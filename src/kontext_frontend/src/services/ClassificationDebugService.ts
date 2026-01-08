export interface DebugEntry {
  id: string;
  timestamp: number;
  projectId: string;
  projectName: string;
  userMessage: string;
  classification?: {
    classification: string;
    confidence: number;
    reasoning: string;
    contextSelection?: any;
    selectionReasoning?: any;
  };
  // ✅ ENHANCED: Complete message context with priority system
  messageContext?: {
    allMessages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp?: string;
      priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CONTEXT';
      priorityReason?: string;
      messageType?: string;
      tokens?: number;
      tokenWeight?: number;
      isCurrentInstruction?: boolean;
      conversationGroup?: string;
    }>;
    totalMessages: number;
    totalTokens?: number;
    contextStrategy: 'full_history' | 'recent_only' | 'priority_based';
    messageSelectionReasoning?: string;
    // 🔥 NEW: Priority system specific data
    priorityMetrics?: {
      currentInstructionId: string;
      criticalMessages: number;
      highPriorityMessages: number;
      mediumPriorityMessages: number;
      lowPriorityMessages: number;
      contextMessages: number;
      priorityDistribution: { [key: string]: number };
      totalPriorityTokens: number;
      optimizationApplied: boolean;
      truncationApplied: boolean;
    };
  };
  // ✅ ENHANCED: Project metadata (existing)
  projectMetadata?: {
    totalFiles: number;
    fileTypes: { [extension: string]: number };
    projectStructure: any;
    featureMap: any;
    relationships: any;
    lastModified: number;
    projectType?: string;
    complexity?: 'simple' | 'medium' | 'complex';
    estimatedTokens?: number;
    keyFiles?: string[];
    dependencies?: string[];
  };
  // ✅ ENHANCED: Context building with priority integration
  contextBuilding?: {
    selectedFiles: string[];
    totalAvailableFiles: number;
    selectionStrategy: string;
    fileContents?: { [fileName: string]: string };
    aiRulesContext?: string;
    documentationContext?: string;
    githubContext?: string;
    mcpContext?: string;
    fileSelectionBreakdown: {
      primaryFiles: string[];
      supportingFiles: string[];
      configFiles: string[];
      excludedFiles: string[];
      selectionCriteria: any;
    };
    contextSizeAnalysis: {
      totalFiles: number;
      totalCharacters: number;
      estimatedTokens: number;
      compressionRatio?: number;
    };
    // 🔥 NEW: Priority system context details
    priorityContextMetadata?: {
      currentInstructionTokens: number;
      supportingContextTokens: number;
      systemContextTokens: number;
      totalPriorityTokens: number;
      priorityStructureApplied: boolean;
      truncationApplied: boolean;
      optimizationApplied: boolean;
      tokenBudgetUsed: number;
      tokenBudgetLimit: number;
    };
  };
  // ✅ ENHANCED: API call with priority details
  apiCall?: {
    messages: any[];
    model: string;
    timestamp: number;
    requestPayload: any;
    headers?: any;
    tokenBudget?: number;
    actualTokenUsage?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
    // 🔥 NEW: Priority system API details
    priorityEnhanced?: {
      hasPriorityAssembly: boolean;
      priorityPromptStructure: {
        currentInstructionSection: boolean;
        supportingContextSection: boolean;
        systemContextSection: boolean;
        focusInstructions: boolean;
      };
      assemblyMetadata?: {
        totalTokens: number;
        priorityDistribution: { [key: string]: number };
        optimizationApplied: boolean;
        truncationApplied: boolean;
      };
    };
  };
  // ✅ ENHANCED: Response analysis (existing enhanced)
  response?: {
    content: any;
    extractedFiles: { [key: string]: string };
    success: boolean;
    error?: string;
    responseAnalysis: {
      contentLength: number;
      fileCount: number;
      codeBlockCount: number;
      hasValidFileMarkers: boolean;
      responseType: 'code_generation' | 'explanation' | 'error' | 'mixed';
      qualityMetrics?: {
        completeness: number;
        relevance: number;
        accuracy: number;
        // 🔥 NEW: Priority system quality metrics
        priorityAlignment?: number; // How well response addresses current instruction
        contextUtilization?: number; // How well supporting context was used
        focusConsistency?: number; // Whether response stayed focused on current instruction
      };
    };
  };
  // ✅ ENHANCED: System state (existing)
  systemState?: {
    activeProject: string;
    selectedFiles: string[];
    activeFile?: string;
    sidebarOpen: boolean;
    currentTab: string;
    messageCount: number;
    generationActive: boolean;
    streamingActive: boolean;
    coordinatorState?: any;
    // 🔥 NEW: Priority system state
    prioritySystemState?: {
      currentInstructionId: string | null;
      totalPriorityAssignments: number;
      activeConversationGroups: number;
      priorityOrderingLength: number;
    };
  };
  duration?: number;
  errors?: Array<{
    phase: string;
    error: string;
    timestamp: number;
    stack?: string;
  }>;
  // 🔥 NEW: Priority system specific metrics - FULLY IMPLEMENTED
  priorityAnalytics?: {
    priorityEffectiveness: number; // 0-100 score
    contextReduction: number; // percentage of context reduced by priority system
    focusImprovement: number; // how much better focus was achieved
    tokenOptimization: number; // tokens saved through priority optimization
    userInstructionClarity: number; // how clear the current instruction was
  };
  // 🔥 SIMPLIFIED: Just track simple coordinator events
  coordinatorEvents?: Array<{
    eventType: string;
    timestamp: number;
    messageId?: string;
    projectId?: string;
    priority?: string;
    currentInstructionId?: string;
    eventData?: any;
  }>;
  // 🔥 NEW: JSON Targeted Mode data
  jsonTargetedMode?: {
    enabled: boolean;
    parsingResults: {
      complete: boolean;
      partialJsonDetected: boolean;
      totalEditsDetected: number;
      totalEditsConverted: number;
      conversionErrors: number;
      fallbackToOldParser: boolean;
      parsingErrors: string[];
      rawJsonResponse?: string | null; // 🔥 NEW: Complete JSON response for debugging
    };
    editOperations: Array<{
      filePath: string;
      targetType: string;
      targetName: string;
      description: string;
      oldCodeLength: number;
      newCodeLength: number;
      status: 'detected' | 'complete' | 'applied' | 'error';
    }>;
    streamingMetrics: {
      firstEditDetectedAt: number | null;
      lastEditDetectedAt: number | null;
      totalStreamingTime: number;
      jsonCompleteAt: number | null;
    };
  };
}

export interface ProjectDebugSummary {
  projectId: string;
  projectName: string;
  totalEntries: number;
  totalClassifications: number;
  lastActivity: number;
  classifications: {
    [classification: string]: number;
  };
  distributionByType: {
    [type: string]: number;
  };
  averageConfidence: number;
  averageDuration: number;
  successRate: number;
  fileRecommendationAccuracy: number;
  architectureHealth: {
    messageContextConsistency: number;
    fileSelectionAccuracy: number;
    responseRelevance: number;
    errorFrequency: number;
    performanceConsistency: number;
    // 🔥 NEW: Priority system health metrics
    prioritySystemHealth: number;
    currentInstructionFocus: number;
    contextOptimizationEffectiveness: number;
  };
  detectedIssues: Array<{
    type: 'context_too_large' | 'missing_files' | 'classification_mismatch' | 'response_incomplete' | 'performance_degradation' | 'priority_system_failure' | 'focus_drift' | 'context_overload';
    frequency: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  // 🔥 NEW: Priority system performance summary
  prioritySystemMetrics?: {
    averagePriorityEffectiveness: number;
    averageContextReduction: number;
    averageFocusImprovement: number;
    averageTokenOptimization: number;
    priorityStructureUsage: number;
    totalPriorityOptimizations: number;
  };
}

class ClassificationDebugService {
  private static instance: ClassificationDebugService;
  private debugEntries: Map<string, DebugEntry> = new Map();
  private projectEntries: Map<string, string[]> = new Map();
  private maxEntries = 1000;
  
  static getInstance(): ClassificationDebugService {
    if (!ClassificationDebugService.instance) {
      ClassificationDebugService.instance = new ClassificationDebugService();
    }
    return ClassificationDebugService.instance;
  }

  constructor() {
    console.log('🔍 [ClassificationDebug] Initialized - COMPLETE IMPLEMENTATION WITH FULL DATA STRUCTURES');
  }

