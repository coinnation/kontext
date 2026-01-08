/**
 * Service for generating Agent, Workflow, and Business Agency specifications
 * from natural language prompts using Claude AI
 */

import { ClaudeService } from '../claudeService';
import { MCPCatalogService } from './MCPCatalogService';
import type {
  AgentSpec,
  WorkflowSpec,
  BusinessAgencySpec,
  GenerationContext,
  GenerationResult
} from '../types/agentSpec';
import type { ChatMessage, ChatContext } from '../claudeService';

export class AIAgentGeneratorService {
  private claudeService: ClaudeService;
  private mcpCatalogService: MCPCatalogService;
  private baseUrl: string = 'https://ai.coinnation.io';

  constructor() {
    this.claudeService = new ClaudeService();
    this.mcpCatalogService = MCPCatalogService.getInstance();
  }

  /**
   * Get API key from ClaudeService
   */
  private async getApiKey(): Promise<string> {
    return await this.claudeService.getApiKey();
  }

  /**
   * Generate Agent spec from user prompt
   */
  async generateAgentSpec(
    userPrompt: string,
    context?: GenerationContext
  ): Promise<GenerationResult<AgentSpec>> {
    console.log('🤖 [AIAgentGenerator] Generating agent spec from prompt...');

    try {
      // Get API key
      const apiKey = await this.claudeService.getApiKey();
      if (!apiKey) {
        throw new Error('Claude API key not configured');
      }

      // Call the dedicated spec generation endpoint
      const baseUrl = 'https://ai.coinnation.io';
      const response = await fetch(`${baseUrl}/api/claude/generate-spec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userPrompt,
          specType: 'agent',
          claudeApiKey: apiKey,
          context,
          maxTokens: 8000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.spec) {
        throw new Error(result.error || 'Failed to generate spec');
      }

      // Transform and validate the spec
      const spec = this.normalizeAgentSpec(result.spec);

      // Validate spec
      this.validateAgentSpec(spec);

      // Extract next steps
      const nextSteps = this.extractAgentDependencies(spec, context);

      return {
        spec,
        explanation: result.explanation || `I've created an agent called "${spec.name}" that ${spec.description}. It uses ${spec.mcpServers.length} MCP server(s) to accomplish this.`,
        nextSteps,
        confidence: result.confidence || 0.85,
        estimatedCost: spec.metadata.estimatedCost
      };
    } catch (error) {
      console.error('❌ [AIAgentGenerator] Failed to generate agent spec:', error);
      throw new Error(`Failed to generate agent specification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate Workflow spec from user prompt
   */
  async generateWorkflowSpec(
    userPrompt: string,
    context?: GenerationContext
  ): Promise<GenerationResult<WorkflowSpec>> {
    console.log('🔄 [AIAgentGenerator] Generating workflow spec from prompt...');

    try {
      const apiKey = await this.claudeService.getApiKey();
      if (!apiKey) {
        throw new Error('Claude API key not configured');
      }

      const baseUrl = 'https://ai.coinnation.io';
      const response = await fetch(`${baseUrl}/api/claude/generate-spec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userPrompt,
          specType: 'workflow',
          claudeApiKey: apiKey,
          context,
          maxTokens: 8000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.spec) {
        throw new Error(result.error || 'Failed to generate spec');
      }

      const spec = this.normalizeWorkflowSpec(result.spec);
      this.validateWorkflowSpec(spec);

      const nextSteps = this.extractWorkflowDependencies(spec, context);

      return {
        spec,
        explanation: result.explanation || `I've created a ${spec.executionMode} workflow called "${spec.name}" with ${spec.steps.length} step(s). ${spec.description}`,
        nextSteps,
        confidence: result.confidence || 0.85,
        estimatedCost: undefined
      };
    } catch (error) {
      console.error('❌ [AIAgentGenerator] Failed to generate workflow spec:', error);
      throw new Error(`Failed to generate workflow specification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate Business Agency spec from user prompt
   */
  async generateBusinessAgencySpec(
    userPrompt: string,
    context?: GenerationContext
  ): Promise<GenerationResult<BusinessAgencySpec>> {
    console.log('🏢 [AIAgentGenerator] Generating business agency spec from prompt...');

    try {
      const apiKey = await this.claudeService.getApiKey();
      if (!apiKey) {
        throw new Error('Claude API key not configured');
      }

      const baseUrl = 'https://ai.coinnation.io';
      const response = await fetch(`${baseUrl}/api/claude/generate-spec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userPrompt,
          specType: 'agency',
          claudeApiKey: apiKey,
          context,
          maxTokens: 8000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.spec) {
        throw new Error(result.error || 'Failed to generate spec');
      }

      const spec = this.normalizeAgencySpec(result.spec);
      this.validateAgencySpec(spec);

      const nextSteps = this.extractAgencyDependencies(spec, context);

      return {
        spec,
        explanation: result.explanation || `I've created a ${spec.category} agency called "${spec.name}" with ${spec.agents.length} agent(s) and ${spec.workflows.length} workflow(s). ${spec.description}`,
        nextSteps,
        confidence: result.confidence || 0.85,
        estimatedCost: undefined
      };
    } catch (error) {
      console.error('❌ [AIAgentGenerator] Failed to generate agency spec:', error);
      throw new Error(`Failed to generate business agency specification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // PROMPT BUILDING
  // ============================================================================

  private buildAgentGenerationPrompt(context?: GenerationContext): string {
    return `You are an expert AI agent architect. Your job is to generate AgentSpec JSON from user requirements.

AgentSpec Schema:
{
  "name": "string - Clear, descriptive agent name",
  "description": "string - What the agent does",
  "instructions": "string - Detailed system prompt for the agent",
  "config": {
    "confidenceThreshold": "number 0-1 - 0.7-0.9 for most tasks, 0.95+ for critical",
    "temperature": "number 0-1 - 0.3-0.7 for structured, 0.7-1.0 for creative",
    "maxTokens": "number - 4000-8000 for most tasks",
    "requireApproval": "boolean - true for high-risk operations"
  },
  "mcpServers": [{
    "serverId": "string - e.g., 'zapier', 'github'",
    "tools": ["array of specific tool names"],
    "authRequired": "boolean",
    "authConfig": {
      "type": "'api_key' | 'oauth' | 'token'",
      "instructions": "string - what user needs to provide"
    }
  }],
  "dependencies": {
    "requiresServerPair": "boolean",
    "requiresMcpAuth": [{
      "serverId": "string",
      "authType": "string",
      "instructions": "string"
    }],
    "requiresExternalSetup": [{
      "service": "string",
      "action": "string",
      "reason": "string"
    }]
  },
  "metadata": {
    "category": "string",
    "complexity": "'low' | 'medium' | 'high'",
    "tags": ["array of strings"]
  }
}

Guidelines:
1. Analyze the user's request carefully
2. Select MCP servers that best match the requirements
3. Choose specific tools from those servers that are needed
4. Set appropriate configuration values
5. Write clear, actionable instructions for the agent
6. Identify ALL dependencies
7. Be specific about MCP tool selection

Return ONLY valid JSON, no markdown, no explanations, just JSON.`;
  }

  private buildAgentPrompt(
    userPrompt: string,
    mcpCatalog: any,
    context?: GenerationContext
  ): string {
    let prompt = `User Request: ${userPrompt}\n\n`;

    prompt += `Available MCP Servers:\n${JSON.stringify(mcpCatalog.servers.slice(0, 20), null, 2)}\n\n`;

    if (context?.existingAgents && context.existingAgents.length > 0) {
      prompt += `Existing Agents (can be reused):\n${JSON.stringify(context.existingAgents, null, 2)}\n\n`;
    }

    prompt += `Generate a complete AgentSpec JSON that matches the user's requirements. `;
    prompt += `Select appropriate MCP servers and tools. Identify all dependencies.`;

    return prompt;
  }

  private buildWorkflowGenerationPrompt(context?: GenerationContext): string {
    return `You are an expert workflow architect. Generate WorkflowSpec JSON from user requirements.

WorkflowSpec Schema:
{
  "name": "string",
  "description": "string",
  "executionMode": "'sequential' | 'parallel' | 'conditional'",
  "steps": [{
    "stepId": "string - unique ID",
    "agentSpec": "AgentSpec object if agent needs creation",
    "agentCanisterId": "string if agent exists",
    "agentName": "string - display name",
    "inputTemplate": "string - CRITICAL: MUST use ONLY these valid template variables: {input}, {previous_output}, {workflow_input}, {step_1_output}, {step_2_output}, {step_3_output}, etc. (1-indexed). DO NOT create custom variable names like {email_content_1} or {step_email_agent_1_output}. For sequential workflows, use {previous_output} to reference the previous step. For specific steps, use {step_N_output} where N is the step number (1-indexed).",
    "requiresApproval": "boolean",
    "retryOnFailure": "boolean",
    "timeout": "number (optional)"
  }],
  "connections": [{
    "from": "stepId",
    "to": "stepId",
    "condition": {
      "type": "'always' | 'on_success' | 'on_error' | 'custom'",
      "expression": "string (optional)"
    }
  }],
  "dependencies": {
    "requiresServerPairs": "number",
    "requiresAgents": [{"agentSpec": "AgentSpec", "reason": "string"}],
    "requiresMcpAuth": [{"serverId": "string", "authType": "string", "instructions": "string"}]
  },
  "metadata": {
    "category": "string",
    "complexity": "'low' | 'medium' | 'high'",
    "tags": ["array"]
  }
}

Return ONLY valid JSON.`;
  }

  private buildWorkflowPrompt(
    userPrompt: string,
    mcpCatalog: any,
    context?: GenerationContext
  ): string {
    let prompt = `User Request: ${userPrompt}\n\n`;

    prompt += `Available MCP Servers:\n${JSON.stringify(mcpCatalog.servers.slice(0, 20), null, 2)}\n\n`;

    if (context?.existingAgents && context.existingAgents.length > 0) {
      prompt += `Existing Agents:\n${JSON.stringify(context.existingAgents, null, 2)}\n\n`;
    }

    prompt += `Generate a complete WorkflowSpec JSON. Break down the workflow into logical steps. `;
    prompt += `Determine if agents should be created or if existing agents can be reused.\n\n`;
    prompt += `CRITICAL INPUT TEMPLATE RULES:\n`;
    prompt += `- For the first step, use {input} or {workflow_input} to reference the workflow input\n`;
    prompt += `- For subsequent steps in sequential workflows, use {previous_output} to reference the previous step's output\n`;
    prompt += `- To reference a specific step's output, use {step_N_output} where N is the step number (1-indexed, e.g., {step_1_output}, {step_2_output})\n`;
    prompt += `- DO NOT create custom variable names like {email_content_1} or {step_email_agent_1_output}\n`;
    prompt += `- ONLY use the predefined variables: {input}, {previous_output}, {workflow_input}, {step_1_output}, {step_2_output}, etc.\n`;

    return prompt;
  }

  private buildAgencyGenerationPrompt(context?: GenerationContext): string {
    return `You are an expert business agency architect. Generate BusinessAgencySpec JSON.

BusinessAgencySpec Schema:
{
  "name": "string",
  "description": "string",
  "category": "'marketing' | 'sales' | 'support' | 'operations' | 'custom'",
  "icon": "string - emoji",
  "color": "string - hex color",
  "agents": [{
    "agentSpec": "AgentSpec (if new)",
    "agentCanisterId": "string (if existing)",
    "role": "string - e.g., 'Content Creator'"
  }],
  "workflows": [{
    "workflowSpec": "WorkflowSpec (if new)",
    "workflowId": "string (if existing)",
    "purpose": "string"
  }],
  "goals": [{
    "name": "string",
    "description": "string",
    "target": "string - e.g., '50 tasks/month'"
  }],
  "dependencies": {
    "requiresServerPairs": "number",
    "requiresAgents": "number",
    "requiresWorkflows": "number",
    "requiresMcpAuth": [{"serverId": "string", "authType": "string", "instructions": "string"}]
  },
  "metadata": {
    "estimatedSetupTime": "string",
    "complexity": "'low' | 'medium' | 'high'",
    "tags": ["array"]
  }
}

Return ONLY valid JSON.`;
  }

  private buildAgencyPrompt(
    userPrompt: string,
    mcpCatalog: any,
    context?: GenerationContext
  ): string {
    let prompt = `User Request: ${userPrompt}\n\n`;

    prompt += `Available MCP Servers:\n${JSON.stringify(mcpCatalog.servers.slice(0, 20), null, 2)}\n\n`;

    if (context?.existingAgents && context.existingAgents.length > 0) {
      prompt += `Existing Agents:\n${JSON.stringify(context.existingAgents, null, 2)}\n\n`;
    }

    if (context?.existingWorkflows && context.existingWorkflows.length > 0) {
      prompt += `Existing Workflows:\n${JSON.stringify(context.existingWorkflows, null, 2)}\n\n`;
    }

    prompt += `Generate a complete BusinessAgencySpec JSON. `;
    prompt += `Determine appropriate agents and workflows. Create business goals.`;

    return prompt;
  }

  // ============================================================================
  // JSON EXTRACTION & VALIDATION
  // ============================================================================

  private extractJSON(content: string): string {
    // Try to find JSON in markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      return jsonMatch[1];
    }

    // Try to find JSON object directly
    const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      return jsonObjectMatch[0];
    }

    throw new Error('No valid JSON found in AI response');
  }

