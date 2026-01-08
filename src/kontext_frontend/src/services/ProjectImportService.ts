import JSZip from 'jszip';
import { Project, ChatInterfaceMessage, ProjectMetadata, NPMPackageInfo, PackageInfo } from '../types';
import { Principal } from '@dfinity/principal';

export interface ImportValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  projectData?: ImportedProjectData;
}

export interface ImportedProjectData {
  project: Project;
  files: { [fileName: string]: string };
  messages: ChatInterfaceMessage[];
  metadata: {
    originalId: string;
    originalName: string;
    fileCount: number;
    exportDate: number;
    version: string;
  };
}

export interface ImportProgress {
  stage: 'uploading' | 'extracting' | 'validating' | 'processing' | 'creating' | 'complete';
  percent: number;
  message: string;
  filesProcessed?: number;
  totalFiles?: number;
}

export interface ImportResult {
  success: boolean;
  projectId?: string;
  error?: string;
  warnings?: string[];
  failedFiles?: string[];
  uploadStats?: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
}

export class ProjectImportService {
  private static instance: ProjectImportService;
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max ZIP size
  private readonly MAX_PROJECT_FILES = 500; // Max files per project
  private readonly SUPPORTED_VERSIONS = ['1.0', '1.1', '1.2']; // Supported export versions

  // Standard project directory structure patterns that files should start with
  private readonly EXPECTED_PATH_PATTERNS = [
    'src/frontend/',
    'src/backend/',
    'dfx.json',
    'mops.toml',
    'project-spec.json',
    '.gitignore',
    'README.md'
  ];

  static getInstance(): ProjectImportService {
    if (!ProjectImportService.instance) {
      ProjectImportService.instance = new ProjectImportService();
    }
    return ProjectImportService.instance;
  }

  /**
   * Validate and extract project from ZIP file
   */
  async validateAndExtractProject(
    file: File,
    progressCallback?: (progress: ImportProgress) => void
  ): Promise<ImportValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Stage 1: Basic file validation
      progressCallback?.({
        stage: 'uploading',
        percent: 5,
        message: 'Validating file...'
      });

      const basicValidation = this.validateBasicFile(file);
      if (!basicValidation.isValid) {
        return {
          isValid: false,
          errors: basicValidation.errors,
          warnings
        };
      }

      // Stage 2: Extract ZIP contents
      progressCallback?.({
        stage: 'extracting',
        percent: 20,
        message: 'Extracting project archive...'
      });

      const zip = new JSZip();
      const zipContents = await zip.loadAsync(file);

      // Stage 3: Validate ZIP structure
      progressCallback?.({
        stage: 'validating',
        percent: 40,
        message: 'Validating project structure...'
      });

      const structureValidation = await this.validateZipStructure(zipContents);
      if (!structureValidation.isValid) {
        return {
          isValid: false,
          errors: structureValidation.errors,
          warnings
        };
      }

      // Stage 4: Extract and parse project data
      progressCallback?.({
        stage: 'processing',
        percent: 60,
        message: 'Processing project data...'
      });

      const projectData = await this.extractProjectData(zipContents, progressCallback);
      
      // Stage 5: Validate project compatibility
      progressCallback?.({
        stage: 'validating',
        percent: 80,
        message: 'Validating project compatibility...'
      });

      const compatibilityValidation = this.validateProjectCompatibility(projectData);
      errors.push(...compatibilityValidation.errors);
      warnings.push(...compatibilityValidation.warnings);

