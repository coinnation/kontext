import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore, useUserSettings } from '../store/appStore';
import { claudeService } from '../claudeService';

// Speech recognition interfaces
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
}

interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item: (index: number) => SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item: (index: number) => SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognitionConstructor {
    new(): SpeechRecognition;
    prototype: SpeechRecognition;
}

interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

const SpeechRecognitionAPI = (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
) as SpeechRecognitionConstructor | null;

// File attachment interface
interface AttachedFile {
    id: string;
    name: string;
    type: string;
    size: number;
    base64Data: string;
    timestamp: number;
    isProcessed: boolean;
    textContent?: string; // For documents
    convertedToImage?: boolean; // For PDFs converted to images
}

interface AttachedImage {
    id: string;
    name: string;
    type: string;
    size: number;
    base64Data: string;
    mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
    timestamp: number;
}

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    onSend: (files?: AttachedFile[], images?: AttachedImage[]) => void;
    isGenerating: boolean;
    isMobile: boolean;
    inputRef: React.RefObject<HTMLTextAreaElement>;
    hasActiveProject: boolean;
    setMessagePending: (pending: boolean) => void;
    isDeploymentActive?: boolean;
}

// File utilities
const getFileIcon = (type: string): string => {
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('text')) return '📄';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
    return '📁';
};

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const isValidFileType = (type: string, fileName?: string): boolean => {
    const allowedTypes = [
        // Office Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // OpenDocument formats
        'application/vnd.oasis.opendocument.text',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation',
        // Text-based files
        'text/plain',
        'text/markdown',
        'text/csv',
        'text/html',
        'text/css',
        'text/javascript',
        'application/javascript',
        'application/json',
        'application/xml',
        'text/xml',
        // Rich text
        'application/rtf',
        'text/rtf'
    ];
    
    // Check MIME type first
    if (allowedTypes.includes(type)) {
        return true;
    }
    
    // Fallback: Check file extension if MIME type is empty or generic
    if ((!type || type === 'application/octet-stream' || type.startsWith('text/') || type === 'application/json') && fileName) {
        const extension = fileName.toLowerCase().split('.').pop();
        const allowedExtensions = [
            // Office documents
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
            // OpenDocument
            'odt', 'ods', 'odp',
            // Text and code files
            'txt', 'md', 'csv', 'json', 'json5',
            // Code files
            'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
            'py', 'java', 'cpp', 'c', 'cc', 'cxx', 'h', 'hpp',
            'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala',
            'sh', 'bash', 'zsh', 'fish', 'ps1',
            'r', 'm', 'sql', 'pl', 'lua', 'vim', 'clj', 'hs',
            // Web files
            'html', 'htm', 'xhtml', 'css', 'scss', 'sass', 'less',
            // Configuration files
            'yml', 'yaml', 'toml', 'ini', 'conf', 'config',
            'env', 'properties', 'xml',
            // Other text formats
            'rtf', 'log', 'diff', 'patch'
        ];
        if (extension && allowedExtensions.includes(extension)) {
            console.log(`⚠️ [ChatInput] File type detected by extension: .${extension} (MIME type was: ${type})`);
            return true;
        }
    }
    
    return false;
};

const isValidImageType = (type: string): boolean => {
    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
    ];
    return allowedTypes.includes(type);
};

// Convert PDF to image using canvas (simplified - in production, use pdf.js)
const convertPDFToImage = async (file: File): Promise<AttachedImage[]> => {
    // For now, we'll show an error and suggest using an image instead
    // In production, integrate pdf.js library for proper PDF rendering
    throw new Error('PDF conversion requires pdf.js library. Please convert PDF to image first or use the file upload for text extraction.');
};

// File storage utilities
const STORAGE_KEY_PREFIX = 'chat_file_';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB limit for localStorage (leave room for other data)

// Estimate localStorage usage for chat files only
const estimateStorageUsage = (): number => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
            const value = localStorage.getItem(key);
            if (value) {
                total += key.length + value.length;
            }
        }
    }
    return total;
};

// Clear old files to make room
const clearOldFiles = (requiredSpace: number): void => {
    const files = getFilesFromLocalStorage();
    // Sort by timestamp (oldest first)
    files.sort((a, b) => a.timestamp - b.timestamp);
    
    let freedSpace = 0;
    for (const file of files) {
        const fileSize = JSON.stringify(file).length;
        removeFileFromLocalStorage(file.id);
        freedSpace += fileSize;
        if (freedSpace >= requiredSpace) {
            break;
        }
    }
};

const storeFileInLocalStorage = (file: AttachedFile): void => {
    try {
        const fileData = JSON.stringify(file);
        const fileSize = fileData.length;
        const currentUsage = estimateStorageUsage();
        const availableSpace = MAX_STORAGE_SIZE - currentUsage;
        
        // If we don't have enough space, try to clear old files
        if (fileSize > availableSpace) {
            console.log(`⚠️ [ChatInput] Low storage space. Clearing old files...`);
            clearOldFiles(fileSize - availableSpace);
            
            // Check again after clearing
            const newUsage = estimateStorageUsage();
            const newAvailableSpace = MAX_STORAGE_SIZE - newUsage;
            
            // Ensure we have a positive value
            if (newAvailableSpace <= 0 || fileSize > newAvailableSpace) {
                const availableMB = Math.max(0, Math.round(newAvailableSpace / 1024 / 1024 * 100) / 100);
                throw new Error(`File too large for storage. Please try a smaller file (max ~${availableMB}MB available).`);
            }
        }
        
        localStorage.setItem(STORAGE_KEY_PREFIX + file.id, fileData);
    } catch (error: any) {
        console.error('Failed to store file in localStorage:', error);
        if (error.message && error.message.includes('too large')) {
            throw error;
        }
        throw new Error('Storage full. Please try a smaller file or clear old files.');
    }
};

const getFilesFromLocalStorage = (): AttachedFile[] => {
    const files: AttachedFile[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_KEY_PREFIX)) {
            try {
                const fileData = localStorage.getItem(key);
                if (fileData) {
                    files.push(JSON.parse(fileData));
                }
            } catch (error) {
                console.error('Failed to parse file from localStorage:', error);
            }
        }
    }
    return files.sort((a, b) => a.timestamp - b.timestamp);
};

const removeFileFromLocalStorage = (fileId: string): void => {
    localStorage.removeItem(STORAGE_KEY_PREFIX + fileId);
};

const clearAllChatFiles = (): void => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_KEY_PREFIX)) {
            keys.push(key);
        }
    }
    keys.forEach(key => localStorage.removeItem(key));
};

