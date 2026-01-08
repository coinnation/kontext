import { StateCreator } from 'zustand';
import { ChatInterfaceMessage, StreamingState, MessagePriority, MessagePriorityContext } from '../../types';
import { 
  detectMessageDomain, 
  calculateTopicRelevance, 
  shouldExcludeMessage,
  isErrorResolved,
  detectTopicClosure // 🔥 FIX 2: Import topic closure detection
} from '../../utils/messageDomainDetection';

export interface MessageSyncState {
  isLoading: boolean;
  isSaving: boolean;
  lastSyncTime: number | null;
  pendingMessages: string[];
  error: string | null;
}

export interface ConversationSession {
  id: string;
  projectId: string;
  startTime: number;
  messages: ChatInterfaceMessage[];
}

// Temporary file/image storage for pending messages
export interface PendingAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  base64Data: string;
  textContent?: string;
}

export interface PendingImage {
  id: string;
  name: string;
  type: string;
  size: number;
  base64Data: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

export interface ChatStateSliceState {
  currentSessionId: string | null;
  currentSessionMessages: ChatInterfaceMessage[];
  projectMessages: { [projectId: string]: ChatInterfaceMessage[] };
  currentMessages: ChatInterfaceMessage[];
  input: string;
  streamingState: StreamingState;
  messageSync: MessageSyncState;
  // 🔥 NEW: Priority system state
  priorityAssignments: { [messageId: string]: MessagePriorityContext };
  currentInstructionId: string | null;
  conversationGroups: { [groupId: string]: string[] }; // groupId -> messageIds
  priorityOrdering: string[]; // ordered list of message IDs by priority
  // 🔥 NEW: Pending attachments for next message
  pendingFiles: PendingAttachment[] | null;
  pendingImages: PendingImage[] | null;
}

export interface ChatStateSliceActions {
  setInput: (input: string) => void;
  addMessageToProject: (projectId: string, message: ChatInterfaceMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatInterfaceMessage>) => void;
  loadProjectMessages: (projectId: string) => Promise<void>;
  clearProjectMessages: (projectId: string) => Promise<boolean>;
  setNoProjectState: () => void;
  startNewSession: (projectId: string) => void;
  endCurrentSession: () => void;
  getCurrentSessionMessages: () => ChatInterfaceMessage[];
  setStreamingState: (content: string, messageId: string) => void;
  clearStreamingState: () => void;
  updateStreamingContent: (content: string) => void;
  saveMessageToCanister: (projectId: string, message: ChatInterfaceMessage) => Promise<void>;
  updateMessageInCanister: (projectId: string, messageId: string, content: string, isGenerating?: boolean) => Promise<void>;
  cleanMessageContent: (content: string) => string;
  // 🔥 NEW: Priority system actions
  addPriorityMessage: (projectId: string, message: ChatInterfaceMessage, priority: MessagePriority, priorityReason: string) => void;
  assignMessagePriority: (messageId: string, priority: MessagePriority, reason: string, isCurrentInstruction?: boolean) => void;
  markCurrentUserInstruction: (messageId: string) => void;
  getPriorityOrderedMessages: (projectId?: string) => ChatInterfaceMessage[];
  updatePriorityOrdering: (projectId: string) => void;
  createConversationGroup: (messages: ChatInterfaceMessage[]) => string;
  addToConversationGroup: (groupId: string, messageId: string) => void;
  getPriorityContext: (messageId: string) => MessagePriorityContext | null;
  reassignPriorities: (projectId: string, currentUserMessageId?: string) => void;
  // 🔥 NEW: Pending attachments management
  setPendingAttachments: (files: PendingAttachment[] | null, images: PendingImage[] | null) => void;
  clearPendingAttachments: () => void;
}

export type ChatStateSlice = ChatStateSliceState & ChatStateSliceActions;

const NO_PROJECT_MESSAGES: ChatInterfaceMessage[] = [{
  id: 'no-project-welcome',
  type: 'system',
  content: '👋 Welcome to Kontext!\n\nTo get started, please:\n• **Create a new project** by clicking "✨ New Project" in the sidebar\n• **Select an existing project** from the sidebar\n\nOnce you have a project selected, you can chat with your AI assistant to build amazing applications!',
  timestamp: new Date()
}];

const generateSessionId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `session_${timestamp}_${random}`;
};

// 🔥 NEW: Generate conversation group ID
const generateConversationGroupId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `group_${timestamp}_${random}`;
};

