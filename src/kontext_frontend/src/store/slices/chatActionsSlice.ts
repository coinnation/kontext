import { StateCreator } from 'zustand';
import { ChatInterfaceMessage, ChatMessage, ChatContext, MessagePriority, MessagePriorityContext, PriorityMessageAssembly } from '../../types';
import { fileDetectionPhaseManager } from '../../services/FileDetectionPhaseManager';
import { EditStreamParser } from '../../services/EditStreamParser';
import { FileExtractor } from '../../utils/fileExtractor';
import { messageCoordinator } from '../../services/MessageCoordinator';
import { autoRetryCoordinator } from '../../services/AutoRetryCoordinator';
import { projectMetadataService } from '../../services/ProjectMetadataService';
import { classificationDebugService } from '../../services/ClassificationDebugService';
import { 
  calculateTopicRelevance, 
  shouldExcludeMessage,
  detectMessageDomain,
  segmentConversationByTopic // 🔥 FIX 3: Import conversation segmentation
} from '../../utils/messageDomainDetection';

export interface ChatActionsSliceActions {
  sendMessage: () => Promise<void>;
  handleProjectGenerationRequest: (activeProject: string, userMessage: ChatInterfaceMessage, input: string, enhancedContext: any) => Promise<void>;
  handleCodeUpdateRequest: (activeProject: string, userMessage: ChatInterfaceMessage, input: string, currentFiles: { [key: string]: string }, enhancedContext: any) => Promise<void>;
  handleNewFileUpdateRequest: (activeProject: string, userMessage: ChatInterfaceMessage, input: string, enhancedContext: any) => Promise<void>;
  handleRegularChatRequest: (activeProject: string, userMessage: ChatInterfaceMessage, input: string, currentFiles: { [key: string]: string }, enhancedContext: any) => Promise<void>;
  getEnhancedAIContext: () => string;
  buildSmartClassificationContext: (currentMessage: string) => Promise<any>;
  buildComprehensiveContext: () => Promise<ChatContext>;
  buildSelectiveContext: (classificationResult: any) => Promise<ChatContext>;
  cleanMessageContent: (content: string) => string;
  ensureCompletionMessageExists: (projectId: string, finalContent: string, extractedFiles: any, deploymentReady: boolean) => Promise<string>;
  ensureUpdateCompletionExists: (projectId: string, finalContent: string, extractedFiles: any) => Promise<string>;
  createFinalWrapUpMessage: (projectId: string, result: any) => Promise<string>;
  createDeploymentReadyMessage: (projectId: string, files: any, applyResult: any) => Promise<string>;
  handleAutoRetryFailure: (projectId: string, errorMessage: string, phase: string) => Promise<void>;
  // 🔥 NEW: Priority system core functions
  buildPriorityMessageAssembly: (projectId: string, currentUserMessageId: string) => Promise<PriorityMessageAssembly>;
  createPriorityBasedContext: (assembly: PriorityMessageAssembly, fileContext: ChatContext) => Promise<ChatContext>;
  assemblePriorityPrompt: (assembly: PriorityMessageAssembly, basePrompt: string) => string;
  estimateTokenCount: (content: string) => number;
  optimizeAssemblyForTokenBudget: (assembly: PriorityMessageAssembly, maxTokens: number) => PriorityMessageAssembly;
}

export type ChatActionsSlice = ChatActionsSliceActions;

// ✅ NEW: Use singleton instance instead of creating new one
import { claudeService as singletonClaudeService } from '../../claudeService';
let claudeService: any = singletonClaudeService;

const log = (category: string, message: string, ...args: any[]) => {
  console.log(`[${category}] ${message}`, ...args);
};

// 🔥 NEW: Enhanced safe store access utility with better error handling
const safeStoreAccess = (getFunction: () => any, operation: string, fallbackValue: any = null) => {
  try {
    const storeState = getFunction();
    if (!storeState) {
      console.warn(`[SAFE_STORE] Store state is null/undefined during ${operation}, using fallback`);
      return fallbackValue;
    }
    return storeState;
  } catch (error) {
    console.error(`[SAFE_STORE] Store access failed during ${operation}:`, error);
    return fallbackValue;
  }
};

// 🔥 ENHANCED: Priority assignment validation utility
const validatePriorityAssignment = (message: ChatInterfaceMessage, expectedPriority?: MessagePriority): boolean => {
  if (!message.priorityContext) {
    console.warn(`[PRIORITY_VALIDATION] Message ${message.id} missing priority context`);
    return false;
  }
  
  if (expectedPriority && message.priorityContext.priority !== expectedPriority) {
    console.warn(`[PRIORITY_VALIDATION] Message ${message.id} has priority ${message.priorityContext.priority}, expected ${expectedPriority}`);
    return false;
  }
  
  if (message.isCurrentInstruction && message.priorityContext.priority !== MessagePriority.CRITICAL) {
    console.warn(`[PRIORITY_VALIDATION] Current instruction message ${message.id} should be CRITICAL, but is ${message.priorityContext.priority}`);
    return false;
  }
  
  console.log(`[PRIORITY_VALIDATION] ✅ Message ${message.id} has valid priority: ${message.priorityContext.priority}`);
  return true;
};

// 🔥 NEW: Enhanced completion validation utility
const validateCompletionParameters = (projectId: string, finalContent: string, extractedFiles: any) => {
  const errors: string[] = [];
  
  if (!projectId || typeof projectId !== 'string') {
    errors.push('projectId must be a non-empty string');
  }
  
  if (!finalContent || typeof finalContent !== 'string') {
    errors.push('finalContent must be a non-empty string');
  }
  
  if (!extractedFiles || typeof extractedFiles !== 'object') {
    errors.push('extractedFiles must be an object');
  }
  
  return errors;
};

// 🔥 NEW: Enhanced message priority assignment function
const determinePriorityFromContext = (
  message: ChatInterfaceMessage, 
  index: number, 
  totalMessages: number, 
  currentUserMessage?: string
): 'high' | 'medium' | 'low' => {
  
  // 🎯 HIGHEST PRIORITY: Current user message being processed
  if (message.type === 'user' && currentUserMessage && message.content === currentUserMessage) {
    return 'high';
  }
  
  // 🔥 HIGH PRIORITY: Critical system messages
  if (message.type === 'system') {
    // Error messages
    if (message.content.toLowerCase().includes('error') || 
        message.content.toLowerCase().includes('failed') ||
        message.content.toLowerCase().includes('issue')) {
      return 'high';
    }
    
    // Project generation completions
    if (message.isProjectGeneration || 
        message.deploymentReady ||
        message.content.toLowerCase().includes('generation complete') ||
        message.content.toLowerCase().includes('ready to deploy')) {
      return 'high';
    }
    
    // Recent AI responses (last 2)
    if (index >= totalMessages - 2) {
      return 'high';
    }
  }
  
  // 📝 MEDIUM PRIORITY: Regular user messages and standard AI responses
  if (message.type === 'user') {
    // Recent user messages (last 3)
    if (index >= totalMessages - 3) {
      return 'medium';
    }
    return 'low'; // Older user messages
  }
  
  // Standard system responses
  if (message.type === 'system') {
    return 'medium';
  }
  
  // 📋 LOW PRIORITY: Everything else (older messages, debug info)
  return 'low';
};

// 🔥 NEW: Enhanced message type classification
const determineMessageType = (message: ChatInterfaceMessage): string => {
  if (message.isProjectGeneration) {
    return 'project_generation';
  }
  
  if (message.deploymentReady) {
    return 'deployment_ready';
  }
  
  if (message.type === 'system') {
    // Check for specific system message types
    const content = message.content.toLowerCase();
    
    if (content.includes('error') || content.includes('failed')) {
      return 'error_response';
    }
    
    if (content.includes('complete') || content.includes('finished')) {
      return 'completion';
    }
    
    if (message.extractedFiles && Object.keys(message.extractedFiles).length > 0) {
      return 'code_generation';
    }
    
    return 'explanation';
  }
  
  if (message.type === 'user') {
    return 'user_request';
  }
  
  return 'standard';
};

// 🆕 CRITICAL FIX: Enhanced completion tracking with workflow-aware deduplication
class CompletionTracker {
  private static instance: CompletionTracker;
  private recentCompletions: Map<string, number> = new Map();
  private workflowCompletions: Map<string, Set<string>> = new Map(); // workflowId -> Set of completion keys
  private readonly DEDUPE_WINDOW = 2000; // 2 seconds

  static getInstance(): CompletionTracker {
    if (!CompletionTracker.instance) {
      CompletionTracker.instance = new CompletionTracker();
    }
    return CompletionTracker.instance;
  }

  canCreateCompletion(key: string, workflowId?: string): boolean {
    const lastCreated = this.recentCompletions.get(key);
    if (lastCreated) {
      const timeSince = Date.now() - lastCreated;
      if (timeSince < this.DEDUPE_WINDOW) {
        console.log(`[COMPLETION DEDUP] Blocking duplicate completion: ${key} (${timeSince}ms since last)`);
        return false;
      }
    }
    
    // 🆕 WORKFLOW-AWARE DEDUPLICATION: Check if workflow already has this type of completion
    if (workflowId) {
      const workflowCompletions = this.workflowCompletions.get(workflowId) || new Set();
      const completionType = key.split('_')[1]; // Extract type from key like "projectId_update_timestamp"
      const hasCompletionOfType = Array.from(workflowCompletions).some(existingKey => 
        existingKey.split('_')[1] === completionType
      );
      
      if (hasCompletionOfType) {
        console.log(`[COMPLETION DEDUP] Blocking duplicate workflow completion: ${key} for workflow ${workflowId}`);
        return false;
      }
    }
    
    return true;
  }

  markCompletion(key: string, workflowId?: string): void {
    this.recentCompletions.set(key, Date.now());
    
    // 🆕 Track workflow completions
    if (workflowId) {
      if (!this.workflowCompletions.has(workflowId)) {
        this.workflowCompletions.set(workflowId, new Set());
      }
      this.workflowCompletions.get(workflowId)!.add(key);
      
      console.log(`[COMPLETION DEDUP] Marked workflow completion: ${key} for workflow ${workflowId}`);
    }
    
    // Cleanup old entries
    setTimeout(() => {
      const cutoff = Date.now() - this.DEDUPE_WINDOW * 2;
      for (const [k, time] of this.recentCompletions.entries()) {
        if (time < cutoff) {
          this.recentCompletions.delete(k);
        }
      }
      
      // 🆕 Cleanup old workflow completions
      if (workflowId) {
        const workflowKeys = this.workflowCompletions.get(workflowId);
        if (workflowKeys) {
          for (const k of Array.from(workflowKeys)) {
            const keyTime = this.recentCompletions.get(k);
            if (!keyTime || keyTime < cutoff) {
              workflowKeys.delete(k);
            }
          }
          if (workflowKeys.size === 0) {
            this.workflowCompletions.delete(workflowId);
          }
        }
      }
    }, this.DEDUPE_WINDOW * 2);
  }

  // 🆕 Clear workflow completions when workflow ends
  clearWorkflowCompletions(workflowId: string): void {
    this.workflowCompletions.delete(workflowId);
    console.log(`[COMPLETION DEDUP] Cleared completions for workflow: ${workflowId}`);
  }
}

const completionTracker = CompletionTracker.getInstance();

// 🔥 NEW: Passive debug capture utility - never throws errors
const captureDebugData = {
  startRequest: async (projectId: string, projectName: string, userMessage: string): Promise<string | null> => {
    try {
      return classificationDebugService.startDebugCapture(projectId, projectName, userMessage);
    } catch (error) {
      console.warn('[DEBUG CAPTURE] Failed to start debug capture (non-critical):', error);
      return null;
    }
  },

  systemState: async (debugId: string | null, systemState: any): Promise<void> => {
    if (!debugId) return;
    try {
      classificationDebugService.captureSystemState(debugId, systemState);
    } catch (error) {
      console.warn('[DEBUG CAPTURE] Failed to capture system state (non-critical):', error);
    }
  },

  messageContext: async (debugId: string | null, messageContext: any): Promise<void> => {
    if (!debugId) return;
    try {
      classificationDebugService.captureMessageContext(debugId, messageContext);
    } catch (error) {
      console.warn('[DEBUG CAPTURE] Failed to capture message context (non-critical):', error);
    }
  },

  classification: async (debugId: string | null, classificationResult: any, projectMetadata?: any): Promise<void> => {
    if (!debugId) return;
    try {
      classificationDebugService.captureClassification(debugId, classificationResult, projectMetadata);
    } catch (error) {
      console.warn('[DEBUG CAPTURE] Failed to capture classification (non-critical):', error);
    }
  },

  contextBuilding: async (debugId: string | null, context: any, selectedFiles: string[]): Promise<void> => {
    if (!debugId) return;
    try {
      classificationDebugService.captureContextBuilding(debugId, context, selectedFiles);
    } catch (error) {
      console.warn('[DEBUG CAPTURE] Failed to capture context building (non-critical):', error);
    }
  },

  apiCall: async (debugId: string | null, messages: any[], model: string, requestPayload?: any): Promise<void> => {
    if (!debugId) return;
    try {
      classificationDebugService.captureApiCall(debugId, messages, model, requestPayload);
    } catch (error) {
      console.warn('[DEBUG CAPTURE] Failed to capture API call (non-critical):', error);
    }
  },

  response: async (debugId: string | null, response: any, extractedFiles: any, success: boolean, error?: string): Promise<void> => {
    if (!debugId) return;
    try {
      classificationDebugService.captureResponse(debugId, response, extractedFiles, success, error);
    } catch (error) {
      console.warn('[DEBUG CAPTURE] Failed to capture response (non-critical):', error);
    }
  },

  error: async (debugId: string | null, phase: string, error: any): Promise<void> => {
    if (!debugId) return;
    try {
      classificationDebugService.captureError(debugId, phase, error);
    } catch (error) {
      console.warn('[DEBUG CAPTURE] Failed to capture error (non-critical):', error);
    }
  },

  jsonTargetedMode: async (debugId: string | null, jsonTargetedData: any): Promise<void> => {
    if (!debugId) return;
    try {
      classificationDebugService.captureJsonTargetedMode(debugId, jsonTargetedData);
    } catch (error) {
      console.warn('[DEBUG CAPTURE] Failed to capture JSON targeted mode (non-critical):', error);
    }
  }
};

