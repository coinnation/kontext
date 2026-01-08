export interface DeploymentErrorState {
  hasErrors: boolean;
  canAutoFix: boolean;
  errorCount: number;
  warningCount: number;
  summary: string;
}

export interface MotokoError {
  filePath: string;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  errorType: 'error' | 'warning';
  errorCode: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  category: 'type' | 'field' | 'deprecated' | 'trap' | 'syntax' | 'other';
}

export interface CodeExtractionContext {
  fileName: string;
  lineNumber: number;
  codeSnippet: string;
  contextBefore: string;
  contextAfter: string;
}

export interface MotokoFixRequest {
  errors: MotokoError[];
  codeContexts: CodeExtractionContext[];
  formattedMessage: string;
}

export interface DiagnosticItem {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  notes?: any[];
}

export interface FrontendError {
  errorType: 'frontend';
  errorMessage: string;
  errorCategory: 'import' | 'typescript' | 'syntax' | 'dependency' | 'other';
  severity: 'high' | 'medium' | 'low';
  canAutoFix: boolean;
}

export class DeploymentErrorHandler {
  private static instance: DeploymentErrorHandler;
  private currentErrors: MotokoError[] = [];
  private currentWarnings: MotokoError[] = [];
  private currentFrontendError: FrontendError | null = null;
  private currentFixRequest: MotokoFixRequest | null = null;
  private currentFrontendFixRequest: string | null = null;
  private fileContents: { [fileName: string]: string } = {};

  private constructor() {}

  static getInstance(): DeploymentErrorHandler {
    if (!DeploymentErrorHandler.instance) {
      DeploymentErrorHandler.instance = new DeploymentErrorHandler();
    }
    return DeploymentErrorHandler.instance;
  }

  /**
   * Parse raw Motoko error output using the improved and tested regex pattern
   */
  private parseMotokoErrors(text: string): DiagnosticItem[] {
    // 1. Remove everything up to the last quoted .mo file
    const clean = text.replace(/^.*"([^"]*\.mo)"\s*/s, '');

    // 2. Match all Motoko errors using the improved regex
    const RE = /(.+?\.mo):(\d+)\.(\d+)(?:-(\d+)\.(\d+))?:\s*(?:\w+\s+)?(error|warning|info)\s+\[([A-Z]\d{4})\],\s*(.+?)(?=\s+\S+?\.mo:\d+\.\d+|$)/gs;

    function toSeverity(s: string): 'error' | 'warn' | 'info' {
      return s === 'error' ? 'error' : s === 'warning' ? 'warn' : 'info';
    }

    const out: DiagnosticItem[] = [];
    let m;

    while ((m = RE.exec(clean)) !== null) {
      const [, file, L1, C1, L2, C2, sev, code, msg] = m;
      out.push({
        file: file.trim(),
        line: +L1,
        column: +C1,
        endLine: L2 ? +L2 : +L1,
        endColumn: C2 ? +C2 : +C1,
        severity: toSeverity(sev),
        code,
        message: msg.trim(),
        notes: []
      });
    }

    console.log('🎯 Parsed Motoko errors with improved regex:', {
      originalTextLength: text.length,
      cleanedTextLength: clean.length,
      matchedErrors: out.length,
      errorCodes: out.map(d => d.code)
    });

