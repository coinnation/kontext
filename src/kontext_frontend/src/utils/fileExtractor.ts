import { getDebugContext } from '../services/GenerationLoggingService';

export interface FileExtractionResult {
    completeFiles: { [key: string]: string };
    inProgressFiles: { [key: string]: string };
    detectedFiles: { [key: string]: 'detected' | 'writing' | 'complete' };
}

export interface FileExtractionOptions {
    shouldExcludeFile?: (fileName: string) => boolean;
    minCompleteFileLength?: number;
    minInProgressFileLength?: number;
    detectPartialFiles?: boolean;
}

export class FileExtractor {
    private static defaultShouldExclude = (fileName: string): boolean => {
        const excludePatterns = [
            /^dfx\.json$/,
            /^package-lock\.json$/,
            /^yarn\.lock$/,
            /^\.gitignore$/,
            /^\.env/,
            /^\.dockerignore$/,
            /^Dockerfile$/,
            /^docker-compose\./,
            /^\.github\//,
            /^\.vscode\//,
            /^node_modules\//,
            /^dist\//,
            /^build\//,
            /\.log$/,
            /\.tmp$/,
            /\.cache$/,
            // 🔥 CRITICAL: Exclude vite.config files - platform generates these automatically
            /vite\.config\.(ts|js|mjs|cjs)$/i,
            /\/vite\.config\.(ts|js|mjs|cjs)$/i
        ];

        return excludePatterns.some(pattern => pattern.test(fileName));
    };

    /**
     * Extract and clean conversational response content by removing code blocks,
     * file markers, imports, and other technical artifacts to leave clean prose.
     */
    public static extractCleanResponse(rawContent: string): string {
        // 🆕 Get debug context for logging cleanup operations
        const debugContext = getDebugContext();
        
        let cleanContent = rawContent;
        
        try {
            // 🆕 Log start of cleanup process
            if (debugContext?.isDebugEnabled) {
                debugContext.captureProcessingStep({
                    step: 'Response content cleanup started',
                    input: `Raw content: ${rawContent.length} chars`,
                    output: 'Starting cleanup process',
                    success: true
                });
            }
            
            // Remove complete code blocks with content
            cleanContent = cleanContent.replace(new RegExp('```[\\w]*\\n[\\s\\S]*?\\n```', 'g'), '');
            
            // Remove standalone code block markers
            cleanContent = cleanContent.replace(new RegExp('^```[\\w]*$', 'gm'), '');
            cleanContent = cleanContent.replace(new RegExp('^```$', 'gm'), '');
            
            // Remove file path comments/markers
            cleanContent = cleanContent.replace(new RegExp('^//\\s*[\\w/\\.-]+\\.(tsx?|jsx?|css|scss|json|html|md)$', 'gm'), '');
            
            // Remove import statements
            cleanContent = cleanContent.replace(new RegExp('^import\\s+.*$', 'gm'), '');
            
            // Normalize excessive line breaks
            cleanContent = cleanContent.replace(new RegExp('\\n{3,}', 'g'), '\\n\\n');
            
            // Clean up whitespace
            cleanContent = cleanContent.trim();
            
            // Provide fallback response if content is too short or invalid
            if (cleanContent.length < 20 || !cleanContent.includes(' ')) {
                cleanContent = 'I\'ve analyzed your code and prepared the requested updates. The changes will preserve your existing functionality while implementing the improvements you requested.';
                
                // 🆕 Log fallback response usage
                if (debugContext?.isDebugEnabled) {
                    debugContext.captureProcessingStep({
                        step: 'Response cleanup fallback applied',
                        input: `Cleaned content too short: ${cleanContent.length} chars`,
                        output: 'Using fallback response',
                        success: true
                    });
                }
            } else {
                // 🆕 Log successful cleanup
                if (debugContext?.isDebugEnabled) {
                    debugContext.captureProcessingStep({
                        step: 'Response content cleanup completed',
                        input: `Original: ${rawContent.length} chars`,
                        output: `Cleaned: ${cleanContent.length} chars`,
                        success: true
                    });
                }
            }
            
            return cleanContent;
            
        } catch (error) {
            // 🆕 Log cleanup error
            if (debugContext?.isDebugEnabled) {
                debugContext.captureProcessingStep({
                    step: 'Response cleanup error',
                    input: `Content length: ${rawContent.length}`,
                    output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    success: false
                });
            }
            
            return cleanContent || 'I\'ve analyzed your code and prepared the requested updates.';
        }
    }

