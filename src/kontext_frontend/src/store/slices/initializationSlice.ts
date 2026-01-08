import { StateCreator } from 'zustand';
import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/agent';
import { initializationCacheService } from '../../services/InitializationCache';

export type InitializationStage = 
  | 'IDLE'
  | 'AUTHENTICATING'
  | 'AUTH_COMPLETE'
  | 'CHECKING_CANISTER'
  | 'CREATING_CANISTER'
  | 'DOWNLOADING_WASM'
  | 'UPLOADING_WASM'
  | 'DEPLOYING_WASM'
  | 'FINALIZING_WASM'
  | 'CANISTER_READY'
  | 'INITIALIZING_USER_ACCOUNT'
  | 'LOADING_PROJECTS'
  | 'SELECTING_SUBSCRIPTION'
  | 'PROCESSING_SUBSCRIPTION'
  | 'SYNCING_SUBSCRIPTION'
  | 'INITIALIZING_CANISTER'
  | 'SETTING_CREDITS'
  | 'READY'
  | 'ERROR';

export interface InitializationProgress {
  percent: number;
  message: string;
  stage: InitializationStage;
}

export interface InitializationSliceState {
  stage: InitializationStage;
  initializationProgress: InitializationProgress;
  userCanisterId: string | null;
  isReady: boolean;
  isInitializing: boolean;
  error: string | null;
  retryCount: number;
}

export interface InitializationSliceActions {
  setStage: (stage: InitializationStage) => void;
  setProgress: (progress: InitializationProgress) => void;
  initializeSequentially: (principal: Principal, identity: Identity) => Promise<void>;
  initializeUserCanister: (principal: Principal, identity: Identity) => Promise<boolean>;
  retryInitialization: () => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
  incrementRetry: () => void;
}

export type InitializationSlice = InitializationSliceState & InitializationSliceActions;

const HARDCODED_CANISTER_ID = 'pnnbf-iiaaa-aaaaa-qcfea-cai';
// 🔓 Admin principals that bypass subscription checks
const ADMIN_PRINCIPALS = [
  'bvpvy-zi75h-rmbcb-56guz-cscdg-apewo-gl6jq-f2t7y-rzcqa-zpilt-eqe'
];

// UPDATED: Removed wallet-related progress stages, added credits setting stage
const PROGRESS_STAGES = {
  CONNECTING: { percent: 5, message: "Connecting to Internet Identity...", stage: 'AUTHENTICATING' as const },
  CHECKING: { percent: 15, message: "Checking existing setup...", stage: 'CHECKING_CANISTER' as const },
  CONNECTING_EXISTING: { percent: 30, message: "Connecting to your environment...", stage: 'CHECKING_CANISTER' as const },
  VERIFYING_ACCESS: { percent: 65, message: "Verifying access permissions...", stage: 'CANISTER_READY' as const },
  SYNCING_SUBSCRIPTION: { percent: 75, message: "Syncing subscription status...", stage: 'SYNCING_SUBSCRIPTION' as const },
  SETTING_CREDITS: { percent: 85, message: "Setting up your credits...", stage: 'SETTING_CREDITS' as const },
  LOADING_UNITS_BALANCE: { percent: 90, message: "Loading your units balance...", stage: 'CANISTER_READY' as const },
  READY: { percent: 100, message: "Connected successfully!", stage: 'READY' as const },
  PREPARING: { percent: 25, message: "Preparing your personal environment...", stage: 'CREATING_CANISTER' as const },
  CREATING: { percent: 35, message: "Creating your personal canister...", stage: 'CREATING_CANISTER' as const },
  DOWNLOADING: { percent: 45, message: "Downloading user canister code...", stage: 'DOWNLOADING_WASM' as const },
  UPLOADING: { percent: 60, message: "Uploading to your canister...", stage: 'UPLOADING_WASM' as const },
  DEPLOYING: { percent: 85, message: "Deploying to your canister...", stage: 'DEPLOYING_WASM' as const },
  FINALIZING: { percent: 95, message: "Finalizing setup...", stage: 'FINALIZING_WASM' as const },
  INITIALIZING_USER_ACCOUNT: { percent: 90, message: "Setting up your account...", stage: 'INITIALIZING_USER_ACCOUNT' as const },
  COMPLETE: { percent: 100, message: "Setup complete!", stage: 'READY' as const }
};

