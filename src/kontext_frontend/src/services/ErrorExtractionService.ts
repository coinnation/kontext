import { ExtractedError } from '../types/deploymentCoordination';
import { messageCoordinator } from './MessageCoordinator';

// 🔥 PHASE 3: Enhanced extracted error interface with priority coordination
export interface EnhancedExtractedError extends ExtractedError {
  // Original ExtractedError properties remain the same
  // Adding priority coordination enhancements
  priorityClassification?: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    blockingUserGoal: boolean;
    requiresImmediateAttention: boolean;
    canBeAutoFixed: boolean;
    errorCategory: string;
    priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  };
  conversationContext?: {
    relatedInstructionId?: string;
    conversationFocus?: string;
    userMainRequest?: string;
    blockingProgress?: boolean;
  };
  coordinationMetadata?: {
    messageCoordinatorReady: boolean;
    priorityCoordinationActive: boolean;
    focusedErrorHandling: boolean;
    extractionTimestamp: number;
  };
}

export class ErrorExtractionService {
  // 🔥 PHASE 3: Enhanced priority-coordination integration status
  private static priorityCoordinationActive: boolean = false;
  private static messageCoordinatorReady: boolean = false;
  private static lastIntegrationCheck: number = 0;
  private static focusedErrorHandlingEnabled: boolean = true;

  // 🔥 PHASE 3: Validate MessageCoordinator integration for error extraction
  private static validateMessageCoordinatorIntegration(): void {
    try {
      // Check if enough time has passed since last validation
      if (Date.now() - this.lastIntegrationCheck < 60000) {
        return; // Skip if checked within last minute
      }

      const priorityStatus = messageCoordinator.getPriorityIntegrationStatus();
      const coordinationStatus = messageCoordinator.getCoordinationStatus();
      
      this.messageCoordinatorReady = priorityStatus.enabled && priorityStatus.functionsRegistered;
      this.priorityCoordinationActive = this.messageCoordinatorReady && coordinationStatus.enabled;
      this.lastIntegrationCheck = Date.now();
      
      if (this.priorityCoordinationActive) {
        console.log('🔥 [ErrorExtractionService] PHASE 3: MessageCoordinator priority-coordination integration CONFIRMED for focused error extraction');
      } else {
        console.warn('⚠️ [ErrorExtractionService] PHASE 3: MessageCoordinator priority-coordination not fully available for error extraction:', {
          messageCoordinatorReady: this.messageCoordinatorReady,
          priorityCoordinationActive: this.priorityCoordinationActive
        });
      }
    } catch (error) {
      console.error('❌ [ErrorExtractionService] PHASE 3: Failed to validate MessageCoordinator integration for error extraction:', error);
      this.messageCoordinatorReady = false;
      this.priorityCoordinationActive = false;
    }
  }

