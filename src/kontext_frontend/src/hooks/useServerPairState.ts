/**
 * React Hook for Server Pair State
 * 
 * Use this hook in components that need to know the currently selected server pair.
 * This provides a simple interface to the canister-based single source of truth.
 * NO CACHING - always fetches fresh data from canister.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getSelectedServerPairId,
  setSelectedServerPairId,
  invalidateCache
} from '../services/ServerPairStateService';

export interface UseServerPairStateReturn {
  selectedServerPairId: string | null;
  isLoading: boolean;
  error: string | null;
  setServerPair: (serverPairId: string | null) => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * Hook to manage server pair state with automatic loading and caching
 * 
 * @param autoLoad - Whether to automatically load the server pair on mount (default: true)
 * @returns Server pair state and management functions
 */
export function useServerPairState(autoLoad: boolean = true): UseServerPairStateReturn {
  const [selectedServerPairId, setSelectedServerPairIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);

  // Load selected server pair from canister
  const loadServerPair = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const serverPairId = await getSelectedServerPairId();
      setSelectedServerPairIdState(serverPairId);
      
      console.log('[useServerPairState] Loaded server pair:', serverPairId || 'none');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load server pair';
      console.error('[useServerPairState] Error loading server pair:', err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set server pair in canister
  const setServerPair = useCallback(async (serverPairId: string | null): Promise<boolean> => {
    try {
      setError(null);
      const success = await setSelectedServerPairId(serverPairId);
      
      if (success) {
        setSelectedServerPairIdState(serverPairId);
        console.log('[useServerPairState] Server pair updated:', serverPairId || 'none');
      } else {
        setError('Failed to update server pair');
      }
      
      return success;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to set server pair';
      console.error('[useServerPairState] Error setting server pair:', err);
      setError(errorMsg);
      return false;
    }
  }, []);

  // Refresh from canister (invalidate cache and reload)
  const refresh = useCallback(async () => {
    invalidateCache();
    await loadServerPair();
  }, [loadServerPair]);

  // Auto-load on mount if enabled - always fetch fresh from canister
  useEffect(() => {
    if (autoLoad) {
      loadServerPair();
    }
  }, [autoLoad, loadServerPair]);

  return {
    selectedServerPairId,
    isLoading,
    error,
    setServerPair,
    refresh
  };
}

/**
 * Hook that only returns the selected server pair ID without loading state
 * Useful for read-only display - NO CACHING, always fetches fresh
 */
export function useSelectedServerPairId(): string | null {
  const [serverPairId, setServerPairId] = useState<string | null>(null);

  useEffect(() => {
    getSelectedServerPairId().then(id => {
      setServerPairId(id);
    });
  }, []);

  return serverPairId;
}


