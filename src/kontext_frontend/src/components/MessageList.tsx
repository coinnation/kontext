import React, { useRef, useEffect, useState, useCallback } from 'react';
import { InitializationProgress, useAppStore } from '../store/appStore';
import { useFileApply } from '../store/appStore';
import { StreamingState, ChatInterfaceMessage } from '../types';
import { DeploymentButton } from './DeploymentButton';
import { projectCreationCoordinator } from '../services/ProjectCreationCoordinator';
import { DeploymentContext } from '../types/deploymentCoordination';
import { FilePhaseInfo } from '../services/FileDetectionPhaseManager';
import { messageCoordinator, MessageCoordinatorState } from '../services/MessageCoordinator';
import { autoRetryCoordinator } from '../services/AutoRetryCoordinator';
import { useSmartScroll } from '../hooks/useSmartScroll';
import { verboseLog } from '../utils/verboseLogging';

interface MessageListProps {
    messages: ChatInterfaceMessage[];
    isGenerating: boolean;
    isStreaming: boolean;
    streamingContent: string;
    streamingState: StreamingState;
    progress: InitializationProgress;
    streamingProgress: number;
    streamingMessage: string;
    isMobile: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    hasActiveProject: boolean;
    isMessagePending: boolean;
    onTabSwitch: (tab: string) => void;
    onAutoStartDeployment: (context: DeploymentContext) => Promise<void>;
    onSubmitMessage: (message: string) => Promise<void>;
    // NEW: Scroll control props
    onUserActionScroll?: () => void;
    // NEW: Auto-retry coordination props
    autoRetryCoordinatorState?: {
        isCoordinating: boolean;
        workflows: any[];
        projectMappings: { [projectId: string]: string };
        storeConnected: boolean;
        lastActivity: number;
    };
}

const formatTimestamp = (timestamp: Date): string => {
    try {
        const now = new Date();
        const diffMs = now.getTime() - timestamp.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return timestamp.toLocaleDateString();
    } catch (error) {
        console.warn('Invalid timestamp format:', timestamp);
        return 'Invalid time';
    }
};

const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy text:', err);
        // Fallback for older browsers
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (fallbackErr) {
            return false;
        }
    }
};

