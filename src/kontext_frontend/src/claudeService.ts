// ============================================================================
// ClaudeService.ts - Complete Implementation with Auto-Deduction for ALL AI Calls
// ============================================================================

// ============================================================================
// IMPORTS - Removed circular dependencies (userCanisterService and useAppStore)
// ============================================================================
// ❌ REMOVED THESE TO BREAK CIRCULAR DEPENDENCY:
// import { userCanisterService } from './services/UserCanisterService';
// import { useAppStore } from './store/appStore';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface StreamEvent {
    type: 'connected' | 'progress' | 'content_delta' | 'complete' | 'error' 
        | 'tool_use_start' | 'tool_executing' | 'tool_result';
    progress?: number;
    message?: string;
    content?: string;
    accumulatedLength?: number;
    files?: { [key: string]: string };
    analytics?: any;
    sessionData?: {
        id: string;
        model: string;
    };
    usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    };
    // Tool-specific properties
    toolName?: string;
    input?: any;
    result?: any;
    context?: string;
}

export interface StreamingResponse {
    content: string;
    files: { [key: string]: string };
    analytics?: any;
    sessionData?: {
        id: string;
        model: string;
    };
    usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    };
}

export interface RulesBasedPromptResponse {
    content: string;
    files: { [key: string]: string };
    analytics?: any;
    sessionData?: {
        id: string;
        model: string;
    };
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatContext {
    activeFile: string;
    fileContent: string;
    selectedFiles: string[];
    selectedFileContents?: { [fileName: string]: string };
    fileContents?: { [fileName: string]: string };
    projectStructure: Array<{name: string; type: string}>;
    projectInfo: {
        id: string;
        name: string;
        type: string;
    };
    aiRulesContext?: string;
    documentationContext?: string;
    githubContext?: string;
    stylingContext?: {
        colorPalettes?: Array<{
            name: string;
            colors: Array<{ hex: string; role?: string }>;
            source?: string;
        }>;
        designInspirations?: Array<{
            name: string;
            url: string;
            extractedColors?: string[];
            extractedTypography?: any;
        }>;
    };
    codeTemplatesContext?: string;
    apiEndpointsContext?: string;
    mcpContext?: string;
    workflowContext?: {
        availableWorkflows: Array<{ id: string; name: string; description: string }>;
        integratedWorkflows: Array<{ id: string; workflowId: string; workflowName: string; isEnabled: boolean }>;
    };
    businessAgencyContext?: {
        availableBusinessAgencies: Array<{ id: string; name: string; description: string; category: string }>;
        integratedBusinessAgencies: Array<{ id: string; agencyId: string; agencyName: string; isEnabled: boolean; category: string }>;
    };
    agentContext?: {
        availableAgents: Array<{ canisterId: string; name: string; description?: string }>;
        integratedAgents: Array<{ id: string; agentCanisterId: string; agentName: string; isEnabled: boolean }>;
    };
}

// 🔥 NEW: Enhanced classification interfaces
export interface EnhancedClassificationContext {
    hasExistingFiles: boolean;
    fileCount: number;
    isEmpty: boolean;
    projectType?: string;
    recentMessages?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    // 🔥 NEW: Request analysis from ProjectMetadataService
    requestKeywords?: string[];
    mentionedFiles?: string[];
    // 🔥 NEW: Explicit mentions extracted from user input to help backend focus on relevant files
    explicitMentions?: {
        files: string[];
        hooks: string[];
        components: string[];
        hasErrorMessages: boolean;
    };
}

export interface EnhancedClassificationResponse {
    classification: 'CREATE_PROJECT' | 'UPDATE_MESSAGE' | 'REGULAR_CHAT';
    confidence: number;
    reasoning: string;
    // 🔥 NEW: File selection recommendations
    contextSelection?: {
        primaryFiles: string[];
        supportingFiles: string[];
        configFiles: string[];
        excludedFiles: string[];
        totalFiles: number;
        estimatedTokens: number;
    };
    selectionReasoning?: {
        primaryFiles: string;
        supportingFiles: string;
        exclusions: string;
    };
    sessionId?: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    };
    model?: string;
}

// ============================================================================
// MCP-SPECIFIC INTERFACES
// ============================================================================

export interface MCPTool {
    id: string;
    name: string;
    description: string;
    version?: string;
    capabilities?: string[];
    category?: string;
    tags?: string[];
    connectionType?: string;
    endpoint?: string;
    documentation?: string;
    requiresAuth?: boolean;
    authType?: string;
    useCases?: string[];
    inputSchema?: any;
    outputSchema?: any;
    status?: string;
    repository?: string;
    lastUpdated?: string;
}

export interface MCPToolDetails {
    id: string;
    name: string;
    description: string;
    fullDescription?: string;
    functions?: any[];
    parameters?: any;
    examples?: string[];
    endpoint?: string;
    authRequirements?: any;
    rateLimit?: any;
    documentation?: string;
    apiReference?: string;
    bestUsedFor?: string[];
    limitations?: string[];
    version?: string;
    status?: string;
    lastUpdated?: string;
    inputSchema?: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
}

export interface MCPSearchResult {
    tools: MCPTool[];
    categories: string[];
    total: number;
    query: string | null;
}

export interface EnabledMCPTool {
    id: string;
    name: string;
    description: string;
    inputSchema: any;
    endpoint: string;
    apiKey?: string;
}

export interface MCPContextResult {
    context: string;
    toolCount: number;
    contextLength: number;
}

export type ProgressCallback = (progress: number, message: string) => void;

// ============================================================================
// CLAUDE SERVICE CLASS
// ============================================================================

export class ClaudeService {
    private apiKey: string | null = null;
    private baseUrl: string;
    // ✅ NEW: Track deductions to prevent double-charging
    private processedDeductions = new Set<string>();
    // ✅ NEW: Store current AbortController for stopping streaming
    private currentAbortController: AbortController | null = null;

    constructor() {
        this.baseUrl = 'https://ai.coinnation.io';
        // console.log(`🤖 [ClaudeService] Initialized with base URL: ${this.baseUrl}`);
    }

    // ✅ NEW: Stop current streaming chat
    public stopStreaming(): void {
        if (this.currentAbortController) {
            console.log('🛑 [ClaudeService] Stopping streaming chat...');
            this.currentAbortController.abort();
            this.currentAbortController = null;
        } else {
            console.warn('⚠️ [ClaudeService] No active streaming to stop');
        }
    }

    // ✅ NEW: Check if streaming is active
    public isStreaming(): boolean {
        return this.currentAbortController !== null && !this.currentAbortController.signal.aborted;
    }

    // ========================================================================
    // API KEY MANAGEMENT
    // ========================================================================

