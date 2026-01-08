import { StateCreator } from 'zustand';
import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/agent';

export interface ProjectFilesSliceState {
  projectFiles: { [projectId: string]: { [fileName: string]: string } };
}

export interface ProjectFilesSliceActions {
  loadProjectFiles: (projectId: string) => Promise<{ [fileName: string]: string }>;
  saveProjectFiles: (projectId: string, files: { [fileName: string]: string }) => Promise<boolean>;
  saveIndividualFile: (projectId: string, fileName: string, content: string) => Promise<boolean>;
  deleteIndividualFile: (projectId: string, fileName: string) => Promise<boolean>;
  createIndividualFile: (projectId: string, fileName: string, content?: string) => Promise<boolean>;
  renameIndividualFile: (projectId: string, oldFileName: string, newFileName: string) => Promise<boolean>;
  updateProjectFilesInMemory: (projectId: string, fileName: string, content: string) => void;
  removeProjectFilesFromMemory: (projectId: string, fileName: string) => void;
  getProjectFileContent: (projectId: string, fileName: string) => string | null;
  clearProjectFiles: (projectId: string) => void;
}

export type ProjectFilesSlice = ProjectFilesSliceState & ProjectFilesSliceActions;

const log = (category: string, message: string, ...args: any[]) => {
  const categories = ['PROJECT_FILES', 'PERSISTENCE', 'FILE_OPERATIONS', 'ERROR_HANDLING', 'STATE_MANAGEMENT', 'PATH_PARSING', 'PARAMETER_MAPPING', 'PROJECT_NAME_RESOLUTION'];
  if (categories.includes(category)) {
    console.log(`[${category}] ${message}`, ...args);
  }
};

// 🆕 NEW: Path parsing utility functions
const parseFilePath = (fullPath: string): { fileName: string; relativePath: string } => {
  const lastSlashIndex = fullPath.lastIndexOf('/');
  
  if (lastSlashIndex === -1) {
    // No directory separator, it's a root file
    return {
      fileName: fullPath,
      relativePath: ''
    };
  }
  
  const fileName = fullPath.substring(lastSlashIndex + 1);
  const relativePath = fullPath.substring(0, lastSlashIndex);
  
  log('PATH_PARSING', '🔍 [PATH PARSE] Parsed file path:', {
    fullPath,
    fileName,
    relativePath
  });
  
  return { fileName, relativePath };
};

// 🆕 NEW: Project name resolution from state
const getProjectNameFromState = (projectId: string, state: any): string | null => {
  try {
    log('PROJECT_NAME_RESOLUTION', '🔍 [PROJECT NAME] Looking up project name for ID:', projectId);
    
    // Check if projects is an array
    if (Array.isArray(state.projects)) {
      const project = state.projects.find((p: any) => p.id === projectId);
      if (project) {
        const projectName = project.name || project.title;
        log('PROJECT_NAME_RESOLUTION', '✅ [PROJECT NAME] Found in array:', projectName);
        return projectName;
      }
    }
    
    // Check if projects is an object/map
    if (state.projects && typeof state.projects === 'object' && state.projects[projectId]) {
      const project = state.projects[projectId];
      const projectName = project.name || project.title;
      log('PROJECT_NAME_RESOLUTION', '✅ [PROJECT NAME] Found in object:', projectName);
      return projectName;
    }
    
    // Try alternative state locations
    if (state.activeProject === projectId) {
      // Check current project info
      if (state.currentProject && (state.currentProject.name || state.currentProject.title)) {
        const projectName = state.currentProject.name || state.currentProject.title;
        log('PROJECT_NAME_RESOLUTION', '✅ [PROJECT NAME] Found in currentProject:', projectName);
        return projectName;
      }
    }
    
    log('PROJECT_NAME_RESOLUTION', '❌ [PROJECT NAME] Not found for ID:', projectId);
    log('PROJECT_NAME_RESOLUTION', '📊 [PROJECT NAME] Available state:', {
      projectsType: Array.isArray(state.projects) ? 'array' : typeof state.projects,
      projectsKeys: state.projects ? Object.keys(state.projects).slice(0, 5) : 'none',
      activeProject: state.activeProject,
      hasCurrentProject: !!state.currentProject
    });
    
    return null;
  } catch (error) {
    log('PROJECT_NAME_RESOLUTION', '❌ [PROJECT NAME] Error during lookup:', error);
    return null;
  }
};