  /**
   * Normalize agent spec from AI response to match expected structure
   */
  private normalizeAgentSpec(rawSpec: any): AgentSpec {
    // Handle case where spec might be wrapped in agentSpec property
    let spec = rawSpec.agentSpec || rawSpec;

    // Ensure required fields exist with defaults
    const normalized: AgentSpec = {
      name: spec.name || 'Unnamed Agent',
      description: spec.description || 'AI agent',
      instructions: spec.instructions || spec.systemPrompt || spec.description || 'You are a helpful AI assistant.',
      config: spec.config || {
        confidenceThreshold: 0.7,
        temperature: 0.7,
        maxTokens: 4000,
        requireApproval: false
      },
      mcpServers: Array.isArray(spec.mcpServers) ? spec.mcpServers.map((s: any) => ({
        serverId: s.serverId || s.id || s.name || '',
        tools: Array.isArray(s.tools) ? s.tools : s.tool ? [s.tool] : ['general'],
        authRequired: s.authRequired !== undefined ? s.authRequired : true,
        authConfig: s.authConfig || (s.authRequired !== false ? {
          type: 'api_key' as const,
          instructions: `Configure ${s.serverId || s.id || s.name} authentication`
        } : undefined)
      })) : [],
      triggers: spec.triggers,
      dependencies: spec.dependencies || {
        requiresServerPair: true,
        requiresMcpAuth: [],
        requiresExternalSetup: []
      },
      metadata: spec.metadata || {
        category: spec.category || 'general',
        complexity: spec.complexity || 'medium',
        tags: spec.tags || []
      }
    };

    // Normalize config values
    if (normalized.config.confidenceThreshold === undefined) {
      normalized.config.confidenceThreshold = 0.7;
    }
    if (normalized.config.temperature === undefined) {
      normalized.config.temperature = 0.7;
    }
    if (normalized.config.maxTokens === undefined) {
      normalized.config.maxTokens = 4000;
    }
    if (normalized.config.requireApproval === undefined) {
      normalized.config.requireApproval = false;
    }

    // Ensure dependencies structure
    if (!normalized.dependencies.requiresMcpAuth) {
      normalized.dependencies.requiresMcpAuth = [];
    }
    if (!normalized.dependencies.requiresExternalSetup) {
      normalized.dependencies.requiresExternalSetup = [];
    }

    return normalized;
  }

