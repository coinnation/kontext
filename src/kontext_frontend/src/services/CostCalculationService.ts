import { CreditsService } from './CreditsService';

export interface CostMetrics {
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
}

export interface BudgetGoal {
  id: string;
  type: 'budget' | 'cost_per_outcome' | 'roi' | 'total_spend';
  target: number; // USD amount or ratio
  currentValue: number;
  status: 'on_track' | 'warning' | 'exceeded';
  period?: 'daily' | 'weekly' | 'monthly' | 'all_time';
}

export class CostCalculationService {
  private static readonly CREDITS_PER_TB_CYCLES = 1000;
  private static readonly TB_CYCLES = 1_000_000_000_000n;

  /**
   * Convert cycles to credits
   * Formula: 1 Trillion cycles = 1000 credits
   */
  static cyclesToCredits(cycles: bigint | number): number {
    const cyclesNum = typeof cycles === 'bigint' ? Number(cycles) : cycles;
    if (cyclesNum <= 0) return 0;
    
    const tbCycles = cyclesNum / 1_000_000_000_000;
    return tbCycles * this.CREDITS_PER_TB_CYCLES;
  }

  /**
   * Convert cycles to USD via XDR
   * Uses CreditsService to get current XDR rate and convert
   */
  static async cyclesToUsd(cycles: bigint | number): Promise<number> {
    const cyclesNum = typeof cycles === 'bigint' ? Number(cycles) : cycles;
    if (cyclesNum <= 0) return 0;

    try {
      // Get XDR rate and cycles per XDR from CreditsService
      const [xdrRate, cyclesPerXdr] = await Promise.all([
        CreditsService.getXdrRate(),
        CreditsService.getCyclesPerXdr()
      ]);

      // Convert cycles to XDR
      const xdrAmount = cyclesNum / Number(cyclesPerXdr);
      
      // Convert XDR to USD
      const usdAmount = xdrAmount * xdrRate;
      
      return Math.max(0, usdAmount);
    } catch (error) {
      console.error('Failed to convert cycles to USD:', error);
      // Fallback: use approximate rate if service fails
      const credits = this.cyclesToCredits(cyclesNum);
      // Approximate: 1 credit ≈ $0.01 (very rough estimate)
      return credits * 0.01;
    }
  }

  /**
   * Calculate token cost in USD
   * Uses average pricing (claude-sonnet-4) if model is unknown
   * Estimates 70% input, 30% output tokens (typical ratio)
   */
  static calculateTokenCost(tokens: bigint | number, model?: string): number {
    const tokensNum = typeof tokens === 'bigint' ? Number(tokens) : tokens;
    if (tokensNum <= 0) return 0;

    // Default to claude-sonnet-4 pricing if model unknown
    const normalizedModel = model || 'claude-sonnet-4';
    const pricing = this.getModelPricing(normalizedModel);
    
    // Estimate: assume 70% input, 30% output tokens (typical ratio)
    const estimatedInputTokens = tokensNum * 0.7;
    const estimatedOutputTokens = tokensNum * 0.3;
    
    const inputCost = (estimatedInputTokens / 1_000_000) * pricing.inputCostPerMillion;
    const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.outputCostPerMillion;
    
    return inputCost + outputCost;
  }

  /**
   * Get model pricing (matches UserCanisterService pricing table)
   */
  private static getModelPricing(model: string): {
    inputCostPerMillion: number;
    outputCostPerMillion: number;
  } {
    const pricingTable: { [key: string]: { inputCostPerMillion: number; outputCostPerMillion: number } } = {
      'claude-opus-4': {
        inputCostPerMillion: 15.00,
        outputCostPerMillion: 75.00
      },
      'claude-sonnet-4': {
        inputCostPerMillion: 3.00,
        outputCostPerMillion: 15.00
      },
      'claude-haiku-3.5': {
        inputCostPerMillion: 1.00,
        outputCostPerMillion: 5.00
      },
      'claude-sonnet-3.5': {
        inputCostPerMillion: 3.00,
        outputCostPerMillion: 15.00
      },
      'claude-haiku-4': {
        inputCostPerMillion: 1.00,
        outputCostPerMillion: 5.00
      }
    };

    // Return pricing for the model, or default to Sonnet if not found
    return pricingTable[model.toLowerCase()] || pricingTable['claude-sonnet-4'];
  }

