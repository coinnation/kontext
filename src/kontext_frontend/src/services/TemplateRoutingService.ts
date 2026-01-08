// Complete file: src/frontend/src/services/TemplateRoutingService.ts
import { ClaudeService, StreamEvent } from '../claudeService';

// ============================================================================
// TEMPLATE DEFINITIONS - Enhanced with AI-friendly descriptions
// ============================================================================

export interface Template {
  name: string;
  description: string;
  keywords: string[];
  antiKeywords?: string[];
  requiresAuth: boolean;
  complexity: 'simple' | 'medium' | 'complex';
  examples: string[];
  // Enhanced for AI routing
  aiDescription: string;
  useCases: string[];
  boundaries: string[];
}

const AI_ENHANCED_TEMPLATES: Template[] = [
  {
    name: "StatelessQuery",
    description: "Pure computation with no storage",
    keywords: [
      "calculator", "converter", "convert", "calculate", "utility",
      "hello world", "demo", "fibonacci", "prime", "temperature",
      "currency", "percentage", "tip", "format", "transform"
    ],
    antiKeywords: ["store", "save", "remember", "database", "user"],
    requiresAuth: false,
    complexity: 'simple',
    examples: [
      "tip calculator",
      "temperature converter", 
      "fibonacci calculator",
      "hello world demo"
    ],
    aiDescription: "Stateless computation applications that perform calculations or transformations without storing any data. These are utility tools that take input, process it, and return results immediately.",
    useCases: [
      "Mathematical calculators and converters",
      "Data format transformers",
      "Simple algorithms and demonstrations",
      "Utility functions without persistence"
    ],
    boundaries: [
      "NO data storage or persistence",
      "NO user accounts or authentication", 
      "NO memory of previous operations",
      "Pure input → computation → output"
    ]
  },
  {
    name: "SimpleCrudPublic",
    description: "Single entity, no authentication, public access",
    keywords: [
      "message board", "guest book", "guestbook",
      "public", "shared", "community", "board", "guest",
      "everyone", "anonymous", "open", "collaborative", "wiki"
    ],
    antiKeywords: ["my", "personal", "private", "login", "user"],
    requiresAuth: false,
    complexity: 'simple',
    examples: [
      "public message board",
      "guest book",
      "community resource list",
      "shared wiki"
    ],
    aiDescription: "Public applications where anyone can view and contribute content. Single entity type (like messages or posts) with community access and no user ownership.",
    useCases: [
      "Public message boards and forums",
      "Guest books and comment systems",
      "Community resource sharing",
      "Anonymous collaboration tools"
    ],
    boundaries: [
      "NO user authentication required",
      "Single entity type (posts, messages, items)",
      "Public read/write access for everyone",
      "NO personal data or user ownership"
    ]
  },
  {
    name: "SimpleCrudAuth",
    description: "Single entity with user ownership",
    keywords: [
      "todo", "note", "notes", "bookmark", "personal", "my", "private",
      "journal", "diary", "list", "habit", "tracker", "reminder"
    ],
    antiKeywords: ["public", "shared", "team", "multiple", "relation"],
    requiresAuth: true,
    complexity: 'simple',
    examples: [
      "personal todo list",
      "private notes app",
      "bookmark manager",
      "habit tracker"
    ],
    aiDescription: "Personal productivity applications where authenticated users manage their own data. Single entity type with user ownership and privacy.",
    useCases: [
      "Personal todo lists and task managers",
      "Private note-taking applications",
      "Personal bookmark and link managers",
      "Individual habit and goal trackers"
    ],
    boundaries: [
      "Single entity type per user",
      "User authentication required",
      "Personal data ownership (my todos, my notes)",
      "NO relationships between different entity types"
    ]
  },
  {
    name: "MultiEntityRelationships",
    description: "Multiple related entities with foreign keys",
    keywords: [
      "project", "task", "blog", "post", "comment", "recipe", "ingredient",
      "course", "lesson", "album", "photo", "playlist", "song",
      "folder", "file", "category", "item", "parent", "child"
    ],
    antiKeywords: ["analytics", "report", "dashboard", "chart"],
    requiresAuth: true,
    complexity: 'medium',
    examples: [
      "project management with tasks",
      "blog with comments",
      "recipe manager with ingredients",
      "course platform with lessons"
    ],
    aiDescription: "Applications with multiple interconnected entity types that relate to each other. Projects have tasks, blogs have posts and comments, recipes have ingredients. Focus on relationships and data organization.",
    useCases: [
      "Project management systems (projects → tasks → subtasks)",
      "Content management (blogs → posts → comments)",
      "Educational platforms (courses → lessons → assignments)",
      "Media organization (albums → photos, playlists → songs)"
    ],
    boundaries: [
      "Multiple entity types that relate to each other",
      "Clear parent-child or association relationships",
      "User authentication with data ownership",
      "Focus on organization and relationships, NOT analytics"
    ]
  },
  {
    name: "MultiEntityAnalytics",
    description: "Related entities plus aggregations and reports",
    keywords: [
      "sales", "revenue", "analytics", "metrics", "dashboard", "report",
      "statistics", "stats", "chart", "graph", "trends", "performance",
      "aggregation", "summary", "insights", "kpi"
    ],
    antiKeywords: [],
    requiresAuth: true,
    complexity: 'medium',
    examples: [
      "sales tracker with reports",
      "social media with engagement metrics",
      "inventory with analytics dashboard",
      "performance monitoring system"
    ],
    aiDescription: "Applications that manage multiple related entities AND provide analytics, reporting, and data visualization on top of that data. Combines relationship management with business intelligence.",
    useCases: [
      "Sales tracking with revenue analytics",
      "Social media platforms with engagement metrics",
      "Inventory management with performance dashboards",
      "Any system needing both data management AND reporting"
    ],
    boundaries: [
      "Multiple related entity types",
      "Strong focus on analytics, reports, charts, trends",
      "Data aggregation and summarization features",
      "Dashboard and visualization requirements"
    ]
  },
  {
    name: "HttpOutcallPublic",
    description: "Fetch external data from public APIs",
    keywords: [
      "exchange rate", "public data",
      "price", "crypto", "bitcoin", "weather", "news", "feed", "rss",
      "stock", "api", "fetch", "external"
    ],
    antiKeywords: ["my", "personal", "user", "login", "api key"],
    requiresAuth: false,
    complexity: 'medium',
    examples: [
      "crypto price tracker",
      "weather app",
      "news aggregator",
      "exchange rate display"
    ],
    aiDescription: "Applications that fetch and display data from external public APIs. No user authentication required, focuses on displaying real-time external information.",
    useCases: [
      "Cryptocurrency price displays",
      "Weather information apps",
      "News aggregators and RSS readers",
      "Public market data displays"
    ],
    boundaries: [
      "Fetches data from external public APIs",
      "NO user authentication required",
      "NO personal API keys or user-specific data",
      "Focus on displaying external real-time information"
    ]
  },
  {
    name: "HttpOutcallAuth",
    description: "User-specific API calls with stored results",
    keywords: [
      "api key", "user api", "personal api", "ai powered",
      "ai", "gpt", "chatgpt", "openai", "assistant", "chat", "prompt",
      "integration", "translate", "generate"
    ],
    antiKeywords: ["public", "shared"],
    requiresAuth: true,
    complexity: 'medium',
    examples: [
      "AI note-taking assistant",
      "personal API integration tool",
      "AI-powered content generator",
      "translation app with user history"
    ],
    aiDescription: "Applications that make API calls using user-provided credentials (API keys) and store personalized results. Each user has their own API integrations and data history.",
    useCases: [
      "AI-powered personal assistants",
      "Custom API integration tools",
      "Personal translation services with history",
      "User-specific external service integrations"
    ],
    boundaries: [
      "Users provide their own API keys/credentials",
      "Personalized external service integration",
      "Store user-specific results and history",
      "Authentication required for API key management"
    ]
  },
  {
    name: "Ecommerce",
    description: "Products, inventory, orders, cart, reviews",
    keywords: [
      "e-commerce", "online store",
      "store", "shop", "ecommerce", "marketplace", "sell",
      "product", "inventory", "cart", "checkout", "order", "purchase",
      "payment", "seller", "buyer", "review", "rating", "stock"
    ],
    antiKeywords: [],
    requiresAuth: true,
    complexity: 'complex',
    examples: [
      "online store",
      "marketplace platform",
      "product catalog with orders",
      "digital goods store"
    ],
    aiDescription: "Full e-commerce platforms with products, inventory management, shopping cart, order processing, and customer management. Complex business workflows for online selling.",
    useCases: [
      "Online retail stores",
      "Marketplace platforms",
      "Digital product sales",
      "B2B wholesale systems"
    ],
    boundaries: [
      "Product catalog and inventory management",
      "Shopping cart and checkout processes",
      "Order management and fulfillment",
      "Customer accounts and purchase history"
    ]
  },
  {
    name: "CRM",
    description: "Contacts with pipeline stages and interactions",
    keywords: [
      "sales pipeline", "call log", "email log", "follow up",
      "crm", "contact", "customer", "client", "lead", "prospect",
      "pipeline", "deal", "opportunity", "interaction"
    ],
    antiKeywords: ["employee", "staff", "hr"],
    requiresAuth: true,
    complexity: 'medium',
    examples: [
      "customer relationship manager",
      "lead tracking system",
      "client database with interactions",
      "sales pipeline manager"
    ],
    aiDescription: "Customer relationship management systems that track contacts, sales pipelines, interactions, and deal progression. Focus on managing customer relationships and sales processes.",
    useCases: [
      "Sales pipeline and lead management",
      "Customer interaction tracking",
      "Deal and opportunity management",
      "Client relationship databases"
    ],
    boundaries: [
      "Contact and customer management",
      "Sales pipeline and deal tracking", 
      "Interaction history and follow-ups",
      "Focus on CUSTOMER relationships (not employee management)"
    ]
  },
  {
    name: "HRManagement",
    description: "Employees, time tracking, leave management, org charts",
    keywords: [
      "human resources", "team member", "time tracking", "clock in", "clock out",
      "time off", "org chart",
      "employee", "hr", "staff", "timesheet",
      "leave", "pto", "vacation", "manager", "department", "payroll"
    ],
    antiKeywords: ["customer", "client", "lead"],
    requiresAuth: true,
    complexity: 'complex',
    examples: [
      "employee directory",
      "time tracking system",
      "leave management system",
      "org chart with hierarchy"
    ],
    aiDescription: "Human resources management systems for managing employees, organizational structure, time tracking, leave management, and internal company processes.",
    useCases: [
      "Employee directory and profiles",
      "Time tracking and timesheet management",
      "Leave and vacation request systems",
      "Organizational hierarchy management"
    ],
    boundaries: [
      "Employee and staff management (NOT customers)",
      "Internal organizational processes",
      "Time tracking and leave management",
      "Company hierarchy and reporting structures"
    ]
  },
  {
    name: "WorkflowApproval",
    description: "Multi-step approvals with state machines and audit trails",
    keywords: [
      "multi-step", "audit trail",
      "approval", "approve", "workflow", "request", "submit", "review",
      "chain", "process", "state", "pending", "audit",
      "trail", "history", "log", "permission", "role"
    ],
    antiKeywords: [],
    requiresAuth: true,
    complexity: 'complex',
    examples: [
      "leave approval system",
      "purchase order approvals",
      "content moderation queue",
      "document approval workflow"
    ],
    aiDescription: "Applications built around multi-step approval processes with defined workflows, state management, and audit trails. Focus on process automation and approval chains.",
    useCases: [
      "Leave and vacation approval workflows",
      "Purchase order and expense approvals",
      "Content moderation and review processes",
      "Document approval and sign-off systems"
    ],
    boundaries: [
      "Multi-step approval processes",
      "Workflow state management",
      "Audit trails and history tracking",
      "Role-based approval permissions"
    ]
  },
  {
    name: "Game",
    description: "Games with player state, scores, leaderboards, sessions",
    keywords: [
      "high score", "single player", "board game", "card game",
      "game", "play", "player", "score", "leaderboard", "level", "levels",
      "points", "highscore", "match", "round", "turn",
      "multiplayer", "puzzle", "quiz", "trivia",
      "arcade", "gaming", "compete", "competition",
      "win", "lose", "battle", "challenge", "achievement", "badge"
    ],
    antiKeywords: ["employee", "customer", "invoice", "order"],
    requiresAuth: true,
    complexity: 'complex',
    examples: [
      "trivia game with leaderboard",
      "multiplayer puzzle game",
      "quiz app with scoring",
      "arcade game with high scores",
      "turn-based strategy game"
    ],
    aiDescription: "Interactive games and gaming applications with player management, scoring systems, leaderboards, and game state management. Focus on entertainment and competition.",
    useCases: [
      "Trivia and quiz games",
      "Puzzle and strategy games",
      "Multiplayer competitive games",
      "Arcade-style games with scoring"
    ],
    boundaries: [
      "Interactive gaming and entertainment",
      "Player state and progression tracking",
      "Scoring and leaderboard systems", 
      "Game mechanics and rule enforcement"
    ]
  }
];

