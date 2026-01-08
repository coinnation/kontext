import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { InitializationOverlay } from './InitializationOverlay';
import { AdminInterface } from './AdminInterface';
import { ProfileInterface } from './ProfileInterface';
import { UserDropdown } from './UserDropdown';
import { RenewalWarningBanner } from './RenewalWarningBanner';
import { SubscriptionSelectionInterface } from './SubscriptionSelectionInterface';
import { AgenciesManagementInterface } from './agency/AgenciesManagementInterface';
import { BusinessAgenciesTab } from './businessAgency';
import { AIAssistantTab } from './aiAssistant';
import { useAppStore, useAuth, useInitialization, useSubscription } from '../store/appStore';
import { BusinessAgencyStorageService } from '../services/BusinessAgencyStorageService';
import { AgencyTemplatesService, AGENCY_TEMPLATES } from '../services/AgencyTemplatesService';
import { BusinessAgencyService } from '../services/BusinessAgencyService';
import type { BusinessAgency, BusinessAgencyTemplate } from '../types/businessAgency';
import { AgencyService } from '../services/AgencyService';
import { SubscriptionTier, PaymentProcessingState, PaymentProcessingError } from '../types';
import { optimizedInitializationService } from '../services/OptimizedInitialization';
import { userCanisterService } from '../services/UserCanisterService';
import { AgentDeploymentService, type AgentDeploymentProgress } from '../services/AgentDeploymentService';
import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory as agentIdlFactory } from '../../candid/agent.did.js';
import type { _SERVICE as AgentService, AgentIdentity, AgentMetrics, Task, TriggerConfig, Approval, ErrorLog, ActivityEvent, AgentConfig, ConditionType, ScheduleType, RetryConfig, ExecutionLimits, TriggerType } from '../candid/agent.did.d.ts';
import { ClaudeService } from '../claudeService';
import type { MCPTool } from '../claudeService';
import { AgentOperationProgressOverlay, type AgentOperationProgress } from './AgentOperationProgressOverlay';

// ==================== ENHANCED TYPES ====================

interface ServerPair {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
}

interface DeployedAgent {
  id: string;
  name: string;
  serverPairId: string;
  serverPairName: string;
  backendCanisterId: string;
  frontendCanisterId: string;
  backendUrl: string;
  frontendUrl: string;
  deployedAt: number;
  status: 'deploying' | 'active' | 'error';
  error?: string;
  // Enhanced agent tracking
  agentIdentity?: AgentIdentity;
  metrics?: AgentMetrics;
  triggers?: TriggerConfig[];
  lastActivity?: number;
}

interface AgentSubTab {
  id: string;
  label: string;
  icon: string;
}

const AGENT_SUB_TABS: AgentSubTab[] = [
  { id: 'ai-assistant', label: 'AI Assistant', icon: '✨' },
  { id: 'single', label: 'Single Agents', icon: '🤖' },
  { id: 'agencies', label: 'Multi-Agent Workflows', icon: '🏢' },
  { id: 'business-agencies', label: 'Business Agencies', icon: '🏛️' }
];

// Mobile responsiveness helper
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile, isTablet };
};

// ==================== TYPE CONVERTERS ====================

const convertBigIntToNumber = (bigintValue: bigint | undefined | null): number => {
  if (!bigintValue) return 0;
  return Number(bigintValue);
};


const convertOptionalBigInt = (optional: [] | [bigint]): number | undefined => {
  return optional.length > 0 ? Number(optional[0]) : undefined;
};

const convertOptionalString = (optional: [] | [string]): string | undefined => {
  return optional.length > 0 ? optional[0] : undefined;
};

// FIXED: Use function declaration instead of arrow function with generic
function convertOptionalArray<T>(optional: [] | [T[]]): T[] {
  return optional.length > 0 ? (optional[0] || []) : [];
}

// ==================== AGENT SERVICE ====================

class AgentServiceClass {
  private agentActors: Map<string, AgentService> = new Map();

  async createAgentActor(canisterId: string, identity: any): Promise<AgentService> {
    const cached = this.agentActors.get(canisterId);
    if (cached) return cached;

    const agent = new HttpAgent({ 
      identity, 
      host: process.env.NODE_ENV === 'production' ? 'https://ic0.app' : 'http://localhost:4943'
    });

    if (process.env.NODE_ENV !== 'production') {
      await agent.fetchRootKey();
    }

    const agentActor = Actor.createActor<AgentService>(agentIdlFactory, {
      agent,
      canisterId,
    });

    this.agentActors.set(canisterId, agentActor);
    return agentActor;
  }

  async getAgentData(canisterId: string, identity: any) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);

      // Use Promise.allSettled to handle any individual failures gracefully
      const results = await Promise.allSettled([
        actor.getAgentIdentity(),
        actor.getMetrics(),
        actor.getAllTasks(BigInt(20)), // Get last 20 tasks
        actor.getTriggers(),
        actor.getPendingApprovals(),
        actor.getActiveErrors(),
        actor.getRecentActivity(BigInt(50)) // Get last 50 activity events
      ]);

      // Extract results safely
      const [identityResult, metricsResult, tasksResult, triggersResult, approvalsResult, errorsResult, activityResult] = results;

      return {
        identity: identityResult.status === 'fulfilled' ? 
          this.convertAgentIdentity(identityResult.value) : undefined,
        metrics: metricsResult.status === 'fulfilled' ? 
          this.convertAgentMetrics(metricsResult.value) : undefined,
        tasks: tasksResult.status === 'fulfilled' ? 
          tasksResult.value.map(task => this.convertTask(task)) : [],
        triggers: triggersResult.status === 'fulfilled' ? 
          triggersResult.value.map(trigger => this.convertTriggerConfig(trigger)) : [],
        approvals: approvalsResult.status === 'fulfilled' ? 
          approvalsResult.value.map(approval => this.convertApproval(approval)) : [],
        errors: errorsResult.status === 'fulfilled' ? 
          errorsResult.value.map(error => this.convertErrorLog(error)) : [],
        activity: activityResult.status === 'fulfilled' ? 
          activityResult.value.map(event => this.convertActivityEvent(event)) : []
      };
    } catch (error) {
      console.error(`Failed to load agent data for ${canisterId}:`, error);
      return {
        identity: undefined,
        metrics: undefined,
        tasks: [],
        triggers: [],
        approvals: [],
        errors: [],
        activity: []
      };
    }
  }

  private convertAgentIdentity(optional: [] | [AgentIdentity]): AgentIdentity | undefined {
    if (optional.length === 0) return undefined;
    const identity = optional[0];
    
    return {
      ...identity,
      createdAt: convertBigIntToNumber(identity.createdAt),
      maxTokens: convertBigIntToNumber(identity.maxTokens),
      owner: identity.owner.toString(),
      authorizedManagers: identity.authorizedManagers ? identity.authorizedManagers.map(p => p.toString()) : [], // NEW: Convert authorized managers
      // Return the API key as-is (no masking - it will be hidden in password input)
      claudeApiKey: identity.claudeApiKey || ''
    };
  }

  private convertAgentMetrics(metrics: AgentMetrics): AgentMetrics {
    return {
      ...metrics,
      totalTasks: convertBigIntToNumber(metrics.totalTasks),
      successfulTasks: convertBigIntToNumber(metrics.successfulTasks),
      failedTasks: convertBigIntToNumber(metrics.failedTasks),
      pendingApprovals: convertBigIntToNumber(metrics.pendingApprovals),
      totalApprovals: convertBigIntToNumber(metrics.totalApprovals),
      activeErrors: convertBigIntToNumber(metrics.activeErrors),
      totalCyclesUsed: convertBigIntToNumber(metrics.totalCyclesUsed),
      mcpToolsConfigured: convertBigIntToNumber(metrics.mcpToolsConfigured)
    };
  }

  private convertTask(task: Task): Task {
    return {
      ...task,
      createdAt: convertBigIntToNumber(task.createdAt),
      updatedAt: convertBigIntToNumber(task.updatedAt),
      cyclesUsed: convertBigIntToNumber(task.cyclesUsed),
      result: convertOptionalString(task.result),
      confidence: task.confidence.length > 0 ? task.confidence[0] : undefined
    };
  }

  private convertTriggerConfig(trigger: TriggerConfig): TriggerConfig {
    return {
      ...trigger,
      createdAt: convertBigIntToNumber(trigger.createdAt),
      updatedAt: convertBigIntToNumber(trigger.updatedAt),
      triggerCount: convertBigIntToNumber(trigger.triggerCount),
      lastTriggered: convertOptionalBigInt(trigger.lastTriggered),
      nextRun: convertOptionalBigInt(trigger.nextRun),
      lastResult: convertOptionalString(trigger.lastResult),
      owner: trigger.owner.toString()
    };
  }

  private convertApproval(approval: Approval): Approval {
    return {
      ...approval,
      timestamp: convertBigIntToNumber(approval.timestamp),
      approvedAt: convertOptionalBigInt(approval.approvedAt),
      approvedBy: approval.approvedBy.length > 0 ? approval.approvedBy[0].toString() : undefined
    };
  }

  private convertErrorLog(error: ErrorLog): ErrorLog {
    return {
      ...error,
      timestamp: convertBigIntToNumber(error.timestamp),
      taskId: convertOptionalString(error.taskId),
      stackTrace: convertOptionalString(error.stackTrace)
    };
  }

  private convertActivityEvent(event: ActivityEvent): ActivityEvent {
    return {
      ...event,
      timestamp: convertBigIntToNumber(event.timestamp),
      taskId: convertOptionalString(event.taskId)
    };
  }

  // Agent control methods
  async executeTask(canisterId: string, identity: any, input: string, metadata: [string, string][] = []) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.executeTask(input, [], metadata, []);
      return result;
    } catch (error) {
      console.error('Failed to execute task:', error);
      return { err: 'Failed to execute task' };
    }
  }

  async processApproval(canisterId: string, identity: any, approvalId: string, approved: boolean) {
    try {
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(canisterId, identity);
      if (!authCheck.authorized) {
        return { 
          err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` 
        };
      }

      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.processApproval(approvalId, approved);
      return result;
    } catch (error) {
      console.error('Failed to process approval:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('authorized')) {
        const authCheck = await this.ensureKontextManagement(canisterId, identity);
        if (!authCheck.authorized) {
          return { err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` };
        }
        // Retry
        try {
          const actor = await this.createAgentActor(canisterId, identity);
          const result = await actor.processApproval(approvalId, approved);
          return result;
        } catch (retryError) {
          return { err: 'Failed to process approval after claiming management' };
        }
      }
      return { err: 'Failed to process approval' };
    }
  }

  async toggleTrigger(canisterId: string, identity: any, triggerId: string) {
    try {
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(canisterId, identity);
      if (!authCheck.authorized) {
        return { 
          err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` 
        };
      }

      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.toggleTrigger(triggerId);
      return result;
    } catch (error) {
      console.error('Failed to toggle trigger:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('authorized')) {
        const authCheck = await this.ensureKontextManagement(canisterId, identity);
        if (!authCheck.authorized) {
          return { err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` };
        }
        // Retry
        try {
          const actor = await this.createAgentActor(canisterId, identity);
          const result = await actor.toggleTrigger(triggerId);
          return result;
        } catch (retryError) {
          return { err: 'Failed to toggle trigger after claiming management' };
        }
      }
      return { err: 'Failed to toggle trigger' };
    }
  }

  async executeTrigger(canisterId: string, identity: any, triggerId: string) {
    try {
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(canisterId, identity);
      if (!authCheck.authorized) {
        return { 
          err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` 
        };
      }

      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.executeTrigger(triggerId);
      return result;
    } catch (error) {
      console.error('Failed to execute trigger:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('authorized')) {
        const authCheck = await this.ensureKontextManagement(canisterId, identity);
        if (!authCheck.authorized) {
          return { err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` };
        }
        // Retry
        try {
          const actor = await this.createAgentActor(canisterId, identity);
          const result = await actor.executeTrigger(triggerId);
          return result;
        } catch (retryError) {
          return { err: 'Failed to execute trigger after claiming management' };
        }
      }
      return { err: 'Failed to execute trigger' };
    }
  }

  async updateAgentConfig(canisterId: string, identity: any, config: AgentConfig) {
    console.log('📡 [AgentService.updateAgentConfig] Called:', {
      canisterId,
      mcpTokensCount: config.mcpTokens.length,
      mcpTokensKeys: config.mcpTokens.map(([k]) => k),
      mcpTokens: JSON.stringify(config.mcpTokens)
    });
    
    try {
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(canisterId, identity);
      if (!authCheck.authorized) {
        console.error('❌ [AgentService.updateAgentConfig] Unauthorized:', authCheck.error);
        return { 
          err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access. If the agent was initialized by the independent UI first, you may need to manually add Kontext as a manager.'}` 
        };
      }

      console.log('✅ [AgentService.updateAgentConfig] Authorized, calling canister...');
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.updateAgentConfig(config);
      console.log('📥 [AgentService.updateAgentConfig] Canister response:', result);
      return result;
    } catch (error) {
      console.error('Failed to update agent config:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('authorized')) {
        const authCheck = await this.ensureKontextManagement(canisterId, identity);
        if (!authCheck.authorized) {
          return { err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` };
        }
        // Retry
        try {
          const actor = await this.createAgentActor(canisterId, identity);
          const result = await actor.updateAgentConfig(config);
          return result;
        } catch (retryError) {
          return { err: 'Failed to update agent config after claiming management' };
        }
      }
      return { err: 'Failed to update agent config' };
    }
  }

  async getTask(canisterId: string, identity: any, taskId: string) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.getTask(taskId);
      if (result.length > 0) {
        return { ok: this.convertTask(result[0]) };
      }
      return { err: 'Task not found' };
    } catch (error) {
      console.error('Failed to get task:', error);
      return { err: 'Failed to get task' };
    }
  }

  async getTrigger(canisterId: string, identity: any, triggerId: string) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.getTrigger(triggerId);
      if (result.length > 0) {
        return { ok: this.convertTriggerConfig(result[0]) };
      }
      return { err: 'Trigger not found' };
    } catch (error) {
      console.error('Failed to get trigger:', error);
      return { err: 'Failed to get trigger' };
    }
  }

  async getTriggerHistory(canisterId: string, identity: any, triggerId: string, limit: number = 20) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.getTriggerHistory(triggerId, BigInt(limit));
      return { ok: result.map(task => this.convertTask(task)) };
    } catch (error) {
      console.error('Failed to get trigger history:', error);
      return { err: 'Failed to get trigger history' };
    }
  }

  // Helper: Try to claim Kontext management if not authorized
  private async ensureKontextManagement(canisterId: string, identity: any): Promise<{ authorized: boolean; error?: string }> {
    try {
      // Check if we're authorized by trying to get authorized managers
      const managersResult = await this.getAuthorizedManagers(canisterId, identity);
      const kontextPrincipal = identity.getPrincipal().toText();
      
      if ('ok' in managersResult) {
        const isAuthorized = managersResult.ok.includes(kontextPrincipal);
        if (isAuthorized) {
          return { authorized: true };
        }
      }

      // Not authorized - try to claim management
      console.log('⚠️ [AgentService] Kontext not authorized, attempting to claim management...');
      const claimResult = await this.claimKontextManagement(canisterId, identity);
      
      if ('ok' in claimResult) {
        console.log('✅ [AgentService] Kontext management claimed successfully');
        return { authorized: true };
      } else {
        const errorMsg = claimResult.err || 'Failed to claim management';
        console.error('❌ [AgentService] Failed to claim management:', errorMsg);
        return { authorized: false, error: errorMsg };
      }
    } catch (error) {
      console.error('❌ [AgentService] Error checking/claiming management:', error);
      return { authorized: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async createScheduledTrigger(
    canisterId: string,
    identity: any,
    name: string,
    description: string,
    schedule: ScheduleType,
    inputTemplate: string,
    retryConfig?: RetryConfig,
    executionLimits?: ExecutionLimits
  ) {
    try {
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(canisterId, identity);
      if (!authCheck.authorized) {
        return { 
          err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access. If the agent was initialized by the independent UI first, you may need to manually add Kontext as a manager.'}` 
        };
      }

      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.createScheduledTrigger(
        name,
        description,
        schedule,
        inputTemplate,
        retryConfig ? [retryConfig] : [],
        executionLimits ? [executionLimits] : []
      );
      return result;
    } catch (error) {
      console.error('Failed to create scheduled trigger:', error);
      // Check if it's an authorization error
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('authorized')) {
        // Try to claim management one more time
        const authCheck = await this.ensureKontextManagement(canisterId, identity);
        if (!authCheck.authorized) {
          return { err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` };
        }
        // Retry the operation
        try {
          const actor = await this.createAgentActor(canisterId, identity);
          const result = await actor.createScheduledTrigger(
            name,
            description,
            schedule,
            inputTemplate,
            retryConfig ? [retryConfig] : [],
            executionLimits ? [executionLimits] : []
          );
          return result;
        } catch (retryError) {
          return { err: 'Failed to create scheduled trigger after claiming management' };
        }
      }
      return { err: 'Failed to create scheduled trigger' };
    }
  }

  async createConditionTrigger(
    canisterId: string,
    identity: any,
    name: string,
    description: string,
    condition: ConditionType,
    inputTemplate: string,
    retryConfig?: RetryConfig,
    executionLimits?: ExecutionLimits
  ) {
    try {
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(canisterId, identity);
      if (!authCheck.authorized) {
        return { 
          err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access. If the agent was initialized by the independent UI first, you may need to manually add Kontext as a manager.'}` 
        };
      }

      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.createConditionTrigger(
        name,
        description,
        condition,
        inputTemplate,
        retryConfig ? [retryConfig] : [],
        executionLimits ? [executionLimits] : []
      );
      return result;
    } catch (error) {
      console.error('Failed to create condition trigger:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('authorized')) {
        const authCheck = await this.ensureKontextManagement(canisterId, identity);
        if (!authCheck.authorized) {
          return { err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` };
        }
        // Retry
        try {
          const actor = await this.createAgentActor(canisterId, identity);
          const result = await actor.createConditionTrigger(
            name,
            description,
            condition,
            inputTemplate,
            retryConfig ? [retryConfig] : [],
            executionLimits ? [executionLimits] : []
          );
          return result;
        } catch (retryError) {
          return { err: 'Failed to create condition trigger after claiming management' };
        }
      }
      return { err: 'Failed to create condition trigger' };
    }
  }

  async createWebhookTrigger(
    canisterId: string,
    identity: any,
    name: string,
    description: string,
    source: string,
    signature: string | undefined,
    inputTemplate: string,
    retryConfig?: RetryConfig,
    executionLimits?: ExecutionLimits
  ) {
    try {
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(canisterId, identity);
      if (!authCheck.authorized) {
        return { 
          err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access. If the agent was initialized by the independent UI first, you may need to manually add Kontext as a manager.'}` 
        };
      }

      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.createWebhookTrigger(
        name,
        description,
        source,
        signature ? [signature] : [],
        inputTemplate,
        retryConfig ? [retryConfig] : [],
        executionLimits ? [executionLimits] : []
      );
      return result;
    } catch (error) {
      console.error('Failed to create webhook trigger:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('authorized')) {
        const authCheck = await this.ensureKontextManagement(canisterId, identity);
        if (!authCheck.authorized) {
          return { err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` };
        }
        // Retry
        try {
          const actor = await this.createAgentActor(canisterId, identity);
          const result = await actor.createWebhookTrigger(
            name,
            description,
            source,
            signature ? [signature] : [],
            inputTemplate,
            retryConfig ? [retryConfig] : [],
            executionLimits ? [executionLimits] : []
          );
          return result;
        } catch (retryError) {
          return { err: 'Failed to create webhook trigger after claiming management' };
        }
      }
      return { err: 'Failed to create webhook trigger' };
    }
  }

  async updateTrigger(
    canisterId: string,
    identity: any,
    triggerId: string,
    name?: string,
    description?: string,
    enabled?: boolean,
    inputTemplate?: string,
    retryConfig?: RetryConfig,
    executionLimits?: ExecutionLimits
  ) {
    try {
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(canisterId, identity);
      if (!authCheck.authorized) {
        return { 
          err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` 
        };
      }

      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.updateTrigger(
        triggerId,
        name ? [name] : [],
        description ? [description] : [],
        enabled !== undefined ? [enabled] : [],
        inputTemplate ? [inputTemplate] : [],
        retryConfig ? [retryConfig] : [],
        executionLimits ? [executionLimits] : []
      );
      return result;
    } catch (error) {
      console.error('Failed to update trigger:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('authorized')) {
        const authCheck = await this.ensureKontextManagement(canisterId, identity);
        if (!authCheck.authorized) {
          return { err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` };
        }
        // Retry
        try {
          const actor = await this.createAgentActor(canisterId, identity);
          const result = await actor.updateTrigger(
            triggerId,
            name ? [name] : [],
            description ? [description] : [],
            enabled !== undefined ? [enabled] : [],
            inputTemplate ? [inputTemplate] : [],
            retryConfig ? [retryConfig] : [],
            executionLimits ? [executionLimits] : []
          );
          return result;
        } catch (retryError) {
          return { err: 'Failed to update trigger after claiming management' };
        }
      }
      return { err: 'Failed to update trigger' };
    }
  }

  async deleteTrigger(canisterId: string, identity: any, triggerId: string) {
    try {
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(canisterId, identity);
      if (!authCheck.authorized) {
        return { 
          err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` 
        };
      }

      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.deleteTrigger(triggerId);
      return result;
    } catch (error) {
      console.error('Failed to delete trigger:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('authorized')) {
        const authCheck = await this.ensureKontextManagement(canisterId, identity);
        if (!authCheck.authorized) {
          return { err: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}` };
        }
        // Retry
        try {
          const actor = await this.createAgentActor(canisterId, identity);
          const result = await actor.deleteTrigger(triggerId);
          return result;
        } catch (retryError) {
          return { err: 'Failed to delete trigger after claiming management' };
        }
      }
      return { err: 'Failed to delete trigger' };
    }
  }

  async initializeAgent(canisterId: string, identity: any, config: AgentConfig) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.initializeAgent(config);
      return result;
    } catch (error) {
      console.error('Failed to initialize agent:', error);
      return { err: 'Failed to initialize agent' };
    }
  }

  // NEW: Set Kontext owner (called during deployment)
  async setKontextOwner(canisterId: string, identity: any, ownerPrincipal: string) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const principal = Principal.fromText(ownerPrincipal);
      const result = await actor.setKontextOwner(principal);
      return result;
    } catch (error) {
      console.error('Failed to set Kontext owner:', error);
      return { err: 'Failed to set Kontext owner' };
    }
  }

  // NEW: Initialize from Kontext (replaces initializeAgent for Kontext deployments)
  async initializeFromKontext(canisterId: string, identity: any, config: AgentConfig) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.initializeFromKontext(config);
      return result;
    } catch (error) {
      console.error('Failed to initialize agent from Kontext:', error);
      return { err: 'Failed to initialize agent from Kontext' };
    }
  }

  // NEW: Get authorized managers
  async getAuthorizedManagers(canisterId: string, identity: any) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.getAuthorizedManagers();
      return { ok: result.map(p => p.toString()) };
    } catch (error) {
      console.error('Failed to get authorized managers:', error);
      return { err: 'Failed to get authorized managers' };
    }
  }

  // NEW: Get Kontext owner
  async getKontextOwner(canisterId: string, identity: any) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.getKontextOwner();
      // result is ?Principal (optional), so check if it exists
      return { ok: result.length > 0 && result[0] ? result[0].toString() : null };
    } catch (error) {
      console.error('Failed to get Kontext owner:', error);
      return { err: 'Failed to get Kontext owner' };
    }
  }

  // NEW: Claim management for Kontext (tries to set owner and initialize)
  // This should be called when Kontext detects it's not authorized
  async claimKontextManagement(canisterId: string, identity: any, config?: AgentConfig) {
    try {
      console.log('🏢 [AgentService] Attempting to claim Kontext management...');
      const kontextPrincipal = identity.getPrincipal().toText();
      
      // Step 1: Try to set Kontext owner (will work if owner is null, even if agent is initialized)
      const setOwnerResult = await this.setKontextOwner(canisterId, identity, kontextPrincipal);
      
      if ('err' in setOwnerResult) {
        console.warn('⚠️ [AgentService] Failed to set Kontext owner:', setOwnerResult.err);
        // Continue anyway - might already be set
      } else {
        console.log('✅ [AgentService] Kontext owner set:', setOwnerResult.ok);
      }

      // Step 2: Try to initialize from Kontext (will add Kontext as manager if already initialized)
      if (config) {
        const initResult = await this.initializeFromKontext(canisterId, identity, config);
        if ('ok' in initResult) {
          console.log('✅ [AgentService] Kontext management claimed successfully:', initResult.ok);
          return { ok: 'Kontext management claimed successfully' };
        } else {
          console.warn('⚠️ [AgentService] Failed to initialize from Kontext:', initResult.err);
          return { err: initResult.err };
        }
      } else {
        // No config provided - just try to set owner
        return setOwnerResult;
      }
    } catch (error) {
      console.error('❌ [AgentService] Error claiming Kontext management:', error);
      return { err: `Failed to claim management: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async exportConfig(canisterId: string, identity: any) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.exportConfig();
      if (result.length > 0) {
        return { ok: result[0] };
      }
      return { err: 'Config not available' };
    } catch (error) {
      console.error('Failed to export config:', error);
      return { err: 'Failed to export config' };
    }
  }

  async handleWebhook(
    canisterId: string,
    identity: any,
    triggerId: string,
    headers: [string, string][],
    body: Uint8Array
  ) {
    try {
      const actor = await this.createAgentActor(canisterId, identity);
      const result = await actor.handleWebhook({
        triggerId,
        headers,
        body
      });
      return result;
    } catch (error) {
      console.error('Failed to handle webhook:', error);
      return { err: { code: BigInt(500), message: 'Failed to handle webhook' } };
    }
  }

  clearCache() {
    this.agentActors.clear();
  }
}

const AgentServiceInstance = new AgentServiceClass();

// ==================== MAIN COMPONENT ====================

export const AgentManagementInterface: React.FC = () => {
  const { isMobile, isTablet } = useIsMobile();
  const [activeSubTab, setActiveSubTab] = useState('ai-assistant');

  const {
    activeProject,
    userCanisterId,
    identity,
    principal,
  } = useAppStore(state => ({
    activeProject: state.activeProject,
    userCanisterId: state.userCanisterId,
    identity: state.identity,
    principal: state.principal,
  }));

  // Handle closing the agencies interface and returning to single agents
  const handleCloseAgencies = () => {
    setActiveSubTab('single');
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">
            No Project Selected
          </h3>
          <p className="text-gray-500">
            Select a project to manage agents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ 
      background: 'var(--primary-black)',
      minHeight: 0,
      overflow: 'hidden'
    }}>
      {/* Header with Enhanced Sub-tabs */}
      <div style={{
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(255, 107, 53, 0.03)', // Level 1: Orange tint
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
      }}>
        {/* Title - Compact */}
        <div style={{ 
          padding: '0.75rem 1rem 0.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.1rem' : isTablet ? '1.25rem' : '1.4rem',
            fontWeight: '600',
            color: '#ffffff',
            margin: '0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{
              fontSize: '1.3rem',
              filter: 'drop-shadow(0 2px 4px rgba(255, 107, 53, 0.3))'
            }}>🤖</span>
            AI Agent Management
          </h2>
        </div>

        {/* Enhanced Sub-tabs - Level 2 */}
        <div style={{
          display: 'flex',
          paddingLeft: '1rem',
          paddingBottom: '0.5rem',
          paddingTop: '0.5rem',
          gap: '0.5rem',
          background: 'rgba(16, 185, 129, 0.02)', // Level 2: Green tint
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)'
        }}>
          {AGENT_SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(16, 185, 129, 0.1))'
                    : 'transparent',
                  border: isActive
                    ? '1px solid rgba(255, 107, 53, 0.4)'
                    : '1px solid transparent',
                  borderRadius: '8px 8px 0 0',
                  color: isActive ? '#ffffff' : 'var(--text-gray)',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive
                    ? '0 -4px 12px rgba(255, 107, 53, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    : 'none',
                  transform: isActive ? 'translateY(-2px)' : 'translateY(0)'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                    e.currentTarget.style.color = '#ccc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.color = 'var(--text-gray)';
                  }
                }}
              >
                <span 
                  style={{
                    fontSize: '1.1rem',
                    display: 'inline-block',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isActive ? 'scale(1.2) rotate(5deg)' : 'scale(1)',
                    filter: isActive 
                      ? 'drop-shadow(0 4px 8px rgba(255, 107, 53, 0.4))'
                      : 'none',
                    opacity: isActive ? 1 : 0.7
                  }}
                >
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                
                {/* Enhanced Bottom border indicator with glow */}
                {isActive && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-green))',
                      boxShadow: '0 0 8px rgba(255, 107, 53, 0.6)',
                      borderRadius: '1px 1px 0 0'
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ 
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {activeSubTab === 'single' && <SingleAgentTab />}
        {activeSubTab === 'agencies' && (
          <AgenciesManagementInterface onClose={handleCloseAgencies} />
        )}
        {activeSubTab === 'business-agencies' && <BusinessAgenciesTab />}
        {activeSubTab === 'ai-assistant' && (
          <AIAssistantTab onSwitchToTab={(tabId) => setActiveSubTab(tabId)} />
        )}
      </div>
    </div>
  );
};

