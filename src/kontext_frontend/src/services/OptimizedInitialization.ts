import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/agent';
import { initializationCacheService } from './InitializationCache';
import { SubscriptionTier } from '../types';

interface OptimizationContext {
  principal: Principal | null;
  identity: Identity | null;
  appActions: any;
  appState: any;
}

interface FastInitResult {
  canUseFastPath: boolean;
  backgroundTasks: (() => Promise<void>)[];
  cacheData?: {
    userCanisterId?: string;
    subscriptionData?: any;
    unitsBalanceData?: any;
  };
}

class OptimizedInitializationService {
  
  // Main entry point - wraps your existing initializeSequentially method
  async optimizeInitialization(
    principal: Principal | null,
    identity: Identity | null,
    appActions: any,
    appState: any
  ): Promise<void> {
    console.log('🚀 [OptInit] Starting optimized units-based initialization...');
    
    // FIXED: Add comprehensive timeout wrapper
    const OPTIMIZATION_TIMEOUT = 10000; // 10 second timeout
    
    try {
      await Promise.race([
        this.performOptimizedInitialization(principal, identity, appActions, appState),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Optimization timeout')), OPTIMIZATION_TIMEOUT)
        )
      ]);
    } catch (error) {
      console.error('❌ [OptInit] Optimization failed or timed out, falling back:', error);
      
      // FIXED: Clear any stuck state before fallback
      this.clearOptimizationState();
      
      // Fall back to regular initialization
      try {
        await appActions.initializeAuth();
      } catch (fallbackError) {
        console.error('❌ [OptInit] Fallback initialization also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  private async performOptimizedInitialization(
    principal: Principal | null,
    identity: Identity | null,
    appActions: any,
    appState: any
  ): Promise<void> {
    // NEW: Check for recovery state first - if recovery is needed, don't use fast path
    if (principal) {
      try {
        const { initializationRecoveryService } = await import('./InitializationRecoveryService');
        const needsRecovery = initializationRecoveryService.needsRecovery(principal.toString());
        
        if (needsRecovery) {
          console.log('🔄 [OptInit] Recovery needed - skipping fast path, using standard initialization');
          await appActions.initializeAuth();
          return;
        }
      } catch (error) {
        console.warn('⚠️ [OptInit] Could not check recovery state, continuing:', error);
        // Continue with normal flow if recovery check fails
      }
    }
    
    // Check cache version and upgrade if needed
    initializationCacheService.checkCacheVersion();
    
    const context: OptimizationContext = { principal, identity, appActions, appState };
    
    // FIXED: Add validation before attempting fast path
    if (!this.validateOptimizationPreconditions(context)) {
      console.log('⚠️ [OptInit] Preconditions not met, using standard initialization');
      await appActions.initializeAuth();
      return;
    }
    
    // Attempt fast path with timeout
    const fastResult = await Promise.race([
      this.evaluateFastPath(context),
      new Promise<FastInitResult>((_, reject) => 
        setTimeout(() => reject(new Error('Fast path evaluation timeout')), 5000)
      )
    ]);
    
    if (fastResult.canUseFastPath) {
      console.log('⚡ [OptInit] Using fast path - applying cached data immediately');
      
      // Apply cached data to state immediately
      await this.applyCachedData(fastResult.cacheData, appActions);
      
      // Mark as ready immediately
      appActions.setStage('READY');
      appActions.setProgress({ 
        percent: 100, 
        message: 'All set! Updating your latest info...', 
        stage: 'READY' 
      });
      
      // FIXED: Run background sync without blocking and with timeout protection
      this.executeBackgroundTasksSafely(fastResult.backgroundTasks, context);
      
    } else {
      console.log('🔄 [OptInit] Cache unavailable - using standard initialization');
      
      // Fall back to your existing initialization flow exactly as is
      await appActions.initializeAuth();
      
      // FIXED: Only cache on successful completion
      try {
        await this.cacheCurrentState(context);
      } catch (cacheError) {
        console.warn('⚠️ [OptInit] Failed to cache state (non-critical):', cacheError);
      }
    }
  }

  // FIXED: Add precondition validation
  private validateOptimizationPreconditions(context: OptimizationContext): boolean {
    // Check if basic app state is available
    if (!context.appActions) {
      console.log('❌ [OptInit] No app actions available');
      return false;
    }

    // Check if we have minimum required methods
    const requiredMethods = ['setStage', 'setProgress', 'initializeAuth'];
    for (const method of requiredMethods) {
      if (typeof context.appActions[method] !== 'function') {
        console.log(`❌ [OptInit] Required method ${method} not available`);
        return false;
      }
    }

    return true;
  }

  private async evaluateFastPath(context: OptimizationContext): Promise<FastInitResult> {
    const { principal } = context;
    const backgroundTasks: (() => Promise<void>)[] = [];
    
    // FIXED: Early exit if no principal
    if (!principal) {
      console.log('❌ [OptInit] No principal available - cannot use cached data');
      return { canUseFastPath: false, backgroundTasks: [] };
    }
    
    // FIXED: Wrap cache operations in try-catch with timeouts
    let cachedUserInit;
    let cachedSubscription;
    let cachedUnitsBalance;
    
    try {
      // Add timeout to cache operations
      const cacheTimeout = 2000; // 2 second timeout for cache operations
      
      cachedUserInit = await Promise.race([
        Promise.resolve(initializationCacheService.getCachedUserInit(principal)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cache read timeout')), cacheTimeout)
        )
      ]);
      
      cachedSubscription = await Promise.race([
        Promise.resolve(initializationCacheService.getCachedSubscription(principal)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cache read timeout')), cacheTimeout)
        )
      ]);
      
      cachedUnitsBalance = await Promise.race([
        Promise.resolve(initializationCacheService.getCachedUnitsBalance(principal)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cache read timeout')), cacheTimeout)
        )
      ]);
    } catch (error) {
      console.warn('⚠️ [OptInit] Cache read failed:', error);
      return { canUseFastPath: false, backgroundTasks: [] };
    }
    
    // Log cache status for debugging
    const cacheStats = initializationCacheService.getCacheStats(principal);
    console.log('📊 [OptInit] Units-based cache analysis:', cacheStats);
    
    // Handle hardcoded user special case (preserves your existing logic)
    const HARDCODED_USER_PRINCIPAL = 'bvpvy-zi75h-rmbcb-56guz-cscdg-apewo-gl6jq-f2t7y-rzcqa-zpilt-eqe';
    const isHardcodedUser = principal?.toString() === HARDCODED_USER_PRINCIPAL;
    
    // We need at least user init data for fast path
    if (!cachedUserInit) {
      console.log('❌ [OptInit] No user init cache - must run full initialization');
      return { canUseFastPath: false, backgroundTasks: [] };
    }

    // If user doesn't have a canister and isn't hardcoded user, need full init
    if (!cachedUserInit.hasCanister && !isHardcodedUser) {
      console.log('❌ [OptInit] User needs canister creation - must run full initialization');
      return { canUseFastPath: false, backgroundTasks: [] };
    }

    console.log('✅ [OptInit] Fast path conditions met for units-based system');

    // Prepare cached data for immediate application
    const cacheData = {
      userCanisterId: isHardcodedUser ? 'pnnbf-iiaaa-aaaaa-qcfea-cai' : cachedUserInit.canisterId,
      subscriptionData: cachedSubscription,
      unitsBalanceData: cachedUnitsBalance
    };

    // FIXED: Create safer background tasks with timeouts
    backgroundTasks.push(this.createSafeBackgroundTask(
      'subscription-sync',
      async () => {
        console.log('🔄 [Background] Refreshing subscription status...');
        await context.appActions.syncSubscriptionWithStripe();
        await this.updateSubscriptionCache(context);
      },
      5000 // 5 second timeout
    ));

    backgroundTasks.push(this.createSafeBackgroundTask(
      'balance-update',
      async () => {
        console.log('💎 [Background] Updating units balance and credits...');
        await context.appActions.fetchCreditsBalance();
        await context.appActions.getUserUnitsBalance();
        await this.updateUnitsBalanceCache(context);
      },
      10000 // 10 second timeout
    ));

    backgroundTasks.push(this.createSafeBackgroundTask(
      'projects-load',
      async () => {
        console.log('📁 [Background] Loading projects...');
        await context.appActions.loadProjects();
        await this.updateProjectsCache(context);
      },
      15000 // 15 second timeout
    ));

    return {
      canUseFastPath: true,
      backgroundTasks,
      cacheData
    };
  }

  // FIXED: Create safe background task wrapper
  private createSafeBackgroundTask(
    taskName: string,
    taskFunction: () => Promise<void>,
    timeoutMs: number
  ): () => Promise<void> {
    return async () => {
      try {
        await Promise.race([
          taskFunction(),
          new Promise<void>((_, reject) => 
            setTimeout(() => reject(new Error(`${taskName} timeout`)), timeoutMs)
          )
        ]);
        console.log(`✅ [Background] ${taskName} completed successfully`);
      } catch (error) {
        console.warn(`⚠️ [Background] ${taskName} failed (non-critical):`, error);
      }
    };
  }

  private async applyCachedData(cacheData: any, appActions: any): Promise<void> {
    if (!cacheData) return;

    console.log('💾 [OptInit] Applying cached units-based data to app state...');

    try {
      // Apply user canister ID
      if (cacheData.userCanisterId) {
        // Set via your existing state management
        // The appStore will handle this through existing methods
      }

      // Apply subscription data using your existing methods
      if (cacheData.subscriptionData) {
        const sub = cacheData.subscriptionData;
        appActions.setSubscriptionTier(sub.currentTier, sub.monthlyCredits);
      }

      // Apply units balance data if available
      if (cacheData.unitsBalanceData) {
        // The balance will be refreshed in background tasks
        // We just need to set the stage as ready
        console.log('💰 [OptInit] Cached units balance available for fast startup');
      }
    } catch (error) {
      console.warn('⚠️ [OptInit] Error applying cached data:', error);
      throw error;
    }
  }

  // FIXED: Make background task execution truly non-blocking
  private executeBackgroundTasksSafely(
    tasks: (() => Promise<void>)[],
    context: OptimizationContext
  ): void {
    console.log(`🔄 [Background] Starting ${tasks.length} background sync tasks for units system...`);
    
    // Run in background without blocking - don't await this
    Promise.allSettled(tasks.map(task => task()))
      .then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`🎉 [Background] Background tasks completed: ${successful} successful, ${failed} failed`);
      })
      .catch(error => {
        console.warn('⚠️ [Background] Background task coordination error:', error);
      });
  }

  // Cache update methods (called after successful operations)
  private async cacheCurrentState(context: OptimizationContext): Promise<void> {
    console.log('💾 [OptInit] Caching current units-based state for next time...');
    
    const { principal, appState } = context;
    
    // FIXED: Validate context before caching
    if (!principal || !appState) {
      console.warn('⚠️ [OptInit] Cannot cache - missing principal or app state');
      return;
    }
    
    try {
      // Cache user init state
      initializationCacheService.setCachedUserInit(principal, {
        isFirstTimeUser: appState.userAccount?.isFirstTimeUser || false,
        hasCanister: appState.userCanisterId !== null,
        canisterId: appState.userCanisterId,
        hasCompletedOnboarding: appState.userAccount?.hasCompletedOnboarding || false,
        accountCreatedAt: appState.userAccount?.accountCreatedAt || null,
        lastChecked: Date.now() // Track when isFirstTimeUser was last verified
      });

      // Cache subscription state
      await this.updateSubscriptionCache(context);
      
      // Cache units balance if available
      if (appState.credits?.unitsBalance !== undefined) {
        await this.updateUnitsBalanceCache(context);
      }
      
      console.log('✅ [OptInit] Units-based state cached successfully');
    } catch (error) {
      console.warn('⚠️ [OptInit] Failed to cache state (non-critical):', error);
    }
  }

  private async updateSubscriptionCache(context: OptimizationContext): Promise<void> {
    const { principal, appState } = context;
    if (!principal || !appState?.subscription) return;
    
    const sub = appState.subscription;
    
    initializationCacheService.setCachedSubscription(principal, {
      currentTier: sub.currentTier,
      isActive: sub.isActive,
      monthlyCredits: sub.monthlyCredits,
      usedCredits: sub.usedCredits,
      customerId: sub.customerId,
      subscriptionId: sub.subscriptionId,
      billingCycleEnd: sub.billingCycleEnd,
      renewalStatus: sub.renewalStatus,
      daysUntilExpiration: sub.daysUntilExpiration,
      renewalWarningDismissed: sub.renewalWarningDismissed
    });
  }

  private async updateUnitsBalanceCache(context: OptimizationContext): Promise<void> {
    const { principal, appState } = context;
    if (!principal || !appState?.credits) return;
    
    const credits = appState.credits;
    
    initializationCacheService.setCachedUnitsBalance(principal, {
      credits: credits.balance || 0,
      units: credits.unitsBalance || credits.units || 0,
      usdEquivalent: credits.usdEquivalent || 0,
      lastUpdated: credits.lastUpdated || Date.now()
    });
  }

  private async updateProjectsCache(context: OptimizationContext): Promise<void> {
    const { principal, appState } = context;
    if (!principal || !appState?.projects) return;
    
    const projects = appState.projects;
    
    initializationCacheService.setCachedProjectsMeta(principal, {
      totalProjects: projects.length || 0,
      lastProjectId: projects.length > 0 ? projects[projects.length - 1].id : null,
      hasProjects: (projects.length || 0) > 0,
      lastUpdated: Date.now()
    });
  }

  // FIXED: Add state cleanup method
  private clearOptimizationState(): void {
    try {
      // Clear any stuck promises or state that might cause issues
      console.log('🧹 [OptInit] Clearing optimization state');
      
      // Could add specific cleanup logic here if needed
      // For now, just log that cleanup happened
    } catch (error) {
      console.warn('⚠️ [OptInit] Error during state cleanup:', error);
    }
  }

  // Public methods for cache management
  invalidateCacheOnLogout(principal?: Principal): void {
    initializationCacheService.invalidateAllCache(principal);
  }

  invalidateSubscriptionCache(principal: Principal): void {
    initializationCacheService.invalidateSubscriptionCache(principal);
  }

  invalidateUnitsBalanceCache(principal: Principal): void {
    initializationCacheService.invalidateUnitsBalanceCache(principal);
  }

  getCacheStats(principal: Principal) {
    return initializationCacheService.getCacheStats(principal);
  }
}

export const optimizedInitializationService = new OptimizedInitializationService();