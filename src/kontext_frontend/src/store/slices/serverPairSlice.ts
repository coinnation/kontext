import { StateCreator } from 'zustand';
import { Principal } from '@dfinity/principal';
import { Project } from '../../types';
import { 
  getSelectedServerPairForProject, 
  setSelectedServerPairForProject 
} from '../../services/CanisterStateService';

export interface ServerPairWithAssignment {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
  currentProjectId?: string;
  currentProjectName?: string;
  canReassign: boolean;
}

export interface ServerPairSelectionDialogState {
  isOpen: boolean;
  isOperationLoading: boolean; // FIXED: Renamed from isLoading for clarity
  isDataLoading: boolean; // NEW: Separate state for background data loading
  selectedOption: 'create' | 'assign' | 'skip' | null;
  allServerPairs: ServerPairWithAssignment[];
  selectedServerPairId: string | null;
  newServerPairName: string;
  creditsToAllocate: number;
  error: string | null;
  pendingProjectData: Project | null;
  // Hosting configuration tracking
  hostingProgress: {
    status: string;
    progress: number;
    phase: 'setup' | 'hosting' | 'complete' | 'error';
  };
}

// Project Server Pair Assignment State
export interface ProjectServerPairState {
  // Maps projectId -> serverPairId for active assignments
  projectServerPairAssignments: { [projectId: string]: string };
  // Timestamp of last update for cache invalidation
  lastAssignmentUpdate: number;
}

export interface ServerPairSliceState {
  serverPairDialog: ServerPairSelectionDialogState;
  // Centralized project-server pair assignment tracking
  projectServerPairs: ProjectServerPairState;
}

export interface ServerPairSliceActions {
  openServerPairSelectionDialog: (projectData: Project) => void;
  closeServerPairSelectionDialog: () => void;
  setServerPairDialogOption: (option: 'create' | 'assign' | 'skip') => void;
  setSelectedServerPairId: (pairId: string | null) => void;
  setNewServerPairName: (name: string) => void;
  setCreditsToAllocate: (credits: number) => void;
  loadAllUserServerPairs: () => Promise<void>;
  assignServerPairAndProject: () => Promise<boolean>;
  createServerPairAndProject: (mainActor: any, icpPriceData: any) => Promise<boolean>;
  createServerPairForExistingProject: (projectId: string, projectName: string, serverPairName: string, creditsToAllocate: number, mainActor: any, icpPriceData: any, progressCallback?: (status: string, progress: number) => void) => Promise<{ success: boolean; serverPairId?: string; error?: string }>;
  createProjectWithoutServerPair: () => Promise<boolean>;
  calculateServerConfigFromCredits: (credits: number) => ReturnType<typeof calculateOptimalServerConfig>;
  getMinimumCreditsRequired: () => number;
  
  // Direct state coordination methods
  setProjectServerPair: (projectId: string, serverPairId: string) => void;
  getProjectServerPair: (projectId: string) => string | null;
  removeProjectServerPair: (projectId: string) => void;
  syncWithLocalStorage: (projectId: string) => void;
  notifyServerPairUpdate: (projectId: string, serverPairId: string) => void;
}

export type ServerPairSlice = ServerPairSliceState & ServerPairSliceActions;

const log = (category: string, message: string, ...args: any[]) => {
  console.log(`[${category}]`, message, ...args);
};

// REALISTIC COSTS - Based on HostingInterface implementation
const REALISTIC_COSTS = {
  CYCLES_PER_SERVER_1GB_30DAYS: 2_000_000_000_000n, // 2T cycles
  OPERATIONAL_BUFFER: 200_000_000_000n, // 200B cycles buffer
  MINIMUM_CYCLES: 100_000_000_000n, // 100B cycles
  MINIMUM_MEMORY_GB: 1
};

// Calculate realistic server resource needs with 1GB MINIMUM
function calculateRealisticServerResources(
  memoryGB: number,
  durationDays: number
): {
  resourcesNeeded: bigint;
  totalWithBuffer: bigint;
  description: string;
} {
  // ENFORCE 1GB MINIMUM
  const actualMemoryGB = Math.max(REALISTIC_COSTS.MINIMUM_MEMORY_GB, Math.floor(memoryGB));
  
  // Base calculation on proven 2T resources for 1GB/30days
  const baseRate = REALISTIC_COSTS.CYCLES_PER_SERVER_1GB_30DAYS;
  
  const memoryFactor = actualMemoryGB;
  const durationFactor = durationDays / 30.0;
  
  const resourcesNeeded = BigInt(Math.floor(Number(baseRate) * memoryFactor * durationFactor));
  const totalWithBuffer = resourcesNeeded + REALISTIC_COSTS.OPERATIONAL_BUFFER;
  
  const description = `${actualMemoryGB}GB for ${durationDays} days (min 1GB, based on proven 2T/GB/30day rate)`;
  
  return {
    resourcesNeeded,
    totalWithBuffer,
    description
  };
}

// FIXED: Convert resources to credits using CreditsService constants (1T cycles = 1000 credits)
function resourcesToCredits(resources: bigint): number {
  const tbResources = Number(resources) / 1_000_000_000_000;
  return Math.ceil(tbResources * 1000); // 1T cycles = 1000 credits (matches CreditsService)
}

// Calculate optimal server configuration with 1GB MINIMUM
function calculateOptimalServerConfig(availableCredits: number): {
  canCreateServers: boolean;
  perServerCredits: number;
  perServerResources: bigint;
  memoryGB: number;
  durationDays: number;
  totalResourcesNeeded: bigint;
  message: string;
} {
  const halfCredits = Math.floor(availableCredits / 2);
  
  const configs = [
    { memoryGB: 1, durationDays: 30 },
    { memoryGB: 1, durationDays: 21 },
    { memoryGB: 1, durationDays: 14 },
    { memoryGB: 1, durationDays: 7 },
    { memoryGB: 2, durationDays: 30 },
  ];
  
  for (const config of configs) {
    const calculation = calculateRealisticServerResources(config.memoryGB, config.durationDays);
    const creditsNeeded = resourcesToCredits(calculation.totalWithBuffer);
    
    if (halfCredits >= creditsNeeded) {
      const totalResourcesNeeded = calculation.totalWithBuffer * 2n;
      
      return {
        canCreateServers: true,
        perServerCredits: creditsNeeded,
        perServerResources: calculation.totalWithBuffer,
        memoryGB: config.memoryGB,
        durationDays: config.durationDays,
        totalResourcesNeeded,
        message: `✅ Can create server pair: ${calculation.description} (~${creditsNeeded} credits each)`
      };
    }
  }
  
  const standardCalculation = calculateRealisticServerResources(1, 30);
  const standardCreditsNeeded = resourcesToCredits(standardCalculation.totalWithBuffer) * 2;
  
  return {
    canCreateServers: false,
    perServerCredits: 0,
    perServerResources: 0n,
    memoryGB: 0,
    durationDays: 0,
    totalResourcesNeeded: 0n,
    message: `❌ Insufficient credits. Need ~${standardCreditsNeeded} credits for 1GB/30day server pair (you have ${availableCredits}). Minimum memory is 1GB.`
  };
}