const log = (category: string, message: string, ...args: any[]) => {
  console.log(message, ...args);
};

export const createInitializationSlice: StateCreator<any, [], [], InitializationSlice> = (set, get) => ({
  stage: 'IDLE',
  initializationProgress: { percent: 0, message: '', stage: 'IDLE' },
  userCanisterId: null,
  isReady: false,
  isInitializing: false,
  error: null,
  retryCount: 0,

  setStage: (stage: InitializationStage) => {
    set((state: any) => {
      state.stage = stage;
    });
  },

  setProgress: (progress: InitializationProgress) => {
    set((state: any) => {
      state.initializationProgress = progress;
      state.stage = progress.stage;
    });
  },

  initializeSequentially: async (principal: Principal, identity: Identity) => {
    try {
      log('AUTH', '🔄 Starting sequential initialization with units-based system...');
      
      set((state: any) => {
        state.isInitializing = true;
        state.error = null;
      });

      const { userCanisterService } = await import('../../services/UserCanisterService');
      await userCanisterService.initializeWithIdentity(identity);

      const canisterReady = await (get() as any).initializeUserCanister(principal, identity);
      
      if (canisterReady) {
        const { userCanisterId } = get() as any;
        
        if (!userCanisterId) {
          throw new Error('User canister ID is required for account initialization');
        }

        // 🔥 OPTIMIZATION: Check cache for first-time user status
        const cachedUserInit = initializationCacheService.getCachedUserInit(principal);
        let isFirstTime: boolean;
        
        if (cachedUserInit && cachedUserInit.lastChecked && (Date.now() - cachedUserInit.lastChecked) < 24 * 60 * 60 * 1000) {
          // Use cached value if checked within last 24 hours
          isFirstTime = cachedUserInit.isFirstTimeUser;
          log('SUBSCRIPTION', `✅ Using cached first-time user status: ${isFirstTime ? 'NEW USER' : 'EXISTING USER'}`);
        } else {
          // Check from canister and cache result
          isFirstTime = await (get() as any).checkIfFirstTimeUser(userCanisterId, identity);
          
          // Update cache with new check
          if (cachedUserInit) {
            initializationCacheService.setCachedUserInit(principal, {
              ...cachedUserInit,
              isFirstTimeUser: isFirstTime,
              lastChecked: Date.now()
            });
          }
        }
        
        if (isFirstTime) {
          log('SUBSCRIPTION', '🎯 First-time user detected - initializing account with default subscription');
          
          const accountInitialized = await (get() as any).initializeNewUserAccount(userCanisterId, identity);
          
          if (!accountInitialized) {
            throw new Error('Failed to initialize new user account');
          }
        } else {
          // 🔥 OPTIMIZATION: Use cached subscription/account data if available, refresh in background
          const cachedSubscription = initializationCacheService.getCachedSubscription(principal);
          
          if (cachedSubscription) {
            log('SUBSCRIPTION', '✅ Using cached subscription data - refreshing in background');
            
            // Apply cached subscription data immediately
            set((state: any) => {
              state.subscription.currentTier = cachedSubscription.currentTier;
              state.subscription.isActive = cachedSubscription.isActive;
              state.subscription.monthlyCredits = cachedSubscription.monthlyCredits;
              state.subscription.usedCredits = cachedSubscription.usedCredits;
              state.subscription.customerId = cachedSubscription.customerId;
              state.subscription.subscriptionId = cachedSubscription.subscriptionId;
              state.subscription.billingCycleEnd = cachedSubscription.billingCycleEnd;
              state.subscription.renewalStatus = cachedSubscription.renewalStatus;
              state.subscription.daysUntilExpiration = cachedSubscription.daysUntilExpiration;
              state.subscription.renewalWarningDismissed = cachedSubscription.renewalWarningDismissed;
            });
            
            // Calculate renewal status from cached data
            (get() as any).calculateRenewalStatus();
            
            // Refresh account and subscription data in background (non-blocking)
            Promise.all([
              (get() as any).syncUserAccountAndSubscriptionState(userCanisterId, identity).catch(err => {
                log('SUBSCRIPTION', '⚠️ Background account sync failed (non-critical):', err);
              }),
              (get() as any).syncSubscriptionWithStripe().catch(err => {
                log('SUBSCRIPTION', '⚠️ Background Stripe sync failed (non-critical):', err);
              })
            ]).then(() => {
              log('SUBSCRIPTION', '✅ Background sync completed');
            });
          } else {
            // No cache - do full sync (blocking)
            log('SUBSCRIPTION', '🔄 Existing user - syncing account and subscription state (no cache)');
            
            await (get() as any).syncUserAccountAndSubscriptionState(userCanisterId, identity);
            
            // Move Stripe sync to background for existing users without cache
            (get() as any).syncSubscriptionWithStripe().catch(err => {
              log('SUBSCRIPTION', '⚠️ Stripe sync failed but continuing initialization:', err);
            });
            
            (get() as any).calculateRenewalStatus();
          }
        }

        // NEW: Set units balance to 1500 on every page refresh
        set((state: any) => {
          state.stage = 'SETTING_CREDITS';
          state.initializationProgress = PROGRESS_STAGES.SETTING_CREDITS;
        });

        try {
          // 🔧 DEV MODE: Ensure exact credit amount for development/testing
          // Set DEV_RESET_CREDITS=true in localStorage to force reset to exact amount
          const { CreditsService } = await import('../../services/CreditsService');
          const targetCredits = 11000; // 🎯 Change this value to set desired credit amount
          
          // Check if we should force reset
          const shouldForceReset = localStorage.getItem('DEV_RESET_CREDITS') === 'true';
          
          // Get current balance first
          const currentUnits = await userCanisterService.getUserUnitsBalance(userCanisterId, identity);
          const currentCredits = await CreditsService.convertUnitsToCredits(currentUnits);
          
          log('CREDITS', `💰 [DEV MODE] Current balance: ${currentUnits} units (${Math.floor(currentCredits)} credits)`);
          
          if (shouldForceReset) {
            log('CREDITS', `🔄 [DEV MODE] Force reset enabled - setting to exactly ${targetCredits} credits...`);
            localStorage.removeItem('DEV_RESET_CREDITS'); // Clear flag after use
            
            // Calculate exact units needed
            const unitsNeeded = await CreditsService.calculateUnitsForCredits(targetCredits);
            
            // Use setUnitsBalance which handles both increase and decrease
            const setResult = await userCanisterService.setUnitsBalance(userCanisterId, identity, unitsNeeded);
            
            if (setResult) {
              const newUnits = await userCanisterService.getUserUnitsBalance(userCanisterId, identity);
              const newCredits = await CreditsService.convertUnitsToCredits(newUnits);
              log('CREDITS', `✅ Balance reset! New balance: ${newUnits} units (${Math.floor(newCredits)} credits)`);
            } else {
              log('CREDITS', '⚠️ Force reset failed, trying to add to target instead...');
              // Fallback: just try to reach target by adding
              if (currentCredits < targetCredits) {
                const creditsToAdd = targetCredits - Math.floor(currentCredits);
                const unitsToAdd = await CreditsService.calculateUnitsForCredits(creditsToAdd);
                await userCanisterService.addUnitsToBalance(userCanisterId, identity, unitsToAdd);
              }
            }
          } else {
            // Normal mode: only add if below target
            if (currentCredits < targetCredits) {
              const creditsToAdd = targetCredits - Math.floor(currentCredits);
              const unitsToAdd = await CreditsService.calculateUnitsForCredits(creditsToAdd);
              
              log('CREDITS', `💰 [DEV MODE] Adding ${unitsToAdd} units (${creditsToAdd} credits) to reach target...`);
              const addResult = await userCanisterService.addUnitsToBalance(userCanisterId, identity, unitsToAdd);
              
              if (addResult) {
                const newUnits = await userCanisterService.getUserUnitsBalance(userCanisterId, identity);
                const newCredits = await CreditsService.convertUnitsToCredits(newUnits);
                log('CREDITS', `✅ Successfully added credits! New balance: ${newUnits} units (${Math.floor(newCredits)} credits)`);
              } else {
                log('CREDITS', '⚠️ Failed to add units but continuing initialization');
              }
            } else {
              log('CREDITS', `✅ Balance already at or above target (${Math.floor(currentCredits)} >= ${targetCredits} credits)`);
              log('CREDITS', `💡 TIP: Run localStorage.setItem('DEV_RESET_CREDITS', 'true') in console and reload to reset to exactly ${targetCredits} credits`);
            }
          }
        } catch (creditsError) {
          log('CREDITS', '⚠️ Error managing dev credits (non-critical):', creditsError);
          // Don't fail the initialization if setting credits fails
        }

        // 🔥 OPTIMIZATION: Load projects - use cache if available, but always load to ensure fresh data
        // Note: We still load projects to ensure we have the latest list, but we don't block on it
        // if we have cached metadata indicating projects exist
        const cachedProjectsMeta = initializationCacheService.getCachedProjectsMeta(principal);
        
        if (cachedProjectsMeta && cachedProjectsMeta.hasProjects) {
          log('PROJECTS', '✅ Cached projects metadata available - loading projects in background');
          // Start loading in background (non-blocking)
          (get() as any).loadProjects().catch(err => {
            log('PROJECTS', '⚠️ Background project load failed (non-critical):', err);
          });
        } else {
          set((state: any) => {
            state.stage = 'LOADING_PROJECTS';
            state.initializationProgress = { 
              percent: 90, 
              message: 'Loading your projects...', 
              stage: 'LOADING_PROJECTS' 
            };
          });
          
          await (get() as any).loadProjects();
        }

        set((state: any) => {
          state.stage = 'READY';
          state.initializationProgress = PROGRESS_STAGES.READY;
          state.isReady = true;
          state.isInitializing = false;
        });

        // Start periodic balance updates for units and credits
        (get() as any).startPeriodicBalanceUpdate();

        log('AUTH', '✅ Sequential initialization completed with units-based system');
      } else {
        log('AUTH', '⏸️ Initialization paused - waiting for subscription selection');
        
        set((state: any) => {
          state.isInitializing = false;
        });
      }

    } catch (error) {
      log('AUTH', '❌ Sequential initialization failed:', error);
      set((state: any) => {
        state.stage = 'ERROR';
        state.error = error instanceof Error ? error.message : 'Initialization failed';
        state.isInitializing = false;
      });
    }
  },

  initializeUserCanister: async (principal: Principal, identity: Identity): Promise<boolean> => {
    try {
      set((state: any) => {
        state.stage = 'CHECKING_CANISTER';
        state.initializationProgress = PROGRESS_STAGES.CHECKING;
      });

      let userCanisterId: string | null = null;
      const currentUserPrincipal = principal.toText();

      // 🔓 Check if user is an admin - bypass subscription and use hardcoded canister
      if (ADMIN_PRINCIPALS.includes(currentUserPrincipal)) {
        console.log('🔓 [InitSlice] Admin user detected - using hardcoded canister and bypassing subscription');
        userCanisterId = HARDCODED_CANISTER_ID;
        
        set((state: any) => {
          state.stage = 'CANISTER_READY';
          state.initializationProgress = PROGRESS_STAGES.VERIFYING_ACCESS;
          state.userCanisterId = userCanisterId;
        });

        return true;
      } else {
        const { userCanisterService } = await import('../../services/UserCanisterService');
        userCanisterId = await userCanisterService.checkExistingCanister(principal);

        if (userCanisterId) {
          set((state: any) => {
            state.stage = 'CANISTER_READY';
            state.initializationProgress = PROGRESS_STAGES.VERIFYING_ACCESS;
            state.userCanisterId = userCanisterId;
          });

          return true;
        } else {
          console.log('📋 [InitSlice] New user needs subscription plan');
          set((state: any) => {
            state.stage = 'SELECTING_SUBSCRIPTION';
            state.ui.showSubscriptionSelection = true;
            state.initializationProgress = { 
              percent: 40, 
              message: 'Choose your subscription plan...', 
              stage: 'SELECTING_SUBSCRIPTION' 
            };
          });

          return false;
        }
      }
    } catch (error) {
      set((state: any) => {
        state.stage = 'ERROR';
        state.error = error instanceof Error ? error.message : 'Canister initialization failed';
      });
      return false;
    }
  },

  retryInitialization: async () => {
    const { principal, identity } = get() as any;
    
    if (principal && identity) {
      set((state: any) => {
        state.error = null;
        state.retryCount += 1;
      });
      
      await (get() as any).initializeSequentially(principal, identity);
    } else {
      await (get() as any).login();
    }
  },

  setError: (error: string | null) => {
    set((state: any) => {
      state.error = error;
    });
  },

  clearError: () => {
    set((state: any) => {
      state.error = null;
    });
  },

  incrementRetry: () => {
    set((state: any) => {
      state.retryCount += 1;
    });
  },
});