  /**
   * Normalize input template to use only valid template variables
   */
  private normalizeInputTemplate(template: string | undefined, stepIndex: number, totalSteps: number): string {
    if (!template) {
      return stepIndex === 0 ? '{input}' : '{previous_output}';
    }

    let normalized = template;

    // Replace common invalid patterns with valid ones
    // Pattern: {step_<name>_output} -> {step_N_output} where N is step index + 1
    normalized = normalized.replace(/\{step_([a-zA-Z_]+)_(\d+)_output\}/g, (match, name, num) => {
      const stepNum = parseInt(num, 10);
      return `{step_${stepNum}_output}`;
    });

    // Pattern: {step_<name>_output} -> try to find step by name and convert to index
    normalized = normalized.replace(/\{step_([a-zA-Z_]+)_output\}/g, (match, stepName) => {
      // Try to find step index by name - for now, default to previous_output for sequential
      return '{previous_output}';
    });

    // Pattern: {<custom_name>_<number>} -> {input} for first step, {previous_output} for others
    normalized = normalized.replace(/\{([a-zA-Z_]+)_(\d+)\}/g, (match, name, num) => {
      if (stepIndex === 0) {
        return '{input}';
      }
      return '{previous_output}';
    });

    // Pattern: {<custom_name>} that's not a valid variable -> replace based on context
    const validVariables = ['input', 'previous_output', 'workflow_input', 'step_1_output', 'step_2_output', 'step_3_output', 'step_4_output', 'step_5_output', 'step_6_output', 'step_7_output', 'step_8_output', 'step_9_output', 'step_10_output'];
    normalized = normalized.replace(/\{([a-zA-Z_]+)\}/g, (match, varName) => {
      if (validVariables.includes(varName)) {
        return match; // Keep valid variables
      }
      // Replace invalid variables based on step position
      if (stepIndex === 0) {
        return '{input}';
      }
      return '{previous_output}';
    });

    return normalized;
  }