    /**
     * FIXED: Only detect files with CLEAR GENERATION INTENT - no casual mentions
     */
    public static detectProgressiveFiles(
        content: string,
        options: FileExtractionOptions = {}
    ): FileExtractionResult {
        const {
            shouldExcludeFile = FileExtractor.defaultShouldExclude,
            minCompleteFileLength = 10,
            minInProgressFileLength = 5,
            detectPartialFiles = true
        } = options;

        const completeFiles: { [key: string]: string } = {};
        const inProgressFiles: { [key: string]: string } = {};
        const detectedFiles: { [key: string]: 'detected' | 'writing' | 'complete' } = {};
        
        // Case-insensitive tracking to prevent duplicates
        const processedFiles = new Map<string, string>(); // lowercase -> actual filename

        // 🆕 Get debug context for logging extraction attempts
        const debugContext = getDebugContext();
        
        // 🆕 Track extraction statistics for debug logging
        const extractionStats = {
            patternsAttempted: 0,
            patternsSuccessful: 0,
            totalMatches: 0,
            completeFilesFound: 0,
            inProgressFilesFound: 0,
            detectedFilesFound: 0,
            excludedFiles: 0
        };

        try {
            // console.log('🔍 [FileExtractor] Starting INTENT-BASED file detection...');
            
            // 🆕 Log start of file extraction
            if (debugContext?.isDebugEnabled) {
                debugContext.captureProcessingStep({
                    step: 'File extraction started',
                    input: `Content: ${content.length} chars, detectPartialFiles: ${detectPartialFiles}`,
                    output: 'Beginning intent-based file detection',
                    success: true
                });
            }

            // PHASE 1: Detect complete files with actual content (HIGHEST PRIORITY)
            const completeFilePatterns = [
                // Complete TypeScript/React files
                {
                    regex: /```(?:typescript|ts|tsx|jsx|javascript|js|react)\s*\n(?:\/\/\s*([^\n]+\.(?:tsx?|jsx?|js))[^\n]*\n)?([\s\S]*?)```/gi,
                    type: 'typescript'
                },
                // Complete JSON files
                {
                    regex: /```json\s*\n(?:(?:\/\/|\/\*)\s*([^\n\*]+\.json)[^\n\*]*(?:\*\/)?\s*\n)?([\s\S]*?)```/gi,
                    type: 'json'
                },
                // Complete CSS files
                {
                    regex: /```(?:css|scss|sass)\s*\n(?:\/\*\s*([^\n*]+\.(?:css|scss))[^\n*]*\s*\*\/\s*\n)?([\s\S]*?)```/gi,
                    type: 'css'
                },
                // Complete Motoko files
                {
                    regex: /```motoko\s*\n(?:\/\/\s*([^\n]+\.mo)[^\n]*\n)?([\s\S]*?)```/gi,
                    type: 'motoko'
                },
                // Complete HTML/Markdown files
                {
                    regex: /```(?:html|markdown|md)\s*\n(?:(?:\/\/|<!--)\s*([^\n\->]+\.(?:html|md))[^\n\->]*(?:-->)?\s*\n)([\s\S]*?)```/gi,
                    type: 'markup'
                }
            ];

            completeFilePatterns.forEach(({regex, type}, patternIndex) => {
                extractionStats.patternsAttempted++;
                regex.lastIndex = 0;
                let match;
                let patternMatches = 0;
                const patternFiles: string[] = [];
                
                while ((match = regex.exec(content)) !== null) {
                    let fileName = match[1]?.trim();
                    let fileContent = match[2]?.trim();

                    if (fileName && fileContent && fileContent.length > minCompleteFileLength) {
                        fileName = FileExtractor.cleanFileName(fileName, type);
                        const lowerFileName = fileName.toLowerCase();

                        if (processedFiles.has(lowerFileName)) {
                            // console.log(`🔄 [FileExtractor] Skipping duplicate complete file: ${fileName}`);
                            continue;
                        }

                        if (shouldExcludeFile(fileName)) {
                            extractionStats.excludedFiles++;
                            continue;
                        }

                        fileContent = FileExtractor.cleanFileContent(fileContent);

                        completeFiles[fileName] = fileContent;
                        detectedFiles[fileName] = 'complete';
                        processedFiles.set(lowerFileName, fileName);
                        patternMatches++;
                        extractionStats.completeFilesFound++;
                        patternFiles.push(fileName);
                        
                        // 🆕 CAPTURE COMPLETE FILES IN DEBUG CONTEXT
                        if (debugContext?.captureGeneratedFile) {
                            debugContext.captureGeneratedFile(fileName, fileContent);
                        }
                        
                        // console.log(`✅ [FileExtractor] Complete file with content: ${fileName} (${fileContent.length} chars)`);
                        
                        // 🆕 Log successful file extraction
                        if (debugContext?.isDebugEnabled) {
                            debugContext.captureProcessingStep({
                                step: `Complete file extracted: ${fileName}`,
                                input: `Pattern ${patternIndex + 1} (${type}), content: ${fileContent.length} chars`,
                                output: `File successfully extracted and stored`,
                                success: true
                            });
                        }
                    }
                }
                
                if (patternMatches > 0) {
                    extractionStats.patternsSuccessful++;
                }
                
                extractionStats.totalMatches += patternMatches;
                
                // 🆕 Log pattern attempt results
                if (debugContext?.isDebugEnabled) {
                    debugContext.captureExtractionAttempt({
                        pattern: `Complete files pattern ${patternIndex + 1} (${type})`,
                        matches: patternFiles,
                        success: patternMatches > 0
                    });
                }
            });

            // PHASE 2: Detect in-progress files (only if partial content detection is enabled)
            if (detectPartialFiles) {
                const inProgressPatterns = [
                    // In-progress TypeScript/React files
                    {
                        regex: new RegExp(
                            '```(?:typescript|ts|tsx|jsx|javascript|js|react)\\s*\\n' +
                            '(?:\\s*\\/\\/\\s*([^\\n]+\\.(?:tsx?|jsx?|js))[^\\n]*\\n)?' +
                            '([\\s\\S]*?)' +
                            '(?=```|\\n```|$)',
                            'gi'
                        ),
                        type: 'typescript'
                    },
                    // In-progress JSON files
                    {
                        regex: new RegExp(
                            '```json\\s*\\n' +
                            '(?:(?:\\/\\/|\\/\\*)\\s*([^\\n\\*]+\\.json)[^\\n\\*]*(?:\\*\\/)?\\s*\\n)?' +
                            '([\\s\\S]*?)' +
                            '(?=```|\\n```|$)',
                            'gi'
                        ),
                        type: 'json'
                    },
                    // In-progress CSS files
                    {
                        regex: new RegExp(
                            '```(?:css|scss|sass)\\s*\\n' +
                            '(?:\\/\\*\\s*([^\\n\\*]+\\.(?:css|scss))[^\\n\\*]*\\s*\\*\\/\\s*\\n)?' +
                            '([\\s\\S]*?)' +
                            '(?=```|\\n```|$)',
                            'gi'
                        ),
                        type: 'css'
                    },
                    // In-progress Motoko files
                    {
                        regex: new RegExp(
                            '```motoko\\s*\\n' +
                            '(?:\\/\\/\\s*([^\\n]+\\.mo)[^\\n]*\\n)?' +
                            '([\\s\\S]*?)' +
                            '(?=```|\\n```|$)',
                            'gi'
                        ),
                        type: 'motoko'
                    }
                ];

                inProgressPatterns.forEach(({regex, type}, patternIndex) => {
                    extractionStats.patternsAttempted++;
                    regex.lastIndex = 0;
                    let match;
                    let patternMatches = 0;
                    const patternFiles: string[] = [];
                    
                    while ((match = regex.exec(content)) !== null) {
                        let fileName = match[1]?.trim();
                        let fileContent = match[2]?.trim();

                        if (fileName && fileContent && fileContent.length >= minInProgressFileLength) {
                            fileName = FileExtractor.cleanFileName(fileName, type);
                            const lowerFileName = fileName.toLowerCase();

                            if (processedFiles.has(lowerFileName)) {
                                // console.log(`🔄 [FileExtractor] Skipping duplicate in-progress file: ${fileName}`);
                                continue;
                            }

                            if (shouldExcludeFile(fileName)) {
                                extractionStats.excludedFiles++;
                                continue;
                            }

                            fileContent = FileExtractor.cleanFileContent(fileContent);
                            
                            if (FileExtractor.hasMeaningfulContent(fileContent, type)) {
                                inProgressFiles[fileName] = fileContent;
                                detectedFiles[fileName] = 'writing';
                                processedFiles.set(lowerFileName, fileName);
                                patternMatches++;
                                extractionStats.inProgressFilesFound++;
                                patternFiles.push(fileName);
                                
                                // 🆕 CAPTURE IN-PROGRESS FILES IN DEBUG CONTEXT
                                if (debugContext?.captureGeneratedFile) {
                                    debugContext.captureGeneratedFile(fileName, fileContent);
                                }
                                
                                // console.log(`📝 [FileExtractor] In-progress file with content: ${fileName} (${fileContent.length} chars)`);
                                
                                // 🆕 Log successful in-progress file extraction
                                if (debugContext?.isDebugEnabled) {
                                    debugContext.captureProcessingStep({
                                        step: `In-progress file extracted: ${fileName}`,
                                        input: `Pattern ${patternIndex + 1} (${type}), content: ${fileContent.length} chars`,
                                        output: `In-progress file successfully extracted`,
                                        success: true
                                    });
                                }
                            }
                        }
                    }
                    
                    if (patternMatches > 0) {
                        extractionStats.patternsSuccessful++;
                    }
                    
                    extractionStats.totalMatches += patternMatches;
                    
                    // 🆕 Log in-progress pattern attempt results
                    if (debugContext?.isDebugEnabled) {
                        debugContext.captureExtractionAttempt({
                            pattern: `In-progress files pattern ${patternIndex + 1} (${type})`,
                            matches: patternFiles,
                            success: patternMatches > 0
                        });
                    }
                });
            }

            // PHASE 3: STRICT INTENT-BASED file marker detection (ONLY clear generation intent)
            if (detectPartialFiles) {
                // console.log('🎯 [FileExtractor] Starting STRICT intent-based marker detection...');
                
                // ONLY detect files that are clearly mentioned with generation intent
                const strictIntentPatterns = [
                    // Files mentioned in code block headers (strong intent)
                    new RegExp('```\\w*\\s*\\n\\s*(?:\\/\\/|\\/\\*|<!--)\\s*([a-zA-Z0-9_\\-\\/\\.]+\\.(?:tsx?|jsx?|js|json|css|scss|mo|html|md))\\s*(?:\\*\\/|-->)?\\s*\\n', 'gi'),
                    
                    // Explicit creation statements (very strong intent)
                    new RegExp('(?:I\'ll create|Let me create|Creating|I\'m creating|We\'ll create|Now create)\\s+(?:a\\s+|the\\s+)?(?:file\\s+)?["`\']?([a-zA-Z0-9_\\-\\/\\.]+\\.(?:tsx?|jsx?|js|json|css|scss|mo|html|md))["`\']?', 'gi'),
                    
                    // Explicit file generation statements
                    new RegExp('(?:Generate|Generating|Build|Building)\\s+(?:a\\s+|the\\s+)?(?:file\\s+)?["`\']?([a-zA-Z0-9_\\-\\/\\.]+\\.(?:tsx?|jsx?|js|json|css|scss|mo|html|md))["`\']?', 'gi'),
                    
                    // "Next, let's create..." type statements
                    new RegExp('(?:Next,?\\s+(?:let\'s\\s+|we\'ll\\s+)?(?:create|add|generate)|Let\'s\\s+(?:create|add|generate))\\s+(?:a\\s+|the\\s+)?(?:file\\s+)?["`\']?([a-zA-Z0-9_\\-\\/\\.]+\\.(?:tsx?|jsx?|js|json|css|scss|mo|html|md))["`\']?', 'gi'),
                    
                    // Files mentioned with clear action verbs in imperative form
                    new RegExp('(?:^|\\n)\\s*(?:\\d+\\.\\s*)?(?:Create|Add|Generate|Write)\\s+["`\']?([a-zA-Z0-9_\\-\\/\\.]+\\.(?:tsx?|jsx?|js|json|css|scss|mo|html|md))["`\']?', 'gim')
                ];

                strictIntentPatterns.forEach((pattern, patternIndex) => {
                    extractionStats.patternsAttempted++;
                    pattern.lastIndex = 0;
                    let match;
                    let patternMatches = 0;
                    const patternFiles: string[] = [];
                    
                    while ((match = pattern.exec(content)) !== null) {
                        let fileName = match[1]?.trim();
                        
                        if (fileName && !shouldExcludeFile(fileName)) {
                            fileName = FileExtractor.cleanFileName(fileName, 'generic');
                            const lowerFileName = fileName.toLowerCase();

                            // Skip if already processed
                            if (processedFiles.has(lowerFileName)) {
                                // console.log(`🔄 [FileExtractor] INTENT: Already have ${processedFiles.get(lowerFileName)}, skipping ${fileName}`);
                                continue;
                            }

                            // CRITICAL: Check context to ensure this is truly generation intent
                            const matchContext = content.substring(
                                Math.max(0, match.index - 100), 
                                Math.min(content.length, match.index + match[0].length + 100)
                            ).toLowerCase();

                            // EXCLUDE if this appears to be description/summary text
                            const excludeContexts = [
                                'this includes:',
                                'configuration files:',
                                'the app demonstrates',
                                'dependencies:',
                                'with required dependencies',
                                'platform includes:',
                                'project includes:',
                                'files include:',
                                'summary',
                                'overview',
                                'features:',
                                'components:',
                                'structure:'
                            ];

                            const isDescriptiveContext = excludeContexts.some(exclude => 
                                matchContext.includes(exclude)
                            );

                            if (isDescriptiveContext) {
                                // console.log(`🚫 [FileExtractor] INTENT FILTER: Excluding descriptive mention of ${fileName}`);
                                // console.log(`   Context: ${matchContext.substring(0, 150)}...`);
                                
                                // 🆕 Log intent filtering
                                if (debugContext?.isDebugEnabled) {
                                    debugContext.captureProcessingStep({
                                        step: `Intent filter applied: ${fileName}`,
                                        input: `Context analysis for ${fileName}`,
                                        output: `Excluded as descriptive mention, not generation intent`,
                                        success: true
                                    });
                                }
                                continue;
                            }

                            // Only add if this seems like real generation intent
                            detectedFiles[fileName] = 'detected';
                            processedFiles.set(lowerFileName, fileName);
                            patternMatches++;
                            extractionStats.detectedFilesFound++;
                            patternFiles.push(fileName);
                            
                            // 🆕 CAPTURE DETECTED FILES IN DEBUG CONTEXT (with empty content for now)
                            if (debugContext?.captureGeneratedFile) {
                                debugContext.captureGeneratedFile(fileName, ''); // Empty content for detected files
                            }
                            
                            // console.log(`🎯 [FileExtractor] INTENT: File generation detected: ${fileName} (pattern ${patternIndex})`);
                            // console.log(`   Context: ${match[0]}`);
                            
                            // 🆕 Log intent-based file detection
                            if (debugContext?.isDebugEnabled) {
                                debugContext.captureProcessingStep({
                                    step: `Intent-based file detected: ${fileName}`,
                                    input: `Pattern ${patternIndex + 1}, context: ${match[0].substring(0, 100)}`,
                                    output: `File detected with clear generation intent`,
                                    success: true
                                });
                            }
                        }
                    }
                    
                    if (patternMatches > 0) {
                        extractionStats.patternsSuccessful++;
                    }
                    
                    extractionStats.totalMatches += patternMatches;
                    
                    // console.log(`🎯 [FileExtractor] Pattern ${patternIndex} found ${patternMatches} intent-based files`);
                    
                    // 🆕 Log intent pattern attempt results
                    if (debugContext?.isDebugEnabled) {
                        debugContext.captureExtractionAttempt({
                            pattern: `Intent-based pattern ${patternIndex + 1}`,
                            matches: patternFiles,
                            success: patternMatches > 0
                        });
                    }
                });
            }

            // console.log(`📁 [FileExtractor] INTENT-BASED detection results:`, {
            //     detected: Object.keys(detectedFiles).length,
            //     complete: Object.keys(completeFiles).length,
            //     inProgress: Object.keys(inProgressFiles).length,
            //     totalUnique: processedFiles.size,
            //     processedFilesMap: Array.from(processedFiles.entries())
            // });

            // FINAL VALIDATION: Remove any files that don't have content OR clear intent
            const validatedDetectedFiles: { [key: string]: 'detected' | 'writing' | 'complete' } = {};
            let validationRemovals = 0;
            
            Object.entries(detectedFiles).forEach(([fileName, state]) => {
                const hasContent = completeFiles[fileName] || inProgressFiles[fileName];
                const hasStrongIntent = state === 'complete' || state === 'writing' || 
                    (state === 'detected' && !fileName.match(/^[A-Z]/)); // Avoid capitalized casual mentions
                
                if (hasContent || hasStrongIntent) {
                    validatedDetectedFiles[fileName] = state;
                } else {
                    validationRemovals++;
                    // console.log(`🚫 [FileExtractor] VALIDATION: Removing weak file detection: ${fileName}`);
                    
                    // 🆕 Log validation removal
                    if (debugContext?.isDebugEnabled) {
                        debugContext.captureProcessingStep({
                            step: `Validation removal: ${fileName}`,
                            input: `File state: ${state}, hasContent: ${!!hasContent}`,
                            output: `Removed due to weak detection signals`,
                            success: true
                        });
                    }
                }
            });

            // 🆕 Log final extraction summary
            if (debugContext?.isDebugEnabled) {
                debugContext.captureProcessingStep({
                    step: 'File extraction completed',
                    input: `Content: ${content.length} chars, Patterns attempted: ${extractionStats.patternsAttempted}`,
                    output: `Files extracted: ${Object.keys(validatedDetectedFiles).length} total (${Object.keys(completeFiles).length} complete, ${Object.keys(inProgressFiles).length} in-progress, ${extractionStats.detectedFilesFound} detected), ${validationRemovals} removed in validation, ${extractionStats.excludedFiles} excluded`,
                    success: Object.keys(validatedDetectedFiles).length > 0
                });
            }

            return { 
                completeFiles, 
                inProgressFiles, 
                detectedFiles: validatedDetectedFiles 
            };

        } catch (error) {
            console.warn('FileExtractor error:', error);
            
            // 🆕 Log extraction error
            if (debugContext?.isDebugEnabled) {
                debugContext.captureProcessingStep({
                    step: 'File extraction error',
                    input: `Content: ${content.length} chars`,
                    output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    success: false
                });
            }
            
            return { completeFiles, inProgressFiles, detectedFiles };
        }
    }

