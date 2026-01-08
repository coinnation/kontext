// ============================================================================
// GeminiService.ts - Complete Implementation with Auto-Deduction for ALL AI Calls
// ============================================================================
// Mirrors ClaudeService but uses Gemini API endpoints

// ============================================================================
// INTERFACES & TYPES (Reusing from ClaudeService)
// ============================================================================

export interface StreamEvent {
    type: 'connected' | 'progress' | 'content_delta' | 'complete' | 'error';
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
    fileExtractionMode?: boolean;
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

export interface EnhancedClassificationContext {
    hasExistingFiles: boolean;
    fileCount: number;
    isEmpty: boolean;
    projectType?: string;
    recentMessages?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    requestKeywords?: string[];
    mentionedFiles?: string[];
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
// GEMINI SERVICE CLASS
// ============================================================================

export class GeminiService {
    private apiKey: string | null = null;
    private baseUrl: string;
    // Track deductions to prevent double-charging
    private processedDeductions = new Set<string>();
    // Store current AbortController for stopping streaming
    private currentAbortController: AbortController | null = null;

    constructor() {
        this.baseUrl = 'https://ai.coinnation.io';
    }

    // Stop current streaming chat
    public stopStreaming(): void {
        if (this.currentAbortController) {
            console.log('🛑 [GeminiService] Stopping streaming chat...');
            this.currentAbortController.abort();
            this.currentAbortController = null;
        } else {
            console.warn('⚠️ [GeminiService] No active streaming to stop');
        }
    }

    // Check if streaming is active
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
            const apiKey = store.geminiApiKey;
            
            if (!apiKey || apiKey.trim().length === 0) {
                throw new Error('Gemini API key is empty or invalid. Please set your API key in Profile & Settings.');
            }
            
            if (!apiKey.startsWith('AIza')) {
                console.warn('⚠️ [GeminiService] API key format may be invalid - expected to start with AIza');
            }
            
