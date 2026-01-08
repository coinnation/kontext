import { Principal } from '@dfinity/principal';
import { HttpAgent } from '@dfinity/agent';
import { AssetManager } from "@dfinity/assets";
import { userCanisterService } from './UserCanisterService';
import { Identity } from '@dfinity/agent';
import { injectElementSelectionScript } from '../utils/elementSelectionInjector';

interface ServerPair {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
}

interface DeploymentParams {
  selectedServerPair: ServerPair;
  projectId: string;
  projectName: string;
  userCanisterId: string;
  identity: Identity;
  principal: Principal;
  projectFiles: Record<string, Record<string, any>>;
  projectGeneratedFiles: Record<string, Record<string, any>>;
  generatedFiles: Record<string, any>;
  selectedVersion?: string | null; // 🆕 VERSION-AWARE: Version ID or null for working copy
  onStatusUpdate: (status: string) => void;
  onError: (error: string) => void;
  onLog?: (message: string) => void;
}

interface MotokoPackage {
  name: string;
  repo: string;
  version: string;
  dir: string;
}

interface PreparedMotokoFiles {
  files: Array<{ name: string; content: string }>;
  mainFile: string;
  packages: MotokoPackage[];
}

interface PreparedFrontendFiles {
  files: Array<{ name: string; content: string }>;
  packageJson: object;
}

interface DFXUtilsResponse {
  success: boolean;
  wasm: string;
  candid: string;
  typescript: string;
  didJs: string;
  jsonSchema: string;
  error?: string;
  compiledWasm?: Uint8Array;
}

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

// Hardcoded Motoko packages for DFXUtils compilation
const DEFAULT_MOTOKO_PACKAGES: MotokoPackage[] = [
  {
    name: "base",
    repo: "dfinity/motoko-base",
    version: "0.14.9",
    dir: "src"
  },
  {
    name: "sha2",
    repo: "research-ag/sha2",
    version: "0.1.0",
    dir: "src"
  },
  {
    name: "cn-logger",
    repo: "coinnation/cnLogger",
    version: "0.1.1",
    dir: "src"
  }
];

// ==================== ULTRA HIGH-PERFORMANCE PARALLEL PROCESSING ====================

// Maximum safe chunk size for IC (1.98MB)
const MAX_CHUNK_SIZE = 1980000;

// Aggressive parallelization settings
const MAX_WASM_CHUNKS = 15; // Maximum parallel WASM chunks
const MAX_SMALL_ASSETS = 24; // Maximum parallel small asset uploads
const MAX_LARGE_ASSETS = 12; // Maximum parallel large asset uploads
const SMALL_ASSET_THRESHOLD = 102400; // 100KB

