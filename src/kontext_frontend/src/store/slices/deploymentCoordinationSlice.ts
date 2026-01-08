import { StateCreator } from 'zustand';
import { DeploymentContext, DeploymentButtonState, LivePreviewActivationData, DeploymentCompletionContext } from '../../types/deploymentCoordination';
import { autoRetryCoordinator } from '../../services/AutoRetryCoordinator';
import { economyMetricsService } from '../../services/EconomyMetricsService';

export interface MotokoDeploymentError {
  hasErrors: boolean;
  errorSummary: string | null;
  canAutoFix: boolean;
  lastErrorTime: number;
}

export interface DeploymentErrorState {
  [projectId: string]: MotokoDeploymentError;
}

export interface DeploymentCoordinationState {
  activeDeployments: { [messageId: string]: DeploymentContext };
  deploymentStates: { [messageId: string]: DeploymentButtonState };
  isCoordinating: boolean;
  currentDeploymentMessageId: string | null;
  selectedServerPairId: string | null;
  retryAttempts: { [messageId: string]: number };
  maxRetryAttempts: number;
  lastUpdateTime: number;
}

export interface DeploymentCoordinationSliceState {
  deploymentCoordination: DeploymentCoordinationState;
  deploymentErrors: DeploymentErrorState;
}

export interface DeploymentCoordinationSliceActions {
  createDeploymentContext: (messageId: string, projectId: string, projectName: string, generatedFiles: { [fileName: string]: string }) => DeploymentContext;
  getDeploymentContext: (messageId: string) => DeploymentContext | null;
  getDeploymentState: (messageId: string) => DeploymentButtonState;
  updateDeploymentState: (messageId: string, updates: Partial<DeploymentButtonState>) => void;
  startDeployment: (messageId: string, onTabSwitch: (tab: string) => void, onAutoStartDeployment: (context: DeploymentContext) => Promise<void>) => Promise<void>;
  handleDeploymentSuccess: (messageId: string, deployedUrl: string, duration: number, onTabSwitch: (tab: string) => void) => void;
  handleDeploymentError: (messageId: string, error: string, onTabSwitch: (tab: string) => void, onSubmitFixMessage: (fixPrompt: string) => Promise<void>) => Promise<void>;
  setDeploymentSelectedServerPairId: (serverPairId: string | null) => void;
  getDeploymentSelectedServerPairId: () => string | null;
  setDeploymentError: (projectId: string, errorData: { hasErrors: boolean; errorSummary: string | null; canAutoFix: boolean; }) => void;
  clearDeploymentError: (projectId: string) => void;
  getDeploymentError: (projectId: string) => MotokoDeploymentError;
  
  // Live preview integration actions
  handleLivePreviewActivation: (activationData: LivePreviewActivationData) => void;
  findDeploymentByProject: (projectId: string) => { messageId: string; context: DeploymentContext; state: DeploymentButtonState } | null;
  markDeploymentComplete: (messageId: string, deployedUrl: string) => void;
  ensureChatAlwaysEnabled: () => void;
  cleanupStuckDeployments: () => void;
  
  incrementRetryAttempt: (messageId: string) => number;
  resetRetryAttempt: (messageId: string) => void;
  getRetryAttempt: (messageId: string) => number;
  canAutoRetry: (messageId: string) => boolean;
  isInAutoRetryMode: (messageId: string) => boolean;
  getAutoRetryProgress: (messageId: string) => { attempt: number; maxAttempts: number; isRetrying: boolean; elapsedTime?: number };
  
  // Force UI refresh
  forceUIRefresh: () => void;
}

export type DeploymentCoordinationSlice = DeploymentCoordinationSliceState & DeploymentCoordinationSliceActions;

const log = (category: string, message: string, ...args: any[]) => {
  console.log(`🔥 [DEPLOY-${category}] ${message}`, ...args);
};

