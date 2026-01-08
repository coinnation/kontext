import { Principal } from '@dfinity/principal';
import JSZip from 'jszip';
import { userCanisterService } from './UserCanisterService';
import { Identity } from '@dfinity/agent';

// ==================== TYPE DEFINITIONS ====================

export interface PlatformProvidedFile {
  name: string;
  content: string;
  targetDirectory: string;
  isDummy: boolean;
}

export interface FileExtractionResult {
  success: boolean;
  files: PlatformProvidedFile[];
  totalFiles: number;
  validFiles: number;
  skippedFiles: number;
  error?: string;
}

export interface PlatformFileCreationResult {
  success: boolean;
  createdCount: number;
  failedCount: number;
  totalFiles: number;
  errors: Array<{ fileName: string; error: string }>;
}

// ==================== CONSTANTS ====================

const PLATFORM_FILES_URL = 'https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/templates.zip';

// Files that shouldn't be persisted to the project (placeholders/examples)
const DUMMY_FILES = ['App.tsx', 'useCanister.ts'];

// Hook files that should go in the hooks directory
const HOOK_FILES = [
  'useActor.ts',
  'useCommonQueries.ts',
  'useEntityManager.ts',
  'useInternetIdentity.ts',
  'useMutation.ts',
  'useQuery.ts'
];

// Files to skip entirely (macOS metadata, etc.)
const SKIP_PATTERNS = [
  /^__MACOSX\//,
  /^\._/,
  /\.DS_Store$/,
  /Thumbs\.db$/,
  /desktop\.ini$/
];

// ==================== SERVICE CLASS ====================

class PlatformProvidedFilesService {
  
  /**
   * Main entry point: Add platform provided files to a project
   * Uses UserCanisterService.saveCodeArtifacts under the hood
   */
  public async addPlatformFilesToProject(
    projectName: string,
    projectId: string,
    userPrincipal: Principal,
    userCanisterId: string,
    identity: Identity
  ): Promise<void> {
    try {
      console.log(`Adding platform provided files to project: ${projectName}`);
      
      // Step 1: Download and extract files
      const extractionResult = await this.fetchAndExtractPlatformFiles();
      
      if (!extractionResult.success) {
        throw new Error(`Failed to extract platform files: ${extractionResult.error}`);
      }

      console.log(`Extracted ${extractionResult.validFiles} valid files, skipped ${extractionResult.skippedFiles} files`);

      // Step 2: Filter files for creation (exclude dummy files)
      const filesToCreate = extractionResult.files.filter(file => !file.isDummy);
      const dummyFiles = extractionResult.files.filter(file => file.isDummy);

      console.log(`Found ${filesToCreate.length} files to persist, ${dummyFiles.length} dummy files (not persisted)`);
      
      if (dummyFiles.length > 0) {
        console.log('Dummy files (NOT persisted):', dummyFiles.map(f => f.name).join(', '));
      }

      // Log hook files specifically
      const hookFiles = filesToCreate.filter(file => HOOK_FILES.includes(file.name));
      if (hookFiles.length > 0) {
        console.log(`Hook files being added to hooks directory: ${hookFiles.map(f => f.name).join(', ')}`);
      }

      if (filesToCreate.length === 0) {
        console.log('No platform files to create after filtering');
        return;
      }

      // Step 3: Convert to the format expected by UserCanisterService.saveCodeArtifacts
      const filesForSaving: { [key: string]: string } = {};
      
      filesToCreate.forEach(file => {
        // Create the full path key that UserCanisterService expects
        const fullPath = `${file.targetDirectory}/${file.name}`;
        filesForSaving[fullPath] = file.content;
        console.log(`Prepared file for saving: ${fullPath}`);
      });

      // Step 4: Use UserCanisterService.saveCodeArtifacts to save the files
      console.log(`Saving ${Object.keys(filesForSaving).length} platform files using UserCanisterService...`);
      
      const saveResult = await userCanisterService.saveCodeArtifacts(
        filesForSaving,
        projectId,
        userCanisterId,
        identity,
        null, // 🔥 FIX: versionId parameter (null = working copy/sandbox)
        (progress) => {
          console.log(`Platform files save progress: ${progress.percent}% - ${progress.message}`);
        }
      );

      if (saveResult.success) {
        console.log(`Successfully saved platform files: ${saveResult.filesUploaded} created, ${saveResult.filesUpdated} updated`);
        
        if (saveResult.filesFailed && saveResult.filesFailed > 0) {
          console.warn(`Some platform files failed: ${saveResult.filesFailed} failures`);
          saveResult.details?.failed.forEach(failure => {
            console.warn(`- ${failure.fileName}: ${failure.error}`);
          });
        }
      } else {
        throw new Error(`Failed to save platform files: ${saveResult.error}`);
      }

    } catch (error) {
      console.error('Failed to add platform provided files:', error);
      throw error;
    }
  }