  // 🔥 COMPLETE: Start debug capture with comprehensive data structure initialization
  startDebugCapture(projectId: string, projectName: string, userMessage: string): string {
    const debugId = `debug_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const entry: DebugEntry = {
      id: debugId,
      timestamp: Date.now(),
      projectId,
      projectName,
      userMessage,
      errors: [],
      coordinatorEvents: [],
      // 🔥 COMPLETE: Initialize all data structures with default values to ensure modal tabs work
      messageContext: {
        allMessages: [],
        totalMessages: 0,
        totalTokens: 0,
        contextStrategy: 'priority_based',
        messageSelectionReasoning: 'Initial capture - no messages processed yet',
        priorityMetrics: {
          currentInstructionId: '',
          criticalMessages: 0,
          highPriorityMessages: 0,
          mediumPriorityMessages: 0,
          lowPriorityMessages: 0,
          contextMessages: 0,
          priorityDistribution: {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0,
            CONTEXT: 0
          },
          totalPriorityTokens: 0,
          optimizationApplied: false,
          truncationApplied: false
        }
      },
      projectMetadata: {
        totalFiles: 0,
        fileTypes: {},
        projectStructure: {},
        featureMap: {},
        relationships: {},
        lastModified: Date.now(),
        projectType: 'unknown',
        complexity: 'medium',
        estimatedTokens: 0,
        keyFiles: [],
        dependencies: []
      },
      contextBuilding: {
        selectedFiles: [],
        totalAvailableFiles: 0,
        selectionStrategy: 'pending',
        fileContents: {},
        aiRulesContext: '',
        documentationContext: '',
        githubContext: '',
        mcpContext: '',
        fileSelectionBreakdown: {
          primaryFiles: [],
          supportingFiles: [],
          configFiles: [],
          excludedFiles: [],
          selectionCriteria: {}
        },
        contextSizeAnalysis: {
          totalFiles: 0,
          totalCharacters: 0,
          estimatedTokens: 0,
          compressionRatio: 0
        },
        priorityContextMetadata: {
          currentInstructionTokens: 0,
          supportingContextTokens: 0,
          systemContextTokens: 0,
          totalPriorityTokens: 0,
          priorityStructureApplied: false,
          truncationApplied: false,
          optimizationApplied: false,
          tokenBudgetUsed: 0,
          tokenBudgetLimit: 200000
        }
      },
      apiCall: {
        messages: [],
        model: 'pending',
        timestamp: Date.now(),
        requestPayload: {},
        tokenBudget: 0,
        actualTokenUsage: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0
        },
        priorityEnhanced: {
          hasPriorityAssembly: false,
          priorityPromptStructure: {
            currentInstructionSection: false,
            supportingContextSection: false,
            systemContextSection: false,
            focusInstructions: false
          },
          assemblyMetadata: {
            totalTokens: 0,
            priorityDistribution: {
              CRITICAL: 0,
              HIGH: 0,
              MEDIUM: 0,
              LOW: 0,
              CONTEXT: 0
            },
            optimizationApplied: false,
            truncationApplied: false
          }
        }
      },
      response: {
        content: '',
        extractedFiles: {},
        success: false,
        responseAnalysis: {
          contentLength: 0,
          fileCount: 0,
          codeBlockCount: 0,
          hasValidFileMarkers: false,
          responseType: 'explanation',
          qualityMetrics: {
            completeness: 0,
            relevance: 0,
            accuracy: 0,
            priorityAlignment: 0,
            contextUtilization: 0,
            focusConsistency: 0
          }
        }
      },
      systemState: {
        activeProject: projectId,
        selectedFiles: [],
        activeFile: '',
        sidebarOpen: false,
        currentTab: 'chat',
        messageCount: 0,
        generationActive: false,
        streamingActive: false,
        coordinatorState: null,
        prioritySystemState: {
          currentInstructionId: null,
          totalPriorityAssignments: 0,
          activeConversationGroups: 0,
          priorityOrderingLength: 0
        }
      },
      // 🔥 COMPLETE: Initialize priority analytics with calculated defaults
      priorityAnalytics: {
        priorityEffectiveness: 50, // Neutral starting point
        contextReduction: 0, // No reduction yet
        focusImprovement: 0, // No improvement measured yet
        tokenOptimization: 0, // No optimization yet
        userInstructionClarity: this.analyzeUserInstructionClarity(userMessage)
      },
      // 🔥 NEW: Initialize JSON targeted mode data
      jsonTargetedMode: {
        enabled: false,
        parsingResults: {
          complete: false,
          partialJsonDetected: false,
          totalEditsDetected: 0,
          totalEditsConverted: 0,
          conversionErrors: 0,
          fallbackToOldParser: false,
          parsingErrors: []
        },
        editOperations: [],
        streamingMetrics: {
          firstEditDetectedAt: null,
          lastEditDetectedAt: null,
          totalStreamingTime: 0,
          jsonCompleteAt: null
        }
      }
    };
    
    this.debugEntries.set(debugId, entry);
    
    if (!this.projectEntries.has(projectId)) {
      this.projectEntries.set(projectId, []);
    }
    this.projectEntries.get(projectId)!.push(debugId);
    
    this.cleanupOldEntries();
    
    console.log(`🔍 [ClassificationDebug] Started COMPLETE capture with full data structures: ${debugId}`);
    return debugId;
  }

  // 🔥 COMPLETE: Enhanced system state capture with comprehensive data
  captureSystemState(debugId: string, systemState: any): void {
    const entry = this.debugEntries.get(debugId);
    if (!entry) {
      console.warn(`⚠️ [ClassificationDebug] Entry not found: ${debugId}`);
      return;
    }

    // 🔥 COMPLETE: Merge with existing systemState while preserving structure
    entry.systemState = {
      ...entry.systemState!,
      activeProject: systemState.activeProject || entry.systemState!.activeProject,
      selectedFiles: systemState.selectedFiles || [],
      activeFile: systemState.activeFile || '',
      sidebarOpen: systemState.sidebarOpen || false,
      currentTab: systemState.currentTab || 'chat',
      messageCount: systemState.messageCount || 0,
      generationActive: systemState.generationActive || false,
      streamingActive: systemState.streamingActive || false,
      coordinatorState: systemState.coordinatorState || null,
      prioritySystemState: {
        currentInstructionId: systemState.currentInstructionId || null,
        totalPriorityAssignments: systemState.totalPriorityAssignments || 0,
        activeConversationGroups: systemState.activeConversationGroups || 0,
        priorityOrderingLength: systemState.priorityOrderingLength || 0
      }
    };
    
    // 🔥 COMPLETE: Update priority analytics based on system state
    this.updatePriorityAnalytics(entry, 'system_state_captured');
    
    console.log(`🖥️ [ClassificationDebug] Captured COMPLETE system state: ${debugId}`);
  }

  // 🔥 COMPLETE: Enhanced message context capture with full priority analysis
  captureMessageContext(debugId: string, messageContext: any): void {
    const entry = this.debugEntries.get(debugId);
    if (!entry) {
      console.warn(`⚠️ [ClassificationDebug] Entry not found: ${debugId}`);
      return;
    }

    const allMessages = messageContext.messages || [];
    const totalTokens = allMessages.reduce((sum: number, msg: any) => sum + (msg.tokens || 0), 0);
    
    // 🔥 COMPLETE: Full priority metrics calculation with comprehensive analysis
    const priorityMetrics = this.calculateCompletePriorityMetrics(allMessages, entry.userMessage);
    
    // 🔥 COMPLETE: Enhanced message processing with type analysis
    const processedMessages = allMessages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp || new Date().toISOString(),
      priority: msg.priority || this.determinePriorityFromContent(msg.content, msg.role, entry.userMessage),
      priorityReason: msg.priorityReason || this.generatePriorityReason(msg, allMessages),
      messageType: msg.messageType || this.determineMessageTypeFromContent(msg),
      tokens: msg.tokens || this.estimateTokensFromContent(msg.content),
      tokenWeight: msg.tokenWeight || this.calculateTokenWeightFromPriority(msg.priority || 'MEDIUM'),
      isCurrentInstruction: msg.isCurrentInstruction || this.isCurrentInstructionMessage(msg, entry.userMessage),
      conversationGroup: msg.conversationGroup || null
    }));

    entry.messageContext = {
      allMessages: processedMessages,
      totalMessages: allMessages.length,
      totalTokens: totalTokens,
      contextStrategy: messageContext.strategy || this.determineContextStrategy(allMessages.length, totalTokens),
      messageSelectionReasoning: messageContext.reasoning || this.generateMessageSelectionReasoning(processedMessages),
      priorityMetrics
    };
    
    // 🔥 COMPLETE: Update priority analytics based on message analysis
    this.updatePriorityAnalytics(entry, 'message_context_captured');
    
    console.log(`💬 [ClassificationDebug] Captured COMPLETE message context: ${debugId}`, {
      totalMessages: entry.messageContext.totalMessages,
      totalTokens: entry.messageContext.totalTokens,
      priorityMetrics: priorityMetrics
    });
  }

  // 🔥 COMPLETE: Full priority metrics calculation with detailed analysis
  private calculateCompletePriorityMetrics(messages: any[], userMessage: string): any {
    const distribution = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      CONTEXT: 0
    };
    
    let currentInstructionId = '';
    let totalPriorityTokens = 0;
    let optimizationApplied = false;
    let truncationApplied = false;
    
    messages.forEach((msg, index) => {
      const priority = msg.priority || this.determinePriorityFromContent(msg.content, msg.role, userMessage);
      if (distribution.hasOwnProperty(priority)) {
        distribution[priority as keyof typeof distribution]++;
      }
      
      const tokens = msg.tokens || this.estimateTokensFromContent(msg.content);
      totalPriorityTokens += tokens;
      
      // 🔥 COMPLETE: Detect current instruction with multiple strategies
      if (msg.isCurrentInstruction || this.isCurrentInstructionMessage(msg, userMessage)) {
        currentInstructionId = `msg_${index}_${msg.role}`;
      }
      
      // 🔥 COMPLETE: Detect optimization and truncation
      if (msg.optimized || tokens > 1000) {
        optimizationApplied = true;
      }
      if (msg.truncated || msg.content.endsWith('...')) {
        truncationApplied = true;
      }
    });
    
    return {
      currentInstructionId,
      criticalMessages: distribution.CRITICAL,
      highPriorityMessages: distribution.HIGH,
      mediumPriorityMessages: distribution.MEDIUM,
      lowPriorityMessages: distribution.LOW,
      contextMessages: distribution.CONTEXT,
      priorityDistribution: distribution,
      totalPriorityTokens,
      optimizationApplied,
      truncationApplied
    };
  }

  // 🔥 COMPLETE: Enhanced classification capture with full metadata processing
  captureClassification(debugId: string, classificationResult: any, projectMetadata?: any): void {
    const entry = this.debugEntries.get(debugId);
    if (!entry) {
      console.warn(`⚠️ [ClassificationDebug] Entry not found: ${debugId}`);
      return;
    }

    entry.classification = {
      classification: classificationResult.classification || classificationResult.intent,
      confidence: classificationResult.confidence,
      reasoning: classificationResult.reasoning,
      contextSelection: classificationResult.contextSelection,
      selectionReasoning: classificationResult.selectionReasoning
    };
    
    // 🔥 COMPLETE: Enhanced project metadata with comprehensive analysis
    if (projectMetadata) {
      entry.projectMetadata = {
        totalFiles: projectMetadata.totalFiles || 0,
        fileTypes: projectMetadata.fileTypes || {},
        projectStructure: projectMetadata.projectStructure || {},
        featureMap: projectMetadata.featureMap || {},
        relationships: projectMetadata.relationships || {},
        lastModified: projectMetadata.lastModified || Date.now(),
        projectType: projectMetadata.projectType || this.inferProjectType(projectMetadata),
        complexity: projectMetadata.complexity || this.calculateProjectComplexity(projectMetadata),
        estimatedTokens: projectMetadata.estimatedTokens || this.estimateProjectTokens(projectMetadata),
        keyFiles: projectMetadata.keyFiles || this.identifyKeyFiles(projectMetadata),
        dependencies: projectMetadata.dependencies || this.extractDependencies(projectMetadata)
      };
    } else {
      // 🔥 COMPLETE: Generate metadata from classification if not provided
      entry.projectMetadata = {
        ...entry.projectMetadata!,
        projectType: this.inferProjectTypeFromClassification(entry.classification),
        complexity: this.inferComplexityFromClassification(entry.classification),
        estimatedTokens: this.estimateTokensFromUserMessage(entry.userMessage)
      };
    }
    
    // 🔥 COMPLETE: Update priority analytics based on classification
    this.updatePriorityAnalytics(entry, 'classification_captured');
    
    console.log(`📊 [ClassificationDebug] Captured COMPLETE classification: ${debugId}`, {
      classification: entry.classification.classification,
      confidence: entry.classification.confidence,
      projectType: entry.projectMetadata.projectType,
      complexity: entry.projectMetadata.complexity
    });
  }

  // 🔥 COMPLETE: Enhanced context building capture with comprehensive analysis
  captureContextBuilding(debugId: string, context: any, selectedFiles: string[]): void {
    const entry = this.debugEntries.get(debugId);
    if (!entry) {
      console.warn(`⚠️ [ClassificationDebug] Entry not found: ${debugId}`);
      return;
    }

    const totalFiles = context.fileContents ? Object.keys(context.fileContents).length : 0;
    const totalCharacters = Object.values(context.fileContents || {})
      .reduce((sum: number, content: any) => sum + (typeof content === 'string' ? content.length : 0), 0);
    
    // 🔥 COMPLETE: Enhanced file selection breakdown with detailed analysis
    const fileSelectionBreakdown = {
      primaryFiles: context.primaryFiles || this.identifyPrimaryFiles(context.fileContents, entry.userMessage),
      supportingFiles: context.supportingFiles || this.identifySupportingFiles(context.fileContents, entry.userMessage),
      configFiles: context.configFiles || this.identifyConfigFiles(context.fileContents),
      excludedFiles: context.excludedFiles || this.identifyExcludedFiles(context, selectedFiles),
      selectionCriteria: context.selectionCriteria || this.generateSelectionCriteria(context, entry)
    };
    
    // 🔥 COMPLETE: Comprehensive context size analysis
    const contextSizeAnalysis = {
      totalFiles: totalFiles,
      totalCharacters: totalCharacters,
      estimatedTokens: this.estimateTokensFromContent(totalCharacters.toString()),
      compressionRatio: totalFiles > 0 ? totalCharacters / totalFiles : 0
    };
    
    // 🔥 COMPLETE: Full priority context metadata with detailed calculations
    const priorityContextMetadata = {
      currentInstructionTokens: this.calculateCurrentInstructionTokens(entry),
      supportingContextTokens: this.calculateSupportingContextTokens(context, entry),
      systemContextTokens: this.calculateSystemContextTokens(context),
      totalPriorityTokens: contextSizeAnalysis.estimatedTokens,
      priorityStructureApplied: this.detectPriorityStructure(context, entry),
      truncationApplied: this.detectTruncationInContext(context),
      optimizationApplied: this.detectOptimizationInContext(context, entry),
      tokenBudgetUsed: contextSizeAnalysis.estimatedTokens,
      tokenBudgetLimit: context.tokenBudgetLimit || 200000
    };

    entry.contextBuilding = {
      selectedFiles,
      totalAvailableFiles: context.totalAvailableFiles || totalFiles,
      selectionStrategy: this.determineSelectionStrategy(selectedFiles.length, totalFiles, context),
      fileContents: context.fileContents,
      aiRulesContext: context.aiRulesContext || '',
      documentationContext: context.documentationContext || '',
      githubContext: context.githubContext || '',
      mcpContext: context.mcpContext || '',
      fileSelectionBreakdown,
      contextSizeAnalysis,
      priorityContextMetadata
    };
    
    // 🔥 COMPLETE: Update priority analytics based on context building
    this.updatePriorityAnalytics(entry, 'context_building_captured');
    
    console.log(`🏗️ [ClassificationDebug] Captured COMPLETE context building: ${debugId}`, {
      selectedFiles: selectedFiles.length,
      totalFiles,
      totalCharacters,
      estimatedTokens: contextSizeAnalysis.estimatedTokens,
      priorityStructure: priorityContextMetadata.priorityStructureApplied
    });
  }

  // 🔥 COMPLETE: Enhanced API call capture with full priority assembly data
  captureApiCall(debugId: string, messages: any[], model: string, requestPayload?: any): void {
    const entry = this.debugEntries.get(debugId);
    if (!entry) {
      console.warn(`⚠️ [ClassificationDebug] Entry not found: ${debugId}`);
      return;
    }

    // 🔥 COMPLETE: Detailed priority prompt structure analysis
    const priorityPromptStructure = {
      currentInstructionSection: this.detectCurrentInstructionSection(messages),
      supportingContextSection: this.detectSupportingContextSection(messages),
      systemContextSection: this.detectSystemContextSection(messages),
      focusInstructions: this.detectFocusInstructions(messages)
    };
    
    // 🔥 COMPLETE: Enhanced assembly metadata with comprehensive data
    const assemblyMetadata = {
      totalTokens: this.calculateTotalTokensFromMessages(messages),
      priorityDistribution: this.calculatePriorityDistributionFromMessages(messages),
      optimizationApplied: this.detectOptimizationInMessages(messages),
      truncationApplied: this.detectTruncationInMessages(messages)
    };

    entry.apiCall = {
      messages,
      model,
      timestamp: Date.now(),
      requestPayload: requestPayload || {},
      tokenBudget: requestPayload?.tokenBudget || this.estimateTokenBudget(messages),
      actualTokenUsage: {
        input_tokens: this.calculateInputTokens(messages),
        output_tokens: 0, // Will be updated in response
        total_tokens: this.calculateInputTokens(messages)
      },
      priorityEnhanced: {
        hasPriorityAssembly: this.detectPriorityAssembly(requestPayload, messages),
        priorityPromptStructure,
        assemblyMetadata
      }
    };
    
    // 🔥 COMPLETE: Update priority analytics based on API call
    this.updatePriorityAnalytics(entry, 'api_call_captured');
    
    console.log(`📡 [ClassificationDebug] Captured COMPLETE API call: ${debugId}`, { 
      model,
      messageCount: messages.length,
      totalTokens: assemblyMetadata.totalTokens,
      hasPriorityAssembly: entry.apiCall.priorityEnhanced.hasPriorityAssembly
    });
  }

  // 🔥 COMPLETE: Enhanced response capture with comprehensive quality analysis
  captureResponse(debugId: string, response: any, extractedFiles: { [key: string]: string }, success: boolean, error?: string): void {
    const entry = this.debugEntries.get(debugId);
    if (!entry) {
      console.warn(`⚠️ [ClassificationDebug] Entry not found: ${debugId}`);
      return;
    }

    const contentString = typeof response === 'string' ? response : 
                          response?.content || JSON.stringify(response);
    const backtickMatches = contentString.match(/```[\s\S]*?```/g);
    const codeBlockCount = backtickMatches ? backtickMatches.length : 0;
    
    // 🔥 COMPLETE: Comprehensive quality metrics calculation
    const qualityMetrics = {
      completeness: this.calculateCompletenessScore(contentString, extractedFiles, entry),
      relevance: this.calculateRelevanceScore(contentString, entry.userMessage),
      accuracy: this.calculateAccuracyScore(success, contentString, entry),
      priorityAlignment: this.calculatePriorityAlignment(contentString, entry),
      contextUtilization: this.calculateContextUtilization(contentString, entry),
      focusConsistency: this.calculateFocusConsistency(contentString, entry)
    };

    entry.response = {
      content: response,
      extractedFiles: extractedFiles || {},
      success,
      error,
      responseAnalysis: {
        contentLength: contentString.length,
        fileCount: Object.keys(extractedFiles || {}).length,
        codeBlockCount,
        hasValidFileMarkers: this.detectValidFileMarkers(contentString),
        responseType: this.determineResponseType(contentString, extractedFiles, success),
        qualityMetrics
      }
    };

    // 🔥 COMPLETE: Update API call with output tokens if available
    if (entry.apiCall) {
      const outputTokens = this.estimateTokensFromContent(contentString);
      entry.apiCall.actualTokenUsage = {
        ...entry.apiCall.actualTokenUsage!,
        output_tokens: outputTokens,
        total_tokens: entry.apiCall.actualTokenUsage!.input_tokens + outputTokens
      };
    }

    // Calculate final duration
    if (entry.timestamp) {
      entry.duration = Date.now() - entry.timestamp;
    }
    
    // 🔥 COMPLETE: Final priority analytics calculation with all data
    this.calculateFinalPriorityAnalytics(entry);
    
    console.log(`📥 [ClassificationDebug] Captured COMPLETE response: ${debugId}`, {
      success,
      contentLength: entry.response.responseAnalysis.contentLength,
      fileCount: entry.response.responseAnalysis.fileCount,
      responseType: entry.response.responseAnalysis.responseType,
      qualityMetrics,
      finalAnalytics: entry.priorityAnalytics
    });
  }

  // 🔥 COMPLETE: Enhanced error capture with detailed analysis
  captureError(debugId: string, phase: string, error: any): void {
    const entry = this.debugEntries.get(debugId);
    if (!entry) {
      console.warn(`⚠️ [ClassificationDebug] Entry not found: ${debugId}`);
      return;
    }

    if (!entry.errors) {
      entry.errors = [];
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    entry.errors.push({
      phase,
      error: errorMessage,
      timestamp: Date.now(),
      stack: errorStack
    });
    
    // 🔥 COMPLETE: Update priority analytics to reflect error impact
    this.updatePriorityAnalytics(entry, 'error_captured', { phase, error: errorMessage });
    
    console.log(`❌ [ClassificationDebug] Captured COMPLETE error: ${debugId}`, { phase, error: errorMessage });
  }

  // 🔥 NEW: Capture JSON targeted mode data
  captureJsonTargetedMode(debugId: string, jsonTargetedData: any): void {
    const entry = this.debugEntries.get(debugId);
    if (!entry) {
      console.warn(`⚠️ [ClassificationDebug] Entry not found: ${debugId}`);
      return;
    }

    if (!entry.jsonTargetedMode) {
      entry.jsonTargetedMode = {
        enabled: false,
        parsingResults: {
          complete: false,
          partialJsonDetected: false,
          totalEditsDetected: 0,
          totalEditsConverted: 0,
          conversionErrors: 0,
          fallbackToOldParser: false,
          parsingErrors: []
        },
        editOperations: [],
        streamingMetrics: {
          firstEditDetectedAt: null,
          lastEditDetectedAt: null,
          totalStreamingTime: 0,
          jsonCompleteAt: null
        }
      };
    }

    // Merge the provided data
    entry.jsonTargetedMode = {
      ...entry.jsonTargetedMode,
      ...jsonTargetedData,
      parsingResults: {
        ...entry.jsonTargetedMode.parsingResults,
        ...(jsonTargetedData.parsingResults || {})
      },
      streamingMetrics: {
        ...entry.jsonTargetedMode.streamingMetrics,
        ...(jsonTargetedData.streamingMetrics || {})
      },
      editOperations: jsonTargetedData.editOperations || entry.jsonTargetedMode.editOperations
    };

    console.log(`📝 [ClassificationDebug] Captured JSON targeted mode data: ${debugId}`, {
      enabled: entry.jsonTargetedMode.enabled,
      totalEdits: entry.jsonTargetedMode.parsingResults.totalEditsDetected,
      complete: entry.jsonTargetedMode.parsingResults.complete
    });
  }

  // 🔥 COMPLETE: Priority analytics calculation and updates
  private updatePriorityAnalytics(entry: DebugEntry, phase: string, additionalData?: any): void {
    if (!entry.priorityAnalytics) {
      entry.priorityAnalytics = {
        priorityEffectiveness: 50,
        contextReduction: 0,
        focusImprovement: 0,
        tokenOptimization: 0,
        userInstructionClarity: this.analyzeUserInstructionClarity(entry.userMessage)
      };
    }
    
    switch (phase) {
      case 'system_state_captured':
        entry.priorityAnalytics.priorityEffectiveness += this.calculateSystemStateEffectiveness(entry);
        break;
      case 'message_context_captured':
        entry.priorityAnalytics.contextReduction = this.calculateContextReduction(entry);
        entry.priorityAnalytics.focusImprovement = this.calculateFocusImprovement(entry);
        break;
      case 'context_building_captured':
        entry.priorityAnalytics.tokenOptimization = this.calculateTokenOptimization(entry);
        break;
      case 'error_captured':
        entry.priorityAnalytics.priorityEffectiveness -= 10; // Errors reduce effectiveness
        break;
    }
    
    // Ensure values stay within bounds
    entry.priorityAnalytics.priorityEffectiveness = Math.max(0, Math.min(100, entry.priorityAnalytics.priorityEffectiveness));
    entry.priorityAnalytics.contextReduction = Math.max(0, Math.min(100, entry.priorityAnalytics.contextReduction));
    entry.priorityAnalytics.focusImprovement = Math.max(0, Math.min(100, entry.priorityAnalytics.focusImprovement));
    entry.priorityAnalytics.tokenOptimization = Math.max(0, entry.priorityAnalytics.tokenOptimization);
    entry.priorityAnalytics.userInstructionClarity = Math.max(0, Math.min(100, entry.priorityAnalytics.userInstructionClarity));
  }

  // 🔥 COMPLETE: Final priority analytics calculation with comprehensive data
  private calculateFinalPriorityAnalytics(entry: DebugEntry): void {
    if (!entry.priorityAnalytics) {
      entry.priorityAnalytics = {
        priorityEffectiveness: 0,
        contextReduction: 0,
        focusImprovement: 0,
        tokenOptimization: 0,
        userInstructionClarity: 0
      };
    }
    
    // 🔥 COMPLETE: Calculate final effectiveness based on all available data
    let effectiveness = entry.priorityAnalytics.userInstructionClarity;
    
    // Quality metrics impact
    if (entry.response?.responseAnalysis?.qualityMetrics) {
      const qm = entry.response.responseAnalysis.qualityMetrics;
      effectiveness = (effectiveness + 
        (qm.priorityAlignment || 0) + 
        (qm.contextUtilization || 0) + 
        (qm.focusConsistency || 0)) / 4;
    }
    
    // Success/error impact
    if (entry.response?.success === false) {
      effectiveness *= 0.5; // Halve effectiveness for failed responses
    }
    
    if (entry.errors && entry.errors.length > 0) {
      effectiveness -= (entry.errors.length * 5); // Reduce by 5 points per error
    }
    
    // Priority system utilization impact
    if (entry.messageContext?.priorityMetrics?.optimizationApplied) {
      effectiveness += 10;
    }
    
    if (entry.contextBuilding?.priorityContextMetadata?.priorityStructureApplied) {
      effectiveness += 15;
    }
    
    // 🔥 COMPLETE: Calculate context reduction
    const originalTokens = entry.contextBuilding?.contextSizeAnalysis?.estimatedTokens || 0;
    const optimizedTokens = entry.contextBuilding?.priorityContextMetadata?.tokenBudgetUsed || originalTokens;
    const contextReduction = originalTokens > 0 ? ((originalTokens - optimizedTokens) / originalTokens) * 100 : 0;
    
    // 🔥 COMPLETE: Calculate focus improvement based on current instruction handling
    const focusImprovement = this.calculateFinalFocusImprovement(entry);
    
    // 🔥 COMPLETE: Calculate token optimization
    const tokenOptimization = Math.max(0, originalTokens - optimizedTokens);
    
    entry.priorityAnalytics = {
      priorityEffectiveness: Math.max(0, Math.min(100, effectiveness)),
      contextReduction: Math.max(0, Math.min(100, contextReduction)),
      focusImprovement: Math.max(0, Math.min(100, focusImprovement)),
      tokenOptimization,
      userInstructionClarity: entry.priorityAnalytics.userInstructionClarity
    };
    
    console.log(`📈 [ClassificationDebug] Calculated FINAL priority analytics: ${entry.id}`, entry.priorityAnalytics);
  }

  // 🔥 COMPLETE: Helper methods for comprehensive analysis
  private analyzeUserInstructionClarity(userMessage: string): number {
    let clarity = 50; // Base score
    
    // Length factor
    if (userMessage.length > 20 && userMessage.length < 200) clarity += 10;
    if (userMessage.length >= 200 && userMessage.length < 500) clarity += 5;
    if (userMessage.length > 500) clarity -= 10;
    
    // Specificity indicators
    const specificityIndicators = ['create', 'update', 'fix', 'add', 'remove', 'modify', 'build', 'generate'];
    const hasSpecificity = specificityIndicators.some(indicator => 
      userMessage.toLowerCase().includes(indicator));
    if (hasSpecificity) clarity += 15;
    
    // Technical terms
    const technicalTerms = ['function', 'component', 'file', 'class', 'method', 'api', 'database'];
    const techTermCount = technicalTerms.filter(term => 
      userMessage.toLowerCase().includes(term)).length;
    clarity += Math.min(techTermCount * 5, 20);
    
    // Question vs statement
    if (userMessage.includes('?')) clarity -= 5; // Questions are less clear than statements
    
    return Math.max(0, Math.min(100, clarity));
  }

  private determinePriorityFromContent(content: string, role: string, userMessage: string): string {
    if (role === 'user' && content === userMessage) return 'CRITICAL';
    if (role === 'user') return 'HIGH';
    if (content.toLowerCase().includes('error')) return 'HIGH';
    if (content.toLowerCase().includes('complete')) return 'MEDIUM';
    if (role === 'assistant') return 'MEDIUM';
    return 'LOW';
  }

  private generatePriorityReason(msg: any, allMessages: any[]): string {
    if (msg.priority === 'CRITICAL') return 'Current user instruction - highest priority';
    if (msg.priority === 'HIGH') return 'Recent user message or important system response';
    if (msg.priority === 'MEDIUM') return 'Standard conversation context';
    return 'Background context information';
  }

  private determineMessageTypeFromContent(msg: any): string {
    if (msg.isProjectGeneration) return 'project_generation';
    if (msg.deploymentReady) return 'deployment_ready';
    const content = msg.content.toLowerCase();
    if (content.includes('error')) return 'error_response';
    if (content.includes('complete')) return 'completion';
    if (msg.type === 'user') return 'user_request';
    return 'standard';
  }

  private estimateTokensFromContent(content: string): number {
    if (typeof content !== 'string') return 0;
    return Math.ceil(content.length / 4);
  }

  private calculateTokenWeightFromPriority(priority: string): number {
    switch (priority) {
      case 'CRITICAL': return 1.0;
      case 'HIGH': return 0.8;
      case 'MEDIUM': return 0.6;
      case 'LOW': return 0.3;
      case 'CONTEXT': return 0.1;
      default: return 0.5;
    }
  }

  private isCurrentInstructionMessage(msg: any, userMessage: string): boolean {
    return msg.type === 'user' && msg.content === userMessage;
  }

  private determineContextStrategy(messageCount: number, totalTokens: number): string {
    if (totalTokens > 100000) return 'priority_based';
    if (messageCount > 20) return 'recent_only';
    return 'full_history';
  }

  private generateMessageSelectionReasoning(messages: any[]): string {
    const criticalCount = messages.filter(m => m.priority === 'CRITICAL').length;
    const highCount = messages.filter(m => m.priority === 'HIGH').length;
    return `Selected ${messages.length} messages: ${criticalCount} critical, ${highCount} high priority`;
  }

  private inferProjectType(metadata: any): string {
    if (!metadata || !metadata.fileTypes) return 'unknown';
    const fileTypes = metadata.fileTypes;
    if (fileTypes['tsx'] || fileTypes['jsx']) return 'react';
    if (fileTypes['mo']) return 'motoko';
    if (fileTypes['ts'] || fileTypes['js']) return 'javascript';
    if (fileTypes['html'] || fileTypes['css']) return 'web';
    return 'mixed';
  }

  private calculateProjectComplexity(metadata: any): 'simple' | 'medium' | 'complex' {
    if (!metadata) return 'medium';
    const totalFiles = metadata.totalFiles || 0;
    if (totalFiles < 5) return 'simple';
    if (totalFiles < 20) return 'medium';
    return 'complex';
  }

  private estimateProjectTokens(metadata: any): number {
    if (!metadata) return 0;
    return (metadata.totalFiles || 0) * 500; // Rough estimate
  }

  private identifyKeyFiles(metadata: any): string[] {
    if (!metadata || !metadata.fileTypes) return [];
    const keyExtensions = ['tsx', 'mo', 'json', 'ts'];
    return Object.keys(metadata.fileTypes).filter(ext => keyExtensions.includes(ext));
  }

  private extractDependencies(metadata: any): string[] {
    // Simplified dependency extraction
    return metadata?.dependencies || [];
  }

  private inferProjectTypeFromClassification(classification: any): string {
    if (!classification) return 'unknown';
    const cls = classification.classification.toLowerCase();
    if (cls.includes('react')) return 'react';
    if (cls.includes('web')) return 'web';
    if (cls.includes('api')) return 'api';
    return 'general';
  }

  private inferComplexityFromClassification(classification: any): 'simple' | 'medium' | 'complex' {
    if (!classification) return 'medium';
    if (classification.confidence > 80) return 'simple';
    if (classification.confidence > 60) return 'medium';
    return 'complex';
  }

  private estimateTokensFromUserMessage(userMessage: string): number {
    return Math.ceil(userMessage.length / 4) * 10; // Rough estimate for project size
  }

  private identifyPrimaryFiles(fileContents: any, userMessage: string): string[] {
    if (!fileContents) return [];
    const files = Object.keys(fileContents);
    return files.filter(file => 
      userMessage.toLowerCase().includes(file.toLowerCase()) ||
      file.includes('.tsx') || file.includes('.mo'));
  }

  private identifySupportingFiles(fileContents: any, userMessage: string): string[] {
    if (!fileContents) return [];
    const files = Object.keys(fileContents);
    return files.filter(file => 
      file.includes('.ts') || file.includes('.css') || file.includes('.js'));
  }

  private identifyConfigFiles(fileContents: any): string[] {
    if (!fileContents) return [];
    const files = Object.keys(fileContents);
    return files.filter(file => 
      file.includes('.json') || file.includes('config') || file.includes('.toml'));
  }

  private identifyExcludedFiles(context: any, selectedFiles: string[]): string[] {
    const allFiles = Object.keys(context.fileContents || {});
    return allFiles.filter(file => !selectedFiles.includes(file));
  }

  private generateSelectionCriteria(context: any, entry: DebugEntry): any {
    return {
      basedOnUserMessage: true,
      priorityFiltering: true,
      tokenBudgetConsidered: true,
      relevanceScoring: true
    };
  }

  private determineSelectionStrategy(selectedCount: number, totalCount: number, context: any): string {
    if (selectedCount === totalCount) return 'all_files';
    if (selectedCount < totalCount * 0.3) return 'selective';
    if (selectedCount < totalCount * 0.7) return 'balanced';
    return 'comprehensive';
  }

  private calculateCurrentInstructionTokens(entry: DebugEntry): number {
    return this.estimateTokensFromContent(entry.userMessage);
  }

  private calculateSupportingContextTokens(context: any, entry: DebugEntry): number {
    const messageTokens = entry.messageContext?.totalTokens || 0;
    const instructionTokens = this.calculateCurrentInstructionTokens(entry);
    return Math.max(0, messageTokens - instructionTokens);
  }

  private calculateSystemContextTokens(context: any): number {
    const aiRulesTokens = this.estimateTokensFromContent(context.aiRulesContext || '');
    const docTokens = this.estimateTokensFromContent(context.documentationContext || '');
    return aiRulesTokens + docTokens;
  }

  private detectPriorityStructure(context: any, entry: DebugEntry): boolean {
    return !!(entry.messageContext?.priorityMetrics?.criticalMessages);
  }

  private detectTruncationInContext(context: any): boolean {
    return Object.values(context.fileContents || {})
      .some((content: any) => typeof content === 'string' && content.endsWith('...'));
  }

  private detectOptimizationInContext(context: any, entry: DebugEntry): boolean {
    const totalFiles = Object.keys(context.fileContents || {}).length;
    const selectedFiles = context.selectedFiles?.length || 0;
    return selectedFiles < totalFiles;
  }

  private detectCurrentInstructionSection(messages: any[]): boolean {
    return messages.some(msg => 
      msg.content && msg.content.includes('CURRENT') && msg.content.includes('INSTRUCTION'));
  }

  private detectSupportingContextSection(messages: any[]): boolean {
    return messages.some(msg => 
      msg.content && msg.content.includes('SUPPORTING') && msg.content.includes('CONTEXT'));
  }

  private detectSystemContextSection(messages: any[]): boolean {
    return messages.some(msg => 
      msg.content && msg.content.includes('SYSTEM') && msg.content.includes('CONTEXT'));
  }

  private detectFocusInstructions(messages: any[]): boolean {
    return messages.some(msg => 
      msg.content && (msg.content.includes('FOCUS') || msg.content.includes('COORDINATOR')));
  }

  private calculateTotalTokensFromMessages(messages: any[]): number {
    return messages.reduce((sum, msg) => sum + this.estimateTokensFromContent(msg.content || ''), 0);
  }

  private calculatePriorityDistributionFromMessages(messages: any[]): { [key: string]: number } {
    const distribution = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, CONTEXT: 0 };
    messages.forEach(msg => {
      const priority = msg.priority || 'MEDIUM';
      if (distribution.hasOwnProperty(priority)) {
        distribution[priority as keyof typeof distribution]++;
      }
    });
    return distribution;
  }

  private detectOptimizationInMessages(messages: any[]): boolean {
    return messages.some(msg => msg.optimized || (msg.content && msg.content.length > 2000));
  }

  private detectTruncationInMessages(messages: any[]): boolean {
    return messages.some(msg => msg.truncated || (msg.content && msg.content.endsWith('...')));
  }

  private detectPriorityAssembly(requestPayload: any, messages: any[]): boolean {
    return !!(requestPayload?.hasPriorityAssembly || 
              messages.some(msg => msg.content && msg.content.includes('PRIORITY')));
  }

  private estimateTokenBudget(messages: any[]): number {
    const totalTokens = this.calculateTotalTokensFromMessages(messages);
    return Math.max(totalTokens * 2, 50000); // Estimate budget as 2x input + buffer
  }

  private calculateInputTokens(messages: any[]): number {
    return this.calculateTotalTokensFromMessages(messages);
  }

  private calculateCompletenessScore(content: string, extractedFiles: any, entry: DebugEntry): number {
    let score = 30; // Base score
    
    if (content.length > 100) score += 20;
    if (content.length > 500) score += 20;
    if (Object.keys(extractedFiles || {}).length > 0) score += 30;
    
    // Check if response addresses user message
    const userWords = entry.userMessage.toLowerCase().split(' ').filter(w => w.length > 3);
    const contentLower = content.toLowerCase();
    const addressedWords = userWords.filter(word => contentLower.includes(word));
    score += (addressedWords.length / userWords.length) * 30;
    
    return Math.min(score, 100);
  }

  private calculateRelevanceScore(content: string, userMessage: string): number {
    const userWords = userMessage.toLowerCase().split(' ').filter(w => w.length > 3);
    const contentLower = content.toLowerCase();
    const matchingWords = userWords.filter(word => contentLower.includes(word));
    return Math.min((matchingWords.length / userWords.length) * 100, 100);
  }

  private calculateAccuracyScore(success: boolean, content: string, entry: DebugEntry): number {
    let score = success ? 70 : 20;
    
    // Adjust based on content quality
    if (content.includes('error') || content.includes('failed')) score -= 20;
    if (content.includes('successfully') || content.includes('complete')) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculatePriorityAlignment(content: string, entry: DebugEntry): number {
    // Check if response directly addresses the user's request
    const userKeywords = entry.userMessage.toLowerCase().split(' ')
      .filter(w => w.length > 3)
      .slice(0, 10); // Top 10 keywords
    const contentLower = content.toLowerCase();
    const matches = userKeywords.filter(keyword => contentLower.includes(keyword));
    
    let alignment = (matches.length / userKeywords.length) * 100;
    
    // Bonus for direct action words
    const actionWords = ['created', 'updated', 'fixed', 'added', 'removed', 'modified'];
    if (actionWords.some(word => contentLower.includes(word))) {
      alignment += 20;
    }
    
    return Math.min(alignment, 100);
  }

  private calculateContextUtilization(content: string, entry: DebugEntry): number {
    let score = 40; // Base score
    
    // Check if context was used effectively
    if (entry.contextBuilding?.selectedFiles && entry.contextBuilding.selectedFiles.length > 0) {
      score += 30;
      
      // Check if file names are mentioned in response
      const filesMentioned = entry.contextBuilding.selectedFiles.filter(file =>
        content.toLowerCase().includes(file.toLowerCase()));
      score += (filesMentioned.length / entry.contextBuilding.selectedFiles.length) * 20;
    }
    
    if (entry.messageContext?.totalMessages && entry.messageContext.totalMessages > 1) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  private calculateFocusConsistency(content: string, entry: DebugEntry): number {
    let score = 60; // Base score
    
    // Length factor - very long responses may lack focus
    if (content.length > 10000) score -= 30;
    else if (content.length > 5000) score -= 15;
    else if (content.length < 50) score -= 20; // Too short may be incomplete
    
    // Check if response stays on topic
    const userTopic = this.extractMainTopic(entry.userMessage);
    if (userTopic && content.toLowerCase().includes(userTopic.toLowerCase())) {
      score += 20;
    }
    
    // Check for tangential content
    const tangentialIndicators = ['by the way', 'also note', 'additionally', 'furthermore'];
    const tangentialCount = tangentialIndicators.filter(indicator => 
      content.toLowerCase().includes(indicator)).length;
    score -= tangentialCount * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private extractMainTopic(userMessage: string): string {
    // Simple topic extraction - find the main noun or action
    const words = userMessage.toLowerCase().split(' ');
    const actionWords = ['create', 'build', 'fix', 'update', 'add', 'remove', 'modify'];
    const action = words.find(word => actionWords.includes(word));
    return action || words.find(word => word.length > 5) || '';
  }

  private detectValidFileMarkers(content: string): boolean {
    const hasCompleteFileMarkers = content.includes('Complete file:') || 
                                   content.includes('// Complete file:') ||
                                   content.includes('/* Complete file:') ||
                                   content.includes('<!-- Complete file:');
    const hasCodeBlocks = content.includes('```');
    return hasCompleteFileMarkers && hasCodeBlocks;
  }