const generateSessionId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `session_${timestamp}_${random}`;
};

// FIXED: Helper function to create properly formatted project data with timestamp debugging
const createProjectData = (baseProjectData: Partial<Project>): Project => {
  const now = Date.now(); // CRITICAL FIX: Use Date.now() for millisecond timestamps
  
  // ENHANCED LOGGING: Track timestamp values throughout the process
  console.log('🔍 [createProjectData] TIMESTAMP DEBUG - Starting project data creation');
  console.log('🔍 [createProjectData] Current timestamp (now):', now, 'typeof:', typeof now);
  console.log('🔍 [createProjectData] Input baseProjectData:', {
    id: baseProjectData.id,
    name: baseProjectData.name,
    created: baseProjectData.created,
    createdType: typeof baseProjectData.created,
    updated: baseProjectData.updated,
    updatedType: typeof baseProjectData.updated,
    hasCreated: 'created' in baseProjectData,
    hasUpdated: 'updated' in baseProjectData
  });
  
  // CRITICAL FIX: Reorder object construction to prevent timestamp overwrite
  // OLD ORDER (BUGGY): Set timestamps first, then spread baseProjectData (overwrites!)
  // NEW ORDER (FIXED): Spread baseProjectData first (defaults), then set timestamps (overrides!)
  
  const projectData = {
    // STEP 1: Spread baseProjectData FIRST (provides defaults, won't overwrite our explicit fields)
    ...baseProjectData,
    
    // STEP 2: Set required fields with explicit values AFTER spread (these will override any undefined values from baseProjectData)
    id: baseProjectData.id || `project_${now}_${Math.random().toString(36).substring(2, 15)}`,
    name: baseProjectData.name || 'New Project',
    created: now, // CRITICAL: This now CANNOT be overwritten by the spread operator
    updated: now, // CRITICAL: This now CANNOT be overwritten by the spread operator
    visibility: baseProjectData.visibility || 'Private',
    status: baseProjectData.status || 'Active',
    projectType: baseProjectData.projectType || { name: 'Web Application', subType: 'React' },
    canisters: baseProjectData.canisters || [],
    files: baseProjectData.files || {},
    messages: baseProjectData.messages || [],
    
    // Optional fields - keep from baseProjectData if they exist, otherwise undefined
    description: baseProjectData.description,
    collaborators: baseProjectData.collaborators,
    templateId: baseProjectData.templateId,
    npmPackages: baseProjectData.npmPackages,
    motokoPackages: baseProjectData.motokoPackages,
    workingCopyBaseVersion: baseProjectData.workingCopyBaseVersion,
    lastMessageTime: baseProjectData.lastMessageTime,
    messageCount: baseProjectData.messageCount,
    metadata: baseProjectData.metadata
  } as Project;

  // ENHANCED LOGGING: Verify the final result
  console.log('✅ [createProjectData] TIMESTAMP DEBUG - Final project data created:', {
    id: projectData.id,
    name: projectData.name,
    created: projectData.created,
    createdType: typeof projectData.created,
    createdValid: typeof projectData.created === 'number' && !isNaN(projectData.created),
    updated: projectData.updated,
    updatedType: typeof projectData.updated,
    updatedValid: typeof projectData.updated === 'number' && !isNaN(projectData.updated),
    timestampsMatch: projectData.created === projectData.updated,
    timestampsEqualNow: projectData.created === now && projectData.updated === now
  });
  
  // DEFENSIVE VALIDATION: Ensure we never return invalid timestamps
  if (typeof projectData.created !== 'number' || isNaN(projectData.created)) {
    console.error('🚨 [createProjectData] CRITICAL: Invalid created timestamp detected, forcing to current time');
    projectData.created = now;
  }
  
  if (typeof projectData.updated !== 'number' || isNaN(projectData.updated)) {
    console.error('🚨 [createProjectData] CRITICAL: Invalid updated timestamp detected, forcing to current time');
    projectData.updated = now;
  }
  
  console.log('🎉 [createProjectData] TIMESTAMP DEBUG - Project data successfully created with valid timestamps');
  return projectData;
};