    public async getApiKey(): Promise<string> {
        try {
            // Get API key from store
            const { useAppStore } = await import('./store/appStore');
            const store = useAppStore.getState();
            const apiKey = store.claudeApiKey;
            
            // Fallback to environment variable or throw error if not set
            const fallbackKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
            const finalKey = apiKey || fallbackKey;
            
            if (!finalKey || finalKey.trim().length === 0) {
                throw new Error('Claude API key is empty or invalid. Please set your API key in Profile & Settings.');
            }
            
            if (!finalKey.startsWith('sk-ant-')) {
                throw new Error('Claude API key format is invalid - should start with sk-ant-');
            }
            
            console.log(`🔑 [ClaudeService] API key validated successfully (length: ${finalKey.length})`);
            return finalKey;
        } catch (error) {
            console.error('🚨 [ClaudeService] API key validation failed:', error);
            throw new Error(`Claude API key validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ========================================================================
    // HEALTH CHECK
    // ========================================================================

    public async healthCheck(): Promise<{success: boolean; error?: string}> {
        try {
            console.log(`🏥 [ClaudeService] Performing health check...`);
            
            // Check API key
            await this.getApiKey();
            
            // Check base URL connectivity
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET'
            });
            
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
            }
            
            console.log(`✅ [ClaudeService] Health check passed`);
            return { success: true };
            
        } catch (error) {
            console.error('❌ [ClaudeService] Health check failed:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown health check error'
            };
        }
    }

    // ========================================================================
    // COMPLEXITY ANALYSIS
    // ========================================================================

    private analyzeComplexity(prompt: string): { 
        complexity: 'simple' | 'medium' | 'complex', 
        recommendedModel: 'sonnet-4'
    } {
        const lowerPrompt = prompt.toLowerCase();
        const length = prompt.length;

        const complexKeywords = [
            'enterprise', 'microservices', 'distributed', 'blockchain', 
            'ai', 'machine learning', 'complex', 'advanced', 'full-stack', 
            'multiple databases', 'authentication system', 'real-time', 'websockets'
        ];
        
        const mediumKeywords = [
            'dashboard', 'crud', 'api', 'database', 'authentication', 
            'responsive', 'mobile', 'typescript', 'react', 'backend'
        ];

        const complexCount = complexKeywords.filter(keyword => lowerPrompt.includes(keyword)).length;
        const mediumCount = mediumKeywords.filter(keyword => lowerPrompt.includes(keyword)).length;

        // 🔥 REMOVED OPUS & SONNET-3.7: Project generation requires 200K token context window
        // Only Sonnet-4 has sufficient context for the full project generation strategy
        // Complexity detection kept for potential future use and logging purposes
        if (length > 500 || complexCount >= 3) {
            return { complexity: 'complex', recommendedModel: 'sonnet-4' };
        } else if (length > 200 || mediumCount >= 2 || complexCount >= 1) {
            return { complexity: 'medium', recommendedModel: 'sonnet-4' };
        } else {
            return { complexity: 'simple', recommendedModel: 'sonnet-4' };
        }
    }

    // ========================================================================
    // AUTO-DEDUCTION LOGIC (✅ NOW WITH CORRECT PROJECT CONTEXT!)
    // ========================================================================

    /**
     * Get current user context dynamically from store
     * ✅ NOW USES CORRECT PROPERTY PATHS FROM PROJECT SLICE!
     */
    private async getCurrentContext(): Promise<{
        userCanisterId: string | null;
        identity: any | null;
        projectId: string | null;
    }> {
        try {
            // ✅ SOLUTION: Dynamically import the store only when needed
            const { useAppStore } = await import('./store/appStore');
            const state = useAppStore.getState();
            
            // ✅ FIXED: Use correct property paths based on actual store structure
            const context = {
                userCanisterId: state.userCanisterId || null,
                identity: state.identity || null,
                // ✅ CRITICAL FIX: activeProject is a string (project ID), not an object
                projectId: state.activeProject || null
            };
            
            console.log('🔍 [ClaudeService] Context extraction debug:', {
                hasUserCanisterId: !!context.userCanisterId,
                hasIdentity: !!context.identity,
                hasProjectId: !!context.projectId,
                projectId: context.projectId ? context.projectId.substring(0, 10) + '...' : 'null',
                userCanisterId: context.userCanisterId ? context.userCanisterId.substring(0, 10) + '...' : 'null'
            });
            
            return context;
        } catch (error) {
            console.error('❌ [ClaudeService] Error getting store context:', error);
            return { userCanisterId: null, identity: null, projectId: null };
        }
    }

    /**
     * Check if auto-deduction is possible
     * ✅ NOW ASYNC TO SUPPORT LAZY LOADING
     */
    private async canAutoDeduct(): Promise<boolean> {
        const context = await this.getCurrentContext();
        const canDeduct = !!(context.userCanisterId && context.identity && context.projectId);
        
        if (!canDeduct) {
            console.log('ℹ️ [ClaudeService] Auto-deduction not available:', {
                hasUserCanisterId: !!context.userCanisterId,
                hasIdentity: !!context.identity,
                hasProjectId: !!context.projectId,
                reason: !context.userCanisterId ? 'No user canister ID' :
                       !context.identity ? 'No identity' :
                       !context.projectId ? 'No active project' : 'Unknown'
            });
            console.log('   📝 This is normal for unauthenticated users or when no project is selected');
        }
        
        return canDeduct;
    }

    /**
     * ✅ ENHANCED: Create unique deduction ID to prevent double-charging
     */
    private createDeductionId(usage: any, model: string, context: any): string {
        return `${context.userCanisterId}_${context.projectId}_${usage.total_tokens}_${model}_${Date.now()}`;
    }

    /**
     * Auto-deduct units based on API usage
     * ✅ NOW WITH DEDUPLICATION PROTECTION AND ENHANCED LOGGING
     */
    private async autoDeductUnits(
        usage: { input_tokens: number; output_tokens: number; total_tokens: number },
        model: string,
        sessionId?: string,
        operationType: string = 'chat_completion'
    ): Promise<void> {
        const deductionStartTime = Date.now();
        
        try {
            console.log('💳🚀 [ClaudeService] STARTING AUTO-DEDUCTION PROCESS 🚀💳');
            console.log('📊 [ClaudeService] Token usage details:', {
                inputTokens: usage.input_tokens.toLocaleString(),
                outputTokens: usage.output_tokens.toLocaleString(),
                totalTokens: usage.total_tokens.toLocaleString(),
                model,
                operationType,
                sessionId: sessionId || 'unknown'
            });

            // Get context first
            const context = await this.getCurrentContext();

            if (!context.userCanisterId || !context.identity || !context.projectId) {
                console.log('ℹ️ [ClaudeService] Auto-deduction skipped - user context not available');
                console.log('   📝 This is normal for unauthenticated users or when no project is selected');
                console.log('   🔍 Context details:', {
                    hasUserCanisterId: !!context.userCanisterId,
                    hasIdentity: !!context.identity,
                    hasProjectId: !!context.projectId
                });
                return;
            }

            // ✅ CRITICAL: Create unique deduction ID and check for duplicates
            const deductionId = this.createDeductionId(usage, model, context);
            
            if (this.processedDeductions.has(deductionId)) {
                console.warn('⚠️🛡️ [ClaudeService] DUPLICATE DEDUCTION PREVENTED! 🛡️⚠️');
                console.warn(`   DeductionId: ${deductionId}`);
                return;
            }

            // Mark this deduction as processed
            this.processedDeductions.add(deductionId);

            console.log('✅ [ClaudeService] User context validated for auto-deduction:', {
                userCanisterId: context.userCanisterId.substring(0, 10) + '...',
                hasIdentity: !!context.identity,
                projectId: context.projectId,
                deductionId: deductionId.substring(0, 20) + '...'
            });

            // ✅ SOLUTION: Dynamically import dependencies only when needed
            const [
                { userCanisterService },
                { useAppStore }
            ] = await Promise.all([
                import('./services/UserCanisterService'),
                import('./store/appStore')
            ]);

            console.log('🔄 [ClaudeService] Calling userCanisterService.deductUnitsFromClaudeAPIUsage...');
            console.log('📋 [ClaudeService] Deduction parameters:', {
                userCanisterId: context.userCanisterId.substring(0, 10) + '...',
                projectId: context.projectId,
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
                model: model,
                operationType: operationType
            });

            // ✅ CRITICAL: Call the actual deduction service
            const result = await userCanisterService.deductUnitsFromClaudeAPIUsage(
                context.userCanisterId,
                context.identity,
                context.projectId,
                usage.input_tokens,
                usage.output_tokens,
                model,
                operationType
            );

            const deductionDuration = Date.now() - deductionStartTime;

            if (result.success) {
                console.log('🎉✅ [ClaudeService] AUTO-DEDUCTION SUCCESSFUL! ✅🎉');
                console.log('💰 [ClaudeService] Deduction details:', {
                    unitsDeducted: result.unitsDeducted?.toFixed(4),
                    dollarCost: `$${result.dollarCost?.toFixed(6)}`,
                    remainingBalance: result.remainingBalance?.toFixed(2),
                    processingTime: `${deductionDuration}ms`,
                    deductionId: deductionId.substring(0, 20) + '...',
                    sessionId: sessionId || 'unknown',
                    operationType: operationType
                });
                
                // ✅ ENHANCED: Try to refresh balance in store with better error handling
                try {
                    const store = useAppStore.getState();
                    if (typeof store.fetchCreditsBalance === 'function') {
                        await store.fetchCreditsBalance();
                        console.log('🔄✅ [ClaudeService] User balance refreshed in store successfully');
                    } else {
                        console.warn('⚠️ [ClaudeService] fetchCreditsBalance method not available in store');
                    }
                } catch (refreshError) {
                    console.warn('⚠️ [ClaudeService] Could not refresh balance in store (non-critical):', refreshError);
                }
                
                // ✅ ENHANCED: Clean up old deduction IDs to prevent memory leaks
                if (this.processedDeductions.size > 100) {
                    const oldIds = Array.from(this.processedDeductions).slice(0, 50);
                    oldIds.forEach(id => this.processedDeductions.delete(id));
                    console.log(`🧹 [ClaudeService] Cleaned up ${oldIds.length} old deduction IDs`);
                }
                
            } else {
                console.error('❌💸 [ClaudeService] AUTO-DEDUCTION FAILED! 💸❌');
                console.error('📋 [ClaudeService] Failure details:', {
                    error: result.error,
                    userCanisterId: context.userCanisterId.substring(0, 10) + '...',
                    projectId: context.projectId,
                    tokenUsage: usage.total_tokens,
                    deductionId: deductionId.substring(0, 20) + '...',
                    processingTime: `${deductionDuration}ms`,
                    operationType: operationType
                });
                
                // Log specific error types for debugging
                if (result.error?.toLowerCase().includes('insufficient')) {
                    console.warn('💰⚠️ [ClaudeService] User has insufficient credits balance');
                    console.warn('💡 [ClaudeService] Consider prompting user to purchase more credits');
                } else if (result.error?.toLowerCase().includes('canister')) {
                    console.warn('🔧⚠️ [ClaudeService] Canister communication error - may be temporary');
                } else if (result.error?.toLowerCase().includes('identity')) {
                    console.warn('🔐⚠️ [ClaudeService] Identity/authentication error');
                } else {
                    console.warn('❓⚠️ [ClaudeService] Unknown deduction error type');
                }
                
                // Remove from processed set if it failed so it can be retried
                this.processedDeductions.delete(deductionId);
            }

        } catch (error) {
            const deductionDuration = Date.now() - deductionStartTime;
            console.error('❌🚨 [ClaudeService] CRITICAL ERROR IN AUTO-DEDUCTION! 🚨❌');
            console.error('📋 [ClaudeService] Error details:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                processingTime: `${deductionDuration}ms`,
                sessionId: sessionId || 'unknown',
                tokenUsage: usage,
                operationType: operationType
            });
            
            // Don't throw - allow the response to complete even if billing fails
            // This ensures the user experience isn't disrupted by billing issues
            console.log('🛡️ [ClaudeService] Continuing generation despite billing error (user experience protected)');
        }
    }

    /**
     * ✅ NEW: Extract usage data from non-streaming API response
     */
    private extractUsageFromResponse(responseData: any, model: string): {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    } | null {
        try {
            // Try multiple possible locations for usage data
            let usage: any = null;
            
            if (responseData.usage) {
                usage = responseData.usage;
            } else if (responseData.body?.usage) {
                usage = responseData.body.usage;
            } else if (responseData.analytics?.usage) {
                usage = responseData.analytics.usage;
            } else if (responseData.sessionData?.usage) {
                usage = responseData.sessionData.usage;
            }

            if (usage && usage.input_tokens && usage.output_tokens) {
                return {
                    input_tokens: usage.input_tokens,
                    output_tokens: usage.output_tokens,
                    total_tokens: usage.total_tokens || (usage.input_tokens + usage.output_tokens)
                };
            }

            // ✅ FALLBACK: Estimate usage if not provided by API
            console.warn('⚠️ [ClaudeService] No usage data found in response, estimating token usage...');
            
            const contentLength = this.estimateContentLength(responseData);
            const estimatedInputTokens = Math.ceil(contentLength * 0.3); // Rough estimate
            const estimatedOutputTokens = Math.ceil(contentLength * 0.7);
            
            return {
                input_tokens: estimatedInputTokens,
                output_tokens: estimatedOutputTokens,
                total_tokens: estimatedInputTokens + estimatedOutputTokens
            };

        } catch (error) {
            console.error('❌ [ClaudeService] Error extracting usage data:', error);
            return null;
        }
    }

    /**
     * ✅ NEW: Estimate content length from response for fallback usage calculation
     */
    private estimateContentLength(responseData: any): number {
        try {
            let totalLength = 0;

            if (responseData.content) {
                totalLength += responseData.content.length;
            }
            if (responseData.body?.content) {
                totalLength += responseData.body.content.length;
            }
            if (responseData.files) {
                Object.values(responseData.files).forEach((content: any) => {
                    if (typeof content === 'string') {
                        totalLength += content.length;
                    }
                });
            }
            if (responseData.body?.files) {
                Object.values(responseData.body.files).forEach((content: any) => {
                    if (typeof content === 'string') {
                        totalLength += content.length;
                    }
                });
            }

            return Math.max(totalLength, 100); // Minimum estimate
        } catch (error) {
            console.error('❌ [ClaudeService] Error estimating content length:', error);
            return 500; // Default fallback estimate
        }
    }

    // ========================================================================
    // PROJECT GENERATION METHODS (WITH AUTO-DEDUCTION)
    // ========================================================================

    /**
     * Send streaming rules-based prompt for comprehensive project generation
     */
    async sendStreamingRulesBasedPrompt(
        prompt: string,
        progressCallback: (event: StreamEvent) => void,
        preferredModel?: 'sonnet-4'
    ): Promise<StreamingResponse> {
        const sessionId = `rules_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log(`🚀 [ClaudeService] Starting streaming rules-based prompt (${prompt.length} characters)`);
            console.log(`📊 [ClaudeService] Session ID: ${sessionId}`);

            // CRITICAL FIX: Validate inputs before proceeding
            if (!prompt || prompt.trim() === '') {
                throw new Error('Prompt cannot be empty');
            }

            // CRITICAL FIX: Get and validate API key first
            const apiKey = await this.getApiKey();

            let selectedModel = preferredModel;
            if (!selectedModel) {
                const analysis = this.analyzeComplexity(prompt);
                selectedModel = analysis.recommendedModel;
                console.log(`🎯 [ClaudeService] Auto-selected model: ${selectedModel} (${analysis.complexity} complexity)`);
            }

            console.log(`🌊 [ClaudeService] Initiating streaming rules-based request with ${selectedModel}...`);

            // CRITICAL FIX: Add timeout and proper error handling
            const controller = new AbortController();
            this.currentAbortController = controller; // ✅ NEW: Store for stop functionality
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

            try {
                const response = await fetch(`${this.baseUrl}/api/claude/kontext/rulesBased/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        apiKey: apiKey,
                        prompt: prompt,
                        preferredModel: selectedModel,
                        tokenBudget: 200000
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`🚨 [ClaudeService] Streaming rules-based API error ${response.status}:`, errorText);
                    this.currentAbortController = null; // Clear on error
                    throw new Error(`Streaming rules-based API returned ${response.status}: ${errorText}`);
                }

                // ✅ NEW: Process stream with abort controller support
                try {
                    const result = await this.processStreamingResponse(response, progressCallback, sessionId, controller);
                    this.currentAbortController = null; // Clear when streaming completes
                    return result;
                } catch (error) {
                    this.currentAbortController = null; // Clear on processing error
                    throw error;
                }

            } catch (fetchError) {
                clearTimeout(timeoutId);
                this.currentAbortController = null; // Clear on fetch error
                
                // ✅ NEW: Handle abort errors gracefully
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    console.log('🛑 [ClaudeService] Rules-based request was aborted');
                    progressCallback({
                        type: 'error',
                        message: 'Request was cancelled'
                    });
                    throw new Error('Request was cancelled');
                }
                
                throw fetchError;
            }

        } catch (error) {
            console.error('🚨 [ClaudeService] Error in streaming rules-based prompt:', error);

            progressCallback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown streaming error'
            });

            throw new Error(`Failed to send streaming rules-based prompt: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Send streaming frontend-only generation request
     */
    async sendStreamingFrontendPrompt(
        prompt: string,
        frontendPrompt: string,
        progressCallback: (event: StreamEvent) => void,
        preferredModel?: 'sonnet-4',
        backendContext?: { [key: string]: string }
    ): Promise<StreamingResponse> {
        const sessionId = `frontend_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log(`🎨 [ClaudeService] Starting frontend-only generation (${prompt.length} characters)`);
            console.log(`📊 [ClaudeService] Session ID: ${sessionId}`);

            // CRITICAL FIX: Validate inputs
            if (!prompt || prompt.trim() === '') {
                throw new Error('Prompt cannot be empty');
            }
            if (!frontendPrompt || frontendPrompt.trim() === '') {
                throw new Error('Frontend prompt cannot be empty');
            }

            const apiKey = await this.getApiKey();

            let selectedModel = preferredModel;
            if (!selectedModel) {
                const analysis = this.analyzeComplexity(prompt);
                selectedModel = analysis.recommendedModel;
                console.log(`🎯 [ClaudeService] Auto-selected model for frontend: ${selectedModel} (${analysis.complexity} complexity)`);
            }

            console.log(`🌊 [ClaudeService] Initiating frontend streaming request with ${selectedModel}...`);

            const controller = new AbortController();
            this.currentAbortController = controller; // ✅ NEW: Store for stop functionality
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            try {
                const response = await fetch(`${this.baseUrl}/api/claude/kontext/frontend/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        apiKey: apiKey,
                        prompt: prompt,
                        frontendPrompt: frontendPrompt,
                        preferredModel: selectedModel,
                        backendContext: backendContext || {}
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`🚨 [ClaudeService] Frontend streaming API error ${response.status}:`, errorText);
                    this.currentAbortController = null; // Clear on error
                    throw new Error(`Frontend streaming API returned ${response.status}: ${errorText}`);
                }

                // ✅ NEW: Process stream with abort controller support
                try {
                    const result = await this.processStreamingResponse(response, progressCallback, sessionId, controller);
                    this.currentAbortController = null; // Clear when streaming completes
                    return result;
                } catch (error) {
                    this.currentAbortController = null; // Clear on processing error
                    throw error;
                }

            } catch (fetchError) {
                clearTimeout(timeoutId);
                this.currentAbortController = null; // Clear on fetch error
                
                // ✅ NEW: Handle abort errors gracefully
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    console.log('🛑 [ClaudeService] Frontend request was aborted');
                    progressCallback({
                        type: 'error',
                        message: 'Request was cancelled'
                    });
                    throw new Error('Request was cancelled');
                }
                
                throw fetchError;
            }

        } catch (error) {
            console.error('🚨 [ClaudeService] Error in frontend streaming:', error);

            progressCallback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown frontend streaming error'
            });