  private determineResponseType(content: string, extractedFiles: any, success: boolean): string {
    if (!success) return 'error';
    if (Object.keys(extractedFiles || {}).length > 0) return 'code_generation';
    if (content.includes('```')) return 'mixed';
    return 'explanation';
  }

  private calculateSystemStateEffectiveness(entry: DebugEntry): number {
    // Simple effectiveness calculation based on system state
    let effectiveness = 0;
    
    if (entry.systemState?.generationActive) effectiveness += 5;
    if (entry.systemState?.selectedFiles && entry.systemState.selectedFiles.length > 0) effectiveness += 5;
    if (entry.systemState?.prioritySystemState?.currentInstructionId) effectiveness += 10;
    
    return effectiveness;
  }

  private calculateContextReduction(entry: DebugEntry): number {
    if (!entry.messageContext?.totalMessages || !entry.contextBuilding?.totalAvailableFiles) return 0;
    
    const totalPossibleContext = entry.contextBuilding.totalAvailableFiles * 1000; // Rough estimate
    const actualContext = entry.messageContext.totalTokens || 0;
    
    return totalPossibleContext > 0 ? 
      Math.max(0, ((totalPossibleContext - actualContext) / totalPossibleContext) * 100) : 0;
  }

  private calculateFocusImprovement(entry: DebugEntry): number {
    if (!entry.messageContext?.priorityMetrics) return 0;
    
    const criticalRatio = entry.messageContext.priorityMetrics.criticalMessages / 
                         (entry.messageContext.totalMessages || 1);
    return criticalRatio * 100;
  }

