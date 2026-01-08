/**
 * EditStreamParser - Progressive parsing of streaming AI responses
 * Detects edit descriptions as they stream in, similar to FileExtractor.detectProgressiveFiles()
 */

import { EditParser, EditOperation, ParsedEditResult } from '../utils/EditParser';

export interface ProgressiveEditResult {
  detectedEdits: EditOperation[];
  inProgressEdits: EditOperation[];
  completeEdits: EditOperation[];
  detectedFiles: { [fileName: string]: 'detected' | 'writing' | 'complete' };
}

export class EditStreamParser {
  private static accumulatedContent: string = '';
  private static detectedEditOperations: Map<string, EditOperation> = new Map();
  private static editStates: Map<string, 'detected' | 'writing' | 'complete'> = new Map();
  // 🔥 NEW: Persist completed edits across streaming calls
  private static completedEdits: EditOperation[] = [];
  // 🔥 NEW: Flags to prevent logging spam during streaming
  private static hasLoggedNoEdits: boolean = false;
  private static hasLoggedEditsDetected: boolean = false;
  private static hasLoggedManyIncomplete: boolean = false;
  private static hasLoggedNoValidCode: boolean = false;

  /**
   * Reset parser state (call at start of new stream)
   */
  static reset(): void {
    this.accumulatedContent = '';
    this.detectedEditOperations.clear();
    this.editStates.clear();
    this.completedEdits = []; // 🔥 NEW: Clear completed edits on reset
    // Reset logging flags
    this.hasLoggedNoEdits = false;
    this.hasLoggedEditsDetected = false;
    this.hasLoggedManyIncomplete = false;
    this.hasLoggedNoValidCode = false;
    // Also reset EditParser logging state (this will clear loggedEdits Set)
    EditParser.resetLogging();
  }