    // Helper functions remain the same
    private static cleanFileName(fileName: string, type: string): string {
        // Remove comment markers and prefixes
        fileName = fileName.replace(/^.*\/\/\s*/, '');
        fileName = fileName.replace(/^.*\/\*\s*/, '');
        fileName = fileName.replace(/\s*\*\/.*$/, '');
        fileName = fileName.replace(/^.*<!--\s*/, '');
        fileName = fileName.replace(/\s*-->.*$/, '');
        fileName = fileName.replace(/^Complete file:\s*/i, '');
        fileName = fileName.replace(/^File:\s*/i, '');
        fileName = fileName.replace(/^Creating:\s*/i, '');
        fileName = fileName.replace(/^In:\s*/i, ''); // Remove "In: " prefix (common in AI responses)
        fileName = fileName.trim();

        // Normalize case for common files
        const lowerFileName = fileName.toLowerCase();
        if (lowerFileName === 'package.json') {
            fileName = 'package.json';
        }

        // Add proper file extension if missing
        if (!fileName.includes('.')) {
            if (type === 'css') fileName += '.css';
            else if (type === 'motoko') fileName += '.mo';
            else if (type === 'json') fileName += '.json';
            else if (type === 'markup') fileName += '.html';
            else fileName += '.tsx';
        }

        // Add proper path structure if missing
        if (!fileName.includes('/') && !fileName.startsWith('src/')) {
            const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
            if (ext === '.mo') {
                fileName = `src/backend/src/${fileName}`;
            } else if (ext === '.json') {
                // Smart JSON placement
                if (fileName.includes('package') || fileName.includes('tsconfig') || fileName.includes('tailwind')) {
                    fileName = fileName; // Keep in root
                } else {
                    fileName = `src/frontend/src/${fileName}`;
                }
            } else if (['.css', '.scss'].includes(ext)) {
                fileName = `src/frontend/src/${fileName}`;
            } else {
                fileName = `src/frontend/src/${fileName}`;
            }
        }

        return fileName;
    }

