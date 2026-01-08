export interface BusinessAgency {
  id: string;
  name: string; // e.g., "Marketing Agency", "Customer Service Agency"
  description: string;
  category: 'marketing' | 'sales' | 'support' | 'operations' | 'custom';
  icon: string; // emoji or icon identifier
  color?: string; // theme color
  
  // References to existing resources (not duplicates)
  agentIds: string[]; // References to agent canister IDs
  workflowIds: string[]; // References to workflow/agency IDs
  
  // Business metrics & goals
  goals: AgencyGoal[];
  metrics: AgencyMetrics;
  
  // Client management (for agency users)
  clients?: Client[];
  
  // Metadata
  created: number;
  updated: number;
  owner: string; // principal
  projectId?: string; // optional: if agency is project-specific
}

export interface GoalTaskMapping {
  // Filter tasks by these criteria
  agentIds?: string[]; // Specific agents to track (empty = all agents in agency)
  triggerTypes?: string[]; // e.g., ['webhook', 'scheduled', 'manual']
  triggerMetadata?: Array<{ key: string; value: string }>; // Match trigger metadata
  taskStatus?: string[]; // e.g., ['completed', 'running']
  mcpToolsUsed?: string[]; // Track tasks that used specific MCP tools
  inputContains?: string; // Match tasks where input contains this text
  resultContains?: string; // Match tasks where result contains this text
  
  // How to count tasks for this goal
  countMethod: 'total' | 'completed' | 'successful' | 'failed' | 'unique_tools' | 'custom';
  customCountFn?: string; // JavaScript function string for custom counting (advanced)
  
  // Time window for tracking
  timeWindow?: {
    type: 'all_time' | 'last_days' | 'last_weeks' | 'last_months' | 'since_date';
    value?: number; // days/weeks/months
    sinceDate?: number; // timestamp
  };
}

export interface AgencyGoal {
  id: string;
  name: string;
  description: string;
  target: string; // e.g., "10", "50%", "100 tasks", "$100" (for budget goals)
  currentValue?: string;
  deadline?: number;
  status: 'active' | 'completed' | 'paused';
  
  // NEW: Task mapping configuration
  taskMapping?: GoalTaskMapping;
  
  // NEW: Manual override (if user wants to set progress manually)
  manualTracking?: boolean;
  
  // NEW: Cost-related goal types
  goalType?: 'budget' | 'cost_per_outcome' | 'roi' | 'total_spend' | 'standard';
  period?: 'daily' | 'weekly' | 'monthly' | 'all_time'; // For budget goals
}

export interface AgencyMetrics {
  // Business metrics (aggregated from agents/workflows)
  totalExecutions: number;
  successRate: number;
  averageResponseTime: number;
  businessImpact?: {
    leadsGenerated?: number;
    contentCreated?: number;
    ticketsResolved?: number;
    revenueInfluenced?: number;
    campaignsRun?: number;
    engagementRate?: number;
    dealsInfluenced?: number;
    tasksAutomated?: number;
  };
  lastUpdated: number;
  // Historical tracking
  history?: MetricsSnapshot[];
  
  // NEW: Cost metrics
  costMetrics?: {
    totalCycles: bigint;
    totalCredits: number;
    totalUsd: number;
    // NEW: Token metrics
    totalTokens: number;
    totalTokenCostUsd: number;
    averageTokensPerTask: number;
    averageCostPerExecution: number;
    averageCostPerTask: number;
    costTrend?: Array<{
      timestamp: number;
      cycles: bigint;
      credits: number;
      usd: number;
      tokens?: number;
      tokenCostUsd?: number;
    }>;
  };
}

export interface MetricsSnapshot {
  timestamp: number;
  totalExecutions: number;
  successRate: number;
  averageResponseTime: number;
  businessImpact?: Record<string, number>;
}

export interface Client {
  id: string;
  name: string;
  agentIds: string[];
  workflowIds: string[];
  customMetrics?: Record<string, any>;
}

export interface BusinessAgencyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'marketing' | 'sales' | 'support' | 'operations' | 'custom';
  icon: string;
  color: string;
  suggestedAgents: Array<{ name: string; role: string }>;
  suggestedWorkflows: Array<{ name: string; type: string }>;
  defaultGoals: Array<{ name: string; target: string }>;
}

