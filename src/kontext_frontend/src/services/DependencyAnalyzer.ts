/**
 * Service for analyzing dependencies in generated specs
 * Identifies missing resources and what needs to be created/configured
 */

import type {
  AgentSpec,
  WorkflowSpec,
  BusinessAgencySpec,
  DependencyAnalysis,
  GenerationContext
} from '../types/agentSpec';

export class DependencyAnalyzer {
  /**
   * Analyze dependencies for an Agent spec
   */
  analyzeAgentDependencies(
    spec: AgentSpec,
    context: GenerationContext
  ): DependencyAnalysis {
    const missing: DependencyAnalysis['missing'] = [];
    const existing: DependencyAnalysis['existing'] = [];
    const warnings: DependencyAnalysis['warnings'] = [];

    // Check server pairs
    if (spec.dependencies.requiresServerPair) {
      const available = context.availableServerPairs || 0;
      if (available === 0) {
        missing.push({
          id: 'server_pair_1',
          type: 'server_pair',
          message: 'At least one server pair is required to deploy this agent',
          priority: 'critical',
          canSkip: false,
          data: { count: 1 }
        });
      } else {
        existing.push({
          type: 'server_pair',
          id: 'available',
          name: `${available} server pair(s) available`
        });
      }
    }

    // Check MCP auth
    spec.dependencies.requiresMcpAuth.forEach((auth, idx) => {
      const hasAuth = context.userMcpAuth?.some(
        a => a.serverId === auth.serverId && a.authType === auth.authType
      );

      if (!hasAuth) {
        missing.push({
          id: `mcp_auth_${auth.serverId}_${idx}`,
          type: 'mcp_auth',
          message: `Configure ${auth.authType} authentication for ${auth.serverId}`,
          priority: 'high',
          canSkip: true, // Can skip, but agent won't work without it
          data: {
            serverId: auth.serverId,
            authType: auth.authType,
            instructions: auth.instructions
          }
        });
      } else {
        existing.push({
          type: 'mcp_auth',
          id: `${auth.serverId}_${auth.authType}`,
          name: `${auth.serverId} (${auth.authType})`
        });
      }
    });

    // Check external setup
    spec.dependencies.requiresExternalSetup.forEach((setup, idx) => {
      missing.push({
        id: `external_${setup.service}_${idx}`,
        type: 'external_setup',
        message: `${setup.service}: ${setup.action}`,
        priority: 'medium',
        canSkip: true,
        data: {
          service: setup.service,
          action: setup.action,
          reason: setup.reason
        }
      });
    });

    // Warnings
    if (spec.config.requireApproval) {
      warnings.push({
        type: 'info',
        message: 'This agent requires manual approval for tasks'
      });
    }

    if (spec.mcpServers.length === 0) {
      warnings.push({
        type: 'info',
        message: 'This agent has no MCP tools configured - it will have limited capabilities'
      });
    }

    return {
      canProceed: missing.filter(m => !m.canSkip && m.priority === 'critical').length === 0,
      missing,
      existing,
      warnings
    };
  }

  /**
   * Analyze dependencies for a Workflow spec
   */
  analyzeWorkflowDependencies(
    spec: WorkflowSpec,
    context: GenerationContext
  ): DependencyAnalysis {
    const missing: DependencyAnalysis['missing'] = [];
    const existing: DependencyAnalysis['existing'] = [];
    const warnings: DependencyAnalysis['warnings'] = [];

    // Check server pairs
    const requiredPairs = spec.dependencies.requiresServerPairs;
    const available = context.availableServerPairs || 0;
    if (available < requiredPairs) {
      missing.push({
        id: 'server_pairs',
        type: 'server_pair',
        message: `This workflow requires ${requiredPairs} server pair(s). You have ${available}.`,
        priority: 'critical',
        canSkip: false,
        data: { count: requiredPairs - available }
      });
    } else if (requiredPairs > 0) {
      existing.push({
        type: 'server_pair',
        id: 'available',
        name: `${available} server pair(s) available`
      });
    }

    // Check agents
    spec.dependencies.requiresAgents.forEach((agentReq, idx) => {
      // Check if agent already exists
      const existingAgent = context.existingAgents?.find(
        a => a.name.toLowerCase() === agentReq.agentSpec.name.toLowerCase()
      );

      if (!existingAgent) {
        missing.push({
          id: `agent_${agentReq.agentSpec.name}_${idx}`,
          type: 'agent',
          message: `Agent: "${agentReq.agentSpec.name}" - ${agentReq.reason}`,
          priority: 'critical',
          canSkip: false,
          data: {
            agentSpec: agentReq.agentSpec,
            reason: agentReq.reason
          }
        });
      } else {
        existing.push({
          type: 'agent',
          id: existingAgent.id,
          name: existingAgent.name
        });
      }
    });

    // Check MCP auth
    spec.dependencies.requiresMcpAuth.forEach((auth, idx) => {
      const hasAuth = context.userMcpAuth?.some(
        a => a.serverId === auth.serverId && a.authType === auth.authType
      );

      if (!hasAuth) {
        missing.push({
          id: `mcp_auth_${auth.serverId}_${idx}`,
          type: 'mcp_auth',
          message: `Configure ${auth.authType} authentication for ${auth.serverId}`,
          priority: 'high',
          canSkip: true,
          data: {
            serverId: auth.serverId,
            authType: auth.authType,
            instructions: auth.instructions
          }
        });
      }
    });

    // Warnings
    if (spec.steps.length > 5) {
      warnings.push({
        type: 'info',
        message: 'This workflow has many steps - execution may take longer'
      });
    }

    if (spec.executionMode === 'conditional') {
      warnings.push({
        type: 'info',
        message: 'This workflow uses conditional execution - ensure conditions are properly configured'
      });
    }

    return {
      canProceed: missing.filter(m => !m.canSkip && m.priority === 'critical').length === 0,
      missing,
      existing,
      warnings
    };
  }