export const createServerPairSlice: StateCreator<any, [], [], ServerPairSlice> = (set, get) => ({
  serverPairDialog: {
    isOpen: false,
    isOperationLoading: false, // FIXED: Renamed and only for actual operations
    isDataLoading: false, // NEW: Separate state for background data loading
    selectedOption: null,
    allServerPairs: [],
    selectedServerPairId: null,
    newServerPairName: '',
    creditsToAllocate: 4400, // Default credits allocation (realistic for 1GB/30day pair)
    error: null,
    pendingProjectData: null,
    // Hosting progress tracking
    hostingProgress: {
      status: 'Ready',
      progress: 0,
      phase: 'setup'
    }
  },

  // Centralized project-server pair assignment state
  projectServerPairs: {
    projectServerPairAssignments: {},
    lastAssignmentUpdate: 0
  },

  openServerPairSelectionDialog: (projectData: Project) => {
    log('SERVER_PAIRS', '🖥️ Opening server pair selection dialog for project:', projectData.name);
    
    // ENHANCED LOGGING: Track input project data
    console.log('🔍 [openServerPairSelectionDialog] TIMESTAMP DEBUG - Input project data:', {
      id: projectData.id,
      name: projectData.name,
      created: projectData.created,
      createdType: typeof projectData.created,
      updated: projectData.updated,
      updatedType: typeof projectData.updated
    });
    
    // CRITICAL FIX: Ensure proper timestamp formatting when setting pendingProjectData
    const properlyFormattedProjectData = createProjectData(projectData);
    
    // ENHANCED LOGGING: Verify the formatted result
    console.log('✅ [openServerPairSelectionDialog] TIMESTAMP DEBUG - Formatted project data:', {
      id: properlyFormattedProjectData.id,
      name: properlyFormattedProjectData.name,
      created: properlyFormattedProjectData.created,
      createdType: typeof properlyFormattedProjectData.created,
      updated: properlyFormattedProjectData.updated,
      updatedType: typeof properlyFormattedProjectData.updated
    });
    
    set((state: any) => {
      state.serverPairDialog.isOpen = true;
      state.serverPairDialog.pendingProjectData = properlyFormattedProjectData;
      state.serverPairDialog.selectedOption = null;
      state.serverPairDialog.selectedServerPairId = null;
      state.serverPairDialog.error = null;
      state.serverPairDialog.newServerPairName = `${properlyFormattedProjectData.name} Server`;
      state.serverPairDialog.creditsToAllocate = 4400;
      // FIXED: Don't set any loading states when opening dialog
      state.serverPairDialog.isOperationLoading = false;
      state.serverPairDialog.isDataLoading = false;
      // Reset hosting progress
      state.serverPairDialog.hostingProgress = {
        status: 'Ready',
        progress: 0,
        phase: 'setup'
      };
    });
    
    console.log('🎉 [openServerPairSelectionDialog] Dialog opened successfully with properly formatted project data');
    
    // OPTIMIZATION: Pre-load server pairs in background when dialog opens
    // This makes the "use existing server pair" option load instantly when selected
    // Load in background without blocking UI or showing loading state
    if (!get().serverPairDialog.allServerPairs.length && !get().serverPairDialog.isDataLoading) {
      // Start loading in background, but don't set loading state to avoid UI blocking
      (get() as any).loadAllUserServerPairs().catch((error: any) => {
        console.warn('⚠️ [ServerPairDialog] Background pre-load failed (non-critical):', error);
        // Don't set error state - this is just a pre-load optimization
      });
    }
  },

  closeServerPairSelectionDialog: () => {
    log('SERVER_PAIRS', '🖥️ Closing server pair selection dialog');
    
    set((state: any) => {
      state.serverPairDialog.isOpen = false;
      state.serverPairDialog.pendingProjectData = null;
      state.serverPairDialog.selectedOption = null;
      state.serverPairDialog.selectedServerPairId = null;
      state.serverPairDialog.error = null;
      state.serverPairDialog.isOperationLoading = false;
      state.serverPairDialog.isDataLoading = false;
      // Reset hosting progress
      state.serverPairDialog.hostingProgress = {
        status: 'Ready',
        progress: 0,
        phase: 'setup'
      };
    });
  },

  setServerPairDialogOption: (option: 'create' | 'assign' | 'skip') => {
    log('SERVER_PAIRS', '🖥️ Setting server pair dialog option:', option);
    
    set((state: any) => {
      state.serverPairDialog.selectedOption = option;
      state.serverPairDialog.error = null;
      
      // Reset related state when switching options
      if (option !== 'assign') {
        state.serverPairDialog.selectedServerPairId = null;
      }
    });
  },

  setSelectedServerPairId: (pairId: string | null) => {
    log('SERVER_PAIRS', '🖥️ Setting selected server pair ID:', pairId);
    
    set((state: any) => {
      state.serverPairDialog.selectedServerPairId = pairId;
    });
  },

  setNewServerPairName: (name: string) => {
    set((state: any) => {
      state.serverPairDialog.newServerPairName = name;
    });
  },

  setCreditsToAllocate: (credits: number) => {
    set((state: any) => {
      state.serverPairDialog.creditsToAllocate = credits;
    });
  },

  loadAllUserServerPairs: async () => {
    const { userCanisterId, identity } = get() as any;
    
    if (!userCanisterId || !identity) {
      log('SERVER_PAIRS', '⚠️ Cannot load server pairs - missing canister or identity');
      return;
    }

    log('SERVER_PAIRS', '🖥️ Loading ALL user server pairs with assignment information...');
    
    // FIXED: Use isDataLoading instead of isOperationLoading
    set((state: any) => {
      state.serverPairDialog.isDataLoading = true;
      state.serverPairDialog.error = null;
    });

    try {
      const { userCanisterService } = await import('../../services/UserCanisterService');
      // Get all user server pairs with assignment information
      const allPairsResult = await userCanisterService.getAllUserServerPairsWithAssignments(userCanisterId, identity);
      
      if (!allPairsResult.success) {
        throw new Error(allPairsResult.error || 'Failed to load server pairs');
      }

      const allPairs = allPairsResult.serverPairs || [];

      set((state: any) => {
        state.serverPairDialog.allServerPairs = allPairs;
        state.serverPairDialog.isDataLoading = false;
      });

      log('SERVER_PAIRS', `✅ Loaded ${allPairs.length} server pairs with assignment information`);

    } catch (error) {
      log('SERVER_PAIRS', '❌ Failed to load server pairs:', error);
      
      set((state: any) => {
        state.serverPairDialog.isDataLoading = false;
        state.serverPairDialog.error = error instanceof Error ? error.message : 'Failed to load server pairs';
        state.serverPairDialog.allServerPairs = [];
      });
    }
  },

  assignServerPairAndProject: async (): Promise<boolean> => {
    const { serverPairDialog, userCanisterId, identity } = get() as any;
    
    if (!serverPairDialog.pendingProjectData || !serverPairDialog.selectedServerPairId || !userCanisterId || !identity) {
      log('SERVER_PAIRS', '❌ Cannot assign server pair and create project - missing required data');
      return false;
    }

    const { pendingProjectData, selectedServerPairId } = serverPairDialog;

    log('SERVER_PAIRS', '🖥️ Assigning/reassigning server pair and creating project:', {
      projectName: pendingProjectData.name,
      serverPairId: selectedServerPairId
    });

    // ENHANCED LOGGING: Track pending project data timestamps
    console.log('🔍 [assignServerPairAndProject] TIMESTAMP DEBUG - Pending project data:', {
      id: pendingProjectData.id,
      name: pendingProjectData.name,
      created: pendingProjectData.created,
      createdType: typeof pendingProjectData.created,
      updated: pendingProjectData.updated,
      updatedType: typeof pendingProjectData.updated
    });

    // FIXED: Set operation loading state only during actual operations
    set((state: any) => {
      state.serverPairDialog.isOperationLoading = true;
      state.serverPairDialog.error = null;
      state.serverPairDialog.hostingProgress = {
        status: 'Assigning server pair and creating project...',
        progress: 10,
        phase: 'setup'
      };
    });

    try {
      // CRITICAL FIX: Ensure project data has proper timestamp format before creation
      const properlyFormattedProjectData = createProjectData(pendingProjectData);
      
      // First create the project
      const projectSuccess = await (get() as any).createProject(properlyFormattedProjectData);
      
      if (!projectSuccess) {
        throw new Error('Failed to create project');
      }

      const newProjectId = properlyFormattedProjectData.id;
      log('SERVER_PAIRS', '✅ Project created successfully, now assigning server pair...');

      // Update progress
      set((state: any) => {
        state.serverPairDialog.hostingProgress = {
          status: 'Assigning server pair to project...',
          progress: 50,
          phase: 'setup'
        };
      });

      // Move/assign the server pair to the new project (from unassigned to new project)
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const moveResult = await userCanisterService.moveServerPairToProject(
        selectedServerPairId,
        '', // fromProjectId - empty string for unassigned pairs
        properlyFormattedProjectData.id, // toProjectId
        userCanisterId,
        identity
      );

      if (!moveResult.success) {
        throw new Error(`Failed to assign server pair to project: ${moveResult.error}`);
      }

      log('SERVER_PAIRS', '✅ Server pair assigned/reassigned successfully to project');

      // 🚀 NEW: Mark both deployment flags since server pair changed
      const markFlags = (get() as any).markBothDeploymentFlagsChanged;
      if (markFlags) {
        markFlags(newProjectId);
        log('SERVER_PAIRS', '🔄 [SMART DEPLOY] Both deployment flags marked - server pair changed');
      }

      // Update progress
      set((state: any) => {
        state.serverPairDialog.hostingProgress = {
          status: 'Server pair assignment completed!',
          progress: 100,
          phase: 'complete'
        };
      });

      // Use direct state coordination
      (get() as any).notifyServerPairUpdate(newProjectId, selectedServerPairId);
      log('SERVER_PAIRS', '✅ Server pair assignment coordinated through direct state update');

      // Directly set the active project
      set((state: any) => {
        state.activeProject = properlyFormattedProjectData.id;
        
        // Initialize project-specific state if needed
        if (!state.projectMessages[properlyFormattedProjectData.id]) {
          const welcomeMessage = [{
            id: 'welcome-' + properlyFormattedProjectData.id,
            type: 'system' as const,
            content: `Welcome to your project: **${properlyFormattedProjectData.title || properlyFormattedProjectData.name}**!\n\nI'm your AI development assistant. What would you like to build today?`,
            timestamp: new Date()
          }];
          state.projectMessages[properlyFormattedProjectData.id] = welcomeMessage;
        }
        
        // Set current messages to this project's messages
        state.currentMessages = state.projectMessages[properlyFormattedProjectData.id] || [];
        
        // Initialize other project-specific state
        if (!state.projectGeneratedFiles[properlyFormattedProjectData.id]) {
          state.projectGeneratedFiles[properlyFormattedProjectData.id] = {};
        }
        if (!state.projectFileGenerationStates[properlyFormattedProjectData.id]) {
          state.projectFileGenerationStates[properlyFormattedProjectData.id] = {};
        }
        if (!state.projectLiveGeneratedFiles[properlyFormattedProjectData.id]) {
          state.projectLiveGeneratedFiles[properlyFormattedProjectData.id] = [];
        }
        if (!state.projectTabGroups[properlyFormattedProjectData.id]) {
          state.projectTabGroups[properlyFormattedProjectData.id] = [];
        }
        
        // Clear current generated files and set to this project's files
        state.generatedFiles = {};
        state.fileGenerationStates = {};
        state.liveGeneratedFiles = [];
        state.tabGroups = [];
        
        // Start a new session for the project
        const sessionId = generateSessionId();
        state.currentSessionId = sessionId;
        state.currentSessionMessages = [];
        
        // Close side pane
        state.ui.sidePane.isOpen = false;
        state.ui.sidePane.activeFile = null;
        state.isEditable = false;
        state.isDirty = false;
        state.editContent = null;
        state.ui.sidePane.isEditable = false;
        state.ui.sidePane.isDirty = false;
        state.ui.sidePane.editContent = null;
      });

      log('SERVER_PAIRS', '✅ Active project set directly with server pair coordination');

      // Close the dialog
      (get() as any).closeServerPairSelectionDialog();

      return true;

    } catch (error) {
      log('SERVER_PAIRS', '❌ Failed to assign server pair and create project:', error);
      
      set((state: any) => {
        state.serverPairDialog.error = error instanceof Error ? error.message : 'Failed to assign server pair';
        state.serverPairDialog.isOperationLoading = false;
        state.serverPairDialog.hostingProgress = {
          status: 'Assignment failed',
          progress: 0,
          phase: 'error'
        };
      });
      
      return false;
    }
  },

  createServerPairAndProject: async (mainActor: any, icpPriceData: any): Promise<boolean> => {
    const { 
      serverPairDialog, 
      userCanisterId, 
      identity
    } = get() as any;
    
    // Validate required dialog state
    if (!serverPairDialog.pendingProjectData || !serverPairDialog.newServerPairName || !userCanisterId || !identity) {
      log('SERVER_PAIRS', '❌ Cannot create server pair and project - missing required dialog data');
      set((state: any) => {
        state.serverPairDialog.error = 'Missing required project or server pair information';
      });
      return false;
    }

    // Validate platform wallet prerequisites
    if (!mainActor) {
      log('SERVER_PAIRS', '❌ Cannot create server pair - platform wallet actor not provided');
      set((state: any) => {
        state.serverPairDialog.error = 'Platform wallet not connected. Please refresh and try again.';
      });
      return false;
    }

    // Validate ICP pricing data prerequisites
    if (!icpPriceData || !icpPriceData.price || icpPriceData.price <= 0) {
      log('SERVER_PAIRS', '❌ Cannot create server pair - ICP pricing data not provided or invalid');
      set((state: any) => {
        state.serverPairDialog.error = 'ICP pricing data unavailable. Please check your connection and try again.';
      });
      return false;
    }

    const { pendingProjectData, newServerPairName, creditsToAllocate } = serverPairDialog;

    log('SERVER_PAIRS', '🚀 Creating NEW server pair with hosting and project:', {
      projectName: pendingProjectData.name,
      serverPairName: newServerPairName,
      creditsAllocated: creditsToAllocate,
      icpPrice: icpPriceData.price
    });

    // ENHANCED LOGGING: Track pending project data timestamps
    console.log('🔍 [createServerPairAndProject] TIMESTAMP DEBUG - Pending project data:', {
      id: pendingProjectData.id,
      name: pendingProjectData.name,
      created: pendingProjectData.created,
      createdType: typeof pendingProjectData.created,
      updated: pendingProjectData.updated,
      updatedType: typeof pendingProjectData.updated
    });

    // Validate credits sufficiency before starting expensive operations
    const serverConfig = calculateOptimalServerConfig(creditsToAllocate);
    if (!serverConfig.canCreateServers) {
      log('SERVER_PAIRS', '❌ Insufficient credits for server pair creation');
      set((state: any) => {
        state.serverPairDialog.error = serverConfig.message;
      });
      return false;
    }

    // FIXED: Set operation loading state only during actual operations
    set((state: any) => {
      state.serverPairDialog.isOperationLoading = true;
      state.serverPairDialog.error = null;
      state.serverPairDialog.hostingProgress = {
        status: 'Starting server pair creation with hosting...',
        progress: 0,
        phase: 'setup'
      };
    });

    try {
      // CRITICAL FIX: Ensure proper timestamp formatting before project creation
      const properlyFormattedProjectData = createProjectData(pendingProjectData);
      
      // First create the project (same as assignment pattern)
      const projectSuccess = await (get() as any).createProject(properlyFormattedProjectData);
      
      if (!projectSuccess) {
        throw new Error('Failed to create project');
      }

      const newProjectId = properlyFormattedProjectData.id;
      log('SERVER_PAIRS', '✅ Project created successfully, now creating server pair infrastructure with hosting...');

      // Update progress
      set((state: any) => {
        state.serverPairDialog.hostingProgress = {
          status: 'Creating server infrastructure...',
          progress: 25,
          phase: 'setup'
        };
      });

      // ENHANCED: Create complete server pair infrastructure with hosting using enhanced service method
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const serverPairResult = await userCanisterService.createCompleteServerPairForProject(
        newServerPairName,
        creditsToAllocate,
        newProjectId,
        properlyFormattedProjectData.name,
        userCanisterId,
        identity,
        mainActor,
        icpPriceData,
        true,
        // Progress callback for detailed hosting progress tracking
        (status: string, progress: number) => {
          log('SERVER_PAIRS', `🌐 Hosting Progress: ${status} (${progress}%)`);
          
          set((state: any) => {
            state.serverPairDialog.hostingProgress = {
              status,
              progress,
              phase: progress < 50 ? 'setup' : progress < 100 ? 'hosting' : 'complete'
            };
          });
        }
      );

      if (!serverPairResult.success) {
        throw new Error(`Failed to create server pair infrastructure with hosting: ${serverPairResult.error}`);
      }

      log('SERVER_PAIRS', '✅ Server pair infrastructure with hosting created successfully:', {
        serverPairId: serverPairResult.serverPairId,
        frontendCanisterId: serverPairResult.frontendCanisterId,
        backendCanisterId: serverPairResult.backendCanisterId,
        hostingConfigured: serverPairResult.hostingConfigured
      });

      // ROBUST FALLBACK: If serverPairId is missing or invalid, find it by matching canister IDs
      let finalServerPairId = serverPairResult.serverPairId;
      
      if (!finalServerPairId || finalServerPairId === 'created' || typeof finalServerPairId !== 'string') {
        log('SERVER_PAIRS', '⚠️ Server pair ID not properly returned, attempting to find by canister IDs...');
        
        try {
          // Refresh server pairs list to find the newly created pair
          const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
          const refreshedPairsResult = await userActor.getProjectServerPairs(newProjectId);
          
          if (refreshedPairsResult && 'ok' in refreshedPairsResult && Array.isArray(refreshedPairsResult.ok)) {
            const refreshedPairs = refreshedPairsResult.ok.map((pair: any) => ({
              pairId: pair.pairId,
              name: pair.name,
              frontendCanisterId: pair.frontendCanisterId.toText(),
              backendCanisterId: pair.backendCanisterId.toText()
            }));
            
            // Find the newly created pair by matching frontend/backend canister IDs
            const newlyCreatedPair = refreshedPairs.find((pair: any) => 
              pair.frontendCanisterId === serverPairResult.frontendCanisterId && 
              pair.backendCanisterId === serverPairResult.backendCanisterId
            );
            
            if (newlyCreatedPair && newlyCreatedPair.pairId) {
              finalServerPairId = newlyCreatedPair.pairId;
              log('SERVER_PAIRS', '✅ Found server pair ID by canister ID matching:', finalServerPairId);
            } else {
              log('SERVER_PAIRS', '⚠️ Could not find server pair by canister ID matching');
            }
          }
        } catch (error) {
          log('SERVER_PAIRS', '⚠️ Error while trying to find server pair by canister IDs:', error);
        }
      }

      // Check hosting configuration status and provide appropriate feedback
      if (serverPairResult.hostingConfigured) {
        log('SERVER_PAIRS', '🌐 Hosting configured successfully - frontend server ready for website deployment!');
        set((state: any) => {
          state.serverPairDialog.hostingProgress = {
            status: 'Hosting configured successfully!',
            progress: 100,
            phase: 'complete'
          };
        });
      } else {
        log('SERVER_PAIRS', '⚠️ Server pair created but hosting configuration failed - manual configuration may be needed');
        set((state: any) => {
          state.serverPairDialog.hostingProgress = {
            status: 'Server created - hosting needs manual configuration',
            progress: 100,
            phase: 'error'
          };
        });
      }

      // Coordinate state with the new server pair assignment
      if (finalServerPairId && finalServerPairId !== 'created' && typeof finalServerPairId === 'string') {
        (get() as any).notifyServerPairUpdate(newProjectId, finalServerPairId);
        log('SERVER_PAIRS', '✅ Server pair creation with hosting coordinated through direct state update');
      } else {
        log('SERVER_PAIRS', '⚠️ Cannot coordinate server pair update - invalid server pair ID:', finalServerPairId);
      }

      // Set active project with same pattern as assignment method
      set((state: any) => {
        state.activeProject = properlyFormattedProjectData.id;
        
        // Initialize project-specific state if needed
        if (!state.projectMessages[properlyFormattedProjectData.id]) {
          const welcomeMessage = [{
            id: 'welcome-' + properlyFormattedProjectData.id,
            type: 'system' as const,
            content: `Welcome to your new project: **${properlyFormattedProjectData.title || properlyFormattedProjectData.name}**!\n\nYour server infrastructure has been provisioned ${serverPairResult.hostingConfigured ? 'with hosting configured' : '(hosting configuration pending)'}. What would you like to build?`,
            timestamp: new Date()
          }];
          state.projectMessages[properlyFormattedProjectData.id] = welcomeMessage;
        }
        
        // Set current messages to this project's messages
        state.currentMessages = state.projectMessages[properlyFormattedProjectData.id] || [];
        
        // Initialize other project-specific state
        if (!state.projectGeneratedFiles[properlyFormattedProjectData.id]) {
          state.projectGeneratedFiles[properlyFormattedProjectData.id] = {};
        }
        if (!state.projectFileGenerationStates[properlyFormattedProjectData.id]) {
          state.projectFileGenerationStates[properlyFormattedProjectData.id] = {};
        }
        if (!state.projectLiveGeneratedFiles[properlyFormattedProjectData.id]) {
          state.projectLiveGeneratedFiles[properlyFormattedProjectData.id] = [];
        }
        if (!state.projectTabGroups[properlyFormattedProjectData.id]) {
          state.projectTabGroups[properlyFormattedProjectData.id] = [];
        }
        
        // Clear current generated files and set to this project's files
        state.generatedFiles = {};
        state.fileGenerationStates = {};
        state.liveGeneratedFiles = [];
        state.tabGroups = [];
        
        // Start a new session for the project
        const sessionId = generateSessionId();
        state.currentSessionId = sessionId;
        state.currentSessionMessages = [];
        
        // Close side pane
        state.ui.sidePane.isOpen = false;
        state.ui.sidePane.activeFile = null;
        state.isEditable = false;
        state.isDirty = false;
        state.editContent = null;
        state.ui.sidePane.isEditable = false;
        state.ui.sidePane.isDirty = false;
        state.ui.sidePane.editContent = null;
        
        // Clear loading state
        state.serverPairDialog.isOperationLoading = false;
      });

      log('SERVER_PAIRS', '✅ Active project set with new server infrastructure and hosting configuration');

      // Close the dialog
      (get() as any).closeServerPairSelectionDialog();

      return true;

    } catch (error) {
      log('SERVER_PAIRS', '❌ Failed to create server pair and project with hosting:', error);
      
      // Enhanced error handling for server creation complexity with hosting
      let errorMessage = 'Failed to create server infrastructure with hosting';
      
      if (error instanceof Error) {
        if (error.message.includes('platform wallet')) {
          errorMessage = 'Platform wallet operation failed. Please check your connection and try again.';
        } else if (error.message.includes('ICP')) {
          errorMessage = 'ICP pricing or payment processing failed. Please try again.';
        } else if (error.message.includes('insufficient')) {
          errorMessage = 'Insufficient credits for server pair creation. Please add more credits.';
        } else if (error.message.includes('cycles')) {
          errorMessage = 'Server provisioning failed due to insufficient resources.';
        } else if (error.message.includes('hosting')) {
          errorMessage = 'Server created but hosting configuration failed. Manual hosting setup may be needed.';
        } else {
          errorMessage = error.message;
        }
      }
      
      set((state: any) => {
        state.serverPairDialog.error = errorMessage;
        state.serverPairDialog.isOperationLoading = false;
        state.serverPairDialog.hostingProgress = {
          status: 'Creation failed',
          progress: 0,
          phase: 'error'
        };
      });
      
      return false;
    }
  },

  createServerPairForExistingProject: async (
    projectId: string,
    projectName: string,
    serverPairName: string,
    creditsToAllocate: number,
    mainActor: any,
    icpPriceData: any,
    progressCallback?: (status: string, progress: number) => void,
    poolType?: 'RegularServerPair' | 'AgentServerPair' | 'AgencyWorkflowPair'
  ): Promise<{ success: boolean; serverPairId?: string; error?: string }> => {
    const { userCanisterId, identity } = get() as any;

    // Validate required parameters
    if (!userCanisterId || !identity) {
      log('SERVER_PAIRS', '❌ Cannot create server pair - missing user authentication');
      return {
        success: false,
        error: 'Missing user authentication. Please ensure you are logged in.'
      };
    }

    // Validate platform wallet prerequisites
    if (!mainActor) {
      log('SERVER_PAIRS', '❌ Cannot create server pair - platform wallet actor not provided');
      return {
        success: false,
        error: 'Platform wallet not connected. Please refresh and try again.'
      };
    }

    // Validate ICP pricing data prerequisites
    if (!icpPriceData || !icpPriceData.price || icpPriceData.price <= 0) {
      log('SERVER_PAIRS', '❌ Cannot create server pair - ICP pricing data not provided or invalid');
      return {
        success: false,
        error: 'ICP pricing data unavailable. Please check your connection and try again.'
      };
    }

    log('SERVER_PAIRS', '🚀 Creating server pair for existing project:', {
      projectId,
      projectName,
      serverPairName,
      creditsAllocated: creditsToAllocate,
      icpPrice: icpPriceData.price
    });

    // Validate credits sufficiency before starting expensive operations
    const serverConfig = calculateOptimalServerConfig(creditsToAllocate);
    if (!serverConfig.canCreateServers) {
      log('SERVER_PAIRS', '❌ Insufficient credits for server pair creation');
      return {
        success: false,
        error: serverConfig.message
      };
    }

    try {
      progressCallback?.('Creating server infrastructure...', 25);

      // Create complete server pair infrastructure with hosting using enhanced service method
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const serverPairResult = await userCanisterService.createCompleteServerPairForProject(
        serverPairName,
        creditsToAllocate,
        projectId,
        projectName,
        userCanisterId,
        identity,
        mainActor,
        icpPriceData,
        true, // createHosting
        // Progress callback for detailed hosting progress tracking
        (status: string, progress: number) => {
          log('SERVER_PAIRS', `🌐 Hosting Progress: ${status} (${progress}%)`);
          progressCallback?.(status, progress);
        },
        poolType || 'RegularServerPair' // Pool type (default to regular hosting)
      );

      if (!serverPairResult.success) {
        throw new Error(`Failed to create server pair infrastructure with hosting: ${serverPairResult.error}`);
      }

      log('SERVER_PAIRS', '✅ Server pair infrastructure with hosting created successfully:', {
        serverPairId: serverPairResult.serverPairId,
        frontendCanisterId: serverPairResult.frontendCanisterId,
        backendCanisterId: serverPairResult.backendCanisterId,
        hostingConfigured: serverPairResult.hostingConfigured
      });

      // ROBUST FALLBACK: If serverPairId is missing or invalid, find it by matching canister IDs
      let finalServerPairId = serverPairResult.serverPairId;
      
      if (!finalServerPairId || finalServerPairId === 'created' || typeof finalServerPairId !== 'string') {
        log('SERVER_PAIRS', '⚠️ Server pair ID not properly returned, attempting to find by canister IDs...');
        
        try {
          // Refresh server pairs list to find the newly created pair
          const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
          const refreshedPairsResult = await userActor.getProjectServerPairs(projectId);
          
          if (refreshedPairsResult && 'ok' in refreshedPairsResult && Array.isArray(refreshedPairsResult.ok)) {
            const refreshedPairs = refreshedPairsResult.ok.map((pair: any) => ({
              pairId: pair.pairId,
              name: pair.name,
              frontendCanisterId: pair.frontendCanisterId.toText(),
              backendCanisterId: pair.backendCanisterId.toText()
            }));
            
            // Find the newly created pair by matching frontend/backend canister IDs
            const newlyCreatedPair = refreshedPairs.find((pair: any) => 
              pair.frontendCanisterId === serverPairResult.frontendCanisterId && 
              pair.backendCanisterId === serverPairResult.backendCanisterId
            );
            
            if (newlyCreatedPair && newlyCreatedPair.pairId) {
              finalServerPairId = newlyCreatedPair.pairId;
              log('SERVER_PAIRS', '✅ Found server pair ID by canister ID matching:', finalServerPairId);
            } else {
              log('SERVER_PAIRS', '⚠️ Could not find server pair by canister ID matching');
            }
          }
        } catch (error) {
          log('SERVER_PAIRS', '⚠️ Error while trying to find server pair by canister IDs:', error);
        }
      }

      // Coordinate state with the new server pair assignment
      if (finalServerPairId && finalServerPairId !== 'created' && typeof finalServerPairId === 'string') {
        (get() as any).notifyServerPairUpdate(projectId, finalServerPairId);
        log('SERVER_PAIRS', '✅ Server pair creation coordinated through direct state update');
      } else {
        log('SERVER_PAIRS', '⚠️ Cannot coordinate server pair update - invalid server pair ID:', finalServerPairId);
      }

      progressCallback?.('Server pair created successfully!', 100);

      return {
        success: true,
        serverPairId: finalServerPairId
      };

    } catch (error) {
      log('SERVER_PAIRS', '❌ Failed to create server pair for existing project:', error);
      
      // Enhanced error handling
      let errorMessage = 'Failed to create server infrastructure with hosting';
      
      if (error instanceof Error) {
        if (error.message.includes('platform wallet')) {
          errorMessage = 'Platform wallet operation failed. Please check your connection and try again.';
        } else if (error.message.includes('ICP')) {
          errorMessage = 'ICP pricing or payment processing failed. Please try again.';
        } else if (error.message.includes('insufficient')) {
          errorMessage = 'Insufficient credits for server pair creation. Please add more credits.';
        } else if (error.message.includes('cycles')) {
          errorMessage = 'Server provisioning failed due to insufficient resources.';
        } else if (error.message.includes('hosting')) {
          errorMessage = 'Server created but hosting configuration failed. Manual hosting setup may be needed.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  },

  createProjectWithoutServerPair: async (): Promise<boolean> => {
    const { serverPairDialog } = get() as any;
    
    if (!serverPairDialog.pendingProjectData) {
      log('SERVER_PAIRS', '❌ Cannot create project - no pending project data');
      return false;
    }

    const { pendingProjectData } = serverPairDialog;

    log('SERVER_PAIRS', '🖥️ Creating project without server pair:', pendingProjectData.name);

    // ENHANCED LOGGING: Track pending project data timestamps before processing
    console.log('🔍 [createProjectWithoutServerPair] TIMESTAMP DEBUG - Pending project data before createProjectData:', {
      id: pendingProjectData.id,
      name: pendingProjectData.name,
      created: pendingProjectData.created,
      createdType: typeof pendingProjectData.created,
      createdValid: typeof pendingProjectData.created === 'number' && !isNaN(pendingProjectData.created),
      updated: pendingProjectData.updated,
      updatedType: typeof pendingProjectData.updated,
      updatedValid: typeof pendingProjectData.updated === 'number' && !isNaN(pendingProjectData.updated)
    });

    // FIXED: Set operation loading state only during actual operations
    set((state: any) => {
      state.serverPairDialog.isOperationLoading = true;
      state.serverPairDialog.error = null;
      state.serverPairDialog.hostingProgress = {
        status: 'Creating project without hosting...',
        progress: 50,
        phase: 'setup'
      };
    });

    try {
      // CRITICAL FIX: Ensure proper timestamp formatting before project creation
      const properlyFormattedProjectData = createProjectData(pendingProjectData);
      
      // ENHANCED LOGGING: Verify the formatted data before sending to createProject
      console.log('✅ [createProjectWithoutServerPair] TIMESTAMP DEBUG - About to call createProject with:', {
        id: properlyFormattedProjectData.id,
        name: properlyFormattedProjectData.name,
        created: properlyFormattedProjectData.created,
        createdType: typeof properlyFormattedProjectData.created,
        createdValid: typeof properlyFormattedProjectData.created === 'number' && !isNaN(properlyFormattedProjectData.created),
        updated: properlyFormattedProjectData.updated,
        updatedType: typeof properlyFormattedProjectData.updated,
        updatedValid: typeof properlyFormattedProjectData.updated === 'number' && !isNaN(properlyFormattedProjectData.updated),
        mathFloorCreated: Math.floor(properlyFormattedProjectData.created),
        mathFloorUpdated: Math.floor(properlyFormattedProjectData.updated),
        bigintCreated: typeof properlyFormattedProjectData.created === 'number' ? BigInt(Math.floor(properlyFormattedProjectData.created) * 1_000_000) : 'WOULD_FAIL',
        bigintUpdated: typeof properlyFormattedProjectData.updated === 'number' ? BigInt(Math.floor(properlyFormattedProjectData.updated) * 1_000_000) : 'WOULD_FAIL'
      });
      
      // Create the project normally
      const success = await (get() as any).createProject(properlyFormattedProjectData);
      
      if (success) {
        // Update progress
        set((state: any) => {
          state.serverPairDialog.hostingProgress = {
            status: 'Project created successfully!',
            progress: 100,
            phase: 'complete'
          };
        });

        // Switch to the newly created project
        await (get() as any).switchToProject(properlyFormattedProjectData.id);
        
        // Close the dialog
        (get() as any).closeServerPairSelectionDialog();
        
        log('SERVER_PAIRS', '✅ Project created successfully without server pair');
        console.log('🎉 [createProjectWithoutServerPair] TIMESTAMP DEBUG - Project creation completed successfully!');
        return true;
      }
      
      throw new Error('Failed to create project');

    } catch (error) {
      log('SERVER_PAIRS', '❌ Failed to create project without server pair:', error);
      console.error('🚨 [createProjectWithoutServerPair] TIMESTAMP DEBUG - Project creation failed with error:', error);
      
      set((state: any) => {
        state.serverPairDialog.error = error instanceof Error ? error.message : 'Failed to create project';
        state.serverPairDialog.isOperationLoading = false;
        state.serverPairDialog.hostingProgress = {
          status: 'Project creation failed',
          progress: 0,
          phase: 'error'
        };
      });
      
      return false;
    }
  },

  calculateServerConfigFromCredits: (credits: number) => {
    return calculateOptimalServerConfig(credits);
  },

  getMinimumCreditsRequired: (): number => {
    const standardCalc = calculateRealisticServerResources(1, 30);
    return resourcesToCredits(standardCalc.totalWithBuffer) * 2; // For pair
  },

  // Direct state coordination methods
  setProjectServerPair: (projectId: string, serverPairId: string) => {
    log('SERVER_PAIR_COORDINATION', '🔗 Setting project server pair assignment:', { projectId, serverPairId });
    
    set((state: any) => {
      state.projectServerPairs.projectServerPairAssignments[projectId] = serverPairId;
      state.projectServerPairs.lastAssignmentUpdate = Date.now();
    });

    // Save to canister for persistence (fire-and-forget) - NO FALLBACK
    setSelectedServerPairForProject(projectId, serverPairId).then(() => {
      log('SERVER_PAIR_COORDINATION', '✅ Updated canister for persistence');
    }).catch(error => {
      log('SERVER_PAIR_COORDINATION', '❌ Failed to update canister:', error);
    });
  },

  getProjectServerPair: (projectId: string): string | null => {
    const state = get() as any;
    const assignment = state.projectServerPairs.projectServerPairAssignments[projectId];
    
    if (assignment) {
      log('SERVER_PAIR_COORDINATION', '🔍 Found server pair assignment in state:', { projectId, serverPairId: assignment });
      return assignment;
    }

    // NO FALLBACK - return null if not in state
    return null;
  },

  removeProjectServerPair: (projectId: string) => {
    log('SERVER_PAIR_COORDINATION', '🗑️ Removing project server pair assignment:', projectId);
    
    set((state: any) => {
      delete state.projectServerPairs.projectServerPairAssignments[projectId];
      state.projectServerPairs.lastAssignmentUpdate = Date.now();
    });

    // Remove from canister (fire-and-forget) - NO FALLBACK
    setSelectedServerPairForProject(projectId, null).catch(error => {
      log('SERVER_PAIR_COORDINATION', '⚠️ Failed to remove from canister:', error);
    });

    // Also remove from localStorage
    try {
      localStorage.removeItem(`selected-server-pair-${projectId}`);
      log('SERVER_PAIR_COORDINATION', '✅ Removed from localStorage');
    } catch (error) {
      log('SERVER_PAIR_COORDINATION', '⚠️ Failed to remove from localStorage:', error);
    }
  },

  syncWithLocalStorage: (projectId: string) => {
    // NO-OP: localStorage sync has been removed - all state comes from backend
    log('SERVER_PAIR_COORDINATION', 'ℹ️ syncWithLocalStorage is deprecated - no action taken');
  },

  notifyServerPairUpdate: (projectId: string, serverPairId: string) => {
    log('SERVER_PAIR_COORDINATION', '📢 Broadcasting server pair update:', { projectId, serverPairId });
    
    // Update state immediately
    (get() as any).setProjectServerPair(projectId, serverPairId);
    
    // Dispatch a custom event for any components that might be listening
    try {
      window.dispatchEvent(new CustomEvent('serverPairAssignmentChange', {
        detail: { projectId, serverPairId, timestamp: Date.now() }
      }));
      log('SERVER_PAIR_COORDINATION', '✅ Custom event dispatched');
    } catch (error) {
      log('SERVER_PAIR_COORDINATION', '⚠️ Failed to dispatch custom event:', error);
    }
  },
});