            throw new Error(`Failed to send frontend streaming request: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Send streaming backend-only generation request
     */
    async sendStreamingBackendPrompt(
        prompt: string,
        backendPrompt: string,
        progressCallback: (event: StreamEvent) => void,
        preferredModel?: 'sonnet-4'
    ): Promise<StreamingResponse> {
        const sessionId = `backend_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log(`🏗️ [ClaudeService] Starting backend-only generation (${prompt.length} characters)`);
            console.log(`📊 [ClaudeService] Session ID: ${sessionId}`);

            // CRITICAL FIX: Validate inputs
            if (!prompt || prompt.trim() === '') {
                throw new Error('Prompt cannot be empty');
            }
            if (!backendPrompt || backendPrompt.trim() === '') {
                throw new Error('Backend prompt cannot be empty');
            }

            const apiKey = await this.getApiKey();

            let selectedModel = preferredModel;
            if (!selectedModel) {
                const analysis = this.analyzeComplexity(prompt);
                selectedModel = analysis.recommendedModel;
                console.log(`🎯 [ClaudeService] Auto-selected model for backend: ${selectedModel} (${analysis.complexity} complexity)`);
            }

            console.log(`🌊 [ClaudeService] Initiating backend streaming request with ${selectedModel}...`);

            const controller = new AbortController();
            this.currentAbortController = controller; // ✅ NEW: Store for stop functionality
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            try {
                const response = await fetch(`${this.baseUrl}/api/claude/kontext/backend/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        apiKey: apiKey,
                        prompt: prompt,
                        backendPrompt: backendPrompt,
                        preferredModel: selectedModel
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`🚨 [ClaudeService] Backend streaming API error ${response.status}:`, errorText);
                    this.currentAbortController = null; // Clear on error
                    throw new Error(`Backend streaming API returned ${response.status}: ${errorText}`);
                }

                // ✅ NEW: Process stream with abort controller support
                try {
                    const result = await this.processStreamingResponse(response, progressCallback, sessionId, controller);
                    this.currentAbortController = null; // Clear when streaming completes
                    return result;
                } catch (error) {
                    this.currentAbortController = null; // Clear on processing error
                    throw error;
                }

            } catch (fetchError) {
                clearTimeout(timeoutId);
                this.currentAbortController = null; // Clear on fetch error
                
                // ✅ NEW: Handle abort errors gracefully
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    console.log('🛑 [ClaudeService] Backend request was aborted');
                    progressCallback({
                        type: 'error',
                        message: 'Request was cancelled'
                    });
                    throw new Error('Request was cancelled');
                }
                
                throw fetchError;
            }

        } catch (error) {
            console.error('🚨 [ClaudeService] Error in backend streaming:', error);

            progressCallback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown backend streaming error'
            });

            throw new Error(`Failed to send backend streaming request: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ========================================================================
    // STREAM PROCESSING WITH GUARANTEED AUTO-DEDUCTION
    // ========================================================================

    /**
     * Process streaming response from the server
     * ✅ NOW WITH GUARANTEED SINGLE AUTO-DEDUCTION PER SESSION!
     */
    private async processStreamingResponse(
        response: Response,
        onProgress: (event: StreamEvent) => void,
        sessionId?: string,
        abortController?: AbortController
    ): Promise<StreamingResponse> {
        // 🔥 CRITICAL FIX: Guard against duplicate completion events
        let completionEventSent = false;
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No reader available from streaming response');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';
        let finalFiles: { [key: string]: string } = {};
        let finalAnalytics: any = {};
        let sessionData: { id: string; model: string } = { id: '', model: '' };
        let finalUsage: { input_tokens: number; output_tokens: number; total_tokens: number } | undefined;
        
        // ✅ CRITICAL: Track if we've already processed deduction for this session
        let deductionProcessed = false;

        try {
            console.log(`🌊 [ClaudeService] Starting to process streaming response for session: ${sessionId || 'unknown'}`);

            onProgress({
                type: 'connected',
                message: 'Connected to streaming endpoint'
            });

            while (true) {
                // ✅ NEW: Check if aborted before reading
                if (abortController && abortController.signal.aborted) {
                    console.log('🛑 [ClaudeService] Stream aborted during read loop');
                    throw new Error('Request was cancelled');
                }
                
                const { done, value } = await reader.read();
                if (done) {
                    console.log('🌊 [ClaudeService] Stream naturally ended');
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);

                        if (dataStr === '[DONE]' || dataStr === 'DONE' || dataStr.trim() === '') {
                            console.log('🏁 [ClaudeService] Completion signal received:', dataStr);
                            
                            // 🔥 CRITICAL FIX: Prevent duplicate completion events
                            if (completionEventSent) {
                                console.warn('⚠️ [ClaudeService] Duplicate [DONE] signal - ignoring');
                                continue;
                            }
                            
                            // ✅ FINAL SAFETY: Try to deduct if we haven't already and have usage data
                            if (!deductionProcessed && finalUsage && await this.canAutoDeduct()) {
                                console.log('💳🔥 [ClaudeService] FINAL DEDUCTION ATTEMPT (completion signal) 🔥💳');
                                await this.autoDeductUnits(finalUsage, sessionData.model || 'claude-sonnet-4', sessionId, 'streaming_generation');
                                deductionProcessed = true;
                            }
                            
                            completionEventSent = true;
                            onProgress({
                                type: 'complete',
                                content: accumulatedContent,
                                files: finalFiles,
                                usage: finalUsage
                            });
                            continue;
                        }

                        try {
                            const eventData: StreamEvent = JSON.parse(dataStr);

                            switch (eventData.type) {
                                case 'connected':
                                    console.log('🔗 [ClaudeService] Connected to streaming endpoint');
                                    onProgress(eventData);
                                    break;

                                case 'progress':
                                    console.log(`📊 [ClaudeService] Progress ${eventData.progress}% - ${eventData.message}`);
                                    onProgress(eventData);
                                    break;

                                case 'content_delta':
                                    if (eventData.content) {
                                        accumulatedContent += eventData.content;
                                        
                                        onProgress({
                                            type: 'content_delta',
                                            content: eventData.content,
                                            accumulatedLength: accumulatedContent.length,
                                            progress: eventData.progress,
                                            message: eventData.message
                                        });
                                    }
                                    break;

                                case 'complete':
                                    console.log('🏁 [ClaudeService] Streaming complete event received');
                                    
                                    // 🔥 CRITICAL FIX: Prevent duplicate completion events
                                    if (completionEventSent) {
                                        console.warn('⚠️ [ClaudeService] Duplicate complete event - ignoring');
                                        break;
                                    }
                                    
                                    if (eventData.files) {
                                        finalFiles = eventData.files;
                                        console.log(`📁 [ClaudeService] Received ${Object.keys(finalFiles).length} files`);
                                    }
                                    if (eventData.analytics) {
                                        finalAnalytics = eventData.analytics;
                                    }
                                    if (eventData.sessionData) {
                                        sessionData = eventData.sessionData;
                                    }
                                    
                                    // ✅ CRITICAL: Capture usage data for auto-deduction
                                    if (eventData.usage) {
                                        finalUsage = eventData.usage;
                                        console.log(`📊✅ [ClaudeService] TOKEN USAGE CAPTURED FOR DEDUCTION:`, {
                                            inputTokens: finalUsage.input_tokens.toLocaleString(),
                                            outputTokens: finalUsage.output_tokens.toLocaleString(),
                                            totalTokens: finalUsage.total_tokens.toLocaleString(),
                                            model: sessionData.model,
                                            sessionId: sessionId
                                        });
                                    } else {
                                        console.warn('⚠️❗ [ClaudeService] NO USAGE DATA IN COMPLETE EVENT - DEDUCTION MAY NOT WORK');
                                    }
                                    
                                    // ✅ GUARANTEED DEDUCTION: Process immediately when we have complete data
                                    if (!deductionProcessed && finalUsage && await this.canAutoDeduct()) {
                                        console.log('💳⚡ [ClaudeService] PROCESSING AUTO-DEDUCTION (complete event) ⚡💳');
                                        await this.autoDeductUnits(finalUsage, sessionData.model || 'claude-sonnet-4', sessionId, 'streaming_generation');
                                        deductionProcessed = true;
                                    } else if (deductionProcessed) {
                                        console.log('✅🛡️ [ClaudeService] Deduction already processed - skipping duplicate');
                                    } else if (!finalUsage) {
                                        console.warn('⚠️ [ClaudeService] Cannot process deduction - no usage data available');
                                    } else {
                                        console.log('ℹ️ [ClaudeService] Auto-deduction skipped (user context not available)');
                                    }
                                    
                                    completionEventSent = true;
                                    onProgress({
                                        type: 'complete',
                                        content: accumulatedContent,
                                        files: finalFiles,
                                        analytics: finalAnalytics,
                                        sessionData: sessionData,
                                        usage: finalUsage
                                    });
                                    break;

                                case 'error':
                                    console.error('🚨 [ClaudeService] Streaming error -', eventData.message);
                                    onProgress(eventData);
                                    throw new Error(eventData.message || 'Streaming error occurred');

                                default:
                                    console.log(`🔍 [ClaudeService] Unknown event type: ${eventData.type}`);
                                    onProgress(eventData);
                            }
                        } catch (parseError) {
                            console.warn('⚠️ [ClaudeService] Error parsing SSE data:', parseError);
                            console.warn('Raw data:', dataStr.substring(0, 200));
                        }
                    }
                }
            }

            // ✅ FINAL SAFETY NET: If we somehow missed deduction, try one more time
            if (!deductionProcessed && finalUsage && await this.canAutoDeduct() && accumulatedContent.length > 0) {
                console.log('💳🚨 [ClaudeService] FINAL SAFETY NET DEDUCTION ATTEMPT 🚨💳');
                await this.autoDeductUnits(finalUsage, sessionData.model || 'claude-sonnet-4', sessionId, 'streaming_generation');
                deductionProcessed = true;
            }

            // 🔥 CRITICAL FIX: Only send completion if we haven't already sent it
            // This prevents duplicate completion events when stream ends naturally
            if (accumulatedContent.length > 0 && !completionEventSent) {
                console.log('🌊 [ClaudeService] Stream naturally ended - sending completion event');
                completionEventSent = true;
                onProgress({
                    type: 'complete',
                    content: accumulatedContent,
                    files: finalFiles,
                    analytics: finalAnalytics,
                    sessionData: sessionData,
                    usage: finalUsage
                });
            } else if (completionEventSent) {
                console.log('✅ [ClaudeService] Completion already sent - skipping natural end completion');
            }

        } catch (error) {
            console.error('🚨 [ClaudeService] Error in stream processing:', error);
            
            // ✅ NEW: Handle abort errors during stream processing
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('🛑 [ClaudeService] Stream was aborted during processing');
                onProgress({
                    type: 'error',
                    message: 'Request was cancelled'
                });
                throw new Error('Request was cancelled');
            }
            
            onProgress({
                type: 'error',
                message: error instanceof Error ? error.message : 'Stream processing error'
            });
            throw error;
        } finally {
            reader.releaseLock();
            
            // ✅ LOG FINAL DEDUCTION STATUS
            if (deductionProcessed) {
                console.log(`✅🎉 [ClaudeService] Session ${sessionId || 'unknown'} completed WITH successful deduction`);
            } else if (finalUsage) {
                console.warn(`⚠️💸 [ClaudeService] Session ${sessionId || 'unknown'} completed but deduction was NOT processed (user may not be authenticated)`);
            } else {
                console.warn(`⚠️❓ [ClaudeService] Session ${sessionId || 'unknown'} completed with no usage data for deduction`);
            }
        }

        console.log(`✅ [ClaudeService] Streaming completed - ${accumulatedContent.length} chars, ${Object.keys(finalFiles).length} files`);

        return {
            content: accumulatedContent,
            files: finalFiles,
            analytics: finalAnalytics,
            sessionData: sessionData,
            usage: finalUsage
        };
    }

