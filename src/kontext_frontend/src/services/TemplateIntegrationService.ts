import { TemplateContent } from './TemplateManagerService';
import { Template, RouteResult } from './TemplateRoutingService';
import { SpecGenerationResult } from './AISpecGenerationService';

/**
 * Service for integrating templates into the generation prompts
 * Handles prompt enhancement, template injection, and context preparation
 */

export interface EnhancedPromptResult {
  enhancedPrompt: string;
  originalPromptSize: number;
  templateSize: number;
  rulesSize: number;
  totalSize: number;
  templateIncluded: boolean;
  promptParts?: {
    criticalInstructions: string;
    rules: string;
    userRequirements: string;
    projectSpec: string;
    backendContext: string;
    mainInstructions: string;
    templateContext: string;
    templateCode: string;
    architectureExplanation: string;
    backendIntegration: string;
    customization: string;
  };
}

export interface PromptEnhancementOptions {
  includeTemplateCode: boolean;
  includeArchitectureExplanation: boolean;
  customizeInstructions: boolean;
  optimizeForUserRequirements: boolean;
  includeRules: boolean;
}

export class TemplateIntegrationService {
  private static instance: TemplateIntegrationService;

  private constructor() {}

  public static getInstance(): TemplateIntegrationService {
    if (!TemplateIntegrationService.instance) {
      TemplateIntegrationService.instance = new TemplateIntegrationService();
    }
    return TemplateIntegrationService.instance;
  }

  /**
   * Enhance backend prompt with template content, instructions, and rules
   */
  public enhanceBackendPrompt(
    userInput: string,
    specResult: SpecGenerationResult | null,
    templateContent: TemplateContent,
    template: Template,
    routeResult: RouteResult,
    options: PromptEnhancementOptions = this.getDefaultEnhancementOptions()
  ): EnhancedPromptResult {
    console.log(`🔧 [Template Integration] Enhancing backend prompt for template ${template.name}`);

    const originalPrompt = templateContent.backendInstructions;
    const originalSize = originalPrompt.length;
    const rulesSize = templateContent.backendRules.length;
    
    // Start with rules if enabled
    let enhancedPrompt = '';
    
    // 🔥 CRITICAL: Explicit instruction to ONLY generate backend files
    enhancedPrompt += `
🚨🚨🚨 CRITICAL: BACKEND-ONLY GENERATION 🚨🚨🚨

You MUST generate ONLY backend files in this phase:
- ✅ Generate ONLY Motoko (.mo) files
- ✅ Generate ONLY backend code, data models, and business logic
- ❌ DO NOT generate any frontend files (.tsx, .ts, .css, .js, .jsx)
- ❌ DO NOT generate React components
- ❌ DO NOT generate TypeScript frontend code
- ❌ DO NOT generate HTML, CSS, or JavaScript files
- ❌ DO NOT generate configuration files (package.json, vite.config.ts, etc.)

The frontend will be generated in a SEPARATE phase AFTER backend generation completes.
Focus ONLY on backend/Motoko code in this response.

=== END CRITICAL INSTRUCTIONS ===

`;
    
    if (options.includeRules) {
      enhancedPrompt += this.buildRulesSection(templateContent.backendRules, 'backend');
    }
    
    // Build spec section with explicit instructions (backend doesn't need visual design emphasis)
    const specSection = specResult ? this.buildSpecSection(specResult.spec, 'backend') : 'No detailed specification available - generate based on user requirements';
    
    enhancedPrompt += this.replaceTemplatePlaceholders(originalPrompt, {
      USER_REQUIREMENTS: userInput,
      PROJECT_SPEC: specSection,
      TEMPLATE_NAME: template.name,
      TEMPLATE_DESCRIPTION: template.description,
      TEMPLATE_COMPLEXITY: template.complexity,
      ROUTING_CONFIDENCE: routeResult.confidence.toFixed(2),
      REQUIRES_AUTH: template.requiresAuth ? 'YES' : 'NO'
    });

    // Add template-specific context
    enhancedPrompt += this.buildTemplateContextSection(template, routeResult);

    // Include template code if enabled and available
    if (options.includeTemplateCode && templateContent.backendTemplate.trim().length > 0) {
      enhancedPrompt += this.buildTemplateCodeSection(templateContent.backendTemplate, 'backend', template);
    }

    // Add architecture explanation if requested
    if (options.includeArchitectureExplanation) {
      enhancedPrompt += this.buildArchitectureSection(template, 'backend');
    }

    // Add user requirement customizations
    if (options.customizeInstructions) {
      enhancedPrompt += this.buildCustomizationSection(userInput, template, specResult);
    }

    const templateSize = templateContent.backendTemplate.length;
    const totalSize = enhancedPrompt.length;

    console.log(`✅ [Template Integration] Backend prompt enhanced:`);
    console.log(`   Original instructions: ${originalSize.toLocaleString()} chars`);
    console.log(`   Backend rules: ${rulesSize.toLocaleString()} chars`);
    console.log(`   Template code: ${templateSize.toLocaleString()} chars`);
    console.log(`   Enhanced total: ${totalSize.toLocaleString()} chars`);

    return {
      enhancedPrompt,
      originalPromptSize: originalSize,
      templateSize,
      rulesSize,
      totalSize,
      templateIncluded: options.includeTemplateCode && templateSize > 0
    };
  }

