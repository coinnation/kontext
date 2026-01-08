// 🔥 FIX: Import React FIRST before anything else to prevent initialization errors
import React, { useState, useRef, useCallback, useMemo, useEffect, Suspense } from 'react';

// Components
import { Sidebar } from './Sidebar';
import { ChatHeader } from './ChatHeader';
import { TabBar } from './TabBar';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { StaticStyles } from './StaticStyles';
import { ProjectOverview } from './ProjectOverview';
import { HostingInterface } from './HostingInterface';
import { DeploymentInterface } from './DeploymentInterface';
import { ContextInterface } from './ContextInterface';
import { LivePreviewInterface } from './LivePreviewInterface';
import { IndependentSidebarToggle } from './IndependentSidebarToggle';

// 🚀 PWA OPTIMIZATION: Lazy load heavy conditional components for faster ChatInterface load
// 🔥 FIX: Use lazy getter functions to prevent React.lazy() from being called at module level
// Use 'any' type to avoid React.LazyExoticComponent initialization issues
let DatabaseWrapperComponent: any = null;
const getDatabaseWrapper = () => {
  if (!DatabaseWrapperComponent) {
    DatabaseWrapperComponent = React.lazy(() => 
      import('./database/DatabaseWrapper').then(module => {
        console.log('✅ [PWA] DatabaseWrapper lazy loaded');
        return { default: module.DatabaseWrapper };
      })
    );
  }
  return DatabaseWrapperComponent;
};

let AgentManagementInterfaceComponent: any = null;
const getAgentManagementInterface = () => {
  if (!AgentManagementInterfaceComponent) {
    AgentManagementInterfaceComponent = React.lazy(() => 
      import('./AgentManagementInterface').then(module => {
        console.log('✅ [PWA] AgentManagementInterface lazy loaded');
        return { default: module.AgentManagementInterface };
      })
    );
  }
  return AgentManagementInterfaceComponent;
};

let DomainInterfaceComponent: any = null;
const getDomainInterface = () => {
  if (!DomainInterfaceComponent) {
    DomainInterfaceComponent = React.lazy(() => 
      import('./DomainInterface').then(module => {
        console.log('✅ [PWA] DomainInterface lazy loaded');
        return module;
      })
    );
  }
  return DomainInterfaceComponent;
};

let ServerPairSelectionDialogComponent: any = null;
const getServerPairSelectionDialog = () => {
  if (!ServerPairSelectionDialogComponent) {
    ServerPairSelectionDialogComponent = React.lazy(() => 
      import('./ServerPairSelectionDialog').then(module => {
        console.log('✅ [PWA] ServerPairSelectionDialog lazy loaded');
        return module;
      })
    );
  }
  return ServerPairSelectionDialogComponent;
};

let ProjectImportDialogComponent: any = null;
const getProjectImportDialog = () => {
  if (!ProjectImportDialogComponent) {
    ProjectImportDialogComponent = React.lazy(() => 
      import('./ProjectImportDialog').then(module => {
        console.log('✅ [PWA] ProjectImportDialog lazy loaded');
        return module;
      })
    );
  }
  return ProjectImportDialogComponent;
};

let ProjectCreationDialogComponent: any = null;
const getProjectCreationDialog = () => {
  if (!ProjectCreationDialogComponent) {
    ProjectCreationDialogComponent = React.lazy(() => 
      import('./ProjectCreationDialog').then(module => {
        console.log('✅ [PWA] ProjectCreationDialog lazy loaded');
        return module;
      })
    );
  }
  return ProjectCreationDialogComponent;
};

// Store hooks
import { useAppStore, useProjects, useChat, useFiles, useUI, useServerPairDialog, useDeploymentCoordination } from '../store/appStore';
import { useServerPairState } from '../hooks/useServerPairState';

// Services
import { userCanisterService } from '../services/UserCanisterService';

// Types
import { Project } from '../types';
import { DeploymentContext } from '../types/deploymentCoordination';

// Coordinators
import { projectCreationCoordinator } from '../services/ProjectCreationCoordinator';
import { autoRetryCoordinator } from '../services/AutoRetryCoordinator';

// ✅ ENHANCED: Lazy load SidePane with coordinated loading fallback
let SidePaneComponent: any = null;
const getSidePane = () => {
  if (!SidePaneComponent) {
    SidePaneComponent = React.lazy(() => 
      import('./SidePane').then(module => {
        console.log('✅ [ChatInterface] SidePane lazy loaded successfully');
        return { default: module.SidePane };
      }).catch(error => {
        console.error('❌ [ChatInterface] SidePane lazy load failed:', error);
        // Return a fallback component
        return {
          default: () => (
            <div style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '50%',
              height: '100vh',
              background: '#1e1e1e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ff6b35',
              fontSize: '1rem',
              fontWeight: 600
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>⚠️</div>
                <div>Failed to load code editor</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                  Please refresh the page to try again
                </div>
              </div>
            </div>
          )
        };
      })
    );
  }
  return SidePaneComponent;
};

interface ChatInterfaceProps {
    onClose: () => void;
}

interface ServerPair {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
}