    // ========================================================================
    // MCP TOOL DISCOVERY & MANAGEMENT (WITH AUTO-DEDUCTION)
    // ========================================================================

    /**
     * Search for MCP tools in the registry
     * ✅ NO DEDUCTION NEEDED - This is just a registry search, not AI generation
     */
    async searchMCPTools(
        query?: string,
        limit: number = 50,
        category?: string
    ): Promise<MCPSearchResult> {
        const searchId = `search-${Date.now()}`;
        
        try {
            console.log(`🔍 [${searchId}] MCP SEARCH INITIATED`);

            const params = new URLSearchParams();
            if (limit) params.append('limit', limit.toString());
            if (query) params.append('query', query);
            if (category) params.append('category', category);

            const url = `${this.baseUrl}/api/mcp/search?${params.toString()}`;
            console.log(`📡 [${searchId}] Fetching from URL: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ [${searchId}] Non-OK response:`, errorText);
                throw new Error(`MCP search failed: ${response.status} - ${errorText.substring(0, 100)}`);
            }

            const result = await response.json();
            console.log(`✅ [${searchId}] SEARCH COMPLETE - Returning ${result.total} tools`);

            return result;

        } catch (error) {
            console.error(`❌ [${searchId}] SEARCH FAILED:`, error);
            throw new Error(`Failed to search MCP tools: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get detailed information about a specific MCP tool
     * ✅ NO DEDUCTION NEEDED - This is just tool information retrieval
     */
    async getMCPToolDetails(toolId: string): Promise<MCPToolDetails> {
        try {
            console.log(`🔍 Fetching MCP tool details: ${toolId}`);

            const response = await fetch(`${this.baseUrl}/api/mcp/tools/${toolId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`MCP tool not found: ${toolId}`);
                }
                const errorText = await response.text();
                console.error(`MCP tool details error ${response.status}:`, errorText);
                throw new Error(`Failed to fetch MCP tool details: ${response.status}`);
            }