      progressCallback?.({
        stage: 'complete',
        percent: 100,
        message: 'Validation complete'
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        projectData: errors.length === 0 ? projectData : undefined
      };

    } catch (error) {
      console.error('[ProjectImportService] Validation failed:', error);
      return {
        isValid: false,
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      };
    }
  }

  /**
   * Create project from validated import data with enhanced error reporting
   */
  async createProjectFromImport(
    importData: ImportedProjectData,
    newProjectName?: string,
    progressCallback?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const failedFiles: string[] = [];
    let uploadStats = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };

    try {
      progressCallback?.({
        stage: 'creating',
        percent: 10,
        message: 'Creating new project...'
      });

      // Generate new project with imported data
      const newProject = this.generateNewProjectFromImport(importData, newProjectName);

      // Import the project using existing store methods
      const { useAppStore } = await import('../store/appStore');
      const store = useAppStore.getState();

      // Create project
      const createResult = await store.createProject(newProject);
      if (!createResult) {
        throw new Error('Failed to create project in canister');
      }

      progressCallback?.({
        stage: 'creating',
        percent: 50,
        message: 'Uploading project files...'
      });

      // Upload files with detailed tracking
      const { userCanisterService } = await import('./UserCanisterService');
      
      uploadStats.total = Object.keys(importData.files).length;
      
      const filesResult = await userCanisterService.saveCodeArtifactsParallel(
        importData.files,
        newProject.id,
        store.userCanisterId!,
        store.identity!,
        newProject.name,
        (fileProgress) => {
          uploadStats.successful = fileProgress.created + fileProgress.updated;
          uploadStats.failed = fileProgress.filesFailed;
          
          if (fileProgress.failedFiles && Array.isArray(fileProgress.failedFiles)) {
            failedFiles.length = 0;
            failedFiles.push(...fileProgress.failedFiles);
          }
          
          progressCallback?.({
            stage: 'creating',
            percent: 50 + (uploadStats.successful / uploadStats.total * 40),
            message: `Uploading files: ${uploadStats.successful}/${uploadStats.total}`,
            filesProcessed: uploadStats.successful,
            totalFiles: uploadStats.total
          });
        }
      );

      if (!filesResult.success) {
        throw new Error(`Failed to upload files: ${filesResult.error}`);
      }

      uploadStats.successful = filesResult.filesCreated + filesResult.filesUpdated;
      uploadStats.failed = filesResult.filesFailed;
      uploadStats.skipped = 0;

      progressCallback?.({
        stage: 'creating',
        percent: 90,
        message: 'Finalizing import...'
      });

      // Import messages if any
      if (importData.messages.length > 0) {
        for (const message of importData.messages) {
          try {
            await store.addMessageToProject(newProject.id, {
              ...message,
              id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date()
            });
          } catch (error) {
            console.warn('[ProjectImportService] Failed to import message:', error);
          }
        }
      }

      progressCallback?.({
        stage: 'complete',
        percent: 100,
        message: 'Import complete!'
      });

      const warnings: string[] = [];
      
      if (failedFiles.length > 0) {
        warnings.push(`${failedFiles.length} files failed to import`);
        
        failedFiles.forEach(fileName => {
          warnings.push(`Failed to upload file: ${fileName}`);
        });
        
        if (failedFiles.length < 5) {
          warnings.push('You can recreate these files manually using the chat interface');
        } else {
          warnings.push(`Multiple file failures detected. Consider re-exporting the project and trying again`);
        }
      }

      return {
        success: true,
        projectId: newProject.id,
        warnings,
        failedFiles,
        uploadStats
      };

    } catch (error) {
      console.error('[ProjectImportService] Import failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Import failed',
        failedFiles,
        uploadStats
      };
    }
  }

  /**
   * Basic file validation
   */
  private validateBasicFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      errors.push('File must be a ZIP archive (.zip)');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File too large. Maximum size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate ZIP structure - expects export format with code/ directory
   */
  private async validateZipStructure(zip: JSZip): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for project.json at root (from export process)
    const projectJsonFile = zip.file('project.json');
    if (!projectJsonFile) {
      errors.push('Missing project.json file at archive root');
    }

    // Get all file entries
    const fileEntries = Object.keys(zip.files).filter(name => !zip.files[name].dir);
    console.log('[ProjectImportService] ZIP contents:', fileEntries);

    // Look for code directory structure (from export process)
    const codeFiles = fileEntries.filter(name => name.startsWith('code/'));
    console.log('[ProjectImportService] Files in code directory:', codeFiles);

    // Also check for any files that might be in the root or other directories
    const nonCodeFiles = fileEntries.filter(name => 
      name !== 'project.json' && 
      !name.startsWith('code/') &&
      !name.startsWith('__MACOSX/') &&
      !name.startsWith('.DS_Store')
    );
    
    if (codeFiles.length === 0 && nonCodeFiles.length === 0) {
      errors.push('No project files found in archive');
    }

    // Validate total file count
    const totalProjectFiles = codeFiles.length + nonCodeFiles.length;
    if (totalProjectFiles > this.MAX_PROJECT_FILES) {
      errors.push(`Too many files. Maximum is ${this.MAX_PROJECT_FILES}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Extract project data from ZIP - reverse engineering the export process with aggressive prefix removal
   */
  private async extractProjectData(
    zip: JSZip,
    progressCallback?: (progress: ImportProgress) => void
  ): Promise<ImportedProjectData> {
    try {
      // Extract project.json (created by export process)
      const projectJsonFile = zip.file('project.json')!;
      const projectJsonContent = await projectJsonFile.async('text');
      const exportData = JSON.parse(projectJsonContent);

      console.log('[ProjectImportService] Raw export data:', exportData);

      // Transform project data from export format
      const project = this.transformProjectFromExport(exportData);
      
      // Extract files by aggressively reversing the export process
      const files: { [fileName: string]: string } = {};
      
      // Get all file entries (non-directories, excluding system files)
      const allFileEntries = Object.keys(zip.files).filter(name => 
        !zip.files[name].dir && 
        name !== 'project.json' && 
        !name.startsWith('__MACOSX/') &&
        !name.startsWith('.DS_Store')
      );
      
      console.log('[ProjectImportService] All file entries found:', allFileEntries);
      
      let processedFiles = 0;
      
      for (const filePath of allFileEntries) {
        const file = zip.file(filePath);
        if (file) {
          const content = await file.async('text');
          
          // AGGRESSIVE PREFIX REMOVAL: Clean the file path completely
          const cleanPath = this.aggressivelyCleanFilePath(filePath, exportData);
          
          if (cleanPath && cleanPath.trim() !== '') {
            files[cleanPath] = content;
            console.log(`[ProjectImportService] Cleaned file path: ${filePath} -> ${cleanPath}`);
          } else {
            console.warn(`[ProjectImportService] Skipping file with unresolvable path: ${filePath}`);
          }
          
          processedFiles++;
          progressCallback?.({
            stage: 'processing',
            percent: 60 + (processedFiles / allFileEntries.length) * 20,
            message: `Processing files: ${processedFiles}/${allFileEntries.length}`,
            filesProcessed: processedFiles,
            totalFiles: allFileEntries.length
          });
        }
      }

      console.log('[ProjectImportService] Final cleaned files:', Object.keys(files));

      // Extract messages if they exist in the export
      const messages = exportData.messages ? this.transformMessagesFromExport(exportData.messages) : [];

      return {
        project,
        files,
        messages,
        metadata: {
          originalId: exportData.id || 'unknown',
          originalName: this.extractOptionalValue(exportData.name) || exportData.name || 'Imported Project',
          fileCount: Object.keys(files).length,
          exportDate: exportData.exportDate || Date.now(),
          version: exportData.version || '1.0'
        }
      };
    } catch (error) {
      console.error('[ProjectImportService] Error extracting project data:', error);
      throw new Error(`Failed to extract project data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * AGGRESSIVE PATH CLEANING: Remove all export prefixes to match normal project paths
   */
  private aggressivelyCleanFilePath(rawPath: string, exportData: any): string | null {
    let cleanPath = rawPath;
    
    console.log(`[ProjectImportService] Starting path cleaning for: ${rawPath}`);
    
    // Step 1: Remove the 'code/' prefix from export structure
    if (cleanPath.startsWith('code/')) {
      cleanPath = cleanPath.substring(5); // Remove 'code/' (5 characters)
      console.log(`[ProjectImportService] Removed code/ prefix: ${cleanPath}`);
    }
    
    // Step 2: Get project name from export data to remove as prefix
    const exportProjectName = this.extractOptionalValue(exportData.name) || exportData.name;
    if (exportProjectName && typeof exportProjectName === 'string') {
      // Remove project name prefix if it exists
      const projectPrefix = `${exportProjectName}/`;
      if (cleanPath.startsWith(projectPrefix)) {
        cleanPath = cleanPath.substring(projectPrefix.length);
        console.log(`[ProjectImportService] Removed project name prefix '${projectPrefix}': ${cleanPath}`);
      }
    }
    
    // Step 3: Remove any remaining single directory prefix that doesn't match expected patterns
    // If the path doesn't start with expected patterns, remove the first directory level
    const pathStartsWithExpectedPattern = this.EXPECTED_PATH_PATTERNS.some(pattern => 
      cleanPath.startsWith(pattern)
    );
    
    if (!pathStartsWithExpectedPattern && cleanPath.includes('/')) {
      const pathParts = cleanPath.split('/');
      if (pathParts.length > 1) {
        // Check if removing the first directory would create a valid path
        const withoutFirstDir = pathParts.slice(1).join('/');
        const wouldBeValidWithoutFirstDir = this.EXPECTED_PATH_PATTERNS.some(pattern => 
          withoutFirstDir.startsWith(pattern)
        );
        
        if (wouldBeValidWithoutFirstDir) {
          cleanPath = withoutFirstDir;
          console.log(`[ProjectImportService] Removed unexpected prefix directory: ${cleanPath}`);
        }
      }
    }
    
    // Step 4: Final validation - ensure we have a valid path
    if (!cleanPath || cleanPath.trim() === '') {
      console.warn(`[ProjectImportService] Path became empty after cleaning: ${rawPath}`);
      return null;
    }
    
    // Step 5: Validate the final path makes sense
    const finalPathIsValid = 
      this.EXPECTED_PATH_PATTERNS.some(pattern => cleanPath.startsWith(pattern)) ||
      this.isValidRootFile(cleanPath);
    
    if (!finalPathIsValid) {
      console.warn(`[ProjectImportService] Final path doesn't match expected patterns: ${cleanPath}`);
      // For unknown files, try one more aggressive cleanup
      if (cleanPath.includes('/')) {
        const pathParts = cleanPath.split('/');
        // If it has multiple parts, try removing directories until we find a match
        for (let i = 0; i < pathParts.length - 1; i++) {
          const testPath = pathParts.slice(i).join('/');
          if (this.EXPECTED_PATH_PATTERNS.some(pattern => testPath.startsWith(pattern)) ||
              this.isValidRootFile(testPath)) {
            cleanPath = testPath;
            console.log(`[ProjectImportService] Found valid path after aggressive cleanup: ${cleanPath}`);
            break;
          }
        }
      }
    }
    
    console.log(`[ProjectImportService] Final cleaned path: ${rawPath} -> ${cleanPath}`);
    return cleanPath;
  }

  /**
   * Check if a file is a valid root-level file
   */
  private isValidRootFile(fileName: string): boolean {
    const validRootFiles = [
      'dfx.json',
      'mops.toml', 
      'project-spec.json',
      '.gitignore',
      'README.md'
    ];
    return validRootFiles.includes(fileName);
  }

  /**
   * Transform project data from any export format (Motoko or JavaScript)
   */
  private transformProjectFromExport(exportedProject: any): Project {
    try {
      console.log('[ProjectImportService] Transforming project from export format:', exportedProject);

      // Safely extract the project name
      let projectName = 'Imported Project';
      if (typeof exportedProject.name === 'string') {
        projectName = exportedProject.name;
      } else if (Array.isArray(exportedProject.name) && exportedProject.name.length > 0) {
        projectName = exportedProject.name[0];
      }

      // Safely extract description
      let description: string | undefined;
      const descField = exportedProject.description;
      if (typeof descField === 'string') {
        description = descField;
      } else if (Array.isArray(descField) && descField.length > 0) {
        description = descField[0];
      }

      // Safely extract project type with comprehensive fallback
      let projectType = { name: 'Frontend', subType: 'React' }; // Default fallback
      if (exportedProject.projectType && typeof exportedProject.projectType === 'object') {
        if (exportedProject.projectType.name && exportedProject.projectType.subType) {
          projectType = {
            name: exportedProject.projectType.name,
            subType: exportedProject.projectType.subType
          };
        }
      }

      // Improved timestamp conversion with multiple format support
      const created = this.convertAnyTimestamp(exportedProject.created);
      const updated = this.convertAnyTimestamp(exportedProject.updated);

      // Extract collaborators
      let collaborators: string[] = [];
      if (Array.isArray(exportedProject.collaborators)) {
        if (exportedProject.collaborators.length > 0 && Array.isArray(exportedProject.collaborators[0])) {
          collaborators = exportedProject.collaborators[0];
        } else if (exportedProject.collaborators.length > 0 && typeof exportedProject.collaborators[0] === 'string') {
          collaborators = exportedProject.collaborators;
        }
      }

      // Extract template ID
      let templateId: string | undefined;
      const templateField = exportedProject.templateId;
      if (Array.isArray(templateField) && templateField.length > 0) {
        templateId = templateField[0];
      } else if (typeof templateField === 'string') {
        templateId = templateField;
      }

      // Transform NPM packages with better array handling
      let npmPackages: NPMPackageInfo[] | undefined;
      if (Array.isArray(exportedProject.npmPackages)) {
        if (exportedProject.npmPackages.length > 0) {
          let packagesArray = exportedProject.npmPackages;
          if (Array.isArray(packagesArray[0])) {
            packagesArray = packagesArray[0];
          }
          
          if (Array.isArray(packagesArray)) {
            npmPackages = packagesArray.map((pkg: any) => ({
              name: pkg.name || '',
              version: pkg.version || '1.0.0',
              dependencyType: pkg.dependencyType || 'dependencies'
            }));
          }
        }
      }

      // Transform Motoko packages
      let motokoPackages: PackageInfo[] | undefined;
      if (Array.isArray(exportedProject.motokoPackages) && exportedProject.motokoPackages.length > 0) {
        let packagesArray = exportedProject.motokoPackages;
        if (Array.isArray(packagesArray[0])) {
          packagesArray = packagesArray[0];
        }
        if (Array.isArray(packagesArray)) {
          motokoPackages = packagesArray.map((pkg: any) => ({
            name: pkg.name || '',
            version: pkg.version || '1.0.0',
            repository: pkg.repository || ''
          }));
        }
      }

      // Transform canisters
      let canisters: string[] = [];
      if (Array.isArray(exportedProject.canisters)) {
        canisters = exportedProject.canisters.map((canister: any) => {
          if (typeof canister === 'string') return canister;
          if (canister.__principal__) return canister.__principal__;
          if (canister.toText) return canister.toText();
          return String(canister);
        });
      }

      // Extract working copy base version
      let workingCopyBaseVersion: string | undefined;
      const workingCopyField = exportedProject.workingCopyBaseVersion;
      if (Array.isArray(workingCopyField) && workingCopyField.length > 0) {
        workingCopyBaseVersion = workingCopyField[0];
      } else if (typeof workingCopyField === 'string') {
        workingCopyBaseVersion = workingCopyField;
      }

      // Extract last message time
      let lastMessageTime: number | undefined;
      const lastMsgField = exportedProject.lastMessageTime;
      if (Array.isArray(lastMsgField) && lastMsgField.length > 0) {
        lastMessageTime = this.convertAnyTimestamp(lastMsgField[0]);
      } else if (lastMsgField) {
        lastMessageTime = this.convertAnyTimestamp(lastMsgField);
      }

      // Extract message count
      let messageCount: number | undefined;
      const msgCountField = exportedProject.messageCount;
      if (Array.isArray(msgCountField) && msgCountField.length > 0) {
        messageCount = Number(msgCountField[0]);
      } else if (typeof msgCountField === 'number') {
        messageCount = msgCountField;
      }

      // Transform metadata
      let metadata: ProjectMetadata | undefined;
      const metadataField = exportedProject.metadata;
      if (Array.isArray(metadataField) && metadataField.length > 0) {
        metadata = this.transformProjectMetadata(metadataField[0]);
      } else if (metadataField && typeof metadataField === 'object') {
        metadata = this.transformProjectMetadata(metadataField);
      }

      const transformedProject: Project = {
        id: '', // Will be generated during import
        name: projectName,
        title: projectName, // Ensure title is set for sidebar display
        description,
        projectType,
        canisters,
        created,
        updated,
        visibility: exportedProject.visibility || 'private',
        status: exportedProject.status || 'active',
        collaborators,
        templateId,
        npmPackages,
        motokoPackages,
        workingCopyBaseVersion,
        lastMessageTime,
        messageCount,
        metadata,
        messages: [], // Will be handled separately
        files: {}, // Will be handled separately
        // Add required sidebar display properties
        icon: '📦',
        iconType: 'import',
        preview: description || 'Imported project',
        time: 'Imported',
        isTemplate: false,
        unreadCount: 0
      };

      console.log('[ProjectImportService] Transformed project:', transformedProject);
      return transformedProject;

    } catch (error) {
      console.error('[ProjectImportService] Error transforming project:', error);
      throw new Error(`Failed to transform project: ${error instanceof Error ? error.message : 'Transformation error'}`);
    }
  }

  /**
   * Transform messages from any export format
   */
  private transformMessagesFromExport(exportedMessages: any[]): ChatInterfaceMessage[] {
    try {
      return exportedMessages.map(msg => ({
        id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: this.convertMessageType(msg.messageType),
        content: msg.content || '',
        timestamp: new Date(this.convertAnyTimestamp(msg.timestamp)),
        isGenerating: this.extractOptionalValue(msg.isGenerating) || false,
        metadata: this.extractOptionalValue(msg.metadata)
      }));
    } catch (error) {
      console.error('[ProjectImportService] Error transforming messages:', error);
      return []; // Return empty array if message transformation fails
    }
  }

  /**
   * Validate project compatibility
   */
  private validateProjectCompatibility(projectData: ImportedProjectData): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!projectData.project.name || projectData.project.name.trim() === '') {
      errors.push('Project name is required');
    }

    if (!projectData.project.projectType || !projectData.project.projectType.name) {
      errors.push('Project type is required');
    }

    // Check file types
    const supportedExtensions = ['.mo', '.tsx', '.ts', '.js', '.jsx', '.css', '.html', '.json', '.md', '.toml', '.did'];
    const unsupportedFiles = Object.keys(projectData.files).filter(fileName => {
      const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      return !supportedExtensions.includes(extension);
    });

    if (unsupportedFiles.length > 0) {
      warnings.push(`${unsupportedFiles.length} files with unsupported extensions will be imported as text files`);
    }

    // Check for large files
    const largeFiles = Object.entries(projectData.files).filter(([_, content]) => 
      content.length > 1024 * 1024 // 1MB
    );

    if (largeFiles.length > 0) {
      warnings.push(`${largeFiles.length} large files detected (>1MB each)`);
    }

    // Check for potentially problematic package dependencies
    if (projectData.project.npmPackages) {
      const problemPackages = projectData.project.npmPackages.filter(pkg => 
        pkg.name.includes('native') || pkg.name.includes('node-')
      );
      
      if (problemPackages.length > 0) {
        warnings.push(`${problemPackages.length} packages may not be compatible with browser environment`);
      }
    }

    // Validate that cleaned paths match expected patterns
    const filesWithUnexpectedPaths = Object.keys(projectData.files).filter(filePath => {
      const matchesExpectedPattern = this.EXPECTED_PATH_PATTERNS.some(pattern => 
        filePath.startsWith(pattern)
      );
      const isValidRootFile = this.isValidRootFile(filePath);
      return !matchesExpectedPattern && !isValidRootFile;
    });

    if (filesWithUnexpectedPaths.length > 0) {
      warnings.push(`${filesWithUnexpectedPaths.length} files have unexpected path structures and may not deploy correctly`);
      console.warn('[ProjectImportService] Files with unexpected paths:', filesWithUnexpectedPaths.slice(0, 5));
    }

    return { errors, warnings };
  }

  /**
   * Generate new project from import data
   */
  private generateNewProjectFromImport(importData: ImportedProjectData, newName?: string): Project {
    const now = Date.now();
    const projectId = `imported_${now}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      ...importData.project,
      id: projectId,
      name: newName || `${importData.project.name} (Imported)`,
      title: newName || `${importData.project.name} (Imported)`, // Ensure title matches name
      created: now,
      updated: now,
      canisters: [], // Will be assigned during creation
      messages: [], // Will be added separately
      files: {} // Will be uploaded separately
    };
  }

  // ============= UTILITY METHODS =============

  /**
   * Extract value from optional array format (handles both Motoko and regular arrays)
   */
  private extractOptionalValue<T>(optionalArray: any): T | undefined {
    if (Array.isArray(optionalArray) && optionalArray.length > 0) {
      return optionalArray[0];
    }
    return undefined;
  }

  /**
   * Universal timestamp conversion supporting multiple formats
   */
  private convertAnyTimestamp(timestamp: any): number {
    try {
      if (!timestamp) {
        return Date.now(); // Fallback to current time
      }

      // Handle string timestamps
      if (typeof timestamp === 'string') {
        // Try to parse as number first
        const numericTimestamp = parseFloat(timestamp);
        if (!isNaN(numericTimestamp)) {
          return this.convertNumericTimestamp(numericTimestamp);
        }
        
        // Try to parse as ISO date string
        const dateTimestamp = new Date(timestamp).getTime();
        if (!isNaN(dateTimestamp)) {
          return dateTimestamp;
        }
        
        console.warn('[ProjectImportService] Could not parse string timestamp:', timestamp);
        return Date.now();
      }
      
      // Handle numeric timestamps
      if (typeof timestamp === 'number') {
        return this.convertNumericTimestamp(timestamp);
      }
      
      // Handle BigInt timestamps
      if (typeof timestamp === 'bigint') {
        const numberTimestamp = Number(timestamp);
        return this.convertNumericTimestamp(numberTimestamp);
      }
      
      console.warn('[ProjectImportService] Unknown timestamp format:', typeof timestamp, timestamp);
      return Date.now();
      
    } catch (error) {
      console.error('[ProjectImportService] Error converting timestamp:', error);
      return Date.now();
    }
  }

  /**
   * Convert numeric timestamp handling different scales and decimal precision
   */
  private convertNumericTimestamp(timestamp: number): number {
    try {
      // Check for decimal values - can't convert to BigInt
      if (timestamp % 1 !== 0) {
        console.log('[ProjectImportService] Decimal timestamp detected (likely milliseconds):', timestamp);
        
        // Validate it's a reasonable timestamp
        if (timestamp > 1000000000000 && timestamp < 4102444800000) { // Between 2001 and 2100
          return Math.floor(timestamp); // Remove decimal part
        }
        
        // If it's a smaller decimal, might be seconds with decimal precision
        if (timestamp > 1000000000 && timestamp < 4102444800) { // Between 2001 and 2100 in seconds
          return Math.floor(timestamp * 1000); // Convert to milliseconds
        }
        
        console.warn('[ProjectImportService] Unusual decimal timestamp, using current time:', timestamp);
        return Date.now();
      }
      
      // It's a whole number - determine the scale
      if (timestamp > 1000000000000000) {
        // Likely nanoseconds (Motoko format)
        return Math.floor(timestamp / 1_000_000);
      } else if (timestamp > 1000000000000) {
        // Likely milliseconds (JavaScript format)
        return timestamp;
      } else if (timestamp > 1000000000) {
        // Likely seconds (Unix timestamp)
        return timestamp * 1000;
      }
      
      console.warn('[ProjectImportService] Timestamp scale unclear, assuming milliseconds:', timestamp);
      return timestamp;
      
    } catch (error) {
      console.error('[ProjectImportService] Error in numeric timestamp conversion:', error);
      return Date.now();
    }
  }

  /**
   * Convert message type to chat interface format
   */
  private convertMessageType(messageType: any): 'user' | 'system' | 'assistant' {
    if (typeof messageType === 'object') {
      if ('User' in messageType) return 'user';
      if ('Assistant' in messageType) return 'assistant';
      if ('System' in messageType) return 'system';
    }
    
    if (typeof messageType === 'string') {
      const lower = messageType.toLowerCase();
      if (lower.includes('user')) return 'user';
      if (lower.includes('assistant')) return 'assistant';
      if (lower.includes('system')) return 'system';
    }
    
    return 'system'; // Default fallback
  }

  /**
   * Transform metadata to ProjectMetadata format
   */
  private transformProjectMetadata(metadata: any): ProjectMetadata {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }

    return {
      difficultyLevel: this.extractOptionalValue(metadata.difficultyLevel) || metadata.difficultyLevel,
      externalLinks: this.extractOptionalValue(metadata.externalLinks) || metadata.externalLinks,
      thumbnailUrl: this.extractOptionalValue(metadata.thumbnailUrl) || metadata.thumbnailUrl,
      completionStatus: this.extractOptionalValue(metadata.completionStatus) || metadata.completionStatus,
      lastAccessed: this.convertOptionalTimestamp(metadata.lastAccessed),
      fileCount: this.extractOptionalNumber(metadata.fileCount),
      tags: this.extractOptionalArray(metadata.tags),
      learningObjectives: this.extractOptionalValue(metadata.learningObjectives) || metadata.learningObjectives,
      notes: this.extractOptionalValue(metadata.notes) || metadata.notes,
      customIcon: this.extractOptionalValue(metadata.customIcon) || metadata.customIcon,
      category: this.extractOptionalValue(metadata.category) || metadata.category,
      priority: this.extractOptionalValue(metadata.priority) || metadata.priority,
      isBookmarked: this.extractOptionalValue(metadata.isBookmarked) || metadata.isBookmarked,
      estimatedSize: this.extractOptionalNumber(metadata.estimatedSize),
      customColor: this.extractOptionalValue(metadata.customColor) || metadata.customColor
    };
  }

  private extractOptionalArray<T>(optionalArray: any): T[] {
    if (Array.isArray(optionalArray)) {
      if (optionalArray.length > 0 && Array.isArray(optionalArray[0])) {
        return optionalArray[0];
      }
      return optionalArray;
    }
    return [];
  }

  private extractOptionalNumber(optionalValue: any): number | undefined {
    const value = this.extractOptionalValue(optionalValue) || optionalValue;
    return value !== undefined ? Number(value) : undefined;
  }

  private convertOptionalTimestamp(optionalValue: any): number | undefined {
    const value = this.extractOptionalValue(optionalValue) || optionalValue;
    return value !== undefined ? this.convertAnyTimestamp(value) : undefined;
  }
}

export const projectImportService = ProjectImportService.getInstance();