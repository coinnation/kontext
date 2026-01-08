import { StateCreator } from 'zustand';
import { Identity } from '@dfinity/agent';

export interface CreditsState {
  balance: number;
  units: number;
  unitsBalance: number;
  isLoading: boolean;
  unitsLoading: boolean;
  lastUpdated: number | null;
  lastUnitsUpdate: number | null;
  usdEquivalent: number;
  xdrRate: number | null;
  error: string | null;
  unitsError: string | null;
}

export interface PaymentState {
  isProcessing: boolean;
  currentTransaction: string | null;
  error: string | null;
  lastPayment: {
    amount: number;
    unitsAdded: number;
    timestamp: number;
    status: 'pending' | 'completed' | 'failed';
  } | null;
}

export interface UserPreferences {
  notifications: {
    lowBalanceThreshold: number;
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
  autoTopUp: {
    enabled: boolean;
    threshold: number;
    amount: number;
  };
}

export interface CreditsSliceState {
  credits: CreditsState;
  payment: PaymentState;
  userPreferences: UserPreferences;
}

export interface CreditsSliceActions {
  fetchCreditsBalance: () => Promise<void>;
  getUserUnitsBalance: () => Promise<void>;
  addUnitsToBalance: (units: number) => Promise<boolean>;
  deductUnitsFromBalance: (units: number, projectId: string, operation: string) => Promise<boolean>;
  startPeriodicBalanceUpdate: () => void;
  stopPeriodicBalanceUpdate: () => void;
  updateUserPreferences: (preferences: Partial<UserPreferences>) => void;
}

export type CreditsSlice = CreditsSliceState & CreditsSliceActions;

const BALANCE_UPDATE_INTERVAL = 30000;
let balanceUpdateInterval: NodeJS.Timeout | null = null;

const log = (category: string, message: string, ...args: any[]) => {
  // console.log(message, ...args);
};

export const createCreditsSlice: StateCreator<any, [], [], CreditsSlice> = (set, get) => ({
  credits: {
    balance: 0,
    units: 0,
    unitsBalance: 0,
    isLoading: false,
    unitsLoading: false,
    lastUpdated: null,
    lastUnitsUpdate: null,
    usdEquivalent: 0,
    xdrRate: null,
    error: null,
    unitsError: null
  },
  payment: {
    isProcessing: false,
    currentTransaction: null,
    error: null,
    lastPayment: null
  },
  userPreferences: {
    notifications: {
      lowBalanceThreshold: 100,
      emailNotifications: true,
      pushNotifications: true
    },
    autoTopUp: {
      enabled: false,
      threshold: 50,
      amount: 1000
    }
  },

  fetchCreditsBalance: async () => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        return;
      }

      set((state: any) => {
        state.credits.isLoading = true;
        state.credits.error = null;
      });

      const { CreditsService } = await import('../../services/CreditsService');
      const balanceData = await CreditsService.fetchUserBalance(userCanisterId, identity);
      
      if (balanceData) {
        // Get current XDR rate for display
        const conversionUtils = CreditsService.getConversionUtils();
        const xdrRate = await conversionUtils.getXdrRate();
        
        set((state: any) => {
          state.credits.balance = balanceData.credits;
          state.credits.units = balanceData.units;
          state.credits.usdEquivalent = balanceData.usdEquivalent;
          state.credits.xdrRate = xdrRate;
          state.credits.lastUpdated = balanceData.lastUpdated;
          state.credits.isLoading = false;
          state.credits.error = null;
        });
      } else {
        throw new Error('Unable to fetch units-derived credits balance');
      }
    } catch (error) {
      set((state: any) => {
        state.credits.isLoading = false;
        state.credits.error = error instanceof Error ? error.message : 'Failed to fetch balance';
      });
    }
  },

  getUserUnitsBalance: async () => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        return;
      }

      set((state: any) => {
        state.credits.unitsLoading = true;
        state.credits.unitsError = null;
      });

      log('CREDITS', '📊 Fetching units balance from store');

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const unitsBalance = await userCanisterService.getUserUnitsBalance(userCanisterId, identity);
      
      set((state: any) => {
        state.credits.unitsBalance = unitsBalance;
        state.credits.lastUnitsUpdate = Date.now();
        state.credits.unitsLoading = false;
        state.credits.unitsError = null;
      });

      log('CREDITS', '✅ Units balance updated in store:', unitsBalance);

    } catch (error) {
      set((state: any) => {
        state.credits.unitsLoading = false;
        state.credits.unitsError = error instanceof Error ? error.message : 'Failed to fetch units balance';
      });
      log('CREDITS', '❌ Error fetching units balance:', error);
    }
  },

  addUnitsToBalance: async (units: number): Promise<boolean> => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        return false;
      }

      log('CREDITS', '💰 Adding units to balance via store:', units);

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const success = await userCanisterService.addUnitsToBalance(userCanisterId, identity, units);
      
      if (success) {
        // Refresh both credits and units balance after successful addition
        await Promise.all([
          (get() as any).fetchCreditsBalance(),
          (get() as any).getUserUnitsBalance()
        ]);
        
        set((state: any) => {
          state.payment.lastPayment = {
            amount: units / 100, // Convert units back to USD for display
            unitsAdded: units,
            timestamp: Date.now(),
            status: 'completed'
          };
        });
        
        log('CREDITS', '✅ Units added successfully via store and balances refreshed');
        return true;
      }
      
      return false;
    } catch (error) {
      log('CREDITS', '❌ Error adding units to balance via store:', error);
      set((state: any) => {
        state.credits.unitsError = error instanceof Error ? error.message : 'Failed to add units';
      });
      return false;
    }
  },

  deductUnitsFromBalance: async (units: number, projectId: string, operation: string): Promise<boolean> => {
    try {
      const { userCanisterId, identity } = get() as any;
      
      if (!userCanisterId || !identity) {
        return false;
      }

      log('CREDITS', '💸 Deducting units from balance via store:', { units, projectId, operation });

      // Check current balance first
      const currentState = get() as any;
      if (currentState.credits.unitsBalance < units) {
        log('CREDITS', '❌ Insufficient units balance for operation');
        set((state: any) => {
          state.credits.unitsError = `Insufficient units: ${units} required, ${currentState.credits.unitsBalance} available`;
        });
        return false;
      }

      const { userCanisterService } = await import('../../services/UserCanisterService');
      const success = await userCanisterService.deductUnitsFromBalance(userCanisterId, identity, units, projectId, operation);
      
      if (success) {
        // Update local state immediately for responsive UI, then refresh from backend
        set((state: any) => {
          state.credits.unitsBalance = Math.max(0, state.credits.unitsBalance - units);
        });

        // Refresh both credits and units balance after successful deduction
        await Promise.all([
          (get() as any).fetchCreditsBalance(),
          (get() as any).getUserUnitsBalance()
        ]);
        
        log('CREDITS', '✅ Units deducted successfully via store and balances refreshed');
        return true;
      }
      
      return false;
    } catch (error) {
      log('CREDITS', '❌ Error deducting units from balance via store:', error);
      set((state: any) => {
        state.credits.unitsError = error instanceof Error ? error.message : 'Failed to deduct units';
      });
      return false;
    }
  },

  startPeriodicBalanceUpdate: () => {
    if (balanceUpdateInterval) {
      clearInterval(balanceUpdateInterval);
    }
    
    balanceUpdateInterval = setInterval(() => {
      Promise.all([
        (get() as any).fetchCreditsBalance(),
        (get() as any).getUserUnitsBalance()
      ]);
    }, BALANCE_UPDATE_INTERVAL);
    
    // Initial fetch for both balances
    Promise.all([
      (get() as any).fetchCreditsBalance(),
      (get() as any).getUserUnitsBalance()
    ]);
  },

  stopPeriodicBalanceUpdate: () => {
    if (balanceUpdateInterval) {
      clearInterval(balanceUpdateInterval);
      balanceUpdateInterval = null;
    }
  },

  updateUserPreferences: (preferences: Partial<UserPreferences>) => {
    set((state: any) => {
      if (preferences.notifications) {
        Object.assign(state.userPreferences.notifications, preferences.notifications);
      }
      if (preferences.autoTopUp) {
        Object.assign(state.userPreferences.autoTopUp, preferences.autoTopUp);
      }
    });
  },
});