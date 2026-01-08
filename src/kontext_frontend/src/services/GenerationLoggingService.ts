import { Identity } from '@dfinity/agent';
import { HttpAgent } from '@dfinity/agent';
import { AssetManager } from '@dfinity/assets';
import { Principal } from '@dfinity/principal';

// ==================== TYPES AND INTERFACES ====================

export interface UserPromptData {
  sessionId: string;
  timestamp: number;
  userInput: string;
  projectId: string;
  projectName: string;
  requestContext: {
    hasExistingFiles: boolean;
    fileCount: number;
    requestType: string;
  };
}

export interface TemplateRoutingData {
  sessionId: string;
  timestamp: number;
  routingStartTime: number;
  routingEndTime: number;
  selectedTemplate: string | null;
  confidence: number;
  reasoning: string;
  alternatives: string[];
  clarificationQuestions?: string[];
  fallbackUsed: boolean;
  fallbackReason?: string;
}

export interface GenerationPhaseData {
  sessionId: string;
  phase: 'backend' | 'frontend';
  timestamp: number;
  startTime: number;
  endTime: number;
  inputPrompt?: string; // Keep for backward compatibility with backend
  inputPromptParts?: {
    criticalInstructions: { content: string; size: number };
    rules: { content: string; size: number };
    userRequirements: { content: string; size: number };
    projectSpec: { content: string; size: number };
    backendContext: { content: string; size: number };
    mainInstructions: { content: string; size: number };
    templateContext: { content: string; size: number };
    templateCode: { content: string; size: number };
    architectureExplanation: { content: string; size: number };
    backendIntegration: { content: string; size: number };
    customization: { content: string; size: number };
  };
  fullResponse: string;
  templateUsed: string;
  enhancedInstructions: string;
  responseLength: number;
  streamingEvents: number;
  success: boolean;
  error?: string;
}

export interface FileExtractionData {
  sessionId: string;
  timestamp: number;
  totalFiles: number;
  backendFiles: string[];
  frontendFiles: string[];
  extractionSuccess: boolean;
  parsingErrors: string[];
  filesByType: {
    motoko: string[];
    typescript: string[];
    css: string[];
    json: string[];
    other: string[];
  };
}

export interface GenerationSummaryData {
  sessionId: string;
  timestamp: number;
  startTime: number;
  endTime: number;
  totalDuration: number;
  success: boolean;
  error?: string;
  
  userPrompt: string;
  projectContext: {
    projectId: string;
    projectName: string;
    hasExistingFiles: boolean;
  };
  
  template: {
    name: string;
    confidence: number;
    routingTime: number;
    fetchingTime: number;
    fallbackUsed: boolean;
    routingBypassed?: boolean;
  };
  
  performance: {
    totalTime: number;
    routingTime: number;
    fetchingTime: number;
    backendTime: number;
    frontendTime: number;
    extractionTime: number;
  };
  
  results: {
    totalFiles: number;
    backendFiles: number;
    frontendFiles: number;
    candidGenerated: boolean;
    platformFilesIntegrated: boolean;
  };
  
  quality: {
    templateAdherence: string;
    codeCompleteness: number;
    extractionAccuracy: number;
    userSatisfactionPredicted: string;
  };
}

export interface ProcessingStep {
  step: string;
  input: string;
  output: string;
  success: boolean;
}

export interface ExtractionAttempt {
  pattern: string;
  matches: string[];
  success: boolean;
}

// ==================== DEBUG CONFIGURATION ====================

export interface DebugConfiguration {
  enabled: boolean;
  silentMode: boolean;
  maxRetries: number;
  timeoutMs: number;
  skipOnError: boolean;
}

export const DEFAULT_DEBUG_CONFIG: DebugConfiguration = {
  enabled: false, // DISABLED BY DEFAULT - Use Admin Interface toggle to enable
  silentMode: false, // Set to false to see console output when debugging
  maxRetries: 2,
  timeoutMs: 10000,
  skipOnError: true // DON'T FAIL GENERATION IF DEBUG FAILS
};

