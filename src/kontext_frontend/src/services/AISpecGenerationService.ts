import { StreamEvent } from '../claudeService';

export interface ProjectSpec {
  projectMeta: {
    name: string;
    actorName: string; // 🔥 NEW: Valid Motoko actor name (e.g., "Hello World App" -> "HelloWorldApp")
    description: string;
    complexity: 'simple' | 'medium' | 'complex';
    userIntent: string;
  };
  coreRequirements: {
    primaryGoal: string;
    essentialFeatures: string[];
    explicitRequirements: string[];
  };
  minimalArchitecture: {
    backendEntities: string[];
    frontendComponents: string[];
    keyInteractions: string[];
  };
  scopeBoundaries: {
    included: string[];
    excluded: string[];
  };
  visualDesign?: {
    domain: string; // e.g., "finance", "creative", "healthcare", "education", "ecommerce", "social"
    colorPalette: {
      primary: string; // Hex color code
      secondary?: string;
      accent?: string;
      background?: string;
      text?: string;
    };
    designStyle: 'modern' | 'minimalist' | 'corporate' | 'playful' | 'elegant' | 'bold' | 'warm' | 'cool';
    layoutPreference: 'dashboard' | 'card-based' | 'list-based' | 'grid' | 'single-page' | 'multi-page';
    typographyStyle: 'professional' | 'friendly' | 'bold' | 'elegant' | 'modern';
    visualGuidance: string[]; // Domain-specific styling notes
  };
}

export interface SpecGenerationResult {
  spec: ProjectSpec;
  constraints: string;
  implementationPrompt: string;
  rawSpecContent: string;
}

/**
 * AI spec generation service that integrates with streaming architecture
 * Always generates a spec first, then creates constrained implementation prompts
 */
export class AISpecGenerationService {
  