    return out;
  }

  /**
   * Process deployment error output - ALL ERRORS ARE TREATED AS FIXABLE
   */
  processDeploymentError(
    errorOutput: string, 
    fileContents: { [fileName: string]: string },
    diagnostics?: DiagnosticItem[]
  ): DeploymentErrorState {
    console.log('🔧 DeploymentErrorHandler: Processing error output (ALL ERRORS ARE FIXABLE)...', {
      hasRawOutput: !!errorOutput,
      hasDiagnostics: !!diagnostics,
      diagnosticsCount: diagnostics?.length || 0
    });
    
    // Store file contents for context extraction
    this.fileContents = fileContents;
    
    try {
      let processedDiagnostics: DiagnosticItem[] = [];

      // Use provided structured diagnostics or parse from raw output
      if (diagnostics && diagnostics.length > 0) {
        console.log('🎯 Using provided structured diagnostics');
        processedDiagnostics = diagnostics;
      } else {
        console.log('🔍 Parsing raw Motoko error output with improved regex');
        processedDiagnostics = this.parseMotokoErrors(errorOutput);
      }
      
      // Convert to internal error format
      const { errors, warnings } = this.processDiagnostics(processedDiagnostics);
      
      console.log('🔧 DeploymentErrorHandler: Processed results:', {
        errors: errors.length,
        warnings: warnings.length
      });
      
      // Update internal state
      this.currentErrors = errors;
      this.currentWarnings = warnings;
      this.currentFrontendError = null; // Clear any previous frontend error
      
      // ALWAYS create fix request if we have ANY errors or warnings
      if (errors.length > 0 || warnings.length > 0) {
        const contexts = this.extractCodeContexts(errors, fileContents);
        this.currentFixRequest = this.formatFixRequest(errors, warnings, contexts);
        console.log('🔧 DeploymentErrorHandler: Created fix request with contexts:', contexts.length);
      } else {
        this.currentFixRequest = null;
      }
      
      // Clear frontend fix request
      this.currentFrontendFixRequest = null;
      
      const state: DeploymentErrorState = {
        hasErrors: errors.length + warnings.length > 0,
        canAutoFix: true, // ALL ERRORS ARE NOW CONSIDERED FIXABLE
        errorCount: errors.length,
        warningCount: warnings.length,
        summary: this.createErrorSummary(errors, warnings)
      };
      
      console.log('✅ DeploymentErrorHandler: Final state (ALL ERRORS FIXABLE):', state);
      return state;
      
    } catch (error) {
      console.error('❌ DeploymentErrorHandler: Failed to process errors:', error);
      
      // Even fallback state is fixable
      return {
        hasErrors: true,
        canAutoFix: true, // ALWAYS TRUE NOW
        errorCount: 1,
        warningCount: 0,
        summary: 'Error processing failed - but AI can still help analyze this issue'
      };
    }
  }

  /**
   * Process frontend bundling errors - ALL ERRORS ARE TREATED AS FIXABLE
   */
  processFrontendError(errorOutput: string): DeploymentErrorState {
    console.log('🎨 DeploymentErrorHandler: Processing frontend error (ALL ERRORS ARE FIXABLE)...', {
      errorLength: errorOutput.length
    });

    try {
      // Clear Motoko error state
      this.currentErrors = [];
      this.currentWarnings = [];
      this.currentFixRequest = null;

      // Categorize frontend error (for better prompts, not for filtering)
      const frontendError = this.categorizeFrontendError(errorOutput);
      this.currentFrontendError = frontendError;

      // ALWAYS generate fix request for frontend errors
      this.currentFrontendFixRequest = this.formatFrontendFixRequest(frontendError);
      console.log('🎨 DeploymentErrorHandler: Created frontend fix request');

      const state: DeploymentErrorState = {
        hasErrors: true,
        canAutoFix: true, // ALL ERRORS ARE FIXABLE
        errorCount: 1,
        warningCount: 0,
        summary: `Frontend bundling error: ${frontendError.errorCategory}`
      };

      console.log('✅ DeploymentErrorHandler: Frontend error state (ALWAYS FIXABLE):', state);
      return state;

    } catch (error) {
      console.error('❌ DeploymentErrorHandler: Failed to process frontend error:', error);
      
      // Even error processing failures are fixable
      return {
        hasErrors: true,
        canAutoFix: true, // ALWAYS TRUE
        errorCount: 1,
        warningCount: 0,
        summary: 'Frontend error processing failed - but AI can still help analyze this issue'
      };
    }
  }

  /**
   * Categorize frontend errors based on error message patterns (for better prompts, not filtering)
   */
  private categorizeFrontendError(errorMessage: string): FrontendError {
    const lowerMessage = errorMessage.toLowerCase();

    // Import resolution errors
    if (lowerMessage.includes('could not resolve') || 
        lowerMessage.includes('module not found') ||
        lowerMessage.includes('cannot resolve module')) {
      return {
        errorType: 'frontend',
        errorMessage,
        errorCategory: 'import',
        severity: 'high',
        canAutoFix: true
      };
    }

    // TypeScript compilation errors
    if (lowerMessage.includes('typescript') || 
        lowerMessage.includes('type error') ||
        lowerMessage.includes('ts(') ||
        lowerMessage.includes('property') && lowerMessage.includes('does not exist')) {
      return {
        errorType: 'frontend',
        errorMessage,
        errorCategory: 'typescript',
        severity: 'medium',
        canAutoFix: true
      };
    }

    // Syntax errors
    if (lowerMessage.includes('syntax error') || 
        lowerMessage.includes('unexpected token') ||
        lowerMessage.includes('parsing error')) {
      return {
        errorType: 'frontend',
        errorMessage,
        errorCategory: 'syntax',
        severity: 'high',
        canAutoFix: true
      };
    }

    // Dependency issues
    if (lowerMessage.includes('dependency') || 
        lowerMessage.includes('package') ||
        lowerMessage.includes('npm') ||
        lowerMessage.includes('node_modules')) {
      return {
        errorType: 'frontend',
        errorMessage,
        errorCategory: 'dependency',
        severity: 'medium',
        canAutoFix: true
      };
    }

    // Default to other category - ALL ARE FIXABLE
    return {
      errorType: 'frontend',
      errorMessage,
      errorCategory: 'other',
      severity: 'medium',
      canAutoFix: true
    };
  }

  /**
   * Format frontend fix request for AI - COMPREHENSIVE APPROACH FOR ALL ERRORS
   */
  private formatFrontendFixRequest(frontendError: FrontendError): string {
    const messageHeader = `🎨 **FRONTEND BUNDLING ERROR DETECTED** 🎨\n\n`;
    
    let messageBody = `The frontend bundling failed during deployment with the following error:\n\n`;
    messageBody += `**Error Category**: ${frontendError.errorCategory.toUpperCase()} ERROR\n`;
    messageBody += `**Error Message**:\n\`\`\`\n${frontendError.errorMessage}\n\`\`\`\n\n`;
    
    let messageFooter = `Please analyze this bundling error and provide assistance. Even if you cannot provide a complete fix, please help by:\n\n`;
    
    // Universal guidance for all error types
    messageFooter += `**Immediate Help:**\n`;
    messageFooter += `• Explain what this error means in simple terms\n`;
    messageFooter += `• Identify the likely root cause of the issue\n`;
    messageFooter += `• Suggest specific debugging steps or investigation approaches\n`;
    messageFooter += `• Provide any code fixes or corrections if possible\n\n`;
    
    // Category-specific guidance (additive, not discriminatory)
    switch (frontendError.errorCategory) {
      case 'import':
        messageFooter += `**For Import Issues:**\n`;
        messageFooter += `• Check if the imported file exists and create it if missing\n`;
        messageFooter += `• Verify the import path is correct\n`;
        messageFooter += `• Ensure proper file extensions are used\n`;
        messageFooter += `• Fix any case sensitivity issues in file names\n\n`;
        break;
        
      case 'typescript':
        messageFooter += `**For TypeScript Issues:**\n`;
        messageFooter += `• Fix any type mismatches or interface violations\n`;
        messageFooter += `• Add missing type definitions if needed\n`;
        messageFooter += `• Correct property access issues\n`;
        messageFooter += `• Ensure proper TypeScript syntax\n\n`;
        break;
        
      case 'syntax':
        messageFooter += `**For Syntax Issues:**\n`;
        messageFooter += `• Fix any malformed syntax or missing brackets\n`;
        messageFooter += `• Correct any parsing issues\n`;
        messageFooter += `• Ensure proper JavaScript/TypeScript formatting\n\n`;
        break;
        
      case 'dependency':
        messageFooter += `**For Dependency Issues:**\n`;
        messageFooter += `• Add any missing dependencies to package.json\n`;
        messageFooter += `• Fix import paths for installed packages\n`;
        messageFooter += `• Resolve any package version conflicts\n\n`;
        break;
        
      default:
        messageFooter += `**General Analysis:**\n`;
        messageFooter += `• Provide insights based on the error pattern\n`;
        messageFooter += `• Suggest relevant documentation or resources\n`;
        messageFooter += `• Recommend systematic debugging approaches\n\n`;
    }
    
    messageFooter += `**Final Request:**\n`;
    messageFooter += `If you can provide corrected code, please do so. If not, provide detailed guidance on resolving this issue. `;
    messageFooter += `This is part of a full-stack deployment, so focus on getting the build working properly. `;
    messageFooter += `Even partial solutions or debugging guidance will be extremely helpful.`;

    return messageHeader + messageBody + messageFooter;
  }

  /**
   * Process structured diagnostics from parser
   */
  private processDiagnostics(diagnostics: DiagnosticItem[]): { errors: MotokoError[], warnings: MotokoError[] } {
    const errors: MotokoError[] = [];
    const warnings: MotokoError[] = [];

    for (const diagnostic of diagnostics) {
      const motokoError: MotokoError = {
        filePath: this.cleanFilePath(diagnostic.file),
        lineNumber: diagnostic.line,
        columnStart: diagnostic.column,
        columnEnd: diagnostic.endColumn || diagnostic.column,
        errorType: diagnostic.severity === 'error' ? 'error' : 'warning',
        errorCode: diagnostic.code,
        message: diagnostic.message.trim(),
        severity: this.categorizeSeverity(diagnostic.code, diagnostic.message),
        category: this.categorizeError(diagnostic.code, diagnostic.message)
      };

      if (motokoError.errorType === 'warning') {
        warnings.push(motokoError);
      } else {
        errors.push(motokoError);
      }
    }

    console.log('✅ Processed structured diagnostics:', {
      totalDiagnostics: diagnostics.length,
      errors: errors.length,
      warnings: warnings.length
    });

    return { errors, warnings };
  }

  /**
   * Extract code context for errors from file content
   */
  private extractCodeContexts(
    errors: MotokoError[], 
    fileContents: { [fileName: string]: string }
  ): CodeExtractionContext[] {
    const contexts: CodeExtractionContext[] = [];
    const LINE_CONTEXT_SIZE = 3;
    
    for (const error of errors) {
      const cleanPath = this.cleanFilePath(error.filePath);
      const fileContent = this.findFileContent(cleanPath, fileContents);
      
      if (!fileContent) {
        console.warn(`Could not find file content for: ${cleanPath}`);
        continue;
      }
      
      const lines = fileContent.split('\n');
      const targetLineIndex = error.lineNumber - 1; // Convert to 0-based
      
      if (targetLineIndex < 0 || targetLineIndex >= lines.length) {
        console.warn(`Line ${error.lineNumber} not found in file ${cleanPath}`);
        continue;
      }
      
      const contextStart = Math.max(0, targetLineIndex - LINE_CONTEXT_SIZE);
      const contextEnd = Math.min(lines.length - 1, targetLineIndex + LINE_CONTEXT_SIZE);
      
      const contextBefore = lines.slice(contextStart, targetLineIndex).join('\n');
      const codeSnippet = lines[targetLineIndex] || '';
      const contextAfter = lines.slice(targetLineIndex + 1, contextEnd + 1).join('\n');
      
      contexts.push({
        fileName: cleanPath,
        lineNumber: error.lineNumber,
        codeSnippet,
        contextBefore,
        contextAfter
      });
    }
    
    return contexts;
  }

  /**
   * Format errors into a fix request message for the AI - COMPREHENSIVE APPROACH FOR ALL ERRORS
   */
  private formatFixRequest(errors: MotokoError[], warnings: MotokoError[], contexts: CodeExtractionContext[]): MotokoFixRequest {
    const allIssues = [...errors, ...warnings]; // Include both errors and warnings
    
    const formattedIssues = allIssues.map(issue => {
        const context = contexts.find(c => c.lineNumber === issue.lineNumber);
        
        let issueDescription = `**${issue.category.toUpperCase()} ${issue.errorType.toUpperCase()}** (${issue.errorCode}) at line ${issue.lineNumber}:\n`;
        issueDescription += `${issue.message}\n`;
        
        if (context) {
          issueDescription += `\n**Code Location:**\n`;
          issueDescription += `\`\`\`motoko\n`;
          
          if (context.contextBefore.trim()) {
            issueDescription += `// Context before (lines ${Math.max(1, issue.lineNumber - 3)} to ${issue.lineNumber - 1}):\n`;
            issueDescription += `${context.contextBefore}\n`;
          }
          
          issueDescription += `// ${issue.errorType.toUpperCase()} ON THIS LINE (line ${issue.lineNumber}):\n`;
          issueDescription += `${context.codeSnippet}\n`;
          
          if (context.contextAfter.trim()) {
            issueDescription += `// Context after (lines ${issue.lineNumber + 1} to ${Math.min(context.codeSnippet.split('\n').length, issue.lineNumber + 3)}):\n`;
            issueDescription += `${context.contextAfter}\n`;
          }
          
          issueDescription += `\`\`\`\n`;
        }
        
        return issueDescription;
      });

    const messageHeader = `🔧 **MOTOKO COMPILATION ISSUES DETECTED** 🔧\n\n`;
    const messageBody = `I need help with ${allIssues.length} compilation issue${allIssues.length > 1 ? 's' : ''} in my Motoko backend code:\n\n`;
    const issuesSection = formattedIssues.join('\n---\n\n');
    
    let messageFooter = `\n\n**Please help by providing:**\n\n`;
    messageFooter += `**Immediate Assistance:**\n`;
    messageFooter += `• Clear explanation of what each issue means\n`;
    messageFooter += `• Identification of root causes for these problems\n`;
    messageFooter += `• Specific code corrections where possible\n`;
    messageFooter += `• Debugging guidance if direct fixes aren't feasible\n\n`;
    
    messageFooter += `**Technical Focus Areas:**\n`;
    messageFooter += `• Type errors (unbound variables, missing identifiers, type mismatches)\n`;
    messageFooter += `• Syntax errors (malformed operators, missing tokens, formatting issues)\n`;
    messageFooter += `• Module and import issues (missing dependencies, incorrect paths)\n`;
    messageFooter += `• API usage problems (deprecated functions, incorrect signatures)\n`;
    messageFooter += `• Actor and canister-specific patterns\n\n`;
    
    // Add specific issue analysis - but don't discriminate based on it
    const errorsByCategory = allIssues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    if (Object.keys(errorsByCategory).length > 0) {
      messageFooter += `**Issue Breakdown:**\n`;
      if (errorsByCategory.type) {
        messageFooter += `• ${errorsByCategory.type} type-related issue(s)\n`;
      }
      if (errorsByCategory.syntax) {
        messageFooter += `• ${errorsByCategory.syntax} syntax issue(s)\n`;
      }
      if (errorsByCategory.field) {
        messageFooter += `• ${errorsByCategory.field} module/field issue(s)\n`;
      }
      if (errorsByCategory.deprecated) {
        messageFooter += `• ${errorsByCategory.deprecated} deprecation warning(s)\n`;
      }
      if (errorsByCategory.trap) {
        messageFooter += `• ${errorsByCategory.trap} potential runtime issue(s)\n`;
      }
      if (errorsByCategory.other) {
        messageFooter += `• ${errorsByCategory.other} other issue(s)\n`;
      }
      messageFooter += `\n`;
    }
    
    messageFooter += `**Final Request:**\n`;
    messageFooter += `Please provide corrected code where possible, or detailed guidance for resolution. `;
    messageFooter += `Even if some issues are complex, any assistance with analysis, explanation, or partial solutions will be extremely valuable. `;
    messageFooter += `I'm working on a full-stack deployment, so getting the Motoko compilation working is critical.`;

    const formattedMessage = messageHeader + messageBody + issuesSection + messageFooter;

    return {
      errors,
      codeContexts: contexts,
      formattedMessage
    };
  }

  /**
   * Create a simplified error summary for UI display
   */
  private createErrorSummary(errors: MotokoError[], warnings: MotokoError[]): string {
    let summary = '';
    if (errors.length > 0) {
      summary += `${errors.length} error${errors.length > 1 ? 's' : ''}`;
    }
    if (warnings.length > 0) {
      if (summary) summary += ', ';
      summary += `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`;
    }
    
    // Add most common error types for context
    const allIssues = [...errors, ...warnings];
    const errorTypes = allIssues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topErrorType = Object.entries(errorTypes)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topErrorType) {
      summary += ` (${topErrorType[0]} issues detected)`;
    }
    
    return summary;
  }

  /**
   * Get the current fix request message for the AI
   */
  getFixRequestMessage(): string | null {
    // Return frontend fix request if we have a frontend error
    if (this.currentFrontendError && this.currentFrontendFixRequest) {
      return this.currentFrontendFixRequest;
    }
    
    // Return Motoko fix request if we have Motoko errors or warnings
    return this.currentFixRequest?.formattedMessage || null;
  }

  /**
   * Get error summary for UI display
   */
  getErrorSummary(): string {
    if (this.currentFrontendError) {
      return `Frontend ${this.currentFrontendError.errorCategory} error`;
    }
    
    if (this.currentErrors.length === 0 && this.currentWarnings.length === 0) {
      return '';
    }
    
    return this.createErrorSummary(this.currentErrors, this.currentWarnings);
  }

  /**
   * Create user-friendly explanation of the errors
   */
  createUserFriendlyExplanation(): string {
    if (this.currentFrontendError) {
      const categoryExplanations = {
        import: 'import resolution issues (missing files or incorrect paths)',
        typescript: 'TypeScript compilation problems (type mismatches or interface violations)',
        syntax: 'JavaScript/TypeScript syntax errors (malformed code structure)',
        dependency: 'package dependency issues (missing or conflicting packages)',
        other: 'general bundling issues'
      };
      
      return categoryExplanations[this.currentFrontendError.errorCategory] || 'frontend bundling issues';
    }
    
    if (this.currentErrors.length === 0 && this.currentWarnings.length === 0) {
      return '';
    }
    
    const allIssues = [...this.currentErrors, ...this.currentWarnings];
    const issuesByCategory = allIssues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const explanations: string[] = [];
    
    if (issuesByCategory.syntax) {
      explanations.push(`${issuesByCategory.syntax} syntax issue${issuesByCategory.syntax > 1 ? 's' : ''} (code structure problems)`);
    }
    
    if (issuesByCategory.type) {
      explanations.push(`${issuesByCategory.type} type issue${issuesByCategory.type > 1 ? 's' : ''} (type system problems)`);
    }
    
    if (issuesByCategory.field) {
      explanations.push(`${issuesByCategory.field} module issue${issuesByCategory.field > 1 ? 's' : ''} (import or field problems)`);
    }
    
    if (issuesByCategory.deprecated) {
      explanations.push(`${issuesByCategory.deprecated} deprecation issue${issuesByCategory.deprecated > 1 ? 's' : ''} (outdated API usage)`);
    }
    
    if (issuesByCategory.trap) {
      explanations.push(`${issuesByCategory.trap} potential runtime issue${issuesByCategory.trap > 1 ? 's' : ''} (safety concerns)`);
    }
    
    if (issuesByCategory.other) {
      explanations.push(`${issuesByCategory.other} other issue${issuesByCategory.other > 1 ? 's' : ''} (various problems)`);
    }
    
    return explanations.length > 0 ? explanations.join(', ') : 'Various compilation issues detected - AI can help analyze and resolve these';
  }

  /**
   * Check if there are structured errors available
   */
  hasStructuredErrors(): boolean {
    return this.currentErrors.length > 0 || this.currentWarnings.length > 0 || this.currentFrontendError !== null;
  }

  /**
   * Get count of blocking errors (includes warnings since we treat everything as actionable)
   */
  getBlockingErrorsCount(): number {
    if (this.currentFrontendError) {
      return 1;
    }
    return this.currentErrors.length + this.currentWarnings.length; // Count warnings too since they're all actionable
  }

  /**
   * Get count of warnings
   */
  getWarningsCount(): number {
    return this.currentWarnings.length;
  }

  /**
   * Clear all error state
   */
  clearErrors(): void {
    this.currentErrors = [];
    this.currentWarnings = [];
    this.currentFrontendError = null;
    this.currentFixRequest = null;
    this.currentFrontendFixRequest = null;
    this.fileContents = {};
    console.log('🧹 DeploymentErrorHandler: Cleared all error state');
  }

  /**
   * Get detailed error information for debugging
   */
  getDetailedErrorInfo(): { 
    errors: MotokoError[], 
    warnings: MotokoError[], 
    frontendError: FrontendError | null,
    fixRequest: MotokoFixRequest | null,
    frontendFixRequest: string | null 
  } {
    return {
      errors: this.currentErrors,
      warnings: this.currentWarnings,
      frontendError: this.currentFrontendError,
      fixRequest: this.currentFixRequest,
      frontendFixRequest: this.currentFrontendFixRequest
    };
  }

  /**
   * Serialize current state for persistence
   */
  getSerializedState(): string {
    try {
      const state = {
        errors: this.currentErrors,
        warnings: this.currentWarnings,
        frontendError: this.currentFrontendError,
        fixRequest: this.currentFixRequest,
        frontendFixRequest: this.currentFrontendFixRequest,
        timestamp: Date.now()
      };
      return JSON.stringify(state);
    } catch (error) {
      console.warn('Failed to serialize error handler state:', error);
      return '{}';
    }
  }

  /**
   * Restore state from serialized data
   */
  restoreFromSerializedState(serializedState: string): boolean {
    try {
      const state = JSON.parse(serializedState);
      
      this.currentErrors = state.errors || [];
      this.currentWarnings = state.warnings || [];
      this.currentFrontendError = state.frontendError || null;
      this.currentFixRequest = state.fixRequest || null;
      this.currentFrontendFixRequest = state.frontendFixRequest || null;
      
      console.log('✅ Restored error handler state from serialized data');
      return true;
    } catch (error) {
      console.warn('Failed to restore error handler state:', error);
      return false;
    }
  }

  // Private helper methods
  private categorizeSeverity(errorCode: string, message: string): 'high' | 'medium' | 'low' {
    const lowerErrorCode = errorCode.toLowerCase();
    const lowerMessage = message.toLowerCase();
    
    // M000X series are syntax errors (high severity)
    if (lowerErrorCode.startsWith('m000') || 
        lowerMessage.includes('syntax error') ||
        lowerMessage.includes('malformed') ||
        lowerMessage.includes('parse error')) {
      return 'high';
    }
    
    // M005X and M009X series are type errors (high severity)
    if (lowerMessage.includes('type error') || 
        lowerMessage.includes('cannot produce expected type') ||
        lowerMessage.includes('unbound variable') ||
        lowerErrorCode.startsWith('m005') ||
        lowerErrorCode.startsWith('m009')) {
      return 'high';
    }
    
    // M015X and M019X series, deprecated fields (medium severity)
    if (lowerMessage.includes('does not exist') || 
        lowerMessage.includes('deprecated') ||
        lowerErrorCode.startsWith('m015') ||
        lowerErrorCode.startsWith('m019') ||
        lowerErrorCode.startsWith('m154')) {
      return 'medium';
    }
    
    return 'low';
  }

  private categorizeError(errorCode: string, message: string): 'type' | 'field' | 'deprecated' | 'trap' | 'syntax' | 'other' {
    const lowerMessage = message.toLowerCase();
    const lowerErrorCode = errorCode.toLowerCase();
    
    console.log('🔍 Categorizing error:', { errorCode, message: message.substring(0, 100) + '...' });
    
    // Check error codes first (most reliable)
    if (lowerErrorCode.match(/^m000\d$/)) {
      console.log('✅ Categorized as SYNTAX via error code:', errorCode);
      return 'syntax';
    }
    
    if (lowerErrorCode.match(/^m005\d$/)) {
      console.log('✅ Categorized as TYPE via error code:', errorCode);
      return 'type';
    }
    
    if (lowerErrorCode.match(/^m009\d$/)) {
      console.log('✅ Categorized as TYPE via error code:', errorCode);
      return 'type';
    }
    
    if (lowerErrorCode.match(/^m015\d$/)) {
      console.log('✅ Categorized as TRAP via error code:', errorCode);
      return 'trap';
    }
    
    if (lowerErrorCode.match(/^m019\d$/)) {
      console.log('✅ Categorized as OTHER via error code (capability):', errorCode);
      return 'other';
    }
    
    if (lowerErrorCode.match(/^m154$/)) {
      console.log('✅ Categorized as DEPRECATED via error code:', errorCode);
      return 'deprecated';
    }

    // Syntax error patterns
    const syntaxErrorPatterns = [
      'syntax error',
      'malformed operator',
      'malformed',
      'parse error',
      'unexpected token',
      'expected',
      'missing'
    ];
    
    for (const pattern of syntaxErrorPatterns) {
      if (lowerMessage.includes(pattern)) {
        console.log('✅ Categorized as SYNTAX via pattern:', pattern);
        return 'syntax';
      }
    }
    
    // Type error patterns
    const typeErrorPatterns = [
      'expression of type',           
      'cannot produce expected type', 
      'type error',                   
      'expected type',               
      'type mismatch',               
      'mismatched types',            
      'literal of type',             
      'incompatible types',          
      'wrong type',                  
      'type annotation',
      'unbound variable'
    ];
    
    for (const pattern of typeErrorPatterns) {
      if (lowerMessage.includes(pattern)) {
        console.log('✅ Categorized as TYPE via pattern:', pattern);
        return 'type';
      }
    }
    
    // Field/module error patterns
    const fieldErrorPatterns = [
      'does not exist in module',
      'field',
      'module',
      'not found in',
      'undefined field',
      'no such field',
      'unknown field'
    ];
    
    for (const pattern of fieldErrorPatterns) {
      if (lowerMessage.includes(pattern) && lowerMessage.includes('does not exist')) {
        console.log('✅ Categorized as FIELD via pattern:', pattern);
        return 'field';
      }
    }
    
    // Deprecation patterns
    const deprecationPatterns = [
      'deprecated',
      'will be removed',
      'use instead',
      'obsolete',
      'legacy'
    ];
    
    for (const pattern of deprecationPatterns) {
      if (lowerMessage.includes(pattern)) {
        console.log('✅ Categorized as DEPRECATED via pattern:', pattern);
        return 'deprecated';
      }
    }
    
    // Trap patterns
    const trapPatterns = [
      'may trap',
      'operator may trap',
      'will trap',
      'trap on',
      'overflow',
      'underflow',
      'division by zero'
    ];
    
    for (const pattern of trapPatterns) {
      if (lowerMessage.includes(pattern)) {
        console.log('✅ Categorized as TRAP via pattern:', pattern);
        return 'trap';
      }
    }
    
    console.log('⚠️ Categorized as OTHER (no pattern matched):', { errorCode, messagePreview: lowerMessage.substring(0, 100) });
    return 'other';
  }

  private cleanFilePath(filePath: string): string {
    // Remove leading/trailing whitespace and normalize path separators
    let cleaned = filePath.trim().replace(/\\/g, '/');
    
    // Handle project name prefixes in file paths
    if (cleaned.includes('/')) {
      const parts = cleaned.split('/');
      // If it starts with a project name, preserve the structure
      if (parts.length > 3 && parts[0] && !parts[0].includes('.mo')) {
        // This looks like "Project Name/src/backend/src/main.mo"
        return cleaned;
      }
    }
    
    return cleaned;
  }

  private findFileContent(targetPath: string, fileContents: { [fileName: string]: string }): string | null {
    console.log('🔍 DeploymentErrorHandler: Looking for file content:', targetPath);
    console.log('🔍 DeploymentErrorHandler: Available files:', Object.keys(fileContents));
    
    // Direct match
    if (fileContents[targetPath]) {
      console.log('✅ DeploymentErrorHandler: Direct match found');
      return fileContents[targetPath];
    }
    
    // Try to find by filename match (in case of path differences)
    const targetFilename = targetPath.split('/').pop();
    if (!targetFilename) return null;
    
    for (const [filePath, content] of Object.entries(fileContents)) {
      if (filePath.endsWith(targetFilename) || filePath.includes(targetFilename)) {
        console.log('✅ DeploymentErrorHandler: Filename match found:', filePath);
        return content;
      }
    }
    
    // Try to find Motoko files (.mo extension) with partial path matching
    if (targetFilename.endsWith('.mo')) {
      const baseFilename = targetFilename.replace('.mo', '');
      for (const [filePath, content] of Object.entries(fileContents)) {
        if (filePath.endsWith('.mo') && 
            (filePath.includes(baseFilename) || filePath.endsWith(`/${targetFilename}`))) {
          console.log('✅ DeploymentErrorHandler: Motoko partial match found:', filePath);
          return content;
        }
      }
    }
    
    console.log('❌ DeploymentErrorHandler: No file content found for:', targetPath);
    return null;
  }
}