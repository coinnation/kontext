/**
 * EconomyMetricsService
 * 
 * Tracks all platform economy metrics including:
 * - Platform profit (daily, weekly, monthly)
 * - User subscriptions (active, canceled, new)
 * - Deployments (successful, unsuccessful)
 * - New apps created
 * - Cycle consumption (platform-wide and per-user)
 * - User credits balances
 * - Cycle balances (user canisters, server pairs)
 * - Master wallet ICP balance
 * 
 * Currently uses localStorage for storage, will migrate to canister storage later.
 */

export interface PlatformProfit {
  daily: number;
  weekly: number;
  monthly: number;
  total: number;
  lastUpdated: number;
}

export interface SubscriptionEvent {
  userId: string;
  userPrincipal: string;
  eventType: 'subscribed' | 'canceled' | 'renewed' | 'upgraded' | 'downgraded';
  tier: string;
  monthlyCredits: number;
  priceUSD: number;
  timestamp: number;
  subscriptionId?: string;
  customerId?: string;
}

export interface DeploymentEvent {
  projectId: string;
  userId: string;
  userPrincipal: string;
  success: boolean;
  timestamp: number;
  duration?: number;
  error?: string;
  serverPairId?: string;
  cyclesUsed?: bigint;
}

export interface ProjectCreationEvent {
  projectId: string;
  userId: string;
  userPrincipal: string;
  projectName: string;
  timestamp: number;
}

export interface CycleConsumptionEvent {
  userId: string;
  userPrincipal: string;
  canisterId: string;
  canisterType: 'user' | 'server_pair_frontend' | 'server_pair_backend';
  cyclesConsumed: bigint;
  timestamp: number;
}

export interface UserCycleBalance {
  userId: string;
  userPrincipal: string;
  userCanisterId: string;
  cycles: bigint;
  lastUpdated: number;
}

export interface ServerPairCycleBalance {
  serverPairId: string;
  userId: string;
  userPrincipal: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  frontendCycles: bigint;
  backendCycles: bigint;
  lastUpdated: number;
}

export interface UserCreditsBalance {
  userId: string;
  userPrincipal: string;
  credits: number;
  units: number;
  usdEquivalent: number;
  lastUpdated: number;
}

export interface MasterWalletBalance {
  icpBalance: bigint;
  cycleBalance: bigint;
  lastUpdated: number;
}

export interface PlatformMetrics {
  profit: PlatformProfit;
  subscriptions: SubscriptionEvent[];
  deployments: DeploymentEvent[];
  projectCreations: ProjectCreationEvent[];
  cycleConsumptions: CycleConsumptionEvent[];
  userCycleBalances: UserCycleBalance[];
  serverPairCycleBalances: ServerPairCycleBalance[];
  userCreditsBalances: UserCreditsBalance[];
  masterWalletBalance: MasterWalletBalance | null;
  lastSyncTime: number;
}

export interface EmployeeCompensation {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  performanceMultiplier: number;
  metrics: {
    deploymentsFacilitated: number;
    usersOnboarded: number;
    revenueGenerated: number;
    customerSatisfaction: number;
  };
  calculatedCompensation: number;
  lastUpdated: number;
}

const STORAGE_KEY = 'kontext_economy_metrics';
const EMPLOYEES_STORAGE_KEY = 'kontext_employee_compensation';

class EconomyMetricsService {
  private static instance: EconomyMetricsService;
  private metrics: PlatformMetrics;

  private constructor() {
    this.metrics = this.loadMetrics();
  }

  public static getInstance(): EconomyMetricsService {
    if (!EconomyMetricsService.instance) {
      EconomyMetricsService.instance = new EconomyMetricsService();
    }
    return EconomyMetricsService.instance;
  }

