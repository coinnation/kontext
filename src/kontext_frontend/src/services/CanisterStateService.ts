/**
 * Canister State Service
 * 
 * Manages selected server pair and selected project state in the user canister
 * instead of localStorage for cross-tab and cross-device synchronization.
 */

import { userCanisterService } from './UserCanisterService';
import { getSharedAuthClient } from './SharedAuthClient';
import { useAppStore } from '../store/appStore';

// Cache to reduce redundant canister calls
interface StateCache {
  selectedServerPair: string | null;
  selectedProject: string | null;
  lastFetch: number;
}

const CACHE_DURATION = 30000; // 30 seconds
let stateCache: StateCache | null = null;

// Migration: Try to load from localStorage on first use
let hasAttemptedMigration = false;

/**
 * Get current user canister ID and identity
 */
async function getUserContext() {
  const state = useAppStore.getState();
  const userCanisterId = state.userCanisterId;
  
  if (!userCanisterId) {
    throw new Error('User canister ID not available');
  }
  
  const authClient = await getSharedAuthClient();
  const identity = authClient.getIdentity();
  
  return { userCanisterId, identity };
}

/**
 * Get selected server pair from canister (with caching)
 */
export async function getSelectedServerPair(): Promise<string | null> {
  try {
    // Check cache first
    if (stateCache && Date.now() - stateCache.lastFetch < CACHE_DURATION) {
      return stateCache.selectedServerPair;
    }

    // Migration: On first call, try to migrate from localStorage
    if (!hasAttemptedMigration) {
      await migrateSelectedServerPairToCanister();
      hasAttemptedMigration = true;
    }

    // Get user context
    const { userCanisterId, identity } = await getUserContext();

    // Fetch from canister
    const result = await userCanisterService.getSelectedServerPair(userCanisterId, identity);
    
    if (result.success && result.serverpairId) {
      const pairId = result.serverpairId;
      
      // Update cache
      stateCache = {
        selectedServerPair: pairId,
        selectedProject: stateCache?.selectedProject || null,
        lastFetch: Date.now()
      };
      
      return pairId;
    }
    
    return null;
  } catch (error) {
    console.error('[CanisterState] Error getting selected server pair:', error);
    // NO FALLBACK - return null on error
    return null;
  }
}

/**
 * Set selected server pair in canister
 */
export async function setSelectedServerPair(pairId: string | null): Promise<boolean> {
  try {
    // Get user context
    const { userCanisterId, identity } = await getUserContext();
    
    const result = await userCanisterService.setSelectedServerPair(userCanisterId, identity, pairId);
    
    if (result.success) {
      // Update cache immediately
      stateCache = {
        selectedServerPair: pairId,
        selectedProject: stateCache?.selectedProject || null,
        lastFetch: Date.now()
      };
      
      // NO LOCALSTORAGE FALLBACK
      
      // Broadcast change to other tabs
      broadcastStateChange('selectedServerPair', pairId);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[CanisterState] Error setting selected server pair:', error);
    // NO FALLBACK - just return false on error
    return false;
  }
}

/**
 * Get selected project from canister (with caching)
 */
export async function getSelectedProject(): Promise<string | null> {
  try {
    // Check cache first
    if (stateCache && Date.now() - stateCache.lastFetch < CACHE_DURATION) {
      return stateCache.selectedProject;
    }

    // Migration: On first call, try to migrate from localStorage
    if (!hasAttemptedMigration) {
      await migrateSelectedProjectToCanister();
      hasAttemptedMigration = true;
    }

    // Get user context
    const { userCanisterId, identity } = await getUserContext();

    // Fetch from canister
    const projectId = await userCanisterService.getSelectedProject(userCanisterId, identity);
    
    if (projectId) {
      // Update cache
      stateCache = {
        selectedServerPair: stateCache?.selectedServerPair || null,
        selectedProject: projectId,
        lastFetch: Date.now()
      };
      
      return projectId;
    }
    
    return null;
  } catch (error) {
    console.error('[CanisterState] Error getting selected project:', error);
    
    // Fallback to localStorage
    const fallback = localStorage.getItem('selected-project-fallback');
    return fallback;
  }
}

/**
 * Set selected project in canister
 */
export async function setSelectedProject(projectId: string | null): Promise<boolean> {
  try {
    // Get user context
    const { userCanisterId, identity } = await getUserContext();
    
    const result = await userCanisterService.setSelectedProject(projectId, userCanisterId, identity);
    
    if ('ok' in result) {
      // Update cache immediately
      stateCache = {
        selectedServerPair: stateCache?.selectedServerPair || null,
        selectedProject: projectId,
        lastFetch: Date.now()
      };
      
      // Also save to localStorage as fallback
      if (projectId) {
        localStorage.setItem('selected-project-fallback', projectId);
      } else {
        localStorage.removeItem('selected-project-fallback');
      }
      
      // Broadcast change to other tabs
      broadcastStateChange('selectedProject', projectId);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[CanisterState] Error setting selected project:', error);
    
    // Fallback: Save to localStorage
    if (projectId) {
      localStorage.setItem('selected-project-fallback', projectId);
    } else {
      localStorage.removeItem('selected-project-fallback');
    }
    
    return false;
  }
}

/**
 * Get selected server pair for a specific project (project-scoped)
 */
export async function getSelectedServerPairForProject(projectId: string): Promise<string | null> {
  try {
    // Try localStorage first (legacy format)
    const legacyKey = `selected-server-pair-${projectId}`;
    const legacyValue = localStorage.getItem(legacyKey);
    
    if (legacyValue) {
      console.log(`[CanisterState] Found legacy server pair for project ${projectId}, migrating...`);
      
      // Migrate to canister
      await setSelectedServerPair(legacyValue);
      
      // Remove legacy key
      localStorage.removeItem(legacyKey);
      
      return legacyValue;
    }
    
    // Fetch from canister (global selected server pair)
    return await getSelectedServerPair();
  } catch (error) {
    console.error('[CanisterState] Error getting server pair for project:', error);
    // NO FALLBACK - return null on error
    return null;
  }
}

/**
 * Set selected server pair for a specific project (project-scoped)
 */
export async function setSelectedServerPairForProject(
  projectId: string,
  pairId: string | null
): Promise<boolean> {
  // NO LOCALSTORAGE - just save to canister (global)
  return await setSelectedServerPair(pairId);
}

/**
 * Invalidate cache (force refresh on next call)
 */
export function invalidateStateCache(): void {
  stateCache = null;
  console.log('[CanisterState] Cache invalidated');
}

/**
 * Listen for state changes from other tabs
 */
export function onStateChange(callback: (key: string, value: string | null) => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === 'canister-state-change') {
      try {
        const { key, value } = JSON.parse(event.newValue || '{}');
        
        // Invalidate cache so next read fetches from canister
        invalidateStateCache();
        
        callback(key, value);
      } catch (error) {
        console.error('[CanisterState] Error parsing state change:', error);
      }
    }
  };
  
  window.addEventListener('storage', handler);
  
  // Return cleanup function
  return () => window.removeEventListener('storage', handler);
}

