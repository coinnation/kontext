import type { WorkflowNode, WorkflowEdge, AgentTemplate, ValidationResult } from './types';
import type { AgentStep, AgentConnection, ConnectionCondition } from '../../services/AgencyService';
import { Principal } from '@dfinity/principal';

/**
 * Convert visual workflow edges to backend AgentConnection format
 */
export const convertEdgesToConnections = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  availableAgentCanisterIds?: string[],
  agencyWorkflowCanisterId?: string
): AgentConnection[] => {
  // Create a map from node ID to step index (only for valid agent nodes)
  const sortedNodes = topologicalSort(nodes, edges);
  const validNodes = sortedNodes.filter(node => {
    if (node.type !== 'agent') return false;
    const canisterId = node.data.agentCanisterId;
    if (!canisterId || canisterId.trim() === '') return false;
    if (agencyWorkflowCanisterId && canisterId === agencyWorkflowCanisterId) return false;
    if (availableAgentCanisterIds && availableAgentCanisterIds.length > 0) {
      if (!availableAgentCanisterIds.includes(canisterId)) return false;
    }
    return true;
  });

  const nodeIdToStepIndex = new Map<string, number>();
  validNodes.forEach((node, index) => {
    nodeIdToStepIndex.set(node.id, index);
  });

  // Convert edges to connections
  const connections: AgentConnection[] = [];
  edges.forEach(edge => {
    const sourceIndex = nodeIdToStepIndex.get(edge.source);
    const targetIndex = nodeIdToStepIndex.get(edge.target);

    // Only create connection if both nodes are valid
    if (sourceIndex !== undefined && targetIndex !== undefined) {
      // Get condition from edge data, default to always
      const condition: ConnectionCondition = edge.data?.condition || { always: null };

      connections.push({
        sourceStepIndex: sourceIndex,
        targetStepIndex: targetIndex,
        condition,
      });
    }
  });

  return connections;
};

/**
 * Convert visual workflow to backend AgentStep format
 */
export const convertWorkflowToAgentSteps = (
  nodes: WorkflowNode[], 
  edges: WorkflowEdge[],
  availableAgentCanisterIds?: string[], // Optional list of valid agent canister IDs to validate against
  agencyWorkflowCanisterId?: string // Optional agency workflow canister ID to explicitly exclude
): AgentStep[] => {
  // Sort nodes by execution order based on edges
  const sortedNodes = topologicalSort(nodes, edges);
  
  return sortedNodes
    .filter(node => {
      // Must be an agent node
      if (node.type !== 'agent') return false;
      
      // Must have a non-empty agent canister ID
      const canisterId = node.data.agentCanisterId;
      if (!canisterId || canisterId.trim() === '') {
        console.warn(`⚠️ [Workflow] Agent node "${node.data.agentName}" has no canister ID - skipping`);
        return false;
      }
      
      // CRITICAL: Explicitly reject if this is the agency workflow canister ID
      if (agencyWorkflowCanisterId && canisterId === agencyWorkflowCanisterId) {
        console.error(`❌ [Workflow] Agent node "${node.data.agentName}" has agency workflow canister ID "${canisterId}" - this is invalid! Skipping.`);
        return false;
      }
      
      // If we have a list of valid agent canister IDs, validate against it
      // This prevents using invalid canister IDs
      if (availableAgentCanisterIds && availableAgentCanisterIds.length > 0) {
        if (!availableAgentCanisterIds.includes(canisterId)) {
          console.warn(`⚠️ [Workflow] Agent node "${node.data.agentName}" has canister ID "${canisterId}" - not in list of available agents. Skipping.`);
          return false;
        }
      }
      
      return true;
    })
    .map(node => ({
      agentCanisterId: node.data.agentCanisterId!,
      agentName: node.data.agentName,
      inputTemplate: node.data.inputTemplate,
      requiresApproval: node.data.requiresApproval,
      retryOnFailure: node.data.retryOnFailure,
      timeout: node.data.timeout,
      triggerConfig: node.data.triggerConfig,
      // NEW: Include loop and nested workflow support
      stepTarget: node.data.stepTarget,
      loopConfig: node.data.loopConfig,
    }));
};

/**
 * Convert backend AgentStep format to visual workflow (with connections support)
 */
