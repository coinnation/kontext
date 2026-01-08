import type { BusinessAgency, AgencyMetrics, AgencyGoal, MetricsSnapshot } from '../types/businessAgency';
import type { AgentMetrics } from './AgencyService';
import type { Execution } from './AgencyService';
import { GoalMappingService } from './GoalMappingService';
import { CostCalculationService } from './CostCalculationService';
import type { Task as CandidTask } from '../../candid/agent.did.d.ts';

export class BusinessAgencyService {
  /**
   * Calculate business metrics for an agency by aggregating data from its agents/workflows
   */
  static async calculateAgencyMetrics(
    agency: BusinessAgency,
    agentDataMap: Map<string, { metrics?: AgentMetrics; tasks?: any[] }>,
    workflowExecutions: Execution[]
  ): Promise<AgencyMetrics> {
    // Get metrics from referenced agents
    const agentMetrics = agency.agentIds
      .map(id => agentDataMap.get(id))
      .filter((data): data is { metrics?: AgentMetrics; tasks?: any[] } => Boolean(data))
      .map(data => data.metrics)
      .filter((m): m is AgentMetrics => Boolean(m));
    
    // Get executions from referenced workflows
    const relevantExecutions = workflowExecutions.filter(exec =>
      agency.workflowIds.includes(exec.agencyId)
    );
    
    // Calculate aggregate metrics
    const totalExecutions = relevantExecutions.length;
    const successfulExecutions = relevantExecutions.filter(
      e => e.status === 'completed'
    ).length;
    const successRate = totalExecutions > 0 
      ? (successfulExecutions / totalExecutions) * 100 
      : 0;
    
    // Calculate average response time
    const completedExecutions = relevantExecutions.filter(
      e => e.status === 'completed' && e.endTime
    );
    const totalDuration = completedExecutions.reduce((sum, exec) => {
      return sum + (exec.endTime! - exec.startTime);
    }, 0);
    const averageResponseTime = completedExecutions.length > 0
      ? totalDuration / completedExecutions.length / 1000 // Convert to seconds
      : 0;
    
    // Calculate business-specific impact metrics
    const businessImpact = this.calculateBusinessImpact(
      agency.category,
      agentMetrics,
      relevantExecutions
    );
    
    // Get existing history or create new
    const existingHistory = agency.metrics?.history || [];
    
    // Create new snapshot
    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      totalExecutions,
      successRate,
      averageResponseTime,
      businessImpact,
    };
    
    // Keep last 30 days of history (or last 100 snapshots, whichever is smaller)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const filteredHistory = existingHistory
      .filter(s => s.timestamp > thirtyDaysAgo)
      .slice(-99); // Keep last 99, plus new one = 100 total
    
    // NEW: Calculate cost metrics
    let costMetrics;
    try {
      // Collect all tasks from agents
      const allTasks: Array<{ cyclesUsed: bigint | number; tokensUsed?: [] | [bigint] }> = [];
      agency.agentIds.forEach(agentId => {
        const agentData = agentDataMap.get(agentId);
        if (agentData?.tasks) {
          agentData.tasks.forEach((task: any) => {
            allTasks.push({
              cyclesUsed: task.cyclesUsed || 0n,
              tokensUsed: task.tokensUsed || []
            });
          });
        }
      });

      // Collect executions with cycles
      const executionsWithCycles = relevantExecutions.map(exec => ({
        cyclesUsed: exec.cyclesUsed || 0,
        startTime: exec.startTime
      }));

      // Calculate costs
      costMetrics = await CostCalculationService.calculateAgencyCosts(
        allTasks,
        executionsWithCycles
      );
    } catch (error) {
      console.error('Failed to calculate cost metrics:', error);
    }
    