  /**
   * Enhance frontend prompt with template content, backend context, instructions, and rules
   */
  public enhanceFrontendPrompt(
    userInput: string,
    specResult: SpecGenerationResult | null,
    templateContent: TemplateContent,
    template: Template,
    routeResult: RouteResult,
    backendContext: any,
    options: PromptEnhancementOptions = this.getDefaultEnhancementOptions()
  ): EnhancedPromptResult {
    console.log(`🎨 [Template Integration] Enhancing frontend prompt for template ${template.name}`);

    const originalPrompt = templateContent.frontendInstructions;
    const originalSize = originalPrompt.length;
    const rulesSize = templateContent.frontendRules.length;

    // Build parts separately for tracking
    const promptParts = {
      criticalInstructions: '',
      rules: '',
      userRequirements: '',
      projectSpec: '',
      backendContext: '',
      mainInstructions: '',
      templateContext: '',
      templateCode: '',
      architectureExplanation: '',
      backendIntegration: '',
      customization: ''
    };

    // Start with rules if enabled
    let enhancedPrompt = '';
    
    // 🔥 CRITICAL: Explicit instruction to ONLY generate frontend files
    promptParts.criticalInstructions = `
🚨🚨🚨 CRITICAL: FRONTEND-ONLY GENERATION 🚨🚨🚨

You MUST generate ONLY frontend files in this phase:
- ✅ Generate ONLY React/TypeScript files (.tsx, .ts)
- ✅ Generate ONLY CSS files (.css)
- ✅ Generate ONLY frontend components, hooks, and UI code
- ✅ Generate ONLY frontend configuration files (package.json, vite.config.ts, tailwind.config.js, etc.)
- ❌ DO NOT generate any backend files (.mo, Motoko code)
- ❌ DO NOT generate backend data models or business logic
- ❌ DO NOT regenerate backend code that was already created

The backend has ALREADY been generated in a previous phase.
Focus ONLY on frontend/React/TypeScript code in this response.

=== END CRITICAL INSTRUCTIONS ===

`;
    enhancedPrompt += promptParts.criticalInstructions;
    
    if (options.includeRules) {
      promptParts.rules = this.buildRulesSection(templateContent.frontendRules, 'frontend');
      enhancedPrompt += promptParts.rules;
    }

    // Build spec section with explicit instructions (frontend needs visual design emphasis)
    const specSection = specResult ? this.buildSpecSection(specResult.spec, 'frontend') : 'No detailed specification available - generate based on user requirements';
    promptParts.projectSpec = specSection;
    promptParts.userRequirements = `# PROMPT: ${userInput}`;
    
    // Build backend context section (pass specResult for actor name)
    promptParts.backendContext = this.buildBackendContextSection(backendContext, specResult);
    
    // Replace placeholders to create main instructions
    promptParts.mainInstructions = this.replaceTemplatePlaceholders(originalPrompt, {
      USER_REQUIREMENTS: userInput,
      PROJECT_SPEC: specSection,
      TEMPLATE_NAME: template.name,
      TEMPLATE_DESCRIPTION: template.description,
      TEMPLATE_COMPLEXITY: template.complexity,
      ROUTING_CONFIDENCE: routeResult.confidence.toFixed(2),
      REQUIRES_AUTH: template.requiresAuth ? 'YES' : 'NO',
      BACKEND_CONTEXT: promptParts.backendContext
    });
    enhancedPrompt += promptParts.mainInstructions;

    // Add template-specific context
    promptParts.templateContext = this.buildTemplateContextSection(template, routeResult);
    enhancedPrompt += promptParts.templateContext;

    // Include frontend template code if enabled and available
    if (options.includeTemplateCode && templateContent.frontendTemplate.trim().length > 0) {
      promptParts.templateCode = this.buildTemplateCodeSection(templateContent.frontendTemplate, 'frontend', template);
      enhancedPrompt += promptParts.templateCode;
    }

    // Add architecture explanation for frontend patterns
    if (options.includeArchitectureExplanation) {
      promptParts.architectureExplanation = this.buildArchitectureSection(template, 'frontend');
      enhancedPrompt += promptParts.architectureExplanation;
    }

    // Add backend integration guidance
    promptParts.backendIntegration = this.buildBackendIntegrationSection(template, backendContext);
    enhancedPrompt += promptParts.backendIntegration;

    // Add user requirement customizations
    if (options.customizeInstructions) {
      promptParts.customization = this.buildCustomizationSection(userInput, template, specResult);
      enhancedPrompt += promptParts.customization;
    }

    const templateSize = templateContent.frontendTemplate.length;
    const totalSize = enhancedPrompt.length;

    console.log(`✅ [Template Integration] Frontend prompt enhanced:`);
    console.log(`   Original instructions: ${originalSize.toLocaleString()} chars`);
    console.log(`   Frontend rules: ${rulesSize.toLocaleString()} chars`);
    console.log(`   Template code: ${templateSize.toLocaleString()} chars`);
    console.log(`   Enhanced total: ${totalSize.toLocaleString()} chars`);

    return {
      enhancedPrompt,
      originalPromptSize: originalSize,
      templateSize,
      rulesSize,
      totalSize,
      templateIncluded: options.includeTemplateCode && templateSize > 0,
      promptParts // Add the parts breakdown
    };
  }

