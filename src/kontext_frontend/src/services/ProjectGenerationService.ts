import { ClaudeService, StreamEvent } from '../claudeService';
import { AISpecGenerationService, SpecGenerationResult } from './AISpecGenerationService';
import { FileExtractor } from '../utils/fileExtractor';
import { wasmConfigService } from './WasmConfigService';
import { 
  TemplateRoutingService, 
  RouteResult, 
  Template, 
  routeUserRequest 
} from './TemplateRoutingService';
import { 
  TemplateManagerService, 
  TemplateContent, 
  fetchTemplateWithFallback 
} from './TemplateManagerService';
import { 
  TemplateIntegrationService, 
  enhanceBackendPrompt, 
  enhanceFrontendPrompt 
} from './TemplateIntegrationService';
import { 
  TemplateGenerationEvent, 
  TemplateProjectGenerationOptions, 
  TemplateProjectGenerationResult 
} from './TemplateGenerationTypes';
import { 
  generationLogger, 
  DebugContext,
  UserPromptData,
  TemplateRoutingData,
  GenerationPhaseData,
  FileExtractionData,
  GenerationSummaryData,
  setDebugContext,
  isDebugEnabled
} from './GenerationLoggingService';
import { messageCoordinator, CompletionData } from './MessageCoordinator';
import { fileDetectionPhaseManager } from './FileDetectionPhaseManager';

export type GenerationEvent = TemplateGenerationEvent;

export interface ProjectGenerationResult extends TemplateProjectGenerationResult {}

export interface ProjectGenerationOptions extends TemplateProjectGenerationOptions {
  // NEW: Enhanced callback for spec progress events
  onSpecProgress?: (event: StreamEvent) => void;
}

export interface BackendGenerationContext {
  motokoFiles: { [key: string]: string }; // Keep for Candid extraction, but don't pass to frontend
  candidInterface?: string;
  methodSignatures: Array<{ 
    name: string; 
    signature: string;
    type?: 'query' | 'update';
    parameters?: Array<{ name: string; type: string; required: boolean }>;
    returnType?: string;
  }>;
  dataModels: Array<{
    name: string;
    definition?: string;
    fields?: Array<{ name: string; type: string; optional: boolean }>;
  }> | string[]; // Support both old (string[]) and new format
  apiEndpoints: Array<{
    name: string;
    fullSignature?: string;
  }> | string[]; // Support both old (string[]) and new format
  templateContent?: TemplateContent;
  templateName?: string;
  routingConfidence?: number;
}

export class ProjectGenerationService {
  private static claudeService: ClaudeService | null = null;
  private static templateManager: TemplateManagerService = TemplateManagerService.getInstance();
  private static templateIntegration: TemplateIntegrationService = TemplateIntegrationService.getInstance();
  
  // Template configuration - ALWAYS use MotokoReactBible (no routing)
  private static readonly HARDCODED_TEMPLATE = 'MotokoReactBible';
  
  // URLs now fetched dynamically from platform configuration
  // Kept as fallback if config service fails
  private static readonly FALLBACK_BACKEND_PROMPT_URL = 'https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/backend_prompt.md';
  private static readonly FALLBACK_FRONTEND_PROMPT_URL = 'https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/frontend_prompt.md';
  private static readonly FALLBACK_BACKEND_RULES_URL = 'https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/backend_rules.md';
  private static readonly FALLBACK_FRONTEND_RULES_URL = 'https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/frontend_rules.md';

  private static async ensureClaudeService(): Promise<ClaudeService> {
    if (!this.claudeService) {
      console.log('🤖 [ProjectGenerationService] Initializing Claude service...');
      this.claudeService = new ClaudeService();
      
      // CRITICAL FIX: Perform health check before proceeding
      const healthCheck = await this.claudeService.healthCheck();
      if (!healthCheck.success) {
        throw new Error(`Claude service health check failed: ${healthCheck.error}`);
      }
      console.log('✅ [ProjectGenerationService] Claude service initialized and healthy');
    }
    return this.claudeService;
  }

