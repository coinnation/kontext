/**
 * 🔥 CRITICAL FIX: Centralized AuthClient to prevent session logout issues
 * 
 * PROBLEM: Multiple modules were creating separate AuthClient instances:
 * - authSlice.ts had its own globalAuthClient
 * - useCanister.ts had its own globalAuthClient  
 * - useUserCanister.ts had its own globalAuthClient
 * - StripeService.ts had its own globalAuthClient
 * - WasmDeploymentService.ts created its own authClient
 * 
 * Each AuthClient instance has separate session storage, so when one module
 * checks isAuthenticated(), it might be checking a different instance than
 * the one used for login, causing false negatives and session loss.
 * 
 * SOLUTION: Single shared AuthClient instance that all modules import and use.
 * 
 * 🔥 SESSION EXPIRATION POLICY:
 * - IdleManager is COMPLETELY DISABLED (disableIdle: true)
 * - Sessions ONLY expire after 7 days (maxTimeToLive set during login)
 * - NO automatic logout paths exist - only natural 7-day expiration
 * - Auth state is NEVER cleared automatically - only on explicit logout or 7-day expiration
 */

import { AuthClient } from '@dfinity/auth-client';

let globalAuthClient: AuthClient | null = null;
let initializationPromise: Promise<AuthClient> | null = null;

/**
 * Get or create the shared AuthClient instance.
 * All modules should use this instead of creating their own instances.
 */
export async function getSharedAuthClient(): Promise<AuthClient> {
  if (globalAuthClient) {
    return globalAuthClient;
  }

  if (!initializationPromise) {
    // 🔥 CRITICAL FIX: Explicitly disable IdleManager to prevent idle logout
    // IdleManager tracks DOM events and can expire sessions prematurely during active app usage
    // By setting disableIdle: true, we completely disable idle management
    // Sessions will only expire based on maxTimeToLive (7 days) set during login
    initializationPromise = AuthClient.create({
      idleOptions: {
        disableIdle: true,
      }
    });
  }

  globalAuthClient = await initializationPromise;
  return globalAuthClient;
}

/**
 * Get the current AuthClient instance if it exists (synchronous).
 * Returns null if not yet initialized.
 */
export function getSharedAuthClientSync(): AuthClient | null {
  return globalAuthClient;
}

/**
 * Check if the shared AuthClient has been initialized.
 */
export function isAuthClientInitialized(): boolean {
  return globalAuthClient !== null;
}

/**
 * Reset the shared AuthClient (for testing or explicit cleanup).
 * WARNING: Only use this if you know what you're doing!
 */
export function resetSharedAuthClient(): void {
  globalAuthClient = null;
  initializationPromise = null;
}