  private calculateTokenOptimization(entry: DebugEntry): number {
    if (!entry.contextBuilding?.contextSizeAnalysis) return 0;
    
    const originalTokens = entry.contextBuilding.contextSizeAnalysis.estimatedTokens;
    const budgetUsed = entry.contextBuilding.priorityContextMetadata?.tokenBudgetUsed || originalTokens;
    
    return Math.max(0, originalTokens - budgetUsed);
  }

  private calculateFinalFocusImprovement(entry: DebugEntry): number {
    let improvement = 50; // Base score
    
    // Priority system utilization
    if (entry.contextBuilding?.priorityContextMetadata?.priorityStructureApplied) {
      improvement += 25;
    }
    
    // Current instruction identification
    if (entry.messageContext?.priorityMetrics?.currentInstructionId) {
      improvement += 15;
    }
    
    // Response quality alignment
    if (entry.response?.responseAnalysis?.qualityMetrics?.priorityAlignment) {
      improvement = (improvement + entry.response.responseAnalysis.qualityMetrics.priorityAlignment) / 2;
    }
    
    return Math.max(0, Math.min(100, improvement));
  }

  // Public methods for accessing data remain the same but with enhanced processing
  getProjectDebugEntries(projectId: string): DebugEntry[] {
    const entryIds = this.projectEntries.get(projectId) || [];
    return entryIds
      .map(id => this.debugEntries.get(id))
      .filter(entry => entry !== undefined)
      .sort((a, b) => b!.timestamp - a!.timestamp) as DebugEntry[];
  }