  private static async fetchFallbackPrompt(url: string): Promise<string> {
    try {
      console.log(`📥 [ProjectGenerationService] Fetching fallback prompt from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch fallback prompt from ${url}: ${response.statusText}`);
      }
      const content = await response.text();
      console.log(`✅ [ProjectGenerationService] Fallback prompt fetched successfully (${content.length} characters)`);
      return content;
    } catch (error) {
      console.error(`❌ [ProjectGenerationService] Error fetching fallback prompt from ${url}:`, error);
      throw new Error(`Unable to load fallback generation prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // FIX: Add completion flag checking with proper callback filtering
  private static safeCallStreamingUpdate(options: ProjectGenerationOptions, content: string, generationState: any): void {
    try {
      // CRITICAL FIX: Only block if generation is FULLY completed AND all callbacks have been notified
      if (generationState?.fullyCompleted && generationState?.callbacksCompleted) {
        console.log('🛡️ [ProjectGenerationService] Blocked streaming update - generation fully completed with callbacks finished');
        return;
      }
      
      if (options.onStreamingContentUpdate && typeof options.onStreamingContentUpdate === 'function') {
        options.onStreamingContentUpdate(content);
      }
    } catch (error) {
      console.warn('⚠️ [ProjectGenerationService] Error in streaming content update callback:', error);
    }
  }

  private static getUserFriendlyDescription(userInput: string, templateName?: string): string {
    const input = userInput.toLowerCase();
    
    if (input.includes('calculator') || input.includes('math') || input.includes('compute')) {
      return 'calculator application';
    }
    if (input.includes('todo') || input.includes('task') || input.includes('list')) {
      return 'task management system';
    }
    if (input.includes('blog') || input.includes('post') || input.includes('article')) {
      return 'blog platform';
    }
    if (input.includes('chat') || input.includes('message') || input.includes('social')) {
      return 'messaging application';
    }
    if (input.includes('gallery') || input.includes('photo') || input.includes('image')) {
      return 'image gallery';
    }
    if (input.includes('shop') || input.includes('store') || input.includes('ecommerce')) {
      return 'e-commerce platform';
    }
    if (input.includes('dashboard') || input.includes('analytics') || input.includes('data')) {
      return 'analytics dashboard';
    }
    if (input.includes('game') || input.includes('puzzle') || input.includes('quiz')) {
      return 'interactive application';
    }
    if (input.includes('portfolio') || input.includes('showcase')) {
      return 'portfolio website';
    }
    if (input.includes('landing') || input.includes('website') || input.includes('page')) {
      return 'web application';
    }
    
    return 'application';
  }

  // CRITICAL FIX: Completely isolated debug operations with no state interference
  private static async handleIsolatedDebugPersistence(
    debugContext: DebugContext | null,
    generationSummaryData: GenerationSummaryData
  ): Promise<void> {
    // Early return if debug is disabled
    if (!isDebugEnabled() || !debugContext) {
      return;
    }

    try {
      console.log('🐛 [ProjectGeneration] Starting ISOLATED debug data persistence...');

      // Capture the summary data
      debugContext.captureGenerationSummary(generationSummaryData);
      
      // CRITICAL: Completely isolated persistence with no external callbacks or state updates
      await debugContext.persistAllDataSilently();
      
      console.log('✅ [ProjectGeneration] Debug data persisted successfully (ISOLATED operation)');
    } catch (persistError) {
      console.error(`❌ [ProjectGeneration] Debug persistence failed (ISOLATED operation):`, persistError);
      // CRITICAL: Silent failure - don't notify user or affect generation success
    }
  }

  // NEW: Project rename logic moved from chatActionsSlice
  private static async handleProjectRename(
    options: ProjectGenerationOptions,
    specResult: SpecGenerationResult | null,
    explicitProjectId: string  // CRITICAL FIX: Use explicit project ID parameter
  ): Promise<void> {
    // Early return if no rename capabilities provided
    if (!options.getProjectById || !options.updateProject || !options.updateProjectsInStore) {
      console.log('ℹ️ [ProjectGeneration] No rename capabilities provided - skipping project rename');
      return;
    }

    try {
      // CRITICAL FIX: Use explicit project ID instead of store lookup
      const currentProjectAfterGen = options.getProjectById(explicitProjectId);
      if (currentProjectAfterGen && currentProjectAfterGen.name === "New Project") {
        console.log('🚨🚨🚨 [PROJECT RENAME] STARTING RENAME PROCESS 🚨🚨🚨');
        console.log('📋 [PROJECT RENAME] Current project state:', {
          id: currentProjectAfterGen.id,
          name: currentProjectAfterGen.name,
          title: currentProjectAfterGen.title,
          explicitProjectId: explicitProjectId
        });
        
        const aiGeneratedName = this.extractProjectNameFromSpec(specResult);
        
        console.log('🤖 [PROJECT RENAME] AI Generated Name from Spec:', aiGeneratedName);
        console.log('📊 [PROJECT RENAME] Spec Result Object:', specResult);
        
        if (specResult?.spec) {
          console.log('📋 [PROJECT RENAME] Full Spec Content:', JSON.stringify(specResult.spec, null, 2));
        }
        
        if (aiGeneratedName) {
          console.log('✅ [PROJECT RENAME] Valid AI name found - proceeding with rename');
          console.log('🎯 [PROJECT RENAME] Renaming from "New Project" to:', aiGeneratedName);
          
          const updatedProject = {
            ...currentProjectAfterGen,
            name: aiGeneratedName,
            title: aiGeneratedName,
            updated: Date.now() // Force update timestamp for reactive updates
          };
          
          console.log('📝 [PROJECT RENAME] Updated project object:', {
            id: updatedProject.id,
            name: updatedProject.name,
            title: updatedProject.title,
            updated: updatedProject.updated
          });
          
          // Update the project in store AND trigger sidebar refresh
          const renameSuccess = await options.updateProject(updatedProject);
          
          if (renameSuccess) {
            console.log('🎉🎉🎉 [PROJECT RENAME] SUCCESS! Project renamed successfully 🎉🎉🎉');
            console.log('📍 [PROJECT RENAME] Project should now appear as:', aiGeneratedName, 'in sidebar');
            
            // CRITICAL FIX: Use explicit project ID in store update
            options.updateProjectsInStore((state: any) => {
              const projectIndex = state.projects.findIndex((p: any) => p.id === explicitProjectId);
              if (projectIndex !== -1) {
                // Create new projects array with updated project
                const newProjects = [...state.projects];
                newProjects[projectIndex] = {
                  ...state.projects[projectIndex],
                  name: aiGeneratedName,
                  title: aiGeneratedName,
                  updated: Date.now(),
                  time: 'Just now' // Update relative time
                };
                state.projects = newProjects;
                
                console.log('🔄 [PROJECT RENAME] Store updated with new project array');
                console.log('🎯 [PROJECT RENAME] Updated project in store:', newProjects[projectIndex]);
              }
            });
            
            // Also reload projects from canister to ensure consistency
            if (options.loadProjects) {
              setTimeout(() => {
                options.loadProjects!().then(() => {
                  console.log('🔄 [PROJECT RENAME] Projects reloaded from canister for consistency');
                });
              }, 1000);
            }
            
          } else {
            console.error('❌❌❌ [PROJECT RENAME] FAILED! UpdateProject returned false ❌❌❌');
          }
        } else {
          console.warn('⚠️⚠️⚠️ [PROJECT RENAME] No valid AI name found - keeping "New Project" ⚠️⚠️⚠️');
          console.log('🔍 [PROJECT RENAME] Spec extraction details:', {
            hasSpecResult: !!specResult,
            hasSpec: !!specResult?.spec,
            hasProjectMeta: !!specResult?.spec?.projectMeta,
            hasName: !!specResult?.spec?.projectMeta?.name,
            extractedName: aiGeneratedName
          });
        }
      } else {
        console.log('ℹ️ [PROJECT RENAME] Project already has proper name:', currentProjectAfterGen?.name || 'Unknown');
      }
    } catch (error) {
      console.error('❌ [PROJECT RENAME] Error during project rename:', error);
      // Don't throw - rename failure shouldn't fail generation
    }
  }

  public static async generateProject(options: ProjectGenerationOptions): Promise<ProjectGenerationResult> {
    const startTime = Date.now();
    const sessionId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`🚀 [ProjectGeneration] Starting generation session: ${sessionId}`);
    console.log(`🐛 [ProjectGeneration] Debug logging enabled: ${isDebugEnabled()}`);
    console.log(`🎭 [ProjectGeneration] Coordinating with MessageCoordinator - NO CRYPTO LANGUAGE`);
    console.log(`🔧 [ProjectGeneration] EXPLICIT PROJECT ID: ${options.projectId}`);  // CRITICAL FIX: Log explicit project ID
    console.log(`⚡ [ProjectGeneration] Using hardcoded template: ${this.HARDCODED_TEMPLATE} (no routing)`);
    
    const appType = this.getUserFriendlyDescription(options.userInput);
    
    let debugContext: DebugContext | null = null;
    
    // Only initialize debug context if debug is enabled
    if (isDebugEnabled()) {
      try {
        const identity = options.identity;
        if (identity) {
          debugContext = await generationLogger.initializeDebugSession(sessionId, identity);
          setDebugContext(debugContext);
          console.log(`🐛 [ProjectGeneration] Debug context initialized for session: ${sessionId}`);
        }
      } catch (error) {
        console.error(`❌ [ProjectGeneration] Failed to initialize debug context (continuing without debug):`, error);
        debugContext = null;
      }
    } else {
      console.log(`🐛 [ProjectGeneration] Debug logging is DISABLED - no debug context created`);
    }
    
    // Capture user prompt data if debug is enabled
    if (debugContext?.isDebugEnabled) {
      const userPromptData: UserPromptData = {
        sessionId,
        timestamp: startTime,
        userInput: options.userInput,
        projectId: options.projectId,
        projectName: options.projectName,
        requestContext: {
          hasExistingFiles: false,
          fileCount: 0,
          requestType: 'create_project'
        }
      };
      
      debugContext.captureUserPrompt(userPromptData);
    }
    
    const generationState = {
      generationPhaseComplete: false,
      deploymentDataReady: false,
      fullyCompleted: false,
      callbacksCompleted: false, // CRITICAL FIX: Track callback completion separately
      isPostProcessing: false,
      specResult: null as SpecGenerationResult | null,
      backendFiles: {} as { [key: string]: string },
      frontendFiles: {} as { [key: string]: string },
      allExtractedFiles: {} as { [key: string]: string },
      backendContext: null as BackendGenerationContext | null,
      accumulatedStreamContent: '',
      finalContent: '',
      success: false,
      error: null as string | null,
      routeResult: null as RouteResult | null,
      selectedTemplate: null as Template | null,
      templateContent: null as TemplateContent | null,
      routingTime: 0,
      fetchingTime: 0,
      clarificationQuestions: [] as string[],
      clarificationResponses: [] as string[],
      fallbackUsed: null as any,
      backendGenerationStartTime: 0,
      backendGenerationEndTime: 0,
      frontendGenerationStartTime: 0,
      frontendGenerationEndTime: 0,
      backendGenerationStarted: false,
      extractionStartTime: 0,
      extractionEndTime: 0,
      streamingEventCount: 0 // CRITICAL FIX: Track streaming events for proper completion detection
    };

    console.log('🚀 Starting enhanced project generation with NO CRYPTO LANGUAGE');

    try {
      // ENHANCED: Detailed service initialization with proper error handling
      console.log('🔧 [ProjectGeneration] Phase 0: Initializing services...');
      messageCoordinator.updateKLoadingMessage('Starting up...');
      
      let claudeService: ClaudeService;
      
      try {
        claudeService = await this.ensureClaudeService();
        console.log('✅ [ProjectGeneration] Claude service ready');
      } catch (serviceError) {
        console.error('❌ [ProjectGeneration] Claude service initialization failed:', serviceError);
        throw new Error(`Failed to initialize AI service: ${serviceError instanceof Error ? serviceError.message : 'Unknown service error'}`);
      }

      // PHASE 1: Generate Specification with enhanced transition - ALWAYS HAPPENS NOW
      console.log('📋 [ProjectGeneration] Phase 1: Generating project specification...');
      
      // ENHANCED: Use rich phase transition message (NO CRYPTO LANGUAGE)
      messageCoordinator.transitionToPhase('specification', {
        projectType: appType,
        userRequest: options.userInput, // 🔥 CRITICAL: Pass actual user request for better app name extraction
        complexity: this.analyzeComplexity(options.userInput),
        userFriendlyExplanation: this.getSpecificationTransitionMessage(appType, options.userInput)
      });

      try {
        console.log('🔬 [ProjectGeneration] ALWAYS generating AI specification (needed for project rename and metadata)');
        generationState.specResult = await AISpecGenerationService.generateSpecification(
          options.userInput,
          claudeService,
          (event: StreamEvent) => {
            if (generationState.fullyCompleted && generationState.callbacksCompleted) return;
            
            // CRITICAL: Pass spec progress events to chatActionsSlice for enhanced K animation
            if (options.onSpecProgress && typeof options.onSpecProgress === 'function') {
              try {
                options.onSpecProgress(event);
              } catch (specCallbackError) {
                console.warn('⚠️ [ProjectGeneration] Error in spec progress callback:', specCallbackError);
              }
            }
            
            switch (event.type) {
              case 'connected':
                console.log('🔗 [ProjectGeneration] Spec generation connected - K animation should be updating');
                break;
                
              case 'complete':
                console.log('✅ [ProjectGeneration] Spec generation complete - K animation should show completion');
                break;
                
              case 'error':
                console.error('❌ [ProjectGeneration] Specification generation error:', event.message);
                break;
            }
          }
        );
        console.log('✅ [ProjectGeneration] Specification generated successfully');
      } catch (specError) {
        console.error('❌ [ProjectGeneration] Specification generation failed:', specError);
        throw new Error(`Failed to analyze project requirements: ${specError instanceof Error ? specError.message : 'Specification error'}`);
      }

      if (generationState.specResult && !(generationState.fullyCompleted && generationState.callbacksCompleted)) {
        const specFileName = 'project-spec.json';
        const specContent = JSON.stringify(generationState.specResult.spec, null, 2);
        generationState.accumulatedStreamContent += `\n\n\`\`\`json\n// ${specFileName}\n${specContent}\n\`\`\`\n`;
        this.safeCallStreamingUpdate(options, generationState.accumulatedStreamContent, generationState);
      }

      // PHASE 2: Template Selection with SELECTIVE BYPASS - This is where the bypass happens now
      console.log('🎯 [ProjectGeneration] Phase 2: Template routing and selection...');
      
      const routingStartTime = Date.now();
      
      if (generationState.fullyCompleted && generationState.callbacksCompleted) return generationState as any;

      // ENHANCED: Rich template selection transition (NO CRYPTO LANGUAGE)
      messageCoordinator.transitionToPhase('template_selection', {
        projectType: appType,
        userRequest: options.userInput, // 🔥 CRITICAL: Pass actual user request for better app name extraction
        complexity: this.analyzeComplexity(options.userInput),
        technicalDetails: `Evaluating 12+ specialized templates`,
        userFriendlyExplanation: this.getTemplateSelectionTransitionMessage(appType, options.userInput)
      });

      // 🔥 SIMPLIFIED: Always use MotokoReactBible - no routing logic needed
      try {
        console.log(`⚡ [ProjectGeneration] Using MotokoReactBible template (hardcoded, no routing)`);
        
        generationState.routeResult = {
          templateName: this.HARDCODED_TEMPLATE,
          confidence: 1.0,
          reasoning: 'MotokoReactBible template (hardcoded)'
        };
        
        generationState.selectedTemplate = {
          name: this.HARDCODED_TEMPLATE,
          description: 'Motoko React Bible - Production template',
          keywords: [],
          requiresAuth: true,
          complexity: 'medium',
          examples: [],
          aiDescription: 'Production-ready Motoko React template',
          useCases: ['Professional web applications'],
          boundaries: ['Enterprise-grade architecture']
        };
        
        generationState.routingTime = Date.now() - routingStartTime;
        
        console.log(`✅ [ProjectGeneration] MotokoReactBible template selected in ${generationState.routingTime}ms`);
        
        messageCoordinator.updateKLoadingMessage(`Loading design patterns...`);
        
      } catch (error) {
        console.error('❌ [ProjectGeneration] Template selection failed:', error);
        throw new Error(`Template selection failed: ${error instanceof Error ? error.message : 'Template selection error'}`);
      }

      // Capture template routing data if debug is enabled
      if (debugContext?.isDebugEnabled && generationState.routeResult) {
        const templateRoutingData: TemplateRoutingData = {
          sessionId,
          timestamp: Date.now(),
          routingStartTime,
          routingEndTime: Date.now(),
          selectedTemplate: generationState.routeResult.templateName,
          confidence: generationState.routeResult.confidence,
          reasoning: generationState.routeResult.reasoning,
          alternatives: [],
          clarificationQuestions: undefined,
          fallbackUsed: false,
          fallbackReason: undefined
        };
        
        debugContext.captureTemplateRouting(templateRoutingData);
      }

      // 🔥 Template is always set - no need for validation since it's hardcoded
      if (!generationState.selectedTemplate) {
        throw new Error(`Template ${this.HARDCODED_TEMPLATE} not found - this should never happen`);
      }

      if (generationState.fullyCompleted && generationState.callbacksCompleted) return generationState as any;

      if (options.onTemplateSelected) {
        try {
          options.onTemplateSelected(
            generationState.routeResult.templateName,
            generationState.selectedTemplate,
            generationState.routeResult.confidence
          );
        } catch (error) {
          console.warn('⚠️ [ProjectGeneration] Error in template selection callback:', error);
        }
      }

      // PHASE 3: Template Fetching with enhanced transition
      console.log('📦 [ProjectGeneration] Phase 3: Loading template architecture...');
      
      // ENHANCED: Rich template fetching transition (NO CRYPTO LANGUAGE)
      messageCoordinator.transitionToPhase('template_fetching', {
        templateName: generationState.selectedTemplate.name,
        userRequest: options.userInput, // 🔥 CRITICAL: Pass actual user request for better app name extraction
        complexity: generationState.selectedTemplate.complexity as 'simple' | 'medium' | 'complex',
        technicalDetails: `Loading ${generationState.selectedTemplate.name} architectural patterns`,
        userFriendlyExplanation: this.getTemplateFetchingTransitionMessage(generationState.selectedTemplate.name, appType)
      });
      
      const fetchingStartTime = Date.now();

      if (generationState.fullyCompleted && generationState.callbacksCompleted) return generationState as any;

      try {
        const templateFetchResult = await fetchTemplateWithFallback(generationState.routeResult.templateName);
        generationState.fetchingTime = Date.now() - fetchingStartTime;

        if (templateFetchResult.success && templateFetchResult.content) {
          generationState.templateContent = templateFetchResult.content;
          
          if (!(generationState.fullyCompleted && generationState.callbacksCompleted)) {
            messageCoordinator.updateKLoadingMessage(`Design patterns ready...`);
          }
          console.log('✅ [ProjectGeneration] Template content loaded successfully');
        } else {
          console.warn('⚠️ [ProjectGeneration] Template fetch failed, using fallback generation');
          
          generationState.fallbackUsed = {
            originalTemplateName: generationState.routeResult.templateName,
            error: templateFetchResult.error || 'Unknown template fetch error',
            fallbackType: 'generic_prompts'
          };

          if (!(generationState.fullyCompleted && generationState.callbacksCompleted)) {
            messageCoordinator.updateKLoadingMessage('Using alternative templates...');
          }

          if (options.onTemplateFallback) {
            try {
              options.onTemplateFallback(generationState.routeResult.templateName, templateFetchResult.error || 'Template fetch failed');
            } catch (error) {
              console.warn('⚠️ [ProjectGeneration] Error in template fallback callback:', error);
            }
          }

          try {
            // Get URLs from platform configuration (with hardcoded fallback)
            const [backendPromptUrl, frontendPromptUrl, backendRulesUrl, frontendRulesUrl] = await Promise.all([
              wasmConfigService.getBackendPromptUrl().catch(() => this.FALLBACK_BACKEND_PROMPT_URL),
              wasmConfigService.getFrontendPromptUrl().catch(() => this.FALLBACK_FRONTEND_PROMPT_URL),
              wasmConfigService.getBackendRulesUrl().catch(() => this.FALLBACK_BACKEND_RULES_URL),
              wasmConfigService.getFrontendRulesUrl().catch(() => this.FALLBACK_FRONTEND_RULES_URL)
            ]);

            const [backendInstructions, frontendInstructions, backendRules, frontendRules] = await Promise.all([
              this.fetchFallbackPrompt(backendPromptUrl),
              this.fetchFallbackPrompt(frontendPromptUrl),
              this.fetchFallbackPrompt(backendRulesUrl),
              this.fetchFallbackPrompt(frontendRulesUrl)
            ]);

            generationState.templateContent = {
              name: generationState.routeResult.templateName,
              backendTemplate: '',
              frontendTemplate: '',
              backendInstructions,
              frontendInstructions,
              backendRules,
              frontendRules,
              fetchedAt: Date.now()
            };
            console.log('✅ [ProjectGeneration] Fallback template content loaded');
          } catch (fallbackError) {
            throw new Error(`Failed to load generation templates: ${fallbackError instanceof Error ? fallbackError.message : 'Template loading error'}`);
          }
        }
      } catch (fetchError) {
        console.error('❌ [ProjectGeneration] Template fetching failed:', fetchError);
        throw new Error(`Template loading failed: ${fetchError instanceof Error ? fetchError.message : 'Template fetch error'}`);
      }

      // PHASE 4: Backend Generation with enhanced transition and SEAMLESS HANDOFF
      console.log('🏗️ [ProjectGeneration] Phase 4: Starting backend generation...');
      
      // 🔥 CRITICAL: Mark that backend generation is starting (for validation later)
      generationState.backendGenerationStarted = true;
      
      // ENHANCED: Rich backend preparation transition (NO CRYPTO LANGUAGE)
      messageCoordinator.transitionToPhase('backend_preparation', {
        templateName: generationState.selectedTemplate.name,
        projectType: appType,
        userRequest: options.userInput, // 🔥 CRITICAL: Pass actual user request for better app name extraction
        technicalDetails: 'Preparing core system architecture',
        userFriendlyExplanation: this.getBackendPreparationTransitionMessage(generationState.selectedTemplate.name, appType)
      });
      
      // CRITICAL FIX: Add delay to let the phase transition message display
      await new Promise(resolve => setTimeout(resolve, 800));
      
      generationState.backendGenerationStartTime = Date.now();
      
      if (generationState.fullyCompleted && generationState.callbacksCompleted) return generationState as any;

      try {
        const backendResult = await this.generateTemplateEnhancedBackend(
          options, 
          generationState.specResult, 
          generationState.templateContent,
          generationState.selectedTemplate,
          generationState.routeResult,
          claudeService, 
          generationState.accumulatedStreamContent,
          debugContext,
          sessionId,
          appType,
          generationState
        );
        
        generationState.backendGenerationEndTime = Date.now();
        generationState.backendFiles = backendResult.files;
        generationState.accumulatedStreamContent = backendResult.accumulatedContent;
        
        if (Object.keys(generationState.backendFiles).length > 0) {
          generationState.allExtractedFiles = { ...generationState.allExtractedFiles, ...generationState.backendFiles };
          if (!(generationState.fullyCompleted && generationState.callbacksCompleted)) {
            options.onFileUpdate(generationState.allExtractedFiles, generationState.accumulatedStreamContent);
          }
        }
        
        const backendFileCount = Object.keys(generationState.backendFiles).length;
        console.log(`✅ [ProjectGeneration] Backend generation completed - ${backendFileCount} files`);
        
        // 🔥 CRITICAL: Validate that backend files were actually generated
        if (backendFileCount === 0) {
          console.warn('⚠️ [ProjectGeneration] Backend generation returned 0 files - waiting for streaming to complete...');
          
          // Wait a bit for streaming callbacks to finish processing
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Re-check backend files after waiting
          const retryBackendFileCount = Object.keys(generationState.backendFiles).length;
          if (retryBackendFileCount === 0) {
            console.error('❌ [ProjectGeneration] Backend generation produced no files after waiting');
            throw new Error('Backend generation failed: No backend files were generated. The AI may not have followed instructions to generate Motoko files.');
          } else {
            console.log(`✅ [ProjectGeneration] Backend files detected after wait: ${retryBackendFileCount} files`);
          }
        }
      } catch (backendError) {
        console.error('❌ [ProjectGeneration] Backend generation failed:', backendError);
        throw new Error(`Backend generation failed: ${backendError instanceof Error ? backendError.message : 'Backend generation error'}`);
      }

      // 🔥 CRITICAL: Ensure we have backend files before proceeding
      const finalBackendFileCount = Object.keys(generationState.backendFiles).length;
      if (finalBackendFileCount === 0) {
        throw new Error('Cannot proceed to frontend generation: No backend files were generated. Backend files (especially main.mo) are required before frontend generation.');
      }
      
      // 🔥 CRITICAL: Ensure main.mo exists (it's required for backend)
      const hasMainMo = Object.keys(generationState.backendFiles).some(fileName => 
        fileName.includes('main.mo') || fileName.endsWith('/main.mo') || fileName === 'main.mo'
      );
      if (!hasMainMo) {
        console.warn('⚠️ [ProjectGeneration] main.mo not found in backend files. Files generated:', Object.keys(generationState.backendFiles));
        // Don't throw - some projects might use different actor file names, but log a warning
      } else {
        console.log('✅ [ProjectGeneration] main.mo detected in backend files');
      }

      // PHASE 5: Backend Analysis with enhanced transition
      console.log('🔍 [ProjectGeneration] Phase 5: Analyzing backend architecture...');
      
      // ENHANCED: Rich backend analysis transition (NO CRYPTO LANGUAGE)
      messageCoordinator.transitionToPhase('backend_analysis', {
        fileCount: Object.keys(generationState.backendFiles).length,
        technicalDetails: 'Extracting interfaces, data models, and method signatures',
        userFriendlyExplanation: this.getBackendAnalysisTransitionMessage(Object.keys(generationState.backendFiles).length)
      });
      
      generationState.extractionStartTime = Date.now();
      
      if (generationState.fullyCompleted && generationState.callbacksCompleted) return generationState as any;
      
      try {
        generationState.backendContext = await this.extractBackendContext(
          generationState.backendFiles, 
          options,
          generationState.templateContent,
          generationState.selectedTemplate,
          generationState.routeResult
        );

        generationState.extractionEndTime = Date.now();
        console.log('✅ [ProjectGeneration] Backend context extraction completed');
      } catch (extractionError) {
        console.error('❌ [ProjectGeneration] Backend context extraction failed:', extractionError);
        // Continue without backend context - this is not fatal
        generationState.backendContext = null;
        generationState.extractionEndTime = Date.now();
      }

      // PHASE 6: Frontend Generation with enhanced transition and SEAMLESS HANDOFF
      console.log('🎨 [ProjectGeneration] Phase 6: Starting frontend generation...');
      
      // 🔥 CRITICAL: Ensure backend generation actually ran before proceeding
      if (!generationState.backendGenerationStarted) {
        throw new Error('Cannot proceed to frontend generation: Backend generation phase was never started. This indicates a critical flow error.');
      }
      
      // ENHANCED: Rich frontend preparation transition (NO CRYPTO LANGUAGE)
      messageCoordinator.transitionToPhase('frontend_preparation', {
        templateName: generationState.selectedTemplate.name,
        projectType: appType,
        userRequest: options.userInput, // 🔥 CRITICAL: Pass actual user request for better app name extraction
        technicalDetails: 'Analyzing core system for seamless frontend integration',
        userFriendlyExplanation: this.getFrontendPreparationTransitionMessage(generationState.selectedTemplate.name, appType)
      });
      
      // CRITICAL FIX: Add delay to let the phase transition message display
      await new Promise(resolve => setTimeout(resolve, 800));
      
      generationState.frontendGenerationStartTime = Date.now();
      
      if (generationState.fullyCompleted && generationState.callbacksCompleted) return generationState as any;

      try {
        const frontendResult = await this.generateTemplateEnhancedFrontend(
          options, 
          generationState.specResult, 
          generationState.templateContent,
          generationState.selectedTemplate,
          generationState.routeResult,
          generationState.backendContext, 
          claudeService, 
          generationState.accumulatedStreamContent,
          debugContext,
          sessionId,
          appType,
          generationState
        );
        
        generationState.frontendGenerationEndTime = Date.now();
        generationState.frontendFiles = frontendResult.files;
        generationState.accumulatedStreamContent = frontendResult.accumulatedContent;
        
        if (Object.keys(generationState.frontendFiles).length > 0) {
          generationState.allExtractedFiles = { ...generationState.allExtractedFiles, ...generationState.frontendFiles };
          if (!(generationState.fullyCompleted && generationState.callbacksCompleted)) {
            options.onFileUpdate(generationState.allExtractedFiles, generationState.accumulatedStreamContent);
          }
        }

        console.log(`✅ [ProjectGeneration] Frontend generation completed - ${Object.keys(generationState.frontendFiles).length} files`);
      } catch (frontendError) {
        console.error('❌ [ProjectGeneration] Frontend generation failed:', frontendError);
        throw new Error(`Frontend generation failed: ${frontendError instanceof Error ? frontendError.message : 'Frontend generation error'}`);
      }

      // Capture file extraction data if debug is enabled
      if (debugContext?.isDebugEnabled) {
        const backendFileNames = Object.keys(generationState.backendFiles);
        const frontendFileNames = Object.keys(generationState.frontendFiles);
        const allFileNames = Object.keys(generationState.allExtractedFiles);
        
        const filesByType = {
          motoko: allFileNames.filter(f => f.endsWith('.mo')),
          typescript: allFileNames.filter(f => f.endsWith('.ts') || f.endsWith('.tsx')),
          css: allFileNames.filter(f => f.endsWith('.css') || f.endsWith('.scss')),
          json: allFileNames.filter(f => f.endsWith('.json')),
          other: allFileNames.filter(f => !f.match(/\.(mo|tsx?|s?css|json)$/))
        };
        
        const fileExtractionData: FileExtractionData = {
          sessionId,
          timestamp: Date.now(),
          totalFiles: allFileNames.length,
          backendFiles: backendFileNames,
          frontendFiles: frontendFileNames,
          extractionSuccess: allFileNames.length > 0,
          parsingErrors: [],
          filesByType
        };
        
        debugContext.captureFileExtraction(fileExtractionData);
      }

      // PHASE 7: Configuration Generation with enhanced transition
      console.log('🔧 [ProjectGeneration] Phase 7: Configuration and platform integration...');
      
      // ENHANCED: Rich configuration transition (NO CRYPTO LANGUAGE)
      messageCoordinator.transitionToPhase('configuration_generation', {
        templateName: generationState.selectedTemplate.name,
        projectType: appType,
        userRequest: options.userInput, // 🔥 CRITICAL: Pass actual user request for better app name extraction
        fileCount: Object.keys(generationState.allExtractedFiles).length,
        technicalDetails: 'Generating project configurations and deployment setup',
        userFriendlyExplanation: this.getConfigurationTransitionMessage(generationState.selectedTemplate.name, appType)
      });
      
      if (generationState.fullyCompleted && generationState.callbacksCompleted) return generationState as any;
      
      generationState.generationPhaseComplete = true;
      generationState.isPostProcessing = true;
      
      try {
        await this.handlePostGeneration(
          generationState.allExtractedFiles, 
          options, 
          generationState.backendFiles, 
          generationState.frontendFiles,
          appType,
          generationState
        );
        console.log('✅ [ProjectGeneration] Post-generation processing completed');
      } catch (postGenError) {
        console.error('❌ [ProjectGeneration] Post-generation processing failed:', postGenError);
        // Continue - post-generation failures are not fatal
      }

      const totalTime = Date.now() - startTime;
      const totalFiles = Object.keys(generationState.allExtractedFiles).length;
      const backendFileCount = Object.keys(generationState.backendFiles).length;
      const frontendFileCount = Object.keys(generationState.frontendFiles).length;
      const timeInSeconds = Math.round(totalTime / 1000);
      
      // ENHANCED: Rich completion message with phase summary (NO CRYPTO LANGUAGE)
      const phaseInfo = messageCoordinator.getCurrentPhaseInfo();
      const phaseSummary = phaseInfo.history.length > 0 ? 
        `\n• Completed ${phaseInfo.history.length} generation phases in ${timeInSeconds}s` : '';
      
      generationState.finalContent = `${appType.charAt(0).toUpperCase() + appType.slice(1)} Generation Complete

═══════════════════════════════════════════════════════════

Project Architecture:
• ${totalFiles} files generated (${backendFileCount} backend, ${frontendFileCount} frontend)
• Complete core system with secure data management
• Modern React frontend with TypeScript and beautiful UI components
• Complete project configuration and deployment setup${phaseSummary}

Build Details:
• Template Used: ${generationState.selectedTemplate.name}
• Build Time: ${timeInSeconds}s
• Architecture: Full-stack web application
• Specification Generated: ${generationState.specResult ? 'Yes' : 'No'}${generationState.specResult ? ' (Project metadata available for renaming)' : ''}

═══════════════════════════════════════════════════════════

🚀 Your ${appType} is production-ready and can be deployed immediately using the deployment tools.

📋 Click the Deploy button below to launch your application!`;

      generationState.success = true;
      generationState.deploymentDataReady = true;

      // Save files to store
      if (Object.keys(generationState.allExtractedFiles).length > 0) {
        const allFilesToSave = { ...generationState.allExtractedFiles };
        
        // Add spec file if available
        if (generationState.specResult) {
          allFilesToSave['project-spec.json'] = JSON.stringify(generationState.specResult.spec, null, 2);
        }
        
        options.onFileUpdate(allFilesToSave, generationState.accumulatedStreamContent);
      }

      // NEW: Handle project rename BEFORE final completion
      console.log('🏷️ [ProjectGeneration] Phase 8: Project rename processing...');
      messageCoordinator.updateKLoadingMessage('Finalizing your project...');
      
      // CRITICAL FIX: Pass explicit project ID to project rename function
      await this.handleProjectRename(options, generationState.specResult, options.projectId);

      // ENHANCED: Prepare completion data for MessageCoordinator with deployment ready flag
      const completionData: CompletionData = {
        finalContent: generationState.finalContent,
        extractedFiles: { ...generationState.allExtractedFiles },
        templateUsed: {
          name: generationState.selectedTemplate.name,
          confidence: generationState.routeResult.confidence
        },
        deploymentReady: true,
        messageId: options.messageId || 'unknown'
      };

      // ENHANCED: Complete generation through MessageCoordinator with final phase
      messageCoordinator.transitionToPhase('complete', {
        projectType: appType,
        userRequest: options.userInput, // 🔥 CRITICAL: Pass actual user request for better app name extraction
        fileCount: totalFiles,
        technicalDetails: `Generated ${totalFiles} production-ready files`,
        userFriendlyExplanation: `🎉 ${appType.charAt(0).toUpperCase() + appType.slice(1)} generation complete! Ready for deployment.`
      });
      
      messageCoordinator.completeGeneration(generationState.finalContent, completionData);

      // CRITICAL: Emit final completion event with ALL deployment data FIRST - NO CONNECTED EVENTS
      options.onProgress({
        type: 'complete',
        message: generationState.finalContent,
        extractedFiles: { ...generationState.allExtractedFiles },
        templateUsed: {
          name: generationState.selectedTemplate.name,
          confidence: generationState.routeResult.confidence
        },
        // CRITICAL FIX: Add deployment ready flag
        deploymentReady: true,
        isProjectGeneration: true
      });

      // CRITICAL FIX: Wait for all callbacks to complete before setting completion flags
      await new Promise(resolve => setTimeout(resolve, 200));
      generationState.callbacksCompleted = true;

      // CRITICAL FIX: Set completion flag LAST
      generationState.fullyCompleted = true;
      generationState.isPostProcessing = false;

      // ISOLATED DEBUG PERSISTENCE - Happens AFTER everything is complete and isolated
      if (debugContext?.isDebugEnabled) {
        const generationSummaryData: GenerationSummaryData = {
          sessionId,
          timestamp: Date.now(),
          startTime,
          endTime: Date.now(),
          totalDuration: totalTime,
          success: true,
          
          userPrompt: options.userInput,
          projectContext: {
            projectId: options.projectId,
            projectName: options.projectName,
            hasExistingFiles: false
          },
          
          template: {
            name: generationState.selectedTemplate.name,
            confidence: generationState.routeResult.confidence,
            routingTime: generationState.routingTime,
            fetchingTime: generationState.fetchingTime,
            fallbackUsed: !!generationState.fallbackUsed,
            routingBypassed: true
          },
          
          performance: {
            totalTime,
            routingTime: generationState.routingTime,
            fetchingTime: generationState.fetchingTime,
            backendTime: generationState.backendGenerationEndTime - generationState.backendGenerationStartTime,
            frontendTime: generationState.frontendGenerationEndTime - generationState.frontendGenerationStartTime,
            extractionTime: generationState.extractionEndTime - generationState.extractionStartTime
          },
          
          results: {
            totalFiles,
            backendFiles: Object.keys(generationState.backendFiles).length,
            frontendFiles: Object.keys(generationState.frontendFiles).length,
            candidGenerated: Object.keys(generationState.allExtractedFiles).some(f => f.endsWith('.did')),
            platformFilesIntegrated: true
          },
          
          quality: {
            templateAdherence: 'high',
            codeCompleteness: totalFiles > 5 ? 1.0 : totalFiles / 5,
            extractionAccuracy: totalFiles > 0 ? 1.0 : 0,
            userSatisfactionPredicted: 'high'
          }
        };
        
        // CRITICAL FIX: ISOLATED debug persistence - completely separate from main flow
        this.handleIsolatedDebugPersistence(debugContext, generationSummaryData).catch(debugError => {
          // Silent failure - debug errors should never affect main generation
          console.warn(`🐛 [ProjectGeneration] Debug persistence failed silently:`, debugError);
        });
      }

      console.log('🎉 [ProjectGeneration] Generation completed successfully!');

      return {
        success: true,
        finalContent: generationState.finalContent,
        extractedFiles: { ...generationState.allExtractedFiles },
        backendFiles: { ...generationState.backendFiles },
        frontendFiles: { ...generationState.frontendFiles },
        specResult: generationState.specResult,
        templateUsed: {
          name: generationState.selectedTemplate.name,
          confidence: generationState.routeResult.confidence,
          routingTime: generationState.routingTime,
          fetchingTime: generationState.fetchingTime,
          wasUserSelected: !!options.preferredTemplateName,
          routingBypassed: true
        },
        clarificationQuestions: generationState.clarificationQuestions,
        clarificationResponses: generationState.clarificationResponses,
        fallbackUsed: generationState.fallbackUsed
      };

    } catch (error) {
      console.error('❌ [ProjectGeneration] Generation failed with error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // CRITICAL FIX: Set completion flags immediately on error
      generationState.callbacksCompleted = true;
      generationState.fullyCompleted = true;
      generationState.isPostProcessing = false;
      
      const errorContent = `**Generation Error**

An error occurred during ${appType} generation: ${errorMessage}

**Troubleshooting Steps:**
• Verify your internet connection is stable
• Try rephrasing your project requirements
• Check the console for detailed error information
• Contact support if the issue persists

**Technical Details:**
• Session: ${sessionId}
• Phase: ${generationState.templateContent ? 'Code Generation' : generationState.routeResult ? 'Template Loading' : 'Service Initialization'}
• Template: ${generationState.selectedTemplate?.name || 'Not selected'}
• Error Type: ${error instanceof Error ? error.constructor.name : 'Unknown'}
• Spec Generated: ${generationState.specResult ? 'Yes (available for debugging)' : 'No'}`;
      
      // ENHANCED: Error completion through MessageCoordinator with failure phase
      messageCoordinator.transitionToPhase('complete', {
        projectType: appType,
        technicalDetails: `Generation failed: ${errorMessage}`,
        userFriendlyExplanation: `❌ ${appType.charAt(0).toUpperCase() + appType.slice(1)} generation encountered an error.`
      });

      const errorCompletionData: CompletionData = {
        finalContent: errorContent,
        extractedFiles: { ...generationState.allExtractedFiles },
        deploymentReady: false,
        messageId: options.messageId || 'unknown'
      };

      messageCoordinator.completeGeneration(errorContent, errorCompletionData);

      // ISOLATED DEBUG PERSISTENCE for error case too
      if (debugContext?.isDebugEnabled) {
        const errorSummaryData: GenerationSummaryData = {
          sessionId,
          timestamp: Date.now(),
          startTime,
          endTime: Date.now(),
          totalDuration: Date.now() - startTime,
          success: false,
          error: errorMessage,
          
          userPrompt: options.userInput,
          projectContext: {
            projectId: options.projectId,
            projectName: options.projectName,
            hasExistingFiles: false
          },
          
          template: generationState.selectedTemplate ? {
            name: generationState.selectedTemplate.name,
            confidence: generationState.routeResult?.confidence || 0,
            routingTime: generationState.routingTime,
            fetchingTime: generationState.fetchingTime,
            fallbackUsed: !!generationState.fallbackUsed,
            routingBypassed: true
          } : {
            name: 'Unknown',
            confidence: 0,
            routingTime: 0,
            fetchingTime: 0,
            fallbackUsed: true,
            routingBypassed: true
          },
          
          performance: {
            totalTime: Date.now() - startTime,
            routingTime: generationState.routingTime,
            fetchingTime: generationState.fetchingTime,
            backendTime: generationState.backendGenerationEndTime - generationState.backendGenerationStartTime,
            frontendTime: generationState.frontendGenerationEndTime - generationState.frontendGenerationStartTime,
            extractionTime: generationState.extractionEndTime - generationState.extractionStartTime
          },
          
          results: {
            totalFiles: Object.keys(generationState.allExtractedFiles).length,
            backendFiles: Object.keys(generationState.backendFiles).length,
            frontendFiles: Object.keys(generationState.frontendFiles).length,
            candidGenerated: false,
            platformFilesIntegrated: false
          },
          
          quality: {
            templateAdherence: 'low',
            codeCompleteness: 0,
            extractionAccuracy: 0,
            userSatisfactionPredicted: 'low'
          }
        };
        
        // ISOLATED error debug persistence
        this.handleIsolatedDebugPersistence(debugContext, errorSummaryData).catch(debugError => {
          console.warn(`🐛 [ProjectGeneration] Error debug persistence failed silently:`, debugError);
        });
      }
      
      options.onProgress({
        type: 'error',
        message: errorContent,
        extractedFiles: { ...generationState.allExtractedFiles },
        templateError: {
          templateName: generationState.routeResult?.templateName || undefined,
          phase: generationState.templateContent ? 'generation' : generationState.routeResult ? 'fetching' : 'initialization',
          originalError: errorMessage
        }
      });

      return {
        success: false,
        finalContent: errorContent,
        extractedFiles: { ...generationState.allExtractedFiles },
        backendFiles: { ...generationState.backendFiles },
        frontendFiles: { ...generationState.frontendFiles },
        specResult: generationState.specResult,
        error: errorMessage,
        templateUsed: generationState.routeResult?.templateName ? {
          name: generationState.selectedTemplate?.name || 'Unknown',
          confidence: generationState.routeResult.confidence,
          routingTime: generationState.routingTime,
          fetchingTime: generationState.fetchingTime,
          wasUserSelected: !!options.preferredTemplateName,
          routingBypassed: true
        } : undefined,
        fallbackUsed: generationState.fallbackUsed
      };
    } finally {
      if (debugContext) {
        generationLogger.cleanupDebugSession(sessionId);
        setDebugContext(null);
      }
    }
  }

