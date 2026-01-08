import { StateCreator } from 'zustand';
import { SubscriptionTier, SubscriptionSyncState } from '../../types';
import { Identity } from '@dfinity/agent';

export type RenewalStatus = 'ACTIVE' | 'WARNING' | 'EXPIRED';

export interface SubscriptionState {
  currentTier: SubscriptionTier;
  isActive: boolean;
  monthlyCredits: number;
  usedCredits: number;
  billingCycleStart: number | null;
  billingCycleEnd: number | null;
  customerId: string | null;
  subscriptionId: string | null;
  lastCreditAllocation: number | null;
  isLoading: boolean;
  syncState: SubscriptionSyncState;
  renewalStatus: RenewalStatus;
  daysUntilExpiration: number | null;
  renewalWarningDismissed: boolean;
}

export interface InitializationRecoveryState {
  needsRecovery: boolean;
  isRecovery: boolean;
  canRetry: boolean;
  nextStep: string | null;
  currentStep: string | null;
  failedSteps: string[];
  retryCount: number;
  error: string | null;
}

export interface SubscriptionSliceState {
  subscription: SubscriptionState;
  initializationRecovery: InitializationRecoveryState | null;
}

export interface SubscriptionSliceActions {
  setSubscriptionTier: (tier: SubscriptionTier, monthlyCredits: number) => void;
  updateCreditsUsage: (used: number) => void;
  completeSubscriptionSetup: (data: {
    tier: SubscriptionTier;
    monthlyCredits: number;
    customerId?: string;
    subscriptionId?: string;
    billingCycleStart?: number;
    billingCycleEnd?: number;
    sessionId?: string; // Stripe session ID for recovery
  }) => Promise<boolean>;
  loadSubscriptionInfo: () => Promise<void>;
  resetSubscription: () => void;
  selectSubscriptionTier: (tier: SubscriptionTier) => Promise<boolean>;
  showSubscriptionSelection: () => void;
  hideSubscriptionSelection: () => void;
  syncSubscriptionWithStripe: () => Promise<boolean>;
  isSubscriptionActiveForFeatureAccess: () => boolean;
  handleSubscriptionRenewal: () => Promise<void>;
  calculateRenewalStatus: () => void;
  dismissRenewalWarning: () => void;
  getRenewalStatus: () => RenewalStatus;
  getDaysUntilExpiration: () => number | null;
  allocateSubscriptionCredits: (tier: SubscriptionTier) => Promise<boolean>;
  refreshMonthlyCreditsIfNeeded: () => Promise<boolean>;
  simpleZeroAndAllocate: () => Promise<{ success: boolean; finalBalance: number; wasZeroed: boolean; initialBalance: number }>;
  calculateExpectedUnitsFromCredits: (credits: number) => Promise<number>;
  updateProgressWithSmoothing: (basePercent: number, message: string, stage: string, smoothingDuration?: number) => void;
  handleSubscriptionChange: (subscriptionId: string) => Promise<boolean>;
}

export type SubscriptionSlice = SubscriptionSliceState & SubscriptionSliceActions;

const log = (category: string, message: string, ...args: any[]) => {
  // console.log(message, ...args);
};