    return {
      totalExecutions,
      successRate,
      averageResponseTime,
      businessImpact,
      lastUpdated: Date.now(),
      history: [...filteredHistory, snapshot],
      costMetrics // NEW: Add cost metrics
    };
  }
  
  /**
   * Auto-update goal progress from tasks and metrics
   * NEW: Uses actual agent tasks if available, falls back to metrics-based tracking
   */
  static updateGoalProgressFromMetrics(
    goals: AgencyGoal[],
    metrics: AgencyMetrics,
    category: BusinessAgency['category'],
    agentTasks?: Array<{ task: CandidTask; agentCanisterId: string }>
  ): AgencyGoal[] {
    return goals.map(goal => {
      // Only update active goals
      if (goal.status !== 'active') {
        return goal;
      }

      // If manual tracking is enabled, don't auto-update
      if (goal.manualTracking) {
        return goal;
      }

      let newCurrentValue: string | undefined = goal.currentValue;
      
      // NEW: If we have task-level data and a mapping, use it
      if (agentTasks && agentTasks.length > 0 && goal.taskMapping) {
        const taskCount = GoalMappingService.countTasksForGoal(agentTasks, goal);
        newCurrentValue = String(taskCount);
      } else {
        // Fallback to old keyword-based matching (for backward compatibility)
        const targetMatch = goal.target.match(/(\d+)/);
        if (!targetMatch) {
          return goal;
        }
        
        const targetNumber = parseInt(targetMatch[1]);
        const targetUnit = goal.target.toLowerCase();
        
        // Map goal names/targets to metrics
        if (targetUnit.includes('content') || targetUnit.includes('piece')) {
          newCurrentValue = String(metrics.businessImpact?.contentCreated || 0);
      } else if (targetUnit.includes('lead')) {
        newCurrentValue = String(metrics.businessImpact?.leadsGenerated || 0);
        } else if (targetUnit.includes('ticket') || targetUnit.includes('resolve')) {
          newCurrentValue = String(metrics.businessImpact?.ticketsResolved || 0);
        } else if (targetUnit.includes('campaign')) {
          newCurrentValue = String(metrics.businessImpact?.campaignsRun || 0);
        } else if (targetUnit.includes('task') || targetUnit.includes('automat')) {
          newCurrentValue = String(metrics.businessImpact?.tasksAutomated || 0);
        } else if (targetUnit.includes('execution')) {
          newCurrentValue = String(metrics.totalExecutions);
        } else if (targetUnit.includes('success') || targetUnit.includes('rate')) {
          newCurrentValue = `${metrics.successRate.toFixed(1)}%`;
        } else if (targetUnit.includes('engagement')) {
          newCurrentValue = `${(metrics.businessImpact?.engagementRate || 0).toFixed(1)}%`;
        }
      }
      
      // Check if goal is completed
      let newStatus: 'active' | 'completed' | 'paused' = goal.status;
      if (newCurrentValue) {
        // Extract numeric value from target
        const targetMatch = goal.target.match(/(\d+\.?\d*)/);
        if (targetMatch) {
          const targetNumber = parseFloat(targetMatch[1]);
          const currentNum = parseFloat(newCurrentValue.replace(/[^0-9.]/g, ''));
          if (!isNaN(currentNum) && !isNaN(targetNumber) && targetNumber > 0) {
            if (currentNum >= targetNumber) {
              newStatus = 'completed';
            }
          }
        }
      }
      
      return {
        ...goal,
        currentValue: newCurrentValue,
        status: newStatus,
      };
    });
  }
  
  private static calculateBusinessImpact(
    category: string,
    agentMetrics: AgentMetrics[],
    executions: Execution[]
  ): Record<string, number> {
    const impact: Record<string, number> = {};
    
    switch (category) {
      case 'marketing':
        impact.contentCreated = executions.filter(
          e => e.status === 'completed'
        ).length;
        impact.campaignsRun = executions.length;
        impact.engagementRate = agentMetrics.reduce(
          (sum, m) => sum + (m.successRate || 0),
          0
        ) / (agentMetrics.length || 1);
        break;
        
      case 'sales':
        impact.leadsQualified = agentMetrics.reduce(
          (sum, m) => sum + (m.successfulTasks || 0),
          0
        );
        impact.dealsInfluenced = executions.filter(
          e => e.status === 'completed'
        ).length;
        break;
        
      case 'support':
        impact.ticketsResolved = executions.filter(
          e => e.status === 'completed'
        ).length;
        impact.averageResponseTime = executions
          .filter(e => e.status === 'completed' && e.endTime)
          .reduce((sum, e) => {
            return sum + (e.endTime! - e.startTime) / 1000;
          }, 0) / (executions.filter(e => e.endTime).length || 1);
        break;
        
      case 'operations':
        impact.tasksAutomated = executions.length;
        impact.successRate = executions.length > 0
          ? (executions.filter(e => e.status === 'completed').length / executions.length) * 100
          : 0;
        break;
    }
    
    return impact;
  }
  
  /**
   * Refresh metrics for an agency (call this periodically or after workflow executions)
   */
  static async refreshAgencyMetrics(
    agency: BusinessAgency,
    agentDataMap: Map<string, any>,
    workflowExecutions: Execution[]
  ): Promise<AgencyMetrics> {
    return await this.calculateAgencyMetrics(agency, agentDataMap, workflowExecutions);
  }
}