  /**
   * Normalize workflow spec from AI response to match expected structure
   */
  private normalizeWorkflowSpec(rawSpec: any): WorkflowSpec {
    // Handle case where spec might be wrapped in workflowSpec property
    let spec = rawSpec.workflowSpec || rawSpec;

    // Ensure required fields exist with defaults
    const normalized: WorkflowSpec = {
      name: spec.name || 'Unnamed Workflow',
      description: spec.description || 'Multi-agent workflow',
      executionMode: spec.executionMode || 'sequential',
      steps: Array.isArray(spec.steps) ? spec.steps.map((step: any, index: number) => ({
        stepId: step.stepId || `step_${index + 1}`,
        agentSpec: step.agentSpec ? this.normalizeAgentSpec(step.agentSpec) : undefined,
        agentCanisterId: step.agentCanisterId || undefined,
        agentName: step.agentName || step.agentSpec?.name || `Agent ${index + 1}`,
        inputTemplate: this.normalizeInputTemplate(step.inputTemplate, index, spec.steps.length) || (index === 0 ? '{input}' : '{previous_output}'),
        requiresApproval: step.requiresApproval !== undefined ? step.requiresApproval : false,
        retryOnFailure: step.retryOnFailure !== undefined ? step.retryOnFailure : true,
        timeout: step.timeout,
        condition: step.condition
      })) : [],
      connections: Array.isArray(spec.connections) ? spec.connections.map((conn: any) => ({
        from: conn.from || conn.fromStep || '',
        to: conn.to || conn.toStep || '',
        condition: conn.condition || {
          type: 'always' as const
        }
      })) : [],
      globalTriggers: spec.globalTriggers || spec.triggers,
      dependencies: spec.dependencies || {
        requiresServerPairs: spec.requiresServerPairs || 1,
        requiresAgents: Array.isArray(spec.requiresAgents) ? spec.requiresAgents.map((a: any) => ({
          agentSpec: a.agentSpec ? this.normalizeAgentSpec(a.agentSpec) : this.normalizeAgentSpec(a),
          reason: a.reason || 'Required for workflow step'
        })) : [],
        requiresMcpAuth: spec.requiresMcpAuth || []
      },
      metadata: spec.metadata || {
        category: spec.category || 'general',
        complexity: spec.complexity || 'medium',
        tags: spec.tags || []
      }
    };

    // Auto-generate connections if missing but steps exist
    if (normalized.connections.length === 0 && normalized.steps.length > 1) {
      for (let i = 0; i < normalized.steps.length - 1; i++) {
        normalized.connections.push({
          from: normalized.steps[i].stepId,
          to: normalized.steps[i + 1].stepId,
          condition: {
            type: 'on_success' as const
          }
        });
      }
    }

    return normalized;
  }