  /**
   * Build rules section for AI understanding and compliance
   */
  private buildRulesSection(rules: string, type: 'backend' | 'frontend'): string {
    return `

=== ${type.toUpperCase()} GENERATION RULES ===

These rules must be followed when generating ${type} code:

${rules}

=== END ${type.toUpperCase()} RULES ===

`;
  }

  /**
   * Build spec section with explicit instructions for AI
   */
  private buildSpecSection(spec: any, type: 'backend' | 'frontend'): string {
    const specJson = JSON.stringify(spec, null, 2);
    
    let specSection = `=== PROJECT SPECIFICATION ===

This is the complete project specification generated from the user's requirements. You MUST follow this specification closely.

PROJECT SPECIFICATION JSON:
${specJson}

CRITICAL INSTRUCTIONS FOR USING THIS SPECIFICATION:

1. **Core Requirements**: Follow the primaryGoal, essentialFeatures, and explicitRequirements exactly
2. **Architecture**: Use the minimalArchitecture section to guide your ${type === 'backend' ? 'entity and data model' : 'component'} structure
3. **Scope Boundaries**: Respect the included/excluded lists - do NOT add features outside the scope`;

    // Add visual design instructions only for frontend
    if (type === 'frontend' && spec.visualDesign) {
      specSection += `

4. **Visual Design (CRITICAL - OVERRIDES TEMPLATE DEFAULTS)**: 
   - The visualDesign section contains styling guidance that MUST be followed
   - ${spec.visualDesign.visualGuidance?.some((g: string) => g.includes('User-specified')) ? 
     '🚨 USER-SPECIFIED STYLING DETECTED: The user explicitly mentioned colors/style preferences - these take ABSOLUTE PRIORITY' : 
     'The styling is based on domain analysis - use these domain-appropriate colors'}
   - You MUST use the colorPalette colors instead of default template colors
   - Override any MotokoReactBible template default colors/cards with the spec's colorPalette
   - Follow the designStyle, layoutPreference, and typographyStyle exactly
   - Apply the visualGuidance notes to all styling decisions
   - The domain field (${spec.visualDesign.domain}) indicates the app type - style accordingly
   - DO NOT use generic template colors - use the spec's colorPalette colors

VISUAL DESIGN DETAILS (MUST FOLLOW):
Domain: ${spec.visualDesign.domain}
Color Palette (USE THESE COLORS):
  - Primary: ${spec.visualDesign.colorPalette?.primary || 'Not specified'} (use for main buttons, headers, primary actions)
  - Secondary: ${spec.visualDesign.colorPalette?.secondary || 'Not specified'} (use for secondary elements)
  - Accent: ${spec.visualDesign.colorPalette?.accent || 'Not specified'} (use for highlights, CTAs, important elements)
  - Background: ${spec.visualDesign.colorPalette?.background || 'Not specified'} (use for page/container backgrounds)
  - Text: ${spec.visualDesign.colorPalette?.text || 'Not specified'} (use for body text)
Design Style: ${spec.visualDesign.designStyle || 'Not specified'} (apply this aesthetic throughout)
Layout Preference: ${spec.visualDesign.layoutPreference || 'Not specified'} (use this layout pattern)
Typography Style: ${spec.visualDesign.typographyStyle || 'Not specified'} (apply this typography approach)
Visual Guidance:
${spec.visualDesign.visualGuidance?.map((note: string) => `  - ${note}`).join('\n') || '  - No specific guidance'}

🚨 CRITICAL: The visualDesign section takes ABSOLUTE PRECEDENCE over template default styling. 
If the spec specifies colors, you MUST use those colors. If it specifies a layout preference, you MUST use that layout style.
Do NOT default to MotokoReactBible's hardcoded colors - use the spec's domain-appropriate colors instead.`;
    } else if (type === 'frontend') {
      specSection += `

4. **Visual Design**: No specific visual design guidance in spec - use template defaults appropriately`;
    }

    specSection += `

=== END PROJECT SPECIFICATION ===

`;

    return specSection;
  }

