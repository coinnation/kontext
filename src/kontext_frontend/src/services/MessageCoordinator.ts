import { verboseLog, verboseWarn } from '../utils/verboseLogging';

export type MessageOwner = 'PROJECT_SERVICE' | 'FILE_MANAGER' | 'NONE';
export type MessageDisplayState = 'IDLE' | 'THINKING' | 'STREAMING' | 'COMPLETED';

// ENHANCED: Added comprehensive phase tracking for transitions
export type ProjectGenerationPhase = 
  | 'idle'
  | 'specification'
  | 'template_selection'
  | 'template_fetching'
  | 'backend_preparation'
  | 'backend_generation' 
  | 'backend_analysis'
  | 'frontend_preparation'
  | 'frontend_generation'
  | 'configuration_generation'
  | 'project_organization'
  | 'platform_integration'
  | 'complete';

// ENHANCED: Phase transition context for rich K messages
export interface PhaseTransitionContext {
  fromPhase: ProjectGenerationPhase;
  toPhase: ProjectGenerationPhase;
  technicalDetails?: string;
  userFriendlyExplanation?: string;
  estimatedDuration?: number;
  templateName?: string;
  projectType?: string;
  fileCount?: number;
  complexity?: 'simple' | 'medium' | 'complex';
  userRequest?: string;
}

export interface MessageCoordinatorState {
  currentOwner: MessageOwner;
  currentMessage: string;
  lastHandoffTime: number;
  isStreamingActive: boolean;
  currentPhase: ProjectGenerationPhase;
  // ENHANCED: Single source K animation control with exclusive states
  displayState: MessageDisplayState;
  showKLoadingAnimation: boolean;
  kLoadingMessage: string;
  isGenerating: boolean;
  completionData: CompletionData | null;
  // ENHANCED: Exclusive message control tracking
  activeMessageId: string | null;
  activeMessageContent: string;
  controlledMessages: Set<string>;
  // CRITICAL FIX: Track generation completion properly
  generationComplete: boolean;
  streamingComplete: boolean;
  // ENHANCED: Exclusive rendering control
  exclusiveRenderingActive: boolean;
  // NEW: Phase transition tracking
  currentTransition: PhaseTransitionContext | null;
  phaseStartTime: number;
  phaseHistory: Array<{phase: ProjectGenerationPhase, duration: number, timestamp: number}>;
  // CRITICAL FIX: Force ownership consistency
  ownershipLocked: boolean;
  pendingOwnershipTransfer: MessageOwner | null;
  // NEW: Pure visual state support for updates and regular chat
  pureVisualState: boolean;
  visualStateMessage: string;
  // 🔥 NEW: Atomic message creation tracking
  messageCreationInProgress: boolean;
  pendingMessageCreation: string | null;
}

export interface CompletionData {
  finalContent: string;
  extractedFiles: { [key: string]: string };
  templateUsed?: {
    name: string;
    confidence: number;
  };
  deploymentReady: boolean;
  messageId: string;
}

export interface MessageHandoffContext {
  fromOwner: MessageOwner;
  toOwner: MessageOwner;
  reason: 'STREAMING_STARTED' | 'STREAMING_ENDED' | 'PHASE_TRANSITION' | 'GENERATION_COMPLETE' | 'K_ANIMATION_START' | 'K_ANIMATION_END' | 'MESSAGE_CREATED' | 'USER_MESSAGE_CREATED';
  phaseContext?: string;
  fileContext?: string[];
  showKAnimation?: boolean;
  messageId?: string;
  // NEW: Enhanced transition context
  transitionContext?: PhaseTransitionContext;
  // 🔥 NEW: Message creation completion data
  messageData?: any;
}

// 🔥 NEW: User message creation event interface
export interface UserMessageCreationEvent {
  type: 'USER_MESSAGE_CREATED';
  messageId: string;
  projectId: string;
  message: any;
  currentInstructionId: string;
  priority: string;
  timestamp: number;
}

class MessageCoordinatorService {
  private state: MessageCoordinatorState = {
    currentOwner: 'NONE',
    currentMessage: '',
    lastHandoffTime: 0,
    isStreamingActive: false,
    currentPhase: 'idle',
    // ENHANCED: Exclusive state machine
    displayState: 'IDLE',
    showKLoadingAnimation: false,
    kLoadingMessage: '',
    isGenerating: false,
    completionData: null,
    // ENHANCED: Exclusive message control
    activeMessageId: null,
    activeMessageContent: '',
    controlledMessages: new Set<string>(),
    // CRITICAL FIX: Completion tracking
    generationComplete: false,
    streamingComplete: false,
    // ENHANCED: Exclusive rendering control
    exclusiveRenderingActive: false,
    // NEW: Phase transition state
    currentTransition: null,
    phaseStartTime: Date.now(),
    phaseHistory: [],
    // CRITICAL FIX: Ownership consistency
    ownershipLocked: false,
    pendingOwnershipTransfer: null,
    // NEW: Pure visual state support
    pureVisualState: false,
    visualStateMessage: '',
    // 🔥 NEW: Atomic message creation tracking
    messageCreationInProgress: false,
    pendingMessageCreation: null
  };

  private listeners: Array<(state: MessageCoordinatorState) => void> = [];
  private handoffListeners: Array<(context: MessageHandoffContext) => void> = [];
  // 🔥 NEW: Event listeners for message creation completion
  private messageCreationListeners: Array<(event: UserMessageCreationEvent) => void> = [];
  private updateQueue: Array<() => void> = [];
  private isProcessingQueue = false;
  
  // CRITICAL: Store reference to functions from chatActionsSlice
  private addMessageToProjectFn: ((projectId: string, message: any) => void) | null = null;
  private updateMessageFn: ((messageId: string, updates: any) => void) | null = null;
  private saveMessageFn: ((projectId: string, message: any) => Promise<void>) | null = null;
  private updateMessageInCanisterFn: ((projectId: string, messageId: string, content: string, isGenerating?: boolean) => Promise<void>) | null = null;
  // 🔥 NEW: Priority assignment function reference
  private assignMessagePriorityFn: ((messageId: string, priority: any, reason: string, isCurrentInstruction: boolean) => void) | null = null;
  private currentProjectId: string | null = null;

  constructor() {
    verboseLog('MessageCoordinator', 'Initialized - User-friendly K animations only');
  }

  // CRITICAL FIX: Register functions from chatActionsSlice
  public registerMessageCreator(addMessageToProjectFn: (projectId: string, message: any) => void): void {
    this.addMessageToProjectFn = addMessageToProjectFn;
    verboseLog('MessageCoordinator', 'Message creator registered');
  }

