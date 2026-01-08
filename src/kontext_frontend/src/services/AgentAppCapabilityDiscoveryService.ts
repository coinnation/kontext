import { Identity } from '@dfinity/agent';
import { AgentContextualAwarenessService, CanisterMethodDocumentation } from './AgentContextualAwarenessService';
import { ClaudeService } from '../claudeService';
import { MCPCatalogService } from './MCPCatalogService';

// Import AgentIdentity type
// Using a type definition that matches the canister's AgentIdentity
export interface AgentIdentity {
  name: string;
  description: string;
  instructions: string;
  defaultMcpServers?: string[];
  mcpClientEndpoint?: string;
  mcpTokens?: Array<[string, string]>;
}

export interface AgentCapabilities {
  agentId: string;
  name: string;
  description: string;
  instructions: string;
  mcpTools: Array<{
    serverId: string;
    toolName: string;
    description: string;
    parameters: any;
    appName?: string;
    actionName?: string;
  }>;
  capabilities: string[];
  strengths: string[];
}

export interface AppCapabilities {
  projectId: string;
  backendCanisterId: string;
  candidMethods: CanisterMethodDocumentation[];
  dataStructures: any[];
  uiComponents?: string[];
  appPurpose: string;
}

export interface IntegrationPoint {
  type: 'state-management' | 'ui-control' | 'data-flow' | 'event-handling' | 'autonomous-decision';
  description: string;
  agentCapability: string;
  appCapability: string;
  implementation: string;
}

export interface IntegrationStrategy {
  strategyType: 'unidirectional' | 'bidirectional' | 'autonomous';
  integrationPoints: IntegrationPoint[];
  agentEnhancements: {
    newInstructions: string;
    newMCPTools?: any[];
  };
  appEnhancements: {
    newComponents: string[];
    newHooks: string[];
    stateManagement?: any;
  };
  autonomousCapabilities?: {
    canRunAutonomously: boolean;
    autonomousTriggers: string[];
    decisionPoints: string[];
    safeguards: string[];
  };
  implementationPlan: {
    steps: Array<{
      type: 'code-generation' | 'instruction-update' | 'hook-creation' | 'state-setup';
      description: string;
      code?: string;
    }>;
  };
}

