import { StateCreator } from 'zustand';

export interface SidePaneState {
  isOpen: boolean;
  activeFile: string | null;
  isMobile: boolean;
  isEditable: boolean;
  isDirty: boolean;
  pendingSave: boolean;
  editContent: string | null;
  isUserEditing: boolean;
  contentUpdateSource: 'user' | 'streaming' | 'external' | null;
  lastUserContentHash: string | null;
  // ENHANCED: Auto-retry automation UI state management
  isAutomationMode: boolean;
  automationWorkflowId: string | null;
  interactionBlocked: boolean;
  blockingReason: string | null;
  // 🆕 STREAMING STATE AWARENESS
  isStreamingToActiveFile: boolean;
  streamingSource: 'project_generation' | 'update_streaming' | 'file_application' | null;
  // 🆕 EDIT LOCATION for scrolling to edits
  editLocation: { lineNumber: number; column: number; fileName: string } | null;
  editPreview: {
    fileName: string;
    lineNumber: number;
    oldCode: string;
    newCode: string;
    context: string;
    description: string;
  } | null;
}

export interface SidebarState {
  isOpen: boolean;
  searchQuery: string;
  // ENHANCED: Automation-aware sidebar state
  isAutomationActive: boolean;
  automationStatus: string | null;
}

export interface UIState {
  sidePane: SidePaneState;
  sidebar: SidebarState;
  showInitializationOverlay: boolean;
  showSubscriptionSelection: boolean;
  mobileMenuOpen: boolean;
  userDropdownOpen: boolean;
  isUserEditing: boolean;
  contentUpdateSource: 'user' | 'streaming' | 'external' | null;
  lastUserContentHash: string | null;
  // ENHANCED: Global automation UI state with comprehensive status tracking
  automationState: {
    isActive: boolean;
    workflowId: string | null;
    phase: 'FILE_GENERATION' | 'FILE_APPLICATION' | 'DEPLOYMENT' | 'COMPLETED' | 'FAILED' | null;
    status: string;
    startTime: number | null;
    lastUpdate: number | null;
    executionCount: number;
    maxExecutions: number;
    blockUserInteractions: boolean;
    showVisualIndicators: boolean;
  };
  // ENHANCED: Auto-retry visual feedback system
  autoRetryVisualState: {
    showBanner: boolean;
    bannerMessage: string;
    bannerType: 'info' | 'progress' | 'success' | 'error';
    showProgressIndicator: boolean;
    progressPercent: number;
    progressMessage: string;
    showWorkflowIcon: boolean;
    workflowIconState: 'idle' | 'spinning' | 'success' | 'error';
  };
  // OPTION 4: UI-First K animation override system
  instantKAnimationOverride: {
    forceHide: boolean;
    reason: string;
    timestamp: number;
    messageId: string;
  } | null;
}

export interface UISliceState {
  ui: UIState;
  isEditable: boolean;
  isDirty: boolean;
  pendingSave: boolean;
  editContent: string | null;
}

export interface UISliceActions {
  toggleSidePane: (fileName?: string) => void;
  closeSidePane: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarSearchQuery: (query: string) => void;
  setMobile: (isMobile: boolean) => void;
  toggleUserDropdown: () => void;
  closeUserDropdown: () => void;
  // FIXED: Renamed to avoid conflict with generatedFilesSlice
  triggerTabGroupsUpdate: () => void;
  handleTabClick: (fileName: string) => void;
  toggleSidePaneEditMode: () => void;
  updateFileContent: (content: string, source?: 'user' | 'streaming' | 'external') => void;
  saveCurrentFile: () => Promise<boolean>;
  createNewFile: (fileName: string, content?: string) => Promise<boolean>;
  deleteCurrentFile: () => Promise<boolean>;
  renameCurrentFile: (newFileName: string) => Promise<boolean>;
  setFileDirty: (isDirty: boolean, source?: 'user' | 'streaming' | 'external') => void;
  setUserEditingState: (isEditing: boolean) => void;
  clearContentUpdateSource: () => void;
  isContentFromUser: () => boolean;
  // 🆕 STREAMING STATE MANAGEMENT - ENHANCED
  setStreamingToActiveFile: (isStreaming: boolean, source?: 'project_generation' | 'update_streaming' | 'file_application') => void;
  isStreamingContentUpdate: () => boolean;
  shouldAllowSidePaneClose: () => boolean;
  // ENHANCED: Auto-retry UI coordination methods
  startAutomationMode: (workflowId: string, phase: string) => void;
  stopAutomationMode: (reason?: string) => void;
  updateAutomationStatus: (phase: string, status: string, executionCount?: number) => void;
  blockUserInteractions: (reason: string, workflowId: string) => void;
  unblockUserInteractions: () => void;
  isUserInteractionBlocked: () => boolean;
  // ENHANCED: Visual feedback methods for auto-retry
  showAutoRetryBanner: (message: string, type: 'info' | 'progress' | 'success' | 'error') => void;
  hideAutoRetryBanner: () => void;
  updateAutoRetryProgress: (percent: number, message: string) => void;
  setWorkflowIconState: (state: 'idle' | 'spinning' | 'success' | 'error') => void;
  // ENHANCED: Automation-aware interaction handling
  shouldPreventUserAction: (action: string) => boolean;
  getAutomationStatusForDisplay: () => string | null;
  // ENHANCED: Cleanup and reset methods
  resetAutomationUI: () => void;
  cleanupAutomationState: (workflowId: string) => void;
}

export type UISlice = UISliceState & UISliceActions;

// ENHANCED: Logging system for UI automation coordination
const log = (category: string, message: string, ...args: any[]) => {
  const categories = ['UI_AUTOMATION', 'USER_INTERACTION', 'VISUAL_FEEDBACK', 'STATE_MANAGEMENT', 'FUNCTION_BINDING', 'STREAMING_STATE'];
  if (categories.includes(category)) {
    console.log(`[${category}] ${message}`, ...args);
  }
};

// ENHANCED: User action validation during automation
const BLOCKED_ACTIONS_DURING_AUTOMATION = [
  'file_edit', 'file_create', 'file_delete', 'file_rename',
  'project_switch', 'deployment_manual', 'sidebar_interaction'
];

const ALLOWED_ACTIONS_DURING_AUTOMATION = [
  'tab_view', 'scroll', 'resize', 'close_sidepane', 'view_logs'
];

// 🆕 STREAMING-SPECIFIC ACTIONS - ARCHITECTURAL ALIGNMENT
const STREAMING_ALLOWED_ACTIONS = [
  'close_sidepane',    // 🚀 CRITICAL: Always allow close during streaming (aligned with project generation)
  'tab_view', 
  'scroll', 
  'resize', 
  'view_logs', 
  'navigate'
];

// ENHANCED: Visual feedback timing constants
const BANNER_AUTO_HIDE_DELAY = 8000; // 8 seconds
const PROGRESS_UPDATE_THROTTLE = 500; // 500ms
const ICON_STATE_TRANSITION_DELAY = 300; // 300ms

// FIXED: Circuit breaker for preventing infinite recursion
const createCircuitBreaker = (functionName: string, maxDepth: number = 3) => {
  let currentDepth = 0;
  const activeExecutions = new Set<string>();
  
  return (fn: Function) => {
    return (...args: any[]) => {
      const executionId = `${functionName}_${Date.now()}_${Math.random()}`;
      
      // Check for recursion depth
      if (currentDepth >= maxDepth) {
        console.warn(`🔥 [CIRCUIT BREAKER] ${functionName} exceeded max depth (${maxDepth}), breaking recursion`);
        return;
      }
      
      // Check for active executions of same function
      if (activeExecutions.has(functionName)) {
        console.warn(`🔥 [CIRCUIT BREAKER] ${functionName} already executing, preventing re-entry`);
        return;
      }
      
      try {
        currentDepth++;
        activeExecutions.add(functionName);
        return fn(...args);
      } catch (error) {
        console.error(`🔥 [CIRCUIT BREAKER] ${functionName} execution error:`, error);
        throw error;
      } finally {
        currentDepth--;
        activeExecutions.delete(functionName);
      }
    };
  };
};