  /**
   * Analyze dependencies for a Business Agency spec
   */
  analyzeAgencyDependencies(
    spec: BusinessAgencySpec,
    context: GenerationContext
  ): DependencyAnalysis {
    const missing: DependencyAnalysis['missing'] = [];
    const existing: DependencyAnalysis['existing'] = [];
    const warnings: DependencyAnalysis['warnings'] = [];

    // Check server pairs
    const requiredPairs = spec.dependencies.requiresServerPairs;
    const available = context.availableServerPairs || 0;
    if (available < requiredPairs) {
      missing.push({
        id: 'server_pairs',
        type: 'server_pair',
        message: `This agency requires ${requiredPairs} server pair(s). You have ${available}.`,
        priority: 'critical',
        canSkip: false,
        data: { count: requiredPairs - available }
      });
    }

    // Check agents
    spec.agents.forEach((agentRef, idx) => {
      if (agentRef.agentSpec) {
        // New agent needs to be created
        const existingAgent = context.existingAgents?.find(
          a => a.name.toLowerCase() === agentRef.agentSpec!.name.toLowerCase()
        );

        if (!existingAgent) {
          missing.push({
            id: `agent_${agentRef.agentSpec.name}_${idx}`,
            type: 'agent',
            message: `Agent: "${agentRef.agentSpec.name}" (${agentRef.role})`,
            priority: 'critical',
            canSkip: false,
            data: {
              agentSpec: agentRef.agentSpec,
              role: agentRef.role
            }
          });
        }
      } else if (agentRef.agentCanisterId) {
        // Existing agent - verify it exists
        const existingAgent = context.existingAgents?.find(
          a => a.id === agentRef.agentCanisterId
        );

        if (existingAgent) {
          existing.push({
            type: 'agent',
            id: existingAgent.id,
            name: existingAgent.name
          });
        } else {
          missing.push({
            id: `agent_missing_${agentRef.agentCanisterId}`,
            type: 'agent',
            message: `Referenced agent not found: ${agentRef.agentCanisterId}`,
            priority: 'critical',
            canSkip: false,
            data: { agentCanisterId: agentRef.agentCanisterId }
          });
        }
      }
    });

    // Check workflows
    spec.workflows.forEach((workflowRef, idx) => {
      if (workflowRef.workflowSpec) {
        // New workflow needs to be created
        missing.push({
          id: `workflow_${workflowRef.workflowSpec.name}_${idx}`,
          type: 'workflow',
          message: `Workflow: "${workflowRef.workflowSpec.name}" - ${workflowRef.purpose}`,
          priority: 'high',
          canSkip: false,
          data: {
            workflowSpec: workflowRef.workflowSpec,
            purpose: workflowRef.purpose
          }
        });
      } else if (workflowRef.workflowId) {
        // Existing workflow - verify it exists
        const existingWorkflow = context.existingWorkflows?.find(
          w => w.id === workflowRef.workflowId
        );

        if (existingWorkflow) {
          existing.push({
            type: 'workflow',
            id: existingWorkflow.id,
            name: existingWorkflow.name
          });
        } else {
          missing.push({
            id: `workflow_missing_${workflowRef.workflowId}`,
            type: 'workflow',
            message: `Referenced workflow not found: ${workflowRef.workflowId}`,
            priority: 'high',
            canSkip: false,
            data: { workflowId: workflowRef.workflowId }
          });
        }
      }
    });

    // Check MCP auth
    spec.dependencies.requiresMcpAuth.forEach((auth, idx) => {
      const hasAuth = context.userMcpAuth?.some(
        a => a.serverId === auth.serverId && a.authType === auth.authType
      );

      if (!hasAuth) {
        missing.push({
          id: `mcp_auth_${auth.serverId}_${idx}`,
          type: 'mcp_auth',
          message: `Configure ${auth.authType} authentication for ${auth.serverId}`,
          priority: 'high',
          canSkip: true,
          data: {
            serverId: auth.serverId,
            authType: auth.authType,
            instructions: auth.instructions
          }
        });
      }
    });

    // Warnings
    if (spec.goals.length === 0) {
      warnings.push({
        type: 'info',
        message: 'This agency has no goals defined - consider adding business goals'
      });
    }

    if (spec.agents.length === 0 && spec.workflows.length === 0) {
      warnings.push({
        type: 'warning',
        message: 'This agency has no agents or workflows assigned'
      });
    }

    return {
      canProceed: missing.filter(m => !m.canSkip && m.priority === 'critical').length === 0,
      missing,
      existing,
      warnings
    };
  }

  /**
   * Get summary of dependencies
   */
  getDependencySummary(analysis: DependencyAnalysis): string {
    const critical = analysis.missing.filter(m => m.priority === 'critical' && !m.canSkip).length;
    const high = analysis.missing.filter(m => m.priority === 'high').length;
    const medium = analysis.missing.filter(m => m.priority === 'medium').length;
    const low = analysis.missing.filter(m => m.priority === 'low').length;

    const parts: string[] = [];
    if (critical > 0) parts.push(`${critical} critical`);
    if (high > 0) parts.push(`${high} high priority`);
    if (medium > 0) parts.push(`${medium} medium priority`);
    if (low > 0) parts.push(`${low} low priority`);

    if (parts.length === 0) {
      return 'All dependencies resolved';
    }

    return `${parts.join(', ')} dependency${parts.length > 1 ? 'ies' : 'y'} need${parts.length === 1 ? 's' : ''} to be resolved`;
  }
}