  getAllDebugEntries(): DebugEntry[] {
    return Array.from(this.debugEntries.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getProjectDebugSummary(projectId: string): ProjectDebugSummary {
    const entries = this.getProjectDebugEntries(projectId);
    const totalEntries = entries.length;
    
    if (totalEntries === 0) {
      return {
        projectId,
        projectName: 'Unknown Project',
        totalEntries: 0,
        totalClassifications: 0,
        lastActivity: 0,
        classifications: {},
        distributionByType: {},
        averageConfidence: 0,
        averageDuration: 0,
        successRate: 0,
        fileRecommendationAccuracy: 0,
        architectureHealth: {
          messageContextConsistency: 0,
          fileSelectionAccuracy: 0,
          responseRelevance: 0,
          errorFrequency: 0,
          performanceConsistency: 0,
          prioritySystemHealth: 0,
          currentInstructionFocus: 0,
          contextOptimizationEffectiveness: 0
        },
        detectedIssues: [],
        prioritySystemMetrics: {
          averagePriorityEffectiveness: 0,
          averageContextReduction: 0,
          averageFocusImprovement: 0,
          averageTokenOptimization: 0,
          priorityStructureUsage: 0,
          totalPriorityOptimizations: 0
        }
      };
    }

    const projectName = entries[0]?.projectName || 'Unknown Project';
    const classificationsMap: { [key: string]: number } = {};
    const distributionMap: { [key: string]: number } = {};
    
    let totalConfidence = 0;
    let totalDuration = 0;
    let successCount = 0;
    let classificationCount = 0;
    let durationCount = 0;
    
    // 🔥 COMPLETE: Enhanced priority system metrics calculation
    let totalPriorityEffectiveness = 0;
    let totalContextReduction = 0;
    let totalFocusImprovement = 0;
    let totalTokenOptimization = 0;
    let priorityStructureCount = 0;
    let totalPriorityOptimizations = 0;
    let priorityAnalyticsCount = 0;

    entries.forEach(entry => {
      // Classification data
      if (entry.classification) {
        classificationCount++;
        const classification = entry.classification.classification;
        classificationsMap[classification] = (classificationsMap[classification] || 0) + 1;
        totalConfidence += entry.classification.confidence;
      }

      // Response success tracking
      if (entry.response) {
        if (entry.response.success) successCount++;
        const responseType = entry.response.responseAnalysis?.responseType || 'unknown';
        distributionMap[responseType] = (distributionMap[responseType] || 0) + 1;
      }

      // Duration tracking
      if (entry.duration) {
        totalDuration += entry.duration;
        durationCount++;
      }

      // 🔥 COMPLETE: Priority system metrics aggregation
      if (entry.priorityAnalytics) {
        totalPriorityEffectiveness += entry.priorityAnalytics.priorityEffectiveness;
        totalContextReduction += entry.priorityAnalytics.contextReduction;
        totalFocusImprovement += entry.priorityAnalytics.focusImprovement;
        totalTokenOptimization += entry.priorityAnalytics.tokenOptimization;
        priorityAnalyticsCount++;
      }

      if (entry.contextBuilding?.priorityContextMetadata?.priorityStructureApplied) {
        priorityStructureCount++;
      }

      if (entry.messageContext?.priorityMetrics?.optimizationApplied) {
        totalPriorityOptimizations++;
      }
    });

    // 🔥 COMPLETE: Calculate comprehensive architecture health
    const architectureHealth = {
      messageContextConsistency: this.calculateMessageContextConsistency(entries),
      fileSelectionAccuracy: this.calculateFileSelectionAccuracy(entries),
      responseRelevance: this.calculateResponseRelevance(entries),
      errorFrequency: this.calculateErrorFrequency(entries),
      performanceConsistency: this.calculatePerformanceConsistency(entries),
      prioritySystemHealth: priorityAnalyticsCount > 0 ? totalPriorityEffectiveness / priorityAnalyticsCount : 0,
      currentInstructionFocus: priorityAnalyticsCount > 0 ? totalFocusImprovement / priorityAnalyticsCount : 0,
      contextOptimizationEffectiveness: priorityAnalyticsCount > 0 ? totalContextReduction / priorityAnalyticsCount : 0
    };

    return {
      projectId,
      projectName,
      totalEntries,
      totalClassifications: classificationCount,
      lastActivity: entries[0]?.timestamp || 0,
      classifications: classificationsMap,
      distributionByType: distributionMap,
      averageConfidence: classificationCount > 0 ? totalConfidence / classificationCount : 0,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
      successRate: totalEntries > 0 ? (successCount / totalEntries) * 100 : 0,
      fileRecommendationAccuracy: this.calculateFileRecommendationAccuracy(entries),
      architectureHealth,
      detectedIssues: this.detectArchitecturalIssues(entries),
      prioritySystemMetrics: {
        averagePriorityEffectiveness: priorityAnalyticsCount > 0 ? totalPriorityEffectiveness / priorityAnalyticsCount : 0,
        averageContextReduction: priorityAnalyticsCount > 0 ? totalContextReduction / priorityAnalyticsCount : 0,
        averageFocusImprovement: priorityAnalyticsCount > 0 ? totalFocusImprovement / priorityAnalyticsCount : 0,
        averageTokenOptimization: priorityAnalyticsCount > 0 ? totalTokenOptimization / priorityAnalyticsCount : 0,
        priorityStructureUsage: totalEntries > 0 ? (priorityStructureCount / totalEntries) * 100 : 0,
        totalPriorityOptimizations
      }
    };
  }

  // 🔥 COMPLETE: Helper methods for architecture health calculation
  private calculateMessageContextConsistency(entries: DebugEntry[]): number {
    const withContext = entries.filter(e => e.messageContext?.totalMessages && e.messageContext.totalMessages > 0);
    return entries.length > 0 ? (withContext.length / entries.length) * 100 : 0;
  }

  private calculateFileSelectionAccuracy(entries: DebugEntry[]): number {
    const withFiles = entries.filter(e => e.contextBuilding?.selectedFiles && e.contextBuilding.selectedFiles.length > 0);
    return entries.length > 0 ? (withFiles.length / entries.length) * 100 : 0;
  }

  private calculateResponseRelevance(entries: DebugEntry[]): number {
    const withQuality = entries.filter(e => e.response?.responseAnalysis?.qualityMetrics?.relevance);
    if (withQuality.length === 0) return 0;
    
    const totalRelevance = withQuality.reduce((sum, e) => 
      sum + (e.response!.responseAnalysis.qualityMetrics!.relevance || 0), 0);
    return totalRelevance / withQuality.length;
  }

  private calculateErrorFrequency(entries: DebugEntry[]): number {
    const withErrors = entries.filter(e => e.errors && e.errors.length > 0);
    return entries.length > 0 ? (withErrors.length / entries.length) * 100 : 0;
  }

  private calculatePerformanceConsistency(entries: DebugEntry[]): number {
    const withDuration = entries.filter(e => e.duration);
    if (withDuration.length < 2) return 100;
    
    const durations = withDuration.map(e => e.duration!);
    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - average, 2), 0) / durations.length;
    const consistency = Math.max(0, 100 - (Math.sqrt(variance) / average) * 100);
    
    return Math.min(100, consistency);
  }

