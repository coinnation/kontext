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

export interface ParsedMotokoErrors {
  errors: MotokoError[];
  warnings: MotokoError[];
  totalIssues: number;
  hasBlockingErrors: boolean;
  affectedFiles: string[];
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

export class MotokoErrorParser {
  // ENHANCED: More comprehensive regex patterns for different error formats
  private static readonly ERROR_PATTERNS = [
    // Primary pattern: file.mo:line.col-line.col: error/warning [CODE], message
    /([^:\s]+\.mo):(\d+)\.(\d+)-(\d+)\.(\d+):\s+(warning|type error|syntax error|error)\s+\[([^\]]+)\],\s*(.+)/gm,
    
    // Alternative pattern: file.mo:line.col: error/warning [CODE], message
    /([^:\s]+\.mo):(\d+)\.(\d+):\s+(warning|type error|syntax error|error)\s+\[([^\]]+)\],\s*(.+)/gm,
    
    // Simple format: file.mo:line: error message (no code)
    /([^:\s]+\.mo):(\d+):\s+(error|warning):\s*(.+)/gm,
    
    // Flexible format for various Motoko error structures
    /([^:\s\n]+\.mo):(\d+)\.(\d+)(?:-(\d+)\.(\d+))?:\s+(warning|type error|syntax error|error)\s*(?:\[([^\]]+)\])?,?\s*(.+)/gm
  ];

  private static readonly LINE_CONTEXT_SIZE = 3;

  /**
   * Parse Motoko compiler error output with enhanced detection
   */
  static parseMotokoErrors(errorOutput: string): ParsedMotokoErrors {
    const errors: MotokoError[] = [];
    const warnings: MotokoError[] = [];
    const affectedFiles = new Set<string>();

    console.log('🔍 MotokoErrorParser: Starting parse with input length:', errorOutput.length);
    console.log('🔍 MotokoErrorParser: Input preview:', errorOutput.substring(0, 500));
    console.log('🔍 MotokoErrorParser: Full input:', errorOutput);

    // ENHANCED: Pre-process to handle all wrapped formats
    let processedErrorText = this.preprocessErrorOutput(errorOutput);
    console.log('🔍 MotokoErrorParser: Processed text:', processedErrorText);

    // Try each pattern until we find matches
    let totalMatches = 0;
    for (let i = 0; i < this.ERROR_PATTERNS.length; i++) {
      const pattern = this.ERROR_PATTERNS[i];
      pattern.lastIndex = 0; // Reset regex state
      let match;
      let foundMatches = 0;

      console.log(`🔍 MotokoErrorParser: Trying pattern ${i + 1}:`, pattern.source);

      while ((match = pattern.exec(processedErrorText)) !== null) {
        foundMatches++;
        totalMatches++;
        console.log('🎯 MotokoErrorParser: Found match with pattern', i + 1, ':', match);

        const motokoError = this.parseMatchToError(match, pattern, i);
        if (motokoError) {
          console.log('✅ MotokoErrorParser: Successfully parsed error:', {
            filePath: motokoError.filePath,
            lineNumber: motokoError.lineNumber,
            errorType: motokoError.errorType,
            errorCode: motokoError.errorCode,
            category: motokoError.category,
            message: motokoError.message.substring(0, 50) + '...'
          });

          if (motokoError.errorType === 'warning') {
            warnings.push(motokoError);
          } else {
            errors.push(motokoError);
          }
          affectedFiles.add(this.cleanFilePath(motokoError.filePath));
        } else {
          console.warn('❌ MotokoErrorParser: Failed to parse match:', match);
        }
      }

      console.log(`🔍 MotokoErrorParser: Pattern ${i + 1} found ${foundMatches} matches`);
      if (foundMatches > 0) {
        console.log(`✅ MotokoErrorParser: Using pattern ${i + 1} as primary parser`);
        break; // Use first successful pattern
      }
    }

    console.log(`🔍 MotokoErrorParser: Total matches found: ${totalMatches}`);

    const result = {
      errors,
      warnings,
      totalIssues: errors.length + warnings.length,
      hasBlockingErrors: errors.length > 0,
      affectedFiles: Array.from(affectedFiles)
    };

    console.log('✅ MotokoErrorParser: Final result:', {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      affectedFiles: result.affectedFiles,
      hasBlockingErrors: result.hasBlockingErrors
    });

    return result;
  }

  /**
   * ENHANCED: Pre-process error output to handle all wrapped formats
   */
  private static preprocessErrorOutput(errorOutput: string): string {
    console.log('🔧 MotokoErrorParser: Starting preprocessing...');

    // Handle DFXUtils wrapped format
    if (errorOutput.includes('Backend compilation failed:') || 
        errorOutput.includes('WASM compilation failed:') ||
        errorOutput.includes('Command failed:')) {
      
      console.log('🔧 MotokoErrorParser: Detected wrapped error format');
      
      // ENHANCED: Strategy 1 - Extract everything after the quoted .mo file
      const afterQuoteMatch = errorOutput.match(/"([^"]*\.mo)"\s+(.+)$/s);
      if (afterQuoteMatch && afterQuoteMatch[2]) {
        console.log('🎯 MotokoErrorParser: Strategy 1 - After quote extraction');
        const afterQuote = afterQuoteMatch[2];
        console.log('🔧 MotokoErrorParser: After quote content:', afterQuote);
        return this.extractErrorLines(afterQuote);
      }
      
      // ENHANCED: Strategy 2 - Find all .mo error lines directly
      const allMotokoLines = this.extractAllMotokoErrorLines(errorOutput);
      if (allMotokoLines.length > 0) {
        console.log('🎯 MotokoErrorParser: Strategy 2 - Direct .mo line extraction');
        console.log('🔧 MotokoErrorParser: Found .mo lines:', allMotokoLines);
        return allMotokoLines.join('\n');
      }
      
      // ENHANCED: Strategy 3 - Extract from command output section
      const commandOutputMatch = errorOutput.match(/Command failed:[^]*$/s);
      if (commandOutputMatch) {
        console.log('🎯 MotokoErrorParser: Strategy 3 - Command output extraction');
        return this.extractErrorLines(commandOutputMatch[0]);
      }
    }
    
    // ENHANCED: Try direct extraction of .mo error lines from any format
    const directMotokoLines = this.extractAllMotokoErrorLines(errorOutput);
    if (directMotokoLines.length > 0) {
      console.log('🔧 MotokoErrorParser: Direct extraction successful');
      return directMotokoLines.join('\n');
    }
    
    console.log('🔧 MotokoErrorParser: No preprocessing applied, using original');
    return errorOutput;
  }

  /**
   * Extract ALL Motoko error lines from text using comprehensive pattern matching
   */
  private static extractAllMotokoErrorLines(text: string): string[] {
    const errorLines: string[] = [];
    const lines = text.split('\n');
    
    console.log('🔍 MotokoErrorParser: Extracting from', lines.length, 'lines');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // COMPREHENSIVE pattern to match ANY .mo error/warning line
      if (trimmedLine.match(/[^:\s]*\.mo:\d+\.\d+(?:-\d+\.\d+)?:\s+(?:warning|type error|syntax error|error)/)) {
        console.log('✅ MotokoErrorParser: Found .mo error line:', trimmedLine);
        errorLines.push(trimmedLine);
      }
    }
    
    console.log('🔍 MotokoErrorParser: Extracted', errorLines.length, 'error lines');
    return errorLines;
  }

  /**
   * Extract error lines from text using multiple strategies
   */
  private static extractErrorLines(text: string): string {
    const allLines = this.extractAllMotokoErrorLines(text);
    return allLines.length > 0 ? allLines.join('\n') : text;
  }

  /**
   * Parse a regex match into a MotokoError object
   */
  private static parseMatchToError(match: RegExpExecArray, pattern: RegExp, patternIndex: number): MotokoError | null {
    try {
      console.log(`🔧 MotokoErrorParser: Parsing match from pattern ${patternIndex + 1}:`, match);

      let filePath: string = '';
      let lineNumber: number = 1;
      let columnStart: number = 0;
      let columnEnd: number = 0;
      let severity: string = '';
      let errorCode: string = 'M0000';
      let message: string = '';

      // Handle different pattern structures
      if (patternIndex === 0) {
        // Pattern: file.mo:line.col-line.col: error [code], message
        if (match.length >= 9) {
          [, filePath, , columnStart, , columnEnd, severity, errorCode, message] = match;
          lineNumber = parseInt(match[2], 10);
          columnStart = parseInt(match[3], 10);
          columnEnd = parseInt(match[5], 10);
        }
      } else if (patternIndex === 1) {
        // Pattern: file.mo:line.col: error [code], message  
        if (match.length >= 7) {
          [, filePath, , , severity, errorCode, message] = match;
          lineNumber = parseInt(match[2], 10);
          columnStart = parseInt(match[3], 10);
          columnEnd = columnStart;
        }
      } else if (patternIndex === 2) {
        // Pattern: file.mo:line: error message (no code)
        if (match.length >= 5) {
          [, filePath, , severity, message] = match;
          lineNumber = parseInt(match[2], 10);
          errorCode = 'M0000';
        }
      } else if (patternIndex === 3) {
        // Flexible pattern
        if (match.length >= 9) {
          filePath = match[1];
          lineNumber = parseInt(match[2], 10);
          columnStart = parseInt(match[3], 10);
          columnEnd = match[4] ? parseInt(match[5], 10) : columnStart;
          severity = match[6];
          errorCode = match[7] || 'M0000';
          message = match[8];
        }
      }

      console.log('🔧 MotokoErrorParser: Parsed components:', {
        filePath,
        lineNumber,
        columnStart,
        columnEnd,
        severity,
        errorCode,
        message: message.substring(0, 50) + '...'
      });

      const cleanedMessage = message.trim();
      const cleanedErrorCode = errorCode.trim();
      
      const motokoError = {
        filePath: this.cleanFilePath(filePath),
        lineNumber: isNaN(lineNumber) ? 1 : lineNumber,
        columnStart: isNaN(columnStart) ? 0 : columnStart,
        columnEnd: isNaN(columnEnd) ? columnStart : columnEnd,
        errorType: (severity.toLowerCase().includes('warning') ? 'warning' : 'error') as 'error' | 'warning',
        errorCode: cleanedErrorCode,
        message: cleanedMessage,
        severity: this.categorizeSeverity(cleanedErrorCode, cleanedMessage),
        category: this.categorizeError(cleanedErrorCode, cleanedMessage)
      };

      console.log('✅ MotokoErrorParser: Created error object:', motokoError);
      return motokoError;
      
    } catch (error) {
      console.error('❌ MotokoErrorParser: Error parsing match:', error, match);
      return null;
    }
  }

  /**
   * Extract code context for errors from file content
   */
  static extractCodeContexts(
    errors: MotokoError[], 
    fileContents: { [fileName: string]: string }
  ): CodeExtractionContext[] {
    const contexts: CodeExtractionContext[] = [];
    
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
      
      const contextStart = Math.max(0, targetLineIndex - this.LINE_CONTEXT_SIZE);
      const contextEnd = Math.min(lines.length - 1, targetLineIndex + this.LINE_CONTEXT_SIZE);
      
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
   * Format errors into a fix request message for the AI
   */
  static formatFixRequest(errors: MotokoError[], contexts: CodeExtractionContext[]): MotokoFixRequest {
    const formattedErrors = errors
      .filter(e => e.errorType === 'error') // Only include actual errors, not warnings
      .map(error => {
        const context = contexts.find(c => c.lineNumber === error.lineNumber);
        const locationInfo = `${error.filePath}:${error.lineNumber}`;
        
        let errorDescription = `**${error.category.toUpperCase()} ERROR** (${error.errorCode}) at line ${error.lineNumber}:\n`;
        errorDescription += `${error.message}\n`;
        
        if (context) {
          errorDescription += `\n**Problematic code:**\n`;
          errorDescription += `\`\`\`motoko\n`;
          
          if (context.contextBefore.trim()) {
            errorDescription += `// Context before (lines ${Math.max(1, error.lineNumber - this.LINE_CONTEXT_SIZE)} to ${error.lineNumber - 1}):\n`;
            errorDescription += `${context.contextBefore}\n`;
          }
          
          errorDescription += `// ERROR ON THIS LINE (line ${error.lineNumber}):\n`;
          errorDescription += `${context.codeSnippet}\n`;
          
          if (context.contextAfter.trim()) {
            errorDescription += `// Context after (lines ${error.lineNumber + 1} to ${Math.min(context.codeSnippet.split('\n').length, error.lineNumber + this.LINE_CONTEXT_SIZE)}):\n`;
            errorDescription += `${context.contextAfter}\n`;
          }
          
          errorDescription += `\`\`\`\n`;
        }
        
        return errorDescription;
      });

    const messageHeader = `🔧 **MOTOKO COMPILATION ERRORS DETECTED** 🔧\n\n`;
    const messageBody = `I need help fixing ${errors.length} compilation error${errors.length > 1 ? 's' : ''} in my Motoko backend code:\n\n`;
    const errorsSection = formattedErrors.join('\n---\n\n');
    
    let messageFooter = `\n\nPlease analyze these errors and provide the corrected Motoko code for each problematic section. Focus on:\n`;
    messageFooter += `• Type errors (unbound variables, missing identifiers)\n`;
    messageFooter += `• Syntax errors (malformed operators, missing tokens, incorrect formatting)\n`;
    messageFooter += `• Module field usage (deprecated or non-existent fields)\n`;
    messageFooter += `• Proper Motoko syntax and patterns\n\n`;
    messageFooter += `The main issues appear to be:\n`;
    
    // Add specific issue analysis
    const errorsByCategory = errors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    if (errorsByCategory.type) {
      messageFooter += `• ${errorsByCategory.type} type error(s) - likely unbound variables or missing identifiers\n`;
    }
    if (errorsByCategory.deprecated) {
      messageFooter += `• ${errorsByCategory.deprecated} deprecated field(s) - old API usage that needs updating\n`;
    }
    if (errorsByCategory.trap) {
      messageFooter += `• ${errorsByCategory.trap} potential trap(s) - operations that may fail at runtime\n`;
    }
    
    messageFooter += `\nProvide the complete corrected functions or code blocks that I can replace the problematic sections with.`;

    const formattedMessage = messageHeader + messageBody + errorsSection + messageFooter;

    return {
      errors,
      codeContexts: contexts,
      formattedMessage
    };
  }

  /**
   * Create a simplified error summary for UI display
   */
  static createErrorSummary(parsedErrors: ParsedMotokoErrors): string {
    const { errors, warnings } = parsedErrors;
    
    let summary = '';
    if (errors.length > 0) {
      summary += `${errors.length} error${errors.length > 1 ? 's' : ''}`;
    }
    if (warnings.length > 0) {
      if (summary) summary += ', ';
      summary += `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`;
    }
    
    // Add most common error types
    const errorTypes = errors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topErrorType = Object.entries(errorTypes)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topErrorType) {
      summary += ` (mostly ${topErrorType[0]} issues)`;
    }
    
    return summary;
  }

  /**
   * Check if errors are likely fixable by AI
   */
  static areErrorsFixable(errors: MotokoError[]): boolean {
    if (errors.length === 0) return false;
    
    const fixableCategories = ['type', 'field', 'deprecated', 'syntax'];
    const fixableErrors = errors.filter(error => 
      fixableCategories.includes(error.category) && 
      error.errorType === 'error'
    );
    
    console.log('🔧 MotokoErrorParser: Fixability check:', {
      totalErrors: errors.length,
      fixableErrors: fixableErrors.length,
      categories: errors.map(e => e.category),
      threshold: Math.ceil(errors.length * 0.5) // Lowered threshold
    });
    
    // Consider errors fixable if at least 50% are in fixable categories (lowered from 70%)
    return fixableErrors.length >= Math.ceil(errors.length * 0.5);
  }

  // Private helper methods
  private static categorizeSeverity(errorCode: string, message: string): 'high' | 'medium' | 'low' {
    const lowerErrorCode = errorCode.toLowerCase();
    const lowerMessage = message.toLowerCase();
    
    // ENHANCED: More comprehensive severity mapping
    if (lowerErrorCode.startsWith('m000') || // Syntax errors
        lowerMessage.includes('syntax error') ||
        lowerMessage.includes('malformed') ||
        lowerMessage.includes('parse error')) {
      return 'high';
    }
    
    if (lowerMessage.includes('type error') || 
        lowerMessage.includes('cannot produce expected type') ||
        lowerMessage.includes('unbound variable') ||
        lowerErrorCode.startsWith('m005') || // M0057 is unbound variable
        lowerErrorCode.startsWith('m009')) {
      return 'high';
    }
    
    if (lowerMessage.includes('does not exist') || 
        lowerMessage.includes('deprecated') ||
        lowerErrorCode.startsWith('m015') ||
        lowerErrorCode.startsWith('m019')) {
      return 'medium';
    }
    
    return 'low';
  }

  private static categorizeError(errorCode: string, message: string): 'type' | 'field' | 'deprecated' | 'trap' | 'syntax' | 'other' {
    const lowerMessage = message.toLowerCase();
    const lowerErrorCode = errorCode.toLowerCase();
    
    console.log('🔍 Categorizing error:', { errorCode, message: message.substring(0, 100) + '...' });
    
    // Check error codes first (most reliable)
    if (lowerErrorCode.match(/^m000\d$/)) {
      // M000X series are syntax/parse errors
      console.log('✅ Categorized as SYNTAX via error code:', errorCode);
      return 'syntax';
    }
    
    if (lowerErrorCode.match(/^m005\d$/)) {
      // M005X series are type errors (M0057 = unbound variable)
      console.log('✅ Categorized as TYPE via error code:', errorCode);
      return 'type';
    }
    
    if (lowerErrorCode.match(/^m009\d$/)) {
      // M009X series are type system errors
      console.log('✅ Categorized as TYPE via error code:', errorCode);
      return 'type';
    }
    
    if (lowerErrorCode.match(/^m015\d$/)) {
      // M015X series are trap/operator errors
      console.log('✅ Categorized as TRAP via error code:', errorCode);
      return 'trap';
    }
    
    if (lowerErrorCode.match(/^m019\d$/)) {
      // M019X series are capability/system warnings (often non-critical)
      console.log('✅ Categorized as OTHER via error code (capability):', errorCode);
      return 'other';
    }
    
    if (lowerErrorCode.match(/^m154$/)) {
      // M0154 is deprecated field
      console.log('✅ Categorized as DEPRECATED via error code:', errorCode);
      return 'deprecated';
    }

    // ENHANCED: Syntax error detection patterns
    const syntaxErrorPatterns = [
      'syntax error',
      'malformed operator',
      'malformed',
      'parse error',
      'unexpected token',
      'expected',
      'missing'
    ];
    
    // Check syntax error patterns
    for (const pattern of syntaxErrorPatterns) {
      if (lowerMessage.includes(pattern)) {
        console.log('✅ Categorized as SYNTAX via pattern:', pattern);
        return 'syntax';
      }
    }
    
    // ENHANCED: Primary type error detection patterns
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
      'unbound variable'             // Key pattern for M0057
    ];
    
    // Check type error patterns
    for (const pattern of typeErrorPatterns) {
      if (lowerMessage.includes(pattern)) {
        console.log('✅ Categorized as TYPE via pattern:', pattern);
        return 'type';
      }
    }
    
    // Field/module error detection
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
    
    // Deprecation detection
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
    
    // Trap detection
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
    
    // DEBUG: Log when falling back to 'other'
    console.log('⚠️ Categorized as OTHER (no pattern matched):', { errorCode, messagePreview: lowerMessage.substring(0, 100) });
    return 'other';
  }

  private static cleanFilePath(filePath: string): string {
    // Remove leading/trailing whitespace and normalize path separators
    let cleaned = filePath.trim().replace(/\\/g, '/');
    
    // ENHANCED: Handle project name prefixes in file paths
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

  private static findFileContent(targetPath: string, fileContents: { [fileName: string]: string }): string | null {
    console.log('🔍 MotokoErrorParser: Looking for file content:', targetPath);
    console.log('🔍 MotokoErrorParser: Available files:', Object.keys(fileContents));
    
    // Direct match
    if (fileContents[targetPath]) {
      console.log('✅ MotokoErrorParser: Direct match found');
      return fileContents[targetPath];
    }
    
    // Try to find by filename match (in case of path differences)
    const targetFilename = targetPath.split('/').pop();
    if (!targetFilename) return null;
    
    for (const [filePath, content] of Object.entries(fileContents)) {
      if (filePath.endsWith(targetFilename) || filePath.includes(targetFilename)) {
        console.log('✅ MotokoErrorParser: Filename match found:', filePath);
        return content;
      }
    }
    
    // Try to find Motoko files (.mo extension) with partial path matching
    if (targetFilename.endsWith('.mo')) {
      const baseFilename = targetFilename.replace('.mo', '');
      for (const [filePath, content] of Object.entries(fileContents)) {
        if (filePath.endsWith('.mo') && 
            (filePath.includes(baseFilename) || filePath.endsWith(`/${targetFilename}`))) {
          console.log('✅ MotokoErrorParser: Motoko partial match found:', filePath);
          return content;
        }
      }
    }
    
    console.log('❌ MotokoErrorParser: No file content found for:', targetPath);
    return null;
  }
}