// Global debug configuration
let globalDebugConfig: DebugConfiguration = { ...DEFAULT_DEBUG_CONFIG };

export function setDebugConfiguration(config: Partial<DebugConfiguration>): void {
  globalDebugConfig = { ...globalDebugConfig, ...config };
  console.log(`🐛 [DebugConfig] Configuration updated:`, globalDebugConfig);
}

export function getDebugConfiguration(): DebugConfiguration {
  return { ...globalDebugConfig };
}

export function isDebugEnabled(): boolean {
  return globalDebugConfig.enabled;
}

export function enableDebug(): void {
  setDebugConfiguration({ enabled: true });
}

export function disableDebug(): void {
  setDebugConfiguration({ enabled: false });
}

// ==================== DEBUG CONTEXT CLASS ====================

export class DebugContext {
  public readonly sessionId: string;
  public readonly identity: Identity;
  public readonly isDebugEnabled: boolean;
  private readonly assetCanisterId: string;
  private readonly projectPath: string;
  private assetManager: AssetManager | null = null;
  
  // Data containers
  private userPromptData: UserPromptData | null = null;
  private templateRoutingData: TemplateRoutingData | null = null;
  private backendGenerationData: GenerationPhaseData | null = null;
  private frontendGenerationData: GenerationPhaseData | null = null;
  private fileExtractionData: FileExtractionData | null = null;
  private generationSummaryData: GenerationSummaryData | null = null;
  private processingSteps: ProcessingStep[] = [];
  private extractionAttempts: ExtractionAttempt[] = [];
  private generatedFiles: Map<string, string> = new Map();

  constructor(sessionId: string, identity: Identity, assetCanisterId?: string, projectPath?: string) {
    this.sessionId = sessionId;
    this.identity = identity;
    this.isDebugEnabled = globalDebugConfig.enabled;
    
    // Use provided values or get from service instance
    const service = GenerationLoggingService.getInstance();
    this.assetCanisterId = assetCanisterId || service.getAssetCanisterId();
    this.projectPath = projectPath || service.getProjectPath();
    
    if (!this.isDebugEnabled) {
      console.log(`🐛 [DebugContext] DEBUG DISABLED - Session ${sessionId} will collect no data`);
    }
  }

  private async ensureAssetManager(): Promise<AssetManager> {
    if (!globalDebugConfig.enabled) {
      throw new Error('Debug is disabled - AssetManager not available');
    }

    if (!this.assetManager) {
      try {
        const agent = new HttpAgent({
          identity: this.identity,
          host: 'https://icp0.io'
        });

        this.assetManager = new AssetManager({
          canisterId: Principal.fromText(this.assetCanisterId),
          agent: agent,
        });

        if (!globalDebugConfig.silentMode) {
          console.log(`✅ [DebugContext] AssetManager created for session: ${this.sessionId}`);
        }
      } catch (error) {
        if (!globalDebugConfig.silentMode) {
          console.error(`❌ [DebugContext] Failed to create AssetManager:`, error);
        }
        throw error;
      }
    }
    return this.assetManager;
  }

  // Data capture methods - only work if debug is enabled
  public captureUserPrompt(data: UserPromptData): void {
    if (!this.isDebugEnabled) return;
    this.userPromptData = data;
  }

  public captureTemplateRouting(data: TemplateRoutingData): void {
    if (!this.isDebugEnabled) return;
    this.templateRoutingData = data;
  }

  public captureGenerationPhase(data: GenerationPhaseData): void {
    if (!this.isDebugEnabled) return;
    if (data.phase === 'backend') {
      this.backendGenerationData = data;
    } else {
      this.frontendGenerationData = data;
    }
  }

  public captureFileExtraction(data: FileExtractionData): void {
    if (!this.isDebugEnabled) return;
    this.fileExtractionData = data;
  }