  // NEW: Enhanced transition message generators (NO CRYPTO LANGUAGE)
  private static analyzeComplexity(input: string): 'simple' | 'medium' | 'complex' {
    const lowerInput = input.toLowerCase();
    const complexTerms = ['enterprise', 'multi-user', 'real-time', 'analytics', 'dashboard', 'api integration'];
    const complexMatches = complexTerms.filter(term => lowerInput.includes(term)).length;
    
    if (complexMatches >= 2) return 'complex';
    if (complexMatches >= 1 || input.length > 100) return 'medium';
    return 'simple';
  }

  private static getSpecificationTransitionMessage(appName: string, userInput: string): string {
    // Simplified messages - no technical jargon
    if (appName.includes('todo') || appName.includes('task')) {
      return 'Understanding your task management needs...';
    }
    if (appName.includes('calculator')) {
      return 'Understanding your calculator requirements...';
    }
    if (appName.includes('ecommerce') || appName.includes('shop')) {
      return 'Understanding your store requirements...';
    }
    if (appName.includes('dashboard')) {
      return 'Understanding your dashboard needs...';
    }
    return `Understanding your ${appName} requirements...`;
  }

  private static getTemplateSelectionTransitionMessage(appName: string, userInput: string): string {
    // Simplified - don't mention template counts or technical details
    if (userInput.toLowerCase().includes('auth') || userInput.toLowerCase().includes('login')) {
      return 'Finding the best starting point with authentication...';
    }
    if (appName.includes('complex')) {
      return 'Finding the best starting point for your project...';
    }
    return `Finding the best starting point for your ${appName}...`;
  }

