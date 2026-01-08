import { StateCreator } from 'zustand';
import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/agent';
import { Project, ProjectMetadata } from '../../types';
import { UserCanisterService } from '../../services/UserCanisterService';
import { economyMetricsService } from '../../services/EconomyMetricsService';

export interface ProjectSwitchStatus {
  isLoading: boolean;
  targetProjectId: string | null;
  error: string | null;
}

export interface ProjectRenameStatus {
  isRenaming: boolean;
  targetProjectId: string | null;
  error: string | null;
}

export interface ProjectsSliceState {
  projects: Project[];
  activeProject: string | null;
  selectedVersionId: string | null; // null means sandbox
  versionCache: Record<string, string>; // versionId -> versionString (e.g., "1.0.0") - Using object instead of Map for Immer compatibility
  projectSwitchStatus: ProjectSwitchStatus;
  projectRenameStatus: ProjectRenameStatus;
}

export interface ProjectsSliceActions {
  loadProjects: () => Promise<void>;
  createProject: (project: Project) => Promise<boolean>;
  createProjectWithServerPair: (project: Project, serverPairId: string | null) => Promise<boolean>;
  updateProject: (project: Project) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  switchToProject: (projectId: string) => Promise<boolean>;
  getProjectById: (projectId: string) => Project | undefined;
  updateProjectMetadata: (projectId: string, metadata: ProjectMetadata) => Promise<boolean>;
  setProjectRenameLoading: (projectId: string, isLoading: boolean) => void;
  setSelectedVersion: (versionId: string | null) => void;
  getSelectedVersion: () => string | null;
  setVersionString: (versionId: string, versionString: string) => void;
  getSelectedVersionString: () => string | null;
  loadVersionFiles: (projectId: string, versionId: string) => Promise<{ [key: string]: string } | null>;
  markBothDeploymentFlagsChanged: (projectId: string) => void;
  clearDeploymentFlags: (projectId: string) => void;
}

export type ProjectsSlice = ProjectsSliceState & ProjectsSliceActions;

const NO_PROJECT_MESSAGES = [{
  id: 'no-project-welcome',
  type: 'system' as const,
  content: '👋 Welcome to Kontext!\n\nTo get started, please:\n• **Create a new project** by clicking "✨ New Project" in the sidebar\n• **Select an existing project** from the sidebar\n\nOnce you have a project selected, you can chat with your AI assistant to build amazing applications!',
  timestamp: new Date()
}];

const generateSessionId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `session_${timestamp}_${random}`;
};

const log = (category: string, message: string, ...args: any[]) => {
  console.log(message, ...args);
};

const mergeFilesWithoutDuplicates = (...fileSources: Array<{ [key: string]: string }>): { [key: string]: string } => {
  const merged: { [key: string]: string } = {};
  
  fileSources.forEach(source => {
    if (source && typeof source === 'object') {
      Object.entries(source).forEach(([fileName, content]) => {
        if (fileName && content !== undefined) {
          merged[fileName] = content;
        }
      });
    }
  });
  
  return merged;
};

