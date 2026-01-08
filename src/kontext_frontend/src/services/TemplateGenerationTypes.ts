import { Template, RouteResult, ClarificationQuestion } from './TemplateRoutingService';
import { TemplateContent } from './TemplateManagerService';
import { Identity } from '@dfinity/agent';
import { StreamEvent } from '../claudeService';

/**
 * Enhanced generation event types that include template routing and clarification support
 */

export type TemplateGenerationEvent = 
  | {
      type: 'template_routing_started';
      message?: string;
    }
  | {
      type: 'template_routing_complete';
      message: string;
      routeResult: RouteResult;
      selectedTemplate?: Template;
    }
  | {
      type: 'template_fetching_started';
      message?: string;
      templateName: string;
    }
  | {
      type: 'template_fetching_complete';
      message: string;
      templateName: string;
      templateContent: TemplateContent;
      cached: boolean;
    }
  | {
      type: 'clarification_needed';
      message: string;
      questions: string[];
      alternatives?: string[];
      routeResult: RouteResult;
      waitingForResponse: true;
    }
  | {
      type: 'clarification_received';
      message: string;
      userResponses: string[];
      finalTemplateName: string;
      finalTemplate: Template;
    }
  | {
      type: 'template_generation_enhanced';
      message: string;
      phase: 'backend' | 'frontend';
      templateName: string;
      templateSize: number;
      instructionsSize: number;
    }
  | {
      type: 'template_fallback_triggered';
      message: string;
      originalTemplateName: string;
      error: string;
      usingGenericPrompts: boolean;
    }
  | {
      type: 'progress';
      message?: string;
      phase?: 'template_routing' | 'template_fetching' | 'backend' | 'frontend' | 'integration';
      progress?: number;
    }
  | {
      type: 'content_delta';
      message?: string;
      content?: string;
      accumulatedLength?: number;
      phase?: 'template_routing' | 'template_fetching' | 'backend' | 'frontend' | 'integration';
      files?: { [key: string]: string };
    }
  | {
      type: 'complete';
      message: string;
      extractedFiles: { [key: string]: string };
      templateUsed?: {
        name: string;
        confidence: number;
      };
      deploymentReady?: boolean;
      isProjectGeneration?: boolean;
    }
  | {
      type: 'error';
      message: string;
      extractedFiles?: { [key: string]: string };
      templateError?: {
        templateName?: string;
        phase: 'routing' | 'fetching' | 'generation';
        originalError: string;
      };
    }
  | {
      type: 'connected';
      message?: string;
      phase?: 'template_routing' | 'template_fetching' | 'backend' | 'frontend' | 'integration';
    }
  | {
      type: 'phase_complete';
      message: string;
      phase: 'template_routing' | 'template_fetching' | 'backend' | 'frontend' | 'integration';
      extractedFiles: { [key: string]: string };
      templateInfo?: {
        name: string;
        confidence: number;
      };
    }
  | {
      type: 'file_update';
      message?: string;
      files: { [key: string]: string };
      extractedFiles?: { [key: string]: string };
    };

/**
 * Response to clarification questions
 */
export interface ClarificationResponse {
  responses: string[];
  selectedTemplateName?: string; // User can override template selection
  skipRemainingQuestions?: boolean;
}

/**
 * Enhanced project generation options with template support
 */
export interface TemplateProjectGenerationOptions {
  projectId: string;
  userInput: string;
  projectName: string;
  identity?: Identity; // Made optional for compatibility
  messageId?: string; // NEW: Added for MessageCoordinator integration
  onProgress: (event: TemplateGenerationEvent) => void;
  onFileUpdate: (files: { [key: string]: string }, accumulatedContent?: string) => void;
  onStreamingContentUpdate?: (content: string) => void; // Made optional for compatibility
  onCandidExtraction?: (files: { [key: string]: string }, projectName: string) => Promise<boolean>;
  onPlatformFilesIntegration?: (projectId: string, projectName: string, extractedFiles: { [key: string]: string }) => Promise<void>;
  
  // Template-specific callbacks
  onClarificationNeeded?: (questions: string[], alternatives: string[], routeResult: RouteResult) => Promise<ClarificationResponse>;
  onTemplateSelected?: (templateName: string, template: Template, confidence: number) => void;
  onTemplateFallback?: (originalTemplateName: string, error: string) => void;
  