// Advanced concurrency limiter with adaptive scaling
const createConcurrencyLimiter = (maxConcurrent: number) => {
  let running = 0;
  const queue: Array<() => Promise<any>> = [];
  
  const process = async () => {
    if (running >= maxConcurrent || queue.length === 0) return;
    
    running++;
    const task = queue.shift()!;
    
    try {
      await task();
    } catch (error) {
      console.error('Task failed in concurrency limiter:', error);
    } finally {
      running--;
      if (queue.length > 0) {
        process();
      }
    }
  };
  
  return {
    add: (task: () => Promise<any>): Promise<void> => {
      return new Promise((resolve, reject) => {
        queue.push(async () => {
          try {
            await task();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        process();
      });
    }
  };
};

const batchProcessWithProgress = async <T, R>(
  items: T[], 
  processor: (item: T, index: number) => Promise<R>,
  maxConcurrent: number,
  progressCallback?: (completed: number, total: number) => void
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let completed = 0;
  
  const limiter = createConcurrencyLimiter(maxConcurrent);
  
  const tasks = items.map((item, index) =>
    limiter.add(async () => {
      try {
        const result = await processor(item, index);
        results[index] = result;
        completed++;
        if (progressCallback) {
          progressCallback(completed, items.length);
        }
        return result;
      } catch (error) {
        completed++;
        if (progressCallback) {
          progressCallback(completed, items.length);
        }
        throw error;
      }
    })
  );
  
  await Promise.allSettled(tasks);
  return results;
};

// ==================== HELPER FUNCTIONS ====================

const addProjectPrefix = (files: Array<{ name: string; content: string }>, projectName: string): Array<{ name: string; content: string }> => {
  return files.map(file => ({
    ...file,
    name: file.name.startsWith(`${projectName}/`) 
      ? file.name  
      : `${projectName}/${file.name}`  
  }));
};

// ==================== VITE CONFIG GENERATION ====================

const generateViteConfig = (backendCanisterId: string, projectName: string): string => {
  console.log(`[VITE_CONFIG_GENERATION] 🔧 Generating Vite config with backend canister ID: ${backendCanisterId}`);
  
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
};

export class DeploymentService {
  static async executeFullDeployment(params: DeploymentParams): Promise<string> {
    const {
      selectedServerPair,
      projectId,
      projectName,
      userCanisterId,
      identity,
      principal,
      projectFiles,
      projectGeneratedFiles,
      generatedFiles,
      selectedVersion, // 🆕 VERSION-AWARE
      onStatusUpdate,
      onError,
      onLog
    } = params;

    const log = (message: string) => {
      if (onLog) onLog(message);
      console.log(`[DEPLOYMENT_SERVICE] ${message}`);
    };

    try {
      // 🚀 SMART DEPLOYMENT: Query flags from backend (persistent, authoritative)
      const { shouldDeploy } = await import('../utils/deploymentTracking');
      const { userCanisterService } = await import('./UserCanisterService');
      
      log('🔍 [SMART DEPLOY] Querying deployment flags from backend...');
      const deploymentFlags = await userCanisterService.getDeploymentFlags(
        userCanisterId,
        identity,
        projectId
      );
      
      const deploymentDecision = shouldDeploy(
        deploymentFlags?.hasBackendChanged,
        deploymentFlags?.hasFrontendChanged
      );
      
      log(`🧠 [SMART DEPLOY] ${deploymentDecision.reason}`);
      log(`🧠 [SMART DEPLOY] Backend: ${deploymentDecision.shouldDeployBackend ? '✅ Deploy' : '⏭️  Skip'}`);
      log(`🧠 [SMART DEPLOY] Frontend: ${deploymentDecision.shouldDeployFrontend ? '✅ Deploy' : '⏭️  Skip'}`);
      
      // If nothing needs deployment, return early
      if (!deploymentDecision.shouldDeployBackend && !deploymentDecision.shouldDeployFrontend) {
        const message = '✅ No changes detected - deployment skipped!';
        onStatusUpdate(message);
        log(message);
        return message;
      }

      // Step 1: Create deployment file snapshot
      const deploymentSource = selectedVersion ? `version ${selectedVersion}` : 'working copy';
      onStatusUpdate(`Creating deployment snapshot from ${deploymentSource}...`);
      log(`📸 Creating deployment file snapshot from ${deploymentSource}...`);
      
      const deploymentSnapshot = await this.createDeploymentFileSnapshot(
        projectId,
        projectFiles,
        projectGeneratedFiles,
        generatedFiles,
        selectedVersion, // 🆕 Pass version
        userCanisterId,  // 🆕 Pass for version loading
        identity         // 🆕 Pass for version loading
      );

      if (Object.keys(deploymentSnapshot).length === 0) {
        throw new Error('No files available in deployment snapshot');
      }

      log(`✅ Deployment snapshot created with ${Object.keys(deploymentSnapshot).length} files`);

      // Step 2: Analyze file types
      const motokoFiles = Object.keys(deploymentSnapshot).filter(f => f.endsWith('.mo'));
      const frontendFiles = Object.keys(deploymentSnapshot).filter(f => !f.endsWith('.mo') && !f.endsWith('.did'));
      
      log(`Found ${motokoFiles.length} Motoko files and ${frontendFiles.length} frontend files`);
      
      if (motokoFiles.length === 0) {
        throw new Error('No Motoko backend files found in deployment snapshot');
      }
      
      if (frontendFiles.length === 0) {
        throw new Error('No frontend files found in deployment snapshot');
      }

      // Step 3: Compile backend (conditionally)
      let backendResult: DFXUtilsResponse | null = null;
      let usedCachedWasm = false;
      let actorName = 'main';
      
      if (deploymentDecision.shouldDeployBackend) {
        onStatusUpdate('Compiling Motoko backend...');
        log('Starting Motoko compilation...');
        
        const motokoData = this.prepareMotokoFiles(deploymentSnapshot);
        log(`Main actor file: ${motokoData.mainFile}`);
      
      // 🎯 CRITICAL: Extract actor name first to find the correctly-named WASM
      const mainFileEntry = Object.entries(deploymentSnapshot).find(([fileName]) => 
        fileName.endsWith('/main.mo') || fileName.endsWith('/Main.mo') ||
        fileName === 'main.mo' || fileName === 'Main.mo'
      );
      
      const actorName = mainFileEntry 
        ? this.extractActorNameFromMotoko(mainFileEntry[1], mainFileEntry[0])
        : 'main';
      
      log(`🎯 Detected actor name: ${actorName}`);
      
      try {
        log('🔍 Checking for cached WASM from project generation...');
        
        const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
        
        const cachedWasmResult = await userActor.readCodeArtifact(
          principal,
          projectId,
          '.deploy',
          `${actorName}.wasm`,  // 🎯 Use actor name, not "backend"
          []
        );
        
        if ('ok' in cachedWasmResult || 'Ok' in cachedWasmResult) {
          const artifact = cachedWasmResult.ok || cachedWasmResult.Ok;
          
          // Extract Binary content (same as downloadProjectWasmFiles)
          let binaryData: any = null;
          if (Array.isArray(artifact.content) && artifact.content.length > 0) {
            binaryData = artifact.content[0];
          } else if (artifact.content && typeof artifact.content === 'object') {
            binaryData = artifact.content;
          }
          
          if (binaryData && typeof binaryData === 'object' && 'Binary' in binaryData) {
            const binary = binaryData.Binary;
            let wasmBytes: Uint8Array | null = null;
            
            if (Array.isArray(binary)) {
              wasmBytes = new Uint8Array(binary);
            } else if (binary instanceof Uint8Array) {
              wasmBytes = binary;
            }
            
            if (wasmBytes) {
              log(`🎯 Found cached WASM: ${(wasmBytes.length / 1024).toFixed(1)} KB - skipping recompilation!`);
              
              // Use cached WASM with existing Candid artifacts from project files
              backendResult = {
                success: true,
                wasm: '', // Not needed
                candid: deploymentSnapshot['src/frontend/candid/backend.did'] || '',
                typescript: deploymentSnapshot['src/frontend/candid/backend.did.d.ts'] || '',
                didJs: deploymentSnapshot['src/frontend/candid/backend.did.js'] || '',
                jsonSchema: deploymentSnapshot['src/frontend/candid/backend.json'] || '{}',
                compiledWasm: wasmBytes
              } as DFXUtilsResponse;
              
              usedCachedWasm = true;
            }
          }
        }
      } catch (cacheError) {
        log(`⚠️ No cached WASM found, will compile from source`);
      }
      
      // Compile only if we don't have cached WASM
      if (!usedCachedWasm) {
        log('🔨 Compiling Motoko code from source...');
        backendResult = await this.compileMotokoCode(
          motokoData, 
          projectName, 
          log,
          userCanisterId,
          identity,
          principal,
          projectId
        );
        log('✅ Motoko compilation successful');
      } else {
        log('⚡ Skipped compilation - using cached WASM from project generation!');
      }

      // Step 4: Deploy backend
      onStatusUpdate('Deploying backend to canister...');
      log('Deploying to backend canister...');
      
      await this.deployBackendToCanister(
        backendResult,
        selectedServerPair.backendCanisterId,
        userCanisterId,
        identity,
        principal,
        projectId,
        projectName,
        log
      );

      // Step 4.5: Set Kontext Owner IMMEDIATELY after backend deployment
      // 🔐 CRITICAL SECURITY: This prevents race condition where a rogue user could
      // claim ownership before the platform does. Must happen immediately after WASM deployment.
      try {
        log('🏢 Setting Kontext owner for backend canister...');
        onStatusUpdate('Setting Kontext owner...');

        // Create actor to call setKontextOwner
        const { HttpAgent, Actor } = await import('@dfinity/agent');
        
        const agent = new HttpAgent({ 
          identity, 
          host: process.env.NODE_ENV === 'production' ? 'https://ic0.app' : 'http://localhost:4943'
        });

        if (process.env.NODE_ENV !== 'production') {
          await agent.fetchRootKey();
        }

        // Create IDL for setKontextOwner method
        const idlFactory = ({ IDL }: any) => {
          const Result = IDL.Variant({ 'ok': IDL.Text, 'err': IDL.Text });
          return IDL.Service({
            'setKontextOwner': IDL.Func([IDL.Principal], [Result], []),
            'isKontextOwnerQuery': IDL.Func([], [IDL.Bool], ['query']),
          });
        };

        const backendActor = Actor.createActor(idlFactory, {
          agent,
          canisterId: selectedServerPair.backendCanisterId,
        });

        const kontextOwnerPrincipal = principal;
        const setOwnerResult = await backendActor.setKontextOwner(kontextOwnerPrincipal) as any;

        if (setOwnerResult && typeof setOwnerResult === 'object' && 'ok' in setOwnerResult) {
          log('✅ Kontext owner set successfully: ' + setOwnerResult.ok);
          log('🔐 Backend canister is now managed by Kontext - Database Interface will have full access');
        } else if (setOwnerResult && typeof setOwnerResult === 'object' && 'err' in setOwnerResult) {
          log('⚠️ Could not set Kontext owner: ' + setOwnerResult.err);
          log('ℹ️  This is OK if backend does not implement Kontext owner pattern');
          // Non-fatal - backend might not have the pattern
        }
      } catch (ownerError) {
        log('ℹ️  Backend does not implement Kontext owner pattern - continuing deployment');
        // Non-fatal - not all backends will have this pattern
      }

        // 🚀 Backend deployed successfully - clear the flag in backend (persistent)
        log('✅ [SMART DEPLOY] Backend deployment complete - clearing flag...');
        const { clearDeploymentFlags } = await import('../utils/deploymentTracking');
        const clearBackendResult = await clearDeploymentFlags(
          userCanisterId,
          identity,
          projectId,
          true,  // Clear backend
          false  // Don't clear frontend yet
        );
        if (clearBackendResult.success) {
          log('✅ [SMART DEPLOY] Backend flag cleared in backend');
        } else {
          log('⚠️ [SMART DEPLOY] Failed to clear backend flag:', clearBackendResult.error);
        }
      } else {
        log('⏭️  [SMART DEPLOY] Skipping backend deployment - no changes detected');
        
        // Even if skipping backend, we need backendResult for Candid artifacts
        // Try to get from previous deployment or use minimal stub
        try {
          const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
          const candidResult = await userActor.readCodeArtifact(
            principal,
            projectId,
            'src/frontend/candid',
            'backend.did',
            []
          );
          
          if ('ok' in candidResult || 'Ok' in candidResult) {
            const artifact = candidResult.ok || candidResult.Ok;
            backendResult = {
              success: true,
              wasm: '',
              candid: artifact.content || '',
              typescript: '',
              didJs: '',
              jsonSchema: '{}',
              compiledWasm: new Uint8Array(0)
            } as DFXUtilsResponse;
            log('✅ Using existing Candid artifacts from previous deployment');
          }
        } catch (e) {
          log('⚠️ Could not load existing Candid artifacts - frontend may need them');
        }
      }

      // Step 5: Add Candid artifacts and generate Vite config
      onStatusUpdate('Adding Candid artifacts and generating Vite config...');
      log('Adding Candid artifacts to deployment snapshot...');
      
      const enhancedSnapshot = this.addCandidArtifactsToFiles(
        deploymentSnapshot, 
        backendResult, 
        projectName,
        log
      );

      // Generate and add Vite config with backend canister ID
      log('🔧 Generating Vite config with backend canister integration...');
      const snapshotWithViteConfig = this.addViteConfigToSnapshot(
        enhancedSnapshot,
        selectedServerPair.backendCanisterId,
        projectName,
        log
      );
      
      const frontendData = this.prepareFrontendFiles(snapshotWithViteConfig, selectedServerPair);

      // Step 6 & 7: Bundle and deploy frontend (conditionally)
      let frontendUrl = '';
      
      if (deploymentDecision.shouldDeployFrontend) {
        onStatusUpdate('Bundling frontend with backend integration...');
        log(`🔧 Bundling with backend canister integration: ${selectedServerPair.backendCanisterId}`);
        
        const bundleResult = await this.bundleFrontendCode(
          frontendData, 
          selectedServerPair, 
          projectName,
          log
        );

        onStatusUpdate('Deploying frontend to canister...');
        log('Deploying to frontend canister...');
        
        frontendUrl = await this.deployFrontendToCanister(
          bundleResult,
          selectedServerPair.frontendCanisterId,
          userCanisterId,
          identity,
          log
        );

        // 🚀 Frontend deployed successfully - clear the flag in backend (persistent)
        log('✅ [SMART DEPLOY] Frontend deployment complete - clearing flag...');
        const { clearDeploymentFlags } = await import('../utils/deploymentTracking');
        const clearFrontendResult = await clearDeploymentFlags(
          userCanisterId,
          identity,
          projectId,
          false, // Don't clear backend
          true   // Clear frontend
        );
        if (clearFrontendResult.success) {
          log('✅ [SMART DEPLOY] Frontend flag cleared in backend');
        } else {
          log('⚠️ [SMART DEPLOY] Failed to clear frontend flag:', clearFrontendResult.error);
        }
      } else {
        log('⏭️  [SMART DEPLOY] Skipping frontend deployment - no changes detected');
        // Use existing frontend URL
        frontendUrl = `https://${selectedServerPair.frontendCanisterId}.icp0.io`;
      }

      onStatusUpdate('Deployment completed successfully!');
      log(`🎉 Deployment completed successfully!`);
      log(`🌐 Frontend URL: ${frontendUrl}`);
      log(`⚙️ Backend Canister ID: ${selectedServerPair.backendCanisterId}`);

      // 🚀 NEW: Clean up cached WASM after successful deployment
      if (usedCachedWasm) {
        try {
          log('🧹 Cleaning up cached WASM...');
          const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
          // Use actor name for cleanup (same as we used for caching)
          await userActor.deleteFile(projectId, `.deploy/${actorName}.wasm`, []);
          log('✅ Cached WASM cleaned up');
        } catch (cleanupError) {
          log(`⚠️ Could not delete cached WASM (non-critical)`);
        }
      }

      return frontendUrl;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';
      log(`❌ Deployment failed: ${errorMessage}`);
      onError(errorMessage);
      throw error;
    }
  }

  private static async createDeploymentFileSnapshot(
    activeProject: string,
    projectFiles: Record<string, Record<string, any>>,
    projectGeneratedFiles: Record<string, Record<string, any>>,
    generatedFiles: Record<string, any>,
    selectedVersion: string | null | undefined, // 🆕 VERSION-AWARE
    userCanisterId: string, // 🆕 Required for version loading
    identity: Identity // 🆕 Required for version loading
  ): Promise<Record<string, string>> {
    if (!activeProject) {
      return {};
    }
    
    // 🆕 VERSION-AWARE: Load files from selected version or working copy
    let filesSource: Record<string, any> = {};

    if (selectedVersion) {
      console.log(`[DEPLOYMENT_SERVICE] 📦 Loading files from version: ${selectedVersion}`);
      try {
        const result = await userCanisterService.getProjectFiles(activeProject, selectedVersion);
        
        if ('ok' in result) {
          // Convert artifacts to file map
          result.ok.forEach((artifact: any) => {
            const path = artifact.path || artifact.name;
            const content = artifact.content || '';
            filesSource[path] = content;
          });
          
          console.log(`[DEPLOYMENT_SERVICE] ✅ Loaded ${Object.keys(filesSource).length} files from version ${selectedVersion}`);
        } else {
          console.warn(`[DEPLOYMENT_SERVICE] ⚠️ Failed to load version files: ${result.err}, falling back to working copy`);
          // Fall back to working copy below
        }
      } catch (error) {
        console.warn(`[DEPLOYMENT_SERVICE] ⚠️ Error loading version files:`, error, ', falling back to working copy');
        // Fall back to working copy below
      }
    }

    // If no version or version load failed, use working copy
    if (Object.keys(filesSource).length === 0) {
      console.log(`[DEPLOYMENT_SERVICE] 🔧 Loading files from working copy`);
      const canisterFiles = projectFiles[activeProject] || {};
      const projectGenFiles = projectGeneratedFiles[activeProject] || {};
      const currentGeneratedFiles = generatedFiles || {};
      
      filesSource = {
        ...canisterFiles,
        ...projectGenFiles,
        ...currentGeneratedFiles
      };
    }
    
    const snapshot: Record<string, string> = {};
    
    // Convert all files to strings
    Object.entries(filesSource).forEach(([fileName, content]) => {
      snapshot[fileName] = this.resolveFileContentSafely(content, fileName);
    });
    
    console.log(`[DEPLOYMENT_SERVICE] ✅ Deployment snapshot created with ${Object.keys(snapshot).length} files from ${selectedVersion ? `version ${selectedVersion}` : 'working copy'}`);
    
    return snapshot;
  }

  private static resolveFileContentSafely(content: any, fileName: string): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content) && content.length > 0) {
      const contentItem = content[0];
      if (contentItem && typeof contentItem === 'object' && contentItem.Text) {
        return contentItem.Text;
      }
    }
    
    if (typeof content === 'object' && content !== null) {
      if (content.Text && typeof content.Text === 'string') {
        return content.Text;
      }
      
      if (content.content && typeof content.content === 'string') {
        return content.content;
      }
    }
    
    console.warn(`[DEPLOYMENT_SERVICE] ⚠️ Could not resolve content for file: ${fileName}`);
    return '';
  }

  private static addViteConfigToSnapshot(
    fileSnapshot: Record<string, string>, 
    backendCanisterId: string,
    projectName: string,
    log: (message: string) => void
  ): Record<string, string> {
    log('🔧 Adding generated Vite config to deployment snapshot...');
    log(`🎯 Target backend canister ID: ${backendCanisterId}`);
    log(`📁 Project name: ${projectName}`);
    
    const updatedSnapshot: Record<string, string> = { ...fileSnapshot };
    
    const viteConfigPath = `${projectName}/src/frontend/vite.config.ts`;
    const viteConfigContent = generateViteConfig(backendCanisterId, projectName);
    
    updatedSnapshot[viteConfigPath] = viteConfigContent;
    
    log(`✅ Generated Vite config with backend canister ID: ${backendCanisterId}`);
    log(`✅ Added Vite config to path: ${viteConfigPath}`);
    log('🎉 Vite config generation completed successfully');
    
    return updatedSnapshot;
  }

  private static prepareMotokoFiles(fileSnapshot: Record<string, string>): PreparedMotokoFiles {
    const motokoEntries = Object.entries(fileSnapshot).filter(([fileName]) => fileName.endsWith('.mo'));
    
    const motokoFiles = motokoEntries.map(([fileName, content]) => ({
      name: fileName,
      content: content
    }));

    if (motokoFiles.length === 0) {
      throw new Error('No Motoko files found');
    }

    // Identify main actor file
    const mainFile = this.identifyMainActorFile(motokoFiles);
    
    return {
      files: motokoFiles,
      mainFile: mainFile,
      packages: DEFAULT_MOTOKO_PACKAGES
    };
  }

  private static identifyMainActorFile(files: { name: string; content: string }[]): string {
    // Look for files named main.mo or Main.mo
    const mainFile = files.find(f => 
      f.name.endsWith('/main.mo') || 
      f.name.endsWith('/Main.mo') ||
      f.name === 'main.mo' ||
      f.name === 'Main.mo'
    );
    
    if (mainFile) return mainFile.name;

    // Look for files containing actor definitions
    const actorFile = files.find(f => {
      const cleanContent = f.content
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      
      const actorPatterns = [
        /^\s*actor\s+\w+\s*(\([^)]*\))?\s*\{/m,
        /^\s*actor\s+class\s+\w+\s*(\([^)]*\))?\s*\{/m,
        /^\s*actor\s*\{/m
      ];
      
      return actorPatterns.some(pattern => pattern.test(cleanContent));
    });

    return actorFile ? actorFile.name : files[0]?.name || 'main.mo';
  }

  private static async compileMotokoCode(
    motokoData: PreparedMotokoFiles, 
    projectName: string,
    log: (message: string) => void,
    userCanisterId?: string,
    identity?: Identity,
    principal?: Principal,
    projectId?: string
  ): Promise<DFXUtilsResponse> {
    try {
      const motokoFilesWithPrefix = addProjectPrefix(motokoData.files, projectName);

      const payload = {
        files: motokoFilesWithPrefix,
        packages: motokoData.packages,
        mode: 'reinstall',
        mainFile: `${projectName}/${motokoData.mainFile}`,
      };

      log('🔍 [DFXUTILS PAYLOAD] Complete payload being sent');

      const response = await fetch('https://dfxutils.coinnation.io/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.error || response.statusText;
        } catch {
          errorText = response.statusText;
        }
        
        throw new Error(`Backend compilation failed: ${errorText}`);
      }

      const result = await response.json();

      if (result.error && result.error.trim().length > 0) {
        log('🔍 Found compilation error in success response:', result.error);
        throw new Error('Compilation failed');
      }

      if (!result?.wasm)
        throw new Error('No WASM in response');

      if (typeof result.wasm !== 'string')
        throw new Error('WASM is not a base-64 string');

      if (!result?.candid?.trim())
        throw new Error('No Candid interface returned');

      const binaryString = atob(result.wasm);
      const wasmBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) wasmBytes[i] = binaryString.charCodeAt(i);

      const mainFileContent =
        motokoData.files.find((f) => f.name === motokoData.mainFile)?.content ?? '';
      const actorName = this.extractActorNameFromMotoko(mainFileContent, motokoData.mainFile);

      log(`✅ Compiled actor "${actorName}" – ${(wasmBytes.length / 1024).toFixed(1)} KB WASM`);

      // Save Candid artifacts if we have the necessary parameters
      if (userCanisterId && identity && principal && projectId) {
        try {
          const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
          const candidDir = `${projectName}/src/frontend/candid`;
          const versionParam: string[] = [];

          const artifacts = [
            { name: `${actorName}.did`, content: result.candid, type: 'text/plain', category: 'candid' },
            { name: `${actorName}.did.d.ts`, content: result.typescript ?? '', type: 'text/typescript', category: 'typescript' },
            { name: `${actorName}.did.js`, content: result.didJs ?? '', type: 'text/javascript', category: 'javascript' },
          ];

          if (result.jsonSchema && result.jsonSchema !== '{}')
            artifacts.push({ name: `${actorName}.json`, content: result.jsonSchema, type: 'application/json', category: 'json' });

          let saved = 0;
          for (const art of artifacts) {
            if (!art.content.trim()) continue;
            try {
              const existing = await userActor.readCodeArtifact(principal, projectId, candidDir, art.name, versionParam);
              'ok' in existing
                ? await userActor.updateCodeArtifact(principal, projectId, art.name, { Text: art.content }, candidDir, versionParam)
                : await userActor.createCodeArtifact(principal, projectId, art.name, { Text: art.content }, art.type, art.category, candidDir, versionParam);
              saved++;
            } catch (e) {
              log(`⚠️ Could not save ${art.name}`);
            }
          }
          log(`✅ Saved ${saved}/${artifacts.length} Candid artifacts`);
        } catch {
          log('⚠️ Could not persist Candid artifacts');
        }
      }

      return {
        success: true,
        wasm: result.wasm,
        candid: result.candid,
        typescript: result.typescript ?? '',
        didJs: result.didJs ?? '',
        jsonSchema: result.jsonSchema ?? '{}',
        compiledWasm: wasmBytes,
      } as DFXUtilsResponse;
      
    } catch (err: any) {
      throw err;
    }
  }

  private static extractActorNameFromMotoko(motokoContent: string, fallbackFilename: string): string {
    const cleanContent = motokoContent
      .replace(/\/\/.*$/gm, '') 
      .replace(/\/\*[\s\S]*?\*\//g, ''); 

    const actorClassMatch = cleanContent.match(/actor\s+class\s+(\w+)\s*\(/);
    if (actorClassMatch && actorClassMatch[1]) {
      return actorClassMatch[1];
    }

    const namedActorMatch = cleanContent.match(/actor\s+(\w+)\s*\{/);
    if (namedActorMatch && namedActorMatch[1]) {
      return namedActorMatch[1];
    }

    const anonymousActorMatch = cleanContent.match(/actor\s*\{/);
    if (anonymousActorMatch) {
      return fallbackFilename.split('/').pop()?.replace('.mo', '') || 'main';
    }

    return fallbackFilename.split('/').pop()?.replace('.mo', '') || 'main';
  }

  private static async deployBackendToCanister(
    backendResult: DFXUtilsResponse,
    backendCanisterId: string,
    userCanisterId: string,
    identity: Identity,
    principal: Principal,
    projectId: string,
    projectName: string,
    log: (message: string) => void
  ): Promise<void> {
    log('🚀 Starting high-performance backend deployment...');

    if (!backendResult.success) {
      throw new Error('Cannot deploy: Backend compilation was not successful');
    }

    if (!backendResult.wasm) {
      throw new Error('Cannot deploy: No WASM data available');
    }

    if (!backendResult.candid) {
      throw new Error('Cannot deploy: No Candid interface available');
    }

    let wasmBytes: Uint8Array;
    
    try {
      if (backendResult.compiledWasm && backendResult.compiledWasm instanceof Uint8Array) {
        wasmBytes = backendResult.compiledWasm;
        log(`Using pre-compiled WASM bytes: ${(wasmBytes.length / 1024).toFixed(2)}KB`);
      } else {
        if (typeof backendResult.wasm !== 'string') {
          throw new Error(`Expected base64 string from DFXUtils, got ${typeof backendResult.wasm}`);
        }

        const binaryString = atob(backendResult.wasm);
        wasmBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          wasmBytes[i] = binaryString.charCodeAt(i);
        }
        log(`WASM converted from base64: ${(wasmBytes.length / 1024).toFixed(2)}KB`);
      }
      
    } catch (error) {
      throw new Error(`Failed to process WASM data: ${error instanceof Error ? error.message : 'Unknown WASM processing error'}`);
    }

    if (wasmBytes.length === 0) {
      throw new Error('WASM data is empty after processing');
    }

    let candidInterface: string;
    try {
      candidInterface = backendResult.candid.trim();
      
      if (candidInterface.length === 0) {
        throw new Error('Candid interface is empty');
      }
      
      log(`Candid interface processed: ${candidInterface.length} characters`);
    } catch (error) {
      throw new Error(`Failed to process Candid interface: ${error instanceof Error ? error.message : 'Unknown Candid error'}`);
    }
    
    let userActor;
    try {
      userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      log('Connected to user canister successfully');
    } catch (error) {
      throw new Error(`Failed to connect to user canister: ${error instanceof Error ? error.message : 'Connection failed'}`);
    }
    
    const metadata = {
      name: 'main.mo',
      canisterType: "backend",
      didInterface: [candidInterface],
      stableInterface: backendResult.jsonSchema ? [backendResult.jsonSchema] : [],
      project: [projectId],
      subType: []
    };

    const wasmSize = wasmBytes.length;
    
    log(`Prepared deployment metadata for canister: ${backendCanisterId}`);
    log(`📦 WASM size: ${wasmSize} bytes (${(wasmSize / (1024 * 1024)).toFixed(2)} MB)`);

    let deploymentResult;

    try {
      if (wasmSize > MAX_CHUNK_SIZE) {
        log("🚀 Using ultra high-performance parallel chunked upload...");
        
        log(`📊 WASM chunking strategy: ${wasmSize} bytes in chunks of ${MAX_CHUNK_SIZE}`);
        
        const sessionResult = await userActor.startWasmUploadSession(
          projectId,
          'main.wasm',
          BigInt(Math.ceil(wasmSize / MAX_CHUNK_SIZE)),
          BigInt(wasmSize),
          [Principal.fromText(backendCanisterId)],
          ["backend"],
          ["production"]
        );

        if (!('ok' in sessionResult)) {
          throw new Error(`Failed to start upload session: ${sessionResult.err || 'Unknown session error'}`);
        }

        const sessionId = sessionResult.ok;
        const wasmArray = Array.from(wasmBytes);
        const totalChunks = Math.ceil(wasmSize / MAX_CHUNK_SIZE);
        
        log(`📤 Upload session started: ${sessionId} (${totalChunks} chunks)`);
        log(`🔧 Ultra high-performance chunking: ${totalChunks} chunks of ${MAX_CHUNK_SIZE} bytes each`);

        // Ultra high-performance parallel chunk upload
        log('🚀 Starting ultra parallel chunk upload process...');
        const chunkUploadStartTime = performance.now();
        
        let uploadedChunks = 0;
        const uploadChunk = async (chunkIndex: number): Promise<void> => {
          const start = chunkIndex * MAX_CHUNK_SIZE;
          const end = Math.min(start + MAX_CHUNK_SIZE, wasmSize);
          const chunk = wasmArray.slice(start, end);

          log(`📤 Uploading chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} bytes)`);

          const chunkResult = await userActor.uploadWasmChunk(sessionId, BigInt(chunkIndex), chunk);
          if (!('ok' in chunkResult)) {
            throw new Error(`Failed to upload chunk ${chunkIndex}: ${chunkResult.err || 'Unknown chunk error'}`);
          }
          
          uploadedChunks++;
          log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`);
        };

        // Execute ultra parallel chunk uploads with maximum concurrency
        await batchProcessWithProgress(
          Array.from({ length: totalChunks }, (_, i) => i),
          uploadChunk,
          MAX_WASM_CHUNKS,
          (completed, total) => {
            log(`📤 Ultra parallel upload progress: ${completed}/${total} chunks (${Math.round((completed / total) * 100)}%)`);
          }
        );

        const chunkUploadEndTime = performance.now();
        const uploadDuration = (chunkUploadEndTime - chunkUploadStartTime) / 1000;
        
        log(`🚀 Ultra parallel chunk upload completed in ${uploadDuration.toFixed(1)}s`);
        log(`📊 Ultra parallel upload performance: ${totalChunks} chunks in ${uploadDuration.toFixed(1)}s (${(totalChunks / uploadDuration).toFixed(1)} chunks/sec)`);

        log('🔗 Finalizing ultra high-performance upload...');
        const finalizeResult = await userActor.finalizeWasmUpload(sessionId);
        if (!('ok' in finalizeResult)) {
          throw new Error(`Failed to finalize upload: ${finalizeResult.err || 'Unknown finalize error'}`);
        }

        log('🚀 Deploying WASM to canister...');
        deploymentResult = await userActor.deployStoredWasm(
          projectId,
          'main.wasm',
          Principal.fromText(backendCanisterId),
          'backend',
          'production',
          principal,
          [metadata],
          [], 
          ["reinstall"] 
        );

      } else {
        log("🚀 Using direct deployment for smaller WASM.");
        
        deploymentResult = await userActor.deployToExistingCanister(
          Principal.fromText(backendCanisterId),
          Array.from(wasmBytes),
          'backend',
          'backend',
          principal,
          [metadata],
          [], 
          ["reinstall"] 
        );
      }

      if (!('ok' in deploymentResult)) {
        throw new Error(`Backend deployment failed: ${deploymentResult.err || 'Unknown deployment error'}`);
      }

      log('✅ High-performance backend deployment completed successfully');
      log(`🎯 Deployed to canister: ${backendCanisterId}`);

      // Save WASM file to project for later download (for both chunked and direct deployment)
      try {
        log('💾 Saving WASM file to project...');
        const wasmsPath = `${projectName}/wasms`;
        const wasmFileName = 'main.wasm';
        
        console.log(`💾 [DeploymentService] Attempting to save WASM:`, {
          projectId,
          wasmsPath,
          wasmFileName,
          wasmSize: wasmBytes.length
        });
        
        // Check if WASM file already exists
        const existing = await userActor.readCodeArtifact(principal, projectId, wasmsPath, wasmFileName, []);
        
        if ('ok' in existing || 'Ok' in existing) {
          // Update existing WASM file
          const updateResult = await userActor.updateCodeArtifact(
            principal,
            projectId,
            wasmFileName,
            { Binary: Array.from(wasmBytes) },
            wasmsPath,
            []
          );
          console.log(`✅ [DeploymentService] WASM update result:`, updateResult);
          log('✅ Updated WASM file in project');
        } else {
          // Create new WASM file
          const createResult = await userActor.createCodeArtifact(
            principal,
            projectId,
            wasmFileName,
            { Binary: Array.from(wasmBytes) },
            'application/wasm',
            'wasm',
            wasmsPath,
            []
          );
          console.log(`✅ [DeploymentService] WASM create result:`, createResult);
          
          if (createResult && typeof createResult === 'object' && ('err' in createResult || 'Err' in createResult)) {
            const error = createResult.err || createResult.Err;
            throw new Error(`Failed to create WASM file: ${typeof error === 'string' ? error : JSON.stringify(error)}`);
          }
          
          log('✅ Saved WASM file to project');
        }
      } catch (wasmSaveError) {
        // Log but don't fail deployment if WASM save fails
        const errorMsg = wasmSaveError instanceof Error ? wasmSaveError.message : 'Unknown error';
        console.error(`❌ [DeploymentService] Failed to save WASM file:`, wasmSaveError);
        log(`⚠️ Could not save WASM file to project: ${errorMsg}`);
      }

    } catch (deployError) {
      const errorMessage = deployError instanceof Error ? deployError.message : 'Unknown deployment error';
      log(`❌ Deployment failed: ${errorMessage}`);
      throw new Error(`Backend deployment failed: ${errorMessage}`);
    }
  }

  private static prepareFrontendFiles(
    fileSnapshot: Record<string, string>,
    serverPair: ServerPair
  ): PreparedFrontendFiles {
    const frontendEntries = Object.entries(fileSnapshot).filter(([fileName]) => {
      const extension = fileName.split('.').pop()?.toLowerCase();
      
      if (['mo', 'did'].includes(extension || '')) return false;
      
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

    // Find package.json
    const packageJsonFile = Object.entries(fileSnapshot).find(([fileName]) => 
      fileName.endsWith('package.json')
    );
    
    if (!packageJsonFile) {
      throw new Error('package.json not found');
    }

    let packageJson: object;
    try {
      packageJson = JSON.parse(packageJsonFile[1]);
    } catch (e) {
      throw new Error('Invalid package.json format');
    }

    return {
      files: frontendFiles,
      packageJson: packageJson
    };
  }

  private static async bundleFrontendCode(
    frontendData: PreparedFrontendFiles,
    serverPair: ServerPair,
    projectName: string,
    log: (message: string) => void
  ): Promise<BundlerResponse> {
    const frontendFilesWithPrefix = addProjectPrefix(frontendData.files, projectName);

    const staticIndexHtml = {
      name: `${projectName}/src/frontend/index.html`,
      content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="./src/index.tsx"></script>
</body>
</html>`
    };

    const allFrontendFiles = [...frontendFilesWithPrefix, staticIndexHtml];

    // Validate bundle requirements
    const hasPackageJson = allFrontendFiles.some(f => f.name.endsWith('package.json'));
    const hasIndexHtml = allFrontendFiles.some(f => 
      f.name.endsWith('index.html') || f.name === 'index.html'
    );
    const hasJavaScriptFiles = allFrontendFiles.some(f => 
      f.name.endsWith('.js') || f.name.endsWith('.jsx') || 
      f.name.endsWith('.ts') || f.name.endsWith('.tsx')
    );
    const hasViteConfig = allFrontendFiles.some(f => 
      f.name.endsWith('vite.config.ts') || f.name.endsWith('vite.config.js')
    );
    
    log(`Pre-bundle validation: package.json=${hasPackageJson ? '✅' : '❌'}, index.html=${hasIndexHtml ? '✅' : '⚠️'}, JS/TS files=${hasJavaScriptFiles ? '✅' : '❌'}, vite.config=${hasViteConfig ? '✅' : '⚠️'}`);
    
    if (!hasPackageJson) {
      throw new Error('Bundle validation failed: No package.json found in project files');
    }
    
    if (!hasJavaScriptFiles) {
      throw new Error('Bundle validation failed: No JavaScript/TypeScript files found');
    }

    if (!hasViteConfig) {
      log('⚠️ Warning: No Vite config found in project files - environment variables may not be injected');
    }

    log('Submitting bundling job to JSBundler...');
    
    let jobResponse: Response;
    let jobData: BundlerJobResponse;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); 
      
      jobResponse = await fetch('https://jsbundler.coinnation.io/kontext/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: allFrontendFiles,
          packageJson: frontendData.packageJson,
          projectType: 'icpstudio'
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
    } catch (submitError) {
      if (submitError instanceof Error) {
        if (submitError.name === 'AbortError') {
          throw new Error('Bundling job submission timed out after 30 seconds');
        }
        throw new Error(`Network error while submitting bundling job: ${submitError.message}`);
      }
      throw new Error(`Failed to submit bundling job: ${String(submitError)}`);
    }

    let jobResponseText = '';
    try {
      jobResponseText = await jobResponse.text();
      
      if (!jobResponse.ok) {
        let errorDetails = jobResponseText;
        try {
          const errorJson = JSON.parse(jobResponseText);
          if (errorJson.error) {
            errorDetails = errorJson.error;
          }
          if (errorJson.message) {
            errorDetails = errorJson.message;
          }
        } catch {
          // Keep original error text if JSON parsing fails
        }
        
        throw new Error(`JSBundler rejected job submission (${jobResponse.status}): ${errorDetails}`);
      }
      
      jobData = JSON.parse(jobResponseText);
      
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message.includes('JSBundler rejected')) {
        throw parseError; 
      }
      
      throw new Error(`Invalid response from JSBundler: ${jobResponseText.substring(0, 200)}...`);
    }
    
    if (!jobData || typeof jobData !== 'object') {
      const errorMsg = 'Invalid job response: Expected object with job information';
      throw new Error(errorMsg);
    }
    
    if (!jobData.success) {
      const errorMsg = jobData.error || 'JSBundler reported job creation failure';
      throw new Error(`JSBundler job creation failed: ${errorMsg}`);
    }
    
    if (!jobData.jobId || typeof jobData.jobId !== 'string') {
      const errorMsg = 'Invalid job response: Missing job ID';
      throw new Error(errorMsg);
    }
    
    if (!jobData.statusUrl || !jobData.downloadUrl) {
      const errorMsg = 'Invalid job response: Missing status or download URLs';
      throw new Error(errorMsg);
    }

    log(`Bundling job started (ID: ${jobData.jobId})`);

    const statusUrl = `https://jsbundler.coinnation.io${jobData.statusUrl}`;
    const downloadUrl = `https://jsbundler.coinnation.io${jobData.downloadUrl}`;

    let attempts = 0;
    const maxAttempts = 60; 
    let bundleComplete = false;

    log('Polling for bundling completion...');

    while (!bundleComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); 
      attempts++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); 
        
        const statusResponse = await fetch(statusUrl, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!statusResponse.ok) {
          log(`Status check failed (attempt ${attempts}/${maxAttempts}): HTTP ${statusResponse.status}`);
          
          if (statusResponse.status === 404 && attempts > 10) {
            const errorMsg = 'Bundling job not found';
            throw new Error(errorMsg);
          }
          
          continue;
        }

        let status: BundlerStatusResponse;
        const statusText = await statusResponse.text();
        
        try {
          status = JSON.parse(statusText);
        } catch (parseError) {
          log(`Invalid status response (attempt ${attempts}): ${statusText.substring(0, 100)}...`);
          continue;
        }
        
        log(`Bundling status (${attempts * 5}s): ${status.status}${status.progress ? ` (${status.progress}%)` : ''}`);
        
        if (status.status === 'completed') {
          bundleComplete = true;
          log('✅ Bundling completed successfully!');
          break;
        } else if (status.status === 'failed') {
          let errorMessage = status.error || 'Unknown bundling error';
          throw new Error(`JSBundler job failed: ${errorMessage}`);
        }
        
      } catch (pollError) {
        if (pollError instanceof Error) {
          if (pollError.message.includes('JSBundler job failed') || 
              pollError.message.includes('Bundling job not found')) {
            throw pollError;
          }
          
          const errorMsg = pollError.name === 'AbortError' ? 
            'Status check timed out' : 
            pollError.message;
            
          log(`Status poll error (attempt ${attempts}): ${errorMsg}`);
        }
      }
    }

    if (!bundleComplete) {
      const errorMsg = 'Bundling timeout - job did not complete within 5 minutes';
      throw new Error(errorMsg);
    }

    log('Downloading completed bundle...');
    
    let downloadResponse: Response;
    let finalResult: BundlerResponse;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); 
      
      downloadResponse = await fetch(downloadUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
    } catch (downloadError) {
      if (downloadError instanceof Error) {
        if (downloadError.name === 'AbortError') {
          throw new Error('Bundle download timed out after 60 seconds');
        }
        throw new Error(`Network error during bundle download: ${downloadError.message}`);
      }
      throw new Error(`Failed to download bundle: ${String(downloadError)}`);
    }
    
    if (!downloadResponse.ok) {
      let errorText = '';
      try {
        errorText = await downloadResponse.text();
      } catch {
        errorText = `HTTP ${downloadResponse.status}`;
      }
      
      throw new Error(`Failed to download bundle (${downloadResponse.status}): ${errorText}`);
    }

    let bundleData = '';
    try {
      bundleData = await downloadResponse.text();
      finalResult = JSON.parse(bundleData);
    } catch (parseError) {
      const errorMsg = 'Invalid bundle response: Could not parse downloaded data';
      throw new Error(errorMsg);
    }
    
    if (!finalResult || typeof finalResult !== 'object') {
      const errorMsg = 'Invalid bundle result: Expected object with bundle data';
      throw new Error(errorMsg);
    }
    
    if (!finalResult.success) {
      const errorMsg = finalResult.error || 'Bundle indicates failure without specific error';
      throw new Error(`Bundle processing failed: ${errorMsg}`);
    }
    
    if (!finalResult.output || typeof finalResult.output !== 'object') {
      const errorMsg = 'Invalid bundle result: Missing or invalid output data';
      throw new Error(errorMsg);
    }

    const outputFiles = Object.keys(finalResult.output);
    if (outputFiles.length === 0) {
      const errorMsg = 'Bundle result contains no output files';
      throw new Error(errorMsg);
    }

    log(`✅ Bundle downloaded successfully! Generated ${outputFiles.length} files.`);
    
    return finalResult;
  }

  private static async deployFrontendToCanister(
    bundleResult: BundlerResponse,
    frontendCanisterId: string,
    userCanisterId: string,
    identity: Identity,
    log: (message: string) => void
  ): Promise<string> {
    
    if (!userCanisterId || !identity) {
      throw new Error('Missing required parameters for frontend deployment');
    }

    log(`🚀 Processing ${Object.keys(bundleResult.output).length} bundled files for ultra high-performance deployment...`);

    const resolvedIdentity = await Promise.resolve(identity);
    const host = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://127.0.0.1:4943'
      : 'https://icp0.io';
    
    const agent = new HttpAgent({
      identity: resolvedIdentity,
      host: host
    });

    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      await agent.fetchRootKey();
    }

    const assetManager = new AssetManager({
      canisterId: Principal.fromText(frontendCanisterId),
      agent: agent,
    });

    log('🔗 Asset manager initialized for frontend canister');

    const getContentType = (filename: string): string => {
      const ext = filename.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'html':
          return 'text/html';
        case 'js':
          return 'application/javascript';
        case 'css':
          return 'text/css';
        case 'json':
          return 'application/json';
        case 'png':
          return 'image/png';
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg';
        case 'svg':
          return 'image/svg+xml';
        case 'ico':
          return 'image/x-icon';
        case 'woff':
        case 'woff2':
          return 'font/woff';
        case 'ttf':
          return 'font/ttf';
        default:
          return 'application/octet-stream';
      }
    };

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

    try {
      log('📋 Deploying CSP configuration...');
      await assetManager.store(
        new TextEncoder().encode(createUnrestrictedCSPConfig()),
        {
          fileName: '.ic-assets.json5',
          contentType: 'application/json'
        }
      );
      log('✅ CSP configuration deployed');

      const hasIndexHtml = Object.keys(bundleResult.output).some(filename => 
        filename.endsWith('index.html') || filename === 'index.html'
      );

      if (!hasIndexHtml) {
        log('📄 Creating default index.html...');
        let defaultIndexHtml = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Deployed App</title>
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
        log('✅ Default index.html created with element selection script');
      }

      // 🔥 NEW: Inject element selection script into index.html files
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
            log(`✅ Injected element selection script into ${filename}`);
          } catch (err) {
            log(`⚠️ Failed to inject script into ${filename}: ${err}`);
            console.error('Script injection error details:', err, {
              filename,
              dataType: typeof content.data,
              isArray: Array.isArray(content.data),
              dataLength: content.data?.length
            });
          }
        }
      }

      // Ultra high-performance asset categorization and prioritization
      const assetEntries = Object.entries(bundleResult.output);
      const criticalAssets: Array<[string, any]> = [];
      const smallAssets: Array<[string, any]> = [];
      const largeAssets: Array<[string, any]> = [];
      
      log('📊 Categorizing assets for ultra high-performance parallel upload...');
      
      assetEntries.forEach(([filename, content]) => {
        if (!content || !content.data) return;
        
        const fileSize = content.data.length;
        const isHtml = filename.endsWith('.html') || filename === 'index.html';
        const isMainJs = filename.includes('index') && (filename.endsWith('.js') || filename.endsWith('.mjs'));
        const isMainCss = filename.includes('index') && filename.endsWith('.css');
        
        if (isHtml || isMainJs || isMainCss) {
          criticalAssets.push([filename, content]);
        } else if (fileSize <= SMALL_ASSET_THRESHOLD) {
          smallAssets.push([filename, content]);
        } else {
          largeAssets.push([filename, content]);
        }
      });
      
      const totalFiles = assetEntries.length;
      log(`📊 Asset categorization: ${criticalAssets.length} critical, ${smallAssets.length} small, ${largeAssets.length} large`);
      log(`📁 Asset distribution: Critical=${criticalAssets.length}, Small(<${SMALL_ASSET_THRESHOLD}B)=${smallAssets.length}, Large(>${SMALL_ASSET_THRESHOLD}B)=${largeAssets.length}`);

      let deployedCount = 0;
      const deploymentStartTime = performance.now();
      
      // Ultra high-performance asset deployment function
      const deployAsset = async (filename: string, content: any, priority: 'critical' | 'normal' | 'low' = 'normal'): Promise<void> => {
        try {
          if (!content || !content.data) {
            log(`⚠️ Skipping ${filename} - no content data`);
            return;
          }

          const fileData = new Uint8Array(content.data);
          const contentType = getContentType(filename);

          log(`📤 Deploying ${priority} asset: ${filename} (${fileData.length} bytes, ${contentType})`);

          await assetManager.store(fileData, {
            fileName: filename,
            contentType: contentType
          });

          deployedCount++;
          log(`✅ Deployed asset: ${filename} (${deployedCount}/${totalFiles})`);

        } catch (fileError) {
          const errorMsg = fileError instanceof Error ? fileError.message : String(fileError);
          log(`❌ Failed to deploy ${filename}: ${errorMsg}`);
          console.error(`Failed to deploy ${filename}:`, fileError);
          throw fileError;
        }
      };

      // PHASE 1: Deploy critical assets first (sequential for reliability)
      if (criticalAssets.length > 0) {
        log(`🎯 Phase 1: Deploying ${criticalAssets.length} critical assets...`);
        
        for (const [filename, content] of criticalAssets) {
          await deployAsset(filename, content, 'critical');
        }
        
        log(`✅ Critical assets deployed (${criticalAssets.length}/${totalFiles})`);
      }

      // PHASE 2: Deploy small assets with ultra parallelization
      if (smallAssets.length > 0) {
        log(`🚀 Phase 2: Deploying ${smallAssets.length} small assets with ultra parallelization...`);
        
        const smallAssetStartTime = performance.now();
        
        await batchProcessWithProgress(
          smallAssets,
          async ([filename, content], index) => {
            await deployAsset(filename, content, 'normal');
          },
          MAX_SMALL_ASSETS,
          (completed, total) => {
            log(`📤 Small asset upload progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`);
          }
        );
        
        const smallAssetEndTime = performance.now();
        const smallAssetDuration = (smallAssetEndTime - smallAssetStartTime) / 1000;
        
        log(`✅ Small assets deployed with ultra parallelization (${smallAssetDuration.toFixed(1)}s)`);
        log(`📊 Small asset performance: ${smallAssets.length} assets in ${smallAssetDuration.toFixed(1)}s (${(smallAssets.length / smallAssetDuration).toFixed(1)} assets/sec)`);
      }

      // PHASE 3: Deploy large assets with high concurrency
      if (largeAssets.length > 0) {
        log(`📦 Phase 3: Deploying ${largeAssets.length} large assets with high concurrency...`);
        
        const largeAssetStartTime = performance.now();
        
        await batchProcessWithProgress(
          largeAssets,
          async ([filename, content], index) => {
            await deployAsset(filename, content, 'low');
          },
          MAX_LARGE_ASSETS,
          (completed, total) => {
            log(`📤 Large asset upload progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`);
          }
        );
        
        const largeAssetEndTime = performance.now();
        const largeAssetDuration = (largeAssetEndTime - largeAssetStartTime) / 1000;
        
        log(`✅ Large assets deployed with high concurrency (${largeAssetDuration.toFixed(1)}s)`);
        log(`📊 Large asset performance: ${largeAssets.length} assets in ${largeAssetDuration.toFixed(1)}s`);
      }

      const deploymentEndTime = performance.now();
      const totalDeploymentTime = (deploymentEndTime - deploymentStartTime) / 1000;

      log(`🎉 Ultra high-performance deployment completed: ${deployedCount}/${totalFiles} files in ${totalDeploymentTime.toFixed(1)}s`);
      log(`📊 Overall deployment performance: ${totalFiles} assets in ${totalDeploymentTime.toFixed(1)}s (${(totalFiles / totalDeploymentTime).toFixed(1)} assets/sec)`);

      const frontendUrl = `https://${frontendCanisterId}.icp0.io`;
      log(`🌐 Frontend deployed at: ${frontendUrl}`);

      return frontendUrl;

    } catch (deploymentError) {
      const errorMsg = deploymentError instanceof Error ? deploymentError.message : String(deploymentError);
      log(`❌ Ultra high-performance frontend deployment failed: ${errorMsg}`);
      throw new Error(`Failed to deploy to frontend canister: ${errorMsg}`);
    }
  }

  private static addCandidArtifactsToFiles(
    originalSnapshot: Record<string, string>,
    backendResult: DFXUtilsResponse,
    projectName: string,
    log: (message: string) => void
  ): Record<string, string> {
    
    log('Adding Candid artifacts to deployment snapshot...');
    
    const enhancedSnapshot = { ...originalSnapshot };
    
    const mainFileEntry = Object.entries(originalSnapshot).find(([name]) => 
      name.endsWith('/main.mo') || name.endsWith('/Main.mo') || name === 'main.mo' || name === 'Main.mo'
    ) || Object.entries(originalSnapshot).find(([name]) => name.endsWith('.mo'));

    let actorName = 'main';
    if (mainFileEntry) {
      actorName = this.extractActorNameFromMotoko(mainFileEntry[1], mainFileEntry[0]);
    }

    if (backendResult.candid) {
      const candidPath = `${projectName}/src/frontend/candid/${actorName}.did`;
      enhancedSnapshot[candidPath] = backendResult.candid;
      log(`Added Candid interface: ${candidPath}`);
    }
    
    if (backendResult.typescript) {
      const tsPath = `${projectName}/src/frontend/candid/${actorName}.did.d.ts`;
      enhancedSnapshot[tsPath] = backendResult.typescript;
      log(`Added TypeScript definitions: ${tsPath}`);
    }
    
    if (backendResult.didJs) {
      const jsPath = `${projectName}/src/frontend/candid/${actorName}.did.js`;
      enhancedSnapshot[jsPath] = backendResult.didJs;
      log(`Added JavaScript bindings: ${jsPath}`);
    }
    
    if (backendResult.jsonSchema && backendResult.jsonSchema !== '{}') {
      const schemaPath = `${projectName}/src/frontend/candid/${actorName}.json`;
      enhancedSnapshot[schemaPath] = backendResult.jsonSchema;
      log(`Added JSON schema: ${schemaPath}`);
    }
    
    const totalFiles = Object.keys(enhancedSnapshot).length;
    const addedFiles = totalFiles - Object.keys(originalSnapshot).length;
    log(`✅ Enhanced snapshot: +${addedFiles} Candid artifacts`);
    
    return enhancedSnapshot;
  }
}