  // 🔥 PHASE 3: Enhanced Motoko error extraction with priority coordination
  static extractMotokoError(
    error: string, 
    files: { [fileName: string]: string },
    // 🔥 PHASE 3: Priority coordination context parameters
    options?: {
      projectId?: string;
      relatedInstructionId?: string;
      conversationContext?: string;
      blockingUserGoal?: boolean;
      errorSeverity?: 'critical' | 'high' | 'medium' | 'low';
    }
  ): EnhancedExtractedError {
    console.log('🔥 [ErrorExtractionService] PHASE 3: Extracting Motoko error with priority-coordination integration');
    
    // Validate MessageCoordinator integration
    this.validateMessageCoordinatorIntegration();
    
    // Parse Motoko compilation error format
    // Example: "Online Arcade Platform/src/backend/src/main.mo:1024.25-1024.26: syntax error [M0001], unexpected token ';'"
    
    const motokoErrorRegex = /([^:]+):(\d+)\.(\d+)-\d+\.\d+:\s*(.+)/;
    const match = error.match(motokoErrorRegex);
    
    // 🔥 PHASE 3: Enhanced priority classification for Motoko errors
    const priorityClassification = this.classifyMotokoErrorForPriorityCoordination(
      error,
      options?.errorSeverity || 'high',
      !!options?.blockingUserGoal,
      !!options?.conversationContext
    );
    
    // 🔥 PHASE 3: Conversation context assembly
    const conversationContext = options?.conversationContext || options?.relatedInstructionId ? {
      relatedInstructionId: options.relatedInstructionId,
      conversationFocus: options.conversationContext,
      blockingProgress: options?.blockingUserGoal || priorityClassification.blockingUserGoal
    } : undefined;
    
    // 🔥 PHASE 3: Coordination metadata
    const coordinationMetadata = {
      messageCoordinatorReady: this.messageCoordinatorReady,
      priorityCoordinationActive: this.priorityCoordinationActive,
      focusedErrorHandling: this.focusedErrorHandlingEnabled,
      extractionTimestamp: Date.now()
    };
    
    if (!match) {
      return {
        type: 'motoko',
        originalError: error,
        extractedMessage: error,
        // 🔥 PHASE 3: Enhanced properties
        priorityClassification,
        conversationContext,
        coordinationMetadata
      };
    }
    
    const [, filePath, lineStr, columnStr, errorMessage] = match;
    const line = parseInt(lineStr, 10);
    const column = parseInt(columnStr, 10);
    
    // Clean up the file path to match our file keys
    let cleanFilePath = filePath;
    if (filePath.includes('/')) {
      const parts = filePath.split('/');
      // Remove project name prefix if present
      if (parts.length > 1) {
        cleanFilePath = parts.slice(1).join('/');
      }
    }
    
    // Find the matching file in our files object
    const matchingFileKey = Object.keys(files).find(key => 
      key.endsWith(cleanFilePath) || 
      key.includes(cleanFilePath) ||
      key.split('/').pop() === cleanFilePath.split('/').pop()
    );
    
    if (!matchingFileKey || !files[matchingFileKey]) {
      console.log('🔥 [ErrorExtractionService] PHASE 3: File not found for Motoko error, returning basic extraction with priority coordination');
      
      return {
        type: 'motoko',
        originalError: error,
        extractedMessage: `${filePath}:${line}.${column}: ${errorMessage}`,
        file: filePath,
        line,
        column,
        // 🔥 PHASE 3: Enhanced properties
        priorityClassification,
        conversationContext,
        coordinationMetadata
      };
    }
    
    const fileContent = files[matchingFileKey];
    const lines = fileContent.split('\n');
    
    if (line <= 0 || line > lines.length) {
      return {
        type: 'motoko',
        originalError: error,
        extractedMessage: `${filePath}:${line}.${column}: ${errorMessage}`,
        file: matchingFileKey,
        line,
        column,
        // 🔥 PHASE 3: Enhanced properties
        priorityClassification,
        conversationContext,
        coordinationMetadata
      };
    }
    
    // Extract context lines (5 before and after)
    const contextStart = Math.max(0, line - 6); // line is 1-based, array is 0-based
    const contextEnd = Math.min(lines.length, line + 5);
    const errorLineIndex = line - 1; // Convert to 0-based
    
    const beforeLines = lines.slice(contextStart, errorLineIndex);
    const errorLine = lines[errorLineIndex] || '';
    const afterLines = lines.slice(errorLineIndex + 1, contextEnd);
    
    const codeContext = [
      ...beforeLines.map((l, i) => `${contextStart + i + 1}: ${l}`),
      `${line}: ${errorLine} // <- ERROR HERE`,
      ...afterLines.map((l, i) => `${line + i + 1}: ${l}`)
    ].join('\n');
    
    console.log('✅ [ErrorExtractionService] PHASE 3: Motoko error extracted with complete priority-coordination integration:', {
      file: matchingFileKey,
      line,
      column,
      priorityLevel: priorityClassification.priorityLevel,
      blockingUserGoal: priorityClassification.blockingUserGoal,
      hasConversationContext: !!conversationContext,
      priorityCoordinationActive: this.priorityCoordinationActive
    });
    
    return {
      type: 'motoko',
      originalError: error,
      extractedMessage: `${matchingFileKey}:${line}.${column}: ${errorMessage}`,
      file: matchingFileKey,
      line,
      column,
      codeContext,
      contextLines: {
        before: beforeLines,
        errorLine,
        after: afterLines
      },
      // 🔥 PHASE 3: Enhanced properties with complete priority coordination
      priorityClassification,
      conversationContext,
      coordinationMetadata
    };
  }
  