// 🆕 NEW: Construct full path with project name
const constructFullFilePath = (projectId: string, relativePath: string, state: any): string => {
  const projectName = getProjectNameFromState(projectId, state);
  
  if (!projectName) {
    log('PROJECT_NAME_RESOLUTION', '⚠️ [FULL PATH] Using relative path without project name prefix');
    return relativePath;
  }
  
  const fullPath = relativePath ? `${projectName}/${relativePath}` : projectName;
  
  log('PROJECT_NAME_RESOLUTION', '🎯 [FULL PATH] Constructed full path:', {
    projectId,
    projectName,
    relativePath,
    fullPath
  });
  
  return fullPath;
};

// 🔥 NEW: Enhanced parameter validation utility
const validateSaveParameters = (projectId: string, files: { [fileName: string]: string }, userCanisterId: string, identity: Identity) => {
  const errors: string[] = [];
  
  if (!projectId || typeof projectId !== 'string') {
    errors.push('projectId must be a non-empty string');
  }
  
  if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
    errors.push('files must be a non-empty object');
  }
  
  if (!userCanisterId || typeof userCanisterId !== 'string' || !userCanisterId.includes('-')) {
    errors.push(`userCanisterId must be a valid canister ID string, got: ${typeof userCanisterId}`);
  }
  
  if (!identity || typeof identity !== 'object' || typeof identity.getPrincipal !== 'function') {
    errors.push(`identity must be a valid Identity object with getPrincipal method, got: ${typeof identity}`);
  }
  
  return errors;
};

// 🔥 NEW: Enhanced individual file parameter validation
const validateIndividualFileParameters = (projectId: string, fileName: string, userCanisterId: string, identity: Identity) => {
  const errors: string[] = [];
  
  if (!projectId || typeof projectId !== 'string') {
    errors.push('projectId must be a non-empty string');
  }
  
  if (!fileName || typeof fileName !== 'string') {
    errors.push('fileName must be a non-empty string');
  }
  
  if (!userCanisterId || typeof userCanisterId !== 'string' || !userCanisterId.includes('-')) {
    errors.push(`userCanisterId must be a valid canister ID string, got: ${typeof userCanisterId}`);
  }
  
  if (!identity || typeof identity !== 'object' || typeof identity.getPrincipal !== 'function') {
    errors.push(`identity must be a valid Identity object with getPrincipal method, got: ${typeof identity}`);
  }
  
  return errors;
};

