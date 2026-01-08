import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Principal } from '@dfinity/principal';
import {HttpAgent} from '@dfinity/agent';
import {AssetManager} from "@dfinity/assets";
import { userCanisterService } from '../services/UserCanisterService';
import { useAppStore } from '../store/appStore';
import { useServerPairState } from '../hooks/useServerPairState';
import { MotokoPackage } from './types';
import { DeploymentErrorHandler, DiagnosticItem } from '../services/DeploymentErrorHandler';
import { autoRetryCoordinator } from '../services/AutoRetryCoordinator';
import { DeploymentContext } from '../types/deploymentCoordination';
import { injectElementSelectionScript } from '../utils/elementSelectionInjector';
import { VersionBadge } from './VersionBadge';

// ==================== DEPLOYMENT STATE PERSISTENCE SYSTEM ====================

interface DeploymentSessionCache {
  deploymentState?: {
    selectedServerPairId: string | null;
    deploymentStatus: 'idle' | 'analyzing' | 'compiling-backend' | 'deploying-backend' | 'bundling-frontend' | 'deploying-frontend' | 'completed' | 'failed';
    deploymentProgress: number;
    deploymentError: string | null;
    isDeploying: boolean;
    deploymentStartTime: number | null;
    deploymentDuration: number | null;
    retryAttempt?: number;
    isAutoRetrying?: boolean;
  };
  errorHandlerState?: {
    showFixButton: boolean;
    errorSummary: string | null;
    hasStructuredErrors: boolean;
    serializedErrors?: string;
    lastProcessedError?: string;
    errorProcessingTimestamp?: number;
    errorClassification?: string;
    errorCategory?: string;
  };
  coordinatorWorkflowState?: {
    workflowId: string;
    phase: string;
    executionCount: number;
    isSequentialError: boolean;
    sequentialErrorCount: number;
    automationPipelineActive: boolean;
    deploymentRetryReady: boolean;
  };
  logs: string[];
  timestamp: number;
}

interface DeploymentCacheEntry {
  projectId: string;
  deploymentId: string;
  timestamp: number;
  status: 'success' | 'failed' | 'in-progress';
  frontendUrl?: string;
  duration?: number;
  serverPairId?: string;
  serverPairName?: string;
  error?: string;
  errorDetails?: string;
  logs: string[];
  sessionCache?: DeploymentSessionCache;
}

interface DeploymentCache {
  [projectId: string]: {
    current?: DeploymentCacheEntry;
    history: DeploymentCacheEntry[];
  };
}

interface DeploymentConfigCache {
  [projectId: string]: {
    selectedServerPairId: string | null;
    lastUpdated: number;
  };
}

// ==================== SERVER PAIR CACHING SYSTEM ====================

interface CachedServerPair {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
  currentProjectId?: string;
  currentProjectName?: string;
  canReassign: boolean;
}

interface ServerPairCache {
  serverPairs: CachedServerPair[];
  timestamp: number;
  userCanisterId: string;
  version: number;
  assignments: {
    [serverPairId: string]: {
      projectId: string;
      projectName: string;
      assignmentTimestamp: number;
    };
  };
}

interface PersistentServerPairStorage {
  [userCanisterId: string]: ServerPairCache;
}

const CACHE_KEY = 'deployment-cache-v5';
const CONFIG_CACHE_KEY = 'deployment-config-cache-v1';
const SERVER_PAIR_CACHE_KEY = 'server-pair-cache-v3';
const CACHE_EXPIRY_DAYS = 7;
const SERVER_PAIR_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
const ASSIGNMENT_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours
const MAX_HISTORY_PER_PROJECT = 10;
const MAX_CACHE_SIZE = 2 * 1024 * 1024;

// ==================== ULTRA HIGH-PERFORMANCE CONSTANTS ====================

// Maximum safe chunk size for IC (1.98MB)
const MAX_CHUNK_SIZE = 1980000;

// Aggressive parallelization settings
const MAX_WASM_CHUNKS = 15; // Maximum parallel WASM chunks
const MAX_SMALL_ASSETS = 24; // Maximum parallel small asset uploads
const MAX_LARGE_ASSETS = 12; // Maximum parallel large asset uploads
const SMALL_ASSET_THRESHOLD = 102400; // 100KB
const LARGE_ASSET_THRESHOLD = 524288; // 512KB

// ==================== SERVER PAIR PERSISTENT CACHING FUNCTIONS ====================

const getServerPairPersistentCache = (): PersistentServerPairStorage => {
  // NO-OP: Caching disabled - always return empty
  return {};
};

const saveServerPairPersistentCache = (cache: PersistentServerPairStorage): boolean => {
  // NO-OP: Caching disabled
  return true;
};

const getCachedServerPairs = (userCanisterId: string): CachedServerPair[] | null => {
  // NO-OP: Caching disabled - always return null to force fresh fetch
  console.log('🖥️ [ServerPairCache] Caching disabled - fetching fresh from backend');
  return null;
};

const setCachedServerPairs = (userCanisterId: string, serverPairs: CachedServerPair[]): void => {
  // NO-OP: Caching disabled
  console.log('🖥️ [ServerPairCache] Caching disabled - not storing data');
  
  // Still dispatch update event for any listeners
  const event = new CustomEvent('serverPairsUpdated', {
    detail: { userCanisterId, serverPairs, timestamp: Date.now() }
  });
  window.dispatchEvent(event);
};

const invalidateServerPairCache = (userCanisterId: string): void => {
  // NO-OP: Caching disabled
  console.log('🖥️ [ServerPairCache] Caching disabled - no cache to invalidate');
};

const updateServerPairAssignment = (
  userCanisterId: string, 
  serverPairId: string, 
  projectId: string, 
  projectName: string
): void => {
  // NO-OP: Caching disabled
  console.log('🖥️ [ServerPairCache] Caching disabled - not updating assignment');
  return;
  
  // OLD CODE KEPT FOR REFERENCE BUT NOT EXECUTED
  const serverPair = userCache.serverPairs.find(p => p.pairId === serverPairId);
  if (serverPair) {
    serverPair.currentProjectId = projectId;
    serverPair.currentProjectName = projectName;
  }
  
  saveServerPairPersistentCache(cache);
  console.log('🖥️ [ServerPairCache] Updated assignment:', { serverPairId, projectId, projectName });
};

// ==================== EXISTING CACHE FUNCTIONS ====================

const getDeploymentCache = (): DeploymentCache => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    
    const parsed = JSON.parse(cached) as DeploymentCache;
    
    const now = Date.now();
    const cutoff = now - (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    Object.keys(parsed).forEach(projectId => {
      if (parsed[projectId]) {
        parsed[projectId].history = parsed[projectId].history.filter(
          entry => entry.timestamp > cutoff
        );
        
        if (parsed[projectId].current && parsed[projectId].current!.timestamp <= cutoff) {
          delete parsed[projectId].current;
        }
        
        if (!parsed[projectId].current && parsed[projectId].history.length === 0) {
          delete parsed[projectId];
        }
      }
    });
    
    return parsed;
  } catch (error) {
    console.warn('Failed to load deployment cache:', error);
    return {};
  }
};

const getDeploymentConfigCache = (): DeploymentConfigCache => {
  try {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY);
    if (!cached) return {};
    return JSON.parse(cached) as DeploymentConfigCache;
  } catch (error) {
    console.warn('Failed to load deployment config cache:', error);
    return {};
  }
};