  private calculateFileRecommendationAccuracy(entries: DebugEntry[]): number {
    // Simple heuristic based on whether files were actually used
    const withRecommendations = entries.filter(e => 
      e.classification?.contextSelection && e.contextBuilding?.selectedFiles);
    
    if (withRecommendations.length === 0) return 75; // Default
    
    let accuracySum = 0;
    withRecommendations.forEach(entry => {
      const recommended = entry.classification!.contextSelection?.totalFiles || 0;
      const selected = entry.contextBuilding!.selectedFiles.length;
      const accuracy = recommended > 0 ? Math.min(100, (selected / recommended) * 100) : 50;
      accuracySum += accuracy;
    });
    
    return accuracySum / withRecommendations.length;
  }

  private detectArchitecturalIssues(entries: DebugEntry[]): Array<{
    type: string;
    frequency: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }> {
    const issues: Array<{ type: string; frequency: number; description: string; severity: 'low' | 'medium' | 'high' }> = [];
    
    // Context overload detection
    const largeContextEntries = entries.filter(e => 
      e.contextBuilding?.contextSizeAnalysis?.estimatedTokens && 
      e.contextBuilding.contextSizeAnalysis.estimatedTokens > 150000);
    if (largeContextEntries.length > 0) {
      issues.push({
        type: 'context_overload',
        frequency: (largeContextEntries.length / entries.length) * 100,
        description: 'Context size exceeding optimal token limits',
        severity: largeContextEntries.length / entries.length > 0.3 ? 'high' : 'medium'
      });
    }
    
    // Priority system failures
    const noPriorityEntries = entries.filter(e => !e.priorityAnalytics);
    if (noPriorityEntries.length > 0) {
      issues.push({
        type: 'priority_system_failure',
        frequency: (noPriorityEntries.length / entries.length) * 100,
        description: 'Priority analytics not being calculated',
        severity: 'high'
      });
    }
    
    // Focus drift detection
    const lowFocusEntries = entries.filter(e => 
      e.priorityAnalytics?.focusImprovement && 
      e.priorityAnalytics.focusImprovement < 30);
    if (lowFocusEntries.length > 0) {
      issues.push({
        type: 'focus_drift',
        frequency: (lowFocusEntries.length / entries.length) * 100,
        description: 'Low focus improvement scores indicating potential attention drift',
        severity: lowFocusEntries.length / entries.length > 0.5 ? 'high' : 'medium'
      });
    }
    
    return issues;
  }