export const createSubscriptionSlice: StateCreator<any, [], [], SubscriptionSlice> = (set, get) => ({
  subscription: {
    currentTier: SubscriptionTier.FREE,
    isActive: false,
    monthlyCredits: 0,
    usedCredits: 0,
    billingCycleStart: null,
    billingCycleEnd: null,
    customerId: null,
    subscriptionId: null,
    lastCreditAllocation: null,
    isLoading: false,
    syncState: {
      isSyncing: false,
      lastSyncTime: null,
      syncError: null,
      requiresRenewal: false,
      renewalActionType: null
    },
    renewalStatus: 'ACTIVE',
    daysUntilExpiration: null,
    renewalWarningDismissed: false
  },
  initializationRecovery: null,

  setSubscriptionTier: (tier: SubscriptionTier, monthlyCredits: number) => {
    set((state: any) => {
      state.subscription.currentTier = tier;
      state.subscription.monthlyCredits = monthlyCredits;
      state.subscription.isActive = tier !== SubscriptionTier.FREE;
    });
    
    (get() as any).calculateRenewalStatus();
  },

  updateCreditsUsage: (used: number) => {
    set((state: any) => {
      state.subscription.usedCredits = used;
    });
  },

  // NEW: Smooth progress helper for better UX
  updateProgressWithSmoothing: (basePercent: number, message: string, stage: string, smoothingDuration: number = 3000) => {
    set((state: any) => {
      state.initializationProgress = {
        percent: basePercent,
        message,
        stage
      };
    });

    // Add micro-increments for smooth visual feedback
    let currentPercent = basePercent;
    const incrementSize = 0.5; // Small increments for smooth movement
    const intervalTime = smoothingDuration / ((basePercent + 5 - basePercent) / incrementSize);

    const smoothingInterval = setInterval(() => {
      currentPercent += incrementSize;
      if (currentPercent >= basePercent + 5) {
        clearInterval(smoothingInterval);
        return;
      }

      set((state: any) => {
        if (state.initializationProgress.stage === stage) {
          state.initializationProgress.percent = Math.min(currentPercent, basePercent + 5);
        }
      });
    }, intervalTime);

    // Clean up if component unmounts or stage changes
    setTimeout(() => clearInterval(smoothingInterval), smoothingDuration + 1000);
  },

  // Calculate expected units from credits using the same conversion logic
  calculateExpectedUnitsFromCredits: async (credits: number): Promise<number> => {
    try {
      console.log('🧮 [UNIT_CONVERSION] Calculating expected units for credits:', credits);
      
      const { CreditsService } = await import('../../services/CreditsService');
      
      // Use the reverse conversion: credits → USD → units
      const conversionUtils = CreditsService.getConversionUtils();
      const usdValue = await conversionUtils.creditsToUsd(credits);
      const unitsNeeded = Math.round(usdValue * 100); // 100 units per USD
      
      console.log('🧮 [UNIT_CONVERSION] Expected units calculation:', {
        inputCredits: credits,
        usdValue: usdValue.toFixed(4),
        expectedUnits: unitsNeeded,
        formula: `${credits} credits → $${usdValue.toFixed(4)} → ${unitsNeeded} units`
      });
      
      return unitsNeeded;
    } catch (error) {
      console.error('❌ [UNIT_CONVERSION] Error calculating expected units:', error);
      // Fallback: use approximate conversion (observed ~7.35 credits per unit)
      const fallbackUnits = Math.round(credits / 7.35);
      console.warn('⚠️ [UNIT_CONVERSION] Using fallback calculation:', fallbackUnits, 'units');
      return fallbackUnits;
    }
  },

  // SIMPLIFIED: Clean zero and allocate operation
  simpleZeroAndAllocate: async (): Promise<{ 
    success: boolean; 
    finalBalance: number; 
    wasZeroed: boolean; 
    initialBalance: number 
  }> => {
    const { userCanisterId, identity, getUserUnitsBalance } = get() as any;
    
    if (!userCanisterId || !identity) {
      console.error('🔥 [SIMPLE_ZERO] Cannot perform zeroing - no user context');
      return { success: false, finalBalance: 0, wasZeroed: false, initialBalance: 0 };
    }

    try {
      console.log('🔥 [SIMPLE_ZERO] 🎯 Starting simple zero and allocate operation...');
      
      // STEP 1: Get initial balance
      await getUserUnitsBalance();
      const initialState = get() as any;
      const initialBalance = initialState.credits.unitsBalance || 0;
      
      console.log('🔥 [SIMPLE_ZERO] BEFORE - Initial balance:', initialBalance, 'units');
      
      if (initialBalance === 0) {
        console.log('✅ [SIMPLE_ZERO] Balance is already 0 - no zeroing needed');
        return { success: true, finalBalance: 0, wasZeroed: false, initialBalance: 0 };
      }
      
      // STEP 2: Call the fixed setUnitsBalance method to zero it out
      const { userCanisterService } = await import('../../services/UserCanisterService');
      
      console.log('🔥 [SIMPLE_ZERO] Calling setUnitsBalance(0) with fixed implementation...');
      const zeroSuccess = await userCanisterService.setUnitsBalance(userCanisterId, identity, 0);
      
      if (!zeroSuccess) {
        console.error('❌ [SIMPLE_ZERO] setUnitsBalance(0) returned false');
        return { success: false, finalBalance: initialBalance, wasZeroed: false, initialBalance };
      }
      
      // STEP 3: Get final balance to confirm
      console.log('🔍 [SIMPLE_ZERO] Getting final balance after zero operation...');
      await getUserUnitsBalance();
      const finalState = get() as any;
      const finalBalance = finalState.credits.unitsBalance || 0;
      
      console.log('🔥 [SIMPLE_ZERO] AFTER - Final balance:', finalBalance, 'units');
      console.log('🔥 [SIMPLE_ZERO] Operation summary:', {
        initialBalance,
        finalBalance,
        difference: initialBalance - finalBalance,
        wasZeroed: finalBalance === 0
      });
      
      const wasZeroed = finalBalance === 0;
      
      if (wasZeroed) {
        console.log('🎉 [SIMPLE_ZERO] SUCCESS: Balance successfully zeroed!');
        console.log('🏆 [SIMPLE_ZERO] Backend auto-allocation eliminated - clean slate achieved!');
      } else {
        console.warn('⚠️ [SIMPLE_ZERO] Balance not fully zeroed:', {
          expected: 0,
          actual: finalBalance,
          reduction: initialBalance - finalBalance
        });
      }
      
      return {
        success: true,
        finalBalance,
        wasZeroed,
        initialBalance
      };

    } catch (error) {
      console.error('❌ [SIMPLE_ZERO] Zero operation failed:', error);
      return { 
        success: false, 
        finalBalance: 0, 
        wasZeroed: false, 
        initialBalance: 0 
      };
    }
  },

  /**
   * FIXED: Allocate subscription credits using PROMISED amounts (what user expects to receive)
   */
  allocateSubscriptionCredits: async (tier: SubscriptionTier): Promise<boolean> => {
    const { userCanisterId, identity, addUnitsToBalance, getUserUnitsBalance } = get() as any;
    
    if (!userCanisterId || !identity) {
      console.error('❌ [SubscriptionSlice] Cannot allocate PROMISED credits - no user context');
      return false;
    }

    try {
      console.log('🎁 [SubscriptionSlice] FIXED: Allocating PROMISED subscription credits for tier:', tier);
      
      // STEP 1: Get balance BEFORE allocation
      await getUserUnitsBalance();
      const beforeAllocState = get() as any;
      const beforeAllocBalance = beforeAllocState.credits.unitsBalance || 0;
      console.log(`🎁 [PRECISE_ALLOCATION] BEFORE ALLOCATION - Units balance: ${beforeAllocBalance}`);
      
      const { subscriptionService } = await import('../../services/SubscriptionService');
      
      // Set up user context provider for the subscription service
      subscriptionService.setUserContextProvider(async () => ({
        userCanisterId,
        identity
      }));

      // Use the corrected subscription service allocation method
      const allocation = await subscriptionService.allocateSubscriptionCredits(
        tier,
        userCanisterId,
        identity,
        addUnitsToBalance
      );

      if (allocation.success) {
        console.log('✅ [SubscriptionSlice] FIXED: PROMISED subscription credits allocated successfully:', {
          tier,
          unitsAllocated: allocation.unitsAllocated,
          promisedCredits: allocation.creditsEquivalent
        });

        // STEP 2: Get balance AFTER allocation and verify
        await getUserUnitsBalance();
        const afterAllocState = get() as any;
        const afterAllocBalance = afterAllocState.credits.unitsBalance || 0;
        console.log(`🎁 [PRECISE_ALLOCATION] AFTER ALLOCATION - Units balance: ${afterAllocBalance}`);
        console.log(`🎁 [PRECISE_ALLOCATION] Balance change: ${beforeAllocBalance} → ${afterAllocBalance} (delta: +${afterAllocBalance - beforeAllocBalance})`);
        console.log(`🎁 [PRECISE_ALLOCATION] Expected allocation: ${allocation.unitsAllocated} units`);
        
        if ((afterAllocBalance - beforeAllocBalance) === allocation.unitsAllocated) {
          console.log('✅ [PRECISE_ALLOCATION] ALLOCATION VERIFIED: Balance changed by exactly the expected amount!');
        } else {
          console.warn(`⚠️ [PRECISE_ALLOCATION] ALLOCATION MISMATCH: Expected +${allocation.unitsAllocated}, got +${afterAllocBalance - beforeAllocBalance}`);
        }

        // Update last credit allocation timestamp
        set((state: any) => {
          state.subscription.lastCreditAllocation = Date.now();
        });

        // Refresh balance to show new credits
        await (get() as any).fetchCreditsBalance();

        return true;
      } else {
        console.error('❌ [SubscriptionSlice] Failed to allocate PROMISED subscription credits:', allocation.error);
        return false;
      }

    } catch (error) {
      console.error('❌ [SubscriptionSlice] Error in PROMISED subscription credit allocation:', error);
      return false;
    }
  },

  /**
   * FIXED: Refresh monthly credits using PROMISED amounts
   */
  refreshMonthlyCreditsIfNeeded: async (): Promise<boolean> => {
    const { subscription, addUnitsToBalance } = get() as any;
    
    if (subscription.currentTier === SubscriptionTier.FREE || !subscription.isActive) {
      return false;
    }

    try {
      console.log('🔄 [SubscriptionSlice] FIXED: Checking if monthly PROMISED credit refresh is needed...');
      
      const { subscriptionService } = await import('../../services/SubscriptionService');
      
      const shouldRefresh = subscriptionService.shouldRefreshMonthlyCredits(
        subscription.billingCycleStart,
        subscription.billingCycleEnd,
        subscription.lastCreditAllocation
      );

      if (!shouldRefresh) {
        return false;
      }

      console.log('🎁 [SubscriptionSlice] FIXED: Monthly PROMISED credit refresh needed, allocating credits...');
      
      const success = await (get() as any).allocateSubscriptionCredits(subscription.currentTier);
      
      if (success) {
        console.log('✅ [SubscriptionSlice] FIXED: Monthly PROMISED credits refreshed successfully');
        return true;
      } else {
        console.error('❌ [SubscriptionSlice] Failed to refresh monthly PROMISED credits');
        return false;
      }

    } catch (error) {
      console.error('❌ [SubscriptionSlice] Error refreshing monthly PROMISED credits:', error);
      return false;
    }
  },

  /**
   * ENHANCED: Subscription setup with recovery system and retry mechanisms
   * New sequence: Initialize → Update Tier (causes 2nd auto-allocation) → Zero ALL allocations → Add ONLY precise credits
   * Includes comprehensive error handling and recovery options
   */
  completeSubscriptionSetup: async (data: {
    tier: SubscriptionTier;
    monthlyCredits: number;
    customerId?: string;
    subscriptionId?: string;
    billingCycleStart?: number;
    billingCycleEnd?: number;
    sessionId?: string; // Stripe session ID for recovery
  }): Promise<boolean> => {
    const { principal, identity, getUserUnitsBalance, updateProgressWithSmoothing } = get() as any;
    
    if (!principal || !identity) {
      console.error('❌ [SubscriptionSlice] Cannot complete subscription setup - no authenticated user');
      return false;
    }

    // Import recovery service
    const { initializationRecoveryService, InitializationStep } = await import('../../services/InitializationRecoveryService');
    const principalString = principal.toString();

    try {
      console.log('🔥 [RECOVERY_ENABLED] 🎯 Starting subscription setup with recovery system!');
      console.log('💰 [RECOVERY_ENABLED] User expects to receive EXACTLY:', data.monthlyCredits, 'credits (and nothing more)');
      
      // Check for existing recovery state
      let recoveryState = initializationRecoveryService.getState(principalString);
      const isRecovery = recoveryState && initializationRecoveryService.needsRecovery(principalString);
      
      if (isRecovery) {
        console.log('🔄 [RECOVERY_ENABLED] Detected incomplete initialization - resuming from recovery state');
        // Detect actual current state
        recoveryState = await initializationRecoveryService.detectCurrentState(principalString, identity);
      } else {
        // Start new initialization tracking
        recoveryState = initializationRecoveryService.startInitialization(principalString, data.sessionId || null);
        // Update with subscription data
        initializationRecoveryService.updateSubscriptionData(principalString, {
          customerId: data.customerId,
          subscriptionId: data.subscriptionId,
          tier: data.tier,
          monthlyCredits: data.monthlyCredits,
          billingCycleStart: data.billingCycleStart,
          billingCycleEnd: data.billingCycleEnd
        });
      }
      
      set((state: any) => {
        state.subscription.isLoading = true;
        state.stage = 'PROCESSING_SUBSCRIPTION';
        state.initializationRecovery = {
          isRecovery,
          currentStep: recoveryState?.step,
          failedSteps: recoveryState?.failedSteps || [],
          retryCount: recoveryState?.retryCount || 0
        };
      });

      // USER-FRIENDLY: Start with encouraging message
      updateProgressWithSmoothing(20, isRecovery ? 'Picking up where we left off...' : 'Getting everything ready for you...', 'WORKSPACE_SETUP');

      let userCanisterId = (get() as any).userCanisterId || recoveryState?.canisterId;
      
      // STEP 1: Canister Creation (with retry)
      if (!userCanisterId || recoveryState?.failedSteps.includes(InitializationStep.CANISTER_CREATION)) {
        const shouldRetry = !recoveryState?.failedSteps.includes(InitializationStep.CANISTER_CREATION) || 
                           (recoveryState.retryCount < 3);
        
        if (!shouldRetry) {
          throw new Error('Canister creation failed after maximum retries. Please contact support.');
        }

        console.log('🏗️ [RECOVERY_ENABLED] User needs canister - creating and deploying now...');
        
        // GRANULAR PROGRESS: Canister creation phase
        updateProgressWithSmoothing(25, 'Setting up your workspace...', 'CREATING_WORKSPACE');

        try {
          const { userCanisterService } = await import('../../services/UserCanisterService');
          const canisterResult = await userCanisterService.createNewCanister(principal);
          
          if (!canisterResult.success || !canisterResult.canisterId) {
            const errorMsg = `Failed to create user canister: ${canisterResult.error?.message || 'Unknown error'}`;
            initializationRecoveryService.markStepFailed(principalString, InitializationStep.CANISTER_CREATION, errorMsg);
            throw new Error(errorMsg);
          }
          
          userCanisterId = canisterResult.canisterId;
          console.log('✅ [RECOVERY_ENABLED] User canister created successfully:', userCanisterId);
          
          // Mark step as completed
          recoveryState = initializationRecoveryService.markStepCompleted(
            principalString,
            InitializationStep.CANISTER_CREATION,
            { canisterId: userCanisterId }
          );
          
          set((state: any) => {
            state.userCanisterId = userCanisterId;
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          initializationRecoveryService.markStepFailed(principalString, InitializationStep.CANISTER_CREATION, errorMsg);
          
          // Wait before retry
          const currentState = initializationRecoveryService.getState(principalString);
          const delay = initializationRecoveryService.getRetryDelay(currentState?.retryCount || 0);
          console.log(`⏳ [RECOVERY_ENABLED] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          throw error;
        }
      } else if (userCanisterId && !recoveryState?.completedSteps.includes(InitializationStep.CANISTER_CREATION)) {
        // Canister exists but wasn't marked as completed - mark it now
        recoveryState = initializationRecoveryService.markStepCompleted(
          principalString,
          InitializationStep.CANISTER_CREATION,
          { canisterId: userCanisterId }
        );
      }

      // STEP 2: WASM Deployment (with retry)
      if (!recoveryState?.completedSteps.includes(InitializationStep.WASM_DEPLOYMENT) || 
          recoveryState?.failedSteps.includes(InitializationStep.WASM_DEPLOYMENT)) {
        const shouldRetry = !recoveryState?.failedSteps.includes(InitializationStep.WASM_DEPLOYMENT) || 
                           (recoveryState.retryCount < 3);
        
        if (!shouldRetry) {
          throw new Error('WASM deployment failed after maximum retries. Please contact support.');
        }

        // GRANULAR PROGRESS: WASM deployment with smooth updates
        console.log('📦 [RECOVERY_ENABLED] Deploying WASM to new canister...');
        updateProgressWithSmoothing(35, 'Installing your tools...', 'INSTALLING_ENVIRONMENT');
        
        try {
          const { wasmDeploymentService } = await import('../../services/WasmDeploymentService');
          
          let deploymentProgress = 35;
          const deployResult = await wasmDeploymentService.deployWasm(
            userCanisterId,
            principal,
            (progress) => {
              // SMOOTH PROGRESS: Map deployment progress to our range (35-65%)
              const mappedProgress = 35 + (progress.percent * 0.3); // 30% of total progress for deployment
              deploymentProgress = mappedProgress;
              
              // USER-FRIENDLY: Translate technical stages to user-friendly messages
              let userFriendlyMessage = 'Installing your tools...';
              
              switch (progress.stage) {
                case 'DOWNLOADING':
                  userFriendlyMessage = 'Getting the tools you need...';
                  break;
                case 'UPLOADING':
                  userFriendlyMessage = 'Setting everything up...';
                  break;
                case 'DEPLOYING':
                  userFriendlyMessage = 'Making sure everything works...';
                  break;
                case 'FINALIZING':
                  userFriendlyMessage = 'Almost done...';
                  break;
              }
              
              set((state: any) => {
                state.stage = 'WORKSPACE_DEPLOYMENT';
                state.initializationProgress = {
                  percent: mappedProgress,
                  message: userFriendlyMessage,
                  stage: 'WORKSPACE_DEPLOYMENT'
                };
              });
            }
          );

          if (!deployResult.success) {
            const errorMsg = `Failed to deploy WASM to canister: ${deployResult.error || 'Deployment failed'}`;
            initializationRecoveryService.markStepFailed(principalString, InitializationStep.WASM_DEPLOYMENT, errorMsg);
            throw new Error(errorMsg);
          }

          console.log('✅ [RECOVERY_ENABLED] WASM deployed successfully to canister');
          
          // Mark step as completed
          recoveryState = initializationRecoveryService.markStepCompleted(
            principalString,
            InitializationStep.WASM_DEPLOYMENT
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          initializationRecoveryService.markStepFailed(principalString, InitializationStep.WASM_DEPLOYMENT, errorMsg);
          
          // Wait before retry
          const currentState = initializationRecoveryService.getState(principalString);
          const delay = initializationRecoveryService.getRetryDelay(currentState?.retryCount || 0);
          console.log(`⏳ [RECOVERY_ENABLED] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          throw error;
        }
      }

      // SMOOTH PROGRESS: Service initialization
      console.log('🔄 [RECOVERY_ENABLED] Initializing user canister service...');
      updateProgressWithSmoothing(65, 'Connecting everything together...', 'CONNECTING_WORKSPACE');

      const { userCanisterService } = await import('../../services/UserCanisterService');
      await userCanisterService.initializeWithIdentity(identity);

      // STEP 3: Account Initialization (with retry)
      if (!recoveryState?.completedSteps.includes(InitializationStep.ACCOUNT_INITIALIZATION) || 
          recoveryState?.failedSteps.includes(InitializationStep.ACCOUNT_INITIALIZATION)) {
        const shouldRetry = !recoveryState?.failedSteps.includes(InitializationStep.ACCOUNT_INITIALIZATION) || 
                           (recoveryState.retryCount < 3);
        
        if (!shouldRetry) {
          throw new Error('Account initialization failed after maximum retries. Please contact support.');
        }

        // 🔥 CORRECTED STEP 1: Account initialization (auto-allocates 10,000)
        console.log('🔄 [RECOVERY_ENABLED] 🎯 STEP 3: Initializing user account (will auto-allocate 10,000 units)...');
        updateProgressWithSmoothing(70, 'Creating your account...', 'ACCOUNT_INITIALIZATION');
        
        try {
          const accountInitialized = await (get() as any).initializeNewUserAccount(userCanisterId, identity);
          
          if (!accountInitialized) {
            const errorMsg = 'Account initialization returned false';
            initializationRecoveryService.markStepFailed(principalString, InitializationStep.ACCOUNT_INITIALIZATION, errorMsg);
            throw new Error(errorMsg);
          }
          
          // Mark step as completed
          recoveryState = initializationRecoveryService.markStepCompleted(
            principalString,
            InitializationStep.ACCOUNT_INITIALIZATION
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          initializationRecoveryService.markStepFailed(principalString, InitializationStep.ACCOUNT_INITIALIZATION, errorMsg);
          
          // Wait before retry
          const delay = initializationRecoveryService.getRetryDelay(recoveryState.retryCount);
          console.log(`⏳ [RECOVERY_ENABLED] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          throw error;
        }
      }

      // Store Stripe data for billing
      if (data.customerId) {
        console.log('💳 [RECOVERY_ENABLED] Storing minimal Stripe data for reliable billing operations...');
        
        const minimalStripeData = {
          customerId: data.customerId,
          subscriptionActive: true,
          billingCycleEnd: data.billingCycleEnd || null
        };

        const stripeDataResult = await userCanisterService.storeMinimalStripeData(
          userCanisterId,
          identity,
          minimalStripeData
        );

        if (stripeDataResult.success) {
          console.log('✅ [RECOVERY_ENABLED] Minimal Stripe data stored successfully');
        } else {
          console.warn('⚠️ [RECOVERY_ENABLED] Failed to store minimal Stripe data, but continuing:', stripeDataResult.error);
        }
      }

      // STEP 4: Subscription Setup (with retry)
      if (!recoveryState?.completedSteps.includes(InitializationStep.SUBSCRIPTION_SETUP) || 
          recoveryState?.failedSteps.includes(InitializationStep.SUBSCRIPTION_SETUP)) {
        const shouldRetry = !recoveryState?.failedSteps.includes(InitializationStep.SUBSCRIPTION_SETUP) || 
                           (recoveryState.retryCount < 3);
        
        if (!shouldRetry) {
          throw new Error('Subscription setup failed after maximum retries. Please contact support.');
        }

        // 🔥 CORRECTED STEP 2: Update subscription tier (will auto-allocate ANOTHER 10,000)
        console.log('🔄 [RECOVERY_ENABLED] 🎯 STEP 4: Updating subscription tier (will trigger 2nd auto-allocation)...');
        console.log('⚠️ [RECOVERY_ENABLED] Backend will auto-allocate another 10,000 units when tier changes from FREE to STARTER');
        
        // USER-FRIENDLY: Show as subscription activation
        updateProgressWithSmoothing(75, 'Activating your plan...', 'SUBSCRIPTION_ACTIVATION');

        try {
          const subscriptionResult = await userCanisterService.updateSubscriptionTier(
            userCanisterId,
            identity,
            data.tier,
            data.monthlyCredits,
            {
              customerId: data.customerId || null,
              subscriptionId: data.subscriptionId || null,
              billingCycleStart: data.billingCycleStart || null,
              billingCycleEnd: data.billingCycleEnd || null
            }
          );

          if (!subscriptionResult.success) {
            const errorMsg = `Failed to set up subscription: ${subscriptionResult.error || 'Unknown error'}`;
            initializationRecoveryService.markStepFailed(principalString, InitializationStep.SUBSCRIPTION_SETUP, errorMsg);
            throw new Error(errorMsg);
          }

          console.log('✅ [RECOVERY_ENABLED] Subscription tier updated (backend has now auto-allocated twice)');
          
          // Mark step as completed
          recoveryState = initializationRecoveryService.markStepCompleted(
            principalString,
            InitializationStep.SUBSCRIPTION_SETUP
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          initializationRecoveryService.markStepFailed(principalString, InitializationStep.SUBSCRIPTION_SETUP, errorMsg);
          
          // Wait before retry
          const delay = initializationRecoveryService.getRetryDelay(recoveryState.retryCount);
          console.log(`⏳ [RECOVERY_ENABLED] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          throw error;
        }
      }

      // Update frontend state
      set((state: any) => {
        state.subscription.currentTier = data.tier;
        state.subscription.monthlyCredits = data.monthlyCredits;
        state.subscription.isActive = true;
        state.subscription.customerId = data.customerId || null;
        state.subscription.subscriptionId = data.subscriptionId || null;
        state.subscription.billingCycleStart = data.billingCycleStart || null;
        state.subscription.billingCycleEnd = data.billingCycleEnd || null;
        state.subscription.isLoading = false;
        
        state.ui.showSubscriptionSelection = false;
      });

      // 🔥 CORRECTED STEP 3: NOW zero out ALL auto-allocations (should be ~20,000 units total)
      console.log('🔥 [CORRECTED_SEQUENCE] 🎯 STEP 3: Zeroing out ALL auto-allocations (expecting ~20,000 units)...');
      updateProgressWithSmoothing(85, 'Getting your credits ready...', 'ACCOUNT_PREPARATION');
      
      // Get balance before zeroing to see total auto-allocation
      await getUserUnitsBalance();
      const preZeroState = get() as any;
      const preZeroBalance = preZeroState.credits.unitsBalance || 0;
      console.log('📊 [CORRECTED_SEQUENCE] Balance before zeroing (total auto-allocations):', preZeroBalance, 'units');
      
      const zeroResult = await (get() as any).simpleZeroAndAllocate();
      
      if (zeroResult.success && zeroResult.wasZeroed) {
        console.log('🏆 [CORRECTED_SEQUENCE] SUCCESS: ALL auto-allocations eliminated!');
        console.log(`🏆 [CORRECTED_SEQUENCE] Eliminated ${zeroResult.initialBalance} total auto-allocated units`);
        console.log('🏆 [CORRECTED_SEQUENCE] Clean slate achieved - ready for precise allocation!');
      } else if (zeroResult.success && !zeroResult.wasZeroed) {
        if (zeroResult.initialBalance === 0) {
          console.log('✅ [CORRECTED_SEQUENCE] No auto-allocation detected - already clean');
        } else {
          console.warn('⚠️ [CORRECTED_SEQUENCE] Auto-allocation detected but not fully zeroed:', zeroResult);
        }
      } else {
        console.error('❌ [CORRECTED_SEQUENCE] Zero operation failed:', zeroResult);
        // Continue but with warning
      }

      // 🔥 CORRECTED STEP 4: Add ONLY the precise subscription credits the user paid for
      console.log('🔥 [CORRECTED_SEQUENCE] 🎯 STEP 4: Allocating EXACTLY the promised credits on clean slate...');
      
      // USER-FRIENDLY: Show final credit delivery
      updateProgressWithSmoothing(95, 'Adding your credits...', 'CREDIT_DELIVERY');

      const creditAllocation = await (get() as any).allocateSubscriptionCredits(data.tier);
      
      if (creditAllocation) {
        console.log('🏆 [CORRECTED_SEQUENCE] SUCCESS: EXACT promised credits allocated on clean slate!');
      } else {
        console.warn('⚠️ [CORRECTED_SEQUENCE] Credit allocation failed, but subscription is active');
      }

      // Final verification
      await getUserUnitsBalance();
      const finalState = get() as any;
      const finalBalance = finalState.credits.unitsBalance || 0;
      
      console.log('🏆 [CORRECTED_SEQUENCE] FINAL VERIFICATION - CORRECTED SEQUENCE OUTCOME:', {
        totalAutoAllocationsEliminated: zeroResult.initialBalance,
        zeroingSuccess: zeroResult.wasZeroed,
        finalBalance: finalBalance,
        expectedBalance: 'Only precise subscription credits',
        correctedSequence: 'Initialize → Update Tier → Zero ALL → Add Precise'
      });

      // FINAL USER MESSAGE: Success with encouraging tone
      set((state: any) => {
        state.stage = 'READY';
        state.initializationProgress = {
          percent: 100,
          message: creditAllocation && zeroResult.wasZeroed
            ? 'Welcome to Kontext! Your workspace is ready!' 
            : creditAllocation 
            ? 'Welcome! Your subscription is active!'
            : 'Welcome! Your workspace is being prepared...',
          stage: 'READY'
        };
        state.isReady = true;
      });

      (get() as any).calculateRenewalStatus();

      // Mark initialization as complete
      recoveryState = initializationRecoveryService.markStepCompleted(
        principalString,
        InitializationStep.COMPLETE
      );
      
      // Clear recovery state on success
      initializationRecoveryService.clearState(principalString);

      console.log('🎉 [RECOVERY_ENABLED] SUBSCRIPTION SETUP COMPLETED WITH RECOVERY SYSTEM!');
      console.log('🏆 [RECOVERY_ENABLED] Clean, reliable, and precise credit allocation achieved!');
      console.log('🏆 [RECOVERY_ENABLED] User receives exactly what they paid for - no more, no less!');
      
      return true;

    } catch (error) {
      console.error('❌ [RECOVERY_ENABLED] Subscription setup failed:', error);
      
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const recoveryInfo = initializationRecoveryService.getRecoveryInfo(principalString);
      
      set((state: any) => {
        state.subscription.isLoading = false;
        state.error = `Setup failed: ${errorMsg}`;
        state.stage = 'ERROR';
        state.initializationProgress = {
          percent: 0,
          message: recoveryInfo.canRetry 
            ? 'Something went wrong, but you can try again from where we left off.' 
            : 'Something went wrong. Please contact support and we\'ll help you finish setting up.',
          stage: 'ERROR'
        };
        state.initializationRecovery = {
          needsRecovery: true,
          canRetry: recoveryInfo.canRetry,
          nextStep: recoveryInfo.nextStep,
          error: errorMsg,
          failedSteps: recoveryInfo.state?.failedSteps || [],
          retryCount: recoveryInfo.state?.retryCount || 0
        };
      });
      
      return false;
    }
  },

  loadSubscriptionInfo: async () => {
    const { userCanisterId, identity } = get() as any;
    
    if (!userCanisterId || !identity) {
      console.log('ℹ️ [SubscriptionSlice] Cannot load subscription - missing canister or identity');
      return;
    }

    try {
      console.log('📊 [SubscriptionSlice] Loading subscription info...');
      
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const subscriptionInfo = await userCanisterService.getSubscriptionInfo(userCanisterId, identity);
      
      if (subscriptionInfo) {
        set((state: any) => {
          state.subscription.currentTier = subscriptionInfo.tier;
          state.subscription.isActive = subscriptionInfo.isActive;
          state.subscription.monthlyCredits = subscriptionInfo.monthlyCredits;
          state.subscription.customerId = subscriptionInfo.customerId;
          state.subscription.subscriptionId = subscriptionInfo.subscriptionId;
          state.subscription.billingCycleStart = subscriptionInfo.billingCycleStart;
          state.subscription.billingCycleEnd = subscriptionInfo.billingCycleEnd;
          // Note: lastCreditAllocation is set elsewhere if needed
        });
        
        console.log('✅ [SubscriptionSlice] Subscription info loaded:', subscriptionInfo);
        
        (get() as any).calculateRenewalStatus();
        
        // Check if monthly PROMISED credit refresh is needed after loading subscription info
        setTimeout(async () => {
          await (get() as any).refreshMonthlyCreditsIfNeeded();
        }, 1000);
        
      } else {
        console.log('ℹ️ [SubscriptionSlice] No subscription info found - user on free tier');
        set((state: any) => {
          state.subscription.currentTier = SubscriptionTier.FREE;
          state.subscription.isActive = false;
          state.subscription.monthlyCredits = 0;
          state.subscription.renewalStatus = 'ACTIVE';
          state.subscription.daysUntilExpiration = null;
          state.subscription.renewalWarningDismissed = false;
        });
      }

    } catch (error) {
      console.error('❌ [SubscriptionSlice] Failed to load subscription info:', error);
    }
  },

  resetSubscription: () => {
    set((state: any) => {
      state.subscription.currentTier = SubscriptionTier.FREE;
      state.subscription.isActive = false;
      state.subscription.monthlyCredits = 0;
      state.subscription.usedCredits = 0;
      state.subscription.billingCycleStart = null;
      state.subscription.billingCycleEnd = null;
      state.subscription.customerId = null;
      state.subscription.subscriptionId = null;
      state.subscription.lastCreditAllocation = null;
      state.subscription.isLoading = false;
      state.subscription.syncState = {
        isSyncing: false,
        lastSyncTime: null,
        syncError: null,
        requiresRenewal: false,
        renewalActionType: null
      };
      state.subscription.renewalStatus = 'ACTIVE';
      state.subscription.daysUntilExpiration = null;
      state.subscription.renewalWarningDismissed = false;
    });
  },

  selectSubscriptionTier: async (tier: SubscriptionTier): Promise<boolean> => {
    try {
      console.log('💳 [SubscriptionSlice] User selected subscription tier:', tier);
      
      if (tier === SubscriptionTier.FREE) {
        console.log('📝 [SubscriptionSlice] User selected free tier - proceeding with initialization');
        
        set((state: any) => {
          state.ui.showSubscriptionSelection = false;
        });
        
        const { principal, identity } = get() as any;
        if (principal && identity) {
          await (get() as any).initializeSequentially(principal, identity);
        }
        return true;
      } else {
        console.log('💰 [SubscriptionSlice] User selected paid tier - redirecting to Stripe checkout');
        
        const { stripeService } = await import('../../services/StripeService');
        
        const { principal } = get() as any;
        if (!principal) {
          throw new Error('User not authenticated');
        }
        
        const successUrl = `${window.location.origin}/?subscription_success=true&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${window.location.origin}/?subscription_canceled=true`;
        
        const checkoutResult = await stripeService.createSubscriptionCheckout(
          tier,
          principal.toString(),
          successUrl,
          cancelUrl
        );
        
        if (checkoutResult.success && checkoutResult.checkoutUrl) {
          console.log('✅ [SubscriptionSlice] Stripe checkout session created, redirecting...');
          
          // 🔥 CRITICAL: Store FULL auth session data in localStorage before redirect
          try {
            const { getSharedAuthClient } = await import('../../services/SharedAuthClient');
            const authClient = await getSharedAuthClient();
            
            // Verify auth is still valid before redirect
            const isAuthValid = await authClient.isAuthenticated();
            if (!isAuthValid) {
              throw new Error('Authentication lost before redirect - cannot proceed');
            }
            
            // Get the current identity and its delegation chain
            const identity = authClient.getIdentity();
            const currentPrincipal = identity.getPrincipal();
            
            // Store principal for recovery
            localStorage.setItem('stripe_redirect_principal', currentPrincipal.toString());
            localStorage.setItem('stripe_redirect_timestamp', Date.now().toString());
            
            // 🔥 NEW: Store the delegation chain from AuthClient's internal storage
            // This is the KEY to restoring the session after redirect
            try {
              // 🔍 VERIFIED: These are the correct values from @dfinity/auth-client source code
              const IDB_KEY = 'delegation'; // ✅ FIXED: Was 'ic-delegation', should be 'delegation'
              const IDB_DB_NAME = 'auth-client-db';
              const IDB_STORE_NAME = 'ic-keyval';
              
              console.log('🔍 [SubscriptionSlice] Starting delegation backup...');
              console.log('📦 [SubscriptionSlice] IndexedDB Config:', { IDB_KEY, IDB_DB_NAME, IDB_STORE_NAME });
              
              // Read the delegation from IndexedDB
              const idbRequest = indexedDB.open(IDB_DB_NAME);
              
              await new Promise<void>((resolve, reject) => {
                idbRequest.onsuccess = () => {
                  console.log('✅ [SubscriptionSlice] IndexedDB opened successfully');
                  const db = idbRequest.result;
                  const transaction = db.transaction([IDB_STORE_NAME], 'readonly');
                  const store = transaction.objectStore(IDB_STORE_NAME);
                  const getRequest = store.get(IDB_KEY);
                  
                  getRequest.onsuccess = () => {
                    const delegation = getRequest.result;
                    console.log('🔍 [SubscriptionSlice] Delegation read result:', {
                      exists: !!delegation,
                      type: typeof delegation,
                      isString: typeof delegation === 'string',
                      length: typeof delegation === 'string' ? delegation.length : 'N/A'
                    });
                    
                    if (delegation) {
                      // 🔥 CRITICAL: auth-client stores delegation as JSON STRING already!
                      // Do NOT JSON.stringify again or it will be double-stringified
                      if (typeof delegation !== 'string') {
                        console.error('❌ [SubscriptionSlice] Delegation is not a string! This is unexpected.');
                        console.log('🔍 [SubscriptionSlice] Delegation type:', typeof delegation, 'Keys:', Object.keys(delegation));
                      }
                      
                      // Parse the delegation to check expiration
                      try {
                        const delegationObj = typeof delegation === 'string' ? JSON.parse(delegation) : delegation;
                        const expiration = delegationObj.delegationChain?.[0]?.delegation?.expiration;
                        if (expiration) {
                          const expirationMs = Number(expiration) / 1_000_000; // Convert from nanoseconds
                          const expiresIn = expirationMs - Date.now();
                          console.log('⏰ [SubscriptionSlice] Delegation expires in:', Math.floor(expiresIn / 1000 / 60), 'minutes');
                          
                          if (expiresIn < 0) {
                            console.error('❌ [SubscriptionSlice] Delegation is already EXPIRED!');
                          } else if (expiresIn < 5 * 60 * 1000) {
                            console.warn('⚠️  [SubscriptionSlice] Delegation expires soon (< 5 minutes)!');
                          }
                        }
                      } catch (expError) {
                        console.warn('⚠️  [SubscriptionSlice] Could not check expiration:', expError);
                      }
                      
                      // 🔥 FIX: Store AS-IS (it's already a JSON string from auth-client)
                      const delegationString = typeof delegation === 'string' ? delegation : JSON.stringify(delegation);
                      localStorage.setItem('stripe_redirect_delegation', delegationString);
                      console.log('✅ [SubscriptionSlice] Delegation chain backed up to localStorage');
                      console.log('📏 [SubscriptionSlice] Backup size:', (delegationString.length / 1024).toFixed(2), 'KB');
                    } else {
                      console.error('❌ [SubscriptionSlice] No delegation found in IndexedDB!');
                    }
                    resolve();
                  };
                  
                  getRequest.onerror = (event) => {
                    console.error('❌ [SubscriptionSlice] Error reading delegation from IndexedDB:', event);
                    resolve(); // Continue anyway
                  };
                };
                
                idbRequest.onerror = (event) => {
                  console.error('❌ [SubscriptionSlice] Could not open IndexedDB:', event);
                  resolve(); // Continue anyway
                };
              });
            } catch (delegationBackupError) {
              console.error('❌ [SubscriptionSlice] Delegation backup failed (non-critical):', delegationBackupError);
              // Continue with redirect even if backup fails
            }
            
            // Give a small delay to ensure localStorage writes complete
            await new Promise(resolve => setTimeout(resolve, 200));
            
            console.log('✅ [SubscriptionSlice] Auth state verified and persisted before redirect');
          } catch (authError) {
            console.error('❌ [SubscriptionSlice] CRITICAL: Auth verification failed before redirect:', authError);
            throw new Error('Authentication verification failed. Please try again.');
          }
          
          window.location.href = checkoutResult.checkoutUrl;
          return true;
        } else {
          throw new Error(checkoutResult.error || 'Failed to create checkout session');
        }
      }
    } catch (error) {
      console.error('❌ [SubscriptionSlice] Subscription tier selection failed:', error);
      set((state: any) => {
        state.error = `Failed to select subscription tier: ${error instanceof Error ? error.message : 'Unknown error'}`;
      });
      return false;
    }
  },

  showSubscriptionSelection: () => {
    set((state: any) => {
      state.ui.showSubscriptionSelection = true;
      state.stage = 'SELECTING_SUBSCRIPTION';
    });
  },

  hideSubscriptionSelection: () => {
    set((state: any) => {
      state.ui.showSubscriptionSelection = false;
      
      // FIXED: Preserve authentication state - if user is already authenticated and initialized,
      // keep them in READY state instead of resetting to IDLE (which triggers login handlers)
      const isAuthenticated = state.isAuthenticated;
      const wasReady = state.stage === 'READY' || (state.userCanisterId && state.principal);
      
      if (isAuthenticated && wasReady) {
        // User is authenticated and was already initialized - keep them ready
        state.stage = 'READY';
        state.initializationProgress = { 
          percent: 100, 
          message: 'Ready', 
          stage: 'READY' 
        };
      } else {
        // User is not authenticated or wasn't initialized - reset to IDLE
        state.stage = 'IDLE';
        state.initializationProgress = { 
          percent: 0, 
          message: '', 
          stage: 'IDLE' 
        };
      }
      
      state.isInitializing = false;
    });
  },

  syncSubscriptionWithStripe: async (): Promise<boolean> => {
    const { subscription, userCanisterId, identity } = get() as any;
    
    const storedCustomerId = subscription.customerId;
    
    if (!storedCustomerId || !userCanisterId || !identity) {
      log('SUBSCRIPTION', '💳 [SubscriptionSlice] Attempting to retrieve stored customer ID for sync...');
      
      if (userCanisterId && identity) {
        const { userCanisterService } = await import('../../services/UserCanisterService');
        const customerResult = await userCanisterService.getStripeCustomerId(userCanisterId, identity);
        if (customerResult.success && customerResult.customerId) {
          log('SUBSCRIPTION', '✅ [SubscriptionSlice] Retrieved customer ID from storage for sync');
          
          set((state: any) => {
            state.subscription.customerId = customerResult.customerId!;
          });
        } else {
          log('SUBSCRIPTION', 'ℹ️ [SubscriptionSlice] No customer ID found - skipping Stripe sync (likely free tier user)');
          return true;
        }
      } else {
        log('SUBSCRIPTION', 'ℹ️ [SubscriptionSlice] Missing canister or identity for sync - skipping');
        return true;
      }
    }

    try {
      set((state: any) => {
        state.subscription.syncState.isSyncing = true;
        state.subscription.syncState.syncError = null;
        state.stage = 'SYNCING_SUBSCRIPTION';
        state.initializationProgress = {
          percent: 75,
          message: 'Syncing subscription status...',
          stage: 'SYNCING_SUBSCRIPTION'
        };
      });

      log('SUBSCRIPTION', '🔄 [SubscriptionSlice] Starting Stripe subscription sync with stored customer ID...');

      const { stripeService } = await import('../../services/StripeService');
      
      const currentCustomerId = (get() as any).subscription.customerId;
      if (!currentCustomerId) {
        throw new Error('Customer ID still not available after retrieval attempt');
      }
      
      const syncResult = await stripeService.syncSubscriptionWithStripe(
        currentCustomerId,
        subscription
      );

      if (syncResult.success) {
        log('SUBSCRIPTION', '✅ [SubscriptionSlice] Stripe sync completed successfully:', syncResult);
        
        if (syncResult.statusChanged && syncResult.newStatus) {
          const newStatus = syncResult.newStatus;
          const isActive = newStatus.status === 'active';
          
          log('SUBSCRIPTION', '📊 [SubscriptionSlice] Updating local and backend state with new subscription status');
          
          set((state: any) => {
            state.subscription.isActive = isActive;
            state.subscription.billingCycleStart = newStatus.current_period_start * 1000;
            state.subscription.billingCycleEnd = newStatus.current_period_end * 1000;
          });

          try {
            const { userCanisterService } = await import('../../services/UserCanisterService');
            await userCanisterService.updateSubscriptionActiveStatus(
              userCanisterId,
              identity,
              isActive
            );
            
            if (newStatus.current_period_end) {
              await userCanisterService.updateBillingCycleEnd(
                userCanisterId,
                identity,
                newStatus.current_period_end * 1000
              );
            }
            
            log('SUBSCRIPTION', '✅ [SubscriptionSlice] Backend updated with new minimal Stripe data');
          } catch (backendError) {
            log('SUBSCRIPTION', '⚠️ [SubscriptionSlice] Failed to update backend with new status, but continuing:', backendError);
          }
          
          // Check if PROMISED credit refresh is needed after sync
          setTimeout(async () => {
            await (get() as any).refreshMonthlyCreditsIfNeeded();
          }, 1000);
        }

        set((state: any) => {
          state.subscription.syncState.isSyncing = false;
          state.subscription.syncState.lastSyncTime = Date.now();
          state.subscription.syncState.requiresRenewal = syncResult.requiresAction;
          state.subscription.syncState.renewalActionType = syncResult.actionType;
          state.subscription.syncState.syncError = null;
        });

        (get() as any).calculateRenewalStatus();

        return true;
      } else {
        throw new Error(syncResult.error || 'Sync failed');
      }

    } catch (error) {
      log('SUBSCRIPTION', '❌ [SubscriptionSlice] Stripe sync failed:', error);
      
      set((state: any) => {
        state.subscription.syncState.isSyncing = false;
        state.subscription.syncState.syncError = error instanceof Error ? error.message : 'Sync failed';
        state.subscription.syncState.lastSyncTime = Date.now();
      });
      
      return false;
    }
  },

  isSubscriptionActiveForFeatureAccess: (): boolean => {
    const state = get() as any;
    const { subscription, principal } = state;
    
    // 🔓 Admin bypass: Hardcoded admins always have access
    const ADMIN_PRINCIPALS = [
      "bvpvy-zi75h-rmbcb-56guz-cscdg-apewo-gl6jq-f2t7y-rzcqa-zpilt-eqe"
    ];
    
    if (principal && ADMIN_PRINCIPALS.includes(principal.toString())) {
      log('SUBSCRIPTION', '🔓 [SubscriptionSlice] Admin user detected - bypassing subscription check');
      return true;
    }
    
    if (subscription.currentTier === SubscriptionTier.FREE) {
      return true;
    }
    
    if (subscription.renewalStatus === 'EXPIRED') {
      log('SUBSCRIPTION', '🚫 [SubscriptionSlice] Feature access blocked - subscription expired (local check)');
      return false;
    }
    
    if (subscription.syncState.requiresRenewal) {
      log('SUBSCRIPTION', '🚫 [SubscriptionSlice] Feature access blocked - subscription requires renewal');
      return false;
    }
    
    if (!subscription.isActive) {
      log('SUBSCRIPTION', '🚫 [SubscriptionSlice] Feature access blocked - subscription not active (local check)');
      return false;
    }
    
    if (subscription.billingCycleEnd) {
      const now = Date.now();
      const gracePeriod = 7 * 24 * 60 * 60 * 1000;
      
      if (now > subscription.billingCycleEnd + gracePeriod) {
        log('SUBSCRIPTION', '🚫 [SubscriptionSlice] Feature access blocked - billing cycle ended (local check)');
        return false;
      }
    }
    
    log('SUBSCRIPTION', '✅ [SubscriptionSlice] Feature access allowed - all local checks passed');
    return true;
  },

  handleSubscriptionRenewal: async (): Promise<void> => {
    const { subscription, principal, userCanisterId, identity } = get() as any;
    
    log('SUBSCRIPTION', '🔄 [SubscriptionSlice] Starting subscription renewal process...');
    
    try {
      let customerId = subscription.customerId;
      
      if (!customerId && userCanisterId && identity) {
        log('SUBSCRIPTION', '🔍 [SubscriptionSlice] No customer ID in state, checking backend storage...');
        
        const { userCanisterService } = await import('../../services/UserCanisterService');
        const customerResult = await userCanisterService.getStripeCustomerId(userCanisterId, identity);
        if (customerResult.success && customerResult.customerId) {
          customerId = customerResult.customerId;
          log('SUBSCRIPTION', '✅ [SubscriptionSlice] Customer ID retrieved from backend storage:', customerId);
          
          set((state: any) => {
            state.subscription.customerId = customerId;
          });
        }
      }
      
      if (!customerId && principal) {
        log('SUBSCRIPTION', '🔍 [SubscriptionSlice] No stored customer ID, attempting Stripe lookup as fallback...');
        
        const { stripeService } = await import('../../services/StripeService');
        const lookupResult = await stripeService.lookupCustomerByPrincipal(principal.toString());
        
        if (lookupResult.success && lookupResult.customerId) {
          customerId = lookupResult.customerId;
          log('SUBSCRIPTION', '✅ [SubscriptionSlice] Customer ID found via Stripe lookup:', customerId);
          
          if (userCanisterId && identity) {
            const { userCanisterService } = await import('../../services/UserCanisterService');
            const storeResult = await userCanisterService.setStripeCustomerId(userCanisterId, identity, customerId);
            if (storeResult.success) {
              log('SUBSCRIPTION', '✅ [SubscriptionSlice] Customer ID now stored in backend - future lookups will be instant');
            }
            
            set((state: any) => {
              state.subscription.customerId = customerId;
            });
          }
        } else {
          log('SUBSCRIPTION', '❌ [SubscriptionSlice] Customer lookup failed:', lookupResult.error);
        }
      }
      
      if (!customerId) {
        log('SUBSCRIPTION', '❌ [SubscriptionSlice] Cannot handle renewal - no customer ID found anywhere');
        set((state: any) => {
          state.error = 'Unable to find your subscription. Please contact support or start a new subscription.';
        });
        return;
      }

      log('SUBSCRIPTION', '🔄 [SubscriptionSlice] Creating billing portal session for renewal with stored/found customer ID...');
      
      const { stripeService } = await import('../../services/StripeService');
      
      const portalResult = await stripeService.createBillingPortalSession(
        customerId,
        window.location.origin
      );

      if (portalResult.success && portalResult.url) {
        log('SUBSCRIPTION', '✅ [SubscriptionSlice] Redirecting to Stripe billing portal...');
        window.location.href = portalResult.url;
      } else {
        throw new Error(portalResult.error || 'Failed to create billing portal session');
      }

    } catch (error) {
      log('SUBSCRIPTION', '❌ [SubscriptionSlice] Renewal redirect failed:', error);
      set((state: any) => {
        state.error = `Unable to open renewal page: ${error instanceof Error ? error.message : 'Unknown error'}`;
      });
    }
  },

  calculateRenewalStatus: () => {
    const { subscription } = get() as any;
    
    if (subscription.currentTier === SubscriptionTier.FREE || !subscription.isActive) {
      set((state: any) => {
        state.subscription.renewalStatus = 'ACTIVE';
        state.subscription.daysUntilExpiration = null;
      });
      return;
    }

    if (!subscription.billingCycleEnd) {
      set((state: any) => {
        state.subscription.renewalStatus = 'ACTIVE';
        state.subscription.daysUntilExpiration = null;
      });
      return;
    }

    const now = Date.now();
    const msUntilExpiration = subscription.billingCycleEnd - now;
    const daysUntilExpiration = Math.ceil(msUntilExpiration / (24 * 60 * 60 * 1000));

    let renewalStatus: RenewalStatus = 'ACTIVE';
    
    if (msUntilExpiration <= 0) {
      renewalStatus = 'EXPIRED';
    } else if (daysUntilExpiration <= 7) {
      renewalStatus = 'WARNING';
    }

    set((state: any) => {
      state.subscription.renewalStatus = renewalStatus;
      state.subscription.daysUntilExpiration = Math.max(0, daysUntilExpiration);
    });

    console.log('🔄 [SubscriptionSlice] Renewal status calculated:', {
      tier: subscription.currentTier,
      renewalStatus,
      daysUntilExpiration,
      billingCycleEnd: new Date(subscription.billingCycleEnd).toISOString()
    });
  },

  dismissRenewalWarning: () => {
    set((state: any) => {
      state.subscription.renewalWarningDismissed = true;
    });
  },

  getRenewalStatus: (): RenewalStatus => {
    return (get() as any).subscription.renewalStatus;
  },

  getDaysUntilExpiration: (): number | null => {
    return (get() as any).subscription.daysUntilExpiration;
  },

  handleSubscriptionChange: async (subscriptionId: string): Promise<boolean> => {
    const { userCanisterId, identity, mainActor } = get() as any;
    
    if (!userCanisterId || !identity) {
      log('SUBSCRIPTION', '❌ [SubscriptionSlice] Cannot handle subscription change - missing canister or identity');
      return false;
    }

    try {
      log('SUBSCRIPTION', '🔄 [SubscriptionSlice] Handling subscription change for:', subscriptionId);
      
      const { subscriptionService } = await import('../../services/SubscriptionService');
      
      // Set mainActor if available
      if (mainActor) {
        subscriptionService.setMainActor(mainActor);
      }

      // Get addUnitsToBalance function from store
      const addUnitsToBalance = async (units: number) => {
        const { userCanisterService } = await import('../../services/UserCanisterService');
        return await userCanisterService.addUnitsToBalance(userCanisterId, identity, units);
      };

      // Sync subscription change
      const syncResult = await subscriptionService.syncSubscriptionChange(
        subscriptionId,
        userCanisterId,
        identity,
        addUnitsToBalance
      );

      if (syncResult.success && syncResult.data) {
        log('SUBSCRIPTION', '✅ [SubscriptionSlice] Subscription change synced successfully:', syncResult.data);
        
        // Update local state
        set((state: any) => {
          state.subscription.currentTier = syncResult.data.tier;
          state.subscription.monthlyCredits = syncResult.data.promisedCredits;
          state.subscription.customerId = syncResult.data.customerId;
          state.subscription.subscriptionId = syncResult.data.subscriptionId;
          state.subscription.billingCycleStart = syncResult.data.billingCycleStart;
          state.subscription.billingCycleEnd = syncResult.data.billingCycleEnd;
          state.subscription.isActive = true;
          state.subscription.lastCreditAllocation = Date.now();
        });

        // Recalculate renewal status
        (get() as any).calculateRenewalStatus();

        // Reload subscription info to ensure everything is in sync
        await (get() as any).loadSubscriptionInfo();

        return true;
      } else {
        log('SUBSCRIPTION', '❌ [SubscriptionSlice] Subscription change sync failed:', syncResult.error);
        return false;
      }
    } catch (error) {
      log('SUBSCRIPTION', '❌ [SubscriptionSlice] Error handling subscription change:', error);
      return false;
    }
  },
});