  public captureGenerationSummary(data: GenerationSummaryData): void {
    if (!this.isDebugEnabled) return;
    this.generationSummaryData = data;
  }

  public captureProcessingStep(step: ProcessingStep): void {
    if (!this.isDebugEnabled) return;
    this.processingSteps.push(step);
  }

  public captureExtractionAttempt(attempt: ExtractionAttempt): void {
    if (!this.isDebugEnabled) return;
    this.extractionAttempts.push(attempt);
  }

  public captureGeneratedFile(fileName: string, content: string): void {
    if (!this.isDebugEnabled) return;
    this.generatedFiles.set(fileName, content);
  }

  // COMPLETELY ISOLATED PERSISTENCE - NO EXTERNAL EVENTS OR CALLBACKS
  public async persistAllDataSilently(): Promise<void> {
    if (!this.isDebugEnabled) {
      return; // Silent no-op if debug disabled
    }

    // CRITICAL: Wrap everything in isolation to prevent any event propagation
    return new Promise<void>((resolve, reject) => {
      // Use setTimeout to completely isolate from current execution context
      setTimeout(async () => {
        try {
          await this.performIsolatedPersistence();
          resolve();
        } catch (error) {
          if (globalDebugConfig.skipOnError) {
            if (!globalDebugConfig.silentMode) {
              console.warn(`⚠️ [DebugContext] Persistence failed but skipping error:`, error);
            }
            resolve(); // Don't propagate errors if configured to skip
          } else {
            reject(error);
          }
        }
      }, 0); // Completely async from current execution context
    });
  }

  private async performIsolatedPersistence(): Promise<void> {
    const startTime = Date.now();
    
    if (!globalDebugConfig.silentMode) {
      console.log(`💾 [DebugContext] Starting ISOLATED persistence for session: ${this.sessionId}`);
    }

    try {
      const assetManager = await this.ensureAssetManager();
      const baseDir = `${this.projectPath}/debug-logs/${this.sessionId}`;
      let uploadedFiles = 0;
      let failedFiles = 0;

      const filesToUpload = [
        {
          name: 'user-prompt.json',
          data: this.userPromptData,
          condition: !!this.userPromptData
        },
        {
          name: 'template-routing.json',
          data: this.templateRoutingData,
          condition: !!this.templateRoutingData
        },
        {
          name: 'generation-backend.json',
          data: this.backendGenerationData,
          condition: !!this.backendGenerationData
        },
        {
          name: 'generation-frontend.json',
          data: this.frontendGenerationData,
          condition: !!this.frontendGenerationData
        },
        {
          name: 'file-extraction.json',
          data: this.fileExtractionData,
          condition: !!this.fileExtractionData
        },
        {
          name: 'processing-steps.json',
          data: this.processingSteps,
          condition: this.processingSteps.length > 0
        },
        {
          name: 'generation-summary.json',
          data: this.generationSummaryData,
          condition: !!this.generationSummaryData
        }
      ];

      // Upload debug files with timeout protection
      for (const file of filesToUpload) {
        if (file.condition) {
          try {
            const uploadPromise = this.uploadFileWithTimeout(assetManager, baseDir, file.name, file.data);
            await uploadPromise;
            uploadedFiles++;
          } catch (fileError) {
            failedFiles++;
            if (!globalDebugConfig.silentMode) {
              console.warn(`⚠️ [DebugContext] File ${file.name} upload failed:`, fileError);
            }
          }
        }
      }

      // Upload generated files if any exist
      if (this.generatedFiles.size > 0) {
        const generatedFilesDir = `${baseDir}/generated-files`;
        let generatedFileCount = 0;
        
        for (const [fileName, content] of this.generatedFiles.entries()) {
          try {
            const uploadPromise = this.uploadFileWithTimeout(
              assetManager, 
              generatedFilesDir, 
              fileName, 
              content,
              this.getContentType(fileName)
            );
            await uploadPromise;
            generatedFileCount++;
          } catch (fileError) {
            if (!globalDebugConfig.silentMode) {
              console.warn(`⚠️ [DebugContext] Generated file ${fileName} upload failed:`, fileError);
            }
          }
        }
      }

      const totalTime = Date.now() - startTime;
      
      if (!globalDebugConfig.silentMode) {
        const baseUrl = `https://${this.assetCanisterId}.raw.icp0.io`;
        console.log(`✅ [DebugContext] ISOLATED persistence completed in ${totalTime}ms`);
        console.log(`📊 [DebugContext] Uploaded: ${uploadedFiles}, Failed: ${failedFiles}`);
        console.log(`🔗 [DebugContext] Debug URL: ${baseUrl}/${baseDir}/`);
      }

    } catch (error) {
      if (!globalDebugConfig.silentMode) {
        console.error(`❌ [DebugContext] ISOLATED persistence failed:`, error);
      }
      throw error;
    }
  }