export const createDeploymentCoordinationSlice: StateCreator<any, [], [], DeploymentCoordinationSlice> = (set, get) => ({
  deploymentCoordination: {
    activeDeployments: {},
    deploymentStates: {},
    isCoordinating: false,
    currentDeploymentMessageId: null,
    selectedServerPairId: null,
    retryAttempts: {},
    maxRetryAttempts: 3,
    lastUpdateTime: Date.now()
  },
  deploymentErrors: {},

  createDeploymentContext: (messageId: string, projectId: string, projectName: string, generatedFiles: { [fileName: string]: string }): DeploymentContext => {
    log('CREATE', '🚀 Creating deployment context for IMMEDIATE AUTO-START:', { 
      messageId, 
      projectId, 
      projectName, 
      fileCount: Object.keys(generatedFiles).length,
      fileNames: Object.keys(generatedFiles).slice(0, 3),
      timestamp: new Date().toISOString()
    });
    
    const context: DeploymentContext = {
      messageId,
      projectId,
      projectName,
      generatedFiles,
      timestamp: Date.now()
    };

    set((state: any) => {
      // 🆕 CRITICAL FIX: Clean up old deployment contexts for this project that are not 'ready'
      // This prevents old 'deploying' or 'error' states from blocking new deployments
      const activeDeployments = { ...state.deploymentCoordination.activeDeployments };
      const deploymentStates = { ...state.deploymentCoordination.deploymentStates };
      
      // Find and remove old contexts for this project that are stuck in non-ready states
      for (const oldMessageId in activeDeployments) {
        const oldContext = activeDeployments[oldMessageId];
        const oldState = deploymentStates[oldMessageId];
        
        if (oldContext.projectId === projectId && 
            oldMessageId !== messageId && 
            oldState && 
            oldState.status !== 'ready' && 
            oldState.status !== 'success') {
          // Remove old stuck deployment contexts
          delete activeDeployments[oldMessageId];
          delete deploymentStates[oldMessageId];
          log('CREATE', '🧹 Cleaned up old deployment context:', {
            oldMessageId: oldMessageId.substring(Math.max(0, oldMessageId.length - 8)),
            oldStatus: oldState.status
          });
        }
      }
      
      state.deploymentCoordination = {
        ...state.deploymentCoordination,
        activeDeployments: {
          ...activeDeployments,
          [messageId]: context
        },
        deploymentStates: {
          ...deploymentStates,
          [messageId]: { 
            status: 'ready',
            // FIXED: Mark as ready for immediate auto-start
            isAutoRetrying: false,
            retryAttempt: 0,
            maxRetryAttempts: 3
          }
        },
        retryAttempts: {
          ...state.deploymentCoordination.retryAttempts,
          [messageId]: 0
        },
        lastUpdateTime: Date.now()
      };
    });

    log('CREATE', '✅ Deployment context created for immediate auto-start');
    return context;
  },

  getDeploymentContext: (messageId: string): DeploymentContext | null => {
    const state = get() as any;
    const result = state.deploymentCoordination.activeDeployments[messageId] || null;
    if (result) {
      log('GET-CONTEXT', 'Found deployment context:', {
        messageId,
        projectId: result.projectId,
        fileCount: Object.keys(result.generatedFiles).length
      });
    }
    return result;
  },

  getDeploymentState: (messageId: string): DeploymentButtonState => {
    const state = get() as any;
    const result = state.deploymentCoordination.deploymentStates[messageId] || { status: 'ready' };
    return result;
  },

  updateDeploymentState: (messageId: string, updates: Partial<DeploymentButtonState>) => {
    log('UPDATE', 'Updating deployment state:', { messageId, updates });
    
    set((state: any) => {
      const currentState = state.deploymentCoordination.deploymentStates[messageId] || { status: 'ready' };
      const updatedState = { 
        ...currentState, 
        ...updates,
        retryAttempt: state.deploymentCoordination.retryAttempts[messageId] || 0,
        maxRetryAttempts: state.deploymentCoordination.maxRetryAttempts
      };
      
      state.deploymentCoordination = {
        ...state.deploymentCoordination,
        deploymentStates: {
          ...state.deploymentCoordination.deploymentStates,
          [messageId]: updatedState
        },
        lastUpdateTime: Date.now()
      };
    });
    
    setTimeout(() => {
      (get() as any).forceUIRefresh();
    }, 10);
  },

  // FIXED: Enhanced startDeployment - Triggers immediate auto-deployment
  startDeployment: async (messageId: string, onTabSwitch: (tab: string) => void, onAutoStartDeployment: (context: DeploymentContext) => Promise<void>): Promise<void> => {
    log('START', '🚀 STARTING IMMEDIATE AUTO-DEPLOYMENT for message:', messageId);
    
    const state = get() as any;
    const context = state.deploymentCoordination.activeDeployments[messageId];
    if (!context) {
      log('START', '❌ ERROR: No deployment context found for message:', messageId);
      return;
    }

    try {
      // Reset retry tracking
      (get() as any).resetRetryAttempt(messageId);

      // Update deployment state to show it's starting
      set((state: any) => {
        const currentState = state.deploymentCoordination.deploymentStates[messageId] || { status: 'ready' };
        
        state.deploymentCoordination = {
          ...state.deploymentCoordination,
          deploymentStates: {
            ...state.deploymentCoordination.deploymentStates,
            [messageId]: { 
              ...currentState,
              status: 'deploying', 
              progress: 0,
              retryAttempt: state.deploymentCoordination.retryAttempts[messageId] || 0,
              maxRetryAttempts: state.deploymentCoordination.maxRetryAttempts,
              // FIXED: Mark for immediate auto-start
              isAutoRetrying: false
            }
          },
          isCoordinating: true,
          currentDeploymentMessageId: messageId,
          lastUpdateTime: Date.now()
        };
      });

      log('START', '🔄 Switching to deploy tab for immediate auto-start...');
      onTabSwitch('deploy');

      // FIXED: Minimal delay before triggering auto-deployment
      await new Promise(resolve => setTimeout(resolve, 200));

      log('START', '🚀 TRIGGERING IMMEDIATE AUTO-DEPLOYMENT via onAutoStartDeployment...');
      
      // FIXED: Pass context with auto-start flag to deployment interface
      const contextWithAutoStart = {
        ...context,
        autoStart: true,
        immediateDeployment: true
      };
      
      await onAutoStartDeployment(contextWithAutoStart);
      
      log('START', '✅ Auto-deployment triggered successfully');

    } catch (error) {
      log('START', '❌ Auto-deployment failed:', error);
      
      set((state: any) => {
        const currentState = state.deploymentCoordination.deploymentStates[messageId] || { status: 'ready' };
        
        state.deploymentCoordination = {
          ...state.deploymentCoordination,
          deploymentStates: {
            ...state.deploymentCoordination.deploymentStates,
            [messageId]: {
              ...currentState,
              status: 'error',
              error: error instanceof Error ? error.message : 'Auto-deployment failed',
              retryAttempt: state.deploymentCoordination.retryAttempts[messageId] || 0,
              maxRetryAttempts: state.deploymentCoordination.maxRetryAttempts
            }
          },
          isCoordinating: false,
          currentDeploymentMessageId: null,
          lastUpdateTime: Date.now()
        };
      });
    }
  },

  handleDeploymentSuccess: (messageId: string, deployedUrl: string, duration: number, onTabSwitch: (tab: string) => void): void => {
    log('SUCCESS', '🎉 Handling deployment success:', { messageId, deployedUrl, duration });
    
    const state = get() as any;
    const context = state.deploymentCoordination.activeDeployments[messageId];
    
    set((state: any) => {
      const currentState = state.deploymentCoordination.deploymentStates[messageId] || { status: 'ready' };
      
      state.deploymentCoordination = {
        ...state.deploymentCoordination,
        deploymentStates: {
          ...state.deploymentCoordination.deploymentStates,
          [messageId]: {
            ...currentState,
            status: 'success',
            deployedUrl,
            duration,
            progress: 100,
            livePreviewActivated: true,
            retryAttempt: 0
          }
        },
        isCoordinating: false,
        currentDeploymentMessageId: null,
        retryAttempts: {
          ...state.deploymentCoordination.retryAttempts,
          [messageId]: 0
        },
        lastUpdateTime: Date.now()
      };
    });

    // If this was an auto-retry workflow, complete it via coordinator
    if (context && autoRetryCoordinator.isProjectInAutoRetry(context.projectId)) {
      const workflow = autoRetryCoordinator.getProjectWorkflow(context.projectId);
      if (workflow) {
        autoRetryCoordinator.completeWorkflow(workflow.workflowId, {
          success: true,
          phase: 'deployment',
          deployedUrl,
          duration
        });
      }
    }

    // Track successful deployment in economy metrics
    try {
      const state = get() as any;
      const { userCanisterId, principal } = state;
      if (context && userCanisterId && principal) {
        economyMetricsService.trackDeployment({
          projectId: context.projectId,
          userId: userCanisterId,
          userPrincipal: principal.toString(),
          success: true,
          timestamp: Date.now(),
          duration: duration,
          serverPairId: context.serverPairId
        });
      }
    } catch (trackingError) {
      console.warn('⚠️ [DeploymentCoordination] Failed to track deployment success:', trackingError);
    }

    log('SUCCESS', '🔄 Switching to Live Preview tab...');
    setTimeout(() => {
      onTabSwitch('preview');
    }, 1000);
  },

  // FIXED: Enhanced error handling - Starts auto-retry coordinator when appropriate
  handleDeploymentError: async (messageId: string, error: string, onTabSwitch: (tab: string) => void, onSubmitFixMessage: (fixPrompt: string) => Promise<void>): Promise<void> => {
    log('ERROR', '💥 Handling deployment error with AUTO-RETRY coordination:', { 
      messageId, 
      error: error.substring(0, 100),
      errorLength: error.length,
      timestamp: new Date().toISOString()
    });
    
    const state = get() as any;
    const context = state.deploymentCoordination.activeDeployments[messageId];
    if (!context) {
      console.error('❌ No deployment context found for error handling');
      return;
    }

    try {
      // Update deployment state with error
      set((state: any) => {
        const currentState = state.deploymentCoordination.deploymentStates[messageId] || { status: 'ready' };
        
        state.deploymentCoordination = {
          ...state.deploymentCoordination,
          deploymentStates: {
            ...state.deploymentCoordination.deploymentStates,
            [messageId]: {
              ...currentState,
              status: 'error',
              error: error.length > 100 ? `${error.substring(0, 100)}...` : error,
              retryAttempt: state.deploymentCoordination.retryAttempts[messageId] || 0,
              maxRetryAttempts: state.deploymentCoordination.maxRetryAttempts
            }
          },
          lastUpdateTime: Date.now()
        };
      });

      // Track failed deployment in economy metrics
      try {
        const state = get() as any;
        const { userCanisterId, principal } = state;
        if (context && userCanisterId && principal) {
          economyMetricsService.trackDeployment({
            projectId: context.projectId,
            userId: userCanisterId,
            userPrincipal: principal.toString(),
            success: false,
            timestamp: Date.now(),
            error: error.length > 200 ? error.substring(0, 200) : error,
            serverPairId: context.serverPairId
          });
        }
      } catch (trackingError) {
        console.warn('⚠️ [DeploymentCoordination] Failed to track deployment failure:', trackingError);
      }

      // Check if this is already an auto-retry workflow via coordinator
      const isAutoRetryWorkflow = autoRetryCoordinator.isProjectInAutoRetry(context.projectId);
      
      if (isAutoRetryWorkflow) {
        log('ERROR', '🤖 Existing auto-retry workflow detected - coordinator will handle error');
        const workflow = autoRetryCoordinator.getProjectWorkflow(context.projectId);
        if (workflow) {
          autoRetryCoordinator.completeWorkflow(workflow.workflowId, {
            success: false,
            phase: 'deployment',
            error
          });
        }
        return;
      }

      // FIXED: For chat-initiated deployments, START auto-retry coordinator
      log('ERROR', '🚀 Chat-initiated deployment failed - starting AUTO-RETRY coordinator');
      
      // Create file snapshot from deployment context
      const fileSnapshot = context.generatedFiles || {};
      
      // Start auto-retry workflow via coordinator
      const autoRetryWorkflowId = autoRetryCoordinator.startAutoRetryWorkflow(
        context.projectId, 
        fileSnapshot, 
        messageId // Use messageId as trigger context
      );
      
      if (autoRetryWorkflowId) {
        log('ERROR', '✅ Auto-retry workflow started successfully:', autoRetryWorkflowId);
        
        // Update deployment state to show auto-retry is active
        set((state: any) => {
          const currentState = state.deploymentCoordination.deploymentStates[messageId] || { status: 'ready' };
          
          state.deploymentCoordination = {
            ...state.deploymentCoordination,
            deploymentStates: {
              ...state.deploymentCoordination.deploymentStates,
              [messageId]: {
                ...currentState,
                status: 'deploying', // Reset to deploying for auto-retry
                isAutoRetrying: true,
                retryAttempt: 1,
                progress: 0
              }
            },
            lastUpdateTime: Date.now()
          };
        });
        
        return;
      }

      // If auto-retry coordinator failed to start, fall back to manual error handling
      log('ERROR', '⚠️ Auto-retry coordinator failed to start - falling back to manual error handling');

      const { ErrorExtractionService } = await import('../../services/ErrorExtractionService');
      
      let extractedError;
      
      if (error.toLowerCase().includes('motoko') || 
          error.toLowerCase().includes('moc') ||
          error.toLowerCase().includes('.mo:')) {
        log('ERROR', '🔍 Extracting Motoko error...');
        extractedError = ErrorExtractionService.extractMotokoError(error, context.generatedFiles);
      } else {
        log('ERROR', '🔍 Extracting frontend error...');
        extractedError = ErrorExtractionService.extractFrontendError(error, context.generatedFiles);
      }

      const fixPrompt = ErrorExtractionService.generateFixPrompt(extractedError, context.projectName);

      // Manual deployment - submit fix request to chat
      onTabSwitch('chat');
      await new Promise(resolve => setTimeout(resolve, 500));
      await onSubmitFixMessage(fixPrompt);

    } catch (extractionError) {
      log('ERROR', '❌ Error extraction failed:', extractionError);
      
      // Basic fallback
      const basicFixPrompt = `The deployment failed with the following error. Please fix the issue and regenerate the code:\n\n**Error:** ${error}`;
      
      onTabSwitch('chat');
      await new Promise(resolve => setTimeout(resolve, 500));
      await onSubmitFixMessage(basicFixPrompt);
      
    } finally {
      set((state: any) => {
        state.deploymentCoordination = {
          ...state.deploymentCoordination,
          isCoordinating: false,
          currentDeploymentMessageId: null,
          lastUpdateTime: Date.now()
        };
      });
    }
  },

  setDeploymentSelectedServerPairId: (serverPairId: string | null) => {
    set((state: any) => {
      state.deploymentCoordination = {
        ...state.deploymentCoordination,
        selectedServerPairId: serverPairId,
        lastUpdateTime: Date.now()
      };
    });
  },

  getDeploymentSelectedServerPairId: (): string | null => {
    const state = get() as any;
    return state.deploymentCoordination.selectedServerPairId;
  },

  setDeploymentError: (projectId: string, errorData: {
    hasErrors: boolean;
    errorSummary: string | null;
    canAutoFix: boolean;
  }) => {
    set((state: any) => {
      state.deploymentErrors = {
        ...state.deploymentErrors,
        [projectId]: {
          ...errorData,
          lastErrorTime: Date.now()
        }
      };
    });
  },

  clearDeploymentError: (projectId: string) => {
    set((state: any) => {
      state.deploymentErrors = {
        ...state.deploymentErrors,
        [projectId]: {
          hasErrors: false,
          errorSummary: null,
          canAutoFix: false,
          lastErrorTime: 0
        }
      };
    });
  },

  getDeploymentError: (projectId: string): MotokoDeploymentError => {
    const state = get() as any;
    return state.deploymentErrors[projectId] || {
      hasErrors: false,
      errorSummary: null,
      canAutoFix: false,
      lastErrorTime: 0
    };
  },

  handleLivePreviewActivation: (activationData: LivePreviewActivationData) => {
    log('ACTIVATION', 'Live preview activated:', activationData);

    const deploymentInfo = (get() as any).findDeploymentByProject(activationData.projectId);
    
    if (!deploymentInfo) {
      log('ACTIVATION', 'No deployment found for project, cleaning up coordination state anyway');
      
      set((state: any) => {
        state.deploymentCoordination = {
          ...state.deploymentCoordination,
          isCoordinating: false,
          currentDeploymentMessageId: null,
          lastUpdateTime: Date.now()
        };
      });
      
      return;
    }

    const { messageId, context } = deploymentInfo;
    const duration = Date.now() - context.timestamp;

    log('ACTIVATION', 'Found deployment, marking as complete:', {
      messageId: messageId.substring(Math.max(0, messageId.length - 8)),
      projectId: context.projectId,
      duration: `${(duration / 1000).toFixed(1)}s`
    });

    set((state: any) => {
      const currentDeploymentState = state.deploymentCoordination.deploymentStates[messageId] || { status: 'ready' };
      
      const successfulDeploymentState = {
        ...currentDeploymentState,
        status: 'success' as const,
        deployedUrl: activationData.deployedUrl,
        duration: duration,
        progress: 100,
        livePreviewActivated: true,
        error: undefined,
        retryAttempt: 0
      };

      state.deploymentCoordination = {
        ...state.deploymentCoordination,
        deploymentStates: {
          ...state.deploymentCoordination.deploymentStates,
          [messageId]: successfulDeploymentState
        },
        isCoordinating: false,
        currentDeploymentMessageId: null,
        retryAttempts: {
          ...state.deploymentCoordination.retryAttempts,
          [messageId]: 0
        },
        lastUpdateTime: Date.now()
      };

      if (state.isMessagePending) {
        state.isMessagePending = false;
      }
    });

    // If this was an auto-retry workflow, complete it
    if (autoRetryCoordinator.isProjectInAutoRetry(activationData.projectId)) {
      const workflow = autoRetryCoordinator.getProjectWorkflow(activationData.projectId);
      if (workflow) {
        autoRetryCoordinator.completeWorkflow(workflow.workflowId, {
          success: true,
          phase: 'deployment',
          deployedUrl: activationData.deployedUrl,
          duration
        });
      }
    }

    log('ACTIVATION', 'Deployment marked as successful - UI should update now');

    setTimeout(() => {
      (get() as any).forceUIRefresh();
    }, 10);
  },

  findDeploymentByProject: (projectId: string): { messageId: string; context: DeploymentContext; state: DeploymentButtonState } | null => {
    log('FIND', 'Searching for deployment by project:', projectId);
    
    const state = get() as any;
    
    try {
      const activeDeployments = state.deploymentCoordination.activeDeployments;
      const deploymentStates = state.deploymentCoordination.deploymentStates;
      
      if (!activeDeployments || !deploymentStates) {
        log('FIND', 'Deployment objects not initialized');
        return null;
      }

      log('FIND', 'Objects info:', {
        deployments: Object.keys(activeDeployments).length,
        states: Object.keys(deploymentStates).length
      });
      
      // 🆕 CRITICAL FIX: Collect all matching deployments and prefer 'ready' status or most recent
      const matchingDeployments: Array<{ messageId: string; context: DeploymentContext; state: DeploymentButtonState; timestamp: number }> = [];
      
      for (const messageId in activeDeployments) {
        const context = activeDeployments[messageId];
        
        if (context.projectId === projectId) {
          const deploymentState = deploymentStates[messageId] || { status: 'ready' };
          
          matchingDeployments.push({
            messageId,
            context,
            state: deploymentState,
            timestamp: context.timestamp || 0
          });
          
          log('FIND', 'Found matching deployment:', {
            messageId: messageId.substring(Math.max(0, messageId.length - 8)),
            status: deploymentState.status,
            timestamp: context.timestamp
          });
        }
      }
      
      if (matchingDeployments.length === 0) {
        log('FIND', 'No deployment found for project:', projectId);
        return null;
      }
      
      // 🆕 NEW: Prefer 'ready' status deployments, then most recent
      const readyDeployments = matchingDeployments.filter(d => d.state.status === 'ready');
      if (readyDeployments.length > 0) {
        // If multiple ready deployments, get the most recent
        const mostRecent = readyDeployments.reduce((latest, current) => 
          current.timestamp > latest.timestamp ? current : latest
        );
        
        log('FIND', 'Returning ready deployment (most recent):', {
          messageId: mostRecent.messageId.substring(Math.max(0, mostRecent.messageId.length - 8)),
          status: mostRecent.state.status,
          timestamp: mostRecent.timestamp
        });
        
        return {
          messageId: mostRecent.messageId,
          context: mostRecent.context,
          state: mostRecent.state
        };
      }
      
      // If no ready deployments, return the most recent one
      const mostRecent = matchingDeployments.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      
      log('FIND', 'Returning most recent deployment (no ready found):', {
        messageId: mostRecent.messageId.substring(Math.max(0, mostRecent.messageId.length - 8)),
        status: mostRecent.state.status,
        timestamp: mostRecent.timestamp
      });
      
      return {
        messageId: mostRecent.messageId,
        context: mostRecent.context,
        state: mostRecent.state
      };
      
    } catch (error) {
      log('FIND', 'Search error:', error);
      return null;
    }
  },

  markDeploymentComplete: (messageId: string, deployedUrl: string) => {
    log('COMPLETE', 'Marking deployment complete:', { messageId, deployedUrl });
    
    set((state: any) => {
      const currentState = state.deploymentCoordination.deploymentStates[messageId] || { status: 'ready' };
      
      const completedState = {
        ...currentState,
        status: 'success' as const,
        deployedUrl,
        progress: 100,
        livePreviewActivated: true,
        duration: currentState.duration || 0,
        error: undefined,
        retryAttempt: 0
      };
      
      state.deploymentCoordination = {
        ...state.deploymentCoordination,
        deploymentStates: {
          ...state.deploymentCoordination.deploymentStates,
          [messageId]: completedState
        },
        retryAttempts: {
          ...state.deploymentCoordination.retryAttempts,
          [messageId]: 0
        },
        lastUpdateTime: Date.now()
      };
    });
  },

  ensureChatAlwaysEnabled: () => {
    log('CHAT', 'Ensuring chat is enabled');
    
    set((state: any) => {
      let hasChanges = false;
      
      if (state.isMessagePending) {
        state.isMessagePending = false;
        hasChanges = true;
      }
      
      if (state.streamingState?.isStreaming && !state.streamingState?.streamingContent) {
        state.streamingState = {
          isStreaming: false,
          streamingContent: '',
          streamingMessageId: null,
          accumulatedLength: 0
        };
        hasChanges = true;
      }
      
      if (hasChanges) {
        log('CHAT', 'Chat blocking states cleared');
      }
    });
  },

  cleanupStuckDeployments: () => {
    log('CLEANUP', 'Cleaning up stuck deployments');
    
    const state = get() as any;
    const currentTime = Date.now();
    const stuckThreshold = 5 * 60 * 1000; // 5 minutes
    
    const activeDeployments = state.deploymentCoordination.activeDeployments;
    const deploymentStates = state.deploymentCoordination.deploymentStates;
    
    const stuckDeployments: string[] = [];
    const updatedDeploymentStates: { [key: string]: DeploymentButtonState } = {};
    
    for (const messageId in deploymentStates) {
      const deploymentState = deploymentStates[messageId];
      
      if (deploymentState.status === 'deploying') {
        const context = activeDeployments[messageId];
        if (context && (currentTime - context.timestamp) > stuckThreshold) {
          stuckDeployments.push(messageId);
          updatedDeploymentStates[messageId] = {
            ...deploymentState,
            status: 'ready',
            progress: undefined,
            error: 'Deployment timed out and was reset',
            retryAttempt: 0
          };
        } else {
          updatedDeploymentStates[messageId] = deploymentState;
        }
      } else {
        updatedDeploymentStates[messageId] = deploymentState;
      }
    }
    
    if (stuckDeployments.length > 0) {
      set((state: any) => {
        state.deploymentCoordination = {
          ...state.deploymentCoordination,
          deploymentStates: updatedDeploymentStates,
          isCoordinating: false,
          currentDeploymentMessageId: null,
          lastUpdateTime: Date.now()
        };
      });
      
      log('CLEANUP', `Cleaned up ${stuckDeployments.length} stuck deployments`);
    }
  },

  incrementRetryAttempt: (messageId: string): number => {
    let newAttempt = 0;
    
    set((state: any) => {
      const currentAttempt = state.deploymentCoordination.retryAttempts[messageId] || 0;
      newAttempt = currentAttempt + 1;
      
      state.deploymentCoordination = {
        ...state.deploymentCoordination,
        retryAttempts: {
          ...state.deploymentCoordination.retryAttempts,
          [messageId]: newAttempt
        },
        lastUpdateTime: Date.now()
      };
    });
    
    log('RETRY', `Incremented retry attempt for ${messageId}: ${newAttempt}`);
    return newAttempt;
  },

  resetRetryAttempt: (messageId: string) => {
    set((state: any) => {
      state.deploymentCoordination = {
        ...state.deploymentCoordination,
        retryAttempts: {
          ...state.deploymentCoordination.retryAttempts,
          [messageId]: 0
        },
        lastUpdateTime: Date.now()
      };
    });
    
    log('RETRY', `Reset retry attempt for ${messageId}`);
  },

  getRetryAttempt: (messageId: string): number => {
    const state = get() as any;
    return state.deploymentCoordination.retryAttempts[messageId] || 0;
  },

  canAutoRetry: (messageId: string): boolean => {
    const state = get() as any;
    const currentAttempt = state.deploymentCoordination.retryAttempts[messageId] || 0;
    const maxAttempts = state.deploymentCoordination.maxRetryAttempts;
    
    return currentAttempt < maxAttempts;
  },

  isInAutoRetryMode: (messageId: string): boolean => {
    const state = get() as any;
    const context = state.deploymentCoordination.activeDeployments[messageId];
    if (!context) return false;
    
    return autoRetryCoordinator.isProjectInAutoRetry(context.projectId);
  },

  getAutoRetryProgress: (messageId: string) => {
    const state = get() as any;
    const attempt = state.deploymentCoordination.retryAttempts[messageId] || 0;
    const maxAttempts = state.deploymentCoordination.maxRetryAttempts;
    const context = state.deploymentCoordination.activeDeployments[messageId];
    
    const isRetrying = context ? autoRetryCoordinator.isProjectInAutoRetry(context.projectId) : false;
    const workflow = context ? autoRetryCoordinator.getProjectWorkflow(context.projectId) : null;
    
    const result = {
      attempt,
      maxAttempts,
      isRetrying,
      elapsedTime: workflow ? Date.now() - workflow.startTime : undefined
    };
    
    return result;
  },

  forceUIRefresh: () => {
    set((state: any) => {
      state.deploymentCoordination = {
        ...state.deploymentCoordination,
        lastUpdateTime: Date.now()
      };
    });
  },
});