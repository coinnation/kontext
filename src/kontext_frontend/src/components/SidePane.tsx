import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useFiles, useUI, useAppStore } from '../store/appStore';
// 🔥 FIX: Do NOT import Monaco at all - not even types - causes serviceIds error
// Monaco will be imported dynamically when needed, types will be inferred
// 🔥 CRITICAL FIX: Import MonacoPreloadService dynamically to prevent Monaco from being bundled
// import { monacoPreloadService } from '../services/MonacoPreloadService';
import { verboseLog } from '../utils/verboseLogging';

// 🔥 FIX: Store Monaco instance globally after first load
// Type is 'any' to avoid importing Monaco types
let monacoInstance: any = null;

interface SidePaneProps {
  onClose?: () => void;
}

// 🔥 STABLE SINGLETON: Device capabilities - calculated once and cached
let DEVICE_CAPABILITIES_CACHE: ReturnType<typeof getDeviceCapabilities> | null = null;

const getDeviceCapabilities = () => {
  const isMobile = window.innerWidth <= 768;
  const hasTouch = 'ontouchstart' in window;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  // Check if browser supports dynamic viewport units
  const supportsDynamicViewport = CSS.supports('height', '100dvh');
  
  return {
    isMobile,
    hasTouch,
    isIOS,
    isAndroid,
    supportsDynamicViewport
  };
};

// 🔥 STABLE CAPABILITIES SINGLETON
const getStableDeviceCapabilities = (): ReturnType<typeof getDeviceCapabilities> => {
  if (!DEVICE_CAPABILITIES_CACHE) {
    DEVICE_CAPABILITIES_CACHE = getDeviceCapabilities();
    
    // Update capabilities on resize (with debouncing)
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const wasMobile = DEVICE_CAPABILITIES_CACHE?.isMobile;
        DEVICE_CAPABILITIES_CACHE = getDeviceCapabilities();
        const nowMobile = DEVICE_CAPABILITIES_CACHE?.isMobile;
        
        // Only log if mobile state changed
        if (wasMobile !== nowMobile) {
          console.log('📱 Device capabilities updated:', DEVICE_CAPABILITIES_CACHE);
        }
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
  }
  
  return DEVICE_CAPABILITIES_CACHE;
};

// Mobile-optimized viewport calculation
const getMobileViewportHeight = (capabilities: ReturnType<typeof getDeviceCapabilities>) => {
  if (!capabilities.isMobile) return '100vh';
  
  if (capabilities.supportsDynamicViewport) {
    return '100dvh'; // Modern browsers with dynamic viewport support
  }
  
  // Fallback for older browsers - use JavaScript calculation
  const viewportHeight = window.innerHeight;
  return `${viewportHeight}px`;
};

// Detect language from file extension for Monaco
const detectMonacoLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    'mo': 'motoko',
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'py': 'python',
    'rs': 'rust',
    'json': 'json',
    'md': 'markdown',
    'txt': 'plaintext',
    'yml': 'yaml',
    'yaml': 'yaml'
  };
  
  return languageMap[ext || ''] || 'plaintext';
};

// Mobile-optimized Monaco configuration
const getMonacoConfig = (capabilities: ReturnType<typeof getDeviceCapabilities>) => {
  const baseConfig = {
    minimap: { enabled: !capabilities.isMobile },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    fontSize: capabilities.isMobile ? 14 : 14,
    lineHeight: capabilities.isMobile ? 20 : 22,
    fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', Monaco, Menlo, 'Ubuntu Mono', monospace",
    fontLigatures: true,
    renderLineHighlight: 'line',
    occurrencesHighlight: true,
    selectionHighlight: true,
    wordWrap: capabilities.isMobile ? 'on' : 'off',
    lineNumbers: 'on',
    glyphMargin: false,
    folding: true,
    lineDecorationsWidth: capabilities.isMobile ? 5 : 10,
    lineNumbersMinChars: 4,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: false,
    renderValidationDecorations: 'on',
    links: true,
    colorDecorators: true,
    codeLens: false,
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      verticalScrollbarSize: capabilities.isMobile ? 16 : 14,
      horizontalScrollbarSize: capabilities.isMobile ? 14 : 12,
      useShadows: false,
      alwaysConsumeMouseWheel: !capabilities.isMobile,
      handleMouseWheel: true,
      touchSupport: capabilities.isMobile
    },
    padding: {
      top: capabilities.isMobile ? 12 : 16,
      bottom: capabilities.isMobile ? 24 : 16 // Extra bottom padding for mobile
    },
    suggest: { enabled: true },
    parameterHints: { enabled: true },
    hover: { enabled: true },
    lightbulb: { enabled: true },
    mouseWheelZoom: false,
    multiCursorModifier: 'ctrlCmd',
    // Enhanced mobile optimizations
    ...(capabilities.isMobile && {
      disableLayerHinting: true,
      mouseWheelScrollSensitivity: 1,
      fastScrollSensitivity: 5,
      smoothScrolling: true,
      scrollPredominantAxis: true
    })
  };

  return baseConfig;
};

// Enhanced streaming-optimized Monaco manager with preload coordination
class StreamingOptimizedMonacoManager {
  private editor: any = null;
  private container: HTMLDivElement | null = null;
  private currentContent: string = '';
  private currentLanguage: string = 'plaintext';
  private currentFileName: string = '';
  private isEditable: boolean = false;
  private isUserTyping: boolean = false;
  private shouldAutoScroll: boolean = true;
  // ✅ NEW: User scroll detection for mobile
  private isUserScrolling: boolean = false;
  private isNearBottom: boolean = true;
  private lastUserScrollTime: number = 0;
  private scrollDetectionThreshold: number = 150; // pixels from bottom
  private onContentChange: ((content: string) => void) | null = null;
  private capabilities: ReturnType<typeof getDeviceCapabilities>;
  private isInitialized: boolean = false;
  private resizeObserver: ResizeObserver | null = null;
  private isVisible: boolean = true;
  
  // 🔥 INITIALIZATION GUARDS to prevent infinite loops
  private isInitializing: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private containerFingerprint: string = '';
  
  // Mobile viewport tracking
  private viewportHeight: number = 0;
  private keyboardHeight: number = 0;
  private isKeyboardVisible: boolean = false;
  private orientationChangeHandler: (() => void) | null = null;
  private visualViewportHandler: ((event: Event) => void) | null = null;
  
  // Enhanced anti-flicker protection with file-specific tracking
  private lastContentFingerprint: string = '';
  private lastLanguageSet: string = '';
  private lastEditableState: boolean = false;
  private lastFileName: string = '';
  private isStreamingMode: boolean = false;
  private streamingUpdateCount: number = 0;
  private lastStreamingUpdate: number = 0;
  
  // Streaming-aware change detection
  private changeListenerDisposable: any = null;
  private isSettingContent: boolean = false;
  
  // Enhanced state preservation for mobile
  private editorState: {
    position: any;
    scrollTop: number;
    scrollLeft: number;
    selection: any;
    viewState: any;
  } = {
    position: null,
    scrollTop: 0,
    scrollLeft: 0,
    selection: null,
    viewState: null
  };
  
  // Enhanced visibility state management with proper file tracking
  private visibilityState: {
    isVisible: boolean;
    lastHiddenTime: number;
    needsFullRestoration: boolean;
    savedTheme: string;
    savedLanguage: string;
    savedContent: string;
    savedEditable: boolean;
    lastVisibleFileName: string;
    forceNextUpdate: boolean;
  } = {
    isVisible: true,
    lastHiddenTime: 0,
    needsFullRestoration: false,
    savedTheme: 'vscode-dark-optimized',
    savedLanguage: 'plaintext',
    savedContent: '',
    savedEditable: false,
    lastVisibleFileName: '',
    forceNextUpdate: false
  };
  
  constructor(capabilities: ReturnType<typeof getDeviceCapabilities>) {
    this.capabilities = capabilities;
    this.viewportHeight = window.innerHeight;
    // Setup Motoko after a brief delay to ensure monaco is loaded
    setTimeout(() => this.setupMotoko(), 100);
    this.setupMobileViewportTracking();
  }

  // Mobile viewport tracking setup
  private setupMobileViewportTracking() {
    if (!this.capabilities.isMobile) return;

    // Track viewport changes
    this.orientationChangeHandler = () => {
      setTimeout(() => {
        this.viewportHeight = window.innerHeight;
        this.handleViewportChange();
      }, 500); // Delay to let orientation change complete
    };

    window.addEventListener('orientationchange', this.orientationChangeHandler);
    window.addEventListener('resize', () => {
      const newHeight = window.innerHeight;
      const heightDifference = this.viewportHeight - newHeight;
      
      // Keyboard detection heuristic
      if (heightDifference > 150) {
        this.isKeyboardVisible = true;
        this.keyboardHeight = heightDifference;
      } else if (heightDifference < -50) {
        this.isKeyboardVisible = false;
        this.keyboardHeight = 0;
      }
      
      this.viewportHeight = newHeight;
      this.handleViewportChange();
    });

    // Visual Viewport API for better keyboard detection
    if ('visualViewport' in window && window.visualViewport) {
      this.visualViewportHandler = (event) => {
        const viewport = window.visualViewport!;
        const heightDiff = window.innerHeight - viewport.height;
        
        this.isKeyboardVisible = heightDiff > 150;
        this.keyboardHeight = heightDiff;
        this.handleViewportChange();
      };
      
      window.visualViewport.addEventListener('resize', this.visualViewportHandler);
    }
  }

  private handleViewportChange() {
    if (this.editor && this.isVisible) {
      // Throttle layout updates for performance
      setTimeout(() => {
        if (this.editor && this.isVisible) {
          this.editor.layout();
          
          // Adjust scroll behavior for keyboard changes
          if (this.isKeyboardVisible && this.shouldAutoScroll) {
            this.performMobileOptimizedScroll();
          }
        }
      }, 100);
    }
  }

