// Monaco configuration function (extracted from SidePane.tsx)
const configureMonaco = async () => {
  const monaco = await import('monaco-editor');
  
  // 🔥 CRITICAL FIX: Expose Monaco to window.monaco right after import
  if (!window.monaco) {
    (window as any).monaco = monaco;
    console.log('✅ [Monaco] Exposed to window.monaco immediately after import');
  }
  
  // ✅ MonacoEnvironment is now configured globally in index.html <head>
  // Do NOT overwrite it here - just configure Monaco features
  console.log('🎨 [Monaco] Loading with globally configured MonacoEnvironment');

  // Disable only the advanced features that require workers, keep basic syntax highlighting
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2015,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    typeRoots: ["node_modules/@types"]
  });

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2015,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    allowJs: true
  });

  // Disable diagnostics (which require workers) but keep syntax highlighting
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true
  });

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true
  });

  // Disable JSON validation but keep JSON syntax highlighting
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: false,
    enableSchemaRequest: false
  });

  // Configure CSS to not use workers
  monaco.languages.css.cssDefaults.setOptions({
    validate: false,
    lint: {
      compatibleVendorPrefixes: "ignore",
      vendorPrefix: "ignore",
      duplicateProperties: "ignore",
      emptyDeclaration: "ignore",
      importStatement: "ignore",
      boxModel: "ignore",
      universalSelector: "ignore",
      zeroUnits: "ignore",
      fontFaceProperties: "ignore",
      hexColorLength: "ignore",
      argumentsInColorFunction: "ignore",
      unknownProperties: "ignore",
      validProperties: []
    }
  });

  // Configure HTML to not use workers  
  monaco.languages.html.htmlDefaults.setOptions({
    validate: false,
    suggest: false
  });

  // Setup Motoko language support
  setupMotokoSupport(monaco);

  return monaco;
};

const setupMotokoSupport = (monaco: any) => {
  if (monaco.languages.getLanguages().some((lang: any) => lang.id === 'motoko')) return;

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

  console.log('✅ Motoko language support configured');
};

interface NetworkInfo {
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  saveData?: boolean;
  downlink?: number;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInfo;
  mozConnection?: NetworkInfo;
  webkitConnection?: NetworkInfo;
}

class MonacoPreloadService {
  private static instance: MonacoPreloadService;
  private preloadPromise: Promise<any> | null = null;
  private preloadedMonaco: any = null;
  private isPreloading = false;
  private preloadStartTime = 0;
  private preloadCancelled = false;
  private debugMode = false;

  private constructor() {
    this.debugMode = localStorage.getItem('monaco-preload-debug') === 'true';
  }

  static getInstance(): MonacoPreloadService {
    if (!MonacoPreloadService.instance) {
      MonacoPreloadService.instance = new MonacoPreloadService();
    }
    return MonacoPreloadService.instance;
  }

  private log(message: string, ...args: any[]) {
    if (this.debugMode) {
      console.log(`[MonacoPreload] ${message}`, ...args);
    }
  }

  private shouldPreload(): boolean {
    // Check if user is on a slow connection or has data saver enabled
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    if (connection) {
      // Respect data saver mode
      if (connection.saveData) {
        this.log('❌ Preload cancelled - user has data saver enabled');
        return false;
      }
      
      // Only preload on fast connections
      if (connection.effectiveType && ['slow-2g', '2g'].includes(connection.effectiveType)) {
        this.log('❌ Preload cancelled - slow connection detected', connection.effectiveType);
        return false;
      }
    }

    // Check if user agent suggests mobile device with limited resources
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      // Be more conservative on mobile
      const screenWidth = window.screen.width;
      if (screenWidth < 768) {
        this.log('⚠️ Mobile device detected - using conservative preload strategy');
        // Still allow preload but with lower priority
      }
    }