  /**
   * Replace template placeholders in instructions
   */
  private replaceTemplatePlaceholders(prompt: string, placeholders: { [key: string]: string }): string {
    let enhancedPrompt = prompt;
    
    Object.entries(placeholders).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      enhancedPrompt = enhancedPrompt.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    return enhancedPrompt;
  }

  /**
   * Build template context section for AI understanding
   */
  private buildTemplateContextSection(template: Template, routeResult: RouteResult): string {
    return `

=== TEMPLATE SELECTION CONTEXT ===

Selected Template: ${template.name}
Description: ${template.description}
Complexity Level: ${template.complexity}
Authentication Required: ${template.requiresAuth ? 'YES' : 'NO'}
Selection Confidence: ${(routeResult.confidence * 100).toFixed(1)}%

Template Examples:
${template.examples.map(example => `• ${example}`).join('\n')}

Key Characteristics:
${template.keywords.slice(0, 10).map(keyword => `• Optimized for: ${keyword}`).join('\n')}

${routeResult.reasoning ? `Selection Reasoning: ${routeResult.reasoning}` : ''}

=== END TEMPLATE CONTEXT ===

`;
  }

  /**
   * Build template code reference section
   */
  private buildTemplateCodeSection(templateCode: string, type: 'backend' | 'frontend', template: Template): string {
    return `

=== ${type.toUpperCase()} TEMPLATE REFERENCE ===

The following is a complete, production-ready ${type} template for ${template.name}.
Use this as your foundation and extend/modify it based on the user requirements.

IMPORTANT INSTRUCTIONS:
1. This template represents best practices for ${template.description}
2. Maintain the existing architecture patterns and structure
3. Extend functionality rather than completely rewriting
4. Keep the same naming conventions and code organization
5. Ensure all modifications integrate seamlessly with the existing code

TEMPLATE CODE:
\`\`\`${type === 'backend' ? 'motoko' : 'tsx'}
${templateCode}
\`\`\`

=== END TEMPLATE REFERENCE ===

`;
  }