            console.log(`🔑 [GeminiService] API key validated successfully (length: ${apiKey.length})`);
            return apiKey;
        } catch (error) {
            console.error('🚨 [GeminiService] API key validation failed:', error);
            throw new Error(`Gemini API key validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ========================================================================
    // HEALTH CHECK
    // ========================================================================

    public async healthCheck(): Promise<{success: boolean; error?: string}> {
        try {
            console.log(`🏥 [GeminiService] Performing health check...`);
            
            await this.getApiKey();
            
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET'
            });
            
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
            }
            
            console.log(`✅ [GeminiService] Health check passed`);
            return { success: true };
            
        } catch (error) {
            console.error('❌ [GeminiService] Health check failed:', error);
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
        recommendedModel: 'pro-1.5' | 'flash-1.5' 
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

        if (length > 500 || complexCount >= 3) {
            return { complexity: 'complex', recommendedModel: 'pro-1.5' };
        } else if (length > 200 || mediumCount >= 2 || complexCount >= 1) {
            return { complexity: 'medium', recommendedModel: 'pro-1.5' };
        } else {
            return { complexity: 'simple', recommendedModel: 'flash-1.5' };
        }
    }

    // ========================================================================
    // AUTO-DEDUCTION LOGIC
    // ========================================================================

    private async getCurrentContext(): Promise<{
        userCanisterId: string | null;
        identity: any | null;
        projectId: string | null;
    }> {
        try {
            const { useAppStore } = await import('./store/appStore');
            const state = useAppStore.getState();
            
            const context = {
                userCanisterId: state.userCanisterId || null,
                identity: state.identity || null,
                projectId: state.activeProject || null
            };
            
            return context;
        } catch (error) {
            console.error('❌ [GeminiService] Error getting store context:', error);
            return { userCanisterId: null, identity: null, projectId: null };
        }
    }

    private async canAutoDeduct(): Promise<boolean> {
        const context = await this.getCurrentContext();
        return !!(context.userCanisterId && context.identity && context.projectId);
    }

    private createDeductionId(usage: any, model: string, context: any): string {
        return `gemini_${context.userCanisterId}_${context.projectId}_${usage.total_tokens}_${model}_${Date.now()}`;
    }

    private async autoDeductUnits(
        usage: { input_tokens: number; output_tokens: number; total_tokens: number },
        model: string,
        sessionId?: string,
        operationType: string = 'chat_completion'
    ): Promise<void> {
        try {
            const context = await this.getCurrentContext();

            if (!context.userCanisterId || !context.identity || !context.projectId) {
                console.log('ℹ️ [GeminiService] Auto-deduction skipped - user context not available');
                return;
            }

            const deductionId = this.createDeductionId(usage, model, context);
            
            if (this.processedDeductions.has(deductionId)) {
                console.warn('⚠️🛡️ [GeminiService] DUPLICATE DEDUCTION PREVENTED! 🛡️⚠️');
                return;
            }

            this.processedDeductions.add(deductionId);

            const [
                { userCanisterService },
                { useAppStore }
            ] = await Promise.all([
                import('./services/UserCanisterService'),
                import('./store/appStore')
            ]);

            const result = await userCanisterService.deductUnitsFromGeminiAPIUsage(
                context.userCanisterId,
                context.identity,
                context.projectId,
                usage.input_tokens,
                usage.output_tokens,
                model,
                operationType
            );

            if (result.success) {
                console.log('🎉✅ [GeminiService] AUTO-DEDUCTION SUCCESSFUL! ✅🎉');
                
                try {
                    const store = useAppStore.getState();
                    if (typeof store.fetchCreditsBalance === 'function') {
                        await store.fetchCreditsBalance();
                    }
                } catch (refreshError) {
                    console.warn('⚠️ [GeminiService] Could not refresh balance in store:', refreshError);
                }
            } else {
                console.error('❌💸 [GeminiService] AUTO-DEDUCTION FAILED! 💸❌');
                this.processedDeductions.delete(deductionId);
            }

        } catch (error) {
            console.error('❌🚨 [GeminiService] CRITICAL ERROR IN AUTO-DEDUCTION! 🚨❌');
        }
    }

    private extractUsageFromResponse(response: any, defaultModel: string): { 
        input_tokens: number; 
        output_tokens: number; 
        total_tokens: number 
    } | null {
        if (response.usage) {
            return {
                input_tokens: response.usage.input_tokens || 0,
                output_tokens: response.usage.output_tokens || 0,
                total_tokens: response.usage.total_tokens || (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)
            };
        }
        return null;
    }

    // ========================================================================
    // STREAMING GENERATION METHODS
    // ========================================================================

    /**
     * Send streaming rules-based project generation request
     */
    async sendStreamingRulesBasedPrompt(
        prompt: string,
        progressCallback: (event: StreamEvent) => void,
        preferredModel?: 'pro-1.5' | 'flash-1.5',
        tokenBudget?: number,
        images?: Array<{ data: string; mediaType: string }>
    ): Promise<StreamingResponse> {
        const sessionId = `gemini_rules_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log(`🚀 [GeminiService] Starting rules-based generation (${prompt.length} characters)`);
            console.log(`📊 [GeminiService] Session ID: ${sessionId}`);

            if (!prompt || prompt.trim() === '') {
                throw new Error('Prompt cannot be empty');
            }

            const apiKey = await this.getApiKey();

            let selectedModel = preferredModel;
            if (!selectedModel) {
                const analysis = this.analyzeComplexity(prompt);
                selectedModel = analysis.recommendedModel;
                console.log(`🎯 [GeminiService] Auto-selected model: ${selectedModel} (${analysis.complexity} complexity)`);
            }

            console.log(`🌊 [GeminiService] Initiating streaming rules-based request with ${selectedModel}...`);

            const controller = new AbortController();
            this.currentAbortController = controller;
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            try {
                const response = await fetch(`${this.baseUrl}/api/gemini/kontext/rulesBased/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        apiKey: apiKey,
                        prompt: prompt,
                        preferredModel: selectedModel,
                        tokenBudget: tokenBudget || 200000,
                        images: images
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`🚨 [GeminiService] Streaming rules-based API error ${response.status}:`, errorText);
                    this.currentAbortController = null;
                    throw new Error(`Streaming rules-based API returned ${response.status}: ${errorText}`);
                }

                try {
                    const result = await this.processStreamingResponse(response, progressCallback, sessionId, controller);
                    this.currentAbortController = null;
                    return result;
                } catch (error) {
                    this.currentAbortController = null;
                    throw error;
                }

            } catch (fetchError) {
                clearTimeout(timeoutId);
                this.currentAbortController = null;
                
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    console.log('🛑 [GeminiService] Rules-based request was aborted');
                    progressCallback({
                        type: 'error',
                        message: 'Request was cancelled'
                    });
                    throw new Error('Request was cancelled');
                }
                
                throw fetchError;
            }

        } catch (error) {
            console.error('🚨 [GeminiService] Error in streaming rules-based prompt:', error);

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
        preferredModel?: 'pro-1.5' | 'flash-1.5',
        backendContext?: { [key: string]: string },
        images?: Array<{ data: string; mediaType: string }>
    ): Promise<StreamingResponse> {
        const sessionId = `gemini_frontend_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log(`🎨 [GeminiService] Starting frontend-only generation (${prompt.length} characters)`);
            console.log(`📊 [GeminiService] Session ID: ${sessionId}`);

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
                console.log(`🎯 [GeminiService] Auto-selected model for frontend: ${selectedModel} (${analysis.complexity} complexity)`);
            }

            console.log(`🌊 [GeminiService] Initiating frontend streaming request with ${selectedModel}...`);

            const controller = new AbortController();
            this.currentAbortController = controller;
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            try {
                const response = await fetch(`${this.baseUrl}/api/gemini/kontext/frontend/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        apiKey: apiKey,
                        prompt: prompt,
                        frontendPrompt: frontendPrompt,
                        preferredModel: selectedModel,
                        backendContext: backendContext || {},
                        images: images
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`🚨 [GeminiService] Frontend streaming API error ${response.status}:`, errorText);
                    this.currentAbortController = null;
                    throw new Error(`Frontend streaming API returned ${response.status}: ${errorText}`);
                }

                try {
                    const result = await this.processStreamingResponse(response, progressCallback, sessionId, controller);
                    this.currentAbortController = null;
                    return result;
                } catch (error) {
                    this.currentAbortController = null;
                    throw error;
                }

            } catch (fetchError) {
                clearTimeout(timeoutId);
                this.currentAbortController = null;
                
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    console.log('🛑 [GeminiService] Frontend request was aborted');
                    progressCallback({
                        type: 'error',
                        message: 'Request was cancelled'
                    });
                    throw new Error('Request was cancelled');
                }
                
                throw fetchError;
            }

        } catch (error) {
            console.error('🚨 [GeminiService] Error in frontend streaming:', error);

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
        preferredModel?: 'pro-1.5' | 'flash-1.5',
        images?: Array<{ data: string; mediaType: string }>
    ): Promise<StreamingResponse> {
        const sessionId = `gemini_backend_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log(`🏗️ [GeminiService] Starting backend-only generation (${prompt.length} characters)`);
            console.log(`📊 [GeminiService] Session ID: ${sessionId}`);

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
                console.log(`🎯 [GeminiService] Auto-selected model for backend: ${selectedModel} (${analysis.complexity} complexity)`);
            }

            console.log(`🌊 [GeminiService] Initiating backend streaming request with ${selectedModel}...`);

            const controller = new AbortController();
            this.currentAbortController = controller;
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            try {
                const response = await fetch(`${this.baseUrl}/api/gemini/kontext/backend/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        apiKey: apiKey,
                        prompt: prompt,
                        backendPrompt: backendPrompt,
                        preferredModel: selectedModel,
                        images: images
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`🚨 [GeminiService] Backend streaming API error ${response.status}:`, errorText);
                    this.currentAbortController = null;
                    throw new Error(`Backend streaming API returned ${response.status}: ${errorText}`);
                }

                try {
                    const result = await this.processStreamingResponse(response, progressCallback, sessionId, controller);
                    this.currentAbortController = null;
                    return result;
                } catch (error) {
                    this.currentAbortController = null;
                    throw error;
                }

            } catch (fetchError) {
                clearTimeout(timeoutId);
                this.currentAbortController = null;
                
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    console.log('🛑 [GeminiService] Backend request was aborted');
                    progressCallback({
                        type: 'error',
                        message: 'Request was cancelled'
                    });
                    throw new Error('Request was cancelled');
                }
                
                throw fetchError;
            }

        } catch (error) {
            console.error('🚨 [GeminiService] Error in backend streaming:', error);

            progressCallback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown backend streaming error'
            });

            throw new Error(`Failed to send backend streaming request: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ========================================================================
    // STREAM PROCESSING
    // ========================================================================

    private async processStreamingResponse(
        response: Response,
        onProgress: (event: StreamEvent) => void,
        sessionId?: string,
        abortController?: AbortController
    ): Promise<StreamingResponse> {
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
        
        let deductionProcessed = false;

        try {
            console.log(`🌊 [GeminiService] Starting to process streaming response for session: ${sessionId || 'unknown'}`);

            onProgress({
                type: 'connected',
                message: 'Connected to streaming endpoint'
            });

            while (true) {
                if (abortController && abortController.signal.aborted) {
                    console.log('🛑 [GeminiService] Stream aborted during read loop');
                    throw new Error('Request was cancelled');
                }
                
                const { done, value } = await reader.read();
                if (done) {
                    console.log('🌊 [GeminiService] Stream naturally ended');
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
                            console.log('🏁 [GeminiService] Completion signal received:', dataStr);
                            
                            if (completionEventSent) {
                                console.warn('⚠️ [GeminiService] Duplicate [DONE] signal - ignoring');
                                continue;
                            }
                            
                            if (!deductionProcessed && finalUsage && await this.canAutoDeduct()) {
                                console.log('💳🔥 [GeminiService] FINAL DEDUCTION ATTEMPT (completion signal) 🔥💳');
                                await this.autoDeductUnits(finalUsage, sessionData.model || 'gemini-1.5-pro', sessionId, 'streaming_generation');
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
                                    console.log('🔗 [GeminiService] Connected to streaming endpoint');
                                    onProgress(eventData);
                                    break;

                                case 'progress':
                                    console.log(`📊 [GeminiService] Progress ${eventData.progress}% - ${eventData.message}`);
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
                                    console.log('🏁 [GeminiService] Streaming complete event received');
                                    
                                    if (completionEventSent) {
                                        console.warn('⚠️ [GeminiService] Duplicate complete event - ignoring');
                                        break;
                                    }
                                    
                                    if (eventData.files) {
                                        finalFiles = eventData.files;
                                        console.log(`📁 [GeminiService] Received ${Object.keys(finalFiles).length} files`);
                                    }
                                    if (eventData.analytics) {
                                        finalAnalytics = eventData.analytics;
                                    }
                                    if (eventData.sessionData) {
                                        sessionData = eventData.sessionData;
                                    }
                                    
                                    if (eventData.usage) {
                                        finalUsage = eventData.usage;
                                        console.log(`📊✅ [GeminiService] TOKEN USAGE CAPTURED FOR DEDUCTION:`, {
                                            inputTokens: finalUsage.input_tokens.toLocaleString(),
                                            outputTokens: finalUsage.output_tokens.toLocaleString(),
                                            totalTokens: finalUsage.total_tokens.toLocaleString(),
                                            model: sessionData.model,
                                            sessionId: sessionId
                                        });
                                    }
                                    
                                    if (!deductionProcessed && finalUsage && await this.canAutoDeduct()) {
                                        console.log('💳⚡ [GeminiService] PROCESSING AUTO-DEDUCTION (complete event) ⚡💳');
                                        await this.autoDeductUnits(finalUsage, sessionData.model || 'gemini-1.5-pro', sessionId, 'streaming_generation');
                                        deductionProcessed = true;
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
                                    console.error('🚨 [GeminiService] Streaming error -', eventData.message);
                                    onProgress(eventData);
                                    throw new Error(eventData.message || 'Streaming error occurred');

                                default:
                                    console.log(`🔍 [GeminiService] Unknown event type: ${eventData.type}`);
                                    onProgress(eventData);
                            }
                        } catch (parseError) {
                            console.warn('⚠️ [GeminiService] Error parsing SSE data:', parseError);
                            console.warn('Raw data:', dataStr.substring(0, 200));
                        }
                    }
                }
            }

            if (!deductionProcessed && finalUsage && await this.canAutoDeduct() && accumulatedContent.length > 0) {
                console.log('💳🚨 [GeminiService] FINAL SAFETY NET DEDUCTION ATTEMPT 🚨💳');
                await this.autoDeductUnits(finalUsage, sessionData.model || 'gemini-1.5-pro', sessionId, 'streaming_generation');
                deductionProcessed = true;
            }

            if (accumulatedContent.length > 0 && !completionEventSent) {
                console.log('🌊 [GeminiService] Stream naturally ended - sending completion event');
                completionEventSent = true;
                onProgress({
                    type: 'complete',
                    content: accumulatedContent,
                    files: finalFiles,
                    analytics: finalAnalytics,
                    sessionData: sessionData,
                    usage: finalUsage
                });
            }

        } catch (error) {
            console.error('🚨 [GeminiService] Error in stream processing:', error);
            
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('🛑 [GeminiService] Stream was aborted during processing');
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
        }

        console.log(`✅ [GeminiService] Streaming completed - ${accumulatedContent.length} chars, ${Object.keys(finalFiles).length} files`);

        return {
            content: accumulatedContent,
            files: finalFiles,
            analytics: finalAnalytics,
            sessionData: sessionData,
            usage: finalUsage
        };
    }

    // ========================================================================
    // MESSAGE CLASSIFICATION
    // ========================================================================

    async classifyMessage(
        message: string,
        context?: EnhancedClassificationContext,
        projectMetadata?: any
    ): Promise<EnhancedClassificationResponse> {
        const sessionId = `gemini_classify_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log('🔍 [GeminiService] Enhanced classification with project metadata:', {
                messageLength: message.length,
                hasContext: !!context,
                hasProjectMetadata: !!projectMetadata,
                sessionId
            });
            
            const apiKey = await this.getApiKey();
            
            const requestBody = {
                apiKey: apiKey,
                message: message,
                context: context || {},
                projectMetadata: projectMetadata || null
            };

            console.log('📡 [GeminiService] Calling enhanced classification endpoint...');

            const response = await fetch(`${this.baseUrl}/api/gemini/classify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ [GeminiService] Enhanced classification API error ${response.status}:`, errorText);
                throw new Error(`Enhanced classification API returned ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            
            let classificationResult;
            if (result.success && result.data) {
                classificationResult = result.data;
            } else if (!result.success && result.fallback) {
                classificationResult = result.fallback;
                console.warn('⚠️ [GeminiService] Classification failed, using fallback result');
            } else {
                classificationResult = result;
            }
            
            console.log(`✅ [GeminiService] Enhanced classification result: ${classificationResult.classification} (${classificationResult.confidence}% confidence)`);

            const usage = this.extractUsageFromResponse(classificationResult, 'gemini-1.5-flash');
            if (usage && await this.canAutoDeduct()) {
                console.log('💳 [GeminiService] Processing auto-deduction for enhanced message classification...');
                await this.autoDeductUnits(usage, 'gemini-1.5-flash', sessionId, 'message_classification_enhanced');
            }

            return {
                classification: classificationResult.classification,
                confidence: classificationResult.confidence,
                reasoning: classificationResult.reasoning,
                contextSelection: classificationResult.contextSelection || undefined,
                selectionReasoning: classificationResult.selectionReasoning || undefined,
                sessionId: classificationResult.sessionId || sessionId,
                usage: classificationResult.usage,
                model: classificationResult.model
            };

        } catch (error) {
            console.error('❌ [GeminiService] Error in enhanced message classification:', error);
            
            return {
                classification: 'REGULAR_CHAT',
                confidence: 0,
                reasoning: `Enhanced classification failed: ${error instanceof Error ? error.message : 'Unknown error'} - defaulting to conversational`,
                sessionId: sessionId
            };
        }
    }

    // ========================================================================
    // CHAT METHODS
    // ========================================================================

    async sendStreamingChat(
        messages: ChatMessage[],
        context: ChatContext,
        onProgress: (event: StreamEvent) => void,
        enabledMCPTools?: any[],
        images?: Array<{ data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }>,
        needsFileExtraction: boolean = true
    ): Promise<StreamingResponse> {
        const sessionId = `gemini_chat_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log('🌊 [GeminiService] Starting streaming chat');
            console.log(`📊 [GeminiService] Chat session ID: ${sessionId}`);
            if (images && images.length > 0) {
                console.log(`📷 [GeminiService] Including ${images.length} image(s) in chat request`);
            }
            
            if (!messages || messages.length === 0) {
                throw new Error('Messages array cannot be empty');
            }

            const apiKey = await this.getApiKey();
            
            const preparedContext = this.prepareAndValidateContext(context);

            console.log(`🚀 [GeminiService] STREAMING CHAT: Sending request with ${messages.length} messages`);

            const messagesWithContent = messages.map((m, index) => {
                if (m.role === 'user' && index === messages.length - 1 && images && images.length > 0) {
                    return {
                        role: m.role,
                        content: [
                            { type: 'text', text: m.content },
                            ...images.map(img => ({
                                type: 'image' as const,
                                inlineData: {
                                    mimeType: img.mediaType,
                                    data: img.data
                                }
                            }))
                        ]
                    };
                }
                return {
                    role: m.role,
                    content: m.content
                };
            });

            const controller = new AbortController();
            this.currentAbortController = controller;
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            try {
                const response = await fetch(`${this.baseUrl}/api/gemini/chat/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        apiKey: apiKey,
                        messages: messagesWithContent,
                        context: preparedContext,
                        needsFileExtraction: needsFileExtraction,
                        preferredModel: 'pro-1.5',
                        tokenBudget: 150000
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`🚨 [GeminiService] Chat streaming API error ${response.status}:`, errorText);
                    this.currentAbortController = null;
                    throw new Error(`Chat streaming API returned ${response.status}: ${errorText}`);
                }

                try {
                    const result = await this.processStreamingResponse(response, onProgress, sessionId, controller);
                    this.currentAbortController = null;
                    return result;
                } catch (error) {
                    this.currentAbortController = null;
                    throw error;
                }

            } catch (fetchError) {
                clearTimeout(timeoutId);
                this.currentAbortController = null;
                
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    console.log('🛑 [GeminiService] Chat request was aborted');
                    onProgress({
                        type: 'error',
                        message: 'Request was cancelled'
                    });
                    throw new Error('Request was cancelled');
                }
                
                throw fetchError;
            }

        } catch (error) {
            console.error('🚨 [GeminiService] Error in streaming chat:', error);

            onProgress({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown streaming chat error'
            });

            throw new Error(`Failed to send streaming chat: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async sendChat(
        messages: ChatMessage[],
        context: ChatContext,
        needsFileExtraction: boolean = true
    ): Promise<{content: string; files: { [key: string]: string }; reasoning?: string}> {
        const sessionId = `gemini_chat_nonstream_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        try {
            console.log('📄 [GeminiService] Sending non-streaming chat');
            console.log(`📊 [GeminiService] Non-streaming chat session ID: ${sessionId}`);
            
            const apiKey = await this.getApiKey();
            
            const preparedContext = this.prepareAndValidateContext(context);

            const response = await fetch(`${this.baseUrl}/api/gemini/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apiKey: apiKey,
                    messages: messages,
                    context: preparedContext,
                    needsFileExtraction: needsFileExtraction,
                    preferredModel: 'pro-1.5',
                    tokenBudget: 150000
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`🚨 [GeminiService] Chat API error ${response.status}:`, errorText);
                throw new Error(`Chat API returned ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            console.log(`✅ [GeminiService] Non-streaming chat complete - ${data.body?.content?.length || 0} chars`);

            const usage = this.extractUsageFromResponse(data.body, 'gemini-1.5-pro');
            if (usage && await this.canAutoDeduct()) {
                console.log('💳 [GeminiService] Processing auto-deduction for non-streaming chat...');
                await this.autoDeductUnits(usage, 'gemini-1.5-pro', sessionId, 'non_streaming_chat');
            }

            return {
                content: data.body?.content || '',
                files: data.body?.files || {},
                reasoning: data.body?.reasoning
            };

        } catch (error) {
            console.error('🚨 [GeminiService] Error in non-streaming chat:', error);
            throw new Error(`Failed to send non-streaming chat: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ========================================================================
    // CONTEXT PREPARATION
    // ========================================================================

    private prepareAndValidateContext(context: ChatContext): any {
        const prepared: any = {
            activeFile: context.activeFile || '',
            fileContent: context.fileContent || '',
            selectedFiles: context.selectedFiles || [],
            fileContents: context.fileContents || context.selectedFileContents || {},
            projectStructure: context.projectStructure || [],
            projectInfo: context.projectInfo || { id: '', name: '', type: '' }
        };

        if (context.aiRulesContext) {
            prepared.aiRulesContext = context.aiRulesContext;
        }
        if (context.documentationContext) {
            prepared.documentationContext = context.documentationContext;
        }
        if (context.githubContext) {
            prepared.githubContext = context.githubContext;
        }
        if (context.stylingContext) {
            prepared.stylingContext = context.stylingContext;
        }
        if (context.codeTemplatesContext) {
            prepared.codeTemplatesContext = context.codeTemplatesContext;
        }
        if (context.apiEndpointsContext) {
            prepared.apiEndpointsContext = context.apiEndpointsContext;
        }
        if (context.mcpContext) {
            prepared.mcpContext = context.mcpContext;
        }
        if (context.workflowContext) {
            prepared.workflowContext = context.workflowContext;
        }
        if (context.businessAgencyContext) {
            prepared.businessAgencyContext = context.businessAgencyContext;
        }
        if (context.agentContext) {
            prepared.agentContext = context.agentContext;
        }

        return prepared;
    }
}

// Export singleton instance
export const geminiService = new GeminiService();