    private static cleanFileContent(content: string): string {
        // Remove file header comments
        content = content.replace(/^(?:\/\/|\/\*|<!--).*?(?:Complete file|File|Creating):.*?(?:\n|\*\/|-->)/i, '');
        content = content.replace(/^\/\*[\s\S]*?\*\/\s*\n/, '');
        content = content.replace(/^<!--[\s\S]*?-->\s*\n/, '');
        
        // 🔥 NEW: Remove common leading indentation (fixes issue where AI indents entire code blocks)
        const lines = content.split('\n');
        if (lines.length > 1) {
            // Find minimum leading whitespace (excluding empty lines)
            const nonEmptyLines = lines.filter(line => line.trim().length > 0);
            if (nonEmptyLines.length > 0) {
                const leadingWhitespaces = nonEmptyLines.map(line => {
                    const match = line.match(/^(\s*)/);
                    return match ? match[1].length : 0;
                });
                const minIndent = Math.min(...leadingWhitespaces);
                
                // Remove common indentation from all lines
                if (minIndent > 0) {
                    content = lines.map(line => {
                        if (line.trim().length === 0) return line; // Preserve empty lines as-is
                        return line.substring(minIndent);
                    }).join('\n');
                }
            }
        }
        
        content = content.trim();
        return content;
    }

    private static hasMeaningfulContent(content: string, fileType?: string): boolean {
        if (!content || content.length < 5) return false;
        
        // Special handling for JSON files
        if (fileType === 'json') {
            const trimmed = content.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                return true;
            }
            try {
                JSON.parse(trimmed);
                return true;
            } catch {
                return trimmed.includes('{') || trimmed.includes('[') || trimmed.includes('"');
            }
        }
        
        // Check for actual code content
        const meaningfulLines = content.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && 
                   !trimmed.startsWith('//') && 
                   !trimmed.startsWith('/*') && 
                   !trimmed.startsWith('*') &&
                   !trimmed.startsWith('<!--') &&
                   trimmed !== '{' &&
                   trimmed !== '}';
        });

        return meaningfulLines.length > 0;
    }

    // Maintain backward compatibility
    public static extractFiles(
        content: string, 
        options: FileExtractionOptions = {}
    ): FileExtractionResult {
        return FileExtractor.detectProgressiveFiles(content, options);
    }

    public static extractFilesWithStreaming(
        content: string, 
        shouldExcludeFile?: (fileName: string) => boolean
    ): FileExtractionResult {
        return FileExtractor.detectProgressiveFiles(content, { shouldExcludeFile });
    }
}