// ============================================================================
// AI ROUTING TYPES - ENHANCED WITH STRUCTURAL GUIDANCE
// ============================================================================

export interface StructuralGuidance {
  shouldSimplify: boolean;
  removeParentEntity?: boolean;
  primaryEntity?: string;
  entitiesToRemove?: string[];
  workflowAdjustments?: string[];
  reasoning: string;
}

export interface RouteResult {
  templateName: string | null;
  confidence: number;
  reasoning: string;
  alternatives?: string[];
  clarificationNeeded?: string[];
  selectedTemplate?: Template;
  // 🆕 NEW: Structural guidance for generation
  structuralGuidance?: StructuralGuidance | null;
}

export interface EntityDetection {
  count: number;
  entities: string[];
}

export interface ClarificationQuestion {
  question: string;
  options?: string[];
  context: string;
  importance: 'high' | 'medium' | 'low';
}

export interface AIRoutingResponse {
  selectedTemplate: string | null;
  confidence: number;
  reasoning: string;
  alternatives: string[];
  clarificationQuestions: string[];
  needsClarification: boolean;
  structuralGuidance?: StructuralGuidance | null; // 🆕 NEW
}

// ============================================================================
// AI TEMPLATE ROUTING SERVICE
// ============================================================================

export class TemplateRoutingService {
  private static instance: TemplateRoutingService;
  private templateCache: Map<string, Template> = new Map();
  private routingCache: Map<string, RouteResult> = new Map();
  private claudeService: ClaudeService | null = null;
  private readonly cacheTimeout = 60 * 60 * 1000; // 1 hour cache for routing decisions
  
