import { StateCreator } from 'zustand';
import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { getSharedAuthClient } from '../../services/SharedAuthClient';

export interface AuthSliceState {
  isAuthenticated: boolean;
  principal: Principal | null;
  identity: Identity | null;
  authClient: AuthClient | null;
}

export interface AuthSliceActions {
  login: () => Promise<boolean>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export type AuthSlice = AuthSliceState & AuthSliceActions;

export const createAuthSlice: StateCreator<any, [], [], AuthSlice> = (set, get) => ({
  isAuthenticated: false,
  principal: null,
  identity: null,
  authClient: null,

  login: async () => {
    try {
      console.log('🔐 Starting login process...');
      
      // 🔥 FIX: Use shared AuthClient to prevent session logout issues
      const globalAuthClient = await getSharedAuthClient();

      set((state: any) => {
        state.stage = 'AUTHENTICATING';
        state.initializationProgress = { percent: 5, message: "Connecting to Internet Identity...", stage: 'AUTHENTICATING' };
      });

      let loginSuccess = false;
      
      await globalAuthClient.login({
        identityProvider: 'https://id.ai',
        maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 7 days in nanoseconds
        onSuccess: async () => {
          console.log('✅ Authentication successful');
          
          const identity = globalAuthClient!.getIdentity();
          const principal = identity.getPrincipal();

          set((state: any) => {
            state.isAuthenticated = true;
            state.principal = principal;
            state.identity = identity;
            state.authClient = globalAuthClient;
            state.stage = 'AUTH_COMPLETE';
            state.error = null;
          });

          await (get() as any).initializeSequentially(principal, identity);
          loginSuccess = true;
        },
        onError: (error: any) => {
          console.log('❌ Authentication failed:', error);
          set((state: any) => {
            state.stage = 'ERROR';
            state.error = 'Authentication failed. Please try again.';
          });
          loginSuccess = false;
        }
      });

      // Wait a moment for onSuccess/onError to complete, then check authentication state
      await new Promise(resolve => setTimeout(resolve, 100));
      const isAuthenticated = await globalAuthClient.isAuthenticated();
      return isAuthenticated || loginSuccess;
    } catch (error) {
      console.log('❌ Login error:', error);
      set((state: any) => {
        state.stage = 'ERROR';
        state.error = error instanceof Error ? error.message : 'Login failed';
      });
      return false;
    }
  },

  logout: async () => {
    try {
      console.log('🚪 Starting logout...');
      
      (get() as any).stopPeriodicBalanceUpdate();
      
      // 🔥 FIX: Use shared AuthClient to ensure consistent logout
      const globalAuthClient = await getSharedAuthClient();
      await globalAuthClient.logout();

      const { userCanisterService } = await import('../../services/UserCanisterService');
      userCanisterService.clearUserActors();

      set((state: any) => {
        // Reset to initial state
        state.isAuthenticated = false;
        state.principal = null;
        state.identity = null;
        state.authClient = null;
        state.isProcessingPaymentReturn = false;
        state.paymentReturnError = null;
      });

      console.log('✅ Logout completed');
    } catch (error) {
      console.log('❌ Logout error:', error);
    }
  },

  initializeAuth: async () => {
    try {
      console.log('🔧 Initializing authentication...');
      
      // 🔥 FIX: Use shared AuthClient to prevent session logout issues
      const globalAuthClient = await getSharedAuthClient();

      // 🔥 CRITICAL: Check existing state first - NEVER clear if user was previously authenticated
      // The ONLY way to logout is after 7 days when the session naturally expires
      const currentState = get() as any;
      const hadPreviousAuth = currentState.isAuthenticated && currentState.principal && currentState.identity;

      // 🔥 CRITICAL: Try to get identity even if isAuthenticated() returns false
      // Sometimes the identity is still available even if isAuthenticated() fails temporarily
      let identity: Identity | null = null;
      let principal: Principal | null = null;
      let isAuthenticated = false;

      try {
        // First, try the standard check
        isAuthenticated = await globalAuthClient.isAuthenticated();
        
        if (isAuthenticated) {
          identity = globalAuthClient.getIdentity();
          principal = identity.getPrincipal();
        } else if (hadPreviousAuth) {
          // 🔥 CRITICAL: If we had previous auth but isAuthenticated() returns false,
          // try to get identity anyway - it might still be valid
          // NEVER clear state - only the 7-day expiration should cause logout
          try {
            identity = globalAuthClient.getIdentity();
            principal = identity.getPrincipal();
            
            // If we successfully got identity/principal, the session is likely still valid
            // Retry isAuthenticated() check after a short delay
            await new Promise(resolve => setTimeout(resolve, 100));
            isAuthenticated = await globalAuthClient.isAuthenticated();
            
            if (!isAuthenticated && principal) {
              // We have a valid principal but isAuthenticated() says false
              // This could be a transient issue - PRESERVE STATE - only 7-day expiration should logout
              console.warn('⚠️ [Auth] isAuthenticated() returned false but identity exists - preserving state (only 7-day expiration causes logout)');
              // Keep the existing auth state - NEVER clear it automatically
              return;
            }
          } catch (identityError) {
            // Can't get identity - but if we had previous auth, preserve it anyway
            // The session might be expired, but we'll let the 7-day natural expiration handle it
            // Don't clear state here - let the user stay logged in until natural expiration
            if (hadPreviousAuth) {
              console.log('🔧 [Auth] Cannot retrieve identity but preserving previous auth state - only 7-day expiration causes logout');
              return;
            }
          }
        }
      } catch (authCheckError) {
        console.warn('⚠️ [Auth] Error checking authentication status:', authCheckError);
        
        // 🔥 CRITICAL: If we had previous auth and there's ANY error, preserve state
        // NEVER clear state on errors - only 7-day expiration should cause logout
        if (hadPreviousAuth) {
          console.log('🔧 [Auth] Error during auth check but preserving state - only 7-day expiration causes logout');
          return;
        }
      }

      if (isAuthenticated && identity && principal) {
        // Successfully authenticated - update state
        set((state: any) => {
          state.isAuthenticated = true;
          state.principal = principal;
          state.identity = identity;
          state.authClient = globalAuthClient;
        });

        await (get() as any).initializeSequentially(principal, identity);
      } else if (!hadPreviousAuth) {
        // Only clear auth state if we didn't have previous auth AND can't authenticate
        // This is the initial load case where user was never logged in
        console.log('🔧 [Auth] User not authenticated on initialization - clearing auth state (no previous auth)');
        set((state: any) => {
          state.isAuthenticated = false;
          state.principal = null;
          state.identity = null;
          // Keep authClient so we don't recreate it unnecessarily
        });
      } else {
        // 🔥 CRITICAL: Had previous auth but can't verify - ALWAYS preserve state
        // The ONLY way to logout is after 7 days when the session naturally expires
        console.log('🔧 [Auth] Preserving previous auth state - only 7-day expiration causes logout');
      }
    } catch (error) {
      console.log('❌ Auth initialization error:', error);
      
      // 🔥 CRITICAL: NEVER clear auth state on error if user was previously authenticated
      // The ONLY way to logout is after 7 days when the session naturally expires
      const currentState = get() as any;
      if (currentState.isAuthenticated && currentState.principal) {
        console.log('🔧 [Auth] Error during init but preserving existing auth state - only 7-day expiration causes logout');
      } else {
        set((state: any) => {
          state.error = 'Failed to initialize authentication';
        });
      }
    }
  },
});