  /**
   * Normalize business agency spec from AI response to match expected structure
   */
  private normalizeAgencySpec(rawSpec: any): BusinessAgencySpec {
    // Handle case where spec might be wrapped in agencySpec or businessAgencySpec property
    let spec = rawSpec.agencySpec || rawSpec.businessAgencySpec || rawSpec;

    // Build agents and workflows first so we can use them in dependencies calculation
    const agents = Array.isArray(spec.agents) ? spec.agents.map((agent: any) => ({
      agentSpec: agent.agentSpec ? this.normalizeAgentSpec(agent.agentSpec) : undefined,
      agentCanisterId: agent.agentCanisterId || agent.agentId || undefined,
      role: agent.role || agent.name || 'Agent'
    })) : [];

    const workflows = Array.isArray(spec.workflows) ? spec.workflows.map((workflow: any) => ({
      workflowSpec: workflow.workflowSpec ? this.normalizeWorkflowSpec(workflow.workflowSpec) : undefined,
      workflowId: workflow.workflowId || workflow.id || undefined,
      purpose: workflow.purpose || workflow.description || 'Workflow'
    })) : [];

    // Ensure required fields exist with defaults
    const normalized: BusinessAgencySpec = {
      name: spec.name || 'Unnamed Agency',
      description: spec.description || 'Business agency',
      category: spec.category || 'custom',
      icon: spec.icon || '🏢',
      color: spec.color || '#3B82F6',
      agents,
      workflows,
      goals: Array.isArray(spec.goals) ? spec.goals.map((goal: any) => ({
        name: goal.name || 'Goal',
        description: goal.description || '',
        target: goal.target || '0',
        taskMapping: goal.taskMapping
      })) : [],
      dependencies: spec.dependencies || {
        requiresServerPairs: spec.requiresServerPairs || 1,
        requiresAgents: spec.requiresAgents !== undefined ? spec.requiresAgents : agents.filter(a => !!a.agentSpec).length,
        requiresWorkflows: spec.requiresWorkflows !== undefined ? spec.requiresWorkflows : workflows.filter(w => !!w.workflowSpec).length,
        requiresMcpAuth: spec.requiresMcpAuth || []
      },
      metadata: spec.metadata || {
        estimatedSetupTime: spec.estimatedSetupTime || '30 minutes',
        complexity: spec.complexity || 'medium',
        tags: spec.tags || []
      }
    };

    return normalized;
  }

