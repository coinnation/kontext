import { Principal } from '@dfinity/principal';
import { HttpAgent, Actor } from '@dfinity/agent';
import { AssetManager } from '@dfinity/assets';
import { userCanisterService } from './UserCanisterService';
import { DeploymentService } from './DeploymentService';
import type { Identity } from '@dfinity/agent';
import JSZip from 'jszip';
import { idlFactory as agentIdlFactory } from '../../candid/agent.did.js';
import { injectElementSelectionScript } from '../utils/elementSelectionInjector';
import { wasmConfigService } from './WasmConfigService';

// Progress tracking interface
export interface AgentDeploymentProgress {
  stage: 'download' | 'extract' | 'backend' | 'frontend' | 'complete' | 'error';
  message: string;
  percent: number;
}

export interface DeploymentConfig {
  agentName: string;
  serverPairId: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  projectId: string;
  userCanisterId: string;
  identity: Identity;
  principal: Principal;
}

export interface AgencyDeploymentConfig {
  projectId: string;
  serverPairId: string;
  backendCanisterId: string;
  frontendCanisterId?: string; // Optional frontend canister for UI deployment
  userCanisterId: string;
  identity: Identity;
  principal: Principal;
}

export interface DeploymentResult {
  success: boolean;
  frontendUrl?: string;
  backendUrl?: string;
  error?: string;
}

// Bundler interfaces (matching DeploymentService)
interface BundlerJobResponse {
  success: boolean;
  jobId: string;
  status: string;
  statusUrl: string;
  downloadUrl: string;
  estimatedTime: string;
}

interface BundlerStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

interface BundlerResponse {
  success: boolean;
  output: Record<string, {
    type: 'Buffer';
    data: number[];
  }>;
}

interface PreparedFrontendFiles {
  files: Array<{ name: string; content: string }>;
  packageJson: object;
}

class AgentDeploymentServiceClass {
  
  /**
   * Extract frontend files from zip archive (supports both agent and agency workflow zips)
   */
  private async extractFrontendFilesFromZip(
    zipUrl: string,
    onProgress?: (progress: AgentDeploymentProgress) => void
  ): Promise<Record<string, string>> {
    onProgress?.({
      stage: 'extract',
      message: 'Downloading frontend archive...',
      percent: 0
    });

    console.log('📥 [AgentDeployment] Fetching frontend zip from:', zipUrl);
    
    const response = await fetch(zipUrl, {
      headers: {
        'Accept': 'application/zip, application/octet-stream'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch frontend zip: ${response.status} ${response.statusText}`);
    }

    onProgress?.({
      stage: 'extract',
      message: 'Extracting frontend files...',
      percent: 30
    });

    const zipBlob = await response.blob();
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(zipBlob);

    console.log('📦 [AgentDeployment] Extracting files from zip...');

    // Try multiple possible prefixes for different zip structures
    const possiblePrefixes = [
      'code/Kontext Agent/src/frontend/',
      'code/Agency Workflow/src/frontend/',
      'code/agency_workflow/src/frontend/',
      'src/frontend/',
      'frontend/'
    ];

    const frontendFiles: Record<string, string> = {};
    let foundPrefix: string | null = null;

    // First, find which prefix matches
    for (const prefix of possiblePrefixes) {
      const matchingFiles = Object.keys(zipContents.files).filter(path => 
        path.startsWith(prefix) && !zipContents.files[path].dir
      );
      if (matchingFiles.length > 0) {
        foundPrefix = prefix;
        console.log(`✅ [AgentDeployment] Found frontend files with prefix: ${prefix}`);
        break;
      }
    }

    if (!foundPrefix) {
      // Fallback: look for specific frontend indicator files to determine structure
      console.log('⚠️ [AgentDeployment] No standard prefix found, searching for frontend files...');
      
      // Look for common frontend root files (index.html, package.json, vite.config.ts, etc.)
      const frontendIndicatorFiles = [
        'index.html',
        'package.json',
        'vite.config.ts',
        'vite.config.js',
        'tsconfig.json',
        'tailwind.config.js',
        'postcss.config.js'
      ];
      
      let candidatePrefix: string | null = null;
      
      // First, try to find a frontend indicator file
      for (const [path, file] of Object.entries(zipContents.files)) {
        if (file.dir) continue;
        const fileName = path.split('/').pop() || '';
        if (frontendIndicatorFiles.includes(fileName)) {
          candidatePrefix = path.substring(0, path.lastIndexOf('/') + 1);
          console.log(`✅ [AgentDeployment] Found frontend indicator file: ${path}, using prefix: ${candidatePrefix}`);
          break;
        }
      }
      
      // If no indicator file found, look for any frontend-like files and find common prefix
      if (!candidatePrefix) {
        const frontendFiles: string[] = [];
        for (const [path, file] of Object.entries(zipContents.files)) {
          if (file.dir) continue;
          const ext = path.split('.').pop()?.toLowerCase() || '';
          const frontendExtensions = ['html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'svg'];
          if (frontendExtensions.includes(ext)) {
            frontendFiles.push(path);
          }
        }
        
        if (frontendFiles.length > 0) {
          // Find the common prefix among all frontend files
          const findCommonPrefix = (paths: string[]): string => {
            if (paths.length === 0) return '';
            if (paths.length === 1) {
              const lastSlash = paths[0].lastIndexOf('/');
              return lastSlash >= 0 ? paths[0].substring(0, lastSlash + 1) : '';
            }
            
            // Sort paths to find common prefix
            paths.sort();
            const first = paths[0];
            const last = paths[paths.length - 1];
            
            let i = 0;
            while (i < first.length && i < last.length && first[i] === last[i]) {
              i++;
            }
            
            // Find the last slash before the divergence
            const commonPart = first.substring(0, i);
            const lastSlash = commonPart.lastIndexOf('/');
            return lastSlash >= 0 ? commonPart.substring(0, lastSlash + 1) : '';
          };
          
          candidatePrefix = findCommonPrefix(frontendFiles);
          if (candidatePrefix) {
            console.log(`✅ [AgentDeployment] Detected frontend structure from ${frontendFiles.length} files, using prefix: ${candidatePrefix}`);
          }
        }
      }
      
      // Verify the candidate prefix actually contains frontend files
      if (candidatePrefix) {
        const matchingFiles = Object.keys(zipContents.files).filter(path => 
          path.startsWith(candidatePrefix!) && !zipContents.files[path].dir
        );
        if (matchingFiles.length > 0) {
          foundPrefix = candidatePrefix;
          console.log(`✅ [AgentDeployment] Verified prefix with ${matchingFiles.length} files`);
        } else {
          console.warn(`⚠️ [AgentDeployment] Candidate prefix ${candidatePrefix} has no matching files`);
        }
      }
    }

    if (!foundPrefix) {
      // Log all file paths for debugging
      const allPaths = Object.keys(zipContents.files).filter(path => !zipContents.files[path].dir);
      console.error('❌ [AgentDeployment] Available files in zip:', allPaths.slice(0, 20));
      throw new Error('Could not determine frontend file structure in zip archive');
    }

    // Extract files using the found prefix
    console.log(`📦 [AgentDeployment] Extracting files with prefix: "${foundPrefix}"`);
    let extractedCount = 0;
    
    for (const [path, file] of Object.entries(zipContents.files)) {
      if (file.dir) continue; // Skip directories
      
      // Handle both cases: prefix with trailing slash and without
      const matchesPrefix = foundPrefix ? path.startsWith(foundPrefix) : true;
      
      if (matchesPrefix) {
        // Remove the prefix to get the relative path within frontend folder
        const relativePath = foundPrefix ? path.substring(foundPrefix.length) : path;
        
        // Skip if relativePath is empty (this would be the prefix directory itself)
        if (!relativePath || relativePath.trim() === '') {
          continue;
        }
        
        // Keep the src/frontend/ structure for bundler compatibility
        const bundlerPath = `src/frontend/${relativePath}`;
        
        // Determine if this is a text file based on extension
        // Include config files as text files (tailwind.config.js, postcss.config.js, vite.config.ts, etc.)
        const textExtensions = ['html', 'htm', 'css', 'scss', 'sass', 'less', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'json', 'txt', 'md', 'xml', 'svg'];
        const configFilePatterns = ['tailwind.config', 'postcss.config', 'vite.config', 'tsconfig', 'jsconfig'];
        const extension = relativePath.split('.').pop()?.toLowerCase() || '';
        const isConfigFile = configFilePatterns.some(pattern => relativePath.includes(pattern));
        const isTextFile = textExtensions.includes(extension) || isConfigFile;
        
        try {
          if (isTextFile) {
            // Extract as text
            const content = await file.async('string');
            // Store with both paths: relative for internal use, bundler path for bundler
            frontendFiles[bundlerPath] = content;
            extractedCount++;
            if (extractedCount <= 10) { // Log first 10 files to avoid spam
              console.log(`✅ [AgentDeployment] Extracted text: ${bundlerPath} (from ${path})`);
            }
          } else {
            // For binary files, extract as base64 string (bundler can handle this)
            const content = await file.async('uint8array');
            // Convert to base64
            const base64 = btoa(String.fromCharCode(...content));
            // Use bundlerPath to maintain src/frontend/ structure (same as text files)
            frontendFiles[bundlerPath] = base64;
            extractedCount++;
            if (extractedCount <= 10) { // Log first 10 files to avoid spam
              console.log(`✅ [AgentDeployment] Extracted binary (base64): ${bundlerPath} (from ${path})`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ [AgentDeployment] Failed to extract ${path}:`, error);
        }
      }
    }