  /**
   * Detects if user has specified their own styling preferences
   */
  static detectUserSpecifiedStyling(prompt: string): {
    hasUserStyling: boolean;
    colors?: string[];
    style?: string;
    layout?: string;
    theme?: string;
  } {
    const lowerPrompt = prompt.toLowerCase();
    const userStyling: {
      hasUserStyling: boolean;
      colors?: string[];
      style?: string;
      layout?: string;
      theme?: string;
    } = {
      hasUserStyling: false
    };

    // Detect color mentions (hex codes, color names, or "color" + specific color)
    const colorPatterns = [
      /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi, // Hex colors
      /(?:color|colour|use|with)\s+(?:the\s+)?(?:colors?\s+)?(?:of\s+)?([a-z]+(?:\s+and\s+[a-z]+)*)/gi, // "color blue", "colors red and green"
      /(?:blue|red|green|yellow|orange|purple|pink|black|white|gray|grey|brown|teal|cyan|indigo|violet|magenta)/gi // Color names
    ];
    
    const foundColors: string[] = [];
    colorPatterns.forEach(pattern => {
      const matches = prompt.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Extract hex codes
          if (match.startsWith('#')) {
            foundColors.push(match);
          } else {
            // Extract color names from phrases
            const colorMatch = match.match(/(?:blue|red|green|yellow|orange|purple|pink|black|white|gray|grey|brown|teal|cyan|indigo|violet|magenta)/i);
            if (colorMatch) {
              foundColors.push(colorMatch[0].toLowerCase());
            }
          }
        });
      }
    });

    // Detect style mentions
    const styleKeywords = ['modern', 'minimalist', 'corporate', 'playful', 'elegant', 'bold', 'warm', 'cool', 'dark', 'light'];
    const foundStyle = styleKeywords.find(keyword => 
      lowerPrompt.includes(keyword) && 
      (lowerPrompt.includes('style') || lowerPrompt.includes('design') || lowerPrompt.includes('theme') || lowerPrompt.includes('aesthetic'))
    );

    // Detect layout mentions
    const layoutKeywords = ['dashboard', 'card', 'list', 'grid', 'single-page', 'multi-page'];
    const foundLayout = layoutKeywords.find(keyword => 
      lowerPrompt.includes(keyword) && 
      (lowerPrompt.includes('layout') || lowerPrompt.includes('design') || lowerPrompt.includes('interface'))
    );

    // Detect theme mentions
    const themeKeywords = ['dark theme', 'light theme', 'dark mode', 'light mode'];
    const foundTheme = themeKeywords.find(keyword => lowerPrompt.includes(keyword));

    if (foundColors.length > 0 || foundStyle || foundLayout || foundTheme) {
      userStyling.hasUserStyling = true;
      if (foundColors.length > 0) {
        userStyling.colors = [...new Set(foundColors)]; // Remove duplicates
      }
      if (foundStyle) {
        userStyling.style = foundStyle;
      }
      if (foundLayout) {
        userStyling.layout = foundLayout;
      }
      if (foundTheme) {
        userStyling.theme = foundTheme;
      }
    }

    return userStyling;
  }

  /**
   * Detects domain from user prompt for appropriate visual design guidance
   */
  static detectDomain(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase().trim();
    
    // Finance & Business
    if (lowerPrompt.includes('finance') || lowerPrompt.includes('banking') || 
        lowerPrompt.includes('accounting') || lowerPrompt.includes('budget') ||
        lowerPrompt.includes('invoice') || lowerPrompt.includes('payment') ||
        lowerPrompt.includes('trading') || lowerPrompt.includes('portfolio')) {
      return 'finance';
    }
    
    // E-commerce
    if (lowerPrompt.includes('shop') || lowerPrompt.includes('store') || 
        lowerPrompt.includes('ecommerce') || lowerPrompt.includes('marketplace') ||
        lowerPrompt.includes('cart') || lowerPrompt.includes('checkout')) {
      return 'ecommerce';
    }
    
    // Healthcare
    if (lowerPrompt.includes('health') || lowerPrompt.includes('medical') || 
        lowerPrompt.includes('doctor') || lowerPrompt.includes('patient') ||
        lowerPrompt.includes('clinic') || lowerPrompt.includes('hospital')) {
      return 'healthcare';
    }
    
    // Education
    if (lowerPrompt.includes('education') || lowerPrompt.includes('learning') || 
        lowerPrompt.includes('course') || lowerPrompt.includes('student') ||
        lowerPrompt.includes('school') || lowerPrompt.includes('university')) {
      return 'education';
    }
    
    // Creative & Design
    if (lowerPrompt.includes('creative') || lowerPrompt.includes('design') || 
        lowerPrompt.includes('art') || lowerPrompt.includes('portfolio') ||
        lowerPrompt.includes('gallery') || lowerPrompt.includes('showcase')) {
      return 'creative';
    }
    
    // Social & Communication
    if (lowerPrompt.includes('social') || lowerPrompt.includes('chat') || 
        lowerPrompt.includes('message') || lowerPrompt.includes('community') ||
        lowerPrompt.includes('forum') || lowerPrompt.includes('network')) {
      return 'social';
    }
    
    // Productivity & Task Management
    if (lowerPrompt.includes('todo') || lowerPrompt.includes('task') || 
        lowerPrompt.includes('productivity') || lowerPrompt.includes('organizer') ||
        lowerPrompt.includes('planner') || lowerPrompt.includes('calendar')) {
      return 'productivity';
    }
    
    // Entertainment & Media
    if (lowerPrompt.includes('game') || lowerPrompt.includes('entertainment') || 
        lowerPrompt.includes('music') || lowerPrompt.includes('video') ||
        lowerPrompt.includes('media') || lowerPrompt.includes('streaming')) {
      return 'entertainment';
    }
    
    // Food & Restaurant
    if (lowerPrompt.includes('food') || lowerPrompt.includes('restaurant') || 
        lowerPrompt.includes('recipe') || lowerPrompt.includes('cooking') ||
        lowerPrompt.includes('menu') || lowerPrompt.includes('dining')) {
      return 'food';
    }
    
    // Travel
    if (lowerPrompt.includes('travel') || lowerPrompt.includes('trip') || 
        lowerPrompt.includes('hotel') || lowerPrompt.includes('booking') ||
        lowerPrompt.includes('vacation') || lowerPrompt.includes('tour')) {
      return 'travel';
    }
    
    // Fitness & Wellness
    if (lowerPrompt.includes('fitness') || lowerPrompt.includes('workout') || 
        lowerPrompt.includes('exercise') || lowerPrompt.includes('gym') ||
        lowerPrompt.includes('wellness') || lowerPrompt.includes('yoga')) {
      return 'fitness';
    }
    
    // Default to generic
    return 'generic';
  }
  
  /**
   * Merges user-specified styling with domain defaults (user styling takes priority)
   */
  private static mergeUserStylingWithDefaults(
    userStyling: { hasUserStyling: boolean; colors?: string[]; style?: string; layout?: string; theme?: string },
    defaultDesign: ProjectSpec['visualDesign'],
    domain: string
  ): ProjectSpec['visualDesign'] {
    if (!defaultDesign) {
      return this.getDefaultVisualDesign(domain, '');
    }

    // Start with a copy of default design
    const merged: NonNullable<ProjectSpec['visualDesign']> = {
      domain: domain,
      colorPalette: {
        ...defaultDesign.colorPalette
      },
      designStyle: defaultDesign.designStyle,
      layoutPreference: defaultDesign.layoutPreference,
      typographyStyle: defaultDesign.typographyStyle,
      visualGuidance: [...(defaultDesign.visualGuidance || [])]
    };

    // Convert user-specified colors to hex codes if needed
    const colorMap: Record<string, string> = {
      'blue': '#3b82f6',
      'red': '#dc2626',
      'green': '#10b981',
      'yellow': '#eab308',
      'orange': '#f59e0b',
      'purple': '#8b5cf6',
      'pink': '#ec4899',
      'black': '#000000',
      'white': '#ffffff',
      'gray': '#6b7280',
      'grey': '#6b7280',
      'brown': '#92400e',
      'teal': '#14b8a6',
      'cyan': '#06b6d4',
      'indigo': '#6366f1',
      'violet': '#8b5cf6',
      'magenta': '#d946ef'
    };

    // Update color palette with user-specified colors
    if (userStyling.colors && userStyling.colors.length > 0) {
      const userColors = userStyling.colors.map(color => {
        // If it's already a hex code, use it
        if (color.startsWith('#')) {
          return color;
        }
        // Otherwise, map color name to hex
        return colorMap[color.toLowerCase()] || color;
      });

      merged.colorPalette = {
        ...merged.colorPalette,
        primary: userColors[0] || merged.colorPalette.primary,
        secondary: userColors[1] || merged.colorPalette.secondary,
        accent: userColors[2] || merged.colorPalette.accent
      };

      // Update background/text if dark/light theme specified
      if (userStyling.theme) {
        if (userStyling.theme.includes('dark')) {
          merged.colorPalette.background = '#0f172a';
          merged.colorPalette.text = '#f1f5f9';
        } else if (userStyling.theme.includes('light')) {
          merged.colorPalette.background = '#ffffff';
          merged.colorPalette.text = '#1f2937';
        }
      }
    }

    // Update design style if user specified
    if (userStyling.style) {
      const validStyles: Array<NonNullable<ProjectSpec['visualDesign']>['designStyle']> = 
        ['modern', 'minimalist', 'corporate', 'playful', 'elegant', 'bold', 'warm', 'cool'];
      if (validStyles.includes(userStyling.style as any)) {
        merged.designStyle = userStyling.style as any;
      }
    }

    // Update layout preference if user specified
    if (userStyling.layout) {
      const validLayouts: Array<NonNullable<ProjectSpec['visualDesign']>['layoutPreference']> = 
        ['dashboard', 'card-based', 'list-based', 'grid', 'single-page', 'multi-page'];
      if (validLayouts.includes(userStyling.layout as any)) {
        merged.layoutPreference = userStyling.layout as any;
      }
    }

    // Update visual guidance to mention user preferences
    if (userStyling.hasUserStyling) {
      const userGuidance: string[] = [];
      if (userStyling.colors && userStyling.colors.length > 0) {
        userGuidance.push(`User-specified color palette: ${userStyling.colors.join(', ')}`);
      }
      if (userStyling.style) {
        userGuidance.push(`User-specified design style: ${userStyling.style}`);
      }
      if (userStyling.layout) {
        userGuidance.push(`User-specified layout: ${userStyling.layout}`);
      }
      if (userStyling.theme) {
        userGuidance.push(`User-specified theme: ${userStyling.theme}`);
      }
      
      merged.visualGuidance = [
        ...userGuidance,
        ...merged.visualGuidance
      ];
    }

    return merged;
  }

  /**
   * Gets default visual design based on domain
   */
  static getDefaultVisualDesign(domain: string, prompt: string): ProjectSpec['visualDesign'] {
    const defaults: Record<string, ProjectSpec['visualDesign']> = {
      finance: {
        domain: 'finance',
        colorPalette: {
          primary: '#1e40af', // Professional blue
          secondary: '#64748b', // Slate gray
          accent: '#059669', // Trust green
          background: '#f8fafc', // Light gray
          text: '#1e293b' // Dark slate
        },
        designStyle: 'corporate',
        layoutPreference: 'dashboard',
        typographyStyle: 'professional',
        visualGuidance: [
          'Use clean, professional layouts with clear data hierarchy',
          'Emphasize trust and stability with muted, professional colors',
          'Prioritize readability and data clarity',
          'Use subtle shadows and borders for card elements'
        ]
      },
      ecommerce: {
        domain: 'ecommerce',
        colorPalette: {
          primary: '#dc2626', // E-commerce red
          secondary: '#f59e0b', // Accent orange
          accent: '#10b981', // Success green
          background: '#ffffff',
          text: '#1f2937'
        },
        designStyle: 'modern',
        layoutPreference: 'card-based',
        typographyStyle: 'friendly',
        visualGuidance: [
          'Use vibrant, attention-grabbing colors for CTAs',
          'Card-based layouts for product displays',
          'Clear visual hierarchy for pricing and product info',
          'Warm, inviting color scheme to encourage purchases'
        ]
      },
      healthcare: {
        domain: 'healthcare',
        colorPalette: {
          primary: '#0ea5e9', // Medical blue
          secondary: '#14b8a6', // Teal
          accent: '#10b981', // Health green
          background: '#f0fdfa', // Light teal
          text: '#0f172a'
        },
        designStyle: 'modern',
        layoutPreference: 'card-based',
        typographyStyle: 'professional',
        visualGuidance: [
          'Clean, calming color palette',
          'Emphasize clarity and trust',
          'Use soft, rounded corners for a friendly feel',
          'High contrast for accessibility'
        ]
      },
      education: {
        domain: 'education',
        colorPalette: {
          primary: '#8b5cf6', // Learning purple
          secondary: '#06b6d4', // Cyan
          accent: '#f59e0b', // Energy orange
          background: '#faf5ff', // Light purple
          text: '#1e293b'
        },
        designStyle: 'playful',
        layoutPreference: 'card-based',
        typographyStyle: 'friendly',
        visualGuidance: [
          'Engaging, vibrant colors to maintain interest',
          'Playful but professional design',
          'Clear visual hierarchy for learning content',
          'Encouraging and approachable aesthetic'
        ]
      },
      creative: {
        domain: 'creative',
        colorPalette: {
          primary: '#ec4899', // Creative pink
          secondary: '#8b5cf6', // Purple
          accent: '#f59e0b', // Orange
          background: '#ffffff',
          text: '#111827'
        },
        designStyle: 'bold',
        layoutPreference: 'grid',
        typographyStyle: 'bold',
        visualGuidance: [
          'Bold, expressive color choices',
          'Creative layouts with visual interest',
          'Emphasize visual content and imagery',
          'Unique, memorable design elements'
        ]
      },
      social: {
        domain: 'social',
        colorPalette: {
          primary: '#3b82f6', // Social blue
          secondary: '#8b5cf6', // Purple
          accent: '#ec4899', // Pink
          background: '#ffffff',
          text: '#1f2937'
        },
        designStyle: 'modern',
        layoutPreference: 'card-based',
        typographyStyle: 'friendly',
        visualGuidance: [
          'Warm, inviting color palette',
          'Card-based layouts for content feeds',
          'Emphasize user-generated content',
          'Modern, trendy aesthetic'
        ]
      },
      productivity: {
        domain: 'productivity',
        colorPalette: {
          primary: '#059669', // Productive green
          secondary: '#0ea5e9', // Blue
          accent: '#f59e0b', // Orange
          background: '#f9fafb',
          text: '#111827'
        },
        designStyle: 'minimalist',
        layoutPreference: 'list-based',
        typographyStyle: 'professional',
        visualGuidance: [
          'Clean, distraction-free design',
          'Minimal color palette to reduce visual noise',
          'Clear typography for readability',
          'Focus on functionality and efficiency'
        ]
      },
      entertainment: {
        domain: 'entertainment',
        colorPalette: {
          primary: '#dc2626', // Entertainment red
          secondary: '#f59e0b', // Orange
          accent: '#8b5cf6', // Purple
          background: '#0f172a', // Dark
          text: '#f1f5f9' // Light
        },
        designStyle: 'bold',
        layoutPreference: 'grid',
        typographyStyle: 'bold',
        visualGuidance: [
          'Bold, high-contrast color schemes',
          'Dark themes for media-focused apps',
          'Emphasize visual content',
          'Energetic, engaging design'
        ]
      },
      food: {
        domain: 'food',
        colorPalette: {
          primary: '#dc2626', // Food red
          secondary: '#f59e0b', // Warm orange
          accent: '#10b981', // Fresh green
          background: '#fff7ed', // Warm cream
          text: '#1f2937'
        },
        designStyle: 'warm',
        layoutPreference: 'card-based',
        typographyStyle: 'friendly',
        visualGuidance: [
          'Warm, appetizing color palette',
          'Emphasize food imagery',
          'Inviting, comfortable design',
          'Appetite-appealing warm tones'
        ]
      },
      travel: {
        domain: 'travel',
        colorPalette: {
          primary: '#0ea5e9', // Sky blue
          secondary: '#10b981', // Nature green
          accent: '#f59e0b', // Sunset orange
          background: '#f0f9ff', // Light blue
          text: '#0f172a'
        },
        designStyle: 'modern',
        layoutPreference: 'card-based',
        typographyStyle: 'friendly',
        visualGuidance: [
          'Inspiring, adventurous color palette',
          'Emphasize destination imagery',
          'Clean, modern layouts',
          'Wanderlust-inducing aesthetic'
        ]
      },
      fitness: {
        domain: 'fitness',
        colorPalette: {
          primary: '#dc2626', // Energy red
          secondary: '#059669', // Health green
          accent: '#f59e0b', // Energy orange
          background: '#ffffff',
          text: '#111827'
        },
        designStyle: 'bold',
        layoutPreference: 'dashboard',
        typographyStyle: 'bold',
        visualGuidance: [
          'Energetic, motivating color scheme',
          'Bold typography for motivation',
          'Data-focused dashboards for tracking',
          'High-energy, action-oriented design'
        ]
      },
      generic: {
        domain: 'generic',
        colorPalette: {
          primary: '#3b82f6', // Default blue
          secondary: '#64748b', // Gray
          accent: '#10b981', // Green
          background: '#ffffff',
          text: '#1f2937'
        },
        designStyle: 'modern',
        layoutPreference: 'card-based',
        typographyStyle: 'modern',
        visualGuidance: [
          'Clean, modern design',
          'Professional appearance',
          'Versatile color palette',
          'User-friendly interface'
        ]
      }
    };
    
    return defaults[domain] || defaults.generic;
  }
  
  /**
   * Analyzes prompt complexity for appropriate spec generation approach
   */
  /**
   * Generate a fallback project name based on user prompt
   */
  private static generateFallbackProjectName(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    // Try to extract key words from the prompt
    const keywords = [];
    
    // Common app types
    if (lowerPrompt.includes('todo') || lowerPrompt.includes('task')) keywords.push('Todo');
    if (lowerPrompt.includes('shop') || lowerPrompt.includes('store') || lowerPrompt.includes('ecommerce')) keywords.push('Shop');
    if (lowerPrompt.includes('dashboard')) keywords.push('Dashboard');
    if (lowerPrompt.includes('blog')) keywords.push('Blog');
    if (lowerPrompt.includes('social') || lowerPrompt.includes('network')) keywords.push('Social');
    if (lowerPrompt.includes('chat') || lowerPrompt.includes('message')) keywords.push('Chat');
    if (lowerPrompt.includes('game')) keywords.push('Game');
    if (lowerPrompt.includes('music')) keywords.push('Music');
    if (lowerPrompt.includes('photo') || lowerPrompt.includes('gallery')) keywords.push('Gallery');
    if (lowerPrompt.includes('recipe') || lowerPrompt.includes('food')) keywords.push('Recipe');
    if (lowerPrompt.includes('fitness') || lowerPrompt.includes('workout')) keywords.push('Fitness');
    if (lowerPrompt.includes('travel')) keywords.push('Travel');
    if (lowerPrompt.includes('finance') || lowerPrompt.includes('money')) keywords.push('Finance');
    
    // If we found keywords, create a name
    if (keywords.length > 0) {
      return keywords[0] + (keywords.length > 1 ? ' ' + keywords[1] : '') + ' App';
    }
    
    // Fallback to generic name
    return 'New Project';
  }

  /**
   * 🔥 NEW: Generate valid Motoko actor name from project name
   * "Hello World App" -> "HelloWorldApp"
   * "Todo App" -> "TodoApp"
   * "e-commerce dashboard" -> "ECommerceDashboard"
   */
  private static generateActorName(projectName: string): string {
    return projectName
      // Remove special characters and punctuation, keep spaces and alphanumeric
      .replace(/[^a-zA-Z0-9\s]/g, '')
      // Split by spaces and capitalize each word
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      // Join without spaces
      .join('')
      // Ensure it starts with a letter (fallback to "Main" if it doesn't)
      .replace(/^[^a-zA-Z]+/, '') || 'Main';
  }

  static analyzePromptComplexity(prompt: string): 'simple' | 'medium' | 'complex' {
    const lowerPrompt = prompt.toLowerCase().trim();
    
    const complexityIndicators = {
      simple: [
        'hello world', 'basic', 'simple', 'minimal', 'quick', 'demo',
        'todo', 'calculator', 'counter', 'form', 'button', 'landing page'
      ],
      medium: [
        'dashboard', 'crud', 'authentication', 'login', 'signup',
        'gallery', 'blog', 'portfolio', 'chart', 'responsive', 'api'
      ],
      complex: [
        'ecommerce', 'marketplace', 'social', 'messaging', 'real-time',
        'multi-user', 'admin panel', 'cms', 'integration', 'database',
        'microservices', 'scalable', 'enterprise'
      ]
    };
    
    // Count feature indicators
    const featureKeywords = [
      'with', 'and', 'including', 'also', 'plus', 'that has',
      'authentication', 'database', 'real-time', 'responsive'
    ];
    const featureCount = featureKeywords.filter(k => lowerPrompt.includes(k)).length;
    
    // Check complexity indicators
    for (const [level, keywords] of Object.entries(complexityIndicators)) {
      if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
        return level as 'simple' | 'medium' | 'complex';
      }
    }
    
    // Fallback based on length and feature count
    const wordCount = prompt.trim().split(/\s+/).length;
    if (wordCount > 30 || featureCount > 3) return 'complex';
    if (wordCount > 15 || featureCount > 1) return 'medium';
    return 'simple';
  }
  
  /**
   * Generates a focused specification using the store's streaming approach
   * FIXED: Enhanced progress feedback during specification generation
   */
  static async generateSpecification(
    prompt: string,
    claudeService: any,
    onStreamEvent: (event: StreamEvent) => void
  ): Promise<SpecGenerationResult> {
    
    // CRITICAL FIX: Provide detailed progress feedback during spec generation
    const startTime = Date.now();
    
    // Phase 1: Initial analysis
    onStreamEvent({
      type: 'progress',
      progress: 10,
      message: 'Analyzing your project requirements...'
    });
    
    // Simulate brief delay to show progress
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Phase 2: Building specification prompt
    onStreamEvent({
      type: 'progress',
      progress: 25,
      message: 'Building technical specification framework...'
    });
    
    const specPrompt = this.buildSpecificationPrompt(prompt);
    
    // Phase 3: Connecting to Claude for specification analysis
    onStreamEvent({
      type: 'progress',
      progress: 40,
      message: 'Connecting to AI analysis engine for deep requirement analysis...'
    });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Phase 4: Processing with Claude
    onStreamEvent({
      type: 'progress',
      progress: 60,
      message: 'AI analyzing project scope and technical requirements...'
    });
    
    // Use the store's streaming approach with enhanced progress tracking
    const specResult = await claudeService.sendStreamingRulesBasedPrompt(
      specPrompt,
      (event: StreamEvent) => {
        // Enhanced progress feedback during Claude processing
        switch (event.type) {
          case 'connected':
            onStreamEvent({
              type: 'progress',
              progress: 70,
              message: 'Deep AI analysis in progress - evaluating project complexity...'
            });
            break;
            
          case 'content_delta':
            if (event.content && event.content.length > 100) {
              onStreamEvent({
                type: 'progress',
                progress: 85,
                message: 'AI generating detailed project specification...'
              });
            }
            break;
            
          case 'complete':
            onStreamEvent({
              type: 'progress',
              progress: 95,
              message: 'Specification analysis complete - finalizing requirements...'
            });
            break;
            
          case 'error':
            onStreamEvent({
              type: 'error',
              message: `Specification generation error: ${event.message}`
            });
            break;
        }
        
        // Pass through the original event with spec context
        onStreamEvent({
          ...event,
          context: 'specification'
        });
      }
    );
    
    // Phase 5: Final processing
    onStreamEvent({
      type: 'progress',
      progress: 100,
      message: 'Project specification ready - proceeding to template selection...'
    });
    
    // Parse the generated specification
    const spec = this.parseSpecificationSafely(specResult.content, prompt);
    
    // Extract constraints and build implementation prompt
    const constraints = this.extractConstraintsFromSpec(spec);
    const implementationPrompt = this.buildImplementationPrompt(prompt, constraints);
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ [AISpecGeneration] Specification completed in ${totalTime}ms with enhanced feedback`);
    
    return {
      spec,
      constraints,
      implementationPrompt,
      rawSpecContent: specResult.content
    };
  }
  
  /**
   * Builds the specification generation prompt
   */
  private static buildSpecificationPrompt(userPrompt: string): string {
    const detectedDomain = this.detectDomain(userPrompt);
    const userStyling = this.detectUserSpecifiedStyling(userPrompt);
    
    let stylingInstructions = '';
    if (userStyling.hasUserStyling) {
      stylingInstructions = `

🚨 CRITICAL STYLING PRIORITY: The user has specified their own styling preferences. You MUST use these instead of domain defaults:

${userStyling.colors && userStyling.colors.length > 0 ? `- User-specified colors: ${userStyling.colors.join(', ')} - USE THESE COLORS in the colorPalette` : ''}
${userStyling.style ? `- User-specified design style: ${userStyling.style} - USE THIS STYLE` : ''}
${userStyling.layout ? `- User-specified layout: ${userStyling.layout} - USE THIS LAYOUT` : ''}
${userStyling.theme ? `- User-specified theme: ${userStyling.theme} - USE THIS THEME` : ''}

IMPORTANT: User-specified styling takes ABSOLUTE PRIORITY over domain defaults. If the user mentioned colors, use those exact colors. If they mentioned a style, use that exact style.`;
    } else {
      stylingInstructions = `

VISUAL DESIGN GUIDANCE:
- Analyze the domain context (detected: ${detectedDomain}) and choose appropriate colors, style, and layout
- Finance apps: professional blues/grays, corporate style, dashboard layouts
- E-commerce: vibrant reds/oranges, modern style, card-based layouts
- Creative/Portfolio: bold colors, expressive design, grid layouts
- Healthcare: calming blues/teals, modern style, clean design
- Education: engaging purples/cyans, playful but professional, card-based
- Social: warm blues/purples, modern style, card-based feeds
- Productivity: clean greens/blues, minimalist style, list-based
- Entertainment: bold reds/purples, energetic design, dark themes
- Food: warm reds/oranges, appetizing colors, card-based
- Travel: inspiring blues/greens, modern style, image-focused
- Fitness: energetic reds/greens, bold style, dashboard layouts`;
    }
    
    return `Create ONLY a JSON specification (no code) for this request:

USER REQUEST: ${userPrompt}

CRITICAL INSTRUCTIONS:
- Include ONLY features explicitly mentioned or absolutely essential for the core goal
- Do NOT add enterprise features unless specifically requested
- Keep scope minimal and focused on the user's actual need
- If user says "simple" or "basic", reflect that in the specification
- ${userStyling.hasUserStyling ? 'PRIORITIZE user-specified styling preferences over domain defaults' : 'Analyze the domain context and provide appropriate visual design guidance'}

Generate a focused JSON specification with this EXACT structure:

{
  "projectMeta": {
    "name": "descriptive name based on request",
    "actorName": "ValidMotokoActorName",
    "description": "what this app does based on user request only",
    "complexity": "simple",
    "userIntent": "what the user specifically asked for"
  },
  "coreRequirements": {
    "primaryGoal": "main thing user wants to accomplish",
    "essentialFeatures": ["feature1", "feature2"],
    "explicitRequirements": ["requirement1", "requirement2"]
  },
  "minimalArchitecture": {
    "backendEntities": ["entity1", "entity2"],
    "frontendComponents": ["component1", "component2"],
    "keyInteractions": ["interaction1", "interaction2"]
  },
  "scopeBoundaries": {
    "included": ["what to build"],
    "excluded": ["what NOT to add unless requested"]
  },
  "visualDesign": {
    "domain": "${detectedDomain}",
    "colorPalette": {
      "primary": "#hexcolor",
      "secondary": "#hexcolor",
      "accent": "#hexcolor",
      "background": "#hexcolor",
      "text": "#hexcolor"
    },
    "designStyle": "modern|minimalist|corporate|playful|elegant|bold|warm|cool",
    "layoutPreference": "dashboard|card-based|list-based|grid|single-page|multi-page",
    "typographyStyle": "professional|friendly|bold|elegant|modern",
    "visualGuidance": [
      "domain-specific styling note 1",
      "domain-specific styling note 2"
    ]
  }
}

${stylingInstructions}

IMPORTANT: 
- Use only "simple", "medium", or "complex" for complexity
- Keep all arrays concise with 1-5 items maximum
- Use simple strings, no special characters in values
- Ensure valid JSON syntax with proper quotes and commas
- ${userStyling.hasUserStyling ? 'Use the user-specified colors/styles exactly as mentioned' : 'Provide hex color codes (e.g., "#3b82f6") for colorPalette based on domain'}
- ${userStyling.hasUserStyling ? 'Use the user-specified designStyle, layoutPreference exactly' : 'Choose designStyle, layoutPreference, and typographyStyle that match the domain'}
- Include 2-4 specific visual guidance notes ${userStyling.hasUserStyling ? 'based on user preferences' : 'for the domain'}

🚨 CRITICAL: PROJECT NAME REQUIREMENTS (projectMeta.name):
- The name MUST be a short, descriptive project name (2-5 words maximum)
- Examples of GOOD names: "Todo App", "E-commerce Dashboard", "Social Media Platform", "Fitness Tracker", "Recipe Manager"
- The name MUST be clean text only - NO special characters, NO emojis, NO instruction text
- DO NOT include any of these in the name:
  * Instruction markers (🎯, CURRENT USER INSTRUCTION, HIGHEST PRIORITY, etc.)
  * System prompts or coordination text
  * Priority markers or assembly text
  * Any text that looks like a system instruction
- The name should describe WHAT the app is, not HOW it's built
- Keep it under 50 characters
- Use title case (e.g., "Todo App with React" not "todo app with react")
- If unsure, use a simple descriptive name like "Task Manager" or "Shopping App"

🔥 CRITICAL: ACTOR NAME REQUIREMENTS (projectMeta.actorName):
- This is the Motoko actor name that will be used for the backend canister
- MUST be a valid Motoko identifier (starts with letter, alphanumeric only, no spaces or special chars)
- Convert the project name to PascalCase: "Todo App" -> "TodoApp", "E-commerce Dashboard" -> "EcommerceDashboard"
- Remove all spaces, hyphens, and special characters
- Each word should start with a capital letter
- Examples: "TodoApp", "FitnessTracker", "RecipeManager", "BudgetManager", "SocialPlatform"
- This will be used to generate imports like: import { TodoApp } from '../candid/TodoApp.did.js'

Focus on building exactly what the user asked for, nothing more.`;
  }
  
  /**
   * Safely parses the generated specification with fallback handling
   */
  private static parseSpecificationSafely(specContent: string, originalPrompt: string): ProjectSpec {
    try {
      const parsed = JSON.parse(specContent);
      
      if (!parsed.projectMeta || !parsed.coreRequirements) {
        throw new Error('Missing required spec sections');
      }
      
      // Clean and validate project name
      if (parsed.projectMeta.name) {
        // Clean up name: remove any leading/trailing whitespace, limit length
        parsed.projectMeta.name = parsed.projectMeta.name.trim().substring(0, 50);
      } else {
        // Generate name if missing
        parsed.projectMeta.name = this.generateFallbackProjectName(originalPrompt);
      }
      
      // 🔥 NEW: Generate valid Motoko actor name from project name
      // "Hello World App" -> "HelloWorldApp"
      parsed.projectMeta.actorName = this.generateActorName(parsed.projectMeta.name);
      
      const validComplexities = ['simple', 'medium', 'complex'];
      if (!validComplexities.includes(parsed.projectMeta.complexity)) {
        parsed.projectMeta.complexity = this.analyzePromptComplexity(originalPrompt);
      }
      
      // Check if user specified styling preferences
      const userStyling = this.detectUserSpecifiedStyling(originalPrompt);
      
      // Ensure visualDesign exists - add default if missing or invalid
      if (!parsed.visualDesign || typeof parsed.visualDesign !== 'object') {
        const domain = parsed.visualDesign?.domain || this.detectDomain(originalPrompt);
        const defaultDesign = this.getDefaultVisualDesign(domain, originalPrompt);
        
        // If user specified styling, merge it with defaults (user styling takes priority)
        if (userStyling.hasUserStyling && defaultDesign) {
          parsed.visualDesign = this.mergeUserStylingWithDefaults(userStyling, defaultDesign, domain);
        } else {
          parsed.visualDesign = defaultDesign;
        }
      } else {
        // Validate and fill in missing visualDesign fields
        const domain = parsed.visualDesign.domain || this.detectDomain(originalPrompt);
        const defaultDesign = this.getDefaultVisualDesign(domain, originalPrompt);
        
        // Merge with defaults, but prioritize user-specified styling if present
        if (userStyling.hasUserStyling && defaultDesign) {
          parsed.visualDesign = this.mergeUserStylingWithDefaults(userStyling, {
            ...defaultDesign,
            ...parsed.visualDesign // Preserve any AI-generated styling from spec
          }, domain);
        } else {
          // Merge with defaults to ensure all fields exist
          parsed.visualDesign = {
            domain: parsed.visualDesign.domain || defaultDesign!.domain,
            colorPalette: {
              ...defaultDesign!.colorPalette,
              ...(parsed.visualDesign.colorPalette || {})
            },
            designStyle: parsed.visualDesign.designStyle || defaultDesign!.designStyle,
            layoutPreference: parsed.visualDesign.layoutPreference || defaultDesign!.layoutPreference,
            typographyStyle: parsed.visualDesign.typographyStyle || defaultDesign!.typographyStyle,
            visualGuidance: parsed.visualDesign.visualGuidance || defaultDesign!.visualGuidance
          };
        }
      }
      
      return parsed;
      
    } catch (e) {
      // Try to extract JSON from the content
      const jsonMatch = specContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const cleaned = jsonMatch[0];
          const parsed = JSON.parse(cleaned);
          return parsed;
        } catch (e2) {
          // Continue to fallback
        }
      }
      
      // Fallback specification
      return this.createFallbackSpec(originalPrompt);
    }
  }
  
  /**
   * Creates a fallback specification when parsing fails
   */
  private static createFallbackSpec(originalPrompt: string): ProjectSpec {
    const complexity = this.analyzePromptComplexity(originalPrompt);
    const domain = this.detectDomain(originalPrompt);
    const defaultDesign = this.getDefaultVisualDesign(domain, originalPrompt);
    const userStyling = this.detectUserSpecifiedStyling(originalPrompt);
    
    // Merge user styling with defaults if user specified styling
    const visualDesign = userStyling.hasUserStyling && defaultDesign
      ? this.mergeUserStylingWithDefaults(userStyling, defaultDesign, domain)
      : defaultDesign;
    
    const fallbackName = originalPrompt.substring(0, 50);
    return {
      projectMeta: {
        name: fallbackName,
        actorName: this.generateActorName(fallbackName),
        description: `Application based on: ${originalPrompt}`,
        complexity,
        userIntent: originalPrompt
      },
      coreRequirements: {
        primaryGoal: 'Build the requested application',
        essentialFeatures: ['core functionality'],
        explicitRequirements: ['user requested features']
      },
      minimalArchitecture: {
        backendEntities: ['main entity'],
        frontendComponents: ['main component'],
        keyInteractions: ['user interactions']
      },
      scopeBoundaries: {
        included: ['requested features'],
        excluded: ['enterprise features unless requested']
      },
      visualDesign
    };
  }
  
  /**
   * Extracts focused constraints from the parsed specification
   */
  private static extractConstraintsFromSpec(spec: ProjectSpec): string {
    const constraints: string[] = [];
    
    // Core requirements
    if (spec.coreRequirements?.primaryGoal) {
      constraints.push(`PRIMARY GOAL: ${spec.coreRequirements.primaryGoal}`);
    }
    
    // Essential features
    if (spec.coreRequirements?.essentialFeatures?.length > 0) {
      constraints.push(`ESSENTIAL FEATURES: ${spec.coreRequirements.essentialFeatures.join(', ')}`);
    }
    
    // Architecture constraints
    if (spec.minimalArchitecture?.backendEntities?.length > 0) {
      constraints.push(`BACKEND ENTITIES: ${spec.minimalArchitecture.backendEntities.join(', ')} (${spec.minimalArchitecture.backendEntities.length} total)`);
    }
    
    if (spec.minimalArchitecture?.frontendComponents?.length > 0) {
      constraints.push(`FRONTEND COMPONENTS: ${spec.minimalArchitecture.frontendComponents.join(', ')} (${spec.minimalArchitecture.frontendComponents.length} total)`);
    }
    
    // Scope boundaries
    if (spec.scopeBoundaries?.included?.length > 0) {
      constraints.push(`INCLUDE: ${spec.scopeBoundaries.included.join(', ')}`);
    }
    
    if (spec.scopeBoundaries?.excluded?.length > 0) {
      constraints.push(`DO NOT INCLUDE: ${spec.scopeBoundaries.excluded.join(', ')}`);
    }
    
    // Complexity level
    if (spec.projectMeta?.complexity) {
      constraints.push(`COMPLEXITY LEVEL: ${spec.projectMeta.complexity}`);
    }
    
    // User intent
    if (spec.projectMeta?.userIntent) {
      constraints.push(`USER INTENT: ${spec.projectMeta.userIntent}`);
    }
    
    // Visual design constraints
    if (spec.visualDesign) {
      constraints.push(`\n🎨 VISUAL DESIGN REQUIREMENTS:`);
      constraints.push(`DOMAIN: ${spec.visualDesign.domain}`);
      
      if (spec.visualDesign.colorPalette) {
        const colorStrings: string[] = [];
        const palette = spec.visualDesign.colorPalette;
        if (palette.primary) colorStrings.push(`Primary: ${palette.primary}`);
        if (palette.secondary) colorStrings.push(`Secondary: ${palette.secondary}`);
        if (palette.accent) colorStrings.push(`Accent: ${palette.accent}`);
        if (palette.background) colorStrings.push(`Background: ${palette.background}`);
        if (palette.text) colorStrings.push(`Text: ${palette.text}`);
        if (colorStrings.length > 0) {
          constraints.push(`COLOR PALETTE: ${colorStrings.join(', ')}`);
        }
      }
      
      if (spec.visualDesign.designStyle) {
        constraints.push(`DESIGN STYLE: ${spec.visualDesign.designStyle}`);
      }
      
      if (spec.visualDesign.layoutPreference) {
        constraints.push(`LAYOUT PREFERENCE: ${spec.visualDesign.layoutPreference}`);
      }
      
      if (spec.visualDesign.typographyStyle) {
        constraints.push(`TYPOGRAPHY STYLE: ${spec.visualDesign.typographyStyle}`);
      }
      
      if (spec.visualDesign.visualGuidance?.length > 0) {
        constraints.push(`VISUAL GUIDANCE: ${spec.visualDesign.visualGuidance.join('; ')}`);
      }
    }
    
    return constraints.join('\n');
  }
  
  /**
   * Builds the constrained implementation prompt
   */
  private static buildImplementationPrompt(userPrompt: string, constraints: string): string {
    return `IMPLEMENT EXACTLY WHAT WAS REQUESTED

USER REQUEST: ${userPrompt}

FOCUSED CONSTRAINTS:
${constraints}

🚨 CRITICAL IMPLEMENTATION REQUIREMENTS:
- Build ONLY the features specified in the constraints
- Do NOT add features beyond what the user requested
- Keep the scope exactly as defined - no enterprise additions
- Generate complete, professional implementation within the defined scope
- Include proper error handling, validation, and professional styling
- Make it production-ready but appropriately sized

🏗️ REQUIRED OUTPUT:
- Complete Motoko backend with business logic for specified features only
- Full React frontend with components for specified functionality only  
- Professional CSS styling and responsive design
- Complete integration within the defined scope
- Immediately deployable and testable system

📋 DELIVERABLE:
Generate the complete, functional implementation that exactly matches the focused specification and directly satisfies: "${userPrompt}"`;
  }
  
  /**
   * Convenience method for store integration
   * Returns both the spec data and the ready-to-use implementation prompt
   */
  static async generateSpecAndPrompt(
    prompt: string,
    claudeService: any,
    onStreamEvent: (event: StreamEvent) => void
  ): Promise<SpecGenerationResult> {
    return this.generateSpecification(prompt, claudeService, onStreamEvent);
  }
}