  private validateAgentSpec(spec: AgentSpec): void {
    if (!spec.name || !spec.description || !spec.instructions) {
      console.error('❌ [AIAgentGenerator] Invalid spec structure:', {
        hasName: !!spec.name,
        hasDescription: !!spec.description,
        hasInstructions: !!spec.instructions,
        specKeys: Object.keys(spec)
      });
      throw new Error('Invalid AgentSpec: missing required fields (name, description, or instructions)');
    }
    if (!spec.config || !spec.dependencies || !spec.metadata) {
      console.error('❌ [AIAgentGenerator] Missing configuration sections:', {
        hasConfig: !!spec.config,
        hasDependencies: !!spec.dependencies,
        hasMetadata: !!spec.metadata
      });
      throw new Error('Invalid AgentSpec: missing configuration sections');
    }
  }

  private validateWorkflowSpec(spec: WorkflowSpec): void {
    if (!spec.name || !spec.description || !spec.executionMode) {
      throw new Error('Invalid WorkflowSpec: missing required fields');
    }
    if (!spec.steps || spec.steps.length === 0) {
      throw new Error('Invalid WorkflowSpec: must have at least one step');
    }
  }

  private validateAgencySpec(spec: BusinessAgencySpec): void {
    if (!spec.name || !spec.description || !spec.category) {
      throw new Error('Invalid BusinessAgencySpec: missing required fields');
    }
  }