  // 🆕 NEW: Feature flag for structural guidance (gradual rollout)
  private enableStructuralGuidance: boolean = true;

  private constructor() {
    // Initialize template cache
    AI_ENHANCED_TEMPLATES.forEach(template => {
      this.templateCache.set(template.name, template);
    });
  }

  public static getInstance(): TemplateRoutingService {
    if (!TemplateRoutingService.instance) {
      TemplateRoutingService.instance = new TemplateRoutingService();
    }
    return TemplateRoutingService.instance;
  }

  private async ensureClaudeService(): Promise<ClaudeService> {
    if (!this.claudeService) {
      this.claudeService = new ClaudeService();
    }
    return this.claudeService;
  }

  // 🆕 NEW: Feature flag control
  public setStructuralGuidanceEnabled(enabled: boolean): void {
    this.enableStructuralGuidance = enabled;
    console.log(`🎛️ [AI Template Router] Structural guidance ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Main AI-powered routing function
   */
  public async route(userPrompt: string, sessionId?: string): Promise<RouteResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(userPrompt);

    console.log(`🎯 [AI Template Router] Starting AI-powered route analysis for: "${userPrompt.substring(0, 100)}..."`);

    try {
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`✅ [AI Template Router] Using cached routing decision`);
        return cached;
      }

      // Use AI for routing decision
      const aiResponse = await this.getAIRoutingDecision(userPrompt);
      
      // Process AI response into RouteResult
      const result = this.processAIResponse(aiResponse, userPrompt);
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      // Log decision
      const processingTime = Date.now() - startTime;
      this.logRoutingDecision(userPrompt, result, processingTime, sessionId, 'ai');

      return result;

    } catch (error) {
      console.error('❌ [AI Template Router] AI routing failed, falling back to keyword routing:', error);
      
      // Fallback to keyword-based routing
      return this.fallbackKeywordRouting(userPrompt, sessionId);
    }
  }

  /**
   * Get AI routing decision from Claude
   */
  private async getAIRoutingDecision(userPrompt: string): Promise<AIRoutingResponse> {
    const claudeService = await this.ensureClaudeService();
    const routingPrompt = this.buildRoutingPrompt(userPrompt);

    console.log(`🤖 [AI Template Router] Sending routing request to AI (${routingPrompt.length} chars)`);

    let aiResponse = '';
    
    await claudeService.sendStreamingChat(
      [{ role: 'user', content: routingPrompt }],
      {
        activeFile: 'routing-analysis',
        fileContent: '',
        selectedFiles: [],
        projectStructure: [],
        projectInfo: { id: 'routing', name: 'Template Routing', type: 'analysis' }
      },
      (event: StreamEvent) => {
        if (event.type === 'content_delta' && event.content) {
          aiResponse += event.content;
        }
      }
    );

    // Parse AI response
    return this.parseAIResponse(aiResponse);
  }

  /**
   * Build the routing prompt for AI - ENHANCED WITH STRUCTURAL GUIDANCE
   */
  private buildRoutingPrompt(userPrompt: string): string {
    const templateDescriptions = AI_ENHANCED_TEMPLATES.map(template => 
      `**${template.name}** (${template.complexity}):
- Description: ${template.aiDescription}
- Use Cases: ${template.useCases.join(', ')}
- Boundaries: ${template.boundaries.join(', ')}
- Auth Required: ${template.requiresAuth ? 'Yes' : 'No'}
- Examples: ${template.examples.join(', ')}`
    ).join('\n\n');

    // 🆕 NEW: Structural guidance section (conditional on feature flag)
    const structuralGuidanceSection = this.enableStructuralGuidance ? `

## 🔧 CRITICAL: Structural Simplification Analysis

After selecting the template, analyze if the user's intent requires structural simplification:

### Common Simplification Patterns:

**Pattern 1: "X app" (creation focus) vs "X manager/platform" (management focus)**

Examples:
- "blogging app" → User wants to WRITE posts (remove Blog entity, make Post primary)
- "blog platform" → User wants to MANAGE blogs (keep full structure)
- "note app" → User wants to WRITE notes (remove Notebook entity, make Note primary)  
- "notebook manager" → User wants to ORGANIZE notebooks (keep full structure)
- "expense tracker" → User wants to TRACK expenses (remove Budget entity, make Expense primary)
- "budget manager" → User wants to MANAGE budgets (keep full structure)

**Detection Keywords:**
- **Simplify when user says:** "app", "write", "post", "create", "add", "my", "personal", "track"
- **Keep full when user says:** "manage", "platform", "organize", "multiple", "system", "manager"

**Entity Analysis:**
- If user mentions CHILD entity but NOT parent → Simplify (remove parent)
- If user mentions BOTH parent and child → Keep full structure
- If user uses creation verbs → Simplify to direct access
- If user uses management verbs → Keep organizational structure

### Structural Guidance Output:

When simplification is needed, include in your JSON response:

\`\`\`json
{
  "structuralGuidance": {
    "shouldSimplify": true,
    "removeParentEntity": true,
    "primaryEntity": "Post",
    "entitiesToRemove": ["Blog"],
    "workflowAdjustments": [
      "Remove Blog dashboard and selection",
      "Direct access to Posts from main view",
      "Single-step post creation (no blog selection)",
      "Keep Blog entity in backend for future extension"
    ],
    "reasoning": "User said 'blogging app' with focus on writing posts. This indicates content creation intent, not multi-blog management. Remove Blog entity from UI, make Post the primary entity with direct access."
  }
}
\`\`\`

When NO simplification is needed:

\`\`\`json
{
  "structuralGuidance": {
    "shouldSimplify": false,
    "reasoning": "User explicitly mentioned managing multiple projects with tasks. Full parent-child structure matches user intent."
  }
}
\`\`\`

**IMPORTANT:** 
- Always include structuralGuidance in your response
- Analyze every MultiEntityRelationships selection for simplification needs
- Default to simplification when ambiguous (users can always ask for more complexity)` : '';

    return `You are a template routing system for an ICP (Internet Computer) application generator. Your job is to analyze user requirements and select the most appropriate template for their project.

## Available Templates:

${templateDescriptions}

## User Request:
"${userPrompt}"

## Your Task:
Analyze the user's request and determine which template best fits their needs. Consider:

1. **Entity Complexity**: How many different types of data will they manage?
   - Single entity → SimpleCrud templates
   - Multiple related entities → MultiEntity templates
   - Complex business processes → Specialized templates (CRM, Ecommerce, etc.)

2. **Authentication Needs**: 
   - Personal/private data → Auth required
   - Public/community data → No auth needed

3. **Business Domain**:
   - Customer management → CRM
   - Employee management → HRManagement  
   - Product sales → Ecommerce
   - Approval processes → WorkflowApproval
   - Games/entertainment → Game

4. **External Integration**:
   - Public APIs → HttpOutcallPublic
   - Personal API keys → HttpOutcallAuth

5. **Analytics Requirements**:
   - Basic relationships → MultiEntityRelationships
   - Reports/dashboards → MultiEntityAnalytics

${structuralGuidanceSection}

## Confidence Guidelines:
- **90-100%**: Crystal clear match, unambiguous requirements
- **70-89%**: Strong match but some ambiguity, offer alternatives
- **50-69%**: Moderate match, ask 1-2 clarifying questions  
- **Below 50%**: Low confidence, ask specific clarifying questions

## Response Format:
Provide your analysis in this exact JSON format:

\`\`\`json
{
  "selectedTemplate": "TemplateName" | null,
  "confidence": 0.85,
  "reasoning": "Clear explanation of why this template fits the requirements...",
  "alternatives": ["AlternativeTemplate1", "AlternativeTemplate2"],
  "clarificationQuestions": [
    "Is this for personal use or team collaboration?",
    "Do you need reporting and analytics features?"
  ],
  "needsClarification": false,
  "structuralGuidance": {
    "shouldSimplify": true | false,
    "removeParentEntity": true | false,
    "primaryEntity": "EntityName",
    "entitiesToRemove": ["ParentEntity"],
    "workflowAdjustments": ["Adjustment 1", "Adjustment 2"],
    "reasoning": "Explanation of why simplification is or isn't needed"
  }
}
\`\`\`

Rules:
- If confidence is below 70%, set needsClarification to true
- Always provide reasoning for your decision
- Include 2-3 alternatives for medium confidence decisions
- Ask specific, actionable clarification questions
- Consider the complexity hierarchy: don't suggest complex templates for simple needs
- ${this.enableStructuralGuidance ? 'ALWAYS include structuralGuidance analysis for MultiEntityRelationships templates' : 'structuralGuidance is optional'}

Analyze the user request and provide your routing decision.`;
  }

  /**
   * Parse AI response into structured format - ENHANCED
   */
  private parseAIResponse(response: string): AIRoutingResponse {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[1]);
      
      return {
        selectedTemplate: parsed.selectedTemplate,
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || 'No reasoning provided',
        alternatives: parsed.alternatives || [],
        clarificationQuestions: parsed.clarificationQuestions || [],
        needsClarification: parsed.needsClarification || false,
        // 🆕 NEW: Safe default for structural guidance
        structuralGuidance: parsed.structuralGuidance || null
      };
      
    } catch (error) {
      console.error('❌ [AI Template Router] Failed to parse AI response:', error);
      throw new Error(`Failed to parse AI routing response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process AI response into RouteResult format - ENHANCED
   */
  private processAIResponse(aiResponse: AIRoutingResponse, userPrompt: string): RouteResult {
    const { selectedTemplate, confidence, reasoning, alternatives, clarificationQuestions, needsClarification, structuralGuidance } = aiResponse;

    // If AI determined clarification is needed
    if (needsClarification || confidence < 0.7) {
      return {
        templateName: null,
        confidence,
        reasoning,
        alternatives,
        clarificationNeeded: clarificationQuestions.length > 0 ? clarificationQuestions : [
          "Could you provide more details about your app's main purpose?",
          "Will this be for personal use or team collaboration?",
          "Do you need any special features like reporting, external integrations, or approval workflows?"
        ],
        structuralGuidance: null // No guidance needed if we need clarification
      };
    }

    // Validate selected template exists
    const template = selectedTemplate ? this.getTemplate(selectedTemplate) : null;
    if (selectedTemplate && !template) {
      console.warn(`⚠️ [AI Template Router] AI selected unknown template: ${selectedTemplate}`);
      return this.fallbackToAlternatives(alternatives, reasoning, userPrompt);
    }

    // 🆕 NEW: Log structural guidance if present
    if (structuralGuidance) {
      console.log(`🔧 [AI Template Router] Structural guidance provided:`, {
        shouldSimplify: structuralGuidance.shouldSimplify,
        removeParentEntity: structuralGuidance.removeParentEntity,
        primaryEntity: structuralGuidance.primaryEntity,
        reasoning: structuralGuidance.reasoning
      });
    }

    // Success case
    return {
      templateName: selectedTemplate,
      confidence,
      reasoning,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
      selectedTemplate: template || undefined,
      clarificationNeeded: confidence < 0.85 && clarificationQuestions.length > 0 ? clarificationQuestions.slice(0, 2) : undefined,
      // 🆕 NEW: Include structural guidance
      structuralGuidance: structuralGuidance || null
    };
  }

  /**
   * Handle case where AI selected invalid template
   */
  private fallbackToAlternatives(alternatives: string[], reasoning: string, userPrompt: string): RouteResult {
    // Try first valid alternative
    for (const alt of alternatives) {
      const template = this.getTemplate(alt);
      if (template) {
        return {
          templateName: alt,
          confidence: 0.6, // Lower confidence due to fallback
          reasoning: `${reasoning} (Fell back to alternative due to invalid primary selection)`,
          selectedTemplate: template,
          structuralGuidance: null // No guidance in fallback mode
        };
      }
    }

    // No valid alternatives, return clarification request
    return {
      templateName: null,
      confidence: 0.3,
      reasoning: "AI routing failed to select valid template, need clarification",
      clarificationNeeded: [
        "What is the main purpose of your application?",
        "How many different types of data will you manage?",
        "Do you need user accounts and authentication?"
      ],
      structuralGuidance: null
    };
  }

  /**
   * Fallback to keyword-based routing if AI fails
   */
  private fallbackKeywordRouting(userPrompt: string, sessionId?: string): RouteResult {
    console.log(`🔄 [AI Template Router] Using keyword-based fallback routing`);
    
    // Simplified keyword-based routing for fallback only
    return this.performKeywordRouting(userPrompt);
  }

  /**
   * Simplified keyword-based routing logic (fallback only)
   */
  private performKeywordRouting(userPrompt: string): RouteResult {
    const prompt = userPrompt.toLowerCase().trim();
    
    // Quick keyword matching for fallback
    const scores = new Map<string, number>();
    
    AI_ENHANCED_TEMPLATES.forEach(template => {
      let score = 0;
      
      // Check for keyword matches
      template.keywords.forEach(keyword => {
        if (prompt.includes(keyword.toLowerCase())) {
          score += 1;
        }
      });
      
      // Check for anti-keywords
      if (template.antiKeywords) {
        const hasAntiKeyword = template.antiKeywords.some(antiKw => 
          prompt.includes(antiKw.toLowerCase())
        );
        if (hasAntiKeyword) {
          score = 0; // Disqualify
        }
      }
      
      if (score > 0) {
        scores.set(template.name, score / Math.sqrt(template.keywords.length));
      }
    });

    // Get best match
    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score > 0);

    if (sorted.length === 0) {
      return {
        templateName: null,
        confidence: 0,
        reasoning: "No keyword matches found - need clarification",
        clarificationNeeded: [
          "What type of data will your app manage?",
          "Is this for personal use or team collaboration?",
          "Do you need any external integrations?"
        ],
        structuralGuidance: null // No guidance in fallback mode
      };
    }

    const [bestName, bestScore] = sorted[0];
    const template = this.getTemplate(bestName);
    
    // 🆕 NEW: Attempt basic structural analysis even in fallback mode
    let structuralGuidance: StructuralGuidance | null = null;
    if (this.enableStructuralGuidance && bestName === 'MultiEntityRelationships') {
      structuralGuidance = this.performBasicStructuralAnalysis(userPrompt);
    }
    
    return {
      templateName: bestName,
      confidence: Math.min(bestScore, 0.8), // Cap fallback confidence
      reasoning: `Keyword-based fallback selection (AI routing unavailable)`,
      selectedTemplate: template || undefined,
      alternatives: sorted.slice(1, 3).map(([name]) => name),
      structuralGuidance // Include guidance if available
    };
  }

  /**
   * 🆕 NEW: Basic structural analysis for fallback mode
   */
  private performBasicStructuralAnalysis(userPrompt: string): StructuralGuidance | null {
    const prompt = userPrompt.toLowerCase();
    
    // Simple heuristic-based analysis
    const creationKeywords = ['app', 'write', 'post', 'create', 'add', 'track', 'my', 'personal'];
    const managementKeywords = ['manage', 'platform', 'organize', 'multiple', 'system', 'manager'];
    
    const hasCreationIntent = creationKeywords.some(kw => prompt.includes(kw));
    const hasManagementIntent = managementKeywords.some(kw => prompt.includes(kw));
    
    // Check for parent/child entity mentions
    const parentChildPatterns = [
      { parent: 'blog', child: 'post' },
      { parent: 'notebook', child: 'note' },
      { parent: 'folder', child: 'file' },
      { parent: 'project', child: 'task' },
      { parent: 'budget', child: 'expense' },
      { parent: 'collection', child: 'recipe' },
      { parent: 'album', child: 'photo' },
      { parent: 'playlist', child: 'song' }
    ];
    
    for (const pattern of parentChildPatterns) {
      const mentionsParent = prompt.includes(pattern.parent);
      const mentionsChild = prompt.includes(pattern.child);
      
      // User mentions child but not parent, and has creation intent
      if (mentionsChild && !mentionsParent && hasCreationIntent && !hasManagementIntent) {
        return {
          shouldSimplify: true,
          removeParentEntity: true,
          primaryEntity: pattern.child.charAt(0).toUpperCase() + pattern.child.slice(1),
          entitiesToRemove: [pattern.parent.charAt(0).toUpperCase() + pattern.parent.slice(1)],
          workflowAdjustments: [
            `Remove ${pattern.parent} dashboard and selection`,
            `Direct access to ${pattern.child}s from main view`,
            `Single-step ${pattern.child} creation`,
            `Keep ${pattern.parent} entity in backend for future extension`
          ],
          reasoning: `Keyword analysis suggests user wants to create ${pattern.child}s directly, not manage multiple ${pattern.parent}s`
        };
      }
    }
    
    // Default: no simplification
    return {
      shouldSimplify: false,
      reasoning: 'Keyword analysis suggests full structure is appropriate'
    };
  }

  /**
   * Cache management - BROWSER-COMPATIBLE VERSION
   */
  private generateCacheKey(userPrompt: string): string {
    const str = userPrompt.toLowerCase().trim();
    
    // Simple string hash function (browser-compatible)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to base36 string and take first 16 characters
    return `route_${Math.abs(hash).toString(36).slice(0, 16)}`;
  }

  private getFromCache(key: string): RouteResult | null {
    const cached = this.routingCache.get(key);
    if (cached) {
      console.log(`📋 [AI Template Router] Cache hit for routing decision`);
      return cached;
    }
    return null;
  }

  private setCache(key: string, result: RouteResult): void {
    this.routingCache.set(key, result);
    
    // Simple cache cleanup - remove oldest entries if cache gets too large
    if (this.routingCache.size > 100) {
      const firstKey = this.routingCache.keys().next().value;
      if (firstKey) {
        this.routingCache.delete(firstKey);
      }
    }
  }

  /**
   * Template management
   */
  public getTemplate(name: string): Template | undefined {
    return this.templateCache.get(name);
  }

  public getAllTemplates(): Template[] {
    return AI_ENHANCED_TEMPLATES;
  }

  /**
   * Enhanced clarification capabilities
   */
  public async generateContextualClarification(
    userPrompt: string, 
    alternatives: string[]
  ): Promise<ClarificationQuestion[]> {
    try {
      const claudeService = await this.ensureClaudeService();
      
      const clarificationPrompt = `Given this user request: "${userPrompt}"
And these possible template alternatives: ${alternatives.join(', ')}

Generate 2-3 specific, actionable clarification questions that would help distinguish between these templates. Focus on:
- Entity complexity (single vs multiple data types)
- Authentication needs (personal vs public)
- Business domain specifics
- Feature requirements (analytics, approvals, integrations)

Return as JSON array:
\`\`\`json
[
  {
    "question": "Will multiple people use this app or just yourself?",
    "context": "This helps determine if authentication is needed",
    "importance": "high"
  }
]
\`\`\``;

      let response = '';
      await claudeService.sendStreamingChat(
        [{ role: 'user', content: clarificationPrompt }],
        {
          activeFile: 'clarification-generation',
          fileContent: '',
          selectedFiles: [],
          projectStructure: [],
          projectInfo: { id: 'clarification', name: 'Clarification Generation', type: 'analysis' }
        },
        (event: StreamEvent) => {
          if (event.type === 'content_delta' && event.content) {
            response += event.content;
          }
        }
      );

      // Parse response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

    } catch (error) {
      console.warn('⚠️ [AI Template Router] Failed to generate contextual clarification:', error);
    }

    // Fallback to generic questions
    return [
      {
        question: "What is the main purpose of this application?",
        context: "This helps determine the appropriate template category",
        importance: 'high'
      },
      {
        question: "Will you manage one type of data or multiple related types?",
        context: "This determines single vs multi-entity templates",
        importance: 'high'
      }
    ];
  }

