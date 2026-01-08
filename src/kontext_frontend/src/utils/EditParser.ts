/**
 * EditParser - Parses natural language descriptions from AI responses
 * and extracts structured edit operations for targeted code modifications.
 */

export interface EditOperation {
  type: 'replace' | 'insert' | 'delete' | 'update';
  filePath: string;
  target: {
    // For code files: function/component name or code snippet
    name?: string;
    codeSnippet?: string;
    lineRange?: { start: number; end: number };
    
    // For JSON: property path
    jsonPath?: string;
  };
  oldCode?: string;  // Code to find/replace
  newCode: string;   // Replacement code
  description: string; // AI's natural language description
  confidence?: number; // Match confidence (0-100) - optional, set during application
}

export interface ParsedEditResult {
  operations: EditOperation[];
  hasErrors: boolean;
  errors: string[];
}

export class EditParser {
  // 🔥 NEW: Track if we've already logged each issue type (only log once per stream)
  private static hasLoggedFullFileMarkers: boolean = false;
  private static hasLoggedReplaceWithError: boolean = false;
  private static hasLoggedNoPattern: boolean = false;
  // 🔥 NEW: Track which edits we've already logged to avoid spam during streaming
  private static loggedEdits: Set<string> = new Set();

  /**
   * Reset logging state (call at start of new stream)
   */
  static resetLogging(): void {
    this.hasLoggedFullFileMarkers = false;
    this.hasLoggedReplaceWithError = false;
    this.hasLoggedNoPattern = false;
    this.loggedEdits.clear(); // 🔥 NEW: Clear logged edits on reset
  }