const log = (category: string, message: string, ...args: any[]) => {
  const categories = ['CHAT_COORDINATION', 'TAB_MANAGEMENT', 'MESSAGE_HANDLING', 'AUTO_RETRY_INTEGRATION', 'CALLBACK_MANAGEMENT', 'AUTO_DEPLOYMENT_BRIDGE', 'DEBUG_AUTO_TAB', 'COORDINATOR_INTEGRATION', 'SCROLL_SCENARIOS', 'SERVER_PAIR_COORDINATION', 'PROJECT_CREATION'];
//   if (categories.includes(category)) {
    // console.log(`[${category}] ${message}`, ...args);
//   }
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose }) => {
    // 🔥 FIX: Initialize lazy components inside the component (not at module level)
    const DatabaseWrapper = getDatabaseWrapper();
    const AgentManagementInterface = getAgentManagementInterface();
    const DomainInterface = getDomainInterface();
    const ServerPairSelectionDialog = getServerPairSelectionDialog();
    const ProjectImportDialog = getProjectImportDialog();
    const ProjectCreationDialog = getProjectCreationDialog();
    const SidePane = getSidePane();
    
    // Store hooks - moved to top to avoid hoisting issues
    const { 
        projects, 
        activeProject, 
        switchToProject, 
        createProject, 
        updateProject, 
        deleteProject, 
        getProjectById,
        projectSwitchStatus,
        setSelectedVersion,
        getSelectedVersion,
        getSelectedVersionString
    } = useProjects();

    const { 
        currentMessages,
        input, 
        setInput, 
        sendMessage, 
        generation,
        streamingState,
        activeProject: chatActiveProject,
        setNoProjectState,
        isMessagePending,
        setMessagePending,
        showKLoadingAnimation,
        chatKAnimation
    } = useChat();

    const { 
        generatedFiles, 
        tabGroups, 
        liveGeneratedFiles, 
        getProjectFiles 
    } = useFiles();

    const { 
        ui, 
        toggleSidePane, 
        closeSidePane, 
        setSidebarOpen, 
        setSidebarSearchQuery, 
        setMobile, 
        handleTabClick,
        startAutomationMode,
        stopAutomationMode,
        updateAutomationStatus,
        shouldPreventUserAction,
        getAutomationStatusForDisplay,
        resetAutomationUI,
        showAutoRetryBanner,
        hideAutoRetryBanner,
        setWorkflowIconState,
        updateAutoRetryProgress
    } = useUI();

    const { serverPairDialog } = useServerPairDialog();

    const { 
        deploymentCoordination,
        getDeploymentContext,
        getDeploymentState,
        createDeploymentContext,
        findDeploymentByProject
    } = useDeploymentCoordination();

    const { 
        userCanisterId, 
        identity, 
        principal,
        getProjectServerPair,
        projectServerPairs 
    } = useAppStore(state => ({
        userCanisterId: state.userCanisterId,
        identity: state.identity,
        principal: state.principal,
        getProjectServerPair: state.getProjectServerPair,
        projectServerPairs: state.projectServerPairs
    }));

    // Memoized project data to avoid re-renders
    const currentProjectData = useMemo(() => {
        if (!activeProject) return null;
        const project = projects.find(p => p.id === activeProject);
        return project || null;
    }, [activeProject, projects]);

    // 🔥 NEW: Use centralized server pair state management
    const {
        selectedServerPairId,
        setServerPair: setServerPairId,
        isLoading: serverPairLoading,
        error: serverPairError
    } = useServerPairState();

    // State variables - using let/const properly to avoid hoisting issues
    const [isMobile, setIsMobileLocal] = useState(false);
    const [activeProjectTab, setActiveProjectTab] = useState('chat');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [serverPairs, setServerPairs] = useState<ServerPair[]>([]);
    const [autoDeploymentContext, setAutoDeploymentContext] = useState<DeploymentContext | null>(null);
    
    // NEW: Project Creation Dialog State
    const [isProjectCreationDialogOpen, setIsProjectCreationDialogOpen] = useState(false);
    
    // Refs
    const inputRef = useRef<HTMLTextAreaElement>(null);
    
    // NEW: Scroll control callback ref for SCENARIO 2
    const scrollForUserActionRef = useRef<(() => void) | null>(null);
    const lastAutoSwitchTimeRef = useRef<number>(0);

    // ENHANCED: Auto-retry coordinator state tracking with stable references
    const [autoRetryCoordinatorState, setAutoRetryCoordinatorState] = useState<{
        isCoordinating: boolean;
        workflows: any[];
        projectMappings: { [projectId: string]: string };
        storeConnected: boolean;
        lastActivity: number;
    }>({
        isCoordinating: false,
        workflows: [],
        projectMappings: {},
        storeConnected: false,
        lastActivity: 0
    });

    // ENHANCED: Memoize stable values to prevent infinite loops
    const stableCoordinatorValues = useMemo(() => {
        const projectWorkflow = autoRetryCoordinatorState.workflows.find(w => w.projectId === activeProject);
        const workflowIds = autoRetryCoordinatorState.workflows.map(w => w.workflowId);
        
        return {
            isCoordinating: autoRetryCoordinatorState.isCoordinating,
            projectWorkflow,
            workflowCount: autoRetryCoordinatorState.workflows.length,
            workflowIds: workflowIds.join(','), // Stable string representation
            storeConnected: autoRetryCoordinatorState.storeConnected
        };
    }, [autoRetryCoordinatorState.isCoordinating, autoRetryCoordinatorState.workflows, autoRetryCoordinatorState.storeConnected, activeProject]);

    // 🔥 ENHANCED: Compute active server pair from centralized state
    const activeServerPair = useMemo(() => {
        if (!selectedServerPairId) {
            log('SERVER_PAIR_COORDINATION', 'No server pair selected', { activeProject });
            return null;
        }

        // Find the server pair data from loaded server pairs
        const serverPairData = serverPairs.find(pair => pair.pairId === selectedServerPairId);
        
        if (serverPairData) {
            log('SERVER_PAIR_COORDINATION', 'Found active server pair', {
                projectId: activeProject,
                serverPairId: selectedServerPairId,
                serverPairName: serverPairData.name
            });
        } else {
            log('SERVER_PAIR_COORDINATION', 'Server pair ID found but data not loaded yet', {
                projectId: activeProject,
                serverPairId: selectedServerPairId,
                loadedPairs: serverPairs.length
            });
        }

        return serverPairData || null;
    }, [selectedServerPairId, serverPairs, activeProject]);

    // 🚨 SIMPLIFIED: Remove deployment execution logic from ChatInterface
    // Let AutoRetryCoordinator handle all deployment execution orchestration

    // ENHANCED: Simplified deployment coordination subscription - UI feedback only
    useEffect(() => {
        if (!activeProject) {
            log('DEBUG_AUTO_TAB', '❌ No active project - skipping deployment subscription');
            return;
        }

        log('DEBUG_AUTO_TAB', '🔌 Setting up SIMPLIFIED deployment coordination subscription for UI feedback only', {
            activeProject,
            currentTab: activeProjectTab
        });
        
        let lastProcessedMessageId = autoDeploymentContext?.messageId || '';
        let subscriptionActive = true;
        
        // Subscribe to deployment coordination state changes for UI updates only
        const unsubscribe = useAppStore.subscribe(
            (state) => state.deploymentCoordination,
            (deploymentCoordinationState) => {
                if (!subscriptionActive) {
                    log('DEBUG_AUTO_TAB', '🚫 Subscription inactive - ignoring update');
                    return;
                }

                log('DEBUG_AUTO_TAB', '📊 Deployment coordination state update detected (UI feedback only)', {
                    activeDeployments: Object.keys(deploymentCoordinationState.activeDeployments).length,
                    currentProject: activeProject,
                    lastUpdate: deploymentCoordinationState.lastUpdateTime
                });
                
                // Find the most recent deployment context for current project (UI state only)
                const projectDeployments = Object.values(deploymentCoordinationState.activeDeployments)
                    .filter(context => context.projectId === activeProject)
                    .sort((a, b) => b.timestamp - a.timestamp);
                
                const mostRecentDeployment = projectDeployments[0];
                
                if (mostRecentDeployment) {
                    log('DEBUG_AUTO_TAB', '🎯 Found deployment context for UI state (no execution)', {
                        messageId: mostRecentDeployment.messageId.slice(-8),
                        projectId: mostRecentDeployment.projectId,
                        fileCount: Object.keys(mostRecentDeployment.generatedFiles).length,
                        timestamp: new Date(mostRecentDeployment.timestamp).toISOString(),
                        lastProcessedMessageId: lastProcessedMessageId.slice(-8),
                        isNewContext: mostRecentDeployment.messageId !== lastProcessedMessageId
                    });
                    
                    // Update UI state only (no execution logic)
                    const isNewDeploymentContext = mostRecentDeployment.messageId !== lastProcessedMessageId;
                    
                    if (isNewDeploymentContext && subscriptionActive) {
                        log('DEBUG_AUTO_TAB', '🔄 NEW deployment context detected - updating UI state only');
                        
                        lastProcessedMessageId = mostRecentDeployment.messageId;
                        setAutoDeploymentContext(mostRecentDeployment);
                        
                        // Tab switching is now handled by AutoRetryCoordinator
                        log('DEBUG_AUTO_TAB', '📋 Deployment context updated for UI - AutoRetryCoordinator handles execution');
                    } else {
                        log('DEBUG_AUTO_TAB', '♻️ Same deployment context - no UI update needed');
                    }
                } else {
                    // No deployment context for current project
                    if (autoDeploymentContext && subscriptionActive) {
                        log('DEBUG_AUTO_TAB', '🧹 Clearing deployment context - no active deployment for project');
                        setAutoDeploymentContext(null);
                        lastProcessedMessageId = '';
                    }
                }
            },
            {
                // Custom equality function to ensure we catch all changes
                equalityFn: (a, b) => {
                    const aKeys = Object.keys(a.activeDeployments);
                    const bKeys = Object.keys(b.activeDeployments);
                    
                    if (aKeys.length !== bKeys.length) {
                        return false;
                    }
                    
                    for (const key of aKeys) {
                        if (!b.activeDeployments[key] || 
                            a.activeDeployments[key].timestamp !== b.activeDeployments[key].timestamp) {
                            return false;
                        }
                    }
                    
                    if (a.lastUpdateTime !== b.lastUpdateTime) {
                        return false;
                    }
                    
                    return true;
                }
            }
        );

        return () => {
            log('DEBUG_AUTO_TAB', '🧹 Cleaning up simplified deployment coordination subscription');
            subscriptionActive = false;
            unsubscribe();
        };
    }, [activeProject, activeProjectTab, autoDeploymentContext?.messageId]);

    // Callback references
    const callbacksRef = useRef<{
        tabChange: ((tabId: string) => void) | null;
        submitMessage: ((message: string) => Promise<void>) | null;
        lastUpdateTime: number;
        isRegistered: boolean;
    }>({
        tabChange: null,
        submitMessage: null,
        lastUpdateTime: 0,
        isRegistered: false
    });

    // ENHANCED: Stable auto-retry completion handler
    const handleAutoRetryCompletion = useCallback((workflow: any, success: boolean) => {
        log('AUTO_RETRY_INTEGRATION', '🎯 Auto-retry workflow completion detected', {
            workflowId: workflow.workflowId,
            success,
            phase: workflow.phase,
            currentTab: activeProjectTab
        });
        
        if (success) {
            // 🔧 CRITICAL FIX: Check completedPhase instead of current phase (which is now 'COMPLETED')
            // Also check if deployment was triggered or if there's a deployed URL
            const wasDeploymentCompletion = workflow.completedPhase === 'deployment' || 
                                          workflow.deploymentTriggered || 
                                          workflow.completedDeployedUrl ||
                                          workflow.deployedUrl;
            
            if (wasDeploymentCompletion) {
                log('AUTO_RETRY_INTEGRATION', '✅ Deployment retry completed successfully', {
                    completedPhase: workflow.completedPhase,
                    deploymentTriggered: workflow.deploymentTriggered,
                    hasDeployedUrl: !!(workflow.completedDeployedUrl || workflow.deployedUrl)
                });
                showAutoRetryBanner('✅ Auto-retry deployment completed successfully!', 'success');
                // 🔧 CRITICAL FIX: Don't switch tabs - deployment success handler already switched to preview
                // Just hide the banner after a delay
            } else {
                // ENHANCED: This is a CODE GENERATION completion - user needs to deploy manually
                log('AUTO_RETRY_INTEGRATION', '✅ Code generation completed - user should deploy manually');
                showAutoRetryBanner('✅ Code fixes generated! Click Deploy to test your fixes.', 'success');
                
                // CRITICAL: Switch to deploy tab so user can manually deploy
                setTimeout(() => {
                    if (callbacksRef.current.tabChange) {
                        log('AUTO_RETRY_INTEGRATION', '🔄 Switching to deploy tab for manual deployment');
                        callbacksRef.current.tabChange('deploy');
                    }
                }, 1000);
            }
            
            setTimeout(() => {
                hideAutoRetryBanner();
            }, 5000);
        } else {
            // CRITICAL: On failure, switch back to chat so user can submit fixes
            log('AUTO_RETRY_INTEGRATION', '❌ Auto-retry workflow failed - switching back to chat');
            showAutoRetryBanner('❌ Auto-retry process failed. Please check logs.', 'error');
            
            // CRITICAL: Switch back to chat tab on failure so user can see errors and submit fixes
            setTimeout(() => {
                if (callbacksRef.current.tabChange) {
                    log('AUTO_RETRY_INTEGRATION', '🔄 Switching to chat tab after auto-retry failure');
                    callbacksRef.current.tabChange('chat');
                }
            }, 1000);
        }
    }, [activeProjectTab, showAutoRetryBanner, hideAutoRetryBanner]);

    // ENHANCED: Coordinator subscription with stable dependencies - UI FEEDBACK ONLY
    useEffect(() => {
        log('AUTO_RETRY_INTEGRATION', '🔌 Setting up auto-retry coordinator subscription for UI feedback only');

        let subscriptionActive = true;

        const handleCoordinatorState = (state: any) => {
            if (!subscriptionActive) {
                log('AUTO_RETRY_INTEGRATION', '🚫 Coordinator subscription inactive - ignoring update');
                return;
            }

            log('AUTO_RETRY_INTEGRATION', '📊 Coordinator state update received for UI feedback', {
                isCoordinating: state.isCoordinating,
                workflows: state.workflows.length,
                storeConnected: state.storeConnected
            });

            const currentWorkflows = state.workflows;
            const previousWorkflows = autoRetryCoordinatorState.workflows;
            
            // Check for workflow completion/failure for UI feedback
            if (previousWorkflows.length > 0) {
                previousWorkflows.forEach((prevWorkflow: any) => {
                    const currentWorkflow = currentWorkflows.find((w: any) => w.workflowId === prevWorkflow.workflowId);
                    
                    // Check for both completion AND failure
                    if (!currentWorkflow || 
                        (currentWorkflow.phase === 'COMPLETED' && prevWorkflow.phase !== 'COMPLETED') ||
                        (currentWorkflow.phase === 'FAILED' && prevWorkflow.phase !== 'FAILED')) {
                        
                        const success = currentWorkflow ? currentWorkflow.phase === 'COMPLETED' : false;
                        if (subscriptionActive) {
                            handleAutoRetryCompletion(prevWorkflow, success);
                        }
                    }
                });
            }

            if (subscriptionActive) {
                setAutoRetryCoordinatorState(state);

                if (activeProject) {
                    const projectWorkflow = currentWorkflows.find((w: any) => w.projectId === activeProject);
                    
                    if (projectWorkflow && !ui.automationState.isActive) {
                        startAutomationMode(projectWorkflow.workflowId, projectWorkflow.phase);
                        setWorkflowIconState('spinning');
                        showAutoRetryBanner('🤖 Auto-retry active', 'progress');
                    } else if (!projectWorkflow && ui.automationState.isActive) {
                        stopAutomationMode('completed');
                        setWorkflowIconState('success');
                    }

                    if (projectWorkflow && ui.automationState.isActive) {
                        updateAutomationStatus(projectWorkflow.phase, `Phase: ${projectWorkflow.phase}`, projectWorkflow.executionCount);
                    }
                }
            }
        };

        const unsubscribe = autoRetryCoordinator.subscribe(handleCoordinatorState);
        
        return () => {
            subscriptionActive = false;
            unsubscribe();
        };
    }, [activeProject, handleAutoRetryCompletion]);

    // Mobile detection
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth <= 768;
            log('CHAT_COORDINATION', '📱 Mobile detection update', { windowWidth: window.innerWidth, isMobile: mobile });
            setIsMobileLocal(mobile);
            setMobile(mobile);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [setMobile]);

    useEffect(() => {
        if (isMobile) {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.height = '100%';
            
            return () => {
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.width = '';
                document.body.style.height = '';
            };
        }
    }, [isMobile]);

    // Load server pairs for current project
    useEffect(() => {
        const loadServerPairs = async () => {
            if (!userCanisterId || !identity || !activeProject) {
                setServerPairs([]);
                setServerPairId(null);
                return;
            }

            try {
                log('SERVER_PAIR_COORDINATION', 'Loading server pairs for project', { activeProject });

                const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
                const serverPairsResult = await userActor.getProjectServerPairs(activeProject);

                if (serverPairsResult && 'ok' in serverPairsResult) {
                    const serverPairsData = serverPairsResult.ok;
                    
                    if (Array.isArray(serverPairsData)) {
                        const pairs = serverPairsData.map((pair: any) => ({
                            pairId: pair.pairId,
                            name: pair.name,
                            createdAt: Number(pair.createdAt) / 1_000_000,
                            creditsAllocated: Number(pair.creditsAllocated),
                            frontendCanisterId: pair.frontendCanisterId.toText(),
                            backendCanisterId: pair.backendCanisterId.toText()
                        }));
                        
                        setServerPairs(pairs);
                        
                        log('SERVER_PAIR_COORDINATION', 'Server pairs loaded successfully', {
                            activeProject,
                            pairsCount: pairs.length,
                            pairIds: pairs.map(p => p.pairId)
                        });

                        // Update selected server pair based on coordinated state
                        const coordinatedServerPairId = getProjectServerPair(activeProject);
                        const coordinatedPair = pairs.find(p => p.pairId === coordinatedServerPairId);
                        
                        if (coordinatedPair) {
                            setServerPairId(coordinatedPair.pairId);
                            log('SERVER_PAIR_COORDINATION', 'Set selected server pair from coordinated state', {
                                pairId: coordinatedPair.pairId,
                                pairName: coordinatedPair.name
                            });
                        } else if (pairs.length > 0) {
                            // Fallback to first pair if no coordinated assignment
                            setServerPairId(pairs[0].pairId);
                            log('SERVER_PAIR_COORDINATION', 'Set selected server pair to first available (no coordinated assignment)', {
                                pairId: pairs[0].pairId,
                                pairName: pairs[0].name
                            });
                        } else {
                            setServerPairId(null);
                            log('SERVER_PAIR_COORDINATION', 'No server pairs available for project');
                        }
                    }
                }
            } catch (error) {
                log('SERVER_PAIR_COORDINATION', '❌ Failed to load server pairs', { error });
                setServerPairs([]);
                setServerPairId(null);
            }
        };

        loadServerPairs();
    }, [userCanisterId, identity, activeProject, getProjectServerPair, projectServerPairs.lastAssignmentUpdate, setServerPairId]); // 🔧 FIX: Include setServerPairId in dependencies

    // Listen for coordinated server pair assignment changes
    useEffect(() => {
        if (!activeProject) return;

        log('SERVER_PAIR_COORDINATION', 'Setting up coordinated server pair assignment listener', { activeProject });

        // 🔥 REMOVED: Server pair selection now managed by centralized ServerPairStateService
        // The selected server pair is persisted in the user canister and synchronized across tabs
        
    }, [activeProject, userCanisterId, identity]);

    // Project selection handler
    const handleProjectSelect = useCallback(async (project: Project) => {
        log('CHAT_COORDINATION', '🎬 Project selection requested', { projectId: project.id });
        
        if (shouldPreventUserAction('project_switch')) {
            const currentWorkflow = stableCoordinatorValues.projectWorkflow;
            log('CHAT_COORDINATION', '🚫 Project switch blocked - automation active', { workflowId: currentWorkflow?.workflowId });
            showAutoRetryBanner('Cannot switch projects during auto-retry process.', 'info');
            return;
        }
        
        try {
            await switchToProject(project.id);
            setSidebarOpen(false);
            
            if (autoDeploymentContext) {
                log('CHAT_COORDINATION', '🔄 Clearing auto-deployment context for project switch');
                setAutoDeploymentContext(null);
            }
        } catch (error) {
            log('CHAT_COORDINATION', '❌ Project switch failed', { error });
            showAutoRetryBanner('Failed to switch projects. Please try again.', 'error');
        }
    }, [switchToProject, setSidebarOpen, shouldPreventUserAction, stableCoordinatorValues.projectWorkflow, autoDeploymentContext, showAutoRetryBanner]);

    const handleProjectDelete = useCallback(async (projectId: string) => {
        if (shouldPreventUserAction('project_delete')) {
            const projectWorkflow = autoRetryCoordinatorState.workflows.find(w => w.projectId === projectId);
            if (projectWorkflow) {
                showAutoRetryBanner(`Cannot delete project - auto-retry workflow is active.`, 'error');
                return;
            }
            showAutoRetryBanner('Cannot delete projects during active automation processes.', 'info');
            return;
        }

        try {
            if (autoRetryCoordinatorState.workflows.some(w => w.projectId === projectId)) {
                log('CHAT_COORDINATION', '🧹 Force cleaning up workflows before deletion');
                autoRetryCoordinator.forceCleanupWorkflow(projectId);
            }

            await deleteProject(projectId);
        } catch (error) {
            log('CHAT_COORDINATION', '❌ Project deletion failed', { error });
            showAutoRetryBanner('Failed to delete project. Please try again.', 'error');
        }
    }, [deleteProject, shouldPreventUserAction, autoRetryCoordinatorState.workflows, showAutoRetryBanner]);

    // ENHANCED: Message sending with SCENARIO 2 immediate scroll
    const handleSend = useCallback(async () => {
        if (!input.trim() || generation.isGenerating) return;
        
        if (!activeProject) {
            log('MESSAGE_HANDLING', '❌ No active project - cannot send message');
            showAutoRetryBanner('Please select a project before sending messages.', 'info');
            return;
        }
        
        const currentWorkflow = stableCoordinatorValues.projectWorkflow;
        if (currentWorkflow) {
            log('MESSAGE_HANDLING', '⚠️ Sending message during active workflow', {
                workflowId: currentWorkflow.workflowId,
                workflowPhase: currentWorkflow.phase
            });
            
            if (['FILE_APPLICATION', 'DEPLOYMENT'].includes(currentWorkflow.phase)) {
                showAutoRetryBanner(`Auto-retry is currently ${currentWorkflow.phase.toLowerCase()}. Your message will be queued.`, 'info');
            }
        }
        
        try {
            // SCENARIO 2: IMMEDIATE SCROLL AFTER USER SUBMITS
            log('SCROLL_SCENARIOS', '🚀 [SCENARIO 2] User submitting message - triggering immediate scroll');
            
            await sendMessage();
            
            // Trigger immediate scroll after successful send
            if (scrollForUserActionRef.current) {
                log('SCROLL_SCENARIOS', '👤 [SCENARIO 2] Executing user action scroll');
                scrollForUserActionRef.current();
            }
            
            if (inputRef.current) {
                inputRef.current.style.height = 'auto';
            }
        } catch (error) {
            log('MESSAGE_HANDLING', '❌ Message sending failed', { error });
            showAutoRetryBanner('Failed to send message. Please try again.', 'error');
        }
    }, [input, generation.isGenerating, sendMessage, activeProject, stableCoordinatorValues.projectWorkflow, showAutoRetryBanner]);

    // Programmatic message submission
    const handleSubmitMessageProgrammatically = useCallback(async (message: string) => {
        if (!activeProject) {
            log('MESSAGE_HANDLING', '❌ No active project for programmatic message');
            return;
        }
        
        if (!message || message.trim().length === 0) {
            log('MESSAGE_HANDLING', '❌ Empty message provided to programmatic submission');
            return;
        }

        log('MESSAGE_HANDLING', '📝 Programmatic message submission', {
            messagePreview: message.substring(0, 100) + '...',
            messageLength: message.length,
            activeProject
        });
        
        try {
            setInput(message);
            await new Promise(resolve => setTimeout(resolve, 100));
            await sendMessage();
            
            // SCENARIO 2: Immediate scroll for programmatic submissions too
            if (scrollForUserActionRef.current) {
                log('SCROLL_SCENARIOS', '👤 [SCENARIO 2] Executing user action scroll (programmatic)');
                scrollForUserActionRef.current();
            }
            
            log('MESSAGE_HANDLING', '✅ Programmatic message submitted successfully');
        } catch (error) {
            log('MESSAGE_HANDLING', '❌ Programmatic message submission failed', { error });
            throw error;
        }
    }, [activeProject, setInput, sendMessage]);

    // NEW: Fixed project creation handler - opens ProjectCreationDialog instead of directly creating
    const handleCreateNewProject = useCallback(async () => {
        log('PROJECT_CREATION', '🚀 New Project button clicked - opening ProjectCreationDialog');
        
        if (shouldPreventUserAction('project_create')) {
            const activeWorkflows = autoRetryCoordinatorState.workflows.length;
            showAutoRetryBanner(`Cannot create projects during active automation (${activeWorkflows} workflows running)`, 'info');
            return;
        }

        // Simply open the ProjectCreationDialog - let it handle the rest
        setIsProjectCreationDialogOpen(true);
        log('PROJECT_CREATION', '✅ ProjectCreationDialog opened');
    }, [shouldPreventUserAction, autoRetryCoordinatorState, showAutoRetryBanner]);

    // NEW: Handler for closing ProjectCreationDialog
    const handleCloseProjectCreationDialog = useCallback(() => {
        log('PROJECT_CREATION', '🔄 Closing ProjectCreationDialog');
        setIsProjectCreationDialogOpen(false);
    }, []);

    // NEW: Handler for creating blank project (called from ProjectCreationDialog)
    const handleCreateBlankProject = useCallback(async () => {
        log('PROJECT_CREATION', '📝 Create Blank Project selected from dialog');
        
        // Close the creation dialog
        setIsProjectCreationDialogOpen(false);
        
        // This matches the previous logic but is now properly triggered from the dialog
        const newProject = {
            id: Date.now().toString(),
            name: 'New Project',
            description: 'A new project created in Kontext',
            projectType: { name: 'Frontend', subType: 'React' },
            canisters: [],
            created: Date.now(),
            updated: Date.now(),
            visibility: 'private',
            status: 'active',
            title: 'New Project',
            icon: '✨',
            iconType: 'new',
            preview: 'A new project',
            time: 'Just now',
            isTemplate: false,
            unreadCount: 0,
            messages: []
        };
        
        try {
            const success = await createProject(newProject);
            if (success) {
                await switchToProject(newProject.id);
                log('PROJECT_CREATION', '✅ Blank project created and activated successfully');
            } else {
                showAutoRetryBanner('Failed to create new project. Please try again.', 'error');
            }
        } catch (error) {
            log('PROJECT_CREATION', '❌ Blank project creation failed', { error });
            showAutoRetryBanner('Error creating new project. Please try again.', 'error');
        }
    }, [createProject, switchToProject, showAutoRetryBanner]);

    // Tab change callback
    const handleProjectTabChange = useCallback((tabId: string) => {
        log('TAB_MANAGEMENT', '📑 Project tab change requested', { tabId });
        
        const currentWorkflow = stableCoordinatorValues.projectWorkflow;
        if (ui.automationState.isActive || currentWorkflow) {
            log('TAB_MANAGEMENT', '🤖 Tab change during automation - providing context', {
                tabId,
                workflowId: currentWorkflow?.workflowId,
                phase: currentWorkflow?.phase
            });
            
            if (tabId === 'deploy' && currentWorkflow) {
                showAutoRetryBanner(`Viewing deployment while auto-retry is ${currentWorkflow.phase.toLowerCase()}`, 'info');
            }
        }
        
        setActiveProjectTab(tabId);
        
        try {
            switch (tabId) {
                case 'chat':
                    closeSidePane();
                    break;
                // case 'overview':  // TEMPORARILY COMMENTED OUT
                case 'context':
                case 'database':
                case 'hosting':
                case 'preview':
                // case 'agents':  // TEMPORARILY COMMENTED OUT
                    closeSidePane();
                    break;
                case 'deploy':
                    closeSidePane();
                    log('TAB_MANAGEMENT', '🚀 Deploy tab - showing DeploymentInterface (AutoRetryCoordinator handles execution)');
                    
                    if (!currentWorkflow && autoDeploymentContext) {
                        log('TAB_MANAGEMENT', '🔄 Clearing stale auto-deployment context on manual deploy tab access');
                        setAutoDeploymentContext(null);
                    }
                    break;
                default:
                    log('TAB_MANAGEMENT', '❌ Unknown tab', { tabId });
            }
        } catch (error) {
            log('TAB_MANAGEMENT', '❌ Error during tab change processing', { error });
        }
    }, [closeSidePane, ui.automationState.isActive, activeProject, stableCoordinatorValues.projectWorkflow, autoDeploymentContext, showAutoRetryBanner]);

    // Stable callback setup
    const stableTabChangeCallback = useCallback((tabId: string) => {
        try {
            // UPDATED: Removed overview and inspector from valid tabs, agents tab reactivated, domains tab added
            const validTabs = ['chat', 'context', 'database', 'hosting', 'deploy', 'preview', 'agents', 'domains'];
            if (!validTabs.includes(tabId)) {
                log('CALLBACK_MANAGEMENT', '⚠️ Invalid tab ID provided to callback', { tabId });
                return;
            }
            
            log('CALLBACK_MANAGEMENT', '🔗 Tab change callback executed', { tabId, timestamp: Date.now() });
            handleProjectTabChange(tabId);
        } catch (error) {
            log('CALLBACK_MANAGEMENT', '❌ Tab change callback failed', { error });
            console.error('Tab change callback failed:', error);
        }
    }, [handleProjectTabChange]);

    const stableSubmitMessageCallback = useCallback(async (message: string) => {
        try {
            if (typeof message !== 'string') {
                throw new Error('Message must be a string');
            }
            
            if (message.length > 10000) {
                throw new Error('Message too long (max 10000 characters)');
            }
            
            log('CALLBACK_MANAGEMENT', '🔗 Submit message callback executed', {
                messagePreview: message.substring(0, 50) + '...',
                messageLength: message.length,
                timestamp: Date.now()
            });
            
            await handleSubmitMessageProgrammatically(message);
        } catch (error) {
            log('CALLBACK_MANAGEMENT', '❌ Submit message callback failed', { error });
            console.error('Submit message callback failed:', error);
            
            if (showAutoRetryBanner) {
                showAutoRetryBanner('Failed to submit message automatically. Please try manually.', 'error');
            }
        }
    }, [handleSubmitMessageProgrammatically, showAutoRetryBanner]);

    // NEW: Scroll callback for SCENARIO 2
    const handleUserActionScroll = useCallback(() => {
        if (scrollForUserActionRef.current) {
            log('SCROLL_SCENARIOS', '🚀 [SCENARIO 2] User action scroll callback executed');
            scrollForUserActionRef.current();
        }
    }, []);

    // Window callback setup
    useEffect(() => {
        const now = Date.now();
        
        log('CALLBACK_MANAGEMENT', '🔧 Setting up window callbacks for enhanced auto-retry integration', { timestamp: now });

        callbacksRef.current.tabChange = stableTabChangeCallback;
        callbacksRef.current.submitMessage = stableSubmitMessageCallback;
        callbacksRef.current.lastUpdateTime = now;
        callbacksRef.current.isRegistered = true;

        (stableTabChangeCallback as any).metadata = {
            version: '2.2',
            enhanced: true,
            // UPDATED: Removed overview and inspector from valid tabs, agents tab reactivated
            validTabs: ['chat', 'context', 'database', 'hosting', 'deploy', 'preview', 'agents'],
            createdAt: now
        };

        (stableSubmitMessageCallback as any).metadata = {
            version: '2.2',
            enhanced: true,
            timestamp: now,
            features: ['validation', 'error-handling', 'automation-aware'],
            createdAt: now
        };

        (window as any).__chatInterfaceTabChange = stableTabChangeCallback;
        (window as any).__chatInterfaceSubmitMessage = stableSubmitMessageCallback;
        
        log('CALLBACK_MANAGEMENT', '✅ Enhanced window callbacks exposed immediately for auto-retry coordinator');
        
        return () => {
            const currentTabCallback = (window as any).__chatInterfaceTabChange;
            const currentSubmitCallback = (window as any).__chatInterfaceSubmitMessage;
            
            if (currentTabCallback && currentTabCallback.metadata && 
                currentTabCallback.metadata.createdAt === now) {
                delete (window as any).__chatInterfaceTabChange;
                log('CALLBACK_MANAGEMENT', '🧹 Tab change callback cleaned from window');
            }
            
            if (currentSubmitCallback && currentSubmitCallback.metadata && 
                currentSubmitCallback.metadata.createdAt === now) {
                delete (window as any).__chatInterfaceSubmitMessage;
                log('CALLBACK_MANAGEMENT', '🧹 Submit message callback cleaned from window');
            }
            
            callbacksRef.current.tabChange = null;
            callbacksRef.current.submitMessage = null;
            callbacksRef.current.isRegistered = false;
        };
    }, [stableTabChangeCallback, stableSubmitMessageCallback]);

    const handleToggleSidebarCollapsed = useCallback(() => {
        setSidebarCollapsed(!sidebarCollapsed);
    }, [sidebarCollapsed]);

    // SIMPLIFIED: Auto-start deployment handler - removed execution logic
    const handleAutoStartDeployment = useCallback(async (context: DeploymentContext) => {
        if (!activeProject || !userCanisterId || !identity || !principal) {
            throw new Error('Missing required deployment context');
        }

        log('AUTO_DEPLOYMENT_BRIDGE', '🚀 Auto-start deployment requested (UI context only - AutoRetryCoordinator handles execution)', {
            contextId: context.messageId,
            projectId: activeProject,
            coordinatorActive: stableCoordinatorValues.isCoordinating
        });

        try {
            const existingWorkflow = stableCoordinatorValues.projectWorkflow;
            if (existingWorkflow) {
                log('AUTO_DEPLOYMENT_BRIDGE', '⚠️ Auto-retry coordinator already handling this project', {
                    existingWorkflowId: existingWorkflow.workflowId
                });
                showAutoRetryBanner(`Auto-retry already active: ${existingWorkflow.phase}`, 'info');
                return;
            }

            if (!context.messageId || !context.projectId || !context.generatedFiles || Object.keys(context.generatedFiles).length === 0) {
                throw new Error('Invalid deployment context - missing required fields');
            }

            // Just set the UI context - AutoRetryCoordinator handles execution
            setAutoDeploymentContext(context);
            showAutoRetryBanner('🚀 Deployment context set - AutoRetryCoordinator handles execution', 'progress');

        } catch (error) {
            log('AUTO_DEPLOYMENT_BRIDGE', '❌ Auto-deployment context setup failed', { error });
            setAutoDeploymentContext(null);
            showAutoRetryBanner('Failed to set deployment context. Please try manual deployment.', 'error');
            throw error;
        }
    }, [activeProject, userCanisterId, identity, principal, stableCoordinatorValues, showAutoRetryBanner]);

    const handleSubmitFixMessage = useCallback(async (fixPrompt: string) => {
        const currentWorkflow = stableCoordinatorValues.projectWorkflow;
        
        log('MESSAGE_HANDLING', '🔧 Fix message submission requested', {
            promptPreview: fixPrompt.substring(0, 100) + '...',
            automationActive: ui.automationState.isActive,
            workflowActive: !!currentWorkflow
        });
        
        try {
            if (currentWorkflow) {
                showAutoRetryBanner(`Submitting AI fix during ${currentWorkflow.phase.toLowerCase()}`, 'progress');
            }
            
            setInput(fixPrompt);
            await new Promise(resolve => setTimeout(resolve, 100));
            await sendMessage();
            
            // SCENARIO 2: Immediate scroll for fix message submissions
            if (scrollForUserActionRef.current) {
                log('SCROLL_SCENARIOS', '👤 [SCENARIO 2] Executing user action scroll (fix message)');
                scrollForUserActionRef.current();
            }
            
            log('MESSAGE_HANDLING', '✅ Fix message sent to AI for processing');

            if (!currentWorkflow) {
                setAutoDeploymentContext(null);
            }
            
        } catch (error) {
            log('MESSAGE_HANDLING', '❌ Fix message submission failed', { error });
            showAutoRetryBanner('Failed to submit fix message. Please try again.', 'error');
            throw error;
        }
    }, [setInput, sendMessage, ui.automationState.isActive, stableCoordinatorValues.projectWorkflow, activeProject, showAutoRetryBanner]);

    // Clear auto-deployment context when switching away from deploy tab
    useEffect(() => {
        if (activeProjectTab !== 'deploy' && autoDeploymentContext && !stableCoordinatorValues.isCoordinating) {
            const currentWorkflow = stableCoordinatorValues.projectWorkflow;
            
            if (!currentWorkflow) {
                log('AUTO_DEPLOYMENT_BRIDGE', '🔄 Clearing auto-deployment context (switched away from deploy tab)');
                setAutoDeploymentContext(null);
            }
        }
    }, [activeProjectTab, autoDeploymentContext, stableCoordinatorValues.isCoordinating, stableCoordinatorValues.projectWorkflow]);

    // Cleanup automation state on unmount
    useEffect(() => {
        return () => {
            if (ui.automationState.isActive) {
                log('CHAT_COORDINATION', '🧹 Cleaning up automation state on component unmount');
                resetAutomationUI();
            }
        };
    }, [ui.automationState.isActive, resetAutomationUI]);

    const currentProject = currentProjectData;
    const hasActiveProject = Boolean(activeProject);
    const shouldShowChatInterface = activeProjectTab === 'chat';
    // const shouldShowOverview = activeProjectTab === 'overview';  // TEMPORARILY COMMENTED OUT
    const shouldShowContext = activeProjectTab === 'context';
    const shouldShowDatabase = activeProjectTab === 'database';
    const shouldShowHosting = activeProjectTab === 'hosting';
    const shouldShowDeployment = activeProjectTab === 'deploy';
    const shouldShowPreview = activeProjectTab === 'preview';
    const shouldShowAgents = activeProjectTab === 'agents';  // REACTIVATED
    const shouldShowDomains = activeProjectTab === 'domains';  // NEW: Domain registration tab
    const shouldShowTabBar = tabGroups.length > 0 && hasActiveProject && shouldShowChatInterface;

    // ENHANCED: Create a dummy ref for backwards compatibility
    const dummyMessagesEndRef = useRef<HTMLDivElement>(null);

    // 🎯 COORDINATED LOADING FALLBACK for SidePane
    const CoordinatedSidePaneFallback = () => (
        <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: isMobile ? '100vw' : '50%',
            height: '100vh',
            background: 'rgba(30, 30, 30, 0.98)',
            backdropFilter: 'blur(12px) saturate(150%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5000
        }}>
            <div style={{
                width: isMobile ? '64px' : '72px',
                height: isMobile ? '64px' : '72px',
                marginBottom: '1.5rem',
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)',
                animation: 'kontextPulse 2s ease-in-out infinite'
            }}>
                <img 
                    src="https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/KCP_LOGO.webp"
                    alt="Kontext Logo"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        borderRadius: '16px'
                    }}
                />
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                    borderRadius: '16px',
                    animation: 'kontextShine 2s ease-in-out infinite'
                }} />
            </div>
            
            <div style={{
                color: '#ffffff',
                fontSize: isMobile ? '1rem' : '1.1rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
                textAlign: 'center'
            }}>
                Loading Code Editor
            </div>
            
            <div style={{
                color: '#ff6b35',
                fontSize: isMobile ? '0.85rem' : '0.9rem',
                fontWeight: 500,
                textAlign: 'center',
                opacity: 0.8
            }}>
                Preparing Monaco editor with coordination...
            </div>
            
            <div style={{
                marginTop: '2rem',
                display: 'flex',
                gap: '6px'
            }}>
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #ff6b35, #10b981)',
                            animation: `kontextDots 1.5s ease-in-out infinite`,
                            animationDelay: `${i * 0.2}s`
                        }}
                    />
                ))}
            </div>

            <style>{`
                @keyframes kontextPulse {
                    0%, 100% { 
                        transform: scale(1);
                        box-shadow: 0 8px 32px rgba(255, 107, 53, 0.3);
                    }
                    50% { 
                        transform: scale(1.05);
                        box-shadow: 0 12px 40px rgba(255, 107, 53, 0.5);
                    }
                }
                
                @keyframes kontextShine {
                    0%, 100% { 
                        transform: translateX(-100%) rotate(45deg);
                        opacity: 0;
                    }
                    50% { 
                        transform: translateX(100%) rotate(45deg);
                        opacity: 1;
                    }
                }
                
                @keyframes kontextDots {
                    0%, 60%, 100% { 
                        transform: scale(1);
                        opacity: 0.7;
                    }
                    30% { 
                        transform: scale(1.3);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );

    return (
        <>
            <StaticStyles />
            
            <IndependentSidebarToggle
                isCollapsed={sidebarCollapsed}
                sidebarOpen={ui.sidebar.isOpen}
                isMobile={isMobile}
                onToggle={handleToggleSidebarCollapsed}
            />

            {serverPairDialog.isOpen && (
              <Suspense fallback={<div />}>
                <ServerPairSelectionDialog />
              </Suspense>
            )}
            
            {/* Global Project Import Dialog */}
            <Suspense fallback={<div />}>
              <ProjectImportDialog />
            </Suspense>
            
            {/* NEW: Project Creation Dialog */}
            <Suspense fallback={<div />}>
              <ProjectCreationDialog
                  isOpen={isProjectCreationDialogOpen}
                  onClose={handleCloseProjectCreationDialog}
                  onCreateBlank={handleCreateBlankProject}
              />
            </Suspense>
            
            <div className="main-layout" style={{
                height: '100vh',
                width: '100vw',
                overflow: 'hidden',
                position: 'fixed',
                top: 0,
                left: 0,
                display: 'flex'
            }}>
                <Sidebar
                    projects={projects}
                    activeProject={activeProject || ''}
                    searchQuery={ui.sidebar.searchQuery}
                    sidebarOpen={ui.sidebar.isOpen}
                    isMobile={isMobile}
                    onSetSearchQuery={setSidebarSearchQuery}
                    onSelectProject={handleProjectSelect}
                    onCreateNewProject={handleCreateNewProject}
                    onSetSidebarOpen={setSidebarOpen}
                    onDeleteProject={handleProjectDelete}
                    onUpdateProject={updateProject}
                    isDeleting={false}
                    isCollapsed={sidebarCollapsed}
                    style={{
                        height: '100vh',
                        maxHeight: '100vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                />
                
                <div 
                    className={`main-content ${ui.sidePane.isOpen ? 'with-side-pane' : ''}`}
                    style={{
                        flex: 1,
                        height: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        position: 'relative'
                    }}
                >
                    <div 
                        className="chat-area"
                        style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        <div style={{ position: 'sticky', top: 0, flexShrink: 0 }}>
                            <ChatHeader
                                currentProjectTitle={currentProject?.title || (hasActiveProject ? 'Loading...' : 'No Project Selected')}
                                currentProjectIcon={currentProject?.icon || (hasActiveProject ? '📁' : '💬')}
                                isGenerating={generation.isGenerating}
                                isMobile={isMobile}
                                onToggleSidebar={() => setSidebarOpen(!ui.sidebar.isOpen)}
                                onCloseApp={onClose}
                                activeTab={activeProjectTab}
                                onTabChange={handleProjectTabChange}
                                projectId={activeProject}
                                selectedVersion={getSelectedVersion()}
                                onVersionChange={async (versionId) => {
                                    log('VERSION', `📌 [ChatInterface] Version changed to: ${versionId || 'Sandbox'}`);
                                    setSelectedVersion(versionId);
                                    
                                    // 🔥 FIX: Load version files when switching versions
                                    if (activeProject) {
                                        try {
                                            const { userCanisterService } = await import('../services/UserCanisterService');
                                            const { identity, userCanisterId } = get();
                                            
                                            if (!identity || !userCanisterId) {
                                                log('VERSION', '❌ Missing identity or userCanisterId');
                                                return;
                                            }
                                            
                                            if (versionId) {
                                                // Load files from the selected version
                                                log('VERSION', `📦 Loading files from version: ${versionId}`);
                                                const result = await userCanisterService.getProjectFiles(activeProject, versionId);
                                                
                                                if ('ok' in result && result.ok) {
                                                    const versionFiles: { [fileName: string]: string } = {};
                                                    
                                                    result.ok.forEach((artifact: any) => {
                                                        // Use path if available, otherwise fileName
                                                        const fileKey = artifact.path || artifact.fileName;
                                                        if (fileKey && artifact.content) {
                                                            versionFiles[fileKey] = artifact.content;
                                                        }
                                                    });
                                                    
                                                    log('VERSION', `✅ Loaded ${Object.keys(versionFiles).length} files from version ${versionId}`);
                                                    
                                                    // Update projectFiles state
                                                    set((state: any) => ({
                                                        projectFiles: {
                                                            ...state.projectFiles,
                                                            [activeProject]: versionFiles
                                                        }
                                                    }));
                                                    
                                                    // 🔥 CRITICAL: Update file tabs to reflect version files
                                                    const updateTabGroupsFunc = get().updateTabGroups;
                                                    if (typeof updateTabGroupsFunc === 'function') {
                                                        updateTabGroupsFunc();
                                                        log('VERSION', '🔄 File tabs updated for version');
                                                    }
                                                } else {
                                                    log('VERSION', `⚠️ No files found in version ${versionId}, clearing files`);
                                                    // Clear files if version has no content
                                                    set((state: any) => ({
                                                        projectFiles: {
                                                            ...state.projectFiles,
                                                            [activeProject]: {}
                                                        }
                                                    }));
                                                }
                                            } else {
                                                // Switching back to Sandbox - reload working copy
                                                log('VERSION', '🔧 Loading files from working copy (Sandbox)');
                                                const result = await userCanisterService.loadCodeArtifacts(
                                                    activeProject,
                                                    userCanisterId,
                                                    identity
                                                );
                                                
                                                if (result.success && result.artifacts) {
                                                    const sandboxFiles: { [fileName: string]: string } = {};
                                                    
                                                    result.artifacts.forEach((artifact: any) => {
                                                        // Skip WASM files
                                                        if (artifact.fileName?.endsWith('.wasm')) return;
                                                        
                                                        const fileKey = artifact.path || artifact.fileName;
                                                        if (fileKey && artifact.content) {
                                                            sandboxFiles[fileKey] = artifact.content;
                                                        }
                                                    });
                                                    
                                                    log('VERSION', `✅ Loaded ${Object.keys(sandboxFiles).length} files from Sandbox`);
                                                    
                                                    // Update projectFiles state
                                                    set((state: any) => ({
                                                        projectFiles: {
                                                            ...state.projectFiles,
                                                            [activeProject]: sandboxFiles
                                                        }
                                                    }));
                                                    
                                                    // 🔥 CRITICAL: Update file tabs to reflect sandbox files
                                                    const updateTabGroupsFunc = get().updateTabGroups;
                                                    if (typeof updateTabGroupsFunc === 'function') {
                                                        updateTabGroupsFunc();
                                                        log('VERSION', '🔄 File tabs updated for Sandbox');
                                                    }
                                                }
                                            }
                                        } catch (error) {
                                            log('VERSION', '❌ Failed to load version files:', error);
                                        }
                                    }
                                }}
                            />
                            
                            {shouldShowTabBar && (
                                <div style={{
                                    borderTop: isMobile ? '1px solid var(--border-color)' : '1.5px solid var(--border-color)',
                                    borderBottom: isMobile ? '1px solid var(--border-color)' : '3px solid var(--border-color)',
                                    background: 'rgba(255, 255, 255, 0.02)'
                                }}>
                                    <TabBar />
                                </div>
                            )}
                        </div>
                        
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            minHeight: 0,
                            position: 'relative'
                        }}>
                            {shouldShowChatInterface && (
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    minHeight: 0
                                }}>
                                    <div style={{
                                        flex: 1,
                                        overflow: 'hidden',
                                        minHeight: 0
                                    }}>
                                        <MessageList
                                            messages={currentMessages}
                                            isGenerating={generation.isGenerating}
                                            isStreaming={streamingState.isStreaming}
                                            streamingContent={streamingState.streamingContent}
                                            streamingState={streamingState}
                                            progress={generation.progress}
                                            streamingProgress={generation.streamingProgress}
                                            streamingMessage={generation.streamingMessage}
                                            isMobile={isMobile}
                                            messagesEndRef={dummyMessagesEndRef}
                                            hasActiveProject={hasActiveProject}
                                            isMessagePending={isMessagePending}
                                            showKLoadingAnimation={showKLoadingAnimation}
                                            chatKAnimation={chatKAnimation}
                                            onTabSwitch={handleProjectTabChange}
                                            onAutoStartDeployment={handleAutoStartDeployment}
                                            onSubmitMessage={handleSubmitFixMessage}
                                            onUserActionScroll={handleUserActionScroll}
                                            autoRetryCoordinatorState={autoRetryCoordinatorState}
                                        />
                                    </div>
                                    
                                    <div style={{
                                        position: 'sticky',
                                        bottom: 0,
                                        flexShrink: 0,
                                        backgroundColor: 'var(--bg-dark)',
                                        borderTop: isMobile ? '1px solid var(--border-color)' : '3px solid var(--border-color)'
                                    }}>
                                        <ChatInput
                                            input={input}
                                            setInput={setInput}
                                            onSend={async (files, images) => {
                                                // Store files/images temporarily in store for sendMessage
                                                const store = useAppStore.getState();
                                                if (store.setPendingAttachments) {
                                                    // Convert AttachedFile to PendingAttachment format
                                                    const pendingFiles = files ? files.map(f => ({
                                                        id: f.id,
                                                        name: f.name,
                                                        type: f.type,
                                                        size: f.size,
                                                        base64Data: f.base64Data,
                                                        textContent: f.textContent
                                                    })) : null;
                                                    
                                                    // Convert AttachedImage to PendingImage format
                                                    const pendingImages = images ? images.map(img => ({
                                                        id: img.id,
                                                        name: img.name,
                                                        type: img.type,
                                                        size: img.size,
                                                        base64Data: img.base64Data,
                                                        mediaType: img.mediaType
                                                    })) : null;
                                                    
                                                    store.setPendingAttachments(pendingFiles, pendingImages);
                                                }
                                                await handleSend();
                                            }}
                                            isGenerating={generation.isGenerating}
                                            isMobile={isMobile}
                                            inputRef={inputRef}
                                            hasActiveProject={hasActiveProject}
                                            setMessagePending={setMessagePending}
                                            isDeploymentActive={autoRetryCoordinatorState.isCoordinating}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {/* TEMPORARILY COMMENTED OUT - Overview tab */}
                            {/* {shouldShowOverview && (
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                    <ProjectOverview />
                                </div>
                            )} */}
                            
                            {shouldShowContext && (
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, position: 'relative' }}>
                                    <ContextInterface />
                                </div>
                            )}
                            
                            {shouldShowDatabase && hasActiveProject && (
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                    <DatabaseWrapper 
                                        projectId={activeProject || ''}
                                        projectName={currentProject?.name || 'Current Project'}
                                        selectedServerPair={activeServerPair}
                                    />
                                </div>
                            )}

                            {shouldShowDatabase && !hasActiveProject && (
                                <div style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column', gap: '1rem', padding: '2rem', color: 'var(--text-gray)', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '3rem', opacity: 0.5 }}>🗄️</div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                                        Select a Project First
                                    </h3>
                                    <p style={{ fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px', margin: 0, opacity: 0.8 }}>
                                        Please select or create a project in the sidebar to access the database interface.
                                    </p>
                                </div>
                            )}
                            
                            {shouldShowHosting && hasActiveProject && (
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                    <HostingInterface 
                                        projectId={activeProject || ''}
                                        projectName={currentProject?.name || 'Current Project'}
                                        userCanisterId={userCanisterId}
                                        selectedServerPair={activeServerPair}
                                    />
                                </div>
                            )}
                            
                            {shouldShowHosting && !hasActiveProject && (
                                <div style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column', gap: '1rem', padding: '2rem', color: 'var(--text-gray)', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '3rem', opacity: 0.5 }}>🏗️</div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                                        Select a Project First
                                    </h3>
                                    <p style={{ fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px', margin: 0, opacity: 0.8 }}>
                                        Please select or create a project in the sidebar to access hosting features.
                                    </p>
                                </div>
                            )}

                            {shouldShowDeployment && hasActiveProject && (
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                    <DeploymentInterface 
                                        projectId={activeProject || ''}
                                        projectName={currentProject?.name || 'Current Project'}
                                        userCanisterId={userCanisterId}
                                        autoDeploymentContext={autoDeploymentContext}
                                        isActive={activeProjectTab === 'deploy'}
                                        selectedVersion={getSelectedVersion()}
                                        versionString={getSelectedVersion() ? getSelectedVersionString() : null}
                                    />
                                </div>
                            )}
                            
                            {shouldShowDeployment && !hasActiveProject && (
                                <div style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column', gap: '1rem', padding: '2rem', color: 'var(--text-gray)', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '3rem', opacity: 0.5 }}>🚀</div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                                        Select a Project First
                                    </h3>
                                    <p style={{ fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px', margin: 0, opacity: 0.8 }}>
                                        Please select or create a project in the sidebar to access deployment features.
                                    </p>
                                </div>
                            )}

                            {shouldShowPreview && hasActiveProject && (
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, height: '100%' }}>
                                    <LivePreviewInterface 
                                        projectId={activeProject || ''}
                                        projectName={currentProject?.name || 'Current Project'}
                                        selectedServerPair={activeServerPair}
                                    />
                                </div>
                            )}
                            
                            {shouldShowPreview && !hasActiveProject && (
                                <div style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column', gap: '1rem', padding: '2rem', color: 'var(--text-gray)', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '3rem', opacity: 0.5 }}>👁️</div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                                        Select a Project First
                                    </h3>
                                    <p style={{ fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px', margin: 0, opacity: 0.8 }}>
                                        Please select or create a project in the sidebar to preview your deployed applications.
                                    </p>
                                </div>
                            )}

                            {/* Agents tab - REACTIVATED */}
                            {shouldShowAgents && hasActiveProject && (
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, height: '100%' }}>
                                    <Suspense fallback={
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '100%',
                                            gap: '1rem',
                                            color: 'var(--text-gray)'
                                        }}>
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                border: '3px solid rgba(255, 255, 255, 0.1)',
                                                borderTopColor: 'var(--accent-green)',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite'
                                            }} />
                                            <style>{`
                                                @keyframes spin {
                                                    to { transform: rotate(360deg); }
                                                }
                                            `}</style>
                                            <p style={{ fontSize: '0.9375rem', opacity: 0.8 }}>Loading agent management...</p>
                                        </div>
                                    }>
                                        <AgentManagementInterface />
                                    </Suspense>
                                </div>
                            )}
                            
                            {shouldShowAgents && !hasActiveProject && (
                                <div style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column', gap: '1rem', padding: '2rem', color: 'var(--text-gray)', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '3rem', opacity: 0.5 }}>🤖</div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                                        Select a Project First
                                    </h3>
                                    <p style={{ fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px', margin: 0, opacity: 0.8 }}>
                                        Please select or create a project in the sidebar to manage AI agents.
                                    </p>
                                </div>
                            )}

                            {/* Domains tab - NEW */}
                            {shouldShowDomains && hasActiveProject && (
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, height: '100%' }}>
                                    <Suspense fallback={
                                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888'}}>
                                            Loading Domains...
                                        </div>
                                    }>
                                        <DomainInterface 
                                            projectId={activeProject || ''}
                                            projectName={currentProject?.name || 'Current Project'}
                                            userCanisterId={userCanisterId}
                                        />
                                    </Suspense>
                                </div>
                            )}
                            
                            {shouldShowDomains && !hasActiveProject && (
                                <div style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column', gap: '1rem', padding: '2rem', color: 'var(--text-gray)', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '3rem', opacity: 0.5 }}>🌐</div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                                        Select a Project First
                                    </h3>
                                    <p style={{ fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px', margin: 0, opacity: 0.8 }}>
                                        Please select or create a project in the sidebar to purchase domains.
                                    </p>
                                </div>
                            )}
                            
                            {!shouldShowChatInterface && !shouldShowContext && !shouldShowDatabase && 
                             !shouldShowHosting && !shouldShowDeployment && !shouldShowPreview && !shouldShowAgents && !shouldShowDomains && (
                                <div style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column', gap: '1rem', padding: '2rem', color: 'var(--text-gray)', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '3rem', opacity: 0.5 }}>
                                        {(activeProjectTab === 'inspector' && '🔍') ||
                                         (activeProjectTab === 'overview' && '📊') ||
                                         (activeProjectTab === 'agents' && '🤖') ||
                                         '🚧'}
                                    </div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0, textTransform: 'capitalize' }}>
                                        {activeProjectTab === 'inspector' ? 'Inspector Tab (Coming Soon)' :
                                         activeProjectTab === 'overview' ? 'Overview Tab (Coming Soon)' :
                                         `${activeProjectTab} Tab`}
                                    </h3>
                                    <p style={{ fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px', margin: 0, opacity: 0.8 }}>
                                        {(activeProjectTab === 'inspector' || activeProjectTab === 'overview') ?
                                         'This tab is temporarily hidden while we finalize its features. It will be available in upcoming updates.' :
                                         'This tab will be implemented in future updates.'
                                        }
                                        {' '}Click the Chat, Context, Database, Hosting, Deploy, Agents, or Live Preview tab to explore your project.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* ✅ ENHANCED: Coordinated SidePane with beautiful loading fallback */}
                {ui.sidePane.isOpen && (
                    <Suspense fallback={<CoordinatedSidePaneFallback />}>
                        <SidePane />
                    </Suspense>
                )}
            </div>
        </>
    );
};