export const ChatInput: React.FC<ChatInputProps> = ({
    input,
    setInput,
    onSend,
    isGenerating,
    isMobile,
    inputRef,
    hasActiveProject,
    setMessagePending,
    isDeploymentActive = false
}) => {
    // CRITICAL FIX: Enhanced deployment state subscription with proper reactivity
    const deploymentCoordinationState = useAppStore(state => state.deploymentCoordination);
    const isActuallyDeploying = deploymentCoordinationState.isCoordinating;
    
    // Get selected model from store
    const { selectedChatModel, setSelectedChatModel, claudeApiKey, geminiApiKey, kimiApiKey, openaiApiKey } = useUserSettings();
    
    // Model selector dropdown state
    const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    
    // Model display names with color styling
    const modelInfo = {
        claude: { name: 'Claude', icon: '🧠', color: '#3b82f6' }, // Blue
        gemini: { name: 'Gemini', icon: '🧠', color: '#fbbf24' }, // Amber/Yellow
        kimi: { name: 'Kimi', icon: '🧠', color: '#a855f7' }, // Purple
        openai: { name: 'OpenAI', icon: '🧠', color: '#10b981' } // Green
    };
    
    // Close model dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
        };
        
        if (showModelDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showModelDropdown]);
    
    // DEBUG: Enhanced logging for deployment state with reactivity tracking
    useEffect(() => {
        console.log('🔥 [ChatInput] Deployment state changed:', { 
            isDeploymentActive, 
            isActuallyDeploying, 
            hasActiveProject, 
            isGenerating,
            lastUpdate: new Date(deploymentCoordinationState.lastUpdateTime).toISOString(),
            activeDeployments: Object.keys(deploymentCoordinationState.activeDeployments).length,
            deploymentStates: Object.keys(deploymentCoordinationState.deploymentStates).length
        });
    }, [isDeploymentActive, isActuallyDeploying, hasActiveProject, isGenerating, deploymentCoordinationState.lastUpdateTime]);



    // Speech recognition state
    const [isListening, setIsListening] = useState<boolean>(false);
    const [speechSupported, setSpeechSupported] = useState<boolean>(!!SpeechRecognitionAPI);
    const [speechError, setSpeechError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // File attachment state
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isProcessingFiles, setIsProcessingFiles] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);
    const dragCounterRef = useRef(0);
    
    // File and image input refs for click-to-upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Auto-dismiss errors after 8 seconds
    useEffect(() => {
        if (fileError || speechError) {
            const timer = setTimeout(() => {
                setFileError(null);
                setSpeechError(null);
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [fileError, speechError]);

    // Load existing files from localStorage on mount
    useEffect(() => {
        const existingFiles = getFilesFromLocalStorage();
        setAttachedFiles(existingFiles);
    }, []);

    // Speech recognition setup
    useEffect(() => {
        if (SpeechRecognitionAPI) {
            setSpeechSupported(true);
        }
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    // ENHANCED: Reset height when input becomes empty
    useEffect(() => {
        if (input === '' && inputRef.current) {
            const minHeight = isMobile ? 32 : 36;
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = minHeight + 'px';
            inputRef.current.scrollTop = 0;
        }
    }, [input, isMobile]);

    // FIXED: Auto-resize functionality with proper empty content handling
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        
        // FIXED: Improved auto-resize textarea with proper empty content handling
        if (inputRef.current) {
            // Reset height to auto to get the correct scrollHeight
            inputRef.current.style.height = 'auto';
            
            // Calculate dimensions
            const maxHeight = isMobile ? 100 : 120;
            const minHeight = isMobile ? 32 : 36;
            
            // FIXED: If content is empty or just whitespace, use minimum height
            if (!e.target.value.trim()) {
                inputRef.current.style.height = minHeight + 'px';
            } else {
                // Calculate new height based on content for non-empty input
                const newHeight = Math.max(minHeight, Math.min(inputRef.current.scrollHeight, maxHeight));
                inputRef.current.style.height = newHeight + 'px';
            }
        }
        
        // Clear any errors when user starts typing
        setFileError(null);
        setSpeechError(null);
    };

    // FIXED: Auto-resize when input is cleared programmatically
    useEffect(() => {
        if (!input.trim() && inputRef.current) {
            const minHeight = isMobile ? 32 : 36;
            inputRef.current.style.height = minHeight + 'px';
        }
    }, [input, isMobile]);

    // ORIGINAL WORKING SUBMIT LOGIC WITH HEIGHT RESET FIX
    const handleSubmit = (e?: React.FormEvent) => {
        if (e) {
            e.preventDefault();
        }
        
        if (!hasActiveProject || (!input.trim() && attachedFiles.length === 0 && attachedImages.length === 0) || isInputDisabledForChat) {
            return;
        }
        
        setMessagePending(true);
        
        // Call onSend with files and images
        onSend(attachedFiles.length > 0 ? attachedFiles : undefined, attachedImages.length > 0 ? attachedImages : undefined);
        
        // CRITICAL FIX: Reset height AFTER input is cleared
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (inputRef.current) {
                    const minHeight = isMobile ? 32 : 36;
                    inputRef.current.style.height = 'auto';
                    inputRef.current.style.height = minHeight + 'px';
                    // Force a scroll reset
                    inputRef.current.scrollTop = 0;
                }
            }, 50);
        });
        
        // Clean up files and images AFTER onSend is called
        setTimeout(() => {
            attachedFiles.forEach(file => removeFileFromLocalStorage(file.id));
            setAttachedFiles([]);
            setAttachedImages([]);
        }, 100);
    };

    // ORIGINAL KEY HANDLING - UNCHANGED
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // On mobile, allow Enter for new lines - only submit on specific gesture
        if (isMobile) {
            // Don't submit on Enter on mobile - let users create new lines
            return;
        }
        
        // On desktop, Enter submits, Shift+Enter creates new line
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleTextareaClick = () => {
        if (inputRef.current && !isInputDisabledForChat) {
            inputRef.current.focus();
        }
    };

    // Separate chat-specific disabled state from deployment state
    const isInputDisabledForChat = !hasActiveProject || isGenerating;
    
    // ✅ NEW: Check if streaming is active for stop button
    const [isStreaming, setIsStreaming] = useState(false);
    
    // ✅ NEW: Check streaming status periodically - use singleton instance
    useEffect(() => {
        const checkStreaming = () => {
            // Use the singleton claudeService instance
            const serviceStreaming = claudeService.isStreaming();
            const actuallyStreaming = serviceStreaming || isGenerating;
            
            // ✅ DEBUG: Always log for troubleshooting
            // console.log('🛑 [ChatInput] Streaming check:', {
            //     isGenerating,
            //     serviceStreaming,
            //     actuallyStreaming,
            //     currentIsStreaming: isStreaming,
            //     abortController: claudeService['currentAbortController'] ? 'exists' : 'null'
            // });
            
            if (actuallyStreaming !== isStreaming) {
                console.log('🛑 [ChatInput] ⚠️ Streaming state CHANGED:', {
                    isGenerating,
                    serviceStreaming,
                    actuallyStreaming,
                    previousIsStreaming: isStreaming
                });
            }
            
            setIsStreaming(actuallyStreaming);
        };
        
        checkStreaming();
        const interval = setInterval(checkStreaming, 200); // Check more frequently
        
        return () => clearInterval(interval);
    }, [isGenerating, isStreaming]);
    
    // ✅ NEW: Handle stop streaming
    const handleStopStreaming = useCallback(() => {
        console.log('🛑 [ChatInput] Stop button clicked - stopping streaming');
        claudeService.stopStreaming();
        
        // ✅ NEW: Clear streaming state immediately
        setIsStreaming(false);
        
        // ✅ NEW: Also clear generation state in store
        const store = useAppStore.getState();
        if (store.completeGeneration && typeof store.completeGeneration === 'function') {
            store.completeGeneration();
            console.log('✅ [ChatInput] Cleared generation state after stop');
        } else if (store.forceCompleteGeneration && typeof store.forceCompleteGeneration === 'function') {
            store.forceCompleteGeneration();
            console.log('✅ [ChatInput] Force cleared generation state after stop');
        }
    }, []);

    // CRITICAL FIX: Use actual deployment state from store instead of prop
    const shouldShowDeploymentBanner = isActuallyDeploying && hasActiveProject && !isGenerating;

    // Determine placeholder text with deployment awareness
    const getPlaceholderText = (): string => {
        if (!hasActiveProject) {
            return "Select a project to start...";
        }
        if (shouldShowDeploymentBanner) {
            return "Deployment in progress - you can still chat...";
        }
        if (isGenerating) {
            return "Generating response...";
        }
        return "Tell me what you need...";
    };

    const placeholderText = getPlaceholderText();

    // Speech recognition functions
    const startSpeechRecognition = () => {
        if (!SpeechRecognitionAPI) {
            setSpeechError('Speech recognition is not supported in your browser.');
            return;
        }

        try {
            recognitionRef.current = new SpeechRecognitionAPI() as SpeechRecognition;
            const recognition = recognitionRef.current;

            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0])
                    .map(result => result.transcript)
                    .join('');

                setInput(transcript);
                
                // FIXED: Trigger auto-resize for speech recognition input
                if (inputRef.current) {
                    inputRef.current.style.height = 'auto';
                    const maxHeight = isMobile ? 100 : 120;
                    const minHeight = isMobile ? 32 : 36;
                    
                    if (!transcript.trim()) {
                        inputRef.current.style.height = minHeight + 'px';
                    } else {
                        const newHeight = Math.max(minHeight, Math.min(inputRef.current.scrollHeight, maxHeight));
                        inputRef.current.style.height = newHeight + 'px';
                    }
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error, event.message);
                setSpeechError(`Speech recognition error: ${event.error}`);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.start();
            setIsListening(true);
            setSpeechError(null);
        } catch (err) {
            console.error('Speech recognition start error:', err);
            setSpeechError('Failed to start speech recognition. Please check browser permissions.');
            setIsListening(false);
        }
    };

    const stopSpeechRecognition = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    // Helper function to extract text from .docx files using jszip
    const extractTextFromDocx = async (file: File): Promise<string> => {
        try {
            // @ts-ignore - Dynamic import that may not be available
            const JSZip = (await import(/* @vite-ignore */ 'jszip')).default;
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // .docx files contain text in word/document.xml
            const documentXml = await zip.file('word/document.xml')?.async('string');
            if (!documentXml) {
                throw new Error('Could not find document.xml in .docx file');
            }
            
            // Extract text from XML (simple extraction - removes XML tags)
            // This is a basic extraction - for better results, consider using a proper XML parser
            const text = documentXml
                .replace(/<[^>]+>/g, ' ') // Remove XML tags
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
            
            return text || `[Word document: ${file.name} - text extraction completed but no readable text found]`;
        } catch (error) {
            console.error(`❌ [ChatInput] Error extracting text from .docx:`, error);
            return `[Word document: ${file.name} - text extraction failed. Please describe the document content in your message.]`;
        }
    };

    // Helper function to extract text from Excel files (.xlsx)
    const extractTextFromExcel = async (file: File): Promise<string> => {
        try {
            // Try to use xlsx library if available
            try {
                // @ts-ignore - Dynamic import that may not be available
                const XLSX = (await import(/* @vite-ignore */ 'xlsx')).default;
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                
                let allText = '';
                workbook.SheetNames.forEach((sheetName, index) => {
                    const worksheet = workbook.Sheets[sheetName];
                    const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                    
                    if (index > 0) allText += `\n\n--- Sheet: ${sheetName} ---\n`;
                    sheetData.forEach((row: any) => {
                        if (Array.isArray(row)) {
                            const rowText = row.filter(cell => cell !== '').join(' | ');
                            if (rowText.trim()) {
                                allText += rowText + '\n';
                            }
                        }
                    });
                });
                
                return allText.trim() || `[Excel spreadsheet: ${file.name} - extracted but appears to be empty]`;
            } catch (importError) {
                // xlsx library not available - provide helpful message
                console.warn(`⚠️ [ChatInput] xlsx library not available for ${file.name}. Install with: npm install xlsx`);
                return `[Excel spreadsheet: ${file.name} - text extraction requires the 'xlsx' library. Please describe the spreadsheet content in your message, or install the library to enable automatic extraction.]`;
            }
        } catch (error) {
            console.error(`❌ [ChatInput] Error extracting text from Excel:`, error);
            return `[Excel spreadsheet: ${file.name} - text extraction failed. Please describe the spreadsheet content in your message.]`;
        }
    };

    // Helper function to extract text from PDF files using pdf.js
    const extractTextFromPDF = async (file: File): Promise<string> => {
        try {
            // Try to use pdf.js library if available
            try {
                // @ts-ignore - Dynamic import that may not be available
                const pdfjsLib = await import(/* @vite-ignore */ 'pdfjs-dist');
                // Set worker source (required for pdf.js)
                pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
                
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                
                let allText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items
                        .map((item: any) => item.str)
                        .join(' ');
                    allText += `\n\n--- Page ${i} ---\n${pageText}`;
                }
                
                return allText.trim() || `[PDF document: ${file.name} - extracted but appears to be empty or image-only]`;
            } catch (importError) {
                // pdf.js library not available - provide helpful message
                console.warn(`⚠️ [ChatInput] pdf.js library not available for ${file.name}. Install with: npm install pdfjs-dist`);
                return `[PDF document: ${file.name} - text extraction requires the 'pdfjs-dist' library. Please describe the document content in your message, or install the library to enable automatic extraction.]`;
            }
        } catch (error) {
            console.error(`❌ [ChatInput] Error extracting text from PDF:`, error);
            return `[PDF document: ${file.name} - text extraction failed. Please describe the document content in your message.]`;
        }
    };

    // Helper function to extract text from PowerPoint files (.pptx)
    const extractTextFromPowerPoint = async (file: File): Promise<string> => {
        try {
            // .pptx files are also ZIP archives like .docx
            // @ts-ignore - Dynamic import that may not be available
            const JSZip = (await import(/* @vite-ignore */ 'jszip')).default;
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            let allText = '';
            const slideFiles = zip.file(/ppt\/slides\/slide\d+\.xml/);
            
            if (slideFiles && slideFiles.length > 0) {
                for (const slideFile of slideFiles) {
                    const slideXml = await slideFile.async('string');
                    // Extract text from slide XML
                    const slideText = slideXml
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&apos;/g, "'")
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    if (slideText) {
                        allText += `\n\n--- Slide ${slideFile.name.match(/slide(\d+)\.xml/)?.[1] || '?'} ---\n${slideText}`;
                    }
                }
            }
            
            return allText.trim() || `[PowerPoint presentation: ${file.name} - text extraction completed but no readable text found]`;
        } catch (error) {
            console.error(`❌ [ChatInput] Error extracting text from PowerPoint:`, error);
            return `[PowerPoint presentation: ${file.name} - text extraction failed. Please describe the presentation content in your message.]`;
        }
    };

    // File processing functions
    const processFile = async (file: File): Promise<AttachedFile | null> => {
        console.log(`📄 [ChatInput] Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
        
        if (!isValidFileType(file.type, file.name)) {
            const errorMsg = `Unsupported file type: ${file.type || 'unknown'}. Supported: PDF, Word, Excel, PowerPoint, Text, Markdown, CSV, JSON, Code files (.js, .ts, .py, etc.), HTML, CSS, Config files (.yml, .toml, etc.)`;
            console.error(`❌ [ChatInput] ${errorMsg}`);
            setFileError(errorMsg);
            return null;
        }

        if (file.size > MAX_FILE_SIZE) {
            const errorMsg = `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`;
            console.error(`❌ [ChatInput] ${errorMsg}`);
            setFileError(errorMsg);
            return null;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const base64Data = e.target?.result as string;
                    let textContent: string | undefined;

                    const fileName = file.name.toLowerCase();
                    const fileType = file.type.toLowerCase();

                    // Extract text content based on file type
                    if (fileType === 'text/plain' || fileType === 'text/markdown' || fileType === 'text/csv' ||
                        fileType === 'text/html' || fileType === 'text/css' || fileType === 'text/javascript' ||
                        fileType === 'application/javascript' || fileType === 'application/json' ||
                        fileType === 'application/xml' || fileType === 'text/xml' ||
                        fileName.endsWith('.js') || fileName.endsWith('.jsx') || fileName.endsWith('.ts') ||
                        fileName.endsWith('.tsx') || fileName.endsWith('.json') || fileName.endsWith('.html') ||
                        fileName.endsWith('.css') || fileName.endsWith('.scss') || fileName.endsWith('.sass') ||
                        fileName.endsWith('.less') || fileName.endsWith('.py') || fileName.endsWith('.java') ||
                        fileName.endsWith('.cpp') || fileName.endsWith('.c') || fileName.endsWith('.go') ||
                        fileName.endsWith('.rs') || fileName.endsWith('.rb') || fileName.endsWith('.php') ||
                        fileName.endsWith('.swift') || fileName.endsWith('.kt') || fileName.endsWith('.sh') ||
                        fileName.endsWith('.bash') || fileName.endsWith('.yml') || fileName.endsWith('.yaml') ||
                        fileName.endsWith('.toml') || fileName.endsWith('.ini') || fileName.endsWith('.env') ||
                        fileName.endsWith('.xml') || fileName.endsWith('.log') || fileName.endsWith('.sql') ||
                        fileName.endsWith('.r') || fileName.endsWith('.m') || fileName.endsWith('.pl') ||
                        fileName.endsWith('.lua') || fileName.endsWith('.vim') || fileName.endsWith('.clj') ||
                        fileName.endsWith('.hs') || fileName.endsWith('.diff') || fileName.endsWith('.patch') ||
                        fileName.endsWith('.rtf') || fileName.endsWith('.conf') || fileName.endsWith('.config')) {
                        // Plain text and code files - direct extraction
                        textContent = base64Data.split(',')[1] ? atob(base64Data.split(',')[1]) : '';
                        console.log(`✅ [ChatInput] Extracted ${textContent.length} characters from text/code file`);
                    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                               fileName.endsWith('.docx')) {
                        // Word .docx files - extract text using jszip
                        console.log(`📝 [ChatInput] Extracting text from .docx file: ${file.name}`);
                        textContent = await extractTextFromDocx(file);
                        console.log(`✅ [ChatInput] Extracted ${textContent.length} characters from Word document`);
                    } else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
                        // Old .doc format - cannot extract text in browser, need backend
                        textContent = `[Word document (.doc format): ${file.name}. This older format requires specialized processing. Please describe the document content in your message if you need specific information from it.]`;
                        console.log(`📝 [ChatInput] .doc file detected - requires specialized processing`);
                    } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                        // PDF files - attempt extraction
                        console.log(`📄 [ChatInput] Processing PDF file: ${file.name}`);
                        textContent = await extractTextFromPDF(file);
                        console.log(`✅ [ChatInput] PDF processing complete`);
                    } else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                               fileType === 'application/vnd.ms-excel' ||
                               fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                        // Excel files - attempt extraction
                        console.log(`📊 [ChatInput] Extracting text from Excel file: ${file.name}`);
                        textContent = await extractTextFromExcel(file);
                        console.log(`✅ [ChatInput] Excel extraction complete`);
                    } else if (fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                               fileType === 'application/vnd.ms-powerpoint' ||
                               fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
                        // PowerPoint files - attempt extraction
                        console.log(`📽️ [ChatInput] Extracting text from PowerPoint file: ${file.name}`);
                        textContent = await extractTextFromPowerPoint(file);
                        console.log(`✅ [ChatInput] Extracted ${textContent.length} characters from PowerPoint`);
                    }

                    // For PDFs, we'll note that they should be converted to images
                    const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');

                    const attachedFile: AttachedFile = {
                        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
                        name: file.name,
                        type: file.type || (fileName.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream'),
                        size: file.size,
                        base64Data,
                        timestamp: Date.now(),
                        isProcessed: false,
                        textContent,
                        convertedToImage: isPDF // Mark PDFs for conversion
                    };

                    console.log(`✅ [ChatInput] File processed successfully: ${file.name}`);
                    resolve(attachedFile);
                } catch (error) {
                    console.error(`❌ [ChatInput] Error processing file:`, error);
                    reject(error);
                }
            };
            reader.onerror = () => {
                console.error(`❌ [ChatInput] FileReader error for file: ${file.name}`);
                reject(new Error('Failed to read file'));
            };
            reader.readAsDataURL(file);
        });
    };

    // Image processing function
    const processImage = async (file: File): Promise<AttachedImage | null> => {
        if (!isValidImageType(file.type)) {
            setFileError(`Unsupported image type: ${file.type}. Supported: JPEG, PNG, GIF, WebP`);
            return null;
        }

        if (file.size > MAX_FILE_SIZE) {
            setFileError(`Image too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`);
            return null;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const base64Data = e.target?.result as string;
                    // Extract base64 data without data URL prefix
                    const base64Only = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
                    
                    // Determine media type
                    let mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' = 'image/png';
                    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                        mediaType = 'image/jpeg';
                    } else if (file.type === 'image/gif') {
                        mediaType = 'image/gif';
                    } else if (file.type === 'image/webp') {
                        mediaType = 'image/webp';
                    }

                    const attachedImage: AttachedImage = {
                        id: `image_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        base64Data: base64Only, // Store only base64 data
                        mediaType,
                        timestamp: Date.now()
                    };

                    resolve(attachedImage);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read image'));
            reader.readAsDataURL(file);
        });
    };

    const handleFileSelection = async (files: FileList) => {
        setIsProcessingFiles(true);
        setFileError(null);

        try {
            const fileArray = Array.from(files);
            const processedFiles: AttachedFile[] = [];

            for (const file of fileArray) {
                // Check if it's an image - if so, process as image instead
                if (isValidImageType(file.type)) {
                    const processedImage = await processImage(file);
                    if (processedImage) {
                        setAttachedImages(prev => [...prev, processedImage]);
                    }
                } else {
                const processedFile = await processFile(file);
                if (processedFile) {
                    processedFiles.push(processedFile);
                    storeFileInLocalStorage(processedFile);
                    }
                }
            }

            if (processedFiles.length > 0) {
            setAttachedFiles(prev => [...prev, ...processedFiles]);
            }
        } catch (error) {
            setFileError(error instanceof Error ? error.message : 'Failed to process files');
        } finally {
            setIsProcessingFiles(false);
        }
    };

    const handleImageSelection = async (files: FileList) => {
        setIsProcessingFiles(true);
        setFileError(null);

        try {
            const fileArray = Array.from(files);
            const processedImages: AttachedImage[] = [];

            for (const file of fileArray) {
                const processedImage = await processImage(file);
                if (processedImage) {
                    processedImages.push(processedImage);
                }
            }

            setAttachedImages(prev => [...prev, ...processedImages]);
        } catch (error) {
            setFileError(error instanceof Error ? error.message : 'Failed to process images');
        } finally {
            setIsProcessingFiles(false);
        }
    };

    // Drag and drop handlers - SIMPLIFIED to prevent flickering
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Only handle file drops
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
            
            // Increment counter on each dragover (fired continuously while dragging)
            dragCounterRef.current++;
            
            // Set drag state only once when counter starts
            if (dragCounterRef.current === 1 && !isDragOver) {
                setIsDragOver(true);
            }
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Only process if dragging files
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // SIMPLIFIED: Only hide if leaving the actual drop zone container
        // Check if we're leaving to an element outside the drop zone
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        // If mouse is outside the container bounds, hide the drag overlay
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            dragCounterRef.current = 0;
            setIsDragOver(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Reset drag state immediately
        dragCounterRef.current = 0;
        setIsDragOver(false);

        if (!hasActiveProject) {
            setFileError('Please select a project first');
            return;
        }

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files);
        }
    };
    
    // Reset drag counter when drag state changes
    useEffect(() => {
        if (!isDragOver) {
            dragCounterRef.current = 0;
        }
    }, [isDragOver]);

    // File management functions
    const removeFile = (fileId: string) => {
        setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
        removeFileFromLocalStorage(fileId);
    };

    const handleUploadClick = () => {
        if (!hasActiveProject) {
            setFileError('Please select a project first');
            return;
        }
        fileInputRef.current?.click();
    };

    const handleImageUploadClick = () => {
        if (!hasActiveProject) {
            setFileError('Please select a project first');
            return;
        }
        imageInputRef.current?.click();
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFileSelection(e.target.files);
            e.target.value = ''; // Reset input
        }
    };

    const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleImageSelection(e.target.files);
            e.target.value = ''; // Reset input
        }
    };

    // File management functions
    const removeImage = (imageId: string) => {
        setAttachedImages(prev => prev.filter(img => img.id !== imageId));
    };

    // Check for both input, files, and images
    const hasContent = input.trim() || attachedFiles.length > 0 || attachedImages.length > 0;

    if (isMobile) {
        // MOBILE LAYOUT - Enhanced with speech and file features
        return (
            <div 
                data-chat-input="true"
                style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '0.75rem',
                paddingBottom: 'max(0.75rem, calc(0.75rem + env(safe-area-inset-bottom, 20px)))',
                background: '#0a0a0a',
                borderTop: '1px solid var(--border-color)',
                zIndex: 1000,
                flexShrink: 0,
                minHeight: 'calc(80px + env(safe-area-inset-bottom, 20px))'
            }}>
                {/* Drag overlay for mobile */}
                {isDragOver && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(255, 107, 53, 0.1)',
                        border: '2px dashed var(--accent-orange)',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        color: 'var(--accent-orange)',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                    }}>
                        📎 Drop files to attach
                    </div>
                )}

                {/* Attached files and images preview */}
                {(attachedFiles.length > 0 || attachedImages.length > 0) && (
                    <div style={{
                        marginBottom: '0.75rem',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                    }}>
                        {attachedFiles.map(file => (
                            <div key={file.id} style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                padding: '0.4rem 0.6rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontSize: '0.75rem',
                                color: '#ffffff',
                                maxWidth: '200px'
                            }}>
                                <span>{getFileIcon(file.type)}</span>
                                <span style={{ 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap' 
                                }}>
                                    {file.name}
                                </span>
                                <button
                                    onClick={() => removeFile(file.id)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-gray)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        fontSize: '0.7rem'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        {attachedImages.map(image => (
                            <div key={image.id} style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                padding: '0.4rem 0.6rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontSize: '0.75rem',
                                color: '#ffffff',
                                maxWidth: '200px'
                            }}>
                                <span>🖼️</span>
                                <span style={{ 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap' 
                                }}>
                                    {image.name}
                                </span>
                                <button
                                    onClick={() => removeImage(image.id)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-gray)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        fontSize: '0.7rem'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{
                    background: !hasActiveProject 
                        ? 'rgba(255, 255, 255, 0.02)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border: isDragOver 
                        ? '2px dashed var(--accent-orange)'
                        : (!hasActiveProject
                            ? '1px solid rgba(255, 255, 255, 0.05)'
                            : '1px solid var(--border-color)'),
                    borderRadius: '14px',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '0.75rem',
                    transition: 'all 0.3s var(--smooth-easing)',
                    backdropFilter: 'blur(10px)',
                    opacity: !hasActiveProject ? 0.6 : 1,
                    minHeight: '48px'
                }}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                >
                    {/* Mobile controls - File upload */}
                    <button
                        onClick={handleUploadClick}
                        disabled={isInputDisabledForChat}
                        style={{
                            width: '32px',
                            height: '32px',
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isInputDisabledForChat ? 'rgba(156, 163, 175, 0.5)' : 'var(--text-gray)',
                            cursor: isInputDisabledForChat ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s var(--smooth-easing)',
                            fontSize: '0.9rem',
                            opacity: isInputDisabledForChat ? 0.5 : 1,
                            flexShrink: 0,
                            alignSelf: 'flex-end',
                            marginBottom: '2px'
                        }}
                        title={!hasActiveProject ? "Select a project first" : "Upload File"}
                    >
                        📎
                    </button>

                    {/* Mobile controls - Image upload */}
                    <button
                        onClick={handleImageUploadClick}
                        disabled={isInputDisabledForChat}
                        style={{
                            width: '32px',
                            height: '32px',
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isInputDisabledForChat ? 'rgba(156, 163, 175, 0.5)' : 'var(--text-gray)',
                            cursor: isInputDisabledForChat ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s var(--smooth-easing)',
                            fontSize: '0.9rem',
                            opacity: isInputDisabledForChat ? 0.5 : 1,
                            flexShrink: 0,
                            alignSelf: 'flex-end',
                            marginBottom: '2px'
                        }}
                        title={!hasActiveProject ? "Select a project first" : "Upload Image"}
                    >
                        🖼️
                    </button>

                    {/* Mobile controls - Speech recognition */}
                    {speechSupported && (
                        <button
                            onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                            disabled={isInputDisabledForChat}
                            style={{
                                width: '32px',
                                height: '32px',
                                background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                border: isListening ? '1px solid #ef4444' : '1px solid var(--border-color)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isListening ? '#ef4444' : (isInputDisabledForChat ? 'rgba(156, 163, 175, 0.5)' : 'var(--text-gray)'),
                                cursor: isInputDisabledForChat ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s var(--smooth-easing)',
                                fontSize: '0.9rem',
                                opacity: isInputDisabledForChat ? 0.5 : 1,
                                flexShrink: 0,
                                alignSelf: 'flex-end',
                                marginBottom: '2px'
                            }}
                            title={!hasActiveProject ? "Select a project first" : (isListening ? "Stop recording" : "Voice input")}
                        >
                            🎤
                        </button>
                    )}
                    
                    {/* Textarea */}
                    <div 
                        onClick={handleTextareaClick}
                        style={{
                            flex: 1,
                            cursor: isInputDisabledForChat ? 'not-allowed' : 'text',
                            display: 'flex',
                            alignItems: 'flex-end'
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholderText}
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                boxShadow: 'none',
                                color: isInputDisabledForChat ? 'rgba(255, 255, 255, 0.4)' : '#ffffff',
                                fontSize: '16px', // Prevent zoom on iOS
                                lineHeight: 1.4,
                                resize: 'none',
                                minHeight: '32px',
                                maxHeight: '100px',
                                fontFamily: 'inherit',
                                transition: 'color 0.2s var(--smooth-easing)',
                                padding: '0',
                                paddingTop: '2px',
                                overflow: 'hidden',
                                overflowY: 'auto',
                                wordWrap: 'break-word'
                            }}
                            disabled={isInputDisabledForChat}
                            rows={1}
                        />
                    </div>
                    
                    {/* ✅ NEW: Stop button - show when generating/streaming, otherwise show send button */}
                    {(() => {
                        const shouldShowStop = isGenerating || isStreaming;
                        // ✅ DEBUG: Log button decision
                        if (shouldShowStop || isGenerating) {
                            console.log('🛑 [ChatInput] DESKTOP Button decision:', {
                                isGenerating,
                                isStreaming,
                                shouldShowStop,
                                serviceCheck: claudeService.isStreaming(),
                                willRender: shouldShowStop ? 'STOP BUTTON' : 'SEND BUTTON'
                            });
                        }
                        return shouldShowStop;
                    })() ? (
                        <button
                            onClick={handleStopStreaming}
                            style={{
                                width: '36px',
                                height: '36px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ef4444',
                                cursor: 'pointer',
                                transition: 'all 0.3s var(--smooth-easing)',
                                fontSize: '1rem',
                                flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                                e.currentTarget.style.borderColor = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                            }}
                            title="Stop AI generation"
                        >
                            ⏹
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isInputDisabledForChat || !hasContent}
                            style={{
                                width: '36px',
                                height: '36px',
                                background: (!hasContent || isInputDisabledForChat) 
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                                border: 'none',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: (!hasContent || isInputDisabledForChat) ? 'var(--text-gray)' : '#ffffff',
                                cursor: (!hasContent || isInputDisabledForChat) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s var(--smooth-easing)',
                                fontSize: '1rem',
                                boxShadow: (!hasContent || isInputDisabledForChat) 
                                    ? 'none'
                                    : '0 4px 15px rgba(255, 107, 53, 0.3)',
                                opacity: isInputDisabledForChat ? 0.5 : 1,
                                flexShrink: 0
                            }}
                            title={!hasActiveProject ? "Select a project first" : undefined}
                        >
                            ➤
                        </button>
                    )}
                </div>

                {/* Listening indicator */}
                {isListening && (
                    <div style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: '#ef4444',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            animation: 'pulse 1s ease-in-out infinite'
                        }}></span>
                        Recording... Speak clearly into your microphone
                    </div>
                )}

                {/* Error messages */}
                {(fileError || speechError) && (
                    <div style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: '#ef4444',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                    }}>
                        <span style={{ flex: 1 }}>{fileError || speechError}</span>
                        <button
                            onClick={() => {
                                setFileError(null);
                                setSpeechError(null);
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                fontSize: '1.2rem',
                                lineHeight: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                transition: 'background 0.2s ease',
                                flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                            title="Dismiss error"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Status messages */}
                {!hasActiveProject && (
                    <div style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255, 107, 53, 0.1)',
                        border: '1px solid rgba(255, 107, 53, 0.2)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        color: 'var(--accent-orange)',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem'
                    }}>
                        💡 Select a project to start
                    </div>
                )}

                {/* CRITICAL FIX: Use actual deployment state from store */}
                {shouldShowDeploymentBanner && (
                    <div style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: 'var(--accent-green)',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            border: '2px solid rgba(16, 185, 129, 0.3)',
                            borderTop: '2px solid var(--accent-green)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        🚀 Deployment in progress - you can still chat
                    </div>
                )}

                {/* File processing indicator */}
                {isProcessingFiles && (
                    <div style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: 'var(--accent-green)',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            border: '2px solid rgba(16, 185, 129, 0.3)',
                            borderTop: '2px solid var(--accent-green)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        Processing files...
                    </div>
                )}

                {/* Hidden file and image inputs */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx,.json,.js,.jsx,.ts,.tsx,.html,.css,.scss,.sass,.less,.py,.java,.cpp,.c,.go,.rs,.rb,.php,.swift,.kt,.sh,.bash,.yml,.yaml,.toml,.ini,.env,.xml,.log,.sql,.rtf,.odt,.ods,.odp"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                />
                <input
                    ref={imageInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleImageInputChange}
                    style={{ display: 'none' }}
                />

                <style>{`
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.5; }
                        100% { opacity: 1; }
                    }
                    
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    // DESKTOP LAYOUT - Enhanced with speech and file features
    return (
        <div 
            data-chat-input="true"
            style={{
            padding: '1.5rem 2rem',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(255, 255, 255, 0.02)',
            zIndex: 2,
            flexShrink: 0
        }}>
            {/* Drag overlay for desktop */}
            {isDragOver && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(255, 107, 53, 0.1)',
                    border: '2px dashed var(--accent-orange)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    color: 'var(--accent-orange)',
                    fontSize: '1.2rem',
                    fontWeight: '600'
                }}>
                    📎 Drop files here to attach to your message
                </div>
            )}

            {/* Attached files and images preview */}
            {(attachedFiles.length > 0 || attachedImages.length > 0) && (
                <div style={{
                    marginBottom: '1rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                }}>
                    {attachedFiles.map(file => (
                        <div key={file.id} style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.85rem',
                            color: '#ffffff',
                            maxWidth: '300px'
                        }}>
                            <span style={{ fontSize: '1.1rem' }}>{getFileIcon(file.type)}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap',
                                    fontWeight: '500'
                                }}>
                                    {file.name}
                                </div>
                                <div style={{ 
                                    fontSize: '0.7rem', 
                                    color: 'var(--text-gray)',
                                    marginTop: '2px'
                                }}>
                                    {formatFileSize(file.size)}
                                </div>
                            </div>
                            <button
                                onClick={() => removeFile(file.id)}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '4px 6px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600'
                                }}
                                title="Remove file"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                    {attachedImages.map(image => (
                        <div key={image.id} style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.85rem',
                            color: '#ffffff',
                            maxWidth: '300px'
                        }}>
                            <span style={{ fontSize: '1.1rem' }}>🖼️</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap',
                                    fontWeight: '500'
                                }}>
                                    {image.name}
                                </div>
                                <div style={{ 
                                    fontSize: '0.7rem', 
                                    color: 'var(--text-gray)',
                                    marginTop: '2px'
                                }}>
                                    {formatFileSize(image.size)}
                                </div>
                            </div>
                            <button
                                onClick={() => removeImage(image.id)}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '4px 6px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600'
                                }}
                                title="Remove image"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div style={{
                background: !hasActiveProject 
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(255, 255, 255, 0.05)',
                border: isDragOver 
                    ? '2px dashed var(--accent-orange)'
                    : (!hasActiveProject
                        ? '1px solid rgba(255, 255, 255, 0.05)'
                        : '1px solid var(--border-color)'),
                borderRadius: '16px',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s ease-out',
                backdropFilter: 'blur(10px)',
                opacity: !hasActiveProject ? 0.6 : 1,
                minHeight: '50px',
                position: 'relative'
            }}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            >
                {/* Model Selector Button - Left Side */}
                <div ref={modelDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                        disabled={isInputDisabledForChat || isGenerating}
                        style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: isInputDisabledForChat || isGenerating 
                                ? 'rgba(55, 65, 81, 0.3)' 
                                : 'rgba(55, 65, 81, 0.5)',
                            color: isInputDisabledForChat || isGenerating 
                                ? 'rgba(255, 255, 255, 0.5)' 
                                : '#ffffff',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            cursor: isInputDisabledForChat || isGenerating ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease-out',
                            opacity: isInputDisabledForChat || isGenerating ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}
                        title="Select AI Model"
                        onMouseEnter={(e) => {
                            if (!isInputDisabledForChat && !isGenerating) {
                                e.currentTarget.style.background = 'rgba(55, 65, 81, 0.7)';
                                e.currentTarget.style.borderColor = 'var(--accent-orange)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isInputDisabledForChat && !isGenerating) {
                                e.currentTarget.style.background = 'rgba(55, 65, 81, 0.5)';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                            }
                        }}
                    >
                        <span style={{ 
                            filter: selectedChatModel === 'claude' 
                                ? 'hue-rotate(200deg) saturate(1.8) brightness(1.1)' // Blue
                                : selectedChatModel === 'gemini'
                                ? 'hue-rotate(30deg) saturate(1.8) brightness(1.2)' // Yellow/Amber
                                : selectedChatModel === 'kimi'
                                ? 'hue-rotate(280deg) saturate(1.8) brightness(1.1)' // Purple
                                : 'hue-rotate(140deg) saturate(1.8) brightness(1.1)', // Green
                            display: 'inline-block'
                        }}>{modelInfo[selectedChatModel].icon}</span>
                        {modelInfo[selectedChatModel].name}
                    </button>
                    
                    {/* Model Dropdown Menu */}
                    {showModelDropdown && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: 0,
                            marginBottom: '0.5rem',
                            background: 'rgba(17, 17, 17, 0.98)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '0.125rem',
                            minWidth: '120px',
                            zIndex: 1000,
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(10px)'
                        }}>
                            {(['claude', 'gemini', 'kimi', 'openai'] as const).map((model) => (
                                <button
                                    key={model}
                                    onClick={() => {
                                        setSelectedChatModel(model);
                                        setShowModelDropdown(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.375rem 0.5rem',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: selectedChatModel === model 
                                            ? 'rgba(59, 130, 246, 0.2)' 
                                            : 'transparent',
                                        color: '#ffffff',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        transition: 'all 0.2s ease-out'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (selectedChatModel !== model) {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedChatModel !== model) {
                                            e.currentTarget.style.background = 'transparent';
                                        }
                                    }}
                                >
                                    <span style={{ 
                                        filter: model === 'claude' 
                                            ? 'hue-rotate(200deg) saturate(1.8) brightness(1.1)' // Blue
                                            : model === 'gemini'
                                            ? 'hue-rotate(30deg) saturate(1.8) brightness(1.2)' // Yellow/Amber
                                            : model === 'kimi'
                                            ? 'hue-rotate(280deg) saturate(1.8) brightness(1.1)' // Purple
                                            : 'hue-rotate(140deg) saturate(1.8) brightness(1.1)', // Green
                                        display: 'inline-block'
                                    }}>{modelInfo[model].icon}</span>
                                    <span>{modelInfo[model].name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Text Input - Middle */}
                <div 
                    onClick={handleTextareaClick}
                    style={{
                        flex: 1,
                        cursor: isInputDisabledForChat ? 'not-allowed' : 'text',
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: '36px'
                    }}
                >
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholderText || "Ask anything..."}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            boxShadow: 'none',
                            color: isInputDisabledForChat ? 'rgba(255, 255, 255, 0.4)' : '#ffffff',
                            fontSize: '0.95rem',
                            lineHeight: 1.4,
                            resize: 'none',
                            minHeight: '36px',
                            maxHeight: '120px',
                            fontFamily: 'inherit',
                            transition: 'color 0.2s var(--smooth-easing)',
                            padding: '0',
                            overflow: 'hidden',
                            overflowY: 'auto',
                            wordWrap: 'break-word'
                        }}
                        disabled={isInputDisabledForChat}
                        rows={1}
                    />
                </div>
                
                {/* Action Buttons - Right Side */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    {/* Attachment Button */}
                    <button
                        onClick={handleUploadClick}
                        disabled={isInputDisabledForChat}
                        style={{
                            width: '32px',
                            height: '32px',
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isInputDisabledForChat ? 'rgba(156, 163, 175, 0.5)' : 'var(--text-gray)',
                            cursor: isInputDisabledForChat ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease-out',
                            fontSize: '0.9rem',
                            opacity: isInputDisabledForChat ? 0.5 : 1
                        }}
                        title={!hasActiveProject ? "Select a project first" : "Upload File"}
                        onMouseEnter={(e) => {
                            if (!isInputDisabledForChat) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.borderColor = 'var(--accent-orange)';
                                e.currentTarget.style.color = '#ffffff';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isInputDisabledForChat) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                e.currentTarget.style.color = 'var(--text-gray)';
                            }
                        }}
                    >
                        📎
                    </button>

                    {/* Microphone Button */}
                    {speechSupported && (
                        <button
                            onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                            disabled={isInputDisabledForChat}
                            style={{
                                width: '32px',
                                height: '32px',
                                background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                border: isListening ? '1px solid #ef4444' : '1px solid var(--border-color)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isListening ? '#ef4444' : (isInputDisabledForChat ? 'rgba(156, 163, 175, 0.5)' : 'var(--text-gray)'),
                                cursor: isInputDisabledForChat ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease-out',
                                fontSize: '0.9rem',
                                opacity: isInputDisabledForChat ? 0.5 : 1
                            }}
                            title={!hasActiveProject ? "Select a project first" : (isListening ? "Stop Recording" : "Voice Note")}
                            onMouseEnter={(e) => {
                                if (!isInputDisabledForChat && !isListening) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.borderColor = 'var(--accent-orange)';
                                    e.currentTarget.style.color = '#ffffff';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isInputDisabledForChat && !isListening) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.color = 'var(--text-gray)';
                                }
                            }}
                        >
                            🎤
                        </button>
                    )}
                    
                    {/* Send/Stop Button */}
                    {(isGenerating || isStreaming) ? (
                        <button
                            onClick={handleStopStreaming}
                            style={{
                                width: '32px',
                                height: '32px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ef4444',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-out',
                                fontSize: '0.9rem',
                                flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                                e.currentTarget.style.borderColor = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                            }}
                            title="Stop AI generation"
                        >
                            ⏹
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isInputDisabledForChat || !hasContent}
                            style={{
                                width: '32px',
                                height: '32px',
                                background: (!hasContent || isInputDisabledForChat) 
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
                                border: 'none',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: (!hasContent || isInputDisabledForChat) ? 'var(--text-gray)' : '#ffffff',
                                cursor: (!hasContent || isInputDisabledForChat) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease-out',
                                fontSize: '0.9rem',
                                boxShadow: (!hasContent || isInputDisabledForChat) 
                                    ? 'none'
                                    : '0 2px 8px rgba(255, 107, 53, 0.3)',
                                opacity: isInputDisabledForChat ? 0.5 : 1,
                                flexShrink: 0
                            }}
                            title={!hasActiveProject ? "Select a project first" : undefined}
                            onMouseEnter={(e) => {
                                if (!isInputDisabledForChat && hasContent) {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.4)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isInputDisabledForChat && hasContent) {
                                    e.currentTarget.style.transform = '';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 107, 53, 0.3)';
                                }
                            }}
                        >
                            ➤
                        </button>
                    )}
                </div>

                {/* Listening indicator */}
                {isListening && (
                    <div style={{
                        position: 'absolute',
                        top: '-3rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.8rem',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        whiteSpace: 'nowrap',
                        zIndex: 5
                    }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            animation: 'pulse 1s ease-in-out infinite'
                        }}></span>
                        Recording... Speak clearly into your microphone
                    </div>
                )}
            </div>

            {/* Error messages */}
            {(fileError || speechError) && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#ef4444',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem'
                }}>
                    <span style={{ flex: 1 }}>{fileError || speechError}</span>
                    <button
                        onClick={() => {
                            setFileError(null);
                            setSpeechError(null);
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            fontSize: '1.2rem',
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'background 0.2s ease',
                            flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                        title="Dismiss error"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* No project selected hint */}
            {!hasActiveProject && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(255, 107, 53, 0.1)',
                    border: '1px solid rgba(255, 107, 53, 0.2)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: 'var(--accent-orange)',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}>
                    💡 Select or create a project in the sidebar to start chatting with files and voice input
                </div>
            )}

            {/* CRITICAL FIX: Use actual deployment state from store */}
            {shouldShowDeploymentBanner && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: 'var(--accent-green)',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}>
                    <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(16, 185, 129, 0.3)',
                        borderTop: '2px solid var(--accent-green)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    🚀 Deployment in progress - you can continue chatting while your project deploys
                </div>
            )}

            {/* File processing indicator */}
            {isProcessingFiles && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: 'var(--accent-green)',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}>
                    <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(16, 185, 129, 0.3)',
                        borderTop: '2px solid var(--accent-green)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    Processing files...
                </div>
            )}

            {/* Hidden file and image inputs */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
            />
            <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageInputChange}
                style={{ display: 'none' }}
            />

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    );
};