  private static getTemplateFetchingTransitionMessage(templateName: string, appType: string): string {
    // Don't mention template names - just say we're loading the blueprint
    return `Loading the blueprint for your ${appType}...`;
  }

  private static getBackendPreparationTransitionMessage(templateName: string, appType: string): string {
    // Don't mention template names - just describe what we're preparing
    if (templateName.includes('Auth')) {
      return `Preparing backend with authentication...`;
    }
    if (templateName.includes('Ecommerce')) {
      return `Preparing backend for e-commerce features...`;
    }
    return `Preparing backend system...`;
  }

  private static getBackendAnalysisTransitionMessage(fileCount: number): string {
    // Don't say "complete" - this is just a phase, not the entire project
    if (fileCount > 3) {
      return `Analyzing backend files for frontend integration...`;
    }
    return 'Extracting interfaces and data models for frontend...';
  }

  private static getFrontendPreparationTransitionMessage(templateName: string, appType: string): string {
    // Don't mention template names - just describe what we're doing
    if (templateName.includes('Auth')) {
      return `Preparing frontend with authentication...`;
    }
    if (appType.includes('dashboard')) {
      return 'Setting up dashboard interface...';
    }
    return `Preparing frontend interface...`;
  }

  private static getConfigurationTransitionMessage(templateName: string, appType: string): string {
    // Don't mention template names - just say we're configuring
    if (templateName.includes('Complex') || templateName.includes('Multi')) {
      return `Configuring deployment settings...`;
    }
    return `Setting up project configuration...`;
  }