export const createChatActionsSlice: StateCreator<any, [], [], ChatActionsSlice> = (set, get) => {
  // 🔥 NEW: Core priority system functions

  // 🔥 ENHANCED: Build priority-based message assembly with better current instruction detection
  const buildPriorityMessageAssembly = async (
    projectId: string, 
    currentUserMessageId: string
  ): Promise<PriorityMessageAssembly> => {
    console.log(`🔥 [PRIORITY ASSEMBLY] Building assembly for project: ${projectId}, currentUserMessageId: ${currentUserMessageId}`);
    
    const storeState = safeStoreAccess(get, 'buildPriorityMessageAssembly');
    if (!storeState || !storeState.projectMessages || !storeState.projectMessages[projectId]) {
      throw new Error('Project messages not available for priority assembly');
    }
    
    const allMessages = storeState.projectMessages[projectId] as ChatInterfaceMessage[];
    console.log(`🔥 [PRIORITY ASSEMBLY] Processing ${allMessages.length} total messages`);
    
    // 🔥 ENHANCED: Find current instruction with multiple validation methods
    let currentInstruction = allMessages.find(m => m.id === currentUserMessageId);
    
    // Fallback: Look for message marked as current instruction
    if (!currentInstruction) {
      currentInstruction = allMessages.find(m => m.isCurrentInstruction === true);
      console.warn(`🔥 [PRIORITY ASSEMBLY] Current instruction found by isCurrentInstruction flag: ${currentInstruction?.id}`);
    }
    
    // Fallback: Use the last user message
    if (!currentInstruction) {
      const userMessages = allMessages.filter(m => m.type === 'user');
      currentInstruction = userMessages[userMessages.length - 1];
      console.warn(`🔥 [PRIORITY ASSEMBLY] Using last user message as current instruction: ${currentInstruction?.id}`);
    }
    
    if (!currentInstruction) {
      throw new Error('No current user instruction found in messages');
    }
    
    // 🔥 ENHANCED: Validate current instruction has proper priority
    if (!validatePriorityAssignment(currentInstruction, MessagePriority.CRITICAL)) {
      console.warn(`🔥 [PRIORITY ASSEMBLY] Current instruction ${currentInstruction.id} priority validation failed`);
    }
    
    // 🆕 NEW: Filter messages by relevance before categorizing by priority
    const allActiveMessages = allMessages.filter(msg => !shouldExcludeMessage(msg, currentUserMessageId));
    
    // Separate messages by priority
    const criticalMessages: ChatInterfaceMessage[] = [];
    const highPriorityMessages: ChatInterfaceMessage[] = [];
    const mediumPriorityMessages: ChatInterfaceMessage[] = [];
    const lowPriorityMessages: ChatInterfaceMessage[] = [];
    const contextMessages: ChatInterfaceMessage[] = [];
    
    allActiveMessages.forEach(message => {
      const priority = message.priorityContext?.priority || MessagePriority.LOW;
      
      switch (priority) {
        case MessagePriority.CRITICAL:
          criticalMessages.push(message);
          break;
        case MessagePriority.HIGH:
          highPriorityMessages.push(message);
          break;
        case MessagePriority.MEDIUM:
          mediumPriorityMessages.push(message);
          break;
        case MessagePriority.LOW:
          lowPriorityMessages.push(message);
          break;
        case MessagePriority.CONTEXT:
          contextMessages.push(message);
          break;
      }
    });
    
    // 🆕 NEW: Filter high priority messages by topic relevance
    const highPriorityMessagesFiltered = highPriorityMessages
      .filter(msg => {
        // Always include current instruction
        if (msg.id === currentUserMessageId) return true;
        
        // Calculate relevance
        const relevance = calculateTopicRelevance(currentInstruction, msg);
        
        // Include if high relevance OR recent (< 5 minutes)
        const age = Date.now() - msg.timestamp.getTime();
        const isRecent = age < 5 * 60 * 1000;
        
        return relevance > 0.5 || (isRecent && relevance > 0.3);
      })
      .sort((a, b) => {
        // Sort by relevance (highest first)
        const relevanceA = calculateTopicRelevance(currentInstruction, a);
        const relevanceB = calculateTopicRelevance(currentInstruction, b);
        return relevanceB - relevanceA;
      })
      .slice(0, 5); // Limit to top 5 most relevant
    
    // Get AI context
    const aiRulesContext = storeState.getEnhancedAIContext ? storeState.getEnhancedAIContext() : '';
    
    // Estimate tokens
    const estimateTokens = (content: string) => Math.ceil(content.length / 4);
    
    const currentInstructionTokens = estimateTokens(currentInstruction.content);
    const recentMessagesTokens = highPriorityMessagesFiltered.reduce((acc, m) => acc + estimateTokens(m.content), 0);
    const relatedHistoryTokens = [...mediumPriorityMessages, ...lowPriorityMessages].reduce((acc, m) => acc + estimateTokens(m.content), 0);
    const aiRulesTokens = estimateTokens(aiRulesContext);
    
    const assembly: PriorityMessageAssembly = {
      currentInstruction: {
        message: currentInstruction,
        context: currentInstruction.content,
        fileReferences: currentInstruction.priorityContext?.supportingContext?.fileReferences || [],
        estimatedTokens: currentInstructionTokens
      },
      supportingContext: {
        recentMessages: highPriorityMessagesFiltered, // 🆕 Use filtered list
        relatedHistory: [...mediumPriorityMessages, ...lowPriorityMessages],
        totalMessages: highPriorityMessagesFiltered.length + mediumPriorityMessages.length + lowPriorityMessages.length,
        estimatedTokens: recentMessagesTokens + relatedHistoryTokens
      },
      systemContext: {
        aiRules: aiRulesContext,
        documentation: '', // Could be enhanced with actual documentation
        projectContext: `Project: ${projectId}`,
        estimatedTokens: aiRulesTokens
      },
      assemblyMetadata: {
        totalTokens: currentInstructionTokens + recentMessagesTokens + relatedHistoryTokens + aiRulesTokens,
        priorityDistribution: {
          [MessagePriority.CRITICAL]: criticalMessages.length,
          [MessagePriority.HIGH]: highPriorityMessages.length,
          [MessagePriority.MEDIUM]: mediumPriorityMessages.length,
          [MessagePriority.LOW]: lowPriorityMessages.length,
          [MessagePriority.CONTEXT]: contextMessages.length
        },
        optimizationApplied: false,
        truncationApplied: false,
        assemblyTimestamp: Date.now()
      }
    };
    
    console.log(`🔥 [PRIORITY ASSEMBLY] Assembly complete:`, {
      currentInstruction: assembly.currentInstruction.estimatedTokens + ' tokens',
      supportingContext: assembly.supportingContext.estimatedTokens + ' tokens',
      systemContext: assembly.systemContext.estimatedTokens + ' tokens',
      totalTokens: assembly.assemblyMetadata.totalTokens,
      distribution: assembly.assemblyMetadata.priorityDistribution
    });
    
    return assembly;
  };

  // 🔥 NEW: Create priority-based context
  const createPriorityBasedContext = async (
    assembly: PriorityMessageAssembly, 
    fileContext: ChatContext
  ): Promise<ChatContext> => {
    console.log(`🔥 [PRIORITY CONTEXT] Creating priority-based context`);
    
    const priorityMetadata = {
      currentInstructionTokens: assembly.currentInstruction.estimatedTokens,
      supportingContextTokens: assembly.supportingContext.estimatedTokens,
      systemContextTokens: assembly.systemContext.estimatedTokens,
      totalPriorityTokens: assembly.assemblyMetadata.totalTokens,
      priorityStructureApplied: true,
      truncationApplied: assembly.assemblyMetadata.truncationApplied
    };
    
    // Enhance existing context with priority metadata
    const priorityContext: ChatContext = {
      ...fileContext,
      priorityMetadata,
      // Enhanced AI rules context with priority structure
      aiRulesContext: assembly.systemContext.aiRules + 
        `\n\n🔥 PRIORITY CONTEXT STRUCTURE:\n` +
        `• CURRENT REQUEST (${assembly.currentInstruction.estimatedTokens} tokens): User's immediate instruction\n` +
        `• SUPPORTING CONTEXT (${assembly.supportingContext.estimatedTokens} tokens): Recent relevant conversation\n` +
        `• SYSTEM CONTEXT (${assembly.systemContext.estimatedTokens} tokens): AI rules and project info\n` +
        `\nFocus on the CURRENT REQUEST as the primary objective. Use supporting context only as background.`
    };
    
    console.log(`🔥 [PRIORITY CONTEXT] Enhanced context created with priority structure`);
    return priorityContext;
  };

  // 🔥 NEW: Assemble priority-structured prompt
  const assemblePriorityPrompt = (assembly: PriorityMessageAssembly, basePrompt: string): string => {
    console.log(`🔥 [PRIORITY PROMPT] Assembling priority-structured prompt`);
    
    const priorityPrompt = `🎯 CURRENT USER INSTRUCTION (HIGHEST PRIORITY):
${assembly.currentInstruction.message.content}

📋 SUPPORTING CONVERSATION CONTEXT:
${assembly.supportingContext.recentMessages.slice(0, 3).map(m => 
  `${m.type === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}`
).join('\n')}

🔧 SYSTEM CONTEXT:
${assembly.systemContext.aiRules}

⚡ CRITICAL FOCUS INSTRUCTION:
Focus primarily on the CURRENT USER INSTRUCTION above. The supporting context is provided for background understanding only. Your response should directly address the current user's request.

${basePrompt}`;
    
    console.log(`🔥 [PRIORITY PROMPT] Priority-structured prompt assembled (${Math.ceil(priorityPrompt.length / 4)} estimated tokens)`);
    return priorityPrompt;
  };

  // 🔥 NEW: Estimate token count
  const estimateTokenCount = (content: string): number => {
    return Math.ceil(content.length / 4); // Rough estimate: 4 characters per token
  };

  // 🔥 NEW: Optimize assembly for token budget
  const optimizeAssemblyForTokenBudget = (
    assembly: PriorityMessageAssembly, 
    maxTokens: number
  ): PriorityMessageAssembly => {
    console.log(`🔥 [PRIORITY OPTIMIZATION] Optimizing assembly for ${maxTokens} token budget`);
    
    if (assembly.assemblyMetadata.totalTokens <= maxTokens) {
      console.log(`🔥 [PRIORITY OPTIMIZATION] No optimization needed - under budget`);
      return assembly;
    }
    
    const optimizedAssembly = { ...assembly };
    let currentTokens = assembly.assemblyMetadata.totalTokens;
    
    // Reserve tokens for current instruction (never truncate)
    const reservedTokens = assembly.currentInstruction.estimatedTokens + assembly.systemContext.estimatedTokens;
    const availableForSupporting = maxTokens - reservedTokens;
    
    if (assembly.supportingContext.estimatedTokens > availableForSupporting) {
      console.log(`🔥 [PRIORITY OPTIMIZATION] Truncating supporting context`);
      
      // Prioritize recent messages over history
      const recentTokens = assembly.supportingContext.recentMessages.reduce(
        (acc, m) => acc + estimateTokenCount(m.content), 0
      );
      
      if (recentTokens <= availableForSupporting) {
        // Keep all recent messages, truncate history
        optimizedAssembly.supportingContext.relatedHistory = [];
        optimizedAssembly.supportingContext.estimatedTokens = recentTokens;
      } else {
        // Truncate recent messages too, keeping most recent
        const truncatedRecent = assembly.supportingContext.recentMessages.slice(-2);
        optimizedAssembly.supportingContext.recentMessages = truncatedRecent;
        optimizedAssembly.supportingContext.relatedHistory = [];
        optimizedAssembly.supportingContext.estimatedTokens = truncatedRecent.reduce(
          (acc, m) => acc + estimateTokenCount(m.content), 0
        );
      }
      
      optimizedAssembly.assemblyMetadata.truncationApplied = true;
      optimizedAssembly.assemblyMetadata.optimizationApplied = true;
      optimizedAssembly.assemblyMetadata.totalTokens = 
        reservedTokens + optimizedAssembly.supportingContext.estimatedTokens;
    }
    
    console.log(`🔥 [PRIORITY OPTIMIZATION] Optimization complete:`, {
      originalTokens: assembly.assemblyMetadata.totalTokens,
      optimizedTokens: optimizedAssembly.assemblyMetadata.totalTokens,
      truncationApplied: optimizedAssembly.assemblyMetadata.truncationApplied
    });
    
    return optimizedAssembly;
  };

  // 🔥 CRITICAL FIX: Enhanced completion message with proper error handling
  const ensureCompletionMessageExists = async (
    projectId: string, 
    finalContent: string, 
    extractedFiles: any,
    deploymentReady: boolean = false
  ): Promise<string> => {
    try {
      // 🔥 NEW: Validate parameters before proceeding
      const validationErrors = validateCompletionParameters(projectId, finalContent, extractedFiles);
      if (validationErrors.length > 0) {
        console.error('[COMPLETION] Parameter validation failed:', validationErrors);
        return '';
      }

      // 🔥 ADDITIONAL FIX: Check if a message with similar content already exists in the project
      // This prevents duplicate responses even if ensureCompletionMessageExists is called multiple times
      const storeState = safeStoreAccess(get, 'addMessageToProject');
      
      // 🔥 FIX: Clean content before comparison to catch duplicates even with technical jargon differences
      const cleanedContentForComparison = finalContent
        .replace(/coordinator[- ]?enhanced/gi, '')
        .replace(/coordinator[- ]?integration/gi, '')
        .replace(/coordinator[- ]?managed/gi, '')
        .replace(/coordinator[- ]?based/gi, '')
        .replace(/coordinator[- ]?system/gi, '')
        .replace(/with coordinator/gi, '')
        .replace(/coordinator/gi, '')
        .replace(/priority[- ]?assembly/gi, '')
        .replace(/priority[- ]?structured/gi, '')
        .replace(/assembly/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (storeState && storeState.getCurrentSessionMessages) {
        const existingMessages = storeState.getCurrentSessionMessages();
        // Check for messages with very similar content (likely duplicates)
        // Use cleaned content for comparison to catch duplicates even with technical jargon
        const similarMessage = existingMessages.find((m: ChatInterfaceMessage) => {
          if (m.type !== 'system' || m.content.length < 50) return false;
          
          // Clean existing message content for comparison
          const cleanedExisting = m.content
            .replace(/coordinator[- ]?enhanced/gi, '')
            .replace(/coordinator[- ]?integration/gi, '')
            .replace(/coordinator[- ]?managed/gi, '')
            .replace(/coordinator[- ]?based/gi, '')
            .replace(/coordinator[- ]?system/gi, '')
            .replace(/with coordinator/gi, '')
            .replace(/coordinator/gi, '')
            .replace(/priority[- ]?assembly/gi, '')
            .replace(/priority[- ]?structured/gi, '')
            .replace(/assembly/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          return Math.abs(cleanedExisting.length - cleanedContentForComparison.length) < 50 && // Similar length
                 cleanedExisting.substring(0, 100) === cleanedContentForComparison.substring(0, 100); // Same start
        });
        if (similarMessage) {
          console.log('[COMPLETION] Message with similar content already exists, skipping duplicate:', similarMessage.id);
          return '';
        }
      }
      
      // 🔥 FIX: Use cleaned content hash for better deduplication to prevent duplicate responses
      // This prevents the same content from being added multiple times even if called with different timestamps
      const contentHash = cleanedContentForComparison.substring(0, 100).replace(/\s+/g, ' ').trim(); // Use first 100 chars as hash
      const completionKey = `${projectId}_${deploymentReady ? 'generation' : 'chat'}_${contentHash.length}_${Date.now()}`;
      
      if (!completionTracker.canCreateCompletion(completionKey)) {
        console.log('[COMPLETION] Recent completion exists, skipping duplicate response');
        return '';
      }

      console.log('[COMPLETION] Creating completion message...', {
        projectId,
        contentLength: finalContent?.length || 0,
        filesCount: extractedFiles ? Object.keys(extractedFiles).length : 0,
        deploymentReady
      });
      
      const messageId = `completion_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // 🔥 FIX: Clean technical jargon from completion messages while preserving formatting
      let cleanedContent = finalContent
        .replace(/coordinator[- ]?enhanced/gi, '')
        .replace(/coordinator[- ]?integration/gi, '')
        .replace(/coordinator[- ]?managed/gi, '')
        .replace(/coordinator[- ]?based/gi, '')
        .replace(/coordinator[- ]?system/gi, '')
        .replace(/with coordinator/gi, '')
        .replace(/coordinator/gi, '')
        .replace(/priority[- ]?assembly/gi, '')
        .replace(/priority[- ]?structured/gi, '')
        .replace(/assembly/gi, '')
        // Preserve newlines but collapse multiple spaces within lines
        .replace(/[ \t]+/g, ' ')
        // Preserve intentional double newlines (paragraph breaks)
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const message: ChatInterfaceMessage = {
        id: messageId,
        type: 'system',
        content: cleanedContent,
        timestamp: new Date(),
        isGenerating: false,
        extractedFiles: extractedFiles || {},
        deploymentReady,
        isProjectGeneration: deploymentReady
      };

      // 🔥 CRITICAL FIX: Safe store access for adding message (storeState already declared above)
      if (storeState && typeof storeState.addMessageToProject === 'function') {
        storeState.addMessageToProject(projectId, message);
        completionTracker.markCompletion(completionKey);
        console.log('[COMPLETION] Message added to UI');
      } else {
        throw new Error('Store access failed - addMessageToProject not available');
      }

      if (deploymentReady && extractedFiles && Object.keys(extractedFiles).length > 0) {
        try {
          const currentProject = storeState.getProjectById ? storeState.getProjectById(projectId) : null;
          const projectName = currentProject?.name || 'Generated Project';
          
          console.log('[COMPLETION] Creating deployment context...', {
            messageId,
            projectId,
            projectName,
            fileCount: Object.keys(extractedFiles).length
          });
          
          if (typeof storeState.createDeploymentContext === 'function') {
            storeState.createDeploymentContext(messageId, projectId, projectName, extractedFiles);
            console.log('[COMPLETION] Deployment context created successfully');
          }
        } catch (deployError) {
          console.error('[COMPLETION] Failed to create deployment context:', deployError);
        }
      }

      // 🔥 CRITICAL FIX: Safe store access for backend operations
      const { userCanisterId, identity } = safeStoreAccess(get, 'backend_save', { userCanisterId: null, identity: null });
      if (userCanisterId && identity) {
        try {
          const { userCanisterService } = await import('../../services/UserCanisterService');
          await userCanisterService.saveMessageToProject(projectId, message, userCanisterId, identity);
          console.log('[COMPLETION] Message saved to backend');
        } catch (saveError) {
          console.warn('[COMPLETION] Backend save failed, but UI message exists:', saveError);
        }
      }
      
      return messageId;
      
    } catch (error) {
      console.error('[COMPLETION] Failed to ensure completion message:', error);
      return '';
    }
  };

  // 🆕 CRITICAL FIX: Enhanced update completion with COMPREHENSIVE workflow-aware deduplication
  // Track in-flight completions to prevent race conditions
  const inFlightCompletions = new Map<string, Promise<string>>();
  
  const ensureUpdateCompletionExists = async (
    projectId: string, 
    finalContent: string, 
    extractedFiles: any
  ): Promise<string> => {
    try {
      // 🔥 NEW: Validate parameters before proceeding
      const validationErrors = validateCompletionParameters(projectId, finalContent, extractedFiles);
      if (validationErrors.length > 0) {
        console.error('[UPDATE COMPLETION] Parameter validation failed:', validationErrors);
        return '';
      }

      const fileCount = Object.keys(extractedFiles || {}).length;
      
      // 🔥 FIX: Clean content before comparison to catch duplicates even with technical jargon differences
      // Must be declared before use in deduplication logic
      const cleanedContentForComparison = finalContent
        .replace(/coordinator[- ]?enhanced/gi, '')
        .replace(/coordinator[- ]?integration/gi, '')
        .replace(/coordinator[- ]?managed/gi, '')
        .replace(/coordinator[- ]?based/gi, '')
        .replace(/coordinator[- ]?system/gi, '')
        .replace(/with coordinator/gi, '')
        .replace(/coordinator/gi, '')
        .replace(/priority[- ]?assembly/gi, '')
        .replace(/priority[- ]?structured/gi, '')
        .replace(/assembly/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // 🔥 CRITICAL FIX: Create a stable key for deduplication using cleaned content
      const contentHash = cleanedContentForComparison.substring(0, 200).replace(/\s+/g, ' ').trim();
      const fileNamesHash = Object.keys(extractedFiles || {}).sort().join(',');
      const completionKey = `${projectId}_update_${contentHash.length}_${fileCount}_${fileNamesHash.substring(0, 50)}`;
      
      // 🔥 CRITICAL FIX: Check if there's already an in-flight completion for this exact content
      if (inFlightCompletions.has(completionKey)) {
        console.log('[UPDATE COMPLETION] Completion already in-flight for this content, waiting for existing one...');
        return await inFlightCompletions.get(completionKey)!;
      }
      
      console.log('[UPDATE COMPLETION] Creating update completion with enhanced workflow-aware deduplication:', {
        projectId,
        fileCount,
        contentLength: finalContent?.length || 0,
        completionKey: completionKey.substring(0, 100)
      });

      // 🔥 CRITICAL FIX: Check for EXACT duplicate Apply sections (same files, not yet applied)
      // Only skip if there's already a visible Apply button for these EXACT same files
      const storeState = safeStoreAccess(get, 'addMessageToProject');
      
      if (storeState && storeState.getCurrentSessionMessages && fileCount > 0) {
        const existingMessages = storeState.getCurrentSessionMessages();
        
        // Only check for duplicates if we have files to apply
        // Look for messages with EXACT same files that haven't been applied yet
        const exactDuplicate = existingMessages.find((m: ChatInterfaceMessage) => {
          // Must be system message with files
          if (m.type !== 'system' || !m.extractedFiles) return false;
          
          // Must have exact same file count
          const existingFileCount = Object.keys(m.extractedFiles).length;
          if (existingFileCount !== fileCount) return false;
          
          // Must have exact same file names AND content
          const sameFiles = Object.keys(extractedFiles).every(fileName => {
            return m.extractedFiles![fileName] === extractedFiles[fileName];
          });
          
          if (!sameFiles) return false;
          
          // Must NOT be deployment-ready or project generation (those are different message types)
          if (m.isProjectGeneration || (m as any).deploymentReady) return false;
          
          // This is an exact duplicate with same files - check if it's still visible
          console.log('[UPDATE COMPLETION] Found message with exact same files:', {
            messageId: m.id,
            fileCount: existingFileCount,
            isGenerating: m.isGenerating,
            timestamp: m.timestamp
          });
          
          return true; // This is a duplicate
        });
        
        if (exactDuplicate) {
          console.log('🚨 [UPDATE COMPLETION] EXACT DUPLICATE DETECTED - Skipping to prevent duplicate Apply sections:', {
            existingMessageId: exactDuplicate.id,
            fileCount,
            fileNames: Object.keys(extractedFiles).slice(0, 5)
          });
          return exactDuplicate.id; // Return existing message ID instead of empty string
        }
      }
      
      // Create the completion promise and track it
      const completionPromise = (async () => {
        try {
          // 🆕 CRITICAL FIX: Check if this is an auto-retry workflow and get workflow ID
          const autoRetryWorkflow = autoRetryCoordinator.getProjectWorkflow(projectId);
          // 🔧 FIX: Use proper method to check if workflow is actually active, not just if it exists
          // This prevents treating COMPLETED workflows as active after successful deployment
          const isAutoRetryActive = autoRetryCoordinator.isProjectInAutoRetry(projectId);
          const workflowId = autoRetryWorkflow?.workflowId;
          
          console.log('[UPDATE COMPLETION] Auto-retry workflow analysis:', {
            isAutoRetryActive,
            workflowId,
            phase: autoRetryWorkflow?.phase,
            fileCount
          });

          // 🆕 CRITICAL FIX: Enhanced deduplication with workflow awareness
          // Use content hash instead of timestamp to ensure stable deduplication
          const workflowCompletionKey = workflowId 
            ? `${completionKey}_${workflowId}`  // Add workflow ID to the stable key
            : completionKey;
          
          if (!completionTracker.canCreateCompletion(workflowCompletionKey, workflowId)) {
            console.log('[UPDATE COMPLETION] Duplicate completion blocked by enhanced workflow-aware deduplication');
            return '';
          }

          // 🆕 CRITICAL FIX: Check workflow phase to prevent duplicate automation
          if (isAutoRetryActive && autoRetryWorkflow) {
            console.log('[UPDATE COMPLETION] Checking workflow phase before automation:', {
              currentPhase: autoRetryWorkflow.phase,
              fileApplicationTriggered: autoRetryWorkflow.fileApplicationTriggered,
              deploymentTriggered: autoRetryWorkflow.deploymentTriggered
            });

            // If workflow is already in FILE_APPLICATION or DEPLOYMENT phase, don't trigger automation again
            if (['FILE_APPLICATION', 'DEPLOYMENT'].includes(autoRetryWorkflow.phase)) {
              console.log('[UPDATE COMPLETION] Workflow already in progress - creating completion without automation:', {
                phase: autoRetryWorkflow.phase,
                fileApplicationTriggered: autoRetryWorkflow.fileApplicationTriggered,
                deploymentTriggered: autoRetryWorkflow.deploymentTriggered
              });
              
              // Create a simple completion message without triggering automation
              const messageId = `update_completion_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
              const simpleContent = `**AI Fix Update Applied**

✅ **Code Update Complete:**
• ${fileCount} file${fileCount > 1 ? 's' : ''} updated successfully
• Changes have been integrated

*The auto-retry system is currently processing these changes automatically.*`;

              // 🔥 CRITICAL: Ensure extractedFiles is always properly set
              const validExtractedFilesForWorkflow = extractedFiles && typeof extractedFiles === 'object' 
                ? extractedFiles 
                : {};
              
              console.log('🚨 [UPDATE COMPLETION] WORKFLOW IN-PROGRESS - EXTRACTED FILES DEBUG:', {
                hasExtractedFiles: !!extractedFiles,
                isObject: typeof extractedFiles === 'object',
                fileCount: Object.keys(validExtractedFilesForWorkflow).length,
                fileNames: Object.keys(validExtractedFilesForWorkflow)
              });
              
              const message: ChatInterfaceMessage = {
                id: messageId,
                type: 'system',
                content: simpleContent,
                timestamp: new Date(),
                isGenerating: false,
                extractedFiles: validExtractedFilesForWorkflow,
                isProjectGeneration: false,
                deploymentReady: false
              };

              // 🔥 CRITICAL FIX: Safe store access (reuse storeState from earlier check)
              if (!storeState || typeof storeState.addMessageToProject !== 'function') {
                throw new Error('Store access failed for simple completion');
              }
              storeState.addMessageToProject(projectId, message);
              completionTracker.markCompletion(workflowCompletionKey, workflowId);
              
              console.log('[UPDATE COMPLETION] Simple completion message created for in-progress workflow:', {
                messageId,
                extractedFileCount: Object.keys(validExtractedFilesForWorkflow).length
              });
              return messageId;
            }
          }

          const messageId = `update_completion_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          
          // Force shutdown competing state systems
          console.log('[UPDATE COMPLETION] Shutting down competing systems...');
          fileDetectionPhaseManager.forceComplete();
          messageCoordinator.forceCompletePureVisualState();
          
          // Add delay to ensure shutdown
          // 🚀 PERFORMANCE: Removed artificial 100ms delay
          // 🔥 FIX: Convert escaped newlines (\n) to actual newlines and clean technical jargon
          // 🔥 CRITICAL: Clean finalContent to remove empty "Replace with:" messages and incomplete edit patterns
          // finalContent should already be cleaned by EditStreamParser.extractCleanResponse, but ensure it's clean
          let cleanedFinalContent = finalContent || '';
          if (cleanedFinalContent) {
            cleanedFinalContent = EditStreamParser.extractCleanResponse(cleanedFinalContent);
          }
          
          let completionContent = cleanedFinalContent.replace(/\\n/g, '\n');
          
          // 🔥 NEW: Clean technical jargon from AI responses while preserving formatting
          completionContent = completionContent
            .replace(/coordinator[- ]?enhanced/gi, '')
            .replace(/coordinator[- ]?integration/gi, '')
            .replace(/coordinator[- ]?managed/gi, '')
            .replace(/coordinator[- ]?based/gi, '')
            .replace(/coordinator[- ]?system/gi, '')
            .replace(/with coordinator/gi, '')
            .replace(/coordinator/gi, '')
            .replace(/priority[- ]?assembly/gi, '')
            .replace(/priority[- ]?structured/gi, '')
            .replace(/assembly/gi, '')
            // Preserve newlines but collapse multiple spaces within lines
            .replace(/[ \t]+/g, ' ')
            // Preserve intentional double newlines (paragraph breaks)
            .replace(/\n{3,}/g, '\n\n')
            .trim();

          if (isAutoRetryActive && fileCount > 0) {
            console.log('[UPDATE COMPLETION] Creating auto-retry completion with automation');
            
            completionContent = `**🤖 Auto-Fix Complete - Full Automation Active**

✅ **AI Analysis and Fixes Applied:**
• Analyzed the deployment error automatically
• Generated fixes for ${fileCount} file${fileCount > 1 ? 's' : ''}
• Code has been updated and optimized

🚀 **Complete Automation Pipeline Starting:**
The system will now automatically:
1. ✅ Apply all updated files to your project
2. 🚀 Switch to deployment interface  
3. ⚡ Execute deployment with fixes
4. 📊 Monitor progress and handle any issues

*Your deployment will continue automatically - sit back and relax! 🎉*`;
          } else if (fileCount > 0) {
            // 🔥 NEW: Create appropriate completion message based on context
            // Only use "Update Application Complete" if files were actually applied
            // Otherwise, use a simpler message that reflects what happened
            const hasDeploymentReady = completionContent.toLowerCase().includes('ready to deploy') || 
                                      completionContent.toLowerCase().includes('deployment');
            
            // 🔥 CRITICAL: Clean the finalContent to remove empty "Replace with:" messages
            // finalContent should already be cleaned by EditStreamParser.extractCleanResponse, but double-check
            let cleanedFinalContent = finalContent || '';
            if (cleanedFinalContent && cleanedFinalContent.trim().length > 0) {
              // Additional validation: ensure the cleaned content makes sense
              // If it's too short or starts with edit markers, it's likely incomplete
              if (cleanedFinalContent.trim().length < 20 || /^(Replace|Find|In:)/i.test(cleanedFinalContent.trim())) {
                // Content is too short or starts with edit markers - use default message
                cleanedFinalContent = `✅ **Code Update Complete**

${fileCount} file${fileCount > 1 ? 's' : ''} updated successfully.`;
              }
            } else {
              // No content or empty - use default message
              cleanedFinalContent = `✅ **Code Update Complete**

${fileCount} file${fileCount > 1 ? 's' : ''} updated successfully.`;
            }
            
            if (!hasDeploymentReady && !completionContent.toLowerCase().includes('update application')) {
              // Use the cleaned AI's response if it makes sense
              completionContent = cleanedFinalContent;
              console.log('[UPDATE COMPLETION] Using cleaned AI response as completion message:', {
                originalLength: finalContent?.length || 0,
                cleanedLength: cleanedFinalContent.length,
                preview: cleanedFinalContent.substring(0, 100)
              });
            } else {
              // AI response already has deployment language, use it
              console.log('[UPDATE COMPLETION] AI response contains deployment language, using as-is');
            }
          }

          // 🔥 CRITICAL: Ensure extractedFiles is always properly set
          const validExtractedFiles = extractedFiles && typeof extractedFiles === 'object' 
            ? extractedFiles 
            : {};
          
          // 🚨 CRITICAL DEBUG: Log file extraction state
          console.log('🚨 [UPDATE COMPLETION] EXTRACTED FILES DEBUG:', {
            hasExtractedFiles: !!extractedFiles,
            isObject: typeof extractedFiles === 'object',
            fileCount: Object.keys(validExtractedFiles).length,
            fileNames: Object.keys(validExtractedFiles),
            willShowApplyButton: Object.keys(validExtractedFiles).length > 0
          });
          
          const message: ChatInterfaceMessage = {
            id: messageId,
            type: 'system',
            content: completionContent,
            timestamp: new Date(),
            isGenerating: false,
            extractedFiles: validExtractedFiles,
            isProjectGeneration: false,
            deploymentReady: false
          };

          // 🔥 CRITICAL FIX: Safe store access for adding message (reuse storeState from earlier)
          if (!storeState || typeof storeState.addMessageToProject !== 'function') {
            throw new Error('Store access failed - addMessageToProject not available');
          }
          
          storeState.addMessageToProject(projectId, message);
          completionTracker.markCompletion(workflowCompletionKey, workflowId);
          
          console.log('[UPDATE COMPLETION] Completion message created:', {
            messageId,
            extractedFileCount: Object.keys(validExtractedFiles).length,
            isAutoRetryActive,
            fileCount,
            workflowPhase: autoRetryWorkflow?.phase
          });
          
          // 🔥 NEW: Mark conversation as resolved immediately after AI generates
          // Don't wait for user to apply files - generation completes the request
          if (Object.keys(validExtractedFiles).length > 0 && storeState.markConversationResolved) {
            // Find the user message that requested this update
            const allMessages = storeState.projectMessages?.[projectId] || [];
            const recentUserMessages = allMessages
              .filter((m: any) => m.type === 'user' && !m.domainContext?.resolved)
              .slice(-1);
            
            if (recentUserMessages.length > 0) {
              const userMessageId = recentUserMessages[0].id;
              console.log(`🎯 [AUTO-RESOLVE] Marking conversation resolved after AI generation: user=${userMessageId}, ai=${messageId}`);
              storeState.markConversationResolved(
                projectId,
                userMessageId,
                messageId,
                `AI generated ${Object.keys(validExtractedFiles).length} file(s) - request completed`
              );
            }
          }

          // Save to backend with safe store access
          const { userCanisterId, identity } = safeStoreAccess(get, 'backend_save', { userCanisterId: null, identity: null });
          if (userCanisterId && identity) {
            try {
              const { userCanisterService } = await import('../../services/UserCanisterService');
              await userCanisterService.saveMessageToProject(projectId, message, userCanisterId, identity);
              console.log('[UPDATE COMPLETION] Message saved to backend');
            } catch (saveError) {
              console.warn('[UPDATE COMPLETION] Backend save failed, but UI message exists:', saveError);
            }
          }

          // 🆕 CRITICAL FIX: Only trigger automation for eligible workflows that are actually active
          // 🚨 NEW FIX: Don't auto-trigger if this is a user-initiated update (not from a failed deployment)
          if (isAutoRetryActive && fileCount > 0 && extractedFiles && autoRetryWorkflow) {
            // Double-check the workflow phase hasn't changed during message creation
            const currentWorkflow = autoRetryCoordinator.getProjectWorkflow(projectId);
            
            // 🆕 CRITICAL FIX: Check if workflow is stale (completed/failed or too old)
            // If workflow is completed/failed, it's from a previous error, not the current user request
            // Also check if workflow was started from a deployment error (should have errorType)
            const isStaleWorkflow = currentWorkflow && (
              ['COMPLETED', 'FAILED'].includes(currentWorkflow.phase) ||
              (Date.now() - currentWorkflow.lastActivity) > 5 * 60 * 1000 // 5 minutes old
            );
            
            // 🆕 NEW: Check if this workflow is actually from a deployment error
            // If workflow doesn't have errorType, it might be from a previous session
            const isFromDeploymentError = currentWorkflow && currentWorkflow.errorType;
            
            if (isStaleWorkflow || !isFromDeploymentError) {
              console.log('[AUTO-RETRY AUTOMATION] ⚠️ Skipping automation - workflow is not eligible for auto-retry:', {
                phase: currentWorkflow?.phase,
                age: currentWorkflow ? Date.now() - currentWorkflow.lastActivity : 'unknown',
                isStale: isStaleWorkflow,
                isFromDeploymentError: isFromDeploymentError,
                errorType: currentWorkflow?.errorType,
                message: isStaleWorkflow 
                  ? 'Workflow is stale (completed/failed or too old) - this is a user-initiated update'
                  : 'Workflow not from deployment error - this is a user-initiated update, not a failed deployment retry'
              });
              // Don't auto-trigger for stale workflows or non-deployment-error workflows - let user manually apply
              return messageId;
            }
            
            // 🔧 ENHANCED: More detailed logging to diagnose stuck workflows
            console.log('[AUTO-RETRY AUTOMATION] Checking automation eligibility:', {
              hasWorkflow: !!currentWorkflow,
              workflowPhase: currentWorkflow?.phase,
              automationActive: currentWorkflow?.automationPipelineActive,
              fileApplicationTriggered: currentWorkflow?.fileApplicationTriggered,
              fileCount,
              hasExtractedFiles: !!extractedFiles && Object.keys(extractedFiles).length > 0,
              executionCount: currentWorkflow?.executionCount,
              maxExecutions: currentWorkflow?.maxExecutions,
              isStale: isStaleWorkflow
            });
            
            // 🔧 CRITICAL FIX: Reset workflow phase if stuck in unexpected state when new files arrive
            // This handles cases where workflow might be stuck from a previous attempt
            if (currentWorkflow && 
                currentWorkflow.automationPipelineActive && 
                fileCount > 0 &&
                ['FILE_APPLICATION', 'DEPLOYMENT'].includes(currentWorkflow.phase) &&
                !currentWorkflow.fileApplicationTriggered) {
              console.log('[AUTO-RETRY AUTOMATION] 🔄 Resetting workflow phase - new AI fix received but workflow stuck in:', currentWorkflow.phase);
              // Reset to AI_PROCESSING to allow file application to proceed
              currentWorkflow.phase = 'AI_PROCESSING';
              currentWorkflow.phaseStartTime = Date.now();
              currentWorkflow.lastActivity = Date.now();
            }
            
            // 🔧 CRITICAL FIX: Don't auto-apply if workflow is completed/failed or automation is disabled
            // This prevents auto-application when user manually requests fixes after a successful deployment
            // ENHANCED: Allow FILE_APPLICATION phase if fileApplicationTriggered is false (retry scenario)
            const isEligiblePhase = currentWorkflow && (
              !['COMPLETED', 'FAILED'].includes(currentWorkflow.phase) &&
              (currentWorkflow.phase === 'AI_PROCESSING' || 
               currentWorkflow.phase === 'MESSAGE_INJECTION' ||
               (currentWorkflow.phase === 'FILE_APPLICATION' && !currentWorkflow.fileApplicationTriggered))
            );
            
            if (isEligiblePhase && currentWorkflow.automationPipelineActive === true) {
              console.log('[AUTO-RETRY AUTOMATION] 🚀 Auto-triggering file application...', {
                phase: currentWorkflow.phase,
                executionCount: currentWorkflow.executionCount
              });
              
              try {
                // Small delay to ensure UI is updated
                // 🚀 PERFORMANCE: Removed artificial 500ms delay
                
                // Auto-trigger file application with auto-retry context
                const startFileApplication = storeState.startFileApplication;
                if (startFileApplication && typeof startFileApplication === 'function') {
                  console.log('[AUTO-RETRY AUTOMATION] Starting automated file application...', {
                    workflowId: autoRetryWorkflow.workflowId,
                    fileCount: Object.keys(extractedFiles).length
                  });
                  
                  // Pass autoRetryWorkflowId to enable further automation
                  await startFileApplication(extractedFiles, { 
                    autoRetryWorkflowId: autoRetryWorkflow.workflowId 
                  });
                  
                  console.log('[AUTO-RETRY AUTOMATION] ✅ Automated file application initiated successfully');
                } else {
                  console.error('[AUTO-RETRY AUTOMATION] ❌ startFileApplication not available', {
                    hasStartFileApplication: !!startFileApplication,
                    type: typeof startFileApplication
                  });
                  
                  // Mark workflow as failed but don't cleanup yet
                  if (autoRetryWorkflow) {
                    console.log('[AUTO-RETRY AUTOMATION] Marking workflow as failed due to missing file application function');
                    autoRetryCoordinator.markWorkflowComplete(autoRetryWorkflow.workflowId, false, 'file_application_function_missing');
                  }
                }
              } catch (automationError) {
                console.error('[AUTO-RETRY AUTOMATION] ❌ Automated file application failed:', automationError);
                
                // On automation failure, mark workflow as failed
                if (autoRetryWorkflow) {
                  autoRetryCoordinator.markWorkflowComplete(autoRetryWorkflow.workflowId, false, 'file_application_failed');
                }
              }
            } else {
              console.log('[AUTO-RETRY AUTOMATION] Skipping automation - workflow not eligible:', {
                currentPhase: currentWorkflow?.phase,
                fileApplicationTriggered: currentWorkflow?.fileApplicationTriggered,
                automationActive: currentWorkflow?.automationPipelineActive,
                isEligiblePhase,
                reason: !isEligiblePhase ? 'phase_not_eligible' : !currentWorkflow?.automationPipelineActive ? 'automation_disabled' : 'unknown'
              });
            }
          } else {
            console.log('[AUTO-RETRY AUTOMATION] Skipping automation - preconditions not met:', {
              isAutoRetryActive,
              fileCount,
              hasExtractedFiles: !!extractedFiles && Object.keys(extractedFiles || {}).length > 0,
              hasWorkflow: !!autoRetryWorkflow
            });
          }
          
          return messageId;
        } catch (error) {
          console.error('[UPDATE COMPLETION] Failed to create update completion message:', error);
          
          // Force cleanup on error
          fileDetectionPhaseManager.forceComplete();
          messageCoordinator.forceCompletePureVisualState();
          return '';
        }
      })();
    
      // Track this completion
      inFlightCompletions.set(completionKey, completionPromise);
      
      try {
        const result = await completionPromise;
        return result;
      } catch (error) {
        // Remove from tracking on error
        inFlightCompletions.delete(completionKey);
        console.error('[UPDATE COMPLETION] Completion promise failed:', error);
        return '';
      }
    } catch (error) {
      // Remove from tracking on error (completionKey may not be in scope if error occurred early)
      console.error('[UPDATE COMPLETION] Outer error handler:', error);
      return '';
    }
  };

  const handleAutoRetryFailure = async (projectId: string, errorMessage: string, phase: string) => {
    try {
      console.log('[AUTO-RETRY FAILURE] Handling automation failure...', { 
        projectId,
        phase, 
        errorMessage: errorMessage.substring(0, 200)
      });

      // Cleanup workflow via coordinator and clear completion tracking
      const workflow = autoRetryCoordinator.getProjectWorkflow(projectId);
      if (workflow) {
        completionTracker.clearWorkflowCompletions(workflow.workflowId);
        autoRetryCoordinator.forceCleanupWorkflow(projectId);
      }

      const failureMessageId = `auto_retry_failure_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      const failureContent = `**Automated Retry Process Failed**

❌ **What Happened:**
The automated retry process encountered an issue during the **${phase}** phase and could not complete successfully.

**Error Details:**
\`\`\`
${errorMessage}
\`\`\`

🔧 **Next Steps Available:**

**Option 1: Manual Review**
• Check the generated files above in this conversation
• Use the "Apply All Files" button to manually apply the generated fixes
• Go to the Deploy tab and attempt deployment manually

**Option 2: Request Further Help**
• Ask me to analyze the specific error in more detail
• Request alternative approaches to fix the issue
• Get guidance on manual troubleshooting steps

**Option 3: Try Different Approach**
• Ask me to generate a completely different solution
• Request a step-by-step manual fix guide
• Explore alternative implementation strategies

*The AI-generated fixes are still available above and can be applied manually if the automated process failed.*`;

      const failureMessage: ChatInterfaceMessage = {
        id: failureMessageId,
        type: 'system',
        content: failureContent,
        timestamp: new Date(),
        isGenerating: false,
        extractedFiles: {},
        deploymentReady: false,
        isProjectGeneration: false
      };

      // 🔥 CRITICAL FIX: Safe store access
      const storeState = safeStoreAccess(get, 'addMessageToProject');
      if (storeState && typeof storeState.addMessageToProject === 'function') {
        storeState.addMessageToProject(projectId, failureMessage);
        console.log('[AUTO-RETRY FAILURE] Failure message created:', failureMessageId);
      }

      // Save to backend
      const { userCanisterId, identity } = safeStoreAccess(get, 'backend_save', { userCanisterId: null, identity: null });
      if (userCanisterId && identity) {
        try {
          const { userCanisterService } = await import('../../services/UserCanisterService');
          await userCanisterService.saveMessageToProject(projectId, failureMessage, userCanisterId, identity);
          console.log('[AUTO-RETRY FAILURE] Failure message saved to backend');
        } catch (saveError) {
          console.warn('[AUTO-RETRY FAILURE] Backend save failed for failure message:', saveError);
        }
      }

      console.log('[AUTO-RETRY FAILURE] Auto-retry failure handling completed');

    } catch (error) {
      console.error('[AUTO-RETRY FAILURE] Failed to create failure message:', error);
    }
  };

  const createDeploymentReadyMessage = async (
    projectId: string,
    files: { [fileName: string]: string },
    applyResult: any
  ): Promise<string> => {
    try {
      const completionKey = `${projectId}_deployment_${Date.now()}`;
      
      if (!completionTracker.canCreateCompletion(completionKey)) {
        console.log('[DEPLOYMENT READY] Recent completion exists, skipping');
        return '';
      }

      console.log('[DEPLOYMENT READY] Creating deployment-ready message...', {
        projectId,
        filesCount: Object.keys(files).length,
        applyResult: {
          filesUploaded: applyResult.filesUploaded,
          filesUpdated: applyResult.filesUpdated,
          success: applyResult.success
        }
      });

      const fileCount = Object.keys(files).length;
      const filesUploaded = applyResult.filesUploaded || 0;
      const filesUpdated = applyResult.filesUpdated || 0;

      // 🔥 FIX: Create deployment message only when files were actually applied
      // Don't show "Update Application Complete" if no files were processed
      let deploymentReadyContent: string;
      
      if (fileCount === 0) {
        // No files were applied, create a different message
        deploymentReadyContent = `**Application Status**

✅ **No file changes were needed.**

Your application is ready for deployment. Click the deploy button below to deploy your current application.`;
      } else {
        // Files were applied, show the full deployment message
        deploymentReadyContent = `**Update Application Complete - Ready to Deploy**

✅ **Files Successfully Applied:**
• ${fileCount} file${fileCount > 1 ? 's' : ''} processed and saved
${filesUploaded > 0 ? `• ${filesUploaded} new file${filesUploaded > 1 ? 's' : ''} created\n` : ''}${filesUpdated > 0 ? `• ${filesUpdated} existing file${filesUpdated > 1 ? 's' : ''} updated\n` : ''}
🚀 **Your updated application is ready for deployment!**

The changes have been applied to your project files and are ready to be deployed to your live application. Click the deploy button below to update your live site with these changes.

**What happens when you deploy:**
• Updated backend code will be compiled and deployed
• Frontend changes will be bundled and deployed
• Your live application will be updated with all changes
• You'll be automatically taken to the Live Preview to see your updates

*Click Deploy to push these updates to your live application!*`;
      }

      const messageId = `deployment_ready_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      const message: ChatInterfaceMessage = {
        id: messageId,
        type: 'system',
        content: deploymentReadyContent,
        timestamp: new Date(),
        isGenerating: false,
        extractedFiles: files,
        deploymentReady: true,
        isProjectGeneration: true
      };

      // 🔥 CRITICAL FIX: Safe store access
      const storeState = safeStoreAccess(get, 'addMessageToProject');
      if (!storeState || typeof storeState.addMessageToProject !== 'function') {
        throw new Error('Store access failed for deployment ready message');
      }
      
      storeState.addMessageToProject(projectId, message);
      completionTracker.markCompletion(completionKey);
      console.log('[DEPLOYMENT READY] Deployment-ready message added to UI');

      try {
        const currentProject = storeState.getProjectById ? storeState.getProjectById(projectId) : null;
        const projectName = currentProject?.name || 'Updated Project';
        
        if (typeof storeState.createDeploymentContext === 'function') {
          storeState.createDeploymentContext(messageId, projectId, projectName, files);
          console.log('[DEPLOYMENT READY] Deployment context created successfully');
        }
      } catch (deployError) {
        console.error('[DEPLOYMENT READY] Failed to create deployment context:', deployError);
      }

      const { userCanisterId, identity } = safeStoreAccess(get, 'backend_save', { userCanisterId: null, identity: null });
      if (userCanisterId && identity) {
        try {
          const { userCanisterService } = await import('../../services/UserCanisterService');
          await userCanisterService.saveMessageToProject(projectId, message, userCanisterId, identity);
          console.log('[DEPLOYMENT READY] Deployment-ready message saved to backend');
        } catch (saveError) {
          console.warn('[DEPLOYMENT READY] Backend save failed, but UI message exists:', saveError);
        }
      }

      return messageId;

    } catch (error) {
      console.error('[DEPLOYMENT READY] Failed to create deployment-ready message:', error);
      return '';
    }
  };

  const createFinalWrapUpMessage = async (
    projectId: string, 
    result: any
  ): Promise<string> => {
    try {
      console.log('[FINAL WRAP-UP] Creating final message with deploy button...', {
        projectId,
        hasResult: !!result,
        success: result?.success,
        filesCount: result?.extractedFiles ? Object.keys(result.extractedFiles).length : 0
      });

      if (!result || !result.success) {
        console.error('[FINAL WRAP-UP] Invalid result object:', result);
        return '';
      }

      const messageId = await ensureCompletionMessageExists(
        projectId,
        result.finalContent || 'Generation completed successfully!',
        result.extractedFiles || {},
        true
      );

      if (messageId) {
        console.log('[FINAL WRAP-UP] Final wrap-up message created successfully:', messageId);
        
        setTimeout(() => {
          // 🔥 CRITICAL FIX: Safe store access for state validation
          const storeState = safeStoreAccess(get, 'validateMessage');
          if (storeState && storeState.activeProject === projectId) {
            const currentMessages = storeState.currentMessages || [];
            const messageExists = currentMessages.find((m: ChatInterfaceMessage) => m.id === messageId);
            
            if (!messageExists) {
              console.warn('[FINAL WRAP-UP] Message not found in currentMessages, forcing update...');
              if (typeof storeState.loadProjectMessages === 'function') {
                storeState.loadProjectMessages(projectId);
              }
            }
          }
        }, 500);
      }

      return messageId;

    } catch (error) {
      console.error('[FINAL WRAP-UP] Failed to create final wrap-up message:', error);
      return '';
    }
  };

  // MessageCoordinator registration logic...
  const registerWithMessageCoordinator = (): boolean => {
    // 🔥 CRITICAL FIX: Safe store access for registration
    const storeState = safeStoreAccess(get, 'registerWithMessageCoordinator');
    if (!storeState) {
      console.error('[ChatActionsSlice] Store state not available for MessageCoordinator registration');
      return false;
    }

    const addMessageToProject = storeState.addMessageToProject;
    const updateMessage = storeState.updateMessage;
    const saveMessageToCanister = storeState.saveMessageToCanister;
    const updateMessageInCanister = storeState.updateMessageInCanister;
    const assignMessagePriority = storeState.assignMessagePriority; // 🔥 NEW: Register priority assignment
    
    let registrationSuccessful = true;
    
    if (addMessageToProject && typeof addMessageToProject === 'function') {
      messageCoordinator.registerMessageCreator(addMessageToProject);
      console.log('[ChatActionsSlice] Message creator registered with MessageCoordinator');
    } else {
      console.error('[ChatActionsSlice] FAILED to register message creator - addMessageToProject not available');
      registrationSuccessful = false;
    }
    
    if (updateMessage && typeof updateMessage === 'function') {
      messageCoordinator.registerMessageUpdater(updateMessage);
      console.log('[ChatActionsSlice] Message updater registered with MessageCoordinator');
    } else {
      console.error('[ChatActionsSlice] FAILED to register message updater - updateMessage not available');
      registrationSuccessful = false;
    }

    if (saveMessageToCanister && updateMessageInCanister && 
        typeof saveMessageToCanister === 'function' && typeof updateMessageInCanister === 'function') {
      messageCoordinator.registerMessagePersistence(saveMessageToCanister, updateMessageInCanister);
      console.log('[ChatActionsSlice] Persistence functions registered with MessageCoordinator');
    } else {
      console.error('[ChatActionsSlice] FAILED to register persistence functions', {
        hasSaveFunction: typeof saveMessageToCanister === 'function',
        hasUpdateFunction: typeof updateMessageInCanister === 'function'
      });
      registrationSuccessful = false;
    }
    
    // 🔥 NEW: Register priority assignment function
    if (assignMessagePriority && typeof assignMessagePriority === 'function') {
      messageCoordinator.registerPriorityAssignment(assignMessagePriority);
      console.log('[ChatActionsSlice] Priority assignment function registered with MessageCoordinator');
    } else {
      console.error('[ChatActionsSlice] FAILED to register priority assignment function');
      registrationSuccessful = false;
    }
    
    const persistenceStatus = messageCoordinator.getPersistenceStatus();
    if (!persistenceStatus.enabled || !persistenceStatus.verified) {
      console.error('[ChatActionsSlice] MessageCoordinator persistence verification FAILED');
      registrationSuccessful = false;
    }
    
    return registrationSuccessful;
  };

  let registrationAttempts = 0;
  const maxRegistrationAttempts = 5;
  
  const attemptRegistration = () => {
    registrationAttempts++;
    const success = registerWithMessageCoordinator();
    
    if (success) {
      console.log('[ChatActionsSlice] MessageCoordinator registration SUCCESSFUL');
      return;
    }
    
    if (registrationAttempts < maxRegistrationAttempts) {
      console.warn(`[ChatActionsSlice] Registration attempt ${registrationAttempts}/${maxRegistrationAttempts} failed, retrying...`);
      setTimeout(attemptRegistration, 1000 * registrationAttempts);
    } else {
      console.error('[ChatActionsSlice] MessageCoordinator registration FAILED after all attempts');
    }
  };

  setTimeout(attemptRegistration, 0);

  return {
    // 🔥 NEW: Priority system core functions
    buildPriorityMessageAssembly,
    createPriorityBasedContext,
    assemblePriorityPrompt,
    estimateTokenCount,
    optimizeAssemblyForTokenBudget,

    // Existing functions
    ensureCompletionMessageExists,
    ensureUpdateCompletionExists,
    createFinalWrapUpMessage,
    createDeploymentReadyMessage,
    handleAutoRetryFailure,

    cleanMessageContent: (content: string): string => {
      return content
        .replace(/\n\n===.*?===\n[\s\S]*?\n=== END.*?===\n\n/g, '')
        .replace(/\[CURRENT REQUEST - PRIORITY\]\s*/g, '')
        .replace(/\[CONTEXT\]\s*/g, '')
        .trim();
    },

    getEnhancedAIContext: (): string => {
      console.log('Building fresh AI context...');
      
      let context = '';
      // 🔥 CRITICAL FIX: Safe store access
      const storeState = safeStoreAccess(get, 'getEnhancedAIContext');
      const placeholderAIRules = [];
      const placeholderDocs = [];
      const placeholderGitHub = [];
      const placeholderMCP = [];
      
      if (placeholderAIRules.length > 0) {
        context += '\n\n=== AI ASSISTANT RULES ===\n';
        context += 'Please follow these specific guidelines when providing assistance:\n\n';
        context += '=== END RULES ===\n\n';
      }
      
      if (placeholderDocs.length > 0) {
        context += '\n\n=== DOCUMENTATION CONTEXT ===\n';
        context += 'Reference these documentation sources when providing assistance:\n\n';
        context += '=== END DOCUMENTATION ===\n\n';
      }
      
      if (placeholderGitHub.length > 0) {
        context += '\n\n=== GITHUB REPOSITORY CONTEXT ===\n';
        context += 'Reference these GitHub repository guidelines when providing assistance:\n\n';
        context += '=== END GITHUB CONTEXT ===\n\n';
      }
      
      if (placeholderMCP.length > 0) {
        context += '\n\n=== MCP CAPABILITIES ===\n';
        context += 'Available MCP servers and their tools:\n\n';
        context += '=== END MCP CAPABILITIES ===\n\n';
      }
      
      const totalSources = placeholderAIRules.length + placeholderDocs.length + placeholderGitHub.length + placeholderMCP.length;
      
      if (totalSources > 0 || context.length > 0) {
        context += '\n\n=== CONTEXT SUMMARY ===\n';
        context += 'Active Elements:\n';
        if (placeholderAIRules.length > 0) context += `- ${placeholderAIRules.length} AI rules enforced\n`;
        if (placeholderDocs.length > 0) context += `- ${placeholderDocs.length} documentation sources available\n`;
        if (placeholderGitHub.length > 0) context += `- ${placeholderGitHub.length} GitHub repository sources available\n`;
        if (placeholderMCP.length > 0) context += `- ${placeholderMCP.length} MCP servers connected\n`;
        context += '\nPlease consider all these sources when providing assistance.\n';
        context += '=== END CONTEXT SUMMARY ===\n\n';
      }
      
      console.log(`Built AI context: ${context.length} characters, ${totalSources} sources`);
      return context;
    },

    // 🔥 ENHANCED: Smart classification context with PROPER message priority assignment
    buildSmartClassificationContext: async (currentMessage: string): Promise<any> => {
      console.log('🧠 [CLASSIFICATION] Building classification context with enhanced message prioritization...');
      
      // 🔥 CRITICAL FIX: Safe store access
      const storeState = safeStoreAccess(get, 'buildSmartClassificationContext');
      if (!storeState) {
        throw new Error('Store state not available for context building');
      }

      const { activeProject, ui, generatedFiles, projectFiles, currentMessages } = storeState;
      
      if (!activeProject) {
        throw new Error('No active project selected');
      }
      
      const currentProject = storeState.getProjectById ? storeState.getProjectById(activeProject) : null;
      
      const allFiles = { ...generatedFiles, ...(projectFiles[activeProject] || {}) };
      const hasExistingFiles = Object.keys(allFiles).length > 0;
      const isEmpty = !hasExistingFiles;
      const fileCount = Object.keys(allFiles).length;
      
      console.log(`🔍 [CLASSIFICATION] Project analysis: ${fileCount} files, empty: ${isEmpty}`);

      // 🔥 NEW: PASSIVE debug capture - start debug session
      const debugId = await captureDebugData.startRequest(
        activeProject,
        currentProject?.name || 'Current Project',
        currentMessage
      );

      // 🔥 NEW: PASSIVE debug capture - capture system state
      await captureDebugData.systemState(debugId, {
        activeProject: activeProject,
        selectedFiles: ui.sidePane?.selectedFiles || [],
        activeFile: ui.sidePane?.activeFile || '',
        sidebarOpen: ui.sidebar?.isOpen || false,
        currentTab: ui.currentTab || 'chat',
        messageCount: currentMessages?.length || 0,
        generationActive: ui.generation?.isActive || false,
        streamingActive: ui.streaming?.isActive || false,
        coordinatorState: messageCoordinator.getCurrentState(),
        // 🔥 NEW: Priority system state
        currentInstructionId: storeState.currentInstructionId,
        totalPriorityAssignments: Object.keys(storeState.priorityAssignments || {}).length,
        activeConversationGroups: Object.keys(storeState.conversationGroups || {}).length,
        priorityOrderingLength: (storeState.priorityOrdering || []).length
      });

      // 🚀 OPTIMIZATION: Lazy metadata generation - only for projects with enough files
      // Skip metadata generation for very small projects (< 5 files) to save time
      const METADATA_THRESHOLD = 5;
      let projectMetadata = null;
      if (hasExistingFiles && fileCount >= METADATA_THRESHOLD) {
        try {
          console.log(`📊 [CLASSIFICATION] Generating project metadata for ${fileCount} files...`);
          const generatedMetadata = await projectMetadataService.getProjectMetadata(activeProject, allFiles);
          projectMetadata = generatedMetadata;
          console.log(`✅ [CLASSIFICATION] Project metadata generated:`, {
            totalFiles: generatedMetadata.totalFiles,
            features: Object.keys(generatedMetadata.featureMap).length,
            relationships: Object.keys(generatedMetadata.relationships).length
          });
        } catch (metadataError) {
          console.warn('⚠️ [CLASSIFICATION] Failed to generate project metadata:', metadataError);
          await captureDebugData.error(debugId, 'metadata_generation', metadataError);
        }
      } else {
        if (fileCount > 0 && fileCount < METADATA_THRESHOLD) {
          console.log(`📋 [CLASSIFICATION] Skipping metadata generation - project has only ${fileCount} files (threshold: ${METADATA_THRESHOLD})`);
        } else {
          console.log('📋 [CLASSIFICATION] Skipping metadata generation - project is empty');
        }
      }

      // 🔥 ORIGINAL LOGIC: Extract request analysis (with passive capture)
      const requestKeywords = projectMetadataService.extractRequestKeywords(currentMessage);
      const mentionedFiles = projectMetadataService.extractMentionedFiles(currentMessage);
      
      console.log(`🔍 [CLASSIFICATION] Request analysis:`, {
        keywords: requestKeywords,
        mentionedFiles: mentionedFiles
      });

      const recentMessages = currentMessages.slice(-2);
      const lastUserMessage = recentMessages.filter(m => m.type === 'user').slice(-2)[0];
      const conversationFlow = recentMessages.map(m => ({
        type: m.type,
        content: m.content.substring(0, 100) + '...',
        isGeneration: !!m.isProjectGeneration
      }));
      
      const selectedFiles = ui.sidePane?.selectedFiles || [];
      const activeFile = ui.sidePane?.activeFile || '';

      // 🆕 ENHANCED: Message context with relevance filtering
      // Get current instruction ID from store
      const currentUserMessageId = storeState.currentInstructionId || 
        recentMessages.find(m => m.isCurrentInstruction)?.id ||
        recentMessages.filter(m => m.type === 'user').slice(-1)[0]?.id;
      
      // Create current instruction message object for relevance calculation
      const currentInstructionMessage: ChatInterfaceMessage = {
        id: currentUserMessageId || 'current_instruction',
        type: 'user',
        content: currentMessage,
        timestamp: new Date()
      };
      
      const messageContext = {
        messages: recentMessages
          .filter(msg => {
            // Always include current instruction
            if (msg.id === currentUserMessageId || msg.isCurrentInstruction) return true;
            
            // Exclude expired/resolved messages
            if (shouldExcludeMessage(msg, currentUserMessageId)) return false;
            
            // Calculate relevance to current question
            const relevance = calculateTopicRelevance(currentInstructionMessage, msg);
            
            // Include if relevance meets threshold
            return relevance > 0.4;
          })
          .map((m, index) => {
            // 🔥 CRITICAL FIX: Read assigned priority from priorityContext if available
            const assignedPriority = m.priorityContext?.priority;
            const fallbackPriority = determinePriorityFromContext(m, index, recentMessages.length, currentMessage);
            
            // Use assigned priority if available, otherwise calculate
            const finalPriority = assignedPriority || fallbackPriority;
            
            // 🆕 NEW: Calculate and include relevance score
            const relevance = calculateTopicRelevance(currentInstructionMessage, m);
            const domain = detectMessageDomain(m);
            
            return {
              role: m.type === 'user' ? 'user' : 'assistant',
              content: m.content,
              timestamp: m.timestamp.toISOString(),
              // 🔥 CRITICAL FIX: Use assigned priority from priority system
              priority: assignedPriority || finalPriority,
              priorityReason: m.priorityContext?.priorityReason || `Calculated priority: ${fallbackPriority}`,
              // 🔥 ENHANCED: Better message type classification
              messageType: determineMessageType(m),
              tokens: Math.ceil(m.content.length / 4),
              // 🔥 NEW: Priority system specific fields
              isCurrentInstruction: m.isCurrentInstruction || false,
              conversationGroup: m.conversationGroup || null,
              tokenWeight: m.priorityContext?.priority === MessagePriority.CRITICAL ? 1.0 :
                          m.priorityContext?.priority === MessagePriority.HIGH ? 0.8 :
                          m.priorityContext?.priority === MessagePriority.MEDIUM ? 0.6 : 0.3,
              // 🆕 NEW: Add relevance and domain info
              topicRelevance: relevance,
              domain: domain.domain,
              domainResolved: domain.resolved || false
            };
          }),
        strategy: 'priority_aware_selection_with_relevance_filtering',
        reasoning: `Selected ${recentMessages.length} messages with topic relevance filtering (min relevance: 0.4)`
      };

      await captureDebugData.messageContext(debugId, messageContext);
      
      let intentAnalysis;
      try {
        // ✅ NEW: Use singleton instance - no need to create new one
        if (!claudeService) {
          const { claudeService: singleton } = await import('../../claudeService');
          claudeService = singleton;
        }

        console.log('[AI CLASSIFICATION] Sending message to AI for intent analysis...');
        
        // 🔥 ENHANCED: Include more context to help backend make better file recommendations
        // Extract explicitly mentioned files/terms from user input to help classification
        const explicitMentions = {
          files: currentMessage.match(/\b[\w\-/]+\.(tsx?|jsx?|ts|js|json|css|mo|md)\b/gi) || [],
          hooks: currentMessage.match(/\buse[A-Z]\w+\b/gi) || [],
          components: currentMessage.match(/\b[A-Z][a-zA-Z]*(?:Component|List|Pane|Interface|Service)\b/gi) || [],
          errorMessages: currentMessage.match(/(?:error|Error|ERROR)[\s\S]{0,200}/gi) || []
        };
        
        // 🔥 ORIGINAL LOGIC: Simple classification (with passive capture)
        // Enhanced context to help backend avoid recommending irrelevant files
        const aiClassification = await claudeService.classifyMessage(currentMessage, {
          hasExistingFiles,
          fileCount,
          isEmpty,
          projectType: currentProject?.projectType?.name,
          recentMessages: conversationFlow,
          requestKeywords,
          mentionedFiles,
          // 🔥 NEW: Include explicit mentions to help backend focus on relevant files
          explicitMentions: {
            files: explicitMentions.files,
            hooks: explicitMentions.hooks,
            components: explicitMentions.components,
            hasErrorMessages: explicitMentions.errorMessages.length > 0
          }
        }, projectMetadata);

        let primaryIntent: 'CREATE_PROJECT' | 'UPDATE_CODE' | 'CONVERSATIONAL';
        switch (aiClassification.classification) {
          case 'CREATE_PROJECT':
            primaryIntent = 'CREATE_PROJECT';
            break;
          case 'UPDATE_MESSAGE':
            // All updates route through full file regeneration
            primaryIntent = 'UPDATE_CODE';
            console.log(`[AI CLASSIFICATION] Routing to UPDATE_CODE (full file regeneration)`);
            break;
          case 'REGULAR_CHAT':
          default:
            primaryIntent = 'CONVERSATIONAL';
            break;
        }

        // 🔥 FIX: Override UPDATE_CODE if it's clearly a question with low confidence
        if (primaryIntent === 'UPDATE_CODE' && 
            currentMessage.trim().endsWith('?') && 
            aiClassification.confidence < 90) {
          primaryIntent = 'CONVERSATIONAL';
          console.log('[CLASSIFICATION OVERRIDE] Question mark detected with <90% confidence, forcing CONVERSATIONAL');
        }

        // 🔥 FIX: Validate classification results - log warnings if recommendations seem off
        const fileRecommendations = aiClassification.contextSelection || null;
        if (fileRecommendations) {
          const inputLower = currentMessage.toLowerCase();
          const mentionedFiles: string[] = [];
          
          // Extract explicitly mentioned files/terms from user input for validation
          const fileMentions = currentMessage.match(/\b[\w\-/]+\.(tsx?|jsx?|ts|js|json|css|mo|md)\b/gi) || [];
          const hookMentions = currentMessage.match(/\buse[A-Z]\w+\b/gi) || [];
          const componentMentions = currentMessage.match(/\b[A-Z][a-zA-Z]*(?:Component|List|Pane|Interface)\b/gi) || [];
          
          mentionedFiles.push(...fileMentions, ...hookMentions, ...componentMentions);
          
          // Log warning if recommendations don't align with user input
          const allRecommendedFiles = [
            ...(fileRecommendations.primaryFiles || []),
            ...(fileRecommendations.supportingFiles || []),
            ...(fileRecommendations.configFiles || [])
          ];
          
          const hasMentionedFiles = mentionedFiles.length > 0;
          const recommendedCount = allRecommendedFiles.length;
          
          // Warn if many files recommended but user didn't mention any files
          if (recommendedCount > 5 && !hasMentionedFiles && primaryIntent === 'UPDATE_CODE') {
            console.warn('[CLASSIFICATION VALIDATION] ⚠️ Many files recommended but user input doesn\'t mention specific files:', {
              recommendedCount,
              mentionedFiles: mentionedFiles.length,
              userInput: currentMessage.substring(0, 100),
              recommendations: allRecommendedFiles.slice(0, 5)
            });
          }
          
          // Warn if classification confidence is low but still routing to UPDATE_CODE
          if (primaryIntent === 'UPDATE_CODE' && aiClassification.confidence < 75) {
            console.warn('[CLASSIFICATION VALIDATION] ⚠️ Low confidence classification routing to UPDATE_CODE:', {
              confidence: aiClassification.confidence,
              reasoning: aiClassification.reasoning,
              userInput: currentMessage.substring(0, 100)
            });
          }
        }

        intentAnalysis = {
          primaryIntent,
          confidence: aiClassification.confidence,
          reasoning: aiClassification.reasoning,
          intentSignals: ['ai_classified'],
          fileRecommendations: fileRecommendations,
          selectionReasoning: aiClassification.selectionReasoning || null
        };

        console.log(`[AI CLASSIFICATION] Result: ${primaryIntent} (${aiClassification.confidence}% confidence)`);
        console.log(`[AI CLASSIFICATION] Raw classification: ${aiClassification.classification}`);
        console.log(`[AI CLASSIFICATION] Reasoning: ${aiClassification.reasoning}`);
        console.log(`[AI CLASSIFICATION] Routing thresholds: CREATE_PROJECT >= 80%, UPDATE_CODE >= 70%`);
        if (aiClassification.contextSelection) {
          console.log(`[AI CLASSIFICATION] File recommendations:`, {
            primary: aiClassification.contextSelection.primaryFiles?.length || 0,
            supporting: aiClassification.contextSelection.supportingFiles?.length || 0,
            config: aiClassification.contextSelection.configFiles?.length || 0,
            total: aiClassification.contextSelection.totalFiles || 0
          });
        }

        // 🔥 NEW: PASSIVE debug capture - capture classification results
        await captureDebugData.classification(debugId, aiClassification, projectMetadata);

      } catch (error) {
        console.error('[AI CLASSIFICATION] Failed, falling back to safe default:', error);
        
        await captureDebugData.error(debugId, 'classification', error);
        
        intentAnalysis = {
          primaryIntent: 'CONVERSATIONAL' as const,
          confidence: 50,
          reasoning: `AI classification failed: ${error instanceof Error ? error.message : 'Unknown error'} - defaulting to conversational`,
          intentSignals: ['classification_error_fallback'],
          fileRecommendations: null,
          selectionReasoning: null
        };
      }
      
      const classificationContext = {
        currentRequest: {
          message: currentMessage,
          intentAnalysis,
          timestamp: Date.now(),
          requestKeywords,
          mentionedFiles
        },
        
        projectState: {
          id: activeProject,
          name: currentProject?.name || 'Current Project',
          type: currentProject?.projectType?.name || 'General',
          isEmpty,
          hasExistingFiles,
          fileCount,
          fileTypes: Object.keys(allFiles).map(f => f.split('.').pop()).filter(Boolean)
        },

        projectMetadata,
        
        conversationFlow: {
          recentMessages: conversationFlow,
          lastUserIntent: lastUserMessage ? 'previous_context' : 'first_message',
          conversationLength: currentMessages.length
        },
        
        selectedContext: selectedFiles.length > 0 ? {
          selectedFiles,
          activeFile,
          hasSelections: true
        } : {
          selectedFiles: [],
          activeFile: '',
          hasSelections: false
        },
        
        aiRulesContext: (get() as any).getEnhancedAIContext(),
        messageContext, // 🔥 NEW: Include enhanced message context with priorities

        // NEW: Include debug ID for tracking
        debugId
      };
      
      console.log(`✅ [CLASSIFICATION] Enhanced classification context built with intelligent message prioritization: ${debugId || 'no-debug'}`);
      return classificationContext;
    },

    buildComprehensiveContext: async (): Promise<ChatContext> => {
      // 🔥 CRITICAL FIX: Safe store access
      const storeState = safeStoreAccess(get, 'buildComprehensiveContext');
      if (!storeState) {
        throw new Error('Store state not available for comprehensive context building');
      }

      const { activeProject, ui, generatedFiles, projectFiles } = storeState;
      
      if (!activeProject) {
        throw new Error('No active project selected');
      }
      
      const currentProject = storeState.getProjectById ? storeState.getProjectById(activeProject) : null;
      
      const selectedFiles = ui.sidePane?.selectedFiles || [];
      const activeFile = ui.sidePane?.activeFile || '';
      const activeFileContent = ui.sidePane?.fileContent || '';
      
      const selectedFileContents: { [fileName: string]: string } = {};
      const allFiles = { ...generatedFiles, ...(projectFiles[activeProject] || {}) };
      
      for (const fileName of selectedFiles) {
        try {
          let content = generatedFiles[fileName];
          if (!content && projectFiles[activeProject]) {
            content = projectFiles[activeProject][fileName];
          }
          
          if (content) {
            selectedFileContents[fileName] = content;
          } else {
            selectedFileContents[fileName] = `// Content not available for ${fileName}`;
          }
        } catch (error) {
          console.error(`Error loading content for ${fileName}:`, error);
          selectedFileContents[fileName] = `// Error loading content for ${fileName}`;
        }
      }
      
      if (activeFile && activeFileContent && !selectedFileContents[activeFile]) {
        selectedFileContents[activeFile] = activeFileContent;
      }
      
      const allFileContents: { [fileName: string]: string } = { ...allFiles };
      
      const projectStructure = Object.keys(allFiles).map(fileName => ({
        name: fileName,
        type: fileName.includes('.mo') ? 'backend' : fileName.includes('.tsx') ? 'component' : fileName.includes('.css') ? 'style' : 'config'
      }));
      
      const enhancedAIContext = (get() as any).getEnhancedAIContext();
      
      // Load context from ContextInterface (localStorage)
      let documentationContext: string | undefined;
      let githubContext: string | undefined;
      let stylingContext: ChatContext['stylingContext'];
      let codeTemplatesContext: string | undefined;
      let apiEndpointsContext: string | undefined;
      
      try {
        // Load Documentation
        const savedDocs = localStorage.getItem('kontext_documentation_items');
        if (savedDocs) {
          const docs = JSON.parse(savedDocs);
          if (docs.length > 0) {
            documentationContext = docs.map((doc: any) => {
              if (doc.type === 'link') {
                return `📖 ${doc.title}\nURL: ${doc.url}\n${doc.content ? `Notes: ${doc.content}` : ''}`;
              } else {
                return `📖 ${doc.title}\n${doc.content}`;
              }
            }).join('\n\n---\n\n');
          }
        }

        // Load GitHub Guidelines
        const savedGitHub = localStorage.getItem('kontext_github_guidelines');
        if (savedGitHub) {
          const guidelines = JSON.parse(savedGitHub);
          if (guidelines.length > 0) {
            githubContext = guidelines.map((g: any) => {
              return `[${g.category.toUpperCase()}] ${g.title}\n${g.content}`;
            }).join('\n\n---\n\n');
          }
        }

        // Load Styling Context
        const savedPalettes = localStorage.getItem('kontext_color_palettes');
        const savedInspirations = localStorage.getItem('kontext_design_inspirations');
        if (savedPalettes || savedInspirations) {
          stylingContext = {
            colorPalettes: savedPalettes ? JSON.parse(savedPalettes).map((p: any) => ({
              name: p.name,
              colors: p.colors.map((c: any) => ({
                hex: c.hex,
                role: c.role
              })),
              source: p.source
            })) : undefined,
            designInspirations: savedInspirations ? JSON.parse(savedInspirations).map((i: any) => ({
              name: i.name,
              url: i.url,
              extractedColors: i.extractedColors,
              extractedTypography: i.extractedTypography
            })) : undefined
          };
        }

        // Load Code Templates
        const savedTemplates = localStorage.getItem('kontext_code_templates');
        if (savedTemplates) {
          const templates = JSON.parse(savedTemplates);
          if (templates.length > 0) {
            codeTemplatesContext = templates.map((t: any) => {
              return `[${t.category.toUpperCase()}] ${t.name} (${t.language})\n${t.description ? `Description: ${t.description}\n` : ''}${t.tags.length > 0 ? `Tags: ${t.tags.join(', ')}\n` : ''}\nCode:\n\`\`\`${t.language}\n${t.code}\n\`\`\``;
            }).join('\n\n---\n\n');
          }
        }

        // Load API Endpoints
        const savedApiEndpoints = localStorage.getItem('kontext_api_endpoints');
        if (savedApiEndpoints) {
          const endpoints = JSON.parse(savedApiEndpoints);
          if (endpoints.length > 0) {
            apiEndpointsContext = endpoints.map((e: any) => {
              return `${e.method} ${e.path}\nName: ${e.name}\nDescription: ${e.description}\n${e.requestSchema ? `Request Schema:\n\`\`\`json\n${e.requestSchema}\n\`\`\`\n` : ''}${e.responseSchema ? `Response Schema:\n\`\`\`json\n${e.responseSchema}\n\`\`\`\n` : ''}`;
            }).join('\n\n---\n\n');
          }
        }
      } catch (error) {
        console.warn('⚠️ [CONTEXT] Failed to load ContextInterface data:', error);
      }
      
      // Load workflow and business agency context
      let workflowContext;
      let businessAgencyContext;
      let agentContext;
      
      try {
        const { userCanisterId, identity } = storeState;
        
        // Load workflows
        if (userCanisterId && identity) {
          const { AgencyService } = await import('../../services/AgencyService');
          const workflowsResult = await AgencyService.getAgencies(
            activeProject,
            userCanisterId,
            identity
          );
          
          if (workflowsResult.success) {
            const { WorkflowIntegrationService } = await import('../../services/WorkflowIntegrationService');
            const integratedWorkflows = WorkflowIntegrationService.getProjectWorkflowIntegrations(activeProject);
            
            workflowContext = {
              availableWorkflows: workflowsResult.agencies.map(a => ({
                id: a.id,
                name: a.name,
                description: a.description
              })),
              integratedWorkflows: integratedWorkflows.map(i => ({
                id: i.id,
                workflowId: i.workflowId,
                workflowName: i.workflowName,
                isEnabled: i.isEnabled
              }))
            };
          }
        }
        
        // Load business agencies
        if (userCanisterId) {
          const { BusinessAgencyContextualAwarenessService } = await import('../../services/BusinessAgencyContextualAwarenessService');
          const { BusinessAgencyIntegrationService } = await import('../../services/BusinessAgencyIntegrationService');
          
          const availableBusinessAgencies = await BusinessAgencyContextualAwarenessService
            .discoverProjectBusinessAgencies(userCanisterId, activeProject);
          
          const integratedBusinessAgencies = BusinessAgencyIntegrationService
            .getProjectBusinessAgencyIntegrations(activeProject);
          
          businessAgencyContext = {
            availableBusinessAgencies: availableBusinessAgencies.map(a => ({
              id: a.agencyId,
              name: a.name,
              description: a.description,
              category: a.category
            })),
            integratedBusinessAgencies: integratedBusinessAgencies.map(i => ({
              id: i.id,
              agencyId: i.agencyId,
              agencyName: i.agencyName,
              isEnabled: i.isEnabled,
              category: i.category
            }))
          };
        }
        
        // Load agents
        const { AgentIntegrationService } = await import('../../services/AgentIntegrationService');
        const integratedAgents = AgentIntegrationService.getProjectIntegrations(activeProject);
        
        // Load available agents from localStorage
        const stored = localStorage.getItem(`deployed-agents-${activeProject}`);
        const availableAgents = stored ? JSON.parse(stored)
          .filter((a: any) => a.status === 'active')
          .map((a: any) => ({
            canisterId: a.backendCanisterId,
            name: a.name,
            description: undefined
          })) : [];
        
        agentContext = {
          availableAgents,
          integratedAgents: integratedAgents.map(i => ({
            id: i.id,
            agentCanisterId: i.agentCanisterId,
            agentName: i.agentName,
            isEnabled: i.isEnabled
          }))
        };
      } catch (error) {
        console.warn('⚠️ [CONTEXT] Failed to load workflow/business agency context:', error);
      }
      
      const context: ChatContext = {
        activeFile,
        fileContent: activeFileContent,
        selectedFiles,
        selectedFileContents,
        fileContents: allFileContents,
        projectStructure,
        projectInfo: {
          id: activeProject,
          name: currentProject?.name || 'Current Project',
          type: currentProject?.projectType?.name || 'General'
        },
        aiRulesContext: enhancedAIContext,
        documentationContext,
        githubContext,
        stylingContext,
        codeTemplatesContext,
        apiEndpointsContext,
        workflowContext,
        businessAgencyContext,
        agentContext
      };
      
      console.log(`Built comprehensive context with ${Object.keys(allFileContents).length} total files`);
      if (workflowContext) {
        console.log(`📋 [CONTEXT] Workflows: ${workflowContext.availableWorkflows.length} available, ${workflowContext.integratedWorkflows.length} integrated`);
      }
      if (businessAgencyContext) {
        console.log(`📊 [CONTEXT] Business Agencies: ${businessAgencyContext.availableBusinessAgencies.length} available, ${businessAgencyContext.integratedBusinessAgencies.length} integrated`);
      }
      if (agentContext) {
        console.log(`🤖 [CONTEXT] Agents: ${agentContext.availableAgents.length} available, ${agentContext.integratedAgents.length} integrated`);
      }
      return context;
    },

    // 🔥 SIMPLIFIED: Selective context with passive debug capture (only used when AI provides recommendations)
    buildSelectiveContext: async (classificationResult: any): Promise<ChatContext> => {
      console.log('🎯 [SELECTIVE CONTEXT] Building selective context with passive debug capture...');
      
      const storeState = safeStoreAccess(get, 'buildSelectiveContext');
      if (!storeState) {
        throw new Error('Store state not available for selective context building');
      }

      const { activeProject, ui, generatedFiles, projectFiles } = storeState;
      
      if (!activeProject) {
        throw new Error('No active project selected');
      }
      
      const currentProject = storeState.getProjectById ? storeState.getProjectById(activeProject) : null;
      const allFiles = { ...generatedFiles, ...(projectFiles[activeProject] || {}) };
      
      console.log(`🔍 [SELECTIVE CONTEXT] Starting with ${Object.keys(allFiles).length} total files`);

      let selectedFileContents: { [fileName: string]: string } = {};
      let selectedFiles: string[] = [];
      let fileSelectionBreakdown = {
        primaryFiles: [] as string[],
        supportingFiles: [] as string[],
        configFiles: [] as string[],
        excludedFiles: [] as string[]
      };

      // 🔥 SIMPLIFIED: Use AI recommendations if available, otherwise fall back to comprehensive
      const fileRecommendations = classificationResult?.currentRequest?.intentAnalysis?.fileRecommendations;
      
      if (fileRecommendations && fileRecommendations.totalFiles > 0) {
        console.log(`📁 [SELECTIVE CONTEXT] Using AI-recommended files:`, {
          primary: fileRecommendations.primaryFiles?.length || 0,
          supporting: fileRecommendations.supportingFiles?.length || 0,
          config: fileRecommendations.configFiles?.length || 0
        });
        
        // 🔥 ENHANCED: Log config files specifically for debugging
        if (fileRecommendations.configFiles && fileRecommendations.configFiles.length > 0) {
          console.log(`📁 [SELECTIVE CONTEXT] Config files recommended:`, fileRecommendations.configFiles);
        }

        fileSelectionBreakdown.primaryFiles = fileRecommendations.primaryFiles || [];
        fileSelectionBreakdown.supportingFiles = fileRecommendations.supportingFiles || [];
        fileSelectionBreakdown.configFiles = fileRecommendations.configFiles || [];
        fileSelectionBreakdown.excludedFiles = fileRecommendations.excludedFiles || [];

        const recommendedFiles = [
          ...(fileRecommendations.primaryFiles || []),
          ...(fileRecommendations.supportingFiles || []),
          ...(fileRecommendations.configFiles || [])
        ];

        // 🚀 OPTIMIZATION: Load recommended file contents in parallel
        const fileLoadingResults = await Promise.all(
          recommendedFiles.map(async (fileName) => {
            if (allFiles[fileName]) {
              return {
                fileName,
                matchedFileName: fileName,
                content: allFiles[fileName],
                found: true
              };
            } else {
              // 🔥 ENHANCED: Better file matching for config files and files with path differences
              const fileNameLower = fileName.toLowerCase();
              const fileNameOnly = fileName.split('/').pop() || fileName; // Get just the filename without path
              
              const matchingFile = Object.keys(allFiles).find(existingFile => {
                const existingFileLower = existingFile.toLowerCase();
                const existingFileNameOnly = existingFile.split('/').pop() || existingFile;
                
                // Exact match (case-insensitive)
                if (existingFileLower === fileNameLower) return true;
                
                // Filename-only match (handles path differences like "package.json" vs "src/frontend/package.json")
                if (fileNameOnly.toLowerCase() === existingFileNameOnly.toLowerCase()) return true;
                
                // Partial match (original logic)
                if (existingFileLower.includes(fileNameLower) || fileNameLower.includes(existingFileLower)) return true;
                
                // Special handling for config files - match by base name
                const configFilePatterns = ['package.json', 'postcss.config', 'tailwind.config', 'vite.config', 'tsconfig.json'];
                for (const pattern of configFilePatterns) {
                  if (fileNameLower.includes(pattern) && existingFileLower.includes(pattern)) {
                    return true;
                  }
                }
                
                return false;
              });
              
              if (matchingFile) {
                console.log(`📄 [SELECTIVE CONTEXT] Found similar file: ${fileName} → ${matchingFile}`);
                return {
                  fileName,
                  matchedFileName: matchingFile,
                  content: allFiles[matchingFile],
                  found: true
                };
              } else {
                console.warn(`⚠️ [SELECTIVE CONTEXT] Recommended file not found: ${fileName}`);
                return {
                  fileName,
                  matchedFileName: null,
                  content: null,
                  found: false
                };
              }
            }
          })
        );

        // Process results
        for (const result of fileLoadingResults) {
          if (result.found && result.content) {
            selectedFileContents[result.matchedFileName!] = result.content;
            selectedFiles.push(result.matchedFileName!);
          }
        }

        // Log warning for missing files
        const missingFiles = fileLoadingResults.filter(r => !r.found).map(r => r.fileName);
        if (missingFiles.length > 0) {
          console.warn(`⚠️ [SELECTIVE CONTEXT] ${missingFiles.length} recommended files not found:`, missingFiles);
          console.warn(`⚠️ [SELECTIVE CONTEXT] Available files:`, Object.keys(allFiles).slice(0, 20));
        }

        console.log(`✅ [SELECTIVE CONTEXT] Loaded ${selectedFiles.length} recommended files`);
        console.log(`✅ [SELECTIVE CONTEXT] Files loaded:`, selectedFiles);
        
        // 🔥 ENHANCED: Warn if config files were recommended but not loaded
        const recommendedConfigFiles = fileRecommendations.configFiles || [];
        const loadedConfigFiles = selectedFiles.filter(f => {
          const fLower = f.toLowerCase();
          return fLower.includes('package.json') || fLower.includes('postcss') || 
                 fLower.includes('tailwind') || fLower.includes('vite.config') || 
                 fLower.includes('tsconfig') || fLower.endsWith('.config.js') ||
                 fLower.endsWith('.config.ts');
        });
        
        if (recommendedConfigFiles.length > 0 && loadedConfigFiles.length < recommendedConfigFiles.length) {
          console.warn(`⚠️ [SELECTIVE CONTEXT] Some config files were recommended but not loaded:`, {
            recommended: recommendedConfigFiles,
            loaded: loadedConfigFiles,
            missing: recommendedConfigFiles.filter(rec => 
              !selectedFiles.some(loaded => {
                const recLower = rec.toLowerCase();
                const loadedLower = loaded.toLowerCase();
                return loadedLower.includes(recLower) || recLower.includes(loadedLower) ||
                       recLower.split('/').pop() === loadedLower.split('/').pop();
              })
            )
          });
        }

      } else {
        console.log('📋 [SELECTIVE CONTEXT] No AI recommendations available, using UI-selected files...');
        
        const uiSelectedFiles = ui.sidePane?.selectedFiles || [];
        fileSelectionBreakdown.supportingFiles = uiSelectedFiles.slice(0, 10);
        
        for (const fileName of uiSelectedFiles.slice(0, 10)) {
          if (allFiles[fileName]) {
            selectedFileContents[fileName] = allFiles[fileName];
            selectedFiles.push(fileName);
          }
        }
        console.log(`📋 [SELECTIVE CONTEXT] Used ${selectedFiles.length} UI-selected files`);
      }

      // Include actively selected file from UI if not already included
      const activeFile = ui.sidePane?.activeFile || '';
      const activeFileContent = ui.sidePane?.fileContent || '';
      
      if (activeFile && activeFileContent && !selectedFileContents[activeFile]) {
        selectedFileContents[activeFile] = activeFileContent;
        selectedFiles.push(activeFile);
        fileSelectionBreakdown.supportingFiles.push(activeFile);
        console.log(`📄 [SELECTIVE CONTEXT] Added active file: ${activeFile}`);
      }

      // 🔥 NEW: PASSIVE debug capture - capture context building results
      if (classificationResult?.debugId) {
        const contextData = {
          fileContents: selectedFileContents,
          aiRulesContext: (get() as any).getEnhancedAIContext(),
          primaryFiles: fileSelectionBreakdown.primaryFiles,
          supportingFiles: fileSelectionBreakdown.supportingFiles,
          configFiles: fileSelectionBreakdown.configFiles,
          excludedFiles: fileSelectionBreakdown.excludedFiles
        };
        
        await captureDebugData.contextBuilding(classificationResult.debugId, contextData, selectedFiles);
      }

      const projectStructure = selectedFiles.map(fileName => ({
        name: fileName,
        type: fileName.includes('.mo') ? 'backend' : 
              fileName.includes('.tsx') ? 'component' : 
              fileName.includes('.css') ? 'style' : 'config'
      }));
      
      const enhancedAIContext = (get() as any).getEnhancedAIContext();
      
      // Load context from ContextInterface (localStorage) - same as comprehensive context
      let documentationContext: string | undefined;
      let githubContext: string | undefined;
      let stylingContext: ChatContext['stylingContext'];
      let codeTemplatesContext: string | undefined;
      let apiEndpointsContext: string | undefined;
      
      try {
        // Load Documentation
        const savedDocs = localStorage.getItem('kontext_documentation_items');
        if (savedDocs) {
          const docs = JSON.parse(savedDocs);
          if (docs.length > 0) {
            documentationContext = docs.map((doc: any) => {
              if (doc.type === 'link') {
                return `📖 ${doc.title}\nURL: ${doc.url}\n${doc.content ? `Notes: ${doc.content}` : ''}`;
              } else {
                return `📖 ${doc.title}\n${doc.content}`;
              }
            }).join('\n\n---\n\n');
          }
        }

        // Load GitHub Guidelines
        const savedGitHub = localStorage.getItem('kontext_github_guidelines');
        if (savedGitHub) {
          const guidelines = JSON.parse(savedGitHub);
          if (guidelines.length > 0) {
            githubContext = guidelines.map((g: any) => {
              return `[${g.category.toUpperCase()}] ${g.title}\n${g.content}`;
            }).join('\n\n---\n\n');
          }
        }

        // Load Styling Context
        const savedPalettes = localStorage.getItem('kontext_color_palettes');
        const savedInspirations = localStorage.getItem('kontext_design_inspirations');
        if (savedPalettes || savedInspirations) {
          stylingContext = {
            colorPalettes: savedPalettes ? JSON.parse(savedPalettes).map((p: any) => ({
              name: p.name,
              colors: p.colors.map((c: any) => ({
                hex: c.hex,
                role: c.role
              })),
              source: p.source
            })) : undefined,
            designInspirations: savedInspirations ? JSON.parse(savedInspirations).map((i: any) => ({
              name: i.name,
              url: i.url,
              extractedColors: i.extractedColors,
              extractedTypography: i.extractedTypography
            })) : undefined
          };
        }

        // Load Code Templates
        const savedTemplates = localStorage.getItem('kontext_code_templates');
        if (savedTemplates) {
          const templates = JSON.parse(savedTemplates);
          if (templates.length > 0) {
            codeTemplatesContext = templates.map((t: any) => {
              return `[${t.category.toUpperCase()}] ${t.name} (${t.language})\n${t.description ? `Description: ${t.description}\n` : ''}${t.tags.length > 0 ? `Tags: ${t.tags.join(', ')}\n` : ''}\nCode:\n\`\`\`${t.language}\n${t.code}\n\`\`\``;
            }).join('\n\n---\n\n');
          }
        }

        // Load API Endpoints
        const savedApiEndpoints = localStorage.getItem('kontext_api_endpoints');
        if (savedApiEndpoints) {
          const endpoints = JSON.parse(savedApiEndpoints);
          if (endpoints.length > 0) {
            apiEndpointsContext = endpoints.map((e: any) => {
              return `${e.method} ${e.path}\nName: ${e.name}\nDescription: ${e.description}\n${e.requestSchema ? `Request Schema:\n\`\`\`json\n${e.requestSchema}\n\`\`\`\n` : ''}${e.responseSchema ? `Response Schema:\n\`\`\`json\n${e.responseSchema}\n\`\`\`\n` : ''}`;
            }).join('\n\n---\n\n');
          }
        }
      } catch (error) {
        console.warn('⚠️ [SELECTIVE CONTEXT] Failed to load ContextInterface data:', error);
      }
      
      const context: ChatContext = {
        activeFile,
        fileContent: activeFileContent,
        selectedFiles,
        selectedFileContents,
        fileContents: selectedFileContents, // Use selective files instead of all files
        projectStructure,
        projectInfo: {
          id: activeProject,
          name: currentProject?.name || 'Current Project',
          type: currentProject?.projectType?.name || 'General'
        },
        aiRulesContext: enhancedAIContext,
        documentationContext,
        githubContext,
        stylingContext,
        codeTemplatesContext,
        apiEndpointsContext
      };
      
      console.log(`🎯 [SELECTIVE CONTEXT] Built selective context with enhanced message prioritization:`, {
        selectedFiles: selectedFiles.length,
        totalAvailable: Object.keys(allFiles).length,
        reductionPercentage: Math.round((1 - selectedFiles.length / Object.keys(allFiles).length) * 100) + '%',
        debugCaptured: !!classificationResult?.debugId
      });
      
      return context;
    },

    // 🔥 CRITICAL FIX: IMMEDIATE K ANIMATION - Start visual state BEFORE atomic message creation
    sendMessage: async () => {
      console.log('🔥 [SEND MESSAGE] Starting IMMEDIATE K ANIMATION with coordinator integration...');
      
      // 🔥 CRITICAL FIX: Safe store access for input and activeProject
      const storeState = safeStoreAccess(get, 'sendMessage');
      if (!storeState) {
        console.error('[SEND MESSAGE] Store state not available');
        return;
      }

      const { input, activeProject } = storeState;
      
      if (!input.trim()) {
        console.log('[SEND MESSAGE] Empty input, aborting');
        return;
      }

      if (!activeProject) {
        console.log('[SEND MESSAGE] No active project, aborting');
        return;
      }

      const isActive = storeState.isSubscriptionActiveForFeatureAccess ? storeState.isSubscriptionActiveForFeatureAccess() : false;
      if (!isActive) {
        log('SUBSCRIPTION', 'Blocking chat feature - subscription renewal required');
        if (typeof storeState.handleSubscriptionRenewal === 'function') {
          await storeState.handleSubscriptionRenewal();
        }
        return;
      }

      const persistenceStatus = messageCoordinator.getPersistenceStatus();
      if (!persistenceStatus.enabled || !persistenceStatus.verified) {
        console.error('[SEND MESSAGE] MessageCoordinator persistence not ready');
        console.error('Persistence status:', persistenceStatus);
        return;
      }

      console.log('🔥 [COORDINATOR MESSAGE HANDLING] Starting with IMMEDIATE K ANIMATION');

      messageCoordinator.setCurrentProject(activeProject);

      // 🚀 IMMEDIATE K ANIMATION START - BEFORE any async operations
      console.log('🚀 [IMMEDIATE K] Starting K animation immediately...');
      messageCoordinator.startPureVisualState('Processing your request...');

      // Clear input immediately for better UX
      if (typeof storeState.setInput === 'function') {
        storeState.setInput('');
      }

      // 🔥 SPECIAL: Handle General Chat (no code generation, just Q&A about Kontext)
      if (activeProject === 'general-chat') {
        console.log('💬 [GENERAL CHAT] Routing to Kontext Q&A mode...');
        messageCoordinator.updateKLoadingMessage('Processing your question...');
        
        const result = await messageCoordinator.createUserMessageWithPriority(
          activeProject,
          input,
          'CRITICAL'
        );
        
        if (!result.success) {
          messageCoordinator.completePureVisualState();
          return;
        }
        
        const userMessage = {
          id: result.messageId,
          type: 'user' as const,
          content: input,
          timestamp: new Date(),
          isGenerating: false,
          isCurrentInstruction: true
        };
        
        if (typeof storeState.saveMessageToCanister === 'function') {
          try {
            await storeState.saveMessageToCanister(activeProject, userMessage);
          } catch (saveError) {
            console.warn('Backend save failed:', saveError);
          }
        }
        
        // Build simple Kontext info prompt
        const kontextInfoPrompt = `You are the Kontext AI assistant. Kontext is a platform for generating full-stack ICP (Internet Computer) applications.

**What Kontext Does:**
- Generates complete full-stack applications (Motoko backend + React frontend)
- Automatically deploys to the Internet Computer
- Handles authentication, state management, and ICP integration
- Provides real-time collaboration and hot reload
- Manages canisters and cycles

**Key Features:**
- AI-powered code generation from natural language descriptions
- Template-based architecture with the MotokoReactBible template
- Automatic deployment and canister management
- Live preview and hot reload
- File editing and version control
- Credit-based pricing model

**User's Question:**
${input}

Please provide a helpful, friendly response about Kontext. Be concise and informative.`;

        messageCoordinator.setOperatingMode('MINIMAL_CHAT');
        await (get() as any).handleRegularChatRequest(activeProject, userMessage, kontextInfoPrompt, {}, {
          comprehensiveContext: { allFiles: {}, projectMetadata: null },
          enhancedPrompt: kontextInfoPrompt
        });
        return;
      }

      // 🚀 OPTIMIZATION: Early exit for simple conversational requests
      const inputLower = input.toLowerCase().trim();
      const simpleResponses = [
        'yes', 'y', 'yeah', 'sure', 'ok', 'okay', 'go ahead', 'please', 'do it',
        'thanks', 'thank you', 'thx', 'ty',
        'no', 'n', 'nope', "don't", 'stop', 'cancel',
        'hi', 'hello', 'hey'
      ];
      const isSimpleResponse = simpleResponses.includes(inputLower) || 
                               (inputLower.length < 20 && !inputLower.includes('.') && !inputLower.includes('/'));
      
      // For simple responses, skip heavy classification and use minimal context
      if (isSimpleResponse) {
        console.log('🚀 [OPTIMIZATION] Simple response detected, using fast path...');
        messageCoordinator.updateKLoadingMessage('Processing...');
        
        const result = await messageCoordinator.createUserMessageWithPriority(
          activeProject,
          input,
          'CRITICAL'
        );
        
        if (!result.success) {
          messageCoordinator.completePureVisualState();
          return;
        }
        
        const simpleMessage = {
          id: result.messageId,
          type: 'user' as const,
          content: input,
          timestamp: new Date(),
          isGenerating: false,
          isCurrentInstruction: true
        };
        
        if (typeof storeState.saveMessageToCanister === 'function') {
          try {
            await storeState.saveMessageToCanister(activeProject, simpleMessage);
          } catch (saveError) {
            console.warn('Backend save failed:', saveError);
          }
        }
        
        // Use minimal context for simple responses
        const minimalContext = await (get() as any).buildComprehensiveContext();
        messageCoordinator.setOperatingMode('MINIMAL_CHAT');
        await (get() as any).handleRegularChatRequest(activeProject, simpleMessage, input, {}, {
          comprehensiveContext: minimalContext,
          enhancedPrompt: input
        });
        return;
      }

      try {
        // 🔥 PHASE 1: ATOMIC USER MESSAGE CREATION (now happens after K animation starts)
        console.log('🔥 [PHASE 1] Creating user message with ATOMIC priority assignment via MessageCoordinator...');
        
        messageCoordinator.updateKLoadingMessage('Preparing your message...');
        
        const result = await messageCoordinator.createUserMessageWithPriority(
          activeProject,
          input,
          'CRITICAL'
        );
        
        if (!result.success) {
          console.error('🔥 [PHASE 1] MessageCoordinator message creation failed');
          messageCoordinator.completePureVisualState();
          return;
        }
        
        console.log('🔥 [PHASE 1] ✅ User message created atomically:', {
          messageId: result.messageId,
          currentInstructionId: result.currentInstructionId
        });

        // Save message to backend
        const userMessage = {
          id: result.messageId,
          type: 'user' as const,
          content: input,
          timestamp: new Date(),
          isGenerating: false,
          isCurrentInstruction: true
        };
        
        if (typeof storeState.saveMessageToCanister === 'function') {
          try {
            await storeState.saveMessageToCanister(activeProject, userMessage);
            console.log('🔥 [PHASE 1] User message saved to backend');
          } catch (saveError) {
            console.warn('🔥 [PHASE 1] Backend save failed:', saveError);
          }
        }

        // 🚀 PHASE 2: PARALLEL CONTEXT BUILDING (Performance Optimization)
        console.log('🚀 [PHASE 2] Building context in parallel for faster response...');
        messageCoordinator.updateKLoadingMessage('Understanding what you need...');
        
        // 🚀 PERFORMANCE: Run classification and base context building IN PARALLEL
        // This saves 2-4 seconds by not waiting for classification to finish before loading files
        const [smartContext, baseComprehensiveContext] = await Promise.all([
          (get() as any).buildSmartClassificationContext(input),
          (get() as any).buildComprehensiveContext()
        ]);
        
        const intentAnalysis = smartContext.currentRequest.intentAnalysis;
        
        console.log(`🔥 [ROUTING] Intent: ${intentAnalysis.primaryIntent}, Confidence: ${intentAnalysis.confidence}%`);
        console.log(`🔥 [ROUTING] Reasoning: ${intentAnalysis.reasoning}`);
        if (intentAnalysis.fileRecommendations) {
          console.log(`🔥 [ROUTING] AI recommended ${intentAnalysis.fileRecommendations.totalFiles} files for context`);
        }
        
        messageCoordinator.updateKLoadingMessage('Gathering relevant information...');
        
        // 🚀 PHASE 3: BUILD PRIORITY ASSEMBLY (Depends on classification result)
        console.log('🔥 [PHASE 3] Building priority assembly with coordinator-created message...');
        let priorityAssembly;
        try {
          priorityAssembly = await (get() as any).buildPriorityMessageAssembly(activeProject, result.messageId);
          console.log(`🔥 [PRIORITY ROUTING] Priority assembly built:`, {
            totalTokens: priorityAssembly.assemblyMetadata.totalTokens,
            currentInstructionTokens: priorityAssembly.currentInstruction.estimatedTokens,
            supportingTokens: priorityAssembly.supportingContext.estimatedTokens,
            currentInstructionMessageId: priorityAssembly.currentInstruction.message.id,
            priorityDistribution: priorityAssembly.assemblyMetadata.priorityDistribution
          });
          
        } catch (assemblyError) {
          console.warn('⚠️ [PRIORITY ROUTING] Priority assembly failed, using standard context:', assemblyError);
          priorityAssembly = null;
        }
        
        // 🔥 ENHANCED: Context strategy with priority system integration
        console.log('🔥 [PHASE 3] Finalizing context with priority system integration...');
        let contextToUse;
        if (intentAnalysis.fileRecommendations && intentAnalysis.fileRecommendations.totalFiles > 0) {
          console.log('[CONTEXT] Using selective context based on AI recommendations');
          try {
            const selectiveContext = await (get() as any).buildSelectiveContext(smartContext);
            
            // 🔥 NEW: Enhance with priority-based context if available
            if (priorityAssembly) {
              contextToUse = await (get() as any).createPriorityBasedContext(priorityAssembly, selectiveContext);
              console.log('🔥 [CONTEXT] Enhanced selective context with priority system');
            } else {
              contextToUse = selectiveContext;
            }
          } catch (selectiveError) {
            console.warn('[CONTEXT] Selective context failed, falling back to comprehensive:', selectiveError);
            // Use the pre-built comprehensive context from parallel fetch
            contextToUse = priorityAssembly 
              ? await (get() as any).createPriorityBasedContext(priorityAssembly, baseComprehensiveContext)
              : baseComprehensiveContext;
          }
        } else {
          console.log('[CONTEXT] Using comprehensive context (already loaded in parallel)');
          // Use the pre-built comprehensive context from parallel fetch
          contextToUse = priorityAssembly 
            ? await (get() as any).createPriorityBasedContext(priorityAssembly, baseComprehensiveContext)
            : baseComprehensiveContext;
        }
        
        // K animation continues through the handler, so we don't complete it here
        
        // 🔥 NEW: Create enhanced context with priority system
        const enhancedContextWithPriority = {
          smartContext,
          comprehensiveContext: contextToUse,
          priorityAssembly,
          enhancedPrompt: priorityAssembly 
            ? (get() as any).assemblePriorityPrompt(priorityAssembly, input)
            : `${input}\n\n${smartContext.aiRulesContext}`,
          // 🔥 NEW: Priority system metadata for handlers
          priorityMetadata: {
            hasCurrentInstruction: true,
            currentInstructionId: result.messageId,
            totalPriorityTokens: priorityAssembly?.assemblyMetadata.totalTokens || 0,
            priorityStructureApplied: !!priorityAssembly
          }
        };
        
        // Get user message for handlers (using coordinator-created message)
        const coordinatorCreatedMessage = {
          id: result.messageId,
          type: 'user' as const,
          content: input,
          timestamp: new Date(),
          isGenerating: false,
          isCurrentInstruction: true
        };
        
        console.log('🔥 [PHASE 4] Routing to handler with coordinator-created message and priority context...');
        if (intentAnalysis.primaryIntent === 'CREATE_PROJECT' && intentAnalysis.confidence >= 80) {
          console.log('🔥 [ROUTING] → PROJECT GENERATION (Coordinator-Enhanced)');
          messageCoordinator.setOperatingMode('COMPLEX_PROJECT_GEN');
          await (get() as any).handleProjectGenerationRequest(activeProject, coordinatorCreatedMessage, input, enhancedContextWithPriority);
          
        } else if (intentAnalysis.primaryIntent === 'UPDATE_CODE' && intentAnalysis.confidence >= 85) {
          // 🔥 NEW: Additional conversational detection before routing to UPDATE_CODE
          const conversationalKeywords = [
            'what is', 'what does', 'how does', 'why does', 'explain', 
            'can you explain', 'tell me about', 'show me how',
            'what\'s the', 'where is', 'which file', 'help me understand',
            'describe', 'clarify', 'what are', 'tell me why'
          ];

          const isConversationalQuery = conversationalKeywords.some(keyword => 
            input.toLowerCase().includes(keyword)
          );

          // If it looks conversational with less than 90% confidence, route to chat instead
          if (isConversationalQuery && intentAnalysis.confidence < 90) {
            console.log('🔥 [ROUTING] → CONVERSATIONAL (Question detected, overriding UPDATE_CODE)');
            messageCoordinator.setOperatingMode('MINIMAL_CHAT');
            await (get() as any).handleRegularChatMessage(activeProject, coordinatorCreatedMessage, input, enhancedContextWithPriority);
          } else {
            console.log('🔥 [ROUTING] → UPDATE CODE (Full File Regeneration)');
            messageCoordinator.setOperatingMode('COMPLEX_PROJECT_GEN'); // Use project gen mode for full file regeneration
            await (get() as any).handleNewFileUpdateRequest(activeProject, coordinatorCreatedMessage, input, enhancedContextWithPriority);
          }
          
        } else if (false) { // UPDATE_CODE routes through full file regeneration
          // 🔥 FIX: Check if previous message was an AI question and user didn't affirmatively respond
          const routingStoreState = safeStoreAccess(get, 'sendMessage_routing');
          const currentMessages = routingStoreState?.currentMessages || [];
          const lastSystemMessage = currentMessages
            .filter((m: ChatInterfaceMessage) => m.type === 'system')
            .slice(-1)[0];
          
          const isResponseToQuestion = lastSystemMessage && (
            lastSystemMessage.content.toLowerCase().includes('would you like') ||
            lastSystemMessage.content.toLowerCase().includes('should i') ||
            lastSystemMessage.content.toLowerCase().includes('do you want') ||
            lastSystemMessage.content.toLowerCase().includes('can i') ||
            lastSystemMessage.content.toLowerCase().includes('may i') ||
            lastSystemMessage.content.toLowerCase().endsWith('?')
          );
          
          // Check if user's response is actually affirmative
          const userInputLower = input.toLowerCase().trim();
          const isAffirmative = userInputLower === 'yes' || 
                               userInputLower === 'y' || 
                               userInputLower === 'yeah' ||
                               userInputLower === 'sure' ||
                               userInputLower === 'ok' ||
                               userInputLower === 'okay' ||
                               userInputLower === 'go ahead' ||
                               userInputLower === 'please' ||
                               userInputLower === 'do it' ||
                               userInputLower.startsWith('yes ') ||
                               userInputLower.startsWith('yes,') ||
                               userInputLower.includes('yes,') ||
                               userInputLower.includes('please do') ||
                               userInputLower.includes('go for it');
          
          // Check if user is asking a question (not affirming)
          const isUserAskingQuestion = userInputLower.endsWith('?') || 
                                       userInputLower.startsWith('what') ||
                                       userInputLower.startsWith('how') ||
                                       userInputLower.startsWith('why') ||
                                       userInputLower.startsWith('when') ||
                                       userInputLower.startsWith('where') ||
                                       userInputLower.startsWith('who') ||
                                       userInputLower.startsWith('can you') ||
                                       userInputLower.startsWith('could you') ||
                                       userInputLower.startsWith('would you');
          
          // If AI asked a question and user didn't affirmatively respond, route to conversational
          if (isResponseToQuestion && !isAffirmative && (isUserAskingQuestion || userInputLower.length < 20)) {
            console.log('🔥 [ROUTING] → CONVERSATIONAL (User responded to AI question without affirmation)');
            messageCoordinator.setOperatingMode('MINIMAL_CHAT');
            await (get() as any).handleRegularChatRequest(activeProject, coordinatorCreatedMessage, input, {}, enhancedContextWithPriority);
          } else {
            console.log('🔥 [ROUTING] → UPDATE (Coordinator-Enhanced)');
            messageCoordinator.setOperatingMode('SIMPLE_UPDATE');
            await (get() as any).handleCodeUpdateRequest(activeProject, coordinatorCreatedMessage, input, {}, enhancedContextWithPriority);
          }
          
        } else {
          console.log('🔥 [ROUTING] → CONVERSATIONAL (Coordinator-Enhanced)');
          messageCoordinator.setOperatingMode('MINIMAL_CHAT');
          await (get() as any).handleRegularChatRequest(activeProject, coordinatorCreatedMessage, input, {}, enhancedContextWithPriority);
        }

      } catch (error) {
        console.error('[COORDINATOR MESSAGE HANDLING] Error in coordinator-based message processing:', error);
        
        messageCoordinator.completePureVisualState();
        
        console.log('[FALLBACK] → SIMPLE CHAT (error recovery)');
        try {
          messageCoordinator.setOperatingMode('MINIMAL_CHAT');
          const comprehensiveContext = await (get() as any).buildComprehensiveContext();
          
          // Create fallback message if needed
          const fallbackMessageResult = await messageCoordinator.createUserMessageWithPriority(
            activeProject,
            input,
            'CRITICAL'
          );
          
          const coordinatorCreatedMessage = {
            id: fallbackMessageResult.messageId,
            type: 'user' as const,
            content: input,
            timestamp: new Date(),
            isGenerating: false,
            isCurrentInstruction: true
          };
          
          await (get() as any).handleRegularChatRequest(activeProject, coordinatorCreatedMessage, input, {}, {
            comprehensiveContext,
            enhancedPrompt: input
          });
        } catch (fallbackError) {
          console.error('[FALLBACK] Even fallback failed:', fallbackError);
        }
      }
      
      console.log('🔥 [SEND MESSAGE] Coordinator-based message handling with IMMEDIATE K animation completed!');
    },

    // 🔥 ENHANCED: Project generation with priority system integration
    handleProjectGenerationRequest: async (activeProject: string, userMessage: ChatInterfaceMessage, input: string, enhancedContext: any) => {
      console.log('🔥 [PROJECT GENERATION] Starting with COORDINATOR integration');
      
      // 🔥 VALIDATION: Confirm we have priority-enhanced context
      if (enhancedContext.priorityMetadata?.priorityStructureApplied) {
        console.log('🔥 [PROJECT GENERATION] ✅ Priority structure confirmed in context');
      } else {
        console.warn('🔥 [PROJECT GENERATION] ⚠️ No priority structure detected in context');
      }
      
      fileDetectionPhaseManager.reset();
      
      // 🔥 CRITICAL FIX: Safe store access for resetPhaseTracking
      const storeState = safeStoreAccess(get, 'handleProjectGenerationRequest');
      if (storeState && typeof storeState.resetPhaseTracking === 'function') {
        storeState.resetPhaseTracking();
      }
      
      messageCoordinator.setCurrentProject(activeProject);
      
      // 🔥 NEW: Use priority-enhanced prompt if available
      const transitionalMessage = enhancedContext.priorityAssembly 
        ? `Processing your CRITICAL priority request with ${enhancedContext.priorityAssembly.assemblyMetadata.totalTokens} tokens of priority-structured context...`
        : 'Kontext is processing your request...';
        
      const assistantMessageId = messageCoordinator.createAndControlGenerationMessage(activeProject, transitionalMessage);
      
      // 🔥 CRITICAL FIX: Safe store access for generation methods
      if (storeState) {
        if (typeof storeState.startGeneration === 'function') {
          storeState.startGeneration(assistantMessageId, true);
        }
        if (typeof storeState.clearCandidContext === 'function') {
          storeState.clearCandidContext();
        }
      }

      // 🔥 NEW: PASSIVE debug capture - extract debug ID
      const debugId = enhancedContext?.smartContext?.debugId;

      try {
        const currentProject = storeState && storeState.getProjectById ? storeState.getProjectById(activeProject) : null;
        let projectName = currentProject?.name || activeProject;
        
        const { ProjectGenerationService } = await import('../../services/ProjectGenerationService');
        const result = await ProjectGenerationService.generateProject({
          projectId: activeProject,
          // 🔥 CRITICAL FIX: Use RAW input for spec generation (not priority-wrapped prompt)
          // The priority system wraps prompts with "🎯 CURRENT USER INSTRUCTION" which leaks into project names
          // Spec generation needs clean user input, priority prompt is only for code generation
          userInput: input, // Always use raw input - sanitization happens in AISpecGenerationService
          projectName,
          identity: storeState?.identity,
          messageId: assistantMessageId,
          
          getProjectById: storeState?.getProjectById,
          updateProject: storeState?.updateProject,
          updateProjectsInStore: (updater: (state: any) => void) => {
            set(updater);
          },
          loadProjects: storeState?.loadProjects,
          
          onProgress: async (event: any) => {
            switch (event.type) {
              case 'connected':
                console.log('🔥 [PROJECT GENERATION] Connected - coordinator integration active');
                
                // 🔥 NEW: PASSIVE debug capture - capture API call
                if (debugId) {
                  await captureDebugData.apiCall(debugId, [], 'project-generation-model', {
                    requestType: 'coordinator_enhanced_project_generation',
                    projectId: activeProject,
                    userInput: input,
                    hasPriorityAssembly: !!enhancedContext.priorityAssembly,
                    totalTokens: enhancedContext.priorityAssembly?.assemblyMetadata?.totalTokens || 0
                  });
                }
                break;
                
              case 'content_delta':
                if (event.content) {
                  const extractionResult = FileExtractor.detectProgressiveFiles(event.content);
                  const { completeFiles, inProgressFiles } = extractionResult;
                  
                  // 🔥 CRITICAL: Filter out vite.config files - platform generates these automatically
                  const viteConfigPattern = /vite\.config\.(ts|js|mjs|cjs)$/i;
                  const filteredCompleteFiles: { [key: string]: string } = {};
                  const filteredInProgressFiles: { [key: string]: string } = {};
                  
                  Object.keys(completeFiles).forEach(fileName => {
                    if (!viteConfigPattern.test(fileName)) {
                      filteredCompleteFiles[fileName] = completeFiles[fileName];
                    }
                  });
                  
                  Object.keys(inProgressFiles).forEach(fileName => {
                    if (!viteConfigPattern.test(fileName)) {
                      filteredInProgressFiles[fileName] = inProgressFiles[fileName];
                    }
                  });
                  
                  const allCurrentFiles = { ...filteredCompleteFiles, ...filteredInProgressFiles };
                  
                  if (Object.keys(allCurrentFiles).length > 0 && storeState && typeof storeState.onFileUpdate === 'function') {
                    storeState.onFileUpdate(allCurrentFiles, event.content);
                  }
                }
                break;

              case 'complete':
                console.log('🔥 [PROJECT GENERATION] Completion with coordinator integration');
                
                // 🔥 CRITICAL FIX: Use event data instead of result variable to avoid scope issues
                const finalContent = event.finalContent || event.content || 'Generation completed successfully!';
                const extractedFiles = event.extractedFiles || {};
                
                // 🔥 NEW: PASSIVE debug capture - capture response using event data
                if (debugId) {
                  await captureDebugData.response(
                    debugId,
                    { content: finalContent },
                    extractedFiles,
                    true
                  );
                }
                
                try {
                  console.log('[COMPLETION] Attempting primary completion...');
                  const completionState = safeStoreAccess(get, 'completeGeneration');
                  if (completionState && typeof completionState.completeGeneration === 'function') {
                    completionState.completeGeneration(finalContent, extractedFiles);
                    console.log('[COMPLETION] Primary completion successful');
                  } else {
                    console.warn('[COMPLETION] completeGeneration method not available, skipping primary completion');
                  }
                } catch (primaryError) {
                  console.warn('[COMPLETION] Primary completion failed:', primaryError);
                  if (debugId) {
                    await captureDebugData.error(debugId, 'primary_completion', primaryError);
                  }
                }
                
                // 🔥 CRITICAL FIX: Use event.extractedFiles for file operations
                // 🔥 CRITICAL: Filter out vite.config files - platform generates these automatically
                const viteConfigPattern = /vite\.config\.(ts|js|mjs|cjs)$/i;
                const filteredExtractedFiles: { [key: string]: string } = {};
                const removedViteConfigs: string[] = [];
                
                Object.keys(extractedFiles || {}).forEach(fileName => {
                  if (viteConfigPattern.test(fileName)) {
                    removedViteConfigs.push(fileName);
                    console.warn(`🚫 [PROJECT GENERATION] Blocked AI-generated vite.config file: ${fileName} - Platform generates this automatically with correct backend canister ID`);
                  } else {
                    filteredExtractedFiles[fileName] = extractedFiles[fileName];
                  }
                });
                
                if (removedViteConfigs.length > 0) {
                  console.warn(`⚠️ [PROJECT GENERATION] Removed ${removedViteConfigs.length} vite.config file(s) generated by AI:`, removedViteConfigs);
                }
                
                const filesToSave = filteredExtractedFiles;
                if (Object.keys(filesToSave).length > 0) {
                  console.log('[COMPLETION] Updating and saving generated files...');
                  
                  const fileOperationState = safeStoreAccess(get, 'file_operations');
                  if (fileOperationState) {
                    if (typeof fileOperationState.updateGeneratedFiles === 'function') {
                      fileOperationState.updateGeneratedFiles(filesToSave);
                      console.log('[COMPLETION] ✅ AI-generated files updated in store');
                    }
                    
                    if (typeof fileOperationState.saveProjectFiles === 'function') {
                      await fileOperationState.saveProjectFiles(activeProject, filesToSave);
                      console.log('[COMPLETION] ✅ AI-generated files saved to backend');
                    }
                  }
                } else {
                  console.warn('[COMPLETION] ⚠️ No files to save - extractedFiles is empty');
                }
                break;
                
              case 'error':
                const errorContent = `I encountered an issue while processing your request: ${event.message || 'Unknown error'}

Please try rephrasing your request or contact support if the issue persists.`;
                
                // 🔥 NEW: PASSIVE debug capture - capture error
                if (debugId) {
                  await captureDebugData.response(
                    debugId,
                    { content: errorContent },
                    {},
                    false,
                    event.message || 'Unknown error'
                  );
                  
                  await captureDebugData.error(debugId, 'project_generation', event.message || 'Unknown error');
                }
                
                // Fix: Use ensureCompletionMessageExists for error cases instead of createFinalWrapUpMessage
                await ensureCompletionMessageExists(
                  activeProject,
                  errorContent,
                  {},
                  false
                );
                
                const errorState = safeStoreAccess(get, 'completeGeneration_error');
                if (errorState && typeof errorState.completeGeneration === 'function') {
                  errorState.completeGeneration();
                }
                return;
            }
          },

          onFileUpdate: (files: any, accumulatedContent: any) => {
            const realFiles = Object.fromEntries(
              Object.entries(files).filter(([key]) => key !== '__streaming__' && key !== 'project-spec.json')
            );
            
            if (accumulatedContent && accumulatedContent.length > 0) {
              const fileUpdateState = safeStoreAccess(get, 'updateProgressiveFileContent');
              if (fileUpdateState && typeof fileUpdateState.updateProgressiveFileContent === 'function') {
                fileUpdateState.updateProgressiveFileContent(accumulatedContent);
              }
            }
          },

          onStreamingContentUpdate: (content: string) => {
            // 🔥 CRITICAL FIX: Update SidePane with streaming content for backend generation
            // This is called during backend streaming to update the SidePane in real-time
            if (content && content.length > 0) {
              const fileUpdateState = safeStoreAccess(get, 'updateProgressiveFileContent');
              if (fileUpdateState && typeof fileUpdateState.updateProgressiveFileContent === 'function') {
                fileUpdateState.updateProgressiveFileContent(content);
              }
            }
          },

          onCandidExtraction: async (files: any, projectName: string) => {
            const candidState = safeStoreAccess(get, 'extractCandidFromGeneration');
            if (candidState && typeof candidState.extractCandidFromGeneration === 'function') {
              return await candidState.extractCandidFromGeneration(files, projectName);
            }
            return false;
          },

          onPlatformFilesIntegration: async (projectId: string, projectNameParam: string, extractedFiles: any) => {
            const { userCanisterId, identity, principal } = safeStoreAccess(get, 'onPlatformFilesIntegration', { 
              userCanisterId: null, 
              identity: null, 
              principal: null 
            });
            
            if (userCanisterId && identity && principal) {
              const { platformProvidedFilesService } = await import('../../services/PlatformProvidedFilesService');
              await platformProvidedFilesService.addPlatformFilesToProject(
                projectNameParam,
                projectId,
                principal,
                userCanisterId,
                identity
              );
              
              const loadFilesState = safeStoreAccess(get, 'loadProjectFiles');
              if (loadFilesState && typeof loadFilesState.loadProjectFiles === 'function') {
                const refreshedFiles = await loadFilesState.loadProjectFiles(projectId);
                const allFiles = { ...refreshedFiles, ...extractedFiles };
                
                set((state: any) => {
                  state.generatedFiles = allFiles;
                  state.projectFiles[projectId] = refreshedFiles;
                  
                  Object.keys(refreshedFiles).forEach(fileName => {
                    if (!state.fileGenerationStates[fileName]) {
                      state.fileGenerationStates[fileName] = 'complete';
                    }
                    if (!state.projectFileGenerationStates[projectId]) {
                      state.projectFileGenerationStates[projectId] = {};
                    }
                    if (!state.projectFileGenerationStates[projectId][fileName]) {
                      state.projectFileGenerationStates[projectId][fileName] = 'complete';
                    }
                  });
                });
                
                const tabGroupsState = safeStoreAccess(get, 'updateTabGroups');
                if (tabGroupsState && typeof tabGroupsState.updateTabGroups === 'function') {
                  tabGroupsState.updateTabGroups();
                }
              }
            }
          },

          onSpecProgress: (specEvent: any) => {
            switch (specEvent.type) {
              case 'connected':
                messageCoordinator.updateKLoadingMessage(`Connecting to AI...`);
                break;
                
              case 'progress':
                if (specEvent.progress >= 10 && specEvent.progress < 40) {
                  messageCoordinator.updateKLoadingMessage(`Analyzing your project requirements...`);
                } else if (specEvent.progress >= 40 && specEvent.progress < 70) {
                  messageCoordinator.updateKLoadingMessage(`Understanding your project scope...`);
                } else if (specEvent.progress >= 70 && specEvent.progress < 95) {
                  messageCoordinator.updateKLoadingMessage(`Creating your project plan...`);
                } else if (specEvent.progress >= 95) {
                  messageCoordinator.updateKLoadingMessage(`Finalizing your project plan...`);
                }
                break;
                
              case 'content_delta':
                messageCoordinator.updateKLoadingMessage(`Designing your project structure...`);
                break;
                
              case 'complete':
                messageCoordinator.updateKLoadingMessage(`Project plan ready!`);
                break;
                
              case 'error':
                messageCoordinator.updateKLoadingMessage(`Reviewing project details...`);
                break;
                
              default:
                messageCoordinator.updateKLoadingMessage(`Processing your project plan...`);
                break;
            }
          }
        });

        console.log('🔥 [PROJECT GENERATION] Completed successfully with coordinator integration');
        
        if (result && result.success) {
          console.log('[PROJECT GENERATION] Creating final wrap-up message with deploy button...');
          try {
            const finalMessageId = await createFinalWrapUpMessage(activeProject, result);
            if (finalMessageId) {
              console.log('[PROJECT GENERATION] Final wrap-up message created successfully with deploy button');
            } else {
              console.warn('[PROJECT GENERATION] Final wrap-up message creation returned empty ID');
            }
          } catch (finalError) {
            console.error('[PROJECT GENERATION] Final wrap-up message creation failed:', finalError);
            
            if (debugId) {
              await captureDebugData.error(debugId, 'final_wrap_up', finalError);
            }
            
            await ensureCompletionMessageExists(
              activeProject,
              result.finalContent || 'Coordinator-enhanced project generation completed successfully!',
              result.extractedFiles || {},
              true
            );
          }
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorContent = `I encountered an issue while processing your request: ${errorMessage}

Please try rephrasing your request or contact support if the issue persists.`;
        
        // 🔥 NEW: PASSIVE debug capture - capture error
        if (debugId) {
          await captureDebugData.response(
            debugId,
            { content: errorContent },
            {},
            false,
            errorMessage
          );
          
          await captureDebugData.error(debugId, 'project_generation_exception', error);
        }
        
        // Fix: Use ensureCompletionMessageExists for error cases instead of createFinalWrapUpMessage
        await ensureCompletionMessageExists(
          activeProject,
          errorContent,
          {},
          false
        );
        
        const errorState = safeStoreAccess(get, 'completeGeneration_final_error');
        if (errorState && typeof errorState.completeGeneration === 'function') {
          errorState.completeGeneration();
        }
      } finally {
        messageCoordinator.releaseExclusiveControl(assistantMessageId);
      }
    },

    // 🔥 NEW: New file generation with full file regeneration (same logic as old UPDATE_CODE)
    handleNewFileUpdateRequest: async (activeProject: string, userMessage: ChatInterfaceMessage, input: string, enhancedContext: any) => {
      console.log('🔥 [NEW FILE UPDATE] Starting with FULL FILE REGENERATION (old UPDATE_CODE logic)');
      
      // 🔥 VALIDATION: Confirm we have priority-enhanced context
      if (enhancedContext.priorityMetadata?.priorityStructureApplied) {
        console.log('🔥 [NEW FILE UPDATE] ✅ Priority structure confirmed in context');
      } else {
        console.warn('🔥 [NEW FILE UPDATE] ⚠️ No priority structure detected in context');
      }
      
      fileDetectionPhaseManager.reset();
      
      // 🔥 CRITICAL FIX: Safe store access for resetPhaseTracking
      const storeState = safeStoreAccess(get, 'handleNewFileUpdateRequest');
      if (storeState && typeof storeState.resetPhaseTracking === 'function') {
        storeState.resetPhaseTracking();
      }
      
      messageCoordinator.setCurrentProject(activeProject);
      
      // 🔥 NEW: Use priority-enhanced prompt if available
      const transitionalMessage = enhancedContext.priorityAssembly 
        ? `Generating new files with ${enhancedContext.priorityAssembly.assemblyMetadata.totalTokens} tokens of priority-structured context...`
        : 'Generating new files...';
        
      const assistantMessageId = messageCoordinator.createAndControlGenerationMessage(activeProject, transitionalMessage);
      
      // 🔥 CRITICAL FIX: Safe store access for generation methods
      if (storeState) {
        if (typeof storeState.startGeneration === 'function') {
          storeState.startGeneration(assistantMessageId, false); // false = not project generation
        }
        if (typeof storeState.clearCandidContext === 'function') {
          storeState.clearCandidContext();
        }
      }

      // 🔥 NEW: PASSIVE debug capture - extract debug ID
      const debugId = enhancedContext?.smartContext?.debugId;

      let streamAccumulated = '';
      let extractedFiles: { [key: string]: string } = {};

      try {
        if (!claudeService) {
          const { ClaudeService } = await import('../../claudeService');
          claudeService = new ClaudeService();
        }

        const sessionMessages = storeState && typeof storeState.getCurrentSessionMessages === 'function' 
          ? storeState.getCurrentSessionMessages() 
          : [];
        const chatMessages: ChatMessage[] = [];

        // 🔥 GAP 16 FIX: Apply segmentation filtering to file update requests too!
        // Use same logic as handleRegularChatRequest to prevent intent carryover
        const allPreviousMessages = sessionMessages.slice(0, -1);
        const segments = segmentConversationByTopic(allPreviousMessages);
        
        // Find the current (most recent) segment
        const currentSegment = segments.length > 0 ? segments[segments.length - 1] : null;
        
        // Build set of messages to include (same logic as regular chat)
        const messagesToInclude: Set<string> = new Set();
        
        // Add current segment messages
        if (currentSegment) {
          for (let i = currentSegment.startIndex; i <= currentSegment.endIndex; i++) {
            messagesToInclude.add(allPreviousMessages[i].id);
          }
          console.log(`📊 [FILE UPDATE SEGMENTATION] Including current segment: ${currentSegment.topic} [${currentSegment.startIndex}-${currentSegment.endIndex}], features: [${currentSegment.features.join(', ')}]`);
        }
        
        // Add unresolved segments
        segments.forEach(segment => {
          const isResolved = segment.getIsResolved();
          if (!isResolved && segment !== currentSegment) {
            for (let i = segment.startIndex; i <= segment.endIndex; i++) {
              messagesToInclude.add(allPreviousMessages[i].id);
            }
            console.log(`📊 [FILE UPDATE SEGMENTATION] Including unresolved segment: ${segment.topic} [${segment.startIndex}-${segment.endIndex}], features: [${segment.features.join(', ')}]`);
          }
        });

        // Process messages with filtering
        allPreviousMessages.forEach((msg: ChatInterfaceMessage) => {
          if (msg.type !== 'system') {
            // 🔥 CRITICAL FIX: Read assigned priority from priorityContext
            const assignedPriority = msg.priorityContext?.priority || MessagePriority.LOW;
            const priorityReason = msg.priorityContext?.priorityReason || 'No priority context assigned';
            
            // 🔥 DEBUG: Log message status for troubleshooting scope creep
            if (msg.domainContext) {
              console.log(`📊 [FILE UPDATE CONTEXT] Message ${msg.id.substring(0, 8)}: domain=${msg.domainContext.domain}, features=[${msg.domainContext.featureContext?.join(', ') || 'none'}], resolved=${msg.domainContext.resolved}, content="${msg.content.substring(0, 50)}..."`);
            } else {
              console.log(`⚠️ [FILE UPDATE CONTEXT] Message ${msg.id.substring(0, 8)} has NO domainContext!`);
            }
            
            // 🔥 FIX: Skip resolved messages
            if (msg.domainContext?.resolved) {
              console.log(`⏭️ [FILE UPDATE] Skipping resolved message ${msg.id}: ${msg.domainContext.domain}`);
              return;
            }
            
            // 🔥 FIX: Skip messages not in relevant segments (unless HIGH/CRITICAL priority)
            if (!messagesToInclude.has(msg.id) && 
                assignedPriority !== MessagePriority.HIGH && 
                assignedPriority !== MessagePriority.CRITICAL) {
              console.log(`⏭️ [FILE UPDATE] Skipping message ${msg.id} - not in relevant segment`);
              return;
            }
            
            // 🔥 FIX: Skip LOW priority messages that are not recent
            if (assignedPriority === MessagePriority.LOW) {
              const messageAge = sessionMessages.length - sessionMessages.indexOf(msg);
              if (messageAge > 5) {
                console.log(`⏭️ [FILE UPDATE] Skipping old LOW priority message ${msg.id} (age: ${messageAge})`);
                return;
              }
            }
            
            chatMessages.push({
              role: msg.type === 'user' ? 'user' : 'assistant',
              content: msg.content,
              priority: assignedPriority,
              priorityReason: priorityReason,
              tokenWeight: assignedPriority === MessagePriority.CRITICAL ? 1.0 :
                          assignedPriority === MessagePriority.HIGH ? 0.8 :
                          assignedPriority === MessagePriority.MEDIUM ? 0.6 : 0.3
            });
          }
        });

        // 🚀 PERFORMANCE: Use cached rules with ETag/Last-Modified validation
        // This saves 1-3 seconds per message by avoiding redundant 750KB downloads
        let backendRules = '';
        let frontendRules = '';
        let vibeEnhancement = '';
        
        try {
          const { rulesCacheService } = await import('../../services/RulesCacheService');
          const rules = await rulesCacheService.fetchAllRules();
          backendRules = rules.backendRules;
          frontendRules = rules.frontendRules;
          vibeEnhancement = rules.vibeEnhancement;
        } catch (rulesError) {
          console.warn('⚠️ [NEW FILE UPDATE] Error fetching cached documents:', rulesError);
        }

        // 🔥 CRITICAL: Use FULL FILE GENERATION prompt (same as old UPDATE_CODE logic)
        // This prompts for complete file regeneration, not targeted edits
        const fullFileGenerationPrompt = `🚨🚨🚨 CRITICAL INSTRUCTION - READ FIRST BEFORE DOING ANYTHING 🚨🚨🚨

⛔ DO NOT REGENERATE THE ENTIRE APPLICATION
⛔ DO NOT MAKE SWEEPING ARCHITECTURAL CHANGES
⛔ DO NOT "IMPROVE" CODE THAT WASN'T ASKED TO BE CHANGED
⛔ DO NOT REMOVE OR SIGNIFICANTLY ALTER WORKING FEATURES
⛔ DO NOT CHANGE UNRELATED PARTS OF THE CODEBASE

🎯 SURGICAL PRECISION REQUIRED:

1. READ THE USER'S REQUEST CAREFULLY - What SPECIFIC thing did they ask for?
2. IDENTIFY THE MINIMAL FILES that need to change to satisfy that request
3. ONLY MODIFY what is EXPLICITLY requested or DIRECTLY NECESSARY
4. PRESERVE ALL EXISTING FUNCTIONALITY that is NOT mentioned in the request
5. IF IN DOUBT, DO LESS - Don't add features that weren't requested

⚠️ EXAMPLES OF WHAT NOT TO DO:

User asks: "Change the button color to blue"
❌ WRONG: Regenerate entire component, restructure state, change layout, add new features
✅ CORRECT: Change only the button's color property

User asks: "Fix the login bug"
❌ WRONG: Rewrite entire auth system, change API structure, modify database
✅ CORRECT: Fix only the specific login bug mentioned

User asks: "Add a delete button to the sidebar"
❌ WRONG: Redesign entire sidebar, change routing, modify state management
✅ CORRECT: Add only the delete button and its handler

🔥 GOLDEN RULE: HOURS OF WORK DEPEND ON YOU NOT DESTROYING THE EXISTING APP

The user has spent HOURS iterating on this code. Every line that works is precious.
DO NOT change anything unless it's explicitly requested or directly necessary for the request.

When in doubt: ASK before making broad changes. DON'T assume you should "improve" things.

---

${vibeEnhancement ? `${vibeEnhancement}\n\n---\n\n` : ''}🎯 CRITICAL USER INSTRUCTION (HIGHEST PRIORITY):
${input}

${enhancedContext.smartContext?.aiRulesContext || ''}

${backendRules ? `\n\n=== BACKEND GENERATION RULES ===\n\nThese rules MUST be followed when generating backend (Motoko) code:\n\n${backendRules}\n\n=== END BACKEND RULES ===\n` : ''}

${frontendRules ? `\n\n=== FRONTEND GENERATION RULES ===\n\nThese rules MUST be followed when generating frontend (React/TypeScript) code:\n\n${frontendRules}\n\n=== END FRONTEND RULES ===\n` : ''}

🚨🚨🚨 CRITICAL: FULL FILE GENERATION MODE 🚨🚨🚨

You are generating NEW FILES or FULL FILE REGENERATIONS. You MUST provide COMPLETE file content with file extraction markers.

**FILE EXTRACTION MARKERS (REQUIRED):**
- TypeScript/JavaScript/JSON: Use // Complete file: [PATH]
- HTML: Use <!-- Complete file: [PATH] -->
- CSS: Use /* Complete file: [PATH] */

**FILE FORMAT BY TYPE:**

TypeScript/JavaScript:
\`\`\`typescript
// Complete file: src/frontend/src/components/NewComponent.tsx
import React from 'react';
// ... complete file content ...
\`\`\`

HTML Files:
\`\`\`html
<!-- Complete file: src/frontend/index.html -->
<!DOCTYPE html>
<html>...</html>
\`\`\`

CSS Files:
\`\`\`css
/* Complete file: src/frontend/src/styles.css */
body { margin: 0; }
\`\`\`

JSON Configuration Files:
\`\`\`json
// Complete file: src/frontend/package.json
{
  "name": "my-app",
  "version": "1.0.0"
}
\`\`\`

**MANDATORY REQUIREMENTS:**
✅ Every file MUST have a code block with proper language
✅ Every file MUST have "Complete file: [FULL_PATH]" as first line inside code block
✅ Every file MUST contain COMPLETE file content (not snippets)
✅ Provide ALL imports, exports, and complete implementations
✅ Include proper file paths matching the actual project structure

**DO NOT:**
❌ Provide partial code snippets
❌ Provide incomplete code snippets
❌ Provide code without file extraction markers
❌ Generate incomplete files

Generate complete files now with proper extraction markers:`;

        chatMessages.push({
          role: 'user',
          content: fullFileGenerationPrompt,
          priority: MessagePriority.CRITICAL,
          priorityReason: "New file generation request with full file regeneration mode",
          tokenWeight: 1.0
        });

        console.log('🔥 [NEW FILE UPDATE] Starting streaming with FULL FILE GENERATION mode...');

        // 🔥 NEW: PASSIVE debug capture - capture API call
        if (debugId) {
          await captureDebugData.apiCall(debugId, chatMessages, 'claude-sonnet-4', {
            requestType: 'new_file_generation_full_regeneration',
            projectId: activeProject,
            userInput: input,
            hasPriorityAssembly: !!enhancedContext.priorityAssembly,
            totalTokens: enhancedContext.priorityAssembly?.assemblyMetadata?.totalTokens || 0,
            mode: 'full_file_regeneration'
          });
        }

        let fileDetectionActivated = false;

        await claudeService.sendStreamingChat(
          chatMessages,
          enhancedContext.comprehensiveContext,
          async (event: any) => {
            switch (event.type) {
              case 'connected':
                console.log('🔥 [NEW FILE UPDATE] Connected to streaming service');
                messageCoordinator.updateKLoadingMessage('Generating new files...');
                break;
                
              case 'content_delta':
                if (event.content) {
                  streamAccumulated += event.content;
                  
                  const extractionResult = FileExtractor.detectProgressiveFiles(streamAccumulated);
                  const { completeFiles, inProgressFiles, detectedFiles } = extractionResult;
                  
                  if (Object.keys(detectedFiles).length > 0 && !fileDetectionActivated) {
                    console.log('🔥 [NEW FILE UPDATE] Files detected in response:', {
                      detectedCount: Object.keys(detectedFiles).length,
                      completeCount: Object.keys(completeFiles).length,
                      inProgressCount: Object.keys(inProgressFiles).length
                    });
                    
                    fileDetectionPhaseManager.activateForStreaming();
                    fileDetectionActivated = true;
                    messageCoordinator.updateKLoadingMessage('Generating new files...');
                  }
                  
                  if (fileDetectionActivated && Object.keys(detectedFiles).length > 0) {
                    const fileDetectionState: { [fileName: string]: 'detected' | 'writing' | 'complete' } = {};
                    
                    Object.keys(inProgressFiles).forEach(fileName => {
                      fileDetectionState[fileName] = 'writing';
                    });
                    
                    Object.keys(completeFiles).forEach(fileName => {
                      fileDetectionState[fileName] = 'complete';
                    });
                    
                    fileDetectionPhaseManager.updateFileDetection(fileDetectionState);
                    
                    if (storeState && typeof storeState.detectAndUpdateProgressiveFiles === 'function') {
                      storeState.detectAndUpdateProgressiveFiles(streamAccumulated);
                    }
                  }
                  
                  const allCurrentFiles = { ...completeFiles, ...inProgressFiles };
                  if (Object.keys(allCurrentFiles).length > 0 && storeState && typeof storeState.onFileUpdate === 'function') {
                    storeState.onFileUpdate(allCurrentFiles, streamAccumulated);
                  }
                }
                break;

              case 'complete':
                console.log('🔥 [NEW FILE UPDATE] Completion with full file generation');
                
                const finalExtractionResult = FileExtractor.detectProgressiveFiles(streamAccumulated);
                const { completeFiles: finalCompleteFiles } = finalExtractionResult;
                const finalContent = FileExtractor.extractCleanResponse(streamAccumulated);
                
                extractedFiles = finalCompleteFiles;
                
                console.log(`🔥 [NEW FILE UPDATE] Files extracted:`, {
                  fileCount: Object.keys(extractedFiles).length,
                  fileNames: Object.keys(extractedFiles).slice(0, 5)
                });
                
                // 🔥 NEW: PASSIVE debug capture - capture response
                if (debugId) {
                  await captureDebugData.response(
                    debugId,
                    { content: finalContent },
                    extractedFiles,
                    true
                  );
                }
                
                Object.keys(extractedFiles).forEach(fileName => {
                  if (storeState && typeof storeState.markFileAsComplete === 'function') {
                    storeState.markFileAsComplete(fileName);
                  }
                });
                
                // 🔥 CRITICAL FIX: Update generated files in store so they're visible to the user
                // This ensures the file application step is visible after NEW_FILE_UPDATE completes
                if (Object.keys(extractedFiles).length > 0) {
                  console.log('🔥 [NEW FILE UPDATE] Updating generated files in store...');
                  
                  const fileOperationState = safeStoreAccess(get, 'file_operations');
                  if (fileOperationState) {
                    if (typeof fileOperationState.updateGeneratedFiles === 'function') {
                      fileOperationState.updateGeneratedFiles(extractedFiles);
                      console.log('🔥 [NEW FILE UPDATE] ✅ Generated files updated in store');
                    } else {
                      console.warn('🔥 [NEW FILE UPDATE] ⚠️ updateGeneratedFiles function not available');
                    }
                  } else {
                    console.warn('🔥 [NEW FILE UPDATE] ⚠️ fileOperationState not available');
                  }
                }
                
                // Create completion message
                if (Object.keys(extractedFiles).length > 0) {
                  console.log('🔥 [NEW FILE UPDATE] Creating completion with full file generation...');
                  
                  try {
                    fileDetectionPhaseManager.forceComplete();
                    messageCoordinator.forceCompletePureVisualState();
                    
                    // 🚀 PERFORMANCE: Removed artificial 50ms delay
                    
                    const completionMessageId = await ensureUpdateCompletionExists(
                      activeProject,
                      finalContent,
                      extractedFiles
                    );
                    
                    if (completionMessageId) {
                      console.log('🔥 [NEW FILE UPDATE] Completion created successfully:', completionMessageId);
                      
                      if (storeState && typeof storeState.completeGeneration === 'function') {
                        storeState.completeGeneration(finalContent, extractedFiles);
                        console.log('🔥 [NEW FILE UPDATE] Generation state updated');
                      }
                    }
                    
                  } catch (completionError) {
                    console.error('[NEW FILE UPDATE] Completion creation error:', completionError);
                    
                    if (debugId) {
                      await captureDebugData.error(debugId, 'completion_creation', completionError);
                    }
                    
                    await ensureCompletionMessageExists(
                      activeProject, 
                      finalContent, 
                      extractedFiles,
                      false
                    );
                  }
                  
                } else {
                  console.log('🔥 [NEW FILE UPDATE] No files extracted - creating explanation message');
                  
                  fileDetectionPhaseManager.forceComplete();
                  messageCoordinator.forceCompletePureVisualState();
                  
                  await ensureCompletionMessageExists(
                    activeProject, 
                    finalContent, 
                    {},
                    false
                  );
                }
                break;

              case 'error':
                console.log('🔥 [NEW FILE UPDATE] Error in streaming');
                
                // 🔥 NEW: PASSIVE debug capture - capture error
                if (debugId) {
                  await captureDebugData.response(
                    debugId,
                    { content: `Error: ${event.message || 'Unknown error'}` },
                    {},
                    false,
                    event.message || 'Unknown error'
                  );
                  
                  await captureDebugData.error(debugId, 'streaming_error', event.message || 'Unknown error');
                }
                
                fileDetectionPhaseManager.forceComplete();
                messageCoordinator.forceCompletePureVisualState();
                
                if (storeState && typeof storeState.completeGeneration === 'function') {
                  storeState.completeGeneration();
                }
                
                const errorContent = `I encountered an issue while generating new files: ${event.message || 'Unknown error'}

Please try rephrasing your request.`;
                
                await ensureCompletionMessageExists(
                  activeProject, 
                  errorContent, 
                  {},
                  false
                );
                break;
            }
          }
        );

      } catch (error) {
        console.log('🔥 [NEW FILE UPDATE] Exception in handler');
        
        // 🔥 NEW: PASSIVE debug capture - capture error
        if (debugId) {
          await captureDebugData.response(
            debugId,
            { content: `Exception: ${error instanceof Error ? error.message : 'Unknown error'}` },
            {},
            false,
            error instanceof Error ? error.message : 'Unknown error'
          );
          
          await captureDebugData.error(debugId, 'new_file_update_exception', error);
        }
        
        fileDetectionPhaseManager.forceComplete();
        messageCoordinator.forceCompletePureVisualState();
        
        if (storeState && typeof storeState.completeGeneration === 'function') {
          storeState.completeGeneration();
        }
        
        const errorContent = `I encountered an issue while generating new files: ${error instanceof Error ? error.message : 'Unknown error'}

Please try rephrasing your request.`;
        
        await ensureCompletionMessageExists(
          activeProject, 
          errorContent, 
          {},
          false
        );
      } finally {
        messageCoordinator.releaseExclusiveControl(assistantMessageId);
      }

      console.log('🔥 [NEW FILE UPDATE] New file generation completed with full file regeneration!');
    },

    // 🔥 SIMPLIFIED: All code updates route through full file regeneration
    handleCodeUpdateRequest: async (activeProject: string, userMessage: ChatInterfaceMessage, input: string, currentFiles: { [key: string]: string }, enhancedContext: any) => {
      console.log('🔥 [UPDATE] Routing to full file regeneration (targeted mode removed)');
      
      // Route all updates through full file regeneration
      await (get() as any).handleNewFileUpdateRequest(activeProject, userMessage, input, enhancedContext);
    },

    // 🔥 ENHANCED: Regular chat with coordinator integration
    handleRegularChatRequest: async (activeProject: string, userMessage: ChatInterfaceMessage, input: string, currentFiles: { [key: string]: string }, enhancedContext: any) => {
      console.log('🔥 [CHAT] Starting with COORDINATOR integration');
      
      // 🔥 VALIDATION: Confirm priority context
      if (enhancedContext.priorityMetadata?.hasCurrentInstruction) {
        console.log('🔥 [CHAT] ✅ Current instruction confirmed in priority context');
        
        // 🔥 VALIDATION: Verify user message has CRITICAL priority for conversational context
        if (!validatePriorityAssignment(userMessage, MessagePriority.CRITICAL)) {
          console.warn('🔥 [CHAT] ⚠️ User message priority validation failed');
        }
      }
      
      messageCoordinator.setCurrentProject(activeProject);
      
      // 🔥 NEW: Use user-friendly messaging
      const thinkingMessage = enhancedContext.priorityAssembly 
        ? 'Thinking about your request...'
        : 'Thinking...';
        
      messageCoordinator.startPureVisualState(thinkingMessage);

      // ✅ NEW: Start generation state for regular chat so stop button appears
      const storeState = safeStoreAccess(get, 'handleRegularChatRequest_start');
      if (storeState && typeof storeState.startGeneration === 'function') {
        // Use a temporary message ID for regular chat (will be replaced when assistant message is created)
        const tempMessageId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        storeState.startGeneration(tempMessageId, false); // false = not project generation
        console.log('✅ [CHAT] Started generation state for regular chat');
      }

      // 🔥 NEW: PASSIVE debug capture - extract debug ID
      const debugId = enhancedContext?.smartContext?.debugId;

      let streamAccumulated = '';

      try {
        // ✅ NEW: Use singleton instance - no need to create new one
        if (!claudeService) {
          const { claudeService: singleton } = await import('../../claudeService');
          claudeService = singleton;
        }

        const storeState = safeStoreAccess(get, 'handleRegularChatRequest');
        const sessionMessages = storeState && typeof storeState.getCurrentSessionMessages === 'function' 
          ? storeState.getCurrentSessionMessages() 
          : [];
        const chatMessages: ChatMessage[] = [];
        
        // Retrieve pending images and files from store (early, before building messages)
        const pendingImages = storeState?.pendingImages || null;
        const pendingFiles = storeState?.pendingFiles || null;
        
        const imagesForRequest = pendingImages ? pendingImages.map(img => ({
          data: img.base64Data,
          mediaType: img.mediaType
        })) : undefined;
        
        // Build file content text to append to user message
        let fileContentText = '';
        if (pendingFiles && pendingFiles.length > 0) {
          const fileContents: string[] = [];
          // Helper to format file size
          const formatFileSize = (bytes: number): string => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
          };
          
          pendingFiles.forEach(file => {
            // Determine file type for better context
            const fileName = file.name.toLowerCase();
            let fileTypeDescription = '';
            if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
              fileTypeDescription = 'PowerPoint presentation';
            } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
              fileTypeDescription = 'Word document';
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
              fileTypeDescription = 'Excel spreadsheet';
            } else if (fileName.endsWith('.pdf')) {
              fileTypeDescription = 'PDF document';
            } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
              fileTypeDescription = 'Text document';
            } else {
              fileTypeDescription = 'document';
            }
            
            if (file.textContent) {
              fileContents.push(`\n\n📎 ATTACHED FILE: ${file.name} (${fileTypeDescription})\nThe user has attached this file. Below is the extracted text content:\n\n${file.textContent}`);
            } else {
              fileContents.push(`\n\n📎 ATTACHED FILE: ${file.name} (${fileTypeDescription}, ${file.type || 'unknown type'}, ${formatFileSize(file.size)})\nThe user has attached this file, but text extraction was not available. Please acknowledge that you are aware of this attachment.`);
            }
          });
          fileContentText = fileContents.join('\n');
          console.log(`📎 [ChatActions] Including ${pendingFiles.length} file(s) in message`);
        }
        
        // Clear pending attachments after retrieving
        if (storeState?.clearPendingAttachments) {
          storeState.clearPendingAttachments();
        }

        // 🔥 ENHANCED: Use priority-ordered messages for chat context
        // 🔥 FIX 3: Segment conversation by topic and only include current segment + unresolved segments
        const allPreviousMessages = sessionMessages.slice(0, -1);
        const segments = segmentConversationByTopic(allPreviousMessages);
        
        // Find the current (most recent) segment
        const currentSegment = segments.length > 0 ? segments[segments.length - 1] : null;
        
        // Include messages from:
        // 1. Current segment (always)
        // 2. Unresolved segments from the past (for continuity)
        // 3. HIGH/CRITICAL priority messages from any segment (for important context)
        const messagesToInclude: Set<string> = new Set();
        
        // Add current segment messages
        if (currentSegment) {
          for (let i = currentSegment.startIndex; i <= currentSegment.endIndex; i++) {
            messagesToInclude.add(allPreviousMessages[i].id);
          }
          console.log(`📊 [SEGMENTATION] Including current segment: ${currentSegment.topic} [${currentSegment.startIndex}-${currentSegment.endIndex}]`);
        }
        
        // Add unresolved segments (🔥 GAP 9 FIX: check resolution dynamically)
        segments.forEach(segment => {
          const isResolved = segment.getIsResolved(); // 🔥 Dynamic check
          if (!isResolved && segment !== currentSegment) {
            for (let i = segment.startIndex; i <= segment.endIndex; i++) {
              messagesToInclude.add(allPreviousMessages[i].id);
            }
            console.log(`📊 [SEGMENTATION] Including unresolved segment: ${segment.topic} [${segment.startIndex}-${segment.endIndex}], features: [${segment.features.join(', ')}]`);
          } else if (isResolved && segment !== currentSegment) {
            console.log(`⏭️ [SEGMENTATION] Skipping resolved segment: ${segment.topic} [${segment.startIndex}-${segment.endIndex}]`);
          }
        });
        
        // Now process messages with filtering
        allPreviousMessages.forEach((msg: ChatInterfaceMessage) => {
          if (msg.type !== 'system') {
            // 🔥 CRITICAL FIX: Read assigned priority from priorityContext
            const assignedPriority = msg.priorityContext?.priority || MessagePriority.LOW;
            const priorityReason = msg.priorityContext?.priorityReason || 'No priority context assigned';
            
            // 🔥 FIX: Skip resolved messages to prevent carrying forward old issues
            if (msg.domainContext?.resolved) {
              console.log(`⏭️ [ChatActions] Skipping resolved message ${msg.id}: ${msg.domainContext.domain}`);
              return;
            }
            
            // 🔥 FIX 3: Skip messages not in relevant segments (unless HIGH/CRITICAL priority)
            if (!messagesToInclude.has(msg.id) && 
                assignedPriority !== MessagePriority.HIGH && 
                assignedPriority !== MessagePriority.CRITICAL) {
              console.log(`⏭️ [ChatActions] Skipping message ${msg.id} - not in relevant segment`);
              return;
            }
            
            // 🔥 FIX: Skip LOW priority messages that are not recent (older than 5 messages)
            if (assignedPriority === MessagePriority.LOW) {
              const messageAge = sessionMessages.length - sessionMessages.indexOf(msg);
              if (messageAge > 5) {
                console.log(`⏭️ [ChatActions] Skipping old LOW priority message ${msg.id} (age: ${messageAge})`);
                return;
              }
            }
            
            chatMessages.push({
              role: msg.type === 'user' ? 'user' : 'assistant',
              content: msg.content,
              priority: assignedPriority,
              priorityReason: priorityReason,
              tokenWeight: assignedPriority === MessagePriority.CRITICAL ? 1.0 :
                          assignedPriority === MessagePriority.HIGH ? 0.8 :
                          assignedPriority === MessagePriority.MEDIUM ? 0.6 : 0.3
            });
          }
        });

        // 🔥 NUCLEAR LEVEL INSTRUCTION: Absolutely forbid any code generation for regular chat
        const nuclearNoCodeInstruction = `🚨🚨🚨 CRITICAL SYSTEM INSTRUCTION 🚨🚨🚨

YOU ARE IN PURE CONVERSATION MODE ONLY. UNDER NO CIRCUMSTANCES SHOULD YOU:

❌ GENERATE ANY CODE WHATSOEVER
❌ CREATE ANY CODE BLOCKS (\`\`\`language)
❌ USE FILE EXTRACTION MARKERS (// Complete file:)
❌ WRITE ANY PROGRAMMING CODE
❌ CREATE FUNCTION DEFINITIONS
❌ WRITE HTML, CSS, TYPESCRIPT, JAVASCRIPT, MOTOKO, OR ANY OTHER CODE
❌ SUGGEST CODE IMPLEMENTATIONS
❌ PROVIDE CODE EXAMPLES
❌ CREATE FILE STRUCTURES

THIS IS A CONVERSATIONAL CHAT ONLY. RESPOND WITH:
✅ EXPLANATIONS AND DISCUSSION
✅ ADVICE AND GUIDANCE  
✅ CONCEPTUAL HELP
✅ PLAIN TEXT RESPONSES ONLY
✅ MARKDOWN FOR FORMATTING (NOT CODE)

IF THE USER ASKS FOR CODE, POLITELY EXPLAIN THEY NEED TO BE MORE SPECIFIC ABOUT WANTING TO UPDATE OR CREATE PROJECT FILES.

VIOLATION OF THIS INSTRUCTION WILL BREAK THE ENTIRE SYSTEM.

🎯 COORDINATOR FOCUS: This is the user's CURRENT REQUEST with CRITICAL priority managed by MessageCoordinator. Focus on this conversation above all else. Any conversation history is purely for context.

📋 DEEP FILE ANALYSIS REQUIREMENT - CRITICAL:

When the user asks questions about their application, code files, alignment between files, or any analysis of the codebase:

1. **IMMEDIATELY ANALYZE ALL PROVIDED FILES EXHAUSTIVELY** - Do not ask clarifying questions first
2. **READ AND COMPREHEND THE ENTIRE FILE CONTENT** - All files in the context are available to you
3. **PERFORM DEEP COMPARATIVE ANALYSIS** - When asked about alignment (e.g., "does main.mo support the UI?"), compare:
   - Every function/method in backend vs every function call in frontend
   - Every data type/interface definition
   - Every API endpoint vs every useActor call
   - Every feature requirement vs implementation
4. **ANSWER DIRECTLY AND COMPREHENSIVELY** - Provide a complete analysis in your first response:
   - List all matching features
   - List all gaps or misalignments
   - Provide specific percentages or alignment scores
   - Give concrete examples from the actual code
5. **DO NOT ASK CLARIFYING QUESTIONS** - If files are provided, you have everything you need. Just analyze and answer.
6. **BE EXHAUSTIVE, NOT ITERATIVE** - One comprehensive answer is better than 6-7 back-and-forth questions

Example: If user asks "do we have 100% main.mo and React app alignment?", you should:
- Immediately read main.mo completely
- Immediately read all React component files
- Compare every method, every interface, every feature
- Provide a complete alignment analysis with specific examples
- Give a definitive answer with percentage and detailed breakdown
- DO NOT ask "can you tell me what alignment issues you're seeing?" - just analyze and report

🚨🚨🚨 NO CODE GENERATION IN CONVERSATION MODE 🚨🚨🚨

User's actual coordinator-managed message: ${input}${fileContentText}`;

        chatMessages.push({
          role: 'user',
          content: nuclearNoCodeInstruction,
          priority: MessagePriority.CRITICAL,
          priorityReason: "Current user conversation with no-code enforcement and coordinator focus",
          tokenWeight: 1.0
        });

        console.log('🔥 [CHAT] Starting chat with COORDINATOR integration');

        // 🔥 NEW: Get selected model from store
        const storeStateForModel = safeStoreAccess(get, 'handleRegularChatRequest_model');
        const selectedModel = storeStateForModel?.selectedChatModel || 'claude';
        console.log(`🤖 [CHAT] Using model: ${selectedModel}`);

        // 🔥 NEW: Import and use the appropriate service based on selected model
        let chatService: any = claudeService;
        let modelName = 'claude-sonnet-4';
        
        if (selectedModel === 'gemini') {
          const { geminiService } = await import('../../geminiService');
          chatService = geminiService;
          modelName = 'gemini-1.5-pro';
        } else if (selectedModel === 'kimi') {
          const { kimiService } = await import('../../kimiService');
          chatService = kimiService;
          modelName = 'kimi-k2';
        } else if (selectedModel === 'openai') {
          const { openaiService } = await import('../../openaiService');
          chatService = openaiService;
          modelName = 'gpt-4o';
        }

        // 🔥 NEW: PASSIVE debug capture - capture API call
        if (debugId) {
          await captureDebugData.apiCall(debugId, chatMessages, modelName, {
            requestType: 'coordinator_enhanced_conversational_chat',
            projectId: activeProject,
            userInput: input,
            noCodeMode: true,
            hasPriorityAssembly: !!enhancedContext.priorityAssembly,
            totalTokens: enhancedContext.priorityAssembly?.assemblyMetadata?.totalTokens || 0,
            selectedModel: selectedModel,
            coordinatorEnhanced: {
              hasPriorityAssembly: !!enhancedContext.priorityAssembly,
              priorityPromptStructure: {
                currentInstructionSection: nuclearNoCodeInstruction.includes('CURRENT REQUEST'),
                supportingContextSection: false,
                systemContextSection: nuclearNoCodeInstruction.includes('CRITICAL SYSTEM INSTRUCTION'),
                focusInstructions: nuclearNoCodeInstruction.includes('COORDINATOR FOCUS')
              },
              assemblyMetadata: enhancedContext.priorityAssembly?.assemblyMetadata
            }
          });
        }

        await chatService.sendStreamingChat(
          chatMessages,
          enhancedContext.comprehensiveContext,
          async (event: any) => {
            switch (event.type) {
              case 'connected':
                console.log('🔥 [CHAT] Connected - coordinator integration ready');
                break;
                
              case 'content_delta':
                if (event.content) {
                  if (streamAccumulated.length === 0) {
                    messageCoordinator.transitionFromVisualToStreaming('chat-streaming');
                    
                    if (storeState && typeof storeState.setStreamingState === 'function') {
                      storeState.setStreamingState('Responding to your request...', 'chat-streaming');
                    }
                  }
                  
                  streamAccumulated += event.content;
                  
                  if (storeState && typeof storeState.updateStreamingContent === 'function') {
                    storeState.updateStreamingContent(streamAccumulated);
                  }
                }
                break;

              case 'complete':
                console.log('🔥 [CHAT] Streaming complete with coordinator integration');
                
                // 🔥 NEW: PASSIVE debug capture - capture response
                if (debugId) {
                  await captureDebugData.response(
                    debugId,
                    { content: streamAccumulated },
                    {}, // Regular chat has no extracted files
                    true
                  );
                }
                
                if (storeState && typeof storeState.clearStreamingState === 'function') {
                  storeState.clearStreamingState();
                }
                
                // ✅ NEW: Clear generation state for regular chat to re-enable submit button
                const completionState = safeStoreAccess(get, 'completeGeneration');
                if (completionState && typeof completionState.completeGeneration === 'function') {
                  completionState.completeGeneration();
                  console.log('✅ [CHAT] Cleared generation state after regular chat completion');
                }
                
                // 🔥 FIX: Clean technical jargon from regular chat responses while preserving formatting
                let finalContent = streamAccumulated
                  .replace(/coordinator[- ]?enhanced/gi, '')
                  .replace(/coordinator[- ]?integration/gi, '')
                  .replace(/coordinator[- ]?managed/gi, '')
                  .replace(/coordinator[- ]?based/gi, '')
                  .replace(/coordinator[- ]?system/gi, '')
                  .replace(/with coordinator/gi, '')
                  .replace(/coordinator/gi, '')
                  .replace(/priority[- ]?assembly/gi, '')
                  .replace(/priority[- ]?structured/gi, '')
                  .replace(/assembly/gi, '')
                  // Preserve newlines but collapse multiple spaces within lines
                  .replace(/[ \t]+/g, ' ')
                  // Preserve intentional double newlines (paragraph breaks)
                  .replace(/\n{3,}/g, '\n\n')
                  .trim();

                await ensureCompletionMessageExists(
                  activeProject, 
                  finalContent, 
                  {}, // 🚀 NUCLEAR: Explicitly empty files object for regular chat
                  false
                );
                
                messageCoordinator.completePureVisualState();
                break;
                
              case 'error':
                // ✅ NEW: Don't show error message for cancelled requests
                const errorMsg = event.message || '';
                if (errorMsg === 'Request was cancelled' || 
                    errorMsg.includes('Request was cancelled') ||
                    errorMsg.includes('Request was canceled') ||
                    errorMsg.includes('cancelled') ||
                    errorMsg.includes('Failed to send streaming chat: Request was cancelled')) {
                  console.log('🛑 [CHAT] Request was cancelled by user - clearing state');
                  
                  // ✅ NEW: Clear ALL file generation states (stop all animations)
                  const currentState = get() as any;
                  const activeProject = currentState.activeProject;
                  if (activeProject && currentState.projectFileGenerationStates?.[activeProject]) {
                    const allFileStates = currentState.projectFileGenerationStates[activeProject];
                    Object.keys(allFileStates).forEach(fileName => {
                      if (allFileStates[fileName] === 'writing' || allFileStates[fileName] === 'detected') {
                        if (storeState && typeof storeState.updateFileGenerationState === 'function') {
                          storeState.updateFileGenerationState(fileName, 'complete');
                        }
                      }
                    });
                  }
                  
                  // ✅ NEW: Clear streaming state
                  if (storeState && typeof storeState.clearStreamingState === 'function') {
                    storeState.clearStreamingState();
                  }
                  
                  // ✅ NEW: Clear UI streaming state and stop SidePane streaming
                  const uiState = safeStoreAccess(get, 'clearContentUpdateSource');
                  if (uiState) {
                    if (typeof uiState.clearContentUpdateSource === 'function') {
                      uiState.clearContentUpdateSource();
                    }
                    // Stop SidePane streaming mode
                    if (typeof uiState.setStreamingToActiveFile === 'function') {
                      uiState.setStreamingToActiveFile(false);
                    }
                  }
                  
                  // ✅ NEW: Force complete file detection
                  fileDetectionPhaseManager.forceComplete();
                  
                  // ✅ NEW: Clear generation state
                  const completionState = safeStoreAccess(get, 'completeGeneration_cancel');
                  if (completionState && typeof completionState.completeGeneration === 'function') {
                    completionState.completeGeneration();
                  }
                  
                  messageCoordinator.completePureVisualState();
                  break;
                }
                
                // 🔥 NEW: PASSIVE debug capture - capture error
                if (debugId) {
                  await captureDebugData.response(
                    debugId,
                    { content: `Error: ${event.message || 'Unknown error'}` },
                    {},
                    false,
                    event.message || 'Unknown error'
                  );
                  
                  await captureDebugData.error(debugId, 'chat_streaming_error', event.message || 'Unknown error');
                }
                
                if (storeState && typeof storeState.clearStreamingState === 'function') {
                  storeState.clearStreamingState();
                }
                
                const errorContent = `I'm having trouble responding to your CRITICAL coordinator-managed request right now: ${event.message || 'Unknown error'}

Please try asking your question again.`;

                await ensureCompletionMessageExists(
                  activeProject, 
                  errorContent, 
                  {}, // 🚀 NUCLEAR: Explicitly empty files object for errors too
                  false
                );
                
                messageCoordinator.completePureVisualState();
                break;
            }
          },
          undefined, // enabledMCPTools
          imagesForRequest // images
        );

      } catch (error) {
        // ✅ NEW: Don't show error message for cancelled requests
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (error instanceof Error && (
            errorMessage === 'Request was cancelled' || 
            errorMessage.includes('Request was cancelled') ||
            errorMessage.includes('Request was canceled') ||
            errorMessage.includes('cancelled') ||
            errorMessage.includes('Failed to send streaming chat: Request was cancelled') ||
            error.name === 'AbortError'
          )) {
          console.log('🛑 [CHAT] Request was cancelled by user - not showing error message');
          const storeState = safeStoreAccess(get, 'handleRegularChatRequest_error');
          if (storeState && typeof storeState.clearStreamingState === 'function') {
            storeState.clearStreamingState();
          }
          
          // ✅ NEW: Clear generation state
          const completionState = safeStoreAccess(get, 'completeGeneration_cancel_error');
          if (completionState && typeof completionState.completeGeneration === 'function') {
            completionState.completeGeneration();
          }
          
          messageCoordinator.completePureVisualState();
          return;
        }
        
        // 🔥 NEW: PASSIVE debug capture - capture error
        if (debugId) {
          await captureDebugData.response(
            debugId,
            { content: `Exception: ${error instanceof Error ? error.message : 'Unknown error'}` },
            {},
            false,
            error instanceof Error ? error.message : 'Unknown error'
          );
          
          await captureDebugData.error(debugId, 'chat_exception', error);
        }
        
        const storeState = safeStoreAccess(get, 'handleRegularChatRequest_error');
        if (storeState && typeof storeState.clearStreamingState === 'function') {
          storeState.clearStreamingState();
        }
        
        const errorContent = `I'm having trouble responding to your CRITICAL coordinator-managed request right now: ${error instanceof Error ? error.message : 'Unknown error'}

Please try asking your question again.`;

        await ensureCompletionMessageExists(
          activeProject, 
          errorContent, 
          {}, // 🚀 NUCLEAR: Explicitly empty files object for exceptions
          false
        );
        
        messageCoordinator.completePureVisualState();
      }
      
      console.log('🔥 [CHAT] Conversational request completed with COORDINATOR enhancement!');
    }
  };
};