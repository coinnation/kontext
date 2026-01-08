/**
 * Server Pair State Service
 * 
 * SINGLE SOURCE OF TRUTH for server pair selection.
 * All components must use this service to get/set the currently selected server pair.
 * 
 * The user canister stores the currently selected server pair.
 * NO CACHING - always fetches fresh data from the canister.
 */

import { userCanisterService } from './UserCanisterService';
import { getSharedAuthClient } from './SharedAuthClient';
import { useAppStore } from '../store/appStore';

// Queue to prevent concurrent requests
let pendingRequest: Promise<string | null> | null = null;

/**
 * Get user context (canister ID and identity)
 */
async function getUserContext() {
  const state = useAppStore.getState();
  const userCanisterId = state.userCanisterId;
  
  if (!userCanisterId) {
    console.warn('[ServerPairState] User canister ID not available');
    return null;
  }
  
  try {
    const authClient = await getSharedAuthClient();
    const identity = authClient.getIdentity();
    
    return { userCanisterId, identity };
  } catch (error) {
    console.error('[ServerPairState] Error getting auth client:', error);
    return null;
  }
}

/**
 * Get the currently selected server pair from the user canister
 * This is the SINGLE SOURCE OF TRUTH - NO CACHING, always fetches fresh
 */
export async function getSelectedServerPairId(): Promise<string | null> {
  // If there's already a pending request, wait for it
  if (pendingRequest) {
    console.log('[ServerPairState] ⏳ Waiting for pending request...');
    return pendingRequest;
  }

  // Create new request - always fetch fresh from canister
  pendingRequest = (async () => {
    try {
      console.log('[ServerPairState] 🔍 Fetching selected server pair from canister (no cache)...');
      
      const context = await getUserContext();
      if (!context) {
        return null;
      }

      const { userCanisterId, identity } = context;
      const result = await userCanisterService.getSelectedServerPair(userCanisterId, identity);
      
      if (result.success && result.serverPairId) {
        console.log('[ServerPairState] ✅ Retrieved from canister:', result.serverPairId);
        return result.serverPairId;
      }
      
      console.log('[ServerPairState] ℹ️ No server pair selected in canister');
      return null;
    } catch (error) {
      console.error('[ServerPairState] ❌ Error getting selected server pair:', error);
      return null;
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
}

/**
 * Set the currently selected server pair in the user canister
 * This updates the SINGLE SOURCE OF TRUTH - NO CACHING
 */
export async function setSelectedServerPairId(serverPairId: string | null): Promise<boolean> {
  try {
    console.log('[ServerPairState] 💾 Setting selected server pair:', serverPairId);
    
    const context = await getUserContext();
    if (!context) {
      console.error('[ServerPairState] ❌ Cannot set server pair: no user context');
      return false;
    }

    const { userCanisterId, identity } = context;
    const result = await userCanisterService.setSelectedServerPair(userCanisterId, identity, serverPairId);
    
    if (result.success) {
      console.log('[ServerPairState] ✅ Server pair set successfully');
      
      // Notify Zustand store for UI updates
      const state = useAppStore.getState();
      if (state.notifyServerPairUpdate && serverPairId) {
        state.notifyServerPairUpdate('active', serverPairId);
      }
      
      return true;
    }
    
    console.error('[ServerPairState] ❌ Failed to set server pair:', result.error);
    return false;
  } catch (error) {
    console.error('[ServerPairState] ❌ Error setting selected server pair:', error);
    return false;
  }
}

/**
 * Clear any pending requests
 * Use this when you need to ensure fresh data on next call
 */
export function invalidateCache(): void {
  console.log('[ServerPairState] 🗑️ Clearing pending requests');
  pendingRequest = null;
}

/**
 * DEPRECATED: No longer caches - always returns null
 * Use getSelectedServerPairId() instead
 */
export function getCachedServerPairId(): string | null {
  return null;
}