  public registerMessageUpdater(updateMessageFn: (messageId: string, updates: any) => void): void {
    this.updateMessageFn = updateMessageFn;
    verboseLog('MessageCoordinator', 'Message updater registered');
  }

  public registerMessagePersistence(
    saveMessageFn: (projectId: string, message: any) => Promise<void>,
    updateMessageInCanisterFn: (projectId: string, messageId: string, content: string, isGenerating?: boolean) => Promise<void>
  ): void {
    this.saveMessageFn = saveMessageFn;
    this.updateMessageInCanisterFn = updateMessageInCanisterFn;
    verboseLog('MessageCoordinator', 'Persistence functions registered');
  }

  // 🔥 NEW: Register priority assignment function
  public registerPriorityAssignment(assignMessagePriorityFn: (messageId: string, priority: any, reason: string, isCurrentInstruction: boolean) => void): void {
    this.assignMessagePriorityFn = assignMessagePriorityFn;
    verboseLog('MessageCoordinator', 'Priority assignment function registered');
  }

  public getPersistenceStatus(): { enabled: boolean; verified: boolean } {
    const enabled = !!(this.addMessageToProjectFn && this.updateMessageFn && this.saveMessageFn && this.updateMessageInCanisterFn);
    const verified = enabled; // For now, just check if all functions are registered
    return { enabled, verified };
  }

  public setCurrentProject(projectId: string): void {
    this.currentProjectId = projectId;
    verboseLog('MessageCoordinator', `Current project set to: ${projectId}`);
  }

  public setOperatingMode(mode: 'COMPLEX_PROJECT_GEN' | 'SIMPLE_UPDATE' | 'MINIMAL_CHAT'): void {
    console.log(`🎭 [MessageCoordinator] Operating mode set to: ${mode}`);
    // This method provides context for logging but doesn't change behavior
    // The actual behavior is determined by which methods are called
  }