// 🆕 COMPREHENSIVE: Context-aware priority assignment with relevance checking
const determinePriorityFromContext = (
  message: ChatInterfaceMessage,
  allMessages: ChatInterfaceMessage[],
  isCurrentInstruction: boolean = false,
  currentInstruction?: ChatInterfaceMessage // 🆕 NEW: Pass current instruction for relevance
): { priority: MessagePriority; reason: string } => {
  
  // 🎯 CRITICAL: Current instruction always highest
  if (isCurrentInstruction || (message.type === 'user' && message.isCurrentInstruction)) {
    return {
      priority: MessagePriority.CRITICAL,
      reason: "Current user instruction - highest priority"
    };
  }
  
  // 🆕 NEW: Check if message should be excluded
  if (shouldExcludeMessage(message)) {
    return {
      priority: MessagePriority.LOW,
      reason: "Excluded - resolved auto-retry message past expiration"
    };
  }
  
  const messageIndex = allMessages.findIndex(m => m.id === message.id);
  const totalMessages = allMessages.length;
  const isRecent = messageIndex >= Math.max(0, totalMessages - 5);
  const age = totalMessages - messageIndex; // Messages since this one
  
  // 🆕 NEW: Calculate topic relevance if current instruction available
  let topicRelevance = 0.5; // Default medium relevance
  if (currentInstruction) {
    topicRelevance = calculateTopicRelevance(currentInstruction, message);
  }
  
  // 🆕 NEW: Check if message is resolved
  const domain = detectMessageDomain(message);
  const isResolved = domain.resolved || isErrorResolved(message, allMessages);
  
  // System messages priority logic
  if (message.type === 'system') {
    // 🆕 ENHANCED: Error messages - but consider resolution and relevance
    if (message.content.toLowerCase().includes('error') || 
        message.content.toLowerCase().includes('failed') ||
        message.content.toLowerCase().includes('issue')) {
      
      // 🚨 Resolved errors = LOW priority (unless very recent and relevant)
      if (isResolved) {
        if (isRecent && topicRelevance > 0.6) {
          return {
            priority: MessagePriority.MEDIUM,
            reason: "Recently resolved error - moderate relevance to current question"
          };
        }
        return {
          priority: MessagePriority.LOW,
          reason: "Resolved error - low priority for future contexts"
        };
      }
      
      // 🎯 Active errors - but only HIGH if relevant to current question
      if (topicRelevance > 0.5 || !currentInstruction) {
        // High relevance OR no current instruction (can't determine relevance)
        return {
          priority: MessagePriority.HIGH,
          reason: topicRelevance > 0.5 
            ? "Active error relevant to current question"
            : "Active error requiring attention"
        };
      } else {
        // Low relevance = MEDIUM priority (error exists but not relevant)
        return {
          priority: MessagePriority.MEDIUM,
          reason: "Active error but low relevance to current question"
        };
      }
    }
    
    // Project generation completions - keep HIGH but check relevance
    if (message.isProjectGeneration || 
        message.deploymentReady ||
        message.content.toLowerCase().includes('generation complete') ||
        message.content.toLowerCase().includes('ready to deploy')) {
      
      // Generation completions are usually relevant, but check anyway
      if (topicRelevance > 0.4 || !currentInstruction) {
        return {
          priority: MessagePriority.HIGH,
          reason: "Project generation completion"
        };
      }
      return {
        priority: MessagePriority.MEDIUM,
        reason: "Generation completion but low relevance to current question"
      };
    }
    
    // 🆕 ENHANCED: Recent AI responses - but consider relevance
    if (isRecent) {
      // Recent + high relevance = HIGH
      if (topicRelevance > 0.6) {
        return {
          priority: MessagePriority.HIGH,
          reason: "Recent AI response with high relevance to current question"
        };
      }
      // Recent + medium relevance = MEDIUM
      if (topicRelevance > 0.4) {
        return {
          priority: MessagePriority.MEDIUM,
          reason: "Recent AI response with moderate relevance"
        };
      }
      // Recent but low relevance = MEDIUM (still recent, so not LOW)
      return {
        priority: MessagePriority.MEDIUM,
        reason: "Recent AI response but low relevance to current question"
      };
    }
    
    // 🆕 ENHANCED: Older messages with temporal decay
    // Apply decay based on age
    if (age > 10) {
      // Very old = LOW unless highly relevant
      if (topicRelevance > 0.7) {
        return {
          priority: MessagePriority.MEDIUM,
          reason: "Older message but highly relevant to current question"
        };
      }
      return {
        priority: MessagePriority.LOW,
        reason: "Older message with low relevance"
      };
    }
    
    // Standard AI responses (medium age)
    return {
      priority: MessagePriority.MEDIUM,
      reason: "Standard AI response - supporting context"
    };
  }
  
  // User messages priority logic
  if (message.type === 'user') {
    if (isRecent) {
      // Recent user messages - check relevance
      if (topicRelevance > 0.5 || !currentInstruction) {
        return {
          priority: MessagePriority.MEDIUM,
          reason: "Recent user message - relevant context"
        };
      }
      return {
        priority: MessagePriority.LOW,
        reason: "Recent user message but low relevance"
      };
    } else {
      return {
        priority: MessagePriority.LOW,
        reason: "Older user message - background context"
      };
    }
  }
  
  // Default fallback
  return {
    priority: MessagePriority.LOW,
    reason: "Default priority assignment"
  };
};

// 🔥 NEW: Extract file references from message content
const extractFileReferences = (content: string): string[] => {
  const fileReferences: string[] = [];
  
  // Match common file patterns
  const filePatterns = [
    /(\w+\.(tsx?|jsx?|css|mo|json|html|js))/gi,
    /src\/[\w\/]+\.\w+/gi,
    /\.\/[\w\/]+\.\w+/gi
  ];
  
  for (const pattern of filePatterns) {
    const matches = content.match(pattern);
    if (matches) {
      fileReferences.push(...matches);
    }
  }
  
  return [...new Set(fileReferences)]; // Remove duplicates
};

// 🔥 NEW: Detect topic continuity
const detectTopicContinuity = (
  currentMessage: ChatInterfaceMessage,
  previousMessages: ChatInterfaceMessage[]
): boolean => {
  if (previousMessages.length === 0) return false;
  
  const recentMessages = previousMessages.slice(-3);
  const currentContent = currentMessage.content.toLowerCase();
  
  // Check for topic keywords overlap
  const extractKeywords = (content: string) => {
    return content.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10); // Top 10 keywords
  };
  
  const currentKeywords = new Set(extractKeywords(currentContent));
  
  for (const prevMessage of recentMessages) {
    const prevKeywords = new Set(extractKeywords(prevMessage.content));
    const overlap = [...currentKeywords].filter(keyword => prevKeywords.has(keyword));
    
    if (overlap.length >= 2) {
      return true; // Significant topic overlap
    }
  }
  
  return false;
};

const log = (category: string, message: string, ...args: any[]) => {
  console.log(`[${category}] ${message}`, ...args);
};