export class AgentAppCapabilityDiscoveryService {
  /**
   * Discover agent capabilities
   */
  static async discoverAgentCapabilities(
    agentCanisterId: string,
    identity: Identity,
    agentIdentity?: AgentIdentity
  ): Promise<AgentCapabilities> {
    console.log(`🔍 [CapabilityDiscovery] Discovering capabilities for agent: ${agentCanisterId}`);
    
    try {
      // If agentIdentity not provided, we'll need to fetch it
      // For now, we'll require it to be passed in
      if (!agentIdentity) {
        throw new Error('Agent identity is required. Please fetch agent data first.');
      }
      
      // Query ACTUAL tools from each MCP server using the agent's auth tokens
      const mcpTools: Array<{
        serverId: string;
        toolName: string;
        description: string;
        parameters: any;
        appName?: string;
        actionName?: string;
      }> = [];
      
      // Get MCP tokens from agent identity
      const mcpTokens = new Map<string, string>();
      if (agentIdentity.mcpTokens && Array.isArray(agentIdentity.mcpTokens)) {
        for (const [tokenKey, tokenValue] of agentIdentity.mcpTokens) {
          mcpTokens.set(tokenKey, tokenValue);
        }
      }

      // Process MCP servers - skip querying external servers for performance
      // The agent will have access to whatever tools the user authorizes at runtime
      for (const serverId of agentIdentity.defaultMcpServers || []) {
        // Internal servers with known tools
        const internalServers = ['kontext-canister-bridge'];
        if (internalServers.includes(serverId)) {
          console.log(`⏭️ [CapabilityDiscovery] Adding known tools for internal server ${serverId}`);
          
          // Add known tools for internal servers
          if (serverId === 'kontext-canister-bridge') {
            mcpTools.push({
              serverId,
              toolName: 'kontext/call_canister_method',
              description: 'Call backend canister methods directly from agents. Enables agents to interact with your app\'s backend canister using Candid interfaces.',
              parameters: {
                canisterId: 'string - The backend canister ID',
                methodName: 'string - The method name to call',
                parameters: 'object - JSON object with method parameters',
                candidInterface: 'string (optional) - Candid interface definition',
                network: 'string - "ic" or "local"'
              }
            });
          }
          continue;
        }
        
        // External MCP servers (Zapier, Rube, etc.) - skip querying for performance
        // The agent will have access to user-authorized tools at runtime
        console.log(`⏭️ [CapabilityDiscovery] Skipping tool query for ${serverId} - agent will have access to user-authorized tools at runtime`);
        
        // Add a general entry indicating the agent has access to this server
        // This provides context without slow queries
        const serverDescriptions: Record<string, string> = {
          'zapier': '8000+ apps - Gmail, Slack, Sheets, Calendar, Salesforce, Mailchimp, and thousands more',
          'rube': '500+ deeply integrated apps - Google Workspace (Gmail, Sheets, Drive, Calendar), Microsoft Teams, GitHub, Linear, Slack, Discord, WhatsApp, X, Instagram, TikTok, AI tools with smart tool discovery, parallel execution, and remote code execution'
        };
        
        const description = serverDescriptions[serverId.toLowerCase()] || 'User-authorized tools and integrations';
        
        mcpTools.push({
          serverId,
          toolName: `${serverId}/${serverId}/general`,
          description: `Agent has access to ${description}. The agent can use any tools the user has authorized in their ${serverId} account.`,
          parameters: {
            useCases: [`Automate workflows with ${serverId}`, `Integrate ${serverId} into your applications`]
          }
        });
      }
      
      // Analyze instructions to extract capabilities
      const capabilities = this.extractCapabilitiesFromInstructions(
        agentIdentity.instructions
      );
      
      // Identify strengths
      const strengths = this.identifyStrengths(agentIdentity, mcpTools);
      
      return {
        agentId: agentCanisterId,
        name: agentIdentity.name,
        description: agentIdentity.description,
        instructions: agentIdentity.instructions,
        mcpTools,
        capabilities,
        strengths
      };
    } catch (error) {
      console.error('❌ [CapabilityDiscovery] Failed to discover agent capabilities:', error);
      throw error;
    }
  }
  
  /**
   * Discover app capabilities
   */
  static async discoverAppCapabilities(
    projectId: string,
    backendCanisterId: string,
    identity: Identity
  ): Promise<AppCapabilities> {
    console.log(`🔍 [CapabilityDiscovery] Discovering app capabilities for project: ${projectId}`);
    
    try {
      // Use Candid discovery
      const candidDiscovery = await AgentContextualAwarenessService
        .discoverProjectCanisterMethods(projectId, backendCanisterId, identity);
      
      // Analyze project context to understand app purpose
      const projectContext = await this.analyzeProjectContext(projectId, identity);
      
      return {
        projectId,
        backendCanisterId,
        candidMethods: candidDiscovery.methodDocs,
        dataStructures: this.extractDataStructures(candidDiscovery.candidContent),
        appPurpose: projectContext.purpose,
        uiComponents: projectContext.components
      };
    } catch (error) {
      console.error('❌ [CapabilityDiscovery] Failed to discover app capabilities:', error);
      throw error;
    }
  }
  