export const createProjectsSlice: StateCreator<any, [], [], ProjectsSlice> = (set, get) => ({
  projects: [],
  activeProject: null,
  selectedVersionId: null, // null = sandbox
  versionCache: {}, // versionId -> versionString - Using object instead of Map for Immer compatibility
  projectSwitchStatus: { isLoading: false, targetProjectId: null, error: null },
  projectRenameStatus: { isRenaming: false, targetProjectId: null, error: null },

  loadProjects: async () => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister or identity not available');
      }

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const result = await userCanisterService.loadUserProjects(userCanisterId, identity);
      
      if (result.success && result.projects) {
        set((state: any) => {
          // Create a map to deduplicate projects by ID
          const projectsMap = new Map<string, Project>();
          
          // First, add existing projects to the map to preserve any local state
          state.projects.forEach((project: Project) => {
            projectsMap.set(project.id, project);
          });
          
          // Then, add/update with projects from canister (canister data takes precedence)
          result.projects.forEach((project: Project) => {
            projectsMap.set(project.id, project);
          });
          
          // Convert back to array, ensuring no duplicates
          state.projects = Array.from(projectsMap.values());
          
          log('PROJECT', `✅ Loaded ${result.projects.length} projects from canister, final deduplicated count: ${state.projects.length}`);
        });
      }
    } catch (error) {
      log('PROJECT', '❌ Error loading projects:', error);
    }
  },

  createProject: async (project: Project): Promise<boolean> => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister or identity not available');
      }

      log('PROJECT', '🎨 Starting project creation:', project.id);

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const result = await userCanisterService.saveProject(project, userCanisterId, identity);
      
      if (result.success) {
        set((state: any) => {
          state.projects.push(project);
          state.activeProject = project.id;
          
          // Initialize project-specific state
          state.projectGeneratedFiles[project.id] = {};
          state.projectFileGenerationStates[project.id] = {};
          state.projectLiveGeneratedFiles[project.id] = [];
          state.projectTabGroups[project.id] = [];  // 🔧 FIXED: Initialize as empty array, not object
          
          state.generatedFiles = {};
          state.fileGenerationStates = {};
          state.liveGeneratedFiles = [];
          state.tabGroups = [];
          
          const sessionId = generateSessionId();
          state.currentSessionId = sessionId;
          state.currentSessionMessages = [];
          
          const welcomeMessage = [{
            id: 'welcome-' + project.id,
            type: 'system' as const,
            content: `Welcome to your new project: **${project.title || project.name}**!\n\nI'm your AI development assistant. What would you like to build today? Try asking me something like:\n\n• "Create a React dashboard with charts"\n• "Build a todo app with TypeScript"\n• "Generate a landing page with Tailwind"`,
            timestamp: new Date()
          }];
          
          state.projectMessages[project.id] = welcomeMessage;
          state.currentMessages = [...welcomeMessage];
        });
        
        // Track project creation in economy metrics
        try {
          const { principal } = get() as any;
          economyMetricsService.trackProjectCreation({
            projectId: project.id,
            userId: userCanisterId,
            userPrincipal: principal ? principal.toString() : '',
            projectName: project.name || project.title || 'Untitled Project',
            timestamp: Date.now()
          });
        } catch (trackingError) {
          console.warn('⚠️ [ProjectsSlice] Failed to track project creation:', trackingError);
        }
        
        log('PROJECT', '✅ Project created successfully');
        return true;
      } else {
        return false;
      }
    } catch (error) {
      log('PROJECT', '❌ Error creating project:', error);
      return false;
    }
  },

  createProjectWithServerPair: async (project: Project, serverPairId: string | null): Promise<boolean> => {
    log('PROJECT', '🎨 Starting enhanced project creation with server pair support:', project.id, serverPairId);

    try {
      // First create the project normally
      const success = await (get() as any).createProject(project);
      
      if (!success) {
        throw new Error('Failed to create project');
      }

      // If server pair ID provided, assign it to the project
      if (serverPairId) {
        const { userCanisterId, identity } = get() as any;
        
        if (userCanisterId && identity) {
          log('SERVER_PAIRS', '🖥️ Assigning server pair to newly created project:', serverPairId);
          
          const { userCanisterService } = await import('../../services/UserCanisterService');
          const moveResult = await userCanisterService.moveServerPairToProject(
            serverPairId,
            '', // fromProjectId - empty string for unassigned pairs
            project.id, // toProjectId
            userCanisterId,
            identity
          );

          if (!moveResult.success) {
            log('SERVER_PAIRS', '⚠️ Failed to assign server pair, but project was created successfully:', moveResult.error);
            // Don't fail the entire operation - project exists, server pair can be assigned later
          } else {
            // 🚀 NEW: Mark both deployment flags since server pair was assigned
            (get() as any).markBothDeploymentFlagsChanged(project.id);
            log('SERVER_PAIRS', '🔄 [SMART DEPLOY] Both deployment flags marked - server pair assigned');
          }
        }
      }

      return true;

    } catch (error) {
      log('PROJECT', '❌ Enhanced project creation failed:', error);
      return false;
    }
  },

  updateProject: async (project: Project): Promise<boolean> => {
    try {
      console.log('🚨🚨🚨 [PROJECT UPDATE] STARTING PROJECT UPDATE 🚨🚨🚨');
      console.log('📊 [PROJECT UPDATE] Input project data:', {
        id: project.id,
        name: project.name,
        title: project.title,
        updated: project.updated
      });

      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister or identity not available');
      }

      console.log('📡 [PROJECT UPDATE] Calling userCanisterService.updateProject...');
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const result = await userCanisterService.updateProject(project, userCanisterId, identity);
      
      console.log('📋 [PROJECT UPDATE] Canister update result:', result);
      
      if (result.success) {
        console.log('✅ [PROJECT UPDATE] Canister update successful - updating store state');
        
        set((state: any) => {
          const index = state.projects.findIndex((p: Project) => p.id === project.id);
          console.log('🔍 [PROJECT UPDATE] Project index in store:', index);
          
          if (index !== -1) {
            let projectToUpdate = result.updatedProject || project;
            
            console.log('📝 [PROJECT UPDATE] Processing project for store update:', projectToUpdate);
            
            const createdMs = projectToUpdate.created;
            const updatedMs = projectToUpdate.updated;
            
            const metadata = projectToUpdate.metadata;
            
            // FIXED: Use static method calls on UserCanisterService class
            const icon = metadata?.customIcon || UserCanisterService.generateProjectIcon(projectToUpdate.projectType, projectToUpdate.name, projectToUpdate.id) || '📁';
            const iconType = metadata?.customIcon ? 'custom' : UserCanisterService.generateIconType(projectToUpdate.projectType, projectToUpdate.name);
            const preview = UserCanisterService.generateProjectPreview(projectToUpdate.description, projectToUpdate.projectType);
            const time = UserCanisterService.formatRelativeTime(updatedMs);
            
            projectToUpdate = {
              ...projectToUpdate,
              title: projectToUpdate.name,
              icon,
              iconType, 
              preview,
              time,
              isTemplate: !!projectToUpdate.templateId,
              unreadCount: 0,
              customColor: metadata?.customColor,
              isBookmarked: metadata?.isBookmarked || false,
              priority: metadata?.priority,
              category: metadata?.category,
              tags: metadata?.tags || []
            };
            
            console.log('📋 [PROJECT UPDATE] Final processed project:', projectToUpdate);
            
            // CRITICAL: Create completely new projects array to trigger React re-render
            const newProjects = [...state.projects];
            newProjects[index] = projectToUpdate;
            state.projects = newProjects;
            
            console.log('🔄 [PROJECT UPDATE] Store state updated with new projects array');
            console.log('🎯 [PROJECT UPDATE] Updated project should now appear in sidebar as:', projectToUpdate.title);
          } else {
            console.error('❌ [PROJECT UPDATE] Project not found in store projects array');
          }
        });
        
        console.log('🎉🎉🎉 [PROJECT UPDATE] COMPLETE - STORE UPDATED 🎉🎉🎉');
        return true;
      } else {
        console.error('❌❌❌ [PROJECT UPDATE] CANISTER UPDATE FAILED ❌❌❌', result.error);
        return false;
      }
    } catch (error) {
      console.error('💥💥💥 [PROJECT UPDATE] EXCEPTION THROWN 💥💥💥', error);
      return false;
    }
  },

  deleteProject: async (projectId: string): Promise<boolean> => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister or identity not available');
      }

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const result = await userCanisterService.deleteProject(projectId, userCanisterId, identity);
      
      if (result.success) {
        set((state: any) => {
          state.projects = state.projects.filter((p: Project) => p.id !== projectId);
          
          // Clean up project-specific state
          delete state.projectFiles[projectId];
          delete state.projectMessages[projectId];
          delete state.projectGeneratedFiles[projectId];
          delete state.projectFileGenerationStates[projectId];
          delete state.projectLiveGeneratedFiles[projectId];
          delete state.projectTabGroups[projectId];
          
          if (state.activeProject === projectId) {
            state.currentSessionId = null;
            state.currentSessionMessages = [];
            
            if (state.projects.length > 0) {
              const nextProject = state.projects[0];
              state.activeProject = nextProject.id;
              state.currentMessages = state.projectMessages[nextProject.id] || [];
              
              const nextProjectFiles = state.projectGeneratedFiles[nextProject.id] || {};
              state.generatedFiles = nextProjectFiles;
              state.fileGenerationStates = state.projectFileGenerationStates[nextProject.id] || {};
              state.liveGeneratedFiles = state.projectLiveGeneratedFiles[nextProject.id] || [];
              state.tabGroups = state.projectTabGroups[nextProject.id] || [];
              
              const sessionId = generateSessionId();
              state.currentSessionId = sessionId;
              state.currentSessionMessages = [];
            } else {
              state.activeProject = null;
              state.currentMessages = [...NO_PROJECT_MESSAGES];
              state.generatedFiles = {};
              state.fileGenerationStates = {};
              state.liveGeneratedFiles = [];
              state.tabGroups = [];
            }
          }
        });
        
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  },

  switchToProject: async (projectId: string): Promise<boolean> => {
    try {
      log('PROJECT', '🔄 Starting enhanced switch to project:', projectId);
      
      set((state: any) => {
        state.projectSwitchStatus = {
          isLoading: true,
          targetProjectId: projectId,
          error: null
        };
      });

      const { activeProject, currentMessages } = get() as any;
      
      if (activeProject) {
        set((state: any) => {
          state.projectMessages[activeProject] = [...currentMessages];
          state.projectGeneratedFiles[activeProject] = { ...state.generatedFiles };
          state.projectFileGenerationStates[activeProject] = { ...state.fileGenerationStates };
          state.projectLiveGeneratedFiles[activeProject] = [...state.liveGeneratedFiles];
          state.projectTabGroups[activeProject] = [...state.tabGroups];
        });
      }

      set((state: any) => {
        state.generatedFiles = {};
        state.fileGenerationStates = {};
        state.liveGeneratedFiles = [];
        state.tabGroups = [];
      });

      const files = await (get() as any).loadProjectFiles(projectId);
      
      log('FILEPATH', '🔍 [PROJECT SWITCH] Files loaded from canister:', Object.keys(files));

      await (get() as any).loadProjectMessages(projectId);

      set((state: any) => {
        state.activeProject = projectId;
        state.projectFiles[projectId] = files;
        
        const sessionId = generateSessionId();
        state.currentSessionId = sessionId;
        state.currentSessionMessages = [];
        
        if (!state.projectGeneratedFiles[projectId]) {
          state.projectGeneratedFiles[projectId] = {};
        }
        if (!state.projectFileGenerationStates[projectId]) {
          state.projectFileGenerationStates[projectId] = {};
        }
        if (!state.projectLiveGeneratedFiles[projectId]) {
          state.projectLiveGeneratedFiles[projectId] = [];
        }
        if (!state.projectTabGroups[projectId]) {
          state.projectTabGroups[projectId] = [];
        }
        
        const projectSpecificFiles = state.projectGeneratedFiles[projectId] || {};
        const mergedFiles = mergeFilesWithoutDuplicates(
          files,
          projectSpecificFiles
        );
        
        Object.keys(mergedFiles).forEach(fileName => {
          if (!state.projectFileGenerationStates[projectId][fileName]) {
            state.projectFileGenerationStates[projectId][fileName] = 'complete';
          }
        });
        
        log('FILEPATH', '🔍 [PROJECT SWITCH] Final merged files keys:', Object.keys(mergedFiles));
        
        state.generatedFiles = { ...mergedFiles };
        state.fileGenerationStates = { ...state.projectFileGenerationStates[projectId] };
        state.liveGeneratedFiles = [...state.projectLiveGeneratedFiles[projectId]];
        state.tabGroups = [...state.projectTabGroups[projectId]];
        
        state.projectSwitchStatus = {
          isLoading: false,
          targetProjectId: null,
          error: null
        };
        
        state.ui.sidePane.isOpen = false;
        state.ui.sidePane.activeFile = null;
        
        state.isEditable = false;
        state.isDirty = false;
        state.editContent = null;
        
        state.ui.sidePane.isEditable = false;
        state.ui.sidePane.isDirty = false;
        state.ui.sidePane.editContent = null;
      });

      // 🔧 CRITICAL FIX: Ensure updateTabGroups is called after project switch
      const currentState = get() as any;
      log('PROJECT', '🔧 [PROJECT SWITCH] Calling updateTabGroups after project switch');
      
      if (currentState.updateTabGroups && typeof currentState.updateTabGroups === 'function') {
        try {
          currentState.updateTabGroups();
          log('PROJECT', '✅ [PROJECT SWITCH] updateTabGroups called successfully');
        } catch (error) {
          log('PROJECT', '❌ [PROJECT SWITCH] updateTabGroups failed:', error);
        }
      } else {
        log('PROJECT', '⚠️ [PROJECT SWITCH] updateTabGroups not available!');
      }
      
      return true;
      
    } catch (error) {
      set((state: any) => {
        state.projectSwitchStatus = {
          isLoading: false,
          targetProjectId: null,
          error: error instanceof Error ? error.message : 'Failed to switch project'
        };
      });
      
      log('PROJECT', '❌ [PROJECT SWITCH] Failed:', error);
      return false;
    }
  },

  getProjectById: (projectId: string): Project | undefined => {
    return (get() as any).projects.find((p: Project) => p.id === projectId);
  },

  updateProjectMetadata: async (projectId: string, metadata: ProjectMetadata): Promise<boolean> => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister or identity not available');
      }

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const result = await userCanisterService.updateProjectMetadata(projectId, metadata, userCanisterId, identity);
      
      if (result.success) {
        set((state: any) => {
          const project = state.projects.find((p: Project) => p.id === projectId);
          if (project) {
            project.metadata = metadata;
          }
        });
        
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  },

  setProjectRenameLoading: (projectId: string, isLoading: boolean) => {
    set((state: any) => {
      state.projectRenameStatus = {
        isRenaming: isLoading,
        targetProjectId: isLoading ? projectId : null,
        error: null
      };
    });
  },

  setSelectedVersion: (versionId: string | null) => {
    set((state: any) => {
      state.selectedVersionId = versionId;
      log('VERSION', `📌 [VERSION] Selected version changed to: ${versionId || 'Sandbox'}`);
    });
  },

  getSelectedVersion: (): string | null => {
    return (get() as any).selectedVersionId;
  },

  setVersionString: (versionId: string, versionString: string) => {
    set((state: any) => {
      // 🔥 FIX: Use plain object - Immer handles objects perfectly
      // Just assign directly - Immer will track the change
      if (!state.versionCache) {
        state.versionCache = {};
      }
      state.versionCache[versionId] = versionString;
      log('VERSION', `📝 [VERSION] Cached version string: ${versionId} -> ${versionString}`);
    });
  },

  getSelectedVersionString: (): string | null => {
    const state = get() as any;
    const versionId = state.selectedVersionId;
    if (!versionId) {
      return null; // Sandbox
    }
    
    // 🔥 FIX: Simple object access - no conversion needed, no excessive logging
    const versionCache = state.versionCache;
    if (!versionCache || typeof versionCache !== 'object') {
      return null;
    }
    
    return versionCache[versionId] || null;
  },

  loadVersionFiles: async (projectId: string, versionId: string): Promise<{ [key: string]: string } | null> => {
    try {
      log('VERSION', `📦 [VERSION] Loading files for version: ${versionId}`);
      
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister or identity not available');
      }

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const result = await userCanisterService.getProjectFiles(projectId, versionId);
      
      if ('ok' in result) {
        const files: { [key: string]: string } = {};
        
        // Convert artifacts to file map
        result.ok.forEach((artifact: any) => {
          const path = artifact.path || artifact.name;
          const content = artifact.content || '';
          files[path] = content;
        });
        
        log('VERSION', `✅ [VERSION] Loaded ${Object.keys(files).length} files from version ${versionId}`);
        return files;
      } else {
        log('VERSION', `❌ [VERSION] Failed to load version files: ${result.err}`);
        return null;
      }
    } catch (error) {
      log('VERSION', '❌ [VERSION] Error loading version files:', error);
      return null;
    }
  },

  // 🚀 NEW: Deployment flag management
  markBothDeploymentFlagsChanged: (projectId: string) => {
    // 🚀 Call backend to mark both flags (persistent across sessions)
    const state = get() as any;
    const { userCanisterId, identity } = state;
    
    if (userCanisterId && identity) {
      // Get the server pair ID from state (NO CACHE)
      const serverPairId = state.getProjectServerPair ? state.getProjectServerPair(projectId) : projectId;
      
      log('DEPLOYMENT_FLAGS', `🔄 [SMART DEPLOY] Marking both deployment flags for project: ${projectId}`);
      
      // Call backend (async, non-blocking)
      import('../../services/UserCanisterService').then(({ userCanisterService }) => {
        userCanisterService.markServerPairChanged(
          userCanisterId,
          identity,
          projectId,
          serverPairId || projectId
        ).then(result => {
          if (result.success) {
            log('DEPLOYMENT_FLAGS', '✅ [SMART DEPLOY] Both flags marked in backend');
          } else {
            log('DEPLOYMENT_FLAGS', '⚠️ [SMART DEPLOY] Failed to mark flags in backend:', result.error);
          }
        }).catch(error => {
          log('DEPLOYMENT_FLAGS', '⚠️ [SMART DEPLOY] Error marking flags:', error);
        });
      });
    } else {
      log('DEPLOYMENT_FLAGS', '⚠️ [SMART DEPLOY] Cannot mark flags - missing userCanisterId or identity');
    }
  },

  clearDeploymentFlags: (projectId: string) => {
    // Note: This function is provided for compatibility but deployment flags
    // are now cleared automatically by DeploymentService after successful deployment.
    // This function is intentionally a no-op as flags are backend-authoritative.
    log('DEPLOYMENT_FLAGS', `ℹ️  [SMART DEPLOY] clearDeploymentFlags called for ${projectId} - flags are managed by backend`);
  },
});