  /**
   * Build architecture explanation section
   */
  private buildArchitectureSection(template: Template, type: 'backend' | 'frontend'): string {
    const architectureGuides = {
      backend: {
        'StatelessQuery': 'Stateless functions with pure computation patterns',
        'SimpleCrudPublic': 'Simple CRUD with public data access patterns',
        'SimpleCrudAuth': 'Authentication-based CRUD with user ownership',
        'MultiEntityRelationships': 'Multi-entity relationships with proper foreign key handling',
        'MultiEntityAnalytics': 'Analytics aggregation with reporting capabilities',
        'HttpOutcallPublic': 'HTTP outcall patterns for external API integration',
        'HttpOutcallAuth': 'Authenticated API integration with user-specific data',
        'Ecommerce': 'E-commerce patterns with inventory and order management',
        'CRM': 'CRM workflows with contact and interaction tracking',
        'HRManagement': 'HR management with employee hierarchy and time tracking',
        'WorkflowApproval': 'Workflow approval systems with state machines',
        'Game': 'Game state management with player progression'
      },
      frontend: {
        'StatelessQuery': 'Simple UI with calculation forms and result display',
        'SimpleCrudPublic': 'Public data interface with community features',
        'SimpleCrudAuth': 'Personal dashboard with authentication flows',
        'MultiEntityRelationships': 'Multi-page application with data relationships',
        'MultiEntityAnalytics': 'Dashboard with charts, graphs, and analytics displays',
        'HttpOutcallPublic': 'Data display interface with external API integration',
        'HttpOutcallAuth': 'Interactive interface with API configuration',
        'Ecommerce': 'E-commerce UI with product catalogs and shopping cart',
        'CRM': 'CRM interface with contact management and pipelines',
        'HRManagement': 'HR dashboard with employee management features',
        'WorkflowApproval': 'Workflow interface with approval queues and status tracking',
        'Game': 'Game interface with interactive elements and score tracking'
      }
    };

    const architectureInfo = architectureGuides[type][template.name] || 'Standard patterns for this template type';

    return `

=== ARCHITECTURE GUIDANCE ===

${type.toUpperCase()} Architecture for ${template.name}:
${architectureInfo}

Key Patterns to Follow:
• Maintain consistent data flow patterns
• Follow established authentication patterns
• Use appropriate state management for complexity level
• Implement proper error handling and loading states
• Follow ICP best practices for ${type} development

=== END ARCHITECTURE GUIDANCE ===

`;
  }

  /**
   * Build backend context section for frontend generation
   */
  private buildBackendContextSection(backendContext: any, specResult?: any): string {
    if (!backendContext) {
      return 'Backend context not available - generate frontend with basic ICP canister integration patterns';
    }

    // 🔥 CRITICAL: Extract actor name from spec for proper Candid imports
    // This ensures AI generates: import { TodoApp } from '../candid/TodoApp.did.js'
    // Instead of: import { backend } from '../candid/backend.did.js'
    const actorName = specResult?.spec?.projectMeta?.actorName || 'Main';

    // Build rich context with enhanced metadata (no full file contents)
    const context: any = {
      actorName: actorName, // 🔥 NEW: Pass actor name to AI
      candidInterface: backendContext.candidInterface || 'Not available (generate basic integration patterns)',
      methodSignatures: backendContext.methodSignatures || [],
      dataModels: backendContext.dataModels || [],
      apiEndpoints: backendContext.apiEndpoints || []
    };

    // Add file count info (but not contents)
    if (backendContext.motokoFiles) {
      context.availableMotokoFiles = Object.keys(backendContext.motokoFiles);
      context.fileCount = Object.keys(backendContext.motokoFiles).length;
    }

    // Format enhanced metadata for better readability
    let contextString = JSON.stringify(context, null, 2);
    
    // Add human-readable summary if we have enhanced metadata
    if (Array.isArray(backendContext.methodSignatures) && backendContext.methodSignatures.length > 0) {
      const methodSummary = backendContext.methodSignatures
        .map((m: any) => `  - ${m.name}: ${m.signature || 'no signature'}${m.type ? ` (${m.type})` : ''}`)
        .join('\n');
      
      contextString = `=== BACKEND API INTERFACE ===\n${methodSummary}\n\n=== FULL CONTEXT ===\n${contextString}`;
    }
    
    // 🔥 CRITICAL: Add explicit instruction about using the actor name
    const actorInstruction = `\n\n🎯 CRITICAL ACTOR NAME INSTRUCTION:
The backend actor name is "${context.actorName}". When importing Candid files, you MUST use this actor name:
✅ CORRECT: import { ${context.actorName} } from '../candid/${context.actorName}.did.js';
❌ WRONG: import { backend } from '../candid/backend.did.js';
❌ WRONG: import { Main } from '../candid/Main.did.js' (unless the actor name is actually "Main");

All Candid imports must use the actor name "${context.actorName}".`;

    return contextString + actorInstruction;
  }