  /**
   * Generate integration strategy using AI
   */
  static async generateIntegrationStrategy(
    agentCapabilities: AgentCapabilities,
    appCapabilities: AppCapabilities,
    userPreferences?: {
      integrationLevel: 'minimal' | 'moderate' | 'deep' | 'autonomous';
      focusAreas?: string[];
    }
  ): Promise<IntegrationStrategy> {
    console.log(`🤖 [CapabilityDiscovery] Generating integration strategy...`);
    
    try {
      const prompt = this.buildIntegrationStrategyPrompt(
        agentCapabilities,
        appCapabilities,
        userPreferences
      );
      
      // Use backend API for strategy generation (similar to spec generation)
      const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://ai.coinnation.io';
      
      // Get API key from ClaudeService
      const { ClaudeService } = await import('../claudeService');
      const claudeService = new ClaudeService();
      const claudeApiKey = await claudeService.getApiKey();
      
      const response = await fetch(`${baseUrl}/api/claude/generate-spec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          specType: 'agent',
          userPrompt: prompt,
          claudeApiKey: claudeApiKey,
          context: {
            integrationStrategy: true
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Strategy generation failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Parse JSON response
      try {
        // The response might be wrapped in a spec object
        let strategyContent = data.spec || data.content || data;
        
        // If it's a string, try to parse it
        if (typeof strategyContent === 'string') {
          // Try to extract JSON from markdown code blocks first
          const jsonMatch = strategyContent.match(/```json\s*([\s\S]*?)\s*```/) || strategyContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            strategyContent = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          } else {
            strategyContent = JSON.parse(strategyContent);
          }
        }
        
        // Ensure it matches our IntegrationStrategy interface
        const parsedStrategy = strategyContent as IntegrationStrategy;
        
        // Validate that we have a strategyType
        if (!parsedStrategy.strategyType) {
          console.warn('⚠️ [CapabilityDiscovery] Strategy missing strategyType, using default');
          throw new Error('Invalid strategy format: missing strategyType');
        }
        
        console.log(`✅ [CapabilityDiscovery] Strategy generated: ${parsedStrategy.strategyType}`);
        return parsedStrategy;
      } catch (parseError) {
        console.error('❌ [CapabilityDiscovery] Failed to parse strategy:', parseError);
        console.error('❌ [CapabilityDiscovery] Response data:', data);
        throw new Error('Failed to parse integration strategy from AI response');
      }
    } catch (error) {
      console.error('❌ [CapabilityDiscovery] Failed to generate strategy:', error);
      // Return a default strategy
      return this.generateDefaultStrategy(agentCapabilities, appCapabilities, userPreferences);
    }
  }
  
  /**
   * Fallback: Add tools from catalog if querying actual server fails
   */
  private static async addCatalogToolsAsFallback(
    serverId: string,
    mcpTools: Array<{
      serverId: string;
      toolName: string;
      description: string;
      parameters: any;
      appName?: string;
      actionName?: string;
    }>
  ): Promise<void> {
    try {
      const mcpCatalog = await MCPCatalogService.getInstance().getCatalog();
      const server = mcpCatalog.servers.find(s => s.id === serverId);
      if (server) {
        for (const tool of server.tools) {
          mcpTools.push({
            serverId,
            toolName: tool.name,
            description: tool.description,
            parameters: { useCases: tool.useCases }
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ [CapabilityDiscovery] Failed to get catalog fallback for ${serverId}:`, error);
    }
  }

