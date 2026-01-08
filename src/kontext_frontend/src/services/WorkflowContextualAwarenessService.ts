import { Identity } from '@dfinity/agent';
import { AgencyService } from './AgencyService';
import type { Agency, AgentStep, TriggerConfig } from './AgencyService';

export interface WorkflowCapabilities {
  workflowId: string;
  name: string;
  description: string;
  steps: Array<{
    stepId: string;
    agentCanisterId: string;
    agentName?: string;
    inputTemplate?: string;
    loopConfig?: any;
    stepTarget?: any;
  }>;
  triggers: Array<{
    triggerId: string;
    type: string;
    name: string;
    enabled: boolean;
    schedule?: any;
  }>;
  executionMode: 'sequential' | 'parallel' | 'conditional';
  capabilities: string[];
}

export interface WorkflowDocumentation {
  workflowId: string;
  name: string;
  description: string;
  executionMethods: Array<{
    method: 'manual' | 'trigger' | 'webhook';
    description: string;
    parameters: Array<{ name: string; type: string; required: boolean }>;
    example: string;
  }>;
  availableTriggers: Array<{
    triggerId: string;
    type: string;
    name: string;
    description: string;
    howToUse: string;
  }>;
}

export class WorkflowContextualAwarenessService {
  /**
   * Discover workflow capabilities
   */
  static async discoverWorkflowCapabilities(
    workflowId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<WorkflowCapabilities> {
    console.log(`🔍 [WorkflowAwareness] Discovering capabilities for workflow: ${workflowId}`);
    
    try {
      // Get workflow details
      const agencyResult = await AgencyService.getAgency(
        workflowId,
        projectId,
        userCanisterId,
        identity
      );
      
      if (!agencyResult.success || !agencyResult.agency) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      const agency = agencyResult.agency;
      
      // Get triggers
      const triggersResult = await AgencyService.getAgencyTriggers(
        workflowId,
        projectId,
        userCanisterId,
        identity
      );
      
      const triggers = triggersResult.success ? triggersResult.triggers || [] : [];
      
      // Extract capabilities from steps
      const capabilities = this.extractCapabilitiesFromSteps(agency.steps);
      
      return {
        workflowId,
        name: agency.name,
        description: agency.description,
        steps: agency.steps.map(step => ({
          stepId: step.stepId,
          agentCanisterId: step.agentCanisterId,
          inputTemplate: step.inputTemplate,
          loopConfig: step.loopConfig,
          stepTarget: step.stepTarget
        })),
        triggers: triggers.map(trigger => {
          // Extract trigger type from Candid variant
          let triggerType = 'manual';
          if ('scheduled' in trigger.triggerType) {
            triggerType = 'scheduled';
          } else if ('webhook' in trigger.triggerType) {
            triggerType = 'webhook';
          } else if ('api' in trigger.triggerType) {
            triggerType = 'api';
          } else if ('condition' in trigger.triggerType) {
            triggerType = 'condition';
          }
          
          return {
            triggerId: trigger.id,
            type: triggerType,
            name: trigger.name,
            enabled: trigger.enabled,
            schedule: 'scheduled' in trigger.triggerType ? trigger.triggerType.scheduled.schedule : undefined
          };
        }),
        executionMode: agency.executionMode || 'sequential',
        capabilities
      };
    } catch (error) {
      console.error('❌ [WorkflowAwareness] Failed to discover workflow capabilities:', error);
      throw error;
    }
  }
  
  /**
   * Discover all workflows in a project
   */
  static async discoverProjectWorkflows(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<WorkflowCapabilities[]> {
    console.log(`🔍 [WorkflowAwareness] Discovering all workflows for project: ${projectId}`);
    
    try {
      const result = await AgencyService.getAgencies(
        projectId,
        userCanisterId,
        identity
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get workflows');
      }
      
      // Discover capabilities for each workflow
      const workflows = await Promise.all(
        result.agencies.map(agency =>
          this.discoverWorkflowCapabilities(
            agency.id,
            projectId,
            userCanisterId,
            identity
          ).catch(error => {
            console.warn(`⚠️ [WorkflowAwareness] Failed to discover workflow ${agency.id}:`, error);
            return null;
          })
        )
      );
      
      return workflows.filter((w): w is WorkflowCapabilities => w !== null);
    } catch (error) {
      console.error('❌ [WorkflowAwareness] Failed to discover project workflows:', error);
      throw error;
    }
  }
  
  /**
   * Generate documentation for a workflow
   */
  static generateWorkflowDocumentation(
    capabilities: WorkflowCapabilities
  ): WorkflowDocumentation {
    const executionMethods = [
      {
        method: 'manual' as const,
        description: `Execute workflow manually with custom input`,
        parameters: [
          { name: 'input', type: 'string', required: true }
        ],
        example: `await workflowActor.executeWorkflow('${capabilities.workflowId}', 'user input here')`
      }
    ];
    
    // Add trigger-based execution methods
    capabilities.triggers.forEach(trigger => {
      if (trigger.type === 'scheduled') {
        executionMethods.push({
          method: 'trigger',
          description: `Execute workflow via scheduled trigger: ${trigger.name}`,
          parameters: [
            { name: 'triggerId', type: 'string', required: true }
          ],
          example: `await workflowActor.executeTrigger('${capabilities.workflowId}', '${trigger.triggerId}')`
        });
      } else if (trigger.type === 'webhook') {
        executionMethods.push({
          method: 'webhook',
          description: `Execute workflow via webhook: ${trigger.name}`,
          parameters: [
            { name: 'webhookUrl', type: 'string', required: true },
            { name: 'payload', type: 'object', required: true }
          ],
          example: `POST ${trigger.name} webhook URL with payload`
        });
      }
    });
    
    return {
      workflowId: capabilities.workflowId,
      name: capabilities.name,
      description: capabilities.description,
      executionMethods,
      availableTriggers: capabilities.triggers.map(trigger => ({
        triggerId: trigger.triggerId,
        type: trigger.type,
        name: trigger.name,
        description: `Trigger type: ${trigger.type}`,
        howToUse: trigger.type === 'scheduled' 
          ? 'Automatically executes on schedule'
          : trigger.type === 'webhook'
          ? 'Send HTTP POST to webhook URL'
          : 'Execute manually via API'
      }))
    };
  }
  
  /**
   * Extract capabilities from workflow steps
   */
  private static extractCapabilitiesFromSteps(steps: AgentStep[]): string[] {
    const capabilities: string[] = [];
    
    // Analyze step patterns
    const hasLoops = steps.some(s => s.loopConfig && s.loopConfig.type !== 'none');
    const hasNestedWorkflows = steps.some(s => s.stepTarget && 'agency' in s.stepTarget);
    const stepCount = steps.length;
    
    if (hasLoops) {
      capabilities.push('iterative-processing');
    }
    
    if (hasNestedWorkflows) {
      capabilities.push('nested-workflows');
    }
    
    if (stepCount > 1) {
      capabilities.push('multi-step-automation');
    }
    
    if (stepCount === 1) {
      capabilities.push('single-step-execution');
    }
    
    // Add based on step count
    if (stepCount >= 5) {
      capabilities.push('complex-workflow');
    }
    
    return capabilities.length > 0 ? capabilities : ['general-automation'];
  }
}