  /**
   * Generate targeted clarification questions for a specific template
   */
  public generateTemplateSpecificQuestions(templateName: string, userPrompt: string): ClarificationQuestion[] {
    const template = this.getTemplate(templateName);
    if (!template) return [];

    const questions: ClarificationQuestion[] = [];
    const prompt = userPrompt.toLowerCase();

    switch (templateName) {
      case 'MultiEntityRelationships':
        questions.push({
          question: "What are the main types of items your app will manage, and how are they related?",
          context: "This helps determine the data structure and relationships needed.",
          importance: 'high'
        });
        break;

      case 'MultiEntityAnalytics':
        questions.push({
          question: "What kind of reports or analytics do you need? (e.g., trends, summaries, charts)",
          context: "This determines the aggregation and reporting features to include.",
          importance: 'high'
        });
        break;

      case 'Ecommerce':
        questions.push({
          question: "Will you handle payments directly, or start with a contact-seller approach?",
          options: ["Direct payments", "Contact seller", "External payment integration"],
          context: "This affects the complexity and integration requirements.",
          importance: 'high'
        });
        break;

      case 'Game':
        questions.push({
          question: "Is this a single-player or multiplayer game?",
          options: ["Single-player", "Turn-based multiplayer", "Real-time multiplayer"],
          context: "This determines the game state management and player interaction patterns.",
          importance: 'high'
        });
        break;
    }

    return questions;
  }