  // CRITICAL FIX: FIXED BACKEND HANDOFF - Now matches frontend handoff pattern exactly
  private static async generateTemplateEnhancedBackend(
    options: ProjectGenerationOptions,
    specResult: SpecGenerationResult | null,
    templateContent: TemplateContent | null,
    selectedTemplate: Template,
    routeResult: RouteResult,
    claudeService: ClaudeService,
    currentAccumulatedContent: string,
    debugContext: DebugContext | null,
    sessionId: string,
    appType: string,
    generationState: any
  ): Promise<{ 
    files: { [key: string]: string }, 
    accumulatedContent: string,
    aiResponse?: any
  }> {
    let streamAccumulated = '';
    let accumulatedContent = currentAccumulatedContent || '';
    let streamingEvents = 0;
    let enhancedPrompt = '';

    try {
      console.log('🔧 [ProjectGenerationService] Preparing template-enhanced backend prompt...');
      
      // ENHANCED: Transition to backend generation phase (NO CRYPTO LANGUAGE)
      messageCoordinator.transitionToPhase('backend_generation', {
        templateName: selectedTemplate.name,
        projectType: appType,
        userRequest: options.userInput, // 🔥 CRITICAL: Pass actual user request for better app name extraction
        technicalDetails: 'Generating core system with production-ready business logic',
        userFriendlyExplanation: `Writing core system logic for your ${appType}...`
      });
      
      if (templateContent) {
        const enhancementResult = enhanceBackendPrompt(
          options.userInput,
          specResult,
          templateContent,
          selectedTemplate,
          routeResult
        );
        
        enhancedPrompt = enhancementResult.enhancedPrompt;
        
        console.log(`✅ [ProjectGenerationService] Template-enhanced backend prompt prepared (${enhancementResult.totalSize.toLocaleString()} chars)`);
      } else {
        console.log('⚠️ [ProjectGenerationService] Using fallback generic backend prompt...');
        
        // Get URLs from platform configuration (with hardcoded fallback)
        const [backendPromptUrl, backendRulesUrl] = await Promise.all([
          wasmConfigService.getBackendPromptUrl().catch(() => this.FALLBACK_BACKEND_PROMPT_URL),
          wasmConfigService.getBackendRulesUrl().catch(() => this.FALLBACK_BACKEND_RULES_URL)
        ]);
        
        const [genericPrompt, genericRules] = await Promise.all([
          this.fetchFallbackPrompt(backendPromptUrl),
          this.fetchFallbackPrompt(backendRulesUrl)
        ]);
        
        enhancedPrompt = this.templateIntegration.createFallbackPrompt(
          options.userInput,
          specResult,
          `${genericRules}\n\n${genericPrompt}`,
          selectedTemplate.name,
          'Template content unavailable'
        );
      }

      console.log(`🚀 [ProjectGenerationService] Starting template-enhanced backend streaming generation`);

      // CRITICAL FIX: SEAMLESS HANDOFF EXACTLY LIKE FRONTEND - This was missing!
      let streamingHasStarted = false;

      await claudeService.sendStreamingBackendPrompt(
        options.userInput,
        enhancedPrompt,
        async (event: StreamEvent) => {
          // CRITICAL FIX: Check completion flags properly
          if (generationState.fullyCompleted && generationState.callbacksCompleted) {
            console.log('🛡️ [Backend] Blocked stream event - fully completed');
            return;
          }
          
          streamingEvents++;
          generationState.streamingEventCount++;
          
          switch (event.type) {
            case 'connected':
              console.log('🔗 [Backend] Connected to streaming service - phase transition message active');
              break;
              
            case 'content_delta':
              if (event.content) {
                // CRITICAL FIX: SEAMLESS HANDOFF - Activate FileDetectionPhaseManager immediately
                // This is the KEY FIX that was missing for backend generation!
                if (!streamingHasStarted) {
                  streamingHasStarted = true;
                  console.log('📊 [Backend] Content detected - SEAMLESS handoff to FileDetectionPhaseManager');
                  
                  // Use seamless activation method - EXACTLY like frontend does!
                  fileDetectionPhaseManager.activateForStreaming();
                }
                
                streamAccumulated += event.content;
                accumulatedContent += event.content;
                
                // 🔥 CRITICAL FIX: Update generationState.accumulatedStreamContent during streaming
                // This ensures the callback has access to the latest accumulated content
                generationState.accumulatedStreamContent = accumulatedContent;
                
                this.safeCallStreamingUpdate(options, accumulatedContent, generationState);
                
                // 🔥 CRITICAL FIX: Use streamAccumulated (current backend phase only) for file detection
                // NOT accumulatedContent which includes all previous phases (spec, template, etc.)
                // This prevents frontend files from being detected during backend generation
                const extractionResult = FileExtractor.detectProgressiveFiles(streamAccumulated);
                const { completeFiles, inProgressFiles } = extractionResult;
                const allCurrentFiles = { ...completeFiles, ...inProgressFiles };
                
                // Create file detection state for FileDetectionPhaseManager
                const fileDetectionState: { [fileName: string]: 'detected' | 'writing' | 'complete' } = {};
                
                Object.keys(inProgressFiles).forEach(fileName => {
                  fileDetectionState[fileName] = 'writing';
                });
                
                Object.keys(completeFiles).forEach(fileName => {
                  fileDetectionState[fileName] = 'complete';
                });
                
                // Update FileDetectionPhaseManager which will update the K message
                fileDetectionPhaseManager.updateFileDetection(fileDetectionState);
                
                if (Object.keys(allCurrentFiles).length > 0 && !(generationState.fullyCompleted && generationState.callbacksCompleted)) {
                  options.onFileUpdate(allCurrentFiles, accumulatedContent);
                }
              }
              break;

            case 'complete':
              console.log('✅ [Backend] Streaming complete');
              // Mark completion in FileDetectionPhaseManager - EXACTLY like frontend does!
              if (streamingHasStarted) {
                fileDetectionPhaseManager.markComplete();
              }
              break;
              
            case 'error':
              console.error('❌ [Backend] Generation stream error:', event.message);
              break;
          }
        }
      );

      console.log(`📁 [ProjectGenerationService] Extracting files from generated content`);
      const extractionResult = FileExtractor.detectProgressiveFiles(streamAccumulated);
      const { completeFiles } = extractionResult;
      
      const backendFiles: { [key: string]: string } = {};
      Object.entries(completeFiles).forEach(([fileName, content]) => {
        if (this.isBackendFile(fileName)) {
          backendFiles[fileName] = content;
          console.log(`📄 [ProjectGenerationService] Backend file: ${fileName} (${content.length} chars)`);
        }
      });

      // Capture backend generation data if debug is enabled
      if (debugContext?.isDebugEnabled) {
        const backendGenerationData: GenerationPhaseData = {
          sessionId,
          phase: 'backend',
          timestamp: Date.now(),
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          inputPrompt: enhancedPrompt,
          fullResponse: streamAccumulated,
          templateUsed: selectedTemplate.name,
          enhancedInstructions: enhancedPrompt.substring(0, 1000) + '...',
          responseLength: streamAccumulated.length,
          streamingEvents,
          success: true
        };
        
        debugContext.captureGenerationPhase(backendGenerationData);
      }

      const aiResponse = {
        model: 'sonnet-4',
        responseLength: streamAccumulated.length,
        completeContent: streamAccumulated,
        streamingEvents,
        tokenUsage: undefined,
        error: undefined
      };

      console.log(`✅ [ProjectGenerationService] Backend generation produced ${Object.keys(backendFiles).length} files`);
      
      return { 
        files: backendFiles, 
        accumulatedContent,
        aiResponse
      };

    } catch (error) {
      console.error('❌ [ProjectGenerationService] Template-enhanced backend generation failed:', error);
      
      // Capture error in debug context if enabled
      if (debugContext?.isDebugEnabled) {
        const errorGenerationData: GenerationPhaseData = {
          sessionId,
          phase: 'backend',
          timestamp: Date.now(),
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          inputPrompt: enhancedPrompt,
          fullResponse: streamAccumulated,
          templateUsed: selectedTemplate.name,
          enhancedInstructions: enhancedPrompt.substring(0, 1000) + '...',
          responseLength: streamAccumulated.length,
          streamingEvents,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        debugContext.captureGenerationPhase(errorGenerationData);
      }
      
      throw new Error(`Backend generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async generateTemplateEnhancedFrontend(
    options: ProjectGenerationOptions,
    specResult: SpecGenerationResult | null,
    templateContent: TemplateContent | null,
    selectedTemplate: Template,
    routeResult: RouteResult,
    backendContext: BackendGenerationContext | null,
    claudeService: ClaudeService,
    currentAccumulatedContent: string,
    debugContext: DebugContext | null,
    sessionId: string,
    appType: string,
    generationState: any
  ): Promise<{ 
    files: { [key: string]: string }, 
    accumulatedContent: string,
    aiResponse?: any
  }> {
    let streamAccumulated = '';
    let accumulatedContent = currentAccumulatedContent || '';
    let streamingEvents = 0;
    let enhancedPrompt = '';

    try {
      console.log('🎨 [ProjectGenerationService] Preparing template-enhanced frontend prompt...');
      
      // ENHANCED: Transition to frontend generation phase (NO CRYPTO LANGUAGE)
      messageCoordinator.transitionToPhase('frontend_generation', {
        templateName: selectedTemplate.name,
        projectType: appType,
        userRequest: options.userInput, // 🔥 CRITICAL: Pass actual user request for better app name extraction
        technicalDetails: 'Building React components with TypeScript and modern UI patterns',
        userFriendlyExplanation: `Creating React frontend components for your ${appType}...`
      });
      
      let enhancementResult: ReturnType<typeof enhanceFrontendPrompt> | undefined;
      
      if (templateContent) {
        enhancementResult = enhanceFrontendPrompt(
          options.userInput,
          specResult,
          templateContent,
          selectedTemplate,
          routeResult,
          backendContext
        );
        
        enhancedPrompt = enhancementResult.enhancedPrompt;
        
        console.log(`✅ [ProjectGenerationService] Template-enhanced frontend prompt prepared`);
      } else {
        console.log('⚠️ [ProjectGenerationService] Using fallback generic frontend prompt...');
        
        // Get URLs from platform configuration (with hardcoded fallback)
        const [frontendPromptUrl, frontendRulesUrl] = await Promise.all([
          wasmConfigService.getFrontendPromptUrl().catch(() => this.FALLBACK_FRONTEND_PROMPT_URL),
          wasmConfigService.getFrontendRulesUrl().catch(() => this.FALLBACK_FRONTEND_RULES_URL)
        ]);
        
        const [genericPrompt, genericRules] = await Promise.all([
          this.fetchFallbackPrompt(frontendPromptUrl),
          this.fetchFallbackPrompt(frontendRulesUrl)
        ]);
        
        enhancedPrompt = this.templateIntegration.createFallbackPrompt(
          options.userInput,
          specResult,
          `${genericRules}\n\n${genericPrompt}`,
          selectedTemplate.name,
          'Template content unavailable'
        );
      }

      console.log(`🚀 [ProjectGenerationService] Starting template-enhanced frontend streaming generation`);

      // CRITICAL FIX: SEAMLESS HANDOFF - FileDetectionPhaseManager takes over immediately when streaming starts
      let streamingHasStarted = false;
      
      // 🔥 TOKEN OPTIMIZATION: Summarize user input for frontend generation
      // The enhancedPrompt already contains the full user input via USER_REQUIREMENTS placeholder
      // We need a concise summary for the primary prompt parameter to avoid duplication
      const summarizedUserPrompt = this.summarizeUserPromptForFrontend(options.userInput, specResult);
      
      console.log(`📊 [ProjectGenerationService] Original user prompt: ${options.userInput.length} chars`);
      console.log(`📊 [ProjectGenerationService] Summarized user prompt: ${summarizedUserPrompt.length} chars (${Math.round((1 - summarizedUserPrompt.length / options.userInput.length) * 100)}% reduction)`);
      console.log(`📊 [ProjectGenerationService] Enhanced prompt length: ${enhancedPrompt.length} chars`);

      // 🔥 CRITICAL: Don't pass backendContext separately - it's already in enhancedPrompt via BACKEND_CONTEXT placeholder
      // The backend expects { [key: string]: string } (Motoko files), but we're not passing files anymore
      // All backend metadata is already included in the enhanced prompt, so passing it separately would duplicate it
      await claudeService.sendStreamingFrontendPrompt(
        summarizedUserPrompt, // Use summarized version - full details are in enhancedPrompt
        enhancedPrompt,    // Enhanced prompt with template instructions, rules, and backend context
        async (event: StreamEvent) => {
          // CRITICAL FIX: Check completion flags properly
          if (generationState.fullyCompleted && generationState.callbacksCompleted) {
            console.log('🛡️ [Frontend] Blocked stream event - fully completed');
            return;
          }
          
          streamingEvents++;
          generationState.streamingEventCount++;
          
          switch (event.type) {
            case 'connected':
              console.log('🔗 [Frontend] Connected to streaming service - phase transition message active');
              break;
              
            case 'content_delta':
              if (event.content) {
                // CRITICAL FIX: SEAMLESS HANDOFF - Activate FileDetectionPhaseManager immediately
                if (!streamingHasStarted) {
                  streamingHasStarted = true;
                  console.log('📊 [Frontend] Content detected - SEAMLESS handoff to FileDetectionPhaseManager');
                  
                  // Use seamless activation method
                  fileDetectionPhaseManager.activateForStreaming();
                }
                
                streamAccumulated += event.content;
                accumulatedContent += event.content;
                
                // 🔥 CRITICAL FIX: Update generationState.accumulatedStreamContent during streaming
                // This ensures the callback has access to the latest accumulated content
                generationState.accumulatedStreamContent = accumulatedContent;
                
                this.safeCallStreamingUpdate(options, accumulatedContent, generationState);
                
                // 🔥 CRITICAL FIX: Use streamAccumulated (current frontend phase only) for file detection
                // NOT accumulatedContent which includes ALL backend content from previous phases
                // This prevents backend files (like main.mo) from being detected during frontend generation
                const extractionResult = FileExtractor.detectProgressiveFiles(streamAccumulated);
                const { completeFiles, inProgressFiles } = extractionResult;
                const allCurrentFiles = { ...completeFiles, ...inProgressFiles };
                
                // Create file detection state for FileDetectionPhaseManager
                const fileDetectionState: { [fileName: string]: 'detected' | 'writing' | 'complete' } = {};
                
                Object.keys(inProgressFiles).forEach(fileName => {
                  fileDetectionState[fileName] = 'writing';
                });
                
                Object.keys(completeFiles).forEach(fileName => {
                  fileDetectionState[fileName] = 'complete';
                });
                
                // Update FileDetectionPhaseManager which will update the K message
                fileDetectionPhaseManager.updateFileDetection(fileDetectionState);
                
                if (Object.keys(allCurrentFiles).length > 0 && !(generationState.fullyCompleted && generationState.callbacksCompleted)) {
                  options.onFileUpdate(allCurrentFiles, accumulatedContent);
                }
              }
              break;

            case 'complete':
              console.log('✅ [Frontend] Streaming complete');
              // Mark completion in FileDetectionPhaseManager
              if (streamingHasStarted) {
                fileDetectionPhaseManager.markComplete();
              }
              break;
              
            case 'error':
              console.error('❌ [Frontend] Generation stream error:', event.message);
              break;
          }
        },
        'sonnet-4'
        // 🔥 REMOVED: backendContext parameter - it's already in enhancedPrompt via BACKEND_CONTEXT placeholder
        // This prevents duplication and reduces token usage significantly (saves ~10K+ tokens)
      );

      console.log(`📁 [ProjectGenerationService] Extracting files from generated content`);
      const extractionResult = FileExtractor.detectProgressiveFiles(streamAccumulated);
      const { completeFiles } = extractionResult;
      
      const frontendFiles: { [key: string]: string } = {};
      Object.entries(completeFiles).forEach(([fileName, content]) => {
        if (this.isFrontendFile(fileName)) {
          frontendFiles[fileName] = content;
          console.log(`📄 [ProjectGenerationService] Frontend file: ${fileName} (${content.length} chars)`);
        }
      });

      // Capture frontend generation data if debug is enabled
      if (debugContext?.isDebugEnabled) {
        const frontendGenerationData: GenerationPhaseData = {
          sessionId,
          phase: 'frontend',
          timestamp: Date.now(),
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          inputPromptParts: enhancementResult?.promptParts ? {
            criticalInstructions: {
              content: enhancementResult.promptParts.criticalInstructions,
              size: enhancementResult.promptParts.criticalInstructions.length
            },
            rules: {
              content: enhancementResult.promptParts.rules,
              size: enhancementResult.promptParts.rules.length
            },
            userRequirements: {
              content: enhancementResult.promptParts.userRequirements,
              size: enhancementResult.promptParts.userRequirements.length
            },
            projectSpec: {
              content: enhancementResult.promptParts.projectSpec,
              size: enhancementResult.promptParts.projectSpec.length
            },
            backendContext: {
              content: enhancementResult.promptParts.backendContext,
              size: enhancementResult.promptParts.backendContext.length
            },
            mainInstructions: {
              content: enhancementResult.promptParts.mainInstructions,
              size: enhancementResult.promptParts.mainInstructions.length
            },
            templateContext: {
              content: enhancementResult.promptParts.templateContext,
              size: enhancementResult.promptParts.templateContext.length
            },
            templateCode: {
              content: enhancementResult.promptParts.templateCode,
              size: enhancementResult.promptParts.templateCode.length
            },
            architectureExplanation: {
              content: enhancementResult.promptParts.architectureExplanation,
              size: enhancementResult.promptParts.architectureExplanation.length
            },
            backendIntegration: {
              content: enhancementResult.promptParts.backendIntegration,
              size: enhancementResult.promptParts.backendIntegration.length
            },
            customization: {
              content: enhancementResult.promptParts.customization,
              size: enhancementResult.promptParts.customization.length
            }
          } : undefined,
          fullResponse: streamAccumulated,
          templateUsed: selectedTemplate.name,
          enhancedInstructions: enhancedPrompt.substring(0, 1000) + '...',
          responseLength: streamAccumulated.length,
          streamingEvents,
          success: true
        };
        
        debugContext.captureGenerationPhase(frontendGenerationData);
      }

      const aiResponse = {
        model: 'sonnet-4',
        responseLength: streamAccumulated.length,
        completeContent: streamAccumulated,
        streamingEvents,
        tokenUsage: undefined,
        error: undefined
      };

      console.log(`✅ [ProjectGenerationService] Frontend generation produced ${Object.keys(frontendFiles).length} files`);
      
      return { 
        files: frontendFiles, 
        accumulatedContent,
        aiResponse
      };

    } catch (error) {
      console.error('❌ [ProjectGenerationService] Template-enhanced frontend generation failed:', error);
      
      // Capture error in debug context if enabled
      if (debugContext?.isDebugEnabled) {
        const errorGenerationData: GenerationPhaseData = {
          sessionId,
          phase: 'frontend',
          timestamp: Date.now(),
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          inputPrompt: enhancedPrompt,
          fullResponse: streamAccumulated,
          templateUsed: selectedTemplate.name,
          enhancedInstructions: enhancedPrompt.substring(0, 1000) + '...',
          responseLength: streamAccumulated.length,
          streamingEvents,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        debugContext.captureGenerationPhase(errorGenerationData);
      }
      
      throw new Error(`Frontend generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Keep all existing utility methods unchanged...
  private static async extractBackendContext(
    backendFiles: { [key: string]: string },
    options: ProjectGenerationOptions,
    templateContent?: TemplateContent | null,
    selectedTemplate?: Template | null,
    routeResult?: RouteResult | null
  ): Promise<BackendGenerationContext | null> {
    try {
      console.log('🔍 [ProjectGenerationService] Extracting backend context for frontend integration...');

      const motokoFiles: { [key: string]: string } = {};
      Object.entries(backendFiles).forEach(([fileName, content]) => {
        if (fileName.endsWith('.mo')) {
          motokoFiles[fileName] = content;
        }
      });

      if (Object.keys(motokoFiles).length === 0) {
        return null;
      }

      let candidInterface: string | undefined;
      let methodSignatures: Array<{ 
        name: string; 
        signature: string;
        type?: 'query' | 'update';
        parameters?: Array<{ name: string; type: string; required: boolean }>;
        returnType?: string;
      }> = [];

      // PATH 1: Try Candid extraction via dfxutils
      let candidExtractionWorked = false;
      try {
        if (options.onCandidExtraction) {
          const candidSuccess = await options.onCandidExtraction(motokoFiles, options.projectName);
          
          if (candidSuccess) {
            console.log('✅ [ProjectGenerationService] Candid extraction successful');
            
            // Retrieve Candid context from store
            try {
              const { useAppStore } = await import('../store/appStore');
              const storeState = useAppStore.getState();
              const candidContext = storeState.candidContext;
              
              // 🔥 VALIDATION: Validate Candid data from dfxutils
              if (candidContext?.isAvailable && candidContext.candid) {
                const candidText = candidContext.candid.trim();
                
                // Validation 1: Check if Candid text is not empty or just whitespace
                if (!candidText || candidText.length === 0) {
                  console.warn('⚠️ [ProjectGenerationService] Candid interface is empty - will extract from Motoko source');
                }
                // Validation 2: Check if it's a valid Candid service declaration
                else if (!candidText.startsWith('service') && !candidText.includes('service :')) {
                  console.warn('⚠️ [ProjectGenerationService] Candid interface does not contain service declaration - will extract from Motoko source');
                }
                // Validation 3: Check if service is empty
                else if (candidText === 'service : {}' || 
                         candidText === 'service: {}' ||
                         (candidText.includes('service : {}') && !candidText.match(/service\s*:\s*\{[^}]+/))) {
                  console.warn('⚠️ [ProjectGenerationService] Candid service is empty - will extract from Motoko source');
                }
                // Validation 4: Validate method signatures match Candid interface
                else {
                  candidInterface = candidText;
                  methodSignatures = candidContext.methods || [];
                  
                  // Validation 5: Check if we have methods and they're valid
                  if (methodSignatures.length === 0) {
                    // Try to extract methods from Candid text if store extraction failed
                    console.warn('⚠️ [ProjectGenerationService] No method signatures in store, extracting from Candid text...');
                    methodSignatures = this.extractMethodsFromCandidText(candidText);
                  }
                  
                  // Validation 6: Verify methods in Candid text match extracted signatures
                  const methodsInCandid = this.extractMethodNamesFromCandid(candidText);
                  const extractedMethodNames = methodSignatures.map(m => m.name);
                  const methodsMatch = methodsInCandid.length === extractedMethodNames.length &&
                                      methodsInCandid.every(name => extractedMethodNames.includes(name));
                  
                  if (!methodsMatch && methodsInCandid.length > 0) {
                    console.warn('⚠️ [ProjectGenerationService] Method signature mismatch - regenerating from Candid text');
                    methodSignatures = this.extractMethodsFromCandidText(candidText);
                  }
                  
                  // Final validation: Ensure we have valid data
                  if (candidInterface && methodSignatures.length > 0) {
                    candidExtractionWorked = true;
                    console.log(`✅ [ProjectGenerationService] Using validated Candid interface with ${methodSignatures.length} method signatures`);
                    console.log(`   Methods: ${methodSignatures.map(m => m.name).join(', ')}`);
                  } else {
                    console.warn('⚠️ [ProjectGenerationService] Candid validation failed - will extract from Motoko source');
                  }
                }
              } else {
                console.warn('⚠️ [ProjectGenerationService] Candid context not available in store - will extract from Motoko source');
              }
            } catch (storeError) {
              console.warn('⚠️ [ProjectGenerationService] Failed to retrieve Candid from store:', storeError);
            }
          } else {
            console.warn('⚠️ [ProjectGenerationService] Candid extraction returned false - will extract from Motoko source');
          }
        }
      } catch (candidError) {
        console.warn('⚠️ [ProjectGenerationService] Candid extraction failed, will extract from Motoko:', candidError);
      }

      // PATH 2: Fallback to Motoko source extraction if Candid didn't work
      if (!candidExtractionWorked || methodSignatures.length === 0) {
        console.log('📝 [ProjectGenerationService] Extracting metadata directly from Motoko source...');
        methodSignatures = this.extractEnhancedMethodSignatures(motokoFiles);
        console.log(`✅ [ProjectGenerationService] Extracted ${methodSignatures.length} method signatures from Motoko source`);
        
        // 🔥 CRITICAL: Generate pseudo-Candid interface from extracted signatures
        // This ensures AI has the same format regardless of /compile success/failure
        if (methodSignatures.length > 0 && !candidInterface) {
          const methodsText = methodSignatures
            .map(m => `  ${m.name} : ${m.signature};`)
            .join('\n');
          
          candidInterface = `service : {\n${methodsText}\n}`;
          console.log('✅ [ProjectGenerationService] Generated pseudo-Candid interface from Motoko source:');
          console.log(candidInterface);
        }
      }

      // Extract enhanced data models and API endpoints
      const dataModels = this.extractEnhancedDataModels(motokoFiles);
      const apiEndpoints = this.extractEnhancedApiEndpoints(motokoFiles);

      const context: BackendGenerationContext = {
        motokoFiles,
        candidInterface,
        methodSignatures,
        dataModels,
        apiEndpoints,
        templateContent,
        templateName: selectedTemplate?.name,
        routingConfidence: routeResult?.confidence
      };

      return context;

    } catch (error) {
      console.warn('⚠️ [ProjectGenerationService] Failed to extract backend context:', error);
      return null;
    }
  }

  private static isBackendFile(fileName: string): boolean {
    const backendPatterns = [
      fileName.endsWith('.mo'),
      fileName.endsWith('.did'),
      fileName.includes('/backend/'),
      fileName.includes('/canister/'),
      fileName.includes('/src/') && fileName.endsWith('.mo'),
      fileName.includes('main.mo'),
      fileName.includes('canister.mo'),
      fileName.includes('.toml') && (fileName.includes('mops') || fileName.includes('vessel')),
      fileName.includes('dfx.json')
    ];
    
    return backendPatterns.some(pattern => pattern);
  }

  private static isFrontendFile(fileName: string): boolean {
    const frontendPatterns = [
      fileName.endsWith('.tsx'),
      fileName.endsWith('.jsx'),
      fileName.endsWith('.ts') && !fileName.endsWith('.d.ts'),
      fileName.endsWith('.js'),
      fileName.endsWith('.css'),
      fileName.endsWith('.scss'),
      fileName.endsWith('.html'),
      fileName.includes('/frontend/'),
      fileName.includes('/components/'),
      fileName.includes('/pages/'),
      fileName.includes('/styles/'),
      fileName.includes('package.json'),
      fileName.includes('vite.config'),
      fileName.includes('tailwind.config'),
      fileName.includes('index.html')
    ];
    
    return frontendPatterns.some(pattern => pattern);
  }

  /**
   * Extract enhanced method signatures from Motoko source code
   * Handles: public func, public shared func, public shared(msg) func, public query func
   */
  /**
   * Convert Motoko types to Candid-style types for AI prompt compatibility
   * This ensures the AI can use the same type detection logic regardless of whether
   * we got types from /compile (true Candid) or fallback regex (Motoko syntax)
   */
  private static convertMotokoTypeToCandid(motokoType: string): string {
    // Handle optional types: ?Type -> opt type
    if (motokoType.startsWith('?')) {
      const innerType = motokoType.substring(1).trim();
      return `opt ${this.convertMotokoTypeToCandid(innerType)}`;
    }
    
    // Handle arrays: [Type] -> vec type
    const arrayMatch = motokoType.match(/^\[(.+)\]$/);
    if (arrayMatch) {
      return `vec ${this.convertMotokoTypeToCandid(arrayMatch[1].trim())}`;
    }
    
    // Handle Result<T, E> -> variant { ok: T; err: E }
    const resultMatch = motokoType.match(/^Result<(.+),\s*(.+)>$/);
    if (resultMatch) {
      const okType = this.convertMotokoTypeToCandid(resultMatch[1].trim());
      const errType = this.convertMotokoTypeToCandid(resultMatch[2].trim());
      return `variant { ok: ${okType}; err: ${errType} }`;
    }
    
    // Basic type conversions (Motoko -> Candid)
    const typeMap: { [key: string]: string } = {
      'Text': 'text',
      'Nat': 'nat',
      'Nat8': 'nat8',
      'Nat16': 'nat16',
      'Nat32': 'nat32',
      'Nat64': 'nat64',
      'Int': 'int',
      'Int8': 'int8',
      'Int16': 'int16',
      'Int32': 'int32',
      'Int64': 'int64',
      'Float': 'float64',
      'Bool': 'bool',
      'Principal': 'principal',
      'Blob': 'blob',
      'Null': 'null'
    };
    
    // Check if it's a basic type
    if (typeMap[motokoType]) {
      return typeMap[motokoType];
    }
    
    // Handle generic types like Option<T>
    const optionMatch = motokoType.match(/^Option<(.+)>$/);
    if (optionMatch) {
      return `opt ${this.convertMotokoTypeToCandid(optionMatch[1].trim())}`;
    }
    
    // For custom types (like Budget, Task, etc.), keep as-is (they're the same in both)
    return motokoType;
  }

  private static extractEnhancedMethodSignatures(
    motokoFiles: { [key: string]: string }
  ): Array<{ 
    name: string; 
    signature: string;
    type?: 'query' | 'update';
    parameters?: Array<{ name: string; type: string; required: boolean }>;
    returnType?: string;
  }> {
    const signatures: Array<{ 
      name: string; 
      signature: string;
      type?: 'query' | 'update';
      parameters?: Array<{ name: string; type: string; required: boolean }>;
      returnType?: string;
    }> = [];
    
    Object.entries(motokoFiles).forEach(([fileName, content]) => {
      // Match all variations: public func, public shared(msg) func, public query func
      const functionRegex = /public\s+(?:(?:shared\s*(?:\([^)]*\))?|query)\s+)?func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?::\s*(?:async\s+)?([^;{]+))?/g;
      
      let match;
      while ((match = functionRegex.exec(content)) !== null) {
        const methodName = match[1];
        const params = match[2] || '';
        const returnType = match[3]?.trim() || '()';
        
        // Determine if query or update
        const isQuery = content.substring(match.index, match.index + match[0].length).includes('query') ||
                       methodName.toLowerCase().startsWith('get') ||
                       methodName.toLowerCase().startsWith('list') ||
                       methodName.toLowerCase().startsWith('find');
        
        // Parse parameters and convert Motoko types to Candid
        const parameters: Array<{ name: string; type: string; required: boolean }> = [];
        if (params.trim()) {
          params.split(',')
            .map(p => p.trim())
            .filter(p => p && p !== 'msg') // Filter out 'msg' parameter from shared(msg)
            .forEach(param => {
              const parts = param.split(':');
              if (parts.length === 2) {
                const paramName = parts[0].trim();
                const paramType = parts[1].trim();
                // 🔥 CRITICAL: Convert Motoko type to Candid for AI prompt compatibility
                const candidType = this.convertMotokoTypeToCandid(paramType);
                parameters.push({
                  name: paramName,
                  type: candidType,  // Now in Candid format!
                  required: true
                });
              }
            });
        }
        
        // Convert return type to Candid format
        const candidReturnType = this.convertMotokoTypeToCandid(returnType);
        
        // Build Candid-style signature
        const paramList = parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        const signature = paramList 
          ? `(${paramList}) -> (${candidReturnType})`
          : `() -> (${candidReturnType})`;
        
        signatures.push({
          name: methodName,
          signature,
          type: isQuery ? 'query' : 'update',
          parameters,
          returnType: candidReturnType  // Candid format
        });
      }
    });
    
    return signatures;
  }

  /**
   * Extract enhanced data models with full type definitions
   */
  private static extractEnhancedDataModels(
    motokoFiles: { [key: string]: string }
  ): Array<{
    name: string;
    definition?: string;
    fields?: Array<{ name: string; type: string; optional: boolean }>;
  }> {
    const models: Array<{
      name: string;
      definition?: string;
      fields?: Array<{ name: string; type: string; optional: boolean }>;
    }> = [];
    
    Object.entries(motokoFiles).forEach(([fileName, content]) => {
      // Match type definitions: type TypeName = { ... }
      const typeRegex = /type\s+(\w+)\s*=\s*\{([^}]+)\}/g;
      
      let match;
      while ((match = typeRegex.exec(content)) !== null) {
        const typeName = match[1];
        const fieldsContent = match[2];
        
        // Extract fields
        const fields: Array<{ name: string; type: string; optional: boolean }> = [];
        const fieldRegex = /(\w+)\s*:\s*([^;,\n]+)/g;
        let fieldMatch;
        
        while ((fieldMatch = fieldRegex.exec(fieldsContent)) !== null) {
          const fieldName = fieldMatch[1];
          const fieldType = fieldMatch[2].trim();
          const isOptional = fieldType.includes('?') || fieldType.includes('Option');
          
          // 🔥 CRITICAL: Convert Motoko type to Candid for AI prompt compatibility
          const cleanedType = fieldType.replace('?', '').trim();
          const candidType = this.convertMotokoTypeToCandid(cleanedType);
          
          fields.push({
            name: fieldName,
            type: candidType,  // Now in Candid format!
            optional: isOptional
          });
        }
        
        models.push({
          name: typeName,
          definition: match[0],
          fields
        });
      }
      
      // Also match simple type aliases: type TypeName = SomeType;
      const aliasRegex = /type\s+(\w+)\s*=\s*([^;]+);/g;
      while ((match = aliasRegex.exec(content)) !== null) {
        const typeName = match[1];
        const aliasType = match[2].trim();
        
        // Only add if not already added as a record type
        if (!models.some(m => m.name === typeName)) {
          models.push({
            name: typeName,
            definition: match[0]
          });
        }
      }
    });
    
    return models;
  }

  /**
   * Extract enhanced API endpoints with full signatures
   */
  private static extractEnhancedApiEndpoints(
    motokoFiles: { [key: string]: string }
  ): Array<{
    name: string;
    fullSignature?: string;
  }> {
    const endpoints: Array<{
      name: string;
      fullSignature?: string;
    }> = [];
    
    Object.entries(motokoFiles).forEach(([fileName, content]) => {
      // Match all public function variations
      const functionRegex = /public\s+(?:(?:shared\s*(?:\([^)]*\))?|query)\s+)?func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?::\s*(?:async\s+)?([^;{]+))?/g;
      
      let match;
      while ((match = functionRegex.exec(content)) !== null) {
        const funcName = match[1];
        const params = match[2] || '';
        const returnType = match[3]?.trim() || '()';
        
        const fullSignature = params 
          ? `${funcName}(${params}): ${returnType}`
          : `${funcName}(): ${returnType}`;
        
        if (!endpoints.some(e => e.name === funcName)) {
          endpoints.push({
            name: funcName,
            fullSignature
          });
        }
      }
    });
    
    return endpoints;
  }

  /**
   * Extract method names from Candid interface text for validation
   */
  private static extractMethodNamesFromCandid(candidText: string): string[] {
    const methodNames: string[] = [];
    
    // Match method declarations in Candid: methodName : (params) -> (returns);
    const methodRegex = /(\w+)\s*:\s*\([^)]*\)\s*->\s*\([^)]*\)/g;
    let match;
    