// SOLUTION: Proper Zustand state creator type with correct binding and circuit breaker protection
export const createUISlice: StateCreator<
  any, // Combined store state
  [['zustand/immer', never], ['zustand/devtools', never], ['zustand/subscribeWithSelector', never]], // Middleware
  [], // No additional middleware
  UISlice // Return type
> = (set, get, api) => {
  
  // SOLUTION: Validate that set function is working correctly
  const validateSetFunction = () => {
    if (typeof set !== 'function') {
      console.error('🚨 [FUNCTION_BINDING] CRITICAL: set is not a function in UISlice!');
      return false;
    }
    return true;
  };

  // SOLUTION: Create bound functions with explicit validation and circuit breaker protection
  const createBoundFunction = <T extends (...args: any[]) => any>(
    name: string, 
    fn: T,
    useCircuitBreaker: boolean = false
  ): T => {
    let boundFunction = (...args: Parameters<T>) => {
      if (!validateSetFunction()) {
        console.error(`🚨 [FUNCTION_BINDING] Cannot execute ${name} - set function invalid`);
        return;
      }
      
      try {
        return fn(...args);
      } catch (error) {
        console.error(`🚨 [FUNCTION_BINDING] Error in ${name}:`, error);
        throw error;
      }
    };
    
    // Apply circuit breaker if requested
    if (useCircuitBreaker) {
      const circuitBreaker = createCircuitBreaker(name, 3);
      boundFunction = circuitBreaker(boundFunction);
    }
    
    // Add function name for debugging
    Object.defineProperty(boundFunction, 'name', { value: name });
    
    return boundFunction as T;
  };

  // SOLUTION: Validate initial state structure
  const initialUIState: UIState = {
    sidePane: { 
      isOpen: false, 
      activeFile: null, 
      isMobile: false,
      isEditable: false,
      isDirty: false,
      pendingSave: false,
      editContent: null,
      isUserEditing: false,
      contentUpdateSource: null,
      lastUserContentHash: null,
      // ENHANCED: Auto-retry automation UI state
      isAutomationMode: false,
      automationWorkflowId: null,
      interactionBlocked: false,
      blockingReason: null,
      // 🆕 STREAMING STATE AWARENESS
      isStreamingToActiveFile: false,
      streamingSource: null,
      // 🆕 EDIT LOCATION for scrolling to edits
      editLocation: null,
      // 🆕 EDIT PREVIEW for showing what changed
      editPreview: null
    },
    sidebar: { 
      isOpen: false, 
      searchQuery: '',
      // ENHANCED: Automation-aware sidebar state
      isAutomationActive: false,
      automationStatus: null
    },
    showInitializationOverlay: false,
    showSubscriptionSelection: false,
    mobileMenuOpen: false,
    userDropdownOpen: false,
    isUserEditing: false,
    contentUpdateSource: null,
    lastUserContentHash: null,
    // ENHANCED: Global automation UI state with comprehensive tracking
    automationState: {
      isActive: false,
      workflowId: null,
      phase: null,
      status: '',
      startTime: null,
      lastUpdate: null,
      executionCount: 0,
      maxExecutions: 3,
      blockUserInteractions: false,
      showVisualIndicators: false
    },
    // ENHANCED: Auto-retry visual feedback system
    autoRetryVisualState: {
      showBanner: false,
      bannerMessage: '',
      bannerType: 'info',
      showProgressIndicator: false,
      progressPercent: 0,
      progressMessage: '',
      showWorkflowIcon: false,
      workflowIconState: 'idle'
    },
    // OPTION 4: Initialize K animation override system
    instantKAnimationOverride: null
  };

  log('FUNCTION_BINDING', '🏗️ [UI SLICE] Creating UI slice with enhanced function binding validation and circuit breaker protection');

  const uiSlice: UISlice = {
    // State
    ui: initialUIState,
    isEditable: false,
    isDirty: false,
    pendingSave: false,
    editContent: null,

    // SOLUTION: Create all functions with explicit binding and validation
    toggleSidePane: createBoundFunction('toggleSidePane', (fileName?: string) => {
      log('USER_INTERACTION', '📱 [SIDEPANE] Toggle called with fileName:', fileName);

      set((state) => {
        if (fileName) {
          if (state.ui.sidePane.isOpen && state.ui.sidePane.activeFile === fileName) {
            // 🚀 ARCHITECTURAL ALIGNMENT: Use shouldAllowSidePaneClose for consistent behavior
            const shouldAllowClose = uiSlice.shouldAllowSidePaneClose();
            if (!shouldAllowClose) {
              log('USER_INTERACTION', '⚠️ [SIDEPANE] Close prevented by shouldAllowSidePaneClose');
              return; // Don't close if not allowed
            }
            
            state.ui.sidePane.isOpen = false;
            state.ui.sidePane.activeFile = null;
          } else {
            state.ui.sidePane.isOpen = true;
            state.ui.sidePane.activeFile = fileName;
          }
          
          // Reset editing states when switching files or closing
          state.isEditable = false;
          state.isDirty = false;
          state.editContent = null;
          
          state.ui.sidePane.isEditable = false;
          state.ui.sidePane.isDirty = false;
          state.ui.sidePane.editContent = null;
          state.ui.sidePane.contentUpdateSource = null;
          
        } else {
          // Closing SidePane entirely
          // 🚀 ARCHITECTURAL ALIGNMENT: Use shouldAllowSidePaneClose for consistent behavior
          const shouldAllowClose = uiSlice.shouldAllowSidePaneClose();
          if (!shouldAllowClose) {
            log('USER_INTERACTION', '⚠️ [SIDEPANE] Close prevented by shouldAllowSidePaneClose');
            return; // Don't close if not allowed
          }
          
          state.ui.sidePane.isOpen = !state.ui.sidePane.isOpen;
          if (!state.ui.sidePane.isOpen) {
            state.ui.sidePane.activeFile = null;
            
            state.isEditable = false;
            state.isDirty = false;
            state.editContent = null;
            
            state.ui.sidePane.isEditable = false;
            state.ui.sidePane.isDirty = false;
            state.ui.sidePane.editContent = null;
            state.ui.sidePane.contentUpdateSource = null;
            state.ui.sidePane.isStreamingToActiveFile = false;
            state.ui.sidePane.streamingSource = null;
          }
        }

        log('USER_INTERACTION', '📱 [SIDEPANE] Toggle completed:', {
          fileName,
          isOpen: state.ui.sidePane.isOpen,
          activeFile: state.ui.sidePane.activeFile
        });
      });
    }),

    closeSidePane: createBoundFunction('closeSidePane', () => {
      log('USER_INTERACTION', '📱 [SIDEPANE] Close called');
      
      set((state) => {
        // 🚀 ARCHITECTURAL ALIGNMENT: Use shouldAllowSidePaneClose for consistent behavior  
        const shouldAllowClose = uiSlice.shouldAllowSidePaneClose();
        if (!shouldAllowClose) {
          log('USER_INTERACTION', '⚠️ [SIDEPANE] Close prevented by shouldAllowSidePaneClose');
          return; // Don't close if not allowed
        }
        
        state.ui.sidePane.isOpen = false;
        state.ui.sidePane.activeFile = null;
        state.ui.sidePane.isStreamingToActiveFile = false;
        state.ui.sidePane.streamingSource = null;
        state.ui.sidePane.contentUpdateSource = null;
      });
      
      log('USER_INTERACTION', '📱 [SIDEPANE] Closed via closeSidePane');
    }),

    // SOLUTION: Critical function - setSidebarOpen with extensive validation and logging
    setSidebarOpen: createBoundFunction('setSidebarOpen', (open: boolean) => {
      log('USER_INTERACTION', '📋 [SIDEBAR] setSidebarOpen called with:', { open });
      
      // ENHANCED: Allow sidebar viewing during automation but log it
      const currentState = get();
      if (currentState.ui && currentState.ui.automationState && currentState.ui.automationState.isActive) {
        log('USER_INTERACTION', '📋 [SIDEBAR] Sidebar interaction during automation:', { 
          open, 
          workflowId: currentState.ui.automationState.workflowId 
        });
      }

      set((state) => {
        if (!state.ui) {
          console.error('🚨 [SIDEBAR] CRITICAL: state.ui is undefined!');
          state.ui = initialUIState;
        }
        if (!state.ui.sidebar) {
          console.error('🚨 [SIDEBAR] CRITICAL: state.ui.sidebar is undefined!');
          state.ui.sidebar = initialUIState.sidebar;
        }
        
        state.ui.sidebar.isOpen = open;
        
        log('USER_INTERACTION', '✅ [SIDEBAR] Sidebar state updated successfully:', {
          open,
          newState: state.ui.sidebar.isOpen
        });
      });
    }),

    setSidebarSearchQuery: createBoundFunction('setSidebarSearchQuery', (query: string) => {
      set((state) => {
        if (!state.ui || !state.ui.sidebar) {
          console.error('🚨 [SIDEBAR] CRITICAL: sidebar state structure missing!');
          if (!state.ui) state.ui = initialUIState;
          if (!state.ui.sidebar) state.ui.sidebar = initialUIState.sidebar;
        }
        state.ui.sidebar.searchQuery = query;
      });
    }),

    setMobile: createBoundFunction('setMobile', (isMobile: boolean) => {
      set((state) => {
        if (!state.ui || !state.ui.sidePane) {
          console.error('🚨 [MOBILE] CRITICAL: sidePane state structure missing!');
          if (!state.ui) state.ui = initialUIState;
          if (!state.ui.sidePane) state.ui.sidePane = initialUIState.sidePane;
        }
        state.ui.sidePane.isMobile = isMobile;
        
        log('STATE_MANAGEMENT', '📱 [MOBILE] Mobile state updated:', { isMobile });
      });
    }),

    toggleUserDropdown: createBoundFunction('toggleUserDropdown', () => {
      set((state) => {
        if (!state.ui) {
          console.error('🚨 [DROPDOWN] CRITICAL: ui state structure missing!');
          state.ui = initialUIState;
        }
        state.ui.userDropdownOpen = !state.ui.userDropdownOpen;
      });
    }),

    closeUserDropdown: createBoundFunction('closeUserDropdown', () => {
      set((state) => {
        if (!state.ui) {
          console.error('🚨 [DROPDOWN] CRITICAL: ui state structure missing!');
          state.ui = initialUIState;
        }
        state.ui.userDropdownOpen = false;
      });
    }),

    // FIXED: Renamed function to avoid conflict and added proper delegation with circuit breaker
    triggerTabGroupsUpdate: createBoundFunction('triggerTabGroupsUpdate', () => {
      log('STATE_MANAGEMENT', '🔄 [TAB GROUPS] Tab groups update triggered from UI slice');
      
      try {
        const currentState = get();
        
        // FIXED: Direct access to the specific slice method to avoid recursion
        if (currentState.updateTabGroups && typeof currentState.updateTabGroups === 'function') {
          // Only call if it's NOT the UI slice's own function
          const functionString = currentState.updateTabGroups.toString();
          if (!functionString.includes('triggerTabGroupsUpdate') && !functionString.includes('Tab groups update triggered from UI slice')) {
            log('STATE_MANAGEMENT', '✅ [TAB GROUPS] Calling generatedFilesSlice.updateTabGroups');
            currentState.updateTabGroups();
          } else {
            log('STATE_MANAGEMENT', '⚠️ [TAB GROUPS] Avoided recursive call to self');
          }
        } else {
          log('STATE_MANAGEMENT', '⚠️ [TAB GROUPS] updateTabGroups method not available');
        }
      } catch (error) {
        console.error('🚨 [TAB GROUPS] Error triggering tab groups update:', error);
      }
    }, true), // Enable circuit breaker for this function

    handleTabClick: createBoundFunction('handleTabClick', (fileName: string) => {
      const currentState = get();
      
      // ENHANCED: Allow tab viewing during automation but log it
      if (currentState.ui && currentState.ui.automationState && currentState.ui.automationState.isActive) {
        log('USER_INTERACTION', '🎯 [TAB INTERACTION] Tab clicked during automation:', { 
          fileName, 
          workflowId: currentState.ui.automationState.workflowId 
        });
      }
      
      // Delegate to toggleSidePane
      if (currentState.toggleSidePane && typeof currentState.toggleSidePane === 'function') {
        currentState.toggleSidePane(fileName);
      }
    }),

    toggleSidePaneEditMode: createBoundFunction('toggleSidePaneEditMode', () => {
      // ENHANCED: Prevent edit mode during automation
      const currentState = get();
      if (currentState.shouldPreventUserAction && typeof currentState.shouldPreventUserAction === 'function' && 
          currentState.shouldPreventUserAction('file_edit')) {
        log('USER_INTERACTION', '🚫 [BLOCKED] Edit mode toggle blocked during automation');
        if (currentState.showAutoRetryBanner && typeof currentState.showAutoRetryBanner === 'function') {
          currentState.showAutoRetryBanner('File editing is disabled during auto-retry process', 'info');
        }
        return;
      }

      set((state) => {
        const currentFile = state.ui.sidePane.activeFile;
        const currentContent = currentFile ? state.generatedFiles[currentFile] : '';
        
        state.isEditable = !state.isEditable;
        state.editContent = state.isEditable ? currentContent : null;
        state.isDirty = false;
        
        state.ui.sidePane.isEditable = state.isEditable;
        state.ui.sidePane.editContent = state.editContent;
        state.ui.sidePane.isDirty = false;
        state.ui.sidePane.contentUpdateSource = state.isEditable ? 'user' : null;
        
        state.ui.isUserEditing = false;
        state.ui.lastUserContentHash = null;

        log('USER_INTERACTION', '✏️ [EDIT MODE] Edit mode toggled:', {
          isEditable: state.isEditable,
          currentFile
        });
      });
    }),

    updateFileContent: createBoundFunction('updateFileContent', (content: string, source: 'user' | 'streaming' | 'external' = 'external') => {
      log('STREAMING_STATE', '📝 [CONTENT UPDATE] Updating file content:', {
        source,
        contentLength: content.length,
        isStreaming: source === 'streaming'
      });

      set((state) => {
        const currentFile = state.ui.sidePane.activeFile;
        if (currentFile && state.isEditable) {
          state.editContent = content;
          
          // 🆕 SMART DIRTY FLAG MANAGEMENT: Only set dirty for user changes
          if (source === 'user') {
            state.isDirty = content !== state.generatedFiles[currentFile];
            state.ui.sidePane.isDirty = state.isDirty;
            
            // Use TextEncoder to handle Unicode characters properly
            const encoder = new TextEncoder();
            const bytes = encoder.encode(content);
            const hash = Array.from(bytes.slice(0, 16))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('')
              .slice(0, 16);
            state.ui.lastUserContentHash = hash;

            log('USER_INTERACTION', '✏️ [USER EDIT] User content update:', {
              currentFile,
              contentLength: content.length,
              hash: hash.substring(0, 8) + '...'
            });
          } else if (source === 'streaming') {
            // 🆕 STREAMING CONTENT: Don't set dirty, but track streaming state
            state.isDirty = false;
            state.ui.sidePane.isDirty = false;
            state.ui.sidePane.isStreamingToActiveFile = true;
            state.ui.sidePane.streamingSource = 'update_streaming';
            
            log('STREAMING_STATE', '🌊 [STREAMING UPDATE] Streaming content update:', {
              currentFile,
              contentLength: content.length
            });
          } else {
            // External updates (like file loading) - don't set dirty
            state.isDirty = false;
            state.ui.sidePane.isDirty = false;
          }
          
          state.ui.sidePane.editContent = content;
          state.ui.contentUpdateSource = source;
          state.ui.sidePane.contentUpdateSource = source;
          state.ui.isUserEditing = source === 'user';
        }
      });
    }),

    // 🔧 RESTORED: File operations now delegate to ProjectFilesSlice like the old version
    saveCurrentFile: createBoundFunction('saveCurrentFile', async (): Promise<boolean> => {
      log('USER_INTERACTION', '💾 [SAVE FILE] Starting save current file operation (delegating to ProjectFilesSlice)');
      
      const state = get();
      const currentFile = state.ui.sidePane.activeFile;
      const editContent = state.editContent || state.ui.sidePane.editContent;
      const activeProject = state.activeProject;
      
      if (!currentFile || !editContent || !activeProject) {
        log('USER_INTERACTION', '❌ [SAVE FILE] Missing required data:', {
          currentFile,
          hasEditContent: !!editContent,
          activeProject
        });
        return false;
      }

      try {
        // Set pending save state
        set((state) => {
          state.pendingSave = true;
          state.ui.sidePane.pendingSave = true;
        });

        // 🔧 RESTORED: Delegate to ProjectFilesSlice saveIndividualFile method
        log('USER_INTERACTION', '📡 [SAVE FILE] Delegating to ProjectFilesSlice.saveIndividualFile');
        
        const result = await state.saveIndividualFile(activeProject, currentFile, editContent);

        if (result) {
          log('USER_INTERACTION', '✅ [SAVE FILE] File saved successfully via ProjectFilesSlice');
          
          // 🔥 NEW: Capture old content for change detection
          const oldContent = state.generatedFiles[currentFile] || '';
          
          // Update state after successful save
          set((state) => {
            // Update the generatedFiles with new content
            state.generatedFiles[currentFile] = editContent;
            
            // Update project-specific files if they exist
            if (state.projectGeneratedFiles && state.projectGeneratedFiles[activeProject]) {
              state.projectGeneratedFiles[activeProject][currentFile] = editContent;
            }
            
            // Clear dirty state
            state.isDirty = false;
            state.ui.sidePane.isDirty = false;
            state.pendingSave = false;
            state.ui.sidePane.pendingSave = false;
            
            // Clear content update source since save is complete
            state.ui.contentUpdateSource = null;
            state.ui.sidePane.contentUpdateSource = null;
            
            log('USER_INTERACTION', '🔄 [SAVE FILE] State updated after successful save');
          });

          // 🔧 CRITICAL: Trigger tab groups update after saving
          try {
            if (state.updateTabGroups && typeof state.updateTabGroups === 'function') {
              state.updateTabGroups();
            }
          } catch (error) {
            log('USER_INTERACTION', '⚠️ [SAVE FILE] Error updating tab groups:', error);
          }

          // 🔥 NEW: Trigger hot reload if applicable (async, don't block)
          if (oldContent !== editContent) {
            setTimeout(async () => {
              try {
                const { changeDetectionService } = await import('../../services/ChangeDetectionService');
                const { hotReloadService } = await import('../../services/HotReloadService');
                
                const analysis = changeDetectionService.analyzeChanges(
                  { [currentFile]: oldContent },
                  { [currentFile]: editContent }
                );
                
                if (analysis.strategy === 'preview-update' || analysis.strategy === 'hot-reload') {
                  console.log('[HotReload] 🔥 Triggering hot reload after file save:', {
                    fileName: currentFile,
                    strategy: analysis.strategy
                  });
                  
                  // Get all project files for preview session
                  const updatedState = get() as any;
                  const canisterFiles = updatedState.projectFiles?.[activeProject] || {};
                  const projectGenFiles = updatedState.projectGeneratedFiles?.[activeProject] || {};
                  const currentGenFiles = updatedState.generatedFiles || {};
                  
                  // Combine all files with proper precedence (current > generated > canister)
                  const allProjectFiles = {
                    ...canisterFiles,
                    ...projectGenFiles,
                    ...currentGenFiles
                  };
                  
                  // Extract package.json if available
                  let packageJson: any = null;
                  for (const [fileName, content] of Object.entries(allProjectFiles)) {
                    if (fileName.includes('package.json')) {
                      try {
                        packageJson = JSON.parse(typeof content === 'string' ? content : String(content));
                        break;
                      } catch {
                        // Not valid JSON, continue
                      }
                    }
                  }
                  
                  // Get project name for path normalization
                  const projectName = (() => {
                    try {
                      const state = get() as any;
                      const projects = state.projects;
                      if (!projects || !activeProject) return null;
                      const project = Array.isArray(projects) 
                        ? projects.find((p: any) => p.id === activeProject)
                        : projects[activeProject];
                      return project?.name || project?.title || null;
                    } catch {
                      return null;
                    }
                  })();
                  
                  // Normalize file paths for preview (remove project name prefix to match server expectations)
                  const { normalizeFilePathForPreview } = await import('../../services/HotReloadService');
                  const filesArray = Object.entries(allProjectFiles).map(([name, content]) => ({
                    name: normalizeFilePathForPreview(name, projectName),
                    content: typeof content === 'string' ? content : String(content)
                  }));
                  
                  // 🔥 CRITICAL: Ensure package.json is included in files array
                  // The server needs the actual file, not just the parsed object
                  const hasPackageJsonFile = filesArray.some(f => 
                    f.name === 'package.json' || 
                    f.name === 'src/frontend/package.json' ||
                    f.name.endsWith('/package.json')
                  );
                  
                  if (!hasPackageJsonFile && packageJson) {
                    // Determine the correct path for package.json (usually src/frontend/package.json for icpstudio)
                    const packageJsonPath = filesArray.some(f => f.name.startsWith('src/frontend/'))
                      ? 'src/frontend/package.json'
                      : 'package.json';
                    
                    filesArray.push({
                      name: packageJsonPath,
                      content: JSON.stringify(packageJson, null, 2)
                    });
                    console.log(`[HotReload] ✅ Added package.json to files array at: ${packageJsonPath}`);
                  }
                  
                  // 🔥 CRITICAL: Generate vite.config.js if not present (like deployment does)
                  // This ensures PostCSS/Tailwind are properly configured
                  const hasViteConfig = filesArray.some(f => f.name.includes('vite.config'));
                  if (!hasViteConfig) {
                    console.log('[HotReload] 🔧 Generating vite.config.js for preview session (like deployment)...');
                    
                    // Try to get backend canister ID from server pairs (optional - preview works without it)
                    let backendCanisterId: string | undefined = undefined;
                    try {
                      const state = get() as any;
                      if (state.userCanisterId && state.identity && activeProject) {
                        const { userCanisterService } = await import('../../services/UserCanisterService');
                        const userActor = await userCanisterService.getUserActor(state.userCanisterId, state.identity);
                        const serverPairsResult = await userActor.getProjectServerPairs(activeProject);
                        
                        if (serverPairsResult && 'ok' in serverPairsResult && Array.isArray(serverPairsResult.ok) && serverPairsResult.ok.length > 0) {
                          // Get selected server pair or use first one
                          const selectedPairId = state.getProjectServerPair?.(activeProject);
                          const pair = selectedPairId 
                            ? serverPairsResult.ok.find((p: any) => p.pairId === selectedPairId)
                            : serverPairsResult.ok[0];
                          
                          if (pair && pair.backendCanisterId) {
                            backendCanisterId = typeof pair.backendCanisterId === 'string' 
                              ? pair.backendCanisterId 
                              : pair.backendCanisterId.toText();
                            console.log(`[HotReload] ✅ Found backend canister ID for vite config: ${backendCanisterId}`);
                          }
                        }
                      }
                    } catch (error) {
                      console.warn('[HotReload] ⚠️ Could not get backend canister ID (preview will work without it):', error);
                    }
                    
                    // Generate vite.config.js using the same function as deployment
                    const { generateViteConfigForPreview } = await import('../../services/HotReloadService');
                    const viteConfigContent = generateViteConfigForPreview(backendCanisterId);
                    
                    // Determine correct path for vite.config (src/frontend/vite.config.js for icpstudio)
                    const viteConfigPath = filesArray.some(f => f.name.startsWith('src/frontend/'))
                      ? 'src/frontend/vite.config.js'
                      : 'vite.config.js';
                    
                    filesArray.push({
                      name: viteConfigPath,
                      content: viteConfigContent
                    });
                    
                    console.log(`[HotReload] ✅ Generated and added vite.config.js at: ${viteConfigPath}`, {
                      hasBackendCanisterId: !!backendCanisterId,
                      backendCanisterId: backendCanisterId || 'none'
                    });
                  }
                  
                  console.log('[HotReload] 📋 Normalized files for preview session:', {
                    totalFiles: filesArray.length,
                    samplePaths: filesArray.slice(0, 5).map(f => f.name),
                    projectName,
                    hasPackageJson: hasPackageJsonFile || !!packageJson,
                    packageJsonPath: filesArray.find(f => f.name.includes('package.json'))?.name || 'not found',
                    viteConfig: filesArray.find(f => f.name.includes('vite.config'))?.name || 'not found'
                  });
                  
                  // Create or update preview session
                  await hotReloadService.createPreviewSession(activeProject, filesArray, packageJson);
                  
                  // Update preview if needed
                  if (analysis.strategy === 'preview-update' && analysis.changes.length > 0) {
                    await hotReloadService.updatePreviewFiles(
                      activeProject,
                      analysis.changes.map(c => ({
                        fileName: c.fileName,
                        content: c.newContent
                      }))
                    );
                    
                    console.log('[HotReload] ✅ Preview updated after file save');
                  }
                } else {
                  console.log('[HotReload] ⏭️ Skipping hot reload - requires full deployment:', analysis.strategy);
                }
              } catch (error) {
                console.error('[HotReload] ❌ Failed to trigger hot reload after file save:', error);
                // Don't throw - hot reload is optional
              }
            }, 100);
          }

          return true;
          
        } else {
          throw new Error('ProjectFilesSlice.saveIndividualFile returned false');
        }

      } catch (error) {
        log('USER_INTERACTION', '❌ [SAVE FILE] Save failed:', error);
        
        // Clear pending save state on error
        set((state) => {
          state.pendingSave = false;
          state.ui.sidePane.pendingSave = false;
        });

        return false;
      }
    }),

    // 🔧 RESTORED: Create file delegated to ProjectFilesSlice
    createNewFile: createBoundFunction('createNewFile', async (fileName: string, content: string = ''): Promise<boolean> => {
      log('USER_INTERACTION', '📄 [CREATE FILE] Starting create new file operation (delegating to ProjectFilesSlice):', fileName);
      
      const state = get();
      const activeProject = state.activeProject;
      
      if (!activeProject) {
        log('USER_INTERACTION', '❌ [CREATE FILE] No active project');
        return false;
      }

      try {
        // 🔧 RESTORED: Delegate to ProjectFilesSlice createIndividualFile method
        log('USER_INTERACTION', '📡 [CREATE FILE] Delegating to ProjectFilesSlice.createIndividualFile');
        
        const result = await state.createIndividualFile(activeProject, fileName, content);

        if (result) {
          log('USER_INTERACTION', '✅ [CREATE FILE] File created successfully via ProjectFilesSlice');
          
          // Update state after successful creation
          set((state) => {
            // Add to generatedFiles
            state.generatedFiles[fileName] = content;
            
            // Add to project-specific files
            if (!state.projectGeneratedFiles[activeProject]) {
              state.projectGeneratedFiles[activeProject] = {};
            }
            state.projectGeneratedFiles[activeProject][fileName] = content;
            
            // Set file generation state
            if (!state.projectFileGenerationStates[activeProject]) {
              state.projectFileGenerationStates[activeProject] = {};
            }
            state.projectFileGenerationStates[activeProject][fileName] = 'complete';
            
            // Update current state
            state.fileGenerationStates = { ...state.projectFileGenerationStates[activeProject] };
            
            log('USER_INTERACTION', '🔄 [CREATE FILE] State updated after successful creation');
          });

          // 🔧 CRITICAL: Update tab groups after creating file
          try {
            if (state.updateTabGroups && typeof state.updateTabGroups === 'function') {
              state.updateTabGroups();
            }
          } catch (error) {
            log('USER_INTERACTION', '⚠️ [CREATE FILE] Error updating tab groups:', error);
          }

          // Open the newly created file in side pane
          if (state.toggleSidePane && typeof state.toggleSidePane === 'function') {
            state.toggleSidePane(fileName);
          }

          return true;
          
        } else {
          throw new Error('ProjectFilesSlice.createIndividualFile returned false');
        }

      } catch (error) {
        log('USER_INTERACTION', '❌ [CREATE FILE] Create failed:', error);
        return false;
      }
    }),

    // 🔧 RESTORED: Delete file delegated to ProjectFilesSlice
    deleteCurrentFile: createBoundFunction('deleteCurrentFile', async (): Promise<boolean> => {
      log('USER_INTERACTION', '🗑️ [DELETE FILE] Starting delete current file operation (delegating to ProjectFilesSlice)');
      
      const state = get();
      const currentFile = state.ui.sidePane.activeFile;
      const activeProject = state.activeProject;
      
      if (!currentFile || !activeProject) {
        log('USER_INTERACTION', '❌ [DELETE FILE] Missing required data:', {
          currentFile,
          activeProject
        });
        return false;
      }

      try {
        // 🔧 RESTORED: Delegate to ProjectFilesSlice deleteIndividualFile method
        log('USER_INTERACTION', '📡 [DELETE FILE] Delegating to ProjectFilesSlice.deleteIndividualFile');
        
        const result = await state.deleteIndividualFile(activeProject, currentFile);

        if (result) {
          log('USER_INTERACTION', '✅ [DELETE FILE] File deleted successfully via ProjectFilesSlice');
          
          // Update state after successful deletion
          set((state) => {
            // Remove from generatedFiles
            delete state.generatedFiles[currentFile];
            
            // Remove from project-specific files
            if (state.projectGeneratedFiles[activeProject]) {
              delete state.projectGeneratedFiles[activeProject][currentFile];
            }
            
            // Remove from file generation states
            if (state.projectFileGenerationStates[activeProject]) {
              delete state.projectFileGenerationStates[activeProject][currentFile];
            }
            
            // Update current file generation states
            state.fileGenerationStates = { ...state.projectFileGenerationStates[activeProject] };
            
            // Close side pane since file is deleted
            state.ui.sidePane.isOpen = false;
            state.ui.sidePane.activeFile = null;
            state.isEditable = false;
            state.isDirty = false;
            state.editContent = null;
            state.ui.sidePane.isEditable = false;
            state.ui.sidePane.isDirty = false;
            state.ui.sidePane.editContent = null;
            
            log('USER_INTERACTION', '🔄 [DELETE FILE] State updated after successful deletion');
          });

          // 🔧 CRITICAL: Update tab groups after deletion
          try {
            if (state.updateTabGroups && typeof state.updateTabGroups === 'function') {
              state.updateTabGroups();
            }
          } catch (error) {
            log('USER_INTERACTION', '⚠️ [DELETE FILE] Error updating tab groups:', error);
          }

          return true;
          
        } else {
          throw new Error('ProjectFilesSlice.deleteIndividualFile returned false');
        }

      } catch (error) {
        log('USER_INTERACTION', '❌ [DELETE FILE] Delete failed:', error);
        return false;
      }
    }),

    // 🔧 RESTORED: Rename file delegated to ProjectFilesSlice
    renameCurrentFile: createBoundFunction('renameCurrentFile', async (newFileName: string): Promise<boolean> => {
      log('USER_INTERACTION', '📝 [RENAME FILE] Starting rename file operation (delegating to ProjectFilesSlice):', newFileName);
      
      const state = get();
      const currentFile = state.ui.sidePane.activeFile;
      const activeProject = state.activeProject;
      
      if (!currentFile || !activeProject || !newFileName) {
        log('USER_INTERACTION', '❌ [RENAME FILE] Missing required data:', {
          currentFile,
          activeProject,
          newFileName
        });
        return false;
      }

      try {
        // 🔧 RESTORED: Delegate to ProjectFilesSlice renameIndividualFile method
        log('USER_INTERACTION', '📡 [RENAME FILE] Delegating to ProjectFilesSlice.renameIndividualFile');
        
        const result = await state.renameIndividualFile(activeProject, currentFile, newFileName);

        if (result) {
          log('USER_INTERACTION', '✅ [RENAME FILE] File renamed successfully via ProjectFilesSlice');
          
          // Get current content to preserve it
          const currentContent = state.generatedFiles[currentFile] || state.editContent || '';
          
          // Update state after successful rename
          set((state) => {
            // Remove old file from generatedFiles
            delete state.generatedFiles[currentFile];
            // Add new file to generatedFiles
            state.generatedFiles[newFileName] = currentContent;
            
            // Update project-specific files
            if (state.projectGeneratedFiles[activeProject]) {
              delete state.projectGeneratedFiles[activeProject][currentFile];
              state.projectGeneratedFiles[activeProject][newFileName] = currentContent;
            }
            
            // Update file generation states
            if (state.projectFileGenerationStates[activeProject]) {
              delete state.projectFileGenerationStates[activeProject][currentFile];
              state.projectFileGenerationStates[activeProject][newFileName] = 'complete';
            }
            
            // Update current file generation states
            state.fileGenerationStates = { ...state.projectFileGenerationStates[activeProject] };
            
            // Update side pane to show new file
            state.ui.sidePane.activeFile = newFileName;
            
            log('USER_INTERACTION', '🔄 [RENAME FILE] State updated after successful rename');
          });

          // 🔧 CRITICAL: Update tab groups after rename
          try {
            if (state.updateTabGroups && typeof state.updateTabGroups === 'function') {
              state.updateTabGroups();
            }
          } catch (error) {
            log('USER_INTERACTION', '⚠️ [RENAME FILE] Error updating tab groups:', error);
          }

          return true;
          
        } else {
          throw new Error('ProjectFilesSlice.renameIndividualFile returned false');
        }
        
      } catch (error) {
        log('USER_INTERACTION', '❌ [RENAME FILE] Rename failed:', error);
        return false;
      }
    }),

    // 🆕 ENHANCED: Set streaming state for active file with proper coordination
    setStreamingToActiveFile: createBoundFunction('setStreamingToActiveFile', (isStreaming: boolean, source?: 'project_generation' | 'update_streaming' | 'file_application') => {
      log('STREAMING_STATE', '🌊 [STREAMING STATE] Setting streaming state with enhanced coordination:', {
        isStreaming,
        source
      });

      set((state) => {
        state.ui.sidePane.isStreamingToActiveFile = isStreaming;
        state.ui.sidePane.streamingSource = isStreaming ? source || null : null;
        
        // If streaming ends, clear streaming-related states
        if (!isStreaming) {
          if (state.ui.sidePane.contentUpdateSource === 'streaming') {
            state.ui.sidePane.contentUpdateSource = null;
          }
        }
        
        log('STREAMING_STATE', '✅ [STREAMING STATE] Streaming state updated successfully:', {
          isStreamingToActiveFile: state.ui.sidePane.isStreamingToActiveFile,
          streamingSource: state.ui.sidePane.streamingSource
        });
      });
    }),

    // 🆕 ENHANCED: Check if current content update is from streaming
    isStreamingContentUpdate: createBoundFunction('isStreamingContentUpdate', (): boolean => {
      const state = get();
      const isStreaming = state.ui.sidePane.isStreamingToActiveFile || 
                         state.ui.sidePane.contentUpdateSource === 'streaming' ||
                         state.ui.contentUpdateSource === 'streaming';
      
      log('STREAMING_STATE', '🔍 [STREAMING CHECK] Checking if content is from streaming:', {
        isStreamingToActiveFile: state.ui.sidePane.isStreamingToActiveFile,
        sidePaneContentSource: state.ui.sidePane.contentUpdateSource,
        globalContentSource: state.ui.contentUpdateSource,
        result: isStreaming
      });
      
      return isStreaming;
    }),

    // 🚀 CRITICAL FIX: ARCHITECTURAL ALIGNMENT - Comprehensive streaming-aware close behavior
    shouldAllowSidePaneClose: createBoundFunction('shouldAllowSidePaneClose', (): boolean => {
      const state = get();
      
      log('STREAMING_STATE', '🎯 [ARCHITECTURAL ALIGNMENT] Enhanced close check with streaming awareness:', {
        isDirty: state.ui.sidePane.isDirty,
        contentUpdateSource: state.ui.sidePane.contentUpdateSource,
        isStreamingToActiveFile: state.ui.sidePane.isStreamingToActiveFile,
        streamingSource: state.ui.sidePane.streamingSource
      });
      
      // Always allow close if not dirty
      if (!state.ui.sidePane.isDirty) {
        log('STREAMING_STATE', '✅ [ARCHITECTURAL ALIGNMENT] Allow close - not dirty');
        return true;
      }
      
      // Allow close if dirty state is from streaming/external, not user
      if (state.ui.sidePane.contentUpdateSource !== 'user') {
        log('STREAMING_STATE', '✅ [ARCHITECTURAL ALIGNMENT] Allow close - dirty from streaming/external:', {
          contentUpdateSource: state.ui.sidePane.contentUpdateSource,
          isDirty: state.ui.sidePane.isDirty,
          isStreamingToActiveFile: state.ui.sidePane.isStreamingToActiveFile
        });
        return true;
      }
      
      // 🚀 CRITICAL FIX: Even if user has changes, check if we're in a MessageCoordinator-controlled streaming session
      // This aligns with project generation behavior where MessageCoordinator has exclusive control
      const isInStreamingSession = state.ui.sidePane.isStreamingToActiveFile && 
                                   (state.ui.sidePane.streamingSource === 'update_streaming' || 
                                    state.ui.sidePane.streamingSource === 'project_generation');
      
      if (isInStreamingSession) {
        log('STREAMING_STATE', '✅ [ARCHITECTURAL ALIGNMENT] Allow close - MessageCoordinator streaming session active (like project generation):', {
          streamingSource: state.ui.sidePane.streamingSource,
          isStreamingToActiveFile: state.ui.sidePane.isStreamingToActiveFile
        });
        return true;
      }
      
      // Block close only if user has genuine unsaved changes outside of streaming
      log('STREAMING_STATE', '🚫 [ARCHITECTURAL ALIGNMENT] Block close - user has genuine unsaved changes:', {
        contentUpdateSource: state.ui.sidePane.contentUpdateSource,
        isDirty: state.ui.sidePane.isDirty,
        isInStreamingSession
      });
      return false;
    }),

    setFileDirty: createBoundFunction('setFileDirty', (isDirty: boolean, source?: 'user' | 'streaming' | 'external') => {
      log('STREAMING_STATE', '🏷️ [DIRTY FLAG] Setting dirty flag with source awareness:', { isDirty, source });
      
      set((state) => {
        // 🆕 CONTEXT-AWARE DIRTY SETTING: Only set dirty for user changes
        if (source === 'user' || (!source && state.ui.sidePane.contentUpdateSource === 'user')) {
          state.isDirty = isDirty;
          state.ui.sidePane.isDirty = isDirty;
          log('STREAMING_STATE', '✅ [DIRTY FLAG] Set dirty flag for user changes');
        } else {
          // For streaming/external sources, don't set dirty flag
          log('STREAMING_STATE', '⏭️ [DIRTY FLAG] Skipped dirty flag for non-user changes:', {
            source,
            currentSource: state.ui.sidePane.contentUpdateSource
          });
        }
      });
    }),

    setUserEditingState: createBoundFunction('setUserEditingState', (isEditing: boolean) => {
      set((state) => {
        state.ui.isUserEditing = isEditing;
        if (!isEditing) {
          state.ui.contentUpdateSource = null;
        }
      });
    }),

    clearContentUpdateSource: createBoundFunction('clearContentUpdateSource', () => {
      log('STREAMING_STATE', '🧹 [CLEAR SOURCE] Clearing all content update sources');
      
      set((state) => {
        state.ui.contentUpdateSource = null;
        state.ui.isUserEditing = false;
        state.ui.sidePane.contentUpdateSource = null;
        state.ui.sidePane.isStreamingToActiveFile = false;
        state.ui.sidePane.streamingSource = null;
      });
    }),

    isContentFromUser: createBoundFunction('isContentFromUser', (): boolean => {
      const state = get();
      return state.ui.contentUpdateSource === 'user' || 
             state.ui.isUserEditing ||
             state.ui.sidePane.contentUpdateSource === 'user';
    }),

    // ENHANCED: Start automation mode with comprehensive state management
    startAutomationMode: createBoundFunction('startAutomationMode', (workflowId: string, phase: string) => {
      log('UI_AUTOMATION', '🤖 [START AUTOMATION] Starting automation mode:', { workflowId, phase });

      set((state) => {
        const now = Date.now();
        
        // Update global automation state
        state.ui.automationState = {
          isActive: true,
          workflowId,
          phase: phase as any,
          status: `Starting ${phase.toLowerCase()}...`,
          startTime: now,
          lastUpdate: now,
          executionCount: 0,
          maxExecutions: 3,
          blockUserInteractions: true,
          showVisualIndicators: true
        };

        // Update sidebar automation state
        state.ui.sidebar.isAutomationActive = true;
        state.ui.sidebar.automationStatus = `Auto-retry in progress`;

        // Update SidePane automation state
        state.ui.sidePane.isAutomationMode = true;
        state.ui.sidePane.automationWorkflowId = workflowId;
        state.ui.sidePane.interactionBlocked = true;
        state.ui.sidePane.blockingReason = 'Auto-retry workflow in progress';

        // Show visual feedback
        state.ui.autoRetryVisualState = {
          showBanner: true,
          bannerMessage: '🤖 Auto-retry system activated - automatically fixing deployment errors',
          bannerType: 'info',
          showProgressIndicator: true,
          progressPercent: 0,
          progressMessage: 'Initializing auto-retry workflow...',
          showWorkflowIcon: true,
          workflowIconState: 'spinning'
        };
      });

      // Auto-hide banner after delay
      setTimeout(() => {
        const currentState = get();
        if (currentState.ui && currentState.ui.automationState && currentState.ui.automationState.workflowId === workflowId) {
          if (currentState.hideAutoRetryBanner && typeof currentState.hideAutoRetryBanner === 'function') {
            currentState.hideAutoRetryBanner();
          }
        }
      }, BANNER_AUTO_HIDE_DELAY);
    }),

    // ENHANCED: Stop automation mode with comprehensive cleanup
    stopAutomationMode: createBoundFunction('stopAutomationMode', (reason?: string) => {
      const currentState = get();
      const workflowId = currentState.ui.automationState.workflowId;
      
      log('UI_AUTOMATION', '🛑 [STOP AUTOMATION] Stopping automation mode:', { workflowId, reason });

      set((state) => {
        // Clean up global automation state
        state.ui.automationState = {
          isActive: false,
          workflowId: null,
          phase: null,
          status: '',
          startTime: null,
          lastUpdate: null,
          executionCount: 0,
          maxExecutions: 3,
          blockUserInteractions: false,
          showVisualIndicators: false
        };

        // Clean up sidebar automation state
        state.ui.sidebar.isAutomationActive = false;
        state.ui.sidebar.automationStatus = null;

        // Clean up SidePane automation state
        state.ui.sidePane.isAutomationMode = false;
        state.ui.sidePane.automationWorkflowId = null;
        state.ui.sidePane.interactionBlocked = false;
        state.ui.sidePane.blockingReason = null;

        // Clean up visual feedback
        state.ui.autoRetryVisualState = {
          showBanner: false,
          bannerMessage: '',
          bannerType: 'info',
          showProgressIndicator: false,
          progressPercent: 0,
          progressMessage: '',
          showWorkflowIcon: false,
          workflowIconState: 'idle'
        };
      });

      // Show completion message if successful
      if (reason === 'success') {
        const showAutoRetryBanner = get().showAutoRetryBanner;
        const hideAutoRetryBanner = get().hideAutoRetryBanner;
        if (showAutoRetryBanner && typeof showAutoRetryBanner === 'function') {
          showAutoRetryBanner('✅ Auto-retry completed successfully!', 'success');
          if (hideAutoRetryBanner && typeof hideAutoRetryBanner === 'function') {
            setTimeout(() => hideAutoRetryBanner(), 3000);
          }
        }
      } else if (reason === 'failed') {
        const showAutoRetryBanner = get().showAutoRetryBanner;
        const hideAutoRetryBanner = get().hideAutoRetryBanner;
        if (showAutoRetryBanner && typeof showAutoRetryBanner === 'function') {
          showAutoRetryBanner('❌ Auto-retry failed - manual intervention may be required', 'error');
          if (hideAutoRetryBanner && typeof hideAutoRetryBanner === 'function') {
            setTimeout(() => hideAutoRetryBanner(), 5000);
          }
        }
      }
    }),

    // ENHANCED: Update automation status with progress tracking
    updateAutomationStatus: createBoundFunction('updateAutomationStatus', (phase: string, status: string, executionCount?: number) => {
      const currentState = get();
      if (!currentState.ui.automationState.isActive) return;

      log('UI_AUTOMATION', '📊 [UPDATE STATUS] Automation status update:', { phase, status, executionCount });

      set((state) => {
        state.ui.automationState.phase = phase as any;
        state.ui.automationState.status = status;
        state.ui.automationState.lastUpdate = Date.now();
        
        if (executionCount !== undefined) {
          state.ui.automationState.executionCount = executionCount;
        }

        // Update sidebar status
        const attemptText = executionCount && executionCount > 0 
          ? ` (attempt ${executionCount}/${state.ui.automationState.maxExecutions})`
          : '';
        state.ui.sidebar.automationStatus = `${status}${attemptText}`;

        // Update progress message
        state.ui.autoRetryVisualState.progressMessage = status;

        // Update progress percentage based on phase
        let progressPercent = 0;
        switch (phase) {
          case 'FILE_GENERATION': progressPercent = 25; break;
          case 'FILE_APPLICATION': progressPercent = 50; break;
          case 'DEPLOYMENT': progressPercent = 75; break;
          case 'COMPLETED': progressPercent = 100; break;
          default: progressPercent = 10; break;
        }
        state.ui.autoRetryVisualState.progressPercent = progressPercent;
      });
    }),

    // ENHANCED: Block user interactions with detailed reason
    blockUserInteractions: createBoundFunction('blockUserInteractions', (reason: string, workflowId: string) => {
      log('USER_INTERACTION', '🚫 [BLOCK] Blocking user interactions:', { reason, workflowId });

      set((state) => {
        state.ui.automationState.blockUserInteractions = true;
        state.ui.sidePane.interactionBlocked = true;
        state.ui.sidePane.blockingReason = reason;
      });
    }),

    // ENHANCED: Unblock user interactions
    unblockUserInteractions: createBoundFunction('unblockUserInteractions', () => {
      log('USER_INTERACTION', '✅ [UNBLOCK] Unblocking user interactions');

      set((state) => {
        state.ui.automationState.blockUserInteractions = false;
        state.ui.sidePane.interactionBlocked = false;
        state.ui.sidePane.blockingReason = null;
      });
    }),

    // ENHANCED: Check if user interactions are blocked
    isUserInteractionBlocked: createBoundFunction('isUserInteractionBlocked', (): boolean => {
      const state = get();
      return state.ui.automationState.blockUserInteractions || state.ui.sidePane.interactionBlocked;
    }),

    // ENHANCED: Show auto-retry banner with type-specific styling
    showAutoRetryBanner: createBoundFunction('showAutoRetryBanner', (message: string, type: 'info' | 'progress' | 'success' | 'error') => {
      log('VISUAL_FEEDBACK', '📢 [BANNER] Showing auto-retry banner:', { message, type });

      set((state) => {
        state.ui.autoRetryVisualState.showBanner = true;
        state.ui.autoRetryVisualState.bannerMessage = message;
        state.ui.autoRetryVisualState.bannerType = type;
      });
    }),

    // ENHANCED: Hide auto-retry banner
    hideAutoRetryBanner: createBoundFunction('hideAutoRetryBanner', () => {
      set((state) => {
        state.ui.autoRetryVisualState.showBanner = false;
        state.ui.autoRetryVisualState.bannerMessage = '';
      });
    }),

    // ENHANCED: Update auto-retry progress with throttling
    updateAutoRetryProgress: createBoundFunction('updateAutoRetryProgress', (percent: number, message: string) => {
      const currentState = get();
      const now = Date.now();
      
      // Throttle progress updates
      const lastUpdate = currentState.ui.automationState.lastUpdate || 0;
      if (now - lastUpdate < PROGRESS_UPDATE_THROTTLE) return;

      log('VISUAL_FEEDBACK', '📊 [PROGRESS] Progress update:', { percent, message });

      set((state) => {
        state.ui.autoRetryVisualState.progressPercent = Math.max(0, Math.min(100, percent));
        state.ui.autoRetryVisualState.progressMessage = message;
        state.ui.automationState.lastUpdate = now;
      });
    }),

    // ENHANCED: Set workflow icon state with transition handling
    setWorkflowIconState: createBoundFunction('setWorkflowIconState', (iconState: 'idle' | 'spinning' | 'success' | 'error') => {
      log('VISUAL_FEEDBACK', '🎭 [ICON] Setting workflow icon state:', iconState);

      set((state) => {
        state.ui.autoRetryVisualState.workflowIconState = iconState;
        state.ui.autoRetryVisualState.showWorkflowIcon = iconState !== 'idle';
      });

      // Auto-reset success/error states
      if (iconState === 'success' || iconState === 'error') {
        setTimeout(() => {
          const currentState = get();
          if (currentState.ui.autoRetryVisualState.workflowIconState === iconState) {
            const setWorkflowIconState = currentState.setWorkflowIconState;
            if (setWorkflowIconState && typeof setWorkflowIconState === 'function') {
              setWorkflowIconState('idle');
            }
          }
        }, 3000);
      }
    }),

    // 🚀 CRITICAL FIX: ARCHITECTURAL ALIGNMENT - Enhanced action prevention with streaming awareness
    shouldPreventUserAction: createBoundFunction('shouldPreventUserAction', (action: string): boolean => {
      const state = get();
      
      // 🆕 ARCHITECTURAL ALIGNMENT: Always allow certain actions during streaming (like project generation)
      if (STREAMING_ALLOWED_ACTIONS.includes(action)) {
        const isStreaming = state.ui.sidePane.isStreamingToActiveFile;
        const isCodeUpdateStreaming = state.ui.sidePane.streamingSource === 'update_streaming';
        
        if (isStreaming || isCodeUpdateStreaming) {
          log('USER_INTERACTION', '✅ [ARCHITECTURAL ALIGNMENT] Action allowed during streaming (like project generation):', {
            action,
            streamingSource: state.ui.sidePane.streamingSource,
            isStreamingToActiveFile: state.ui.sidePane.isStreamingToActiveFile
          });
          return false; // Allow the action
        }
      }
      
      if (!state.ui.automationState.isActive) return false;
      
      const isBlocked = BLOCKED_ACTIONS_DURING_AUTOMATION.includes(action);
      const isAllowed = ALLOWED_ACTIONS_DURING_AUTOMATION.includes(action);
      
      if (isBlocked) {
        log('USER_INTERACTION', '🚫 [PREVENT] Action blocked during automation:', { 
          action, 
          workflowId: state.ui.automationState.workflowId 
        });
        return true;
      }
      
      if (isAllowed) {
        log('USER_INTERACTION', '✅ [ALLOW] Action allowed during automation:', action);
        return false;
      }
      
      // Default to blocking unknown actions during automation
      log('USER_INTERACTION', '⚠️ [DEFAULT BLOCK] Unknown action blocked during automation:', action);
      return state.ui.automationState.blockUserInteractions;
    }),

    // ENHANCED: Get automation status for display
    getAutomationStatusForDisplay: createBoundFunction('getAutomationStatusForDisplay', (): string | null => {
      const state = get();
      
      if (!state.ui.automationState.isActive) return null;
      
      const { phase, status, executionCount, maxExecutions } = state.ui.automationState;
      const attemptText = executionCount > 0 ? ` (${executionCount}/${maxExecutions})` : '';
      
      return `${status}${attemptText}`;
    }),

    // ENHANCED: Reset automation UI state
    resetAutomationUI: createBoundFunction('resetAutomationUI', () => {
      log('STATE_MANAGEMENT', '🔄 [RESET] Resetting automation UI state');

      set((state) => {
        // Reset all automation states to initial values
        state.ui.automationState = {
          isActive: false,
          workflowId: null,
          phase: null,
          status: '',
          startTime: null,
          lastUpdate: null,
          executionCount: 0,
          maxExecutions: 3,
          blockUserInteractions: false,
          showVisualIndicators: false
        };

        state.ui.autoRetryVisualState = {
          showBanner: false,
          bannerMessage: '',
          bannerType: 'info',
          showProgressIndicator: false,
          progressPercent: 0,
          progressMessage: '',
          showWorkflowIcon: false,
          workflowIconState: 'idle'
        };

        state.ui.sidebar.isAutomationActive = false;
        state.ui.sidebar.automationStatus = null;

        state.ui.sidePane.isAutomationMode = false;
        state.ui.sidePane.automationWorkflowId = null;
        state.ui.sidePane.interactionBlocked = false;
        state.ui.sidePane.blockingReason = null;
      });
    }),

    // ENHANCED: Cleanup automation state for specific workflow
    cleanupAutomationState: createBoundFunction('cleanupAutomationState', (workflowId: string) => {
      const currentState = get();
      
      // Only cleanup if the workflow ID matches
      if (currentState.ui.automationState.workflowId === workflowId) {
        log('STATE_MANAGEMENT', '🧹 [CLEANUP] Cleaning up automation state for workflow:', workflowId);
        const resetAutomationUI = currentState.resetAutomationUI;
        if (resetAutomationUI && typeof resetAutomationUI === 'function') {
          resetAutomationUI();
        }
      } else {
        log('STATE_MANAGEMENT', '⚠️ [CLEANUP] Workflow ID mismatch - cleanup skipped:', {
          requestedWorkflowId: workflowId,
          currentWorkflowId: currentState.ui.automationState.workflowId
        });
      }
    })
  };

  // SOLUTION: Final validation of all created functions
  log('FUNCTION_BINDING', '🔍 [UI SLICE] Validating all UI slice functions before return...');
  const functionNames = Object.keys(uiSlice).filter(key => typeof uiSlice[key as keyof UISlice] === 'function');
  functionNames.forEach(name => {
    if (typeof uiSlice[name as keyof UISlice] !== 'function') {
      console.error(`🚨 [FUNCTION_BINDING] CRITICAL: ${name} is not a function!`);
    } else {
      log('FUNCTION_BINDING', `✅ [UI SLICE] Function validated: ${name}`);
    }
  });

  log('FUNCTION_BINDING', '✅ [UI SLICE] All UI slice functions validated successfully');
  return uiSlice;
};