const getFileTypeIcon = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'mo': return '🔧';
        case 'tsx':
        case 'ts': return '⚛️';
        case 'jsx':
        case 'js': return '🟨';
        case 'css': return '🎨';
        case 'json': return '📋';
        case 'md': return '📝';
        default: return '📄';
    }
};

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    isGenerating,
    isStreaming,
    progress,
    streamingProgress,
    streamingMessage,
    streamingContent,
    streamingState,
    isMobile,
    messagesEndRef: externalMessagesEndRef,
    hasActiveProject,
    isMessagePending,
    onTabSwitch,
    onAutoStartDeployment,
    onSubmitMessage,
    onUserActionScroll,
    autoRetryCoordinatorState
}) => {
    const { fileApplyState, startFileApplication } = useFileApply();
    
    // ENHANCED: Use smart scroll hook with all new scroll methods
    const {
        scrollContainerRef,
        messagesEndRef,
        scrollToBottom,
        forceScrollToBottom,
        scrollForUserAction,
        scrollForSystemResponse,
        scrollForManualButton,
        autoScroll,
        isUserScrolling,
        isNearBottom
    } = useSmartScroll({
        threshold: isMobile ? 150 : 100,
        debounceMs: 100,
        mobileOffset: 200, // Increased base offset
        behavior: 'smooth'
    });

    // Calculate chat input height dynamically for proper button positioning
    const [chatInputHeight, setChatInputHeight] = useState<number>(isMobile ? 120 : 100);
    
    useEffect(() => {
        const updateChatInputHeight = () => {
            // Find the chat input element
            const chatInput = document.querySelector('[data-chat-input]') as HTMLElement;
            if (chatInput) {
                const height = chatInput.offsetHeight;
                setChatInputHeight(height + 20); // Add 20px spacing
            } else {
                // Fallback to default heights
                setChatInputHeight(isMobile ? 120 : 100);
            }
        };

        // Initial calculation
        updateChatInputHeight();

        // Update on resize
        window.addEventListener('resize', updateChatInputHeight);
        
        // Use ResizeObserver for more accurate tracking
        const chatInput = document.querySelector('[data-chat-input]') as HTMLElement;
        if (chatInput && window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                updateChatInputHeight();
            });
            resizeObserver.observe(chatInput);
            
            return () => {
                window.removeEventListener('resize', updateChatInputHeight);
                resizeObserver.disconnect();
            };
        }

        return () => {
            window.removeEventListener('resize', updateChatInputHeight);
        };
    }, [isMobile]);

    // Sync external messagesEndRef with internal one
    useEffect(() => {
        if (externalMessagesEndRef && messagesEndRef.current) {
            // Keep external ref in sync for backwards compatibility
            (externalMessagesEndRef as any).current = messagesEndRef.current;
        }
    }, [externalMessagesEndRef, messagesEndRef]);

    // CRITICAL FIX: Enhanced deployment state subscription with proper reactivity
    const deploymentCoordinationState = useAppStore(state => state.deploymentCoordination);
    
    // CRITICAL FIX: Get active project ID from store
    const activeProjectId = useAppStore(state => state.activeProject);
    const projects = useAppStore(state => state.projects);
    
    // FIXED: MessageCoordinator state with stable reference
    const [coordinatorState, setCoordinatorState] = useState<MessageCoordinatorState>(messageCoordinator.getCurrentState());
    
    // OPTION 4: Get UI override state for instant K animation hiding
    const uiState = useAppStore(state => state.ui);
    const instantKAnimationOverride = uiState.instantKAnimationOverride;
    
    // CRITICAL FIX: Stable reference tracking to prevent infinite renders
    const lastCoordinatorStateRef = useRef<MessageCoordinatorState>(coordinatorState);
    const renderCountRef = useRef<number>(0);
    const lastRenderTime = useRef<number>(Date.now());
    
    // NEW: Auto-retry workflow state tracking
    const [currentAutoRetryWorkflow, setCurrentAutoRetryWorkflow] = useState<any>(null);

    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    // ENHANCED: Content change tracking for smart scrolling with immediate triggers
    const lastMessageCountRef = useRef<number>(messages.length);
    const lastStreamingContentRef = useRef<string>('');
    const lastCoordinatorExclusiveRef = useRef<boolean>(false);
    const lastCoordinatorPureVisualRef = useRef<boolean>(false);

    const handleCopyMessage = useCallback(async (messageId: string, content: string) => {
        const success = await copyToClipboard(content);
        if (success) {
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
        }
    }, []);
    
    // CRITICAL FIX: Circuit breaker for infinite renders
    const isRenderingTooFrequently = useCallback((): boolean => {
        const now = Date.now();
        const timeSinceLastRender = now - lastRenderTime.current;
        
        if (timeSinceLastRender < 50) { // Less than 50ms between renders
            renderCountRef.current++;
            if (renderCountRef.current > 10) {
                console.warn('🚨 [MessageList] Render frequency too high, applying circuit breaker');
                return true;
            }
        } else {
            renderCountRef.current = 0; // Reset counter if enough time has passed
        }
        
        lastRenderTime.current = now;
        return false;
    }, []);
    
    // FIXED: MessageCoordinator subscription with immediate scroll triggers
    useEffect(() => {
        console.log('🎭 [MessageList] Subscribing to MessageCoordinator with immediate scroll triggers...');
        
        const unsubscribe = messageCoordinator.subscribe((newState) => {
            // CRITICAL FIX: Only update if state actually changed
            const stateChanged = 
                newState.displayState !== lastCoordinatorStateRef.current.displayState ||
                newState.exclusiveRenderingActive !== lastCoordinatorStateRef.current.exclusiveRenderingActive ||
                newState.showKLoadingAnimation !== lastCoordinatorStateRef.current.showKLoadingAnimation ||
                newState.activeMessageId !== lastCoordinatorStateRef.current.activeMessageId ||
                newState.kLoadingMessage !== lastCoordinatorStateRef.current.kLoadingMessage ||
                newState.pureVisualState !== lastCoordinatorStateRef.current.pureVisualState ||
                newState.visualStateMessage !== lastCoordinatorStateRef.current.visualStateMessage;
            
            if (!stateChanged) {
                return; // Skip update if nothing changed
            }
            
            // CRITICAL FIX: Circuit breaker check
            if (isRenderingTooFrequently()) {
                return; // Skip update if rendering too frequently
            }
            
            // console.log('🎭 [MessageList] MessageCoordinator state updated:', {
            //     displayState: newState.displayState,
            //     exclusive: newState.exclusiveRenderingActive,
            //     showK: newState.showKLoadingAnimation,
            //     pureVisual: newState.pureVisualState,
            //     visualMessage: newState.visualStateMessage,
            //     controlledCount: newState.controlledMessages.size,
            //     activeMessage: newState.activeMessageId?.substring(newState.activeMessageId.length - 8) || 'none'
            // });

            // SCENARIO 3: Immediate scroll when K animation appears
            const kAnimationAppearing = (
                (newState.exclusiveRenderingActive && !lastCoordinatorStateRef.current.exclusiveRenderingActive) ||
                (newState.pureVisualState && !lastCoordinatorStateRef.current.pureVisualState)
            );

            if (kAnimationAppearing) {
                // console.log('🚀 [SCENARIO 3] K animation appearing - immediate scroll!');
                // Use setTimeout to ensure the K animation DOM element is rendered
                setTimeout(() => {
                    scrollForSystemResponse();
                }, 50);
            }
            
            lastCoordinatorStateRef.current = newState;
            setCoordinatorState({ ...newState });
        });
        
        console.log('🎭 [MessageList] MessageCoordinator subscription established');
        return unsubscribe;
    }, [isRenderingTooFrequently, scrollForSystemResponse]);
    
    // NEW: Auto-retry coordinator subscription for workflow state
    useEffect(() => {
        if (!activeProjectId) return;
        
        console.log('🤖 [MessageList] Setting up AutoRetryCoordinator subscription for project:', activeProjectId);
        
        const unsubscribe = autoRetryCoordinator.subscribe((state) => {
            // Find active workflow for current project
            const projectWorkflow = state.workflows.find(w => w.projectId === activeProjectId);
            
            if (projectWorkflow !== currentAutoRetryWorkflow) {
                console.log('🤖 [MessageList] Auto-retry workflow state changed:', {
                    previousWorkflow: currentAutoRetryWorkflow?.workflowId || 'none',
                    newWorkflow: projectWorkflow?.workflowId || 'none',
                    phase: projectWorkflow?.phase || 'none',
                    projectId: activeProjectId
                });
                
                setCurrentAutoRetryWorkflow(projectWorkflow || null);
            }
        });
        
        return unsubscribe;
    }, [activeProjectId, currentAutoRetryWorkflow]);
    
    // Get current file detection phase info from store
    const currentPhaseInfo = (window as any).useAppStore?.getState?.()?.getCurrentPhaseInfo?.() as FilePhaseInfo | null;

    // ENHANCED: Centralized scroll management with immediate triggers for different scenarios
    useEffect(() => {
        // Detect what content has changed
        const messageCountChanged = messages.length !== lastMessageCountRef.current;
        const streamingContentChanged = streamingContent !== lastStreamingContentRef.current;
        const exclusiveStateChanged = coordinatorState.exclusiveRenderingActive !== lastCoordinatorExclusiveRef.current;
        const pureVisualStateChanged = coordinatorState.pureVisualState !== lastCoordinatorPureVisualRef.current;
        
        const anyContentChanged = messageCountChanged || streamingContentChanged || exclusiveStateChanged || pureVisualStateChanged;
        
        // SCENARIO 4: System generates a message
        if (messageCountChanged && !isRenderingTooFrequently()) {
            const messageCountIncreased = messages.length > lastMessageCountRef.current;
            
            if (messageCountIncreased) {
                // console.log('🚀 [SCENARIO 4] System message appeared - immediate scroll!');
                // Check if the new message is from the system
                const newestMessage = messages[messages.length - 1];
                if (newestMessage && newestMessage.type === 'system') {
                    setTimeout(() => {
                        scrollForSystemResponse();
                    }, 50);
                } else {
                    // User message appeared (shouldn't happen here, but handle it)
                    setTimeout(() => {
                        scrollForUserAction();
                    }, 50);
                }
            }
        }
        
        // Handle streaming content changes
        // ✅ NEW: Only auto-scroll if user is near bottom (respects user scrolling up)
        if (streamingContentChanged && !isRenderingTooFrequently() && isNearBottom) {
            // console.log('📜 [MessageList] Streaming content changed - scroll for system response');
            setTimeout(() => {
                scrollForSystemResponse();
            }, 50);
        }
        
        // Update refs for next comparison
        lastMessageCountRef.current = messages.length;
        lastStreamingContentRef.current = streamingContent;
        lastCoordinatorExclusiveRef.current = coordinatorState.exclusiveRenderingActive;
        lastCoordinatorPureVisualRef.current = coordinatorState.pureVisualState;
    }, [
        messages.length, 
        streamingContent, 
        isStreaming, 
        coordinatorState.exclusiveRenderingActive, 
        coordinatorState.pureVisualState,
        scrollForSystemResponse,
        scrollForUserAction,
        isRenderingTooFrequently,
        isNearBottom
    ]);

    // NEW: Expose user action scroll to parent
    useEffect(() => {
        if (onUserActionScroll) {
            // Override the callback to use our enhanced scroll
            (onUserActionScroll as any) = scrollForUserAction;
        }
    }, [onUserActionScroll, scrollForUserAction]);

    const isValidStreamContent = (content: string): boolean => {
        if (!content || typeof content !== 'string') return false;
        if (content.length === 0) return false;
        
        const repetitionPattern = /(.{30,}?)\1{3,}/;
        if (repetitionPattern.test(content)) {
            console.warn('MessageList: Detected repetitive streaming content, skipping display');
            return false;
        }
        
        return true;
    };

    const handleDeployClick = useCallback(async (context: DeploymentContext) => {
        try {
            await projectCreationCoordinator.startDeployment(
                context.messageId,
                onTabSwitch,
                onAutoStartDeployment
            );
        } catch (error) {
            console.error('Failed to start deployment:', error);
        }
    }, [onTabSwitch, onAutoStartDeployment]);

    const handleViewAppClick = useCallback((url: string) => {
        onTabSwitch('preview');
    }, [onTabSwitch]);

    // NEW: Enhanced auto-retry workflow detection
    const isActiveAutoRetryWorkflow = useCallback((): boolean => {
        if (!activeProjectId || !currentAutoRetryWorkflow) return false;
        
        // Check if workflow is for current project and in active phase
        const isCurrentProject = currentAutoRetryWorkflow.projectId === activeProjectId;
        const isActivePhase = ['FILE_GENERATION', 'FILE_APPLICATION'].includes(currentAutoRetryWorkflow.phase);
        const isRecentlyActive = (Date.now() - currentAutoRetryWorkflow.lastActivity) < 30000; // 30 seconds
        
        const isActive = isCurrentProject && isActivePhase && isRecentlyActive;
        
        if (isActive) {
            console.log('🤖 [MessageList] Active auto-retry workflow detected:', {
                workflowId: currentAutoRetryWorkflow.workflowId,
                phase: currentAutoRetryWorkflow.phase,
                projectId: currentAutoRetryWorkflow.projectId,
                age: Date.now() - currentAutoRetryWorkflow.lastActivity
            });
        }
        
        return isActive;
    }, [activeProjectId, currentAutoRetryWorkflow]);

    const shouldShowDeployButton = (message: ChatInterfaceMessage): boolean => {
        const hasFiles = message.extractedFiles && Object.keys(message.extractedFiles).length > 0;
        const isNotGenerating = !message.isGenerating;
        const isSystemMessage = message.type === 'system';
        
        // CRITICAL: Don't show deploy buttons on transitional messages
        const isTransitionalMessage = messageCoordinator.isControllingMessage(message.id);
        if (isTransitionalMessage) {
            return false;
        }
        
        // NEW: Don't show deploy buttons during active auto-retry workflows
        if (isActiveAutoRetryWorkflow()) {
            console.log('🤖 [MessageList] Suppressing deploy button due to active auto-retry workflow');
            return false;
        }
        
        // ✅ FIXED: Check explicit flag FIRST and be more specific about project generation
        const isExplicitProjectGeneration = message.isProjectGeneration === true;
        const hasDeploymentContext = !!message.deploymentReady;
        const hasProjectGenerationContent = message.content.toLowerCase().includes('ready to deploy') ||
            message.content.toLowerCase().includes('generation complete') ||
            message.content.toLowerCase().includes('project generation complete');

        // Show deploy button for explicit project generation OR messages with deployment readiness
        const isProjectGeneration = isExplicitProjectGeneration || hasDeploymentContext || hasProjectGenerationContent;

        return isSystemMessage && isNotGenerating && hasFiles && isProjectGeneration;
    };

    // ENHANCED: Apply button logic with auto-retry coordination
    const shouldShowApplyButton = (message: ChatInterfaceMessage): boolean => {
        // Don't show apply buttons on transitional messages
        const isTransitionalMessage = messageCoordinator.isControllingMessage(message.id);
        if (isTransitionalMessage) {
            return false;
        }
        
        // Show apply button for any message with extracted files from update requests
        // Automation status should only affect auto-triggering, not button visibility
        const basicConditions = (
            message.type === 'system' &&
            !message.isGenerating &&
            message.extractedFiles &&
            Object.keys(message.extractedFiles).length > 0 &&
            !message.isProjectGeneration &&
            !shouldShowDeployButton(message)
        );
        
        // Check if files have already been applied
        const filesAlreadyApplied = currentAutoRetryWorkflow?.fileApplicationTriggered === true;
        
        if (basicConditions) {
            // Show button while applying OR when ready, hide only after successfully applied
            const shouldShow = !filesAlreadyApplied;
            
            verboseLog('MessageList', 'Apply button visibility check:', {
                messageId: message.id,
                fileCount: Object.keys(message.extractedFiles || {}).length,
                shouldShow,
                isApplying: fileApplyState.isApplying,
                filesAlreadyApplied,
                autoRetryActive: isActiveAutoRetryWorkflow()
            });
            
            return shouldShow;
        }
        
        return false;
    };

    // NEW: Show auto-retry status for messages during active workflows
    const shouldShowAutoRetryStatus = (message: ChatInterfaceMessage): boolean => {
        if (!isActiveAutoRetryWorkflow()) return false;
        
        const hasFiles = message.extractedFiles && Object.keys(message.extractedFiles).length > 0;
        const isSystemMessage = message.type === 'system';
        const isNotGenerating = !message.isGenerating;
        
        // Show status for messages with files during auto-retry
        return isSystemMessage && isNotGenerating && hasFiles;
    };

    // Get status text from MessageCoordinator state
    const getStatusText = (): string => {
        if (coordinatorState.currentOwner === 'FILE_MANAGER' && currentPhaseInfo && currentPhaseInfo.phase !== 'thinking' && currentPhaseInfo.detectedFiles.length > 0) {
            return `${currentPhaseInfo.phase.charAt(0).toUpperCase() + currentPhaseInfo.phase.slice(1)}...`;
        }
        
        // CRITICAL FIX: Handle pure visual state
        if (coordinatorState.pureVisualState) {
            return 'Thinking...';
        }
        
        switch (coordinatorState.displayState) {
            case 'THINKING': return 'Analyzing...';
            case 'STREAMING': return 'Writing...';
            case 'COMPLETED': return 'Complete!';
            default:
                switch (coordinatorState.currentPhase) {
                    case 'specification': return 'Analyzing...';
                    case 'template_selection': return 'Planning...';
                    case 'backend_preparation': return 'Preparing Backend...';
                    case 'frontend_preparation': return 'Preparing Frontend...';
                    case 'complete': return 'Complete!';
                    default: return coordinatorState.isGenerating ? 'Generating...' : 'Ready';
                }
        }
    };

    // NEW: Get auto-retry status text
    const getAutoRetryStatusText = (): string => {
        if (!currentAutoRetryWorkflow) return '';
        
        switch (currentAutoRetryWorkflow.phase) {
            case 'FILE_GENERATION': return 'Auto-retry: Generating fixed code...';
            case 'FILE_APPLICATION': return 'Auto-retry: Applying fixed files...';
            case 'DEPLOYMENT': return 'Auto-retry: Deploying fixed version...';
            default: return 'Auto-retry: Processing...';
        }
    };

    // CRITICAL FIX: Enhanced deployment button state retrieval
    const getDeploymentButtonState = useCallback((messageId: string) => {
        // Use the deployment coordination state directly from the store
        return deploymentCoordinationState.deploymentStates[messageId] || { status: 'ready' };
    }, [deploymentCoordinationState.deploymentStates, deploymentCoordinationState.lastUpdateTime]);

    // CRITICAL FIX: Get actual project name from store
    const getActualProjectName = useCallback((): string => {
        if (!activeProjectId) return 'Generated Project';
        
        const project = projects.find(p => p.id === activeProjectId);
        return project?.name || 'Generated Project';
    }, [activeProjectId, projects]);

    // FIXED: Render messages with proper transitional message handling
    const renderMessage = (message: ChatInterfaceMessage) => {
        const isTransitionalMessage = messageCoordinator.isControllingMessage(message.id);
        const isActiveTransitionalMessage = coordinatorState.activeMessageId === message.id;
        
        // CRITICAL FIX: Clean transitional message logic
        if (isTransitionalMessage) {
            if (!isActiveTransitionalMessage) {
                // FIXED: Don't spam console and don't render old transitional messages
                return null;
            }
            
            if (coordinatorState.exclusiveRenderingActive && isActiveTransitionalMessage) {
                // Active transitional message - let K animation handle it
                return null;
            }
        }
        
        // If streaming and this is the active streaming message, don't render the stored version
        if (message.isGenerating && isStreaming && streamingState.streamingMessageId === message.id && !isTransitionalMessage) {
            return null;
        }

        // PERSISTENT CONTENT MESSAGE: Render normally
        return renderPersistentMessage(message);
    };

    const renderPersistentMessage = (message: ChatInterfaceMessage) => {
        if (message.type === 'user') {
            return (
                <div key={message.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    alignSelf: 'flex-end',
                    maxWidth: '75%',
                    marginBottom: '16px'
                }}>
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--text-gray)',
                        fontWeight: '500',
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>You</span>
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>
                            {formatTimestamp(message.timestamp)}
                        </span>
                    </div>
                    <div style={{
                        position: 'relative',
                        padding: isMobile ? '12px 16px' : '16px 20px',
                        borderRadius: '16px 16px 4px 16px',
                        backgroundColor: 'var(--accent-orange)',
                        color: '#ffffff',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)',
                        paddingRight: isMobile ? '40px' : '50px' // Make room for copy button
                    }}>
                        {message.content}
                        
                        {/* Copy button */}
                        <button
                            onClick={() => handleCopyMessage(message.id, message.content)}
                            style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                background: 'rgba(0, 0, 0, 0.2)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: isMobile ? '8px' : '6px 8px',
                                cursor: 'pointer',
                                color: '#ffffff',
                                fontSize: isMobile ? '14px' : '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s ease',
                                opacity: isMobile ? '1' : '0.7', // Always visible on mobile
                                minWidth: isMobile ? '32px' : 'auto',
                                minHeight: isMobile ? '32px' : 'auto',
                                justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                                if (!isMobile) {
                                    e.currentTarget.style.opacity = '1';
                                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isMobile) {
                                    e.currentTarget.style.opacity = '0.7';
                                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)';
                                }
                            }}
                            title="Copy message"
                        >
                            {copiedMessageId === message.id ? '✓' : '📋'}
                        </button>
                    </div>
                </div>
            );
        }

        // PERSISTENT AI Assistant message
        const extractedFiles = message.extractedFiles || {};
        const hasFiles = Object.keys(extractedFiles).length > 0;
        const showDeployButton = shouldShowDeployButton(message);
        const showApplyButton = shouldShowApplyButton(message);
        const showAutoRetryStatus = shouldShowAutoRetryStatus(message);

        let deploymentContext: DeploymentContext | null = null;
        
        // CRITICAL FIX: Enhanced deployment button state retrieval
        let deploymentState = getDeploymentButtonState(message.id);

        if (showDeployButton) {
            deploymentContext = projectCreationCoordinator.getDeploymentContext(message.id);
            
            if (!deploymentContext && hasActiveProject && hasFiles && activeProjectId) {
                console.log('🚀 [DEPLOY FIX] Creating missing deployment context for message:', message.id);
                
                // CRITICAL FIX: Use ACTUAL project ID from store instead of hardcoded 'current-project'
                const actualProjectName = getActualProjectName();
                
                console.log('✅ [DEPLOY FIX] Using REAL project ID:', activeProjectId);
                console.log('✅ [DEPLOY FIX] Using REAL project name:', actualProjectName);
                
                deploymentContext = projectCreationCoordinator.createDeploymentContext(
                    message.id,
                    activeProjectId,  // ← REAL project ID from store!
                    actualProjectName,  // ← REAL project name from store!
                    extractedFiles
                );
                
                console.log('🚀 [DEPLOY FIX] Created deployment context with REAL IDs:', deploymentContext);
            }
        }

        return (
            <div key={message.id} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignSelf: 'flex-start',
                maxWidth: '85%',
                marginBottom: '16px'
            }}>
                <div style={{
                    fontSize: '12px',
                    color: 'var(--text-gray)',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>🤖 AI Assistant</span>
                    {message.isGenerating && (
                        <span style={{
                            fontSize: '10px',
                            backgroundColor: 'rgba(var(--accent-green-rgb), 0.2)',
                            color: 'var(--accent-green)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: '600'
                        }}>
                            {getStatusText()}
                        </span>
                    )}
                    <span style={{ fontSize: '10px', opacity: 0.7 }}>
                        {formatTimestamp(message.timestamp)}
                    </span>
                </div>

            {message.content && (
                <div style={{
                    position: 'relative',
                    padding: isMobile ? '12px 16px' : '16px 20px',
                    borderRadius: '16px 16px 16px 4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    color: '#ffffff',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    paddingRight: isMobile ? '40px' : '50px' // Make room for copy button
                }}>
                    {message.content}
                    
                    {/* Copy button */}
                    <button
                        onClick={() => handleCopyMessage(message.id, message.content)}
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: isMobile ? '8px' : '6px 8px',
                            cursor: 'pointer',
                            color: isMobile ? '#ffffff' : 'var(--text-gray)',
                            fontSize: isMobile ? '14px' : '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s ease',
                            opacity: isMobile ? '1' : '0.8', // Always visible on mobile
                            minWidth: isMobile ? '32px' : 'auto',
                            minHeight: isMobile ? '32px' : 'auto',
                            justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                            if (!isMobile) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.color = '#ffffff';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isMobile) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.color = 'var(--text-gray)';
                            }
                        }}
                        title="Copy message"
                    >
                        {copiedMessageId === message.id ? '✓' : '📋'}
                    </button>

                    {showDeployButton && deploymentContext && (
                        <div style={{ marginTop: '16px' }}>
                            <DeploymentButton
                                deploymentContext={deploymentContext}
                                buttonState={deploymentState}
                                onDeploy={handleDeployClick}
                                onViewApp={handleViewAppClick}
                                isMobile={isMobile}
                            />
                        </div>
                    )}
                </div>
            )}

                {/* NEW: Auto-retry status display */}
                {showAutoRetryStatus && (
                    <div style={{
                        backgroundColor: 'rgba(var(--accent-orange-rgb), 0.1)',
                        border: '1px solid var(--accent-orange)',
                        borderRadius: '12px',
                        padding: isMobile ? '12px' : '16px',
                        marginTop: '8px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px'
                        }}>
                            <div style={{
                                width: '20px',
                                height: '20px',
                                border: '2px solid rgba(var(--accent-orange-rgb), 0.3)',
                                borderTopColor: 'var(--accent-orange)',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                flexShrink: 0
                            }} />
                            <div>
                                <div style={{
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: 'var(--accent-orange)',
                                    marginBottom: '4px'
                                }}>
                                    🤖 Auto-Retry Active
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: 'var(--text-gray)'
                                }}>
                                    {getAutoRetryStatusText()}
                                </div>
                            </div>
                        </div>
                        
                        <div style={{
                            fontSize: '11px',
                            color: 'var(--text-gray)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px'
                        }}>
                            {Object.keys(extractedFiles).map(fileName => (
                                <span key={fileName} style={{
                                    backgroundColor: 'rgba(var(--accent-orange-rgb), 0.2)',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--accent-orange)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    {getFileTypeIcon(fileName)}
                                    {fileName.split('/').pop()}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {showApplyButton && (
                    <div style={{
                        backgroundColor: 'rgba(var(--accent-green-rgb), 0.1)',
                        border: '1px solid var(--accent-green)',
                        borderRadius: '12px',
                        padding: isMobile ? '12px' : '16px',
                        marginTop: '8px'
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            justifyContent: 'space-between',
                            alignItems: isMobile ? 'stretch' : 'center',
                            gap: isMobile ? '12px' : '16px',
                            marginBottom: '12px'
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: 'var(--accent-green)',
                                    marginBottom: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    flexWrap: 'wrap'
                                }}>
                                    🔧 {Object.keys(extractedFiles).length} Files Ready
                                    <span style={{
                                        fontSize: '10px',
                                        backgroundColor: 'rgba(var(--accent-green-rgb), 0.2)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                    }}>
                                        COMPLETE FILES
                                    </span>
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: 'var(--text-gray)',
                                    lineHeight: '1.4'
                                }}>
                                    Ready to apply: {Object.keys(extractedFiles).slice(0, 3).join(', ')}{Object.keys(extractedFiles).length > 3 ? ` and ${Object.keys(extractedFiles).length - 3} more` : ''}
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    console.log('🔧 [MessageList] Manual apply button clicked:', {
                                        messageId: message.id,
                                        fileCount: Object.keys(extractedFiles).length,
                                        autoRetryActive: isActiveAutoRetryWorkflow()
                                    });
                                    startFileApplication(extractedFiles);
                                }}
                                disabled={fileApplyState.isApplying}
                                style={{
                                    padding: isMobile ? '12px 16px' : '10px 20px',
                                    backgroundColor: fileApplyState.isApplying ? 'var(--text-gray)' : 'var(--accent-green)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: fileApplyState.isApplying ? 'not-allowed' : 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {fileApplyState.isApplying ? (
                                    <>
                                        <div style={{
                                            width: '14px',
                                            height: '14px',
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            borderTopColor: '#fff',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite'
                                        }} />
                                        Applying...
                                    </>
                                ) : (
                                    <>🔧 Apply All Files</>
                                )}
                            </button>
                        </div>

                        <div style={{
                            fontSize: '11px',
                            color: 'var(--text-gray)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px'
                        }}>
                            {Object.keys(extractedFiles).map(fileName => (
                                <span key={fileName} style={{
                                    backgroundColor: 'rgba(var(--accent-green-rgb), 0.2)',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--accent-green)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    {getFileTypeIcon(fileName)}
                                    {fileName.split('/').pop()}
                                </span>
                            ))}
                        </div>
                        
                        {fileApplyState.isApplying && fileApplyState.progress.message && (
                            <div style={{
                                marginTop: '12px',
                                padding: '8px 12px',
                                backgroundColor: 'rgba(var(--accent-orange-rgb), 0.1)',
                                border: '1px solid var(--accent-orange)',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: 'var(--accent-orange)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <div style={{
                                    width: '12px',
                                    height: '12px',
                                    border: '2px solid rgba(var(--accent-orange-rgb), 0.3)',
                                    borderTopColor: 'var(--accent-orange)',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                {fileApplyState.progress.message}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (!hasActiveProject) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '1.5rem',
                padding: isMobile ? '1rem' : '2rem',
                textAlign: 'center',
                overflowY: 'auto',
                position: 'relative',
                transform: isMobile ? 'translateY(-15vh)' : 'none'
            }}>
            <div style={{
                width: isMobile ? '70px' : '80px',
                height: isMobile ? '70px' : '80px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '1.8rem' : '2rem',
                marginBottom: isMobile ? '0.5rem' : '1rem',
                border: '2px solid rgba(255, 255, 255, 0.1)'
            }}>
                💬
            </div>
            
            <div>
                <h2 style={{
                    fontSize: isMobile ? '1.3rem' : '1.8rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    marginBottom: isMobile ? '0.75rem' : '1rem',
                    margin: 0
                }}>
                    Welcome to Kontext!
                </h2>
                <p style={{
                    fontSize: isMobile ? '0.85rem' : '1rem',
                    color: 'var(--text-gray)',
                    lineHeight: 1.6,
                    maxWidth: isMobile ? '320px' : '400px',
                    margin: isMobile ? '0.75rem auto 0' : '1rem auto 0'
                }}>
                    To get started, please create a new project or select an existing project from the sidebar. Once you have a project selected, you can chat with your AI assistant to build amazing applications!
                </p>
            </div>
        </div>
        );
    }

    return (
        <div 
            ref={scrollContainerRef}
            style={{
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: isMobile 
                    ? '16px 16px calc(200px + env(safe-area-inset-bottom, 34px))'
                    : '24px 32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative'
            }}
        >
            {/* Empty state */}
            {messages.length === 0 && !coordinatorState.exclusiveRenderingActive && !coordinatorState.pureVisualState && !isStreaming && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    textAlign: 'center',
                    color: 'var(--text-gray)',
                    fontSize: '16px',
                    padding: isMobile ? '20px' : '40px 20px',
                    minHeight: '300px'
                }}>
                    <div style={{ fontSize: isMobile ? '40px' : '48px', marginBottom: '20px' }}>🤖✨</div>
                    <div style={{
                        fontSize: isMobile ? '16px' : '18px',
                        fontWeight: '600',
                        color: '#ffffff',
                        marginBottom: '12px'
                    }}>
                        Ready to build something amazing?
                    </div>
                    <div style={{
                        marginBottom: '32px',
                        lineHeight: '1.5',
                        maxWidth: '500px',
                        fontSize: isMobile ? '14px' : '16px'
                    }}>
                        Start a conversation with your AI assistant. Ask me to create components, fix bugs, or build entire applications!
                    </div>
                </div>
            )}

            {/* PERSISTENT CONTENT MESSAGES */}
            {messages.map(renderMessage).filter(Boolean)}

            {/* OPTION 4: K ANIMATION - Enhanced with UI override system for instant hiding */}
            {(() => {
                // OPTION 4: Check UI override FIRST - this takes precedence over MessageCoordinator
                if (instantKAnimationOverride?.forceHide) {
                    console.log('🎯 [UI-FIRST] K animation hidden by UI override:', instantKAnimationOverride.reason);
                    return null; // Hide K animation immediately
                }

                // Normal K animation logic - show for BOTH exclusive rendering AND pure visual state
                const shouldShowK = (coordinatorState.exclusiveRenderingActive && 
                                    coordinatorState.displayState === 'THINKING' && 
                                    coordinatorState.activeMessageId) || 
                                   (coordinatorState.pureVisualState && coordinatorState.visualStateMessage);

                if (!shouldShowK) {
                    return null;
                }

                return (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignSelf: 'flex-start',
                        maxWidth: '85%',
                        marginBottom: '16px'
                    }}>
                        <div style={{
                            fontSize: '12px',
                            color: 'var(--text-gray)',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span>🤖 AI Assistant</span>
                            <span style={{
                                fontSize: '10px',
                                backgroundColor: 'rgba(var(--accent-green-rgb), 0.2)',
                                color: 'var(--accent-green)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: '600'
                            }}>
                                {getStatusText()}
                            </span>
                            {coordinatorState.currentOwner === 'FILE_MANAGER' && currentPhaseInfo && currentPhaseInfo.progress > 0 && (
                                <span style={{
                                    fontSize: '10px',
                                    backgroundColor: 'rgba(var(--accent-orange-rgb), 0.2)',
                                    color: 'var(--accent-orange)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: '600'
                                }}>
                                    {Math.round(currentPhaseInfo.progress)}%
                                </span>
                            )}
                        </div>
                        
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: isMobile ? '16px' : '20px',
                            borderRadius: '16px 16px 16px 4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <div style={{
                                width: isMobile ? '48px' : '56px',
                                height: isMobile ? '48px' : '56px',
                                background: 'linear-gradient(135deg, var(--accent-orange) 0%, var(--accent-orange) 50%, #10b981 100%)',
                                borderRadius: isMobile ? '12px' : '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '900',
                                fontSize: isMobile ? '24px' : '28px',
                                color: '#ffffff',
                                animation: 'kontextPulse 2s ease-in-out infinite',
                                boxShadow: '0 8px 32px rgba(255, 107, 53, 0.4)',
                                flexShrink: 0
                            }}>
                                K
                            </div>
                            
                            <div style={{
                                fontSize: isMobile ? '14px' : '15px',
                                color: 'var(--text-gray)',
                                fontStyle: 'italic',
                                opacity: 0.9,
                                flex: 1
                            }}>
                                {/* CRITICAL FIX: Show the correct message based on state */}
                                {coordinatorState.pureVisualState ? 
                                    coordinatorState.visualStateMessage : 
                                    (coordinatorState.kLoadingMessage || coordinatorState.currentMessage || 'Kontext is thinking...')}
                            </div>
                            
                            {coordinatorState.currentOwner === 'FILE_MANAGER' && currentPhaseInfo && currentPhaseInfo.detectedFiles.length > 0 && (
                                <div style={{
                                    fontSize: '11px',
                                    color: 'var(--accent-green)',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '4px',
                                    maxWidth: '200px'
                                }}>
                                    {currentPhaseInfo.detectedFiles.slice(0, 3).map(fileName => (
                                        <span key={fileName} style={{
                                            backgroundColor: 'rgba(var(--accent-green-rgb), 0.1)',
                                            padding: '2px 4px',
                                            borderRadius: '3px',
                                            fontSize: '10px'
                                        }}>
                                            {getFileTypeIcon(fileName)} {fileName.split('/').pop()}
                                        </span>
                                    ))}
                                    {currentPhaseInfo.detectedFiles.length > 3 && (
                                        <span style={{
                                            fontSize: '10px',
                                            opacity: 0.7
                                        }}>
                                            +{currentPhaseInfo.detectedFiles.length - 3} more
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* FIXED: Streaming content display for regular streaming */}
            {isStreaming && streamingState.streamingContent && !coordinatorState.exclusiveRenderingActive && !coordinatorState.pureVisualState && !instantKAnimationOverride?.forceHide && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    alignSelf: 'flex-start',
                    maxWidth: '85%',
                    marginBottom: '16px'
                }}>
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--text-gray)',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>🤖 AI Assistant</span>
                        <span style={{
                            fontSize: '10px',
                            backgroundColor: 'rgba(var(--accent-green-rgb), 0.2)',
                            color: 'var(--accent-green)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: '600'
                        }}>
                            Writing...
                        </span>
                    </div>
                    
                    <div style={{
                        padding: isMobile ? '12px 16px' : '16px 20px',
                        borderRadius: '16px 16px 16px 4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        color: '#ffffff',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}>
                        {streamingState.streamingContent}
                        <span style={{
                            opacity: 0.7,
                            animation: 'blink 1s infinite'
                        }}>▌</span>
                    </div>
                </div>
            )}

            {/* ENHANCED: Scroll to bottom button with proper spacing from chat input */}
            {isUserScrolling && !isNearBottom && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        scrollForManualButton();
                    }}
                    style={{
                        position: 'fixed',
                        bottom: isMobile 
                            ? `calc(${chatInputHeight}px + env(safe-area-inset-bottom, 20px))` 
                            : `${chatInputHeight}px`,
                        right: isMobile ? '16px' : '24px',
                        background: 'var(--accent-orange)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: isMobile ? '52px' : '44px',
                        height: isMobile ? '52px' : '44px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(255, 107, 53, 0.5), 0 0 0 0 rgba(255, 107, 53, 0.4)',
                        fontSize: isMobile ? '1.3rem' : '1.1rem',
                        zIndex: 999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        animation: 'scrollButtonFadeIn 0.3s ease',
                        fontWeight: 'bold',
                        lineHeight: 1
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.6), 0 0 0 4px rgba(255, 107, 53, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 107, 53, 0.5), 0 0 0 0 rgba(255, 107, 53, 0.4)';
                    }}
                    title="Scroll to bottom"
                    aria-label="Scroll to bottom"
                >
                    ↓
                </button>
            )}

            <div ref={messagesEndRef} />

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
                
                @keyframes kontextPulse {
                    0% {
                        transform: scale(1);
                        box-shadow: 0 8px 32px rgba(255, 107, 53, 0.4),
                                    0 0 0 0 rgba(255, 107, 53, 0.3);
                    }
                    50% {
                        transform: scale(1.05);
                        box-shadow: 0 10px 40px rgba(255, 107, 53, 0.6),
                                    0 0 0 8px rgba(255, 107, 53, 0.15);
                    }
                    100% {
                        transform: scale(1);
                        box-shadow: 0 8px 32px rgba(255, 107, 53, 0.4),
                                    0 0 0 0 rgba(255, 107, 53, 0.3);
                    }
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                
                @keyframes scrollButtonFadeIn {
                    from { 
                        opacity: 0; 
                        transform: scale(0.8) translateY(10px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: scale(1) translateY(0); 
                    }
                }
            `}</style>
        </div>
    );
};