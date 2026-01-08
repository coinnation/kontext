import type { AgentStep, TriggerConfig, LoopConfig, StepTarget } from '../../services/AgencyService';

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'trigger' | 'condition' | 'parallel';
  position: { x: number; y: number };
  data: {
    agentCanisterId?: string;
    agentName: string;
    inputTemplate: string;
    requiresApproval: boolean;
    retryOnFailure: boolean;
    timeout?: number;
    description?: string;
    icon?: string;
    status: 'configured' | 'unconfigured' | 'error' | 'valid';
    validationErrors: string[];
    agentConfig?: any;
    triggerConfig?: TriggerConfig;
    // NEW: Execution visualization fields
    executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
    executionOutput?: string;
    executionError?: string;
    executionDuration?: number;
    // NEW: Loop and nested workflow support
    stepTarget?: StepTarget; // For nested workflows or agent selection
    loopConfig?: LoopConfig; // Loop configuration
  };
  width?: number;
  height?: number;
}

import type { ConnectionCondition } from '../../services/AgencyService';

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: 'default' | 'conditional' | 'parallel' | 'trigger';
  animated?: boolean;
  style?: React.CSSProperties;
  data?: {
    condition?: ConnectionCondition; // NEW: Store full condition object
    label?: string;
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'customer-service' | 'data-processing' | 'automation' | 'monitoring' | 'general';
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  executionMode: 'sequential' | 'parallel' | 'conditional';
  thumbnail?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  tags: string[];
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'ai-assistant' | 'data-processor' | 'integration' | 'validator' | 'notifier';
  canisterId?: string;
  icon: string;
  color: string;
  defaultConfig: {
    inputTemplate: string;
    requiresApproval: boolean;
    retryOnFailure: boolean;
    timeout?: number;
  };
  configSchema: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
    required: boolean;
    options?: string[];
    placeholder?: string;
    description?: string;
  }>;
}

export interface CanvasState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isDragging: boolean;
  isConnecting: boolean;
  connectionSource: string | null;
  executionMode: 'sequential' | 'parallel' | 'conditional';
  zoomLevel: number;
  canvasPosition: { x: number; y: number };
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    nodeId?: string;
    edgeId?: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }>;
  warnings: Array<{
    nodeId?: string;
    type: 'performance' | 'best-practice' | 'optimization';
    message: string;
    suggestion: string;
  }>;
}