    while ((match = methodRegex.exec(candidText)) !== null) {
      const methodName = match[1];
      if (methodName && !methodNames.includes(methodName)) {
        methodNames.push(methodName);
      }
    }
    
    return methodNames;
  }

  /**
   * Extract method signatures from Candid interface text
   * Used as fallback when store extraction fails or for validation
   */
  private static extractMethodsFromCandidText(candidText: string): Array<{ 
    name: string; 
    signature: string;
    type?: 'query' | 'update';
  }> {
    const methods: Array<{ 
      name: string; 
      signature: string;
      type?: 'query' | 'update';
    }> = [];
    
    // Match method declarations: methodName : (params) -> (returns);
    const methodRegex = /(\w+)\s*:\s*(\([^)]*\)\s*->\s*\([^)]*\))/g;
    let match;
    
    while ((match = methodRegex.exec(candidText)) !== null) {
      const methodName = match[1];
      const signature = match[2];
      
      // Determine if query (read-only) or update (modifying)
      // Query methods typically start with 'get', 'list', 'find', 'fetch'
      const isQuery = methodName.toLowerCase().startsWith('get') ||
                     methodName.toLowerCase().startsWith('list') ||
                     methodName.toLowerCase().startsWith('find') ||
                     methodName.toLowerCase().startsWith('fetch') ||
                     methodName.toLowerCase().startsWith('read');
      
      methods.push({
        name: methodName,
        signature: signature.trim(),
        type: isQuery ? 'query' : 'update'
      });
    }
    
    return methods;
  }

  // Keep old methods for backward compatibility
  private static extractDataModels(motokoFiles: { [key: string]: string }): string[] {
    const enhanced = this.extractEnhancedDataModels(motokoFiles);
    return enhanced.map(m => m.name);
  }

  private static extractApiEndpoints(motokoFiles: { [key: string]: string }): string[] {
    const enhanced = this.extractEnhancedApiEndpoints(motokoFiles);
    return enhanced.map(e => e.name);
  }

  /**
   * Summarize user prompt for frontend generation to reduce token usage
   * The enhanced prompt already contains full requirements, so we only need key points here
   */
  private static summarizeUserPromptForFrontend(
    userInput: string,
    specResult: SpecGenerationResult | null
  ): string {
    // If we have a spec, use it to create a concise summary
    if (specResult?.spec) {
      try {
        const spec = typeof specResult.spec === 'string' 
          ? JSON.parse(specResult.spec) 
          : specResult.spec;
        
        const projectMeta = spec.projectMeta || {};
        const coreRequirements = spec.coreRequirements || {};
        
        // Build concise summary from spec
        let summary = `Build frontend for: ${projectMeta.name || 'the application'}\n\n`;
        
        if (projectMeta.description) {
          summary += `Purpose: ${projectMeta.description}\n\n`;
        }
        
        if (coreRequirements.primaryGoal) {
          summary += `Primary Goal: ${coreRequirements.primaryGoal}\n\n`;
        }
        
        // Include ALL essential features (not just top 5) - they're already concise from the spec
        if (coreRequirements.essentialFeatures && Array.isArray(coreRequirements.essentialFeatures)) {
          const featuresList = coreRequirements.essentialFeatures.map((f: string) => `- ${f}`).join('\n');
          summary += `Essential Features:\n${featuresList}\n`;
        }
        
        // Include explicit requirements if available
        if (coreRequirements.explicitRequirements && Array.isArray(coreRequirements.explicitRequirements) && coreRequirements.explicitRequirements.length > 0) {
          const requirementsList = coreRequirements.explicitRequirements.map((r: string) => `- ${r}`).join('\n');
          summary += `\nExplicit Requirements:\n${requirementsList}\n`;
        }
        
        // Limit total summary to ~800 characters to keep it concise but informative
        // This allows for more features while still staying within token budget
        if (summary.length > 800) {
          // Truncate intelligently - keep project name, purpose, goal, and as many features as fit
          const baseInfo = `Build frontend for: ${projectMeta.name || 'the application'}\n\n` +
            (projectMeta.description ? `Purpose: ${projectMeta.description}\n\n` : '') +
            (coreRequirements.primaryGoal ? `Primary Goal: ${coreRequirements.primaryGoal}\n\n` : '');
          
          const remainingChars = 800 - baseInfo.length - 20; // 20 for "Essential Features:\n" and truncation
          
          if (coreRequirements.essentialFeatures && Array.isArray(coreRequirements.essentialFeatures)) {
            let featuresText = 'Essential Features:\n';
            for (const feature of coreRequirements.essentialFeatures) {
              const featureLine = `- ${feature}\n`;
              if (featuresText.length + featureLine.length <= remainingChars) {
                featuresText += featureLine;
              } else {
                featuresText += `... (${coreRequirements.essentialFeatures.length - coreRequirements.essentialFeatures.indexOf(feature)} more features)\n`;
                break;
              }
            }
            summary = baseInfo + featuresText;
          } else {
            summary = baseInfo.substring(0, 800) + '...';
          }
        }
        
        return summary;
      } catch (error) {
        console.warn('⚠️ [ProjectGenerationService] Failed to parse spec for summary, using fallback');
      }
    }
    
    // Fallback: Extract first few sentences or key phrases
    const lines = userInput.split('\n').filter(line => line.trim().length > 0);
    const firstSection = lines.slice(0, 3).join('\n');
    
    // If still too long, truncate to first 300 characters
    if (firstSection.length > 300) {
      return firstSection.substring(0, 300) + '...';
    }
    
    return firstSection || 'Generate frontend based on the detailed requirements in the prompt.';
  }

  private static async handlePostGeneration(
    allFiles: { [key: string]: string },
    options: ProjectGenerationOptions,
    backendFiles: { [key: string]: string },
    frontendFiles: { [key: string]: string },
    appType: string,
    generationState: any
  ): Promise<void> {
    try {
      console.log('🔧 [ProjectGenerationService] Starting post-generation processing...');

      // ENHANCED: Transition to platform integration phase (NO CRYPTO LANGUAGE)
      messageCoordinator.transitionToPhase('platform_integration', {
        projectType: appType,
        fileCount: Object.keys(allFiles).length,
        technicalDetails: 'Integrating with Kontext platform services and development tools',
        userFriendlyExplanation: `Integrating your ${appType} with Kontext platform services...`
      });

      if (options.onPlatformFilesIntegration) {
        try {
          console.log('⚙️ [ProjectGenerationService] Integrating platform-provided files...');
          await options.onPlatformFilesIntegration(options.projectId, options.projectName, allFiles);
          
          console.log('✅ [ProjectGenerationService] Platform files integration completed');
        } catch (configError) {
          console.error('❌ [ProjectGenerationService] Failed to add platform provided files:', configError);
          throw configError; // Re-throw to be handled by caller
        }
      }

      console.log('✅ [ProjectGenerationService] Post-generation processing completed');

    } catch (error) {
      console.error('❌ [ProjectGenerationService] Post-generation processing failed:', error);
      throw error; // Re-throw to be handled by caller
    }
  }

  public static extractProjectNameFromSpec(specResult: SpecGenerationResult | null): string | null {
    if (specResult?.spec?.projectMeta?.name && 
        specResult.spec.projectMeta.name !== "New Project" && 
        specResult.spec.projectMeta.name.trim().length > 0) {
      return specResult.spec.projectMeta.name.trim();
    }
    return null;
  }

  public static getHardcodedTemplateName(): string {
    return this.HARDCODED_TEMPLATE;
  }
}