  private async uploadFileWithTimeout(
    assetManager: AssetManager, 
    baseDir: string, 
    fileName: string, 
    data: any, 
    contentType: string = 'application/json'
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Upload timeout for ${fileName}`));
      }, globalDebugConfig.timeoutMs);

      try {
        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        const filePath = `${baseDir}/${fileName}`;
        
        await assetManager.store(
          new TextEncoder().encode(content),
          {
            fileName: filePath,
            contentType: contentType
          }
        );
        
        clearTimeout(timeoutId);
        resolve();
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json': return 'application/json';
      case 'js': return 'application/javascript';
      case 'ts': return 'text/typescript';
      case 'tsx': return 'text/typescript';
      case 'css': return 'text/css';
      case 'html': return 'text/html';
      case 'md': return 'text/markdown';
      case 'mo': return 'text/plain';
      default: return 'text/plain';
    }
  }

  public getDebugUrls(): {
    baseUrl: string;
    userPrompt: string;
    templateRouting: string;
    backendGeneration: string;
    frontendGeneration: string;
    fileExtraction: string;
    processingSteps: string;
    generationSummary: string;
  } | null {
    if (!this.isDebugEnabled) return null;

    const baseUrl = `https://${this.assetCanisterId}.raw.icp0.io`;
    const baseDir = `${this.projectPath}/debug-logs/${this.sessionId}`;
    
    return {
      baseUrl: `${baseUrl}/${baseDir}/`,
      userPrompt: `${baseUrl}/${baseDir}/user-prompt.json`,
      templateRouting: `${baseUrl}/${baseDir}/template-routing.json`,
      backendGeneration: `${baseUrl}/${baseDir}/generation-backend.json`,
      frontendGeneration: `${baseUrl}/${baseDir}/generation-frontend.json`,
      fileExtraction: `${baseUrl}/${baseDir}/file-extraction.json`,
      processingSteps: `${baseUrl}/${baseDir}/processing-steps.json`,
      generationSummary: `${baseUrl}/${baseDir}/generation-summary.json`
    };
  }
}

// ==================== MAIN LOGGING SERVICE ====================

export class GenerationLoggingService {
  private static instance: GenerationLoggingService;
  private activeSessions: Map<string, DebugContext> = new Map();
  private assetCanisterId: string;
  private projectPath: string;
  private static readonly STORAGE_KEY_CANISTER = 'debug_asset_canister_id';
  private static readonly STORAGE_KEY_PATH = 'debug_project_path';
  private static readonly DEFAULT_CANISTER_ID = 'pwi5a-sqaaa-aaaaa-qcfgq-cai';
  private static readonly DEFAULT_PROJECT_PATH = 'projects/project-mfvtjz8x-hc7uz';