  /**
   * Build prompt for AI strategy generation
   */
  private static buildIntegrationStrategyPrompt(
    agent: AgentCapabilities,
    app: AppCapabilities,
    preferences?: any
  ): string {
    // Build detailed MCP tools information
    const mcpToolsDetails = agent.mcpTools.map(tool => {
      let detail = `  - ${tool.serverId}/${tool.toolName}: ${tool.description}`;
      if (tool.appName) {
        detail += ` (App: ${tool.appName})`;
      }
      if (tool.actionName) {
        detail += ` (Action: ${tool.actionName})`;
      }
      if (tool.parameters && Object.keys(tool.parameters).length > 0) {
        detail += `\n    Parameters: ${JSON.stringify(tool.parameters).substring(0, 200)}`;
      }
      return detail;
    }).join('\n');

    return `You are an expert AI integration architect. Analyze the following agent and app capabilities, then generate a comprehensive integration strategy.

AGENT CAPABILITIES:
- Name: ${agent.name}
- Description: ${agent.description}
- Core Instructions: ${agent.instructions.substring(0, 500)}...
- MCP Tools Available (EXACT tools authorized in user's accounts):
${mcpToolsDetails.length > 0 ? mcpToolsDetails : '  - No specific tools discovered (using general server access)'}
- Identified Capabilities: ${agent.capabilities.join(', ')}
- Strengths: ${agent.strengths.join(', ')}

CRITICAL INSTRUCTIONS FOR MCP TOOLS:
1. The MCP tools listed above are the EXACT tools/apps/actions that the user has authorized in their MCP server accounts (e.g., Zapier, Rube).
2. For each tool, you can see:
   - The server ID (e.g., "zapier", "rube")
   - The exact tool name (e.g., "zapier/gmail_send", "rube/slack_post")
   - The app name (if available, e.g., "Gmail", "Slack")
   - The action name (if available, e.g., "Send Email", "Post Message")
   - The tool's parameters/input schema
3. When designing the integration strategy, ONLY use the specific tools listed above. Do not assume access to other tools not listed.
4. If a tool shows an app name and action name, that means the user has specifically authorized that app/action in their account. Use this information to design precise integration points.
5. If tools are not listed (fallback to general access), note that the agent has general access to the MCP server but specific authorized tools are unknown.

APP CAPABILITIES:
- Purpose: ${app.appPurpose}
- Backend Methods: ${app.candidMethods.map(m => 
  `${m.name}(${m.parameters.map(p => p.name).join(', ')}) - ${m.type}`
).join('\n  ')}
- Data Structures: ${JSON.stringify(app.dataStructures).substring(0, 500)}...

USER PREFERENCES:
- Integration Level: ${preferences?.integrationLevel || 'moderate'}
- Focus Areas: ${preferences?.focusAreas?.join(', ') || 'all'}

GENERATE AN INTEGRATION STRATEGY that includes:

1. STRATEGY TYPE:
   - "unidirectional": Agent enhances app (agent → app)
   - "bidirectional": Agent and app work together (agent ↔ app)
   - "autonomous": Agent can run app autonomously (agent = app)

2. INTEGRATION POINTS:
   For each integration point, specify:
   - type: "state-management" | "ui-control" | "data-flow" | "event-handling" | "autonomous-decision"
   - description: What agent capability connects to what app capability
   - agentCapability: The agent capability being used
   - appCapability: The app capability being used
   - implementation: How they interact

3. AGENT ENHANCEMENTS:
   - newInstructions: Enhanced instructions that include app context AND explicit instructions on how to call backend methods using the "kontext/call_canister_method" MCP tool
   - newMCPTools: REQUIRED - The integration MUST include "kontext-canister-bridge" MCP server. This server provides the "kontext/call_canister_method" tool that allows the agent to call backend canister methods. The tool accepts:
     * canisterId: The backend canister ID
     * methodName: The method name to call
     * parameters: JSON object with method parameters
     * candidInterface: (optional) Candid interface definition
     * network: "ic" or "local"
   CRITICAL: The agent MUST have access to the "kontext-canister-bridge" MCP server to actually execute backend methods. Instructions alone are not enough.

4. APP ENHANCEMENTS:
   - newComponents: New React components for agent interaction
   - newHooks: Hooks for agent-driven state management
   - stateManagement: State management setup

5. AUTONOMOUS CAPABILITIES (if strategyType is "autonomous"):
   - canRunAutonomously: true
   - autonomousTriggers: What triggers cause autonomous actions
   - decisionPoints: What decisions the agent can make
   - safeguards: What safeguards are needed

6. IMPLEMENTATION PLAN:
   - steps: Array of implementation steps with type, description, and optional code

Return ONLY valid JSON matching this structure:
{
  "strategyType": "unidirectional" | "bidirectional" | "autonomous",
  "integrationPoints": [...],
  "agentEnhancements": {...},
  "appEnhancements": {...},
  "autonomousCapabilities": {...},
  "implementationPlan": {...}
}`;
  }
  