export const convertAgentStepsToWorkflow = (
  steps: AgentStep[],
  connections?: AgentConnection[] // NEW: Optional connections parameter
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } => {
  const nodes: WorkflowNode[] = steps.map((step, index) => {
    // Determine icon and description based on stepTarget
    let icon = getAgentIcon(step.agentName);
    let description = `Agent: ${step.agentName}`;
    
    if (step.stepTarget) {
      if ('agency' in step.stepTarget) {
        icon = '🔄';
        description = `Sub-workflow: ${step.stepTarget.agency.agencyId}`;
      } else if ('agent' in step.stepTarget) {
        icon = getAgentIcon(step.agentName);
        description = `Agent: ${step.agentName}`;
      }
    }
    
    // Add loop indicator to description
    if (step.loopConfig) {
      if ('forEach' in step.loopConfig) {
        description += ` (Loop: for each in ${step.loopConfig.forEach.arraySource})`;
      } else if ('whileLoop' in step.loopConfig) {
        description += ` (Loop: while ${step.loopConfig.whileLoop.condition})`;
      } else if ('repeat' in step.loopConfig) {
        description += ` (Loop: repeat ${step.loopConfig.repeat.count} times)`;
      }
    }
    
    return {
    id: `agent-${index}`,
    type: 'agent' as const,
    position: { x: 100 + (index * 300), y: 100 },
    data: {
      agentCanisterId: step.agentCanisterId,
      agentName: step.agentName,
      inputTemplate: step.inputTemplate,
      requiresApproval: step.requiresApproval || false,
      retryOnFailure: step.retryOnFailure || false,
      timeout: step.timeout,
        status: step.agentCanisterId || step.stepTarget ? 'configured' : 'unconfigured',
      validationErrors: [],
      triggerConfig: step.triggerConfig,
        icon: icon,
        description: description,
        // NEW: Include loop and nested workflow support
        stepTarget: step.stepTarget,
        loopConfig: step.loopConfig,
    },
    };
  });

  const edges: WorkflowEdge[] = [];
  
  if (connections && connections.length > 0) {
    // Convert connections to edges
    connections.forEach((conn, index) => {
      const sourceNode = nodes[conn.sourceStepIndex];
      const targetNode = nodes[conn.targetStepIndex];
      
      if (sourceNode && targetNode) {
        edges.push({
          id: `edge-${index}`,
          source: sourceNode.id,
          target: targetNode.id,
          type: conn.condition.always ? 'default' : 'conditional',
          animated: false,
          data: {
            condition: conn.condition, // NEW: Store full condition object
            label: getConditionLabel(conn.condition),
          },
        });
      }
    });
  } else {
    // Fallback: Create sequential edges if no connections provided
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `edge-${i}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: 'default',
        animated: false,
        data: {
          condition: { always: null }, // Default to always
        },
      });
    }
  }

  return { nodes, edges };
};

/**
 * Helper function to get a human-readable label for a condition
 */
function getConditionLabel(condition: ConnectionCondition): string {
  if (condition.onSuccess !== undefined) return 'On Success';
  if (condition.onFailure !== undefined) return 'On Failure';
  if (condition.always !== undefined) return 'Always';
  if (condition.ifContains) return `If Contains: ${condition.ifContains.field} = ${condition.ifContains.value}`;
  if (condition.ifEquals) return `If Equals: ${condition.ifEquals.field} = ${condition.ifEquals.value}`;
  return 'Always';
}

/**
 * Topological sort for node execution order
 */
export const topologicalSort = (
  nodes: WorkflowNode[], 
  edges: WorkflowEdge[]
): WorkflowNode[] => {
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();
  
  // Initialize in-degree and adjacency list
  nodes.forEach(node => {
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  });
  
  edges.forEach(edge => {
    const sourceTargets = adjacencyList.get(edge.source) || [];
    sourceTargets.push(edge.target);
    adjacencyList.set(edge.source, sourceTargets);
    
    const targetInDegree = inDegree.get(edge.target) || 0;
    inDegree.set(edge.target, targetInDegree + 1);
  });
  
  // Find nodes with no incoming edges
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });
  
  const sortedIds: string[] = [];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    sortedIds.push(currentId);
    
    const neighbors = adjacencyList.get(currentId) || [];
    neighbors.forEach(neighborId => {
      const newInDegree = (inDegree.get(neighborId) || 1) - 1;
      inDegree.set(neighborId, newInDegree);
      
      if (newInDegree === 0) {
        queue.push(neighborId);
      }
    });
  }
  
  // Return sorted nodes
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  return sortedIds.map(id => nodeMap.get(id)!).filter(Boolean);
};

/**
 * Validate workflow for errors and warnings
 */
export const validateWorkflow = (
  nodes: WorkflowNode[], 
  edges: WorkflowEdge[],
  executionMode: string
): ValidationResult => {
  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];
  
  // Check for nodes without canister IDs
  nodes.forEach(node => {
    if (node.type === 'agent' && !node.data.agentCanisterId) {
      errors.push({
        nodeId: node.id,
        type: 'error',
        message: `Agent "${node.data.agentName}" is missing a canister ID`,
        suggestion: 'Configure the agent by selecting a canister ID from available agents',
      });
    }
    
    // Validate canister ID format
    if (node.data.agentCanisterId) {
      try {
        Principal.fromText(node.data.agentCanisterId);
      } catch {
        errors.push({
          nodeId: node.id,
          type: 'error',
          message: `Invalid canister ID format: ${node.data.agentCanisterId}`,
          suggestion: 'Enter a valid Internet Computer Principal ID',
        });
      }
    }
    
    // Check for empty input templates
    if (!node.data.inputTemplate.trim()) {
      warnings.push({
        nodeId: node.id,
        type: 'best-practice',
        message: `Agent "${node.data.agentName}" has an empty input template`,
        suggestion: 'Provide an input template to define how data flows to this agent',
      });
    }
  });
  
  // Check for disconnected nodes in sequential mode
  if (executionMode === 'sequential' && nodes.length > 1) {
    const connectedNodes = new Set<string>();
    edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });
    
    nodes.forEach(node => {
      if (!connectedNodes.has(node.id)) {
        warnings.push({
          nodeId: node.id,
          type: 'performance',
          message: `Agent "${node.data.agentName}" is not connected to the workflow`,
          suggestion: 'Connect this agent to other agents to include it in the execution flow',
        });
      }
    });
  }
  
  // Check for circular dependencies
  if (hasCycle(nodes, edges)) {
    errors.push({
      type: 'error',
      message: 'Workflow contains circular dependencies',
      suggestion: 'Remove connections that create loops in the workflow',
    });
  }
  
  // Performance warnings
  if (nodes.length > 10) {
    warnings.push({
      type: 'performance',
      message: 'Large workflow may impact execution performance',
      suggestion: 'Consider breaking this into smaller sub-workflows',
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Check for cycles in workflow
 */
export const hasCycle = (nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean => {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const adjacencyList = new Map<string, string[]>();
  
  // Build adjacency list
  nodes.forEach(node => adjacencyList.set(node.id, []));
  edges.forEach(edge => {
    const targets = adjacencyList.get(edge.source) || [];
    targets.push(edge.target);
    adjacencyList.set(edge.source, targets);
  });
  
  const dfs = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  };
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }
  
  return false;
};

/**
 * Get appropriate icon for agent type
 */
export const getAgentIcon = (agentName: string): string => {
  const name = agentName.toLowerCase();
  
  if (name.includes('customer') || name.includes('support')) return '👥';
  if (name.includes('data') || name.includes('process')) return '📊';
  if (name.includes('email') || name.includes('notification')) return '📧';
  if (name.includes('validation') || name.includes('verify')) return '✅';
  if (name.includes('ai') || name.includes('assistant')) return '🤖';
  if (name.includes('report') || name.includes('analytics')) return '📈';
  if (name.includes('integration') || name.includes('api')) return '🔗';
  if (name.includes('security') || name.includes('auth')) return '🔒';
  if (name.includes('payment') || name.includes('billing')) return '💳';
  if (name.includes('monitor') || name.includes('health')) return '🏥';
  
  return '⚙️'; // default
};

/**
 * Generate unique ID for nodes and edges
 */
export const generateId = (prefix: string = 'item'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Calculate optimal layout for nodes
 */
export const autoLayout = (
  nodes: WorkflowNode[], 
  edges: WorkflowEdge[],
  executionMode: string
): WorkflowNode[] => {
  if (executionMode === 'sequential') {
    return layoutSequential(nodes, edges);
  } else if (executionMode === 'parallel') {
    return layoutParallel(nodes, edges);
  } else {
    return layoutConditional(nodes, edges);
  }
};

/**
 * Sequential layout - left to right
 */
const layoutSequential = (nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] => {
  const sortedNodes = topologicalSort(nodes, edges);
  return sortedNodes.map((node, index) => ({
    ...node,
    position: {
      x: 100 + (index * 300),
      y: 200,
    },
  }));
};

/**
 * Parallel layout - vertical arrangement
 */
const layoutParallel = (nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] => {
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  
  // Find root nodes (no incoming edges)
  const incomingCount = new Map<string, number>();
  nodes.forEach(node => incomingCount.set(node.id, 0));
  edges.forEach(edge => {
    const count = incomingCount.get(edge.target) || 0;
    incomingCount.set(edge.target, count + 1);
  });
  
  const rootNodes = nodes.filter(node => (incomingCount.get(node.id) || 0) === 0);
  
  // Assign levels using BFS
  const queue = rootNodes.map(node => ({ node, level: 0 }));
  
  while (queue.length > 0) {
    const { node, level } = queue.shift()!;
    if (visited.has(node.id)) continue;
    
    visited.add(node.id);
    levels.set(node.id, level);
    
    // Find children
    const children = edges
      .filter(edge => edge.source === node.id)
      .map(edge => nodes.find(n => n.id === edge.target)!)
      .filter(Boolean);
    
    children.forEach(child => {
      if (!visited.has(child.id)) {
        queue.push({ node: child, level: level + 1 });
      }
    });
  }
  
  // Group nodes by level
  const levelGroups = new Map<number, WorkflowNode[]>();
  nodes.forEach(node => {
    const level = levels.get(node.id) || 0;
    const group = levelGroups.get(level) || [];
    group.push(node);
    levelGroups.set(level, group);
  });
  
  // Position nodes
  return nodes.map(node => {
    const level = levels.get(node.id) || 0;
    const group = levelGroups.get(level) || [];
    const indexInGroup = group.indexOf(node);
    const groupSize = group.length;
    
    return {
      ...node,
      position: {
        x: 100 + (level * 300),
        y: 100 + (indexInGroup * 150) + (groupSize > 1 ? 0 : 50),
      },
    };
  });
};

/**
 * Conditional layout - tree-like structure
 */
const layoutConditional = (nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] => {
  // For now, use parallel layout - can be enhanced for more sophisticated conditional layouts
  return layoutParallel(nodes, edges);
};

/**
 * Format execution time estimation
 */
export const estimateExecutionTime = (nodes: WorkflowNode[], edges: WorkflowEdge[]): string => {
  const agentCount = nodes.filter(node => node.type === 'agent').length;
  const avgTimePerAgent = 30; // seconds
  const parallelFactor = 0.6; // parallel execution efficiency
  
  const totalTime = agentCount * avgTimePerAgent * parallelFactor;
  
  if (totalTime < 60) return `~${Math.round(totalTime)}s`;
  if (totalTime < 3600) return `~${Math.round(totalTime / 60)}m`;
  return `~${Math.round(totalTime / 3600)}h`;
};

/**
 * Export workflow as JSON
 */
export const exportWorkflow = (
  nodes: WorkflowNode[], 
  edges: WorkflowEdge[], 
  metadata: { name: string; description: string }
): string => {
  const workflow = {
    version: '1.0',
    metadata,
    nodes,
    edges,
    exportedAt: new Date().toISOString(),
  };
  
  return JSON.stringify(workflow, null, 2);
};

/**
 * Import workflow from JSON
 */
export const importWorkflow = (json: string): { 
  nodes: WorkflowNode[]; 
  edges: WorkflowEdge[]; 
  metadata?: any 
} => {
  try {
    const workflow = JSON.parse(json);
    return {
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
      metadata: workflow.metadata,
    };
  } catch (error) {
    throw new Error('Invalid workflow JSON format');
  }
};