            const details = await response.json();
            console.log(`✅ Retrieved details for ${details.name}`);

            return details;

        } catch (error) {
            console.error(`Error fetching MCP tool ${toolId}:`, error);
            throw new Error(`Failed to get MCP tool details: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Build MCP context string for LLM from enabled tools
     * ✅ NO DEDUCTION NEEDED - This is just context building, not AI generation
     */
    async buildMCPContext(enabledTools: EnabledMCPTool[]): Promise<MCPContextResult> {
        try {
            console.log(`🧠 Building MCP context for ${enabledTools.length} tools`);

            const response = await fetch(`${this.baseUrl}/api/mcp/context`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    enabledTools: enabledTools
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`MCP context error ${response.status}:`, errorText);
                throw new Error(`Failed to build MCP context: ${response.status}`);
            }

            const result = await response.json();
            console.log(`✅ Built MCP context: ${result.contextLength} characters for ${result.toolCount} tools`);

            return result;

        } catch (error) {
            console.error('Error building MCP context:', error);
            throw new Error(`Failed to build MCP context: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get MCP context string directly (convenience method)
     * ✅ NO DEDUCTION NEEDED - This is just a wrapper method
     */
    async getMCPContextString(enabledTools: EnabledMCPTool[]): Promise<string> {
        const result = await this.buildMCPContext(enabledTools);
        return result.context;
    }

    // ========================================================================
    // MESSAGE CLASSIFICATION (WITH AUTO-DEDUCTION)
    // ========================================================================

    /**
     * 🔥 ENHANCED: Classify a message with project metadata support
     * ✅ NOW WITH AUTO-DEDUCTION FOR AI CLASSIFICATION CALLS
     */
    async classifyMessage(
        message: string,
        context?: EnhancedClassificationContext,
        projectMetadata?: any
    ): Promise<EnhancedClassificationResponse> {
        const sessionId = `classify_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log('🔍 [ClaudeService] Enhanced classification with project metadata:', {
                messageLength: message.length,
                hasContext: !!context,
                hasProjectMetadata: !!projectMetadata,
                sessionId
            });
            
            const apiKey = await this.getApiKey();
            
            // 🔥 NEW: Enhanced request body with project metadata
            const requestBody = {
                apiKey: apiKey,
                message: message,
                context: context || {},
                projectMetadata: projectMetadata || null
            };

            console.log('📡 [ClaudeService] Calling enhanced classification endpoint with project metadata...');

            const response = await fetch(`${this.baseUrl}/api/claude/classify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ [ClaudeService] Enhanced classification API error ${response.status}:`, errorText);
                throw new Error(`Enhanced classification API returned ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            
            // 🔧 CRITICAL FIX: Handle backend response format { success: true, data: {...} } or { success: false, fallback: {...} }
            let classificationResult;
            if (result.success && result.data) {
                classificationResult = result.data;
            } else if (!result.success && result.fallback) {
                classificationResult = result.fallback;
                console.warn('⚠️ [ClaudeService] Classification failed, using fallback result');
            } else {
                // Legacy format support - if result has classification directly
                classificationResult = result;
            }
            
            console.log(`✅ [ClaudeService] Enhanced classification result: ${classificationResult.classification} (${classificationResult.confidence}% confidence)`);
            if (classificationResult.contextSelection) {
                console.log(`📁 [ClaudeService] File recommendations: ${classificationResult.contextSelection.totalFiles} files selected`);
            }

            // ✅ NEW: Auto-deduct for enhanced classification API usage
            const usage = this.extractUsageFromResponse(classificationResult, 'claude-3-7-sonnet-20250219');
            if (usage && await this.canAutoDeduct()) {
                console.log('💳 [ClaudeService] Processing auto-deduction for enhanced message classification...');
                await this.autoDeductUnits(usage, 'claude-3-7-sonnet-20250219', sessionId, 'message_classification_enhanced');
            } else if (usage) {
                console.log('ℹ️ [ClaudeService] Enhanced classification usage captured but user context not available for deduction');
            } else {
                console.warn('⚠️ [ClaudeService] No usage data available for enhanced classification deduction');
            }

            // 🔥 ENHANCED: Post-process classification result to ensure mentioned config files are included
            const enrichedResult = this.enrichClassificationWithConfigFiles(
                message,
                classificationResult
            );
            
            // 🔥 NEW: Return enhanced classification response with file recommendations
            return {
                classification: enrichedResult.classification,
                confidence: enrichedResult.confidence,
                reasoning: enrichedResult.reasoning,
                contextSelection: enrichedResult.contextSelection || undefined,
                selectionReasoning: enrichedResult.selectionReasoning || undefined,
                sessionId: enrichedResult.sessionId || sessionId,
                usage: enrichedResult.usage,
                model: enrichedResult.model
            };

        } catch (error) {
            console.error('❌ [ClaudeService] Error in enhanced message classification:', error);
            
            // 🔥 FALLBACK: Return basic classification result
            return {
                classification: 'REGULAR_CHAT',
                confidence: 0,
                reasoning: `Enhanced classification failed: ${error instanceof Error ? error.message : 'Unknown error'} - defaulting to conversational`,
                sessionId: sessionId
            };
        }
    }

    // ========================================================================
    // CLASSIFICATION ENRICHMENT - CLIENT-SIDE CONFIG FILE DETECTION
    // ========================================================================

    /**
     * 🔥 ENHANCED: Enrich classification result with config files mentioned in user message
     * This is a client-side post-processing step to ensure config files are included
     * even if the remote classification service doesn't include them
     */
    private enrichClassificationWithConfigFiles(
        message: string,
        classificationResult: any
    ): any {
        const messageLower = message.toLowerCase();
        
        // Map of keywords to config file names
        // Priority: More specific patterns first, then general keywords
        const configFileMap: { [keyword: string]: string[] } = {
            'package.json': ['package.json'],  // Exact match - highest priority
            'postcss.config': ['postcss.config.js', 'postcss.config.ts'],  // Specific
            'tailwind.config': ['tailwind.config.js', 'tailwind.config.ts'],  // Specific
            'vite.config': ['vite.config.js', 'vite.config.ts'],  // Specific
            'tsconfig.json': ['tsconfig.json'],  // Exact match
            'webpack.config': ['webpack.config.js', 'webpack.config.ts'],  // Specific
            '.eslintrc': ['.eslintrc.js', '.eslintrc.json', '.eslintrc'],  // Specific
            '.prettierrc': ['.prettierrc', '.prettierrc.json'],  // Specific
            'babel.config': ['babel.config.js', '.babelrc'],  // Specific
            'jest.config': ['jest.config.js', 'jest.config.ts'],  // Specific
            // General keywords (lower priority, only if specific not found)
            'package': ['package.json'],  // Only if package.json not already detected
            'postcss': ['postcss.config.js', 'postcss.config.ts'],  // Only if postcss.config not found
            'tailwind': ['tailwind.config.js', 'tailwind.config.ts'],  // Only if tailwind.config not found
            'vite': ['vite.config.js', 'vite.config.ts'],  // Only if vite.config not found
            'tsconfig': ['tsconfig.json'],  // Only if tsconfig.json not found
            'webpack': ['webpack.config.js', 'webpack.config.ts'],  // Only if webpack.config not found
            'eslint': ['.eslintrc.js', '.eslintrc.json', '.eslintrc'],  // Only if .eslintrc not found
            'prettier': ['.prettierrc', '.prettierrc.json'],  // Only if .prettierrc not found
            'babel': ['babel.config.js', '.babelrc'],  // Only if babel.config not found
            'jest': ['jest.config.js', 'jest.config.ts']  // Only if jest.config not found
        };
        
        // Detect mentioned config files with priority (specific patterns first)
        const mentionedConfigFiles: string[] = [];
        const detectedKeywords = new Set<string>();
        
        // First pass: Check for specific/exact patterns
        for (const [keyword, files] of Object.entries(configFileMap)) {
            // Skip general keywords in first pass
            if (keyword === 'package' || keyword === 'postcss' || keyword === 'tailwind' || 
                keyword === 'vite' || keyword === 'tsconfig' || keyword === 'webpack' ||
                keyword === 'eslint' || keyword === 'prettier' || keyword === 'babel' || keyword === 'jest') {
                continue;
            }
            
            if (messageLower.includes(keyword)) {
                mentionedConfigFiles.push(...files);
                detectedKeywords.add(keyword);
            }
        }
        
        // Second pass: Check general keywords only if specific pattern not found
        for (const [keyword, files] of Object.entries(configFileMap)) {
            // Only process general keywords
            if (keyword === 'package' || keyword === 'postcss' || keyword === 'tailwind' || 
                keyword === 'vite' || keyword === 'tsconfig' || keyword === 'webpack' ||
                keyword === 'eslint' || keyword === 'prettier' || keyword === 'babel' || keyword === 'jest') {
                
                // Check if we already detected the specific version
                const alreadyDetected = 
                    (keyword === 'package' && detectedKeywords.has('package.json')) ||
                    (keyword === 'postcss' && detectedKeywords.has('postcss.config')) ||
                    (keyword === 'tailwind' && detectedKeywords.has('tailwind.config')) ||
                    (keyword === 'vite' && detectedKeywords.has('vite.config')) ||
                    (keyword === 'tsconfig' && detectedKeywords.has('tsconfig.json')) ||
                    (keyword === 'webpack' && detectedKeywords.has('webpack.config')) ||
                    (keyword === 'eslint' && detectedKeywords.has('.eslintrc')) ||
                    (keyword === 'prettier' && detectedKeywords.has('.prettierrc')) ||
                    (keyword === 'babel' && detectedKeywords.has('babel.config')) ||
                    (keyword === 'jest' && detectedKeywords.has('jest.config'));
                
                if (!alreadyDetected && messageLower.includes(keyword)) {
                    // Only add if it's in an error context or explicitly mentioned
                    // Avoid false positives from stack traces mentioning "vite" in paths
                    const isInErrorContext = 
                        messageLower.includes('error') || 
                        messageLower.includes('failed') ||
                        messageLower.includes('fix') ||
                        messageLower.includes('issue') ||
                        messageLower.includes(keyword + '.config') ||
                        messageLower.includes(keyword + '.json');
                    
                    if (isInErrorContext) {
                        mentionedConfigFiles.push(...files);
                    }
                }
            }
        }
        
        if (mentionedConfigFiles.length === 0) {
            return classificationResult; // No config files mentioned, return as-is
        }
        
        console.log(`🔧 [ClaudeService] Detected mentioned config files:`, mentionedConfigFiles);
        
        // Ensure contextSelection exists
        if (!classificationResult.contextSelection) {
            classificationResult.contextSelection = {
                primaryFiles: [],
                supportingFiles: [],
                configFiles: [],
                excludedFiles: [],
                totalFiles: 0,
                estimatedTokens: 0
            };
        }
        
        // Add mentioned config files to configFiles if not already present
        const existingConfigFiles = classificationResult.contextSelection.configFiles || [];
        const newConfigFiles: string[] = [];
        
        for (const configFile of mentionedConfigFiles) {
            // Check if it's already in configFiles (exact or partial match)
            const alreadyIncluded = existingConfigFiles.some(existing => {
                const existingLower = existing.toLowerCase();
                const configFileLower = configFile.toLowerCase();
                return existingLower === configFileLower ||
                       existingLower.includes(configFileLower) ||
                       configFileLower.includes(existingLower) ||
                       existingLower.endsWith(configFile) ||
                       configFileLower.endsWith(existing);
            });
            
            if (!alreadyIncluded) {
                newConfigFiles.push(configFile);
            }
        }
        
        if (newConfigFiles.length > 0) {
            console.log(`🔧 [ClaudeService] Adding missing config files to recommendations:`, newConfigFiles);
            
            // Add new config files
            classificationResult.contextSelection.configFiles = [
                ...existingConfigFiles,
                ...newConfigFiles
            ];
            
            // Update total files count
            classificationResult.contextSelection.totalFiles = 
                (classificationResult.contextSelection.primaryFiles?.length || 0) +
                (classificationResult.contextSelection.supportingFiles?.length || 0) +
                (classificationResult.contextSelection.configFiles?.length || 0);
            
            // Update reasoning if selectionReasoning exists
            if (classificationResult.selectionReasoning) {
                const existingReasoning = classificationResult.selectionReasoning.configFiles || '';
                classificationResult.selectionReasoning.configFiles = 
                    existingReasoning + 
                    (existingReasoning ? ' ' : '') +
                    `Client-side enrichment: Added ${newConfigFiles.join(', ')} based on explicit mentions in user message.`;
            }
        }
        
        return classificationResult;
    }

    // ========================================================================
    // CONTEXT MANAGEMENT - CRITICAL FIXES
    // ========================================================================

    /**
     * Prepare and validate context with comprehensive AI context consolidation
     */
    private prepareAndValidateContext(context: ChatContext): any {
        console.log('🧠 [ClaudeService] Preparing context with comprehensive AI integration...');
        
        const preparedContext = {
            activeFile: context.activeFile || '',
            activeFileContent: context.fileContent || '',
            projectStructure: context.projectStructure || [],
            projectInfo: context.projectInfo || { id: '', name: 'Unknown', type: 'General' },
            selectedFiles: context.selectedFiles || [],
            fileContents: {} as { [fileName: string]: string },
            comprehensiveAIContext: this.buildComprehensiveAIContext(context)
        };

        // Always include the active file
        if (context.activeFile && context.fileContent) {
            preparedContext.fileContents[context.activeFile] = context.fileContent;
        }

        // Include content from all selected files with validation
        if (context.selectedFileContents || context.fileContents) {
            const sourceContents = context.fileContents || context.selectedFileContents || {};

            Object.entries(sourceContents).forEach(([fileName, content]) => {
                if (fileName && typeof content === 'string') {
                    preparedContext.fileContents[fileName] = content;
                }
            });
        }

        // CRITICAL FIX: Ensure selectedFiles exists before using forEach
        const selectedFiles = context.selectedFiles || [];
        selectedFiles.forEach(fileName => {
            if (fileName && !preparedContext.fileContents[fileName]) {
                console.warn(`⚠️ CONTEXT: Missing content for selected file: ${fileName}`);
                preparedContext.fileContents[fileName] = `// Content not available for ${fileName}`;
            }
        });

        console.log(`📊 FINAL CONTEXT: ${Object.keys(preparedContext.fileContents).length} files prepared`);
        console.log(`🎯 AI CONTEXT: ${preparedContext.comprehensiveAIContext ? 'ACTIVE' : 'NONE'}`);

        return preparedContext;
    }

    /**
     * Build comprehensive AI context with boundary markers
     */
    private buildComprehensiveAIContext(context: ChatContext): string {
        console.log('🏗️ [ClaudeService] Building comprehensive AI context...');
        
        let comprehensiveContext = '';

        // 1. AI Rules Context (from aiRulesContext field)
        if (context.aiRulesContext && context.aiRulesContext.length > 0) {
            console.log('📋 Adding AI rules context...');
            comprehensiveContext += context.aiRulesContext;
        }

        // 2. Documentation Context
        if (context.documentationContext) {
            console.log('📚 Adding documentation context...');
            comprehensiveContext += '\n\n=== DOCUMENTATION CONTEXT ===\n';
            comprehensiveContext += 'CRITICAL: Reference these documentation sources when providing assistance:\n';
            comprehensiveContext += '- Use these docs as authoritative sources for APIs, libraries, and frameworks\n';
            comprehensiveContext += '- When generating code, follow patterns and examples from these docs\n';
            comprehensiveContext += '- Cite these sources when explaining concepts or providing solutions\n';
            comprehensiveContext += '- Ensure generated code aligns with official documentation standards\n\n';
            comprehensiveContext += context.documentationContext;
            comprehensiveContext += '\n=== END DOCUMENTATION ===\n\n';
        }

        // 3. GitHub Context
        if (context.githubContext) {
            console.log('🐙 Adding GitHub context...');
            comprehensiveContext += '\n\n=== GITHUB REPOSITORY CONTEXT ===\n';
            comprehensiveContext += 'CRITICAL: Follow these GitHub repository guidelines and patterns EXACTLY when writing code:\n';
            comprehensiveContext += '- Use these conventions for naming, structure, and code organization\n';
            comprehensiveContext += '- Apply these patterns consistently throughout the codebase\n';
            comprehensiveContext += '- Reference these guidelines when making architectural decisions\n\n';
            comprehensiveContext += context.githubContext;
            comprehensiveContext += '\n=== END GITHUB CONTEXT ===\n\n';
        }

        // 3.5. Styling Context
        if (context.stylingContext) {
            console.log('🎨 Adding styling context...');
            comprehensiveContext += '\n\n=== STYLING & DESIGN CONTEXT ===\n';
            comprehensiveContext += 'CRITICAL: Use these colors, design patterns, and visual styles when generating UI components:\n\n';
            
            if (context.stylingContext.colorPalettes && context.stylingContext.colorPalettes.length > 0) {
                comprehensiveContext += 'COLOR PALETTES (MUST USE THESE COLORS):\n';
                context.stylingContext.colorPalettes.forEach((palette, idx) => {
                    comprehensiveContext += `\nPalette ${idx + 1}: ${palette.name}\n`;
                    palette.colors.forEach(color => {
                        comprehensiveContext += `  - ${color.hex}${color.role ? ` (${color.role})` : ''}\n`;
                    });
                });
                comprehensiveContext += '\nINSTRUCTIONS:\n';
                comprehensiveContext += '- Use PRIMARY colors for main buttons, headers, and primary actions\n';
                comprehensiveContext += '- Use SECONDARY colors for secondary elements and supporting UI\n';
                comprehensiveContext += '- Use ACCENT colors for highlights, CTAs, and important elements\n';
                comprehensiveContext += '- Use BACKGROUND colors for page/container backgrounds\n';
                comprehensiveContext += '- Use TEXT colors for body text and readable content\n';
                comprehensiveContext += '- DO NOT use colors outside these palettes unless explicitly requested\n';
                comprehensiveContext += '- Apply colors consistently across all generated components\n\n';
            }
            
            if (context.stylingContext.designInspirations && context.stylingContext.designInspirations.length > 0) {
                comprehensiveContext += 'DESIGN INSPIRATIONS (Reference these for styling patterns):\n';
                context.stylingContext.designInspirations.forEach(inspiration => {
                    comprehensiveContext += `- ${inspiration.name} (${inspiration.url})\n`;
                    if (inspiration.extractedColors && inspiration.extractedColors.length > 0) {
                        comprehensiveContext += `  Colors: ${inspiration.extractedColors.join(', ')}\n`;
                    }
                    if (inspiration.extractedTypography) {
                        comprehensiveContext += `  Typography: ${JSON.stringify(inspiration.extractedTypography)}\n`;
                    }
                });
                comprehensiveContext += '\nINSTRUCTIONS:\n';
                comprehensiveContext += '- Study the design patterns from these inspiration sources\n';
                comprehensiveContext += '- Apply similar visual styles, spacing, and layout patterns\n';
                comprehensiveContext += '- Match the typography, color usage, and component styling\n\n';
            }
            
            comprehensiveContext += '=== END STYLING & DESIGN CONTEXT ===\n\n';
        }

        // 3.6. Code Templates Context
        if (context.codeTemplatesContext) {
            console.log('📝 Adding code templates context...');
            comprehensiveContext += '\n\n=== CODE TEMPLATES CONTEXT ===\n';
            comprehensiveContext += 'CRITICAL: Use these code templates and patterns when generating code:\n';
            comprehensiveContext += '- These are proven, reusable code patterns the user wants you to follow\n';
            comprehensiveContext += '- When generating similar functionality, use these templates as a base\n';
            comprehensiveContext += '- Maintain consistency with these patterns across the codebase\n';
            comprehensiveContext += '- Adapt templates to fit the specific use case while preserving structure\n\n';
            comprehensiveContext += context.codeTemplatesContext;
            comprehensiveContext += '\n=== END CODE TEMPLATES CONTEXT ===\n\n';
        }

        // 3.7. API Endpoints Context
        if (context.apiEndpointsContext) {
            console.log('🔌 Adding API endpoints context...');
            comprehensiveContext += '\n\n=== API ENDPOINTS CONTEXT ===\n';
            comprehensiveContext += 'CRITICAL: Reference these API endpoints when generating code that interacts with APIs:\n';
            comprehensiveContext += '- Use these exact endpoint paths, methods, and schemas\n';
            comprehensiveContext += '- Follow the request/response formats exactly as documented\n';
            comprehensiveContext += '- When generating API calls, use these endpoints and their schemas\n';
            comprehensiveContext += '- Ensure generated code matches the documented API contracts\n\n';
            comprehensiveContext += context.apiEndpointsContext;
            comprehensiveContext += '\n=== END API ENDPOINTS CONTEXT ===\n\n';
        }

        // 4. MCP Context
        if (context.mcpContext) {
            console.log('🔧 Adding MCP context...');
            comprehensiveContext += '\n\n=== MCP CAPABILITIES ===\n';
            comprehensiveContext += 'Available MCP servers and their tools:\n\n';
            comprehensiveContext += context.mcpContext;
            comprehensiveContext += '\n=== END MCP CAPABILITIES ===\n\n';
        }

        // 5. Agent Context
        if (context.agentContext) {
            console.log('🤖 Adding agent context...');
            comprehensiveContext += '\n\n=== AGENT INTEGRATIONS ===\n';
            comprehensiveContext += `Available Agents: ${context.agentContext.availableAgents.length}\n`;
            comprehensiveContext += `Integrated Agents: ${context.agentContext.integratedAgents.filter(a => a.isEnabled).length}\n\n`;
            
            if (context.agentContext.integratedAgents.length > 0) {
                comprehensiveContext += 'Integrated Agents (enabled):\n';
                context.agentContext.integratedAgents.forEach(agent => {
                    if (agent.isEnabled) {
                        comprehensiveContext += `- ${agent.agentName} (${agent.agentCanisterId})\n`;
                    }
                });
            }
            comprehensiveContext += '\n=== END AGENT INTEGRATIONS ===\n\n';
        }

        // 6. Workflow Context
        if (context.workflowContext) {
            console.log('🔄 Adding workflow context...');
            comprehensiveContext += '\n\n=== WORKFLOW INTEGRATIONS ===\n';
            comprehensiveContext += `Available Workflows: ${context.workflowContext.availableWorkflows.length}\n`;
            comprehensiveContext += `Integrated Workflows: ${context.workflowContext.integratedWorkflows.filter(w => w.isEnabled).length}\n\n`;
            
            if (context.workflowContext.availableWorkflows.length > 0) {
                comprehensiveContext += 'Available Workflows:\n';
                context.workflowContext.availableWorkflows.forEach(workflow => {
                    comprehensiveContext += `- ${workflow.name}: ${workflow.description} (ID: ${workflow.id})\n`;
                });
            }
            
            if (context.workflowContext.integratedWorkflows.length > 0) {
                comprehensiveContext += '\nIntegrated Workflows (enabled):\n';
                context.workflowContext.integratedWorkflows.forEach(workflow => {
                    if (workflow.isEnabled) {
                        comprehensiveContext += `- ${workflow.workflowName} (${workflow.workflowId})\n`;
                    }
                });
            }
            comprehensiveContext += '\n=== END WORKFLOW INTEGRATIONS ===\n\n';
        }

        // 7. Business Agency Context
        if (context.businessAgencyContext) {
            console.log('📊 Adding business agency context...');
            comprehensiveContext += '\n\n=== BUSINESS AGENCY INTEGRATIONS ===\n';
            comprehensiveContext += `Available Business Agencies: ${context.businessAgencyContext.availableBusinessAgencies.length}\n`;
            comprehensiveContext += `Integrated Business Agencies: ${context.businessAgencyContext.integratedBusinessAgencies.filter(a => a.isEnabled).length}\n\n`;
            
            if (context.businessAgencyContext.availableBusinessAgencies.length > 0) {
                comprehensiveContext += 'Available Business Agencies:\n';
                context.businessAgencyContext.availableBusinessAgencies.forEach(agency => {
                    comprehensiveContext += `- ${agency.name} (${agency.category}): ${agency.description} (ID: ${agency.id})\n`;
                });
            }
            
            if (context.businessAgencyContext.integratedBusinessAgencies.length > 0) {
                comprehensiveContext += '\nIntegrated Business Agencies (enabled):\n';
                context.businessAgencyContext.integratedBusinessAgencies.forEach(agency => {
                    if (agency.isEnabled) {
                        comprehensiveContext += `- ${agency.agencyName} (${agency.category}) - ${agency.agencyId}\n`;
                    }
                });
            }
            comprehensiveContext += '\n=== END BUSINESS AGENCY INTEGRATIONS ===\n\n';
        }

        // 8. Context Summary (always include if we have any context)
        if (comprehensiveContext.length > 0) {
            console.log('📝 Adding context summary...');
            let summary = '\n\n=== CONTEXT SUMMARY ===\n';
            summary += 'Active Elements:\n';
            if (context.aiRulesContext) summary += '- AI rules and guidelines enforced\n';
            if (context.documentationContext) summary += '- External documentation sources available\n';
            if (context.githubContext) summary += '- GitHub repository guidelines available\n';
            if (context.stylingContext) summary += '- Styling & design context (color palettes, design inspirations) available\n';
            if (context.codeTemplatesContext) summary += '- Code templates and patterns available\n';
            if (context.apiEndpointsContext) summary += '- API endpoints documentation available\n';
            if (context.mcpContext) summary += '- MCP server capabilities connected\n';
            if (context.agentContext && context.agentContext.integratedAgents.some(a => a.isEnabled)) {
                summary += `- ${context.agentContext.integratedAgents.filter(a => a.isEnabled).length} agent(s) integrated\n`;
            }
            if (context.workflowContext && context.workflowContext.integratedWorkflows.some(w => w.isEnabled)) {
                summary += `- ${context.workflowContext.integratedWorkflows.filter(w => w.isEnabled).length} workflow(s) integrated\n`;
            }
            if (context.businessAgencyContext && context.businessAgencyContext.integratedBusinessAgencies.some(a => a.isEnabled)) {
                summary += `- ${context.businessAgencyContext.integratedBusinessAgencies.filter(a => a.isEnabled).length} business agency(ies) integrated\n`;
            }
            summary += '\nPlease consider all these sources when providing assistance.\n';
            summary += '=== END CONTEXT SUMMARY ===\n\n';

            comprehensiveContext += summary;
        }

        console.log(`✅ Built comprehensive AI context: ${comprehensiveContext.length} characters`);
        return comprehensiveContext;
    }

    // ========================================================================
    // CHAT WITH ENHANCED CONTEXT SUPPORT AND AUTO-DEDUCTION
    // ========================================================================

    /**
     * Send streaming chat message with proper context handling
     * ✅ NOW WITH AUTOMATIC UNITS DEDUCTION!
     */
    async sendStreamingChat(
        messages: ChatMessage[],
        context: ChatContext,
        onProgress: (event: StreamEvent) => void,
        enabledMCPTools?: EnabledMCPTool[],
        images?: Array<{ data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }>,
    ): Promise<StreamingResponse> {
        const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        // 🔥 DEBUG: Log all parameters to verify they're being passed correctly
        console.log('🔍 [ClaudeService] sendStreamingChat called with:', {
            messagesCount: messages?.length || 0,
            hasContext: !!context,
            hasOnProgress: typeof onProgress === 'function',
            enabledMCPToolsCount: enabledMCPTools?.length || 0,
            imagesCount: images?.length || 0,
            allArguments: arguments.length
        });
        
        try {
            console.log('🌊 [ClaudeService] Starting streaming chat with enhanced context and auto-deduction');
            console.log(`📊 [ClaudeService] Chat session ID: ${sessionId}`);
            if (images && images.length > 0) {
                console.log(`📷 [ClaudeService] Including ${images.length} image(s) in chat request`);
            }
            
            // CRITICAL FIX: Validate inputs first
            if (!messages || messages.length === 0) {
                throw new Error('Messages array cannot be empty');
            }

            const apiKey = await this.getApiKey();
            
            // Use prepareAndValidateContext with comprehensive AI context
            const preparedContext = this.prepareAndValidateContext(context);

            console.log(`🚀 [ClaudeService] STREAMING CHAT: Sending request with ${messages.length} messages`);

            // Build messages with image support
            const messagesWithContent = messages.map((m, index) => {
                // If this is the last user message and we have images, include them
                if (m.role === 'user' && index === messages.length - 1 && images && images.length > 0) {
                    // Convert to ClaudeContentBlock format
                    const contentBlocks: Array<{ type: 'text' | 'image'; text?: string; source?: any }> = [];
                    
                    // Add text content first
                    if (m.content && m.content.trim()) {
                        contentBlocks.push({ type: 'text', text: m.content });
                    }
                    
                    // Add images
                    images.forEach(img => {
                        contentBlocks.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: img.mediaType,
                                data: img.data
                            }
                        });
                    });
                    
                    return {
                        role: m.role,
                        content: contentBlocks
                    };
                } else {
                    return {
                    role: m.role,
                    content: m.content
                    };
                }
            });

            const requestBody = {
                apiKey: apiKey,
                messages: messagesWithContent,
                context: preparedContext,
                needsFileExtraction: true,
                preferredModel: 'sonnet-4',
                tokenBudget: 150000,
                enabledMCPTools: enabledMCPTools,
                images: images // Also include in body for backward compatibility
            };
            
            // ✅ NEW: Log request details for debugging 400 errors
            const requestBodySize = JSON.stringify(requestBody).length;
            console.log('📤 [ClaudeService] Sending streaming chat request:', {
                messageCount: messagesWithContent.length,
                requestBodySize: `${(requestBodySize / 1024).toFixed(2)} KB`,
                hasImages: !!(images && images.length > 0),
                imageCount: images?.length || 0,
                hasMCPTools: !!(enabledMCPTools && enabledMCPTools.length > 0),
                contextSize: JSON.stringify(preparedContext).length
            });
            
            // 🔥 CRITICAL: Log the EXACT final messages being sent to the API
            console.log('📤 [ClaudeService] ========== FINAL MESSAGES SENT TO API ==========');
            messagesWithContent.forEach((msg, index) => {
              console.log(`\n📤 [ClaudeService] --- Message ${index + 1} (${msg.role}) ---`);
              if (Array.isArray(msg.content)) {
                // Handle content blocks (text + images)
                console.log(`📤 [ClaudeService] Content type: Array with ${msg.content.length} blocks`);
                msg.content.forEach((block, blockIndex) => {
                  if (block.type === 'text') {
                    console.log(`📤 [ClaudeService] Block ${blockIndex + 1} (text): ${block.text?.length || 0} chars`);
                    console.log(`📤 [ClaudeService] Preview: ${block.text?.substring(0, 500) || 'N/A'}...`);
                  } else if (block.type === 'image') {
                    console.log(`📤 [ClaudeService] Block ${blockIndex + 1} (image): ${block.source?.media_type || 'unknown'}`);
                  }
                });
              } else if (typeof msg.content === 'string') {
                console.log(`📤 [ClaudeService] Content length: ${msg.content.length} characters`);
                console.log(`📤 [ClaudeService] Content preview (first 500 chars):\n${msg.content.substring(0, 500)}...`);
                if (msg.content.length > 500) {
                  console.log(`📤 [ClaudeService] ... (${msg.content.length - 500} more characters)`);
                }
              }
            });
            console.log('📤 [ClaudeService] ================================================\n');
            
            // 🔥 CRITICAL: Log context information being sent
            if (preparedContext.comprehensiveAIContext) {
              console.log('📤 [ClaudeService] ========== COMPREHENSIVE AI CONTEXT ==========');
              console.log(`📤 [ClaudeService] Context length: ${preparedContext.comprehensiveAIContext.length} characters`);
              console.log(`📤 [ClaudeService] Context preview (first 1000 chars):\n${preparedContext.comprehensiveAIContext.substring(0, 1000)}...`);
              if (preparedContext.comprehensiveAIContext.length > 1000) {
                console.log(`📤 [ClaudeService] ... (${preparedContext.comprehensiveAIContext.length - 1000} more characters)`);
              }
              console.log('📤 [ClaudeService] ============================================\n');
            }
            
            // Log file contents summary (with previews, not full content)
            if (preparedContext.fileContents && Object.keys(preparedContext.fileContents).length > 0) {
              console.log('📤 [ClaudeService] ========== FILE CONTENTS IN CONTEXT ==========');
              console.log(`📤 [ClaudeService] Files included: ${Object.keys(preparedContext.fileContents).length}`);
              Object.entries(preparedContext.fileContents).forEach(([fileName, content]) => {
                const contentLength = typeof content === 'string' ? content.length : 0;
                const previewLength = 500; // Show first 500 chars as preview
                const preview = typeof content === 'string' 
                  ? (contentLength > previewLength 
                      ? content.substring(0, previewLength) + `\n... (${contentLength - previewLength} more characters)`
                      : content)
                  : '[Non-string content]';
                console.log(`📤 [ClaudeService] --- ${fileName} (${contentLength} characters) ---`);
                console.log(`📤 [ClaudeService] ${preview}`);
              });
              console.log('📤 [ClaudeService] ============================================\n');
            }
            
            // ✅ NEW: Warn if request is very large (might cause 400)
            if (requestBodySize > 500000) { // 500KB
                console.warn('⚠️ [ClaudeService] Large request body detected - may cause server errors:', {
                    size: `${(requestBodySize / 1024).toFixed(2)} KB`,
                    messageCount: messagesWithContent.length
                });
            }

            const controller = new AbortController();
            this.currentAbortController = controller; // Store for stop functionality
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for chat

            try {
                // Always use the standard chat stream endpoint
                const endpoint = `${this.baseUrl}/api/claude/chat/stream`;
                
                console.log(`🔗 [ClaudeService] Using endpoint: ${endpoint}`);
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`🚨 [ClaudeService] Streaming API error ${response.status}:`, errorText);
                    this.currentAbortController = null; // Clear on error
                    
                    // ✅ NEW: Better error messages for different status codes
                    let errorMessage: string;
                    if (response.status === 400) {
                        // Try to parse JSON error if possible
                        try {
                            const errorJson = JSON.parse(errorText);
                            errorMessage = errorJson.message || errorJson.error || errorText || 'Invalid request. Please check your input and try again.';
                        } catch {
                            errorMessage = errorText || 'Invalid request. The server could not process your request. Please check your input and try again.';
                        }
                    } else if (response.status === 401 || response.status === 403) {
                        errorMessage = 'Authentication failed. Please refresh the page and try again.';
                    } else if (response.status === 429) {
                        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
                    } else if (response.status >= 500) {
                        errorMessage = 'Server error. Please try again in a moment.';
                    } else {
                        errorMessage = errorText || `Request failed with status code ${response.status}`;
                    }
                    
                    throw new Error(errorMessage);
                }

                // ✅ Process stream with auto-deduction
                // NOTE: Keep currentAbortController active during streaming so stop button works
                try {
                    const result = await this.processStreamingResponse(response, onProgress, sessionId, controller);
                    this.currentAbortController = null; // Clear when streaming completes successfully
                    return result;
                } catch (error) {
                    this.currentAbortController = null; // Clear on processing error
                    throw error;
                }

            } catch (fetchError) {
                clearTimeout(timeoutId);
                this.currentAbortController = null; // Clear on error
                
                // ✅ NEW: Handle abort errors gracefully
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    console.log('🛑 [ClaudeService] Request was aborted by user');
                    onProgress({
                        type: 'error',
                        message: 'Request was cancelled'
                    });
                    throw new Error('Request was cancelled');
                }
                
                throw fetchError;
            }

        } catch (error) {
            this.currentAbortController = null; // Clear on outer error
            
            // ✅ NEW: Handle abort errors gracefully
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('🛑 [ClaudeService] Request was aborted by user');
                onProgress({
                    type: 'error',
                    message: 'Request was cancelled'
                });
                // Return empty response for aborted requests
                return {
                    content: '',
                    files: {},
                    analytics: {},
                    sessionData: { id: sessionId, model: 'unknown' }
                };
            }
            
            console.error('🚨 [ClaudeService] Error in streaming chat:', error);

            onProgress({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown streaming error'
            });

            // ✅ NEW: Don't wrap "Request was cancelled" errors - return them as-is
            if (error instanceof Error && (error.message === 'Request was cancelled' || error.name === 'AbortError')) {
                throw error; // Re-throw as-is so it can be detected
            }
            
            throw new Error(`Failed to send streaming chat: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ========================================================================
    // NON-STREAMING CHAT (WITH AUTO-DEDUCTION)
    // ========================================================================

    /**
     * Send non-streaming chat message (fallback)
     * ✅ NOW WITH AUTO-DEDUCTION FOR NON-STREAMING CALLS!
     */
    async sendChat(
        messages: ChatMessage[],
        context: ChatContext
    ): Promise<{content: string; files: { [key: string]: string }; reasoning?: string}> {
        const sessionId = `chat_nonstream_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log('📄 [ClaudeService] Sending non-streaming chat');
            console.log(`📊 [ClaudeService] Non-streaming chat session ID: ${sessionId}`);
            
            const apiKey = await this.getApiKey();
            
            // Use prepareAndValidateContext for non-streaming too
            const preparedContext = this.prepareAndValidateContext(context);

            const response = await fetch(`${this.baseUrl}/api/claude/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apiKey: apiKey,
                    messages: messages,
                    context: preparedContext,
                    needsFileExtraction: true,
                    preferredModel: 'sonnet-4',
                    tokenBudget: 150000
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`🚨 [ClaudeService] Chat API error ${response.status}:`, errorText);
                throw new Error(`Chat API returned ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            console.log(`✅ [ClaudeService] Non-streaming chat complete - ${data.body?.content?.length || 0} chars`);

            // ✅ NEW: Auto-deduct for non-streaming chat
            const usage = this.extractUsageFromResponse(data, 'sonnet-4');
            if (usage && await this.canAutoDeduct()) {
                console.log('💳 [ClaudeService] Processing auto-deduction for non-streaming chat...');
                await this.autoDeductUnits(usage, 'sonnet-4', sessionId, 'non_streaming_chat');
            } else if (usage) {
                console.log('ℹ️ [ClaudeService] Non-streaming chat usage captured but user context not available for deduction');
            } else {
                console.warn('⚠️ [ClaudeService] No usage data available for non-streaming chat deduction');
            }

            return {
                content: data.body?.content || '',
                files: data.body?.files || {},
                reasoning: data.body?.reasoning
            };

        } catch (error) {
            console.error('🚨 [ClaudeService] Error in non-streaming chat:', error);
            throw new Error(`Failed to send chat: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Legacy method name for backward compatibility
     * @deprecated Use sendStreamingRulesBasedPrompt instead
     * ✅ NOW WITH AUTO-DEDUCTION FOR LEGACY CALLS!
     */
    async sendRulesBasedPrompt(
        prompt: string,
        progressCallback: ProgressCallback,
        preferredModel?: 'sonnet-4'
    ): Promise<RulesBasedPromptResponse> {
        const sessionId = `legacy_rules_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        console.log('📄 [ClaudeService] Legacy sendRulesBasedPrompt called - forwarding to streaming version');
        console.log(`📊 [ClaudeService] Legacy session ID: ${sessionId}`);
        
        const streamCallback = (event: StreamEvent) => {
            if (event.type === 'progress' && typeof event.progress === 'number' && event.message) {
                progressCallback(event.progress, event.message);
            }
        };

        const result = await this.sendStreamingRulesBasedPrompt(prompt, streamCallback, preferredModel);
        return result as RulesBasedPromptResponse;
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const claudeService = new ClaudeService();