  private constructor() {
    // Load from localStorage or use defaults
    this.assetCanisterId = this.loadFromStorage(GenerationLoggingService.STORAGE_KEY_CANISTER, GenerationLoggingService.DEFAULT_CANISTER_ID);
    this.projectPath = this.loadFromStorage(GenerationLoggingService.STORAGE_KEY_PATH, GenerationLoggingService.DEFAULT_PROJECT_PATH);
    console.log(`🐛 [GenerationLoggingService] Service initialized - Debug enabled: ${globalDebugConfig.enabled}`);
    console.log(`🐛 [GenerationLoggingService] Asset Canister: ${this.assetCanisterId}`);
    console.log(`🐛 [GenerationLoggingService] Project Path: ${this.projectPath}`);
  }

  private loadFromStorage(key: string, defaultValue: string): string {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(key);
      return stored || defaultValue;
    }
    return defaultValue;
  }

  private saveToStorage(key: string, value: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  public static getInstance(): GenerationLoggingService {
    if (!GenerationLoggingService.instance) {
      GenerationLoggingService.instance = new GenerationLoggingService();
    }
    return GenerationLoggingService.instance;
  }

  public async initializeDebugSession(sessionId: string, identity: Identity): Promise<DebugContext> {
    if (!globalDebugConfig.enabled) {
      // Return a no-op debug context
      const noOpContext = new DebugContext(sessionId, identity);
      console.log(`🐛 [GenerationLoggingService] DEBUG DISABLED - Created no-op context for ${sessionId}`);
      return noOpContext;
    }

    try {
      if (!identity) {
        throw new Error('Identity is required for debug session initialization');
      }
      
      if (!sessionId || sessionId.trim().length === 0) {
        throw new Error('Valid session ID is required for debug session initialization');
      }
      
      if (this.activeSessions.has(sessionId)) {
        console.log(`⚠️ [GenerationLoggingService] Session ${sessionId} already exists, returning existing context`);
        return this.activeSessions.get(sessionId)!;
      }
      
      const debugContext = new DebugContext(sessionId, identity, this.assetCanisterId, this.projectPath);
      this.activeSessions.set(sessionId, debugContext);
      
      if (!globalDebugConfig.silentMode) {
        console.log(`✅ [GenerationLoggingService] Debug session ${sessionId} initialized`);
      }
      
      return debugContext;
    } catch (error) {
      console.error(`❌ [GenerationLoggingService] Failed to initialize debug session ${sessionId}:`, error);
      throw error;
    }
  }

  public getDebugContext(sessionId: string): DebugContext | null {
    return this.activeSessions.get(sessionId) || null;
  }

  public getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  public cleanupDebugSession(sessionId: string): void {
    const wasActive = this.activeSessions.has(sessionId);
    this.activeSessions.delete(sessionId);
    
    if (!globalDebugConfig.silentMode && wasActive) {
      console.log(`🧹 [GenerationLoggingService] Cleaned up session: ${sessionId}`);
    }
  }

  public getSessionStats(): {
    activeCount: number;
    activeSessions: string[];
    assetCanisterId: string;
    projectPath: string;
    debugEnabled: boolean;
  } {
    return {
      activeCount: this.activeSessions.size,
      activeSessions: Array.from(this.activeSessions.keys()),
      assetCanisterId: this.assetCanisterId,
      projectPath: this.projectPath,
      debugEnabled: globalDebugConfig.enabled
    };
  }

  public generateDebugUrl(sessionId: string, fileName?: string): string | null {
    if (!globalDebugConfig.enabled) return null;

    const baseUrl = `https://${this.assetCanisterId}.raw.icp0.io`;
    const basePath = `${this.projectPath}/debug-logs/${sessionId}`;
    
    return fileName ? `${baseUrl}/${basePath}/${fileName}` : `${baseUrl}/${basePath}/`;
  }

  public getProjectPath(): string {
    return this.projectPath;
  }

  public getBaseDebugUrl(): string | null {
    if (!globalDebugConfig.enabled) return null;
    return `https://${this.assetCanisterId}.raw.icp0.io/${this.projectPath}/debug-logs`;
  }

  public getAssetCanisterId(): string {
    return this.assetCanisterId;
  }

  public setAssetCanisterId(canisterId: string): void {
    if (!canisterId || canisterId.trim().length === 0) {
      throw new Error('Asset canister ID cannot be empty');
    }
    this.assetCanisterId = canisterId.trim();
    this.saveToStorage(GenerationLoggingService.STORAGE_KEY_CANISTER, this.assetCanisterId);
    console.log(`🐛 [GenerationLoggingService] Asset Canister ID updated to: ${this.assetCanisterId}`);
  }

  public setProjectPath(path: string): void {
    if (!path || path.trim().length === 0) {
      throw new Error('Project path cannot be empty');
    }
    this.projectPath = path.trim();
    this.saveToStorage(GenerationLoggingService.STORAGE_KEY_PATH, this.projectPath);
    console.log(`🐛 [GenerationLoggingService] Project Path updated to: ${this.projectPath}`);
  }
}