/**
 * Broadcast state change to other tabs
 */
function broadcastStateChange(key: string, value: string | null): void {
  try {
    localStorage.setItem('canister-state-change', JSON.stringify({ key, value, timestamp: Date.now() }));
    
    // Clear the broadcast message after a short delay
    setTimeout(() => {
      localStorage.removeItem('canister-state-change');
    }, 100);
  } catch (error) {
    console.error('[CanisterState] Error broadcasting state change:', error);
  }
}

/**
 * Migration: Move selectedServerPair from localStorage to canister (DISABLED)
 */
async function migrateSelectedServerPairToCanister(): Promise<void> {
  // NO-OP: Migration disabled - no longer using localStorage
  console.log('[CanisterState] Migration skipped - localStorage cache disabled');
}

/**
 * Migration: Move selectedProject from localStorage to canister
 */
async function migrateSelectedProjectToCanister(): Promise<void> {
  try {
    // Check if there's a value in localStorage
    const legacyValue = localStorage.getItem('selected-project-fallback');
    
    if (legacyValue) {
      console.log('[CanisterState] Migrating selectedProject to canister:', legacyValue);
      
      // Get user context
      const { userCanisterId, identity } = await getUserContext();
      
      // Set in canister
      await userCanisterService.setSelectedProject(legacyValue, userCanisterId, identity);
      
      console.log('[CanisterState] Migration complete for selectedProject');
    }
  } catch (error) {
    console.error('[CanisterState] Error migrating selectedProject:', error);
  }
}

/**
 * Get both selected states in one call (optimization)
 */
export async function getSelectedState(): Promise<{
  serverPairId: string | null;
  projectId: string | null;
}> {
  const [serverPairId, projectId] = await Promise.all([
    getSelectedServerPair(),
    getSelectedProject()
  ]);
  
  return { serverPairId, projectId };
}

/**
 * React hook for selected server pair
 */
export function useSelectedServerPair() {
  const [serverPairId, setServerPairId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  React.useEffect(() => {
    let mounted = true;
    
    // Load initial value
    getSelectedServerPair().then(pairId => {
      if (mounted) {
        setServerPairId(pairId);
        setLoading(false);
      }
    });
    
    // Listen for changes from other tabs
    const unsubscribe = onStateChange((key, value) => {
      if (key === 'selectedServerPair' && mounted) {
        setServerPairId(value);
      }
    });
    
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  
  const updateServerPair = React.useCallback(async (pairId: string | null) => {
    const success = await setSelectedServerPair(pairId);
    if (success) {
      setServerPairId(pairId);
    }
    return success;
  }, []);
  
  return { serverPairId, setServerPairId: updateServerPair, loading };
}

/**
 * React hook for selected project
 */
export function useSelectedProject() {
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  React.useEffect(() => {
    let mounted = true;
    
    // Load initial value
    getSelectedProject().then(proj => {
      if (mounted) {
        setProjectId(proj);
        setLoading(false);
      }
    });
    
    // Listen for changes from other tabs
    const unsubscribe = onStateChange((key, value) => {
      if (key === 'selectedProject' && mounted) {
        setProjectId(value);
      }
    });
    
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  
  const updateProject = React.useCallback(async (projId: string | null) => {
    const success = await setSelectedProject(projId);
    if (success) {
      setProjectId(projId);
    }
    return success;
  }, []);
  
  return { projectId, setProjectId: updateProject, loading };
}

// Add React import for hooks
import React from 'react';