  // 🔥 NEW: Abbreviation utility to reduce export size without losing effectiveness
  private abbreviateDebugData(entry: DebugEntry): any {
    const MAX_STRING_LENGTH = 5000; // Max length for strings
    const MAX_ARRAY_LENGTH = 100; // Max items in arrays
    const MAX_FILE_CONTENT_LENGTH = 2000; // Max length for file contents
    const MAX_JSON_LENGTH = 50000; // 🔥 NEW: Much longer for JSON to preserve complete responses
    const MAX_PARSING_ERRORS = 50; // 🔥 NEW: Limit parsing errors array to avoid spam
    
    const truncateString = (str: string, maxLength: number): string => {
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength) + `... [truncated ${str.length - maxLength} chars]`;
    };
    
    const abbreviateObject = (obj: any, depth: number = 0, path: string = ''): any => {
      if (depth > 5) return '[max depth reached]'; // Prevent infinite recursion
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'string') {
        // 🔥 NEW: Preserve complete JSON in jsonTargetedMode and response content
        if (path.includes('jsonTargetedMode') || path.includes('parsingResults') || 
            (path.includes('response') && path.includes('content'))) {
          // For JSON-related content, use much longer limit
          return truncateString(obj, MAX_JSON_LENGTH);
        }
        return truncateString(obj, MAX_STRING_LENGTH);
      }
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) {
        // 🔥 NEW: Special handling for parsingErrors array - limit to avoid spam
        if (path.includes('parsingErrors')) {
          if (obj.length > MAX_PARSING_ERRORS) {
            return [
              ...obj.slice(0, MAX_PARSING_ERRORS).map((item: any, idx: number) => 
                abbreviateObject(item, depth + 1, `${path}[${idx}]`)
              ),
              `... [${obj.length - MAX_PARSING_ERRORS} more parsing errors (likely from progressive JSON parsing during streaming)]`
            ];
          }
        }
        if (obj.length > MAX_ARRAY_LENGTH) {
          return [
            ...obj.slice(0, MAX_ARRAY_LENGTH).map((item: any, idx: number) => 
              abbreviateObject(item, depth + 1, `${path}[${idx}]`)
            ),
            `... [${obj.length - MAX_ARRAY_LENGTH} more items]`
          ];
        }
        return obj.map((item: any, idx: number) => 
          abbreviateObject(item, depth + 1, `${path}[${idx}]`)
        );
      }
      
