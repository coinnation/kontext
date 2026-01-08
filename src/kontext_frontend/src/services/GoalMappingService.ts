import type { AgencyGoal, GoalTaskMapping } from '../types/businessAgency';
import type { Task } from '../candid/agent.did.d.ts';

/**
 * Service for mapping goals to agent tasks
 */
export class GoalMappingService {
  /**
   * Check if a task matches a goal's mapping criteria
   */
  static taskMatchesGoal(
    task: Task,
    goal: AgencyGoal,
    agentCanisterId: string
  ): boolean {
    const mapping = goal.taskMapping;
    if (!mapping) {
      // No mapping = match all tasks (backward compatibility)
      return true;
    }

    // Filter by agent IDs
    if (mapping.agentIds && mapping.agentIds.length > 0) {
      if (!mapping.agentIds.includes(agentCanisterId)) {
        return false;
      }
    }

    // Filter by trigger types
    if (mapping.triggerTypes && mapping.triggerTypes.length > 0) {
      if (!mapping.triggerTypes.includes(task.triggerType)) {
        return false;
      }
    }

    // Filter by trigger metadata
    if (mapping.triggerMetadata && mapping.triggerMetadata.length > 0) {
      const taskMetadata = new Map(task.triggerMetadata);
      const allMatch = mapping.triggerMetadata.every(({ key, value }) => {
        return taskMetadata.get(key) === value;
      });
      if (!allMatch) {
        return false;
      }
    }

    // Filter by task status
    if (mapping.taskStatus && mapping.taskStatus.length > 0) {
      if (!mapping.taskStatus.includes(task.status)) {
        return false;
      }
    }

    // Filter by MCP tools used
    if (mapping.mcpToolsUsed && mapping.mcpToolsUsed.length > 0) {
      const taskTools = task.mcpToolsUsed || [];
      const hasMatchingTool = mapping.mcpToolsUsed.some(tool =>
        taskTools.includes(tool)
      );
      if (!hasMatchingTool) {
        return false;
      }
    }

    // Filter by input content
    if (mapping.inputContains) {
      if (!task.input.toLowerCase().includes(mapping.inputContains.toLowerCase())) {
        return false;
      }
    }

    // Filter by result content
    if (mapping.resultContains) {
      const result = task.result && task.result.length > 0 ? task.result[0] : '';
      if (!result.toLowerCase().includes(mapping.resultContains.toLowerCase())) {
        return false;
      }
    }

    // Check time window
    if (mapping.timeWindow) {
      const taskTime = typeof task.createdAt === 'bigint' 
        ? Number(task.createdAt) 
        : task.createdAt || 0;
      
      if (!this.taskInTimeWindow(taskTime, mapping.timeWindow)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a task timestamp falls within the specified time window
   */
  private static taskInTimeWindow(
    taskTimestamp: number,
    timeWindow: GoalTaskMapping['timeWindow']
  ): boolean {
    if (!timeWindow || timeWindow.type === 'all_time') {
      return true;
    }

    const now = Date.now();
    const taskTime = taskTimestamp;

    switch (timeWindow.type) {
      case 'last_days':
        if (!timeWindow.value) return true;
        const daysAgo = now - (timeWindow.value * 24 * 60 * 60 * 1000);
        return taskTime >= daysAgo;

      case 'last_weeks':
        if (!timeWindow.value) return true;
        const weeksAgo = now - (timeWindow.value * 7 * 24 * 60 * 60 * 1000);
        return taskTime >= weeksAgo;

      case 'last_months':
        if (!timeWindow.value) return true;
        const monthsAgo = now - (timeWindow.value * 30 * 24 * 60 * 60 * 1000);
        return taskTime >= monthsAgo;

      case 'since_date':
        if (!timeWindow.sinceDate) return true;
        return taskTime >= timeWindow.sinceDate;

      default:
        return true;
    }
  }

  /**
   * Count tasks for a goal based on its mapping configuration
   */
  static countTasksForGoal(
    tasks: Array<{ task: Task; agentCanisterId: string }>,
    goal: AgencyGoal
  ): number {
    const mapping = goal.taskMapping;
    if (!mapping) {
      // No mapping = count all tasks
      return tasks.length;
    }

    // Filter tasks that match the goal
    const matchingTasks = tasks.filter(({ task, agentCanisterId }) =>
      this.taskMatchesGoal(task, goal, agentCanisterId)
    );

    // Apply count method
    switch (mapping.countMethod) {
      case 'total':
        return matchingTasks.length;

      case 'completed':
        return matchingTasks.filter(t => t.task.status === 'completed').length;

      case 'successful':
        return matchingTasks.filter(t => {
          const status = t.task.status;
          return status === 'completed' && 
                 t.task.result && 
                 t.task.result.length > 0 &&
                 !t.task.result[0].toLowerCase().includes('error');
        }).length;

      case 'failed':
        return matchingTasks.filter(t => {
          const status = t.task.status;
          return status === 'failed' || 
                 (status === 'completed' && 
                  t.task.result && 
                  t.task.result.length > 0 &&
                  t.task.result[0].toLowerCase().includes('error'));
        }).length;

      case 'unique_tools':
        const uniqueTools = new Set<string>();
        matchingTasks.forEach(({ task }) => {
          (task.mcpToolsUsed || []).forEach(tool => uniqueTools.add(tool));
        });
        return uniqueTools.size;

      case 'custom':
        // For custom, we'd need to evaluate the custom function
        // For now, fall back to total
        console.warn('Custom count method not yet implemented, using total count');
        return matchingTasks.length;

      default:
        return matchingTasks.length;
    }
  }

  /**
   * Get all tasks that match a goal's criteria
   */
  static getMatchingTasks(
    allTasks: Array<{ task: Task; agentCanisterId: string }>,
    goal: AgencyGoal
  ): Array<{ task: Task; agentCanisterId: string }> {
    return allTasks.filter(({ task, agentCanisterId }) =>
      this.taskMatchesGoal(task, goal, agentCanisterId)
    );
  }

  /**
   * Create a default mapping for a goal based on its name/description
   */
  static createDefaultMapping(goal: AgencyGoal, agencyCategory: string): GoalTaskMapping {
    const goalName = goal.name.toLowerCase();
    const goalDesc = goal.description.toLowerCase();
    const combined = `${goalName} ${goalDesc}`;

    // Default mappings based on common patterns
    if (combined.includes('webhook') || combined.includes('api')) {
      return {
        triggerTypes: ['webhook'],
        countMethod: 'completed',
        timeWindow: { type: 'all_time' }
      };
    }

    if (combined.includes('scheduled') || combined.includes('automated')) {
      return {
        triggerTypes: ['scheduled'],
        countMethod: 'completed',
        timeWindow: { type: 'all_time' }
      };
    }

    if (combined.includes('tool') || combined.includes('mcp')) {
      return {
        countMethod: 'unique_tools',
        timeWindow: { type: 'all_time' }
      };
    }

    // Default: track all completed tasks
    return {
      taskStatus: ['completed'],
      countMethod: 'completed',
      timeWindow: { type: 'all_time' }
    };
  }
}