  // 🔥 PHASE 3: Enhanced frontend error extraction with priority coordination  
  static extractFrontendError(
    error: string, 
    files: { [fileName: string]: string },
    // 🔥 PHASE 3: Priority coordination context parameters
    options?: {
      projectId?: string;
      relatedInstructionId?: string;
      conversationContext?: string;
      blockingUserGoal?: boolean;
      errorSeverity?: 'critical' | 'high' | 'medium' | 'low';
    }
  ): EnhancedExtractedError {
    console.log('🔥 [ErrorExtractionService] PHASE 3: Extracting frontend error with priority-coordination integration');
    
    // Validate MessageCoordinator integration
    this.validateMessageCoordinatorIntegration();
    
    // Parse frontend bundling errors (Vite/TypeScript)
    // Look for common patterns like:
    // - "src/components/App.tsx(45,12): error TS2304: Cannot find name 'someVariable'"
    // - "Error: Build failed with 1 error:\nsrc/App.tsx:23:15: ERROR: ..."
    
    const patterns = [
      // TypeScript error pattern
      /([^(]+)\((\d+),(\d+)\):\s*error\s*[^:]*:\s*(.+)/,
      // Vite build error pattern  
      /([^:]+):(\d+):(\d+):\s*ERROR:\s*(.+)/,
      // General file:line:column pattern
      /([^:]+):(\d+):(\d+):\s*(.+)/
    ];
    
    let match = null;
    let matchedPattern = -1;
    
    for (let i = 0; i < patterns.length; i++) {
      match = error.match(patterns[i]);
      if (match) {
        matchedPattern = i;
        break;
      }
    }
    
    // 🔥 PHASE 3: Enhanced priority classification for frontend errors
    const priorityClassification = this.classifyFrontendErrorForPriorityCoordination(
      error,
      options?.errorSeverity || 'medium',
      !!options?.blockingUserGoal,
      !!options?.conversationContext
    );
    
    // 🔥 PHASE 3: Conversation context assembly
    const conversationContext = options?.conversationContext || options?.relatedInstructionId ? {
      relatedInstructionId: options.relatedInstructionId,
      conversationFocus: options.conversationContext,
      blockingProgress: options?.blockingUserGoal || priorityClassification.blockingUserGoal
    } : undefined;
    
    // 🔥 PHASE 3: Coordination metadata
    const coordinationMetadata = {
      messageCoordinatorReady: this.messageCoordinatorReady,
      priorityCoordinationActive: this.priorityCoordinationActive,
      focusedErrorHandling: this.focusedErrorHandlingEnabled,
      extractionTimestamp: Date.now()
    };
    
    if (!match) {
      return {
        type: 'frontend',
        originalError: error,
        extractedMessage: error,
        // 🔥 PHASE 3: Enhanced properties
        priorityClassification,
        conversationContext,
        coordinationMetadata
      };
    }
    
    const [, filePath, lineStr, columnStr, errorMessage] = match;
    const line = parseInt(lineStr, 10);
    const column = parseInt(columnStr, 10);
    
    // Clean up file path
    let cleanFilePath = filePath.replace(/^\.\//, '').replace(/^src\//, '');
    
    // Find matching file
    const matchingFileKey = Object.keys(files).find(key => 
      key.includes(cleanFilePath) ||
      key.endsWith(cleanFilePath) ||
      key.split('/').pop() === cleanFilePath.split('/').pop()
    );
    
    if (!matchingFileKey || !files[matchingFileKey]) {
      return {
        type: 'frontend',
        originalError: error,
        extractedMessage: `${filePath}:${line}:${column}: ${errorMessage}`,
        file: filePath,
        line,
        column,
        // 🔥 PHASE 3: Enhanced properties
        priorityClassification,
        conversationContext,
        coordinationMetadata
      };
    }
    
    const fileContent = files[matchingFileKey];
    const lines = fileContent.split('\n');
    
    if (line <= 0 || line > lines.length) {
      return {
        type: 'frontend',
        originalError: error,
        extractedMessage: `${filePath}:${line}:${column}: ${errorMessage}`,
        file: matchingFileKey,
        line,
        column,
        // 🔥 PHASE 3: Enhanced properties
        priorityClassification,
        conversationContext,
        coordinationMetadata
      };
    }
    
    // Extract context lines
    const contextStart = Math.max(0, line - 6);
    const contextEnd = Math.min(lines.length, line + 5);
    const errorLineIndex = line - 1;
    
    const beforeLines = lines.slice(contextStart, errorLineIndex);
    const errorLine = lines[errorLineIndex] || '';
    const afterLines = lines.slice(errorLineIndex + 1, contextEnd);
    
    const codeContext = [
      ...beforeLines.map((l, i) => `${contextStart + i + 1}: ${l}`),
      `${line}: ${errorLine} // <- ERROR HERE`,
      ...afterLines.map((l, i) => `${line + i + 1}: ${l}`)
    ].join('\n');
    
    console.log('✅ [ErrorExtractionService] PHASE 3: Frontend error extracted with complete priority-coordination integration:', {
      file: matchingFileKey,
      line,
      column,
      priorityLevel: priorityClassification.priorityLevel,
      blockingUserGoal: priorityClassification.blockingUserGoal,
      hasConversationContext: !!conversationContext,
      priorityCoordinationActive: this.priorityCoordinationActive
    });
    
    return {
      type: 'frontend',
      originalError: error,
      extractedMessage: `${matchingFileKey}:${line}:${column}: ${errorMessage}`,
      file: matchingFileKey,
      line,
      column,
      codeContext,
      contextLines: {
        before: beforeLines,
        errorLine,
        after: afterLines
      },
      // 🔥 PHASE 3: Enhanced properties with complete priority coordination
      priorityClassification,
      conversationContext,
      coordinationMetadata
    };
  }
  
  // 🔥 PHASE 3: Priority classification for Motoko errors
  private static classifyMotokoErrorForPriorityCoordination(
    error: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    blockingUserGoal: boolean,
    hasConversationContext: boolean
  ): {
    severity: 'critical' | 'high' | 'medium' | 'low';
    blockingUserGoal: boolean;
    requiresImmediateAttention: boolean;
    canBeAutoFixed: boolean;
    errorCategory: string;
    priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  } {
    const lowerError = error.toLowerCase();
    
    // Determine error category
    let errorCategory = 'unknown';
    if (lowerError.includes('syntax error') || lowerError.includes('malformed')) {
      errorCategory = 'syntax';
    } else if (lowerError.includes('type error') || lowerError.includes('unbound variable')) {
      errorCategory = 'type';
    } else if (lowerError.includes('does not exist') || lowerError.includes('module')) {
      errorCategory = 'module';
    } else if (lowerError.includes('deprecated')) {
      errorCategory = 'deprecated';
    }
    
    // Determine if error actually blocks user goal
    const actuallyBlockingUserGoal = blockingUserGoal || 
      severity === 'critical' ||
      errorCategory === 'syntax' ||
      lowerError.includes('compilation failed');
    
    // Determine if requires immediate attention
    const requiresImmediateAttention = actuallyBlockingUserGoal || 
      severity === 'critical' ||
      hasConversationContext;
    
    // Determine priority level with conversation context boost
    let priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
    if (actuallyBlockingUserGoal && hasConversationContext) {
      priorityLevel = 'CRITICAL';
    } else if (actuallyBlockingUserGoal || severity === 'critical') {
      priorityLevel = 'HIGH';
    } else if (hasConversationContext || severity === 'high') {
      priorityLevel = 'HIGH';
    } else if (severity === 'medium') {
      priorityLevel = 'MEDIUM';
    } else {
      priorityLevel = 'LOW';
    }
    
    return {
      severity,
      blockingUserGoal: actuallyBlockingUserGoal,
      requiresImmediateAttention,
      canBeAutoFixed: true, // Most Motoko errors can be auto-fixed
      errorCategory,
      priorityLevel
    };
  }
  
  // 🔥 PHASE 3: Priority classification for frontend errors
  private static classifyFrontendErrorForPriorityCoordination(
    error: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    blockingUserGoal: boolean,
    hasConversationContext: boolean
  ): {
    severity: 'critical' | 'high' | 'medium' | 'low';
    blockingUserGoal: boolean;
    requiresImmediateAttention: boolean;
    canBeAutoFixed: boolean;
    errorCategory: string;
    priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  } {
    const lowerError = error.toLowerCase();
    
    // Determine error category
    let errorCategory = 'unknown';
    if (lowerError.includes('could not resolve') || lowerError.includes('module not found')) {
      errorCategory = 'import';
    } else if (lowerError.includes('typescript') || lowerError.includes('ts(')) {
      errorCategory = 'typescript';
    } else if (lowerError.includes('syntax error')) {
      errorCategory = 'syntax';
    } else if (lowerError.includes('dependency') || lowerError.includes('package')) {
      errorCategory = 'dependency';
    } else {
      errorCategory = 'bundling';
    }
    
    // Frontend errors are generally less blocking than backend errors
    const actuallyBlockingUserGoal = blockingUserGoal || 
      severity === 'critical' ||
      errorCategory === 'syntax' ||
      errorCategory === 'import';
    
    // Determine if requires immediate attention
    const requiresImmediateAttention = actuallyBlockingUserGoal || 
      severity === 'critical' ||
      (hasConversationContext && severity === 'high');
    
    // Determine priority level (frontend errors generally get lower priority than backend)
    let priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (actuallyBlockingUserGoal && hasConversationContext) {
      priorityLevel = 'HIGH'; // Frontend rarely gets CRITICAL unless truly blocking
    } else if (actuallyBlockingUserGoal || severity === 'critical') {
      priorityLevel = 'HIGH';
    } else if (hasConversationContext || severity === 'high') {
      priorityLevel = 'MEDIUM';
    } else {
      priorityLevel = 'LOW';
    }
    
    return {
      severity,
      blockingUserGoal: actuallyBlockingUserGoal,
      requiresImmediateAttention,
      canBeAutoFixed: true, // Most frontend errors can be auto-fixed
      errorCategory,
      priorityLevel
    };
  }
  
  // 🔥 PHASE 3: Enhanced fix prompt generation with priority coordination awareness
  static generateFixPrompt(
    extractedError: EnhancedExtractedError, 
    projectName: string,
    // 🔥 PHASE 3: Priority coordination context
    options?: {
      priorityContext?: any;
      conversationFocus?: string;
      focusedFixRequest?: boolean;
    }
  ): string {
    const errorType = extractedError.type === 'motoko' ? 'Motoko Backend' : 'Frontend';
    const isMotoko = extractedError.type === 'motoko';
    
    // 🔥 PHASE 3: Determine urgency and focus based on priority coordination
    const urgencyLevel = extractedError.priorityClassification?.blockingUserGoal ? 
      '🚨 CRITICAL' : '⚠️ HIGH PRIORITY';
    
    const priorityIndicator = extractedError.priorityClassification?.priorityLevel || 'HIGH';
    const errorCategory = extractedError.priorityClassification?.errorCategory || 'unknown';
    
    let prompt = `${urgencyLevel} **${errorType} Error - Priority ${priorityIndicator}**\n\n`;
    
    // 🔥 PHASE 3: Add conversation context awareness
    if (options?.conversationFocus) {
      prompt += `🎯 **CONVERSATION CONTEXT**: I understand you're working on: ${options.conversationFocus}\n`;
      prompt += `This error is blocking progress toward that goal.\n\n`;
    } else if (extractedError.conversationContext?.conversationFocus) {
      prompt += `🎯 **CONVERSATION CONTEXT**: ${extractedError.conversationContext.conversationFocus}\n`;
      prompt += `This error is blocking your progress.\n\n`;
    }
    
    prompt += `**Error Classification:**\n`;
    prompt += `• Type: ${errorType}\n`;
    prompt += `• Category: ${errorCategory}\n`;
    prompt += `• Severity: ${extractedError.priorityClassification?.severity || 'high'}\n`;
    prompt += `• ${extractedError.priorityClassification?.blockingUserGoal ? '🔴 **BLOCKING YOUR MAIN GOAL**' : '🟡 **IMPACTING YOUR WORK**'}\n`;
    prompt += `• Priority Level: ${priorityIndicator}\n\n`;
    
    prompt += `**Specific Error:** ${extractedError.extractedMessage}\n\n`;
    
    if (extractedError.codeContext) {
      prompt += `**Code Context:**\n\`\`\`${isMotoko ? 'motoko' : 'typescript'}\n`;
      prompt += extractedError.codeContext;
      prompt += `\n\`\`\`\n\n`;
    }
    
    // 🔥 PHASE 3: Add priority context if available
    if (options?.priorityContext) {
      prompt += `**🎯 PRIORITY CONTEXT:**\n`;
      if (options.priorityContext.mainUserRequest) {
        prompt += `Main User Request: ${options.priorityContext.mainUserRequest}\n`;
      }
      if (options.priorityContext.currentFocus) {
        prompt += `Current Focus: ${options.priorityContext.currentFocus}\n`;
      }
      prompt += `\n`;
    }
    
    // 🔥 PHASE 3: Enhanced fix request based on coordination status
    if (extractedError.coordinationMetadata?.priorityCoordinationActive) {
      prompt += `**💡 PRIORITY-COORDINATED FIX REQUEST:**\n`;
      prompt += `This error has been processed through the priority-coordination system. `;
    } else {
      prompt += `**💡 FIX REQUEST:**\n`;
    }
    
    if (isMotoko) {
      prompt += `Please fix this Motoko ${errorCategory} error with focused attention. `;
      prompt += `This is ${extractedError.priorityClassification?.blockingUserGoal ? 'BLOCKING your main goal' : 'impacting your progress'} and needs specific resolution.\n\n`;
      
      // Check if this is a syntax error involving 'and' with switch expression
      const isAndSwitchError = extractedError.errorMessage?.toLowerCase().includes('unexpected token') && 
                                extractedError.errorMessage?.toLowerCase().includes('switch') &&
                                (extractedError.codeContext?.includes(' and ') || extractedError.codeContext?.includes(' and\n'));
      
      if (isAndSwitchError) {
        prompt += `**CRITICAL: This is a Motoko syntax error involving 'and' operator with switch expression.**\n`;
        prompt += `In Motoko, you cannot use 'and' to directly combine a boolean expression with a switch expression.\n`;
        prompt += `The switch expression must be wrapped in parentheses when used with 'and'.\n\n`;
        prompt += `**Example of the problem:**\n`;
        prompt += `\`\`\`motoko\n`;
        prompt += `func(t: Task): Bool {\n`;
        prompt += `    t.owner == msg.caller and\n`;
        prompt += `    switch (t.projectId) {  // ❌ ERROR: switch cannot follow 'and' directly\n`;
        prompt += `        case (?projId) { projId == projectId };\n`;
        prompt += `        case null { false };\n`;
        prompt += `    }\n`;
        prompt += `}\n`;
        prompt += `\`\`\`\n\n`;
        prompt += `**Corrected version:**\n`;
        prompt += `\`\`\`motoko\n`;
        prompt += `func(t: Task): Bool {\n`;
        prompt += `    t.owner == msg.caller and (\n`;
        prompt += `        switch (t.projectId) {  // ✅ CORRECT: switch wrapped in parentheses\n`;
        prompt += `            case (?projId) projId == projectId;\n`;
        prompt += `            case null false;\n`;
        prompt += `        }\n`;
        prompt += `    )\n`;
        prompt += `}\n`;
        prompt += `\`\`\`\n\n`;
        prompt += `**Key fixes:**\n`;
        prompt += `1. Wrap the switch expression in parentheses: \`(\` ... \`)\`\n`;
        prompt += `2. Remove braces from case expressions (they're not needed for single expressions)\n`;
        prompt += `3. Ensure proper indentation and formatting\n\n`;
      }
      
      prompt += `**Requirements:**\n`;
      prompt += `1. **Focus on this specific error** - don't make unrelated changes\n`;
      prompt += `2. **Understand the blocking impact** - this prevents progress toward your main goal\n`;
      prompt += `3. **Generate complete, corrected files** that resolve this exact issue\n`;
      prompt += `4. **Maintain all existing functionality** and follow Motoko best practices\n`;
      prompt += `5. **Provide extraction-ready complete files** with proper markers\n\n`;
    } else {
      prompt += `Please fix this frontend ${errorCategory} error with focused attention. `;
      prompt += `This is ${extractedError.priorityClassification?.blockingUserGoal ? 'BLOCKING your main goal' : 'impacting your progress'} and needs specific resolution.\n\n`;
      
      prompt += `**Requirements:**\n`;
      prompt += `1. **Focus on this specific error** - don't make unrelated changes\n`;
      prompt += `2. **Understand the blocking impact** - this prevents frontend compilation/bundling\n`;
      prompt += `3. **Generate complete, corrected files** that resolve this exact issue\n`;
      prompt += `4. **Ensure TypeScript types are correct** and all imports are properly resolved\n`;
      prompt += `5. **Provide extraction-ready complete files** with proper markers\n\n`;
    }
    
    prompt += `**Response Format:**\n`;
    prompt += `• Start with clear explanation of the root cause\n`;
    prompt += `• Provide complete, corrected files with proper extraction markers\n`;
    prompt += `• Explain how the fix addresses this specific ${errorCategory} error\n`;
    prompt += `• Confirm the error will no longer block progress\n`;
    
    if (extractedError.priorityClassification?.blockingUserGoal) {
      prompt += `• **Focus on resolving the blocking issue** to restore progress toward the main goal\n`;
    }
    
    console.log('✅ [ErrorExtractionService] PHASE 3: Generated priority-coordinated fix prompt:', {
      errorType,
      priorityLevel: priorityIndicator,
      blockingUserGoal: extractedError.priorityClassification?.blockingUserGoal,
      hasConversationContext: !!(options?.conversationFocus || extractedError.conversationContext?.conversationFocus),
      priorityCoordinationActive: extractedError.coordinationMetadata?.priorityCoordinationActive,
      focusedFixRequest: options?.focusedFixRequest
    });
    
    return prompt;
  }
  
  // 🔥 PHASE 3: Get priority coordination status for error extraction
  static getPriorityCoordinationStatus(): {
    messageCoordinatorReady: boolean;
    priorityCoordinationActive: boolean;
    focusedErrorHandlingEnabled: boolean;
    lastIntegrationCheck: number;
  } {
    return {
      messageCoordinatorReady: this.messageCoordinatorReady,
      priorityCoordinationActive: this.priorityCoordinationActive,
      focusedErrorHandlingEnabled: this.focusedErrorHandlingEnabled,
      lastIntegrationCheck: this.lastIntegrationCheck
    };
  }
  
  // 🔥 PHASE 3: Refresh MessageCoordinator integration
  static refreshMessageCoordinatorIntegration(): void {
    console.log('🔄 [ErrorExtractionService] PHASE 3: Refreshing MessageCoordinator integration for error extraction');
    this.lastIntegrationCheck = 0; // Force re-validation
    this.validateMessageCoordinatorIntegration();
  }
  
  // 🔥 PHASE 3: Create priority-coordinated error message directly
  static createPriorityCoordinatedErrorMessage(
    projectId: string,
    extractedError: EnhancedExtractedError,
    options?: {
      conversationFocus?: string;
      priorityContext?: any;
      focusedFixRequest?: boolean;
    }
  ): { success: boolean; messageId?: string } {
    try {
      if (!this.priorityCoordinationActive) {
        console.warn('⚠️ [ErrorExtractionService] PHASE 3: Priority coordination not active, cannot create coordinated error message');
        return { success: false };
      }
      
      const fixPrompt = this.generateFixPrompt(extractedError, 'Project', {
        priorityContext: options?.priorityContext,
        conversationFocus: options?.conversationFocus,
        focusedFixRequest: options?.focusedFixRequest
      });
      
      // Use MessageCoordinator to create coordinated error message
      const result = messageCoordinator.createCoordinatedUserMessage(
        projectId,
        fixPrompt,
        extractedError.priorityClassification?.priorityLevel || 'HIGH',
        {
          enableCoordination: true,
          requestPriorityContext: true,
          maxTokenBudget: 16000,
          responseToInstructionId: extractedError.conversationContext?.relatedInstructionId,
          savePriority: 90,
          coordinationMetadata: {
            messageType: 'priority_coordinated_error_fix',
            errorType: extractedError.type,
            errorCategory: extractedError.priorityClassification?.errorCategory,
            blockingUserGoal: extractedError.priorityClassification?.blockingUserGoal,
            extractionService: true,
            focusedErrorHandling: true
          }
        }
      );
      
      if (result.success) {
        console.log('✅ [ErrorExtractionService] PHASE 3: Priority-coordinated error message created:', result.messageId);
        return { success: true, messageId: result.messageId };
      } else {
        console.error('❌ [ErrorExtractionService] PHASE 3: Failed to create priority-coordinated error message');
        return { success: false };
      }
      
    } catch (error) {
      console.error('❌ [ErrorExtractionService] PHASE 3: Exception creating priority-coordinated error message:', error);
      return { success: false };
    }
  }
}