  /**
   * Parse AI response for edit descriptions
   * Extracts edit operations from natural language descriptions with code snippets
   */
  static parseEditDescriptions(aiResponse: string): ParsedEditResult {
    const operations: EditOperation[] = [];
    const errors: string[] = [];

    try {
      // Check if AI tried to provide full files (should be rejected)
      const fullFileMarkers = [
        /\/\/\s*Complete\s+file:/i,
        /\/\*\s*Complete\s+file:/i,
        /<!--\s*Complete\s+file:/i
      ];

      const hasFullFileMarkers = fullFileMarkers.some(pattern => pattern.test(aiResponse));
      if (hasFullFileMarkers) {
        errors.push('Full file markers detected - targeted edits required');
        // Only log once per stream to avoid spam
        if (!this.hasLoggedFullFileMarkers) {
          this.hasLoggedFullFileMarkers = true;
          console.warn('⚠️ [EditParser] AI provided full file markers - rejecting:', {
            responseLength: aiResponse.length,
            preview: aiResponse.substring(0, 300)
          });
        }
      }

      // Extract edit descriptions from natural language
      // Pattern: "I'll update [function/component] in [file]..."
      const editDescriptionPattern = /(?:I'll|I will|Updating|Update|Modifying|Modify|Adding|Add|Removing|Remove|Changing|Change)\s+(?:the\s+)?([^in]+?)\s+in\s+([^\s\.]+\.(?:tsx?|jsx?|js|mo|json))/gi;
      
      // Pattern for "Find this code" / "Replace with" structure
      // 🔥 FIX: Allow newlines between "code:" and code block, and between "Replace with:" and code block
      // This matches the actual AI response format where there's a newline before the code block
      const findReplacePattern = /(?:Find|find|Locate|locate)\s+(?:this\s+)?code:?\s*\n?\s*```(?:typescript|ts|tsx|jsx|javascript|js|motoko|json)?\s*\n([\s\S]*?)```\s*\n?\s*(?:Replace|replace|with|Replace with):?\s*\n?\s*```(?:typescript|ts|tsx|jsx|javascript|js|motoko|json)?\s*\n([\s\S]*?)```/gi;

      // Extract file paths mentioned in descriptions
      const filePathPattern = /(?:In|in|file|File):\s*([^\s\n]+\.(?:tsx?|jsx?|js|mo|json))/gi;
      const filePaths: string[] = [];
      let match;
      
      while ((match = filePathPattern.exec(aiResponse)) !== null) {
        const filePath = match[1].trim();
        if (filePath && !filePaths.includes(filePath)) {
          filePaths.push(filePath);
        }
      }

      // Extract code blocks with context
      const codeBlockPattern = /```(?:typescript|ts|tsx|jsx|javascript|js|motoko|json)?\s*\n([\s\S]*?)```/g;
      const codeBlocks: string[] = [];
      
      while ((match = codeBlockPattern.exec(aiResponse)) !== null) {
        codeBlocks.push(match[1].trim());
      }

      // 🔥 DEBUG: Check for "Replace with:" without code blocks (common AI mistake)
      // 🔥 FIX: Allow newlines between "Replace with:" and code block
      // Check if "Replace with:" exists but no code block follows within reasonable distance (500 chars)
      const replaceWithMatches: Array<{index: number, hasCodeBlock: boolean, distance: number}> = [];
      let replaceMatch;
      const replaceWithRegex = /Replace\s+with:?/gi;
      replaceWithRegex.lastIndex = 0;
      
      while ((replaceMatch = replaceWithRegex.exec(aiResponse)) !== null) {
        const afterReplace = aiResponse.substring(replaceMatch.index + replaceMatch[0].length, Math.min(aiResponse.length, replaceMatch.index + replaceMatch[0].length + 500));
        // Look for code block marker (```) - allow whitespace/newlines before it
        const codeBlockMatch = afterReplace.match(/\s*```/);
        const hasCodeBlock = !!codeBlockMatch;
        const distance = codeBlockMatch ? codeBlockMatch.index || 0 : -1;
        replaceWithMatches.push({ index: replaceMatch.index, hasCodeBlock, distance });
      }
      
      const hasReplaceWithWithoutCode = replaceWithMatches.some(m => !m.hasCodeBlock);
      if (hasReplaceWithWithoutCode) {
        errors.push('AI provided "Replace with:" markers but no code blocks - response format is invalid');
        // Only log once per stream to avoid spam
        if (!this.hasLoggedReplaceWithError) {
          this.hasLoggedReplaceWithError = true;
          console.error('❌ [EditParser] CRITICAL: AI said "Replace with:" but did NOT provide code blocks!', {
            responseLength: aiResponse.length,
            codeBlockCount: codeBlocks.length,
            hasFilePaths: filePaths.length > 0,
            filePaths: filePaths,
            replaceWithMatches: replaceWithMatches.length,
            matchesWithoutCodeBlocks: replaceWithMatches.filter(m => !m.hasCodeBlock).length,
            matchesWithCodeBlocks: replaceWithMatches.filter(m => m.hasCodeBlock).map(m => ({ distance: m.distance })),
            preview: aiResponse.substring(0, 800),
            issue: 'AI response contains "Replace with:" text but no code blocks follow it within 500 chars'
          });
        }
      }

      // 🔥 DEBUG: Log what we're looking for (only once per stream)
      findReplacePattern.lastIndex = 0; // Reset regex
      const hasFindReplacePattern = findReplacePattern.test(aiResponse);
      if (!hasFindReplacePattern && aiResponse.length > 200) {
        // Only log once per stream to avoid spam
        if (!this.hasLoggedNoPattern) {
          this.hasLoggedNoPattern = true;
          
          // 🔥 ENHANCED DEBUG: Check each part of the pattern separately
          const hasFindText = /(?:Find|find|Locate|locate)\s+(?:this\s+)?code:?/i.test(aiResponse);
          const hasReplaceText = /(?:Replace|replace)\s+with:?/i.test(aiResponse);
          const findCodeIndex = aiResponse.search(/(?:Find|find|Locate|locate)\s+(?:this\s+)?code:?/i);
          const replaceWithIndex = aiResponse.search(/(?:Replace|replace)\s+with:?/i);
          
          console.log('🔍 [EditParser] No "Find this code" / "Replace with" pattern found:', {
            responseLength: aiResponse.length,
            hasCodeBlocks: codeBlocks.length > 0,
            codeBlockCount: codeBlocks.length,
            hasFilePaths: filePaths.length > 0,
            filePaths: filePaths,
            hasFindText,
            hasReplaceText,
            findCodeIndex: findCodeIndex >= 0 ? findCodeIndex : -1,
            replaceWithIndex: replaceWithIndex >= 0 ? replaceWithIndex : -1,
            distanceBetween: findCodeIndex >= 0 && replaceWithIndex >= 0 ? replaceWithIndex - findCodeIndex : 'N/A',
            preview: aiResponse.substring(0, 500),
            // Show the actual text around "Find this code" if found
            findContext: findCodeIndex >= 0 ? aiResponse.substring(Math.max(0, findCodeIndex - 50), Math.min(aiResponse.length, findCodeIndex + 200)) : 'Not found',
            replaceContext: replaceWithIndex >= 0 ? aiResponse.substring(Math.max(0, replaceWithIndex - 50), Math.min(aiResponse.length, replaceWithIndex + 200)) : 'Not found'
          });
        }
      }

      // Try to match "Find this code" / "Replace with" patterns
      // 🔥 CRITICAL: Reset regex lastIndex before matching (test() may have advanced it)
      findReplacePattern.lastIndex = 0;
      let findReplaceMatch;
      
      while ((findReplaceMatch = findReplacePattern.exec(aiResponse)) !== null) {
        let oldCode = findReplaceMatch[1].trim();
        let newCode = findReplaceMatch[2].trim();
        
        // 🔥 CRITICAL: Clean explanation text from code blocks
        // Remove any explanation patterns that might be mixed into code
        const explanationPatterns = [
          /Looking at the error[^\n]*/gi,
          /Looking at the [^\n]*file[^\n]*/gi, // "Looking at the ProjectModal.tsx file"
          /The issue is that[^\n]*/gi,
          /Find this code:[^\n]*/gi,
          /Replace with:[^\n]*/gi,
          /Here's the fix[^\n]*/gi,
          /Here's what[^\n]*/gi,
          /I'll create[^\n]*/gi,
          /I'll add[^\n]*/gi, // "I'll add a minor enhancement"
          /I need to[^\n]*/gi,
          /In:\s*[^\n]+/gi, // "In: src/frontend/src/components/ProjectModal.tsx"
          /##\s*\*\*[^\n]*/g,
          /🚨\s*[^\n]*/g,
          /Error Analysis[^\n]*/gi,
          /Root cause[^\n]*/gi,
          /Fix Required[^\n]*/gi,
        ];
        
        for (const pattern of explanationPatterns) {
          oldCode = oldCode.replace(pattern, '');
          newCode = newCode.replace(pattern, '');
        }
        
        // Remove lines that are clearly explanation (not code)
        const cleanCodeBlock = (code: string): string => {
          const lines = code.split('\n');
          return lines.filter(line => {
            const trimmed = line.trim();
            if (trimmed.length === 0) return true; // Keep empty lines
            if (/^(Looking|The issue|Find this|Replace with|Here's|I'll|I need|##|🚨|Error|Root|Fix|In:)/i.test(trimmed)) {
              return false;
            }
            // Keep lines that look like code
            return /^[\s]*(import|export|const|let|var|function|class|interface|type|return|if|else|for|while|switch|case|default|try|catch|finally|async|await|<\w+|<\/\w+|\{|\}|\(|\)|\[|\]|;|,|=>|\.\w+)/.test(trimmed) || 
                   trimmed.startsWith('//') || // Comments are code
                   trimmed.startsWith('/*') || // Block comments
                   trimmed.startsWith('*') || // Comment continuation
                   /^[\s]*[a-zA-Z_$][\w$]*\s*[:=]/.test(trimmed); // Variable assignments
          }).join('\n');
        };
        
        oldCode = cleanCodeBlock(oldCode);
        newCode = cleanCodeBlock(newCode);
        
        // Extract file path from surrounding context
        const contextBefore = aiResponse.substring(Math.max(0, findReplaceMatch.index - 200), findReplaceMatch.index);
        const filePathMatch = contextBefore.match(/(?:In|in|file|File):\s*([^\s\n]+\.(?:tsx?|jsx?|js|mo|json))/i);
        const filePath = filePathMatch ? filePathMatch[1].trim() : (filePaths[0] || 'unknown');

        // Extract description from context
        const descriptionMatch = contextBefore.match(/(?:I'll|I will|Updating|Update|Modifying|Modify|Adding|Add|Removing|Remove|Changing|Change)\s+([^\.]+)/i);
        const description = descriptionMatch ? descriptionMatch[0].trim() : 'Code update';

        // Determine edit type
        let editType: EditOperation['type'] = 'replace';
        if (description.toLowerCase().includes('add') || description.toLowerCase().includes('insert')) {
          editType = 'insert';
        } else if (description.toLowerCase().includes('remove') || description.toLowerCase().includes('delete')) {
          editType = 'delete';
        }

        // Extract target name (function/component) from description
        const nameMatch = description.match(/(?:the\s+)?(\w+)\s+(?:function|component|method|hook|type|interface|class)/i);
        const targetName = nameMatch ? nameMatch[1] : undefined;

        operations.push({
          type: editType,
          filePath,
          target: {
            name: targetName,
            codeSnippet: oldCode
          },
          oldCode,
          newCode,
          description,
          confidence: 80 // High confidence for explicit find/replace patterns
        });
      }

      // 🔥 NEW: Fallback - try to match "Find this code" and "Replace with" separately if strict pattern didn't match
      // This handles cases where there are newlines or extra text between the markers and code blocks
      if (operations.length === 0) {
        // 🔥 DEBUG: Log why fallback might not run
        if (codeBlocks.length < 2 && !this.hasLoggedNoPattern) {
          console.log('🔍 [EditParser] Fallback parser not running - insufficient code blocks:', {
            codeBlockCount: codeBlocks.length,
            needsAtLeast: 2,
            hasFindText: /(?:Find|find|Locate|locate)\s+(?:this\s+)?code:?/i.test(aiResponse),
            hasReplaceText: /(?:Replace|replace)\s+with:?/i.test(aiResponse)
          });
        }
      }
      
      if (operations.length === 0 && codeBlocks.length >= 2) {
        // Look for "Find this code" followed by a code block, then "Replace with" followed by another code block
        const findCodeMarker = /(?:Find|find|Locate|locate)\s+(?:this\s+)?code:?/gi;
        const replaceWithMarker = /(?:Replace|replace)\s+with:?/gi;
        
        let findMatch;
        findCodeMarker.lastIndex = 0;
        while ((findMatch = findCodeMarker.exec(aiResponse)) !== null) {
          // Find the next code block after "Find this code"
          const afterFind = aiResponse.substring(findMatch.index + findMatch[0].length);
          const firstCodeBlockMatch = afterFind.match(/```(?:typescript|ts|tsx|jsx|javascript|js|motoko|json)?\s*\n([\s\S]*?)```/);
          
          if (firstCodeBlockMatch) {
            const oldCode = firstCodeBlockMatch[1].trim();
            const firstBlockIndex = afterFind.indexOf(firstCodeBlockMatch[0]);
            const afterFirstBlock = afterFind.substring(firstBlockIndex + firstCodeBlockMatch[0].length);
            
            // Find "Replace with" after the first code block
            replaceWithMarker.lastIndex = 0; // Reset regex
            const replaceMatch = replaceWithMarker.exec(afterFirstBlock);
            if (replaceMatch) {
              // Find the next code block after "Replace with"
              const afterReplace = afterFirstBlock.substring(replaceMatch.index + replaceMatch[0].length);
              const secondCodeBlockMatch = afterReplace.match(/```(?:typescript|ts|tsx|jsx|javascript|js|motoko|json)?\s*\n([\s\S]*?)```/);
              
              if (secondCodeBlockMatch) {
                let newCode = secondCodeBlockMatch[1].trim();
                
                // 🔥 CRITICAL: Clean explanation text from code block
                const explanationPatterns = [
                  /Looking at the error[^\n]*/gi,
                  /Looking at the [^\n]*file[^\n]*/gi, // "Looking at the ProjectModal.tsx file"
                  /The issue is that[^\n]*/gi,
                  /Find this code:[^\n]*/gi,
                  /Replace with:[^\n]*/gi,
                  /Here's the fix[^\n]*/gi,
                  /Here's what[^\n]*/gi,
                  /I'll create[^\n]*/gi,
                  /I'll add[^\n]*/gi, // "I'll add a minor enhancement"
                  /I need to[^\n]*/gi,
                  /In:\s*[^\n]+/gi, // "In: src/frontend/src/components/ProjectModal.tsx"
                  /##\s*\*\*[^\n]*/g,
                  /🚨\s*[^\n]*/g,
                  /Error Analysis[^\n]*/gi,
                  /Root cause[^\n]*/gi,
                  /Fix Required[^\n]*/gi,
                ];
                
                for (const pattern of explanationPatterns) {
                  newCode = newCode.replace(pattern, '');
                }
                
                // Remove lines that are clearly explanation (not code)
                const lines = newCode.split('\n');
                newCode = lines.filter(line => {
                  const trimmed = line.trim();
                  if (trimmed.length === 0) return true;
                  if (/^(Looking|The issue|Find this|Replace with|Here's|I'll|I need|##|🚨|Error|Root|Fix|In:)/i.test(trimmed)) {
                    return false;
                  }
                  return /^[\s]*(import|export|const|let|var|function|class|interface|type|return|if|else|for|while|switch|case|default|try|catch|finally|async|await|<\w+|<\/\w+|\{|\}|\(|\)|\[|\]|;|,|=>|\.\w+)/.test(trimmed) || 
                         trimmed.startsWith('//') || 
                         trimmed.startsWith('/*') || 
                         trimmed.startsWith('*') || 
                         /^[\s]*[a-zA-Z_$][\w$]*\s*[:=]/.test(trimmed);
                }).join('\n');
                
                // Extract file path from context before "Find this code"
                const contextBefore = aiResponse.substring(Math.max(0, findMatch.index - 300), findMatch.index);
                const filePathMatch = contextBefore.match(/(?:In|in|file|File):\s*([^\s\n]+\.(?:tsx?|jsx?|js|mo|json))/i);
                const filePath = filePathMatch ? filePathMatch[1].trim() : (filePaths[0] || 'unknown');
                
                // Extract description
                const descriptionMatch = contextBefore.match(/(?:I'll|I will|Updating|Update|Modifying|Modify|Adding|Add|Removing|Remove|Changing|Change|Fix|fix|Here's|here's)\s+([^\.\n]+)/i);
                const description = descriptionMatch ? descriptionMatch[0].trim() : 'Code update';
                
                // Extract function name from oldCode
                const functionNameMatch = oldCode.match(/(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\(|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+))/);
                const targetName = functionNameMatch ? (functionNameMatch[1] || functionNameMatch[2] || functionNameMatch[3] || functionNameMatch[4] || functionNameMatch[5]) : undefined;
                
                // Remove file path comment from oldCode if present
                const cleanOldCode = oldCode.replace(/^\/\/\s*(?:In|in|file|File):\s*[^\s\n]+\.(?:tsx?|jsx?|js|mo|json)\s*\n?/im, '');
                
                operations.push({
                  type: 'replace',
                  filePath,
                  target: {
                    name: targetName,
                    codeSnippet: cleanOldCode.substring(0, 200)
                  },
                  oldCode: cleanOldCode,
                  newCode,
                  description,
                  confidence: 75 // Slightly lower confidence for fallback pattern
                });
                
                console.log('✅ [EditParser] Extracted edit using fallback pattern matching:', {
                  filePath,
                  functionName: targetName,
                  oldCodeLength: cleanOldCode.length,
                  newCodeLength: newCode.length,
                  description
                });
                
                // Reset regex lastIndex for next iteration
                findCodeMarker.lastIndex = 0;
                replaceWithMarker.lastIndex = 0;
                break; // Only extract first match to avoid duplicates
              }
            }
          }
        }
      }

      // 🔥 NEW: If still no operations, try to extract from code blocks with file paths
      // This handles cases where AI provides code blocks but not in strict format
      if (operations.length === 0 && codeBlocks.length > 0) {
        // Look for code blocks that have file path comments inside them
        const codeBlockWithPathPattern = /```(?:typescript|ts|tsx|jsx|javascript|js|motoko|json)?\s*\n([\s\S]*?)```/g;
        let codeBlockMatch;
        
        while ((codeBlockMatch = codeBlockWithPathPattern.exec(aiResponse)) !== null) {
          const codeBlockContent = codeBlockMatch[1].trim();
          
          // Check if this code block has a file path comment
          const filePathInBlock = codeBlockContent.match(/(?:^|\n)\/\/\s*(?:In|in|file|File):\s*([^\s\n]+\.(?:tsx?|jsx?|js|mo|json))/i);
          const extractedFilePath = filePathInBlock ? filePathInBlock[1].trim() : null;
          
          // Extract function/method/component name from the code block
          const functionNameMatch = codeBlockContent.match(/(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\(|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+))/);
          const extractedFunctionName = functionNameMatch ? (functionNameMatch[1] || functionNameMatch[2] || functionNameMatch[3] || functionNameMatch[4] || functionNameMatch[5]) : null;
          
          // Try to find file path from context around this code block
          const blockIndex = codeBlockMatch.index;
          const contextBefore = aiResponse.substring(Math.max(0, blockIndex - 300), blockIndex);
          const contextAfter = aiResponse.substring(blockIndex + codeBlockMatch[0].length, Math.min(aiResponse.length, blockIndex + codeBlockMatch[0].length + 300));
          
          // Look for file path in context
          const contextFilePathMatch = (contextBefore + contextAfter).match(/(?:In|in|file|File):\s*([^\s\n]+\.(?:tsx?|jsx?|js|mo|json))/i);
          const contextFilePath = contextFilePathMatch ? contextFilePathMatch[1].trim() : null;
          
          // Use file path from block, context, or filePaths array
          const filePath = extractedFilePath || contextFilePath || filePaths[0] || 'unknown';
          
          // Extract description from context
          const descriptionMatch = (contextBefore + contextAfter).match(/(?:I'll|I will|Updating|Update|Modifying|Modify|Adding|Add|Removing|Remove|Changing|Change|Fix|fix|Here's|here's)\s+([^\.\n]+)/i);
          const description = descriptionMatch ? descriptionMatch[0].trim() : (extractedFunctionName ? `Update ${extractedFunctionName}` : 'Code update');
          
          // Only create operation if we have a valid file path and code content
          if (filePath !== 'unknown' && codeBlockContent.length > 20) {
            // Remove file path comment from code block content
            let cleanCodeContent = codeBlockContent.replace(/^\/\/\s*(?:In|in|file|File):\s*[^\s\n]+\.(?:tsx?|jsx?|js|mo|json)\s*\n?/im, '');
            
            // 🔥 CRITICAL: Clean explanation text from code block
            const explanationPatterns = [
              /Looking at the error[^\n]*/gi,
              /Looking at the [^\n]*file[^\n]*/gi, // "Looking at the ProjectModal.tsx file"
              /The issue is that[^\n]*/gi,
              /Find this code:[^\n]*/gi,
              /Replace with:[^\n]*/gi,
              /Here's the fix[^\n]*/gi,
              /Here's what[^\n]*/gi,
              /I'll create[^\n]*/gi,
              /I'll add[^\n]*/gi, // "I'll add a minor enhancement"
              /I need to[^\n]*/gi,
              /In:\s*[^\n]+/gi, // "In: src/frontend/src/components/ProjectModal.tsx"
              /##\s*\*\*[^\n]*/g,
              /🚨\s*[^\n]*/g,
              /Error Analysis[^\n]*/gi,
              /Root cause[^\n]*/gi,
              /Fix Required[^\n]*/gi,
            ];
            
            for (const pattern of explanationPatterns) {
              cleanCodeContent = cleanCodeContent.replace(pattern, '');
            }
            
            // Remove lines that are clearly explanation (not code)
            const lines = cleanCodeContent.split('\n');
            cleanCodeContent = lines.filter(line => {
              const trimmed = line.trim();
              if (trimmed.length === 0) return true;
              if (/^(Looking|The issue|Find this|Replace with|Here's|I'll|I need|##|🚨|Error|Root|Fix|In:)/i.test(trimmed)) {
                return false;
              }
              return /^[\s]*(import|export|const|let|var|function|class|interface|type|return|if|else|for|while|switch|case|default|try|catch|finally|async|await|<\w+|<\/\w+|\{|\}|\(|\)|\[|\]|;|,|=>|\.\w+)/.test(trimmed) || 
                     trimmed.startsWith('//') || 
                     trimmed.startsWith('/*') || 
                     trimmed.startsWith('*') || 
                     /^[\s]*[a-zA-Z_$][\w$]*\s*[:=]/.test(trimmed);
            }).join('\n');
            
            operations.push({
              type: 'replace',
              filePath,
              target: {
                name: extractedFunctionName || undefined,
                codeSnippet: cleanCodeContent.substring(0, 200) // First 200 chars for matching
              },
              oldCode: undefined, // Will be found by CodePatternMatcher using target.name
              newCode: cleanCodeContent,
              description,
              confidence: extractedFunctionName ? 70 : 50 // Higher confidence if we found function name
            });
            
            // 🔥 THROTTLE: Only log each unique edit once (track by filePath + codeLength hash)
            const editKey = `${filePath}::${cleanCodeContent.length}::${extractedFunctionName || 'no-name'}`;
            if (!this.loggedEdits.has(editKey)) {
              this.loggedEdits.add(editKey);
              console.log('✅ [EditParser] Extracted edit from code block with file path:', {
                filePath,
                functionName: extractedFunctionName,
                codeLength: cleanCodeContent.length,
                description,
                confidence: extractedFunctionName ? 70 : 50
              });
            }
          }
        }
      }
      
      // Legacy fallback: If still no operations and we have 2+ code blocks, assume first is old, second is new
      if (operations.length === 0 && codeBlocks.length >= 2) {
        const oldCode = codeBlocks[0];
        const newCode = codeBlocks[1];
        const filePath = filePaths[0] || 'unknown';

        operations.push({
          type: 'replace',
          filePath,
          target: {
            codeSnippet: oldCode
          },
          oldCode,
          newCode,
          description: 'Code update',
          confidence: 60 // Lower confidence for inferred edits
        });
      }

      // Extract JSON property updates
      const jsonUpdatePattern = /(?:Add|add|Update|update|Set|set)\s+([^\s]+)\s+to\s+([^\s]+\.json)/gi;
      let jsonMatch;
      
      while ((jsonMatch = jsonUpdatePattern.exec(aiResponse)) !== null) {
        const propertyPath = jsonMatch[1].trim();
        const filePath = jsonMatch[2].trim();

        // Find JSON code block for this file
        const jsonBlockMatch = aiResponse.match(new RegExp(`\\\`\\\`\\\`json[\\s\\S]*?${filePath}[\\s\\S]*?\\\`\\\`\\\`([\\s\\S]*?)\\\`\\\`\\\`json`, 'i'));
        if (jsonBlockMatch) {
          operations.push({
            type: 'update',
            filePath,
            target: {
              jsonPath: propertyPath
            },
            newCode: jsonBlockMatch[1].trim(),
            description: `Update ${propertyPath} in ${filePath}`,
            confidence: 70
          });
        }
      }

    } catch (error) {
      errors.push(`Failed to parse edit descriptions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ EditParser: Error parsing edit descriptions:', error);
    }

    return {
      operations,
      hasErrors: errors.length > 0,
      errors
    };
  }

  /**
   * Extract file path from edit description
   */
  static extractFilePath(description: string): string | null {
    const patterns = [
      /(?:In|in|file|File):\s*([^\s\n]+\.(?:tsx?|jsx?|js|mo|json))/i,
      /([^\s\n]+\.(?:tsx?|jsx?|js|mo|json))/i
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract target name (function/component) from description
   */
  static extractTargetName(description: string): string | null {
    const patterns = [
      /(?:the\s+)?(\w+)\s+(?:function|component|method|hook|type|interface|class)/i,
      /(?:update|modify|change|add|remove)\s+(\w+)/i
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }
}