  // ============================================================================
  // DEPENDENCY EXTRACTION
  // ============================================================================

  private extractAgentDependencies(
    spec: AgentSpec,
    context?: GenerationContext
  ): Array<{ type: string; message: string; action?: string }> {
    const steps: Array<{ type: string; message: string; action?: string }> = [];

    if (spec.dependencies.requiresServerPair) {
      const hasServerPair = (context?.availableServerPairs || 0) > 0;
      if (!hasServerPair) {
        steps.push({
          type: 'create_server_pair',
          message: 'You need at least one server pair to deploy this agent.',
          action: 'navigate_to_server_management'
        });
      }
    }

    spec.dependencies.requiresMcpAuth.forEach(auth => {
      const hasAuth = context?.userMcpAuth?.some(
        a => a.serverId === auth.serverId && a.authType === auth.authType
      );
      if (!hasAuth) {
        steps.push({
          type: 'configure_mcp_auth',
          message: `This agent requires ${auth.authType} authentication for ${auth.serverId}. ${auth.instructions}`,
          action: `configure_auth_${auth.serverId}`
        });
      }
    });

    spec.dependencies.requiresExternalSetup.forEach(setup => {
      steps.push({
        type: 'external_setup',
        message: `${setup.service}: ${setup.action}. Reason: ${setup.reason}`,
        action: `external_${setup.service.toLowerCase()}`
      });
    });

    return steps;
  }

  private extractWorkflowDependencies(
    spec: WorkflowSpec,
    context?: GenerationContext
  ): Array<{ type: string; message: string; action?: string }> {
    const steps: Array<{ type: string; message: string; action?: string }> = [];

    if (spec.dependencies.requiresServerPairs > 0) {
      const available = context?.availableServerPairs || 0;
      const needed = spec.dependencies.requiresServerPairs;
      if (available < needed) {
        steps.push({
          type: 'create_server_pair',
          message: `This workflow requires ${needed} server pair(s). You have ${available}.`,
          action: 'navigate_to_server_management'
        });
      }
    }

    spec.dependencies.requiresAgents.forEach((agent, idx) => {
      steps.push({
        type: 'create_agent',
        message: `Agent ${idx + 1}: "${agent.agentSpec.name}" - ${agent.reason}`,
        action: 'create_agent'
      });
    });

    spec.dependencies.requiresMcpAuth.forEach(auth => {
      steps.push({
        type: 'configure_mcp_auth',
        message: `Configure ${auth.authType} authentication for ${auth.serverId}. ${auth.instructions}`,
        action: `configure_auth_${auth.serverId}`
      });
    });

    return steps;
  }

  private extractAgencyDependencies(
    spec: BusinessAgencySpec,
    context?: GenerationContext
  ): Array<{ type: string; message: string; action?: string }> {
    const steps: Array<{ type: string; message: string; action?: string }> = [];

    if (spec.dependencies.requiresServerPairs > 0) {
      const available = context?.availableServerPairs || 0;
      const needed = spec.dependencies.requiresServerPairs;
      if (available < needed) {
        steps.push({
          type: 'create_server_pair',
          message: `This agency requires ${needed} server pair(s). You have ${available}.`,
          action: 'navigate_to_server_management'
        });
      }
    }

    if (spec.dependencies.requiresAgents > 0) {
      steps.push({
        type: 'create_agents',
        message: `This agency requires ${spec.dependencies.requiresAgents} new agent(s) to be created.`,
        action: 'create_agents'
      });
    }

    if (spec.dependencies.requiresWorkflows > 0) {
      steps.push({
        type: 'create_workflows',
        message: `This agency requires ${spec.dependencies.requiresWorkflows} new workflow(s) to be created.`,
        action: 'create_workflows'
      });
    }

    spec.dependencies.requiresMcpAuth.forEach(auth => {
      steps.push({
        type: 'configure_mcp_auth',
        message: `Configure ${auth.authType} authentication for ${auth.serverId}. ${auth.instructions}`,
        action: `configure_auth_${auth.serverId}`
      });
    });

    return steps;
  }
}