  /**
   * Logging and analytics - ENHANCED
   */
  private logRoutingDecision(
    userPrompt: string,
    result: RouteResult,
    processingTime: number,
    sessionId?: string,
    method: 'ai' | 'keyword' = 'ai'
  ): void {
    const logData = {
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'unknown',
      method,
      promptLength: userPrompt.length,
      promptPreview: userPrompt.substring(0, 100),
      selectedTemplateName: result.templateName || 'None',
      confidence: result.confidence,
      reasoning: result.reasoning,
      hasAlternatives: !!result.alternatives && result.alternatives.length > 0,
      needsClarification: !!result.clarificationNeeded && result.clarificationNeeded.length > 0,
      processingTimeMs: processingTime,
      alternatives: result.alternatives || [],
      // 🆕 NEW: Log structural guidance
      hasStructuralGuidance: !!result.structuralGuidance,
      shouldSimplify: result.structuralGuidance?.shouldSimplify || false,
      structuralGuidanceReasoning: result.structuralGuidance?.reasoning || 'N/A'
    };

    // Log with different levels based on confidence
    if (result.confidence >= 0.85) {
      console.log(`✅ [AI Template Router] High confidence ${method.toUpperCase()} selection:`, logData);
    } else if (result.confidence >= 0.7) {
      console.log(`⚠️ [AI Template Router] Medium confidence ${method.toUpperCase()} selection:`, logData);
    } else {
      console.log(`❌ [AI Template Router] Low confidence - needs clarification:`, logData);
    }

    // 🆕 NEW: Special log for structural simplification
    if (result.structuralGuidance?.shouldSimplify) {
      console.log(`🔧 [AI Template Router] STRUCTURAL SIMPLIFICATION RECOMMENDED:`, {
        template: result.templateName,
        removeParentEntity: result.structuralGuidance.removeParentEntity,
        primaryEntity: result.structuralGuidance.primaryEntity,
        reason: result.structuralGuidance.reasoning
      });
    }
  }