    // Check available memory (if supported)
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      if (memInfo.usedJSHeapSize > memInfo.totalJSHeapSize * 0.8) {
        this.log('❌ Preload cancelled - high memory usage detected');
        return false;
      }
    }

    return true;
  }

  private async preloadInBackground(): Promise<any> {
    if (this.preloadCancelled) {
      throw new Error('Preload was cancelled');
    }

    this.log('🚀 Starting Monaco background preload...');
    this.preloadStartTime = performance.now();
    
    try {
      // Use requestIdleCallback if available for better performance
      if ('requestIdleCallback' in window) {
        await new Promise(resolve => {
          (window as any).requestIdleCallback(resolve, { timeout: 2000 });
        });
      }

      if (this.preloadCancelled) {
        throw new Error('Preload was cancelled');
      }

      // Start the actual Monaco loading
      const monaco = await configureMonaco();
      
      // 🔥 CRITICAL FIX: Expose Monaco to window.monaco immediately after loading
      if (!window.monaco && monaco) {
        (window as any).monaco = monaco;
        this.log('✅ Monaco exposed to window.monaco during preload');
      }
      
      if (this.preloadCancelled) {
        this.log('⚠️ Preload completed but was cancelled - discarding result');
        throw new Error('Preload was cancelled');
      }

      const loadTime = performance.now() - this.preloadStartTime;
      this.log(`✅ Monaco preloaded successfully in ${loadTime.toFixed(2)}ms`);
      
      this.preloadedMonaco = monaco;
      return monaco;
      
    } catch (error) {
      const loadTime = performance.now() - this.preloadStartTime;
      this.log(`❌ Monaco preload failed after ${loadTime.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  async startBackgroundPreload(): Promise<void> {
    // Don't start multiple preload attempts
    if (this.isPreloading || this.preloadedMonaco) {
      this.log('⚠️ Preload already in progress or completed');
      return;
    }

    // Check if we should preload based on network conditions
    if (!this.shouldPreload()) {
      return;
    }

    this.isPreloading = true;
    this.preloadCancelled = false;
    
    this.log('🎯 Initiating Monaco background preload...');

    try {
      this.preloadPromise = this.preloadInBackground();
      await this.preloadPromise;
      this.log('🎉 Background preload completed successfully');
    } catch (error) {
      this.log('💥 Background preload failed:', error);
      // Reset state so SidePane can fall back to lazy loading
      this.preloadPromise = null;
      this.preloadedMonaco = null;
    } finally {
      this.isPreloading = false;
    }
  }

  async getPreloadedMonaco(): Promise<any | null> {
    // If already preloaded, return immediately
    if (this.preloadedMonaco) {
      this.log('⚡ Returning cached preloaded Monaco instantly');
      return this.preloadedMonaco;
    }

    // If preload is in progress, wait for it
    if (this.preloadPromise) {
      this.log('⏳ Waiting for in-progress preload...');
      try {
        const monaco = await this.preloadPromise;
        return monaco;
      } catch (error) {
        this.log('❌ Failed to wait for preload:', error);
        return null;
      }
    }

    // No preload available
    this.log('❌ No preloaded Monaco available');
    return null;
  }

  isPreloadComplete(): boolean {
    return this.preloadedMonaco !== null;
  }

  isPreloadInProgress(): boolean {
    return this.isPreloading;
  }

  getPreloadStatus(): {
    isComplete: boolean;
    isInProgress: boolean;
    hasStarted: boolean;
    loadTimeMs?: number;
  } {
    return {
      isComplete: this.isPreloadComplete(),
      isInProgress: this.isPreloadInProgress(),
      hasStarted: this.preloadPromise !== null || this.preloadedMonaco !== null,
      loadTimeMs: this.preloadStartTime > 0 && this.preloadedMonaco !== null ? 
        performance.now() - this.preloadStartTime : undefined
    };
  }

  cancelPreload(): void {
    this.log('🛑 Cancelling Monaco preload...');
    this.preloadCancelled = true;
    this.isPreloading = false;
    // Don't reset preloadedMonaco if it's already loaded
  }

  // Reset service state (useful for testing or cleanup)
  reset(): void {
    this.log('🧹 Resetting Monaco preload service');
    this.preloadPromise = null;
    this.preloadedMonaco = null;
    this.isPreloading = false;
    this.preloadStartTime = 0;
    this.preloadCancelled = false;
  }
}

// Export singleton instance
export const monacoPreloadService = MonacoPreloadService.getInstance();