const saveDeploymentConfigCache = (cache: DeploymentConfigCache): boolean => {
  try {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch (error) {
    console.error('Failed to save deployment config cache:', error);
    return false;
  }
};

// 🗑️ DEPRECATED: Server pair selection now managed by ServerPairStateService
// These functions are kept for reference but should not be used
// const saveServerPairSelection = ... (removed)
// const getServerPairSelection = ... (removed)

const saveDeploymentCache = (cache: DeploymentCache): boolean => {
  try {
    const cacheString = JSON.stringify(cache);
    
    if (cacheString.length > MAX_CACHE_SIZE) {
      console.warn('Deployment cache exceeds size limit, cleaning oldest entries');
      
      Object.keys(cache).forEach(projectId => {
        if (cache[projectId] && cache[projectId].history.length > 3) {
          cache[projectId].history = cache[projectId].history
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 3);
        }
      });
      
      const cleanedString = JSON.stringify(cache);
      if (cleanedString.length > MAX_CACHE_SIZE) {
        console.error('Cache still too large after cleaning');
        return false;
      }
    }
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch (error) {
    console.error('Failed to save deployment cache:', error);
    return false;
  }
};

const serializeErrorHandlerState = (errorHandler: DeploymentErrorHandler): string | undefined => {
  try {
    if (!errorHandler || typeof errorHandler.getSerializedState !== 'function') {
      console.warn('Error handler serialization not available');
      return undefined;
    }
    return errorHandler.getSerializedState();
  } catch (error) {
    console.warn('Failed to serialize error handler state:', error);
    return undefined;
  }
};

const safeHasStructuredErrors = (errorHandler: DeploymentErrorHandler): boolean => {
  try {
    if (!errorHandler) return false;
    if (typeof errorHandler.hasStructuredErrors !== 'function') return false;
    return errorHandler.hasStructuredErrors();
  } catch (error) {
    console.warn('Error checking structured errors:', error);
    return false;
  }
};

const deserializeErrorHandlerState = (errorHandler: DeploymentErrorHandler, serializedState: string): boolean => {
  try {
    if (!errorHandler || !serializedState) return false;
    if (typeof errorHandler.restoreFromSerializedState !== 'function') {
      console.warn('Error handler deserialization not available');
      return false;
    }
    return errorHandler.restoreFromSerializedState(serializedState);
  } catch (error) {
    console.warn('Failed to deserialize error handler state:', error);
    return false;
  }
};

const saveDeploymentToCache = (entry: DeploymentCacheEntry): void => {
  const cache = getDeploymentCache();
  
  if (!cache[entry.projectId]) {
    cache[entry.projectId] = { history: [] };
  }
  
  cache[entry.projectId].current = entry;
  
  if (entry.status !== 'in-progress') {
    cache[entry.projectId].history.unshift(entry);
    
    if (cache[entry.projectId].history.length > MAX_HISTORY_PER_PROJECT) {
      cache[entry.projectId].history = cache[entry.projectId].history.slice(0, MAX_HISTORY_PER_PROJECT);
    }
  }
  
  saveDeploymentCache(cache);
};

const getCachedDeployment = (projectId: string): DeploymentCacheEntry | null => {
  const cache = getDeploymentCache();
  const projectCache = cache[projectId];
  if (!projectCache) return null;
  
  // 🔧 FIX: Return the most recent deployment (either current or first in history)
  // History is sorted with most recent first (via unshift), so check which is newer
  const current = projectCache.current;
  const mostRecentHistory = projectCache.history && projectCache.history.length > 0 
    ? projectCache.history[0] 
    : null;
  
  if (!current && !mostRecentHistory) return null;
  if (!current) return mostRecentHistory;
  if (!mostRecentHistory) return current;
  
  // Return whichever is more recent
  return current.timestamp > mostRecentHistory.timestamp ? current : mostRecentHistory;
};

const getDeploymentHistory = (projectId: string): DeploymentCacheEntry[] => {
  const cache = getDeploymentCache();
  return cache[projectId]?.history || [];
};

const clearProjectDeploymentCache = (projectId: string): void => {
  const cache = getDeploymentCache();
  delete cache[projectId];
  saveDeploymentCache(cache);
  console.log('🧹 Cleared deployment session cache, preserved server pair configuration');
};

const clearProjectConfigurationCache = (projectId: string): void => {
  const configCache = getDeploymentConfigCache();
  delete configCache[projectId];
  saveDeploymentConfigCache(configCache);
  localStorage.removeItem(`selected-server-pair-${projectId}`);
  console.log('🧹 Cleared deployment configuration cache');
};

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

// ==================== ULTRA HIGH-PERFORMANCE PARALLEL PROCESSING ====================

// Advanced concurrency limiter with adaptive scaling
const createConcurrencyLimiter = (maxConcurrent: number) => {
  let running = 0;
  const queue: Array<() => Promise<any>> = [];
  
  const process = async () => {
    if (running >= maxConcurrent || queue.length === 0) return;
    
    running++;
    const task = queue.shift()!;
    
    try {
      await task();
    } catch (error) {
      console.error('Task failed in concurrency limiter:', error);
    } finally {
      running--;
      if (queue.length > 0) {
        process();
      }
    }
  };
  
  return {
    add: (task: () => Promise<any>): Promise<void> => {
      return new Promise((resolve, reject) => {
        queue.push(async () => {
          try {
            await task();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        process();
      });
    }
  };
};

const batchProcessWithProgress = async <T, R>(
  items: T[], 
  processor: (item: T, index: number) => Promise<R>,
  maxConcurrent: number,
  progressCallback?: (completed: number, total: number) => void
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let completed = 0;
  
  const limiter = createConcurrencyLimiter(maxConcurrent);
  
  const tasks = items.map((item, index) =>
    limiter.add(async () => {
      try {
        const result = await processor(item, index);
        results[index] = result;
        completed++;
        if (progressCallback) {
          progressCallback(completed, items.length);
        }
        return result;
      } catch (error) {
        completed++;
        if (progressCallback) {
          progressCallback(completed, items.length);
        }
        throw error;
      }
    })
  );
  
  await Promise.allSettled(tasks);
  return results;
};

// ==================== LOGGING SYSTEM ====================

interface LogCategories {
  DEPLOYMENT: boolean;
  COMPILATION: boolean;
  CANISTER: boolean;
  CANISTER_ID_REPLACEMENT: boolean;
  AUTO_DEPLOYMENT: boolean;
  ERROR_PARSING: boolean;
  STATE_PERSISTENCE: boolean;
  MUTEX_CONTROL: boolean;
  AUTO_RETRY: boolean;
  COORDINATOR_INTEGRATION: boolean;
  VITE_CONFIG_GENERATION: boolean;
  SERVER_PAIR_CACHE: boolean;
  ENHANCED_WORKFLOW: boolean;
  SEQUENTIAL_ERROR: boolean;
  EXECUTION_COUNT: boolean;
  RICH_CONTEXT_INTEGRATION: boolean;
  PROCESSED_MESSAGE_EXTRACTION: boolean;
  DIRECT_MESSAGE_PASSING: boolean;
  PERFORMANCE: boolean;
  PARALLEL_PROCESSING: boolean;
  CHUNK_PROCESSING: boolean;
  EXECUTION_CONTEXT_ISOLATION: boolean;
}

const LOG_CATEGORIES: LogCategories = {
  DEPLOYMENT: true, 
  COMPILATION: true, 
  CANISTER: false,   
  CANISTER_ID_REPLACEMENT: true,
  AUTO_DEPLOYMENT: true,
  ERROR_PARSING: true,
  STATE_PERSISTENCE: true,
  MUTEX_CONTROL: true,
  AUTO_RETRY: true,
  COORDINATOR_INTEGRATION: true,
  VITE_CONFIG_GENERATION: true,
  SERVER_PAIR_CACHE: true,
  ENHANCED_WORKFLOW: true,
  SEQUENTIAL_ERROR: true,
  EXECUTION_COUNT: true,
  RICH_CONTEXT_INTEGRATION: true,
  PROCESSED_MESSAGE_EXTRACTION: true,
  DIRECT_MESSAGE_PASSING: true,
  PERFORMANCE: true,
  PARALLEL_PROCESSING: true,
  CHUNK_PROCESSING: true,
  EXECUTION_CONTEXT_ISOLATION: true
};

const log = (category: keyof LogCategories, message: string, ...args: any[]) => {
  if (LOG_CATEGORIES[category]) {
    console.log(`[${category}] ${message}`, ...args);
  }
};

// ==================== EXECUTION CONTEXT ISOLATION ====================

interface ExecutionContextState {
  isAutoRetryExecution: boolean;
  coordinatorWorkflowId: string | null;
  requiresCleanSlate: boolean;
  shouldIgnoreCache: boolean;
  executionAttempt: number;
}

const createCleanExecutionContext = (isAutoRetry: boolean, workflowId: string | null, executionCount: number): ExecutionContextState => {
  return {
    isAutoRetryExecution: isAutoRetry,
    coordinatorWorkflowId: workflowId,
    requiresCleanSlate: isAutoRetry,
    shouldIgnoreCache: isAutoRetry,
    executionAttempt: executionCount
  };
};

const prepareExecutionContext = (
  currentState: any,
  consolidatedAutoRetryState: any,
  projectId: string
): ExecutionContextState => {
  const isAutoRetry = consolidatedAutoRetryState.isActive;
  const workflowId = consolidatedAutoRetryState.workflowId;
  const executionCount = consolidatedAutoRetryState.executionCount;
  
  if (isAutoRetry) {
    log('EXECUTION_CONTEXT_ISOLATION', '🔄 Preparing clean execution context for auto-retry', {
      workflowId,
      executionCount,
      currentStateBlocking: {
        hasDeploymentStartTime: !!currentState.deploymentStartTime,
        isCurrentlyDeploying: currentState.isDeploying,
        hasError: !!currentState.deploymentError,
        status: currentState.deploymentStatus
      }
    });
  }
  
  return createCleanExecutionContext(isAutoRetry, workflowId, executionCount);
};

const cleanExecutionState = (
  setDeploymentState: any,
  updateErrorHandlerState: any,
  deploymentErrorHandler: any,
  executionContext: ExecutionContextState,
  projectId: string
): void => {
  if (executionContext.requiresCleanSlate) {
    log('EXECUTION_CONTEXT_ISOLATION', '🧹 Cleaning execution state for auto-retry context', {
      workflowId: executionContext.coordinatorWorkflowId,
      executionAttempt: executionContext.executionAttempt
    });
    
    // Clear deployment state for fresh execution
    setDeploymentState((prev: any) => ({
      ...prev,
      deploymentStatus: 'idle',
      deploymentProgress: 0,
      deploymentError: null,
      isDeploying: false,
      deploymentStartTime: null,
      deploymentDuration: null,
      deploymentLogs: [], // Clear logs for fresh attempt
      isAutoRetrying: true,
      retryAttempt: executionContext.executionAttempt
    }));
    
    // Clear error handler state
    updateErrorHandlerState({
      showFixButton: false,
      errorSummary: null,
      lastErrorProcessingTime: null,
      isProcessingError: false,
      errorClassification: null,
      errorCategory: null,
      blockingErrorsCount: 0,
      warningsCount: 0
    });
    
    // Clear error handler internal state
    try {
      if (deploymentErrorHandler && typeof deploymentErrorHandler.clearErrors === 'function') {
        deploymentErrorHandler.clearErrors();
        log('EXECUTION_CONTEXT_ISOLATION', '✅ Cleared error handler internal state');
      }
    } catch (error) {
      log('EXECUTION_CONTEXT_ISOLATION', '⚠️ Failed to clear error handler:', error);
    }
  }
};

// ==================== AUTO-DEPLOYMENT WITH COORDINATOR INTEGRATION ====================

interface DeploymentInterfaceProps {
  projectId: string;
  projectName: string;
  userCanisterId?: string | null;
  autoDeploymentContext?: DeploymentContext | null;
  isActive?: boolean;
  selectedVersion?: string | null; // Version ID or null for working copy
  versionString?: string | null; // Version display string (e.g., "v1.2.0")
}

interface ServerPair {
  pairId: string;
  name: string;
  createdAt: number;
  creditsAllocated: number;
  frontendCanisterId: string;
  backendCanisterId: string;
}

interface DeploymentState {
  selectedServerPair: ServerPair | null;
  deploymentStatus: 'idle' | 'analyzing' | 'compiling-backend' | 'deploying-backend' | 'bundling-frontend' | 'deploying-frontend' | 'completed' | 'failed';
  deploymentProgress: number;
  deploymentLogs: string[];
  deploymentError: string | null;
  isDeploying: boolean;
  deployedFrontendUrl: string | null;
  deploymentStartTime: number | null;
  deploymentDuration: number | null;
  retryAttempt: number;
  isAutoRetrying: boolean;
}

// ==================== ERROR HANDLER STATE ====================

interface ErrorHandlerState {
  showFixButton: boolean;
  errorSummary: string | null;
  lastErrorProcessingTime: number | null;
  isProcessingError: boolean;
  errorClassification: string | null;
  errorCategory: string | null;
  blockingErrorsCount: number;
  warningsCount: number;
}

// ==================== CONSOLIDATED COORDINATOR STATE ====================

interface ConsolidatedAutoRetryState {
  isActive: boolean;
  workflowId: string | null;
  phase: 'IDLE' | 'MESSAGE_INJECTION' | 'AI_PROCESSING' | 'FILE_APPLICATION' | 'DEPLOYMENT' | 'COMPLETED' | 'FAILED';
  executionCount: number;
  maxExecutions: number;
  displayExecutionCount: string;
  isSequentialError: boolean;
  sequentialErrorCount: number;
  deploymentRetryReady: boolean;
  elapsedTime: number | null;
  hasError: boolean;
  errorSummary: string | null;
  errorClassification: string | null;
  errorCategory: string | null;
}

// ==================== STATE INITIALIZATION ====================

// 🔥 UPDATED: Initialize deployment state without localStorage dependencies
// selectedServerPair will be computed from centralized ServerPairStateService
const initializeDeploymentState = (projectId: string, availableServerPairs: ServerPair[] = [], executionContext?: ExecutionContextState, centralServerPairId?: string | null): DeploymentState => {
  log('STATE_PERSISTENCE', '🔄 Initializing deployment state from cache...', { 
    projectId,
    isAutoRetryContext: executionContext?.isAutoRetryExecution,
    shouldIgnoreCache: executionContext?.shouldIgnoreCache,
    centralServerPairId
  });
  
  // For auto-retry contexts, start with clean state
  if (executionContext?.shouldIgnoreCache) {
    log('EXECUTION_CONTEXT_ISOLATION', '🧹 Auto-retry context: using clean state instead of cache', {
      workflowId: executionContext.coordinatorWorkflowId,
      executionAttempt: executionContext.executionAttempt
    });
    
    let selectedServerPair: ServerPair | null = null;
    
    if (centralServerPairId && availableServerPairs.length > 0) {
      selectedServerPair = availableServerPairs.find(pair => pair.pairId === centralServerPairId) || null;
      if (selectedServerPair) {
        log('EXECUTION_CONTEXT_ISOLATION', '✅ Restored server pair from centralized state for clean execution:', selectedServerPair.name);
      }
    }
    
    return {
      selectedServerPair,
      deploymentStatus: 'idle',
      deploymentProgress: 0,
      deploymentLogs: [],
      deploymentError: null,
      isDeploying: false,
      deployedFrontendUrl: null,
      deploymentStartTime: null,
      deploymentDuration: null,
      retryAttempt: executionContext.executionAttempt,
      isAutoRetrying: true
    };
  }
  
  // Normal cache restoration for manual deployments
  const cached = getCachedDeployment(projectId);
  
  if (cached?.sessionCache?.deploymentState) {
    log('STATE_PERSISTENCE', '✅ Found cached deployment state:', cached.sessionCache.deploymentState);
    
    let selectedServerPair: ServerPair | null = null;
    
    // Use centralized server pair ID instead of localStorage
    const serverPairId = centralServerPairId || cached.sessionCache.deploymentState.selectedServerPairId;
    
    if (serverPairId && availableServerPairs.length > 0) {
      selectedServerPair = availableServerPairs.find(pair => pair.pairId === serverPairId) || null;
      
      if (selectedServerPair) {
        log('STATE_PERSISTENCE', '✅ Restored selected server pair:', selectedServerPair.name);
      } else {
        log('STATE_PERSISTENCE', '⚠️ Cached server pair not found in available pairs');
      }
    }
    
    // 🔧 FIX: Reset status to 'idle' if it's 'completed' or 'failed' to allow next deployment
    // This ensures the status bar doesn't stay stuck at 100% or error percentage
    const cachedStatus = cached.sessionCache.deploymentState.deploymentStatus;
    const shouldReset = (cachedStatus === 'completed' || cachedStatus === 'failed');
    const resetStatus: DeploymentState['deploymentStatus'] = shouldReset ? 'idle' : cachedStatus;
    
    return {
      selectedServerPair,
      deploymentStatus: resetStatus,
      deploymentProgress: shouldReset ? 0 : cached.sessionCache.deploymentState.deploymentProgress,
      deploymentLogs: cached.logs || [],
      deploymentError: shouldReset ? null : cached.sessionCache.deploymentState.deploymentError,
      isDeploying: false,
      deployedFrontendUrl: cached.frontendUrl || null,
      deploymentStartTime: null, // 🔧 FIX: Clear start time so next deployment can start
      deploymentDuration: cached.sessionCache.deploymentState.deploymentDuration,
      retryAttempt: cached.sessionCache.deploymentState.retryAttempt || 0,
      isAutoRetrying: cached.sessionCache.deploymentState.isAutoRetrying || false
    };
  }
  
  // Use centralized server pair ID
  let selectedServerPair: ServerPair | null = null;
  
  if (centralServerPairId && availableServerPairs.length > 0) {
    selectedServerPair = availableServerPairs.find(pair => pair.pairId === centralServerPairId) || null;
    if (selectedServerPair) {
      log('STATE_PERSISTENCE', '✅ Restored server pair from centralized state:', selectedServerPair.name);
    }
  }
  
  log('STATE_PERSISTENCE', '📝 No cached deployment state found, using defaults');
  return {
    selectedServerPair,
    deploymentStatus: 'idle',
    deploymentProgress: 0,
    deploymentLogs: [],
    deploymentError: null,
    isDeploying: false,
    deployedFrontendUrl: null,
    deploymentStartTime: null,
    deploymentDuration: null,
    retryAttempt: 0,
    isAutoRetrying: false
  };
};

const initializeErrorHandlerState = (projectId: string, deploymentErrorHandler: DeploymentErrorHandler, executionContext?: ExecutionContextState): ErrorHandlerState => {
  // For auto-retry contexts, start with clean error state
  if (executionContext?.shouldIgnoreCache) {
    log('EXECUTION_CONTEXT_ISOLATION', '🧹 Auto-retry context: using clean error handler state', {
      workflowId: executionContext.coordinatorWorkflowId
    });
    
    return {
      showFixButton: false,
      errorSummary: null,
      lastErrorProcessingTime: null,
      isProcessingError: false,
      errorClassification: null,
      errorCategory: null,
      blockingErrorsCount: 0,
      warningsCount: 0
    };
  }
  
  const cached = getCachedDeployment(projectId);
  
  if (cached?.sessionCache?.errorHandlerState) {
    log('STATE_PERSISTENCE', '🔧 Restoring error handler state:', cached.sessionCache.errorHandlerState);
    
    const now = Date.now();
    const errorTimestamp = cached.sessionCache.errorHandlerState.errorProcessingTimestamp || 0;
    const isRecentError = (now - errorTimestamp) < (5 * 60 * 1000);
    
    if (cached.sessionCache.errorHandlerState.serializedErrors && isRecentError) {
      try {
        log('STATE_PERSISTENCE', '🔍 Attempting to restore full error handler state...');
        const restored = deserializeErrorHandlerState(deploymentErrorHandler, cached.sessionCache.errorHandlerState.serializedErrors);
        if (restored) {
          log('STATE_PERSISTENCE', '✅ Error handler state fully restored');
        } else {
          log('STATE_PERSISTENCE', '⚠️ Error handler state restoration failed, using UI state only');
        }
      } catch (restoreError) {
        log('STATE_PERSISTENCE', '⚠️ Failed to restore structured errors:', restoreError);
      }
    }
    
    return {
      showFixButton: isRecentError ? cached.sessionCache.errorHandlerState.showFixButton : false,
      errorSummary: isRecentError ? cached.sessionCache.errorHandlerState.errorSummary : null,
      lastErrorProcessingTime: errorTimestamp,
      isProcessingError: false,
      errorClassification: isRecentError ? cached.sessionCache.errorHandlerState.errorClassification || null : null,
      errorCategory: isRecentError ? cached.sessionCache.errorHandlerState.errorCategory || null : null,
      blockingErrorsCount: 0,
      warningsCount: 0
    };
  }
  
  return {
    showFixButton: false,
    errorSummary: null,
    lastErrorProcessingTime: null,
    isProcessingError: false,
    errorClassification: null,
    errorCategory: null,
    blockingErrorsCount: 0,
    warningsCount: 0
  };
};

// ==================== INTERFACES ====================

interface PreparedMotokoFiles {
  files: Array<{ name: string; content: string }>;
  mainFile: string;
  packages: MotokoPackage[];
}

interface PreparedFrontendFiles {
  files: Array<{ name: string; content: string }>;
  packageJson: object;
}

interface DFXUtilsResponse {
  success: boolean;
  wasm: string;
  candid: string;
  typescript: string;
  didJs: string;
  jsonSchema: string;
  compiledWasm?: Uint8Array;
  error?: string;
}

interface BundlerJobResponse {
  success: boolean;
  jobId: string;
  status: string;
  statusUrl: string;
  downloadUrl: string;
  estimatedTime: string;
}

interface BundlerStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

interface BundlerResponse {
  success: boolean;
  output: Record<string, {
    type: 'Buffer';
    data: number[];
  }>;
}

interface DeploymentFileSnapshot {
  [fileName: string]: string;
}

// ==================== CACHING SYSTEM ====================

interface CachedDeploymentUrl {
  [projectId: string]: {
    url: string;
    timestamp: number;
    serverPairId: string;
    duration: number | null;
  };
}

const DEPLOYMENT_URL_CACHE_DURATION = 24 * 60 * 60 * 1000;

const deploymentUrlCache: CachedDeploymentUrl = {};

const getCachedDeploymentUrl = (projectId: string): { url: string; duration: number | null; serverPairId: string } | null => {
  const cached = deploymentUrlCache[projectId];
  if (!cached) return null;
  
  const now = Date.now();
  const isExpired = (now - cached.timestamp) > DEPLOYMENT_URL_CACHE_DURATION;
  
  if (isExpired) {
    delete deploymentUrlCache[projectId];
    return null;
  }
  
  return {
    url: cached.url,
    duration: cached.duration,
    serverPairId: cached.serverPairId
  };
};

const setCachedDeploymentUrl = (projectId: string, url: string, serverPairId: string, duration: number | null): void => {
  deploymentUrlCache[projectId] = {
    url,
    timestamp: Date.now(),
    serverPairId,
    duration
  };
};

const clearCachedDeploymentUrl = (projectId: string): void => {
  delete deploymentUrlCache[projectId];
};

// Hardcoded Motoko packages for DFXUtils compilation
const DEFAULT_MOTOKO_PACKAGES: MotokoPackage[] = [
  {
    name: "base",
    repo: "dfinity/motoko-base",
    version: "0.14.9",
    dir: "src"
  },
  {
    name: "sha2",
    repo: "research-ag/sha2",
    version: "0.1.0",
    dir: "src"
  },
  {
    name: "cn-logger",
    repo: "coinnation/cnLogger",
    version: "0.1.1",
    dir: "src"
  }
];

const addProjectPrefix = (files: Array<{ name: string; content: string }>, projectName: string): Array<{ name: string; content: string }> => {
  return files.map(file => ({
    ...file,
    name: file.name.startsWith(`${projectName}/`) 
      ? file.name  
      : `${projectName}/${file.name}`  
  }));
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile, isTablet };
};

const extractActorNameFromMotoko = (motokoContent: string, fallbackFilename: string): string => {
  const cleanContent = motokoContent
    .replace(/\/\/.*$/gm, '') 
    .replace(/\/\*[\s\S]*?\*\//g, ''); 

  const actorClassMatch = cleanContent.match(/actor\s+class\s+(\w+)\s*\(/);
  if (actorClassMatch && actorClassMatch[1]) {
    return actorClassMatch[1];
  }

  const namedActorMatch = cleanContent.match(/actor\s+(\w+)\s*\{/);
  if (namedActorMatch && namedActorMatch[1]) {
    return namedActorMatch[1];
  }

  const anonymousActorMatch = cleanContent.match(/actor\s*\{/);
  if (anonymousActorMatch) {
    return fallbackFilename.split('/').pop()?.replace('.mo', '') || 'main';
  }

  return fallbackFilename.split('/').pop()?.replace('.mo', '') || 'main';
};

// ==================== VITE CONFIG GENERATION ====================

const generateViteConfig = (backendCanisterId: string, projectName: string): string => {
  log('VITE_CONFIG_GENERATION', '🔧 Generating Vite config with backend canister ID:', backendCanisterId);
  
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    root: '.',
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            input: resolve(__dirname, 'index.html')
        }
    },
    server: {
        port: 3000
    },
    define: {
        'import.meta.env.VITE_BACKEND_CANISTER_ID': '"${backendCanisterId}"',
        'global': 'globalThis'
    }
});`;
};

export const DeploymentInterface: React.FC<DeploymentInterfaceProps> = ({
  projectId,
  projectName,
  selectedVersion,
  versionString,
  userCanisterId,
  autoDeploymentContext,
  isActive = true
}) => {
  const identity = useAppStore(state => state.identity);
  const principal = useAppStore(state => state.principal);
  
  const activeProject = useAppStore(state => state.activeProject);
  const projectFiles = useAppStore(state => state.projectFiles);
  const projectGeneratedFiles = useAppStore(state => state.projectGeneratedFiles);
  const generatedFiles = useAppStore(state => state.generatedFiles);

  // 🔥 NEW: Use centralized server pair state management
  const {
    selectedServerPairId,
    setSelectedServerPair: setServerPairId,
    isLoading: serverPairStateLoading,
    error: serverPairStateError
  } = useServerPairState();

  // 🆕 VERSION-AWARE: Load files from selected version or working copy
  const getDeploymentFiles = useCallback(async (): Promise<{ [key: string]: string }> => {
    if (!activeProject) {
      return {};
    }

    // If a version is selected, load files from that version
    if (selectedVersion) {
      log('VERSION_DEPLOYMENT', `📦 Loading files from version: ${selectedVersion}`);
      try {
        const result = await userCanisterService.getProjectFiles(activeProject, selectedVersion);
        
        if ('ok' in result) {
          const versionFiles: { [key: string]: string } = {};
          
          // Convert artifacts to file map
          result.ok.forEach((artifact: any) => {
            const path = artifact.path || artifact.name;
            const content = artifact.content || '';
            versionFiles[path] = content;
          });
          
          log('VERSION_DEPLOYMENT', `✅ Loaded ${Object.keys(versionFiles).length} files from version ${selectedVersion}`);
          return versionFiles;
        } else {
          log('VERSION_DEPLOYMENT', `❌ Failed to load version files: ${result.err}`);
          // Fall back to working copy
        }
      } catch (error) {
        log('VERSION_DEPLOYMENT', `❌ Error loading version files:`, error);
        // Fall back to working copy
      }
    }

    // Default: Load from working copy (current state)
    log('VERSION_DEPLOYMENT', '🔧 Loading files from working copy');
    const canisterFiles = projectFiles[activeProject] || {};
    const projectGenFiles = projectGeneratedFiles[activeProject] || {};
    const currentGeneratedFiles = generatedFiles || {};
    
    return {
      ...canisterFiles,
      ...projectGenFiles,
      ...currentGeneratedFiles
    };
  }, [activeProject, selectedVersion, projectFiles, projectGeneratedFiles, generatedFiles]);

  const hasRequiredFiles = useCallback(async () => {
    if (!activeProject) {
      return false;
    }
    
    const allFiles = await getDeploymentFiles();
    const files = Object.keys(allFiles);
    const hasMotokoFiles = files.some(f => f.endsWith('.mo'));
    const hasFrontendFiles = files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.js'));
    const hasPackageJson = files.some(f => f.endsWith('package.json'));
    
    return hasMotokoFiles && hasFrontendFiles && hasPackageJson;
  }, [activeProject, getDeploymentFiles]);

  const {
    deploymentCoordination,
    handleDeploymentError,
    handleDeploymentSuccess, // 🔥 NEW: Added for economy metrics tracking
    findDeploymentByProject,
    getProjectServerPair,
    setProjectServerPair,
    projectServerPairs,
  } = useAppStore(state => ({
    deploymentCoordination: state.deploymentCoordination,
    handleDeploymentError: state.handleDeploymentError,
    handleDeploymentSuccess: state.handleDeploymentSuccess, // 🔥 NEW: Added for economy metrics tracking
    findDeploymentByProject: state.findDeploymentByProject,
    getProjectServerPair: state.getProjectServerPair,
    setProjectServerPair: state.setProjectServerPair,
    projectServerPairs: state.projectServerPairs,
  }));

  const { isMobile, isTablet } = useIsMobile();

  const [projectServerPairsList, setProjectServerPairs] = useState<ServerPair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCacheCheck, setLastCacheCheck] = useState<number>(0);
  
  // ==================== CONSOLIDATED AUTO-RETRY STATE ====================
  
  const [consolidatedAutoRetryState, setConsolidatedAutoRetryState] = useState<ConsolidatedAutoRetryState>({
    isActive: false,
    workflowId: null,
    phase: 'IDLE',
    executionCount: 0,
    maxExecutions: 3,
    displayExecutionCount: '0/3',
    isSequentialError: false,
    sequentialErrorCount: 0,
    deploymentRetryReady: false,
    elapsedTime: null,
    hasError: false,
    errorSummary: null,
    errorClassification: null,
    errorCategory: null
  });

  // ==================== EXECUTION CONTEXT STATE ====================
  
  const [executionContext, setExecutionContext] = useState<ExecutionContextState>(() => 
    createCleanExecutionContext(false, null, 0)
  );

  // ==================== DEPLOYMENT STATE INITIALIZATION ====================
  
  const [deploymentState, setDeploymentState] = useState<DeploymentState>(() => {
    // CRITICAL FIX: If there's an autoDeploymentContext, start with clean state to allow new deployment
    if (autoDeploymentContext) {
      log('STATE_PERSISTENCE', '🧹 New deployment requested - starting with clean state (ignoring cache)');
      return {
        selectedServerPair: null,
        deploymentStatus: 'idle',
        deploymentProgress: 0,
        deploymentLogs: [],
        deploymentError: null,
        isDeploying: false,
        deployedFrontendUrl: null,
        deploymentStartTime: null,
        deploymentDuration: null,
        retryAttempt: 0,
        isAutoRetrying: false
      };
    }
    return initializeDeploymentState(projectId, [], executionContext, selectedServerPairId);
  });

  const [errorHandlerState, setErrorHandlerState] = useState<ErrorHandlerState>(() => {
    const deploymentErrorHandler = (() => {
      try {
        return DeploymentErrorHandler.getInstance();
      } catch (error) {
        log('ERROR_PARSING', '❌ Failed to initialize error handler singleton:', error);
        return null;
      }
    })();
    
    if (deploymentErrorHandler) {
      return initializeErrorHandlerState(projectId, deploymentErrorHandler, executionContext);
    }
    
    return {
      showFixButton: false,
      errorSummary: null,
      lastErrorProcessingTime: null,
      isProcessingError: false,
      errorClassification: null,
      errorCategory: null,
      blockingErrorsCount: 0,
      warningsCount: 0
    };
  });

  const [deploymentErrorHandler] = useState(() => {
    try {
      const handler = DeploymentErrorHandler.getInstance();
      log('ERROR_PARSING', '✅ Error handler singleton initialized successfully');
      return handler;
    } catch (error) {
      log('ERROR_PARSING', '❌ Failed to initialize error handler singleton:', error);
      return {
        hasStructuredErrors: () => false,
        getErrorSummary: () => null,
        createUserFriendlyExplanation: () => null,
        getFixRequestMessage: () => null,
        clearErrors: () => {},
        processDeploymentError: () => ({ hasErrors: false, canAutoFix: false }),
        processFrontendError: () => ({ hasErrors: false, canAutoFix: false }),
        getBlockingErrorsCount: () => 0,
        getWarningsCount: () => 0
      } as any;
    }
  });
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [cachedDeployment, setCachedDeployment] = useState<DeploymentCacheEntry | null>(null);
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentCacheEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Debounced cache save to prevent state conflicts
  const debouncedCacheSave = useRef<NodeJS.Timeout | null>(null);
  
  // CRITICAL FIX: Ref-based guard to prevent double execution (React.StrictMode protection)
  const isExecutingDeploymentRef = useRef<boolean>(false);
  
  // 🔧 FIX: Ref for logs container to enable auto-scroll
  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  
  // 🔧 FIX: Ref to track if deployment has started to prevent useEffect from clearing state
  const deploymentStartedRef = useRef<boolean>(false);
  
  // 🔧 FIX: Refs to prevent infinite loops in server pair coordination
  const lastProcessedUpdateRef = useRef<number | null>(null);
  const lastLoadedProjectRef = useRef<string | null>(null);

  // ==================== COORDINATOR SUBSCRIPTION ====================
  
  useEffect(() => {
    log('COORDINATOR_INTEGRATION', '🔌 Setting up coordinator subscription');

    const unsubscribe = autoRetryCoordinator.subscribe((state) => {
      const projectWorkflow = state.workflows.find(w => w.projectId === projectId);
      
      if (projectWorkflow) {
        const elapsedTime = Date.now() - projectWorkflow.startTime;
        
        const consolidatedState: ConsolidatedAutoRetryState = {
          isActive: true,
          workflowId: projectWorkflow.workflowId,
          phase: projectWorkflow.phase,
          executionCount: projectWorkflow.executionCount,
          maxExecutions: projectWorkflow.maxExecutions,
          displayExecutionCount: `${projectWorkflow.executionCount + 1}/${projectWorkflow.maxExecutions}`,
          isSequentialError: projectWorkflow.isSequentialError || false,
          sequentialErrorCount: projectWorkflow.sequentialErrorCount || 0,
          deploymentRetryReady: projectWorkflow.deploymentRetryReady || false,
          elapsedTime: elapsedTime,
          hasError: !!projectWorkflow.lastError,
          errorSummary: projectWorkflow.lastError || null,
          errorClassification: projectWorkflow.lastErrorClassification || null,
          errorCategory: null
        };

        setConsolidatedAutoRetryState(consolidatedState);
        
        // Update execution context when coordinator state changes
        const newExecutionContext = prepareExecutionContext(
          deploymentState,
          consolidatedState,
          projectId
        );
        setExecutionContext(newExecutionContext);
        
        // CRITICAL FIX: Clean execution state when coordinator signals retry ready
        if (projectWorkflow.deploymentRetryReady && 
            !deploymentState.isDeploying) {
          
          log('EXECUTION_CONTEXT_ISOLATION', '🧹 Coordinator signals retry ready - cleaning execution state', {
            currentStatus: deploymentState.deploymentStatus,
            currentStartTime: deploymentState.deploymentStartTime,
            currentError: deploymentState.deploymentError,
            workflowId: projectWorkflow.workflowId,
            executionCount: projectWorkflow.executionCount
          });
          
          // Clean the execution state immediately
          cleanExecutionState(
            setDeploymentState,
            updateErrorHandlerState,
            deploymentErrorHandler,
            newExecutionContext,
            projectId
          );
        }
        
      } else {
        setConsolidatedAutoRetryState({
          isActive: false,
          workflowId: null,
          phase: 'IDLE',
          executionCount: 0,
          maxExecutions: 3,
          displayExecutionCount: '0/3',
          isSequentialError: false,
          sequentialErrorCount: 0,
          deploymentRetryReady: false,
          elapsedTime: null,
          hasError: false,
          errorSummary: null,
          errorClassification: null,
          errorCategory: null
        });

        // Reset execution context
        setExecutionContext(createCleanExecutionContext(false, null, 0));

        if (deploymentState.isAutoRetrying) {
          setDeploymentState(prev => ({
            ...prev,
            isAutoRetrying: false,
            retryAttempt: 0
          }));
        }
      }
    });

    return unsubscribe;
  }, [projectId, deploymentState.isAutoRetrying, deploymentState.isDeploying, deploymentState.deploymentStartTime, deploymentState.deploymentStatus, deploymentState.deploymentError]);

  // ==================== AUTO-DEPLOYMENT STATUS ====================
  
  const autoDeploymentStatus = useMemo(() => {
    const hasChatDeploymentContext = !!autoDeploymentContext;
    const hasServerPair = !!deploymentState.selectedServerPair;
    const isNotCurrentlyDeploying = !deploymentState.isDeploying;
    const serverPairsLoaded = !isLoading;
    
    // CRITICAL FIX: For coordinator retry, check execution context instead of deployment start time
    // Also, if there's a new autoDeploymentContext, treat it as not started (allows fresh deployment)
    // When autoDeploymentContext exists, we want to allow deployment even if there's cached state
    const hasNotStartedYet = executionContext.isAutoRetryExecution ? 
      (deploymentState.deploymentStatus === 'idle' && !deploymentState.isDeploying) :
      (autoDeploymentContext ? 
        // For new deployments, only check status and isDeploying (ignore cached deploymentStartTime)
        (deploymentState.deploymentStatus === 'idle' && !deploymentState.isDeploying) :
        !deploymentState.deploymentStartTime);
    
    const hasCoordinatorRetryContext = consolidatedAutoRetryState.deploymentRetryReady && hasNotStartedYet;
    const hasValidAutoContext = hasChatDeploymentContext || hasCoordinatorRetryContext;
    
    return {
      isAutoDeployment: hasChatDeploymentContext || consolidatedAutoRetryState.isActive,
      isReadyToStart: hasValidAutoContext && hasServerPair && isNotCurrentlyDeploying,
      // CRITICAL FIX: For new deployments with autoDeploymentContext, don't consider it triggered if status is idle
      hasTriggered: !executionContext.isAutoRetryExecution ? 
        (autoDeploymentContext ? 
          (deploymentState.deploymentStartTime !== null && deploymentState.deploymentStatus !== 'idle') :
          (deploymentState.deploymentStartTime !== null)) : 
        deploymentState.isDeploying,
      shouldAutoStart: hasValidAutoContext && hasServerPair && isNotCurrentlyDeploying && hasNotStartedYet && serverPairsLoaded,
      isCoordinatorActive: consolidatedAutoRetryState.isActive
    };
  }, [autoDeploymentContext, deploymentState.selectedServerPair, deploymentState.isDeploying, deploymentState.deploymentStartTime, deploymentState.deploymentStatus, isLoading, consolidatedAutoRetryState, executionContext]);

  // 🔥 NEW: Auto-trigger deployment when user clicks deploy from chat
  useEffect(() => {
    if (autoDeploymentStatus.shouldAutoStart && !deploymentState.isDeploying && deploymentState.deploymentStatus === 'idle') {
      console.log('🚀 [AUTO-DEPLOY] Auto-triggering deployment from chat context');
      // Small delay to ensure UI and state are ready
      const timer = setTimeout(() => {
        if (deploymentState.deploymentStatus === 'idle' && !deploymentState.isDeploying) {
          console.log('🚀 [AUTO-DEPLOY] Executing deployment automatically');
          executeDeployment();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoDeploymentStatus.shouldAutoStart, deploymentState.isDeploying, deploymentState.deploymentStatus]);

  const getCallbacks = useCallback(() => {
    const tabChangeCallback = (window as any).__chatInterfaceTabChange;
    const submitMessageCallback = (window as any).__chatInterfaceSubmitMessage;
    
    return {
      onTabSwitch: tabChangeCallback,
      onSubmitFixMessage: submitMessageCallback
    };
  }, []);

  const createDeploymentFileSnapshot = useCallback(async (): Promise<DeploymentFileSnapshot> => {
    log('CANISTER_ID_REPLACEMENT', '📸 Creating deployment file snapshot...');
    
    if (!activeProject) {
      log('CANISTER_ID_REPLACEMENT', '❌ No active project found');
      return {};
    }
    
    // 🆕 VERSION-AWARE: Use getDeploymentFiles to load from version or working copy
    const allFiles = await getDeploymentFiles();
    
    log('CANISTER_ID_REPLACEMENT', '📊 File sources:', {
      totalFiles: Object.keys(allFiles).length,
      isVersioned: !!selectedVersion,
      versionId: selectedVersion || 'working-copy'
    });
    
    const snapshot: DeploymentFileSnapshot = {};
    
    Object.entries(allFiles).forEach(([fileName, content]) => {
      snapshot[fileName] = resolveFileContentSafely(content, fileName);
    });
    
    log('CANISTER_ID_REPLACEMENT', '✅ Deployment snapshot created:', {
      totalFiles: Object.keys(snapshot).length,
      fileNames: Object.keys(snapshot).slice(0, 5),
      deployingVersion: selectedVersion ? `v${versionString || selectedVersion}` : 'Sandbox'
    });
    
    return snapshot;
  }, [activeProject, selectedVersion, versionString, getDeploymentFiles]);

  const resolveFileContentSafely = (content: any, fileName: string): string => {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content) && content.length > 0) {
      const contentItem = content[0];
      if (contentItem && typeof contentItem === 'object' && contentItem.Text) {
        return contentItem.Text;
      }
    }
    
    if (typeof content === 'object' && content !== null) {
      if (content.Text && typeof content.Text === 'string') {
        return content.Text;
      }
      
      if (content.content && typeof content.content === 'string') {
        return content.content;
      }
    }
    
    log('CANISTER_ID_REPLACEMENT', `⚠️ Could not resolve content for file: ${fileName}`, content);
    return '';
  };

  const addDeploymentLog = useCallback((message: string) => {
    // 🔧 FIX: Use setTimeout to break React's state batching and force immediate UI update
    setTimeout(() => {
      setDeploymentState(prev => ({
        ...prev,
        // 🔧 FIX: Ensure deploymentLogs is always an array to prevent errors
        deploymentLogs: [...(prev.deploymentLogs || []), `[${new Date().toLocaleTimeString()}] ${message}`]
      }));
      
      // Auto-scroll logs container to bottom
      if (logsContainerRef.current) {
        setTimeout(() => {
          if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
          }
        }, 0);
      }
    }, 0);
  }, []);

  const setDeploymentStatus = useCallback((status: DeploymentState['deploymentStatus']) => {
    setDeploymentState(prev => ({ ...prev, deploymentStatus: status }));
  }, []);

  const setDeploymentProgress = useCallback((progress: number) => {
    // 🔧 FIX: Use setTimeout to break React's state batching and force immediate UI update
    // But ensure isDeploying stays true when updating progress
    setTimeout(() => {
      setDeploymentState(prev => ({ 
        ...prev, 
        deploymentProgress: progress,
        // Ensure isDeploying stays true if we're updating progress (means deployment is active)
        isDeploying: prev.isDeploying || progress > 0
      }));
    }, 0);
  }, []);

  const setDeploymentError = useCallback((error: string | null) => {
    setDeploymentState(prev => ({ ...prev, deploymentError: error }));
  }, []);

  // ==================== CACHE SAVE FUNCTION ====================
  
  const saveCurrentStateToCache = useCallback((status: 'success' | 'failed' | 'in-progress' = 'in-progress', immediate = false) => {
    if (!deploymentState.deploymentStartTime && status === 'in-progress') return;
    
    if (consolidatedAutoRetryState.isActive && !immediate) {
      log('STATE_PERSISTENCE', '📁 Deferring cache save during coordinator operation', { status });
      return;
    }
    
    log('STATE_PERSISTENCE', '💾 Saving deployment state to cache:', {
      status,
      deploymentStatus: deploymentState.deploymentStatus,
      progress: deploymentState.deploymentProgress,
      logsCount: deploymentState.deploymentLogs.length,
      hasError: !!deploymentState.deploymentError,
      isAutoRetryActive: consolidatedAutoRetryState.isActive,
      immediate
    });

    let showFixButtonValue = false;
    let errorSummaryValue: string | null = null;
    let errorClassificationValue: string | null = null;
    let errorCategoryValue: string | null = null;

    if (!consolidatedAutoRetryState.isActive && errorHandlerState.showFixButton) {
      showFixButtonValue = errorHandlerState.showFixButton;
      errorSummaryValue = errorHandlerState.errorSummary;
      errorClassificationValue = errorHandlerState.errorClassification;
      errorCategoryValue = errorHandlerState.errorCategory;
    }

    const sessionCache: DeploymentSessionCache = {
      deploymentState: {
        selectedServerPairId: deploymentState.selectedServerPair?.pairId || null,
        deploymentStatus: deploymentState.deploymentStatus,
        deploymentProgress: deploymentState.deploymentProgress,
        deploymentError: deploymentState.deploymentError,
        isDeploying: false,
        deploymentStartTime: deploymentState.deploymentStartTime,
        deploymentDuration: deploymentState.deploymentDuration,
        retryAttempt: deploymentState.retryAttempt,
        isAutoRetrying: deploymentState.isAutoRetrying
      },
      errorHandlerState: {
        showFixButton: showFixButtonValue,
        errorSummary: errorSummaryValue,
        hasStructuredErrors: safeHasStructuredErrors(deploymentErrorHandler),
        serializedErrors: serializeErrorHandlerState(deploymentErrorHandler),
        lastProcessedError: deploymentState.deploymentError || undefined,
        errorProcessingTimestamp: errorHandlerState.lastErrorProcessingTime || undefined,
        errorClassification: errorClassificationValue,
        errorCategory: errorCategoryValue
      },
      coordinatorWorkflowState: consolidatedAutoRetryState.isActive ? {
        workflowId: consolidatedAutoRetryState.workflowId || '',
        phase: consolidatedAutoRetryState.phase,
        executionCount: consolidatedAutoRetryState.executionCount,
        isSequentialError: consolidatedAutoRetryState.isSequentialError,
        sequentialErrorCount: consolidatedAutoRetryState.sequentialErrorCount,
        automationPipelineActive: true,
        deploymentRetryReady: consolidatedAutoRetryState.deploymentRetryReady
      } : undefined,
      logs: [...deploymentState.deploymentLogs],
      timestamp: Date.now()
    };

    const cacheEntry: DeploymentCacheEntry = {
      projectId,
      deploymentId: `persist_${Date.now()}`,
      timestamp: deploymentState.deploymentStartTime || Date.now(),
      status,
      frontendUrl: deploymentState.deployedFrontendUrl || undefined,
      duration: deploymentState.deploymentDuration || undefined,
      serverPairId: deploymentState.selectedServerPair?.pairId,
      serverPairName: deploymentState.selectedServerPair?.name,
      error: deploymentState.deploymentError || undefined,
      logs: [...deploymentState.deploymentLogs],
      sessionCache
    };

    saveDeploymentToCache(cacheEntry);
    
    if (deploymentState.selectedServerPair) {
      // 🔥 UPDATED: Use centralized server pair state management
      setServerPairId(deploymentState.selectedServerPair.pairId);
    }
  }, [
    deploymentState,
    errorHandlerState,
    consolidatedAutoRetryState,
    deploymentErrorHandler,
    projectId
  ]);

  // Debounced cache save
  const debouncedSaveToCache = useCallback((status: 'success' | 'failed' | 'in-progress' = 'in-progress', immediate = false) => {
    if (immediate) {
      saveCurrentStateToCache(status, true);
      return;
    }

    if (debouncedCacheSave.current) {
      clearTimeout(debouncedCacheSave.current);
    }

    debouncedCacheSave.current = setTimeout(() => {
      saveCurrentStateToCache(status, false);
      debouncedCacheSave.current = null;
    }, 1000);
  }, [saveCurrentStateToCache]);

  // Update error handler state
  const updateErrorHandlerState = useCallback((updates: Partial<ErrorHandlerState>) => {
    setErrorHandlerState(prev => ({ ...prev, ...updates }));
  }, []);

  const addViteConfigToSnapshot = (
    fileSnapshot: DeploymentFileSnapshot, 
    backendCanisterId: string,
    projectName: string
  ): DeploymentFileSnapshot => {
    log('VITE_CONFIG_GENERATION', '🔧 Adding generated Vite config to deployment snapshot...');
    log('VITE_CONFIG_GENERATION', `🎯 Target backend canister ID: ${backendCanisterId}`);
    log('VITE_CONFIG_GENERATION', `📁 Project name: ${projectName}`);
    
    const updatedSnapshot: DeploymentFileSnapshot = { ...fileSnapshot };
    
    const viteConfigPath = `${projectName}/src/frontend/vite.config.ts`;
    const viteConfigContent = generateViteConfig(backendCanisterId, projectName);
    
    updatedSnapshot[viteConfigPath] = viteConfigContent;
    
    addDeploymentLog(`✅ Generated Vite config with backend canister ID: ${backendCanisterId}`);
    log('VITE_CONFIG_GENERATION', `✅ Added Vite config to path: ${viteConfigPath}`);
    
    return updatedSnapshot;
  };

  const prepareMotokoFiles = (fileSnapshot: DeploymentFileSnapshot): PreparedMotokoFiles => {
    log('COMPILATION', '🔍 [PREPARE MOTOKO] Input files object keys:', Object.keys(fileSnapshot));
    
    const motokoEntries = Object.entries(fileSnapshot).filter(([fileName]) => fileName.endsWith('.mo'));
    
    log('COMPILATION', '🔍 [PREPARE MOTOKO] After .mo filtering:', {
      totalEntries: motokoEntries.length,
      filteredEntries: motokoEntries.map(([fileName]) => fileName)
    });
    
    const motokoFiles = motokoEntries.map(([fileName, content]) => {
      log('COMPILATION', '🔍 [PREPARE MOTOKO] Processing individual file:', {
        originalFileName: fileName,
        finalName: fileName,
        contentLength: content.length
      });
      
      return {
        name: fileName,
        content: content
      };
    });

    log('COMPILATION', '🔍 [PREPARE MOTOKO] Final prepared files:', {
      totalFiles: motokoFiles.length,
      fileNames: motokoFiles.map(f => f.name),
      packages: DEFAULT_MOTOKO_PACKAGES.length
    });

    if (motokoFiles.length === 0) {
      throw new Error('No Motoko files found in deployment snapshot');
    }

    const mainFile = identifyMainActorFile(motokoFiles);
    
    return {
      files: motokoFiles,
      mainFile: mainFile,
      packages: DEFAULT_MOTOKO_PACKAGES
    };
  };

  const identifyMainActorFile = (files: { name: string; content: string }[]): string => {
    const mainFile = files.find(f => 
      f.name.endsWith('/main.mo') || 
      f.name.endsWith('/Main.mo') ||
      f.name === 'main.mo' ||
      f.name === 'Main.mo'
    );
    
    if (mainFile) return mainFile.name;

    const actorFile = files.find(f => {
      const cleanContent = f.content
        .replace(/\/\/.*$/gm, '') 
        .replace(/\/\*[\s\S]*?\*\//g, ''); 
      
      const actorPatterns = [
        /^\s*actor\s+\w+\s*(\([^)]*\))?\s*\{/m,
        /^\s*actor\s+class\s+\w+\s*(\([^)]*\))?\s*\{/m,
        /^\s*actor\s*\{/m
      ];
      
      return actorPatterns.some(pattern => pattern.test(cleanContent));
    });

    return actorFile ? actorFile.name : files[0]?.name || 'main.mo';
  };

  const prepareFrontendFiles = (
    fileSnapshot: DeploymentFileSnapshot, 
    serverPair: ServerPair
  ): PreparedFrontendFiles => {
    log('COMPILATION', '🔍 [PREPARE FRONTEND] Input files snapshot keys:', Object.keys(fileSnapshot));
    
    const frontendEntries = Object.entries(fileSnapshot).filter(([fileName]) => {
      const extension = fileName.split('.').pop()?.toLowerCase();
      
      if (['mo', 'did'].includes(extension || '')) return false;
      
      const frontendExtensions = [
        'html', 'htm', 'css', 'scss', 'sass', 'less',
        'js', 'jsx', 'ts', 'tsx', 'mjs', 'json',
        'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'
      ];
      
      return frontendExtensions.includes(extension || '');
    });
    
    log('COMPILATION', '🔍 [PREPARE FRONTEND] After frontend filtering:', {
      totalEntries: frontendEntries.length,
      filteredEntries: frontendEntries.map(([fileName]) => fileName)
    });
    
    const frontendFiles = frontendEntries.map(([fileName, content]) => ({
      name: fileName,
      content: content
    }));

    const packageJsonFile = Object.entries(fileSnapshot).find(([fileName]) => 
      fileName.endsWith('package.json')
    );
    
    if (!packageJsonFile) {
      throw new Error('package.json not found in deployment snapshot');
    }

    let packageJson: object;
    try {
      packageJson = JSON.parse(packageJsonFile[1]);
    } catch (e) {
      throw new Error('Invalid package.json format');
    }

    return {
      files: frontendFiles,
      packageJson: packageJson
    };
  };

  // Enhanced error message extraction
  const extractProcessedErrorMessage = (errorHandler: any): string | null => {
    try {
      if (!errorHandler) {
        log('PROCESSED_MESSAGE_EXTRACTION', '❌ No error handler available for message extraction');
        return null;
      }

      if (typeof errorHandler.hasStructuredErrors === 'function' && !errorHandler.hasStructuredErrors()) {
        log('PROCESSED_MESSAGE_EXTRACTION', '⚠️ No structured errors available in error handler');
        return null;
      }

      if (typeof errorHandler.getFixRequestMessage === 'function') {
        const processedMessage = errorHandler.getFixRequestMessage();
        
        if (processedMessage && typeof processedMessage === 'string' && processedMessage.trim().length > 0) {
          log('PROCESSED_MESSAGE_EXTRACTION', '✅ Successfully extracted processed error message', {
            messageLength: processedMessage.length,
            messagePreview: processedMessage.substring(0, 100) + '...',
            extractionTiming: 'IMMEDIATELY_AFTER_PROCESSING',
            hasRichContext: processedMessage.includes('Code Location:') || processedMessage.includes('**MOTOKO COMPILATION ISSUES DETECTED**') || processedMessage.includes('**FRONTEND BUNDLING ERROR DETECTED**')
          });
          
          return processedMessage;
        } else {
          log('PROCESSED_MESSAGE_EXTRACTION', '⚠️ Processed message is empty or invalid', {
            messageType: typeof processedMessage,
            messageLength: processedMessage?.length || 0,
            messageContent: processedMessage
          });
        }
      } else {
        log('PROCESSED_MESSAGE_EXTRACTION', '❌ getFixRequestMessage method not available on error handler');
      }

      return null;
    } catch (error) {
      log('PROCESSED_MESSAGE_EXTRACTION', '❌ Error extracting processed error message:', error);
      return null;
    }
  };

  // Request coordinator workflow creation with processed error message passing
  const requestCoordinatorWorkflowCreation = async (
    errorType: 'deployment-error' | 'frontend-error',
    rawError: string,
    deploymentSnapshot: DeploymentFileSnapshot,
    processedErrorMessage?: string
  ): Promise<string | null> => {
    log('COORDINATOR_INTEGRATION', '🏛️ Requesting coordinator workflow creation with DIRECT ERROR MESSAGE PASSING', {
      errorType,
      projectId,
      hasSnapshot: Object.keys(deploymentSnapshot).length > 0,
      hasProcessedMessage: !!processedErrorMessage,
      processedMessageLength: processedErrorMessage?.length || 0
    });

    if (processedErrorMessage) {
      log('RICH_CONTEXT_INTEGRATION', '🎯 PROCESSED ERROR MESSAGE PROVIDED - Using direct integration path', {
        messageLength: processedErrorMessage.length,
        messagePreview: processedErrorMessage.substring(0, 150) + '...',
        errorType,
        integrationMethod: 'DIRECT_PARAMETER_PASSING'
      });
    } else {
      log('RICH_CONTEXT_INTEGRATION', '⚠️ NO PROCESSED ERROR MESSAGE - Will use fallback path', {
        rawErrorLength: rawError.length,
        rawErrorPreview: rawError.substring(0, 100) + '...',
        errorType,
        integrationMethod: 'FALLBACK_RAW_ERROR'
      });
    }

    const canStartNewWorkflow = autoRetryCoordinator.canStartAutoRetry(projectId);
    
    if (!canStartNewWorkflow) {
      log('COORDINATOR_INTEGRATION', '🚫 Coordinator denied workflow creation');
      return null;
    }

    const workflowId = autoRetryCoordinator.startAutoRetryWorkflow(
      projectId, 
      deploymentSnapshot, 
      errorType,
      rawError,
      autoDeploymentContext,
      processedErrorMessage
    );

    if (!workflowId) {
      log('COORDINATOR_INTEGRATION', '❌ Coordinator failed to create workflow');
      return null;
    }

    log('COORDINATOR_INTEGRATION', '✅ Coordinator created workflow with DIRECT PROCESSED MESSAGE INTEGRATION:', {
      workflowId,
      hasProcessedMessage: !!processedErrorMessage,
      processedMessageLength: processedErrorMessage?.length || 0,
      integrationSuccess: true
    });
    
    return workflowId;
  };

  // ==================== ERROR HANDLERS WITH PROCESSED MESSAGE EXTRACTION ====================
  
  const handleMotokoCompilationError = async (rawOutput: string, fileSnapshot?: DeploymentFileSnapshot) => {
    try {
      log('ERROR_PARSING', '🔍 Processing Motoko compilation error with enhanced message extraction', {
        rawLength: rawOutput.length,
        hasFileSnapshot: !!fileSnapshot,
        isAutoDeployment: autoDeploymentStatus.isAutoDeployment,
        coordinatorActive: consolidatedAutoRetryState.isActive
      });

      const deploymentSnapshot = fileSnapshot || await createDeploymentFileSnapshot();

      if (!deploymentErrorHandler || typeof deploymentErrorHandler.processDeploymentError !== 'function') {
        log('ERROR_PARSING', '❌ Error handler not available for processing deployment error');
        updateErrorHandlerState({
          showFixButton: false,
          errorSummary: rawOutput.substring(0, 200) + '...',
          lastErrorProcessingTime: Date.now(),
          isProcessingError: false,
          errorClassification: 'unknown',
          errorCategory: 'processing-error'
        });
        return;
      }

      updateErrorHandlerState({ isProcessingError: true });

      log('PROCESSED_MESSAGE_EXTRACTION', '🔄 Processing deployment error to generate rich context...');
      const errorState = deploymentErrorHandler.processDeploymentError(rawOutput, deploymentSnapshot);

      log('PROCESSED_MESSAGE_EXTRACTION', '⚡ IMMEDIATELY extracting processed error message...');
      const processedErrorMessage = extractProcessedErrorMessage(deploymentErrorHandler);

      if (!errorState.hasErrors) {
        updateErrorHandlerState({
          showFixButton: false,
          errorSummary: null,
          lastErrorProcessingTime: Date.now(),
          isProcessingError: false,
          errorClassification: null,
          errorCategory: null
        });
        return;
      }

      let summary = null;
      let explanation = null;
      let blockingCount = 0;
      let warningsCount = 0;
      let errorClassification = 'unknown';
      let errorCategory = 'other';

      try {
        if (typeof deploymentErrorHandler.getErrorSummary === 'function') {
          summary = deploymentErrorHandler.getErrorSummary();
        }
        if (typeof deploymentErrorHandler.createUserFriendlyExplanation === 'function') {
          explanation = deploymentErrorHandler.createUserFriendlyExplanation();
        }
        if (typeof deploymentErrorHandler.getBlockingErrorsCount === 'function') {
          blockingCount = deploymentErrorHandler.getBlockingErrorsCount();
        }
        if (typeof deploymentErrorHandler.getWarningsCount === 'function') {
          warningsCount = deploymentErrorHandler.getWarningsCount();
        }
        
        const detailedErrorInfo = deploymentErrorHandler.getDetailedErrorInfo();
        if (detailedErrorInfo && detailedErrorInfo.errors.length > 0) {
          const primaryError = detailedErrorInfo.errors[0];
          errorClassification = primaryError.severity || 'unknown';
          errorCategory = primaryError.category || 'other';
        }
      } catch (methodError) {
        log('ERROR_PARSING', '⚠️ Error accessing error handler methods:', methodError);
      }

      const errorProcessingTime = Date.now();
      
      const showFixButton = errorState.canAutoFix && !autoDeploymentStatus.isAutoDeployment && !consolidatedAutoRetryState.isActive;
      
      updateErrorHandlerState({
        showFixButton: showFixButton,
        errorSummary: summary,
        lastErrorProcessingTime: errorProcessingTime,
        isProcessingError: false,
        errorClassification: errorClassification,
        errorCategory: errorCategory,
        blockingErrorsCount: blockingCount,
        warningsCount: warningsCount
      });

      if ((autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) && errorState.canAutoFix) {
        log('COORDINATOR_INTEGRATION', '🏛️ Auto-deployment error - requesting coordinator workflow with DIRECT PROCESSED MESSAGE');
        
        if (processedErrorMessage) {
          log('DIRECT_MESSAGE_PASSING', '🎯 PASSING PROCESSED ERROR MESSAGE DIRECTLY TO COORDINATOR', {
            messageLength: processedErrorMessage.length,
            messagePreview: processedErrorMessage.substring(0, 150) + '...',
            hasCodeContext: processedErrorMessage.includes('Code Location:'),
            hasStructuredAnalysis: processedErrorMessage.includes('**MOTOKO COMPILATION ISSUES DETECTED**'),
            integrationPath: 'DIRECT_PARAMETER_PASSING'
          });
        } else {
          log('DIRECT_MESSAGE_PASSING', '⚠️ NO PROCESSED MESSAGE AVAILABLE - Using raw error fallback', {
            rawErrorLength: rawOutput.length,
            integrationPath: 'FALLBACK_RAW_ERROR'
          });
        }
        
        const createdWorkflowId = await requestCoordinatorWorkflowCreation(
          'deployment-error',
          rawOutput,
          deploymentSnapshot,
          processedErrorMessage
        );
        
        if (createdWorkflowId) {
          addDeploymentLog('🤖 Auto-retry workflow created by coordinator with rich context integration');
          
          if (processedErrorMessage) {
            addDeploymentLog('✨ Using processed error context with code analysis and line-specific details');
          } else {
            addDeploymentLog('⚠️ Using raw error fallback - processed context unavailable');
          }
        } else {
          log('COORDINATOR_INTEGRATION', '🚫 Coordinator denied workflow creation');
        }
        
      } else {
        if (handleDeploymentError && autoDeploymentContext?.messageId) {
          log('ERROR_PARSING', '🔧 Legacy auto-deployment error handling');
          
          const callbacks = getCallbacks();
          if (callbacks.onTabSwitch && callbacks.onSubmitFixMessage) {
            try {
              await handleDeploymentError(
                autoDeploymentContext.messageId,
                rawOutput,
                callbacks.onTabSwitch,
                callbacks.onSubmitFixMessage
              );
            } catch (coordinationError) {
              log('ERROR_PARSING', '❌ Legacy coordination error handling failed:', coordinationError);
            }
          }
        }
      }

      addDeploymentLog(`🔍 ${blockingCount} errors / ${warningsCount} warnings (${errorClassification})`);
      if (explanation) addDeploymentLog(`📋 ${explanation}`);
      if (errorCategory !== 'other') addDeploymentLog(`🏷️ Category: ${errorCategory}`);
      
      if (processedErrorMessage && (autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive)) {
        addDeploymentLog('✨ Rich error context with code analysis passed to AI auto-retry system');
      } else if (!autoDeploymentStatus.isAutoDeployment && !consolidatedAutoRetryState.isActive && errorState.canAutoFix) {
        addDeploymentLog('✨ Click "Fix These Errors" for AI assistance');
      } else if (autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) {
        addDeploymentLog('🤖 Auto-retry coordinator managing error resolution');
      }

      setTimeout(() => {
        debouncedSaveToCache('failed', false);
      }, 100);
      
    } catch (e) {
      log('ERROR_PARSING', '❌ Motoko error processing failed:', e);
      updateErrorHandlerState({
        showFixButton: false,
        errorSummary: 'Error processing failed - please check the logs',
        lastErrorProcessingTime: Date.now(),
        isProcessingError: false,
        errorClassification: 'processing-error',
        errorCategory: 'system-error'
      });
    }
  };

  const handleFrontendBundlingError = async (errorOutput: string) => {
    try {
      log('ERROR_PARSING', '🎨 Processing frontend bundling error with enhanced message extraction', {
        errorLength: errorOutput.length,
        isAutoDeployment: autoDeploymentStatus.isAutoDeployment,
        coordinatorActive: consolidatedAutoRetryState.isActive
      });

      if (!deploymentErrorHandler || typeof deploymentErrorHandler.processFrontendError !== 'function') {
        log('ERROR_PARSING', '❌ Error handler not available for processing frontend error');
        updateErrorHandlerState({
          showFixButton: false,
          errorSummary: 'Frontend bundling failed',
          lastErrorProcessingTime: Date.now(),
          isProcessingError: false,
          errorClassification: 'frontend-bundling',
          errorCategory: 'processing-error'
        });
        return;
      }

      updateErrorHandlerState({ isProcessingError: true });

      log('PROCESSED_MESSAGE_EXTRACTION', '🔄 Processing frontend bundling error to generate rich context...');
      const errorState = deploymentErrorHandler.processFrontendError(errorOutput);

      log('PROCESSED_MESSAGE_EXTRACTION', '⚡ IMMEDIATELY extracting processed frontend error message...');
      const processedErrorMessage = extractProcessedErrorMessage(deploymentErrorHandler);

      if (!errorState.hasErrors) {
        updateErrorHandlerState({
          showFixButton: false,
          errorSummary: null,
          lastErrorProcessingTime: Date.now(),
          isProcessingError: false,
          errorClassification: null,
          errorCategory: null
        });
        return;
      }

      let summary = null;
      let explanation = null;
      let errorClassification = 'frontend-bundling';
      let errorCategory = 'bundling';

      try {
        if (typeof deploymentErrorHandler.getErrorSummary === 'function') {
          summary = deploymentErrorHandler.getErrorSummary();
        }
        if (typeof deploymentErrorHandler.createUserFriendlyExplanation === 'function') {
          explanation = deploymentErrorHandler.createUserFriendlyExplanation();
        }
        
        const detailedErrorInfo = deploymentErrorHandler.getDetailedErrorInfo();
        if (detailedErrorInfo && detailedErrorInfo.frontendError) {
          errorCategory = detailedErrorInfo.frontendError.errorCategory;
          errorClassification = detailedErrorInfo.frontendError.errorType;
        }
      } catch (methodError) {
        log('ERROR_PARSING', '⚠️ Error accessing error handler methods:', methodError);
      }

      const errorProcessingTime = Date.now();
      
      const showFixButton = errorState.canAutoFix && !autoDeploymentStatus.isAutoDeployment && !consolidatedAutoRetryState.isActive;
      
      updateErrorHandlerState({
        showFixButton: showFixButton,
        errorSummary: summary,
        lastErrorProcessingTime: errorProcessingTime,
        isProcessingError: false,
        errorClassification: errorClassification,
        errorCategory: errorCategory,
        blockingErrorsCount: 1,
        warningsCount: 0
      });
      
      if ((autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) && errorState.canAutoFix) {
        log('COORDINATOR_INTEGRATION', '🏛️ Auto-deployment frontend error - requesting coordinator workflow with DIRECT PROCESSED MESSAGE');
        
        if (processedErrorMessage) {
          log('DIRECT_MESSAGE_PASSING', '🎯 PASSING PROCESSED FRONTEND ERROR MESSAGE DIRECTLY TO COORDINATOR', {
            messageLength: processedErrorMessage.length,
            messagePreview: processedErrorMessage.substring(0, 150) + '...',
            hasStructuredAnalysis: processedErrorMessage.includes('**FRONTEND BUNDLING ERROR DETECTED**'),
            errorCategory: errorCategory,
            integrationPath: 'DIRECT_PARAMETER_PASSING'
          });
        } else {
          log('DIRECT_MESSAGE_PASSING', '⚠️ NO PROCESSED FRONTEND MESSAGE AVAILABLE - Using raw error fallback', {
            rawErrorLength: errorOutput.length,
            integrationPath: 'FALLBACK_RAW_ERROR'
          });
        }
        
        const fileSnapshot = await createDeploymentFileSnapshot();
        const createdWorkflowId = await requestCoordinatorWorkflowCreation(
          'frontend-error',
          errorOutput,
          fileSnapshot,
          processedErrorMessage
        );
        
        if (createdWorkflowId) {
          addDeploymentLog('🤖 Auto-retry frontend workflow created by coordinator with rich context integration');
          
          if (processedErrorMessage) {
            addDeploymentLog('✨ Using processed frontend error context with detailed analysis');
          } else {
            addDeploymentLog('⚠️ Using raw error fallback - processed context unavailable');
          }
        } else {
          log('COORDINATOR_INTEGRATION', '🚫 Coordinator denied frontend workflow creation');
        }
        
      } else {
        if (handleDeploymentError && autoDeploymentContext?.messageId) {
          const callbacks = getCallbacks();
          if (callbacks.onTabSwitch && callbacks.onSubmitFixMessage) {
            try {
              await handleDeploymentError(
                autoDeploymentContext.messageId,
                errorOutput,
                callbacks.onTabSwitch,
                callbacks.onSubmitFixMessage
              );
            } catch (coordinationError) {
              log('ERROR_PARSING', '❌ Frontend coordination error handling failed:', coordinationError);
            }
          }
        }
      }

      addDeploymentLog(`🎨 Frontend bundling error detected (${errorCategory})`);
      if (explanation) addDeploymentLog(`📋 ${explanation}`);
      addDeploymentLog(`🏷️ Error type: ${errorClassification}`);
      
      if (processedErrorMessage && (autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive)) {
        addDeploymentLog('✨ Rich frontend error context with detailed analysis passed to AI auto-retry system');
      } else if (!autoDeploymentStatus.isAutoDeployment && !consolidatedAutoRetryState.isActive && errorState.canAutoFix) {
        addDeploymentLog('✨ Click "Fix These Errors" for AI assistance');
      } else if (autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) {
        addDeploymentLog('🤖 Auto-retry coordinator managing frontend error resolution');
      }

      setTimeout(() => {
        debouncedSaveToCache('failed', false);
      }, 100);

    } catch (e) {
      log('ERROR_PARSING', '❌ Frontend error processing failed:', e);
      updateErrorHandlerState({
        showFixButton: false,
        errorSummary: 'Frontend error processing failed - please check the logs',
        lastErrorProcessingTime: Date.now(),
        isProcessingError: false,
        errorClassification: 'processing-error',
        errorCategory: 'system-error'
      });
    }
  };

  const compileMotokoCode = async (
    motokoData: PreparedMotokoFiles,
    projectName: string
  ): Promise<DFXUtilsResponse> => {
    try {
      const motokoFilesWithPrefix = addProjectPrefix(motokoData.files, projectName);

      const payload = {
        files: motokoFilesWithPrefix,
        packages: motokoData.packages,
        mode: 'reinstall',
        mainFile: `${projectName}/${motokoData.mainFile}`,
      };

      log('COMPILATION', '🔍 [DFXUTILS PAYLOAD] Complete payload being sent:', payload);

      const response = await fetch('https://dfxutils.coinnation.io/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.error || response.statusText;
        } catch {
          errorText = response.statusText;
        }
        
        const fileSnapshot = await createDeploymentFileSnapshot();
        await handleMotokoCompilationError(errorText, fileSnapshot);
        
        throw new Error(`Backend compilation failed: ${errorText}`);
      }

      const result = await response.json();

      if (result.error && result.error.trim().length > 0) {
        log('COMPILATION', '🔍 Found compilation error in success response:', result.error);
        
        const fileSnapshot = await createDeploymentFileSnapshot();
        await handleMotokoCompilationError(result.error, fileSnapshot);
        
        const err = new Error('Compilation failed');
        throw err;
      }

      if (!result?.wasm)
        throw new Error('No WASM in response');

      if (typeof result.wasm !== 'string')
        throw new Error('WASM is not a base-64 string');

      if (!result?.candid?.trim())
        throw new Error('No Candid interface returned');

      const binaryString = atob(result.wasm);
      const wasmBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) wasmBytes[i] = binaryString.charCodeAt(i);

      const mainFileContent =
        motokoData.files.find((f) => f.name === motokoData.mainFile)?.content ?? '';
      const actorName = extractActorNameFromMotoko(mainFileContent, motokoData.mainFile);

      addDeploymentLog(`✅ Compiled actor "${actorName}" – ${(wasmBytes.length / 1024).toFixed(1)} KB WASM`);

      if (userCanisterId && identity && principal) {
        try {
          const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
          const candidDir = `${projectName}/src/frontend/candid`;
          const versionParam: string[] = [];

          const artifacts = [
            { name: `${actorName}.did`, content: result.candid, type: 'text/plain', category: 'candid' },
            { name: `${actorName}.did.d.ts`, content: result.typescript ?? '', type: 'text/typescript', category: 'typescript' },
            { name: `${actorName}.did.js`, content: result.didJs ?? '', type: 'text/javascript', category: 'javascript' },
          ];

          if (result.jsonSchema && result.jsonSchema !== '{}')
            artifacts.push({ name: `${actorName}.json`, content: result.jsonSchema, type: 'application/json', category: 'json' });

          let saved = 0;
          for (const art of artifacts) {
            if (!art.content.trim()) continue;
            try {
              const existing = await userActor.readCodeArtifact(principal, projectId, candidDir, art.name, versionParam);
              'ok' in existing
                ? await userActor.updateCodeArtifact(principal, projectId, art.name, { Text: art.content }, candidDir, versionParam)
                : await userActor.createCodeArtifact(principal, projectId, art.name, { Text: art.content }, art.type, art.category, candidDir, versionParam);
              saved++;
            } catch (e) {
              addDeploymentLog(`⚠️ Could not save ${art.name}`);
            }
          }
          addDeploymentLog(`✅ Saved ${saved}/${artifacts.length} Candid artifacts`);
        } catch {
          addDeploymentLog('⚠️ Could not persist Candid artifacts');
        }
      }

      return {
        success: true,
        wasm: result.wasm,
        candid: result.candid,
        typescript: result.typescript ?? '',
        didJs: result.didJs ?? '',
        jsonSchema: result.jsonSchema ?? '{}',
        compiledWasm: wasmBytes,
      } as DFXUtilsResponse;
      
    } catch (err: any) {
      throw err;
    }
  };

  const bundleFrontendCode = async (
    frontendData: PreparedFrontendFiles, 
    serverPair: ServerPair,
    projectName: string
  ): Promise<BundlerResponse> => {
    
    if (!frontendData || !frontendData.files || frontendData.files.length === 0) {
      throw new Error('Invalid frontend data: No files provided for bundling');
    }
    
    if (!frontendData.packageJson || typeof frontendData.packageJson !== 'object') {
      throw new Error('Invalid frontend data: Missing or invalid package.json');
    }
    
    if (!serverPair || !serverPair.backendCanisterId) {
      throw new Error('Invalid server pair: Missing backend canister ID');
    }
    
    if (!projectName || projectName.trim().length === 0) {
      throw new Error('Invalid project name provided');
    }

    addDeploymentLog(`🔧 Bundling with backend canister integration: ${serverPair.backendCanisterId}`);

    const frontendFilesWithPrefix = addProjectPrefix(frontendData.files, projectName);
    
    const staticIndexHtml = {
      name: `${projectName}/src/frontend/index.html`,
      content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="./src/index.tsx"></script>
</body>
</html>`
    };

    const allFrontendFiles = [
      ...frontendFilesWithPrefix,
      staticIndexHtml
    ];
    
    log('COMPILATION', '🔍 [BUNDLE FRONTEND] Files being sent to JSBundler:', {
      totalFiles: allFrontendFiles.length,
      fileNames: allFrontendFiles.map(f => f.name),
      backendCanister: serverPair.backendCanisterId
    });
    
    const hasPackageJson = allFrontendFiles.some(f => f.name.endsWith('package.json'));
    const hasIndexHtml = allFrontendFiles.some(f => 
      f.name.endsWith('index.html') || f.name === 'index.html'
    );
    const hasJavaScriptFiles = allFrontendFiles.some(f => 
      f.name.endsWith('.js') || f.name.endsWith('.jsx') || 
      f.name.endsWith('.ts') || f.name.endsWith('.tsx')
    );
    const hasViteConfig = allFrontendFiles.some(f => 
      f.name.endsWith('vite.config.ts') || f.name.endsWith('vite.config.js')
    );
    
    addDeploymentLog(`Pre-bundle validation: package.json=${hasPackageJson ? '✅' : '❌'}, index.html=${hasIndexHtml ? '✅' : '⚠️'}, JS/TS files=${hasJavaScriptFiles ? '✅' : '❌'}, vite.config=${hasViteConfig ? '✅' : '⚠️'}`);
    
    if (!hasPackageJson) {
      throw new Error('Bundle validation failed: No package.json found in project files');
    }
    
    if (!hasJavaScriptFiles) {
      throw new Error('Bundle validation failed: No JavaScript/TypeScript files found');
    }

    if (!hasViteConfig) {
      addDeploymentLog('⚠️ Warning: No Vite config found in project files - environment variables may not be injected');
    }
    
    addDeploymentLog('Submitting bundling job to JSBundler...');
    
    let jobResponse: Response;
    let jobData: BundlerJobResponse;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); 
      
      jobResponse = await fetch('https://jsbundler.coinnation.io/kontext/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: allFrontendFiles,
          packageJson: frontendData.packageJson,
          projectType: 'icpstudio'
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
    } catch (submitError) {
      if (submitError instanceof Error) {
        if (submitError.name === 'AbortError') {
          throw new Error('Bundling job submission timed out after 30 seconds');
        }
        throw new Error(`Network error while submitting bundling job: ${submitError.message}`);
      }
      throw new Error(`Failed to submit bundling job: ${String(submitError)}`);
    }

    let jobResponseText = '';
    try {
      jobResponseText = await jobResponse.text();
      
      if (!jobResponse.ok) {
        let errorDetails = jobResponseText;
        try {
          const errorJson = JSON.parse(jobResponseText);
          if (errorJson.error) {
            errorDetails = errorJson.error;
          }
          if (errorJson.message) {
            errorDetails = errorJson.message;
          }
        } catch {
          // Keep original error text if JSON parsing fails
        }
        
        await handleFrontendBundlingError(errorDetails);
        
        throw new Error(`JSBundler rejected job submission (${jobResponse.status}): ${errorDetails}`);
      }
      
      jobData = JSON.parse(jobResponseText);
      
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message.includes('JSBundler rejected')) {
        throw parseError; 
      }
      
      await handleFrontendBundlingError(`Invalid response from JSBundler: ${jobResponseText.substring(0, 200)}...`);
      
      throw new Error(`Invalid response from JSBundler: ${jobResponseText.substring(0, 200)}...`);
    }
    
    if (!jobData || typeof jobData !== 'object') {
      const errorMsg = 'Invalid job response: Expected object with job information';
      await handleFrontendBundlingError(errorMsg);
      throw new Error(errorMsg);
    }
    
    if (!jobData.success) {
      const errorMsg = jobData.error || 'JSBundler reported job creation failure';
      await handleFrontendBundlingError(`JSBundler job creation failed: ${errorMsg}`);
      throw new Error(`JSBundler job creation failed: ${errorMsg}`);
    }
    
    if (!jobData.jobId || typeof jobData.jobId !== 'string') {
      const errorMsg = 'Invalid job response: Missing job ID';
      await handleFrontendBundlingError(errorMsg);
      throw new Error(errorMsg);
    }
    
    if (!jobData.statusUrl || !jobData.downloadUrl) {
      const errorMsg = 'Invalid job response: Missing status or download URLs';
      await handleFrontendBundlingError(errorMsg);
      throw new Error(errorMsg);
    }

    addDeploymentLog(`Bundling job started (ID: ${jobData.jobId})`);

    const statusUrl = `https://jsbundler.coinnation.io${jobData.statusUrl}`;
    const downloadUrl = `https://jsbundler.coinnation.io${jobData.downloadUrl}`;

    let attempts = 0;
    const maxAttempts = 60; 
    let bundleComplete = false;

    addDeploymentLog('Polling for bundling completion...');

    while (!bundleComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); 
      attempts++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); 
        
        const statusResponse = await fetch(statusUrl, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!statusResponse.ok) {
          addDeploymentLog(`Status check failed (attempt ${attempts}/${maxAttempts}): HTTP ${statusResponse.status}`);
          
          if (statusResponse.status === 404 && attempts > 10) {
            const errorMsg = 'Bundling job not found';
            await handleFrontendBundlingError(errorMsg);
            throw new Error(errorMsg);
          }
          
          continue;
        }

        let status: BundlerStatusResponse;
        const statusText = await statusResponse.text();
        
        try {
          status = JSON.parse(statusText);
        } catch (parseError) {
          addDeploymentLog(`Invalid status response (attempt ${attempts}): ${statusText.substring(0, 100)}...`);
          continue;
        }
        
        addDeploymentLog(`Bundling status (${attempts * 5}s): ${status.status}${status.progress ? ` (${status.progress}%)` : ''}`);
        
        if (status.status === 'completed') {
          bundleComplete = true;
          addDeploymentLog('✅ Bundling completed successfully!');
          break;
        } else if (status.status === 'failed') {
          let errorMessage = status.error || 'Unknown bundling error';
          await handleFrontendBundlingError(`JSBundler job failed: ${errorMessage}`);
          throw new Error(`JSBundler job failed: ${errorMessage}`);
        }

        if (status.progress && typeof status.progress === 'number') {
          const overallProgress = 50 + (status.progress * 0.2); 
          setDeploymentProgress(Math.min(overallProgress, 70));
        }
        
      } catch (pollError) {
        if (pollError instanceof Error) {
          if (pollError.message.includes('JSBundler job failed') || 
              pollError.message.includes('Bundling job not found')) {
            throw pollError;
          }
          
          const errorMsg = pollError.name === 'AbortError' ? 
            'Status check timed out' : 
            pollError.message;
            
          addDeploymentLog(`Status poll error (attempt ${attempts}): ${errorMsg}`);
        }
      }
    }

    if (!bundleComplete) {
      const errorMsg = 'Bundling timeout - job did not complete within 5 minutes';
      await handleFrontendBundlingError(errorMsg);
      throw new Error(errorMsg);
    }

    addDeploymentLog('Downloading completed bundle...');
    
    let downloadResponse: Response;
    let finalResult: BundlerResponse;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); 
      
      downloadResponse = await fetch(downloadUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
    } catch (downloadError) {
      if (downloadError instanceof Error) {
        if (downloadError.name === 'AbortError') {
          const errorMsg = 'Bundle download timed out after 60 seconds';
          await handleFrontendBundlingError(errorMsg);
          throw new Error(errorMsg);
        }
        const errorMsg = `Network error during bundle download: ${downloadError.message}`;
        await handleFrontendBundlingError(errorMsg);
        throw new Error(errorMsg);
      }
      const errorMsg = `Failed to download bundle: ${String(downloadError)}`;
      await handleFrontendBundlingError(errorMsg);
      throw new Error(errorMsg);
    }
    
    if (!downloadResponse.ok) {
      let errorText = '';
      try {
        errorText = await downloadResponse.text();
      } catch {
        errorText = `HTTP ${downloadResponse.status}`;
      }
      
      await handleFrontendBundlingError(`Failed to download bundle (${downloadResponse.status}): ${errorText}`);
      throw new Error(`Failed to download bundle (${downloadResponse.status}): ${errorText}`);
    }

    let bundleData = '';
    try {
      bundleData = await downloadResponse.text();
      finalResult = JSON.parse(bundleData);
    } catch (parseError) {
      const errorMsg = 'Invalid bundle response: Could not parse downloaded data';
      await handleFrontendBundlingError(errorMsg);
      throw new Error(errorMsg);
    }
    
    if (!finalResult || typeof finalResult !== 'object') {
      const errorMsg = 'Invalid bundle result: Expected object with bundle data';
      await handleFrontendBundlingError(errorMsg);
      throw new Error(errorMsg);
    }
    
    if (!finalResult.success) {
      const errorMsg = finalResult.error || 'Bundle indicates failure without specific error';
      await handleFrontendBundlingError(`Bundle processing failed: ${errorMsg}`);
      throw new Error(`Bundle processing failed: ${errorMsg}`);
    }
    
    if (!finalResult.output || typeof finalResult.output !== 'object') {
      const errorMsg = 'Invalid bundle result: Missing or invalid output data';
      await handleFrontendBundlingError(errorMsg);
      throw new Error(errorMsg);
    }

    const outputFiles = Object.keys(finalResult.output);
    if (outputFiles.length === 0) {
      const errorMsg = 'Bundle result contains no output files';
      await handleFrontendBundlingError(errorMsg);
      throw new Error(errorMsg);
    }

    addDeploymentLog(`✅ Bundle downloaded successfully! Generated ${outputFiles.length} files.`);
    
    return finalResult;
  };

  // ==================== ULTRA HIGH-PERFORMANCE BACKEND DEPLOYMENT ====================
  
  const deployBackendToCanister = async (
    backendResult: DFXUtilsResponse,
    backendCanisterId: string
  ) => {
    if (!userCanisterId || !identity || !principal) {
      throw new Error('Missing required deployment parameters');
    }

    addDeploymentLog('🚀 Starting high-performance backend deployment...');

    if (!backendResult.success) {
      throw new Error('Cannot deploy: Backend compilation was not successful');
    }

    if (!backendResult.wasm) {
      throw new Error('Cannot deploy: No WASM data available');
    }

    if (!backendResult.candid) {
      throw new Error('Cannot deploy: No Candid interface available');
    }

    let wasmBytes: Uint8Array;
    
    try {
      if (backendResult.compiledWasm && backendResult.compiledWasm instanceof Uint8Array) {
        wasmBytes = backendResult.compiledWasm;
        addDeploymentLog(`Using pre-compiled WASM bytes: ${(wasmBytes.length / 1024).toFixed(2)}KB`);
      } else {
        if (typeof backendResult.wasm !== 'string') {
          throw new Error(`Expected base64 string from DFXUtils, got ${typeof backendResult.wasm}`);
        }

        const binaryString = atob(backendResult.wasm);
        wasmBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          wasmBytes[i] = binaryString.charCodeAt(i);
        }
        addDeploymentLog(`WASM converted from base64: ${(wasmBytes.length / 1024).toFixed(2)}KB`);
      }
      
    } catch (error) {
      throw new Error(`Failed to process WASM data: ${error instanceof Error ? error.message : 'Unknown WASM processing error'}`);
    }

    if (wasmBytes.length === 0) {
      throw new Error('WASM data is empty after processing');
    }

    let candidInterface: string;
    try {
      candidInterface = backendResult.candid.trim();
      
      if (candidInterface.length === 0) {
        throw new Error('Candid interface is empty');
      }
      
      addDeploymentLog(`Candid interface processed: ${candidInterface.length} characters`);
    } catch (error) {
      throw new Error(`Failed to process Candid interface: ${error instanceof Error ? error.message : 'Unknown Candid error'}`);
    }
    
    let userActor;
    try {
      userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      addDeploymentLog('Connected to user canister successfully');
    } catch (error) {
      throw new Error(`Failed to connect to user canister: ${error instanceof Error ? error.message : 'Connection failed'}`);
    }
    
    const metadata = {
      name: 'main.mo',
      canisterType: "backend",
      didInterface: [candidInterface],
      stableInterface: backendResult.jsonSchema ? [backendResult.jsonSchema] : [],
      project: [projectId],
      subType: []
    };

    const wasmSize = wasmBytes.length;
    
    addDeploymentLog(`Prepared deployment metadata for canister: ${backendCanisterId}`);
    addDeploymentLog(`📦 WASM size: ${wasmSize} bytes (${(wasmSize / (1024 * 1024)).toFixed(2)} MB)`);

    let deploymentResult;

    try {
      if (wasmSize > MAX_CHUNK_SIZE) {
        addDeploymentLog("🚀 Using ultra high-performance parallel chunked upload...");
        
        log('PERFORMANCE', `📊 WASM chunking strategy: ${wasmSize} bytes in chunks of ${MAX_CHUNK_SIZE}`);
        
        const sessionResult = await userActor.startWasmUploadSession(
          projectId,
          'main.wasm',
          BigInt(Math.ceil(wasmSize / MAX_CHUNK_SIZE)),
          BigInt(wasmSize),
          [Principal.fromText(backendCanisterId)],
          ["backend"],
          ["production"]
        );

        if (!('ok' in sessionResult)) {
          throw new Error(`Failed to start upload session: ${sessionResult.err || 'Unknown session error'}`);
        }

        const sessionId = sessionResult.ok;
        const wasmArray = Array.from(wasmBytes);
        const totalChunks = Math.ceil(wasmSize / MAX_CHUNK_SIZE);
        
        addDeploymentLog(`📤 Upload session started: ${sessionId} (${totalChunks} chunks)`);
        log('CHUNK_PROCESSING', `🔧 Ultra high-performance chunking: ${totalChunks} chunks of ${MAX_CHUNK_SIZE} bytes each`);

        // Ultra high-performance parallel chunk upload
        log('PARALLEL_PROCESSING', '🚀 Starting ultra parallel chunk upload process...');
        const chunkUploadStartTime = performance.now();
        
        let uploadedChunks = 0;
        const uploadChunk = async (chunkIndex: number): Promise<void> => {
          const start = chunkIndex * MAX_CHUNK_SIZE;
          const end = Math.min(start + MAX_CHUNK_SIZE, wasmSize);
          const chunk = wasmArray.slice(start, end);

          log('PARALLEL_PROCESSING', `📤 Uploading chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} bytes)`);

          const chunkResult = await userActor.uploadWasmChunk(sessionId, BigInt(chunkIndex), chunk);
          if (!('ok' in chunkResult)) {
            throw new Error(`Failed to upload chunk ${chunkIndex}: ${chunkResult.err || 'Unknown chunk error'}`);
          }
          
          uploadedChunks++;
          const chunkProgress = (uploadedChunks / totalChunks) * 15; 
          setDeploymentProgress(30 + chunkProgress);
          
          log('PARALLEL_PROCESSING', `✅ Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`);
        };

        // Execute ultra parallel chunk uploads with maximum concurrency
        await batchProcessWithProgress(
          Array.from({ length: totalChunks }, (_, i) => i),
          uploadChunk,
          MAX_WASM_CHUNKS,
          (completed, total) => {
            addDeploymentLog(`📤 Ultra parallel upload progress: ${completed}/${total} chunks (${Math.round((completed / total) * 100)}%)`);
          }
        );

        const chunkUploadEndTime = performance.now();
        const uploadDuration = (chunkUploadEndTime - chunkUploadStartTime) / 1000;
        
        addDeploymentLog(`🚀 Ultra parallel chunk upload completed in ${uploadDuration.toFixed(1)}s`);
        log('PARALLEL_PROCESSING', `📊 Ultra parallel upload performance: ${totalChunks} chunks in ${uploadDuration.toFixed(1)}s (${(totalChunks / uploadDuration).toFixed(1)} chunks/sec)`);

        addDeploymentLog('🔗 Finalizing ultra high-performance upload...');
        const finalizeResult = await userActor.finalizeWasmUpload(sessionId);
        if (!('ok' in finalizeResult)) {
          throw new Error(`Failed to finalize upload: ${finalizeResult.err || 'Unknown finalize error'}`);
        }

        addDeploymentLog('🚀 Deploying WASM to canister...');
        deploymentResult = await userActor.deployStoredWasm(
          projectId,
          'main.wasm',
          Principal.fromText(backendCanisterId),
          'backend',
          'production',
          principal,
          [metadata],
          [], 
          ["reinstall"] 
        );

      } else {
        addDeploymentLog("🚀 Using direct deployment for smaller WASM.");
        
        deploymentResult = await userActor.deployToExistingCanister(
          Principal.fromText(backendCanisterId),
          Array.from(wasmBytes),
          'backend',
          'backend',
          principal,
          [metadata],
          [], 
          ["reinstall"] 
        );
      }

      if (!('ok' in deploymentResult)) {
        throw new Error(`Backend deployment failed: ${deploymentResult.err || 'Unknown deployment error'}`);
      }

      addDeploymentLog('✅ High-performance backend deployment completed successfully');
      addDeploymentLog(`🎯 Deployed to canister: ${backendCanisterId}`);

      // 🔐 CRITICAL SECURITY: Set Kontext Owner IMMEDIATELY after backend deployment
      // This prevents race condition where a rogue user could claim ownership before platform does
      try {
        addDeploymentLog('🏢 Setting Kontext owner for backend canister...');
        setDeploymentStatus('deploying-backend'); // Keep status as deploying-backend

        // Create actor to call setKontextOwner
        const { HttpAgent, Actor } = await import('@dfinity/agent');
        
        const agent = new HttpAgent({ 
          identity, 
          host: process.env.NODE_ENV === 'production' ? 'https://ic0.app' : 'http://localhost:4943'
        });

        if (process.env.NODE_ENV !== 'production') {
          await agent.fetchRootKey();
        }

        // Create IDL for setKontextOwner method
        const idlFactory = ({ IDL }: any) => {
          const Result = IDL.Variant({ 'ok': IDL.Text, 'err': IDL.Text });
          return IDL.Service({
            'setKontextOwner': IDL.Func([IDL.Principal], [Result], []),
            'isKontextOwnerQuery': IDL.Func([], [IDL.Bool], ['query']),
          });
        };

        const backendActor = Actor.createActor(idlFactory, {
          agent,
          canisterId: backendCanisterId,
        });

        const kontextOwnerPrincipal = principal;
        const setOwnerResult = await backendActor.setKontextOwner(kontextOwnerPrincipal) as any;

        if (setOwnerResult && typeof setOwnerResult === 'object' && 'ok' in setOwnerResult) {
          addDeploymentLog('✅ Kontext owner set successfully: ' + setOwnerResult.ok);
          addDeploymentLog('🔐 Backend canister is now managed by Kontext - Database Interface will have full access');
          log('SECURITY', '✅ Kontext owner set successfully for canister: ' + backendCanisterId);
        } else if (setOwnerResult && typeof setOwnerResult === 'object' && 'err' in setOwnerResult) {
          addDeploymentLog('ℹ️  Could not set Kontext owner: ' + setOwnerResult.err);
          addDeploymentLog('ℹ️  This is OK if backend does not implement Kontext owner pattern');
          log('SECURITY', 'ℹ️  Backend does not have Kontext owner pattern (non-fatal)');
        }
      } catch (ownerError) {
        addDeploymentLog('ℹ️  Backend does not implement Kontext owner pattern - continuing deployment');
        log('SECURITY', 'ℹ️  Backend does not implement Kontext owner pattern (non-fatal):', ownerError);
        // Non-fatal - not all backends will have this pattern
      }

      // Save WASM file to project for later download (for both chunked and direct deployment)
      try {
        addDeploymentLog('💾 Saving WASM file to project...');
        const wasmsPath = `${projectName}/wasms`;
        const wasmFileName = 'main.wasm';
        const wasmSizeKB = (wasmBytes.length / 1024).toFixed(1);
        const IC_MESSAGE_LIMIT = 2 * 1024 * 1024; // 2 MB
        
        console.log(`💾 [DeploymentInterface] Attempting to save WASM:`, {
          projectId,
          wasmsPath,
          wasmFileName,
          wasmSize: wasmBytes.length,
          wasmSizeKB,
          exceedsLimit: wasmBytes.length > IC_MESSAGE_LIMIT
        });
        
        // 🔥 NEW: Check if WASM exceeds IC message size limit (2 MB)
        if (wasmBytes.length > IC_MESSAGE_LIMIT) {
          addDeploymentLog(`⚠️ WASM file (${wasmSizeKB} KB) exceeds 2 MB limit - uploading to asset canister`);
          
          // 🚀 Upload large WASM to asset canister for downloadable archives
          try {
            addDeploymentLog('📤 Uploading large WASM to asset canister archive...');
            
            // Get asset canister configuration
            const { wasmConfigService } = await import('../services/WasmConfigService');
            const assetCanisterId = await wasmConfigService.getAssetCanisterId();
            const basePath = await wasmConfigService.getBasePath();
            
            const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
            const timestamp = Date.now();
            const assetPath = `${basePath}/USER_CANISTERS/${sanitizedProjectName}_${timestamp}.wasm`;
            
            console.log('📥 [DeploymentInterface] Uploading to:', assetCanisterId, assetPath);
            
            const assetAgent = new HttpAgent({
              identity,
              host: 'https://icp0.io'
            });
            
            const assetManager = new AssetManager({
              canisterId: Principal.fromText(assetCanisterId),
              agent: assetAgent,
            });
            
            await assetManager.store(wasmBytes, {
              fileName: assetPath,
              contentType: 'application/wasm'
            });
            
            const downloadUrl = `https://${assetCanisterId}.raw.icp0.io/${assetPath}`;
            addDeploymentLog(`✅ Large WASM uploaded to asset canister (${wasmSizeKB} KB)`);
            addDeploymentLog(`📥 Download URL: ${downloadUrl}`);
            console.log(`📥 [DeploymentInterface] WASM download URL: ${downloadUrl}`);
            
          } catch (assetUploadError) {
            const assetErrorMsg = assetUploadError instanceof Error ? assetUploadError.message : 'Unknown error';
            console.warn(`⚠️ [DeploymentInterface] Failed to upload to asset canister:`, assetUploadError);
            addDeploymentLog(`⚠️ Could not upload to asset canister: ${assetErrorMsg}`);
            throw assetUploadError; // Re-throw to trigger fallback logic
          }
          
        } else {
          // Small WASM - use direct upload to user canister
          addDeploymentLog(`📦 WASM file (${wasmSizeKB} KB) is small enough for direct save`);
          
          // Check if WASM file already exists
          const existing = await userActor.readCodeArtifact(principal, projectId, wasmsPath, wasmFileName, []);
          
          if ('ok' in existing || 'Ok' in existing) {
            // Update existing WASM file
            const updateResult = await userActor.updateCodeArtifact(
              principal,
              projectId,
              wasmFileName,
              { Binary: Array.from(wasmBytes) },
              wasmsPath,
              []
            );
            console.log(`✅ [DeploymentInterface] WASM update result:`, updateResult);
            addDeploymentLog('✅ Updated WASM file in project');
          } else {
            // Create new WASM file
            const createResult = await userActor.createCodeArtifact(
              principal,
              projectId,
              wasmFileName,
              { Binary: Array.from(wasmBytes) },
              'application/wasm',
              'wasm',
              wasmsPath,
              []
            );
            console.log(`✅ [DeploymentInterface] WASM create result:`, createResult);
            
            if (createResult && typeof createResult === 'object' && ('err' in createResult || 'Err' in createResult)) {
              const error = createResult.err || createResult.Err;
              throw new Error(`Failed to create WASM file: ${typeof error === 'string' ? error : JSON.stringify(error)}`);
            }
            
            addDeploymentLog('✅ Saved WASM file to project');
          }
        }
      } catch (wasmSaveError) {
        // Log but don't fail deployment if WASM save fails
        const errorMsg = wasmSaveError instanceof Error ? wasmSaveError.message : 'Unknown error';
        console.error(`❌ [DeploymentInterface] Failed to save WASM file:`, wasmSaveError);
        addDeploymentLog(`⚠️ Could not save WASM file to project: ${errorMsg}`);
      }

    } catch (deployError) {
      const errorMessage = deployError instanceof Error ? deployError.message : 'Unknown deployment error';
      addDeploymentLog(`❌ Deployment failed: ${errorMessage}`);
      throw new Error(`Backend deployment failed: ${errorMessage}`);
    }
  };

  // ==================== ULTRA HIGH-PERFORMANCE FRONTEND DEPLOYMENT ====================
  
  const deployFrontendToCanister = async (
    bundleResult: BundlerResponse,
    frontendCanisterId: string
  ): Promise<string> => {
    
    if (!userCanisterId || !identity) {
      throw new Error('Missing required parameters for frontend deployment');
    }

    addDeploymentLog(`🚀 Processing ${Object.keys(bundleResult.output).length} bundled files for ultra high-performance deployment...`);

    const resolvedIdentity = await Promise.resolve(identity);
    const agent = new HttpAgent({
      identity: resolvedIdentity,
      host: 'https://icp0.io'
    });

    const assetManager = new AssetManager({
      canisterId: Principal.fromText(frontendCanisterId),
      agent: agent,
    });

    addDeploymentLog('🔗 Asset manager initialized for frontend canister');

    const getContentType = (filename: string): string => {
      const ext = filename.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'html':
          return 'text/html';
        case 'js':
          return 'application/javascript';
        case 'css':
          return 'text/css';
        case 'json':
          return 'application/json';
        case 'png':
          return 'image/png';
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg';
        case 'svg':
          return 'image/svg+xml';
        case 'ico':
          return 'image/x-icon';
        case 'woff':
        case 'woff2':
          return 'font/woff';
        case 'ttf':
          return 'font/ttf';
        default:
          return 'application/octet-stream';
      }
    };

    const createUnrestrictedCSPConfig = (): string => {
      return JSON.stringify([
        {
          "match": "**/*",
          "headers": {
            "Content-Security-Policy": "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; script-src-elem * 'unsafe-inline' 'unsafe-eval'; connect-src *; worker-src * blob: data:; img-src * data: blob:; style-src * 'unsafe-inline'; style-src-elem * 'unsafe-inline'; font-src *; object-src *; base-uri *; frame-ancestors *; form-action *; frame-src *; media-src *; manifest-src *;",
            "Permissions-Policy": "",
            "X-Frame-Options": "",
            "Referrer-Policy": "no-referrer-when-downgrade",
            "X-Content-Type-Options": "",
            "X-XSS-Protection": ""
          }
        }
      ], null, 2);
    };

    try {
      addDeploymentLog('📋 Deploying CSP configuration...');
      await assetManager.store(
        new TextEncoder().encode(createUnrestrictedCSPConfig()),
        {
          fileName: '.ic-assets.json5',
          contentType: 'application/json'
        }
      );
      addDeploymentLog('✅ CSP configuration deployed');

      const hasIndexHtml = Object.keys(bundleResult.output).some(filename => 
        filename.endsWith('index.html') || filename === 'index.html'
      );

      if (!hasIndexHtml) {
        addDeploymentLog('📄 Creating default index.html...');
        let defaultIndexHtml = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Deployed App</title>
      <script type="module" src="/assets/index.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>`;

        // 🔥 NEW: Inject element selection script
        defaultIndexHtml = injectElementSelectionScript(defaultIndexHtml);

        await assetManager.store(
          new TextEncoder().encode(defaultIndexHtml),
          {
            fileName: 'index.html',
            contentType: 'text/html'
          }
        );
        addDeploymentLog('✅ Default index.html created with element selection script');
      }

      // 🔥 NEW: Inject element selection script into index.html files
      for (const [filename, content] of Object.entries(bundleResult.output)) {
        if ((filename.endsWith('index.html') || filename === 'index.html') && content && content.data) {
          try {
            // Handle different data types (Buffer, Uint8Array, ArrayBuffer, Array, string)
            let htmlContent: string;
            const data = content.data;
            
            if (typeof data === 'string') {
              htmlContent = data;
            } else if (data instanceof Uint8Array) {
              htmlContent = new TextDecoder().decode(data);
            } else if (data instanceof ArrayBuffer) {
              htmlContent = new TextDecoder().decode(data);
            } else if (Array.isArray(data)) {
              // Array of numbers
              htmlContent = new TextDecoder().decode(new Uint8Array(data));
            } else {
              // Try to convert to Uint8Array (handles Buffer and other types)
              try {
                const uint8Array = new Uint8Array(data as any);
                htmlContent = new TextDecoder().decode(uint8Array);
              } catch (convertError) {
                // If conversion fails, try toString if available
                if (data && typeof (data as any).toString === 'function') {
                  htmlContent = (data as any).toString('utf8');
                } else {
                  throw new Error(`Cannot decode data: ${convertError}`);
                }
              }
            }
            
            const injectedHtml = injectElementSelectionScript(htmlContent);
            bundleResult.output[filename] = {
              ...content,
              data: Array.from(new TextEncoder().encode(injectedHtml))
            };
            addDeploymentLog(`✅ Injected element selection script into ${filename}`);
          } catch (err) {
            addDeploymentLog(`⚠️ Failed to inject script into ${filename}: ${err}`);
            console.error('Script injection error details:', err, {
              filename,
              dataType: typeof content.data,
              isArray: Array.isArray(content.data),
              dataLength: content.data?.length
            });
          }
        }
      }

      // Ultra high-performance asset categorization and prioritization
      const assetEntries = Object.entries(bundleResult.output);
      const criticalAssets: Array<[string, any]> = [];
      const smallAssets: Array<[string, any]> = [];
      const largeAssets: Array<[string, any]> = [];
      
      log('PERFORMANCE', '📊 Categorizing assets for ultra high-performance parallel upload...');
      
      assetEntries.forEach(([filename, content]) => {
        if (!content || !content.data) return;
        
        const fileSize = content.data.length;
        const isHtml = filename.endsWith('.html') || filename === 'index.html';
        const isMainJs = filename.includes('index') && (filename.endsWith('.js') || filename.endsWith('.mjs'));
        const isMainCss = filename.includes('index') && filename.endsWith('.css');
        
        if (isHtml || isMainJs || isMainCss) {
          criticalAssets.push([filename, content]);
        } else if (fileSize <= SMALL_ASSET_THRESHOLD) {
          smallAssets.push([filename, content]);
        } else {
          largeAssets.push([filename, content]);
        }
      });
      
      const totalFiles = assetEntries.length;
      addDeploymentLog(`📊 Asset categorization: ${criticalAssets.length} critical, ${smallAssets.length} small, ${largeAssets.length} large`);
      log('PERFORMANCE', `📁 Asset distribution: Critical=${criticalAssets.length}, Small(<${SMALL_ASSET_THRESHOLD}B)=${smallAssets.length}, Large(>${SMALL_ASSET_THRESHOLD}B)=${largeAssets.length}`);

      let deployedCount = 0;
      const deploymentStartTime = performance.now();
      
      // Ultra high-performance asset deployment function
      const deployAsset = async (filename: string, content: any, priority: 'critical' | 'normal' | 'low' = 'normal'): Promise<void> => {
        try {
          if (!content || !content.data) {
            addDeploymentLog(`⚠️ Skipping ${filename} - no content data`);
            return;
          }

          const fileData = new Uint8Array(content.data);
          const contentType = getContentType(filename);

          log('PARALLEL_PROCESSING', `📤 Deploying ${priority} asset: ${filename} (${fileData.length} bytes, ${contentType})`);

          await assetManager.store(fileData, {
            fileName: filename,
            contentType: contentType
          });

          deployedCount++;
          log('PARALLEL_PROCESSING', `✅ Deployed asset: ${filename} (${deployedCount}/${totalFiles})`);

        } catch (fileError) {
          const errorMsg = fileError instanceof Error ? fileError.message : String(fileError);
          addDeploymentLog(`❌ Failed to deploy ${filename}: ${errorMsg}`);
          console.error(`Failed to deploy ${filename}:`, fileError);
          throw fileError;
        }
      };

      // PHASE 1: Deploy critical assets first (sequential for reliability)
      if (criticalAssets.length > 0) {
        addDeploymentLog(`🎯 Phase 1: Deploying ${criticalAssets.length} critical assets...`);
        
        for (const [filename, content] of criticalAssets) {
          await deployAsset(filename, content, 'critical');
        }
        
        addDeploymentLog(`✅ Critical assets deployed (${criticalAssets.length}/${totalFiles})`);
        setDeploymentProgress(75 + (criticalAssets.length / totalFiles) * 10);
      }

      // PHASE 2: Deploy small assets with ultra parallelization
      if (smallAssets.length > 0) {
        addDeploymentLog(`🚀 Phase 2: Deploying ${smallAssets.length} small assets with ultra parallelization...`);
        
        const smallAssetStartTime = performance.now();
        
        await batchProcessWithProgress(
          smallAssets,
          async ([filename, content], index) => {
            await deployAsset(filename, content, 'normal');
          },
          MAX_SMALL_ASSETS,
          (completed, total) => {
            const overallProgress = 75 + ((criticalAssets.length + completed) / totalFiles) * 20;
            setDeploymentProgress(Math.min(overallProgress, 95));
          }
        );
        
        const smallAssetEndTime = performance.now();
        const smallAssetDuration = (smallAssetEndTime - smallAssetStartTime) / 1000;
        
        addDeploymentLog(`✅ Small assets deployed with ultra parallelization (${smallAssetDuration.toFixed(1)}s)`);
        log('PARALLEL_PROCESSING', `📊 Small asset performance: ${smallAssets.length} assets in ${smallAssetDuration.toFixed(1)}s (${(smallAssets.length / smallAssetDuration).toFixed(1)} assets/sec)`);
      }

      // PHASE 3: Deploy large assets with high concurrency
      if (largeAssets.length > 0) {
        addDeploymentLog(`📦 Phase 3: Deploying ${largeAssets.length} large assets with high concurrency...`);
        
        const largeAssetStartTime = performance.now();
        
        await batchProcessWithProgress(
          largeAssets,
          async ([filename, content], index) => {
            await deployAsset(filename, content, 'low');
          },
          MAX_LARGE_ASSETS,
          (completed, total) => {
            const overallProgress = 75 + ((criticalAssets.length + smallAssets.length + completed) / totalFiles) * 20;
            setDeploymentProgress(Math.min(overallProgress, 95));
          }
        );
        
        const largeAssetEndTime = performance.now();
        const largeAssetDuration = (largeAssetEndTime - largeAssetStartTime) / 1000;
        
        addDeploymentLog(`✅ Large assets deployed with high concurrency (${largeAssetDuration.toFixed(1)}s)`);
        log('PARALLEL_PROCESSING', `📊 Large asset performance: ${largeAssets.length} assets in ${largeAssetDuration.toFixed(1)}s`);
      }

      const deploymentEndTime = performance.now();
      const totalDeploymentTime = (deploymentEndTime - deploymentStartTime) / 1000;

      addDeploymentLog(`🎉 Ultra high-performance deployment completed: ${deployedCount}/${totalFiles} files in ${totalDeploymentTime.toFixed(1)}s`);
      log('PERFORMANCE', `📊 Overall deployment performance: ${totalFiles} assets in ${totalDeploymentTime.toFixed(1)}s (${(totalFiles / totalDeploymentTime).toFixed(1)} assets/sec)`);

      const frontendUrl = `https://${frontendCanisterId}.icp0.io`;
      addDeploymentLog(`🌐 Frontend deployed at: ${frontendUrl}`);

      return frontendUrl;

    } catch (deploymentError) {
      const errorMsg = deploymentError instanceof Error ? deploymentError.message : String(deploymentError);
      addDeploymentLog(`❌ Ultra high-performance frontend deployment failed: ${errorMsg}`);
      throw new Error(`Failed to deploy to frontend canister: ${errorMsg}`);
    }
  };

  const addCandidArtifactsToFiles = (
    originalSnapshot: DeploymentFileSnapshot,
    backendResult: DFXUtilsResponse,
    projectName: string
  ): DeploymentFileSnapshot => {
    
    addDeploymentLog('Adding Candid artifacts to deployment snapshot...');
    
    const enhancedSnapshot = { ...originalSnapshot };
    
    const motokoFiles = Object.keys(originalSnapshot).filter(f => f.endsWith('.mo'));
    
    const mainFileEntry = Object.entries(originalSnapshot).find(([name]) => 
      name.endsWith('/main.mo') || name.endsWith('/Main.mo') || name === 'main.mo' || name === 'Main.mo'
    ) || Object.entries(originalSnapshot).find(([name]) => name.endsWith('.mo'));

    let actorName = 'main';
    if (mainFileEntry) {
      actorName = extractActorNameFromMotoko(mainFileEntry[1], mainFileEntry[0]);
    }

    if (backendResult.candid) {
      const candidPath = `${projectName}/src/frontend/candid/${actorName}.did`;
      enhancedSnapshot[candidPath] = backendResult.candid;
      addDeploymentLog(`Added Candid interface: ${candidPath}`);
    }
    
    if (backendResult.typescript) {
      const tsPath = `${projectName}/src/frontend/candid/${actorName}.did.d.ts`;
      enhancedSnapshot[tsPath] = backendResult.typescript;
      addDeploymentLog(`Added TypeScript definitions: ${tsPath}`);
    }
    
    if (backendResult.didJs) {
      const jsPath = `${projectName}/src/frontend/candid/${actorName}.did.js`;
      enhancedSnapshot[jsPath] = backendResult.didJs;
      addDeploymentLog(`Added JavaScript bindings: ${jsPath}`);
    }
    
    if (backendResult.jsonSchema && backendResult.jsonSchema !== '{}') {
      const schemaPath = `${projectName}/src/frontend/candid/${actorName}.json`;
      enhancedSnapshot[schemaPath] = backendResult.jsonSchema;
      addDeploymentLog(`Added JSON schema: ${schemaPath}`);
    }
    
    const totalFiles = Object.keys(enhancedSnapshot).length;
    const addedFiles = totalFiles - Object.keys(originalSnapshot).length;
    addDeploymentLog(`✅ Enhanced snapshot: +${addedFiles} Candid artifacts`);
    
    return enhancedSnapshot;
  };

  // ==================== MAIN DEPLOYMENT EXECUTION WITH CONTEXT ISOLATION ====================
  
  const executeDeployment = useCallback(async () => {
    // CRITICAL FIX: Ref-based guard to prevent double execution (React.StrictMode protection)
    if (isExecutingDeploymentRef.current) {
      log('DEPLOYMENT', '⚠️ Deployment execution already in progress (ref guard), skipping duplicate call');
      return;
    }
    
    if (!deploymentState.selectedServerPair) {
      if (autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) {
        log('AUTO_DEPLOYMENT', '❌ Auto-deployment failed: No server pair selected');
        setError('Auto-deployment failed: No server pair could be selected automatically');
        return;
      } else {
        setError('Please select a server pair first');
        return;
      }
    }

    // CRITICAL FIX: Check if this is an auto-retry execution that might be blocked by state
    if (executionContext.isAutoRetryExecution) {
      log('EXECUTION_CONTEXT_ISOLATION', '🔍 Auto-retry execution - checking for blocking conditions', {
        isCurrentlyDeploying: deploymentState.isDeploying,
        hasError: !!deploymentState.deploymentError,
        deploymentStatus: deploymentState.deploymentStatus,
        hasStartTime: !!deploymentState.deploymentStartTime
      });
      
      // For auto-retry, only block if actually deploying right now
      if (deploymentState.isDeploying) {
        log('EXECUTION_CONTEXT_ISOLATION', '⚠️ Auto-retry execution blocked: Currently deploying');
        return;
      }
    } else {
      // Original blocking logic for manual deployments
      if (deploymentState.isDeploying) {
        log('DEPLOYMENT', '⚠️ Deployment already in progress, skipping duplicate execution');
        return;
      }
    }
    
    // Set ref guard immediately to prevent double execution
    isExecutingDeploymentRef.current = true;
    
    // 🔧 FIX: Mark deployment as started IMMEDIATELY (before any async operations) to prevent useEffect from clearing state
    deploymentStartedRef.current = true;

    clearCachedDeploymentUrl(projectId);

    log('COORDINATOR_INTEGRATION', '🚀 Starting high-performance deployment execution...', {
      isAutoDeployment: autoDeploymentStatus.isAutoDeployment,
      isCoordinatorActive: consolidatedAutoRetryState.isActive,
      isAutoRetryExecution: executionContext.isAutoRetryExecution,
      executionAttempt: executionContext.executionAttempt,
      serverPairId: deploymentState.selectedServerPair.pairId,
      consolidatedExecutionCount: consolidatedAutoRetryState.executionCount,
      displayCount: consolidatedAutoRetryState.displayExecutionCount
    });
    
    if (consolidatedAutoRetryState.isActive) {
      log('COORDINATOR_INTEGRATION', `🔄 Auto-retry attempt ${consolidatedAutoRetryState.displayExecutionCount}`, {
        isSequential: consolidatedAutoRetryState.isSequentialError,
        sequentialCount: consolidatedAutoRetryState.sequentialErrorCount,
        workflowPhase: consolidatedAutoRetryState.phase,
        executionContext: executionContext.isAutoRetryExecution
      });
      
      setDeploymentState(prev => ({ 
        ...prev, 
        retryAttempt: consolidatedAutoRetryState.executionCount,
        isAutoRetrying: true
      }));
    }

    const actualStartTime = Date.now();
    const deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // CRITICAL FIX: For auto-retry executions, we've already cleaned the state, so don't clear error handler again
    if (!executionContext.isAutoRetryExecution) {
      // Clear error handler state at deployment start for manual deployments
      updateErrorHandlerState({
        showFixButton: false,
        errorSummary: null,
        lastErrorProcessingTime: null,
        isProcessingError: false,
        errorClassification: null,
        errorCategory: null,
        blockingErrorsCount: 0,
        warningsCount: 0
      });
      
      try {
        if (deploymentErrorHandler && typeof deploymentErrorHandler.clearErrors === 'function') {
          deploymentErrorHandler.clearErrors();
        }
      } catch (error) {
        log('ERROR_PARSING', '⚠️ Failed to clear error handler on deployment start:', error);
      }
    } else {
      log('EXECUTION_CONTEXT_ISOLATION', '✅ Auto-retry execution using pre-cleaned state');
    }

    try {
      // 🔧 FIX: Set isDeploying synchronously first to ensure progress bar appears immediately
      // (deploymentStartedRef is already set above, before any async operations)
      // CRITICAL: Reset status and progress to ensure clean state for new deployment
      setDeploymentState(prev => ({
        ...prev,
        isDeploying: true,
        deploymentStartTime: actualStartTime,
        deploymentStatus: 'analyzing', // Reset to initial status
        // 🔧 FIX: Clear logs for fresh deployment start (both auto-retry and manual)
        // This ensures users see a clean log stream from the beginning
        deploymentLogs: [],
        deploymentError: null,
        deploymentProgress: 1, // 🔧 FIX: Start at 1% so progress bar is visible from the start
        deployedFrontendUrl: null,
        deploymentDuration: null,
        retryAttempt: consolidatedAutoRetryState.executionCount,
        isAutoRetrying: consolidatedAutoRetryState.isActive
      }));
      
      // Also reset status and progress via setters to ensure UI updates
      setDeploymentStatus('analyzing');
      setDeploymentProgress(1);

      // Force a synchronous render to ensure isDeploying is visible
      // Use requestAnimationFrame to ensure DOM update happens
      await new Promise(resolve => requestAnimationFrame(resolve));

      setDeploymentStatus('analyzing');
      setDeploymentProgress(5);
      
      // 🔧 FIX: Add initial logs immediately (synchronously) to ensure they appear before compilation
      // Add deployment logging with workflow context
      if (consolidatedAutoRetryState.isActive && consolidatedAutoRetryState.executionCount > 0) {
        const attemptInfo = consolidatedAutoRetryState.displayExecutionCount;
        const sequentialInfo = consolidatedAutoRetryState.isSequentialError 
          ? ` (Sequential error #${consolidatedAutoRetryState.sequentialErrorCount})` 
          : '';
        addDeploymentLog(`🔄 High-performance auto-retry attempt ${attemptInfo}${sequentialInfo}`);
      }
      
      addDeploymentLog('📸 Creating deployment file snapshot...');
      
      // 🔧 FIX: Small delay to ensure initial logs are rendered before proceeding
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const deploymentSnapshot = await createDeploymentFileSnapshot();
      
      if (Object.keys(deploymentSnapshot).length === 0) {
        throw new Error('No files available in deployment snapshot');
      }
      
      addDeploymentLog(`✅ Deployment snapshot created with ${Object.keys(deploymentSnapshot).length} files`);
      
      // 🔧 FIX: Small delay to ensure log is rendered
      await new Promise(resolve => setTimeout(resolve, 30));

      const motokoFiles = Object.keys(deploymentSnapshot).filter(f => f.endsWith('.mo'));
      const frontendFiles = Object.keys(deploymentSnapshot).filter(f => !f.endsWith('.mo') && !f.endsWith('.did'));
      
      addDeploymentLog(`Found ${motokoFiles.length} Motoko files and ${frontendFiles.length} frontend files`);
      
      // 🔧 FIX: Small delay to ensure log is rendered
      await new Promise(resolve => setTimeout(resolve, 30));
      
      if (motokoFiles.length === 0) {
        throw new Error('No Motoko backend files found in deployment snapshot');
      }
      
      if (frontendFiles.length === 0) {
        throw new Error('No frontend files found in deployment snapshot');
      }

      setDeploymentStatus('compiling-backend');
      setDeploymentProgress(10);
      addDeploymentLog('Starting Motoko compilation...');
      
      // 🔧 FIX: Small delay to ensure "Starting Motoko compilation..." log is visible before compilation begins
      await new Promise(resolve => setTimeout(resolve, 50));

      const motokoData = prepareMotokoFiles(deploymentSnapshot);
      addDeploymentLog(`Main actor file: ${motokoData.mainFile}`);
      
      // 🎯 CRITICAL: Extract actor name first to find the correctly-named WASM
      const mainFileEntry = Object.entries(deploymentSnapshot).find(([fileName]) => 
        fileName.endsWith('/main.mo') || fileName.endsWith('/Main.mo') ||
        fileName === 'main.mo' || fileName === 'Main.mo'
      );
      
      const actorName = mainFileEntry 
        ? extractActorNameFromMotoko(mainFileEntry[1], mainFileEntry[0])
        : 'main';
      
      addDeploymentLog(`🎯 Detected actor name: ${actorName}`);
      
      // 🚀 NEW: Check for cached WASM from project generation
      let backendResult: DFXUtilsResponse;
      let usedCachedWasm = false;
      
      try {
        addDeploymentLog('🔍 Checking for cached WASM from project generation...');
        
        const userActor = await userCanisterService.getUserActor(
          userCanisterId!,
          identity!
        );
        
        const cachedWasmResult = await userActor.readCodeArtifact(
          principal!,
          projectId!,
          '.deploy',
          `${actorName}.wasm`,  // 🎯 Use actor name, not "backend"
          []
        );
        
        if ('ok' in cachedWasmResult || 'Ok' in cachedWasmResult) {
          const artifact = cachedWasmResult.ok || cachedWasmResult.Ok;
          
          // Extract Binary content (same as downloadProjectWasmFiles)
          let binaryData: any = null;
          if (Array.isArray(artifact.content) && artifact.content.length > 0) {
            binaryData = artifact.content[0];
          } else if (artifact.content && typeof artifact.content === 'object') {
            binaryData = artifact.content;
          }
          
          if (binaryData && typeof binaryData === 'object' && 'Binary' in binaryData) {
            const binary = binaryData.Binary;
            let wasmBytes: Uint8Array | null = null;
            
            if (Array.isArray(binary)) {
              wasmBytes = new Uint8Array(binary);
            } else if (binary instanceof Uint8Array) {
              wasmBytes = binary;
            }
            
            if (wasmBytes) {
              addDeploymentLog(`🎯 Found cached WASM: ${(wasmBytes.length / 1024).toFixed(1)} KB - skipping recompilation!`);
              
              // Use cached WASM with existing Candid artifacts
              backendResult = {
                success: true,
                wasm: '', // Not needed
                candid: deploymentSnapshot['src/frontend/candid/backend.did'] || '',
                typescript: deploymentSnapshot['src/frontend/candid/backend.did.d.ts'] || '',
                didJs: deploymentSnapshot['src/frontend/candid/backend.did.js'] || '',
                jsonSchema: deploymentSnapshot['src/frontend/candid/backend.json'] || '{}',
                compiledWasm: wasmBytes
              } as DFXUtilsResponse;
              
              usedCachedWasm = true;
              setDeploymentProgress(25); // Skip ahead since we saved compilation time
            }
          }
        }
      } catch (cacheError) {
        addDeploymentLog(`⚠️ No cached WASM found, will compile from source`);
      }
      
      // Compile only if we don't have cached WASM
      if (!usedCachedWasm) {
        addDeploymentLog('🔨 Compiling Motoko code from source...');
        backendResult = await compileMotokoCode(motokoData, projectName);
        addDeploymentLog('✅ Motoko compilation successful');
      } else {
        addDeploymentLog('⚡ Skipped compilation - using cached WASM from project generation!');
      }
      
      setDeploymentProgress(30);

      setDeploymentStatus('deploying-backend');
      addDeploymentLog('🚀 Starting high-performance backend deployment...');

      await deployBackendToCanister(backendResult, deploymentState.selectedServerPair.backendCanisterId);
      
      setDeploymentProgress(50);

      setDeploymentStatus('bundling-frontend');
      addDeploymentLog('Starting frontend bundling...');

      const enhancedSnapshot = addCandidArtifactsToFiles(deploymentSnapshot, backendResult, projectName);
      
      const snapshotWithViteConfig = addViteConfigToSnapshot(enhancedSnapshot, deploymentState.selectedServerPair.backendCanisterId, projectName);
      
      const frontendData = prepareFrontendFiles(snapshotWithViteConfig, deploymentState.selectedServerPair);
      const frontendResult = await bundleFrontendCode(frontendData, deploymentState.selectedServerPair, projectName);
      
      setDeploymentProgress(70);

      setDeploymentStatus('deploying-frontend');
      addDeploymentLog('🚀 Starting ultra high-performance frontend deployment...');

      const frontendUrl = await deployFrontendToCanister(frontendResult, deploymentState.selectedServerPair.frontendCanisterId);
      
      setDeploymentProgress(100);
      setDeploymentStatus('completed');
      
      const actualEndTime = Date.now();
      const actualDuration = actualEndTime - actualStartTime;
      
      setDeploymentState(prev => ({ 
        ...prev, 
        deployedFrontendUrl: frontendUrl,
        deploymentDuration: actualDuration,
        retryAttempt: 0,
        isAutoRetrying: false
      }));
      
      setCachedDeploymentUrl(projectId, frontendUrl, deploymentState.selectedServerPair.pairId, actualDuration);
      
      // Success logging with workflow context
      if (consolidatedAutoRetryState.isActive && consolidatedAutoRetryState.executionCount > 0) {
        const attemptInfo = consolidatedAutoRetryState.displayExecutionCount;
        const sequentialInfo = consolidatedAutoRetryState.isSequentialError 
          ? ` (resolved sequential error #${consolidatedAutoRetryState.sequentialErrorCount})` 
          : '';
        addDeploymentLog(`🎉 High-performance auto-retry successful after ${attemptInfo} attempt${consolidatedAutoRetryState.executionCount > 1 ? 's' : ''}${sequentialInfo}!`);
      }
      
      addDeploymentLog(`🎉 High-performance deployment completed successfully in ${(actualDuration / 1000).toFixed(1)}s!`);
      addDeploymentLog(`🌐 Frontend URL: ${frontendUrl}`);
      addDeploymentLog(`⚙️ Backend Canister ID: ${deploymentState.selectedServerPair.backendCanisterId}`);
      
      const successMessage = autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive
        ? (consolidatedAutoRetryState.executionCount > 0 
            ? `🤖 High-performance auto-retry successful after ${consolidatedAutoRetryState.displayExecutionCount} attempt${consolidatedAutoRetryState.executionCount > 1 ? 's' : ''}!`
            : '🤖 High-performance auto-deployment completed successfully!')
        : '🎉 High-performance deployment completed successfully!';
      
      setSuccess(successMessage);

      debouncedSaveToCache('success', true);

      const updatedHistory = getDeploymentHistory(projectId);
      setDeploymentHistory(updatedHistory);
      
      // 🚀 NEW: Clean up cached WASM after successful deployment
      if (usedCachedWasm) {
        try {
          addDeploymentLog('🧹 Cleaning up cached WASM...');
          const userActor = await userCanisterService.getUserActor(
            userCanisterId!,
            identity!
          );
          // Use actor name for cleanup (same as we used for caching)
          await userActor.deleteFile(projectId!, `.deploy/${actorName}.wasm`, []);
          addDeploymentLog('✅ Cached WASM cleaned up');
        } catch (cleanupError) {
          addDeploymentLog(`⚠️ Could not delete cached WASM (non-critical)`);
        }
      }

      // Notify coordinator of successful deployment
      if (consolidatedAutoRetryState.isActive && consolidatedAutoRetryState.workflowId) {
        try {
          log('COORDINATOR_INTEGRATION', '🎉 Notifying coordinator of high-performance deployment success...', {
            workflowId: consolidatedAutoRetryState.workflowId,
            frontendUrl,
            duration: actualDuration,
            executionCount: consolidatedAutoRetryState.executionCount,
            isSequential: consolidatedAutoRetryState.isSequentialError,
            sequentialCount: consolidatedAutoRetryState.sequentialErrorCount
          });

          await autoRetryCoordinator.completeWorkflow(consolidatedAutoRetryState.workflowId, {
            success: true,
            phase: 'deployment',
            deployedUrl: frontendUrl,
            duration: actualDuration
          });
          
          log('COORDINATOR_INTEGRATION', '✅ Successfully notified coordinator of high-performance deployment success');
        } catch (coordinatorError) {
          log('COORDINATOR_INTEGRATION', '⚠️ Failed to notify coordinator of success (non-critical):', coordinatorError);
        }
      }

      // 🔥 NEW: Track successful deployment in economy metrics (CRITICAL FIX)
      if (handleDeploymentSuccess && autoDeploymentContext?.messageId) {
        try {
          const callbacks = getCallbacks();
          if (callbacks.onTabSwitch) {
            log('DEPLOYMENT', '📊 Tracking successful deployment in economy dashboard...');
            handleDeploymentSuccess(
              autoDeploymentContext.messageId,
              frontendUrl,
              actualDuration,
              callbacks.onTabSwitch
            );
          }
        } catch (trackingError) {
          log('DEPLOYMENT', '⚠️ Failed to track deployment success (non-critical):', trackingError);
        }
      }

      const callbacks = getCallbacks();
      if ((autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) && callbacks.onTabSwitch) {
        log('AUTO_DEPLOYMENT', '🎯 High-performance auto-deployment successful! Switching to Live Preview tab...');
        
        setTimeout(() => {
          callbacks.onTabSwitch('preview');
        }, 2000);
      }

      // 🔧 FIX: Reset deployment status to idle after a delay to allow next deployment
      // This ensures users can see the success status, but then it clears for the next deployment
      // Only reset if not in auto-retry mode (auto-retry coordinator handles its own state)
      if (!consolidatedAutoRetryState.isActive) {
        setTimeout(() => {
          log('DEPLOYMENT', '🔄 Resetting deployment status to idle after successful completion');
          setDeploymentStatus('idle');
          setDeploymentProgress(0);
          setDeploymentState(prev => ({
            ...prev,
            deploymentStatus: 'idle',
            deploymentProgress: 0,
            // Keep deployedFrontendUrl and deploymentDuration for display purposes
          }));
        }, 5000); // 5 second delay to show success status
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';
      log('COORDINATOR_INTEGRATION', '❌ High-performance deployment failed - coordinator will handle retry if applicable:', errorMessage);
      
      setDeploymentStatus('failed');
      setDeploymentError(errorMessage);
      addDeploymentLog(`❌ High-performance deployment failed: ${errorMessage}`);
      
      if (!autoDeploymentStatus.isAutoDeployment && !consolidatedAutoRetryState.isActive) {
        setError(errorMessage);
      } else {
        log('COORDINATOR_INTEGRATION', '🤖 Auto-deployment error will be handled by error processing system');
        
        setDeploymentState(prev => ({ 
          ...prev, 
          retryAttempt: consolidatedAutoRetryState.executionCount,
          isAutoRetrying: consolidatedAutoRetryState.isActive
        }));
      }

      debouncedSaveToCache('failed', true);

      const updatedHistory = getDeploymentHistory(projectId);
      setDeploymentHistory(updatedHistory);

      // 🔧 FIX: Reset deployment status to idle after a delay to allow next deployment
      // Only reset if not in auto-retry mode (auto-retry will handle its own state)
      if (!consolidatedAutoRetryState.isActive) {
        setTimeout(() => {
          log('DEPLOYMENT', '🔄 Resetting deployment status to idle after failure');
          setDeploymentStatus('idle');
          setDeploymentProgress(0);
          setDeploymentError(null);
          setDeploymentState(prev => ({
            ...prev,
            deploymentStatus: 'idle',
            deploymentProgress: 0,
            deploymentError: null,
          }));
        }, 5000); // 5 second delay to show error status
      }

    } finally {
      // CRITICAL FIX: Reset ref guard to allow future deployments
      isExecutingDeploymentRef.current = false;
      
      // 🔧 FIX: Reset deployment started flag after deployment completes
      deploymentStartedRef.current = false;
      
      setDeploymentState(prev => ({ 
        ...prev, 
        isDeploying: false 
      }));
    }
  }, [
    deploymentState.selectedServerPair,
    deploymentState.isDeploying,
    autoDeploymentStatus.isAutoDeployment,
    consolidatedAutoRetryState,
    executionContext, // CRITICAL: Now includes execution context
    autoDeploymentContext,
    projectId,
    projectName,
    createDeploymentFileSnapshot,
    addDeploymentLog,
    setDeploymentStatus,
    setDeploymentProgress,
    deploymentErrorHandler,
    debouncedSaveToCache,
    getCallbacks,
    updateErrorHandlerState,
    deploymentState.deploymentError,
    deploymentState.deploymentStatus
  ]);

  // Expose deployment function for coordinator integration
  useEffect(() => {
    if (typeof executeDeployment === 'function') {
      (window as any).__executeDeployment = executeDeployment;
      log('COORDINATOR_INTEGRATION', '✅ High-performance executeDeployment function exposed to window for coordinator access');
    } else {
      log('COORDINATOR_INTEGRATION', '❌ executeDeployment function is not valid for window exposure');
    }
    
    return () => {
      delete (window as any).__executeDeployment;
      log('COORDINATOR_INTEGRATION', '🧹 executeDeployment function cleaned from window');
    };
  }, [executeDeployment]);

  // Fix button click handler for manual mode only
  const handleFixButtonClick = useCallback(async () => {
    if (consolidatedAutoRetryState.isActive) {
      console.warn('Fix button should not be available during auto-retry');
      return;
    }

    try {
      if (!deploymentErrorHandler || typeof deploymentErrorHandler.getFixRequestMessage !== 'function') {
        log('ERROR_PARSING', '❌ Error handler not available for fix request');
        setError('Fix functionality is not available at the moment');
        return;
      }

      const fixMessage = deploymentErrorHandler.getFixRequestMessage();
      if (!fixMessage) {
        log('ERROR_PARSING', '❌ No fix message available');
        setError('No fix request could be generated');
        return;
      }

      log('ERROR_PARSING', '🔧 Fix button clicked, preparing to submit fix request...', {
        errorClassification: errorHandlerState.errorClassification,
        errorCategory: errorHandlerState.errorCategory,
        blockingErrors: errorHandlerState.blockingErrorsCount,
        warnings: errorHandlerState.warningsCount
      });

      const callbacks = getCallbacks();
      if (callbacks.onTabSwitch) {
        log('ERROR_PARSING', '🔄 Switching to chat tab for fix request...');
        callbacks.onTabSwitch('chat');
      }

      if (callbacks.onSubmitFixMessage) {
        log('ERROR_PARSING', '📝 Submitting fix request to chat...');
        setTimeout(() => {
          callbacks.onSubmitFixMessage(fixMessage);
          
          updateErrorHandlerState({
            showFixButton: false,
            errorSummary: null,
            lastErrorProcessingTime: null,
            errorClassification: null,
            errorCategory: null
          });
          
          debouncedSaveToCache(deploymentState.deploymentStatus === 'completed' ? 'success' : 'failed', true);
        }, 500);
      } else {
        log('ERROR_PARSING', '❌ Chat submit callback not available');
        setError('Unable to submit fix request - chat system not ready');
      }
    } catch (error) {
      log('ERROR_PARSING', '❌ Fix button click failed:', error);
      setError('Failed to submit fix request');
    }
  }, [consolidatedAutoRetryState.isActive, deploymentErrorHandler, getCallbacks, deploymentState.deploymentStatus, debouncedSaveToCache, updateErrorHandlerState, errorHandlerState]);

  // Clear deployment state with coordinator cleanup
  const clearDeploymentState = useCallback((clearConfig = false) => {
    log('STATE_PERSISTENCE', '🧹 Clearing deployment state', { clearConfig });
    
    if (autoRetryCoordinator.isProjectInAutoRetry(projectId)) {
      log('MUTEX_CONTROL', '🧹 Force cleaning coordinator workflow during state clear');
      autoRetryCoordinator.forceCleanupWorkflow(projectId);
    }
    
    setDeploymentState(prev => ({
      selectedServerPair: clearConfig ? null : prev.selectedServerPair,
      deploymentStatus: 'idle',
      deploymentProgress: 0,
      deploymentLogs: [],
      deploymentError: null,
      isDeploying: false,
      deployedFrontendUrl: null,
      deploymentStartTime: null,
      deploymentDuration: null,
      retryAttempt: 0,
      isAutoRetrying: false
    }));
    
    updateErrorHandlerState({
      showFixButton: false,
      errorSummary: null,
      lastErrorProcessingTime: null,
      isProcessingError: false,
      errorClassification: null,
      errorCategory: null,
      blockingErrorsCount: 0,
      warningsCount: 0
    });
    
    setError(null);
    setSuccess(null);
    
    try {
      if (deploymentErrorHandler && typeof deploymentErrorHandler.clearErrors === 'function') {
        deploymentErrorHandler.clearErrors();
      }
    } catch (error) {
      log('ERROR_PARSING', '⚠️ Failed to clear error handler:', error);
    }
    
    clearProjectDeploymentCache(projectId);
    setCachedDeployment(null);
    setDeploymentHistory([]);
    
    clearCachedDeploymentUrl(projectId);
    
    if (clearConfig) {
      clearProjectConfigurationCache(projectId);
    }
    
    log('STATE_PERSISTENCE', '✅ Deployment state cleared successfully', { clearedConfig: clearConfig });
  }, [projectId, deploymentErrorHandler, updateErrorHandlerState]);

  // Listen for server pair changes from ProjectTabs
  useEffect(() => {
    if (!activeProject || !projectServerPairs?.lastAssignmentUpdate) return;
    
    // 🔧 FIX: Skip if we've already processed this update
    if (lastProcessedUpdateRef.current === projectServerPairs.lastAssignmentUpdate) {
      return;
    }
    
    const coordinatedServerPairId = getProjectServerPair(activeProject);
    if (coordinatedServerPairId && deploymentState.selectedServerPair?.pairId !== coordinatedServerPairId) {
      const matchingPair = projectServerPairsList.find(p => p.pairId === coordinatedServerPairId);
      if (matchingPair) {
        log('SERVER_PAIR_COORDINATION', '🔄 Syncing server pair from ProjectTabs:', coordinatedServerPairId);
        lastProcessedUpdateRef.current = projectServerPairs.lastAssignmentUpdate;
        setDeploymentState(prev => ({
          ...prev,
          selectedServerPair: matchingPair
        }));
        // Don't call saveServerPairSelection here to avoid triggering another update
      }
    } else if (coordinatedServerPairId && deploymentState.selectedServerPair?.pairId === coordinatedServerPairId) {
      // Already in sync, just mark as processed
      lastProcessedUpdateRef.current = projectServerPairs.lastAssignmentUpdate;
    }
  }, [activeProject, projectServerPairs?.lastAssignmentUpdate, getProjectServerPair, setProjectServerPair, projectServerPairsList, deploymentState.selectedServerPair]);

  // Handle server pair auto-selection (must be defined before loadServerPairs)
  const handleServerPairAutoSelection = useCallback(async (pairs: ServerPair[]) => {
    log('AUTO_DEPLOYMENT', '🔍 Handling server pair selection:', { 
      pairsCount: pairs.length,
      isAutoDeployment: autoDeploymentStatus.isAutoDeployment,
      isCoordinatorActive: consolidatedAutoRetryState.isActive,
      projectId,
      currentSelectedPair: deploymentState.selectedServerPair?.pairId
    });

    if (pairs.length === 0) {
      log('AUTO_DEPLOYMENT', '❌ No server pairs available');
      return;
    }

    let selectedPair: ServerPair | null = null;

    if (deploymentState.selectedServerPair) {
      const currentPairStillExists = pairs.find(pair => pair.pairId === deploymentState.selectedServerPair!.pairId);
      if (currentPairStillExists) {
        log('STATE_PERSISTENCE', '✅ Current server pair is still valid');
        selectedPair = currentPairStillExists;
      }
    }

    if (!selectedPair && selectedServerPairId) {
      log('STATE_PERSISTENCE', '🔄 Attempting to restore selected server pair from centralized state:', selectedServerPairId);
      
      const cachedPair = pairs.find(pair => pair.pairId === selectedServerPairId);
      if (cachedPair) {
        log('STATE_PERSISTENCE', '✅ Restored server pair from centralized state:', cachedPair.name);
        selectedPair = cachedPair;
      }
    }

    if (!selectedPair) {
      const cached = getCachedDeployment(projectId);
      if (cached?.sessionCache?.deploymentState?.selectedServerPairId) {
        log('STATE_PERSISTENCE', '🔄 Attempting to restore from session cache');
        const sessionPair = pairs.find(pair => pair.pairId === cached.sessionCache!.deploymentState!.selectedServerPairId);
        if (sessionPair) {
          selectedPair = sessionPair;
        }
      }
    }

    if (!selectedPair) {
      log('AUTO_DEPLOYMENT', '🔄 Using first available server pair');
      selectedPair = pairs[0];
    }

    // 🔧 FIX: Only update state if the pair actually changed to prevent infinite loops
    if (selectedPair && deploymentState.selectedServerPair?.pairId !== selectedPair.pairId) {
      setDeploymentState(prev => ({
        ...prev,
        selectedServerPair: selectedPair
      }));

      // 🔧 FIX: Only save if it's different from what's already in the store
      // 🔥 UPDATED: Use centralized server pair state management
      if (selectedServerPairId !== selectedPair.pairId) {
        setServerPairId(selectedPair.pairId);
        
        const storageEvent = new StorageEvent('storage', {
          key: `selected-server-pair-${projectId}`,
          newValue: selectedPair.pairId
        });
        window.dispatchEvent(storageEvent);

        log('AUTO_DEPLOYMENT', '✅ Server pair selected and saved:', selectedPair.name);
      } else {
        log('AUTO_DEPLOYMENT', '✅ Server pair already in sync with store:', selectedPair.name);
      }
    } else if (selectedPair) {
      log('AUTO_DEPLOYMENT', '✅ Server pair unchanged, skipping update:', selectedPair.name);
    }
  }, [projectId, deploymentState.selectedServerPair, autoDeploymentStatus.isAutoDeployment, consolidatedAutoRetryState.isActive, getProjectServerPair, setProjectServerPair]);

  // Server pair loading (simplified - no background refresh for now)
  // 🔧 FIX: Add ref to track loading state and prevent concurrent calls
  const isLoadingServerPairsRef = useRef<boolean>(false);
  const lastLoadTimeRef = useRef<number>(0);
  const LOAD_DEBOUNCE_MS = 2000; // 2 second debounce to prevent rapid calls
  
  const loadServerPairs = useCallback(async (forceRefresh = false) => {
    if (!userCanisterId || !identity || !activeProject) {
      setIsLoading(false);
      return;
    }

    // 🔧 FIX: Prevent concurrent calls
    if (isLoadingServerPairsRef.current) {
      log('SERVER_PAIR_CACHE', '⚠️ Server pairs already loading, skipping duplicate call');
      return;
    }

    // 🔧 FIX: Debounce rapid successive calls
    const now = Date.now();
    if (!forceRefresh && (now - lastLoadTimeRef.current) < LOAD_DEBOUNCE_MS) {
      log('SERVER_PAIR_CACHE', '⚠️ Debouncing server pairs load (too soon after last call)');
      return;
    }

    try {
      isLoadingServerPairsRef.current = true;
      lastLoadTimeRef.current = now;
      setIsLoading(true);
      setError(null);
      
      log('SERVER_PAIR_CACHE', '🔍 Loading server pairs...', { forceRefresh, projectId: activeProject });

      if (!forceRefresh) {
        const cachedPairs = getCachedServerPairs(userCanisterId);
        if (cachedPairs && cachedPairs.length > 0) {
          log('SERVER_PAIR_CACHE', '⚡ Using cached server pairs', {
            count: cachedPairs.length,
            source: 'persistent-cache'
          });
          
          const mappedPairs = cachedPairs.map(pair => ({
            pairId: pair.pairId,
            name: pair.name,
            frontendCanisterId: pair.frontendCanisterId,
            backendCanisterId: pair.backendCanisterId,
            createdAt: pair.createdAt,
            creditsAllocated: pair.creditsAllocated
          }));
          
          setProjectServerPairs(mappedPairs);
          await handleServerPairAutoSelection(mappedPairs);
          setIsLoading(false);
          isLoadingServerPairsRef.current = false;
          setLastCacheCheck(Date.now());
          return;
        }
      }

      log('SERVER_PAIR_CACHE', '📡 Loading fresh server pairs from canister...', { 
        reason: forceRefresh ? 'forced-refresh' : 'no-cache',
        projectId: activeProject
      });

      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      const serverPairsResult = await userActor.getProjectServerPairs(activeProject);

      if (serverPairsResult && 'ok' in serverPairsResult) {
        const serverPairsData = serverPairsResult.ok;
        
        if (Array.isArray(serverPairsData)) {
          const pairs = serverPairsData.map((pair: any) => ({
            pairId: pair.pairId,
            name: pair.name,
            createdAt: Number(pair.createdAt) / 1_000_000,
            creditsAllocated: Number(pair.creditsAllocated),
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          
          const enhancedPairs: CachedServerPair[] = pairs.map(pair => ({
            ...pair,
            currentProjectId: undefined,
            currentProjectName: undefined,
            canReassign: true
          }));
          
          setProjectServerPairs(pairs);
          setCachedServerPairs(userCanisterId, enhancedPairs);
          await handleServerPairAutoSelection(pairs);
          
          log('SERVER_PAIR_CACHE', '✅ Server pairs loaded and cached successfully', {
            count: pairs.length,
            cached: true
          });
          
        } else {
          setProjectServerPairs([]);
          setCachedServerPairs(userCanisterId, []);
        }
      } else {
        setProjectServerPairs([]);
        setCachedServerPairs(userCanisterId, []);
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load server pairs');
      log('SERVER_PAIR_CACHE', '❌ Failed to load server pairs:', error);
    } finally {
      setIsLoading(false);
      isLoadingServerPairsRef.current = false;
      setLastCacheCheck(Date.now());
    }
  }, [userCanisterId, identity, activeProject, handleServerPairAutoSelection, getProjectServerPair, setProjectServerPair]);

  // CRITICAL FIX: Auto-deployment trigger with execution context isolation
  useEffect(() => {
    log('AUTO_DEPLOYMENT', '🔍 Auto-deployment trigger effect with consolidated state:', {
      hasContext: !!autoDeploymentContext,
      hasServerPair: !!deploymentState.selectedServerPair,
      isDeploying: deploymentState.isDeploying,
      hasStarted: !!deploymentState.deploymentStartTime,
      isLoading,
      shouldAutoStart: autoDeploymentStatus.shouldAutoStart,
      coordinatorActive: consolidatedAutoRetryState.isActive,
      coordinatorRetryReady: consolidatedAutoRetryState.deploymentRetryReady,
      displayExecutionCount: consolidatedAutoRetryState.displayExecutionCount,
      executionContextReady: executionContext.isAutoRetryExecution,
      deploymentStatus: deploymentState.deploymentStatus
    });

    // CRITICAL FIX: Check ref guard to prevent double execution (React.StrictMode protection)
    if (isExecutingDeploymentRef.current) {
      log('AUTO_DEPLOYMENT', '⚠️ Deployment already executing (ref guard), skipping auto-trigger');
      return;
    }
    
    if (autoDeploymentStatus.shouldAutoStart && !consolidatedAutoRetryState.isActive) {
      log('AUTO_DEPLOYMENT', '🚀 AUTO-DEPLOYMENT TRIGGER ACTIVATED!');
      
      setTimeout(() => {
        // Double-check ref guard before executing (race condition protection)
        if (!isExecutingDeploymentRef.current) {
          executeDeployment();
        } else {
          log('AUTO_DEPLOYMENT', '⚠️ Deployment already executing (ref guard check in setTimeout), skipping');
        }
      }, 500);
    }
    else if (consolidatedAutoRetryState.deploymentRetryReady && 
             deploymentState.selectedServerPair && 
             !deploymentState.isDeploying &&
             (executionContext.isAutoRetryExecution ? (deploymentState.deploymentStatus === 'idle') : (!deploymentState.deploymentStartTime))) {
      
      log('AUTO_DEPLOYMENT', '🚀 COORDINATOR RETRY TRIGGER ACTIVATED!', {
        workflowId: consolidatedAutoRetryState.workflowId,
        executionCount: consolidatedAutoRetryState.executionCount,
        displayCount: consolidatedAutoRetryState.displayExecutionCount,
        isSequential: consolidatedAutoRetryState.isSequentialError,
        sequentialCount: consolidatedAutoRetryState.sequentialErrorCount,
        workflowPhase: consolidatedAutoRetryState.phase,
        executionContextReady: executionContext.isAutoRetryExecution,
        deploymentStatus: deploymentState.deploymentStatus
      });
      
      setTimeout(() => {
        // Double-check ref guard before executing (race condition protection)
        if (!isExecutingDeploymentRef.current) {
          executeDeployment();
        } else {
          log('AUTO_DEPLOYMENT', '⚠️ Deployment already executing (ref guard check in setTimeout), skipping');
        }
      }, 500);
    }
  }, [
    autoDeploymentContext, 
    deploymentState.selectedServerPair, 
    deploymentState.isDeploying, 
    deploymentState.deploymentStartTime,
    deploymentState.deploymentStatus,
    isLoading,
    autoDeploymentStatus.shouldAutoStart,
    consolidatedAutoRetryState,
    executionContext, // CRITICAL: Now includes execution context
    executeDeployment
  ]);

  // Load server pairs when project changes - ensure we're using the active project
  useEffect(() => {
    // Only load if the DeploymentInterface's projectId matches the active project
    // This ensures server pairs are tied to the currently active project
    if (activeProject && activeProject === projectId && lastLoadedProjectRef.current !== activeProject) {
      lastLoadedProjectRef.current = activeProject;
      loadServerPairs();
      
      // Also sync the selected server pair from centralized store
      const coordinatedServerPairId = getProjectServerPair(activeProject);
      if (coordinatedServerPairId && projectServerPairsList.length > 0) {
        const matchingPair = projectServerPairsList.find(p => p.pairId === coordinatedServerPairId);
        if (matchingPair && deploymentState.selectedServerPair?.pairId !== coordinatedServerPairId) {
          log('SERVER_PAIR_COORDINATION', '🔄 Syncing server pair from centralized store on project load:', coordinatedServerPairId);
          setDeploymentState(prev => ({
            ...prev,
            selectedServerPair: matchingPair
          }));
        }
      }
    }
  }, [activeProject, projectId, loadServerPairs, getProjectServerPair, projectServerPairsList]);

  useEffect(() => {
    // CRITICAL FIX: Only restore cached deployment URL if there's no new deployment requested
    // If autoDeploymentContext exists, we want a fresh deployment, not a cached one
    if (!autoDeploymentContext) {
      const cachedDeployment = getCachedDeploymentUrl(projectId);
      if (cachedDeployment) {
        setDeploymentState(prev => ({
          ...prev,
          deployedFrontendUrl: cachedDeployment.url,
          deploymentDuration: cachedDeployment.duration,
          deploymentStatus: 'completed'
        }));
      }
    } else {
      // Clear cached deployment URL when new deployment is requested
      clearCachedDeploymentUrl(projectId);
    }
  }, [projectId, loadServerPairs, autoDeploymentContext]);

  // State restoration with execution context awareness
  useEffect(() => {
    if (!isActive) return;

    log('STATE_PERSISTENCE', '🔄 Deploy tab became active, checking for state restoration...', {
      projectId,
      hasDeploymentState: !!deploymentState.deploymentStartTime,
      deploymentStatus: deploymentState.deploymentStatus,
      isAutoDeployment: autoDeploymentStatus.isAutoDeployment,
      coordinatorActive: consolidatedAutoRetryState.isActive,
      executionContext: executionContext.isAutoRetryExecution,
      hasAutoDeploymentContext: !!autoDeploymentContext,
      lastCacheCheck: lastCacheCheck,
      timeSinceCheck: lastCacheCheck ? Date.now() - lastCacheCheck : 'never'
    });
    
    // 🔧 FIX: CRITICAL - Check ref FIRST to prevent race conditions with state updates
    // If deployment has started (tracked by ref), NEVER clear state
    if (deploymentStartedRef.current) {
      log('STATE_PERSISTENCE', '⚠️ Deployment started (ref check) - skipping state restoration to avoid interference', {
        deploymentStartedRef: deploymentStartedRef.current,
        isDeploying: deploymentState.isDeploying,
        deploymentStatus: deploymentState.deploymentStatus,
        hasLogs: deploymentState.deploymentLogs.length > 0
      });
      return;
    }
    
    // 🆕 CRITICAL FIX: If there's a new autoDeploymentContext, clear cached state to allow new deployment
    // ENHANCED: Clear even if state is stuck in 'error' (not just 'idle')
    // BUT: Don't clear if deployment is actively in progress (prevents clearing active deployment)
    if (autoDeploymentContext && !executionContext.isAutoRetryExecution && !deploymentState.isDeploying) {
      // Check if state is stuck (error or not idle) or if this is a new context
      const isStuck = deploymentState.deploymentStatus !== 'idle' && 
                      deploymentState.deploymentStatus !== 'completed';
      const isNewContext = !deploymentState.deploymentStartTime || 
                          (autoDeploymentContext.timestamp > (deploymentState.deploymentStartTime || 0));
      
      if (isStuck || (isNewContext && deploymentState.deploymentStatus === 'idle')) {
        log('STATE_PERSISTENCE', '🧹 New deployment requested - clearing cached state to allow fresh deployment', {
          currentStatus: deploymentState.deploymentStatus,
          isStuck,
          isNewContext
        });
        
        // Reset deployment state to allow new deployment
        setDeploymentState(prev => ({
          ...prev,
          deploymentStatus: 'idle',
          deploymentProgress: 0,
          deploymentError: null,
          isDeploying: false,
          deploymentStartTime: null,
          deploymentDuration: null,
          deploymentLogs: [],
          retryAttempt: 0,
          isAutoRetrying: false
        }));
        
        // Clear cached deployment URL to prevent stale state
        clearCachedDeploymentUrl(projectId);
        
        // Don't restore from cache when new deployment is requested
        setLastCacheCheck(Date.now());
        return;
      }
    }
    
    // 🔧 FIX: If deployment is actively in progress, don't interfere with it
    if (deploymentState.isDeploying) {
      log('STATE_PERSISTENCE', '⚠️ Deployment actively in progress - skipping state restoration to avoid interference', {
        isDeploying: deploymentState.isDeploying,
        deploymentStatus: deploymentState.deploymentStatus,
        hasLogs: deploymentState.deploymentLogs.length > 0
      });
      return;
    }
    
    // Only restore from cache if not in auto-retry execution context
    if (!executionContext.shouldIgnoreCache) {
      const cached = getCachedDeployment(projectId);
      const history = getDeploymentHistory(projectId);
      
      if (cached) {
        setCachedDeployment(cached);
        
        if (!autoDeploymentStatus.isAutoDeployment && !consolidatedAutoRetryState.isActive && cached.sessionCache?.errorHandlerState) {
          const cachedErrorState = cached.sessionCache.errorHandlerState;
          const errorTimestamp = cachedErrorState.errorProcessingTimestamp || 0;
          const isRecentError = errorTimestamp && (Date.now() - errorTimestamp) < (5 * 60 * 1000);
          
          if (isRecentError) {
            log('STATE_PERSISTENCE', '🔧 Restoring recent error handler state from cache', {
              showFixButton: cachedErrorState.showFixButton,
              errorSummary: cachedErrorState.errorSummary ? 'present' : 'none',
              errorClassification: cachedErrorState.errorClassification,
              errorCategory: cachedErrorState.errorCategory,
              errorAge: Math.round((Date.now() - errorTimestamp) / 1000)
            });
            
            updateErrorHandlerState({
              showFixButton: cachedErrorState.showFixButton,
              errorSummary: cachedErrorState.errorSummary,
              lastErrorProcessingTime: errorTimestamp,
              isProcessingError: false,
              errorClassification: cachedErrorState.errorClassification || null,
              errorCategory: cachedErrorState.errorCategory || null
            });
          } else {
            log('STATE_PERSISTENCE', '⚠️ Cached error state is stale, not restoring');
          }
        }
        
        if (selectedServerPairId && projectServerPairsList.length > 0) {
          const cachedPair = projectServerPairsList.find(pair => pair.pairId === selectedServerPairId);
          if (cachedPair && (!deploymentState.selectedServerPair || deploymentState.selectedServerPair.pairId !== selectedServerPairId)) {
            setDeploymentState(prev => ({ ...prev, selectedServerPair: cachedPair }));
          }
        }
      }
      
      setDeploymentHistory(history);
    } else {
      log('EXECUTION_CONTEXT_ISOLATION', '⚠️ Skipping cache restoration due to auto-retry execution context');
    }
    
    const cacheAge = lastCacheCheck ? Date.now() - lastCacheCheck : Infinity;
    const CACHE_REFRESH_THRESHOLD = 30 * 60 * 1000; // Increased to 30 minutes to reduce redundant loading
    
    if (cacheAge > CACHE_REFRESH_THRESHOLD && userCanisterId && identity) {
      log('SERVER_PAIR_CACHE', '🔄 Cache is stale, refreshing server pairs...', {
        cacheAge: Math.round(cacheAge / 1000),
        threshold: CACHE_REFRESH_THRESHOLD / 1000
      });
      
      setTimeout(() => {
        loadServerPairs(false);
      }, 1000);
    }
  }, [isActive, projectId, projectServerPairs, autoDeploymentStatus.isAutoDeployment, consolidatedAutoRetryState.isActive, lastCacheCheck, userCanisterId, identity, loadServerPairs, updateErrorHandlerState, executionContext.shouldIgnoreCache]);

  // 🆕 CRITICAL FIX: Detect new deployment contexts and reset state if stuck
  useEffect(() => {
    if (!isActive || !projectId || !findDeploymentByProject) return;
    
    // Check for new 'ready' deployment context
    const deploymentInfo = findDeploymentByProject(projectId);
    
    if (deploymentInfo && deploymentInfo.state.status === 'ready') {
      // Check if current state is stuck (not idle and not actively deploying)
      const isStuck = (deploymentState.deploymentStatus !== 'idle' && 
                      !deploymentState.isDeploying && 
                      deploymentState.deploymentStatus !== 'completed');
      
      // Check if this is a new deployment context (different messageId or newer timestamp)
      const isNewContext = !deploymentState.deploymentStartTime || 
                          (deploymentInfo.context.timestamp > (deploymentState.deploymentStartTime || 0));
      
      if (isStuck && isNewContext && !executionContext.isAutoRetryExecution) {
        log('STATE_PERSISTENCE', '🔄 New ready deployment context detected - resetting stuck state', {
          currentStatus: deploymentState.deploymentStatus,
          isDeploying: deploymentState.isDeploying,
          newMessageId: deploymentInfo.messageId.substring(Math.max(0, deploymentInfo.messageId.length - 8)),
          newTimestamp: deploymentInfo.context.timestamp
        });
        
        // Reset deployment state to allow new deployment
        setDeploymentState(prev => ({
          ...prev,
          deploymentStatus: 'idle',
          deploymentProgress: 0,
          deploymentError: null,
          isDeploying: false,
          deploymentStartTime: null,
          deploymentDuration: null,
          deploymentLogs: [],
          retryAttempt: 0,
          isAutoRetrying: false
        }));
        
        // Clear cached deployment URL
        clearCachedDeploymentUrl(projectId);
      }
    }
  }, [isActive, projectId, findDeploymentByProject, deploymentState.deploymentStatus, deploymentState.isDeploying, deploymentState.deploymentStartTime, executionContext.isAutoRetryExecution, clearCachedDeploymentUrl]);

  // State persistence
  useEffect(() => {
    if (!deploymentState.deploymentStartTime) return;
    
    const isCriticalState = deploymentState.deploymentStatus === 'failed' || 
                           deploymentState.deploymentStatus === 'completed' ||
                           (!autoDeploymentStatus.isAutoDeployment && !consolidatedAutoRetryState.isActive && errorHandlerState.showFixButton) ||
                           deploymentState.deploymentError ||
                           deploymentState.isAutoRetrying ||
                           errorHandlerState.isProcessingError ||
                           consolidatedAutoRetryState.isActive;
    
    const delay = isCriticalState ? 0 : 2000;
    
    const timer = setTimeout(() => {
      const status = deploymentState.deploymentStatus === 'completed' ? 'success' : 
                     deploymentState.deploymentStatus === 'failed' ? 'failed' : 'in-progress';
      debouncedSaveToCache(status, isCriticalState);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [deploymentState.deploymentStatus, deploymentState.deploymentError, errorHandlerState.showFixButton, errorHandlerState.isProcessingError, autoDeploymentStatus.isAutoDeployment, consolidatedAutoRetryState.isActive, debouncedSaveToCache]);

  useEffect(() => {
    log('STATE_PERSISTENCE', '🔄 Loading cached deployment on mount...');
    
    const cached = getCachedDeployment(projectId);
    const history = getDeploymentHistory(projectId);
    
    setCachedDeployment(cached);
    setDeploymentHistory(history);
    
    log('STATE_PERSISTENCE', '✅ Cached state loading completed');
  }, [projectId]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 12000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 12000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Refresh server pairs
  const refreshServerPairs = useCallback(() => {
    log('SERVER_PAIR_CACHE', '🔄 Manual refresh triggered by user');
    loadServerPairs(true);
  }, [loadServerPairs]);

  // ==================== UI HELPER FUNCTIONS ====================
  
  const getStatusColor = () => {
    switch (deploymentState.deploymentStatus) {
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'idle': return 'var(--text-gray)';
      default: return 'var(--accent-orange)';
    }
  };

  const getStatusText = () => {
    const baseStatus = (() => {
      switch (deploymentState.deploymentStatus) {
        case 'idle': return 'Ready to deploy';
        case 'analyzing': return 'Analyzing generated files...';
        case 'compiling-backend': return 'Compiling Motoko code...';
        case 'deploying-backend': return 'Deploying to backend canister...';
        case 'bundling-frontend': return 'Bundling frontend assets...';
        case 'deploying-frontend': return 'Deploying to frontend canister...';
        case 'completed': return (autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) ? 'Auto-deployment successful!' : 'Deployment successful!';
        case 'failed': return 'Deployment failed';
        default: return 'Unknown status';
      }
    })();
    
    if (consolidatedAutoRetryState.isActive) {
      const attemptInfo = consolidatedAutoRetryState.displayExecutionCount !== '0/3' ? 
        ` (Auto-retry ${consolidatedAutoRetryState.displayExecutionCount})` : '';
      const sequentialInfo = consolidatedAutoRetryState.isSequentialError ? 
        ` [Sequential #${consolidatedAutoRetryState.sequentialErrorCount}]` : '';
      return `${baseStatus}${attemptInfo}${sequentialInfo}`;
    }
    
    return baseStatus;
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: isMobile ? '1rem' : isTablet ? '1.5rem' : '2rem',
      paddingBottom: isMobile 
        ? 'calc(120px + env(safe-area-inset-bottom, 20px))' 
        : (isTablet ? '2rem' : '2rem'),
      gap: isMobile ? '1rem' : '1.5rem',
      overflow: 'auto'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? '1rem' : '1.5rem'
      }}>
        <div style={{
          flex: '1',
          maxWidth: isMobile ? '100%' : '60%',
          minWidth: 0
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.5rem' : isTablet ? '1.7rem' : '1.8rem',
            fontWeight: '700',
            color: '#ffffff',
            margin: '0 0 0.5rem 0'
          }}>
            {(autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) ? '🚀 Auto-Deployment' : '🚀 One-Click Deployment'}
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <p style={{
              color: 'var(--text-gray)',
              margin: 0,
              fontSize: isMobile ? '0.9rem' : '0.95rem',
              lineHeight: 1.4
            }}>
              {(autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive)
                ? `Automatically deploying your AI-generated full-stack application to ${projectName} servers with advanced parallel processing`
                : `Deploy your AI-generated full-stack application to ${projectName} server pairs with advanced parallel processing`
              }
            </p>
            
            {/* Version Badge - Show what version will be deployed */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{
                fontSize: '0.85rem',
                color: 'var(--text-gray)',
                fontWeight: 500
              }}>
                Deploying:
              </span>
              <VersionBadge 
                versionString={versionString} 
                variant="default"
              />
            </div>
          </div>
          
          {/* Consolidated auto-retry status display */}
          {consolidatedAutoRetryState.isActive && (
            <div style={{
              marginTop: '0.5rem',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              padding: isMobile ? '0.75rem' : '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#8b5cf6',
                animation: deploymentState.isDeploying ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: isMobile ? '0.85rem' : '0.9rem',
                  fontWeight: '600',
                  color: '#8b5cf6',
                  marginBottom: '0.25rem'
                }}>
                  🤖 Auto-Retry Active - {consolidatedAutoRetryState.phase.replace('_', ' ').toLowerCase()}
                  {consolidatedAutoRetryState.displayExecutionCount !== '0/3' && (
                    <span style={{
                      marginLeft: '0.5rem',
                      background: 'rgba(255, 107, 53, 0.3)',
                      color: '#ff6b35',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {consolidatedAutoRetryState.displayExecutionCount}
                    </span>
                  )}
                  {consolidatedAutoRetryState.isSequentialError && (
                    <span style={{
                      marginLeft: '0.5rem',
                      background: 'rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      Sequential #{consolidatedAutoRetryState.sequentialErrorCount}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: isMobile ? '0.75rem' : '0.8rem',
                  color: 'var(--text-gray)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <span>Workflow: {consolidatedAutoRetryState.workflowId?.slice(-8) || 'Unknown'}</span>
                  {consolidatedAutoRetryState.elapsedTime && (
                    <span>Elapsed: {Math.floor(consolidatedAutoRetryState.elapsedTime / 1000)}s</span>
                  )}
                  {consolidatedAutoRetryState.hasError && (
                    <span style={{ color: '#ef4444' }}>Has Errors</span>
                  )}
                  <span style={{ color: '#10b981' }}>🚀 High-Performance Pipeline</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '0.75rem' : '1rem', 
          alignItems: 'stretch' 
        }}>
          <button
            onClick={refreshServerPairs}
            disabled={isLoading || consolidatedAutoRetryState.isActive}
            style={{
              background: isLoading ? 'rgba(255, 107, 53, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              padding: isMobile ? '0.875rem' : '0.75rem 1rem',
              borderRadius: '8px',
              cursor: (isLoading || consolidatedAutoRetryState.isActive) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontSize: isMobile ? '1rem' : '0.9rem',
              opacity: (isLoading || consolidatedAutoRetryState.isActive) ? 0.6 : 1,
              minHeight: '44px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {isLoading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Loading...
              </>
            ) : (
              <>
                🔄 Refresh
                {lastCacheCheck && (
                  <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                    ({Math.round((Date.now() - lastCacheCheck) / 60000)}m ago)
                  </span>
                )}
              </>
            )}
          </button>
          
          {(deploymentState.deploymentStatus !== 'idle' || cachedDeployment) && (
            <div style={{ position: 'relative', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => clearDeploymentState(false)}
                disabled={deploymentState.isDeploying || consolidatedAutoRetryState.isActive}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: isMobile ? '0.875rem 1rem' : '0.75rem 1rem',
                  borderRadius: '8px',
                  cursor: (deploymentState.isDeploying || consolidatedAutoRetryState.isActive) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: isMobile ? '1rem' : '0.9rem',
                  opacity: (deploymentState.isDeploying || consolidatedAutoRetryState.isActive) ? 0.6 : 1,
                  minHeight: '44px',
                  fontWeight: '500'
                }}
                title="Clear deployment state (keep server selection)"
              >
                🧹 Clear State
              </button>
              
              {!isMobile && (
                <button
                  onClick={() => clearDeploymentState(true)}
                  disabled={deploymentState.isDeploying || consolidatedAutoRetryState.isActive}
                  style={{
                    background: 'rgba(239, 68, 68, 0.3)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    cursor: (deploymentState.isDeploying || consolidatedAutoRetryState.isActive) ? 'not-allowed' : 'cursor',
                    transition: 'all 0.2s ease',
                    fontSize: '0.9rem',
                    opacity: (deploymentState.isDeploying || consolidatedAutoRetryState.isActive) ? 0.6 : 1,
                    minHeight: '44px',
                    fontWeight: '500'
                  }}
                  title="Clear all (including server selection)"
                >
                  🗑️
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {cachedDeployment && (cachedDeployment.status === 'success' || cachedDeployment.status === 'failed') && !deploymentState.isDeploying && (
        <div style={{
          background: cachedDeployment.status === 'success' 
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(185, 28, 28, 0.1))',
          border: cachedDeployment.status === 'success'
            ? '1px solid rgba(16, 185, 129, 0.3)'
            : '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: isMobile ? '1rem' : '1.2rem',
          marginBottom: '0.5rem'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'center',
            gap: '1rem',
            marginBottom: cachedDeployment.status === 'failed' || deploymentHistory.length > 1 ? '0.5rem' : '0'
          }}>
            <div>
              <div style={{
                fontSize: isMobile ? '0.9rem' : '1rem',
                fontWeight: '600',
                color: cachedDeployment.status === 'success' ? '#10b981' : '#ef4444',
                marginBottom: '0.25rem'
              }}>
                {cachedDeployment.status === 'success' ? '✅' : '❌'} Last Deployment: {formatTimeAgo(cachedDeployment.timestamp)}
              </div>
              <div style={{
                fontSize: isMobile ? '0.8rem' : '0.85rem',
                color: 'var(--text-gray)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                Server: {cachedDeployment.serverPairName}
                {cachedDeployment.duration && (
                  <span>• Duration: {(cachedDeployment.duration / 1000).toFixed(1)}s</span>
                )}
                {cachedDeployment.sessionCache?.coordinatorWorkflowState && (
                  <span>• Workflow: {cachedDeployment.sessionCache.coordinatorWorkflowState.phase}</span>
                )}
              </div>
            </div>
            {cachedDeployment.status === 'success' && cachedDeployment.frontendUrl && (
              <a 
                href={cachedDeployment.frontendUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  padding: isMobile ? '0.75rem 1rem' : '0.5rem 1rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: isMobile ? '0.9rem' : '0.85rem',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }}
              >
                🌐 View Live Site
              </a>
            )}
          </div>
          
          {cachedDeployment.status === 'failed' && cachedDeployment.error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '0.75rem',
              marginTop: '0.75rem'
            }}>
              <div style={{
                fontSize: '0.85rem',
                color: '#ef4444',
                fontWeight: '500',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                Deployment Error:
                {cachedDeployment.sessionCache?.errorHandlerState?.errorClassification && (
                  <span style={{
                    fontSize: '0.7rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px'
                  }}>
                    {cachedDeployment.sessionCache.errorHandlerState.errorClassification}
                  </span>
                )}
                {cachedDeployment.sessionCache?.errorHandlerState?.errorCategory && (
                  <span style={{
                    fontSize: '0.7rem',
                    background: 'rgba(255, 107, 53, 0.2)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    color: '#ff6b35'
                  }}>
                    {cachedDeployment.sessionCache.errorHandlerState.errorCategory}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-gray)',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
                maxHeight: '100px',
                overflowY: 'auto'
              }}>
                {cachedDeployment.error.substring(0, 500)}
                {cachedDeployment.error.length > 500 && '...'}
              </div>
            </div>
          )}
          
          {deploymentHistory.length > 1 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-gray)',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginTop: '0.75rem'
              }}
            >
              {showHistory ? '📋 Hide History' : `📋 Show History (${deploymentHistory.length - 1} more)`}
            </button>
          )}
        </div>
      )}

      {showHistory && deploymentHistory.length > 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: isMobile ? '1rem' : '1.2rem',
          marginBottom: '0.5rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              fontSize: isMobile ? '1rem' : '1.1rem',
              fontWeight: '600',
              color: '#ffffff',
              margin: 0
            }}>
              📋 Deployment History
            </h3>
            <button
              onClick={() => {
                clearProjectDeploymentCache(projectId);
                setCachedDeployment(null);
                setDeploymentHistory([]);
                setShowHistory(false);
              }}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              🗑️ Clear History
            </button>
          </div>
          
          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {deploymentHistory.map((entry, index) => (
              <div 
                key={`${entry.deploymentId}-${index}`}
                style={{
                  background: entry.status === 'success' 
                    ? 'rgba(16, 185, 129, 0.05)' 
                    : 'rgba(239, 68, 68, 0.05)',
                  border: `1px solid ${entry.status === 'success' 
                    ? 'rgba(16, 185, 129, 0.2)' 
                    : 'rgba(239, 68, 68, 0.2)'}`,
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '0.8rem'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{
                    color: entry.status === 'success' ? '#10b981' : '#ef4444',
                    fontWeight: '500'
                  }}>
                    {entry.status === 'success' ? '✅' : '❌'} {formatTimeAgo(entry.timestamp)}
                  </div>
                  <div style={{
                    color: 'var(--text-gray)',
                    fontSize: '0.75rem'
                  }}>
                    {entry.duration && `${(entry.duration / 1000).toFixed(1)}s`}
                  </div>
                </div>
                
                <div style={{ color: 'var(--text-gray)', fontSize: '0.75rem' }}>
                  Server: {entry.serverPairName || 'Unknown'}
                  {entry.sessionCache?.coordinatorWorkflowState && (
                    <span style={{ marginLeft: '0.5rem' }}>
                      • Workflow: {entry.sessionCache.coordinatorWorkflowState.phase}
                    </span>
                  )}
                  <span style={{ marginLeft: '0.5rem', color: '#10b981' }}>
                    • 🚀 High-Performance
                  </span>
                </div>
                
                {entry.status === 'success' && entry.frontendUrl && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <a 
                      href={entry.frontendUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#10b981',
                        textDecoration: 'none',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace'
                      }}
                    >
                      🌐 {entry.frontendUrl.replace('https://', '')}
                    </a>
                  </div>
                )}
                
                {entry.status === 'failed' && entry.error && (
                  <details style={{ marginTop: '0.5rem' }}>
                    <summary style={{
                      color: '#ef4444',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}>
                      View Error Details
                    </summary>
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                      color: '#ef4444',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {entry.sessionCache?.errorHandlerState?.errorClassification && (
                        <div style={{ marginBottom: '0.5rem', color: '#ff6b35' }}>
                          Classification: {entry.sessionCache.errorHandlerState.errorClassification}
                          {entry.sessionCache.errorHandlerState.errorCategory && 
                            ` (${entry.sessionCache.errorHandlerState.errorCategory})`
                          }
                        </div>
                      )}
                      {entry.error}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        background: hasRequiredFiles() 
          ? 'rgba(16, 185, 129, 0.1)' 
          : 'rgba(239, 68, 68, 0.1)',
        border: hasRequiredFiles() 
          ? '1px solid rgba(16, 185, 129, 0.3)' 
          : '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1rem 1.5rem',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? '0.5rem' : '1rem'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: isMobile ? '0.8rem' : '0.85rem', 
            color: 'var(--text-gray)', 
            marginBottom: '0.25rem' 
          }}>
            Generated Files Analysis
          </div>
          <div style={{ 
            fontSize: isMobile ? '1rem' : '1.1rem', 
            fontWeight: '600', 
            color: hasRequiredFiles() ? '#10b981' : '#ef4444' 
          }}>
            {hasRequiredFiles() ? '✅ Ready for Deployment' : '⚠️ Missing Required Files'}
          </div>
        </div>
        <div style={{ 
          fontSize: isMobile ? '0.8rem' : '0.85rem', 
          color: hasRequiredFiles() ? '#10b981' : '#ef4444',
          fontWeight: '500'
        }}>
          {(() => {
            if (!activeProject) return '0 files detected';
            
            const canisterFiles = projectFiles[activeProject] || {};
            const projectGenFiles = projectGeneratedFiles[activeProject] || {};
            const currentGeneratedFiles = generatedFiles || {};
            
            const allFiles = {
              ...canisterFiles,
              ...projectGenFiles,
              ...currentGeneratedFiles
            };
            
            return `${Object.keys(allFiles).length} files detected`;
          })()}
        </div>
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '1rem' : '1.5rem',
        overflow: 'hidden'
      }}>
        <h3 style={{
          fontSize: isMobile ? '1.1rem' : '1.2rem',
          fontWeight: '600',
          color: '#ffffff',
          marginBottom: '1rem'
        }}>
          {(autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) ? 'Auto-Selected Server Pair' : 'Select Server Pair for Deployment'}
        </h3>
        
        {isLoading ? (
          <div style={{
            textAlign: 'center',
            padding: isMobile ? '1.5rem' : '2rem',
            color: 'var(--text-gray)'
          }}>
            <div style={{
              width: isMobile ? '32px' : '40px',
              height: isMobile ? '32px' : '40px',
              border: '3px solid rgba(255, 107, 53, 0.3)',
              borderTop: '3px solid var(--accent-orange)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}></div>
            Loading server pairs...
            {lastCacheCheck && (
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                Last updated: {Math.round((Date.now() - lastCacheCheck) / 60000)} minutes ago
              </div>
            )}
          </div>
        ) : projectServerPairsList.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: isMobile ? '1.5rem' : '2rem',
            color: 'var(--text-gray)'
          }}>
            <div style={{ fontSize: isMobile ? '2rem' : '3rem', marginBottom: '1rem', opacity: 0.5 }}>
              🏗️
            </div>
            <p style={{ 
              fontSize: isMobile ? '0.9rem' : '1rem',
              lineHeight: 1.5,
              margin: '0 0 1rem 0'
            }}>
              No server pairs available. Create a server pair in the Hosting tab first.
            </p>
            {lastCacheCheck && (
              <button
                onClick={() => loadServerPairs(true)}
                style={{
                  background: 'rgba(255, 107, 53, 0.2)',
                  border: '1px solid var(--accent-orange)',
                  color: 'var(--accent-orange)',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                🔄 Refresh Now
              </button>
            )}
          </div>
        ) : (
          <>
            {lastCacheCheck && (
              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-gray)',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>⚡ Cached data • Last updated: {Math.round((Date.now() - lastCacheCheck) / 60000)}m ago</span>
                <button
                  onClick={() => loadServerPairs(true)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'var(--text-gray)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  🔄 Update
                </button>
              </div>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(auto-fill, minmax(300px, 1fr))' : 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: isMobile ? '0.75rem' : '1rem',
              padding: '0'
            }}>
            {projectServerPairsList.map((pair) => (
              <div
                key={pair.pairId}
                onClick={() => {
                  if (!autoDeploymentStatus.isAutoDeployment && !consolidatedAutoRetryState.isActive) {
                    setDeploymentState(prev => ({ ...prev, selectedServerPair: pair }));
                    // 🔥 UPDATED: Use centralized server pair state management
                    setServerPairId(pair.pairId);
                  }
                }}
                style={{
                  background: deploymentState.selectedServerPair?.pairId === pair.pairId 
                    ? 'rgba(255, 107, 53, 0.1)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  border: `2px solid ${deploymentState.selectedServerPair?.pairId === pair.pairId 
                    ? 'var(--accent-orange)' 
                    : 'transparent'}`,
                  borderRadius: '8px',
                  padding: isMobile ? '0.875rem' : '1rem',
                  cursor: (!autoDeploymentStatus.isAutoDeployment && !consolidatedAutoRetryState.isActive) ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                  maxWidth: '100%',
                  position: 'relative',
                  opacity: (autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) && deploymentState.selectedServerPair?.pairId !== pair.pairId ? 0.5 : 1
                }}
              >
                <h4 style={{
                  fontSize: isMobile ? '0.9rem' : '1rem',
                  fontWeight: '600',
                  color: '#ffffff',
                  marginBottom: '0.5rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  🏗️ {pair.name}
                  {(autoDeploymentStatus.isAutoDeployment || consolidatedAutoRetryState.isActive) && deploymentState.selectedServerPair?.pairId === pair.pairId && (
                    <span style={{
                      fontSize: '0.7rem',
                      marginLeft: '0.5rem',
                      background: 'rgba(139, 92, 246, 0.3)',
                      color: '#8b5cf6',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px'
                    }}>
                      AUTO
                    </span>
                  )}
                  {deploymentState.selectedServerPair?.pairId === pair.pairId && (
                    <span style={{
                      fontSize: '0.6rem',
                      marginLeft: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px'
                    }}>
                      🚀 HP
                    </span>
                  )}
                </h4>
                <div style={{
                  fontSize: isMobile ? '0.7rem' : '0.8rem',
                  color: 'var(--text-gray)',
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '0.25rem'
                }}>
                  <span>💰 {pair.creditsAllocated.toLocaleString()} credits</span>
                  <span>📅 {new Date(pair.createdAt).toLocaleDateString()}</span>
                </div>
                <div style={{
                  fontSize: isMobile ? '0.7rem' : '0.8rem',
                  color: 'var(--text-gray)',
                  lineHeight: 1.4
                }}>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.25rem'
                  }}>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}>
                      🎨 Frontend: {pair.frontendCanisterId.substring(0, isMobile ? 10 : 15)}...
                    </span>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await navigator.clipboard.writeText(pair.frontendCanisterId);
                        setCopyFeedback('Frontend Canister ID copied!');
                        setTimeout(() => setCopyFeedback(null), 2000);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.6rem',
                        color: 'var(--text-gray)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minHeight: 'auto'
                      }}
                      title={`Copy Frontend Canister ID: ${pair.frontendCanisterId}`}
                    >
                      📋
                    </button>
                  </div>
                  
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}>
                      ⚙️ Backend: {pair.backendCanisterId.substring(0, isMobile ? 10 : 15)}...
                    </span>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await navigator.clipboard.writeText(pair.backendCanisterId);
                        setCopyFeedback('Backend Canister ID copied!');
                        setTimeout(() => setCopyFeedback(null), 2000);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.6rem',
                        color: 'var(--text-gray)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minHeight: 'auto'
                      }}
                      title={`Copy Backend Canister ID: ${pair.backendCanisterId}`}
                    >
                      📋
                    </button>
                  </div>
                </div>
                
                {deploymentState.selectedServerPair?.pairId === pair.pairId && (
                  <div style={{
                    position: 'absolute',
                    top: isMobile ? '0.5rem' : '0.75rem',
                    right: isMobile ? '0.5rem' : '0.75rem',
                    width: '16px',
                    height: '16px',
                    background: 'var(--accent-orange)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6rem',
                    color: '#ffffff',
                    fontWeight: 'bold'
                  }}>
                    ✓
                  </div>
                )}
              </div>
            ))}
            </div>
          </>
        )}
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '1rem' : '1.5rem'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          marginBottom: '1rem',
          gap: isMobile ? '0.5rem' : '1rem'
        }}>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.2rem',
            fontWeight: '600',
            color: '#ffffff',
            margin: 0
          }}>
            Deployment Status
          </h3>
          <div style={{
            fontSize: isMobile ? '0.85rem' : '0.9rem',
            color: getStatusColor(),
            fontWeight: '600'
          }}>
            {getStatusText()}
          </div>
        </div>

        {/* 🔧 FIX: Show progress bar if deploying OR if progress > 0 (handles state update timing) */}
        {(deploymentState.isDeploying || deploymentState.deploymentProgress > 0) && deploymentState.deploymentStatus !== 'idle' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: isMobile ? '0.75rem' : '0.5rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              height: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                // 🔧 FIX: Show at least 1% when deploying or if progress > 0 (handles state timing)
                width: `${Math.max(deploymentState.deploymentProgress, (deploymentState.isDeploying || deploymentState.deploymentProgress > 0) ? 1 : 0)}%`,
                transition: 'width 0.3s ease',
                // 🔧 FIX: Ensure visibility even at 0% if deployment is active
                minWidth: (deploymentState.isDeploying || deploymentState.deploymentProgress > 0) && deploymentState.deploymentProgress === 0 ? '1%' : '0%'
              }} />
            </div>
            <div style={{
              fontSize: isMobile ? '0.75rem' : '0.8rem',
              color: 'var(--text-gray)',
              marginTop: '0.25rem',
              textAlign: 'center'
            }}>
              {deploymentState.deploymentProgress}% complete with high-performance pipeline
              {consolidatedAutoRetryState.isActive && consolidatedAutoRetryState.displayExecutionCount !== '0/3' && (
                <span style={{ marginLeft: '0.5rem', color: '#8b5cf6' }}>
                  (Auto-retry {consolidatedAutoRetryState.displayExecutionCount})
                  {consolidatedAutoRetryState.isSequentialError && ` [Sequential #${consolidatedAutoRetryState.sequentialErrorCount}]`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Simplified error display for manual mode only */}
        {errorHandlerState.showFixButton && !consolidatedAutoRetryState.isActive && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: isMobile ? '1rem' : '1.2rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: isMobile ? '1rem' : '1.5rem'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: isMobile ? '0.9rem' : '1rem',
                  fontWeight: '600',
                  color: '#ef4444',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  🔧 Compilation Errors Detected
                  {errorHandlerState.isProcessingError && (
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid rgba(239, 68, 68, 0.3)',
                      borderTopColor: '#ef4444',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  )}
                  {errorHandlerState.errorClassification && (
                    <span style={{
                      fontSize: '0.7rem',
                      background: 'rgba(255, 107, 53, 0.3)',
                      color: '#ff6b35',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      {errorHandlerState.errorClassification}
                    </span>
                  )}
                  {errorHandlerState.errorCategory && (
                    <span style={{
                      fontSize: '0.7rem',
                      background: 'rgba(139, 92, 246, 0.3)',
                      color: '#8b5cf6',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      {errorHandlerState.errorCategory}
                    </span>
                  )}
                </div>
                {errorHandlerState.errorSummary && (
                  <div style={{
                    fontSize: isMobile ? '0.8rem' : '0.85rem',
                    color: '#ffffff',
                    marginBottom: '0.5rem'
                  }}>
                    {errorHandlerState.errorSummary}
                  </div>
                )}
                <div style={{
                  fontSize: isMobile ? '0.75rem' : '0.8rem',
                  color: 'var(--text-gray)',
                  lineHeight: 1.4
                }}>
                  These errors appear to be fixable by AI assistance. Click the button to get help with the specific issues.
                  {errorHandlerState.blockingErrorsCount > 0 && (
                    <span style={{ display: 'block', marginTop: '0.25rem', color: '#ef4444', fontWeight: '500' }}>
                      {errorHandlerState.blockingErrorsCount} blocking error{errorHandlerState.blockingErrorsCount > 1 ? 's' : ''}
                      {errorHandlerState.warningsCount > 0 && ` • ${errorHandlerState.warningsCount} warning${errorHandlerState.warningsCount > 1 ? 's' : ''}`}
                    </span>
                  )}
                  {errorHandlerState.lastErrorProcessingTime && (
                    <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.7rem', opacity: 0.7 }}>
                      Processing completed {Math.round((Date.now() - errorHandlerState.lastErrorProcessingTime) / 1000)}s ago
                    </span>
                  )}
                </div>
              </div>
              
              {!errorHandlerState.isProcessingError && (
                <button
                  onClick={handleFixButtonClick}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#ffffff',
                    padding: isMobile ? '1rem' : '0.875rem 1.5rem',
                    fontSize: isMobile ? '0.9rem' : '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  🔧 Fix These Errors
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error display for auto-retry mode */}
        {consolidatedAutoRetryState.isActive && consolidatedAutoRetryState.hasError && (
          <div style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '12px',
            padding: isMobile ? '1rem' : '1.2rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(139, 92, 246, 0.3)',
                borderTop: '2px solid #8b5cf6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: isMobile ? '0.9rem' : '1rem',
                  fontWeight: '600',
                  color: '#8b5cf6',
                  marginBottom: '0.25rem'
                }}>
                  🤖 Auto-Retry System Active - {consolidatedAutoRetryState.phase.replace('_', ' ').toLowerCase()}
                  {consolidatedAutoRetryState.displayExecutionCount !== '0/3' && (
                    <span style={{ 
                      fontSize: '0.8rem', 
                      marginLeft: '0.5rem',
                      color: 'var(--text-gray)' 
                    }}>
                      ({consolidatedAutoRetryState.displayExecutionCount})
                    </span>
                  )}
                  {consolidatedAutoRetryState.isSequentialError && (
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.8rem',
                      background: 'rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px'
                    }}>
                      Sequential #{consolidatedAutoRetryState.sequentialErrorCount}
                    </span>
                  )}
                  {consolidatedAutoRetryState.elapsedTime && (
                    <span style={{ 
                      fontSize: '0.8rem', 
                      marginLeft: '0.5rem',
                      color: 'var(--text-gray)' 
                    }}>
                      ({Math.floor(consolidatedAutoRetryState.elapsedTime / 1000)}s)
                    </span>
                  )}
                  <span style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.7rem',
                    background: 'rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    padding: '0.2rem 0.4rem',
                    borderRadius: '4px'
                  }}>
                    🚀 HP
                  </span>
                </div>
                {consolidatedAutoRetryState.errorSummary && (
                  <div style={{
                    fontSize: isMobile ? '0.8rem' : '0.85rem',
                    color: '#ffffff',
                    marginBottom: '0.5rem'
                  }}>
                    {consolidatedAutoRetryState.errorSummary.substring(0, 200)}...
                    {consolidatedAutoRetryState.errorClassification && (
                      <span style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.7rem',
                        background: 'rgba(255, 107, 53, 0.3)',
                        color: '#ff6b35',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px'
                      }}>
                        {consolidatedAutoRetryState.errorClassification}
                      </span>
                    )}
                  </div>
                )}
                <div style={{
                  fontSize: isMobile ? '0.75rem' : '0.8rem',
                  color: 'var(--text-gray)',
                  lineHeight: 1.4
                }}>
                  AI is automatically analyzing and fixing errors with high-performance deployment pipeline. The system will continue retrying until success.
                </div>
              </div>
            </div>
          </div>
        )}

        {deploymentState.deploymentError && !consolidatedAutoRetryState.isActive && !errorHandlerState.showFixButton && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: isMobile ? '0.875rem' : '1rem',
            marginBottom: '1rem',
            color: '#ef4444',
            fontSize: isMobile ? '0.85rem' : '0.9rem',
            lineHeight: 1.4
          }}>
            {deploymentState.deploymentError}
          </div>
        )}

        <div 
          ref={logsContainerRef}
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            padding: isMobile ? '0.875rem' : '1rem',
            maxHeight: isMobile ? '200px' : '300px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: isMobile ? '0.75rem' : '0.8rem'
          }}>
          {deploymentState.deploymentLogs.length === 0 ? (
            <div style={{ color: 'var(--text-gray)' }}>
              High-performance deployment logs will appear here...
            </div>
          ) : (
            deploymentState.deploymentLogs.map((log, index) => (
              <div key={index} style={{
                color: '#ffffff',
                marginBottom: '0.25rem',
                lineHeight: 1.4,
                wordBreak: 'break-word'
              }}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {error && !consolidatedAutoRetryState.isActive && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: isMobile ? '0.875rem' : '1rem',
          color: '#ef4444',
          fontSize: isMobile ? '0.85rem' : '0.9rem',
          lineHeight: 1.4
        }}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          padding: isMobile ? '0.875rem' : '1rem',
          color: '#10b981',
          fontSize: isMobile ? '0.85rem' : '0.9rem',
          lineHeight: 1.4
        }}>
          ✅ {success}
        </div>
      )}

      {!autoDeploymentStatus.isAutoDeployment && !consolidatedAutoRetryState.isActive && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: isMobile ? '0.5rem' : '1rem',
          marginBottom: isMobile ? '2rem' : '0'
        }}>
          <button
            onClick={executeDeployment}
            disabled={!deploymentState.selectedServerPair || deploymentState.isDeploying || !hasRequiredFiles()}
            style={{
              background: (!deploymentState.selectedServerPair || deploymentState.isDeploying || !hasRequiredFiles())
                ? 'rgba(255, 107, 53, 0.3)'
                : 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
              border: 'none',
              color: '#ffffff',
              padding: isMobile ? '1rem' : '1rem 2rem',
              borderRadius: '12px',
              fontSize: isMobile ? '1rem' : '1.1rem',
              fontWeight: '600',
              cursor: (!deploymentState.selectedServerPair || deploymentState.isDeploying || !hasRequiredFiles()) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: (!deploymentState.selectedServerPair || deploymentState.isDeploying || !hasRequiredFiles()) ? 0.6 : 1,
              minWidth: isMobile ? '100%' : '200px',
              maxWidth: isMobile ? '100%' : 'auto',
              boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)',
              minHeight: '44px'
            }}
          >
            {deploymentState.isDeploying ? '🚀 Deploying...' : isMobile ? '🚀 Deploy' : '🚀 Deploy Full Stack'}
          </button>
        </div>
      )}

      {deploymentState.deployedFrontendUrl && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: isMobile ? '1.5rem' : '2rem',
          textAlign: 'center',
          marginBottom: isMobile ? '2rem' : '0'
        }}>
          <h3 style={{
            fontSize: isMobile ? '1.2rem' : '1.4rem',
            fontWeight: '700',
            color: '#10b981',
            marginBottom: '1rem'
          }}>
            🎉 {(() => {
              if (consolidatedAutoRetryState.isActive && consolidatedAutoRetryState.executionCount > 0) {
                const sequentialText = consolidatedAutoRetryState.isSequentialError ? ` (resolved sequential error #${consolidatedAutoRetryState.sequentialErrorCount})` : '';
                return `Auto-Retry Successful After ${consolidatedAutoRetryState.displayExecutionCount} Attempt${consolidatedAutoRetryState.executionCount > 1 ? 's' : ''}${sequentialText}!`;
              }
              return autoDeploymentStatus.isAutoDeployment ? 'Auto-Deployment Successful!' : 'Deployment Successful!';
            })()}
          </h3>
          
          <p style={{
            color: 'var(--text-gray)',
            marginBottom: '1.5rem',
            fontSize: isMobile ? '0.9rem' : '1rem',
            lineHeight: 1.5
          }}>
            Your full-stack application is now live with high-performance benefits including parallel processing and maximum throughput!
          </p>
          
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '0.75rem' : '0.5rem',
            marginBottom: '1.5rem',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <input 
              type="text" 
              value={deploymentState.deployedFrontendUrl} 
              readOnly 
              style={{
                flex: 1,
                maxWidth: isMobile ? '100%' : '400px',
                padding: isMobile ? '0.875rem' : '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#ffffff',
                fontSize: isMobile ? '0.85rem' : '0.9rem',
                fontFamily: 'monospace',
                minHeight: '44px'
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={async () => {
                  await navigator.clipboard.writeText(deploymentState.deployedFrontendUrl || '');
                  setCopyFeedback('Frontend URL copied!');
                  setTimeout(() => setCopyFeedback(null), 2000);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  padding: isMobile ? '0.875rem 1rem' : '0.75rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: isMobile ? '0.9rem' : '0.9rem',
                  fontWeight: '500',
                  minHeight: '44px',
                  whiteSpace: 'nowrap'
                }}
                title="Copy Frontend URL"
              >
                📋 Copy URL
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <a 
              href={deploymentState.deployedFrontendUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                padding: isMobile ? '1rem 1.5rem' : '1rem 2rem',
                borderRadius: '12px',
                textDecoration: 'none',
                fontSize: isMobile ? '1rem' : '1.1rem',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                minHeight: '44px',
                width: isMobile ? '100%' : 'auto',
                maxWidth: isMobile ? '300px' : 'auto',
                textAlign: 'center'
              }}
            >
              🌐 View Live Site
            </a>
            
            {deploymentState.deploymentDuration !== null && (
              <div style={{
                fontSize: isMobile ? '0.75rem' : '0.8rem',
                color: 'var(--text-gray)',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {(() => {
                  if (consolidatedAutoRetryState.isActive && consolidatedAutoRetryState.executionCount > 0) {
                    const sequentialText = consolidatedAutoRetryState.isSequentialError ? ` (resolved sequential error #${consolidatedAutoRetryState.sequentialErrorCount})` : '';
                    return `High-performance auto-retry completed in ${(deploymentState.deploymentDuration / 1000).toFixed(1)}s (${consolidatedAutoRetryState.displayExecutionCount} attempts)${sequentialText}`;
                  }
                  return autoDeploymentStatus.isAutoDeployment 
                    ? `High-performance auto-deployment completed in ${(deploymentState.deploymentDuration / 1000).toFixed(1)}s`
                    : `High-performance deployment completed in ${(deploymentState.deploymentDuration / 1000).toFixed(1)}s`;
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {copyFeedback && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          background: 'rgba(16, 185, 129, 0.9)',
          color: '#ffffff',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontSize: '0.9rem',
          fontWeight: '500',
          zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          ✅ {copyFeedback}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};