  // 🔥 NEW: Atomic user message creation with priority assignment
  public async createUserMessageWithPriority(
    projectId: string,
    messageContent: string,
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'CRITICAL'
  ): Promise<{ messageId: string; success: boolean; currentInstructionId: string | null }> {
    console.log('🔥 [MessageCoordinator] Creating user message with priority...');
    
    if (!this.addMessageToProjectFn || !this.assignMessagePriorityFn) {
      console.error('🔥 [MessageCoordinator] Required functions not registered');
      return { messageId: '', success: false, currentInstructionId: null };
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    return new Promise((resolve) => {
      this.queueUpdate(() => {
        try {
          // Mark creation in progress atomically
          this.state.messageCreationInProgress = true;
          this.state.pendingMessageCreation = messageId;
          
          console.log('🔥 [MessageCoordinator] Creating user message...');
          
          // Import MessagePriority enum
          const MessagePriority = {
            CRITICAL: 'CRITICAL' as const,
            HIGH: 'HIGH' as const,
            MEDIUM: 'MEDIUM' as const,
            LOW: 'LOW' as const,
            CONTEXT: 'CONTEXT' as const
          };
          
          // Create priority context
          const priorityContext = {
            priority: MessagePriority[priority],
            priorityReason: priority === 'CRITICAL' ? "Current user instruction - highest priority for AI focus" : `User message with ${priority} priority`,
            assignedAt: Date.now(),
            isCurrentInstruction: priority === 'CRITICAL',
            supportingContext: {
              relatedMessages: [],
              fileReferences: [],
              topicContinuity: false
            },
            conversationFlow: {
              isResponseTo: null,
              startsNewTopic: true,
              closesLoop: false
            }
          };

          // Create complete user message with priority context
          const userMessage = {
            id: messageId,
            type: 'user' as const,
            content: messageContent,
            timestamp: new Date(),
            isGenerating: false,
            isCurrentInstruction: priority === 'CRITICAL',
            priorityContext
          };

          // ATOMIC OPERATION: Add message with priority context already attached
          console.log('🔥 [MessageCoordinator] Adding message to project...');
          this.addMessageToProjectFn!(projectId, userMessage);

          // Set currentInstructionId if this is a critical message
          const currentInstructionId = priority === 'CRITICAL' ? messageId : null;
          
          // Mark creation complete
          this.state.messageCreationInProgress = false;
          this.state.pendingMessageCreation = null;
          this.state.lastHandoffTime = Date.now();

          console.log('🔥 [MessageCoordinator] ✅ User message created successfully', {
            messageId,
            priority,
            currentInstructionId
          });

          // Notify handoff listeners about message creation
          this.notifyHandoff({
            fromOwner: 'NONE',
            toOwner: 'PROJECT_SERVICE',
            reason: 'USER_MESSAGE_CREATED',
            messageId,
            messageData: userMessage
          });

          // 🔥 NEW: Notify message creation completion listeners
          const creationEvent: UserMessageCreationEvent = {
            type: 'USER_MESSAGE_CREATED',
            messageId,
            projectId,
            message: userMessage,
            currentInstructionId: currentInstructionId || '',
            priority,
            timestamp: Date.now()
          };
          
          this.notifyMessageCreation(creationEvent);

          resolve({ 
            messageId, 
            success: true, 
            currentInstructionId 
          });

        } catch (error) {
          console.error('🔥 [MessageCoordinator] ❌ User message creation failed:', error);
          
          // Reset state on error
          this.state.messageCreationInProgress = false;
          this.state.pendingMessageCreation = null;
          
          resolve({ 
            messageId: '', 
            success: false, 
            currentInstructionId: null 
          });
        }
      });
    });
  }

  // 🔥 NEW: Subscribe to message creation completion events
  public subscribeToMessageCreation(listener: (event: UserMessageCreationEvent) => void): () => void {
    this.messageCreationListeners.push(listener);
    return () => {
      this.messageCreationListeners = this.messageCreationListeners.filter(l => l !== listener);
    };
  }

  // 🔥 NEW: Notify message creation completion
  private notifyMessageCreation(event: UserMessageCreationEvent): void {
    console.log('🔥 [MessageCoordinator] Notifying message creation completion:', event.messageId);
    this.messageCreationListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('🔥 [MessageCoordinator] Error in message creation listener:', error);
      }
    });
  }

  // 🔥 NEW: Check if message creation is in progress
  public isMessageCreationInProgress(): boolean {
    return this.state.messageCreationInProgress;
  }

  // 🔥 NEW: Get pending message creation ID
  public getPendingMessageCreation(): string | null {
    return this.state.pendingMessageCreation;
  }

  // ENHANCED: Process updates synchronously with exclusive state management
  private processUpdateQueue(): void {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.updateQueue.length > 0) {
      const update = this.updateQueue.shift();
      if (update) {
        try {
          update();
        } catch (error) {
          console.error('🎭 [MessageCoordinator] Error in queued update:', error);
        }
      }
    }
    
    // Notify listeners after all updates are processed
    this.notifyListeners();
    this.isProcessingQueue = false;
  }

  // ENHANCED: Queue updates with state validation
  private queueUpdate(updateFn: () => void): void {
    this.updateQueue.push(updateFn);
    
    // Process queue on next tick to batch updates
    setTimeout(() => {
      if (!this.isProcessingQueue) {
        this.processUpdateQueue();
      }
    }, 0);
  }

  // Subscribe to state changes
  subscribe(listener: (state: MessageCoordinatorState) => void): () => void {
    this.listeners.push(listener);
    
    // CRITICAL FIX: Immediately send current state to new subscribers
    setTimeout(() => {
      try {
        listener({ ...this.state });
      } catch (error) {
        console.error('🎭 [MessageCoordinator] Error in immediate state delivery:', error);
      }
    }, 0);
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Subscribe to handoff events
  subscribeToHandoffs(listener: (context: MessageHandoffContext) => void): () => void {
    this.handoffListeners.push(listener);
    return () => {
      this.handoffListeners = this.handoffListeners.filter(l => l !== listener);
    };
  }

  // Get current state
  getCurrentState(): MessageCoordinatorState {
    return { ...this.state };
  }

  // 🔥 FRIENDLY: Start pure visual state with friendly messages
  startPureVisualState(message: string): void {
    // Transform technical messages to user-friendly ones
    const friendlyMessage = this.makeFriendlyMessage(message);
    
    this.queueUpdate(() => {
      this.state = {
        ...this.state,
        currentOwner: 'PROJECT_SERVICE',
        displayState: 'THINKING',
        showKLoadingAnimation: true,
        kLoadingMessage: friendlyMessage,
        currentMessage: friendlyMessage,
        isGenerating: true,
        pureVisualState: true,
        visualStateMessage: friendlyMessage,
        exclusiveRenderingActive: false, // Pure visual state is less exclusive than project generation
        lastHandoffTime: Date.now()
      };
    });
  }

  // 🔥 FRIENDLY: Update K loading message with automatic friendly transformation
  updateKLoadingMessage(message: string): void {
    if (!this.state.showKLoadingAnimation && !this.state.pureVisualState) {
      console.warn('🎭 [MessageCoordinator] Attempted to update K message when K animation not active');
      return;
    }

    // Transform technical messages to user-friendly ones
    const friendlyMessage = this.makeFriendlyMessage(message);
    
    this.queueUpdate(() => {
      this.state = {
        ...this.state,
        kLoadingMessage: friendlyMessage,
        currentMessage: friendlyMessage,
        activeMessageContent: friendlyMessage,
        visualStateMessage: this.state.pureVisualState ? friendlyMessage : this.state.visualStateMessage
      };
    });
  }

  // 🔥 NEW: Edit-specific K message templates
  updateEditKMessage(phase: 'analyzing' | 'locating' | 'applying' | 'complete', details?: { fileName?: string; functionName?: string; editCount?: number }): void {
    let message = '';
    
    switch (phase) {
      case 'analyzing':
        message = 'Analyzing your code changes...';
        break;
      case 'locating':
        if (details?.fileName && details?.functionName) {
          message = `Locating ${details.functionName} in ${details.fileName}...`;
        } else if (details?.fileName) {
          message = `Locating code in ${details.fileName}...`;
        } else {
          message = 'Locating target code...';
        }
        break;
      case 'applying':
        if (details?.functionName) {
          message = `Applying targeted edit: ${details.functionName}...`;
        } else {
          message = 'Applying targeted edit...';
        }
        break;
      case 'complete':
        if (details?.editCount) {
          message = `Edit complete! ${details.editCount} change${details.editCount > 1 ? 's' : ''} applied successfully.`;
        } else {
          message = 'Edit complete! Changes applied successfully.';
        }
        break;
    }
    
    this.updateKLoadingMessage(message);
  }

  // 🔥 FRIENDLY: Transform technical messages to user-friendly messages
  private makeFriendlyMessage(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    // Handle specific technical patterns with user-friendly replacements
    if (lowerMessage.includes('connected to ai') || lowerMessage.includes('ai analysis engine')) {
      return 'Connecting to AI...';
    }
    
    if (lowerMessage.includes('coordinator') && lowerMessage.includes('integration')) {
      return 'Preparing your request...';
    }
    
    if (lowerMessage.includes('coordinator') && lowerMessage.includes('enhanced')) {
      return 'Enhancing your request...';
    }
    
    if (lowerMessage.includes('coordinator') && lowerMessage.includes('analysis')) {
      return 'Analyzing your project...';
    }
    
    if (lowerMessage.includes('priority') && lowerMessage.includes('assignment')) {
      return 'Preparing your message...';
    }
    
    if (lowerMessage.includes('priority') && lowerMessage.includes('based')) {
      return 'Organizing information...';
    }
    
    if (lowerMessage.includes('priority') && lowerMessage.includes('system')) {
      return 'Organizing your project details...';
    }
    
    if (lowerMessage.includes('technical specifications')) {
      return 'Creating project plan...';
    }
    
    if (lowerMessage.includes('project specifications')) {
      return 'Planning your project...';
    }
    
    if (lowerMessage.includes('project architecture')) {
      return 'Designing your project structure...';
    }
    
    if (lowerMessage.includes('conversation context')) {
      return 'Reviewing our conversation...';
    }
    
    if (lowerMessage.includes('understanding your intent')) {
      return 'Understanding what you need...';
    }
    
    if (lowerMessage.includes('processing your request')) {
      return 'Processing your request...';
    }
    
    if (lowerMessage.includes('analyzing your request')) {
      return 'Analyzing your request...';
    }
    
    if (lowerMessage.includes('finalizing')) {
      return 'Finalizing...';
    }
    
    // Remove template name mentions (like "MotokoReactBible")
    if (lowerMessage.includes('template') && (lowerMessage.includes('selected') || lowerMessage.includes('loaded'))) {
      return 'Loading blueprint...';
    }
    
    // Remove all technical jargon
    let friendlyMessage = message
      // Remove template name mentions (like "MotokoReactBible", "Template X selected")
      .replace(/template\s*["']?[^"']*["']?\s*(selected|loaded)/gi, 'template loaded')
      .replace(/motoko\s*react\s*bible/gi, '')
      .replace(/motokoreactbible/gi, '')
      .replace(/["']?[A-Z][a-zA-Z]+(?:[A-Z][a-zA-Z]+)*["']?\s*(?:template|selected|loaded)/gi, 'template')
      // Remove file count mentions during phases (misleading)
      .replace(/\d+\s*files?\s*(?:generated|created|ready|complete)/gi, 'files ready')
      .replace(/found\s*\d+\s*files?/gi, 'files detected')
      // Replace coordinator references with friendly terms
      .replace(/coordinator[- ]?enhanced/gi, 'enhanced')
      .replace(/coordinator[- ]?integration/gi, '')
      .replace(/coordinator[- ]?managed/gi, '')
      .replace(/coordinator[- ]?based/gi, '')
      .replace(/coordinator[- ]?system/gi, '')
      .replace(/with coordinator/gi, '')
      .replace(/coordinator/gi, '')
      
      // Replace priority/assembly technical terms
      .replace(/priority[- ]?assembly/gi, 'organizing')
      .replace(/priority[- ]?structured/gi, 'organizing')
      .replace(/priority[- ]?context/gi, 'organizing')
      .replace(/priority[- ]?based/gi, '')
      .replace(/priority[- ]?assignment/gi, 'preparing')
      .replace(/priority[- ]?system/gi, '')
      .replace(/priority/gi, '')
      .replace(/assembly/gi, '')
      .replace(/structured context/gi, 'context')
      
      // Replace integration references
      .replace(/integration active/gi, '')
      .replace(/integration ready/gi, '')
      .replace(/integration/gi, '')
      
      // Replace engine references
      .replace(/AI analysis engine/gi, 'AI')
      .replace(/analysis engine/gi, 'AI')
      .replace(/engine/gi, '')
      
      // Replace technical specification terms
      .replace(/technical specifications/gi, 'project plan')
      .replace(/project specifications/gi, 'project plan')
      .replace(/specifications/gi, 'plan')
      
      // Replace architecture terms
      .replace(/project architecture/gi, 'project structure')
      .replace(/architecture patterns/gi, 'design patterns')
      .replace(/architecture/gi, 'structure')
      
      // Replace context terms
      .replace(/conversation context/gi, 'conversation')
      .replace(/response context/gi, 'response')
      
      // Remove token/technical references
      .replace(/\d+\s*tokens?[^.]*?/gi, '')
      .replace(/token budget/gi, '')
      .replace(/tokens/gi, '')
      
      // Remove phase/system references
      .replace(/system enhancement/gi, '')
      .replace(/system/gi, '')
      .replace(/phase/gi, '')
      
      // Clean up extra spaces and punctuation
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*/g, ' ')
      .replace(/\.\.\.\s*\.\.\./g, '...')
      .trim();
    
    // If message became empty or too short after cleaning, provide a default
    if (!friendlyMessage || friendlyMessage.length < 5) {
      return this.getGenericFriendlyMessage();
    }
    
    // Ensure message starts with capital and ends properly
    friendlyMessage = friendlyMessage.charAt(0).toUpperCase() + friendlyMessage.slice(1);
    if (!friendlyMessage.endsWith('...') && !friendlyMessage.endsWith('.') && !friendlyMessage.endsWith('!')) {
      friendlyMessage += '...';
    }
    
    return friendlyMessage;
  }

  // 🔥 FRIENDLY: Get generic friendly message for different contexts
  private getGenericFriendlyMessage(): string {
    const currentPhase = this.state.currentPhase;
    
    switch (currentPhase) {
      case 'specification':
        return 'Understanding your project idea...';
      case 'template_selection':
        return 'Finding the perfect starting point...';
      case 'backend_generation':
        return 'Building your app logic...';
      case 'frontend_generation':
        return 'Creating your user interface...';
      case 'complete':
        return 'Putting the finishing touches on your project...';
      default:
        return 'Working on your request...';
    }
  }

  // NEW: Transition from visual state to streaming (for regular chat)
  transitionFromVisualToStreaming(streamingId: string): void {
    console.log(`🎭 [MessageCoordinator] Starting response...`);
    
    this.queueUpdate(() => {
      this.state = {
        ...this.state,
        displayState: 'STREAMING',
        showKLoadingAnimation: false,
        kLoadingMessage: '',
        isStreamingActive: true,
        pureVisualState: false, // Exit pure visual state
        visualStateMessage: ''
      };
    });
  }

  // NEW: Complete pure visual state
  completePureVisualState(): void {
    console.log('🎭 [MessageCoordinator] Completing visual state');
    
    this.queueUpdate(() => {
      this.state = {
        ...this.state,
        displayState: 'IDLE',
        showKLoadingAnimation: false,
        kLoadingMessage: '',
        currentMessage: '',
        isGenerating: false,
        pureVisualState: false,
        visualStateMessage: '',
        isStreamingActive: false
      };
    });
  }

  // SIMPLIFIED: Force complete pure visual state immediately
  forceCompletePureVisualState(): void {
    console.log('🛑 [MessageCoordinator] Force completing visual state');
    
    this.queueUpdate(() => {
      this.state = {
        ...this.state,
        // FORCE CLEAR all visual state flags immediately
        displayState: 'IDLE',
        showKLoadingAnimation: false,
        kLoadingMessage: '',
        currentMessage: '',
        isGenerating: false,
        pureVisualState: false,
        visualStateMessage: '',
        isStreamingActive: false,
        exclusiveRenderingActive: false,
        // Reset ownership if it was locked for visual state
        ownershipLocked: false,
        pendingOwnershipTransfer: null,
        // Clear any phase state that might be active
        currentPhase: 'idle',
        currentTransition: null
      };
    });
    
    console.log('✅ [MessageCoordinator] Force completion successful');
  }

  // NEW: Enhanced phase transition with USER-FRIENDLY messages
  transitionToPhase(
    newPhase: ProjectGenerationPhase, 
    context?: Partial<PhaseTransitionContext>
  ): void {
    const previousPhase = this.state.currentPhase;
    const now = Date.now();
    const phaseDuration = now - this.state.phaseStartTime;

    // Record phase history
    if (previousPhase !== 'idle') {
      this.state.phaseHistory.push({
        phase: previousPhase,
        duration: phaseDuration,
        timestamp: this.state.phaseStartTime
      });
    }

    const transitionContext: PhaseTransitionContext = {
      fromPhase: previousPhase,
      toPhase: newPhase,
      ...context
    };

    // Generate USER-FRIENDLY K animation message for this transition
    const kMessage = this.generateUserFriendlyPhaseMessage(transitionContext);
    
    console.log(`🔄 [MessageCoordinator] Phase transition: ${previousPhase} → ${newPhase}`);
    console.log(`📝 [MessageCoordinator] User Message: "${kMessage}"`);

    this.queueUpdate(() => {
      this.state = {
        ...this.state,
        currentPhase: newPhase,
        currentTransition: transitionContext,
        phaseStartTime: now,
        kLoadingMessage: kMessage,
        currentMessage: kMessage,
        activeMessageContent: kMessage,
        displayState: 'THINKING',
        showKLoadingAnimation: true,
        isGenerating: true,
        exclusiveRenderingActive: true,
        pureVisualState: false, // Exit pure visual state for complex phases
        // CRITICAL FIX: Reset ownership locks during phase transitions
        ownershipLocked: false,
        pendingOwnershipTransfer: null
      };
    });

    // Notify handoff listeners about phase transition
    this.notifyHandoff({
      fromOwner: this.state.currentOwner,
      toOwner: 'PROJECT_SERVICE',
      reason: 'PHASE_TRANSITION',
      phaseContext: newPhase,
      showKAnimation: true,
      messageId: this.state.activeMessageId,
      transitionContext
    });
  }

  // 🔥 ENHANCED: Generate USER-FRIENDLY K animation messages that are truthful but accessible
  private generateUserFriendlyPhaseMessage(context: PhaseTransitionContext): string {
    const { toPhase, projectType, userRequest, templateName, complexity, fileCount, userFriendlyExplanation } = context;

    // Use custom explanation if provided
    if (userFriendlyExplanation) {
      return userFriendlyExplanation;
    }

    // Extract app type from user request or project type for personalization
    const appName = this.extractAppNameFromContext(userRequest, projectType);

    // 🔥 ENHANCED: USER-FRIENDLY messages that explain what's happening in accessible terms
    switch (toPhase) {
      case 'specification':
        return `Reading through your ideas for the ${appName}...`;

      case 'template_selection':
        return `Finding the best starting point for your ${appName}...`;

      case 'template_fetching':
        return `Loading the blueprint for your ${appName}...`;

      case 'backend_preparation':
        return `Setting up the behind-the-scenes magic for your ${appName}...`;

      case 'backend_generation':
        return `Building the brain that makes your ${appName} work...`;

      case 'backend_analysis':
        return `Making sure all the smart features talk to each other...`;

      case 'frontend_preparation':
        return `Getting ready to create what you'll see and click...`;

      case 'frontend_generation':
        return `Designing the screens and buttons you'll use...`;

      case 'configuration_generation':
        return `Adding the finishing touches to make everything work perfectly...`;

      case 'project_organization':
        return `Organizing everything so it's neat and tidy...`;

      case 'platform_integration':
        return `Getting your ${appName} ready to go live on the internet...`;

      case 'complete':
        // Only show completion message - don't mention file count during phases
        return `🎉 Your ${appName} is complete and ready to use!`;

      default:
        return `Working on your ${appName}...`;
    }
  }

  // Helper to extract app name from context - uses actual user request intelligently
  private extractAppNameFromContext(userRequest?: string, projectType?: string): string {
    if (!userRequest && !projectType) return 'app';
    
    const input = (userRequest || projectType || '').trim();
    const inputLower = input.toLowerCase();
    
    // 🔥 CRITICAL: Extract meaningful app name from user's actual request
    // Try to find a descriptive phrase that captures what they're building
    
    // Remove common prefixes/suffixes that don't add meaning
    let cleaned = input.replace(/^(create|build|make|design|develop|generate|i want|i need|i'd like|can you|please)\s+/i, '');
    cleaned = cleaned.replace(/\s+(app|application|system|platform|tool|manager|management)$/i, '');
    
    // Extract key descriptive phrases (2-4 words that describe the app)
    const words = cleaned.split(/\s+/).filter(w => w.length > 2);
    
    // Look for meaningful noun phrases (common patterns)
    const patterns = [
      /(team\s+\w+\s+\w+)/i,           // "team compensation management"
      /(\w+\s+compensation\s+\w+)/i,    // "employee compensation tracker"
      /(\w+\s+management\s+\w+)/i,      // "project management system"
      /(\w+\s+tracker\s+\w+)/i,         // "expense tracker app"
      /(\w+\s+manager\s+\w+)/i,         // "task manager tool"
      /(\w+\s+platform\s+\w+)/i,        // "learning platform"
    ];
    
    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
    
    // If we have 3-5 words, use first 3-4 words as app name
    if (words.length >= 3 && words.length <= 5) {
      return words.slice(0, Math.min(4, words.length)).join(' ').toLowerCase();
    }
    
    // If we have 2 words, use both
    if (words.length === 2) {
      return words.join(' ').toLowerCase();
    }
    
    // Fallback to common patterns only if we can't extract meaningful name
    if (inputLower.includes('todo') || inputLower.includes('task')) return 'todo app';
    if (inputLower.includes('blog') || inputLower.includes('post')) return 'blog';
    if (inputLower.includes('portfolio') || inputLower.includes('showcase')) return 'portfolio';
    if (inputLower.includes('dashboard') || inputLower.includes('analytics')) return 'dashboard';
    if (inputLower.includes('gallery') || inputLower.includes('photo')) return 'photo gallery';
    if (inputLower.includes('chat') || inputLower.includes('message')) return 'chat app';
    if (inputLower.includes('shop') || inputLower.includes('store') || inputLower.includes('ecommerce')) return 'online store';
    if (inputLower.includes('game') || inputLower.includes('quiz')) return 'game';
    if (inputLower.includes('website') || inputLower.includes('site')) return 'website';
    if (inputLower.includes('landing page')) return 'landing page';
    if (inputLower.includes('social')) return 'social app';
    if (inputLower.includes('booking') || inputLower.includes('reservation')) return 'booking system';
    if (inputLower.includes('learning') || inputLower.includes('education')) return 'learning platform';
    if (inputLower.includes('fitness') || inputLower.includes('health')) return 'fitness app';
    if (inputLower.includes('music') || inputLower.includes('audio')) return 'music app';
    if (inputLower.includes('video') || inputLower.includes('streaming')) return 'video app';
    if (inputLower.includes('food') || inputLower.includes('recipe')) return 'food app';
    if (inputLower.includes('travel') || inputLower.includes('trip')) return 'travel app';
    if (inputLower.includes('weather')) return 'weather app';
    if (inputLower.includes('news')) return 'news app';
    
    // Last resort: use first meaningful word or "app"
    if (words.length > 0) {
      return words[0].toLowerCase() + ' app';
    }
    
    return 'app';
  }

  // ENHANCED: Exclusive control checking methods
  public isExclusiveRenderingActive(): boolean {
    return this.state.exclusiveRenderingActive;
  }

  public isDisplayStateActive(): boolean {
    return this.state.displayState !== 'IDLE';
  }

  // Check if chat K animation should be blocked
  isChatKAnimationBlocked(): boolean {
    const isGenerationKActive = this.state.showKLoadingAnimation;
    const isGenerationInProgress = this.state.isGenerating;
    const isExclusivelyControlled = this.state.exclusiveRenderingActive;
    
    if (isGenerationKActive || isGenerationInProgress || isExclusivelyControlled) {
      console.log('🎭 [MessageCoordinator] Blocking chat K animation - exclusive control active');
      return true;
    }
    
    return false;
  }

  // Check if generation K animation should be blocked
  isGenerationKAnimationBlocked(): boolean {
    // Generation K animation always has priority, never blocked
    return false;
  }

  // ENHANCED: Start exclusive message control with state machine and cleanup
  startExclusiveMessageControl(messageId: string, initialMessage: string): void {
    console.log(`🎭 [MessageCoordinator] Starting exclusive control for message: ${messageId}`);
    console.log(`🧹 [MessageCoordinator] Cleaning up old controlled messages: ${this.state.controlledMessages.size} existing`);
    
    // Transform initial message to be user-friendly
    const friendlyInitialMessage = this.makeFriendlyMessage(initialMessage);
    
    this.queueUpdate(() => {
      // CRITICAL FIX: Clear old controlled messages to prevent confusion
      const newControlledMessages = new Set<string>();
      newControlledMessages.add(messageId);
      
      this.state = {
        ...this.state,
        // Core control state
        currentOwner: 'PROJECT_SERVICE',
        activeMessageId: messageId,
        activeMessageContent: friendlyInitialMessage,
        currentMessage: friendlyInitialMessage,
        lastHandoffTime: Date.now(),
        
        // Exclusive state machine
        displayState: 'THINKING',
        exclusiveRenderingActive: true,
        
        // K animation state
        isGenerating: true,
        showKLoadingAnimation: true,
        kLoadingMessage: friendlyInitialMessage,
        currentPhase: 'specification', // Start with specification phase
        
        // CRITICAL FIX: Replace controlled messages set instead of adding
        controlledMessages: newControlledMessages,
        
        // Reset completion flags
        completionData: null,
        generationComplete: false,
        streamingComplete: false,

        // NEW: Reset phase tracking
        currentTransition: null,
        phaseStartTime: Date.now(),
        phaseHistory: [],
        
        // CRITICAL FIX: Reset ownership locks
        ownershipLocked: false,
        pendingOwnershipTransfer: null,

        // Ensure pure visual state is disabled for exclusive control
        pureVisualState: false,
        visualStateMessage: ''
      };
    });
  }

  // ENHANCED: CREATE message with exclusive control and cleanup
  createAndControlGenerationMessage(projectId: string, initialContent: string = 'Getting ready to bring your idea to life...'): string {
    if (!this.addMessageToProjectFn) {
      throw new Error('MessageCoordinator: Message creator not registered');
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`🎭 [MessageCoordinator] Creating generation message: ${messageId}`);
    console.log(`🧹 [MessageCoordinator] This will clean up ${this.state.controlledMessages.size} old messages`);
    
    // Transform initial content to be user-friendly
    const friendlyContent = this.makeFriendlyMessage(initialContent);
    
    // Create the message through the registered function
    const assistantMessage = {
      id: messageId,
      type: 'system',
      content: friendlyContent,
      timestamp: new Date(),
      isGenerating: true,
      isProjectGeneration: true 
    };

    this.addMessageToProjectFn(projectId, assistantMessage);

    // Start exclusive control with cleanup
    this.startExclusiveMessageControl(messageId, friendlyContent);

    return messageId;
  }

  // 🔥 FRIENDLY: Seamless handoff to FileManager with user-friendly messages
  public handoffToFileManager(initialFileMessage: string): void {
    const friendlyMessage = this.makeFriendlyMessage(initialFileMessage) || 'Organizing your files...';
    console.log(`🎭 [MessageCoordinator] Handoff to file processing: "${friendlyMessage}"`);
    
    this.queueUpdate(() => {
      // CRITICAL FIX: Lock ownership to prevent interference
      this.state = {
        ...this.state,
        currentOwner: 'FILE_MANAGER',
        currentMessage: friendlyMessage,
        activeMessageContent: friendlyMessage,
        kLoadingMessage: friendlyMessage,
        lastHandoffTime: Date.now(),
        isStreamingActive: true,
        displayState: 'THINKING', // CRITICAL FIX: Keep as THINKING for UI rendering
        // KEEP: showKLoadingAnimation: true - NO INTERRUPTION
        // KEEP: exclusiveRenderingActive: true - MAINTAIN CONTROL
        // CRITICAL FIX: Lock ownership to prevent competing updates
        ownershipLocked: true,
        pendingOwnershipTransfer: null
      };
    });

    // Notify handoff listeners
    this.notifyHandoff({
      fromOwner: 'PROJECT_SERVICE',
      toOwner: 'FILE_MANAGER',
      reason: 'STREAMING_STARTED',
      showKAnimation: true,
      messageId: this.state.activeMessageId
    });
  }

  // ENHANCED: Transition to streaming state
  transitionToStreaming(): void {
    if (this.state.displayState !== 'THINKING') {
      console.warn('🎭 [MessageCoordinator] Invalid state transition to STREAMING from', this.state.displayState);
      return;
    }

    console.log('🎭 [MessageCoordinator] Transitioning to streaming state');
    
    this.queueUpdate(() => {
      this.state = {
        ...this.state,
        displayState: 'THINKING', // CRITICAL FIX: Keep as THINKING during file detection
        isStreamingActive: true
        // KEEP: showKLoadingAnimation: true - MAINTAIN K ANIMATION
      };
    });
  }

  // 🔥 FRIENDLY: PROJECT SERVICE takes control with friendly messaging
  takeProjectServiceControl(message: string, phase: ProjectGenerationPhase, showKAnimation: boolean = false, transitionContext?: Partial<PhaseTransitionContext>): void {
    const wasFileManager = this.state.currentOwner === 'FILE_MANAGER';
    
    // Transform message to be user-friendly
    const friendlyMessage = this.makeFriendlyMessage(message) || this.getGenericFriendlyMessage();
    
    console.log(`🎭 [MessageCoordinator] PROJECT_SERVICE taking control: "${friendlyMessage}" (phase: ${phase}, K: ${showKAnimation})`);
    
    // If this is a phase transition, use the rich transition system
    if (phase !== this.state.currentPhase && phase !== 'idle') {
      this.transitionToPhase(phase, transitionContext);
      return;
    }
    
    this.queueUpdate(() => {
      const handoffContext: MessageHandoffContext = {
        fromOwner: this.state.currentOwner,
        toOwner: 'PROJECT_SERVICE',
        reason: wasFileManager ? 'STREAMING_ENDED' : 'PHASE_TRANSITION',
        phaseContext: phase,
        showKAnimation,
        messageId: this.state.activeMessageId
      };

      this.state = {
        ...this.state,
        currentOwner: 'PROJECT_SERVICE',
        currentMessage: friendlyMessage,
        activeMessageContent: friendlyMessage,
        lastHandoffTime: Date.now(),
        isStreamingActive: false,
        currentPhase: phase,
        displayState: showKAnimation ? 'THINKING' : this.state.displayState,
        showKLoadingAnimation: showKAnimation,
        kLoadingMessage: showKAnimation ? friendlyMessage : this.state.kLoadingMessage,
        isGenerating: true,
        // CRITICAL FIX: Mark streaming complete when FILE_MANAGER hands back control
        streamingComplete: wasFileManager ? true : this.state.streamingComplete,
        // CRITICAL FIX: Unlock ownership after handoff
        ownershipLocked: false,
        pendingOwnershipTransfer: null
      };

      this.notifyHandoff(handoffContext);
    });
  }

  // CRITICAL FIX: Update message content with ownership validation and lock checking
  updateMessageContent(content: string, owner: MessageOwner): void {
    // CRITICAL FIX: Check ownership lock first
    if (this.state.ownershipLocked && this.state.currentOwner !== owner) {
      console.log(`🔒 [MessageCoordinator] Ownership locked - rejecting update from ${owner}, current owner: ${this.state.currentOwner}`);
      return;
    }

    if (this.state.currentOwner !== owner) {
      verboseWarn('MessageCoordinator', `Attempted message update from ${owner} but ${this.state.currentOwner} is in control`);
      return;
    }

    // Transform content to be user-friendly
    const friendlyContent = this.makeFriendlyMessage(content);
    verboseLog('MessageCoordinator', `Message content update from ${owner}: "${friendlyContent.substring(0, 50)}..."`);
    
    this.queueUpdate(() => {
      this.state = {
        ...this.state,
        currentMessage: friendlyContent,
        activeMessageContent: friendlyContent,
        kLoadingMessage: friendlyContent // Also update K message if K animation is active
      };
    });
  }

  // Update message from current owner (legacy support)
  updateMessage(message: string, owner: MessageOwner): void {
    this.updateMessageContent(message, owner);
  }

  // CRITICAL FIX: Enhanced ownership checking with lock validation
  canSendMessage(owner: MessageOwner): boolean {
    // If ownership is locked, only current owner can send
    if (this.state.ownershipLocked) {
      const canSend = this.state.currentOwner === owner;
      verboseLog('MessageCoordinator', `Ownership locked check: ${owner} can send: ${canSend} (current: ${this.state.currentOwner})`);
      return canSend;
    }
    
    return this.state.currentOwner === owner;
  }

  // Get active message ID
  getActiveMessageId(): string | null {
    return this.state.activeMessageId;
  }

  // Get active message content
  getActiveMessageContent(): string {
    return this.state.activeMessageContent;
  }

  // NEW: Get current phase information for external components
  getCurrentPhaseInfo(): {
    phase: ProjectGenerationPhase;
    transition: PhaseTransitionContext | null;
    duration: number;
    history: Array<{phase: ProjectGenerationPhase, duration: number, timestamp: number}>;
  } {
    return {
      phase: this.state.currentPhase,
      transition: this.state.currentTransition,
      duration: Date.now() - this.state.phaseStartTime,
      history: [...this.state.phaseHistory]
    };
  }

  // 🔥 FRIENDLY: Complete generation with user-friendly messaging
  completeGeneration(finalMessage: string, completionData: CompletionData): void {
    // Transform final message to be user-friendly
    const friendlyFinalMessage = this.makeFriendlyMessage(finalMessage) || 'Your project is ready!';
    
    console.log(`🎭 [MessageCoordinator] Generation complete: "${friendlyFinalMessage.substring(0, 50)}..."`);
    console.log(`🎭 [MessageCoordinator] Completion data:`, {
      filesCount: Object.keys(completionData.extractedFiles).length,
      deploymentReady: completionData.deploymentReady,
      messageId: completionData.messageId
    });
    
    // Record final phase completion
    const finalPhaseDuration = Date.now() - this.state.phaseStartTime;
    
    this.queueUpdate(() => {
      // Ensure completion data has the correct message ID
      const completionDataWithMessageId: CompletionData = {
        ...completionData,
        messageId: this.state.activeMessageId || 'unknown'
      };
      
      const handoffContext: MessageHandoffContext = {
        fromOwner: this.state.currentOwner,
        toOwner: 'PROJECT_SERVICE',
        reason: 'GENERATION_COMPLETE',
        messageId: this.state.activeMessageId
      };

      // Add final phase to history
      this.state.phaseHistory.push({
        phase: this.state.currentPhase,
        duration: finalPhaseDuration,
        timestamp: this.state.phaseStartTime
      });

      // ENHANCED: Transition to completed state but maintain exclusive control
      this.state = {
        ...this.state,
        currentOwner: 'PROJECT_SERVICE',
        currentMessage: friendlyFinalMessage,
        activeMessageContent: friendlyFinalMessage,
        lastHandoffTime: Date.now(),
        isStreamingActive: false,
        currentPhase: 'complete',
        displayState: 'COMPLETED',
        showKLoadingAnimation: false,
        kLoadingMessage: '',
        isGenerating: false,
        completionData: completionDataWithMessageId,
        // CRITICAL FIX: Mark generation as complete
        generationComplete: true,
        streamingComplete: true,
        // MAINTAIN: Keep exclusive control until manually released
        exclusiveRenderingActive: true,
        // Clear transition state
        currentTransition: null,
        // CRITICAL FIX: Unlock ownership on completion
        ownershipLocked: false,
        pendingOwnershipTransfer: null,
        // Clear pure visual state
        pureVisualState: false,
        visualStateMessage: ''
      };

      this.notifyHandoff(handoffContext);
    });
    
    // CRITICAL FIX: Delay deployment context creation to avoid race conditions
    console.log('🎭 [MessageCoordinator] Scheduling deployment context creation...');
    setTimeout(() => {
      this.notifyCompletionForDeployment();
    }, 100);
  }
  
  // NEW: Notify completion for deployment context creation with proper coordination
  private notifyCompletionForDeployment(): void {
    console.log('🎭 [MessageCoordinator] Notifying completion for deployment context creation');
    // This will trigger the deployment context creation through the handoff system
    // The timing ensures state is fully stabilized before deployment coordination begins
  }

  // ENHANCED: Release exclusive control of a message with proper cleanup
  releaseExclusiveControl(messageId: string): void {
    console.log(`🎭 [MessageCoordinator] Releasing exclusive control of message: ${messageId}`);
    
    this.queueUpdate(() => {
      const updatedControlledMessages = new Set(this.state.controlledMessages);
      updatedControlledMessages.delete(messageId);
      
      const isActiveMessage = this.state.activeMessageId === messageId;
      
      this.state = {
        ...this.state,
        controlledMessages: updatedControlledMessages,
        // If releasing the active message, reset states
        ...(isActiveMessage && {
          activeMessageId: null,
          activeMessageContent: '',
          displayState: 'IDLE',
          exclusiveRenderingActive: false,
          showKLoadingAnimation: false,
          isGenerating: false,
          currentPhase: 'idle',
          currentTransition: null,
          phaseHistory: [],
          ownershipLocked: false,
          pendingOwnershipTransfer: null,
          pureVisualState: false,
          visualStateMessage: ''
        })
      };
    });
  }

  // Get completion data
  getCompletionData(): CompletionData | null {
    return this.state.completionData;
  }

  // ENHANCED: Check if message is controlled by coordinator with Set lookup
  isControllingMessage(messageId: string): boolean {
    const isControlling = this.state.controlledMessages.has(messageId) || this.state.activeMessageId === messageId;
    return isControlling;
  }

  // CRITICAL FIX: Check if generation is complete
  isGenerationComplete(): boolean {
    return this.state.generationComplete;
  }

  // CRITICAL FIX: Check if streaming is complete
  isStreamingComplete(): boolean {
    return this.state.streamingComplete;
  }

  // ENHANCED: Reset with controlled cleanup
  reset(): void {
    console.log('🎭 [MessageCoordinator] Resetting - maintaining controlled messages');
    
    this.queueUpdate(() => {
      // Don't reset controlledMessages - they should persist across resets
      this.state = {
        ...this.state,
        currentOwner: 'NONE',
        currentMessage: '',
        lastHandoffTime: 0,
        isStreamingActive: false,
        currentPhase: 'idle',
        displayState: 'IDLE',
        showKLoadingAnimation: false,
        kLoadingMessage: '',
        isGenerating: false,
        completionData: null,
        activeMessageId: null,
        activeMessageContent: '',
        exclusiveRenderingActive: false,
        // CRITICAL FIX: Reset completion flags
        generationComplete: false,
        streamingComplete: false,
        // NEW: Reset phase tracking
        currentTransition: null,
        phaseStartTime: Date.now(),
        phaseHistory: [],
        // CRITICAL FIX: Reset ownership locks
        ownershipLocked: false,
        pendingOwnershipTransfer: null,
        // NEW: Reset pure visual state
        pureVisualState: false,
        visualStateMessage: '',
        // 🔥 NEW: Reset atomic message creation state
        messageCreationInProgress: false,
        pendingMessageCreation: null
        // KEEP: controlledMessages persists across resets
      };
    });
  }

  // ENHANCED: Full reset with message cleanup
  fullReset(): void {
    console.log('🎭 [MessageCoordinator] Full reset - clearing all controlled messages');
    
    this.queueUpdate(() => {
      this.state = {
        currentOwner: 'NONE',
        currentMessage: '',
        lastHandoffTime: 0,
        isStreamingActive: false,
        currentPhase: 'idle',
        displayState: 'IDLE',
        showKLoadingAnimation: false,
        kLoadingMessage: '',
        isGenerating: false,
        completionData: null,
        activeMessageId: null,
        activeMessageContent: '',
        controlledMessages: new Set<string>(),
        generationComplete: false,
        streamingComplete: false,
        exclusiveRenderingActive: false,
        currentTransition: null,
        phaseStartTime: Date.now(),
        phaseHistory: [],
        ownershipLocked: false,
        pendingOwnershipTransfer: null,
        pureVisualState: false,
        visualStateMessage: '',
        // 🔥 NEW: Reset atomic message creation state
        messageCreationInProgress: false,
        pendingMessageCreation: null
      };
    });
  }

  private notifyListeners(): void {
    const currentState = { ...this.state };
    verboseLog('MessageCoordinator', `Notifying ${this.listeners.length} listeners with state:`, {
      owner: currentState.currentOwner,
      phase: currentState.currentPhase,
      displayState: currentState.displayState,
      showK: currentState.showKLoadingAnimation,
      exclusive: currentState.exclusiveRenderingActive,
      pureVisual: currentState.pureVisualState,
      controlledCount: currentState.controlledMessages.size,
      activeMessage: currentState.activeMessageId?.substring(currentState.activeMessageId.length - 8) || 'none',
      message: currentState.currentMessage?.substring(0, 50) + '...',
      isGenerating: currentState.isGenerating,
      generationComplete: currentState.generationComplete,
      streamingComplete: currentState.streamingComplete,
      ownershipLocked: currentState.ownershipLocked,
      transition: currentState.currentTransition ? `${currentState.currentTransition.fromPhase} → ${currentState.currentTransition.toPhase}` : null,
      // 🔥 NEW: Message creation state
      messageCreationInProgress: currentState.messageCreationInProgress,
      pendingMessageCreation: currentState.pendingMessageCreation?.substring(currentState.pendingMessageCreation.length - 8) || 'none'
    });
    
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        console.error('🎭 [MessageCoordinator] Error in listener:', error);
      }
    });
  }

  private notifyHandoff(context: MessageHandoffContext): void {
    console.log(`🎭 [MessageCoordinator] Handoff: ${context.fromOwner} → ${context.toOwner} (${context.reason})`);
    this.handoffListeners.forEach(listener => {
      try {
        listener(context);
      } catch (error) {
        console.error('🎭 [MessageCoordinator] Error in handoff listener:', error);
      }
    });
  }
}

// Singleton instance
export const messageCoordinator = new MessageCoordinatorService();