// ==================== CONVENIENCE FUNCTIONS ====================

export const generationLogger = GenerationLoggingService.getInstance();

let currentDebugContext: DebugContext | null = null;

export function getDebugContext(): DebugContext | null {
  if (!globalDebugConfig.enabled) return null;
  return currentDebugContext;
}

export function setDebugContext(context: DebugContext | null): void {
  if (!globalDebugConfig.enabled) {
    currentDebugContext = null;
    return;
  }
  currentDebugContext = context;
}

export function withDebugContext<T>(sessionId: string, operation: (context: DebugContext) => T): T | null {
  if (!globalDebugConfig.enabled) return null;
  
  const context = generationLogger.getDebugContext(sessionId);
  if (context && context.isDebugEnabled) {
    try {
      return operation(context);
    } catch (error) {
      if (!globalDebugConfig.silentMode) {
        console.error(`❌ [withDebugContext] Operation failed on ${sessionId}:`, error);
      }
      return null;
    }
  }
  return null;
}

export function getLoggingServiceHealth(): {
  isHealthy: boolean;
  activeSessionCount: number;
  assetCanisterId: string;
  projectPath: string;
  debugEnabled: boolean;
  lastError?: string;
} {
  try {
    const stats = generationLogger.getSessionStats();
    return {
      isHealthy: true,
      activeSessionCount: stats.activeCount,
      assetCanisterId: stats.assetCanisterId,
      projectPath: stats.projectPath,
      debugEnabled: stats.debugEnabled
    };
  } catch (error) {
    return {
      isHealthy: false,
      activeSessionCount: 0,
      assetCanisterId: 'unknown',
      projectPath: 'unknown',
      debugEnabled: false,
      lastError: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ==================== DEBUG CONTROL UTILITIES ====================

// Utility functions for easy debug control
export const DebugControl = {
  enable: () => {
    enableDebug();
    console.log('🐛 [DebugControl] Debug logging ENABLED');
  },
  
  disable: () => {
    disableDebug();
    console.log('🐛 [DebugControl] Debug logging DISABLED');
  },
  
  isEnabled: () => isDebugEnabled(),
  
  getConfig: () => getDebugConfiguration(),
  
  setConfig: (config: Partial<DebugConfiguration>) => {
    setDebugConfiguration(config);
    console.log('🐛 [DebugControl] Configuration updated:', getDebugConfiguration());
  },
  
  status: () => {
    const config = getDebugConfiguration();
    const health = getLoggingServiceHealth();
    console.log('🐛 [DebugControl] Status:', {
      enabled: config.enabled,
      silentMode: config.silentMode,
      activeSessions: health.activeSessionCount,
      healthy: health.isHealthy
    });
    return { config, health };
  }
};

// Make debug control available globally for console access
if (typeof window !== 'undefined') {
  (window as any).DebugControl = DebugControl;
}