  /**
   * Cache management utilities
   */
  public clearCache(): void {
    this.routingCache.clear();
    console.log(`🧹 [AI Template Router] Routing cache cleared`);
  }

  public getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.routingCache.size
    };
  }

  /**
   * Analyze routing performance for a batch of prompts (for testing/improvement)
   */
  public async batchAnalyze(prompts: Array<{prompt: string, expectedTemplateName?: string, expectedSimplification?: boolean}>): Promise<void> {
    console.log(`📊 [AI Template Router] Batch analyzing ${prompts.length} prompts...`);
    
    const results = await Promise.all(prompts.map(async ({prompt, expectedTemplateName, expectedSimplification}) => {
      const result = await this.route(prompt);
      return {
        prompt,
        expected: expectedTemplateName,
        actual: result.templateName,
        confidence: result.confidence,
        correct: expectedTemplateName ? result.templateName === expectedTemplateName : undefined,
        // 🆕 NEW: Track simplification accuracy
        expectedSimplification,
        actualSimplification: result.structuralGuidance?.shouldSimplify,
        simplificationCorrect: expectedSimplification !== undefined 
          ? result.structuralGuidance?.shouldSimplify === expectedSimplification 
          : undefined
      };
    }));

    const accurateResults = results.filter(r => r.correct === true);
    const inaccurateResults = results.filter(r => r.correct === false);
    const highConfidenceResults = results.filter(r => r.confidence >= 0.80);
    const simplificationResults = results.filter(r => r.expectedSimplification !== undefined);
    const accurateSimplification = simplificationResults.filter(r => r.simplificationCorrect === true);

    console.log(`📈 [AI Template Router] Batch Analysis Results:`);
    console.log(`   Accuracy: ${accurateResults.length}/${results.filter(r => r.expected).length} (${((accurateResults.length / results.filter(r => r.expected).length) * 100).toFixed(1)}%)`);
    console.log(`   High Confidence: ${highConfidenceResults.length}/${results.length} (${((highConfidenceResults.length / results.length) * 100).toFixed(1)}%)`);
    console.log(`   Average Confidence: ${(results.reduce((sum, r) => sum + r.confidence, 0) / results.length).toFixed(2)}`);
    
    // 🆕 NEW: Simplification accuracy
    if (simplificationResults.length > 0) {
      console.log(`   Simplification Accuracy: ${accurateSimplification.length}/${simplificationResults.length} (${((accurateSimplification.length / simplificationResults.length) * 100).toFixed(1)}%)`);
    }

    if (inaccurateResults.length > 0) {
      console.log(`❌ [AI Template Router] Inaccurate predictions:`, inaccurateResults);
    }
  }

  /**
   * 🆕 NEW: Test structural guidance specifically
   */
  public async testStructuralGuidance(testCases: Array<{
    prompt: string;
    shouldSimplify: boolean;
    expectedPrimaryEntity?: string;
  }>): Promise<void> {
    console.log(`🧪 [AI Template Router] Testing structural guidance with ${testCases.length} cases...`);
    
    const results = await Promise.all(testCases.map(async (testCase) => {
      const result = await this.route(testCase.prompt);
      const guidance = result.structuralGuidance;
      
      return {
        prompt: testCase.prompt,
        expectedSimplify: testCase.shouldSimplify,
        actualSimplify: guidance?.shouldSimplify || false,
        correct: (guidance?.shouldSimplify || false) === testCase.shouldSimplify,
        expectedPrimaryEntity: testCase.expectedPrimaryEntity,
        actualPrimaryEntity: guidance?.primaryEntity,
        primaryEntityCorrect: testCase.expectedPrimaryEntity 
          ? guidance?.primaryEntity === testCase.expectedPrimaryEntity 
          : true
      };
    }));

    const correctSimplification = results.filter(r => r.correct);
    const correctPrimaryEntity = results.filter(r => r.primaryEntityCorrect);

    console.log(`📊 [AI Template Router] Structural Guidance Test Results:`);
    console.log(`   Simplification Detection: ${correctSimplification.length}/${results.length} (${((correctSimplification.length / results.length) * 100).toFixed(1)}%)`);
    console.log(`   Primary Entity Detection: ${correctPrimaryEntity.length}/${results.filter(r => r.expectedPrimaryEntity).length} (${((correctPrimaryEntity.length / results.filter(r => r.expectedPrimaryEntity).length) * 100).toFixed(1)}%)`);

    const failures = results.filter(r => !r.correct);
    if (failures.length > 0) {
      console.log(`❌ [AI Template Router] Failed structural guidance cases:`, failures);
    }
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export function routeUserRequest(prompt: string, sessionId?: string): Promise<RouteResult> {
  const router = TemplateRoutingService.getInstance();
  return router.route(prompt, sessionId);
}

export function getTemplateByName(name: string): Template | undefined {
  const router = TemplateRoutingService.getInstance();
  return router.getTemplate(name);
}

export function getAllTemplates(): Template[] {
  const router = TemplateRoutingService.getInstance();
  return router.getAllTemplates();
}

export function generateContextualClarification(
  userPrompt: string, 
  alternatives: string[]
): Promise<ClarificationQuestion[]> {
  const router = TemplateRoutingService.getInstance();
  return router.generateContextualClarification(userPrompt, alternatives);
}

// 🆕 NEW: Export for controlling structural guidance feature flag
export function setStructuralGuidanceEnabled(enabled: boolean): void {
  const router = TemplateRoutingService.getInstance();
  router.setStructuralGuidanceEnabled(enabled);
}

// 🆕 NEW: Export for testing structural guidance
export function testStructuralGuidance(testCases: Array<{
  prompt: string;
  shouldSimplify: boolean;
  expectedPrimaryEntity?: string;
}>): Promise<void> {
  const router = TemplateRoutingService.getInstance();
  return router.testStructuralGuidance(testCases);
}