      const abbreviated: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Special handling for file contents - truncate more aggressively
        if (key === 'fileContents' && typeof value === 'object') {
          const abbreviatedFiles: any = {};
          for (const [fileName, content] of Object.entries(value as any)) {
            if (typeof content === 'string') {
              abbreviatedFiles[fileName] = truncateString(content, MAX_FILE_CONTENT_LENGTH);
            } else {
              abbreviatedFiles[fileName] = abbreviateObject(content, depth + 1, `${currentPath}.${fileName}`);
            }
          }
          abbreviated[key] = abbreviatedFiles;
        } else if (key === 'rawJsonResponse' && typeof value === 'string') {
          // 🔥 NEW: NEVER truncate raw JSON response - preserve completely for debugging
          abbreviated[key] = value; // Keep complete JSON
        } else if (key === 'content' && typeof value === 'string') {
          // 🔥 NEW: Preserve longer content for response content (might contain JSON)
          if (currentPath.includes('response')) {
            abbreviated[key] = truncateString(value, MAX_JSON_LENGTH);
          } else {
            abbreviated[key] = truncateString(value, MAX_STRING_LENGTH);
          }
        } else if (key === 'messages' && Array.isArray(value)) {
          // Abbreviate messages array
          abbreviated[key] = abbreviateObject(value, depth + 1, currentPath);
        } else if (key === 'jsonTargetedMode' && typeof value === 'object') {
          // 🔥 NEW: Preserve complete JSON targeted mode data (don't abbreviate too much)
          abbreviated[key] = abbreviateObject(value, depth + 1, currentPath);
        } else {
          abbreviated[key] = abbreviateObject(value, depth + 1, currentPath);
        }
      }
      return abbreviated;
    };
    
    return abbreviateObject(entry);
  }

  exportDebugData(projectId: string): void {
    try {
      const entries = this.getProjectDebugEntries(projectId);
      const summary = this.getProjectDebugSummary(projectId);
      
      // 🔥 NEW: Abbreviate entries to reduce export size
      const abbreviatedEntries = entries.map(entry => this.abbreviateDebugData(entry));
      
      const exportData = {
        metadata: {
          exportTime: new Date().toISOString(),
          projectId,
          totalEntries: entries.length,
          version: '2.1.0',
          abbreviated: true,
          abbreviationNote: 'Large strings and arrays have been truncated to reduce file size while preserving essential debug information'
        },
        summary,
        entries: abbreviatedEntries
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `classification_debug_abbreviated_${projectId}_${Date.now()}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      console.log(`📤 [ClassificationDebug] Exported ${entries.length} ABBREVIATED entries for project: ${projectId}`);
    } catch (error) {
      console.error('Failed to export debug data:', error);
    }
  }

  clearProjectDebugData(projectId: string): void {
    const entryIds = this.projectEntries.get(projectId) || [];
    entryIds.forEach(id => this.debugEntries.delete(id));
    this.projectEntries.delete(projectId);
    console.log(`🗑️ [ClassificationDebug] Cleared debug data for project: ${projectId}`);
  }

  clearAllDebugData(): void {
    this.debugEntries.clear();
    this.projectEntries.clear();
    console.log('🗑️ [ClassificationDebug] Cleared all debug data');
  }

  private cleanupOldEntries(): void {
    if (this.debugEntries.size <= this.maxEntries) return;

    const entries = Array.from(this.debugEntries.entries())
      .sort(([, a], [, b]) => b.timestamp - a.timestamp);
    
    const toDelete = entries.slice(this.maxEntries);
    toDelete.forEach(([id]) => {
      this.debugEntries.delete(id);
    });

    // Clean up project entries references
    for (const [projectId, entryIds] of this.projectEntries.entries()) {
      const validIds = entryIds.filter(id => this.debugEntries.has(id));
      if (validIds.length === 0) {
        this.projectEntries.delete(projectId);
      } else {
        this.projectEntries.set(projectId, validIds);
      }
    }

    console.log(`🧹 [ClassificationDebug] Cleaned up ${toDelete.length} old entries`);
  }
}

export const classificationDebugService = ClassificationDebugService.getInstance();