export const createProjectFilesSlice: StateCreator<any, [], [], ProjectFilesSlice> = (set, get) => ({
  projectFiles: {},

  loadProjectFiles: async (projectId: string): Promise<{ [fileName: string]: string }> => {
    log('PROJECT_FILES', '📂 [LOAD FILES] Starting load project files for project:', projectId);
    
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        throw new Error('Missing authentication data for file loading');
      }

      // ✅ Validate userCanisterId format before using it
      if (typeof userCanisterId !== 'string' || !userCanisterId.includes('-') || userCanisterId.length < 20) {
        throw new Error(`Invalid userCanisterId format: ${userCanisterId} (type: ${typeof userCanisterId})`);
      }

      const { userCanisterService } = await import('../../services/UserCanisterService');
      
      log('PROJECT_FILES', '📡 [LOAD FILES] Calling UserCanisterService.loadCodeArtifacts');
      
      const result = await userCanisterService.loadCodeArtifacts(
        projectId,        
        userCanisterId,   
        identity          
      );

      if (result.success && result.artifacts) {
        // 🔥 SURGICAL FIX: Restore intelligent path reconstruction from old version
        const files: { [fileName: string]: string } = {};
        
        result.artifacts.forEach((artifact: any) => {
          // Skip WASM files - they're excluded from regular loading to avoid large payloads
          // They can only be downloaded via the explicit download button
          if (artifact.fileName && artifact.fileName.endsWith('.wasm')) {
            log('PROJECT_FILES', `🚫 [LOAD FILES] Skipping WASM file: ${artifact.fileName}`);
            return;
          }
          
          if (artifact.fileName && artifact.content) {
            let fileKey = artifact.fileName; // Default fallback
            
            // Method 1: Try to reconstruct from ID field
            if (artifact.id && typeof artifact.id === 'string') {
              const idParts = artifact.id.split(':');
              if (idParts.length >= 2) {
                const fullPath = idParts[1];
                const firstSlashIndex = fullPath.indexOf('/');
                if (firstSlashIndex !== -1) {
                  const relativePath = fullPath.substring(firstSlashIndex + 1);
                  if (relativePath && relativePath !== artifact.fileName) {
                    fileKey = relativePath;
                    log('PROJECT_FILES', '🎯 [PATH RECONSTRUCTION] ID method - reconstructed path:', {
                      originalId: artifact.id,
                      extractedPath: relativePath,
                      fileName: artifact.fileName
                    });
                  }
                }
              }
            }
            
            // Method 2: If ID method didn't work, try path + fileName combination
            if (fileKey === artifact.fileName && artifact.path && typeof artifact.path === 'string') {
              // Remove project name prefix from path to get relative path
              let cleanPath = artifact.path;
              const pathParts = cleanPath.split('/');
              if (pathParts.length > 1) {
                // Skip the first part (project name) and join the rest
                const relativePath = pathParts.slice(1).join('/');
                if (relativePath) {
                  fileKey = `${relativePath}/${artifact.fileName}`;
                  log('PROJECT_FILES', '🎯 [PATH RECONSTRUCTION] Path+fileName method - reconstructed path:', {
                    originalPath: artifact.path,
                    relativePath: relativePath,
                    fileName: artifact.fileName,
                    finalKey: fileKey
                  });
                }
              }
            }
            
            files[fileKey] = artifact.content;
          }
        });

        log('PROJECT_FILES', '✅ [LOAD FILES] Files loaded successfully:', {
          projectId,
          fileCount: Object.keys(files).length,
          fileNames: Object.keys(files)
        });

        // Update state with loaded files
        set((state: any) => {
          if (!state.projectFiles) {
            state.projectFiles = {};
          }
          state.projectFiles[projectId] = { ...files };
        });

        return files;
      } else {
        throw new Error(result.error || 'Failed to load project files');
      }
    } catch (error) {
      log('PROJECT_FILES', '❌ [LOAD FILES] Load failed:', error);
      
      // Return empty object on error but don't throw
      set((state: any) => {
        if (!state.projectFiles) {
          state.projectFiles = {};
        }
        if (!state.projectFiles[projectId]) {
          state.projectFiles[projectId] = {};
        }
      });
      
      return {};
    }
  },

  saveProjectFiles: async (projectId: string, files: { [fileName: string]: string }): Promise<boolean> => {
    log('PROJECT_FILES', '💾 [SAVE PROJECT] Starting save project files:', {
      projectId,
      fileCount: Object.keys(files).length,
      fileNames: Object.keys(files)
    });
    
    try {
      // 🔥 CRITICAL FIX: Enhanced parameter extraction with validation
      const state = get() as any;
      let { userCanisterId, identity } = state;
      
      // 🔥 NEW: Comprehensive parameter validation
      const validationErrors = validateSaveParameters(projectId, files, userCanisterId, identity);
      if (validationErrors.length > 0) {
        log('PROJECT_FILES', '🚨 [VALIDATION ERROR] Parameter validation failed:', validationErrors);
        
        // 🔥 NEW: Attempt to recover from corrupted parameters
        try {
          log('PROJECT_FILES', '🔧 [RECOVERY] Attempting parameter recovery...');
          
          // Re-extract parameters from fresh state
          const freshState = get() as any;
          userCanisterId = freshState.userCanisterId;
          identity = freshState.identity;
          
          // Re-validate after recovery attempt
          const retryValidation = validateSaveParameters(projectId, files, userCanisterId, identity);
          if (retryValidation.length > 0) {
            throw new Error(`Parameter recovery failed: ${retryValidation.join(', ')}`);
          }
          
          log('PROJECT_FILES', '✅ [RECOVERY] Parameter recovery successful');
        } catch (recoveryError) {
          throw new Error(`Authentication parameters corrupted and recovery failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown recovery error'}`);
        }
      }

      const { userCanisterService } = await import('../../services/UserCanisterService');
      
      // 🆕 VERSION-AWARE: Get selected version ID from store
      const selectedVersionId = get().getSelectedVersion();
      log('PROJECT_FILES', `📡 [SAVE PROJECT] Calling UserCanisterService.saveCodeArtifactsParallel with version: ${selectedVersionId || 'Sandbox'}`);
      
      const result = await userCanisterService.saveCodeArtifactsParallel(
        files,          
        projectId,      
        userCanisterId, 
        identity,       
        undefined,      // projectName (optional)
        selectedVersionId || null, // 🆕 VERSION-AWARE: Pass selected version ID (convert undefined to null)
        (progress) => { // progressCallback (optional)
          log('PROJECT_FILES', `📊 [SAVE PROGRESS] ${progress.percent}% - ${progress.message}`);
        }
      );

      if (result.success) {
        log('PROJECT_FILES', '✅ [SAVE PROJECT] Project files saved successfully');

        // 🚀 NEW: Mark deployment flags via backend for each file (persistent)
        const { markDeploymentFlagsChanged } = await import('../../utils/deploymentTracking');
        
        // Mark flags for each file (non-blocking)
        for (const filePath of Object.keys(files)) {
          markDeploymentFlagsChanged(userCanisterId, identity, projectId, filePath)
            .then(flagResult => {
              if (!flagResult.success) {
                log('PROJECT_FILES', '⚠️ [DEPLOYMENT FLAG] Failed to mark flags for file:', filePath, flagResult.error);
              }
            })
            .catch(error => {
              log('PROJECT_FILES', '⚠️ [DEPLOYMENT FLAG] Error marking flags for file:', filePath, error);
            });
        }

        // Update in-memory state with saved files
        set((state: any) => {
          if (!state.projectFiles) {
            state.projectFiles = {};
          }
          state.projectFiles[projectId] = { ...files };
        });

        log('PROJECT_FILES', '✅ [DEPLOYMENT FLAG] Deployment flags marked in backend for all saved files');
        return true;
      } else {
        throw new Error(result.error || 'Failed to save project files');
      }
    } catch (error) {
      log('PROJECT_FILES', '❌ [SAVE PROJECT] Save failed:', error);
      return false;
    }
  },

  // 🔥 COMPLETELY FIXED: Individual file operations with project name prefix
  saveIndividualFile: async (projectId: string, fullPath: string, content: string): Promise<boolean> => {
    log('FILE_OPERATIONS', '💾 [SAVE FILE] Starting save individual file:', { projectId, fullPath });
    
    try {
      const state = get() as any;
      const { userCanisterId, identity } = state;
      
      // 🆕 VERSION-AWARE: Get selected version ID from store
      const selectedVersionId = state.selectedVersionId || null; // null = sandbox/working copy
      log('FILE_OPERATIONS', '📌 [VERSION-AWARE] Selected version for save:', selectedVersionId || 'Sandbox (working copy)');
      
      // 🆕 NEW: Enhanced parameter validation
      const validationErrors = validateIndividualFileParameters(projectId, fullPath, userCanisterId, identity);
      if (validationErrors.length > 0) {
        throw new Error(`Parameter validation failed: ${validationErrors.join(', ')}`);
      }

      // 🆕 NEW: Parse the full path into fileName and relativePath
      const { fileName, relativePath } = parseFilePath(fullPath);
      
      // 🔥 NEW: Construct full path with project name prefix
      const filePath = constructFullFilePath(projectId, relativePath, state);
      
      // 🔥 CRITICAL: Extract principal from identity
      const principal = identity.getPrincipal();

      log('PARAMETER_MAPPING', '📋 [PARAM MAP] Save file parameter mapping with project name:', {
        fullPath,
        parsedFileName: fileName,
        parsedRelativePath: relativePath,
        constructedFilePath: filePath,
        projectId,
        selectedVersionId: selectedVersionId || 'Sandbox',
        principalString: principal.toString().substring(0, 8) + '...',
        userCanisterId: userCanisterId.substring(0, 8) + '...',
        contentLength: content.length
      });

      const { userCanisterService } = await import('../../services/UserCanisterService');
      
      log('FILE_OPERATIONS', '📡 [SAVE FILE] Calling UserCanisterService.updateCodeArtifactFromSidePane with version-aware save');
      
      // 🔥 VERSION-AWARE: Pass selected version ID to save method
      // Method signature: updateCodeArtifactFromSidePane(principal, projectId, fileName, content, filePath, userCanisterId, identity, versionId?)
      const result = await userCanisterService.updateCodeArtifactFromSidePane(
        principal,        // Position 1: Principal object
        projectId,        // Position 2: Project ID string
        fileName,         // Position 3: File name only (e.g., "main.mo")
        content,          // Position 4: File content string
        filePath,         // Position 5: Full path with project name (e.g., "NTAN Franchisee Platform/src/backend/src")
        userCanisterId,   // Position 6: Canister ID string
        identity,         // Position 7: Identity object
        selectedVersionId // Position 8: Version ID (null = working copy, string = specific version)
      );

      if (result.success) {
        log('FILE_OPERATIONS', '✅ [SAVE FILE] Individual file saved successfully with project name prefix');

        // 🚀 NEW: Mark deployment flags via backend (persistent across sessions)
        const { markDeploymentFlagsChanged } = await import('../../utils/deploymentTracking');
        
        // Call backend to mark flags (non-blocking - don't wait for result)
        markDeploymentFlagsChanged(userCanisterId, identity, projectId, fullPath)
          .then(flagResult => {
            if (flagResult.success) {
              log('FILE_OPERATIONS', '✅ [DEPLOYMENT FLAG] Deployment flags marked in backend');
            } else {
              log('FILE_OPERATIONS', '⚠️ [DEPLOYMENT FLAG] Failed to mark flags in backend:', flagResult.error);
            }
          })
          .catch(error => {
            log('FILE_OPERATIONS', '⚠️ [DEPLOYMENT FLAG] Error marking flags:', error);
          });

        // Update in-memory state
        set((state: any) => {
          if (!state.projectFiles) {
            state.projectFiles = {};
          }
          if (!state.projectFiles[projectId]) {
            state.projectFiles[projectId] = {};
          }
          state.projectFiles[projectId][fullPath] = content;
        });

        return true;
      } else {
        throw new Error(result.error || 'Failed to save individual file');
      }
    } catch (error) {
      log('FILE_OPERATIONS', '❌ [SAVE FILE] Individual file save failed:', error);
      return false;
    }
  },

  deleteIndividualFile: async (projectId: string, fullPath: string): Promise<boolean> => {
    log('FILE_OPERATIONS', '🗑️ [DELETE FILE] Starting delete individual file:', { projectId, fullPath });
    
    try {
      const state = get() as any;
      const { userCanisterId, identity } = state;
      
      // 🆕 NEW: Enhanced parameter validation
      const validationErrors = validateIndividualFileParameters(projectId, fullPath, userCanisterId, identity);
      if (validationErrors.length > 0) {
        throw new Error(`Parameter validation failed: ${validationErrors.join(', ')}`);
      }

      // 🆕 NEW: Parse the full path into fileName and relativePath
      const { fileName, relativePath } = parseFilePath(fullPath);
      
      // 🔥 NEW: Construct full path with project name prefix
      const filePath = constructFullFilePath(projectId, relativePath, state);
      
      // 🔥 CRITICAL: Extract principal from identity
      const principal = identity.getPrincipal();

      log('PARAMETER_MAPPING', '📋 [PARAM MAP] Delete file parameter mapping with project name:', {
        fullPath,
        parsedFileName: fileName,
        parsedRelativePath: relativePath,
        constructedFilePath: filePath,
        projectId,
        principalString: principal.toString().substring(0, 8) + '...',
        userCanisterId: userCanisterId.substring(0, 8) + '...'
      });

      const { userCanisterService } = await import('../../services/UserCanisterService');
      
      log('FILE_OPERATIONS', '📡 [DELETE FILE] Calling UserCanisterService.deleteCodeArtifactFromSidePane with project name');
      
      // 🔥 FIXED: Use EXACT method signature from UserCanisterService with project name prefix
      // Method signature: deleteCodeArtifactFromSidePane(principal, projectId, fileName, filePath, userCanisterId, identity)
      const result = await userCanisterService.deleteCodeArtifactFromSidePane(
        principal,        // Position 1: Principal object
        projectId,        // Position 2: Project ID string
        fileName,         // Position 3: File name only (e.g., "main.mo")
        filePath,         // Position 4: Full path with project name (e.g., "NTAN Franchisee Platform/src/backend/src")
        userCanisterId,   // Position 5: Canister ID string
        identity          // Position 6: Identity object
      );

      if (result.success) {
        log('FILE_OPERATIONS', '✅ [DELETE FILE] Individual file deleted successfully with project name prefix');

        // Update in-memory state
        set((state: any) => {
          if (state.projectFiles && state.projectFiles[projectId]) {
            delete state.projectFiles[projectId][fullPath];
          }
        });

        return true;
      } else {
        throw new Error(result.error || 'Failed to delete individual file');
      }
    } catch (error) {
      log('FILE_OPERATIONS', '❌ [DELETE FILE] Individual file delete failed:', error);
      return false;
    }
  },

  createIndividualFile: async (projectId: string, fullPath: string, content: string = ''): Promise<boolean> => {
    log('FILE_OPERATIONS', '📄 [CREATE FILE] Starting create individual file:', { projectId, fullPath });
    
    try {
      const state = get() as any;
      const { userCanisterId, identity } = state;
      
      // 🆕 VERSION-AWARE: Get selected version ID from store
      const selectedVersionId = state.selectedVersionId || null; // null = sandbox/working copy
      log('FILE_OPERATIONS', '📌 [VERSION-AWARE] Selected version for create:', selectedVersionId || 'Sandbox (working copy)');
      
      // 🆕 NEW: Enhanced parameter validation
      const validationErrors = validateIndividualFileParameters(projectId, fullPath, userCanisterId, identity);
      if (validationErrors.length > 0) {
        throw new Error(`Parameter validation failed: ${validationErrors.join(', ')}`);
      }

      // 🆕 NEW: Parse the full path into fileName and relativePath
      const { fileName, relativePath } = parseFilePath(fullPath);
      
      // 🔥 NEW: Construct full path with project name prefix
      const filePath = constructFullFilePath(projectId, relativePath, state);
      
      // 🔥 CRITICAL: Extract principal from identity
      const principal = identity.getPrincipal();

      log('PARAMETER_MAPPING', '📋 [PARAM MAP] Create file parameter mapping with project name:', {
        fullPath,
        parsedFileName: fileName,
        parsedRelativePath: relativePath,
        constructedFilePath: filePath,
        projectId,
        selectedVersionId: selectedVersionId || 'Sandbox',
        principalString: principal.toString().substring(0, 8) + '...',
        userCanisterId: userCanisterId.substring(0, 8) + '...',
        contentLength: content.length
      });

      const { userCanisterService } = await import('../../services/UserCanisterService');
      
      log('FILE_OPERATIONS', '📡 [CREATE FILE] Calling UserCanisterService.createCodeArtifactFromSidePane with version-aware create');
      
      // 🔥 VERSION-AWARE: Pass selected version ID to create method
      // Method signature: createCodeArtifactFromSidePane(principal, projectId, fileName, content, filePath, userCanisterId, identity, versionId?)
      const result = await userCanisterService.createCodeArtifactFromSidePane(
        principal,        // Position 1: Principal object
        projectId,        // Position 2: Project ID string
        fileName,         // Position 3: File name only (e.g., "main.mo")
        content,          // Position 4: File content string
        filePath,         // Position 5: Full path with project name (e.g., "NTAN Franchisee Platform/src/backend/src")
        userCanisterId,   // Position 6: Canister ID string
        identity,         // Position 7: Identity object
        selectedVersionId // Position 8: Version ID (null = working copy, string = specific version)
      );

      if (result.success) {
        log('FILE_OPERATIONS', '✅ [CREATE FILE] Individual file created successfully with project name prefix');

        // Update in-memory state
        set((state: any) => {
          if (!state.projectFiles) {
            state.projectFiles = {};
          }
          if (!state.projectFiles[projectId]) {
            state.projectFiles[projectId] = {};
          }
          state.projectFiles[projectId][fullPath] = content;
        });

        return true;
      } else {
        throw new Error(result.error || 'Failed to create individual file');
      }
    } catch (error) {
      log('FILE_OPERATIONS', '❌ [CREATE FILE] Individual file create failed:', error);
      return false;
    }
  },

  renameIndividualFile: async (projectId: string, oldFullPath: string, newFullPath: string): Promise<boolean> => {
    log('FILE_OPERATIONS', '📝 [RENAME FILE] Starting rename individual file:', { 
      projectId, 
      oldFullPath, 
      newFullPath 
    });
    
    try {
      const state = get() as any;
      
      // 🆕 VERSION-AWARE: Get selected version ID from store
      const selectedVersionId = state.selectedVersionId || null; // null = sandbox/working copy
      log('FILE_OPERATIONS', '📌 [VERSION-AWARE] Selected version for rename:', selectedVersionId || 'Sandbox (working copy)');
      
      // Get current file content to preserve it during rename
      const currentContent = state.projectFiles?.[projectId]?.[oldFullPath] || '';
      
      if (!currentContent) {
        throw new Error(`File ${oldFullPath} not found in project ${projectId}`);
      }

      const { userCanisterId, identity } = state;
      
      // 🆕 NEW: Enhanced parameter validation for both old and new paths
      const oldValidationErrors = validateIndividualFileParameters(projectId, oldFullPath, userCanisterId, identity);
      const newValidationErrors = validateIndividualFileParameters(projectId, newFullPath, userCanisterId, identity);
      
      if (oldValidationErrors.length > 0 || newValidationErrors.length > 0) {
        throw new Error(`Parameter validation failed: ${[...oldValidationErrors, ...newValidationErrors].join(', ')}`);
      }

      // 🆕 NEW: Parse both old and new paths
      const { fileName: newFileName, relativePath: newRelativePath } = parseFilePath(newFullPath);
      const { fileName: oldFileName, relativePath: oldRelativePath } = parseFilePath(oldFullPath);
      
      // 🔥 NEW: Construct full paths with project name prefix
      const newFilePath = constructFullFilePath(projectId, newRelativePath, state);
      const oldFilePath = constructFullFilePath(projectId, oldRelativePath, state);
      
      // 🔥 CRITICAL: Extract principal from identity
      const principal = identity.getPrincipal();

      log('PARAMETER_MAPPING', '📋 [PARAM MAP] Rename file parameter mapping with project name:', {
        oldFullPath,
        newFullPath,
        oldFileName,
        oldRelativePath,
        newFileName,
        newRelativePath,
        oldFilePath,
        newFilePath,
        projectId,
        selectedVersionId: selectedVersionId || 'Sandbox',
        principalString: principal.toString().substring(0, 8) + '...',
        userCanisterId: userCanisterId.substring(0, 8) + '...',
        contentLength: currentContent.length
      });

      const { userCanisterService } = await import('../../services/UserCanisterService');
      
      // Strategy: Create new file with same content, then delete old file
      log('FILE_OPERATIONS', '📡 [RENAME FILE] Creating new file with same content using version-aware create');
      
      // 🔥 VERSION-AWARE: Pass selected version ID to create method
      // First, create the new file using version-aware method signature
      const createResult = await userCanisterService.createCodeArtifactFromSidePane(
        principal,        // Position 1: Principal object
        projectId,        // Position 2: Project ID string
        newFileName,      // Position 3: File name only (parsed)
        currentContent,   // Position 4: File content string
        newFilePath,      // Position 5: Full path with project name (parsed and constructed)
        userCanisterId,   // Position 6: Canister ID string
        identity,         // Position 7: Identity object
        selectedVersionId // Position 8: Version ID (null = working copy, string = specific version)
      );

      if (!createResult.success) {
        throw new Error(`Failed to create new file: ${createResult.error}`);
      }

      // Then, delete the old file using EXACT method signature with project name
      log('FILE_OPERATIONS', '📡 [RENAME FILE] Deleting old file using project name prefix');
      
      const deleteResult = await userCanisterService.deleteCodeArtifactFromSidePane(
        principal,        // Position 1: Principal object
        projectId,        // Position 2: Project ID string
        oldFileName,      // Position 3: File name only (parsed)
        oldFilePath,      // Position 4: Full path with project name (parsed and constructed)
        userCanisterId,   // Position 5: Canister ID string
        identity          // Position 6: Identity object
      );

      if (!deleteResult.success) {
        log('FILE_OPERATIONS', '⚠️ [RENAME FILE] Failed to delete old file, but new file was created');
        // Continue anyway since the new file exists
      }

      log('FILE_OPERATIONS', '✅ [RENAME FILE] Individual file renamed successfully with project name prefix');

      // Update in-memory state
      set((state: any) => {
        if (state.projectFiles && state.projectFiles[projectId]) {
          // Add new file
          state.projectFiles[projectId][newFullPath] = currentContent;
          // Remove old file
          delete state.projectFiles[projectId][oldFullPath];
        }
      });

      return true;
    } catch (error) {
      log('FILE_OPERATIONS', '❌ [RENAME FILE] Individual file rename failed:', error);
      return false;
    }
  },

  // ✅ Memory management methods (unchanged)
  updateProjectFilesInMemory: (projectId: string, fileName: string, content: string) => {
    log('STATE_MANAGEMENT', '🧠 [MEMORY UPDATE] Updating file in memory:', { projectId, fileName });
    
    set((state: any) => {
      if (!state.projectFiles) {
        state.projectFiles = {};
      }
      if (!state.projectFiles[projectId]) {
        state.projectFiles[projectId] = {};
      }
      state.projectFiles[projectId][fileName] = content;
    });
  },

  removeProjectFilesFromMemory: (projectId: string, fileName: string) => {
    log('STATE_MANAGEMENT', '🧠 [MEMORY REMOVE] Removing file from memory:', { projectId, fileName });
    
    set((state: any) => {
      if (state.projectFiles && state.projectFiles[projectId]) {
        delete state.projectFiles[projectId][fileName];
      }
    });
  },

  getProjectFileContent: (projectId: string, fileName: string): string | null => {
    const state = get() as any;
    
    const content = state.projectFiles?.[projectId]?.[fileName] || null;
    
    log('STATE_MANAGEMENT', '📖 [GET CONTENT] Retrieved file content from memory:', {
      projectId,
      fileName,
      hasContent: !!content,
      contentLength: content ? content.length : 0
    });
    
    return content;
  },

  clearProjectFiles: (projectId: string) => {
    log('STATE_MANAGEMENT', '🧹 [CLEAR FILES] Clearing project files from memory:', projectId);
    
    set((state: any) => {
      if (state.projectFiles && state.projectFiles[projectId]) {
        delete state.projectFiles[projectId];
      }
    });
  }
});