  /**
   * Download and extract platform files from ZIP
   */
  private async fetchAndExtractPlatformFiles(): Promise<FileExtractionResult> {
    try {
      console.log(`Downloading platform provided files from: ${PLATFORM_FILES_URL}`);

      // Download ZIP file
      const response = await fetch(PLATFORM_FILES_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to download platform files: ${response.status} ${response.statusText}`);
      }

      const zipBuffer = await response.arrayBuffer();
      
      console.log('Extracting platform provided files...');
      
      // Extract ZIP contents
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(zipBuffer);

      const extractedFiles: PlatformProvidedFile[] = [];
      let totalFiles = 0;
      let skippedFiles = 0;

      // Process each file in the ZIP
      for (const [fileName, zipEntry] of Object.entries(zipContents.files)) {
        totalFiles++;

        // Skip directories
        if (zipEntry.dir) {
          skippedFiles++;
          continue;
        }

        // Check if file should be skipped
        if (this.shouldSkipFile(fileName)) {
          console.log(`Skipping file: ${fileName}`);
          skippedFiles++;
          continue;
        }

        // Extract file content
        const content = await zipEntry.async('text');
        
        // Map file to platform structure
        const platformFile = this.mapFileToPlatformStructure(fileName, content);
        
        if (platformFile) {
          extractedFiles.push(platformFile);
          console.log(`Mapped file: ${fileName} -> ${platformFile.targetDirectory}/${platformFile.name}`);
        } else {
          console.warn(`Failed to map file: ${fileName}`);
          skippedFiles++;
        }
      }

      console.log(`Extracted ${extractedFiles.length} platform provided files`);

      return {
        success: true,
        files: extractedFiles,
        totalFiles,
        validFiles: extractedFiles.length,
        skippedFiles
      };

    } catch (error) {
      console.error('Error fetching platform files:', error);
      return {
        success: false,
        files: [],
        totalFiles: 0,
        validFiles: 0,
        skippedFiles: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if a file should be skipped entirely
   */
  private shouldSkipFile(fileName: string): boolean {
    return SKIP_PATTERNS.some(pattern => pattern.test(fileName));
  }

  /**
   * Map a file from the ZIP to the platform project structure
   */
  private mapFileToPlatformStructure(fileName: string, content: string): PlatformProvidedFile | null {
    try {
      // Clean the filename (remove any path prefixes from ZIP)
      const cleanFileName = fileName.split('/').pop() || fileName;
      
      // Determine target directory based on file extension and content
      const targetDirectory = this.determineTargetDirectory(cleanFileName, content);
      
      // Check if this is a dummy file
      const isDummy = DUMMY_FILES.includes(cleanFileName);

      return {
        name: cleanFileName,
        content,
        targetDirectory,
        isDummy
      };

    } catch (error) {
      console.error(`Error mapping file ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Determine the target directory for a file based on its characteristics
   */
  private determineTargetDirectory(fileName: string, content: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const fileNameLower = fileName.toLowerCase();

    // Backend files (.mo)
    if (extension === 'mo') {
      return 'src/backend/src';
    }

    // Hook files - specifically check for known hook files first
    if (HOOK_FILES.includes(fileName)) {
      console.log(`Routing hook file ${fileName} to hooks directory`);
      return 'src/frontend/src/hooks';
    }

    // Configuration files (check BEFORE source files)
    if (extension === 'js' || extension === 'ts') {
      if (fileNameLower.includes('vite')) return 'src/frontend';
      if (fileNameLower.includes('tailwind')) return 'src/frontend';
      if (fileNameLower.includes('postcss')) return 'src/frontend';
      if (fileNameLower.includes('tsconfig')) return 'src/frontend';
      if (fileNameLower === 'package.json') return 'src/frontend';
    }

    // General hooks detection (files starting with 'use' or containing 'hook')
    if (['tsx', 'ts'].includes(extension)) {
      if (fileNameLower.startsWith('use') || fileNameLower.includes('hook')) {
        console.log(`Routing detected hook file ${fileName} to hooks directory`);
        return 'src/frontend/src/hooks';
      }
    }

    // Frontend SOURCE files - ONLY tsx, ts, jsx (NOT plain .js configs)
    if (['tsx', 'ts', 'jsx'].includes(extension)) {
      // Special handling for index.ts files that might be hook index files
      if (fileName === 'index.ts' && (
        content.includes('useActor') || 
        content.includes('useQuery') || 
        content.includes('useMutation') ||
        content.includes('useEntityManager') ||
        content.includes('useCommonQueries') ||
        content.includes('useInternetIdentity')
      )) {
        console.log(`Routing hooks index file ${fileName} to hooks directory`);
        return 'src/frontend/src/hooks';
      }

      return 'src/frontend/src';
    }

    // HTML files go to frontend root
    if (extension === 'html') {
      return 'src/frontend';
    }

    // package.json
    if (fileName === 'package.json') {
      return 'src/frontend';
    }

    // CSS and styling
    if (['css', 'scss', 'sass'].includes(extension)) {
      return 'src/frontend/src';
    }

    // Default to frontend root for unknown files
    return 'src/frontend';
  }

  /**
   * Get platform-provided Motoko files for Candid extraction
   * Filters the platform files to return only .mo files
   */
  public async getPlatformMotokoFiles(projectName: string): Promise<Array<{ name: string; content: string }>> {
    try {
      console.log(`Getting platform Motoko files for project: ${projectName}`);
      
      // Use existing fetchAndExtractPlatformFiles method
      const extractionResult = await this.fetchAndExtractPlatformFiles();
      
      if (!extractionResult.success) {
        console.warn('Failed to extract platform files for Motoko:', extractionResult.error);
        return [];
      }

      // Filter for .mo files only and format for Candid extraction
      const motokoFiles = extractionResult.files
        .filter(file => file.name.endsWith('.mo'))
        .map(file => ({
          name: `${projectName}/${file.targetDirectory}/${file.name}`,
          content: file.content
        }));

      console.log(`Found ${motokoFiles.length} platform Motoko files for Candid extraction`);
      return motokoFiles;

    } catch (error) {
      console.error('Error getting platform Motoko files:', error);
      return [];
    }
  }
}

// ==================== SINGLETON EXPORT ====================

export const platformProvidedFilesService = new PlatformProvidedFilesService();