  // Template preferences
  preferredTemplateName?: string; // Force a specific template (bypasses routing)
  allowClarificationQuestions?: boolean; // Default: true
  fallbackToGeneric?: boolean; // Default: true
  maxClarificationQuestions?: number; // Default: 3
  
  // NEW: Project rename functionality
  getProjectById?: (projectId: string) => any;
  updateProject?: (project: any) => Promise<boolean>;
  updateProjectsInStore?: (updater: (state: any) => void) => void;
  loadProjects?: () => Promise<void>;
  
  // NEW: Enhanced callback for spec progress events (compatible with new architecture)
  onSpecProgress?: (event: StreamEvent) => void;
}

/**
 * Enhanced project generation result with template information
 */
export interface TemplateProjectGenerationResult {
  success: boolean;
  finalContent: string;
  extractedFiles: { [key: string]: string };
  specResult?: any | null; // Made optional for compatibility, keep existing spec result type
  backendFiles: { [key: string]: string };
  frontendFiles: { [key: string]: string };
  error?: string;
  
  // Template-specific results
  templateUsed?: {
    name: string;
    confidence: number;
    routingTime: number;
    fetchingTime: number;
    wasUserSelected: boolean;
    routingBypassed?: boolean; // NEW: Support for routing bypass feature
  };
  clarificationQuestions?: string[];
  clarificationResponses?: string[];
  fallbackUsed?: {
    originalTemplateName: string;
    error: string;
    fallbackType: 'generic_prompts' | 'default_template';
  };
}

/**
 * Template-enhanced backend generation context
 */
export interface TemplateBackendGenerationContext {
  motokoFiles: { [key: string]: string };
  candidInterface?: string;
  methodSignatures: Array<{ name: string; signature: string }>;
  dataModels: string[];
  apiEndpoints: string[];
  
  // Template context
  templateContent?: TemplateContent; // Made optional for compatibility
  templateName?: string;
  routingConfidence?: number;
  enhancedInstructions?: string; // Instructions + template combined
}

/**
 * Template routing analytics data
 */
export interface TemplateRoutingAnalytics {
  sessionId: string;
  timestamp: number;
  userPrompt: string;
  promptLength: number;
  
  // Routing results
  selectedTemplateName: string | null;
  confidence: number;
  alternatives: string[];
  
  // Process metrics
  routingTime: number;
  fetchingTime?: number;
  totalProcessingTime: number;
  
  // User interaction
  clarificationQuestionsAsked: string[];
  clarificationResponsesReceived: string[];
  userOverrodeSelection: boolean;
  
  // Generation outcome
  generationSuccess: boolean;
  generationError?: string;
  filesGenerated: number;
  fallbackUsed: boolean;
  
  // Quality metrics
  userSatisfactionRating?: number; // 1-5, if collected
  userFeedbackText?: string;
}

/**
 * Template confidence thresholds for decision making
 */
export interface TemplateConfidenceThresholds {
  highConfidence: number; // Default: 0.80 - proceed automatically
  mediumConfidence: number; // Default: 0.60 - proceed with logging/optional questions
  lowConfidence: number; // Default: 0.40 - require clarification or fallback
}

/**
 * Template enhancement options
 */
export interface TemplateEnhancementOptions {
  includeExampleCode: boolean; // Include template as example in instructions
  includeArchitectureExplanation: boolean; // Explain template patterns
  customizeForUserRequirements: boolean; // Modify template based on specific needs
  optimizeForComplexity: boolean; // Adjust based on detected complexity
}

/**
 * Utility type for template-aware error handling
 */
export interface TemplateAwareError {
  type: 'routing_error' | 'fetching_error' | 'generation_error' | 'clarification_timeout';
  message: string;
  templateName?: string;
  phase: 'routing' | 'fetching' | 'backend_generation' | 'frontend_generation';
  recoverable: boolean;
  fallbackAvailable: boolean;
  userActionRequired: boolean;
}

/**
 * Template performance metrics
 */
export interface TemplatePerformanceMetrics {
  templateName: string;
  usageCount: number;
  averageConfidence: number;
  successRate: number;
  averageGenerationTime: number;
  userSatisfactionAverage: number;
  commonUserPrompts: string[];
  frequentIssues: string[];
  improvementSuggestions: string[];
}