  /**
   * Build backend integration section for frontend
   */
  private buildBackendIntegrationSection(template: Template, backendContext: any): string {
    return `

=== BACKEND INTEGRATION GUIDANCE ===

Template-Specific Integration for ${template.name}:

${this.getIntegrationPatterns(template)}

Available Backend Context:
${backendContext ? '• Backend methods and data models detected' : '• Generate with basic ICP canister patterns'}
${backendContext?.methodSignatures?.length ? `• ${backendContext.methodSignatures.length} method signatures available` : '• No method signatures available'}
${backendContext?.candidInterface ? '• Candid interface available for type safety' : '• Generate without Candid interface'}

=== END INTEGRATION GUIDANCE ===

`;
  }

  /**
   * Get integration patterns specific to template type
   */
  private getIntegrationPatterns(template: Template): string {
    const patterns = {
      'StatelessQuery': '• Simple function calls with direct parameter passing\n• Display results immediately without complex state',
      'SimpleCrudPublic': '• Public data fetching with list/display patterns\n• No authentication required',
      'SimpleCrudAuth': '• User authentication flows with personal data management\n• CRUD operations with user ownership checks',
      'MultiEntityRelationships': '• Multi-entity data relationships\n• Navigation between related items\n• Proper loading states for complex queries',
      'MultiEntityAnalytics': '• Data aggregation display with charts/graphs\n• Report generation interfaces\n• Dashboard layout patterns',
      'HttpOutcallPublic': '• External API status display\n• Public data refresh patterns\n• Error handling for external services',
      'HttpOutcallAuth': '• User API key management\n• Personal external service integration\n• Result storage and history',
      'Ecommerce': '• Product catalog with search/filtering\n• Shopping cart management\n• Order processing workflows',
      'CRM': '• Contact management interfaces\n• Pipeline status displays\n• Activity tracking and logging',
      'HRManagement': '• Employee directory and profiles\n• Time tracking interfaces\n• Organizational hierarchy display',
      'WorkflowApproval': '• Approval workflow interfaces\n• Status tracking and notifications\n• Multi-step process management',
      'Game': '• Game interface with real-time updates\n• Score tracking and leaderboards\n• Player interaction patterns'
    };

    return patterns[template.name] || '• Standard CRUD patterns with proper state management';
  }

  /**
   * Build customization section based on user requirements
   */
  private buildCustomizationSection(userInput: string, template: Template, specResult: SpecGenerationResult | null): string {
    // Extract specific customizations from user input
    const customizations = this.extractCustomizations(userInput, template);
    
    if (customizations.length === 0) {
      return '';
    }

    return `

=== USER REQUIREMENT CUSTOMIZATIONS ===

Based on the user's specific requirements, pay special attention to:

${customizations.map(customization => `• ${customization}`).join('\n')}

Ensure these customizations are implemented while maintaining the core template architecture.

=== END CUSTOMIZATIONS ===

`;
  }