// ==================== ENHANCED SINGLE AGENT TAB ====================

const SingleAgentTab: React.FC = () => {
  const { isMobile } = useIsMobile();
  const {
    activeProject,
    userCanisterId,
    identity,
    principal,
  } = useAppStore(state => ({
    activeProject: state.activeProject,
    userCanisterId: state.userCanisterId,
    identity: state.identity,
    principal: state.principal,
  }));

  const [serverPairs, setServerPairs] = useState<ServerPair[]>([]);
  const [deployedAgents, setDeployedAgents] = useState<DeployedAgent[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  // 🔥 UPDATED: Local state for agent deployment modal (not related to global server pair selection)
  const [selectedServerPair, setSelectedServerPair] = useState<string>('');
  const [agentName, setAgentName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState<AgentDeploymentProgress | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<DeployedAgent | null>(null);

  // Enhanced agent monitoring with real data
  const [agentData, setAgentData] = useState<Map<string, {
    identity?: AgentIdentity;
    metrics?: AgentMetrics;
    tasks?: Task[];
    triggers?: TriggerConfig[];
    approvals?: Approval[];
    errors?: ErrorLog[];
    activity?: ActivityEvent[];
  }>>(new Map());

  const [isRefreshingAgents, setIsRefreshingAgents] = useState(false);

  // Load server pairs
  useEffect(() => {
    const loadServerPairs = async () => {
      if (!userCanisterId || !identity || !activeProject) {
        return;
      }

      try {
        setIsLoadingServers(true);
        const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
        const serverPairsResult = await userActor.getProjectServerPairs(activeProject);

        if (serverPairsResult && 'ok' in serverPairsResult) {
          const pairs = serverPairsResult.ok.map((pair: any) => ({
            pairId: pair.pairId,
            name: pair.name,
            createdAt: Number(pair.createdAt) / 1_000_000,
            creditsAllocated: Number(pair.creditsAllocated),
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          
          setServerPairs(pairs);
          
          // Auto-select first server pair if none selected
          if (!selectedServerPair && pairs.length > 0) {
            setSelectedServerPair(pairs[0].pairId);
          }
        }
      } catch (error) {
        console.error('Failed to load server pairs:', error);
      } finally {
        setIsLoadingServers(false);
      }
    };

    loadServerPairs();
  }, [userCanisterId, identity, activeProject]);

  // Load deployed agents from localStorage
  useEffect(() => {
    if (!activeProject) return;
    
    const stored = localStorage.getItem(`deployed-agents-${activeProject}`);
    if (stored) {
      try {
        const agents = JSON.parse(stored);
        setDeployedAgents(agents);
        
        // Start monitoring active agents
        agents.forEach((agent: DeployedAgent) => {
          if (agent.status === 'active') {
            loadAgentData(agent.backendCanisterId, agent.id);
          }
        });
      } catch (error) {
        console.error('Failed to load deployed agents:', error);
      }
    }
  }, [activeProject]);

  // Load agent data using the real Candid interface
  const loadAgentData = async (backendCanisterId: string, agentId: string, preserveTasks: boolean = false) => {
    if (!identity || !activeProject) return;

    try {
      console.log(`🔄 Loading data for agent ${agentId} from canister ${backendCanisterId}`);
      
      const data = await AgentServiceInstance.getAgentData(backendCanisterId, identity);
      
      // Store the data in memory
      // If preserveTasks is true, merge existing tasks with new ones to prevent disappearing
      if (preserveTasks) {
        setAgentData(prev => {
          const existing = prev.get(agentId);
          const existingTasks = existing?.tasks || [];
          const newTasks = data.tasks || [];
          
          // Create a map of tasks by ID for efficient lookup
          const taskMap = new Map<string, Task>();
          
          // First, add all existing tasks (these will be preserved if not in new data)
          existingTasks.forEach(task => {
            taskMap.set(task.id, task);
          });
          
          // Then, add/update with new tasks (these take precedence)
          newTasks.forEach(task => {
            taskMap.set(task.id, task);
          });
          
          // Convert back to array and sort by createdAt (newest first)
          const mergedTasks = Array.from(taskMap.values()).sort((a, b) => {
            const timeA = typeof a.createdAt === 'bigint' ? Number(a.createdAt) : a.createdAt || 0;
            const timeB = typeof b.createdAt === 'bigint' ? Number(b.createdAt) : b.createdAt || 0;
            return timeB - timeA;
          });
          
          return new Map(prev.set(agentId, {
            ...data,
            tasks: mergedTasks
          }));
        });
      } else {
        setAgentData(prev => new Map(prev.set(agentId, data)));
      }
      
      // IMPORTANT: Persist agentIdentity to localStorage so palette can access MCP config
      if (data.identity) {
        const stored = localStorage.getItem(`deployed-agents-${activeProject}`);
        if (stored) {
          try {
            const agents = JSON.parse(stored);
            const updatedAgents = agents.map((agent: DeployedAgent) => 
              agent.id === agentId 
                ? { ...agent, agentIdentity: data.identity }
                : agent
            );
            localStorage.setItem(`deployed-agents-${activeProject}`, JSON.stringify(updatedAgents));
            console.log(`💾 Saved agentIdentity for ${agentId} to localStorage`);
          } catch (error) {
            console.warn('Failed to save agentIdentity to localStorage:', error);
          }
        }
      }
      
      console.log(`✅ Loaded data for agent ${agentId}:`, data);
      
      // Log MCP tokens specifically
      if (data.identity?.mcpTokens) {
        console.log('🔑 [loadAgentData] MCP tokens loaded from canister:', {
          count: data.identity.mcpTokens.length,
          keys: data.identity.mcpTokens.map(([k]) => k),
          tokens: JSON.stringify(data.identity.mcpTokens.map(([k, v]) => [k, v.length > 0 ? '***' + v.slice(-4) : '']))
        });
      }
      
    } catch (error) {
      console.error(`❌ Failed to load data for agent ${agentId}:`, error);
      
      // If preserveTasks is true, keep existing tasks even on error
      if (preserveTasks) {
        setAgentData(prev => {
          const existing = prev.get(agentId);
          return new Map(prev.set(agentId, {
            identity: existing?.identity,
            metrics: existing?.metrics,
            tasks: existing?.tasks || [],
            triggers: existing?.triggers || [],
            approvals: existing?.approvals || [],
            errors: existing?.errors || [],
            activity: existing?.activity || []
          }));
        });
      } else {
        // Set empty data to indicate we tried but failed
        setAgentData(prev => new Map(prev.set(agentId, {
          identity: undefined,
          metrics: undefined,
          tasks: [],
          triggers: [],
          approvals: [],
          errors: [],
          activity: []
        })));
      }
    }
  };

  // Refresh all agent data
  const refreshAllAgentData = async (preserveTasks: boolean = false) => {
    if (isRefreshingAgents) return;
    
    setIsRefreshingAgents(true);
    console.log('🔄 Refreshing all agent data...');
    
    try {
      const activeAgents = deployedAgents.filter(agent => agent.status === 'active');
      
      await Promise.all(
        activeAgents.map(agent => 
          loadAgentData(agent.backendCanisterId, agent.id, preserveTasks)
        )
      );
      
      console.log('✅ All agent data refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh agent data:', error);
    } finally {
      setIsRefreshingAgents(false);
    }
  };

  // Refresh agent data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (deployedAgents.some(agent => agent.status === 'active')) {
        refreshAllAgentData();
      }
    }, 5000); // Refresh every 5 seconds for better responsiveness when testing manual tasks

    return () => clearInterval(interval);
  }, [deployedAgents]);

  // Save deployed agents to localStorage
  const saveDeployedAgents = (agents: DeployedAgent[]) => {
    if (!activeProject) return;
    localStorage.setItem(`deployed-agents-${activeProject}`, JSON.stringify(agents));
    setDeployedAgents(agents);
  };

  // Handle deployment
  const handleDeploy = async () => {
    if (!selectedServerPair || !agentName.trim() || !userCanisterId || !identity || !principal || !activeProject) {
      return;
    }

    const serverPair = serverPairs.find(p => p.pairId === selectedServerPair);
    if (!serverPair) {
      return;
    }

    try {
      setIsDeploying(true);
      setDeployProgress({ stage: 'download', message: 'Starting deployment...', percent: 0 });

      // Create agent record
      const newAgent: DeployedAgent = {
        id: `agent_${Date.now()}`,
        name: agentName,
        serverPairId: serverPair.pairId,
        serverPairName: serverPair.name,
        backendCanisterId: serverPair.backendCanisterId,
        frontendCanisterId: serverPair.frontendCanisterId,
        backendUrl: '',
        frontendUrl: '',
        deployedAt: Date.now(),
        status: 'deploying'
      };

      // Add to deployed agents list immediately (optimistic)
      const updatedAgents = [...deployedAgents, newAgent];
      saveDeployedAgents(updatedAgents);

      // Deploy agent
      const result = await AgentDeploymentService.deployAgent(
        {
          agentName,
          serverPairId: serverPair.pairId,
          frontendCanisterId: serverPair.frontendCanisterId,
          backendCanisterId: serverPair.backendCanisterId,
          projectId: activeProject,
          userCanisterId,
          identity,
          principal,
        },
        (progress) => {
          setDeployProgress(progress);
        }
      );

      if (result.success) {
        // Step 1: Set Kontext owner before initialization
        try {
          console.log(`🏢 Setting Kontext owner for agent: ${agentName} on canister: ${serverPair.backendCanisterId}`);
          const kontextOwner = identity.getPrincipal().toText();
          
          const setOwnerResult = await AgentServiceInstance.setKontextOwner(
            serverPair.backendCanisterId,
            identity,
            kontextOwner
          );

          if ('ok' in setOwnerResult) {
            console.log(`✅ Kontext owner set successfully: ${setOwnerResult.ok}`);
          } else {
            console.warn(`⚠️ Failed to set Kontext owner: ${setOwnerResult.err}`);
            // Continue anyway - might already be set
          }
        } catch (ownerError) {
          console.warn(`⚠️ Error setting Kontext owner (non-fatal):`, ownerError);
        }

        // Step 2: Initialize the agent with default configuration
        try {
          console.log(`🔧 Initializing agent from Kontext: ${agentName} on canister: ${serverPair.backendCanisterId}`);
          
          const defaultConfig: AgentConfig = {
            name: agentName,
            description: `AI Agent: ${agentName}`,
            instructions: 'You are a helpful AI assistant with access to MCP servers from your custom endpoint. Configure MCP servers in the MCP Servers tab to enable task execution.',
            mcpClientEndpoint: 'https://ai.coinnation.io/api/mcp',
            claudeApiKey: '', // User will need to configure this
            defaultMcpServers: ['zapier', 'rube'], // Default MCP servers matching independent UI
            mcpTokens: [
              ['ZAPIER_AUTH_TOKEN', 'your_zapier_auth_token_here'],
              ['RUBE_AUTH_TOKEN', 'your_rube_auth_token_here']
            ], // Default tokens matching independent UI
            requireApproval: false,
            confidenceThreshold: 0.7,
            maxTokens: BigInt(4000),
            temperature: 0.7
          };

          const initResult = await AgentServiceInstance.initializeFromKontext(
            serverPair.backendCanisterId,
            identity,
            defaultConfig
          );

          if ('ok' in initResult) {
            console.log(`✅ Agent initialized successfully from Kontext: ${initResult.ok}`);
          } else {
            const errorMsg = initResult.err || 'Unknown error';
            console.warn(`⚠️ Agent initialization warning: ${errorMsg}`);
            
            // If initialization failed because owner is not set, try to set it again
            // (This can happen if agent was initialized by independent UI before we set owner)
            if (errorMsg.includes('Kontext owner not set') || errorMsg.includes('owner must be set')) {
              console.log(`🔄 Retrying to set Kontext owner after initialization failure...`);
              try {
                const retryOwnerResult = await AgentServiceInstance.setKontextOwner(
                  serverPair.backendCanisterId,
                  identity,
                  identity.getPrincipal().toText()
                );
                if ('ok' in retryOwnerResult) {
                  console.log(`✅ Kontext owner set on retry: ${retryOwnerResult.ok}`);
                  // Try initializing again
                  const retryInitResult = await AgentServiceInstance.initializeFromKontext(
                    serverPair.backendCanisterId,
                    identity,
                    defaultConfig
                  );
                  if ('ok' in retryInitResult) {
                    console.log(`✅ Agent initialized successfully on retry: ${retryInitResult.ok}`);
                  } else {
                    console.warn(`⚠️ Agent initialization still failed on retry: ${retryInitResult.err}`);
                  }
                } else {
                  console.warn(`⚠️ Failed to set Kontext owner on retry: ${retryOwnerResult.err}`);
                  console.warn(`⚠️ Note: If agent was initialized by independent UI first, Kontext may not be able to claim management.`);
                }
              } catch (retryError) {
                console.warn(`⚠️ Error during retry:`, retryError);
              }
            }
            // Don't fail deployment if initialization fails - agent might already be initialized
          }
        } catch (initError) {
          console.warn(`⚠️ Agent initialization error (non-fatal):`, initError);
          // Don't fail deployment if initialization fails
        }

        // Update agent with URLs
        const finalAgent: DeployedAgent = {
          ...newAgent,
          backendUrl: result.backendUrl!,
          frontendUrl: result.frontendUrl!,
          status: 'active'
        };

        const finalAgents = updatedAgents.map(a => 
          a.id === newAgent.id ? finalAgent : a
        );
        saveDeployedAgents(finalAgents);

        // Start monitoring the new agent after a brief delay
        setTimeout(() => {
          loadAgentData(serverPair.backendCanisterId, finalAgent.id);
        }, 10000); // Give it time to initialize

        // Reset form
        setAgentName('');
        setShowDeployModal(false);
      } else {
        // Update agent with error
        const errorAgent: DeployedAgent = {
          ...newAgent,
          status: 'error',
          error: result.error
        };

        const errorAgents = updatedAgents.map(a => 
          a.id === newAgent.id ? errorAgent : a
        );
        saveDeployedAgents(errorAgents);
      }

    } catch (error) {
      console.error('Deployment failed:', error);
      
      // Update last agent with error
      const errorAgents = [...deployedAgents];
      const lastAgent = errorAgents[errorAgents.length - 1];
      if (lastAgent) {
        lastAgent.status = 'error';
        lastAgent.error = error instanceof Error ? error.message : 'Deployment failed';
        saveDeployedAgents(errorAgents);
      }
    } finally {
      setIsDeploying(false);
      setDeployProgress(null);
    }
  };

  // Delete agent
  const handleDeleteAgent = (agentId: string) => {
    if (confirm('Are you sure you want to remove this agent record? This will not delete the deployed canisters.')) {
      const updated = deployedAgents.filter(a => a.id !== agentId);
      saveDeployedAgents(updated);
      
      // Clean up agent data
      setAgentData(prev => {
        const newMap = new Map(prev);
        newMap.delete(agentId);
        return newMap;
      });
      
      // Close details panel if this agent was selected
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
    }
  };

  // Get agent status
  const getAgentStatus = (agent: DeployedAgent) => {
    if (agent.status !== 'active') {
      return { 
        status: agent.status === 'deploying' ? 'Deploying' : 'Error', 
        color: agent.status === 'deploying' ? '#f59e0b' : '#ef4444' 
      };
    }

    const data = agentData.get(agent.id);
    if (!data) return { status: 'Loading...', color: '#666' };

    const metrics = data.metrics;
    if (!metrics) return { status: 'Initializing', color: '#f59e0b' };

    const hasErrors = (data.errors?.filter(e => !e.resolved).length || 0) > 0;
    const hasPendingApprovals = Number(metrics.pendingApprovals) > 0;
    const successRate = metrics.successRate;

    if (hasErrors) {
      return { status: 'Has Errors', color: '#ef4444' };
    }
    if (hasPendingApprovals) {
      return { status: 'Pending Approval', color: '#ec4899' };
    }
    if (successRate >= 90) {
      return { status: 'Excellent', color: '#10b981' };
    }
    if (successRate >= 70) {
      return { status: 'Good', color: '#22c55e' };
    }
    if (successRate >= 50) {
      return { status: 'Fair', color: '#f59e0b' };
    }

    return { status: 'Active', color: '#10b981' };
  };

  return (
    <div className="h-full flex flex-col" style={{ 
      minHeight: 0,
      height: '100%',
      overflow: 'hidden',
      background: 'var(--primary-black)'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(255, 255, 255, 0.02)',
        flexShrink: 0
      }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl sm:text-2xl">🧠</span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Advanced AI Agents
              </h3>
              <span className="text-xs sm:text-sm font-normal text-gray-400">
                ({deployedAgents.length} deployed)
              </span>
              {isRefreshingAgents && (
                <div className="flex items-center gap-1 text-xs text-blue-400">
                  <span className="animate-spin">🔄</span>
                  <span>Refreshing...</span>
                </div>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-400">
              Deploy sophisticated AI agents with trigger systems, real-time monitoring, approval workflows, and MCP tool integration
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refreshAllAgentData}
              disabled={deployedAgents.length === 0 || isRefreshingAgents}
              className="hidden sm:flex"
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid #3B82F6',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: '#3B82F6',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: deployedAgents.length === 0 ? 'not-allowed' : 'pointer',
                opacity: deployedAgents.length === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                minHeight: '44px',
              }}
            >
              <span className={isRefreshingAgents ? 'animate-spin' : ''}>🔄</span>
              <span>Refresh Data</span>
            </button>
            <button
              onClick={() => setShowDeployModal(true)}
              disabled={serverPairs.length === 0 || isLoadingServers}
              className="w-full sm:w-auto"
              style={{
                background: serverPairs.length === 0 
                  ? 'rgba(107, 114, 128, 0.2)' 
                  : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: serverPairs.length === 0 ? 'not-allowed' : 'pointer',
                opacity: serverPairs.length === 0 ? 0.5 : 1,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                minHeight: '44px',
              }}
              onMouseEnter={(e) => {
                if (serverPairs.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(255, 107, 53, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (serverPairs.length > 0) {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '';
                }
              }}
            >
              <span className="hidden sm:inline">🚀 Deploy Advanced Agent</span>
              <span className="sm:hidden">🚀 Deploy Agent</span>
            </button>
          </div>
        </div>

        {serverPairs.length === 0 && !isLoadingServers && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
          }}>
            <p className="text-sm text-red-400">
              ⚠️ No server pairs available. Create a server pair in the Hosting tab first.
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ 
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {deployedAgents.length === 0 ? (
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden'
          }} className="chat-scrollbar">
            <EmptyAgentsState 
              onDeploy={() => setShowDeployModal(true)} 
              hasServerPairs={serverPairs.length > 0}
            />
          </div>
        ) : (
          <div style={{ 
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0
          }} className="chat-scrollbar">
            <div className="p-3 sm:p-4 lg:p-6">
              {/* Desktop Agent Cards - Unchanged */}
              {!isMobile && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {deployedAgents.map((agent) => {
                    const data = agentData.get(agent.id);
                    const { status, color } = getAgentStatus(agent);
                    
                    return (
                      <EnhancedAgentCard
                        key={agent.id}
                        agent={agent}
                        agentData={data}
                        statusInfo={{ status, color }}
                        onDelete={() => handleDeleteAgent(agent.id)}
                        onSelect={() => setSelectedAgent(agent)}
                        onRefresh={() => loadAgentData(agent.backendCanisterId, agent.id)}
                        isSelected={selectedAgent?.id === agent.id}
                      />
                    );
                  })}
                </div>
              )}

              {/* Mobile Agent Cards - Optimized for touch */}
              {isMobile && (
                <div className="space-y-3">
                  {deployedAgents.map((agent) => {
                    const data = agentData.get(agent.id);
                    const { status, color } = getAgentStatus(agent);
                    const metrics = data?.metrics;
                    const triggers = data?.triggers || [];
                    const activeTriggers = triggers.filter(t => t.enabled);
                    const errors = data?.errors?.filter(e => !e.resolved) || [];
                    const approvals = data?.approvals || [];
                    
                    return (
                      <div 
                        key={agent.id}
                        style={{
                          background: selectedAgent?.id === agent.id
                            ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(16, 185, 129, 0.05))'
                            : 'rgba(255, 255, 255, 0.03)',
                          border: selectedAgent?.id === agent.id
                            ? '2px solid rgba(255, 107, 53, 0.5)' 
                            : '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '1rem',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                        onClick={() => setSelectedAgent(agent)}
                      >
                        {/* Mobile Header - Horizontal layout */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div style={{
                              width: '40px',
                              height: '40px',
                              background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.2rem',
                              flexShrink: 0,
                              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                            }}>
                              🧠
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base font-bold text-white truncate mb-1" title={agent.name}>
                                {agent.name}
                              </h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div style={{
                                  background: `${color}20`,
                                  color: color,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  padding: '0.2rem 0.4rem',
                                  borderRadius: '6px',
                                  textTransform: 'uppercase',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}>
                                  <div style={{
                                    width: '5px',
                                    height: '5px',
                                    borderRadius: '50%',
                                    background: color,
                                    animation: agent.status === 'active' ? 'pulse 2s infinite' : 'none'
                                  }} />
                                  {status}
                                </div>
                                {activeTriggers.length > 0 && (
                                  <div style={{
                                    background: 'rgba(139, 92, 246, 0.2)',
                                    color: '#8B5CF6',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    padding: '0.2rem 0.4rem',
                                    borderRadius: '6px',
                                    textTransform: 'uppercase'
                                  }}>
                                    ⚡ {activeTriggers.length}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 truncate mt-1" title={agent.serverPairName}>
                                🖥️ {agent.serverPairName}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                loadAgentData(agent.backendCanisterId, agent.id);
                              }}
                              style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '6px',
                                padding: '0.4rem',
                                color: '#3B82F6',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                flexShrink: 0,
                                minWidth: '36px',
                                minHeight: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Refresh agent data"
                            >
                              🔄
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAgent(agent.id);
                              }}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '6px',
                                padding: '0.4rem',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                flexShrink: 0,
                                minWidth: '36px',
                                minHeight: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Remove agent"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Mobile Metrics - Compact horizontal grid */}
                        {metrics && (
                          <div style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            marginBottom: '0.75rem',
                          }}>
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(4, 1fr)', 
                              gap: '0.5rem',
                              fontSize: '0.7rem' 
                            }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>Tasks</div>
                                <div style={{ color: '#3B82F6', fontWeight: 700, fontSize: '1rem' }}>
                                  {typeof metrics.totalTasks === 'bigint' ? convertBigIntToNumber(metrics.totalTasks) : metrics.totalTasks}
                                </div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>Success</div>
                                <div style={{ color: '#10B981', fontWeight: 700, fontSize: '1rem' }}>
                                  {metrics.successRate.toFixed(0)}%
                                </div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>Time</div>
                                <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.9rem' }}>
                                  {metrics.avgResponseTime.toFixed(1)}s
                                </div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>MCP</div>
                                <div style={{ color: '#8B5CF6', fontWeight: 700, fontSize: '1rem' }}>
                                  {data?.identity?.defaultMcpServers?.length || 0}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Mobile Status Indicators */}
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {errors.length > 0 && (
                              <div style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
                                ⚠️ {errors.length}
                              </div>
                            )}
                            {metrics && (typeof metrics.pendingApprovals === 'bigint' ? Number(metrics.pendingApprovals) : metrics.pendingApprovals) > 0 && (
                              <div style={{ color: '#EC4899', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
                                👤 {typeof metrics.pendingApprovals === 'bigint' ? Number(metrics.pendingApprovals) : metrics.pendingApprovals}
                              </div>
                            )}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.7rem' }}>
                            {new Date(agent.deployedAt).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Mobile URLs - Compact */}
                        {agent.status === 'active' && (
                          <div className="space-y-1">
                            {agent.frontendUrl && (
                              <div>
                                <a
                                  href={agent.frontendUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 block truncate"
                                  title={agent.frontendUrl}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  🎨 {agent.frontendUrl.replace('https://', '').slice(0, 20)}... ↗
                                </a>
                              </div>
                            )}
                            <div>
                              <a
                                href={agent.backendUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 block truncate"
                                title={`Backend Canister ID: ${agent.backendCanisterId}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                🔧 {agent.backendCanisterId.slice(0, 8)}... ↗
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Mobile Error display */}
                        {agent.error && (
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            padding: '0.5rem',
                            marginTop: '0.5rem',
                          }}>
                            <p className="text-xs text-red-400 line-clamp-2" title={agent.error}>
                              {agent.error}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Agent Details Panel */}
      {selectedAgent && identity && (
        <AgentDetailsPanel
          agent={selectedAgent}
          agentData={agentData.get(selectedAgent.id)}
          identity={identity}
          backendCanisterId={selectedAgent.backendCanisterId}
          onClose={() => setSelectedAgent(null)}
          onRefresh={() => loadAgentData(selectedAgent.backendCanisterId, selectedAgent.id)}
          onExecuteTask={async (input, metadata) => {
            const result = await AgentServiceInstance.executeTask(selectedAgent.backendCanisterId, identity, input, metadata);
            // After successful task execution, refresh agent data immediately
            // The 5-second polling will also catch any updates, but immediate refresh is better for testing
            if ('ok' in result) {
              // Refresh immediately, then again after a short delay to catch any async updates
              loadAgentData(selectedAgent.backendCanisterId, selectedAgent.id, true);
              setTimeout(() => {
                loadAgentData(selectedAgent.backendCanisterId, selectedAgent.id, true);
              }, 1000); // Second refresh after 1 second to catch any async task creation
            }
            return result;
          }}
          onProcessApproval={(approvalId, approved) => 
            AgentServiceInstance.processApproval(selectedAgent.backendCanisterId, identity, approvalId, approved)}
          onToggleTrigger={(triggerId) => 
            AgentServiceInstance.toggleTrigger(selectedAgent.backendCanisterId, identity, triggerId)}
          onExecuteTrigger={(triggerId) => 
            AgentServiceInstance.executeTrigger(selectedAgent.backendCanisterId, identity, triggerId)}
          onUpdateTrigger={(triggerId, name, description, enabled, inputTemplate, retryConfig, executionLimits) =>
            AgentServiceInstance.updateTrigger(selectedAgent.backendCanisterId, identity, triggerId, name, description, enabled, inputTemplate, retryConfig, executionLimits)}
          onDeleteTrigger={(triggerId) =>
            AgentServiceInstance.deleteTrigger(selectedAgent.backendCanisterId, identity, triggerId)}
          onCreateScheduledTrigger={(name, description, schedule, inputTemplate, retryConfig, executionLimits) =>
            AgentServiceInstance.createScheduledTrigger(selectedAgent.backendCanisterId, identity, name, description, schedule, inputTemplate, retryConfig, executionLimits)}
          onCreateConditionTrigger={(name, description, condition, inputTemplate, retryConfig, executionLimits) =>
            AgentServiceInstance.createConditionTrigger(selectedAgent.backendCanisterId, identity, name, description, condition, inputTemplate, retryConfig, executionLimits)}
          onCreateWebhookTrigger={(name, description, source, signature, inputTemplate, retryConfig, executionLimits) =>
            AgentServiceInstance.createWebhookTrigger(selectedAgent.backendCanisterId, identity, name, description, source, signature, inputTemplate, retryConfig, executionLimits)}
        />
      )}

      {/* Deploy Modal */}
      {showDeployModal && (
        <EnhancedDeployAgentModal
          serverPairs={serverPairs}
          selectedServerPair={selectedServerPair}
          setSelectedServerPair={setSelectedServerPair}
          agentName={agentName}
          setAgentName={setAgentName}
          onDeploy={handleDeploy}
          onClose={() => {
            if (!isDeploying) {
              setShowDeployModal(false);
              setAgentName('');
            }
          }}
          isDeploying={isDeploying}
          deployProgress={deployProgress}
        />
      )}

    </div>
  );
};

// ==================== ENHANCED AGENT CARD ====================

const EnhancedAgentCard: React.FC<{
  agent: DeployedAgent;
  agentData?: {
    identity?: AgentIdentity;
    metrics?: AgentMetrics;
    tasks?: Task[];
    triggers?: TriggerConfig[];
    approvals?: Approval[];
    errors?: ErrorLog[];
    activity?: ActivityEvent[];
  };
  statusInfo: { status: string; color: string };
  onDelete: () => void;
  onSelect: () => void;
  onRefresh: () => void;
  isSelected: boolean;
}> = ({ agent, agentData, statusInfo, onDelete, onSelect, onRefresh, isSelected }) => {
  const metrics = agentData?.metrics;
  const triggers = agentData?.triggers || [];
  const activeTriggers = triggers.filter(t => t.enabled);
  const errors = agentData?.errors?.filter(e => !e.resolved) || [];
  const approvals = agentData?.approvals || [];

  return (
    <div 
      style={{
        background: isSelected 
          ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(16, 185, 129, 0.05))'
          : 'rgba(255, 255, 255, 0.03)',
        border: isSelected 
          ? '2px solid rgba(255, 107, 53, 0.5)' 
          : '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.5rem',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        height: 'fit-content',
      }}
      className="hover:bg-white/5 hover:border-orange-500/30"
      onClick={onSelect}
    >
      {/* Agent Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, var(--accent-green), #059669)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          }}>
            🧠
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-white truncate mb-1" title={agent.name}>
              {agent.name}
            </h3>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div style={{
                background: `${statusInfo.color}20`,
                color: statusInfo.color,
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: statusInfo.color,
                  animation: agent.status === 'active' ? 'pulse 2s infinite' : 'none'
                }} />
                {statusInfo.status}
              </div>
              {activeTriggers.length > 0 && (
                <div style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  color: '#8B5CF6',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  textTransform: 'uppercase'
                }}>
                  ⚡ {activeTriggers.length} TRIGGERS
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate" title={agent.serverPairName}>
              🖥️ {agent.serverPairName}
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            className="opacity-60 hover:opacity-100 transition-opacity"
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              padding: '0.35rem',
              color: '#3B82F6',
              cursor: 'pointer',
              fontSize: '0.8rem',
              flexShrink: 0,
            }}
            title="Refresh agent data"
          >
            🔄
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-60 hover:opacity-100 transition-opacity"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              padding: '0.35rem',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '0.8rem',
              flexShrink: 0,
            }}
            title="Remove agent"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Agent Metrics */}
      {metrics && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          paddingRight: '0.75rem',
          marginBottom: '1rem',
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '1rem',
            fontSize: '0.8rem' 
          }}>
            <div>
              <div style={{ color: '#888', marginBottom: '0.25rem' }}>Tasks</div>
              <div style={{ color: '#3B82F6', fontWeight: 700, fontSize: '1.2rem' }}>
                {typeof metrics.totalTasks === 'bigint' ? convertBigIntToNumber(metrics.totalTasks) : metrics.totalTasks}
              </div>
            </div>
            <div>
              <div style={{ color: '#888', marginBottom: '0.25rem' }}>Success Rate</div>
              <div style={{ color: '#10B981', fontWeight: 700, fontSize: '1.2rem' }}>
                {metrics.successRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ color: '#888', marginBottom: '0.25rem' }}>Avg Time</div>
              <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '1.2rem' }}>
                {metrics.avgResponseTime.toFixed(1)}s
              </div>
            </div>
            <div>
              <div style={{ color: '#888', marginBottom: '0.25rem' }}>MCP Servers</div>
              <div style={{ color: '#8B5CF6', fontWeight: 700, fontSize: '1.2rem' }}>
                {agentData?.identity?.defaultMcpServers?.length || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Indicators */}
      <div className="flex items-center justify-between text-xs mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {errors.length > 0 && (
            <div style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              ⚠️ {errors.length} errors
            </div>
          )}
          {metrics && (typeof metrics.pendingApprovals === 'bigint' ? Number(metrics.pendingApprovals) : metrics.pendingApprovals) > 0 && (
            <div style={{ color: '#EC4899', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              👤 {typeof metrics.pendingApprovals === 'bigint' ? Number(metrics.pendingApprovals) : metrics.pendingApprovals} pending
            </div>
          )}
        </div>
        <div style={{ color: '#888' }}>
          {new Date(agent.deployedAt).toLocaleDateString()}
        </div>
      </div>

      {/* URLs */}
      {agent.status === 'active' && (
        <div className="space-y-1">
          {agent.frontendUrl && (
            <div>
              <a
                href={agent.frontendUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 block truncate"
                title={agent.frontendUrl}
                onClick={(e) => e.stopPropagation()}
              >
                🎨 Frontend: {agent.frontendUrl.replace('https://', '')} ↗
              </a>
            </div>
          )}
          <div>
            <a
              href={agent.backendUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 block truncate"
              title={`Backend Canister ID: ${agent.backendCanisterId}\nClick to view in Candid UI`}
              onClick={(e) => e.stopPropagation()}
            >
              🔧 Backend: {agent.backendCanisterId.slice(0, 8)}...{agent.backendCanisterId.slice(-4)} (Candid UI) ↗
            </a>
          </div>
        </div>
      )}

      {/* Error display */}
      {agent.error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '0.75rem',
          marginTop: '0.75rem',
        }}>
          <p className="text-xs text-red-400 line-clamp-3" title={agent.error}>
            {agent.error}
          </p>
        </div>
      )}
    </div>
  );
};

// ==================== AGENT DETAIL TABS ====================

const AgentOverviewTab: React.FC<{
  agent: DeployedAgent;
  agentData?: {
    identity?: AgentIdentity;
    metrics?: AgentMetrics;
    tasks?: Task[];
    triggers?: TriggerConfig[];
    approvals?: Approval[];
    errors?: ErrorLog[];
    activity?: ActivityEvent[];
  };
}> = ({ agent, agentData }) => {
  const identity = agentData?.identity;
  const metrics = agentData?.metrics;
  const triggers = agentData?.triggers || [];
  const errors = agentData?.errors || [];
  const approvals = agentData?.approvals || [];
  const [registeredServers, setRegisteredServers] = useState<any[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);

  // Load registered MCP servers from endpoint
  useEffect(() => {
    const loadServers = async () => {
      if (!identity?.mcpClientEndpoint) return;
      
      setIsLoadingServers(true);
      try {
        const response = await fetch(`${identity.mcpClientEndpoint}/mcp-servers`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setRegisteredServers(data.servers || []);
        }
      } catch (error) {
        console.warn('Failed to load MCP servers:', error);
      } finally {
        setIsLoadingServers(false);
      }
    };
    
    loadServers();
  }, [identity?.mcpClientEndpoint]);

  // Get MCP tools used across all tasks
  const allToolsUsed = useMemo(() => {
    const tools = new Set<string>();
    agentData?.tasks?.forEach(task => {
      task.mcpToolsUsed?.forEach(tool => tools.add(tool));
    });
    return Array.from(tools);
  }, [agentData?.tasks]);

  return (
    <div className="space-y-6">
      {/* MCP Configuration Status - PROMINENT */}
      {identity && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15))',
          border: '2px solid rgba(139, 92, 246, 0.4)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🔧</span>
              MCP Servers Configuration
            </h3>
            <div style={{
              padding: '0.5rem 1rem',
              background: identity.defaultMcpServers.length > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              border: `1px solid ${identity.defaultMcpServers.length > 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
              borderRadius: '8px',
              color: identity.defaultMcpServers.length > 0 ? '#10b981' : '#f59e0b',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}>
              {identity.defaultMcpServers.length > 0 ? '✅ Configured' : '⚠️ Not Configured'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-300 mb-1">MCP Endpoint</div>
              <div className="text-white font-mono text-sm break-all">
                {identity.mcpClientEndpoint || 'Not configured'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-300 mb-1">Active Servers</div>
              <div className="text-2xl font-bold text-purple-400">
                {identity.defaultMcpServers.length}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {identity.defaultMcpServers.length > 0 
                  ? `${identity.defaultMcpServers.length} server${identity.defaultMcpServers.length !== 1 ? 's' : ''} providing tools`
                  : 'No MCP servers configured'}
              </div>
            </div>
          </div>

          {/* Configured MCP Servers */}
          {identity.defaultMcpServers.length > 0 ? (
            <div className="mt-4">
              <div className="text-sm text-gray-300 mb-2">Configured MCP Servers:</div>
              <div className="flex flex-wrap gap-2">
                {identity.defaultMcpServers.map((serverName, index) => {
                  const serverInfo = registeredServers.find(s => s.name === serverName);
                  return (
                    <div
                      key={index}
                      style={{
                        background: 'rgba(139, 92, 246, 0.2)',
                        border: '1px solid rgba(139, 92, 246, 0.4)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {serverInfo?.imageUrl && (
                        <img 
                          src={serverInfo.imageUrl} 
                          alt={serverName}
                          style={{ width: '20px', height: '20px', borderRadius: '4px' }}
                        />
                      )}
                      <span className="text-white font-medium">{serverInfo?.displayName || serverName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '1rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              color: '#fbbf24',
            }}>
              ⚠️ No MCP servers configured. Configure MCP servers in the MCP Servers tab to enable task execution.
            </div>
          )}

          {/* MCP Servers Used in Tasks */}
          {allToolsUsed.length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-gray-300 mb-2">MCP Servers Used in Tasks:</div>
              <div className="flex flex-wrap gap-2">
                {allToolsUsed.map((tool, index) => (
                  <span
                    key={index}
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.875rem',
                      color: '#10b981',
                    }}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agent Identity - Secondary */}
      {identity && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <h3 className="text-lg font-semibold text-white mb-4">Agent Identity</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">Name</div>
              <div className="text-white font-medium">{identity.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Agent ID</div>
              <div className="text-white font-mono text-sm">{identity.agentId}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-400 mb-1">Description</div>
              <div className="text-white">{identity.description}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Created</div>
              <div className="text-white">
                {(() => {
                  try {
                    if (!identity.createdAt || identity.createdAt === 0) return 'Invalid date';
                    // IC timestamps are in nanoseconds, convert to milliseconds for Date
                    const timestampMs = typeof identity.createdAt === 'bigint' 
                      ? Number(identity.createdAt) / 1_000_000 
                      : Number(identity.createdAt) / 1_000_000;
                    const date = new Date(timestampMs);
                    if (isNaN(date.getTime())) return 'Invalid date';
                    return date.toLocaleString();
                  } catch (e) {
                    return 'Invalid date';
                  }
                })()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Max Tokens</div>
              <div className="text-white">{typeof identity.maxTokens === 'bigint' ? Number(identity.maxTokens) : identity.maxTokens}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Temperature</div>
              <div className="text-white">{identity.temperature}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Confidence Threshold</div>
              <div className="text-white">{identity.confidenceThreshold}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Requires Approval</div>
              <div className="text-white">{identity.requireApproval ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">Total Tasks</div>
              <div className="text-2xl font-bold text-blue-400">
                {typeof metrics.totalTasks === 'bigint' ? Number(metrics.totalTasks) : metrics.totalTasks}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-green-400">
                {metrics.successRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Avg Response Time</div>
              <div className="text-2xl font-bold text-orange-400">
                {metrics.avgResponseTime.toFixed(2)}s
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">MCP Servers</div>
              <div className="text-2xl font-bold text-purple-400">
                {typeof metrics.mcpToolsConfigured === 'bigint' ? Number(metrics.mcpToolsConfigured) : metrics.mcpToolsConfigured}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Successful</div>
              <div className="text-xl font-semibold text-green-400">
                {typeof metrics.successfulTasks === 'bigint' ? Number(metrics.successfulTasks) : metrics.successfulTasks}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Failed</div>
              <div className="text-xl font-semibold text-red-400">
                {typeof metrics.failedTasks === 'bigint' ? Number(metrics.failedTasks) : metrics.failedTasks}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Pending Approvals</div>
              <div className="text-xl font-semibold text-yellow-400">
                {typeof metrics.pendingApprovals === 'bigint' ? Number(metrics.pendingApprovals) : metrics.pendingApprovals}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Active Errors</div>
              <div className="text-xl font-semibold text-red-400">
                {typeof metrics.activeErrors === 'bigint' ? Number(metrics.activeErrors) : metrics.activeErrors}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div style={{
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-lg font-semibold text-white">{triggers.length}</div>
          <div className="text-sm text-gray-400">Active Triggers</div>
        </div>
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-lg font-semibold text-white">{errors.filter(e => !e.resolved).length}</div>
          <div className="text-sm text-gray-400">Unresolved Errors</div>
        </div>
        <div style={{
          background: 'rgba(236, 72, 153, 0.1)',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div className="text-2xl mb-2">👤</div>
          <div className="text-lg font-semibold text-white">{approvals.filter(a => a.status === 'pending').length}</div>
          <div className="text-sm text-gray-400">Pending Approvals</div>
        </div>
      </div>
    </div>
  );
};

const AgentTasksTab: React.FC<{
  agent: DeployedAgent;
  tasks: Task[];
  onExecuteTask: (input: string, metadata: [string, string][]) => Promise<any>;
  showTaskForm: boolean;
  setShowTaskForm: (show: boolean) => void;
  taskInput: string;
  setTaskInput: (input: string) => void;
  isExecuting: boolean;
  setIsExecuting: (executing: boolean) => void;
  agentData?: {
    identity?: AgentIdentity;
  };
}> = ({ agent, tasks, onExecuteTask, showTaskForm, setShowTaskForm, taskInput, setTaskInput, isExecuting, setIsExecuting, agentData }) => {
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [executionProgress, setExecutionProgress] = useState<AgentOperationProgress | null>(null);
  const identity = agentData?.identity;

  // Sort tasks by createdAt (newest first)
  const sortedTasks = [...tasks].sort((a, b) => {
    const timeA = typeof a.createdAt === 'bigint' ? Number(a.createdAt) : a.createdAt || 0;
    const timeB = typeof b.createdAt === 'bigint' ? Number(b.createdAt) : b.createdAt || 0;
    return timeB - timeA; // Descending order (newest first)
  });

  const handleExecute = async () => {
    if (!taskInput.trim()) return;
    
    // Validate MCP configuration
    if (!identity?.mcpClientEndpoint || !identity.defaultMcpServers.length) {
      setExecutionResult('Error: MCP configuration required. Please configure MCP servers in the MCP Servers tab before executing tasks.');
      return;
    }

    if (!identity.claudeApiKey) {
      setExecutionResult('Error: Claude API key required. Please configure it in the agent settings.');
      return;
    }
    
    setIsExecuting(true);
    setExecutionResult(null);
    const startTime = Date.now();

    // Show progress overlay
    setExecutionProgress({
      phase: 'initializing',
      message: `Preparing to execute task with agent "${agent.name}"...`,
      timeMs: 0
    });

    // Update progress during execution
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setExecutionProgress(prev => prev ? {
        ...prev,
        timeMs: elapsed,
        message: prev.message || 'Processing agent task...'
      } : null);
    }, 100);
    
    try {
      const result = await onExecuteTask(taskInput, []);
      clearInterval(progressInterval);
      const totalTime = Date.now() - startTime;

      if ('ok' in result) {
        setExecutionProgress({
          phase: 'complete',
          message: 'Task executed successfully!',
          timeMs: totalTime
        });
        setTimeout(() => {
          setExecutionProgress(null);
        }, 1500);
        setExecutionResult(result.ok);
        setTaskInput('');
        setShowTaskForm(false);
      } else {
        setExecutionProgress({
          phase: 'error',
          message: `Task execution failed: ${result.err}`,
          timeMs: totalTime
        });
        setTimeout(() => {
          setExecutionProgress(null);
        }, 3000);
        setExecutionResult(`Error: ${result.err}`);
      }
    } catch (error) {
      clearInterval(progressInterval);
      const totalTime = Date.now() - startTime;
      setExecutionProgress({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timeMs: totalTime
      });
      setTimeout(() => {
        setExecutionProgress(null);
      }, 3000);
      setExecutionResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const isMcpConfigured = identity?.mcpClientEndpoint && identity.defaultMcpServers.length > 0;
  const hasClaudeKey = identity?.claudeApiKey && identity.claudeApiKey.trim() !== '';

  return (
    <>
      {/* Agent Task Execution Progress Overlay */}
      <AgentOperationProgressOverlay
        progress={executionProgress}
        title="Executing Agent Task"
        icon="🤖"
        color="#10b981"
      />
      
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Task Execution History</h3>
        <button
          onClick={() => setShowTaskForm(!showTaskForm)}
          style={{
            background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            color: '#ffffff',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showTaskForm ? '✕ Cancel' : '+ Execute New Task'}
        </button>
      </div>

      {showTaskForm && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <h4 className="text-md font-semibold text-white mb-3">Execute Task with MCP Servers</h4>
          
          {/* MCP Configuration Status */}
          {!isMcpConfigured && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              color: '#fbbf24',
            }}>
              ⚠️ <strong>MCP Configuration Required:</strong> Configure MCP servers in the MCP Servers tab before executing tasks.
            </div>
          )}

          {!hasClaudeKey && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              color: '#fbbf24',
            }}>
              ⚠️ <strong>Claude API Key Required:</strong> Configure your Claude API key in the agent settings.
            </div>
          )}

          {/* Configured MCP Servers */}
          {isMcpConfigured && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
            }}>
              <div className="text-sm font-semibold text-white mb-2">
                🔧 Configured MCP Servers
              </div>
              <div className="text-xs text-gray-400">
                {identity?.defaultMcpServers.length > 0 
                  ? identity.defaultMcpServers.join(', ')
                  : 'None configured'}
              </div>
            </div>
          )}

          <textarea
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder={isMcpConfigured 
              ? "Describe the task you want to accomplish. The agent will use MCP servers to complete it..."
              : "Enter task input... (MCP configuration required)"}
            style={{
              width: '100%',
              minHeight: '120px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '1rem',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          {executionResult && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: executionResult.startsWith('Error') 
                ? 'rgba(239, 68, 68, 0.1)' 
                : 'rgba(16, 185, 129, 0.1)',
              border: `1px solid ${executionResult.startsWith('Error') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              borderRadius: '8px',
              color: executionResult.startsWith('Error') ? '#ef4444' : '#10b981',
            }}>
              {executionResult}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleExecute}
              disabled={!taskInput.trim() || isExecuting || !isMcpConfigured || !hasClaudeKey}
              style={{
                background: (!taskInput.trim() || isExecuting || !isMcpConfigured || !hasClaudeKey)
                  ? 'rgba(107, 114, 128, 0.2)'
                  : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: (!taskInput.trim() || isExecuting || !isMcpConfigured || !hasClaudeKey) ? 'not-allowed' : 'pointer',
                opacity: (!taskInput.trim() || isExecuting || !isMcpConfigured || !hasClaudeKey) ? 0.5 : 1,
              }}
            >
              {isExecuting ? '⏳ Executing with MCP Servers...' : '▶️ Execute Task with MCP Servers'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sortedTasks.length === 0 ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '3rem',
            textAlign: 'center',
          }}>
            <div className="text-4xl mb-4">📋</div>
            <div className="text-gray-400">No tasks executed yet</div>
          </div>
        ) : (
          sortedTasks.map((task) => (
            <div
              key={task.id}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-mono text-gray-400">{task.id}</span>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: task.status === 'completed' 
                        ? 'rgba(16, 185, 129, 0.2)' 
                        : task.status === 'failed'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(245, 158, 11, 0.2)',
                      color: task.status === 'completed'
                        ? '#10b981'
                        : task.status === 'failed'
                        ? '#ef4444'
                        : '#f59e0b',
                    }}>
                      {task.status}
                    </span>
                  </div>
                  <div className="text-white mb-2">{task.input}</div>
                  <div className="text-sm text-gray-400 mb-2">
                    {(() => {
                      try {
                        if (!task.createdAt || task.createdAt === 0) return 'Invalid date';
                        // IC timestamps are in nanoseconds, convert to milliseconds for Date
                        const timestampMs = typeof task.createdAt === 'bigint' 
                          ? Number(task.createdAt) / 1_000_000 
                          : Number(task.createdAt) / 1_000_000;
                        const date = new Date(timestampMs);
                        if (isNaN(date.getTime())) return 'Invalid date';
                        return date.toLocaleString();
                      } catch (e) {
                        return 'Invalid date';
                      }
                    })()} • 
                    Trigger: {task.triggerType} • 
                    Response: {task.responseTime.toFixed(2)}s
                  </div>
                  {/* MCP Servers Used - PROMINENT */}
                  {task.mcpToolsUsed && task.mcpToolsUsed.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-400 mb-1">🔧 MCP Servers Used:</div>
                      <div className="flex flex-wrap gap-1">
                        {task.mcpToolsUsed.map((tool, toolIndex) => (
                          <span
                            key={toolIndex}
                            style={{
                              background: 'rgba(139, 92, 246, 0.2)',
                              border: '1px solid rgba(139, 92, 246, 0.4)',
                              borderRadius: '6px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              color: '#a78bfa',
                            }}
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {task.result && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}>
                  <div className="text-sm text-gray-400 mb-1">Result:</div>
                  <div className="text-white whitespace-pre-wrap">{task.result}</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
    </>
  );
};

const AgentTriggersTab: React.FC<{
  triggers: TriggerConfig[];
  onToggleTrigger: (triggerId: string) => Promise<any>;
  onExecuteTrigger: (triggerId: string) => Promise<any>;
  onDeleteTrigger: (triggerId: string) => Promise<any>;
  onUpdateTrigger: (triggerId: string, name?: string, description?: string, enabled?: boolean, inputTemplate?: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
  onCreateScheduledTrigger: (name: string, description: string, schedule: ScheduleType, inputTemplate: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
  onCreateConditionTrigger: (name: string, description: string, condition: ConditionType, inputTemplate: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
  onCreateWebhookTrigger: (name: string, description: string, source: string, signature: string | undefined, inputTemplate: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
  showTriggerForm: boolean;
  setShowTriggerForm: (show: boolean) => void;
  triggerFormType: 'scheduled' | 'condition' | 'webhook' | null;
  setTriggerFormType: (type: 'scheduled' | 'condition' | 'webhook' | null) => void;
  selectedTrigger: TriggerConfig | null;
  setSelectedTrigger: (trigger: TriggerConfig | null) => void;
}> = ({ triggers, onToggleTrigger, onExecuteTrigger, onDeleteTrigger, onUpdateTrigger, onCreateScheduledTrigger, onCreateConditionTrigger, onCreateWebhookTrigger, showTriggerForm, setShowTriggerForm, triggerFormType, setTriggerFormType, selectedTrigger, setSelectedTrigger }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleToggle = async (triggerId: string) => {
    setIsProcessing(true);
    try {
      await onToggleTrigger(triggerId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (triggerId: string) => {
    if (!confirm('Are you sure you want to delete this trigger?')) return;
    setIsProcessing(true);
    try {
      await onDeleteTrigger(triggerId);
    } finally {
      setIsProcessing(false);
    }
  };

  const getTriggerTypeLabel = (triggerType: TriggerType): string => {
    if ('scheduled' in triggerType) return 'Scheduled';
    if ('webhook' in triggerType) return 'Webhook';
    if ('condition' in triggerType) return 'Condition';
    if ('manual' in triggerType) return 'Manual';
    if ('event' in triggerType) return 'Event';
    if ('agent' in triggerType) return 'Agent';
    if ('api' in triggerType) return 'API';
    return 'Unknown';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Automated Triggers ({triggers.length})</h3>
          <p className="text-sm text-gray-400 mt-1">
            Configure triggers to automatically execute tasks using MCP tools
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setTriggerFormType('scheduled');
              setShowTriggerForm(true);
            }}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid #3B82F6',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              color: '#3B82F6',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Scheduled
          </button>
          <button
            onClick={() => {
              setTriggerFormType('condition');
              setShowTriggerForm(true);
            }}
            style={{
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid #8B5CF6',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              color: '#8B5CF6',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Condition
          </button>
          <button
            onClick={() => {
              setTriggerFormType('webhook');
              setShowTriggerForm(true);
            }}
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid #10B981',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              color: '#10B981',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Webhook
          </button>
        </div>
      </div>

      {/* MCP Integration Notice */}
      <div style={{
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '8px',
        padding: '1rem',
      }}>
        <div className="flex items-start gap-2">
          <span className="text-lg">🔧</span>
          <div>
            <div className="text-sm font-semibold text-white mb-1">
              All triggers execute tasks using MCP tools
            </div>
            <div className="text-xs text-gray-400">
              When a trigger fires (scheduled, condition, or webhook), it automatically executes a task that uses your configured MCP servers and tools from <code className="text-purple-400">ai.coinnation.io/api/mcp</code>
            </div>
          </div>
        </div>
      </div>

      {showTriggerForm && triggerFormType && (
        <TriggerCreationForm
          type={triggerFormType}
          onCreateScheduledTrigger={onCreateScheduledTrigger}
          onCreateConditionTrigger={onCreateConditionTrigger}
          onCreateWebhookTrigger={onCreateWebhookTrigger}
          onClose={() => {
            setShowTriggerForm(false);
            setTriggerFormType(null);
          }}
        />
      )}

      <div className="space-y-3">
        {triggers.length === 0 ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '3rem',
            textAlign: 'center',
          }}>
            <div className="text-4xl mb-4">⚡</div>
            <div className="text-gray-400">No triggers configured</div>
          </div>
        ) : (
          triggers.map((trigger) => (
            <div
              key={trigger.id}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-md font-semibold text-white">{trigger.name}</h4>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: trigger.enabled 
                        ? 'rgba(16, 185, 129, 0.2)' 
                        : 'rgba(107, 114, 128, 0.2)',
                      color: trigger.enabled ? '#10b981' : '#9ca3af',
                    }}>
                      {trigger.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#8B5CF6',
                    }}>
                      {getTriggerTypeLabel(trigger.triggerType)}
                    </span>
                  </div>
                  <div className="text-gray-400 text-sm mb-2">{trigger.description}</div>
                  <div className="text-xs text-gray-500">
                    Created: {(() => {
                      try {
                        if (!trigger.createdAt || trigger.createdAt === 0) return 'Invalid date';
                        const timestampMs = typeof trigger.createdAt === 'bigint' 
                          ? Number(trigger.createdAt) / 1_000_000 
                          : Number(trigger.createdAt) / 1_000_000;
                        const date = new Date(timestampMs);
                        if (isNaN(date.getTime())) return 'Invalid date';
                        return date.toLocaleString();
                      } catch (e) {
                        return 'Invalid date';
                      }
                    })()} • 
                    Executed: {trigger.triggerCount} times
                    {trigger.lastTriggered && ` • Last: ${(() => {
                      try {
                        if (!trigger.lastTriggered || trigger.lastTriggered === 0) return 'Invalid date';
                        const timestampMs = typeof trigger.lastTriggered === 'bigint' 
                          ? Number(trigger.lastTriggered) / 1_000_000 
                          : Number(trigger.lastTriggered) / 1_000_000;
                        const date = new Date(timestampMs);
                        if (isNaN(date.getTime())) return 'Invalid date';
                        return date.toLocaleString();
                      } catch (e) {
                        return 'Invalid date';
                      }
                    })()}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onExecuteTrigger(trigger.id)}
                    disabled={isProcessing || !trigger.enabled}
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid #10B981',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      color: '#10B981',
                      cursor: (isProcessing || !trigger.enabled) ? 'not-allowed' : 'pointer',
                      opacity: (isProcessing || !trigger.enabled) ? 0.5 : 1,
                    }}
                    title="Execute trigger"
                  >
                    ▶️
                  </button>
                  <button
                    onClick={() => handleToggle(trigger.id)}
                    disabled={isProcessing}
                    style={{
                      background: trigger.enabled 
                        ? 'rgba(245, 158, 11, 0.2)' 
                        : 'rgba(16, 185, 129, 0.2)',
                      border: `1px solid ${trigger.enabled ? '#f59e0b' : '#10B981'}`,
                      borderRadius: '6px',
                      padding: '0.5rem',
                      color: trigger.enabled ? '#f59e0b' : '#10B981',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      opacity: isProcessing ? 0.5 : 1,
                    }}
                    title={trigger.enabled ? 'Disable' : 'Enable'}
                  >
                    {trigger.enabled ? '⏸️' : '▶️'}
                  </button>
                  <button
                    onClick={() => handleDelete(trigger.id)}
                    disabled={isProcessing}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      color: '#ef4444',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      opacity: isProcessing ? 0.5 : 1,
                    }}
                    title="Delete trigger"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AgentApprovalsTab: React.FC<{
  approvals: Approval[];
  onProcessApproval: (approvalId: string, approved: boolean) => Promise<any>;
}> = ({ approvals, onProcessApproval }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApproval = async (approvalId: string, approved: boolean) => {
    setIsProcessing(true);
    try {
      await onProcessApproval(approvalId, approved);
    } finally {
      setIsProcessing(false);
    }
  };

  // Sort approvals by timestamp (newest first)
  const sortByTimestamp = (a: Approval, b: Approval) => {
    const timeA = typeof a.timestamp === 'bigint' ? Number(a.timestamp) : a.timestamp || 0;
    const timeB = typeof b.timestamp === 'bigint' ? Number(b.timestamp) : b.timestamp || 0;
    return timeB - timeA; // Descending order (newest first)
  };

  const pendingApprovals = approvals.filter(a => a.status === 'pending').sort(sortByTimestamp);
  const processedApprovals = approvals.filter(a => a.status !== 'pending').sort(sortByTimestamp);

  return (
    <div className="space-y-6">
      {pendingApprovals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Pending Approvals ({pendingApprovals.length})</h3>
          <div className="space-y-3">
            {pendingApprovals.map((approval) => (
              <div
                key={approval.id}
                style={{
                  background: 'rgba(236, 72, 153, 0.1)',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-sm font-mono text-gray-400 mb-2">{approval.id}</div>
                    <div className="text-white font-semibold mb-2">{approval.action}</div>
                    <div className="text-gray-300 mb-2">{approval.reasoning}</div>
                    <div className="text-sm text-gray-400">
                      Task: {approval.taskId} • 
                      Confidence: {(approval.confidence * 100).toFixed(1)}% • 
                      {(() => {
                        try {
                          if (!approval.timestamp || approval.timestamp === 0) return 'Invalid date';
                          const timestampMs = typeof approval.timestamp === 'bigint' 
                            ? Number(approval.timestamp) / 1_000_000 
                            : Number(approval.timestamp) / 1_000_000;
                          const date = new Date(timestampMs);
                          if (isNaN(date.getTime())) return 'Invalid date';
                          return date.toLocaleString();
                        } catch (e) {
                          return 'Invalid date';
                        }
                      })()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproval(approval.id, true)}
                      disabled={isProcessing}
                      style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid #10B981',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        color: '#10B981',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        opacity: isProcessing ? 0.5 : 1,
                      }}
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => handleApproval(approval.id, false)}
                      disabled={isProcessing}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid #ef4444',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        color: '#ef4444',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        opacity: isProcessing ? 0.5 : 1,
                      }}
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {processedApprovals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Approval History ({processedApprovals.length})</h3>
          <div className="space-y-3">
            {processedApprovals.map((approval) => (
              <div
                key={approval.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-semibold">{approval.action}</span>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: approval.status === 'approved'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                        color: approval.status === 'approved' ? '#10b981' : '#ef4444',
                      }}>
                        {approval.status}
                      </span>
                    </div>
                    <div className="text-gray-300 text-sm mb-1">{approval.reasoning}</div>
                    <div className="text-xs text-gray-500">
                      {(() => {
                        try {
                          if (!approval.timestamp || approval.timestamp === 0) return 'Invalid date';
                          const timestampMs = typeof approval.timestamp === 'bigint' 
                            ? Number(approval.timestamp) / 1_000_000 
                            : Number(approval.timestamp) / 1_000_000;
                          const date = new Date(timestampMs);
                          if (isNaN(date.getTime())) return 'Invalid date';
                          return date.toLocaleString();
                        } catch (e) {
                          return 'Invalid date';
                        }
                      })()}
                      {approval.approvedAt && ` • Processed: ${(() => {
                        try {
                          if (!approval.approvedAt || approval.approvedAt === 0) return 'Invalid date';
                          const timestampMs = typeof approval.approvedAt === 'bigint' 
                            ? Number(approval.approvedAt) / 1_000_000 
                            : Number(approval.approvedAt) / 1_000_000;
                          const date = new Date(timestampMs);
                          if (isNaN(date.getTime())) return 'Invalid date';
                          return date.toLocaleString();
                        } catch (e) {
                          return 'Invalid date';
                        }
                      })()}`}
                      {approval.approvedBy && ` • By: ${approval.approvedBy}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvals.length === 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <div className="text-4xl mb-4">👤</div>
          <div className="text-gray-400">No approvals</div>
        </div>
      )}
    </div>
  );
};

const AgentActivityTab: React.FC<{
  activity: ActivityEvent[];
}> = ({ activity }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3B82F6';
      default: return '#9ca3af';
    }
  };

  // Sort activity by timestamp (newest first)
  const sortedActivity = [...activity].sort((a, b) => {
    const timeA = typeof a.timestamp === 'bigint' ? Number(a.timestamp) : a.timestamp || 0;
    const timeB = typeof b.timestamp === 'bigint' ? Number(b.timestamp) : b.timestamp || 0;
    return timeB - timeA; // Descending order (newest first)
  });

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-white">Activity Log ({sortedActivity.length})</h3>
      {sortedActivity.length === 0 ? (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <div className="text-4xl mb-4">📈</div>
          <div className="text-gray-400">No activity recorded</div>
        </div>
      ) : (
        sortedActivity.map((event) => (
          <div
            key={event.id}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.5rem',
            }}
          >
            <div className="flex items-start gap-3">
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getSeverityColor(event.severity),
                marginTop: '6px',
                flexShrink: 0,
              }} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold">{event.eventType}</span>
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    background: `${getSeverityColor(event.severity)}20`,
                    color: getSeverityColor(event.severity),
                  }}>
                    {event.severity}
                  </span>
                </div>
                <div className="text-gray-300 text-sm mb-2">{event.details}</div>
                <div className="text-xs text-gray-500">
                  {(() => {
                    try {
                      if (!event.timestamp || event.timestamp === 0) return 'Invalid date';
                      // IC timestamps are in nanoseconds, convert to milliseconds for Date
                      const timestampMs = Number(event.timestamp) / 1_000_000;
                      const date = new Date(timestampMs);
                      if (isNaN(date.getTime())) return 'Invalid date';
                      return date.toLocaleString();
                    } catch (e) {
                      return 'Invalid date';
                    }
                  })()}
                  {event.taskId && ` • Task: ${event.taskId}`}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const AgentErrorsTab: React.FC<{
  errors: ErrorLog[];
}> = ({ errors }) => {
  // Sort errors by timestamp (newest first)
  const sortByTimestamp = (a: ErrorLog, b: ErrorLog) => {
    const timeA = typeof a.timestamp === 'bigint' ? Number(a.timestamp) : a.timestamp || 0;
    const timeB = typeof b.timestamp === 'bigint' ? Number(b.timestamp) : b.timestamp || 0;
    return timeB - timeA; // Descending order (newest first)
  };

  const unresolvedErrors = errors.filter(e => !e.resolved).sort(sortByTimestamp);
  const resolvedErrors = errors.filter(e => e.resolved).sort(sortByTimestamp);

  return (
    <div className="space-y-6">
      {unresolvedErrors.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-red-400 mb-4">Unresolved Errors ({unresolvedErrors.length})</h3>
          <div className="space-y-3">
            {unresolvedErrors.map((error) => (
              <div
                key={error.id}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-400 font-semibold">{error.errorType}</span>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                      }}>
                        Unresolved
                      </span>
                    </div>
                    <div className="text-white mb-2">{error.errorMessage}</div>
                    <div className="text-gray-300 text-sm mb-2">{error.context}</div>
                    {error.stackTrace && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-400 cursor-pointer">Stack Trace</summary>
                        <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap" style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          padding: '1rem',
                          borderRadius: '8px',
                          overflow: 'auto',
                        }}>
                          {error.stackTrace}
                        </pre>
                      </details>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      {(() => {
                        try {
                          if (!error.timestamp || error.timestamp === 0) return 'Invalid date';
                          // IC timestamps are in nanoseconds, convert to milliseconds for Date
                          const timestampMs = typeof error.timestamp === 'bigint' 
                            ? Number(error.timestamp) / 1_000_000 
                            : Number(error.timestamp) / 1_000_000;
                          const date = new Date(timestampMs);
                          if (isNaN(date.getTime())) return 'Invalid date';
                          return date.toLocaleString();
                        } catch (e) {
                          return 'Invalid date';
                        }
                      })()}
                      {error.taskId && ` • Task: ${error.taskId}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolvedErrors.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-400 mb-4">Resolved Errors ({resolvedErrors.length})</h3>
          <div className="space-y-3">
            {resolvedErrors.map((error) => (
              <div
                key={error.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  opacity: 0.7,
                }}
              >
                <div className="text-gray-400 font-semibold mb-1">{error.errorType}</div>
                <div className="text-gray-500 text-sm">{error.errorMessage}</div>
                <div className="text-xs text-gray-600 mt-2">
                  {(() => {
                    try {
                      if (!error.timestamp || error.timestamp === 0) return 'Invalid date';
                      // IC timestamps are in nanoseconds, convert to milliseconds for Date
                      const timestampMs = typeof error.timestamp === 'bigint' 
                        ? Number(error.timestamp) / 1_000_000 
                        : Number(error.timestamp) / 1_000_000;
                      const date = new Date(timestampMs);
                      if (isNaN(date.getTime())) return 'Invalid date';
                      return date.toLocaleString();
                    } catch (e) {
                      return 'Invalid date';
                    }
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length === 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <div className="text-4xl mb-4">✅</div>
          <div className="text-gray-400">No errors</div>
        </div>
      )}
    </div>
  );
};

// Debug state interface for MCP tab
interface MCPTabDebugState {
  mcpTokens: [string, string][];
  mcpTokensRef: [string, string][]; // Now just mirrors mcpTokens (no separate ref)
  tokenIds: number[];
  nextTokenId: number;
  newTokenKey: string;
  newTokenValue: string;
  isSaving: boolean;
  showMCPConfig: boolean;
  lastSaveAttempt?: {
    timestamp: number;
    tokensSent: [string, string][];
    tokensInState: number;
    tokensInRef: number;
  };
}

const AgentDebugTab: React.FC<{
  agent: DeployedAgent;
  agentData?: {
    identity?: AgentIdentity;
    metrics?: AgentMetrics;
    tasks?: Task[];
    triggers?: TriggerConfig[];
    approvals?: Approval[];
    errors?: ErrorLog[];
    activity?: ActivityEvent[];
  };
  mcpTabDebugState: MCPTabDebugState | null;
}> = ({ agent, agentData, mcpTabDebugState }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  // Force re-render to get latest debug state
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  const renderJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  };

  return (
    <div className="space-y-6" style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">🐛 Debug Information</h3>
        <button
          onClick={() => setRefreshKey(prev => prev + 1)}
          style={{
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid #3B82F6',
            borderRadius: '6px',
            padding: '0.5rem 1rem',
            color: '#3B82F6',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* MCP Tokens Debug Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <h4 className="text-md font-semibold text-white mb-4">🔑 MCP Tokens Debug</h4>
        
        {mcpTabDebugState ? (
          <div className="space-y-4">
            {/* Current State */}
            <div>
              <div className="text-sm font-semibold text-yellow-400 mb-2">Current State (mcpTokens):</div>
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '1rem',
                borderRadius: '8px',
                color: '#10b981',
                overflowX: 'auto',
              }}>
                <div className="mb-2">Count: {mcpTabDebugState.mcpTokens.length}</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {renderJson(mcpTabDebugState.mcpTokens)}
                </pre>
              </div>
            </div>

            {/* Ref State */}
            <div>
              <div className="text-sm font-semibold text-blue-400 mb-2">Ref State (mcpTokensRef.current):</div>
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '1rem',
                borderRadius: '8px',
                color: '#3B82F6',
                overflowX: 'auto',
              }}>
                <div className="mb-2">Count: {mcpTabDebugState.mcpTokensRef.length}</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {renderJson(mcpTabDebugState.mcpTokensRef)}
                </pre>
              </div>
            </div>

            {/* Token IDs */}
            <div>
              <div className="text-sm font-semibold text-purple-400 mb-2">Token IDs:</div>
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '1rem',
                borderRadius: '8px',
                color: '#a855f7',
              }}>
                {renderJson(mcpTabDebugState.tokenIds)}
              </div>
            </div>

            {/* New Token Inputs */}
            <div>
              <div className="text-sm font-semibold text-cyan-400 mb-2">New Token Inputs:</div>
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '1rem',
                borderRadius: '8px',
                color: '#06b6d4',
              }}>
                Key: "{mcpTabDebugState.newTokenKey}" | Value: "{mcpTabDebugState.newTokenValue ? '***' + mcpTabDebugState.newTokenValue.slice(-4) : ''}"
              </div>
            </div>

            {/* Last Save Attempt */}
            {mcpTabDebugState.lastSaveAttempt && (
              <div>
                <div className="text-sm font-semibold text-orange-400 mb-2">Last Save Attempt:</div>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '1rem',
                  borderRadius: '8px',
                  color: '#f97316',
                }}>
                  <div>Timestamp: {new Date(mcpTabDebugState.lastSaveAttempt.timestamp).toLocaleString()}</div>
                  <div>Tokens in State: {mcpTabDebugState.lastSaveAttempt.tokensInState}</div>
                  <div>Tokens in Ref: {mcpTabDebugState.lastSaveAttempt.tokensInRef}</div>
                  <div className="mt-2">Tokens Sent ({mcpTabDebugState.lastSaveAttempt.tokensSent.length}):</div>
                  <pre style={{ margin: '0.5rem 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {renderJson(mcpTabDebugState.lastSaveAttempt.tokensSent.map(([k]) => k))}
                  </pre>
                </div>
              </div>
            )}

            {/* Status */}
            <div>
              <div className="text-sm font-semibold text-gray-400 mb-2">Status:</div>
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '1rem',
                borderRadius: '8px',
                color: '#9ca3af',
              }}>
                <div>Is Saving: {mcpTabDebugState.isSaving ? '✅ Yes' : '❌ No'}</div>
                <div>Show MCP Config: {mcpTabDebugState.showMCPConfig ? '✅ Yes' : '❌ No'}</div>
                <div>Next Token ID: {mcpTabDebugState.nextTokenId}</div>
              </div>
            </div>

            {/* Comparison */}
            <div>
              <div className="text-sm font-semibold text-red-400 mb-2">⚠️ State vs Ref Comparison:</div>
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '1rem',
                borderRadius: '8px',
                color: '#ef4444',
              }}>
                {mcpTabDebugState.mcpTokens.length === mcpTabDebugState.mcpTokensRef.length ? (
                  <div>✅ State and Ref have same count: {mcpTabDebugState.mcpTokens.length}</div>
                ) : (
                  <div>
                    ❌ MISMATCH! State: {mcpTabDebugState.mcpTokens.length}, Ref: {mcpTabDebugState.mcpTokensRef.length}
                  </div>
                )}
                {mcpTabDebugState.mcpTokens.length !== mcpTabDebugState.mcpTokensRef.length && (
                  <div className="mt-2 text-xs">
                    This indicates a stale closure issue - the state and ref are out of sync!
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(107, 114, 128, 0.1)',
            padding: '2rem',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#9ca3af',
          }}>
            No MCP tab debug state available. Open the MCP Servers tab first.
          </div>
        )}
      </div>

      {/* Backend Identity Tokens */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <h4 className="text-md font-semibold text-white mb-4">💾 Backend Identity (from canister):</h4>
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '1rem',
          borderRadius: '8px',
          color: '#10b981',
          overflowX: 'auto',
        }}>
          <div className="mb-2">Count: {agentData?.identity?.mcpTokens?.length || 0}</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {renderJson(agentData?.identity?.mcpTokens || [])}
          </pre>
        </div>
      </div>

      {/* Full Agent Identity */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <h4 className="text-md font-semibold text-white mb-4">📋 Full Agent Identity:</h4>
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '1rem',
          borderRadius: '8px',
          color: '#9ca3af',
          overflowX: 'auto',
          maxHeight: '400px',
          overflowY: 'auto',
        }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {renderJson({
              ...agentData?.identity,
              mcpTokens: agentData?.identity?.mcpTokens || []
            })}
          </pre>
        </div>
      </div>
    </div>
  );
};

const AgentMCPTab: React.FC<{
  agent: DeployedAgent;
  agentData?: {
    identity?: AgentIdentity;
    metrics?: AgentMetrics;
    tasks?: Task[];
  };
  backendCanisterId: string;
  identity: any;
  onRefresh: () => void;
  debugStateRef?: React.MutableRefObject<MCPTabDebugState | null>;
}> = ({ agent, agentData, backendCanisterId, identity, onRefresh, debugStateRef }) => {
  const [showMCPConfig, setShowMCPConfig] = useState(false);
  const [mcpClientEndpoint, setMcpClientEndpoint] = useState('');
  const [mcpServers, setMcpServers] = useState<string[]>([]);
  const [mcpTokens, setMcpTokens] = useState<[string, string][]>([]);
  // CRITICAL FIX: Use ref to always have latest tokens for save operation
  const mcpTokensRef = useRef<[string, string][]>([]);
  const [tokenIds, setTokenIds] = useState<number[]>([]); // Track stable IDs for tokens
  const [nextTokenId, setNextTokenId] = useState(0);
  const [newServer, setNewServer] = useState('');
  const [newTokenKey, setNewTokenKey] = useState('');
  const [newTokenValue, setNewTokenValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // CRITICAL FIX: Keep ref in sync with state to ensure save always has latest tokens
  useEffect(() => {
    mcpTokensRef.current = mcpTokens;
    console.log('🔄 [useEffect] mcpTokensRef updated:', {
      count: mcpTokens.length,
      keys: mcpTokens.map(([k]) => k)
    });
  }, [mcpTokens]);
  const [claudeApiKey, setClaudeApiKey] = useState(''); // Claude API key
  const [registeredServers, setRegisteredServers] = useState<any[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);

  // CRITICAL FIX: Keep ref in sync with state to ensure save always has latest tokens
  useEffect(() => {
    mcpTokensRef.current = mcpTokens;
    console.log('🔄 [useEffect] mcpTokensRef updated:', {
      count: mcpTokens.length,
      keys: mcpTokens.map(([k]) => k)
    });
  }, [mcpTokens]);

  // Update debug state whenever relevant state changes
  useEffect(() => {
    if (debugStateRef) {
      debugStateRef.current = {
        mcpTokens,
        mcpTokensRef: mcpTokensRef.current, // Use ref value
        tokenIds,
        nextTokenId,
        newTokenKey,
        newTokenValue,
        isSaving,
        showMCPConfig,
        // Preserve lastSaveAttempt if it exists
        lastSaveAttempt: debugStateRef.current?.lastSaveAttempt,
      };
    }
  }, [mcpTokens, tokenIds, nextTokenId, newTokenKey, newTokenValue, isSaving, showMCPConfig]);

  // Load MCP config from agent identity
  // SIMPLE FIX: Only load from canister when form is CLOSED - when form is open, user is editing, don't reset
  useEffect(() => {
    console.log('🔄 [useEffect] MCP config loader triggered:', {
      showMCPConfig,
      hasIdentity: !!agentData?.identity,
      tokensFromBackend: agentData?.identity?.mcpTokens?.length || 0,
      currentStateCount: mcpTokens.length
    });
    
    // If form is open, user is editing - don't reset their work
    if (showMCPConfig) {
      console.log('⏸️ [useEffect] Form is open, skipping token load');
      return;
    }
    
    // Form is closed - safe to load from canister
    if (agentData?.identity) {
      const identity = agentData.identity;
      const tokens = [...identity.mcpTokens];
      
      console.log('🔄 [useEffect] Loading tokens from canister:', {
        tokensFromBackend: tokens.length,
        currentStateCount: mcpTokens.length,
        willReset: tokens.length !== mcpTokens.length || 
          !tokens.every(([key], idx) => mcpTokens[idx] && mcpTokens[idx][0] === key),
        backendTokens: JSON.stringify(tokens),
        currentState: JSON.stringify(mcpTokens)
      });
      
      setMcpClientEndpoint(identity.mcpClientEndpoint || 'https://ai.coinnation.io/api/mcp');
      setMcpServers([...identity.defaultMcpServers]);
      setMcpTokens(tokens);
      // Initialize Claude API key - load it directly (will be hidden in password input)
      setClaudeApiKey(identity.claudeApiKey || '');
      // Generate stable IDs for existing tokens
      const newTokenIds = tokens.map((_, i) => i);
      setTokenIds(newTokenIds);
      setNextTokenId(tokens.length);
      
      console.log('✅ [useEffect] Tokens loaded from canister');
    } else {
      // Set default if no identity yet
      setMcpClientEndpoint('https://ai.coinnation.io/api/mcp');
      setMcpTokens([]);
      setTokenIds([]);
      setNextTokenId(0);
      setClaudeApiKey('');
    }
  }, [agentData?.identity, showMCPConfig]);

  // Load registered MCP servers from endpoint
  const loadRegisteredServers = async () => {
    if (!mcpClientEndpoint) return;
    
    setIsLoadingServers(true);
    try {
      const response = await fetch(`${mcpClientEndpoint}/mcp-servers`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        setRegisteredServers(data.servers || []);
      }
    } catch (error) {
      console.warn('Failed to load registered MCP servers:', error);
      setRegisteredServers([]);
    } finally {
      setIsLoadingServers(false);
    }
  };

  // Auto-load servers when endpoint is available
  useEffect(() => {
    if (mcpClientEndpoint) {
      loadRegisteredServers();
    }
  }, [mcpClientEndpoint]);


  const handleSaveMCPConfig = async () => {
    if (!agentData?.identity) {
      alert('Agent not initialized');
      return;
    }

    setIsSaving(true);
    try {
      // CRITICAL FIX: Use ref to get the absolute latest tokens, avoiding stale closure issues
      // This ensures the last token added is always included in the save operation
      const latestTokens = mcpTokensRef.current;
      
      // CRITICAL FIX: Check if user has partially entered a new token (typed but didn't click +)
      // If so, include it in the save operation
      const trimmedNewKey = newTokenKey.trim();
      const trimmedNewValue = newTokenValue.trim();
      const hasPartialToken = trimmedNewKey !== '' && trimmedNewValue !== '';
      
      if (hasPartialToken) {
        console.log('🔍 [handleSaveMCPConfig] Found partially entered token, including it in save:', {
          key: trimmedNewKey,
          valueLength: trimmedNewValue.length
        });
      }
      
      // Build complete token list: existing tokens + any partially entered token
      const allTokens = hasPartialToken 
        ? [...latestTokens, [trimmedNewKey, trimmedNewValue] as [string, string]]
        : latestTokens;
      
      // DEBUG: Log the raw state before any processing
      console.log('🔍 [handleSaveMCPConfig] RAW tokens (existing + partial):', {
        existingCount: latestTokens.length,
        hasPartialToken,
        totalCount: allTokens.length,
        raw: JSON.stringify(allTokens),
        tokens: allTokens.map(([k, v], idx) => ({
          index: idx,
          key: k,
          keyLength: k.length,
          keyTrimmed: k.trim(),
          valueLength: v.length,
          valueTrimmed: v.trim(),
          isEmpty: k.trim() === '' || v.trim() === '',
          isPartial: idx === allTokens.length - 1 && hasPartialToken
        }))
      });
      
      // Filter valid tokens from the complete list
      const validTokens = allTokens.filter(([k, v]) => {
        const isValid = k.trim() !== '' && v.trim() !== '';
        if (!isValid) {
          console.warn('⚠️ [handleSaveMCPConfig] Filtering out invalid token:', { key: k, valueLength: v.length });
        }
        return isValid;
      });
      
      console.log('💾 [handleSaveMCPConfig] AFTER filtering - validTokens:', {
        count: validTokens.length,
        keys: validTokens.map(([k]) => k),
        full: JSON.stringify(validTokens)
      });
      
      // Update debug state with save attempt info
      if (debugStateRef && debugStateRef.current) {
        debugStateRef.current.lastSaveAttempt = {
          timestamp: Date.now(),
          tokensSent: validTokens,
          tokensInState: latestTokens.length,
          tokensInRef: latestTokens.length,
        };
        debugStateRef.current.isSaving = true;
        // Log if we included a partial token
        if (hasPartialToken) {
          console.log('📝 [handleSaveMCPConfig] Included partial token in save:', {
            key: trimmedNewKey,
            wasInState: false
          });
        }
      }
      
      const updatedConfig: AgentConfig = {
        name: agentData.identity.name,
        description: agentData.identity.description,
        instructions: agentData.identity.instructions,
        mcpClientEndpoint: mcpClientEndpoint,
        // Use the Claude API key from state
        claudeApiKey: claudeApiKey.trim(),
        defaultMcpServers: mcpServers.filter(s => s.trim() !== ''),
        mcpTokens: validTokens,
        requireApproval: agentData.identity.requireApproval,
        confidenceThreshold: agentData.identity.confidenceThreshold,
        maxTokens: typeof agentData.identity.maxTokens === 'bigint' ? agentData.identity.maxTokens : BigInt(agentData.identity.maxTokens),
        temperature: agentData.identity.temperature,
      };

      // DEBUG: Log exactly what we're sending
      console.log('📤 [handleSaveMCPConfig] Sending config to backend:', {
        mcpTokensCount: updatedConfig.mcpTokens.length,
        mcpTokens: JSON.stringify(updatedConfig.mcpTokens),
        mcpTokensKeys: updatedConfig.mcpTokens.map(([k]) => k),
        fullConfigKeys: Object.keys(updatedConfig)
      });

      const result = await AgentServiceInstance.updateAgentConfig(backendCanisterId, identity, updatedConfig);
      
      console.log('📥 [handleSaveMCPConfig] Backend response:', result);
      
      if ('ok' in result) {
        alert('MCP configuration updated successfully');
        // Store the tokens we just saved so we can verify they match after refresh
        const savedTokens = validTokens;
        console.log('💾 [handleSaveMCPConfig] Saved tokens:', {
          count: savedTokens.length,
          keys: savedTokens.map(([k]) => k),
        });
        
        // CRITICAL FIX: If we included a partial token, add it to state and clear the input fields
        if (hasPartialToken) {
          console.log('✅ [handleSaveMCPConfig] Partial token was saved, adding to state and clearing inputs');
          setMcpTokens(validTokens);
          setNewTokenKey('');
          setNewTokenValue('');
        }
        
        // Close the config form first
        setShowMCPConfig(false);
        
        // Refresh agent data to get updated identity from backend
        // Use a delay to allow IC canister to process the update
        setTimeout(async () => {
          try {
            console.log('🔄 [handleSaveMCPConfig] Starting refresh to verify saved tokens...');
            // Call onRefresh and wait for it to complete
            if (onRefresh) {
              await Promise.resolve(onRefresh());
            }
            
            // After refresh, wait a bit more for state to update, then check backend
            setTimeout(() => {
              console.log('✅ [handleSaveMCPConfig] Refresh completed, useEffect will verify tokens on next identity update');
              console.log('🔍 [handleSaveMCPConfig] Expected tokens after save:', {
                count: savedTokens.length,
                keys: savedTokens.map(([k]) => k)
              });
              // The useEffect will handle loading the fresh tokens and logging them
            }, 500);
          } catch (error) {
            console.error('❌ [handleSaveMCPConfig] Error during refresh:', error);
          }
        }, 500); // Small delay to let canister process
      } else {
        alert(`Failed to update: ${result.err}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addMcpServer = async () => {
    if (newServer.trim() && !mcpServers.includes(newServer.trim())) {
      // Add to local state immediately
      const updatedServers = [...mcpServers, newServer.trim()];
      setMcpServers(updatedServers);
      setNewServer('');
      
      // Auto-save to canister if agent is initialized
      if (agentData?.identity) {
        try {
          setIsSaving(true);
          const updatedConfig: AgentConfig = {
            name: agentData.identity.name,
            description: agentData.identity.description,
            instructions: agentData.identity.instructions,
            mcpClientEndpoint: mcpClientEndpoint,
            // Use the Claude API key from state
            claudeApiKey: claudeApiKey.trim(),
            defaultMcpServers: updatedServers.filter(s => s.trim() !== ''),
            mcpTokens: mcpTokens.filter(([k, v]) => k.trim() !== '' && v.trim() !== ''),
            requireApproval: agentData.identity.requireApproval,
            confidenceThreshold: agentData.identity.confidenceThreshold,
            maxTokens: typeof agentData.identity.maxTokens === 'bigint' ? agentData.identity.maxTokens : BigInt(agentData.identity.maxTokens),
            temperature: agentData.identity.temperature,
          };

          const result = await AgentServiceInstance.updateAgentConfig(backendCanisterId, identity, updatedConfig);
          if ('ok' in result) {
            console.log('✅ MCP server added and saved to canister:', newServer.trim());
            onRefresh();
          } else {
            console.error('❌ Failed to save MCP server:', result.err);
            // Revert on error
            setMcpServers(mcpServers);
            alert(`Failed to save: ${result.err}`);
          }
        } catch (error) {
          console.error('❌ Error saving MCP server:', error);
          // Revert on error
          setMcpServers(mcpServers);
          alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  const removeMcpServer = async (index: number) => {
    const serverToRemove = mcpServers[index];
    const updatedServers = mcpServers.filter((_, i) => i !== index);
    
    // Update local state immediately
    setMcpServers(updatedServers);
    
    // Auto-save to canister if agent is initialized
    if (agentData?.identity) {
      try {
        setIsSaving(true);
        const updatedConfig: AgentConfig = {
          name: agentData.identity.name,
          description: agentData.identity.description,
          instructions: agentData.identity.instructions,
          mcpClientEndpoint: mcpClientEndpoint,
          // Use the Claude API key from state
          claudeApiKey: claudeApiKey.trim(),
          defaultMcpServers: updatedServers.filter(s => s.trim() !== ''),
          mcpTokens: mcpTokens.filter(([k, v]) => k.trim() !== '' && v.trim() !== ''),
          requireApproval: agentData.identity.requireApproval,
          confidenceThreshold: agentData.identity.confidenceThreshold,
          maxTokens: typeof agentData.identity.maxTokens === 'bigint' ? agentData.identity.maxTokens : BigInt(agentData.identity.maxTokens),
          temperature: agentData.identity.temperature,
        };

        const result = await AgentServiceInstance.updateAgentConfig(backendCanisterId, identity, updatedConfig);
        if ('ok' in result) {
          console.log('✅ MCP server removed and saved to canister:', serverToRemove);
          onRefresh();
        } else {
          console.error('❌ Failed to remove MCP server:', result.err);
          // Revert on error
          setMcpServers(mcpServers);
          alert(`Failed to remove: ${result.err}`);
        }
      } catch (error) {
        console.error('❌ Error removing MCP server:', error);
        // Revert on error
        setMcpServers(mcpServers);
        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const addMcpToken = () => {
    const trimmedKey = newTokenKey.trim();
    const trimmedValue = newTokenValue.trim();
    
    console.log('🔵 [addMcpToken] Called:', {
      key: trimmedKey,
      valueLength: trimmedValue.length,
      currentStateCount: mcpTokens.length,
      currentState: JSON.stringify(mcpTokens)
    });
    
    if (!trimmedKey || !trimmedValue) {
      alert('Please enter both token name and value');
      return;
    }

    // Simple: just add to state
    setMcpTokens(prevTokens => {
      const newToken: [string, string] = [trimmedKey, trimmedValue];
      const updated: [string, string][] = [...prevTokens, newToken];
      console.log('✅ [addMcpToken] State updated:', {
        beforeCount: prevTokens.length,
        afterCount: updated.length,
        before: JSON.stringify(prevTokens),
        after: JSON.stringify(updated),
        newToken: newToken
      });
      return updated;
    });
    
    setTokenIds(prevIds => {
      const newId = prevIds.length > 0 ? Math.max(...prevIds) + 1 : 0;
      setNextTokenId(newId + 1);
      console.log('✅ [addMcpToken] Token ID added:', { newId, updatedIds: [...prevIds, newId] });
      return [...prevIds, newId];
    });
    
    setNewTokenKey('');
    setNewTokenValue('');
    
    console.log('✅ [addMcpToken] Input fields cleared');
  };

  const removeMcpToken = (index: number) => {
    console.log('🗑️ [removeMcpToken] Called:', {
      index,
      currentCount: mcpTokens.length,
      tokenToRemove: mcpTokens[index] ? mcpTokens[index][0] : 'N/A',
      currentState: JSON.stringify(mcpTokens)
    });
    
    setMcpTokens(prevTokens => {
      const updated = prevTokens.filter((_, i) => i !== index);
      console.log('✅ [removeMcpToken] Token removed:', {
        beforeCount: prevTokens.length,
        afterCount: updated.length,
        before: JSON.stringify(prevTokens),
        after: JSON.stringify(updated)
      });
      return updated;
    });
    setTokenIds(prevIds => prevIds.filter((_, i) => i !== index));
  };

  // Get MCP tools used in tasks
  const mcpToolsUsed = useMemo(() => {
    const tools = new Set<string>();
    agentData?.tasks?.forEach(task => {
      task.mcpToolsUsed?.forEach(tool => tools.add(tool));
    });
    return Array.from(tools);
  }, [agentData?.tasks]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">MCP Servers Configuration</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMCPConfig(!showMCPConfig)}
            style={{
              background: showMCPConfig 
                ? 'rgba(107, 114, 128, 0.2)' 
                : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showMCPConfig ? '✕ Cancel' : '⚙️ Configure MCP'}
          </button>
        </div>
      </div>

      {/* MCP Configuration Form */}
      {showMCPConfig && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <h4 className="text-md font-semibold text-white mb-4">MCP Configuration</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">MCP Client Endpoint *</label>
              <input
                type="text"
                value={mcpClientEndpoint}
                onChange={(e) => setMcpClientEndpoint(e.target.value)}
                placeholder="https://ai.coinnation.io/api/mcp"
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#ffffff',
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Your custom MCP endpoint where MCP servers are registered
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Claude API Key *</label>
              <input
                type="password"
                value={claudeApiKey}
                onChange={(e) => setClaudeApiKey(e.target.value)}
                placeholder="Enter your Claude API key"
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#ffffff',
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Your Claude API key (required for agent task execution). This value is sent to the canister and stored securely.
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Default MCP Servers</label>
              <div className="space-y-2 mb-2">
                {mcpServers.map((server, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={server}
                      onChange={(e) => {
                        const updated = [...mcpServers];
                        updated[index] = e.target.value;
                        setMcpServers(updated);
                      }}
                      placeholder="Server name (e.g., github, slack)"
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        color: '#ffffff',
                      }}
                    />
                    <button
                      onClick={() => removeMcpServer(index)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid #ef4444',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        color: '#ef4444',
                        cursor: 'pointer',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newServer}
                  onChange={(e) => setNewServer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addMcpServer()}
                  placeholder="Add server name..."
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: '#ffffff',
                  }}
                />
                <button
                  onClick={addMcpServer}
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid #10B981',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    color: '#10B981',
                    cursor: 'pointer',
                  }}
                >
                  ➕ Add
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">MCP Tokens</label>
              <div className="space-y-2 mb-2">
                {mcpTokens.map(([key, value], index) => (
                  <div key={`token-${tokenIds[index]}`} className="flex gap-2">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => {
                        console.log('✏️ [Token Key onChange]', {
                          index,
                          oldKey: key,
                          newKey: e.target.value,
                          currentCount: mcpTokens.length
                        });
                        setMcpTokens(prevTokens => {
                          const updated = [...prevTokens];
                          updated[index] = [e.target.value, updated[index][1]];
                          console.log('✅ [Token Key onChange] Updated:', {
                            index,
                            newState: JSON.stringify(updated)
                          });
                          return updated;
                        });
                      }}
                      placeholder="TOKEN_NAME"
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        color: '#ffffff',
                      }}
                    />
                    <input
                      type="password"
                      value={value}
                      onChange={(e) => {
                        console.log('✏️ [Token Value onChange]', {
                          index,
                          key: key,
                          oldValueLength: value.length,
                          newValueLength: e.target.value.length,
                          currentCount: mcpTokens.length
                        });
                        setMcpTokens(prevTokens => {
                          const updated = [...prevTokens];
                          updated[index] = [updated[index][0], e.target.value];
                          console.log('✅ [Token Value onChange] Updated:', {
                            index,
                            newState: JSON.stringify(updated.map(([k, v]) => [k, v.length > 0 ? '***' + v.slice(-4) : '']))
                          });
                          return updated;
                        });
                      }}
                      placeholder="token_value"
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        color: '#ffffff',
                      }}
                    />
                    <button
                      onClick={() => removeMcpToken(index)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid #ef4444',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        color: '#ef4444',
                        cursor: 'pointer',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newTokenKey}
                  onChange={(e) => setNewTokenKey(e.target.value)}
                  placeholder="TOKEN_NAME"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: '#ffffff',
                  }}
                />
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newTokenValue}
                    onChange={(e) => setNewTokenValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addMcpToken()}
                    placeholder="token_value"
                    style={{
                      flex: 1,
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      color: '#ffffff',
                    }}
                  />
                  <button
                    onClick={(e) => {
                      console.log('🟢 [Button Click] Add token button clicked', {
                        newTokenKey,
                        newTokenValueLength: newTokenValue.length,
                        currentTokensCount: mcpTokens.length,
                      });
                      e.preventDefault();
                      e.stopPropagation();
                      addMcpToken();
                    }}
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid #10B981',
                      borderRadius: '8px',
                      padding: '0.5rem 1rem',
                      color: '#10B981',
                      cursor: 'pointer',
                    }}
                  >
                    ➕
                  </button>
                </div>
              </div>
              {mcpTokens.length === 0 && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: '#10b981',
                }}>
                  ✅ Agent will use tokens stored in the canister. Add overrides if needed.
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveMCPConfig}
                disabled={isSaving || !mcpClientEndpoint}
                style={{
                  background: (isSaving || !mcpClientEndpoint)
                    ? 'rgba(107, 114, 128, 0.2)'
                    : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: (isSaving || !mcpClientEndpoint) ? 'not-allowed' : 'pointer',
                  opacity: (isSaving || !mcpClientEndpoint) ? 0.5 : 1,
                }}
              >
                {isSaving ? '⏳ Saving...' : '💾 Save MCP Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registered MCP Servers Available */}
      {registeredServers.length > 0 && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold text-white">
              📋 Available MCP Servers ({registeredServers.length})
            </h4>
            <button
              onClick={loadRegisteredServers}
              disabled={isLoadingServers}
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid #3B82F6',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                color: '#3B82F6',
                fontSize: '0.875rem',
                cursor: isLoadingServers ? 'not-allowed' : 'pointer',
                opacity: isLoadingServers ? 0.5 : 1,
              }}
            >
              {isLoadingServers ? '⏳ Loading...' : '🔄 Refresh'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {registeredServers.map((server) => {
              const isConfigured = mcpServers.includes(server.name);
              return (
                <div
                  key={server.name}
                  style={{
                    background: isConfigured ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 0, 0, 0.3)',
                    border: `1px solid ${isConfigured ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}`,
                    borderRadius: '8px',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={async () => {
                    if (!isConfigured && !mcpServers.includes(server.name)) {
                      // Add to local state immediately for UI feedback
                      const updatedServers = [...mcpServers, server.name];
                      setMcpServers(updatedServers);
                      
                      // Auto-save to canister
                      if (agentData?.identity) {
                        try {
                          setIsSaving(true);
                          // 🔧 FIX: Don't include masked API key in updates - backend will preserve existing key
                          const updatedConfig: AgentConfig = {
                            name: agentData.identity.name,
                            description: agentData.identity.description,
                            instructions: agentData.identity.instructions,
                            mcpClientEndpoint: mcpClientEndpoint,
                            // Use the Claude API key from state
                            claudeApiKey: claudeApiKey.trim(),
                            defaultMcpServers: updatedServers.filter(s => s.trim() !== ''),
                            mcpTokens: mcpTokens.filter(([k, v]) => k.trim() !== '' && v.trim() !== ''),
                            requireApproval: agentData.identity.requireApproval,
                            confidenceThreshold: agentData.identity.confidenceThreshold,
                            maxTokens: typeof agentData.identity.maxTokens === 'bigint' ? agentData.identity.maxTokens : BigInt(agentData.identity.maxTokens),
                            temperature: agentData.identity.temperature,
                          };

                          const result = await AgentServiceInstance.updateAgentConfig(backendCanisterId, identity, updatedConfig);
                          if ('ok' in result) {
                            console.log('✅ MCP server added and saved to canister:', server.name);
                            // Refresh to get updated identity
                            onRefresh();
                          } else {
                            console.error('❌ Failed to save MCP server:', result.err);
                            // Revert local state on error
                            setMcpServers(mcpServers);
                            alert(`Failed to save: ${result.err}`);
                          }
                        } catch (error) {
                          console.error('❌ Error saving MCP server:', error);
                          // Revert local state on error
                          setMcpServers(mcpServers);
                          alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        } finally {
                          setIsSaving(false);
                        }
                      }
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!isConfigured) {
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isConfigured) {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {server.imageUrl && (
                      <img 
                        src={server.imageUrl} 
                        alt={server.displayName || server.name}
                        style={{ width: '32px', height: '32px', borderRadius: '6px' }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="text-white font-semibold text-sm">
                          {server.displayName || server.name}
                        </h5>
                        {isConfigured && (
                          <span style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            fontSize: '0.7rem',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '4px',
                          }}>
                            {isSaving ? '⏳ Saving...' : '✓ Configured'}
                          </span>
                        )}
                      </div>
                      {server.description && (
                        <p className="text-gray-400 text-xs line-clamp-2">
                          {server.description}
                        </p>
                      )}
                      {server.envVars && server.envVars.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-500 mb-1">Required Tokens:</div>
                          <div className="flex flex-wrap gap-1">
                            {server.envVars.map((envVar: string, idx: number) => {
                              const hasToken = mcpTokens.some(([key]) => key === envVar);
                              return (
                                <span
                                  key={idx}
                                  style={{
                                    background: hasToken ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                    color: hasToken ? '#10b981' : '#f59e0b',
                                    fontSize: '0.7rem',
                                    padding: '0.125rem 0.375rem',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {envVar}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current MCP Configuration Display */}
      {!showMCPConfig && agentData?.identity && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">MCP Client Endpoint</div>
              <div className="text-white font-mono text-sm break-all">
                {agentData.identity.mcpClientEndpoint || 'Not configured'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">MCP Servers</div>
              <div className="text-white">
                {agentData.identity.defaultMcpServers.length} configured
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-400 mb-2">Configured Servers:</div>
              <div className="flex flex-wrap gap-2">
                {agentData.identity.defaultMcpServers.length > 0 ? (
                  agentData.identity.defaultMcpServers.map((server, index) => {
                    const serverInfo = registeredServers.find(s => s.name === server);
                    return (
                      <div
                        key={index}
                        style={{
                          background: 'rgba(139, 92, 246, 0.2)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: '8px',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.875rem',
                          color: '#8B5CF6',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        {serverInfo?.imageUrl && (
                          <img 
                            src={serverInfo.imageUrl} 
                            alt={server}
                            style={{ width: '16px', height: '16px', borderRadius: '4px' }}
                          />
                        )}
                        <span>{serverInfo?.displayName || server}</span>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-gray-500 text-sm">No servers configured</span>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-400 mb-2">MCP Tokens:</div>
              <div className="text-white text-sm">
                {agentData.identity.mcpTokens.length > 0 
                  ? `${agentData.identity.mcpTokens.length} token(s) configured`
                  : 'No tokens configured'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MCP Servers Used in Tasks */}
      {mcpToolsUsed.length > 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <h4 className="text-md font-semibold text-white mb-4">MCP Servers Used in Tasks</h4>
          <div className="flex flex-wrap gap-2">
            {mcpToolsUsed.map((tool, index) => (
              <span
                key={index}
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  color: '#10B981',
                }}
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}


      {!showMCPConfig && !agentData?.identity && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <div className="text-4xl mb-4">🔧</div>
          <div className="text-gray-400">Agent not initialized. Initialize the agent first to configure MCP.</div>
        </div>
      )}
    </div>
  );
};

const AgentControlTab: React.FC<{
  agent: DeployedAgent;
  agentData?: {
    identity?: AgentIdentity;
    metrics?: AgentMetrics;
  };
  backendCanisterId: string;
  identity: any;
  showConfigForm: boolean;
  setShowConfigForm: (show: boolean) => void;
}> = ({ agent, agentData, backendCanisterId, identity, showConfigForm, setShowConfigForm }) => {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (agentData?.identity) {
      const identity = agentData.identity;
      setConfig({
        name: identity.name,
        description: identity.description,
        instructions: identity.instructions,
        mcpClientEndpoint: identity.mcpClientEndpoint,
        claudeApiKey: identity.claudeApiKey,
        defaultMcpServers: identity.defaultMcpServers,
        mcpTokens: identity.mcpTokens,
        requireApproval: identity.requireApproval,
        confidenceThreshold: identity.confidenceThreshold,
        maxTokens: typeof identity.maxTokens === 'bigint' ? identity.maxTokens : BigInt(identity.maxTokens),
        temperature: identity.temperature,
      });
    }
  }, [agentData?.identity]);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const configToSave: AgentConfig = {
        ...config,
        claudeApiKey: config.claudeApiKey || '',
      };
      const result = await AgentServiceInstance.updateAgentConfig(backendCanisterId, identity, configToSave);
      if ('ok' in result) {
        alert('Configuration updated successfully');
        setShowConfigForm(false);
        // Refresh data
      } else {
        alert(`Failed to update: ${result.err}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!config) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '3rem',
        textAlign: 'center',
      }}>
        <div className="text-4xl mb-4">⚙️</div>
        <div className="text-gray-400">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Agent Configuration</h3>
        <button
          onClick={() => setShowConfigForm(!showConfigForm)}
          style={{
            background: showConfigForm 
              ? 'rgba(107, 114, 128, 0.2)' 
              : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            color: '#ffffff',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showConfigForm ? '✕ Cancel' : '✏️ Edit Configuration'}
        </button>
      </div>

      {showConfigForm ? (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Name</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#ffffff',
                }}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Description</label>
              <textarea
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#ffffff',
                }}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Instructions</label>
              <textarea
                value={config.instructions}
                onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
                style={{
                  width: '100%',
                  minHeight: '120px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#ffffff',
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Max Tokens</label>
                <input
                  type="number"
                  value={Number(config.maxTokens)}
                  onChange={(e) => setConfig({ ...config, maxTokens: BigInt(parseInt(e.target.value) || 0) })}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: '#ffffff',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={config.temperature}
                  onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: '#ffffff',
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.requireApproval}
                onChange={(e) => setConfig({ ...config, requireApproval: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              <label className="text-sm text-gray-300">Require Approval</label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  background: isSaving 
                    ? 'rgba(107, 114, 128, 0.2)' 
                    : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.5 : 1,
                }}
              >
                {isSaving ? '⏳ Saving...' : '💾 Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">Name</div>
              <div className="text-white">{config.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Max Tokens</div>
              <div className="text-white">{Number(config.maxTokens)}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-400 mb-1">Description</div>
              <div className="text-white">{config.description}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-400 mb-1">Instructions</div>
              <div className="text-white whitespace-pre-wrap">{config.instructions}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Temperature</div>
              <div className="text-white">{config.temperature}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Requires Approval</div>
              <div className="text-white">{config.requireApproval ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Trigger Creation Form Component
const TriggerCreationForm: React.FC<{
  type: 'scheduled' | 'condition' | 'webhook';
  onCreateScheduledTrigger: (name: string, description: string, schedule: ScheduleType, inputTemplate: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
  onCreateConditionTrigger: (name: string, description: string, condition: ConditionType, inputTemplate: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
  onCreateWebhookTrigger: (name: string, description: string, source: string, signature: string | undefined, inputTemplate: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
  onClose: () => void;
}> = ({ type, onCreateScheduledTrigger, onCreateConditionTrigger, onCreateWebhookTrigger, onClose }) => {
  const getTriggerDescription = () => {
    switch (type) {
      case 'webhook':
        return 'Webhooks allow external systems to trigger your agent. When a webhook is received, the agent will execute a task using your configured MCP tools.';
      case 'scheduled':
        return 'Scheduled triggers automatically execute tasks at specified times using your configured MCP tools.';
      case 'condition':
        return 'Condition triggers execute tasks when specific conditions are met, using your configured MCP tools.';
      default:
        return '';
    }
  };
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    inputTemplate: '{input}',
    // Scheduled
    scheduleType: 'interval' as 'interval' | 'cron' | 'once' | 'recurring',
    intervalSeconds: 3600,
    cronExpression: '0 9 * * *',
    onceTimestamp: Date.now(),
    // Condition
    conditionType: 'threshold' as 'threshold' | 'http_check' | 'custom',
    metric: 'success_rate',
    operator: '>',
    threshold: 90,
    httpUrl: '',
    expectedStatus: 200,
    customExpression: '',
    // Webhook
    source: '',
    signature: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    setIsCreating(true);
    try {
      let result;
      
      if (type === 'scheduled') {
        let schedule: ScheduleType;
        if (formData.scheduleType === 'interval') {
          schedule = { interval: { seconds: BigInt(formData.intervalSeconds) } };
        } else if (formData.scheduleType === 'cron') {
          schedule = { cron: { expression: formData.cronExpression } };
        } else if (formData.scheduleType === 'once') {
          schedule = { once: { timestamp: BigInt(formData.onceTimestamp) } };
        } else {
          schedule = { recurring: { pattern: 'hourly', nextRun: BigInt(Date.now()) } };
        }
        result = await onCreateScheduledTrigger(formData.name, formData.description, schedule, formData.inputTemplate);
      } else if (type === 'condition') {
        let condition: ConditionType;
        if (formData.conditionType === 'threshold') {
          condition = { threshold: { metric: formData.metric, operator: formData.operator, value: formData.threshold } };
        } else if (formData.conditionType === 'http_check') {
          condition = { http_check: { url: formData.httpUrl, expected_status: BigInt(formData.expectedStatus) } };
        } else {
          condition = { custom: { expression: formData.customExpression, variables: [] } };
        }
        result = await onCreateConditionTrigger(formData.name, formData.description, condition, formData.inputTemplate);
      } else {
        result = await onCreateWebhookTrigger(
          formData.name,
          formData.description,
          formData.source,
          formData.signature || undefined,
          formData.inputTemplate
        );
      }

      if ('ok' in result) {
        alert('Trigger created successfully');
        onClose();
      } else {
        alert(`Failed to create trigger: ${result.err}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '1.5rem',
    }}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-md font-semibold text-white">
          Create {type === 'scheduled' ? 'Scheduled' : type === 'condition' ? 'Condition' : 'Webhook'} Trigger
        </h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>×</button>
      </div>

      {/* MCP Integration Notice */}
      <div style={{
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '8px',
        padding: '0.75rem',
        marginBottom: '1rem',
      }}>
        <div className="flex items-start gap-2">
          <span className="text-sm">🔧</span>
          <div className="text-xs text-gray-300">
            <strong className="text-white">MCP-Based Execution:</strong> {getTriggerDescription()}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.75rem',
              color: '#ffffff',
            }}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            style={{
              width: '100%',
              minHeight: '80px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.75rem',
              color: '#ffffff',
            }}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Input Template</label>
          <input
            type="text"
            value={formData.inputTemplate}
            onChange={(e) => setFormData({ ...formData, inputTemplate: e.target.value })}
            placeholder="{input}"
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.75rem',
              color: '#ffffff',
            }}
          />
        </div>

        {type === 'scheduled' && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Schedule Type</label>
              <select
                value={formData.scheduleType}
                onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value as any })}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#ffffff',
                }}
              >
                <option value="interval">Interval</option>
                <option value="cron">Cron</option>
                <option value="once">Once</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>
            {formData.scheduleType === 'interval' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Interval (seconds)</label>
                <input
                  type="number"
                  value={formData.intervalSeconds}
                  onChange={(e) => setFormData({ ...formData, intervalSeconds: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: '#ffffff',
                  }}
                />
              </div>
            )}
            {formData.scheduleType === 'cron' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Cron Expression</label>
                <input
                  type="text"
                  value={formData.cronExpression}
                  onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                  placeholder="0 9 * * *"
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: '#ffffff',
                  }}
                />
              </div>
            )}
          </>
        )}

        {type === 'condition' && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Condition Type</label>
              <select
                value={formData.conditionType}
                onChange={(e) => setFormData({ ...formData, conditionType: e.target.value as any })}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#ffffff',
                }}
              >
                <option value="threshold">Threshold</option>
                <option value="http_check">HTTP Check</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {formData.conditionType === 'threshold' && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Metric</label>
                  <select
                    value={formData.metric}
                    onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      color: '#ffffff',
                    }}
                  >
                    <option value="success_rate">Success Rate</option>
                    <option value="tasks_per_hour">Tasks/Hour</option>
                    <option value="avg_response_time">Avg Response Time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Operator</label>
                  <select
                    value={formData.operator}
                    onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      color: '#ffffff',
                    }}
                  >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                    <option value="==">==</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Value</label>
                  <input
                    type="number"
                    value={formData.threshold}
                    onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      color: '#ffffff',
                    }}
                  />
                </div>
              </div>
            )}
            {formData.conditionType === 'http_check' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">URL</label>
                  <input
                    type="text"
                    value={formData.httpUrl}
                    onChange={(e) => setFormData({ ...formData, httpUrl: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      color: '#ffffff',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Expected Status</label>
                  <input
                    type="number"
                    value={formData.expectedStatus}
                    onChange={(e) => setFormData({ ...formData, expectedStatus: parseInt(e.target.value) || 200 })}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      color: '#ffffff',
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {type === 'webhook' && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Source</label>
              <input
                type="text"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                placeholder="webhook source identifier"
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#ffffff',
                }}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Signature (optional)</label>
              <input
                type="text"
                value={formData.signature}
                onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                placeholder="HMAC signature for verification"
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#ffffff',
                }}
              />
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={isCreating || !formData.name.trim()}
            style={{
              background: (isCreating || !formData.name.trim())
                ? 'rgba(107, 114, 128, 0.2)'
                : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: (isCreating || !formData.name.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isCreating || !formData.name.trim()) ? 0.5 : 1,
            }}
          >
            {isCreating ? '⏳ Creating...' : '✅ Create Trigger'}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(107, 114, 128, 0.2)',
              border: '1px solid #6B7280',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              color: '#9CA3AF',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== AGENT DETAILS PANEL ====================

// ==================== AGENT DETAILS PANEL ====================

const AgentDetailsPanel: React.FC<{
  agent: DeployedAgent;
  agentData?: {
    identity?: AgentIdentity;
    metrics?: AgentMetrics;
    tasks?: Task[];
    triggers?: TriggerConfig[];
    approvals?: Approval[];
    errors?: ErrorLog[];
    activity?: ActivityEvent[];
  };
  identity: any;
  backendCanisterId: string;
  onClose: () => void;
  onRefresh: () => void;
  onExecuteTask: (input: string, metadata: [string, string][]) => Promise<any>;
  onProcessApproval: (approvalId: string, approved: boolean) => Promise<any>;
  onToggleTrigger: (triggerId: string) => Promise<any>;
  onExecuteTrigger: (triggerId: string) => Promise<any>;
  onUpdateTrigger: (triggerId: string, name?: string, description?: string, enabled?: boolean, inputTemplate?: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
  onDeleteTrigger: (triggerId: string) => Promise<any>;
  onCreateScheduledTrigger: (name: string, description: string, schedule: ScheduleType, inputTemplate: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
  onCreateConditionTrigger: (name: string, description: string, condition: ConditionType, inputTemplate: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
  onCreateWebhookTrigger: (name: string, description: string, source: string, signature: string | undefined, inputTemplate: string, retryConfig?: RetryConfig, executionLimits?: ExecutionLimits) => Promise<any>;
}> = ({ agent, agentData, identity, backendCanisterId, onClose, onRefresh, onExecuteTask, onProcessApproval, onToggleTrigger, onExecuteTrigger, onUpdateTrigger, onDeleteTrigger, onCreateScheduledTrigger, onCreateConditionTrigger, onCreateWebhookTrigger }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'triggers' | 'mcp' | 'approvals' | 'activity' | 'errors' | 'control' | 'debug'>('overview');
  const [showTriggerForm, setShowTriggerForm] = useState(false);
  const [triggerFormType, setTriggerFormType] = useState<'scheduled' | 'condition' | 'webhook' | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerConfig | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const mcpTabDebugRef = useRef<MCPTabDebugState | null>(null); // Ref to access MCP tab debug state

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'tasks', label: 'Tasks', icon: '📋', count: agentData?.tasks?.length },
    { id: 'triggers', label: 'Triggers', icon: '⚡', count: agentData?.triggers?.length },
    { id: 'mcp', label: 'MCP Servers', icon: '🔧', count: agentData?.identity?.defaultMcpServers?.length },
    { id: 'approvals', label: 'Approvals', icon: '👤', count: agentData?.approvals?.length },
    { id: 'activity', label: 'Activity', icon: '📈', count: agentData?.activity?.length },
    { id: 'errors', label: 'Errors', icon: '⚠️', count: agentData?.errors?.filter(e => !e.resolved).length },
    { id: 'control', label: 'Control', icon: '🎮' },
    { id: 'debug', label: '🐛 Debug', icon: '🐛' },
  ];

  // Render dialog content with high z-index to be above sidebar toggle (z-index 999)
  const dialogContent = (
    <div 
      onClick={(e) => {
        // Close dialog when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        zIndex: 10000, // Much higher than sidebar toggle (999) to ensure it's on top
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        isolation: 'isolate', // Create new stacking context
      }}
    >
      <div style={{
        background: '#111111',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '95vw',
        maxWidth: '1200px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, var(--accent-green), #059669)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}>
              🧠
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{agent.name}</h2>
              <p className="text-sm text-gray-400">{agentData?.identity?.description || 'AI Agent Details'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid #3B82F6',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                color: '#3B82F6',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              🔄 Refresh
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0.5rem',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          padding: '0 1.5rem',
          gap: '0.5rem',
          overflowX: 'auto',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                background: activeTab === tab.id 
                  ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(16, 185, 129, 0.05))' 
                  : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-orange)' : '2px solid transparent',
                color: activeTab === tab.id ? '#ffffff' : '#888',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span style={{
                  background: 'rgba(255, 107, 53, 0.2)',
                  color: '#ff6b35',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  minWidth: '1.25rem',
                  textAlign: 'center',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }} className="chat-scrollbar">
          {activeTab === 'overview' && (
            <AgentOverviewTab agent={agent} agentData={agentData} />
          )}
          {activeTab === 'tasks' && (
            <AgentTasksTab 
              agent={agent}
              tasks={agentData?.tasks || []}
              onExecuteTask={onExecuteTask}
              showTaskForm={showTaskForm}
              setShowTaskForm={setShowTaskForm}
              taskInput={taskInput}
              setTaskInput={setTaskInput}
              isExecuting={isExecuting}
              setIsExecuting={setIsExecuting}
              agentData={agentData}
            />
          )}
          {activeTab === 'triggers' && (
            <AgentTriggersTab
              triggers={agentData?.triggers || []}
              onToggleTrigger={onToggleTrigger}
              onExecuteTrigger={onExecuteTrigger}
              onDeleteTrigger={onDeleteTrigger}
              onUpdateTrigger={onUpdateTrigger}
              onCreateScheduledTrigger={onCreateScheduledTrigger}
              onCreateConditionTrigger={onCreateConditionTrigger}
              onCreateWebhookTrigger={onCreateWebhookTrigger}
              showTriggerForm={showTriggerForm}
              setShowTriggerForm={setShowTriggerForm}
              triggerFormType={triggerFormType}
              setTriggerFormType={setTriggerFormType}
              selectedTrigger={selectedTrigger}
              setSelectedTrigger={setSelectedTrigger}
            />
          )}
          {activeTab === 'mcp' && (
            <AgentMCPTab
              agent={agent}
              agentData={agentData}
              backendCanisterId={backendCanisterId}
              identity={identity}
              onRefresh={onRefresh}
              debugStateRef={mcpTabDebugRef}
            />
          )}
          {activeTab === 'debug' && (
            <AgentDebugTab
              agent={agent}
              agentData={agentData}
              mcpTabDebugState={mcpTabDebugRef.current}
            />
          )}
          {activeTab === 'approvals' && (
            <AgentApprovalsTab
              approvals={agentData?.approvals || []}
              onProcessApproval={onProcessApproval}
            />
          )}
          {activeTab === 'activity' && (
            <AgentActivityTab activity={agentData?.activity || []} />
          )}
          {activeTab === 'errors' && (
            <AgentErrorsTab errors={agentData?.errors || []} />
          )}
          {activeTab === 'control' && (
            <AgentControlTab
              agent={agent}
              agentData={agentData}
              backendCanisterId={backendCanisterId}
              identity={identity}
              showConfigForm={showConfigForm}
              setShowConfigForm={setShowConfigForm}
            />
          )}
        </div>
      </div>
    </div>
  );

  // Render using portal to ensure it's above all other elements including sidebar toggle (z-index 999)
  if (typeof document === 'undefined') {
    return null; // SSR safety
  }
  
  return createPortal(dialogContent, document.body);
};

// ==================== EMPTY STATE ====================

const EmptyAgentsState: React.FC<{ 
  onDeploy: () => void; 
  hasServerPairs: boolean;
}> = ({ onDeploy, hasServerPairs }) => {
  return (
    <div style={{
      minHeight: '100%',
      padding: '2rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start'
    }}>
      <div className="text-center" style={{ maxWidth: '1200px', width: '100%' }}>
        <div className="text-5xl sm:text-6xl mb-4">🧠</div>
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
          No Advanced AI Agents Deployed
        </h3>
        <p className="text-gray-400 mb-6 leading-relaxed text-sm sm:text-base max-w-3xl mx-auto">
          Deploy your first advanced AI agent with sophisticated trigger systems, 
          real-time monitoring, approval workflows, and MCP tool integration. 
          Build agents that can be triggered by schedules, webhooks, conditions, 
          and external events.
        </p>
        
        {hasServerPairs && (
          <button
            onClick={onDeploy}
            className="mb-6"
            style={{
              background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
              border: 'none',
              borderRadius: '12px',
              padding: '1rem 2rem',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: '48px',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(255, 107, 53, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            🚀 Deploy Advanced AI Agent
          </button>
        )}

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.5rem',
          textAlign: 'left',
          marginTop: hasServerPairs ? '0' : '1.5rem',
          width: '100%',
        }}>
          <h4 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            🌟 Advanced Agent Features:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">⚡</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">Advanced Trigger System:</strong> 
                  <br className="hidden sm:block" />Scheduled, webhook, condition-based, and event triggers
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">🧠</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">Claude API Integration:</strong> 
                  <br className="hidden sm:block" />Full conversational AI with MCP tool support
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">📊</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">Real-time Monitoring:</strong> 
                  <br className="hidden sm:block" />Performance metrics, task tracking, error logging
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">👤</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">Approval Workflows:</strong> 
                  <br className="hidden sm:block" />Human-in-the-loop decision making
                </span>
              </li>
            </ul>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">🔄</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">Smart Retry Logic:</strong> 
                  <br className="hidden sm:block" />Intelligent error handling and recovery
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">🌐</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">HTTP Endpoints:</strong> 
                  <br className="hidden sm:block" />Webhook integration with external systems
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">🛠️</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">MCP Servers:</strong> 
                  <br className="hidden sm:block" />Model Context Protocol for external tool access
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">⏰</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">IC Timer System:</strong> 
                  <br className="hidden sm:block" />Autonomous execution with Internet Computer timers
                </span>
              </li>
            </ul>
            <ul className="space-y-2.5 hidden lg:block">
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">🔐</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">Secure Execution:</strong> 
                  <br />Isolated canister environment with IC security
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">📈</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">Scalable Architecture:</strong> 
                  <br />Auto-scaling with IC's infinite capacity
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">🔗</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">Multi-Agent Coordination:</strong> 
                  <br />Orchestrate complex workflows across agents
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 text-base flex-shrink-0 mt-0.5">💾</span>
                <span className="text-gray-300 text-sm">
                  <strong className="text-white">Persistent State:</strong> 
                  <br />Stable memory for reliable agent state
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== ENHANCED DEPLOY MODAL ====================

const EnhancedDeployAgentModal: React.FC<{
  serverPairs: ServerPair[];
  selectedServerPair: string;
  setSelectedServerPair: (id: string) => void;
  agentName: string;
  setAgentName: (name: string) => void;
  onDeploy: () => void;
  onClose: () => void;
  isDeploying: boolean;
  deployProgress: AgentDeploymentProgress | null;
}> = ({
  serverPairs,
  selectedServerPair,
  setSelectedServerPair,
  agentName,
  setAgentName,
  onDeploy,
  onClose,
  isDeploying,
  deployProgress
}) => {
  // Convert deploy progress to AgentOperationProgress format
  const deployOperationProgress: AgentOperationProgress | null = deployProgress ? {
    phase: deployProgress.stage === 'complete' ? 'complete' : 
           deployProgress.stage === 'error' ? 'error' : 'processing',
    message: deployProgress.message || 'Deploying agent...',
    timeMs: 0, // Could track elapsed time if needed
    percentage: deployProgress.percent
  } : null;

  // Get icon and color based on deployment stage
  const getDeployIcon = () => {
    if (!deployProgress) return '🧠';
    switch (deployProgress.stage) {
      case 'download': return '📥';
      case 'extract': return '📦';
      case 'backend': return '🔧';
      case 'frontend': return '🎨';
      case 'complete': return '🧠';
      case 'error': return '❌';
      default: return '🧠';
    }
  };

  const getDeployColor = () => {
    if (!deployProgress) return '#8b5cf6';
    switch (deployProgress.stage) {
      case 'complete': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#8b5cf6'; // Purple for deployment
    }
  };

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000, // Much higher than sidebar toggle (999) to ensure it's on top
      padding: '1rem',
      isolation: 'isolate', // Create new stacking context
    }}>
      <div style={{
        background: '#111111',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '2rem 2rem 1rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              🧠 Deploy Advanced AI Agent
            </h2>
            <p className="text-sm text-gray-400">
              Deploy a sophisticated AI agent with trigger systems and real-time monitoring
            </p>
          </div>
          {!isDeploying && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0.5rem',
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '2rem' }}>
          {!isDeploying ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="My Advanced AI Agent"
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '1rem',
                    color: '#ffffff',
                    fontSize: '1rem',
                    minHeight: '48px',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Deploy to Server Pair *
                </label>
                <select
                  value={selectedServerPair}
                  onChange={(e) => setSelectedServerPair(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '1rem',
                    color: '#ffffff',
                    fontSize: '1rem',
                    minHeight: '48px',
                  }}
                >
                  {serverPairs.map(pair => (
                    <option key={pair.pairId} value={pair.pairId} style={{ background: '#111111' }}>
                      {pair.name} ({pair.creditsAllocated} credits)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  The agent will be deployed to this server pair's canisters
                </p>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(139, 92, 246, 0.1))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                padding: '1.5rem',
              }}>
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  🌟 What you're deploying:
                </h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✅</span>
                    Full-stack AI agent with frontend and backend canisters
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✅</span>
                    Advanced trigger system (scheduled, webhook, conditions)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✅</span>
                    Real-time monitoring and analytics dashboard
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✅</span>
                    Claude API integration with MCP tool support
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✅</span>
                    Approval workflows and error handling
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* This will be replaced by the overlay when deploying */}
              <div className="text-center">
                <p className="text-lg text-gray-400">
                  Ready to deploy your advanced AI agent
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isDeploying && (
          <div style={{
            padding: '2rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <button
              onClick={onDeploy}
              disabled={!agentName.trim() || !selectedServerPair}
              style={{
                width: '100%',
                background: (!agentName.trim() || !selectedServerPair)
                  ? 'rgba(107, 114, 128, 0.2)'
                  : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                border: 'none',
                borderRadius: '8px',
                padding: '1rem',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: (!agentName.trim() || !selectedServerPair) ? 'not-allowed' : 'pointer',
                opacity: (!agentName.trim() || !selectedServerPair) ? 0.5 : 1,
                minHeight: '52px',
              }}
            >
              🚀 Deploy Advanced Agent
            </button>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '1rem',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '52px',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Render using portal to ensure it's above all other elements including sidebar toggle (z-index 999)
  if (typeof document === 'undefined') {
    return null; // SSR safety
  }
  
  return (
    <>
      {/* Agent Deployment Progress Overlay */}
      {isDeploying && deployOperationProgress && (
        <AgentOperationProgressOverlay
          progress={deployOperationProgress}
          title="Deploying Advanced Agent"
          icon={getDeployIcon()}
          color={getDeployColor()}
        />
      )}
      {createPortal(modalContent, document.body)}
    </>
  );
};

