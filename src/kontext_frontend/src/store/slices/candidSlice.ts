import { StateCreator } from 'zustand';

export interface CandidContext {
  isAvailable: boolean;
  candid: string | null;
  typescript: string | null;
  methods: Array<{ name: string; signature: string }>;
  extractedAt: number | null;
}

export interface CandidSliceState {
  candidContext: CandidContext | null;
}

export interface CandidSliceActions {
  extractCandidFromGeneration: (generatedFiles: { [key: string]: string }, projectName: string) => Promise<boolean>;
  setCandidContext: (candid: string, typescript: string, methods: Array<{ name: string; signature: string }>) => void;
  clearCandidContext: () => void;
  hasCandidContext: () => boolean;
}

export type CandidSlice = CandidSliceState & CandidSliceActions;

const log = (category: string, message: string, ...args: any[]) => {
  console.log(message, ...args);
};

const DEFAULT_MOTOKO_PACKAGES = [
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

const extractMotokoFiles = (allFiles: { [fileName: string]: string }): Array<{ name: string; content: string }> => {
  return Object.entries(allFiles)
    .filter(([fileName]) => fileName.endsWith('.mo'))
    .map(([fileName, content]) => ({
      name: fileName,
      content: content
    }));
};

/**
 * Extract actor name from Motoko code (same logic as DeploymentService)
 * Returns the actor name for proper Candid file naming
 */
const extractActorNameFromMotoko = (motokoContent: string, fallbackFilename: string): string => {
  const cleanContent = motokoContent
    .replace(/\/\/.*$/gm, '') 
    .replace(/\/\*[\s\S]*?\*\//g, ''); 

  // Try actor class first
  const actorClassMatch = cleanContent.match(/actor\s+class\s+(\w+)\s*\(/);
  if (actorClassMatch && actorClassMatch[1]) {
    return actorClassMatch[1];
  }

  // Try named actor
  const namedActorMatch = cleanContent.match(/actor\s+(\w+)\s*\{/);
  if (namedActorMatch && namedActorMatch[1]) {
    return namedActorMatch[1];
  }

  // Anonymous actor - use filename
  const anonymousActorMatch = cleanContent.match(/actor\s*\{/);
  if (anonymousActorMatch) {
    return fallbackFilename.split('/').pop()?.replace('.mo', '') || 'main';
  }

  return fallbackFilename.split('/').pop()?.replace('.mo', '') || 'main';
};

const getPlatformMotokoFiles = async (projectName: string): Promise<Array<{ name: string; content: string }>> => {
  try {
    const { platformProvidedFilesService } = await import('../../services/PlatformProvidedFilesService');
    
    const platformFiles = await platformProvidedFilesService.getPlatformMotokoFiles(projectName);
    
    return platformFiles.filter(file => file.name.endsWith('.mo'));
  } catch (error) {
    log('GENERATION', 'Failed to load platform Motoko files:', error);
    return [];
  }
};

const generateCandidArtifactsFromMotoko = async (
  files: Array<{ name: string; content: string }>, 
  packages: Array<{ name: string; repo: string; version: string; }>,
  mainFile: string,
  projectName: string
): Promise<{ success: boolean; candid?: string; typescript?: string; didJs?: string; jsonSchema?: string; wasm?: string; error?: string }> => {
  try {
    log('GENERATION', 'Attempting early Candid generation from Motoko files...');
    
    const { CandidGenerationService } = await import('../../services/CandidGenerationService');
    
    console.log('projectName:', JSON.stringify(projectName));
    console.log('files before mapping:', files.map(f => f.name));

    const request = {
      files: files.map(file => {
        const hasPrefix = file.name.startsWith(`${projectName}/`);
        const newName = hasPrefix ? file.name : `${projectName}/${file.name}`;
        console.log(`File: ${file.name} -> hasPrefix: ${hasPrefix} -> newName: ${newName}`);
        return {
          ...file,
          name: newName
        };
      }),
      packages: packages,
      mainFile: `${projectName}/${mainFile}`
    };
    
    log('GENERATION', 'Calling CandidGenerationService...');

    const result = await CandidGenerationService.generateCandidArtifacts(request);
    
    if (result.success) {
      log('GENERATION', 'Candid artifacts generated successfully');
      return {
        success: true,
        candid: result.candid,
        typescript: result.typescript,
        didJs: result.didJs,
        jsonSchema: result.jsonSchema,
        wasm: result.wasm  // 🚀 Include WASM for caching
      };
    } else {
      log('GENERATION', 'Candid generation failed:', result.error);
      return {
        success: false,
        error: result.error
      };
    }
    
  } catch (error) {
    log('GENERATION', 'Error in Candid generation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

const extractCandidMethodSignatures = async (candidInterface: string): Promise<Array<{ name: string; signature: string }>> => {
  try {
    const { CandidGenerationService } = await import('../../services/CandidGenerationService');
    return CandidGenerationService.extractMethodSignatures(candidInterface);
  } catch (error) {
    log('GENERATION', 'Failed to extract method signatures from Candid:', error);
    return [];
  }
};

export const createCandidSlice: StateCreator<any, [], [], CandidSlice> = (set, get) => ({
  candidContext: null,

  extractCandidFromGeneration: async (generatedFiles: { [key: string]: string }, projectName: string): Promise<boolean> => {
    try {
      log('GENERATION', 'Extracting Candid from generated Motoko files...');
      
      const aiMotokoFiles = extractMotokoFiles(generatedFiles);
      
      if (aiMotokoFiles.length === 0) {
        log('GENERATION', 'No AI-generated Motoko files found - skipping Candid extraction');
        return false;
      }
      
      log('GENERATION', `Found ${aiMotokoFiles.length} AI-generated Motoko files`);
      
      // 🔥 CRITICAL FIX: Do NOT include platform template files in compilation
      // Platform files (MotokoReactBible backend) have complex dependencies that cause compilation errors
      // We only need to compile the AI-generated backend to extract its Candid interface
      
      log('GENERATION', `Compiling ${aiMotokoFiles.length} AI-generated Motoko files (excluding platform template files)`);
      
      const mainFile = aiMotokoFiles.find(f => 
        f.name.endsWith('/main.mo') || 
        f.name.endsWith('/Main.mo') ||
        f.name === 'main.mo' ||
        f.name === 'Main.mo'
      )?.name || aiMotokoFiles[0].name;
      
      log('GENERATION', `Using main file: ${mainFile}`);
      
      // 🔥 CRITICAL: Only compile AI-generated files, not platform template files
      const candidResult = await generateCandidArtifactsFromMotoko(
        aiMotokoFiles,  // ✅ Only AI-generated backend
        DEFAULT_MOTOKO_PACKAGES,  // Basic packages only
        mainFile,
        projectName
      );
      
      if (candidResult.success && candidResult.candid) {
        const methods = await extractCandidMethodSignatures(candidResult.candid);
        
        (get() as any).setCandidContext(
          candidResult.candid,
          candidResult.typescript || '',
          methods
        );
        
        // 🔥 CRITICAL: Extract actor name from main file for proper Candid naming
        // AI project generation expects files like "BudgetManager.did.js", not "backend.did.js"
        const mainFileEntry = aiMotokoFiles.find(f => 
          f.name.endsWith('/main.mo') || 
          f.name.endsWith('/Main.mo') ||
          f.name === 'main.mo' ||
          f.name === 'Main.mo'
        ) || aiMotokoFiles[0];
        
        const actorName = extractActorNameFromMotoko(mainFileEntry.content, mainFileEntry.name);
        log('GENERATION', `🎯 Extracted actor name: ${actorName}`);
        
        const candidFiles: { [fileName: string]: string } = {};
        
        if (candidResult.candid) {
          candidFiles[`src/frontend/candid/${actorName}.did`] = candidResult.candid;
        }
        
        if (candidResult.typescript) {
          candidFiles[`src/frontend/candid/${actorName}.did.d.ts`] = candidResult.typescript;
        }
        
        if (candidResult.didJs) {
          candidFiles[`src/frontend/candid/${actorName}.did.js`] = candidResult.didJs;
        }
        
        if (candidResult.jsonSchema) {
          candidFiles[`src/frontend/candid/${actorName}.json`] = candidResult.jsonSchema;
        }
        
        if (Object.keys(candidFiles).length > 0) {
          (get() as any).updateGeneratedFiles(candidFiles);
          
          const storeState = get() as any;
          const { activeProject } = storeState;
          if (activeProject) {
            // 🔥 FIX: Access projectFiles directly from state, not via function
            const currentProjectFiles = storeState.projectFiles?.[activeProject] || {};
            const allFilesToSave = {
              ...currentProjectFiles,
              ...candidFiles
            };
            
            (get() as any).saveProjectFiles(activeProject, allFilesToSave);
          }
          
          log('GENERATION', `Added ${Object.keys(candidFiles).length} Candid files to project and tabs`);
        }
        
        // 🚀 NEW: Save WASM as Binary artifact for first deployment (saves 2-5 seconds)
        if (candidResult.wasm) {
          try {
            log('GENERATION', '💾 Saving compiled WASM for first deployment...');
            
            // Convert base64 to Uint8Array (same as deployment does)
            const binaryString = atob(candidResult.wasm);
            const wasmBytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              wasmBytes[i] = binaryString.charCodeAt(i);
            }
            
            // Save as Binary artifact using the proven export format
            const { activeProject, userCanisterId, identity, principal } = get() as any;
            
            if (activeProject && userCanisterId && identity && principal) {
              const { userCanisterService } = await import('../../services/UserCanisterService');
              const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
              
              // 🎯 CRITICAL: Use actor name for WASM file (matches Candid naming)
              const wasmFileName = `${actorName}.wasm`;
              
              // Save to .deploy/{actorName}.wasm using Binary format (same as export)
              const saveResult = await userActor.createCodeArtifact(
                principal,
                activeProject,
                wasmFileName,
                { Binary: Array.from(wasmBytes) },  // 🎯 Same format as export!
                'application/wasm',
                'wasm',
                '.deploy',  // Hidden directory for temporary build artifacts
                []
              );
              
              if ('ok' in saveResult || 'Ok' in saveResult) {
                log('GENERATION', `✅ Cached compiled WASM as ${wasmFileName} (${(wasmBytes.length / 1024).toFixed(1)} KB) for first deployment`);
              } else {
                log('GENERATION', '⚠️ Failed to save WASM cache (non-critical)');
              }
            }
          } catch (wasmError) {
            log('GENERATION', '⚠️ Failed to save WASM cache (non-critical):', wasmError);
          }
        }
        
        log('GENERATION', `Candid context established with ${methods.length} methods`);
        log('GENERATION', `Candid interface preview: ${candidResult.candid.substring(0, 200)}...`);
        return true;
      } else {
        log('GENERATION', `Candid extraction failed: ${candidResult.error}`);
        return false;
      }
      
    } catch (error) {
      log('GENERATION', 'Error in Candid extraction:', error);
      return false;
    }
  },

  setCandidContext: (candid: string, typescript: string, methods: Array<{ name: string; signature: string }>) => {
    set((state: any) => {
      state.candidContext = {
        isAvailable: true,
        candid,
        typescript,
        methods,
        extractedAt: Date.now()
      };
    });
  },

  clearCandidContext: () => {
    set((state: any) => {
      state.candidContext = null;
    });
  },

  hasCandidContext: (): boolean => {
    const context = (get() as any).candidContext;
    return context !== null && context.isAvailable && context.candid !== null;
  },
});