  /**
   * Extract specific customizations from user input
   */
  private extractCustomizations(userInput: string, template: Template): string[] {
    const customizations: string[] = [];
    const input = userInput.toLowerCase();

    // Color/theme customizations
    if (input.includes('color') || input.includes('theme') || input.includes('style')) {
      customizations.push('Custom color scheme and visual styling');
    }

    // Feature-specific customizations
    if (input.includes('mobile') || input.includes('responsive')) {
      customizations.push('Mobile-responsive design patterns');
    }

    if (input.includes('real-time') || input.includes('live')) {
      customizations.push('Real-time updates and live data synchronization');
    }

    if (input.includes('notification') || input.includes('alert')) {
      customizations.push('Notification and alert systems');
    }

    // Template-specific customizations
    if (template.name === 'Ecommerce') {
      if (input.includes('payment')) customizations.push('Payment processing integration');
      if (input.includes('inventory')) customizations.push('Inventory management features');
    }

    if (template.name === 'Game') {
      if (input.includes('multiplayer')) customizations.push('Multiplayer functionality');
      if (input.includes('leaderboard')) customizations.push('Leaderboard and ranking systems');
    }

    return customizations;
  }

  /**
   * Get default enhancement options
   */
  private getDefaultEnhancementOptions(): PromptEnhancementOptions {
    return {
      includeTemplateCode: true,
      includeArchitectureExplanation: true,
      customizeInstructions: true,
      optimizeForUserRequirements: true,
      includeRules: true
    };
  }

  /**
   * Validate enhanced prompt size for Claude compatibility
   */
  public validatePromptSize(enhancedPrompt: string, maxSize: number = 100000): { valid: boolean; size: number; recommendations: string[] } {
    const size = enhancedPrompt.length;
    const valid = size <= maxSize;
    const recommendations: string[] = [];

    if (!valid) {
      recommendations.push('Prompt exceeds recommended size for optimal Claude performance');
      recommendations.push(`Consider reducing template code inclusion (current: ${size.toLocaleString()} chars, max: ${maxSize.toLocaleString()})`);
      recommendations.push('Disable architecture explanations for simpler templates');
      recommendations.push('Use template code as reference rather than full inclusion');
      recommendations.push('Consider disabling rules inclusion for very large templates');
    } else if (size > maxSize * 0.8) {
      recommendations.push('Prompt size is approaching limits - monitor performance');
    }

    return { valid, size, recommendations };
  }

  /**
   * Create fallback prompt when template is unavailable
   */
  public createFallbackPrompt(
    userInput: string,
    specResult: SpecGenerationResult | null,
    originalInstructions: string,
    templateName: string,
    error: string
  ): string {
    return `${originalInstructions}

=== TEMPLATE FALLBACK NOTICE ===

Note: Template ${templateName} was requested but unavailable due to: ${error}

Proceeding with generic generation approach. Please ensure to:
1. Follow ICP best practices for code generation
2. Create production-ready, well-structured code
3. Include proper error handling and validation
4. Use appropriate design patterns for the detected use case

User Requirements: ${userInput}

${specResult ? `Project Specification: ${JSON.stringify(specResult.spec, null, 2)}` : ''}

=== END FALLBACK NOTICE ===

`;
  }
}

// Convenience exports
export const templateIntegration = TemplateIntegrationService.getInstance();

export function enhanceBackendPrompt(
  userInput: string,
  specResult: SpecGenerationResult | null,
  templateContent: TemplateContent,
  template: Template,
  routeResult: RouteResult,
  options?: PromptEnhancementOptions
): EnhancedPromptResult {
  return templateIntegration.enhanceBackendPrompt(userInput, specResult, templateContent, template, routeResult, options);
}

export function enhanceFrontendPrompt(
  userInput: string,
  specResult: SpecGenerationResult | null,
  templateContent: TemplateContent,
  template: Template,
  routeResult: RouteResult,
  backendContext: any,
  options?: PromptEnhancementOptions
): EnhancedPromptResult {
  return templateIntegration.enhanceFrontendPrompt(userInput, specResult, templateContent, template, routeResult, backendContext, options);
}