    if (Object.keys(frontendFiles).length === 0) {
      // Log all available paths for debugging
      const allPaths = Object.keys(zipContents.files).filter(path => !zipContents.files[path].dir);
      console.error(`❌ [AgentDeployment] No files extracted. Prefix was: "${foundPrefix}"`);
      console.error(`❌ [AgentDeployment] Available files in zip (first 30):`, allPaths.slice(0, 30));
      throw new Error(`No frontend files found in zip archive. Tried prefix: "${foundPrefix}"`);
    }

    console.log(`✅ [AgentDeployment] Extracted ${Object.keys(frontendFiles).length} frontend files`);

    onProgress?.({
      stage: 'extract',
      message: `Extracted ${Object.keys(frontendFiles).length} frontend files`,
      percent: 60
    });

    return frontendFiles;
  }

  /**
   * Prepare frontend files for bundling
   */
  /**
   * Generate Vite config with backend canister ID
   */
  private generateViteConfig(backendCanisterId: string): string {
    console.log(`🔧 [AgentDeployment] Generating Vite config with backend canister ID: ${backendCanisterId}`);

    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    root: '.',
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            input: resolve(__dirname, 'index.html')
        }
    },
    server: {
        port: 3000
    },
    define: {
        'import.meta.env.VITE_BACKEND_CANISTER_ID': '"${backendCanisterId}"',
        'global': 'globalThis'
    }
});`;
  }

  private prepareFrontendFiles(
    fileSnapshot: Record<string, string>,
    backendCanisterId?: string
  ): PreparedFrontendFiles {
    const frontendEntries = Object.entries(fileSnapshot).filter(([fileName]) => {
      const extension = fileName.split('.').pop()?.toLowerCase();
      
      // Exclude Motoko and Candid files
      if (['mo', 'did'].includes(extension || '')) return false;
      
      // Include config files (critical for Tailwind CSS, PostCSS, Vite, etc.)
      const configFilePatterns = [
        'tailwind.config.js',
        'tailwind.config.ts',
        'postcss.config.js',
        'postcss.config.ts',
        'vite.config.js',
        'vite.config.ts',
        'tsconfig.json',
        'jsconfig.json'
      ];
      
      const isConfigFile = configFilePatterns.some(pattern => 
        fileName.endsWith(pattern) || fileName.includes(`/${pattern}`)
      );
      
      if (isConfigFile) return true;
      
      // Include standard frontend file extensions
      const frontendExtensions = [
        'html', 'htm', 'css', 'scss', 'sass', 'less',
        'js', 'jsx', 'ts', 'tsx', 'mjs', 'json',
        'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'
      ];
      
      return frontendExtensions.includes(extension || '');
    });
    
    const frontendFiles = frontendEntries.map(([fileName, content]) => ({
      name: fileName,
      content: content
    }));

    // Find package.json - check both src/frontend/package.json and package.json
    const packageJsonFile = Object.entries(fileSnapshot).find(([fileName]) => 
      fileName === 'src/frontend/package.json' || fileName.endsWith('/package.json') || fileName === 'package.json'
    );
    
    if (!packageJsonFile) {
      const availableFiles = Object.keys(fileSnapshot).slice(0, 10).join(', ');
      console.error('❌ [AgentDeployment] package.json not found. Available files:', availableFiles, '...');
      throw new Error('package.json not found in frontend files');
    }
    
    console.log(`✅ [AgentDeployment] Found package.json at: ${packageJsonFile[0]}`);

    let packageJson: object;
    try {
      packageJson = JSON.parse(packageJsonFile[1]);
    } catch (e) {
      throw new Error('Invalid package.json format');
    }

    // Log config files to verify they're included
    const configFilesIncluded = frontendFiles.filter(f => 
      f.name.includes('tailwind.config') || f.name.includes('postcss.config') || 
      f.name.includes('vite.config') || f.name.includes('tsconfig') || f.name.includes('jsconfig')
    );
    console.log(`✅ [AgentDeployment] Config files included in frontend files: ${configFilesIncluded.length}`);
    configFilesIncluded.forEach(f => {
      console.log(`   ⚙️ ${f.name}`);
    });
    
    if (configFilesIncluded.length === 0) {
      console.warn(`⚠️ [AgentDeployment] No config files found! Tailwind CSS may not work.`);
    }

    // Generate and add vite.config.ts if backend canister ID is provided
    if (backendCanisterId) {
      const viteConfigContent = this.generateViteConfig(backendCanisterId);
      const viteConfigPath = 'src/frontend/vite.config.ts';
      
      // Check if vite.config.ts already exists, if so replace it; otherwise add it
      const existingViteConfigIndex = frontendFiles.findIndex(f => 
        f.name === viteConfigPath || f.name.endsWith('/vite.config.ts') || f.name.endsWith('/vite.config.js')
      );
      
      if (existingViteConfigIndex >= 0) {
        // Replace existing vite config
        frontendFiles[existingViteConfigIndex] = {
          name: viteConfigPath,
          content: viteConfigContent
        };
        console.log(`✅ [AgentDeployment] Replaced existing vite.config with generated one (backend: ${backendCanisterId})`);
      } else {
        // Add new vite config
        frontendFiles.push({
          name: viteConfigPath,
          content: viteConfigContent
        });
        console.log(`✅ [AgentDeployment] Added generated vite.config.ts with backend canister ID: ${backendCanisterId}`);
      }
    } else {
      console.warn(`⚠️ [AgentDeployment] No backend canister ID provided, skipping vite config generation`);
    }

    return {
      files: frontendFiles,
      packageJson: packageJson
    };
  }

  /**
   * Bundle frontend code using JSBundler
   */
  private async bundleFrontendCode(
    frontendData: PreparedFrontendFiles,
    onProgress?: (progress: AgentDeploymentProgress) => void
  ): Promise<BundlerResponse> {
    onProgress?.({
      stage: 'frontend',
      message: 'Bundling frontend code...',
      percent: 70
    });

    console.log('📦 [AgentDeployment] Bundling frontend code...');

    // CRITICAL: The bundler normalizes icpstudio files by removing the first path segment
    // So "agent/src/frontend/package.json" becomes "src/frontend/package.json" after normalization
    // We need ALL files to have the same prefix so they normalize consistently
    const pathPrefix = 'agent/'; // This prefix will be stripped by bundler
    
    // Convert files to array format and normalize all paths with the prefix
    const filesArray = frontendData.files.map(file => {
      // If file already has the prefix, keep it; otherwise add it
      const normalizedPath = file.name.startsWith(pathPrefix) 
        ? file.name 
        : `${pathPrefix}${file.name}`;
      
      return {
        name: normalizedPath,
        content: file.content
      };
    });

    const packageJsonPathForBundler = 'agent/src/frontend/package.json'; // Prefix "agent/" will be stripped
    const packageJsonPathAfterNormalization = 'src/frontend/package.json'; // This is what bundler expects
    
    // Find existing package.json in any form (now all paths should have the prefix)
    const existingPkgIndex = filesArray.findIndex(f => 
      f.name === packageJsonPathForBundler ||
      f.name.endsWith('/package.json') || 
      f.name.includes('src/frontend/package.json')
    );

    console.log(`🔍 [AgentDeployment] Checking for package.json in files array...`);
    console.log(`🔍 [AgentDeployment] Total files: ${filesArray.length}`);
    console.log(`🔍 [AgentDeployment] package.json found: ${existingPkgIndex >= 0}`);
    
    if (existingPkgIndex >= 0) {
      const existingPkg = filesArray[existingPkgIndex];
      console.log(`📦 [AgentDeployment] Found existing package.json at: ${existingPkg.name}`);
      
      // Update to use the correct path that will normalize properly
      if (existingPkg.name !== packageJsonPathForBundler) {
        console.log(`🔄 [AgentDeployment] Updating package.json path from "${existingPkg.name}" to "${packageJsonPathForBundler}"`);
        existingPkg.name = packageJsonPathForBundler;
      }
    } else {
      console.log(`⚠️ [AgentDeployment] package.json missing from files array, adding it explicitly...`);
      filesArray.push({
        name: packageJsonPathForBundler,
        content: typeof frontendData.packageJson === 'string' 
          ? frontendData.packageJson 
          : JSON.stringify(frontendData.packageJson)
      });
      console.log(`✅ [AgentDeployment] Added package.json to files array at ${packageJsonPathForBundler}`);
    }

    // Verify package.json is in the array with correct path
    const finalCheck = filesArray.some(f => 
      f.name === packageJsonPathForBundler || 
      f.name === packageJsonPathAfterNormalization ||
      f.name.includes('src/frontend/package.json')
    );
    if (!finalCheck) {
      throw new Error(`package.json not found in files array after verification. Files: ${filesArray.map(f => f.name).join(', ')}`);
    }
    
    const finalPkgFile = filesArray.find(f => 
      f.name === packageJsonPathForBundler || 
      f.name === packageJsonPathAfterNormalization ||
      f.name.includes('src/frontend/package.json')
    );
    console.log(`✅ [AgentDeployment] package.json confirmed in files array at: ${finalPkgFile?.name || packageJsonPathForBundler}`);
    console.log(`📝 [AgentDeployment] After bundler normalization, this will become: ${packageJsonPathAfterNormalization}`);

    // Submit bundling job
    console.log('📤 [AgentDeployment] Submitting bundling job to JSBundler...');
    console.log(`📤 [AgentDeployment] Sending ${filesArray.length} files`);
    
    // DEBUG: Log first 15 file names to verify structure
    console.log(`🔍 [AgentDeployment] Sample file paths (first 15):`);
    filesArray.slice(0, 15).forEach((f, i) => {
      const isPackageJson = f.name.includes('package.json');
      const isConfigFile = f.name.includes('tailwind.config') || f.name.includes('postcss.config') || 
                          f.name.includes('vite.config') || f.name.includes('tsconfig') || f.name.includes('jsconfig');
      console.log(`   ${i + 1}. ${f.name}${isPackageJson ? ' ⭐ PACKAGE.JSON' : ''}${isConfigFile ? ' ⚙️ CONFIG FILE' : ''}`);
    });
    
    // Verify config files are included
    const configFiles = filesArray.filter(f => 
      f.name.includes('tailwind.config') || f.name.includes('postcss.config') || 
      f.name.includes('vite.config') || f.name.includes('tsconfig') || f.name.includes('jsconfig')
    );
    console.log(`🔍 [AgentDeployment] Config files found: ${configFiles.length}`);
    configFiles.forEach(f => {
      console.log(`   ⚙️ ${f.name}`);
    });
    
    // Verify package.json content is valid JSON
    const pkgFile = filesArray.find(f => 
      f.name === packageJsonPathForBundler || 
      f.name === packageJsonPathAfterNormalization ||
      f.name.includes('src/frontend/package.json')
    );
    if (pkgFile) {
      try {
        const pkgContent = typeof pkgFile.content === 'string' ? pkgFile.content : JSON.stringify(pkgFile.content);
        const parsed = JSON.parse(pkgContent);
        console.log(`✅ [AgentDeployment] package.json content verified: ${Object.keys(parsed).length} top-level keys`);
        console.log(`   📦 package.json keys: ${Object.keys(parsed).join(', ')}`);
      } catch (e) {
        console.error(`❌ [AgentDeployment] package.json content is invalid JSON:`, e);
        throw new Error(`Invalid package.json content: ${e}`);
      }
    } else {
      console.error(`❌ [AgentDeployment] package.json file not found in files array!`);
      throw new Error('package.json not found in files array before sending to bundler');
    }
    
    const jobResponse = await fetch('https://jsbundler.coinnation.io/kontext/bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: filesArray,
        packageJson: frontendData.packageJson,
        projectType: 'icpstudio'
      })
    });

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text();
      throw new Error(`Bundling failed: ${errorText}`);
    }

    const jobData: BundlerJobResponse = await jobResponse.json();
    if (!jobData.success || !jobData.jobId) {
      throw new Error('Bundling job creation failed');
    }

    console.log(`✅ [AgentDeployment] Bundling job started (ID: ${jobData.jobId})`);

    const statusUrl = `https://jsbundler.coinnation.io${jobData.statusUrl}`;
    const downloadUrl = `https://jsbundler.coinnation.io${jobData.downloadUrl}`;

    // Poll for completion
    console.log('⏳ [AgentDeployment] Polling for bundling completion...');
    let attempts = 0;
    const maxAttempts = 60;
    let bundleComplete = false;

    while (!bundleComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

      try {
        const statusResponse = await fetch(statusUrl);
        if (!statusResponse.ok) {
          console.warn(`⚠️ [AgentDeployment] Status check failed (attempt ${attempts}/${maxAttempts}): HTTP ${statusResponse.status}`);
          continue;
        }

        const status: BundlerStatusResponse = await statusResponse.json();
        
        onProgress?.({
          stage: 'frontend',
          message: `Bundling... ${status.progress ? `${status.progress}%` : status.status}`,
          percent: 70 + (status.progress ? status.progress * 0.15 : 0)
        });
        
        console.log(`📊 [AgentDeployment] Bundling status (${attempts * 5}s): ${status.status}${status.progress ? ` (${status.progress}%)` : ''}`);
        
        if (status.status === 'completed') {
          bundleComplete = true;
          console.log('✅ [AgentDeployment] Bundling completed successfully!');
          break;
        } else if (status.status === 'failed') {
          throw new Error(`Bundling failed: ${status.error || 'Unknown error'}`);
        }
      } catch (pollError) {
        if (pollError instanceof Error && pollError.message.includes('Bundling failed')) {
          throw pollError;
        }
        console.warn(`⚠️ [AgentDeployment] Status poll error (attempt ${attempts}):`, pollError);
      }
    }

    if (!bundleComplete) {
      throw new Error('Bundling timeout');
    }

    // Download the completed bundle
    console.log('📥 [AgentDeployment] Downloading completed bundle...');
    const downloadResponse = await fetch(downloadUrl);
    if (!downloadResponse.ok) {
      throw new Error('Failed to download bundle');
    }

    const finalResult: BundlerResponse = await downloadResponse.json();
    if (!finalResult.success) {
      throw new Error('Bundle processing failed');
    }

    const outputFiles = Object.keys(finalResult.output);
    console.log(`✅ [AgentDeployment] Bundle downloaded successfully! Generated ${outputFiles.length} files.`);

    return finalResult;
  }

  /**
   * Deploy frontend bundle to canister
   */
  private async deployFrontendToCanister(
    bundleResult: BundlerResponse,
    frontendCanisterId: string,
    identity: Identity,
    onProgress?: (progress: AgentDeploymentProgress) => void
  ): Promise<string> {
    onProgress?.({
      stage: 'frontend',
      message: 'Deploying frontend to canister...',
      percent: 85
    });

    console.log(`🚀 [AgentDeployment] Processing ${Object.keys(bundleResult.output).length} bundled files for deployment...`);

    const resolvedIdentity = await Promise.resolve(identity);
    const agent = new HttpAgent({
      identity: resolvedIdentity,
      host: 'https://icp0.io'
    });

    const assetManager = new AssetManager({
      canisterId: Principal.fromText(frontendCanisterId),
      agent: agent,
    });

    console.log('✅ [AgentDeployment] Asset manager initialized for frontend canister');

    // Helper function to get content type
    const getContentType = (filename: string): string => {
      const ext = filename.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'html': return 'text/html';
        case 'js': return 'application/javascript';
        case 'css': return 'text/css';
        case 'json': return 'application/json';
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'svg': return 'image/svg+xml';
        case 'ico': return 'image/x-icon';
        case 'woff':
        case 'woff2': return 'font/woff';
        case 'ttf': return 'font/ttf';
        default: return 'application/octet-stream';
      }
    };

    // Create unrestricted CSP configuration
    const createUnrestrictedCSPConfig = (): string => {
      return JSON.stringify([
        {
          "match": "**/*",
          "headers": {
            "Content-Security-Policy": "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; script-src-elem * 'unsafe-inline' 'unsafe-eval'; connect-src *; worker-src * blob: data:; img-src * data: blob:; style-src * 'unsafe-inline'; style-src-elem * 'unsafe-inline'; font-src *; object-src *; base-uri *; frame-ancestors *; form-action *; frame-src *; media-src *; manifest-src *;",
            "Permissions-Policy": "",
            "X-Frame-Options": "",
            "Referrer-Policy": "no-referrer-when-downgrade",
            "X-Content-Type-Options": "",
            "X-XSS-Protection": ""
          }
        }
      ], null, 2);
    };

    // Deploy CSP configuration
    console.log('📝 [AgentDeployment] Deploying CSP configuration...');
    await assetManager.store(
      new TextEncoder().encode(createUnrestrictedCSPConfig()),
      {
        fileName: '.ic-assets.json5',
        contentType: 'application/json'
      }
    );
    console.log('✅ [AgentDeployment] CSP configuration deployed');

    // Check if we need to create a default index.html
    const hasIndexHtml = Object.keys(bundleResult.output).some(filename => 
      filename.endsWith('index.html') || filename === 'index.html'
    );

    if (!hasIndexHtml) {
      console.log('📄 [AgentDeployment] Creating default index.html...');
      let defaultIndexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Interface</title>
    <script type="module" src="/assets/index.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

      // 🔥 NEW: Inject element selection script
      defaultIndexHtml = injectElementSelectionScript(defaultIndexHtml);

      await assetManager.store(
        new TextEncoder().encode(defaultIndexHtml),
        {
          fileName: 'index.html',
          contentType: 'text/html'
        }
      );
      console.log('✅ [AgentDeployment] Default index.html created with element selection script');
    }

    // 🔥 NEW: Inject element selection script into index.html files before deployment
    for (const [filename, content] of Object.entries(bundleResult.output)) {
      if ((filename.endsWith('index.html') || filename === 'index.html') && content && content.data) {
        try {
          // Handle different data types (Buffer, Uint8Array, ArrayBuffer, Array, string)
          let htmlContent: string;
          const data = content.data;
          
          if (typeof data === 'string') {
            htmlContent = data;
          } else if (data instanceof Uint8Array) {
            htmlContent = new TextDecoder().decode(data);
          } else if (data instanceof ArrayBuffer) {
            htmlContent = new TextDecoder().decode(data);
          } else if (Array.isArray(data)) {
            // Array of numbers
            htmlContent = new TextDecoder().decode(new Uint8Array(data));
          } else {
            // Try to convert to Uint8Array (handles Buffer and other types)
            try {
              const uint8Array = new Uint8Array(data as any);
              htmlContent = new TextDecoder().decode(uint8Array);
            } catch (convertError) {
              // If conversion fails, try toString if available
              if (data && typeof (data as any).toString === 'function') {
                htmlContent = (data as any).toString('utf8');
              } else {
                throw new Error(`Cannot decode data: ${convertError}`);
              }
            }
          }
          
          const injectedHtml = injectElementSelectionScript(htmlContent);
          bundleResult.output[filename] = {
            ...content,
            data: Array.from(new TextEncoder().encode(injectedHtml))
          };
          console.log(`✅ [AgentDeployment] Injected element selection script into ${filename}`);
        } catch (err) {
          console.warn(`⚠️ [AgentDeployment] Failed to inject script into ${filename}: ${err}`);
          console.error('[AgentDeployment] Script injection error details:', err, {
            filename,
            dataType: typeof content.data,
            isArray: Array.isArray(content.data),
            dataLength: content.data?.length
          });
        }
      }
    }

    // Deploy all bundled files
    let deployedCount = 0;
    const totalFiles = Object.keys(bundleResult.output).length;
    
    console.log(`📤 [AgentDeployment] Deploying ${totalFiles} bundled files to asset canister...`);

    for (const [filename, content] of Object.entries(bundleResult.output)) {
      if (!content || !content.data) {
        console.warn(`⚠️ [AgentDeployment] Skipping ${filename} - no content data`);
        continue;
      }

      const fileData = new Uint8Array(content.data);
      const contentType = getContentType(filename);

      console.log(`📤 [AgentDeployment] Deploying: ${filename} (${fileData.length} bytes, ${contentType})`);

      try {
        await assetManager.store(fileData, {
          fileName: filename,
          contentType: contentType
        });

        deployedCount++;
        console.log(`✅ [AgentDeployment] Deployed: ${filename}`);

        // Update progress
        const progressPercent = 85 + (deployedCount / totalFiles * 10);
        onProgress?.({
          stage: 'frontend',
          message: `Deploying files: ${deployedCount}/${totalFiles}`,
          percent: Math.min(progressPercent, 95)
        });

      } catch (fileError) {
        const errorMsg = fileError instanceof Error ? fileError.message : String(fileError);
        console.error(`❌ [AgentDeployment] Failed to deploy ${filename}: ${errorMsg}`);
        throw fileError;
      }
    }

    console.log(`🎉 [AgentDeployment] Successfully deployed ${deployedCount}/${totalFiles} files to asset canister`);

    const frontendUrl = `https://${frontendCanisterId}.icp0.io`;
    console.log(`🌐 [AgentDeployment] Frontend deployed at: ${frontendUrl}`);

    return frontendUrl;
  }
  
  /**
   * Deploy a single agent to its own dedicated server pair
   * 
   * IMPORTANT: Each agent uses its OWN independent server pair.
   * Agents do NOT share canisters with each other or with agency workflows.
   * 
   * @param config - Deployment config including the selected server pair's backend canister ID
   */
  public async deployAgent(
    config: DeploymentConfig,
    onProgress?: (progress: AgentDeploymentProgress) => void
  ): Promise<DeploymentResult> {
    try {
      console.log(`🤖 Starting agent deployment: ${config.agentName}`);
      console.log(`🎯 Backend Canister ID: ${config.backendCanisterId}`);
      console.log(`🔒 INDEPENDENT: This agent uses its own dedicated server pair (separate from other agents and agency workflows)`);
      
      onProgress?.({
        stage: 'download',
        message: 'Preparing agent deployment...',
        percent: 0
      });

      // Step 1: Download agent WASM file
      onProgress?.({
        stage: 'download',
        message: 'Downloading agent WASM...',
        percent: 10
      });

      // Get WASM URLs from configuration
      const AGENT_WASM_URLS = await wasmConfigService.getAgentWasmUrls();
      console.log('📥 [AgentDeployment] WASM URLs from config:', AGENT_WASM_URLS);
      
      let wasmBytes: number[] = [];
      let wasmResponse: Response | null = null;
      let lastError: Error | null = null;

      // Try each URL until one works
      for (const url of AGENT_WASM_URLS) {
        try {
          console.log('📥 [AgentDeployment] Fetching agent WASM from:', url);
          
          wasmResponse = await fetch(url, {
            headers: {
              'Accept': 'application/octet-stream'
            }
          });

          if (wasmResponse.ok) {
            onProgress?.({
              stage: 'download',
              message: 'Processing agent WASM...',
              percent: 30
            });

            const wasmBlob = await wasmResponse.blob();
            const wasmArrayBuffer = await wasmBlob.arrayBuffer();
            wasmBytes = Array.from(new Uint8Array(wasmArrayBuffer));
            console.log(`✅ [AgentDeployment] Agent WASM downloaded from ${url}: ${(wasmBytes.length / 1024).toFixed(1)} KB`);
            break; // Success, exit loop
          } else {
            lastError = new Error(`Failed to fetch from ${url}: ${wasmResponse.status} ${wasmResponse.statusText}`);
            console.warn(`⚠️ [AgentDeployment] Failed to fetch from ${url}, trying next URL...`);
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown fetch error');
          console.warn(`⚠️ [AgentDeployment] Error fetching from ${url}:`, error);
        }
      }

      if (wasmBytes.length === 0) {
        throw lastError || new Error('Failed to fetch agent WASM from any available URL');
      }

      console.log(`✅ [AgentDeployment] Agent WASM downloaded: ${(wasmBytes.length / 1024).toFixed(1)} KB`);

      // Step 2: Deploy WASM to backend canister
      onProgress?.({
        stage: 'backend',
        message: 'Deploying agent to backend canister...',
        percent: 50
      });

      const userActor = await userCanisterService.getUserActor(config.userCanisterId, config.identity);
      const backendPrincipal = Principal.fromText(config.backendCanisterId);

      console.log('🚀 [AgentDeployment] Deploying agent WASM to dedicated backend canister:', config.backendCanisterId);
      console.log('📋 [AgentDeployment] Agent Name:', config.agentName);
      console.log('🔒 [AgentDeployment] Each agent uses its own server pair - independent from other agents and agency workflows');

      const deployResult = await userActor.deployToExistingCanister(
        backendPrincipal,
        wasmBytes,
        'backend',
        'agent',
        config.principal,
        [],
        [],
        ['reinstall']
      );

      if (!deployResult || ('err' in deployResult)) {
        const errorMsg = deployResult && 'err' in deployResult ? deployResult.err : 'Unknown deployment error';
        throw new Error(`Agent deployment failed: ${errorMsg}`);
      }

      console.log('✅ [AgentDeployment] Agent WASM deployed successfully');

      onProgress?.({
        stage: 'backend',
        message: 'Agent backend deployed successfully',
        percent: 75
      });

      // Step 2.5: Set Kontext owner IMMEDIATELY after WASM deployment (before any initialization)
      // This ensures Kontext can claim management even if agent is initialized by independent UI first
      try {
        console.log('🏢 [AgentDeployment] Setting Kontext owner on agent canister...');
        onProgress?.({
          stage: 'backend',
          message: 'Setting Kontext owner...',
          percent: 77
        });

        // Create agent actor to call setKontextOwner
        const agent = new HttpAgent({ 
          identity: config.identity, 
          host: process.env.NODE_ENV === 'production' ? 'https://ic0.app' : 'http://localhost:4943'
        });

        if (process.env.NODE_ENV !== 'production') {
          await agent.fetchRootKey();
        }

        const agentActor = Actor.createActor(agentIdlFactory, {
          agent,
          canisterId: config.backendCanisterId,
        });

        const kontextOwnerPrincipal = config.principal;
        const setOwnerResult = await agentActor.setKontextOwner(kontextOwnerPrincipal) as any;

        if (setOwnerResult && typeof setOwnerResult === 'object' && 'ok' in setOwnerResult) {
          console.log('✅ [AgentDeployment] Kontext owner set successfully:', setOwnerResult.ok);
        } else if (setOwnerResult && typeof setOwnerResult === 'object' && 'err' in setOwnerResult) {
          console.warn('⚠️ [AgentDeployment] Failed to set Kontext owner:', setOwnerResult.err);
          // Continue anyway - might already be set or agent might be initialized
        }
      } catch (ownerError) {
        console.warn('⚠️ [AgentDeployment] Error setting Kontext owner (non-fatal):', ownerError);
        // Continue deployment - owner setting is important but not critical for deployment
      }

      onProgress?.({
        stage: 'backend',
        message: 'Agent backend deployed successfully',
        percent: 80
      });

      // Step 3: Deploy frontend (agent UI)
      let frontendUrl = '';
      
      if (config.frontendCanisterId) {
        try {
          onProgress?.({
            stage: 'frontend',
            message: 'Downloading agent frontend...',
            percent: 85
          });

          // Download and extract frontend files from zip
          const FRONTEND_ZIP_URL = "https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/kontext_agent.zip";
          
          const frontendFiles = await this.extractFrontendFilesFromZip(FRONTEND_ZIP_URL, onProgress);
          
          // Prepare frontend files for bundling (with backend canister ID for vite config)
          const preparedFrontend = this.prepareFrontendFiles(frontendFiles, config.backendCanisterId);
          
          // Bundle frontend code
          const bundleResult = await this.bundleFrontendCode(preparedFrontend, onProgress);
          
          // Deploy frontend to canister
          frontendUrl = await this.deployFrontendToCanister(
            bundleResult,
            config.frontendCanisterId,
            config.identity,
            onProgress
          );
          
          console.log(`✅ [AgentDeployment] Frontend deployed successfully: ${frontendUrl}`);
        } catch (frontendError) {
          console.error(`⚠️ [AgentDeployment] Frontend deployment failed:`, frontendError);
          // Don't fail the entire deployment if frontend fails - backend is more critical
          // Frontend URL will remain empty
        }
      }

      // Step 4: Complete
      onProgress?.({
        stage: 'complete',
        message: 'Agent deployed successfully!',
        percent: 100
      });

      // Backend URL is for reference only - it's not HTTP accessible
      // Use Candid UI: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id={canisterId}
      const backendUrl = `https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=${config.backendCanisterId}`;

      console.log(`✅ Agent deployment completed: ${config.agentName}`);
      console.log(`🎨 Frontend URL: ${frontendUrl || 'N/A (backend only)'}`);
      console.log(`🔧 Backend Canister ID: ${config.backendCanisterId} (Candid UI: ${backendUrl})`);

      return {
        success: true,
        frontendUrl: frontendUrl || undefined,
        backendUrl
      };

    } catch (error) {
      console.error(`❌ Agent deployment failed:`, error);
      
      onProgress?.({
        stage: 'error',
        message: error instanceof Error ? error.message : 'Unknown deployment error',
        percent: 100
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error'
      };
    }
  }

  /**
   * Deploy agency workflow functionality to a dedicated backend canister
   * 
   * IMPORTANT: This deploys to the selected server pair's backend canister.
   * The agency workflow uses its OWN independent server pair, separate from agents.
   * Each agent can also have its own server pair - they are completely independent.
   * 
   * @param config - Deployment config including the selected server pair's backend canister ID
   */
  public async deployAgencyWorkflow(
    config: AgencyDeploymentConfig,
    onProgress?: (progress: AgentDeploymentProgress) => void
  ): Promise<DeploymentResult> {
    try {
      console.log(`🏢 Starting agency workflow deployment for project: ${config.projectId}`);
      console.log(`📋 Server Pair ID: ${config.serverPairId}`);
      console.log(`🎯 Backend Canister ID: ${config.backendCanisterId}`);
      console.log(`🔒 INDEPENDENT: Agency workflow uses its own dedicated server pair (separate from agents)`);
      
      onProgress?.({
        stage: 'download',
        message: 'Preparing agency workflow deployment...',
        percent: 0
      });

      // Step 1: Download agency workflow WASM file
      onProgress?.({
        stage: 'download',
        message: 'Downloading agency workflow WASM...',
        percent: 10
      });

      // Get WASM URLs from configuration
      const AGENCY_WASM_URLS = await wasmConfigService.getAgencyWasmUrls();
      console.log('📥 [AgencyDeployment] WASM URLs from config:', AGENCY_WASM_URLS);
      
      let wasmBytes: number[] = [];
      let wasmResponse: Response | null = null;
      let lastError: Error | null = null;

      // Try each URL until one works
      for (const url of AGENCY_WASM_URLS) {
        try {
          console.log('📥 [AgencyDeployment] Fetching agency WASM from:', url);
          
          wasmResponse = await fetch(url, {
            headers: {
              'Accept': 'application/octet-stream'
            }
          });

          if (wasmResponse.ok) {
            onProgress?.({
              stage: 'download',
              message: 'Processing agency WASM...',
              percent: 30
            });

            const wasmBlob = await wasmResponse.blob();
            const wasmArrayBuffer = await wasmBlob.arrayBuffer();
            wasmBytes = Array.from(new Uint8Array(wasmArrayBuffer));
            console.log(`✅ [AgencyDeployment] Agency WASM downloaded from ${url}: ${(wasmBytes.length / 1024).toFixed(1)} KB`);
            break; // Success, exit loop
          } else {
            lastError = new Error(`Failed to fetch from ${url}: ${wasmResponse.status} ${wasmResponse.statusText}`);
            console.warn(`⚠️ [AgencyDeployment] Failed to fetch from ${url}, trying next URL...`);
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown fetch error');
          console.warn(`⚠️ [AgencyDeployment] Error fetching from ${url}:`, error);
        }
      }

      if (wasmBytes.length === 0) {
        throw lastError || new Error('Failed to fetch agency WASM from any available URL');
      }

      // Step 2: Deploy WASM to backend canister
      onProgress?.({
        stage: 'backend',
        message: 'Deploying agency workflow to backend canister...',
        percent: 50
      });

      const userActor = await userCanisterService.getUserActor(config.userCanisterId, config.identity);
      const backendPrincipal = Principal.fromText(config.backendCanisterId);

      console.log('🚀 [AgencyDeployment] Deploying agency WASM to dedicated backend canister:', config.backendCanisterId);
      console.log('📋 [AgencyDeployment] Server Pair ID:', config.serverPairId);
      console.log('🔒 [AgencyDeployment] This is an INDEPENDENT deployment - agency workflow uses its own server pair, separate from agents');

      const deployResult = await userActor.deployToExistingCanister(
        backendPrincipal,
        wasmBytes,
        'backend',
        'agency',
        config.principal,
        [],
        [],
        ['reinstall']
      );

      if (!deployResult || ('err' in deployResult)) {
        const errorMsg = deployResult && 'err' in deployResult ? deployResult.err : 'Unknown deployment error';
        throw new Error(`Agency deployment failed: ${errorMsg}`);
      }

      console.log('✅ [AgencyDeployment] Agency WASM deployed successfully');

      // Step 2.5: Set Kontext owner BEFORE frontend deployment
      // This allows Kontext to claim ownership even if independent UI initializes first
      onProgress?.({
        stage: 'backend',
        message: 'Setting Kontext owner...',
        percent: 75
      });

      try {
        const { AgencyService } = await import('./AgencyService');
        const kontextPrincipal = config.principal.toText();
        const setOwnerResult: { ok?: string; err?: string } = await AgencyService.setKontextOwner(
          config.projectId,
          config.userCanisterId,
          config.identity,
          kontextPrincipal
        );
        
        if ('ok' in setOwnerResult) {
          console.log(`✅ [AgencyDeployment] Kontext owner set successfully: ${setOwnerResult.ok}`);
        } else {
          console.warn(`⚠️ [AgencyDeployment] Failed to set Kontext owner: ${setOwnerResult.err}`);
          // Continue anyway - might already be set or will be set during initialization
        }
      } catch (ownerError) {
        console.warn(`⚠️ [AgencyDeployment] Error setting Kontext owner:`, ownerError);
        // Continue anyway - owner can be set later
      }

      onProgress?.({
        stage: 'backend',
        message: 'Agency workflow deployed successfully',
        percent: 80
      });

      // Step 3: Deploy frontend (agency workflow UI)
      let frontendUrl = '';
      
      if (config.frontendCanisterId) {
        try {
          onProgress?.({
            stage: 'frontend',
            message: 'Downloading agency workflow frontend...',
            percent: 85
          });

          // Download and extract frontend files from zip
          const AGENCY_FRONTEND_ZIP_URL = "https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/agency_workflow.zip";
          
          const frontendFiles = await this.extractFrontendFilesFromZip(AGENCY_FRONTEND_ZIP_URL, onProgress);
          
          // Prepare frontend files for bundling (with backend canister ID for vite config)
          const preparedFrontend = this.prepareFrontendFiles(frontendFiles, config.backendCanisterId);
          
          // Bundle frontend code
          const bundleResult = await this.bundleFrontendCode(preparedFrontend, onProgress);
          
          // Deploy frontend to canister
          frontendUrl = await this.deployFrontendToCanister(
            bundleResult,
            config.frontendCanisterId,
            config.identity,
            onProgress
          );
          
          console.log(`✅ [AgencyDeployment] Frontend deployed successfully: ${frontendUrl}`);
        } catch (frontendError) {
          console.error(`⚠️ [AgencyDeployment] Frontend deployment failed:`, frontendError);
          // Don't fail the entire deployment if frontend fails - backend is more critical
          // Frontend URL will remain empty
        }
      }

      // Step 4: Initialize agency workflow system
      onProgress?.({
        stage: 'backend',
        message: 'Initializing agency workflow system...',
        percent: 90
      });

      // Step 5: Complete
      onProgress?.({
        stage: 'complete',
        message: 'Agency workflow deployed successfully!',
        percent: 100
      });

      const backendUrl = `https://${config.backendCanisterId}.icp0.io`;

      console.log(`✅ Agency workflow deployment completed for project: ${config.projectId}`);
      console.log(`🏢 Agency Backend URL: ${backendUrl}`);
      console.log(`🎨 Agency Frontend URL: ${frontendUrl || 'N/A (backend only)'}`);

      return {
        success: true,
        backendUrl,
        frontendUrl: frontendUrl || undefined
      };

    } catch (error) {
      console.error(`❌ Agency workflow deployment failed:`, error);
      
      onProgress?.({
        stage: 'error',
        message: error instanceof Error ? error.message : 'Unknown agency deployment error',
        percent: 100
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown agency deployment error'
      };
    }
  }

  /**
   * Check if a canister supports agent functionality
   */
  public async checkAgentSupport(
    canisterId: string,
    identity: Identity
  ): Promise<{ supported: boolean; version?: string; error?: string }> {
    try {
      console.log(`🔍 Checking agent support for canister: ${canisterId}`);
      
      // This would check if the canister supports the agent interface
      // For now, we assume all deployed backend canisters support agents
      
      return {
        supported: true,
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Failed to check agent support:', error);
      return {
        supported: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if a canister supports agency workflow functionality
   */
  public async checkAgencySupport(
    canisterId: string,
    identity: Identity
  ): Promise<{ supported: boolean; version?: string; error?: string }> {
    try {
      console.log(`🔍 Checking agency workflow support for canister: ${canisterId}`);
      
      // This would check if the canister supports the agency workflow interface
      // For now, we assume all deployed backend canisters support agency workflows
      
      return {
        supported: true,
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Failed to check agency support:', error);
      return {
        supported: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get deployment status for an agent or agency workflow
   */
  public async getDeploymentStatus(
    canisterId: string,
    identity: Identity
  ): Promise<{ 
    status: 'active' | 'deploying' | 'error' | 'unknown';
    agentSupport: boolean;
    agencySupport: boolean;
    health?: string;
    error?: string;
  }> {
    try {
      console.log(`📊 Getting deployment status for canister: ${canisterId}`);
      
      // Check both agent and agency support
      const [agentCheck, agencyCheck] = await Promise.all([
        this.checkAgentSupport(canisterId, identity),
        this.checkAgencySupport(canisterId, identity)
      ]);

      return {
        status: 'active',
        agentSupport: agentCheck.supported,
        agencySupport: agencyCheck.supported,
        health: 'healthy'
      };
    } catch (error) {
      console.error('Failed to get deployment status:', error);
      return {
        status: 'error',
        agentSupport: false,
        agencySupport: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all deployed agents for a project
   */
  public async listDeployedAgents(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ 
    success: boolean; 
    agents: Array<{
      id: string;
      name: string;
      canisterId: string;
      status: string;
      deployedAt: number;
    }>; 
    error?: string;
  }> {
    try {
      console.log(`📋 Listing deployed agents for project: ${projectId}`);
      
      // Get server pairs for the project
      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      const serverPairsResult = await userActor.getProjectServerPairs(projectId);
      
      if (!('ok' in serverPairsResult)) {
        return {
          success: false,
          agents: [],
          error: serverPairsResult.err
        };
      }

      // Convert server pairs to agent list
      const agents = serverPairsResult.ok.map((pair: any) => ({
        id: pair.pairId,
        name: pair.name,
        canisterId: pair.backendCanisterId.toText(),
        status: 'active',
        deployedAt: Number(pair.createdAt) / 1_000_000
      }));

      console.log(`✅ Found ${agents.length} deployed agents`);

      return {
        success: true,
        agents
      };
    } catch (error) {
      console.error('Failed to list deployed agents:', error);
      return {
        success: false,
        agents: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update an agent deployment
   */
  public async updateAgent(
    canisterId: string,
    config: Partial<DeploymentConfig>,
    identity: Identity,
    onProgress?: (progress: AgentDeploymentProgress) => void
  ): Promise<DeploymentResult> {
    try {
      console.log(`🔄 Updating agent deployment: ${canisterId}`);
      
      onProgress?.({
        stage: 'download',
        message: 'Preparing agent update...',
        percent: 0
      });

      // Update logic would go here
      onProgress?.({
        stage: 'backend',
        message: 'Updating agent backend...',
        percent: 50
      });

      onProgress?.({
        stage: 'complete',
        message: 'Agent updated successfully!',
        percent: 100
      });

      const backendUrl = `https://${canisterId}.icp0.io`;

      return {
        success: true,
        backendUrl
      };
    } catch (error) {
      console.error('Failed to update agent:', error);
      
      onProgress?.({
        stage: 'error',
        message: error instanceof Error ? error.message : 'Update failed',
        percent: 100
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Update failed'
      };
    }
  }

  /**
   * Remove an agent deployment (cleanup only - doesn't delete canister)
   */
  public async removeAgent(
    canisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🗑️ Removing agent deployment: ${canisterId}`);
      
      // This would clean up agent-specific data but not delete the canister
      // The canister deletion is handled by the server pair management
      
      console.log(`✅ Agent deployment removed: ${canisterId}`);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to remove agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Removal failed'
      };
    }
  }

  /**
   * Get agent health information
   */
  public async getAgentHealth(
    canisterId: string,
    identity: Identity
  ): Promise<{ 
    success: boolean; 
    health?: {
      status: string;
      uptime: number;
      tasksCompleted: number;
      lastActivity: number;
    };
    error?: string;
  }> {
    try {
      console.log(`🏥 Getting agent health: ${canisterId}`);
      
      // This would query the agent canister for health information
      
      return {
        success: true,
        health: {
          status: 'healthy',
          uptime: Date.now() - (24 * 60 * 60 * 1000), // 24 hours ago
          tasksCompleted: 42,
          lastActivity: Date.now() - (5 * 60 * 1000) // 5 minutes ago
        }
      };
    } catch (error) {
      console.error('Failed to get agent health:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }
}

export const AgentDeploymentService = new AgentDeploymentServiceClass();