  /**
   * Generate default strategy if AI generation fails
   */
  private static generateDefaultStrategy(
    agent: AgentCapabilities,
    app: AppCapabilities,
    preferences?: any
  ): IntegrationStrategy {
    const integrationLevel = preferences?.integrationLevel || 'moderate';
    
    return {
      strategyType: integrationLevel === 'autonomous' ? 'autonomous' : 
                    integrationLevel === 'deep' ? 'bidirectional' : 'unidirectional',
      integrationPoints: [
        {
          type: 'data-flow',
          description: `Agent can call backend methods to read and write data`,
          agentCapability: 'backend-method-calling',
          appCapability: 'candid-methods',
          implementation: 'Agent receives enhanced instructions with backend method documentation'
        }
      ],
      agentEnhancements: {
        newInstructions: AgentContextualAwarenessService.generateEnhancedInstructions(
          agent.instructions,
          app.candidMethods,
          app.backendCanisterId
        ),
        newMCPTools: []
      },
      appEnhancements: {
        newComponents: ['KontextAgent'],
        newHooks: ['useAgentIntegration'],
        stateManagement: {}
      },
      autonomousCapabilities: integrationLevel === 'autonomous' ? {
        canRunAutonomously: true,
        autonomousTriggers: ['user-inactivity', 'scheduled-maintenance'],
        decisionPoints: ['data-updates', 'notifications'],
        safeguards: ['require-approval-for-destructive-actions', 'log-all-decisions']
      } : undefined,
      implementationPlan: {
        steps: [
          {
            type: 'instruction-update',
            description: 'Update agent instructions with backend method knowledge'
          },
          {
            type: 'code-generation',
            description: 'Generate KontextAgent component',
            code: '// KontextAgent component will be generated'
          }
        ]
      }
    };
  }
  
  /**
   * Extract capabilities from agent instructions
   */
  private static extractCapabilitiesFromInstructions(instructions: string): string[] {
    const capabilities: string[] = [];
    const lowerInstructions = instructions.toLowerCase();
    
    // Common capability patterns
    if (lowerInstructions.includes('email') || lowerInstructions.includes('send email')) {
      capabilities.push('email-sending');
    }
    if (lowerInstructions.includes('data') || lowerInstructions.includes('analyze')) {
      capabilities.push('data-analysis');
    }
    if (lowerInstructions.includes('user') || lowerInstructions.includes('authentication')) {
      capabilities.push('user-authentication');
    }
    if (lowerInstructions.includes('search') || lowerInstructions.includes('find')) {
      capabilities.push('search');
    }
    if (lowerInstructions.includes('create') || lowerInstructions.includes('generate')) {
      capabilities.push('content-generation');
    }
    if (lowerInstructions.includes('update') || lowerInstructions.includes('modify')) {
      capabilities.push('data-modification');
    }
    
    return capabilities.length > 0 ? capabilities : ['general-assistance'];
  }
  
  /**
   * Identify agent strengths
   */
  private static identifyStrengths(
    agentIdentity: AgentIdentity,
    mcpTools: Array<any>
  ): string[] {
    const strengths: string[] = [];
    
    if (mcpTools.length > 0) {
      strengths.push('mcp-integration');
    }
    if (agentIdentity.instructions.length > 500) {
      strengths.push('detailed-instructions');
    }
    // Note: requireApproval is not part of AgentIdentity interface
    // If needed, it should be added to the interface definition
    
    return strengths.length > 0 ? strengths : ['versatile'];
  }
  
  /**
   * Analyze project context
   */
  private static async analyzeProjectContext(
    projectId: string,
    identity: Identity
  ): Promise<{ purpose: string; components: string[] }> {
    // This would analyze project files to understand app purpose
    // For now, return defaults
    return {
      purpose: 'Full-stack application',
      components: []
    };
  }
  
  /**
   * Extract data structures from Candid
   */
  private static extractDataStructures(candidContent: string): any[] {
    // Simple extraction - can be enhanced
    const structures: any[] = [];
    
    // Look for record types
    const recordPattern = /type\s+(\w+)\s*=\s*record\s*\{([^}]+)\}/g;
    let match;
    while ((match = recordPattern.exec(candidContent)) !== null) {
      structures.push({
        name: match[1],
        type: 'record',
        fields: match[2].split(';').map(f => f.trim()).filter(f => f.length > 0)
      });
    }
    
    return structures;
  }
}

