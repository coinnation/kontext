/**
 * JSON Schema definitions for AI-generated agent, workflow, and agency specifications
 */

// ============================================================================
// AGENT SPECIFICATION
// ============================================================================

export interface AgentSpec {
  // Basic Info
  name: string;
  description: string;
  instructions: string; // System prompt for the agent
  
  // Configuration
  config: {
    confidenceThreshold: number; // 0-1
    temperature: number; // 0-1
    maxTokens: number;
    requireApproval: boolean;
  };
  
  // MCP Integration
  mcpServers: Array<{
    serverId: string; // e.g., "zapier", "github", "filesystem"
    tools: string[]; // Specific tool names to enable
    authRequired?: boolean;
    authConfig?: {
      type: 'api_key' | 'oauth' | 'token';
      instructions: string; // What user needs to provide
    };
  }>;
  
  // Triggers (optional - can be added later)
  triggers?: Array<{
    type: 'webhook' | 'scheduled' | 'manual' | 'condition';
    config: any; // Type-specific config
  }>;
  
  // Dependencies
  dependencies: {
    requiresServerPair: boolean;
    requiresMcpAuth: Array<{
      serverId: string;
      authType: string;
      instructions: string;
    }>;
    requiresExternalSetup: Array<{
      service: string; // e.g., "Zapier", "Rube"
      action: string; // e.g., "Add Gmail integration"
      reason: string;
    }>;
  };
  
  // Metadata
  metadata: {
    category: string;
    estimatedCost?: string;
    complexity: 'low' | 'medium' | 'high';
    tags: string[];
  };
}

// ============================================================================
// WORKFLOW SPECIFICATION
// ============================================================================

export interface WorkflowSpec {
  // Basic Info
  name: string;
  description: string;
  executionMode: 'sequential' | 'parallel' | 'conditional';
  
  // Steps
  steps: Array<{
    stepId: string;
    agentSpec?: AgentSpec; // If agent needs to be created
    agentCanisterId?: string; // If agent already exists
    agentName: string; // Display name
    inputTemplate: string; // Can use {previous_output}, {step_N_output}
    requiresApproval: boolean;
    retryOnFailure: boolean;
    timeout?: number;
    condition?: {
      type: 'success' | 'error' | 'custom';
      expression?: string;
    };
    // NEW: Loop support
    loopConfig?: {
      type: 'for_each' | 'while_loop' | 'repeat' | 'none';
      forEach?: {
        arraySource: string; // e.g., "{step_1_output}.emails" or "{input}"
        itemVariable: string; // e.g., "item"
        indexVariable: string; // e.g., "index"
        maxIterations?: number; // Safety limit
      };
      whileLoop?: {
        condition: string; // e.g., "{step_1_output}.length > 0"
        maxIterations?: number; // Safety limit
      };
      repeat?: {
        count: number; // Number of times to repeat
        indexVariable?: string; // Optional: variable name for iteration number
      };
    };
    // NEW: Nested workflow support
    nestedWorkflow?: {
      workflowId: string; // ID of workflow to execute
      inputMapping: string; // How to map current context to sub-workflow input
    };
  }>;
  
  // Connections
  connections: Array<{
    from: string; // stepId
    to: string; // stepId
    condition?: {
      type: 'always' | 'on_success' | 'on_error' | 'custom';
      expression?: string;
    };
  }>;
  
  // Global Triggers
  globalTriggers?: Array<{
    type: 'webhook' | 'scheduled' | 'condition' | 'manual';
    config: any;
  }>;
  
  // Dependencies
  dependencies: {
    requiresServerPairs: number; // How many server pairs needed
    requiresAgents: Array<{
      agentSpec: AgentSpec;
      reason: string;
    }>;
    requiresMcpAuth: Array<{
      serverId: string;
      authType: string;
      instructions: string;
    }>;
  };
  
  // Metadata
  metadata: {
    category: string;
    estimatedExecutionTime?: string;
    complexity: 'low' | 'medium' | 'high';
    tags: string[];
  };
}

// ============================================================================
// BUSINESS AGENCY SPECIFICATION
// ============================================================================

export interface BusinessAgencySpec {
  // Basic Info
  name: string;
  description: string;
  category: 'marketing' | 'sales' | 'support' | 'operations' | 'custom';
  icon: string;
  color?: string;
  
  // Resources (can reference existing or create new)
  agents: Array<{
    agentSpec?: AgentSpec; // Create new
    agentCanisterId?: string; // Use existing
    role: string; // e.g., "Content Creator", "Data Analyst"
  }>;
  
  workflows: Array<{
    workflowSpec?: WorkflowSpec; // Create new
    workflowId?: string; // Use existing
    purpose: string;
  }>;
  
  // Business Goals
  goals: Array<{
    name: string;
    description: string;
    target: string; // e.g., "50 tasks/month"
    taskMapping?: {
      agentIds?: string[];
      triggerTypes?: string[];
      taskStatus?: string[];
      countMethod: 'total' | 'completed' | 'successful' | 'failed';
      timeWindow?: {
        type: 'all_time' | 'last_days' | 'last_weeks' | 'last_months';
        value?: number;
      };
    };
  }>;
  
  // Dependencies
  dependencies: {
    requiresServerPairs: number;
    requiresAgents: number; // Count of new agents to create
    requiresWorkflows: number; // Count of new workflows to create
    requiresMcpAuth: Array<{
      serverId: string;
      authType: string;
      instructions: string;
    }>;
  };
  
  // Metadata
  metadata: {
    estimatedSetupTime: string;
    complexity: 'low' | 'medium' | 'high';
    tags: string[];
  };
}

// ============================================================================
// DEPENDENCY ANALYSIS
// ============================================================================

export interface DependencyAnalysis {
  canProceed: boolean;
  missing: Array<{
    id: string;
    type: 'server_pair' | 'agent' | 'workflow' | 'mcp_auth' | 'external_setup';
    message: string;
    canSkip?: boolean;
    priority: 'critical' | 'high' | 'medium' | 'low';
    data?: any; // Type-specific data
  }>;
  existing: Array<{
    type: string;
    id: string;
    name: string;
  }>;
  warnings: Array<{
    message: string;
    type: 'info' | 'warning' | 'error';
  }>;
}

export interface ResolvedDependencies {
  serverPairs: string[]; // Server pair IDs
  agents: string[]; // Agent canister IDs
  workflows: string[]; // Workflow IDs
  mcpAuth: Array<{
    serverId: string;
    authType: string;
    configured: boolean;
  }>;
  externalSetup: Array<{
    service: string;
    completed: boolean;
  }>;
}

// ============================================================================
// GENERATION CONTEXT
// ============================================================================

export interface GenerationContext {
  existingAgents?: Array<{
    id: string;
    name: string;
    description: string;
    capabilities?: string[];
  }>;
  existingWorkflows?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  availableServerPairs?: number;
  userMcpAuth?: Array<{
    serverId: string;
    authType: string;
  }>;
  projectId?: string;
  userCanisterId?: string;
}

// ============================================================================
// GENERATION RESULT
// ============================================================================

export interface GenerationResult<T> {
  spec: T;
  explanation: string;
  nextSteps: Array<{
    type: string;
    message: string;
    action?: string;
  }>;
  confidence: number; // 0-1
  estimatedCost?: string;
}