  /**
   * Calculate cost metrics for an agency from tasks and executions
   */
  static async calculateAgencyCosts(
    tasks: Array<{ cyclesUsed: bigint | number; tokensUsed?: [] | [bigint] }>,
    executions: Array<{ cyclesUsed: bigint | number; startTime: number }>
  ): Promise<CostMetrics> {
    // Aggregate cycles from tasks
    const taskCycles = tasks.reduce((sum, task) => {
      const cycles = typeof task.cyclesUsed === 'bigint' 
        ? task.cyclesUsed 
        : BigInt(Math.floor(task.cyclesUsed || 0));
      return sum + cycles;
    }, 0n);

    // Aggregate cycles from executions
    const executionCycles = executions.reduce((sum, exec) => {
      const cycles = typeof exec.cyclesUsed === 'bigint'
        ? exec.cyclesUsed
        : BigInt(Math.floor(exec.cyclesUsed || 0));
      return sum + cycles;
    }, 0n);

    const totalCycles = taskCycles + executionCycles;

    // NEW: Aggregate tokens from tasks
    const totalTokens = tasks.reduce((sum, task) => {
      if (task.tokensUsed && task.tokensUsed.length > 0) {
        const tokens = typeof task.tokensUsed[0] === 'bigint' 
          ? Number(task.tokensUsed[0])
          : task.tokensUsed[0];
        return sum + tokens;
      }
      return sum;
    }, 0);

    // Convert to credits
    const totalCredits = this.cyclesToCredits(totalCycles);

    // Convert cycles to USD
    const cyclesUsd = await this.cyclesToUsd(totalCycles);

    // NEW: Calculate token costs
    const totalTokenCostUsd = this.calculateTokenCost(totalTokens);

    // Total USD = cycles cost + token cost
    const totalUsd = cyclesUsd + totalTokenCostUsd;

    // Calculate averages
    const averageCostPerExecution = executions.length > 0
      ? totalUsd / executions.length
      : 0;

    const averageCostPerTask = tasks.length > 0
      ? totalUsd / tasks.length
      : 0;

    // Build cost trend (group by day)
    const costTrend: Array<{ timestamp: number; cycles: bigint; credits: number; usd: number; tokens?: number; tokenCostUsd?: number }> = [];
    if (executions.length > 0) {
      const dailyCosts = new Map<number, { cycles: bigint; tokens: number }>();
      
      // Group tasks by day for token tracking
      const tasksByDay = new Map<number, number>();
      tasks.forEach(task => {
        // We don't have task timestamps here, so we'll distribute tokens evenly
        // This is a limitation - ideally tasks would have timestamps
      });
      
      executions.forEach(exec => {
        const day = new Date(exec.startTime).setHours(0, 0, 0, 0);
        const cycles = typeof exec.cyclesUsed === 'bigint'
          ? exec.cyclesUsed
          : BigInt(Math.floor(exec.cyclesUsed || 0));
        
        const existing = dailyCosts.get(day) || { cycles: 0n, tokens: 0 };
        dailyCosts.set(day, { 
          cycles: existing.cycles + cycles, 
          tokens: existing.tokens 
        });
      });

      // Distribute tokens evenly across execution days (approximation)
      const tokensPerDay = executions.length > 0 ? totalTokens / executions.length : 0;
      for (const [day, data] of dailyCosts.entries()) {
        const dayTokens = tokensPerDay;
        const credits = this.cyclesToCredits(data.cycles);
        const cyclesUsd = await this.cyclesToUsd(data.cycles);
        const tokenCostUsd = this.calculateTokenCost(dayTokens);
        costTrend.push({ 
          timestamp: day, 
          cycles: data.cycles, 
          credits, 
          usd: cyclesUsd + tokenCostUsd,
          tokens: Math.round(dayTokens),
          tokenCostUsd
        });
      }

      // Sort by timestamp
      costTrend.sort((a, b) => a.timestamp - b.timestamp);
    }

    return {
      totalCycles,
      totalCredits,
      totalUsd,
      totalTokens,
      totalTokenCostUsd,
      averageTokensPerTask: tasks.length > 0 ? totalTokens / tasks.length : 0,
      averageCostPerExecution,
      averageCostPerTask,
      costTrend: costTrend.length > 0 ? costTrend : undefined
    };
  }

  /**
   * Evaluate budget goals against actual costs
   */
  static evaluateBudgetGoals(
    goals: Array<{ id: string; type?: string; target: string; period?: string }>,
    costMetrics: CostMetrics,
    periodStart?: number
  ): BudgetGoal[] {
    return goals
      .filter(goal => 
        goal.type === 'budget' || 
        goal.type === 'total_spend' ||
        goal.type === 'cost_per_outcome' ||
        goal.type === 'roi'
      )
      .map(goal => {
        let currentValue = 0;
        let status: 'on_track' | 'warning' | 'exceeded' = 'on_track';

        // Extract numeric target
        const targetMatch = goal.target.match(/(\d+\.?\d*)/);
        const targetValue = targetMatch ? parseFloat(targetMatch[1]) : 0;

        switch (goal.type) {
          case 'budget':
          case 'total_spend':
            currentValue = costMetrics.totalUsd;
            if (currentValue >= targetValue) {
              status = 'exceeded';
            } else if (currentValue >= targetValue * 0.8) {
              status = 'warning';
            }
            break;

          case 'cost_per_outcome':
            // This requires outcome count from elsewhere
            // For now, use average cost per execution as proxy
            currentValue = costMetrics.averageCostPerExecution;
            if (currentValue > targetValue) {
              status = 'exceeded';
            } else if (currentValue > targetValue * 0.9) {
              status = 'warning';
            }
            break;

          case 'roi':
            // ROI requires value generated - would need to be passed in
            // For now, return placeholder
            currentValue = 0;
            break;
        }

        return {
          id: goal.id,
          type: goal.type as BudgetGoal['type'],
          target: targetValue,
          currentValue,
          status,
          period: goal.period as BudgetGoal['period']
        };
      });
  }

  /**
   * Format cost for display
   */
  static formatCost(usd: number): string {
    if (usd < 0.01) return '< $0.01';
    if (usd < 1) return `$${usd.toFixed(2)}`;
    if (usd < 1000) return `$${usd.toFixed(2)}`;
    return `$${(usd / 1000).toFixed(2)}k`;
  }

  /**
   * Format credits for display
   */
  static formatCredits(credits: number): string {
    if (credits < 1) return '< 1';
    if (credits < 1000) return `${Math.round(credits)}`;
    return `${(credits / 1000).toFixed(2)}k`;
  }
}