  // 🔥 GUARDED INITIALIZATION to prevent infinite loops
  async initialize(container: HTMLDivElement): Promise<void> {
    // 🔥 CRITICAL: Generate container fingerprint to detect actual changes
    const containerFingerprint = `${container.clientWidth}x${container.clientHeight}_${container.className}_${Date.now()}`;
    
    // 🔥 GUARD 1: If already initialized with same container, return early
    if (this.isInitialized && this.editor && this.container === container && this.containerFingerprint === containerFingerprint) {
      console.log('🛡️ [Monaco Manager] Already initialized with same container - skipping');
      return;
    }
    
    // 🔥 GUARD 2: If initialization is in progress, wait for it
    if (this.isInitializing && this.initializationPromise) {
      console.log('⏳ [Monaco Manager] Initialization in progress - waiting...');
      return this.initializationPromise;
    }
    
    // 🔥 GUARD 3: Dispose old editor only if container actually changed
    if (this.editor && this.container !== container) {
      console.log('🔄 [Monaco Manager] Container changed - disposing old editor');
      this.dispose();
    }

    if (!container) {
      console.warn('⚠️ [Monaco Manager] No container provided');
      return;
    }

    // 🔥 CRITICAL: Set guards before starting initialization
    this.isInitializing = true;
    this.container = container;
    this.containerFingerprint = containerFingerprint;

    // 🔥 Create initialization promise for concurrent calls
    this.initializationPromise = this.performInitialization(container);
    
    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  // 🔥 SEPARATED INITIALIZATION LOGIC
  private async performInitialization(container: HTMLDivElement): Promise<void> {
    try {
      console.log('🎯 [Monaco Manager] Starting guarded initialization with preload check');
      
      // 🔥 FIRST: Try to get preloaded Monaco (import service dynamically)
      let monaco: any = null;
      try {
        const { monacoPreloadService } = await import('../services/MonacoPreloadService');
        monaco = await monacoPreloadService.getPreloadedMonaco();
        
        if (monaco) {
          console.log('⚡ [Monaco Manager] Using preloaded Monaco - INSTANT SETUP!');
        }
      } catch (preloadError) {
        console.log('⚠️ [Monaco Manager] Preload service unavailable, will load Monaco directly');
      }
      
      if (!monaco) {
        console.log('🔄 [Monaco Manager] No preload available, loading Monaco normally...');
        // If no preload, just continue with normal Monaco import
        monaco = await import('monaco-editor');
      }
      
      // 🔥 FIX: Store Monaco instance globally for use in other methods
      monacoInstance = monaco;
      
      // 🔥 CRITICAL FIX: Expose Monaco to window.monaco for all the guarded references
      if (!window.monaco && monaco) {
        (window as any).monaco = monaco;
        console.log('✅ [Monaco Manager] Monaco exposed to window.monaco');
      }

      // 🔥 GUARD: Check if we should still proceed (component might have unmounted)
      if (!this.isInitializing || this.container !== container) {
        console.log('🛑 [Monaco Manager] Initialization cancelled - component state changed');
        return;
      }

      // 🔥 SECOND: Create editor with the Monaco instance
      const editorConfig = getMonacoConfig(this.capabilities);

      // 🔥 FIX: Guard against monaco not being loaded
      if (!window.monaco) {
        throw new Error('Monaco editor not loaded');
      }

      this.editor = window.monaco.editor.create(container, {
        value: '',
        language: 'plaintext',
        theme: 'vscode-dark-optimized',
        readOnly: true,
        contextmenu: false,
        bracketPairColorization: {
          enabled: true,
          independentColorPoolPerBracketType: true
        },
        guides: {
          bracketPairs: true,
          bracketPairsHorizontal: true,
          highlightActiveBracketPair: true,
          indentation: false
        },
        'semanticHighlighting.enabled': true,
        ...editorConfig
      });

      this.visibilityState.savedTheme = 'vscode-dark-optimized';
      this.visibilityState.savedLanguage = 'plaintext';

      // Enhanced mobile touch scrolling setup
      this.setupMobileTouchScrolling();
      this.setupEventListeners();
      this.setupResizeObserver();
      this.isInitialized = true;

      console.log('✅ [Monaco Manager] Guarded initialization complete with mobile viewport optimization');
      
    } catch (error) {
      console.error('❌ [Monaco Manager] Guarded initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  private setupMobileTouchScrolling() {
    if (!this.capabilities.isMobile || !this.editor) return;

    setTimeout(() => {
      const editorDom = this.editor?.getDomNode();
      if (!editorDom) return;
      
      // Enhanced touch-action for better mobile scrolling
      editorDom.style.touchAction = 'pan-y pinch-zoom';
      editorDom.style.WebkitOverflowScrolling = 'touch';
      
      // Apply to all Monaco internal elements
      const selectors = [
        '.monaco-scrollable-element',
        '.view-lines',
        '.overflow-guard',
        '.lines-content',
        '.monaco-editor',
        '.editor-scrollable',
        '.decorationsOverviewRuler',
        '.monaco-editor-background'
      ];
      
      selectors.forEach(selector => {
        const elements = editorDom.querySelectorAll(selector);
        elements.forEach(el => {
          (el as HTMLElement).style.touchAction = 'pan-y pinch-zoom';
          (el as HTMLElement).style.WebkitOverflowScrolling = 'touch';
          (el as HTMLElement).style.userSelect = 'text';
        });
      });
      
      console.log('🎯 Enhanced mobile touch scrolling enabled for streaming');
    }, 100);
  }

  private setupResizeObserver() {
    if (!this.container || !this.editor) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      if (this.editor && this.isVisible && !this.isSettingContent) {
        // Mobile-optimized throttling
        const throttleDelay = this.capabilities.isMobile && this.isStreamingMode ? 300 : 100;
        
        if (this.isStreamingMode) {
          const now = Date.now();
          if (now - this.lastStreamingUpdate > throttleDelay) {
            requestAnimationFrame(() => {
              if (this.editor && this.isVisible) {
                this.editor.layout();
              }
            });
            this.lastStreamingUpdate = now;
          }
        } else {
          requestAnimationFrame(() => {
            if (this.editor && this.isVisible) {
              this.editor.layout();
            }
          });
        }
      }
    });

    this.resizeObserver.observe(this.container);
  }

  private setupEventListeners() {
    if (!this.editor) return;

    // Streaming-aware content change detection
    this.changeListenerDisposable = this.editor.onDidChangeModelContent(() => {
      if (this.isSettingContent || this.isStreamingMode || !this.isEditable) {
        return;
      }
      
      const newContent = this.editor!.getValue();
      
      if (newContent !== this.currentContent) {
        console.log('🔄 Content changed by user (mobile-optimized):', {
          oldLength: this.currentContent.length,
          newLength: newContent.length,
          isEditable: this.isEditable,
          isStreaming: this.isStreamingMode
        });
        
        this.currentContent = newContent;
        this.lastContentFingerprint = this.generateContentFingerprint(newContent);
        this.visibilityState.savedContent = newContent;
        
        this.isUserTyping = true;
        
        if (this.onContentChange) {
          this.onContentChange(newContent);
        }
        
        setTimeout(() => {
          this.isUserTyping = false;
        }, 500);
      }
    });

    // ✅ ENHANCED: Scroll behavior tracking - works during streaming too
    const scrollDisposable = this.editor.onDidScrollChange(() => {
      this.updateScrollState();
    });

    this.editor.onDidDispose(() => {
      if (this.changeListenerDisposable) {
        this.changeListenerDisposable.dispose();
        this.changeListenerDisposable = null;
      }
      scrollDisposable.dispose();
    });
  }

  // Enhanced content fingerprint generation with file context
  private generateContentFingerprint(content: string, fileName?: string): string {
    const filePrefix = fileName ? `${fileName}:` : '';
    return `${filePrefix}${content.length}:${content.slice(0, 50)}:${content.slice(-50)}`;
  }

  // ✅ NEW: Update scroll state - tracks user scrolling even during streaming
  private updateScrollState() {
    if (!this.editor) return;

    const scrollTop = this.editor.getScrollTop();
    const scrollHeight = this.editor.getScrollHeight();
    const editorHeight = this.editor.getLayoutInfo().height;
    
    // Mobile-specific scroll detection with keyboard consideration
    let effectiveHeight = editorHeight;
    if (this.capabilities.isMobile && this.isKeyboardVisible) {
      effectiveHeight -= this.keyboardHeight;
    }
    
    const distanceFromBottom = scrollHeight - scrollTop - effectiveHeight;
    const threshold = this.capabilities.isMobile ? this.scrollDetectionThreshold * 1.5 : this.scrollDetectionThreshold;
    const wasNearBottom = this.isNearBottom;
    this.isNearBottom = distanceFromBottom < threshold;
    
    // Track user scrolling - if user scrolled away from bottom, mark as user scrolling
    const now = Date.now();
    if (!this.isNearBottom && !this.isUserScrolling && !this.isUserTyping) {
      // User scrolled up - mark as user scrolling
      this.isUserScrolling = true;
      this.shouldAutoScroll = false;
      this.lastUserScrollTime = now;
    } else if (this.isNearBottom && this.isUserScrolling) {
      // User scrolled back to bottom - allow auto-scroll again
      this.isUserScrolling = false;
      this.shouldAutoScroll = true;
    }
    
    // Update last scroll time
    if (wasNearBottom !== this.isNearBottom) {
      this.lastUserScrollTime = now;
    }
  }

  // Legacy method - kept for backward compatibility
  private checkMobileAutoScrollBehavior() {
    this.updateScrollState();
  }

  private performMobileOptimizedScroll() {
    if (!this.editor || !this.shouldAutoScroll || this.isUserTyping || this.isSettingContent) return;
    
    const model = this.editor.getModel();
    if (!model) return;
    
    const lineCount = model.getLineCount();
    
    // Mobile-optimized scrolling with keyboard consideration
    if (this.capabilities.isMobile) {
      // Immediate scroll for mobile responsiveness
      this.editor.revealLine(lineCount, monacoInstance?.editor.ScrollType.Immediate || 0);
      
      // Additional scroll padding for keyboard
      if (this.isKeyboardVisible) {
        setTimeout(() => {
          if (this.editor) {
            this.editor.setScrollTop(this.editor.getScrollHeight());
          }
        }, 100);
      }
    } else {
      this.editor.revealLine(lineCount, 
        this.isStreamingMode ? 
          (monacoInstance?.editor.ScrollType.Immediate || 0) : 
          (monacoInstance?.editor.ScrollType.Smooth || 1)
      );
    }
  }

  private performAutoScroll() {
    this.performMobileOptimizedScroll();
  }

  // Save editor state before model operations
  private saveEditorState(): void {
    if (!this.editor) return;

    try {
      this.editorState.position = this.editor.getPosition();
      this.editorState.scrollTop = this.editor.getScrollTop();
      this.editorState.scrollLeft = this.editor.getScrollLeft();
      this.editorState.selection = this.editor.getSelection();
      this.editorState.viewState = this.editor.saveViewState();
      
      console.log('💾 [Mobile] Editor state saved:', {
        position: this.editorState.position,
        scrollTop: this.editorState.scrollTop,
        hasViewState: !!this.editorState.viewState,
        fileName: this.currentFileName
      });
    } catch (error) {
      console.warn('⚠️ [Mobile] Failed to save editor state:', error);
      this.editorState = {
        position: null,
        scrollTop: 0,
        scrollLeft: 0,
        selection: null,
        viewState: null
      };
    }
  }

  // Restore editor state after model operations
  private restoreEditorState(): void {
    if (!this.editor) return;

    try {
      if (this.editorState.viewState) {
        verboseLog('SidePane', 'Restoring view state...');
        this.editor.restoreViewState(this.editorState.viewState);
      } else {
        if (this.editorState.position) {
          verboseLog('SidePane', 'Restoring position manually...');
          this.editor.setPosition(this.editorState.position);
        }
        
        if (this.editorState.scrollTop > 0 || this.editorState.scrollLeft > 0) {
          verboseLog('SidePane', 'Restoring scroll manually...');
          this.editor.setScrollTop(this.editorState.scrollTop);
          this.editor.setScrollLeft(this.editorState.scrollLeft);
        }
        
        if (this.editorState.selection) {
          verboseLog('SidePane', 'Restoring selection manually...');
          this.editor.setSelection(this.editorState.selection);
        }
      }
      
      console.log('✅ [Mobile] Editor state restored successfully');
    } catch (error) {
      console.warn('⚠️ [Mobile] Failed to restore editor state:', error);
    }
  }

  // Enhanced model recreation with better error handling and synchronous retry logic
  private recreateModelWithContent(content: string, language: string): boolean {
    if (!this.editor) {
      console.error('❌ [Mobile] No editor instance available');
      return false;
    }

    try {
      verboseLog('SidePane', `Starting model recreation for ${language} with ${content.length} chars`);

      // Save state before recreation
      this.saveEditorState();

      const currentModel = this.editor.getModel();
      
      // Force dispose current model first
      if (currentModel) {
        try {
          console.log('🗑️ [Mobile] Disposing old model...');
          currentModel.dispose();
        } catch (disposeError) {
          console.warn('⚠️ [Mobile] Error disposing old model:', disposeError);
        }
      }

      // Clear editor model reference first
      try {
        this.editor.setModel(null);
      } catch (clearError) {
        console.warn('⚠️ [Mobile] Error clearing model:', clearError);
      }

      // Create new model with synchronous retry logic
      // 🔥 FIX: Guard against monaco not being loaded
      if (!window.monaco) {
        console.error('❌ [Mobile] Monaco not loaded, cannot create model');
        return false;
      }
      
      let newModel: any = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (!newModel && retryCount < maxRetries) {
        try {
          console.log(`🆕 [Mobile] Creating fresh model (attempt ${retryCount + 1}) with language: ${language}`);
          newModel = window.monaco.editor.createModel(content, language);
          
          if (newModel) {
            console.log('✅ [Mobile] Model created successfully');
            break;
          }
        } catch (createError) {
          console.error(`❌ [Mobile] Model creation failed (attempt ${retryCount + 1}):`, createError);
          retryCount++;
          
          if (retryCount < maxRetries) {
            // Synchronous wait using a synchronous timeout approach
            const start = Date.now();
            while (Date.now() - start < (100 * retryCount)) {
              // Synchronous wait without blocking
            }
          }
        }
      }

      if (!newModel) {
        console.error('❌ [Mobile] Failed to create new model after all retries');
        return false;
      }

      // Set the new model with error handling
      try {
        console.log('🔗 [Mobile] Setting new model on editor...');
        this.editor.setModel(newModel);
        
        // Verify the model was set correctly
        const verifyModel = this.editor.getModel();
        if (!verifyModel || verifyModel !== newModel) {
          throw new Error('Model was not set correctly');
        }
        
        console.log('✅ [Mobile] Model set successfully');
      } catch (setError) {
        console.error('❌ [Mobile] Failed to set model on editor:', setError);
        try {
          newModel.dispose();
        } catch (cleanupError) {
          console.warn('⚠️ [Mobile] Failed to cleanup failed model:', cleanupError);
        }
        return false;
      }

      // Update internal state
      this.currentContent = content;
      this.currentLanguage = language;
      this.lastContentFingerprint = this.generateContentFingerprint(content, this.currentFileName);
      this.lastLanguageSet = language;

      console.log('✅ [Mobile] Model recreation completed successfully');
      return true;

    } catch (error) {
      console.error('❌ [Mobile] Model recreation failed:', error);
      return false;
    }
  }

  // Add synchronous sleep helper
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Streaming mode control
  setStreamingMode(isStreaming: boolean): void {
    console.log(`🌊 [Mobile] Setting streaming mode: ${isStreaming}`);
    
    this.isStreamingMode = isStreaming;
    if (isStreaming) {
      this.streamingUpdateCount = 0;
      this.lastStreamingUpdate = Date.now();
      this.shouldAutoScroll = true;
    } else {
      console.log(`🏁 [Mobile] Streaming ended. Total updates: ${this.streamingUpdateCount}`);
    }
  }

  // Enhanced content reconciliation with file-specific tracking
  reconcileContent(fileName: string, content: string, language: string, editable: boolean) {
    if (!this.isInitialized || !this.editor) {
      verboseLog('SidePane', 'Not initialized, cannot reconcile content');
      return;
    }

    const contentFingerprint = this.generateContentFingerprint(content, fileName);
    const needsContentUpdate = contentFingerprint !== this.lastContentFingerprint;
    const needsLanguageUpdate = language !== this.lastLanguageSet;
    const needsEditableUpdate = editable !== this.lastEditableState;
    
    // FIXED: Force update if same file reopened after being closed
    const isSameFileReopened = fileName === this.lastFileName && fileName === this.visibilityState.lastVisibleFileName;
    const shouldForceUpdate = this.visibilityState.forceNextUpdate || isSameFileReopened;
    
    // FIXED: Reset file tracking when file changes
    if (fileName !== this.lastFileName) {
      console.log(`🔄 [Mobile] File changed from ${this.lastFileName} to ${fileName}, clearing fingerprint cache`);
      this.lastContentFingerprint = '';
      this.lastFileName = fileName;
      this.currentFileName = fileName;
      this.visibilityState.forceNextUpdate = false;
    }

    if (this.isStreamingMode && !needsContentUpdate && !needsLanguageUpdate && !needsEditableUpdate && !shouldForceUpdate) {
      return;
    }

    if (!needsContentUpdate && !needsLanguageUpdate && !needsEditableUpdate && !shouldForceUpdate) {
      verboseLog('SidePane', `No updates needed for ${fileName}, fingerprints match`);
      return;
    }

    verboseLog('SidePane', `Reconciling content for ${fileName}:`, {
      needsContentUpdate,
      needsLanguageUpdate, 
      needsEditableUpdate,
      shouldForceUpdate,
      isSameFileReopened
    });

    this.isSettingContent = true;

    try {
      const currentPosition = this.isEditable ? this.editor.getPosition() : null;
      const currentScrollTop = this.isEditable ? this.editor.getScrollTop() : null;

      // FIXED: Force model recreation for same file reopening or language changes
      if (needsLanguageUpdate || shouldForceUpdate || (needsContentUpdate && !this.isVisible)) {
        verboseLog('SidePane', 'Using model recreation strategy');
        const recreationSuccess = this.recreateModelWithContent(content, language);
        
        if (recreationSuccess) {
          this.currentFileName = fileName;
          this.visibilityState.savedContent = content;
          this.visibilityState.savedLanguage = language;
          this.visibilityState.forceNextUpdate = false; // Reset force flag

          if (this.isEditable && currentPosition && currentScrollTop !== null) {
            requestAnimationFrame(() => {
              if (this.editor && !this.isSettingContent) {
                this.editor.setPosition(currentPosition);
                this.editor.setScrollTop(currentScrollTop);
              }
            });
          } else if (!this.isEditable && (needsContentUpdate || shouldForceUpdate)) {
            this.scheduleAutoScroll();
          }
        } else {
          console.warn('⚠️ [Mobile] Model recreation failed, using fallback');
          this.fallbackContentUpdate(content, language, fileName);
        }
      } else {
        this.fallbackContentUpdate(content, language, fileName);
      }

      if (needsEditableUpdate) {
        this.editor.updateOptions({ 
          readOnly: !editable,
          contextmenu: editable
        });
        this.lastEditableState = editable;
        this.isEditable = editable;
        this.visibilityState.savedEditable = editable;
      }

    } catch (error) {
      console.error('❌ [Mobile] Error during content reconciliation:', error);
    } finally {
      this.isSettingContent = false;
    }
  }

  private fallbackContentUpdate(content: string, language: string, fileName: string): void {
    const model = this.editor?.getModel();
    if (!model) return;

    if (language !== this.lastLanguageSet && window.monaco) {
      window.monaco.editor.setModelLanguage(model, language);
      this.lastLanguageSet = language;
      this.currentLanguage = language;
      this.visibilityState.savedLanguage = language;
    }

    const contentFingerprint = this.generateContentFingerprint(content, fileName);
    if (contentFingerprint !== this.lastContentFingerprint) {
      model.setValue(content);
      this.currentContent = content;
      this.lastContentFingerprint = contentFingerprint;
      this.visibilityState.savedContent = content;
      
      if (this.isStreamingMode) {
        this.streamingUpdateCount++;
      }
    }

    this.currentFileName = fileName;
  }

  private scheduleAutoScroll(): void {
    if (this.isStreamingMode) {
      const throttleDelay = this.capabilities.isMobile ? 200 : 100;
      const now = Date.now();
      if (now - this.lastStreamingUpdate > throttleDelay) {
        requestAnimationFrame(() => {
          if (!this.isSettingContent) {
            this.performAutoScroll();
          }
        });
        this.lastStreamingUpdate = now;
      }
    } else {
      requestAnimationFrame(() => {
        if (!this.isSettingContent) {
          this.performAutoScroll();
        }
      });
    }
  }

  // Ultra-fast streaming content update with mobile optimization
  updateStreamingContent(newContent: string) {
    if (!this.isInitialized || !this.editor || this.isUserTyping) {
      return;
    }

    const contentFingerprint = this.generateContentFingerprint(newContent, this.currentFileName);
    if (contentFingerprint === this.lastContentFingerprint) {
      return;
    }

    const model = this.editor.getModel();
    if (!model) return;

    this.isSettingContent = true;

    try {
      // ✅ NEW: Update scroll state before checking if we should auto-scroll
      this.updateScrollState();

      const currentPosition = this.isEditable ? this.editor.getPosition() : null;
      const currentScrollTop = this.isEditable ? this.editor.getScrollTop() : null;

      model.setValue(newContent);
      this.currentContent = newContent;
      this.lastContentFingerprint = contentFingerprint;
      this.visibilityState.savedContent = newContent;
      
      if (this.isStreamingMode) {
        this.streamingUpdateCount++;
      }

      if (this.isEditable && currentPosition && currentScrollTop !== null) {
        // Editable mode - preserve user position
        this.editor.setPosition(currentPosition);
        this.editor.setScrollTop(currentScrollTop);
      } else if (!this.isEditable) {
        // ✅ NEW: Only auto-scroll if user is near bottom and not actively scrolling
        if (this.shouldAutoScroll && this.isNearBottom && !this.isUserScrolling) {
          this.performAutoScroll();
        }
        // If user scrolled up, don't auto-scroll - respect their scroll position
      }
    } catch (error) {
      console.error('Error updating streaming content:', error);
    } finally {
      this.isSettingContent = false;
    }
  }

  // Enhanced visibility control with proper file tracking
  setVisible(visible: boolean) {
    console.log(`🔧 [Mobile] Setting visibility: ${visible}, was: ${this.isVisible}, file: ${this.currentFileName}`);
    
    if (this.isVisible === visible) {
      return;
    }

    this.visibilityState.isVisible = visible;
    this.isVisible = visible;
    
    if (this.container) {
      this.container.style.display = visible ? 'block' : 'none';
      
      if (!visible) {
        console.log(`🔧 [Mobile] Hiding editor for file: ${this.currentFileName} - saving state`);
        this.visibilityState.lastHiddenTime = Date.now();
        this.visibilityState.needsFullRestoration = true;
        this.visibilityState.lastVisibleFileName = this.currentFileName; // Track which file was visible
        
        if (this.editor) {
          const model = this.editor.getModel();
          if (model) {
            this.visibilityState.savedContent = model.getValue();
            this.visibilityState.savedLanguage = model.getLanguageId();
          }
          this.visibilityState.savedTheme = 'vscode-dark-optimized';
          this.visibilityState.savedEditable = this.isEditable;
          
          this.saveEditorState();
        }
      } else {
        console.log(`🚀 [Mobile] Showing editor for file: ${this.currentFileName}`);
        // FIXED: Set force update flag for same file reopening
        if (this.currentFileName && this.currentFileName === this.visibilityState.lastVisibleFileName) {
          verboseLog('SidePane', `Same file reopened (${this.currentFileName}), will force update`);
          this.visibilityState.forceNextUpdate = true;
        }
      }
    }
    
    if (visible && this.editor && this.visibilityState.needsFullRestoration) {
      console.log(`🚀 [Mobile] Showing editor - starting restoration for file: ${this.currentFileName}`);
      this.performCompleteRestoration();
    }
  }

  /**
   * Scroll to a specific line number in the editor
   * Used for scrolling to edit locations
   */
  scrollToLine(lineNumber: number, scrollType: number = 1): void {
    if (!this.editor || !this.isInitialized) {
      console.warn('⚠️ [SidePane] Cannot scroll to line - editor not initialized', {
        hasEditor: !!this.editor,
        isInitialized: this.isInitialized
      });
      return;
    }

    try {
      // Validate line number
      const model = this.editor.getModel();
      if (!model) return;

      const lineCount = model.getLineCount();
      const targetLine = Math.max(1, Math.min(lineNumber, lineCount));

      console.log(`📍 [SidePane] Scrolling to line ${targetLine} of ${lineCount}`);
      
      // Reveal the line with some context (center it in viewport)
      // Use revealLineInCenter to ensure the line is visible
      this.editor.revealLineInCenter(targetLine, scrollType);
      
      // Set cursor position to the line and highlight it
      if (!window.monaco) return;
      const position = new window.monaco.Position(targetLine, 1);
      this.editor.setPosition(position);
      
      // Add a selection to highlight the line (optional visual feedback)
      const lineContent = model.getLineContent(targetLine);
      const endColumn = lineContent.length + 1;
      const selection = new window.monaco.Selection(targetLine, 1, targetLine, endColumn);
      this.editor.setSelection(selection);
      
      // Add a decoration to highlight the edited line
      const decorationId = this.editor.deltaDecorations([], [{
        range: new window.monaco.Range(targetLine, 1, targetLine, endColumn),
        options: {
          className: 'edited-line-highlight',
          isWholeLine: true,
          hoverMessage: { value: '✨ Code was modified here' }
        }
      }]);
      
      // Clear selection and decoration after a moment (just to show where the edit is)
      setTimeout(() => {
        if (this.editor) {
          this.editor.setPosition(position);
          // Keep decoration for a bit longer
          setTimeout(() => {
            if (this.editor) {
              this.editor.deltaDecorations(decorationId, []);
            }
          }, 3000);
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ [SidePane] Error scrolling to line:', error);
    }
  }

  private async performCompleteRestoration(): Promise<void> {
    if (!this.editor || !this.isVisible) return;

    const hiddenDuration = Date.now() - this.visibilityState.lastHiddenTime;
    console.log(`🎨 [Mobile] Starting restoration after ${hiddenDuration}ms:`, {
      theme: this.visibilityState.savedTheme,
      language: this.visibilityState.savedLanguage,
      contentLength: this.visibilityState.savedContent.length,
      fileName: this.currentFileName,
      lastVisibleFile: this.visibilityState.lastVisibleFileName
    });

    const executeRestoration = async () => {
      if (!this.editor || !this.isVisible) return;

      try {
        await this.waitForDOMReady();

        console.log(`🎨 [Mobile] Applying theme: ${this.visibilityState.savedTheme}`);
        if (window.monaco) {
          window.monaco.editor.setTheme(this.visibilityState.savedTheme);
        }

        await this.sleep(50);

        verboseLog('SidePane', `Recreating model with language: ${this.visibilityState.savedLanguage}`);
        const modelRecreated = this.recreateModelWithContent(
          this.visibilityState.savedContent,
          this.visibilityState.savedLanguage
        );

        if (!modelRecreated) {
          throw new Error('Model recreation failed');
        }

        await this.sleep(100);

        if (this.visibilityState.savedEditable !== this.isEditable) {
          console.log(`⚙️ [Mobile] Updating editor options`);
          this.editor.updateOptions({ 
            readOnly: !this.visibilityState.savedEditable,
            contextmenu: this.visibilityState.savedEditable
          });
          this.isEditable = this.visibilityState.savedEditable;
          this.lastEditableState = this.visibilityState.savedEditable;
        }

        verboseLog('SidePane', `Performing layout cycles...`);
        for (let i = 0; i < 3; i++) {
          this.editor.layout();
          await this.sleep(50);
        }

        console.log(`📍 [Mobile] Restoring editor state...`);
        this.restoreEditorState();

        // Mobile-specific layout fixes
        if (this.capabilities.isMobile) {
          await this.sleep(100);
          this.editor.layout();
          
          // Force proper height calculation on mobile
          const container = this.editor.getDomNode();
          if (container) {
            container.style.height = '';
            container.style.height = container.parentElement?.clientHeight + 'px';
          }
        }

        this.editor.layout();
        
        if (!this.isEditable) {
          this.editor.focus();
        }

        this.visibilityState.needsFullRestoration = false;
        
        console.log(`✅ [Mobile] Complete restoration finished for file: ${this.currentFileName}`);

        setTimeout(() => {
          this.validateSyntaxHighlighting();
        }, 200);

      } catch (restoreError) {
        console.error(`❌ [Mobile] Complete restoration failed:`, restoreError);
        await this.performFallbackRestoration();
      }
    };

    if (this.isStreamingMode) {
      setTimeout(executeRestoration, 100);
    } else {
      executeRestoration();
    }
  }

  private async performFallbackRestoration(): Promise<void> {
    if (!this.editor) return;

    try {
      verboseLog('SidePane', `Attempting fallback restoration...`);
      
      if (!window.monaco) {
        console.warn('[SidePane] Monaco not available for fallback restoration');
        return;
      }
      
      window.monaco.editor.setTheme(this.visibilityState.savedTheme);
      await this.sleep(100);

      const model = this.editor.getModel();
      if (model && this.visibilityState.savedLanguage) {
        window.monaco.editor.setModelLanguage(model, this.visibilityState.savedLanguage);
        await this.sleep(100);
      }

      for (let i = 0; i < 5; i++) {
        this.editor.layout();
        await this.sleep(100);
      }

      // Mobile-specific fallback fixes
      if (this.capabilities.isMobile) {
        const container = this.editor.getDomNode();
        if (container && container.parentElement) {
          container.style.height = container.parentElement.clientHeight + 'px';
          this.editor.layout();
        }
      }

      this.editor.trigger('fallback', 'editor.action.formatDocument', {});
      this.editor.focus();
      this.editor.layout();

      this.visibilityState.needsFullRestoration = false;
      console.log(`⚠️ [Mobile] Fallback restoration completed`);

    } catch (fallbackError) {
      console.error(`❌ [Mobile] Fallback restoration failed:`, fallbackError);
      this.visibilityState.needsFullRestoration = false;
    }
  }

  private waitForDOMReady(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    });
  }

  private validateSyntaxHighlighting(): void {
    if (!this.editor) return;

    try {
      const model = this.editor.getModel();
      if (!model) return;

      const languageId = model.getLanguageId();
      const lineCount = model.getLineCount();
      
      console.log(`🔍 [Mobile] Validation - Language: ${languageId}, Lines: ${lineCount}, File: ${this.currentFileName}`);
      
      const editorDom = this.editor.getDomNode();
      const tokenElements = editorDom?.querySelectorAll('.mtk1, .mtk2, .mtk3, .mtk4, .mtk5');
      
      console.log(`🔍 [Mobile] Validation - Found ${tokenElements?.length || 0} syntax token elements`);
      
      if (!tokenElements || tokenElements.length === 0) {
        console.warn(`⚠️ [Mobile] Validation failed - no syntax highlighting tokens found`);
        
        setTimeout(() => {
          if (this.editor && this.isVisible && window.monaco) {
            verboseLog('SidePane', `Attempting additional restoration cycle...`);
            window.monaco.editor.setTheme(this.visibilityState.savedTheme);
            this.editor.layout();
          }
        }, 500);
      } else {
        console.log(`✅ [Mobile] Validation successful - syntax highlighting is active`);
      }

    } catch (error) {
      console.error(`❌ [Mobile] Validation error:`, error);
    }
  }

  setContentChangeHandler(handler: (content: string) => void) {
    this.onContentChange = handler;
  }

  resetAutoScroll() {
    this.shouldAutoScroll = true;
  }

  addCommand(keybinding: number, handler: () => void) {
    if (this.editor) {
      this.editor.addCommand(keybinding, handler);
    }
  }

  getEditor(): monaco.editor.IStandaloneCodeEditor | null {
    return this.editor;
  }

  // 🔥 ENHANCED DISPOSAL with initialization guards
  dispose() {
    console.log('🧹 [Mobile] StreamingOptimizedMonacoManager: Disposing...');
    
    // 🔥 CRITICAL: Set disposal guards to prevent re-initialization
    this.isInitializing = false;
    this.initializationPromise = null;
    
    // Clean up mobile viewport tracking
    if (this.orientationChangeHandler) {
      window.removeEventListener('orientationchange', this.orientationChangeHandler);
      this.orientationChangeHandler = null;
    }
    
    if (this.visualViewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.visualViewportHandler);
      this.visualViewportHandler = null;
    }
    
    if (this.changeListenerDisposable) {
      this.changeListenerDisposable.dispose();
      this.changeListenerDisposable = null;
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.editor) {
      const model = this.editor.getModel();
      if (model) {
        model.dispose();
      }
      
      this.editor.dispose();
      this.editor = null;
    }
    
    this.container = null;
    this.containerFingerprint = '';
    this.onContentChange = null;
    this.isInitialized = false;
    
    // Reset mobile-specific state
    this.viewportHeight = 0;
    this.keyboardHeight = 0;
    this.isKeyboardVisible = false;
    this.isStreamingMode = false;
    this.streamingUpdateCount = 0;
    this.lastStreamingUpdate = 0;
    
    // Reset all tracking variables
    this.lastContentFingerprint = '';
    this.lastLanguageSet = '';
    this.lastEditableState = false;
    this.lastFileName = '';
    this.currentFileName = '';
    this.currentContent = '';
    this.currentLanguage = 'plaintext';
    
    this.editorState = {
      position: null,
      scrollTop: 0,
      scrollLeft: 0,
      selection: null,
      viewState: null
    };
    
    this.visibilityState = {
      isVisible: true,
      lastHiddenTime: 0,
      needsFullRestoration: false,
      savedTheme: 'vscode-dark-optimized',
      savedLanguage: 'plaintext',
      savedContent: '',
      savedEditable: false,
      lastVisibleFileName: '',
      forceNextUpdate: false
    };
  }

  // Setup Motoko language support
  private setupMotoko() {
    // Guard against monaco not being loaded yet
    if (typeof window === 'undefined' || !window.monaco) {
      console.warn('[SidePane] Monaco not yet available, skipping Motoko setup');
      return;
    }
    
    const monaco = window.monaco;
    if (monaco.languages.getLanguages().some(lang => lang.id === 'motoko')) return;

    monaco.languages.register({ id: 'motoko' });
    
    monaco.languages.setMonarchTokensProvider('motoko', {
      tokenizer: {
        root: [
          [/\b(import|module|actor|class|object|type|public|private|shared|query|func|async|await|let|var|if|else|switch|case|while|for|loop|break|continue|return|try|catch|throw|finally|debug|assert|ignore|in|stable|flexible|system|heartbeat|inspect|composite|canister)\b/, 'keyword'],
          [/\b(and|or|not|do|label)\b/, 'keyword.control'],
          [/\b(Nat|Nat8|Nat16|Nat32|Nat64|Int|Int8|Int16|Int32|Int64|Float|Bool|Text|Char|Blob|Principal|Any|None|Null|Error|Option|Result|Array|Buffer|List|Trie|TrieMap|TrieSet|HashMap|Hash|Iter|Time|Timer|Debug|Random|Cycles|ExperimentalCycles|ExperimentalStableMemory|CertifiedData|IC|management_canister)\b/, 'type'],
          [/\b(Prim|Prelude|AssocList|RBTree|Stack|Deque|Heap|Map|Set|OrderedMap|OrderedSet)\b/, 'type.identifier'],
          [/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/, 'entity.name.function'],
          [/\b(true|false|null)\b/, 'constant.language'],
          [/\b0x[0-9a-fA-F_]+\b/, 'number.hex'],
          [/\b0b[01_]+\b/, 'number.binary'],
          [/\b\d+(_\d+)*(\.\d+(_\d+)*)?([eE][+-]?\d+(_\d+)*)?\b/, 'number'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],
          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/'/, 'string', '@string_single'],
          [/\/\/.*$/, 'comment.line'],
          [/\/\*/, 'comment.block', '@comment_block'],
          [/[{}()\[\]]/, 'delimiter.bracket'],
          [/[<>](?!@symbols)/, 'delimiter.angle'],
          [/[;,.:]/, 'delimiter'],
          [/[=!<>]=?/, 'operator.comparison'],
          [/[+\-*/%]/, 'operator.arithmetic'],
          [/[&|^~]/, 'operator.bitwise'],
          [/:=|->|=>/, 'operator.assignment'],
          [/\?/, 'operator.optional'],
          [/[ \t\r\n]+/, 'white'],
          [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
        ],
        
        string: [
          [/[^\\"]+/, 'string'],
          [/\\u[0-9a-fA-F]{4}/, 'string.escape'],
          [/\\n|\\r|\\t|\\\\|\\"/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/"/, 'string', '@pop']
        ],
        
        string_single: [
          [/[^\\']+/, 'string'],
          [/\\u[0-9a-fA-F]{4}/, 'string.escape'],
          [/\\n|\\r|\\t|\\\\|\\'/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/'/, 'string', '@pop']
        ],
        
        comment_block: [
          [/[^\/*]+/, 'comment.block'],
          [/\/\*/, 'comment.block', '@push'],
          [/\*\//, 'comment.block', '@pop'],
          [/[\/*]/, 'comment.block']
        ],
      },
      
      symbols: /[=><!~?:&|+\-*\/\^%]+/,
    });
    
    monaco.languages.setLanguageConfiguration('motoko', {
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
        ['<', '>']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      wordPattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
      indentationRules: {
        increaseIndentPattern: /^.*\{[^}]*$/,
        decreaseIndentPattern: /^.*\}.*$/
      }
    });

    monaco.editor.defineTheme('vscode-dark-optimized', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '4FC1FF', fontStyle: 'bold' },
        { token: 'keyword.control', foreground: 'C586C0', fontStyle: 'bold' },
        { token: 'type', foreground: '4ECDC4', fontStyle: 'bold' },
        { token: 'type.identifier', foreground: '26D0CE' },
        { token: 'entity.name.function', foreground: 'DCDCAA', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'string.escape', foreground: 'D7BA7D' },
        { token: 'string.invalid', foreground: 'F44747' },
        { token: 'comment.line', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'comment.block', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'number.hex', foreground: 'B5CEA8' },
        { token: 'number.binary', foreground: 'B5CEA8' },
        { token: 'constant.language', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'operator.comparison', foreground: 'D4D4D4', fontStyle: 'bold' },
        { token: 'operator.arithmetic', foreground: 'D4D4D4' },
        { token: 'operator.bitwise', foreground: 'D4D4D4' },
        { token: 'operator.assignment', foreground: 'D4D4D4', fontStyle: 'bold' },
        { token: 'operator.optional', foreground: 'C586C0' },
        { token: 'delimiter.bracket', foreground: 'FFD700' },
        { token: 'delimiter.angle', foreground: 'FFD700' },
        { token: 'delimiter', foreground: 'D4D4D4' },
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'variable', foreground: '9CDCFE' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editor.lineHighlightBackground': '#FFFFFF0A',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorCursor.foreground': '#AEAFAD',
        'scrollbarSlider.background': '#79797966',
        'scrollbarSlider.hoverBackground': '#646464B3',
        'scrollbarSlider.activeBackground': '#BFBFBF66',
        'editor.rangeHighlightBackground': '#FFFFFF0D',
        'editorBracketMatch.background': '#0064001A',
        'editorBracketMatch.border': '#888888'
      }
    });
  }
}

// 🎯 BEAUTIFUL LOADING OVERLAY COMPONENT
const MonacoLoadingOverlay: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  // 🔥 STABLE CAPABILITIES - use singleton
  const capabilities = getStableDeviceCapabilities();

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(30, 30, 30, 0.98)',
      backdropFilter: 'blur(12px) saturate(150%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      transition: 'opacity 0.2s ease'
    }}>
      <div style={{
        width: capabilities.isMobile ? '64px' : '72px',
        height: capabilities.isMobile ? '64px' : '72px',
        marginBottom: '1.5rem',
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)',
        animation: 'kontextPulse 2s ease-in-out infinite'
      }}>
        <img 
          src="https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/KCP_LOGO.png"
          alt="Kontext Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: '16px'
          }}
        />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
          borderRadius: '16px',
          animation: 'kontextShine 2s ease-in-out infinite'
        }} />
      </div>
      
      <div style={{
        color: '#ffffff',
        fontSize: capabilities.isMobile ? '1rem' : '1.1rem',
        fontWeight: 600,
        marginBottom: '0.5rem',
        textAlign: 'center'
      }}>
        Initializing Code Editor
      </div>
      
      <div style={{
        color: '#ff6b35',
        fontSize: capabilities.isMobile ? '0.85rem' : '0.9rem',
        fontWeight: 500,
        textAlign: 'center',
        opacity: 0.8
      }}>
        Preparing Monaco for streaming...
      </div>
      
      <div style={{
        marginTop: '2rem',
        display: 'flex',
        gap: '6px'
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff6b35, #10b981)',
              animation: `kontextDots 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes kontextPulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 8px 32px rgba(255, 107, 53, 0.3);
          }
          50% { 
            transform: scale(1.05);
            box-shadow: 0 12px 40px rgba(255, 107, 53, 0.5);
          }
        }
        
        @keyframes kontextShine {
          0%, 100% { 
            transform: translateX(-100%) rotate(45deg);
            opacity: 0;
          }
          50% { 
            transform: translateX(100%) rotate(45deg);
            opacity: 1;
          }
        }
        
        @keyframes kontextDots {
          0%, 60%, 100% { 
            transform: scale(1);
            opacity: 0.7;
          }
          30% { 
            transform: scale(1.3);
            opacity: 1;
          }
        }
        
        .edited-line-highlight {
          background-color: rgba(59, 130, 246, 0.2) !important;
          border-left: 3px solid rgba(59, 130, 246, 0.6) !important;
          animation: pulse-highlight 2s ease-in-out;
        }
        
        @keyframes pulse-highlight {
          0%, 100% {
            background-color: rgba(59, 130, 246, 0.2);
          }
          50% {
            background-color: rgba(59, 130, 246, 0.4);
          }
        }
      `}</style>
    </div>
  );
};

// Main SidePane component with coordinated loading
// 🔥 FIX: Define component first, then export with memo to prevent initialization errors
const SidePaneComponent: React.FC<SidePaneProps> = ({ onClose }) => {
    // Bulletproof store access
    const filesStore = useFiles();
    const uiStore = useUI();
    
    // Safe data extraction
    const generatedFiles = useMemo(() => {
        try {
            return filesStore?.generatedFiles && typeof filesStore.generatedFiles === 'object' 
                ? filesStore.generatedFiles 
                : {};
        } catch (e) {
            console.error('Error accessing generatedFiles:', e);
            return {};
        }
    }, [filesStore?.generatedFiles]);
    
    const liveGeneratedFiles = useMemo(() => {
        try {
            const files = filesStore?.liveGeneratedFiles;
            if (Array.isArray(files)) {
                return files;
            }
            console.warn('liveGeneratedFiles is not an array:', typeof files, files);
            return [];
        } catch (e) {
            console.error('Error accessing liveGeneratedFiles:', e);
            return [];
        }
    }, [filesStore?.liveGeneratedFiles]);
    
    // Ultra-safe UI state access
    const ui = useMemo(() => {
        try {
            const uiData = uiStore?.ui;
            if (uiData && typeof uiData === 'object' && uiData.sidePane && typeof uiData.sidePane === 'object') {
                return uiData;
            }
            return { sidePane: { isOpen: false, activeFile: null, isStreamingToActiveFile: false, streamingSource: null, contentUpdateSource: null, editLocation: null, editPreview: null } };
        } catch (e) {
            console.error('Error accessing UI state:', e);
            return { sidePane: { isOpen: false, activeFile: null, isStreamingToActiveFile: false, streamingSource: null, contentUpdateSource: null, editLocation: null, editPreview: null } };
        }
    }, [uiStore?.ui]);
    
    const isEditable = useMemo(() => {
        try {
            return Boolean(uiStore?.isEditable);
        } catch (e) {
            console.error('Error accessing isEditable:', e);
            return false;
        }
    }, [uiStore?.isEditable]);
    
    const isDirty = useMemo(() => {
        try {
            return Boolean(uiStore?.isDirty);
        } catch (e) {
            console.error('Error accessing isDirty:', e);
            return false;
        }
    }, [uiStore?.isDirty]);
    
    const pendingSave = useMemo(() => {
        try {
            return Boolean(uiStore?.pendingSave);
        } catch (e) {
            console.error('Error accessing pendingSave:', e);
            return false;
        }
    }, [uiStore?.pendingSave]);
    
    const editContent = useMemo(() => {
        try {
            return uiStore?.editContent || null;
        } catch (e) {
            console.error('Error accessing editContent:', e);
            return null;
        }
    }, [uiStore?.editContent]);
    
    // Streaming state access
    const isStreamingToActiveFile = useMemo(() => {
        try {
            return Boolean(ui?.sidePane?.isStreamingToActiveFile);
        } catch (e) {
            console.error('Error accessing isStreamingToActiveFile:', e);
            return false;
        }
    }, [ui?.sidePane?.isStreamingToActiveFile]);
    
    const streamingSource = useMemo(() => {
        try {
            return ui?.sidePane?.streamingSource || null;
        } catch (e) {
            console.error('Error accessing streamingSource:', e);
            return null;
        }
    }, [ui?.sidePane?.streamingSource]);
    
    const contentUpdateSource = useMemo(() => {
        try {
            return ui?.sidePane?.contentUpdateSource || null;
        } catch (e) {
            console.error('Error accessing contentUpdateSource:', e);
            return null;
        }
    }, [ui?.sidePane?.contentUpdateSource]);
    
    // 🔥 STABLE CALLBACK REFS - moved to refs to prevent dependency changes
    const stableCallbackRefs = useRef({
        closeSidePane: () => {
            try {
                if (uiStore?.closeSidePane && typeof uiStore.closeSidePane === 'function') {
                    uiStore.closeSidePane();
                }
            } catch (e) {
                console.error('Error calling closeSidePane:', e);
            }
        },
        toggleSidePaneEditMode: () => {
            try {
                if (uiStore?.toggleSidePaneEditMode && typeof uiStore.toggleSidePaneEditMode === 'function') {
                    uiStore.toggleSidePaneEditMode();
                }
            } catch (e) {
                console.error('Error calling toggleSidePaneEditMode:', e);
            }
        },
        updateFileContent: (content: string, source: 'user' | 'streaming' | 'external') => {
            try {
                if (uiStore?.updateFileContent && typeof uiStore.updateFileContent === 'function') {
                    uiStore.updateFileContent(content, source);
                }
            } catch (e) {
                console.error('Error calling updateFileContent:', e);
            }
        },
        setStreamingToActiveFile: (isStreaming: boolean, source?: 'project_generation' | 'update_streaming' | 'file_application') => {
            try {
                if (uiStore?.setStreamingToActiveFile && typeof uiStore.setStreamingToActiveFile === 'function') {
                    uiStore.setStreamingToActiveFile(isStreaming, source);
                }
            } catch (e) {
                console.error('Error calling setStreamingToActiveFile:', e);
            }
        },
        shouldAllowSidePaneClose: (): boolean => {
            try {
                if (uiStore?.shouldAllowSidePaneClose && typeof uiStore.shouldAllowSidePaneClose === 'function') {
                    return uiStore.shouldAllowSidePaneClose();
                }
                return !isDirty || contentUpdateSource !== 'user';
            } catch (e) {
                console.error('Error calling shouldAllowSidePaneClose:', e);
                return true;
            }
        },
        saveCurrentFile: () => {
            try {
                if (uiStore?.saveCurrentFile && typeof uiStore.saveCurrentFile === 'function') {
                    return uiStore.saveCurrentFile();
                }
                return Promise.resolve(false);
            } catch (e) {
                console.error('Error calling saveCurrentFile:', e);
                return Promise.resolve(false);
            }
        },
        createNewFile: (filename: string, content: string) => {
            try {
                if (uiStore?.createNewFile && typeof uiStore.createNewFile === 'function') {
                    return uiStore.createNewFile(filename, content);
                }
                return Promise.resolve(false);
            } catch (e) {
                console.error('Error calling createNewFile:', e);
                return Promise.resolve(false);
            }
        },
        deleteCurrentFile: () => {
            try {
                if (uiStore?.deleteCurrentFile && typeof uiStore.deleteCurrentFile === 'function') {
                    return uiStore.deleteCurrentFile();
                }
                return Promise.resolve(false);
            } catch (e) {
                console.error('Error calling deleteCurrentFile:', e);
                return Promise.resolve(false);
            }
        },
        renameCurrentFile: (newName: string) => {
            try {
                if (uiStore?.renameCurrentFile && typeof uiStore.renameCurrentFile === 'function') {
                    return uiStore.renameCurrentFile(newName);
                }
                return Promise.resolve(false);
            } catch (e) {
                console.error('Error calling renameCurrentFile:', e);
                return Promise.resolve(false);
            }
        }
    });
    
    // 🔥 UPDATE CALLBACK REFS when store changes (but don't use as dependencies)
    useEffect(() => {
        stableCallbackRefs.current.closeSidePane = () => {
            try {
                if (uiStore?.closeSidePane && typeof uiStore.closeSidePane === 'function') {
                    uiStore.closeSidePane();
                }
            } catch (e) {
                console.error('Error calling closeSidePane:', e);
            }
        };
        // ... update other refs similarly
    }, [uiStore]);
    
    // 🔥 COORDINATED LOADING STATE - simplified to prevent render loops
    const [coordinatedLoadingState, setCoordinatedLoadingState] = useState<{
        isInitializing: boolean;
        monacoReady: boolean;
        initAttempts: number;
    }>({
        isInitializing: false,
        monacoReady: false,
        initAttempts: 0
    });
    
    const containerRef = useRef<HTMLDivElement>(null);
    const monacoManagerRef = useRef<StreamingOptimizedMonacoManager | null>(null);
    
    // 🔥 STABLE CAPABILITIES - use singleton
    const capabilities = getStableDeviceCapabilities();
    const lastActiveFileRef = useRef<string | null>(null);
    
    const [showNewFileDialog, setShowNewFileDialog] = useState(false);
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [newFileContent, setNewFileContent] = useState('');

    // 🔥 STABLE VIEWPORT HEIGHT - calculated once with fallback
    const mobileViewportHeight = useMemo(() => getMobileViewportHeight(capabilities), []);

    // Bulletproof derived values
    const activeFileName = useMemo(() => {
        try {
            return ui?.sidePane?.activeFile || null;
        } catch (e) {
            console.error('Error accessing activeFileName:', e);
            return null;
        }
    }, [ui]);
    
    const currentFile = useMemo(() => {
        try {
            if (!activeFileName || !Array.isArray(liveGeneratedFiles) || liveGeneratedFiles.length === 0) {
                return null;
            }
            return liveGeneratedFiles.find(f => f && f.fileName === activeFileName) || null;
        } catch (e) {
            console.error('Error finding current file:', e);
            return null;
        }
    }, [activeFileName, liveGeneratedFiles]);
    
    const fileContent = useMemo(() => {
        try {
            if (isEditable && editContent !== null) {
                return editContent;
            }
            if (activeFileName && generatedFiles && typeof generatedFiles === 'object') {
                return generatedFiles[activeFileName] || null;
            }
            return null;
        } catch (e) {
            console.error('Error accessing file content:', e);
            return null;
        }
    }, [isEditable, editContent, activeFileName, generatedFiles]);
    
    const language = useMemo(() => {
        try {
            return activeFileName ? detectMonacoLanguage(activeFileName) : 'plaintext';
        } catch (e) {
            console.error('Error detecting language:', e);
            return 'plaintext';
        }
    }, [activeFileName]);

    // 🔥 GUARDED INITIALIZATION EFFECT - with proper cleanup guards
    useEffect(() => {
        // 🔥 GUARD: Only run if container is available and we haven't exceeded retry attempts
        if (!containerRef.current || coordinatedLoadingState.initAttempts >= 3) {
            return;
        }

        // 🔥 GUARD: Skip if already initializing
        if (coordinatedLoadingState.isInitializing) {
            return;
        }

        const coordinatedInitialization = async () => {
            console.log('🎯 [SidePane] Starting guarded coordinated initialization...');
            
            setCoordinatedLoadingState(prev => ({
                ...prev,
                isInitializing: true,
                initAttempts: prev.initAttempts + 1
            }));

            try {
                // Create manager only once
                if (!monacoManagerRef.current) {
                    monacoManagerRef.current = new StreamingOptimizedMonacoManager(capabilities);
                    console.log('🏗️ [SidePane] Created Monaco manager with guarded coordination');
                }

                // 🔥 GUARDED INITIALIZATION with container check
                if (containerRef.current) {
                    await monacoManagerRef.current.initialize(containerRef.current);
                    
                    // Setup handlers via refs (no dependency issues)
                    monacoManagerRef.current.setContentChangeHandler((content) => {
                        stableCallbackRefs.current.updateFileContent(content, 'user');
                    });

                    // Setup keyboard shortcuts
                    monacoManagerRef.current.addCommand(
                        (monacoInstance?.KeyMod.CtrlCmd || 2048) | (monacoInstance?.KeyCode.KeyS || 49), 
                        () => {
                            handleSave();
                        }
                    );

                    // CTRL+D to delete line
                    monacoManagerRef.current.addCommand(
                        (monacoInstance?.KeyMod.CtrlCmd || 2048) | (monacoInstance?.KeyCode.KeyD || 36),
                        () => {
                            const editor = monacoManagerRef.current?.getEditor();
                            if (editor) {
                                editor.trigger('keyboard', 'editor.action.deleteLines', null);
                            }
                        }
                    );

                    // CTRL+SHIFT+C to toggle line comment
                    monacoManagerRef.current.addCommand(
                        (monacoInstance?.KeyMod.CtrlCmd || 2048) | (monacoInstance?.KeyMod.Shift || 1024) | (monacoInstance?.KeyCode.KeyC || 33),
                        () => {
                            const editor = monacoManagerRef.current?.getEditor();
                            if (editor) {
                                editor.trigger('keyboard', 'editor.action.commentLine', null);
                            }
                        }
                    );

                    setCoordinatedLoadingState(prev => ({
                        ...prev,
                        isInitializing: false,
                        monacoReady: true
                    }));

                    console.log(`✅ [SidePane] Guarded coordinated initialization completed`);
                } else {
                    throw new Error('Container ref became null during initialization');
                }

            } catch (error) {
                console.error('❌ [SidePane] Guarded coordinated initialization failed:', error);
                
                setCoordinatedLoadingState(prev => ({
                    ...prev,
                    isInitializing: false,
                    monacoReady: false
                }));
            }
        };

        // 🔥 MINIMAL DELAY to allow React to settle
        const initTimer = setTimeout(coordinatedInitialization, 100);

        return () => {
            clearTimeout(initTimer);
        };
    }, []); // 🔥 CRITICAL: NO DEPENDENCIES to prevent infinite loops

    // 🔥 CLEANUP EFFECT - separate from initialization
    useEffect(() => {
        return () => {
            if (monacoManagerRef.current) {
                console.log('🧹 [SidePane] Cleaning up Monaco manager...');
                monacoManagerRef.current.dispose();
                monacoManagerRef.current = null;
            }
        };
    }, []);

    // Mobile-aware close handler
    const handleClose = useCallback(() => {
        try {
            console.log('🚪 [MOBILE SIDEPANE] Close attempt');

            if (!stableCallbackRefs.current.shouldAllowSidePaneClose()) {
                const shouldClose = window.confirm('You have unsaved changes. Are you sure you want to close?');
                if (!shouldClose) {
                    console.log('🚪 [MOBILE SIDEPANE] User cancelled close due to unsaved changes');
                    return;
                }
            }
            
            console.log('✅ [MOBILE SIDEPANE] Close allowed - proceeding');
            
            if (onClose) {
                onClose();
            } else {
                stableCallbackRefs.current.closeSidePane();
            }
        } catch (e) {
            console.error('Error in handleClose:', e);
            try {
                if (onClose) onClose();
            } catch (e2) {
                console.error('Error in fallback close:', e2);
            }
        }
    }, [onClose]);

    const handleSave = useCallback(async () => {
        try {
            if (isEditable && isDirty) {
                const success = await stableCallbackRefs.current.saveCurrentFile();
                if (!success) {
                    alert('Failed to save file. Please try again.');
                }
            }
        } catch (error) {
            console.error('Error saving file:', error);
            alert('Failed to save file. Please try again.');
        }
    }, [isEditable, isDirty]);

    const handleEditButtonClick = useCallback(() => {
        try {
            if (isEditable && isDirty) {
                handleSave();
            } else {
                stableCallbackRefs.current.toggleSidePaneEditMode();
            }
        } catch (e) {
            console.error('Error in handleEditButtonClick:', e);
        }
    }, [isEditable, isDirty, handleSave]);

    // 🔥 EFFECTS WITH STABLE DEPENDENCIES ONLY
    
    // Streaming mode management
    useEffect(() => {
        if (monacoManagerRef.current && coordinatedLoadingState.monacoReady) {
            const isStreaming = isStreamingToActiveFile && streamingSource !== null;
            monacoManagerRef.current.setStreamingMode(isStreaming);
            
            if (isStreaming) {
                console.log(`🌊 [Mobile] Streaming mode activated for source: ${streamingSource}`);
            } else {
                console.log('🏁 [Mobile] Streaming mode deactivated');
            }
        }
    }, [isStreamingToActiveFile, streamingSource, coordinatedLoadingState.monacoReady]);

    // Content reconciliation
    useEffect(() => {
        if (monacoManagerRef.current && coordinatedLoadingState.monacoReady && ui.sidePane.isOpen && activeFileName && fileContent !== null) {
            monacoManagerRef.current.reconcileContent(
                activeFileName,
                fileContent,
                language,
                isEditable
            );
            
            lastActiveFileRef.current = activeFileName;
            
            if (contentUpdateSource === 'streaming' && !isStreamingToActiveFile) {
                stableCallbackRefs.current.setStreamingToActiveFile(true, 'update_streaming');
            } else if (contentUpdateSource !== 'streaming' && isStreamingToActiveFile) {
                stableCallbackRefs.current.setStreamingToActiveFile(false);
            }
        }
    }, [coordinatedLoadingState.monacoReady, ui.sidePane.isOpen, activeFileName, fileContent, language, isEditable, contentUpdateSource, isStreamingToActiveFile]);

    // Streaming content updates
    useEffect(() => {
        if (monacoManagerRef.current && coordinatedLoadingState.monacoReady && fileContent && activeFileName === lastActiveFileRef.current) {
            if (contentUpdateSource === 'streaming') {
                monacoManagerRef.current.updateStreamingContent(fileContent);
            } else {
                monacoManagerRef.current.reconcileContent(activeFileName, fileContent, language, isEditable);
            }
        }
    }, [coordinatedLoadingState.monacoReady, fileContent, contentUpdateSource, activeFileName, language, isEditable]);

    // Scroll to edit location when edit is detected and show preview
    useEffect(() => {
        const editLocation = ui?.sidePane?.editLocation;
        const editPreview = ui?.sidePane?.editPreview;
        
        if (editLocation && editLocation.fileName === activeFileName) {
            console.group(`📍 [SidePane] Edit detected in ${editLocation.fileName}`);
            console.log('📍 Edit Location:', {
                lineNumber: editLocation.lineNumber,
                column: editLocation.column,
                fileName: editLocation.fileName
            });
            
            if (editPreview) {
                console.log('📋 Edit Preview Available:');
                console.log('📝 Description:', editPreview.description);
                console.log('📋 OLD CODE (removed):');
                console.log(editPreview.oldCode);
                console.log('📋 NEW CODE (added):');
                console.log(editPreview.newCode);
                console.log('📋 Context:', editPreview.context);
            }
            
            console.log('🔧 Monaco State:', {
                monacoReady: coordinatedLoadingState.monacoReady,
                hasManager: !!monacoManagerRef.current
            });
            console.groupEnd();
            
            // 🔥 CRITICAL: Try scrolling immediately, then retry if needed
            const attemptScroll = () => {
                if (monacoManagerRef.current) {
                    // scrollToLine will check if editor is initialized internally
                    try {
                        console.log(`📍 [SidePane] Attempting scroll to line ${editLocation.lineNumber}`);
                        monacoManagerRef.current.scrollToLine(editLocation.lineNumber, monacoInstance?.editor.ScrollType.Smooth || 1);
                        return true;
                    } catch (error) {
                        console.warn(`⚠️ [SidePane] Scroll attempt failed:`, error);
                        return false;
                    }
                }
                return false;
            };
            
            // Try immediately if Monaco is ready
            if (coordinatedLoadingState.monacoReady) {
                if (attemptScroll()) {
                    console.log(`✅ [SidePane] Scrolled immediately to line ${editLocation.lineNumber}`);
                    
                    // Clear edit location after scrolling (but keep preview)
                    setTimeout(() => {
                        useAppStore.setState((state: any) => {
                            if (state.ui && state.ui.sidePane && state.ui.sidePane.editLocation?.fileName === editLocation.fileName) {
                                state.ui.sidePane.editLocation = null;
                                // Keep preview for 10 seconds so user can see what changed
                                setTimeout(() => {
                                    useAppStore.setState((state: any) => {
                                        if (state.ui && state.ui.sidePane) {
                                            state.ui.sidePane.editPreview = null;
                                        }
                                    });
                                }, 10000);
                            }
                        });
                    }, 2000);
                } else {
                    // If failed, retry after short delay
                    console.log(`⏳ [SidePane] Initial scroll failed, retrying in 300ms...`);
                    const scrollTimeout = setTimeout(() => {
                        if (attemptScroll()) {
                            console.log(`✅ [SidePane] Scrolled after delay to line ${editLocation.lineNumber}`);
                        } else {
                            console.warn(`⚠️ [SidePane] Failed to scroll to line ${editLocation.lineNumber} after retry`);
                        }
                        
                        // Clear edit location after scrolling attempt
                        setTimeout(() => {
                            useAppStore.setState((state: any) => {
                                if (state.ui && state.ui.sidePane && state.ui.sidePane.editLocation?.fileName === editLocation.fileName) {
                                    state.ui.sidePane.editLocation = null;
                                    setTimeout(() => {
                                        useAppStore.setState((state: any) => {
                                            if (state.ui && state.ui.sidePane) {
                                                state.ui.sidePane.editPreview = null;
                                            }
                                        });
                                    }, 10000);
                                }
                            });
                        }, 2000);
                    }, 300);
                    
                    return () => clearTimeout(scrollTimeout);
                }
            } else {
                // If Monaco not ready yet, wait and retry
                console.log(`⏳ [SidePane] Monaco not ready, waiting to scroll to line ${editLocation.lineNumber}`);
                const retryTimeout = setTimeout(() => {
                    if (attemptScroll()) {
                        console.log(`✅ [SidePane] Scrolled after retry to line ${editLocation.lineNumber}`);
                    } else {
                        console.warn(`⚠️ [SidePane] Failed to scroll after retry to line ${editLocation.lineNumber}`);
                    }
                    
                    setTimeout(() => {
                        useAppStore.setState((state: any) => {
                            if (state.ui && state.ui.sidePane && state.ui.sidePane.editLocation?.fileName === editLocation.fileName) {
                                state.ui.sidePane.editLocation = null;
                                setTimeout(() => {
                                    useAppStore.setState((state: any) => {
                                        if (state.ui && state.ui.sidePane) {
                                            state.ui.sidePane.editPreview = null;
                                        }
                                    });
                                }, 10000);
                            }
                        });
                    }, 2000);
                }, 500);
                
                return () => clearTimeout(retryTimeout);
            }
        }
    }, [coordinatedLoadingState.monacoReady, ui.sidePane.editLocation, ui.sidePane.editPreview, activeFileName]);

    // Mobile-optimized visibility control
    useEffect(() => {
        if (monacoManagerRef.current && coordinatedLoadingState.monacoReady) {
            console.log(`🔧 [Mobile] Setting Monaco visibility: ${ui.sidePane.isOpen}`);
            monacoManagerRef.current.setVisible(ui.sidePane.isOpen);
        }
    }, [ui.sidePane.isOpen, coordinatedLoadingState.monacoReady]);

    // Auto-scroll reset
    useEffect(() => {
        if (monacoManagerRef.current && coordinatedLoadingState.monacoReady && activeFileName) {
            monacoManagerRef.current.resetAutoScroll();
        }
    }, [activeFileName, coordinatedLoadingState.monacoReady]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            try {
                // CTRL+S to save
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    handleSave();
                }
                // CTRL+D to delete line (fallback if Monaco doesn't handle it)
                if ((e.ctrlKey || e.metaKey) && e.key === 'd' && isEditable) {
                    e.preventDefault();
                    const editor = monacoManagerRef.current?.getEditor();
                    if (editor) {
                        editor.trigger('keyboard', 'editor.action.deleteLines', null);
                    }
                }
                // CTRL+SHIFT+C to toggle line comment (fallback if Monaco doesn't handle it)
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C' && isEditable) {
                    e.preventDefault();
                    const editor = monacoManagerRef.current?.getEditor();
                    if (editor) {
                        editor.trigger('keyboard', 'editor.action.commentLine', null);
                    }
                }
                // Escape to close dialogs
                if (e.key === 'Escape' && (showNewFileDialog || showRenameDialog || showDeleteConfirm)) {
                    setShowNewFileDialog(false);
                    setShowRenameDialog(false);
                    setShowDeleteConfirm(false);
                }
            } catch (e) {
                console.error('Error in keyboard handler:', e);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            try {
                document.removeEventListener('keydown', handleKeyDown);
            } catch (e) {
                console.error('Error removing keyboard handler:', e);
            }
        };
    }, [handleSave, showNewFileDialog, showRenameDialog, showDeleteConfirm, isEditable]);

    // File management handlers
    const handleCreateFile = useCallback(async () => {
        try {
            if (!newFileName.trim()) {
                alert('Please enter a filename');
                return;
            }
            
            const success = await stableCallbackRefs.current.createNewFile(newFileName.trim(), newFileContent);
            if (success) {
                setShowNewFileDialog(false);
                setNewFileName('');
                setNewFileContent('');
            } else {
                alert('Failed to create file. File may already exist.');
            }
        } catch (error) {
            console.error('Error creating file:', error);
            alert('Failed to create file. Please try again.');
        }
    }, [newFileName, newFileContent]);

    const handleRenameFile = useCallback(async () => {
        try {
            if (!newFileName.trim()) {
                alert('Please enter a filename');
                return;
            }
            
            const success = await stableCallbackRefs.current.renameCurrentFile(newFileName.trim());
            if (success) {
                setShowRenameDialog(false);
                setNewFileName('');
            } else {
                alert('Failed to rename file. File may already exist.');
            }
        } catch (error) {
            console.error('Error renaming file:', error);
            alert('Failed to rename file. Please try again.');
        }
    }, [newFileName]);

    const handleDeleteFile = useCallback(async () => {
        try {
            const success = await stableCallbackRefs.current.deleteCurrentFile();
            if (success) {
                setShowDeleteConfirm(false);
            } else {
                alert('Failed to delete file.');
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            alert('Failed to delete file. Please try again.');
        }
    }, []);

    // UI values
    const lines = useMemo(() => {
        try {
            return fileContent ? fileContent.split('\n').length : 0;
        } catch (e) {
            console.error('Error calculating lines:', e);
            return 0;
        }
    }, [fileContent]);
    
    const buttonSize = useMemo(() => ({
        width: capabilities.isMobile ? '36px' : '32px',
        height: capabilities.isMobile ? '36px' : '32px',
        fontSize: capabilities.isMobile ? '0.85rem' : '0.9rem'
    }), []);

    // Loading state check
    if (!ui || !ui.sidePane || typeof ui.sidePane !== 'object') {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '50%',
                height: mobileViewportHeight,
                background: 'rgb(10, 10, 10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '1rem',
                zIndex: 1001
            }}>
                Loading Side Pane...
            </div>
        );
    }

    // Streaming status indicator
    const getStreamingStatusInfo = () => {
        if (!isStreamingToActiveFile || !streamingSource) return null;
        
        const sourceNames = {
            'project_generation': 'Project Generation',
            'update_streaming': 'Code Update',
            'file_application': 'File Application'
        };
        
        return {
            name: sourceNames[streamingSource] || streamingSource,
            color: streamingSource === 'project_generation' ? '#10b981' : 
                  streamingSource === 'update_streaming' ? '#f59e0b' : '#3b82f6'
        };
    };

    const streamingStatus = getStreamingStatusInfo();

    return (
        <>
            {ui.sidePane.isOpen && capabilities.isMobile && (
                <div
                    onClick={handleClose}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.85)',
                        zIndex: 4999,
                        backdropFilter: 'blur(12px)'
                    }}
                />
            )}

            <div className={`side-pane ${ui.sidePane.isOpen ? 'open' : ''}`} style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: capabilities.isMobile ? '100vw' : '50%',
                height: mobileViewportHeight,
                background: 'rgb(10, 10, 10)',
                borderLeft: capabilities.isMobile ? 'none' : '1px solid var(--border-color)',
                transform: ui.sidePane.isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s var(--smooth-easing)',
                zIndex: capabilities.isMobile ? 5000 : 1001,
                display: 'flex',
                flexDirection: 'column',
                isolation: 'isolate',
                // Mobile-specific overflow handling
                overflowY: capabilities.isMobile ? 'hidden' : 'auto',
                WebkitOverflowScrolling: 'touch'
            }}>
                {/* Header with enhanced mobile safe area handling */}
                <div className="side-pane-header" style={{
                    padding: capabilities.isMobile ? '1rem 1rem 0.75rem' : '1.5rem 2rem',
                    borderBottom: '1px solid var(--border-color)',
                    background: capabilities.isMobile 
                        ? 'rgb(17, 17, 17)'
                        : 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    // Enhanced safe area handling for mobile
                    paddingTop: capabilities.isMobile 
                        ? 'max(1rem, calc(1rem + env(safe-area-inset-top)))' 
                        : '1.5rem',
                    minHeight: capabilities.isMobile ? '70px' : '60px',
                    gap: '0.5rem'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: capabilities.isMobile ? '0.5rem' : '0.5rem',
                        flex: 1,
                        minWidth: 0
                    }}>
                        {currentFile && (
                            <>
                                <span style={{ 
                                    fontSize: capabilities.isMobile ? '1.1rem' : '1rem',
                                    flexShrink: 0 
                                }}>
                                    {currentFile.icon}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: capabilities.isMobile ? '0.95rem' : '0.9rem',
                                        fontWeight: 700,
                                        color: '#ffffff',
                                        marginBottom: capabilities.isMobile ? '0.2rem' : '0.1rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        {currentFile.displayName}
                                        {isDirty && contentUpdateSource === 'user' && (
                                            <span style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                background: '#f59e0b',
                                                flexShrink: 0
                                            }} title="Unsaved changes" />
                                        )}
                                        {streamingStatus && (
                                            <span style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: streamingStatus.color,
                                                flexShrink: 0,
                                                animation: 'pulse 1.5s ease-in-out infinite'
                                            }} title={`Streaming from ${streamingStatus.name}`} />
                                        )}
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        flexWrap: 'wrap'
                                    }}>
                                        <div style={{
                                            fontSize: capabilities.isMobile ? '0.75rem' : '0.75rem',
                                            color: 'var(--text-gray)',
                                            background: 'rgba(255,255,255,0.1)',
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '4px',
                                            fontWeight: 500
                                        }}>
                                            {language.toUpperCase()}
                                        </div>
                                        {streamingStatus && (
                                            <div style={{
                                                fontSize: capabilities.isMobile ? '0.7rem' : '0.7rem',
                                                color: streamingStatus.color,
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.3px',
                                                background: `${streamingStatus.color}20`,
                                                padding: '0.2rem 0.4rem',
                                                borderRadius: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                            }}>
                                                <span style={{ animation: 'spin 2s linear infinite' }}>🌊</span>
                                                STREAMING
                                            </div>
                                        )}
                                        <div style={{
                                            fontSize: capabilities.isMobile ? '0.7rem' : '0.7rem',
                                            color: isEditable ? '#f59e0b' : 
                                                  streamingStatus ? streamingStatus.color : 'var(--accent-green)',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.3px',
                                            background: isEditable ? 'rgba(245, 158, 11, 0.15)' : 
                                                       streamingStatus ? `${streamingStatus.color}15` : 'rgba(16, 185, 129, 0.15)',
                                            padding: '0.2rem 0.4rem',
                                            borderRadius: '4px'
                                        }}>
                                            {pendingSave ? 'SAVING...' : 
                                             isEditable ? 'EDIT MODE' :
                                             streamingStatus ? `${streamingStatus.name.toUpperCase()} ACTIVE` :
                                             currentFile?.isComplete ? 'READ ONLY' : 'STREAMING'}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    
                    {/* CRUD Controls */}
                    <div style={{ 
                        display: 'flex', 
                        gap: capabilities.isMobile ? '0.4rem' : '0.5rem',
                        alignItems: 'center',
                        flexShrink: 0
                    }}>
                        <button
                            onClick={() => setShowNewFileDialog(true)}
                            style={{
                                ...buttonSize,
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: capabilities.isMobile ? '8px' : '8px',
                                color: 'var(--accent-green)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease',
                                touchAction: 'manipulation'
                            }}
                            title="New File"
                        >
                            ➕
                        </button>

                        {activeFileName && (
                            <>
                                <button
                                    onClick={handleEditButtonClick}
                                    disabled={pendingSave}
                                    style={{
                                        ...buttonSize,
                                        background: isEditable 
                                            ? (isDirty && contentUpdateSource === 'user' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)')
                                            : 'rgba(255, 255, 255, 0.1)',
                                        border: isEditable 
                                            ? (isDirty && contentUpdateSource === 'user' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)')
                                            : '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: capabilities.isMobile ? '8px' : '8px',
                                        color: isEditable 
                                            ? (isDirty && contentUpdateSource === 'user' ? '#f59e0b' : 'var(--accent-green)')
                                            : 'var(--text-gray)',
                                        cursor: pendingSave ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: pendingSave ? 0.6 : 1,
                                        transition: 'all 0.2s ease',
                                        touchAction: 'manipulation'
                                    }}
                                    title={isEditable 
                                        ? (isDirty && contentUpdateSource === 'user' ? 'Save (Ctrl+S)' : 'Exit Edit Mode')
                                        : 'Edit File'}
                                >
                                    {pendingSave ? '⏳' : 
                                     isEditable ? (isDirty && contentUpdateSource === 'user' ? '💾' : '👁️') : '✏️'}
                                </button>

                                <button
                                    onClick={() => {
                                        setNewFileName(activeFileName);
                                        setShowRenameDialog(true);
                                    }}
                                    style={{
                                        ...buttonSize,
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: capabilities.isMobile ? '8px' : '8px',
                                        color: 'var(--text-gray)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s ease',
                                        touchAction: 'manipulation'
                                    }}
                                    title="Rename File"
                                >
                                    🏷️
                                </button>

                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    style={{
                                        ...buttonSize,
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: capabilities.isMobile ? '8px' : '8px',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s ease',
                                        touchAction: 'manipulation'
                                    }}
                                    title="Delete File"
                                >
                                    🗑️
                                </button>
                            </>
                        )}

                        <button
                            className="side-pane-close"
                            onClick={handleClose}
                            style={{
                                width: capabilities.isMobile ? '40px' : '36px',
                                height: capabilities.isMobile ? '40px' : '36px',
                                background: capabilities.isMobile 
                                    ? 'rgba(255, 107, 53, 0.15)'
                                    : 'rgba(255, 255, 255, 0.1)',
                                border: capabilities.isMobile 
                                    ? '1px solid rgba(255, 107, 53, 0.3)'
                                    : '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: capabilities.isMobile ? '8px' : '8px',
                                color: capabilities.isMobile ? 'var(--accent-orange)' : 'var(--text-gray)',
                                cursor: 'pointer',
                                transition: 'all 0.3s var(--smooth-easing)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: capabilities.isMobile ? '1.1rem' : '1rem',
                                fontWeight: capabilities.isMobile ? '600' : '400',
                                flexShrink: 0,
                                boxShadow: capabilities.isMobile ? '0 2px 8px rgba(255, 107, 53, 0.2)' : 'none',
                                marginLeft: '0.25rem',
                                touchAction: 'manipulation'
                            }}
                        >
                            {capabilities.isMobile ? '✕' : '⨯'}
                        </button>
                    </div>
                </div>
                
                {/* File content with Mobile-Optimized Monaco Editor + Coordinated Loading */}
                <div className="side-pane-content" style={{
                    flex: 1,
                    overflow: 'hidden',
                    background: '#1e1e1e',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    touchAction: 'manipulation',
                    // Mobile-specific height handling
                    minHeight: 0,
                    ...(capabilities.isMobile && {
                        height: `calc(${mobileViewportHeight} - 70px - env(safe-area-inset-top) - env(safe-area-inset-bottom))`,
                        maxHeight: `calc(${mobileViewportHeight} - 70px - env(safe-area-inset-top) - env(safe-area-inset-bottom))`
                    })
                }}>
                    {activeFileName && fileContent !== null ? (
                        <>
                            <div style={{
                                background: '#2d2d30',
                                borderBottom: '1px solid #3e3e42',
                                display: 'flex',
                                alignItems: 'center',
                                minHeight: capabilities.isMobile ? '36px' : '35px',
                                padding: capabilities.isMobile ? '0 6px' : '0',
                                flexShrink: 0
                            }}>
                                <div style={{
                                    padding: capabilities.isMobile ? '6px 12px' : '6px 16px',
                                    background: '#1e1e1e',
                                    borderTop: isEditable ? '2px solid #f59e0b' : 
                                              streamingStatus ? `2px solid ${streamingStatus.color}` : '2px solid #007acc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: capabilities.isMobile ? '13px' : '13px',
                                    color: '#cccccc',
                                    borderRadius: capabilities.isMobile ? '6px 6px 0 0' : '0'
                                }}>
                                    {currentFile && (
                                        <>
                                            <span style={{ color: '#cccccc', fontSize: capabilities.isMobile ? '0.9rem' : '1rem' }}>
                                                {currentFile.icon}
                                            </span>
                                            {activeFileName}
                                            {isDirty && contentUpdateSource === 'user' && (
                                                <div style={{
                                                    width: capabilities.isMobile ? '6px' : '6px',
                                                    height: capabilities.isMobile ? '6px' : '6px',
                                                    borderRadius: '50%',
                                                    background: '#f9c74f'
                                                }} />
                                            )}
                                            {streamingStatus && (
                                                <div style={{
                                                    width: capabilities.isMobile ? '8px' : '8px',
                                                    height: capabilities.isMobile ? '8px' : '8px',
                                                    borderRadius: '50%',
                                                    background: streamingStatus.color,
                                                    animation: 'pulse 1s ease-in-out infinite'
                                                }} />
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            {/* 🚀 COORDINATED MONACO CONTAINER with Beautiful Loading Overlay */}
                            <div style={{
                                flex: 1,
                                overflow: 'hidden',
                                background: '#1e1e1e',
                                position: 'relative',
                                touchAction: 'pan-y pinch-zoom',
                                WebkitOverflowScrolling: 'touch',
                                display: 'block',
                                ...(capabilities.isMobile && {
                                    minHeight: '200px',
                                    maxHeight: '100%'
                                })
                            }}>
                                {/* Monaco Container */}
                                <div 
                                    ref={containerRef}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        overflow: 'hidden',
                                        background: '#1e1e1e',
                                        touchAction: 'pan-y pinch-zoom',
                                        WebkitOverflowScrolling: 'touch',
                                        display: 'block',
                                        position: 'relative'
                                    }}
                                />
                                
                                {/* 🎯 BEAUTIFUL LOADING OVERLAY - Shows during coordinated initialization */}
                                <MonacoLoadingOverlay isVisible={coordinatedLoadingState.isInitializing} />
                                
                                {/* Edit Preview Banner - Shows what code was changed */}
                                {ui?.sidePane?.editPreview && ui.sidePane.editPreview.fileName === activeFileName && (
                                    <div style={{
                                        position: 'absolute',
                                        top: capabilities.isMobile ? '80px' : '70px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: capabilities.isMobile ? 'calc(100% - 2rem)' : '600px',
                                        maxWidth: '90vw',
                                        zIndex: 1000,
                                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        backdropFilter: 'blur(10px)',
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                                        maxHeight: '60vh',
                                        overflow: 'auto',
                                        animation: 'slideDown 0.3s ease-out'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: '0.75rem'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}>
                                                <span style={{ fontSize: '1.2rem' }}>✨</span>
                                                <span style={{
                                                    fontSize: capabilities.isMobile ? '0.9rem' : '0.85rem',
                                                    fontWeight: 700,
                                                    color: '#ffffff'
                                                }}>
                                                    Code Updated at Line {ui.sidePane.editPreview.lineNumber}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    useAppStore.setState((state: any) => {
                                                        if (state.ui && state.ui.sidePane) {
                                                            state.ui.sidePane.editPreview = null;
                                                        }
                                                    });
                                                }}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.1)',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '0.25rem 0.5rem',
                                                    color: '#ffffff',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem'
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        
                                        <div style={{
                                            fontSize: capabilities.isMobile ? '0.75rem' : '0.7rem',
                                            color: 'rgba(255, 255, 255, 0.7)',
                                            marginBottom: '0.75rem'
                                        }}>
                                            {ui.sidePane.editPreview.description}
                                        </div>
                                        
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: capabilities.isMobile ? '1fr' : '1fr 1fr',
                                            gap: '0.75rem',
                                            marginBottom: '0.5rem'
                                        }}>
                                            <div>
                                                <div style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    color: '#ef4444',
                                                    marginBottom: '0.25rem'
                                                }}>
                                                    REMOVED:
                                                </div>
                                                <pre style={{
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                                    borderRadius: '6px',
                                                    padding: '0.5rem',
                                                    fontSize: '0.7rem',
                                                    color: '#fca5a5',
                                                    overflow: 'auto',
                                                    maxHeight: '150px',
                                                    margin: 0,
                                                    fontFamily: 'monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}>
                                                    {ui.sidePane.editPreview.oldCode}
                                                </pre>
                                            </div>
                                            
                                            <div>
                                                <div style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    color: '#10b981',
                                                    marginBottom: '0.25rem'
                                                }}>
                                                    ADDED:
                                                </div>
                                                <pre style={{
                                                    background: 'rgba(16, 185, 129, 0.1)',
                                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                                    borderRadius: '6px',
                                                    padding: '0.5rem',
                                                    fontSize: '0.7rem',
                                                    color: '#6ee7b7',
                                                    overflow: 'auto',
                                                    maxHeight: '150px',
                                                    margin: 0,
                                                    fontFamily: 'monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}>
                                                    {ui.sidePane.editPreview.newCode}
                                                </pre>
                                            </div>
                                        </div>
                                        
                                        <style>{`
                                            @keyframes slideDown {
                                                from {
                                                    opacity: 0;
                                                    transform: translateY(-10px);
                                                }
                                                to {
                                                    opacity: 1;
                                                    transform: translateY(0);
                                                }
                                            }
                                        `}</style>
                                    </div>
                                )}
                            </div>
                            
                            {/* Enhanced bottom status bar with mobile safe area */}
                            <div style={{
                                background: isEditable ? '#f59e0b' : 
                                          streamingStatus ? streamingStatus.color : '#007acc',
                                padding: capabilities.isMobile ? '5px 12px' : '4px 12px',
                                fontSize: capabilities.isMobile ? '12px' : '12px',
                                color: '#ffffff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                // Enhanced mobile safe area handling
                                paddingBottom: capabilities.isMobile 
                                    ? 'max(5px, calc(5px + env(safe-area-inset-bottom)))' 
                                    : '4px',
                                flexShrink: 0
                            }}>
                                <span>/{activeFileName}</span>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: capabilities.isMobile ? '12px' : '12px',
                                    flexWrap: 'wrap'
                                }}>
                                    <span>{language.toUpperCase()} • {lines} lines</span>
                                    <div style={{
                                        fontSize: capabilities.isMobile ? '11px' : '11px',
                                        color: '#ffffff',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {coordinatedLoadingState.isInitializing ? 'INITIALIZING...' :
                                         pendingSave ? 'SAVING...' :
                                         isDirty && contentUpdateSource === 'user' ? 'MODIFIED' :
                                         isEditable ? 'EDIT MODE' : 
                                         streamingStatus ? `${streamingStatus.name.toUpperCase()} STREAMING` :
                                         currentFile?.isComplete ? 'READ ONLY' : 'AUTO-SCROLL'}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Keep container in DOM but hidden when no file selected */}
                            <div 
                                ref={containerRef}
                                style={{
                                    flex: 1,
                                    overflow: 'hidden',
                                    background: '#1e1e1e',
                                    touchAction: 'pan-y pinch-zoom',
                                    WebkitOverflowScrolling: 'touch',
                                    display: 'none'
                                }}
                            />
                            
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#cccccc',
                                fontSize: capabilities.isMobile ? '1rem' : '1rem',
                                background: '#1e1e1e'
                            }}>
                                {activeFileName ? 'Loading file content...' : 'No file selected'}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Dialog components with mobile viewport optimization */}
            {showNewFileDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.85)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(12px)',
                    padding: capabilities.isMobile ? '1rem' : '2rem'
                }}>
                    <div style={{
                        background: 'rgb(17, 17, 17)',
                        border: '1px solid var(--border-color)',
                        borderRadius: capabilities.isMobile ? '16px' : '12px',
                        padding: capabilities.isMobile ? '2rem 1.5rem' : '2rem',
                        minWidth: capabilities.isMobile ? '90vw' : '400px',
                        maxWidth: capabilities.isMobile ? '95vw' : '500px',
                        maxHeight: capabilities.isMobile ? '80vh' : 'auto',
                        overflow: 'auto'
                    }}>
                        <h3 style={{ 
                            color: '#ffffff', 
                            marginBottom: '1rem',
                            fontSize: capabilities.isMobile ? '1.3rem' : '1.1rem'
                        }}>Create New File</h3>
                        <input
                            type="text"
                            placeholder="Enter filename (e.g., utils.ts, styles.css)"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: capabilities.isMobile ? '1rem' : '0.75rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: capabilities.isMobile ? '12px' : '8px',
                                color: '#ffffff',
                                marginBottom: '1rem',
                                fontSize: capabilities.isMobile ? '1rem' : '0.9rem',
                                touchAction: 'manipulation'
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFile();
                            }}
                        />
                        <textarea
                            placeholder="Initial content (optional)"
                            value={newFileContent}
                            onChange={(e) => setNewFileContent(e.target.value)}
                            style={{
                                width: '100%',
                                height: capabilities.isMobile ? '120px' : '100px',
                                padding: capabilities.isMobile ? '1rem' : '0.75rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: capabilities.isMobile ? '12px' : '8px',
                                color: '#ffffff',
                                marginBottom: '1rem',
                                fontSize: capabilities.isMobile ? '1rem' : '0.9rem',
                                resize: 'vertical',
                                fontFamily: 'monospace',
                                touchAction: 'manipulation'
                            }}
                        />
                        <div style={{ 
                            display: 'flex', 
                            gap: '1rem', 
                            justifyContent: 'flex-end',
                            flexDirection: capabilities.isMobile ? 'column' : 'row'
                        }}>
                            <button
                                onClick={() => {
                                    setShowNewFileDialog(false);
                                    setNewFileName('');
                                    setNewFileContent('');
                                }}
                                style={{
                                    padding: capabilities.isMobile ? '1rem 2rem' : '0.75rem 1.5rem',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: capabilities.isMobile ? '12px' : '8px',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    fontSize: capabilities.isMobile ? '1rem' : '0.9rem',
                                    touchAction: 'manipulation'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateFile}
                                style={{
                                    padding: capabilities.isMobile ? '1rem 2rem' : '0.75rem 1.5rem',
                                    background: 'var(--accent-green)',
                                    border: 'none',
                                    borderRadius: capabilities.isMobile ? '12px' : '8px',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: capabilities.isMobile ? '1rem' : '0.9rem',
                                    touchAction: 'manipulation'
                                }}
                            >
                                Create File
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showRenameDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.85)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(12px)',
                    padding: capabilities.isMobile ? '1rem' : '2rem'
                }}>
                    <div style={{
                        background: 'rgb(17, 17, 17)',
                        border: '1px solid var(--border-color)',
                        borderRadius: capabilities.isMobile ? '16px' : '12px',
                        padding: capabilities.isMobile ? '2rem 1.5rem' : '2rem',
                        minWidth: capabilities.isMobile ? '90vw' : '400px',
                        maxWidth: capabilities.isMobile ? '95vw' : '500px'
                    }}>
                        <h3 style={{ 
                            color: '#ffffff', 
                            marginBottom: '1rem',
                            fontSize: capabilities.isMobile ? '1.3rem' : '1.1rem'
                        }}>Rename File</h3>
                        <input
                            type="text"
                            placeholder="Enter new filename"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: capabilities.isMobile ? '1rem' : '0.75rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: capabilities.isMobile ? '12px' : '8px',
                                color: '#ffffff',
                                marginBottom: '1rem',
                                fontSize: capabilities.isMobile ? '1rem' : '0.9rem',
                                touchAction: 'manipulation'
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameFile();
                            }}
                        />
                        <div style={{ 
                            display: 'flex', 
                            gap: '1rem', 
                            justifyContent: 'flex-end',
                            flexDirection: capabilities.isMobile ? 'column' : 'row'
                        }}>
                            <button
                                onClick={() => {
                                    setShowRenameDialog(false);
                                    setNewFileName('');
                                }}
                                style={{
                                    padding: capabilities.isMobile ? '1rem 2rem' : '0.75rem 1.5rem',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: capabilities.isMobile ? '12px' : '8px',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    fontSize: capabilities.isMobile ? '1rem' : '0.9rem',
                                    touchAction: 'manipulation'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRenameFile}
                                style={{
                                    padding: capabilities.isMobile ? '1rem 2rem' : '0.75rem 1.5rem',
                                    background: '#f59e0b',
                                    border: 'none',
                                    borderRadius: capabilities.isMobile ? '12px' : '8px',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: capabilities.isMobile ? '1rem' : '0.9rem',
                                    touchAction: 'manipulation'
                                }}
                            >
                                Rename
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.85)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(12px)',
                    padding: capabilities.isMobile ? '1rem' : '2rem'
                }}>
                    <div style={{
                        background: 'rgb(17, 17, 17)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: capabilities.isMobile ? '16px' : '12px',
                        padding: capabilities.isMobile ? '2rem 1.5rem' : '2rem',
                        minWidth: capabilities.isMobile ? '90vw' : '400px',
                        maxWidth: capabilities.isMobile ? '95vw' : '500px'
                    }}>
                        <h3 style={{ 
                            color: '#ef4444', 
                            marginBottom: '1rem',
                            fontSize: capabilities.isMobile ? '1.3rem' : '1.1rem'
                        }}>Delete File</h3>
                        <p style={{ 
                            color: '#ffffff', 
                            marginBottom: '1.5rem',
                            fontSize: capabilities.isMobile ? '1rem' : '0.9rem'
                        }}>
                            Are you sure you want to delete <strong>{activeFileName}</strong>? This action cannot be undone.
                        </p>
                        <div style={{ 
                            display: 'flex', 
                            gap: '1rem', 
                            justifyContent: 'flex-end',
                            flexDirection: capabilities.isMobile ? 'column' : 'row'
                        }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{
                                    padding: capabilities.isMobile ? '1rem 2rem' : '0.75rem 1.5rem',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: capabilities.isMobile ? '12px' : '8px',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    fontSize: capabilities.isMobile ? '1rem' : '0.9rem',
                                    touchAction: 'manipulation'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteFile}
                                style={{
                                    padding: capabilities.isMobile ? '1rem 2rem' : '0.75rem 1.5rem',
                                    background: '#ef4444',
                                    border: 'none',
                                    borderRadius: capabilities.isMobile ? '12px' : '8px',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: capabilities.isMobile ? '1rem' : '0.9rem',
                                    touchAction: 'manipulation'
                                }}
                            >
                                Delete File
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS animations with mobile optimizations */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                /* Mobile-specific optimizations */
                @media (max-width: 768px) {
                    .side-pane {
                        will-change: transform;
                    }
                    
                    .side-pane-content {
                        transform: translateZ(0);
                        backface-visibility: hidden;
                    }
                }
            `}</style>
        </>
    );
};

// 🔥 FIX: Export with memo separately to prevent initialization errors
export const SidePane = React.memo(SidePaneComponent);

export default SidePane;