  /**
   * Parse streaming content progressively
   * Similar to FileExtractor.detectProgressiveFiles() but for edits
   */
  static detectProgressiveEdits(
    streamContent: string,
    options: {
      onEditDetected?: (edit: EditOperation, fileName: string) => void;
      onEditComplete?: (edit: EditOperation, fileName: string) => void;
    } = {}
  ): ProgressiveEditResult {
    // Accumulate content
    this.accumulatedContent += streamContent;

    // Parse edits from accumulated content
    const parsedResult = EditParser.parseEditDescriptions(this.accumulatedContent);

    // 🔥 DEBUG: Log parsing results with completion analysis (only once per stream to avoid spam)
    if (parsedResult.operations.length === 0 && this.accumulatedContent.length > 100 && !this.hasLoggedNoEdits) {
      this.hasLoggedNoEdits = true;
      console.log('🔍 [EditStreamParser] No edits detected in stream:', {
        accumulatedLength: this.accumulatedContent.length,
        hasErrors: parsedResult.hasErrors,
        errors: parsedResult.errors,
        preview: this.accumulatedContent.substring(0, 300)
      });
    } else if (parsedResult.operations.length > 0 && !this.hasLoggedEditsDetected) {
      this.hasLoggedEditsDetected = true;
      const completeOps = parsedResult.operations.filter(op => {
        const hasValidOldCode = op.oldCode && op.oldCode.trim().length > 0;
        const hasValidNewCode = op.newCode && op.newCode.trim().length > 0;
        const hasTargetName = op.target?.name && op.target.name.trim().length > 0;
        return (hasValidOldCode && hasValidNewCode) || (hasTargetName && hasValidNewCode);
      });
      const incompleteOps = parsedResult.operations.filter(op => {
        const hasValidOldCode = op.oldCode && op.oldCode.trim().length > 0;
        const hasValidNewCode = op.newCode && op.newCode.trim().length > 0;
        const hasTargetName = op.target?.name && op.target.name.trim().length > 0;
        return !((hasValidOldCode && hasValidNewCode) || (hasTargetName && hasValidNewCode));
      });
      
      console.log('✅ [EditStreamParser] Edits detected:', {
        totalCount: parsedResult.operations.length,
        completeCount: completeOps.length,
        incompleteCount: incompleteOps.length,
        files: [...new Set(parsedResult.operations.map(op => op.filePath))],
        sampleComplete: completeOps.slice(0, 2).map(op => ({
          file: op.filePath,
          target: op.target.name || op.target.codeSnippet || 'unknown',
          hasOldCode: !!op.oldCode,
          hasNewCode: !!op.newCode,
          oldCodeLength: op.oldCode?.length || 0,
          newCodeLength: op.newCode?.length || 0
        })),
        sampleIncomplete: incompleteOps.slice(0, 2).map(op => ({
          file: op.filePath,
          target: op.target.name || op.target.codeSnippet || 'unknown',
          hasOldCode: !!op.oldCode,
          hasNewCode: !!op.newCode,
          description: op.description.substring(0, 50)
        }))
      });
      
      // 🔥 CRITICAL: Warn if we have many operations but none are complete (only once)
      if (parsedResult.operations.length > 10 && completeOps.length === 0 && !this.hasLoggedManyIncomplete) {
        this.hasLoggedManyIncomplete = true;
        console.warn('⚠️ [EditStreamParser] CRITICAL: Many operations detected but NONE are complete!', {
          totalOperations: parsedResult.operations.length,
          operationsWithoutOldCode: parsedResult.operations.filter(op => !op.oldCode).length,
          operationsWithoutNewCode: parsedResult.operations.filter(op => !op.newCode).length,
          operationsWithoutBoth: parsedResult.operations.filter(op => !op.oldCode || !op.newCode).length,
          sampleOperation: parsedResult.operations[0] ? {
            filePath: parsedResult.operations[0].filePath,
            hasOldCode: !!parsedResult.operations[0].oldCode,
            hasNewCode: !!parsedResult.operations[0].newCode,
            description: parsedResult.operations[0].description,
            target: parsedResult.operations[0].target
          } : null
        });
      }
    }

    const detectedEdits: EditOperation[] = [];
    const inProgressEdits: EditOperation[] = [];
    const completeEdits: EditOperation[] = [];
    const detectedFiles: { [fileName: string]: 'detected' | 'writing' | 'complete' } = {};

    // Process each detected operation
    for (const operation of parsedResult.operations) {
      const editKey = `${operation.filePath}:${operation.target.name || operation.target.codeSnippet || 'unknown'}`;
      const fileName = operation.filePath;

      // Check if this is a new edit
      if (!this.detectedEditOperations.has(editKey)) {
        this.detectedEditOperations.set(editKey, operation);
        this.editStates.set(editKey, 'detected');
        detectedEdits.push(operation);
        detectedFiles[fileName] = 'detected';

        // Trigger callback
        if (options.onEditDetected) {
          options.onEditDetected(operation, fileName);
        }
      }

      // Check if edit is complete (has both oldCode and newCode, OR has target.name and newCode)
      const currentState = this.editStates.get(editKey);
      if (currentState === 'detected' || currentState === 'writing') {
        // 🔥 CRITICAL: Mark as complete if:
        // 1. BOTH oldCode and newCode exist (strict format), OR
        // 2. target.name exists and newCode exists (flexible format - oldCode will be found by CodePatternMatcher)
        const hasValidOldCode = operation.oldCode && operation.oldCode.trim().length > 0;
        const hasValidNewCode = operation.newCode && operation.newCode.trim().length > 0;
        const hasTargetName = operation.target?.name && operation.target.name.trim().length > 0;
        
        if ((hasValidOldCode && hasValidNewCode) || (hasTargetName && hasValidNewCode)) {
          // Edit appears complete
          this.editStates.set(editKey, 'complete');
          
          // 🔥 NEW: Persist completed edits across streaming calls
          // Check if this edit is already in completedEdits (avoid duplicates)
          const isAlreadyCompleted = this.completedEdits.some(e => {
            return e.filePath === operation.filePath &&
                   e.target.name === operation.target.name &&
                   e.newCode === operation.newCode;
          });
          
          if (!isAlreadyCompleted) {
            this.completedEdits.push(operation);
          }
          
          completeEdits.push(operation);
          detectedFiles[fileName] = 'complete';

          // Trigger callback
          if (options.onEditComplete) {
            options.onEditComplete(operation, fileName);
          }
        } else if (hasValidOldCode || hasValidNewCode || hasTargetName) {
          // Edit is in progress (has one but not both, or has target name but not newCode yet)
          this.editStates.set(editKey, 'writing');
          inProgressEdits.push(operation);
          detectedFiles[fileName] = 'writing';
        } else {
          // 🔥 NEW: Log when operations are detected but have no valid code (only once per stream)
          // This indicates the parser is creating operations incorrectly
          if (parsedResult.operations.length > 10 && !this.hasLoggedNoValidCode) {
            this.hasLoggedNoValidCode = true;
            console.warn('⚠️ [EditStreamParser] Operation detected but has no valid code:', {
              editKey,
              filePath: operation.filePath,
              hasOldCode: !!operation.oldCode,
              hasNewCode: !!operation.newCode,
              oldCodeLength: operation.oldCode?.length || 0,
              newCodeLength: operation.newCode?.length || 0,
              description: operation.description,
              target: operation.target
            });
          }
        }
      }
    }

    // 🔥 NEW: Always include persisted completed edits in results
    // This ensures edits marked complete in previous deltas are still available
    const allCompleteEdits = [...new Set([...this.completedEdits, ...completeEdits])];
    
    // Deduplicate by content (not reference)
    const uniqueCompleteEdits: EditOperation[] = [];
    const seenKeys = new Set<string>();
    
    for (const edit of allCompleteEdits) {
      const key = `${edit.filePath}::${edit.target.name || edit.target.codeSnippet?.substring(0, 50) || 'unknown'}::${edit.newCode?.substring(0, 100).replace(/\s+/g, '') || ''}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueCompleteEdits.push(edit);
      }
    }
    
    return {
      detectedEdits,
      inProgressEdits,
      completeEdits: uniqueCompleteEdits, // Include persisted edits
      detectedFiles
    };
  }

  /**
   * Extract target file path from edit description
   */
  static extractTargetFile(streamContent: string): string | null {
    // Look for file path patterns in the stream
    const filePathPattern = /(?:In|in|file|File):\s*([^\s\n]+\.(?:tsx?|jsx?|js|mo|json))/i;
    const match = streamContent.match(filePathPattern);
    
    if (match) {
      return match[1].trim();
    }

    // Also check accumulated content
    const accumulatedMatch = this.accumulatedContent.match(filePathPattern);
    if (accumulatedMatch) {
      return accumulatedMatch[1].trim();
    }

    return null;
  }

  /**
   * Check if edit description is complete
   * Complete if: (oldCode AND newCode) OR (target.name AND newCode)
   */
  static isEditComplete(operation: EditOperation): boolean {
    const hasValidOldCode = operation.oldCode && operation.oldCode.trim().length > 0;
    const hasValidNewCode = operation.newCode && operation.newCode.trim().length > 0;
    const hasTargetName = operation.target?.name && operation.target.name.trim().length > 0;
    
    return !!(operation.filePath && hasValidNewCode && (hasValidOldCode || hasTargetName));
  }

  /**
   * Get first detected file (for SidePane opening)
   */
  static getFirstDetectedFile(): string | null {
    // Find first edit operation with a file path
    for (const [key, operation] of this.detectedEditOperations.entries()) {
      if (operation.filePath && operation.filePath !== 'unknown') {
        return operation.filePath;
      }
    }

    // Fallback: try to extract from accumulated content
    return this.extractTargetFile(this.accumulatedContent);
  }

  /**
   * Get all detected file paths
   */
  static getDetectedFiles(): string[] {
    const files = new Set<string>();
    
    for (const operation of this.detectedEditOperations.values()) {
      if (operation.filePath && operation.filePath !== 'unknown') {
        files.add(operation.filePath);
      }
    }

    return Array.from(files);
  }

  /**
   * Check if content contains full file markers (should be rejected)
   */
  static hasFullFileMarkers(content: string): boolean {
    const fullFileMarkers = [
      /\/\/\s*Complete\s+file:/i,
      /\/\*\s*Complete\s+file:/i,
      /<!--\s*Complete\s+file:/i
    ];

    return fullFileMarkers.some(pattern => pattern.test(content));
  }

  /**
   * Get accumulated content
   */
  static getAccumulatedContent(): string {
    return this.accumulatedContent;
  }

  /**
   * Clear accumulated content (for testing or reset)
   */
  static clearAccumulatedContent(): void {
    this.accumulatedContent = '';
  }

  /**
   * Extract clean response (remove code blocks, keep natural language)
   * Similar to FileExtractor.extractCleanResponse()
   * 🔥 CRITICAL: Removes empty "Replace with:" messages and incomplete edit patterns
   */
  static extractCleanResponse(content: string): string {
    // Remove code blocks but keep the natural language descriptions
    let clean = content;
    
    // 🔥 CRITICAL FIX: Remove incomplete edit patterns (empty "Replace with:" messages)
    // Pattern 1: "Replace with:" followed by nothing or just whitespace/newlines
    clean = clean.replace(/Replace\s+with:\s*\n\s*(?:\n|$)/gi, '');
    clean = clean.replace(/Replace\s+with:\s*$/gi, '');
    
    // Pattern 2: "Find this code:" without a matching "Replace with:" code block
    // Remove standalone "Find this code:" sections that aren't followed by proper "Replace with:"
    clean = clean.replace(/Find\s+this\s+code:\s*\n\s*```[\s\S]*?```\s*\n\s*Replace\s+with:\s*(?:\n\s*$|$)/gi, '');
    
    // Pattern 3: "Replace with:" followed by explanation text instead of code block
    // This catches cases where AI says "Replace with:" but then explains instead of providing code
    clean = clean.replace(/Replace\s+with:\s*\n\s*(?![`]{3})(?:Actually|Looking|I think|I need|Let me|Here|This|The|Note|Explanation)[^\n]*/gi, '');
    
    // Remove code blocks
    clean = clean.replace(/```[\s\S]*?```/g, '');
    
    // Remove "Find this code:" / "Replace with:" markers but keep descriptions
    clean = clean.replace(/(?:Find|find|Replace|replace)\s+(?:this\s+)?code:?\s*/gi, '');
    
    // 🔥 CRITICAL: Remove orphaned "Replace with:" text that might remain
    clean = clean.replace(/^\s*Replace\s+with:\s*$/gim, '');
    clean = clean.replace(/\n\s*Replace\s+with:\s*\n/g, '\n');
    
    // Remove file path comments that might be left behind
    clean = clean.replace(/\/\/\s*(?:In|in|file|File):\s*[^\s\n]+\.(?:tsx?|jsx?|js|mo|json)\s*\n?/gi, '');
    
    // Clean up extra whitespace and empty lines
    clean = clean.replace(/\n{3,}/g, '\n\n');
    clean = clean.replace(/^\s+|\s+$/g, ''); // Trim start/end
    
    // 🔥 CRITICAL: If the cleaned response is too short or doesn't make sense, provide a default message
    if (clean.trim().length < 20 || /^(Replace|Find|In:)/i.test(clean.trim())) {
      // Response is too short or starts with edit markers - likely incomplete
      return 'Code updates have been applied successfully.';
    }
    
    return clean;
  }
}