export const createChatStateSlice: StateCreator<any, [], [], ChatStateSlice> = (set, get) => ({
  currentSessionId: null,
  currentSessionMessages: [],
  projectMessages: {},
  currentMessages: [...NO_PROJECT_MESSAGES],
  input: '',
  streamingState: {
    isStreaming: false,
    streamingContent: '',
    streamingMessageId: null,
    accumulatedLength: 0
  },
  messageSync: {
    isLoading: false,
    isSaving: false,
    lastSyncTime: null,
    pendingMessages: [],
    error: null
  },
  // 🔥 NEW: Priority system state initialization
  priorityAssignments: {},
  // 🔥 NEW: Pending attachments
  pendingFiles: null,
  pendingImages: null,
  currentInstructionId: null,
  conversationGroups: {},
  priorityOrdering: [],

  setInput: (input: string) => {
    set((state: any) => {
      state.input = input;
    });
  },

  cleanMessageContent: (content: string): string => {
    return content
      .replace(/\n\n===.*?===\n[\s\S]*?\n=== END.*?===\n\n/g, '')
      .replace(/\[CURRENT REQUEST - PRIORITY\]\s*/g, '')
      .replace(/\[CONTEXT\]\s*/g, '')
      .trim();
  },

  // 🔥 STREAMLINED: Simple message storage for coordinator-created messages
  addMessageToProject: (projectId: string, message: ChatInterfaceMessage) => {
    console.log(`🔥 [ChatState] COORDINATOR MESSAGE STORAGE - Adding message: ${message.id}`);
    
    set((state: any) => {
      // Phase 1: Initialize project arrays if needed
      if (!state.projectMessages[projectId]) {
        state.projectMessages[projectId] = [];
      }
      
      // Phase 2: Store coordinator-provided priority context
      if (message.priorityContext) {
        state.priorityAssignments[message.id] = message.priorityContext;
        console.log(`🔥 [ChatState] Stored coordinator priority context: ${message.priorityContext.priority} for ${message.id}`);
        
        // Update currentInstructionId if this is a current instruction
        if (message.isCurrentInstruction || message.priorityContext.isCurrentInstruction) {
          // Clear previous current instruction
          if (state.currentInstructionId && state.currentInstructionId !== message.id) {
            const prevContext = state.priorityAssignments[state.currentInstructionId];
            if (prevContext) {
              prevContext.isCurrentInstruction = false;
              prevContext.priority = MessagePriority.HIGH;
              prevContext.priorityReason = "Previous instruction - now supporting context";
              
              // Update in arrays
              const updatePrevInArray = (messages: ChatInterfaceMessage[]) => {
                const prevIndex = messages.findIndex(m => m.id === state.currentInstructionId);
                if (prevIndex !== -1) {
                  messages[prevIndex].isCurrentInstruction = false;
                  messages[prevIndex].priorityContext = prevContext;
                }
              };
              
              if (state.projectMessages[projectId]) updatePrevInArray(state.projectMessages[projectId]);
              if (state.activeProject === projectId) updatePrevInArray(state.currentMessages);
              if (state.currentSessionMessages) updatePrevInArray(state.currentSessionMessages);
            }
          }
          
          state.currentInstructionId = message.id;
          console.log(`🔥 [ChatState] Updated currentInstructionId: ${message.id}`);
        }
      } else {
        // Fallback: If coordinator didn't provide priority context, create one
        console.warn(`🔥 [ChatState] No priority context from coordinator, creating fallback for: ${message.id}`);
        
        const { priority, reason } = determinePriorityFromContext(
          message,
          state.projectMessages[projectId],
          message.isCurrentInstruction || false
        );
        
        const priorityContext: MessagePriorityContext = {
          priority,
          priorityReason: reason,
          assignedAt: Date.now(),
          isCurrentInstruction: message.isCurrentInstruction || false,
          supportingContext: {
            relatedMessages: [],
            fileReferences: extractFileReferences(message.content),
            topicContinuity: detectTopicContinuity(message, state.projectMessages[projectId])
          },
          conversationFlow: {
            isResponseTo: null,
            startsNewTopic: !detectTopicContinuity(message, state.projectMessages[projectId]),
            closesLoop: false
          }
        };
        
        message.priorityContext = priorityContext;
        state.priorityAssignments[message.id] = priorityContext;
        
        if (message.isCurrentInstruction) {
          state.currentInstructionId = message.id;
        }
      }
      
      // 🔥 GAP 17 FIX: ALWAYS assign domain context when message is added
      // This ensures filtering logic works immediately without needing reassignPriorities()
      if (!message.domainContext) {
        const domain = detectMessageDomain(message);
        message.domainContext = domain;
        console.log(`🎯 [ChatState] Assigned domain context: ${domain.domain}, features: [${domain.featureContext?.join(', ') || 'none'}]`);
      }
      
      // 🔥 GAP 21 FIX: Check for topic closure on EVERY message add (not just in reassignPriorities)
      // This ensures topic closure logic actually runs
      if (message.type === 'user') {
        const existingMessages = state.projectMessages[projectId] || [];
        const previousMessages = existingMessages.slice(0); // All messages before this one
        
        if (detectTopicClosure(message, previousMessages) && previousMessages.length > 0) {
          console.log(`🔚 [TOPIC CLOSURE] Detected topic closure in new message ${message.id}`);
          
          // Find what topic/features this closure is ending
          const closingDomain = detectMessageDomain(message);
          const closingFeatures = closingDomain.featureContext || [];
          
          // Work backwards to find related messages to resolve
          for (let i = previousMessages.length - 1; i >= 0 && i >= previousMessages.length - 10; i--) {
            const prevMsg = previousMessages[i];
            const prevDomain = detectMessageDomain(prevMsg);
            
            // Skip already resolved
            if (prevDomain.resolved) {
              continue;
            }
            
            // Check if this message is related to what's being closed
            const prevFeatures = prevDomain.featureContext || [];
            const hasFeatureOverlap = prevFeatures.some(f => closingFeatures.includes(f));
            const sameDomain = prevDomain.domain === closingDomain.domain;
            
            // 🔥 GAP 23 FIX: Only mark as resolved if features overlap OR both are feature-less (generic)
            // Don't mark different features just because same domain
            const bothGeneric = prevFeatures.length === 0 && closingFeatures.length === 0;
            const isRelated = hasFeatureOverlap || (sameDomain && bothGeneric);
            
            if (isRelated) {
              // Mutate existing domainContext
              if (prevMsg.domainContext) {
                prevMsg.domainContext.resolved = true;
                prevMsg.domainContext.resolvedAt = Date.now();
              } else {
                prevMsg.domainContext = {
                  ...prevDomain,
                  resolved: true,
                  resolvedAt: Date.now()
                };
              }
              console.log(`🔚 [TOPIC CLOSURE] Auto-resolved related message ${prevMsg.id} (domain: ${prevDomain.domain}, features: [${prevFeatures.join(', ')}])`);
            }
          }
        }
      }
      
      // Phase 3: Add message to arrays
      state.projectMessages[projectId].push(message);
      
      // Phase 4: Update session and current messages
      if (state.currentSessionId && state.activeProject === projectId) {
        state.currentSessionMessages.push(message);
      }
      
      if (state.activeProject === projectId) {
        // 🔥 FIX #3: Sort chronologically (oldest first) - backend timestamps are authoritative when available
        // New messages have frontend timestamps until reloaded from backend
        // Backend generates timestamps using Time.now(), and updates change timestamps
        const sortedMessages = [...state.projectMessages[projectId]].sort((a, b) => {
          return a.timestamp.getTime() - b.timestamp.getTime();
        });
        state.currentMessages = sortedMessages;
        
        // Update priority ordering
        state.priorityOrdering = state.projectMessages[projectId]
          .sort((a, b) => {
            const aPriority = a.priorityContext?.priority || MessagePriority.LOW;
            const bPriority = b.priorityContext?.priority || MessagePriority.LOW;
            const priorityOrder = [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.MEDIUM, MessagePriority.LOW, MessagePriority.CONTEXT];
            return priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority);
          })
          .map(m => m.id);
      }
      
      console.log(`🔥 [ChatState] Message storage complete for: ${message.id} with priority ${message.priorityContext?.priority}`);
    });
  },

  // 🔥 ENHANCED: Atomic priority-aware message addition with full synchronization
  addPriorityMessage: (projectId: string, message: ChatInterfaceMessage, priority: MessagePriority, priorityReason: string) => {
    console.log(`🔥 [ChatState] ATOMIC PRIORITY MESSAGE ADD - Starting: ${message.id} with priority ${priority}`);
    
    set((state: any) => {
      // Phase 1: Create priority context
      const priorityContext: MessagePriorityContext = {
        priority,
        priorityReason,
        assignedAt: Date.now(),
        isCurrentInstruction: priority === MessagePriority.CRITICAL,
        supportingContext: {
          relatedMessages: [],
          fileReferences: extractFileReferences(message.content),
          topicContinuity: false // Will be updated based on context
        },
        conversationFlow: {
          isResponseTo: null,
          startsNewTopic: true,
          closesLoop: false
        }
      };
      
      // Phase 2: ATOMIC assignment to both message and priority assignments
      message.priorityContext = priorityContext;
      message.isCurrentInstruction = priority === MessagePriority.CRITICAL;
      state.priorityAssignments[message.id] = priorityContext;
      
      // Phase 3: CRITICAL - Handle current instruction transition atomically
      if (priority === MessagePriority.CRITICAL) {
        // Clear previous current instruction
        if (state.currentInstructionId && state.currentInstructionId !== message.id) {
          const prevInstruction = state.priorityAssignments[state.currentInstructionId];
          if (prevInstruction) {
            prevInstruction.priority = MessagePriority.HIGH;
            prevInstruction.isCurrentInstruction = false;
            prevInstruction.priorityReason = "Previous instruction - now supporting context";
            
            // CRITICAL: Update the previous instruction in ALL message arrays synchronously
            const updatePrevInAllArrays = (prevId: string, updatedContext: MessagePriorityContext) => {
              const updateInArray = (messages: ChatInterfaceMessage[]) => {
                const index = messages.findIndex(m => m.id === prevId);
                if (index !== -1) {
                  messages[index].priorityContext = updatedContext;
                  messages[index].isCurrentInstruction = false;
                }
              };
              
              // Update in all relevant arrays
              if (state.projectMessages[projectId]) updateInArray(state.projectMessages[projectId]);
              if (state.activeProject === projectId) updateInArray(state.currentMessages);
              if (state.currentSessionMessages) updateInArray(state.currentSessionMessages);
            };
            
            updatePrevInAllArrays(state.currentInstructionId, prevInstruction);
          }
        }
        
        // Set new current instruction
        state.currentInstructionId = message.id;
        console.log(`🔥 [ChatState] ATOMIC CURRENT INSTRUCTION SET - New: ${message.id}`);
      }
      
      console.log(`🔥 [ChatState] PRIORITY MESSAGE SETUP COMPLETE - Calling addMessageToProject for final atomic add`);
    });
    
    // Phase 4: Use the enhanced addMessageToProject for final atomic addition
    // Note: We don't call get().addMessageToProject directly to avoid double set() calls
    // Instead, the message with full priority context will be handled by the next addMessageToProject call
    console.log(`🔥 [ChatState] ATOMIC PRIORITY MESSAGE ADD COMPLETE - ${message.id} ready for final addition`);
  },

  // 🔥 STREAMLINED: Simple priority assignment for coordinator integration
  assignMessagePriority: (messageId: string, priority: MessagePriority, reason: string, isCurrentInstruction: boolean = false) => {
    console.log(`🔥 [ChatState] SIMPLE PRIORITY ASSIGN - ${priority} to message: ${messageId}, isCurrentInstruction: ${isCurrentInstruction}`);
    
    set((state: any) => {
      const existingContext = state.priorityAssignments[messageId];
      
      // Create updated priority context
      const updatedContext: MessagePriorityContext = {
        ...existingContext,
        priority,
        priorityReason: reason,
        assignedAt: Date.now(),
        isCurrentInstruction
      };
      
      // Store in priority assignments
      state.priorityAssignments[messageId] = updatedContext;
      
      // Handle current instruction updates
      if (isCurrentInstruction) {
        if (state.currentInstructionId && state.currentInstructionId !== messageId) {
          const prevContext = state.priorityAssignments[state.currentInstructionId];
          if (prevContext) {
            prevContext.isCurrentInstruction = false;
            prevContext.priority = MessagePriority.HIGH;
            prevContext.priorityReason = "Previous instruction - now supporting context";
          }
        }
        
        state.currentInstructionId = messageId;
      }
      
      // Update message in arrays
      const updateMessageInArray = (messages: ChatInterfaceMessage[]) => {
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          messages[messageIndex].priorityContext = updatedContext;
          messages[messageIndex].isCurrentInstruction = isCurrentInstruction;
          return true;
        }
        return false;
      };
      
      // Update in all arrays where the message might exist
      let updatedCount = 0;
      if (updateMessageInArray(state.currentMessages)) updatedCount++;
      if (updateMessageInArray(state.currentSessionMessages)) updatedCount++;
      
      for (const projectId in state.projectMessages) {
        if (updateMessageInArray(state.projectMessages[projectId])) updatedCount++;
      }
      
      console.log(`🔥 [ChatState] Updated ${updatedCount} array(s) with new priority context for ${messageId}`);
    });
  },

  // 🔥 SIMPLE: Mark current user instruction
  markCurrentUserInstruction: (messageId: string) => {
    console.log(`🔥 [ChatState] MARK CURRENT INSTRUCTION - ${messageId}`);
    (get() as any).assignMessagePriority(messageId, MessagePriority.CRITICAL, "Current user instruction - highest priority", true);
  },

  // 🔥 NEW: Get messages ordered by priority
  getPriorityOrderedMessages: (projectId?: string): ChatInterfaceMessage[] => {
    const state = get() as any;
    const targetProjectId = projectId || state.activeProject;
    
    if (!targetProjectId || !state.projectMessages[targetProjectId]) {
      return [];
    }
    
    const messages = [...state.projectMessages[targetProjectId]];
    
    // Sort by priority, then by timestamp within same priority
    return messages.sort((a, b) => {
      const aPriority = a.priorityContext?.priority || MessagePriority.LOW;
      const bPriority = b.priorityContext?.priority || MessagePriority.LOW;
      
      const priorityOrder = [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.MEDIUM, MessagePriority.LOW, MessagePriority.CONTEXT];
      const priorityComparison = priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority);
      
      if (priorityComparison !== 0) {
        return priorityComparison;
      }
      
      // 🔥 FIX #4: Within same priority, sort by timestamp (oldest first for chronological order)
      // Backend timestamps are authoritative - backend generates them using Time.now(), ignoring frontend
      // Updates change timestamps, so we must sort by timestamp, not array position
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  },

  // 🔥 NEW: Update priority ordering for a project
  updatePriorityOrdering: (projectId: string) => {
    console.log(`🔥 [ChatState] Updating priority ordering for project: ${projectId}`);
    
    set((state: any) => {
      if (state.projectMessages[projectId]) {
        const orderedMessages = (get() as any).getPriorityOrderedMessages(projectId);
        state.priorityOrdering = orderedMessages.map(m => m.id);
        
        console.log(`🔥 [ChatState] Updated priority ordering: ${state.priorityOrdering.length} messages`);
      }
    });
  },

  // 🔥 NEW: Create conversation group
  createConversationGroup: (messages: ChatInterfaceMessage[]): string => {
    const groupId = generateConversationGroupId();
    console.log(`🔥 [ChatState] Creating conversation group: ${groupId} with ${messages.length} messages`);
    
    set((state: any) => {
      state.conversationGroups[groupId] = messages.map(m => m.id);
      
      // Update messages with group ID
      messages.forEach(message => {
        message.conversationGroup = groupId;
        if (state.priorityAssignments[message.id]) {
          state.priorityAssignments[message.id].supportingContext.relatedMessages = 
            messages.filter(m => m.id !== message.id).map(m => m.id);
        }
      });
    });
    
    return groupId;
  },

  // 🔥 NEW: Add message to conversation group
  addToConversationGroup: (groupId: string, messageId: string) => {
    console.log(`🔥 [ChatState] Adding message ${messageId} to group ${groupId}`);
    
    set((state: any) => {
      if (state.conversationGroups[groupId]) {
        if (!state.conversationGroups[groupId].includes(messageId)) {
          state.conversationGroups[groupId].push(messageId);
          
          // Update message with group ID
          const updateMessageInArrays = (arrays: ChatInterfaceMessage[][]) => {
            arrays.forEach(messages => {
              const message = messages.find(m => m.id === messageId);
              if (message) {
                message.conversationGroup = groupId;
              }
            });
          };
          
          updateMessageInArrays([
            state.currentMessages,
            state.currentSessionMessages,
            ...Object.values(state.projectMessages)
          ]);
        }
      }
    });
  },

  // 🔥 NEW: Get priority context for message
  getPriorityContext: (messageId: string): MessagePriorityContext | null => {
    const state = get() as any;
    return state.priorityAssignments[messageId] || null;
  },

  // 🔥 STREAMLINED: Simple priority reassignment
  reassignPriorities: (projectId: string, currentUserMessageId?: string) => {
    console.log(`🔥 [ChatState] CONTEXT-AWARE PRIORITY REASSIGNMENT for project: ${projectId}, currentUserMessage: ${currentUserMessageId}`);
    
    set((state: any) => {
      if (!state.projectMessages[projectId]) return;
      
      const messages = state.projectMessages[projectId];
      
      // 🆕 NEW: Filter out excluded messages before processing
      const activeMessages = messages.filter(msg => !shouldExcludeMessage(msg, currentUserMessageId));
      
      // 🆕 NEW: Find current instruction for relevance calculation
      const currentInstruction = activeMessages.find(m => m.id === currentUserMessageId);
      
      // Clear current instruction
      const previousInstructionId = state.currentInstructionId;
      state.currentInstructionId = null;
      
      // Reassign priorities using active messages and current instruction context
      activeMessages.forEach((message, index) => {
        const isCurrentInstruction = message.id === currentUserMessageId;
        
        // 🔥 FIX 2: Check if this message indicates topic closure
        // If user says "moving on" or "another thing", mark previous messages as resolved
        // 🔥 GAP 1 FIX: Pass previous messages for context-aware detection
        const previousMessagesForContext = activeMessages.slice(0, index);
        if (message.type === 'user' && detectTopicClosure(message, previousMessagesForContext) && index > 0) {
          // 🔥 GAP 13 FIX: Only mark messages in the SAME topic segment as resolved
          // Don't blindly mark ALL previous messages - be selective
          
          // Find what topic/features this closure is ending
          const closingDomain = detectMessageDomain(message);
          const closingFeatures = closingDomain.featureContext || [];
          
          // Work backwards to find related messages to resolve
          for (let i = index - 1; i >= 0 && i >= index - 10; i--) { // Look back max 10 messages
            const prevMsg = activeMessages[i];
            const prevDomain = detectMessageDomain(prevMsg);
            
            // Skip already resolved
            if (prevDomain.resolved) {
              continue;
            }
            
            // Check if this message is related to what's being closed
            const prevFeatures = prevDomain.featureContext || [];
            const hasFeatureOverlap = prevFeatures.some(f => closingFeatures.includes(f));
            const sameDomain = prevDomain.domain === closingDomain.domain;
            
            // 🔥 GAP 23 FIX: Only mark as resolved if features overlap OR both are feature-less (generic)
            // Don't mark different features just because same domain  
            const bothGeneric = prevFeatures.length === 0 && closingFeatures.length === 0;
            const isRelated = hasFeatureOverlap || (sameDomain && bothGeneric);
            
            if (isRelated) {
              // 🔥 GAP 18 FIX: Mutate existing domainContext object instead of replacing
              if (prevMsg.domainContext) {
                prevMsg.domainContext.resolved = true;
                prevMsg.domainContext.resolvedAt = Date.now();
              } else {
                prevMsg.domainContext = {
                  ...prevDomain,
                  resolved: true,
                  resolvedAt: Date.now()
                };
              }
              console.log(`🔚 [TOPIC CLOSURE] Auto-resolved related message ${prevMsg.id} (domain: ${prevDomain.domain}, features: [${prevFeatures.join(', ')}])`);
            }
          }
        }
        
        // 🆕 NEW: Pass current instruction for relevance calculation
        const { priority, reason } = determinePriorityFromContext(
          message,
          activeMessages, // Use filtered list
          isCurrentInstruction,
          currentInstruction // 🆕 Pass for relevance
        );
        
        // 🆕 NEW: Store domain context in message
        const domainContext = detectMessageDomain(message);
        message.domainContext = domainContext;
        
        const priorityContext: MessagePriorityContext = {
          priority,
          priorityReason: reason,
          assignedAt: Date.now(),
          isCurrentInstruction,
          supportingContext: {
            relatedMessages: [],
            fileReferences: extractFileReferences(message.content),
            topicContinuity: detectTopicContinuity(message, activeMessages.slice(0, index))
          },
          conversationFlow: {
            isResponseTo: null,
            startsNewTopic: !detectTopicContinuity(message, activeMessages.slice(0, index)),
            closesLoop: false
          }
        };
        
        // Update both message and priority assignments
        message.priorityContext = priorityContext;
        message.isCurrentInstruction = isCurrentInstruction;
        state.priorityAssignments[message.id] = priorityContext;
        
        // Set current instruction
        if (isCurrentInstruction) {
          state.currentInstructionId = message.id;
        }
      });
      
      // Update priority ordering
      state.priorityOrdering = activeMessages
        .sort((a, b) => {
          const aPriority = a.priorityContext?.priority || MessagePriority.LOW;
          const bPriority = b.priorityContext?.priority || MessagePriority.LOW;
          const priorityOrder = [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.MEDIUM, MessagePriority.LOW, MessagePriority.CONTEXT];
          return priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority);
        })
        .map(m => m.id);
      
      // Update current messages if this is the active project
      if (state.activeProject === projectId) {
        state.currentMessages = [...activeMessages];
      }
      
      const excludedCount = messages.length - activeMessages.length;
      console.log(`🔥 [ChatState] CONTEXT-AWARE REASSIGNMENT COMPLETE - ${activeMessages.length} active messages processed, ${excludedCount} excluded, currentInstruction: ${state.currentInstructionId}`);
    });
  },

  // STREAMLINED: Simple updateMessage without complex coordination
  updateMessage: (messageId: string, updates: Partial<ChatInterfaceMessage>) => {
    console.log(`📝 [ChatStateSlice] Simple message update: ${messageId}`, updates);
    
    set((state: any) => {
      // Update in current messages
      const currentIndex = state.currentMessages.findIndex((m: ChatInterfaceMessage) => m.id === messageId);
      if (currentIndex !== -1) {
        state.currentMessages[currentIndex] = {
          ...state.currentMessages[currentIndex],
          ...updates,
          isGenerating: false
        };
      }
      
      // Update in project messages
      if (state.activeProject && state.projectMessages[state.activeProject]) {
        const projectIndex = state.projectMessages[state.activeProject].findIndex((m: ChatInterfaceMessage) => m.id === messageId);
        if (projectIndex !== -1) {
          state.projectMessages[state.activeProject][projectIndex] = {
            ...state.projectMessages[state.activeProject][projectIndex],
            ...updates,
            isGenerating: false
          };
        }
      }
      
      // Update in session messages
      if (state.currentSessionMessages) {
        const sessionIndex = state.currentSessionMessages.findIndex((m: ChatInterfaceMessage) => m.id === messageId);
        if (sessionIndex !== -1) {
          state.currentSessionMessages[sessionIndex] = {
            ...state.currentSessionMessages[sessionIndex],
            ...updates,
            isGenerating: false
          };
        }
      }
      
      // Update priority context if content changes
      if (updates.content && state.priorityAssignments[messageId]) {
        state.priorityAssignments[messageId].supportingContext.fileReferences = 
          extractFileReferences(updates.content);
      }
    });
    
    // Auto-save to backend
    const state = get() as any;
    if (state.activeProject && updates.content) {
      console.log(`💾 [ChatStateSlice] Auto-saving updated message to canister: ${messageId}`);
      state.updateMessageInCanister(state.activeProject, messageId, updates.content, false)
        .catch((error: any) => {
          console.error('❌ Failed to save updated message to canister:', error);
        });
    }
  },

  // 🔥 STREAMLINED: Simple loadProjectMessages with coordinator-compatible priority assignment
  loadProjectMessages: async (projectId: string) => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        return;
      }

      console.log('📥 LOADING PROJECT MESSAGES WITH COORDINATOR COMPATIBILITY:', projectId);

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const result = await userCanisterService.loadProjectMessages(projectId, userCanisterId, identity);
      
      if (result.success && result.messages) {
        console.log(`📥 Loaded ${result.messages.length} messages from canister - applying coordinator-compatible priority assignment`);
        
        const cleanedMessages = result.messages.map((msg: ChatInterfaceMessage) => {
          const hasContamination = msg.content.includes('=== AI ASSISTANT RULES ===') || 
                                 msg.content.includes('[CURRENT REQUEST - PRIORITY]') ||
                                 msg.content.includes('[CONTEXT]');
          
          if (hasContamination) {
            console.warn(`🧹 Cleaning contaminated message: ${msg.id}`);
            const cleanedContent = (get() as any).cleanMessageContent(msg.content);
            return {
              ...msg,
              content: cleanedContent
            };
          }
          return msg;
        });
        
        set((state: any) => {
          // 🔥 FIX #2: Merge backend messages with local messages, prioritizing backend timestamps
          // Backend generates timestamps using Time.now(), ignoring frontend timestamps
          // Backend returns messages in array order (insertion order), but updates change timestamps
          // So we must sort by timestamp, not array position
          const existingMessages = state.projectMessages[projectId] || [];
          const backendMessageIds = new Set(cleanedMessages.map((m: ChatInterfaceMessage) => m.id));

          // Keep local messages that haven't been saved to backend yet (not in backend response)
          const unsavedLocalMessages = existingMessages.filter(
            (m: ChatInterfaceMessage) => !backendMessageIds.has(m.id)
          );

          // Combine: backend messages (with authoritative timestamps) + unsaved local messages
          const allMessages = [...cleanedMessages, ...unsavedLocalMessages];

          // 🔥 FIX #2: Sort chronologically (oldest first) - backend timestamps are authoritative
          // This handles the case where updateMessageInProject changes timestamps
          const sortedMessages = allMessages.sort((a, b) => {
            return a.timestamp.getTime() - b.timestamp.getTime();
          });

          // Set messages (backend messages replace local ones with same ID)
          state.projectMessages[projectId] = sortedMessages;
          state.currentMessages = [...sortedMessages];

          // Assign priorities and domain context to loaded messages
          sortedMessages.forEach((message: ChatInterfaceMessage) => {
            // 🔥 GAP 20 FIX: Assign domain context to messages loaded from backend
            // Backend doesn't store domainContext, so we need to detect and assign it
            if (!message.domainContext) {
              const domain = detectMessageDomain(message);
              message.domainContext = domain;
              console.log(`🎯 [LOAD] Assigned domain context on load: ${domain.domain}, features: [${domain.featureContext?.join(', ') || 'none'}] for message ${message.id}`);
            }
            
            if (!message.priorityContext) {
              const { priority, reason } = determinePriorityFromContext(
                message,
                sortedMessages,
                false // No current instruction on load
              );
              
              const priorityContext: MessagePriorityContext = {
                priority,
                priorityReason: reason,
                assignedAt: Date.now(),
                isCurrentInstruction: false,
                supportingContext: {
                  relatedMessages: [],
                  fileReferences: extractFileReferences(message.content),
                  topicContinuity: detectTopicContinuity(message, sortedMessages)
                },
                conversationFlow: {
                  isResponseTo: null,
                  startsNewTopic: true,
                  closesLoop: false
                }
              };
              
              // Assign to both message and priorityAssignments
              message.priorityContext = priorityContext;
              state.priorityAssignments[message.id] = priorityContext;
            }
          });

          // Update priority ordering
          state.priorityOrdering = sortedMessages
            .sort((a, b) => {
              const aPriority = a.priorityContext?.priority || MessagePriority.LOW;
              const bPriority = b.priorityContext?.priority || MessagePriority.LOW;
              const priorityOrder = [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.MEDIUM, MessagePriority.LOW, MessagePriority.CONTEXT];
              return priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority);
            })
            .map(m => m.id);
        });
        
        console.log(`🔥 [ChatState] COORDINATOR-COMPATIBLE LOAD COMPLETE - Assigned priorities to ${cleanedMessages.length} loaded messages`);
      }
    } catch (error) {
      log('FILES', '❌ Error loading project messages:', error);
    }
  },

  clearProjectMessages: async (projectId: string): Promise<boolean> => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister or identity not available');
      }

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const result = await userCanisterService.clearProjectMessages(projectId, userCanisterId, identity);
      
      if (result.success) {
        // Clear priority assignments for project
        set((state: any) => {
          if (state.projectMessages[projectId]) {
            state.projectMessages[projectId].forEach((message: ChatInterfaceMessage) => {
              delete state.priorityAssignments[message.id];
            });
          }
          
          // Clear conversation groups for this project
          const groupsToDelete: string[] = [];
          for (const [groupId, messageIds] of Object.entries(state.conversationGroups)) {
            if (state.projectMessages[projectId] && 
                (messageIds as string[]).some(id => 
                  state.projectMessages[projectId].some((m: ChatInterfaceMessage) => m.id === id)
                )) {
              groupsToDelete.push(groupId);
            }
          }
          
          groupsToDelete.forEach(groupId => {
            delete state.conversationGroups[groupId];
          });
          
          // 🔥 CRITICAL FIX: Clear the actual message arrays immediately
          // Add a fresh welcome message after clearing
          const project = state.projects?.find((p: any) => p.id === projectId);
          const projectName = project?.name || project?.title || 'your project';
          
          const welcomeMessage: ChatInterfaceMessage = {
            id: `welcome-cleared-${Date.now()}`,
            type: 'system',
            content: `Chat history has been cleared for **${projectName}**.\n\nI'm your AI assistant. What would you like to work on?`,
            timestamp: new Date(),
            isGenerating: false
          };
          
          state.projectMessages[projectId] = [welcomeMessage];
          
          if (state.activeProject === projectId) {
            state.currentInstructionId = null;
            state.priorityOrdering = [];
            // Update currentMessages immediately to show welcome message
            state.currentMessages = [welcomeMessage];
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

  setNoProjectState: () => {
    set((state: any) => {
      state.activeProject = null;
      state.currentMessages = [...NO_PROJECT_MESSAGES];
      
      state.currentSessionId = null;
      state.currentSessionMessages = [];
      
      state.generatedFiles = {};
      state.fileGenerationStates = {};
      state.liveGeneratedFiles = [];
      state.tabGroups = [];
      
      state.ui.sidePane.isOpen = false;
      state.ui.sidePane.activeFile = null;
      
      // Clear priority system state
      state.priorityAssignments = {};
      state.currentInstructionId = null;
      state.conversationGroups = {};
      state.priorityOrdering = [];
    });
  },

  startNewSession: (projectId: string) => {
    set((state: any) => {
      const sessionId = generateSessionId();
      state.currentSessionId = sessionId;
      state.currentSessionMessages = [];
      
      console.log(`🚀 Started new session: ${sessionId} for project: ${projectId}`);
    });
  },

  endCurrentSession: () => {
    set((state: any) => {
      console.log(`🏁 Ended session: ${state.currentSessionId}`);
      state.currentSessionId = null;
      state.currentSessionMessages = [];
    });
  },

  // 🔥 ENHANCED: getCurrentSessionMessages with priority awareness
  getCurrentSessionMessages: (): ChatInterfaceMessage[] => {
    const state = get() as any;
    const sessionMessages = state.currentSessionMessages || [];
    
    const cleanedSessionMessages = sessionMessages.map((msg: ChatInterfaceMessage) => {
      const hasContamination = msg.content.includes('=== AI ASSISTANT RULES ===');
      if (hasContamination && msg.type === 'user') {
        console.warn(`⚠️ Session message contaminated, cleaning: ${msg.id}`);
        return {
          ...msg,
          content: state.cleanMessageContent(msg.content)
        };
      }
      return msg;
    });
    
    // 🔥 FIX #5: Return priority-ordered session messages, then by timestamp within same priority
    // Backend timestamps are authoritative - backend generates them using Time.now(), ignoring frontend
    // Updates change timestamps, so we must sort by timestamp, not array position
    return cleanedSessionMessages.sort((a, b) => {
      const aPriority = a.priorityContext?.priority || MessagePriority.LOW;
      const bPriority = b.priorityContext?.priority || MessagePriority.LOW;
      
      const priorityOrder = [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.MEDIUM, MessagePriority.LOW, MessagePriority.CONTEXT];
      const priorityComparison = priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority);
      
      if (priorityComparison !== 0) {
        return priorityComparison;
      }
      
      // Within same priority, sort by timestamp (oldest first)
      // Backend timestamps are authoritative when available
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  },

  setStreamingState: (content: string, messageId: string) => {
    set((state: any) => {
      state.streamingState.isStreaming = true;
      state.streamingState.streamingContent = content;
      state.streamingState.streamingMessageId = messageId;
      state.streamingState.accumulatedLength = content.length;
    });
  },

  clearStreamingState: () => {
    set((state: any) => {
      state.streamingState.isStreaming = false;
      state.streamingState.streamingContent = '';
      state.streamingState.streamingMessageId = null;
      state.streamingState.accumulatedLength = 0;
    });
  },

  updateStreamingContent: (content: string) => {
    set((state: any) => {
      state.streamingState.streamingContent = content;
      state.streamingState.accumulatedLength = content.length;
    });
  },

  saveMessageToCanister: async (projectId: string, message: ChatInterfaceMessage) => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister or identity not available');
      }

      const cleanMessage = {
        ...message,
        content: message.type === 'user' ? (get() as any).cleanMessageContent(message.content) : message.content
      };

      console.log('💾 SAVE MESSAGE CHECK:', {
        id: cleanMessage.id,
        type: cleanMessage.type,
        hasAIContext: cleanMessage.content.includes('=== AI ASSISTANT RULES ==='),
        contentPreview: cleanMessage.content.substring(0, 100),
        priority: cleanMessage.priorityContext?.priority || 'unassigned'
      });

      const { userCanisterService } = await import('../../services/UserCanisterService');
      await userCanisterService.saveMessageToProject(projectId, cleanMessage, userCanisterId, identity);
      
      console.log(`💾 Saved clean message to canister: ${cleanMessage.id}`);
    } catch (error) {
      console.error('❌ Error saving message to canister:', error);
      throw error;
    }
  },

  updateMessageInCanister: async (projectId: string, messageId: string, content: string, isGenerating?: boolean) => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        throw new Error('User canister or identity not available');
      }

      const cleanContent = (get() as any).cleanMessageContent(content);

      console.log('💾 UPDATE MESSAGE CHECK:', {
        id: messageId,
        hasAIContext: cleanContent.includes('=== AI ASSISTANT RULES ==='),
        contentPreview: cleanContent.substring(0, 100),
        isGenerating: !!isGenerating
      });

      const { userCanisterService } = await import('../../services/UserCanisterService');
      await userCanisterService.updateMessageInProject(projectId, messageId, cleanContent, userCanisterId, identity, isGenerating);
      
      console.log(`💾 Updated clean message in canister: ${messageId}`);
    } catch (error) {
      console.error('❌ Error updating message in canister:', error);
      throw error;
    }
  },

  // 🔥 NEW: Pending attachments management
  setPendingAttachments: (files: PendingAttachment[] | null, images: PendingImage[] | null) => {
    set((state: any) => {
      state.pendingFiles = files;
      state.pendingImages = images;
    });
  },

  clearPendingAttachments: () => {
    set((state: any) => {
      state.pendingFiles = null;
      state.pendingImages = null;
    });
  },

  // 🔥 FIX 1: Explicit resolution marking when files are applied
  markConversationResolved: (projectId: string, userMessageId: string, aiResponseId?: string, reason?: string) => {
    set((state: any) => {
      if (!state.projectMessages[projectId]) return;
      
      const messages = state.projectMessages[projectId];
      
      // Find and mark the user message as resolved
      const userMsg = messages.find((m: ChatInterfaceMessage) => m.id === userMessageId);
      if (userMsg) {
        // 🔥 GAP 18 FIX: Mutate existing domainContext object instead of replacing it
        // This ensures all references see the update
        if (userMsg.domainContext) {
          userMsg.domainContext.resolved = true;
          userMsg.domainContext.resolvedAt = Date.now();
        } else {
          // Create new if doesn't exist
          const domain = detectMessageDomain(userMsg);
          userMsg.domainContext = {
            ...domain,
            resolved: true,
            resolvedAt: Date.now()
          };
        }
        
        console.log(`✅ [RESOLUTION] Marked user message ${userMessageId} as resolved: ${reason || 'files applied'}`);
      }
      
      // Find and mark the AI response as resolved too
      if (aiResponseId) {
        const aiMsg = messages.find((m: ChatInterfaceMessage) => m.id === aiResponseId);
        if (aiMsg) {
          // 🔥 GAP 18 FIX: Mutate existing domainContext object
          if (aiMsg.domainContext) {
            aiMsg.domainContext.resolved = true;
            aiMsg.domainContext.resolvedAt = Date.now();
          } else {
            const domain = detectMessageDomain(aiMsg);
            aiMsg.domainContext = {
              ...domain,
              resolved: true,
              resolvedAt: Date.now()
            };
          }
          
          console.log(`✅ [RESOLUTION] Marked AI response ${aiResponseId} as resolved: ${reason || 'files applied'}`);
        }
      }
    });
  }
});