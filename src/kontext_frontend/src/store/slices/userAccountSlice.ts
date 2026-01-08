import { StateCreator } from 'zustand';
import { Identity } from '@dfinity/agent';

export interface UserAccountState {
  isInitialized: boolean;
  hasCompletedOnboarding: boolean;
  firstLoginAt: number | null;
  accountCreatedAt: number | null;
  isFirstTimeUser: boolean;
  initializationError: string | null;
}

export interface UserAccountSliceState {
  userAccount: UserAccountState;
}

export interface UserAccountSliceActions {
  checkIfFirstTimeUser: (userCanisterId: string, identity: Identity) => Promise<boolean>;
  initializeNewUserAccount: (userCanisterId: string, identity: Identity) => Promise<boolean>;
  syncUserAccountAndSubscriptionState: (userCanisterId: string, identity: Identity) => Promise<void>;
}

export type UserAccountSlice = UserAccountSliceState & UserAccountSliceActions;

const log = (category: string, message: string, ...args: any[]) => {
  console.log(message, ...args);
};

export const createUserAccountSlice: StateCreator<any, [], [], UserAccountSlice> = (set, get) => ({
  userAccount: {
    isInitialized: false,
    hasCompletedOnboarding: false,
    firstLoginAt: null,
    accountCreatedAt: null,
    isFirstTimeUser: false,
    initializationError: null
  },

  checkIfFirstTimeUser: async (userCanisterId: string, identity: Identity): Promise<boolean> => {
    try {
      log('SUBSCRIPTION', '🔍 Checking if user is first-time user...');
      
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const isFirstTime = await userCanisterService.isFirstTimeUser(userCanisterId, identity);
      
      set((state: any) => {
        state.userAccount.isFirstTimeUser = isFirstTime;
      });
      
      log('SUBSCRIPTION', `✅ User first-time check: ${isFirstTime ? 'NEW USER' : 'EXISTING USER'}`);
      return isFirstTime;
      
    } catch (error) {
      log('SUBSCRIPTION', '❌ Error checking first-time user status:', error);
      set((state: any) => {
        state.userAccount.isFirstTimeUser = false;
        state.userAccount.initializationError = error instanceof Error ? error.message : 'Failed to check user status';
      });
      return false;
    }
  },

  initializeNewUserAccount: async (userCanisterId: string, identity: Identity): Promise<boolean> => {
    try {
      log('SUBSCRIPTION', '🏗️ Initializing new user account with default subscription...');
      
      set((state: any) => {
        state.stage = 'INITIALIZING_USER_ACCOUNT';
        state.initializationProgress = {
          percent: 85,
          message: 'Setting up your account...',
          stage: 'INITIALIZING_USER_ACCOUNT'
        };
        state.userAccount.initializationError = null;
      });

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const userProfile = userCanisterService.createDummyUserProfile(identity);
      
      const initResult = await userCanisterService.initializeUserAccount(userCanisterId, identity, userProfile);
      
      if (initResult.success && initResult.user) {
        log('SUBSCRIPTION', '✅ User account initialized successfully');
        
        // 🔥 NEW: Initialize wallet for new user account
        try {
          log('WALLET', '🔄 Initializing user wallet...');
          const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
          const walletId = await userActor.createUserWallet();
          log('WALLET', '✅ User wallet initialized:', walletId);
        } catch (walletError) {
          log('WALLET', '⚠️ Wallet initialization failed (non-critical):', walletError);
          // Don't fail account creation if wallet initialization fails
        }
        
        const subscriptionInfo = initResult.subscriptionInfo;
        
        if (subscriptionInfo) {
          log('SUBSCRIPTION', '📊 Syncing default subscription from backend:', subscriptionInfo);
          
          set((state: any) => {
            state.subscription.currentTier = subscriptionInfo.tier;
            state.subscription.isActive = subscriptionInfo.isActive;
            state.subscription.monthlyCredits = subscriptionInfo.monthlyCredits;
            state.subscription.customerId = subscriptionInfo.customerId;
            state.subscription.subscriptionId = subscriptionInfo.subscriptionId;
            state.subscription.billingCycleStart = subscriptionInfo.billingCycleStart;
            state.subscription.billingCycleEnd = subscriptionInfo.billingCycleEnd;
            
            state.userAccount.isInitialized = true;
            state.userAccount.accountCreatedAt = Date.now();
            state.userAccount.firstLoginAt = Date.now();
          });
          
          log('SUBSCRIPTION', '✅ Default subscription synced to frontend store');
        } else {
          log('SUBSCRIPTION', '⚠️ No subscription info returned from account initialization');
        }
        
        await userCanisterService.markFirstLogin(userCanisterId, identity);
        await userCanisterService.completeOnboarding(userCanisterId, identity);
        
        set((state: any) => {
          state.userAccount.hasCompletedOnboarding = true;
        });
        
        log('SUBSCRIPTION', '✅ New user account initialization completed');
        return true;
        
      } else {
        const errorMsg = initResult.error || 'Unknown error during account initialization';
        log('SUBSCRIPTION', '❌ User account initialization failed:', errorMsg);
        
        set((state: any) => {
          state.userAccount.initializationError = errorMsg;
        });
        
        return false;
      }
      
    } catch (error) {
      log('SUBSCRIPTION', '❌ Error initializing new user account:', error);
      
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize account';
      
      set((state: any) => {
        state.userAccount.initializationError = errorMsg;
      });
      
      return false;
    }
  },

  syncUserAccountAndSubscriptionState: async (userCanisterId: string, identity: Identity): Promise<void> => {
    try {
      log('SUBSCRIPTION', '🔄 Syncing existing user account and subscription state...');
      
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const userInfo = await userCanisterService.getUserAccountInfo(userCanisterId, identity);
      
      if (userInfo) {
        set((state: any) => {
          state.userAccount.isInitialized = true;
          state.userAccount.accountCreatedAt = Number(userInfo.created) / 1_000_000;
          state.userAccount.firstLoginAt = Number(userInfo.lastActive) / 1_000_000;
        });
      }
      
      const onboardingStatus = await userCanisterService.getOnboardingStatus(userCanisterId, identity);
      
      if (onboardingStatus) {
        set((state: any) => {
          state.userAccount.hasCompletedOnboarding = onboardingStatus.hasCompletedOnboarding;
          state.userAccount.firstLoginAt = onboardingStatus.firstLoginAt ? Number(onboardingStatus.firstLoginAt) / 1_000_000 : null;
          state.userAccount.accountCreatedAt = onboardingStatus.accountCreatedAt ? Number(onboardingStatus.accountCreatedAt) / 1_000_000 : null;
        });
      }
      
      await (get() as any).loadSubscriptionInfo();
      
      log('SUBSCRIPTION', '✅ Existing user state synchronized');
      
    } catch (error) {
      log('SUBSCRIPTION', '❌ Error syncing existing user state:', error);
    }
  },
});