  private loadMetrics(): PlatformMetrics {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert bigint strings back to bigint
        return this.deserializeMetrics(parsed);
      }
    } catch (error) {
      console.error('❌ [EconomyMetricsService] Error loading metrics:', error);
    }

    return this.getDefaultMetrics();
  }

  private getDefaultMetrics(): PlatformMetrics {
    return {
      profit: {
        daily: 0,
        weekly: 0,
        monthly: 0,
        total: 0,
        lastUpdated: Date.now()
      },
      subscriptions: [],
      deployments: [],
      projectCreations: [],
      cycleConsumptions: [],
      userCycleBalances: [],
      serverPairCycleBalances: [],
      userCreditsBalances: [],
      masterWalletBalance: null,
      lastSyncTime: Date.now()
    };
  }

  private serializeMetrics(metrics: PlatformMetrics): any {
    // Convert bigint to string for JSON serialization
    const serialized = JSON.parse(JSON.stringify(metrics, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));
    return serialized;
  }

  private deserializeMetrics(parsed: any): PlatformMetrics {
    // Convert string back to bigint
    const deserializeBigInt = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(deserializeBigInt);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'cycles' || key === 'cyclesConsumed' || key === 'frontendCycles' || 
            key === 'backendCycles' || key === 'icpBalance' || key === 'cycleBalance') {
          result[key] = BigInt(value as string);
        } else if (typeof value === 'object' && value !== null) {
          result[key] = deserializeBigInt(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return deserializeBigInt(parsed) as PlatformMetrics;
  }

  private saveMetrics(): void {
    try {
      const serialized = this.serializeMetrics(this.metrics);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      this.metrics.lastSyncTime = Date.now();
    } catch (error) {
      console.error('❌ [EconomyMetricsService] Error saving metrics:', error);
    }
  }

  // ==================== SUBSCRIPTION TRACKING ====================

  public trackSubscription(event: SubscriptionEvent): void {
    this.metrics.subscriptions.push(event);
    
    // Update profit if it's a subscription payment
    if (event.eventType === 'subscribed' || event.eventType === 'renewed') {
      this.updateProfit(event.priceUSD, 'subscription');
    }
    
    this.saveMetrics();
    console.log('📊 [EconomyMetricsService] Subscription tracked:', event);
  }

  public getSubscriptions(filters?: {
    eventType?: SubscriptionEvent['eventType'];
    startDate?: number;
    endDate?: number;
  }): SubscriptionEvent[] {
    let filtered = [...this.metrics.subscriptions];
    
    if (filters) {
      if (filters.eventType) {
        filtered = filtered.filter(s => s.eventType === filters.eventType);
      }
      if (filters.startDate) {
        filtered = filtered.filter(s => s.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filtered = filtered.filter(s => s.timestamp <= filters.endDate!);
      }
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getActiveSubscriptions(): SubscriptionEvent[] {
    const allSubscriptions = this.getSubscriptions();
    const activeMap = new Map<string, SubscriptionEvent>();
    
    // Get the most recent subscription event for each user
    for (const sub of allSubscriptions) {
      const existing = activeMap.get(sub.userId);
      if (!existing || sub.timestamp > existing.timestamp) {
        if (sub.eventType === 'subscribed' || sub.eventType === 'renewed' || sub.eventType === 'upgraded') {
          activeMap.set(sub.userId, sub);
        } else if (sub.eventType === 'canceled') {
          activeMap.delete(sub.userId);
        }
      }
    }
    
    return Array.from(activeMap.values());
  }

  // ==================== DEPLOYMENT TRACKING ====================

  public trackDeployment(event: DeploymentEvent): void {
    this.metrics.deployments.push(event);
    this.saveMetrics();
    console.log('📊 [EconomyMetricsService] Deployment tracked:', event);
  }

  public getDeployments(filters?: {
    success?: boolean;
    startDate?: number;
    endDate?: number;
  }): DeploymentEvent[] {
    let filtered = [...this.metrics.deployments];
    
    if (filters) {
      if (filters.success !== undefined) {
        filtered = filtered.filter(d => d.success === filters.success);
      }
      if (filters.startDate) {
        filtered = filtered.filter(d => d.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filtered = filtered.filter(d => d.timestamp <= filters.endDate!);
      }
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getDeploymentStats(period: 'day' | 'week' | 'month' = 'month'): {
    total: number;
    successful: number;
    unsuccessful: number;
    successRate: number;
  } {
    const now = Date.now();
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    
    const startDate = now - periodMs[period];
    const deployments = this.getDeployments({ startDate });
    
    const successful = deployments.filter(d => d.success).length;
    const unsuccessful = deployments.filter(d => !d.success).length;
    
    return {
      total: deployments.length,
      successful,
      unsuccessful,
      successRate: deployments.length > 0 ? (successful / deployments.length) * 100 : 0
    };
  }

  // ==================== PROJECT CREATION TRACKING ====================

  public trackProjectCreation(event: ProjectCreationEvent): void {
    this.metrics.projectCreations.push(event);
    this.saveMetrics();
    console.log('📊 [EconomyMetricsService] Project creation tracked:', event);
  }

  public getProjectCreations(filters?: {
    startDate?: number;
    endDate?: number;
  }): ProjectCreationEvent[] {
    let filtered = [...this.metrics.projectCreations];
    
    if (filters) {
      if (filters.startDate) {
        filtered = filtered.filter(p => p.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filtered = filtered.filter(p => p.timestamp <= filters.endDate!);
      }
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ==================== CYCLE CONSUMPTION TRACKING ====================

  public trackCycleConsumption(event: CycleConsumptionEvent): void {
    this.metrics.cycleConsumptions.push(event);
    this.saveMetrics();
    console.log('📊 [EconomyMetricsService] Cycle consumption tracked:', event);
  }

  public getTotalCyclesConsumed(period?: 'day' | 'week' | 'month'): bigint {
    const now = Date.now();
    const periodMs = period ? {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    }[period] : undefined;
    
    const startDate = periodMs ? now - periodMs : undefined;
    let consumptions = [...this.metrics.cycleConsumptions];
    
    if (startDate) {
      consumptions = consumptions.filter(c => c.timestamp >= startDate);
    }
    
    return consumptions.reduce((total, c) => total + c.cyclesConsumed, BigInt(0));
  }

  public getCyclesByUser(userId?: string): Map<string, bigint> {
    const userCycles = new Map<string, bigint>();
    
    for (const consumption of this.metrics.cycleConsumptions) {
      const key = userId || consumption.userId;
      const current = userCycles.get(key) || BigInt(0);
      userCycles.set(key, current + consumption.cyclesConsumed);
    }
    
    return userCycles;
  }

  // ==================== CYCLE BALANCE TRACKING ====================

  public updateUserCycleBalance(balance: UserCycleBalance): void {
    const index = this.metrics.userCycleBalances.findIndex(
      b => b.userId === balance.userId
    );
    
    if (index >= 0) {
      this.metrics.userCycleBalances[index] = balance;
    } else {
      this.metrics.userCycleBalances.push(balance);
    }
    
    this.saveMetrics();
  }

  public updateServerPairCycleBalance(balance: ServerPairCycleBalance): void {
    const index = this.metrics.serverPairCycleBalances.findIndex(
      b => b.serverPairId === balance.serverPairId
    );
    
    if (index >= 0) {
      this.metrics.serverPairCycleBalances[index] = balance;
    } else {
      this.metrics.serverPairCycleBalances.push(balance);
    }
    
    this.saveMetrics();
  }

  public getUserCycleBalances(): UserCycleBalance[] {
    return [...this.metrics.userCycleBalances];
  }

  public getServerPairCycleBalances(): ServerPairCycleBalance[] {
    return [...this.metrics.serverPairCycleBalances];
  }

  // ==================== CREDITS BALANCE TRACKING ====================

  public updateUserCreditsBalance(balance: UserCreditsBalance): void {
    const index = this.metrics.userCreditsBalances.findIndex(
      b => b.userId === balance.userId
    );
    
    if (index >= 0) {
      this.metrics.userCreditsBalances[index] = balance;
    } else {
      this.metrics.userCreditsBalances.push(balance);
    }
    
    this.saveMetrics();
  }

  public getUserCreditsBalances(): UserCreditsBalance[] {
    return [...this.metrics.userCreditsBalances];
  }

  public getTotalUserCredits(): number {
    return this.metrics.userCreditsBalances.reduce(
      (total, b) => total + b.credits,
      0
    );
  }

  // ==================== MASTER WALLET TRACKING ====================

  public updateMasterWalletBalance(balance: MasterWalletBalance): void {
    this.metrics.masterWalletBalance = balance;
    this.saveMetrics();
  }

  public getMasterWalletBalance(): MasterWalletBalance | null {
    return this.metrics.masterWalletBalance;
  }

  // ==================== PROFIT TRACKING ====================

  private updateProfit(amount: number, source: 'subscription' | 'transaction' | 'commission'): void {
    const now = Date.now();
    const dayStart = new Date(now).setHours(0, 0, 0, 0);
    const weekStart = now - (7 * 24 * 60 * 60 * 1000);
    const monthStart = now - (30 * 24 * 60 * 60 * 1000);
    
    // This is a simplified calculation - in production, you'd track individual transactions
    // and calculate profit based on revenue minus costs
    this.metrics.profit.total += amount;
    
    // For now, we'll recalculate daily/weekly/monthly from subscription events
    this.recalculateProfit();
  }

  private recalculateProfit(): void {
    const now = Date.now();
    const dayStart = new Date(now).setHours(0, 0, 0, 0);
    const weekStart = now - (7 * 24 * 60 * 60 * 1000);
    const monthStart = now - (30 * 24 * 60 * 60 * 1000);
    
    const dailySubs = this.metrics.subscriptions.filter(
      s => s.timestamp >= dayStart && (s.eventType === 'subscribed' || s.eventType === 'renewed')
    );
    const weeklySubs = this.metrics.subscriptions.filter(
      s => s.timestamp >= weekStart && (s.eventType === 'subscribed' || s.eventType === 'renewed')
    );
    const monthlySubs = this.metrics.subscriptions.filter(
      s => s.timestamp >= monthStart && (s.eventType === 'subscribed' || s.eventType === 'renewed')
    );
    
    this.metrics.profit.daily = dailySubs.reduce((sum, s) => sum + s.priceUSD, 0);
    this.metrics.profit.weekly = weeklySubs.reduce((sum, s) => sum + s.priceUSD, 0);
    this.metrics.profit.monthly = monthlySubs.reduce((sum, s) => sum + s.priceUSD, 0);
    this.metrics.profit.total = this.metrics.subscriptions
      .filter(s => s.eventType === 'subscribed' || s.eventType === 'renewed')
      .reduce((sum, s) => sum + s.priceUSD, 0);
    this.metrics.profit.lastUpdated = now;
    
    this.saveMetrics();
  }

  public getProfit(): PlatformProfit {
    this.recalculateProfit();
    return { ...this.metrics.profit };
  }

  // ==================== EMPLOYEE COMPENSATION ====================

  public getEmployees(): EmployeeCompensation[] {
    try {
      const stored = localStorage.getItem(EMPLOYEES_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('❌ [EconomyMetricsService] Error loading employees:', error);
    }
    return [];
  }

  public saveEmployee(employee: EmployeeCompensation): void {
    const employees = this.getEmployees();
    const index = employees.findIndex(e => e.employeeId === employee.employeeId);
    
    if (index >= 0) {
      employees[index] = employee;
    } else {
      employees.push(employee);
    }
    
    localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees));
  }

  public calculateEmployeeCompensation(employeeId: string, metrics: {
    deploymentsFacilitated: number;
    usersOnboarded: number;
    revenueGenerated: number;
    customerSatisfaction: number;
  }): EmployeeCompensation {
    const employees = this.getEmployees();
    const employee = employees.find(e => e.employeeId === employeeId);
    
    if (!employee) {
      throw new Error(`Employee ${employeeId} not found`);
    }
    
    let calculatedCompensation: number;
    let performanceMultiplier: number;
    
    // If baseSalary is 0, use PURE commission-based model (100% performance-based)
    if (employee.baseSalary === 0) {
      // Pure commission calculation based on platform revenue and performance
      // This makes compensation 100% tied to platform success
      const performanceScore = (
        metrics.deploymentsFacilitated * 0.3 +
        metrics.usersOnboarded * 0.2 +
        (metrics.revenueGenerated / 1000) * 0.3 +
        metrics.customerSatisfaction * 0.2
      ) / 100; // Normalize to 0-1
      
      // Commission model: Direct percentage of revenue + performance bonuses
      // Base commission: 5% of revenue generated
      const baseCommission = metrics.revenueGenerated * 0.05;
      
      // Performance bonus multiplier (0.5x to 2.0x based on overall performance)
      performanceMultiplier = 0.5 + (performanceScore * 1.5);
      
      // Additional bonuses for specific achievements
      const deploymentBonus = metrics.deploymentsFacilitated * 10; // $10 per deployment
      const onboardingBonus = metrics.usersOnboarded * 25; // $25 per user onboarded
      const satisfactionBonus = (metrics.customerSatisfaction / 100) * 100; // Up to $100 for perfect satisfaction
      
      // Total compensation = (base commission * multiplier) + bonuses
      calculatedCompensation = (baseCommission * performanceMultiplier) + deploymentBonus + onboardingBonus + satisfactionBonus;
    } else {
      // Traditional model: baseSalary with performance multiplier
      const performanceScore = (
        metrics.deploymentsFacilitated * 0.3 +
        metrics.usersOnboarded * 0.2 +
        (metrics.revenueGenerated / 1000) * 0.3 +
        metrics.customerSatisfaction * 0.2
      ) / 100; // Normalize to 0-1
      
      performanceMultiplier = 0.5 + (performanceScore * 1.5); // 0.5x to 2.0x
      calculatedCompensation = employee.baseSalary * performanceMultiplier;
    }
    
    const updated: EmployeeCompensation = {
      ...employee,
      performanceMultiplier,
      metrics,
      calculatedCompensation,
      lastUpdated: Date.now()
    };
    
    this.saveEmployee(updated);
    return updated;
  }

  // ==================== UTILITY METHODS ====================

  public getAllMetrics(): PlatformMetrics {
    return { ...this.metrics };
  }

  public clearMetrics(): void {
    this.metrics = this.getDefaultMetrics();
    this.saveMetrics();
  }

  public exportMetrics(): string {
    return JSON.stringify(this.serializeMetrics(this.metrics), null, 2);
  }
}

export const economyMetricsService = EconomyMetricsService.getInstance();

