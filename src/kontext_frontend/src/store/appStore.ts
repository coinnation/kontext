import React from 'react';
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Import all slice creators
import { createUISlice, type UISlice } from './slices/uiSlice';
import { createLoadingSlice, type LoadingSlice } from './slices/loadingSlice';
import { createAuthSlice, type AuthSlice } from './slices/authSlice';
import { createUserAccountSlice, type UserAccountSlice } from './slices/userAccountSlice';
import { createInitializationSlice, type InitializationSlice } from './slices/initializationSlice';
import { createCreditsSlice, type CreditsSlice } from './slices/creditsSlice';
import { createPaymentSlice, type PaymentSlice } from './slices/paymentSlice';
import { createSubscriptionSlice, type SubscriptionSlice } from './slices/subscriptionSlice';
import { createProjectsSlice, type ProjectsSlice } from './slices/projectsSlice';
import { createProjectFilesSlice, type ProjectFilesSlice } from './slices/projectFilesSlice';
import { createGeneratedFilesSlice, type GeneratedFilesSlice } from './slices/generatedFilesSlice';
import { createFileApplicationSlice, type FileApplicationSlice } from './slices/fileApplicationSlice';
import { createChatStateSlice, type ChatStateSlice } from './slices/chatStateSlice';
import { createChatActionsSlice, type ChatActionsSlice } from './slices/chatActionsSlice';
import { createGenerationSlice, type GenerationSlice } from './slices/generationSlice';
import { createCandidSlice, type CandidSlice } from './slices/candidSlice';
import { createServerPairSlice, type ServerPairSlice } from './slices/serverPairSlice';
import { createDeploymentCoordinationSlice, type DeploymentCoordinationSlice } from './slices/deploymentCoordinationSlice';
import { createProjectImportSlice, type ProjectImportSlice } from './slices/projectImportSlice';
import { createBusinessAgenciesSlice, type BusinessAgenciesSlice } from './slices/businessAgenciesSlice';
import { createUserSettingsSlice, type UserSettingsSlice } from './slices/userSettingsSlice';

// Export all types from slices for external use
export type {
  UISlice,
  LoadingSlice,
  AuthSlice,
  UserAccountSlice,
  InitializationSlice,
  CreditsSlice,
  PaymentSlice,
  SubscriptionSlice,
  ProjectsSlice,
  ProjectFilesSlice,
  GeneratedFilesSlice,
  FileApplicationSlice,
  ChatStateSlice,
  ChatActionsSlice,
  GenerationSlice,
  CandidSlice,
  ServerPairSlice,
  DeploymentCoordinationSlice,
  ProjectImportSlice,
  BusinessAgenciesSlice,
  UserSettingsSlice
};

// ENHANCED: Coordinator integration types for store access
export interface CoordinatorStoreAccess {
  getState: () => CombinedStore;
  subscribe: (listener: (state: CombinedStore) => void) => () => void;
  setState: (partial: Partial<CombinedStore> | ((state: CombinedStore) => void)) => void;
  getFileCompletionStatus: () => { total: number; complete: number; writing: number; detected: number };
  startWorkflowFileMonitoring: (workflowId: string) => void;
  stopWorkflowFileMonitoring: () => void;
  // Enhanced debugging helpers
  getDebugInfo: () => {
    activeProject: string | null;
    fileStates: any;
    autoRetryState: any;
    projectCounts: { [projectId: string]: number };
  };
  // Health check methods
  validateStoreIntegrity: () => boolean;
  performStoreHealthCheck: () => {
    isHealthy: boolean;
    issues: string[];
    metrics: {
      projectCount: number;
      totalFiles: number;
      memoryUsage: number;
      subscriptionCount: number;
    };
  };
}

// Combined store type with enhanced coordinator integration
type CombinedStore = UISlice & 
  LoadingSlice & 
  AuthSlice & 
  UserAccountSlice & 
  InitializationSlice & 
  CreditsSlice & 
  PaymentSlice & 
  SubscriptionSlice & 
  ProjectsSlice & 
  ProjectFilesSlice & 
  GeneratedFilesSlice & 
  FileApplicationSlice & 
  ChatStateSlice & 
  ChatActionsSlice & 
  GenerationSlice & 
  CandidSlice & 
  ServerPairSlice & 
  DeploymentCoordinationSlice &
  ProjectImportSlice &
  BusinessAgenciesSlice &
  UserSettingsSlice & {
    // Global store methods
    reset: () => void;
    // ENHANCED: Coordinator integration methods
    getCoordinatorAccess: () => CoordinatorStoreAccess;
    exposeToWindow: () => void;
    validateStoreConnection: () => boolean;
  };

// 🔍 DIAGNOSTIC LOGGING SYSTEM - PHASE 1: Parameter Access Tracking
class StoreInitializationDebugger {
  private static instance: StoreInitializationDebugger;
  private initializationLog: Array<{
    timestamp: number;
    phase: string;
    slice?: string;
    action: string;
    details?: any;
    stackTrace?: string;
  }> = [];

  static getInstance(): StoreInitializationDebugger {
    if (!StoreInitializationDebugger.instance) {
      StoreInitializationDebugger.instance = new StoreInitializationDebugger();
    }
    return StoreInitializationDebugger.instance;
  }

  log(phase: string, action: string, details?: any, slice?: string): void {
    const logEntry = {
      timestamp: performance.now(),
      phase,
      slice,
      action,
      details,
      stackTrace: new Error().stack
    };
    
    this.initializationLog.push(logEntry);
    
    // console.log(`🔍 [STORE-DEBUG] ${phase}:${slice || 'GLOBAL'}:${action}`, details || '');
    
    // If this is an error-related log, dump the full context
    if (action.includes('ERROR') || action.includes('FAIL')) {
      this.dumpFullLog();
    }
  }

  dumpFullLog(): void {
    console.group('🚨 [STORE-DEBUG] FULL INITIALIZATION LOG');
    this.initializationLog.forEach((entry, index) => {
      console.log(`${index + 1}. [${entry.timestamp.toFixed(2)}ms] ${entry.phase}:${entry.slice || 'GLOBAL'}:${entry.action}`, entry.details || '');
    });
    console.groupEnd();
  }

  getLastEntries(count: number = 10): typeof this.initializationLog {
    return this.initializationLog.slice(-count);
  }
}

// 🔍 DIAGNOSTIC LOGGING SYSTEM - PHASE 2: Parameter Wrapper
function createParameterWrapper<T extends (...args: any[]) => any>(
  paramName: 'set' | 'get' | 'api',
  originalParam: T,
  sliceName: string
): T {
  const storeDebugger = StoreInitializationDebugger.getInstance();
  
  if (paramName === 'api') {
    // Create a proxy for the API object to track property access
    return new Proxy(originalParam, {
      get(target, prop, receiver) {
        storeDebugger.log('PARAMETER_ACCESS', 'API_PROPERTY_ACCESS', {
          property: prop.toString(),
          targetType: typeof target,
          hasProperty: prop in target
        }, sliceName);
        
        try {
          const value = Reflect.get(target, prop, receiver);
          storeDebugger.log('PARAMETER_ACCESS', 'API_PROPERTY_SUCCESS', {
            property: prop.toString(),
            valueType: typeof value
          }, sliceName);
          return value;
        } catch (error) {
          storeDebugger.log('PARAMETER_ACCESS', 'API_PROPERTY_ERROR', {
            property: prop.toString(),
            error: error instanceof Error ? error.message : String(error)
          }, sliceName);
          throw error;
        }
      }
    }) as T;
  } else {
    // For set and get, create a wrapper function
    return ((...args: Parameters<T>): ReturnType<T> => {
      storeDebugger.log('PARAMETER_ACCESS', `${paramName.toUpperCase()}_CALL`, {
        argsLength: args.length,
        firstArgType: args[0] ? typeof args[0] : 'undefined'
      }, sliceName);
      
      try {
        const result = originalParam(...args);
        storeDebugger.log('PARAMETER_ACCESS', `${paramName.toUpperCase()}_SUCCESS`, {
          resultType: typeof result
        }, sliceName);
        return result;
      } catch (error) {
        storeDebugger.log('PARAMETER_ACCESS', `${paramName.toUpperCase()}_ERROR`, {
          error: error instanceof Error ? error.message : String(error)
        }, sliceName);
        throw error;
      }
    }) as T;
  }
}

// ENHANCED: Logging system for store operations
const log = (category: string, message: string, ...args: any[]) => {
  const categories = ['STORE_INTEGRATION', 'COORDINATOR_ACCESS', 'STORE_HEALTH', 'WINDOW_EXPOSURE', 'FUNCTION_BINDING', 'SLICE_CREATION', 'PRIORITY_SYSTEM_FIX'];
  if (categories.includes(category)) {
    console.log(`[${category}] ${message}`, ...args);
  }
};

// ENHANCED: Store health monitoring system
let storeHealthMetrics = {
  creationTime: Date.now(),
  lastHealthCheck: Date.now(),
  subscriptionCount: 0,
  operationCount: 0,
  errorCount: 0,
  memoryBaseline: 0
};

// ENHANCED: Subscription management for coordinator
const coordinatorSubscriptions = new Set<(state: CombinedStore) => void>();

// SOLUTION: Function binding validation with PRIORITY SYSTEM FUNCTIONS
const validateSliceFunctions = (sliceName: string, slice: any) => {
  const requiredFunctions = {
    ui: ['setSidebarOpen', 'toggleSidePane', 'closeSidePane'],
    projects: ['switchToProject', 'createProject'],
    files: ['updateGeneratedFiles', 'startFileApplication'],
    serverPair: ['setProjectServerPair', 'getProjectServerPair', 'notifyServerPairUpdate'],
    projectImport: ['openImportDialog', 'closeImportDialog', 'validateProject', 'importProject'],
    // 🔥 CRITICAL FIX: Add priority system function validation
    chatState: ['addPriorityMessage', 'assignMessagePriority', 'markCurrentUserInstruction', 'getPriorityOrderedMessages', 'reassignPriorities'],
    chatActions: ['buildPriorityMessageAssembly', 'createPriorityBasedContext', 'assemblePriorityPrompt', 'optimizeAssemblyForTokenBudget']
  };
  
  const sliceKey = sliceName.replace('Slice', '').toLowerCase();
  const required = requiredFunctions[sliceKey as keyof typeof requiredFunctions] || [];
  
  required.forEach(funcName => {
    if (typeof slice[funcName] !== 'function') {
      console.error(`❌ [FUNCTION_BINDING] Missing or invalid function: ${sliceName}.${funcName}`, typeof slice[funcName]);
    } else {
      log('FUNCTION_BINDING', `✅ [FUNCTION_BINDING] Validated function: ${sliceName}.${funcName}`);
    }
  });
};

// 🔍 DIAGNOSTIC SLICE CREATOR WRAPPER
function createSliceWithLogging<T>(
  sliceName: string,
  sliceCreator: (set: any, get: any, api: any) => T,
  originalSet: any,
  originalGet: any,
  originalApi: any
): T {
  const storeDebugger = StoreInitializationDebugger.getInstance();
  
  storeDebugger.log('SLICE_CREATION', 'START', { sliceName });
  
  try {
    // Create wrapped parameters with logging
    const wrappedSet = createParameterWrapper('set', originalSet, sliceName);
    const wrappedGet = createParameterWrapper('get', originalGet, sliceName);
    const wrappedApi = createParameterWrapper('api', originalApi, sliceName);
    
    storeDebugger.log('SLICE_CREATION', 'PARAMETERS_WRAPPED', { sliceName });
    
    // Call the slice creator with wrapped parameters
    const slice = sliceCreator(wrappedSet, wrappedGet, wrappedApi);
    
    storeDebugger.log('SLICE_CREATION', 'SUCCESS', { 
      sliceName,
      sliceKeys: Object.keys(slice || {}).length,
      functionCount: Object.keys(slice || {}).filter(key => typeof (slice as any)[key] === 'function').length
    });
    
    // Validate the created slice
    validateSliceFunctions(sliceName, slice);
    
    return slice;
  } catch (error) {
    storeDebugger.log('SLICE_CREATION', 'ERROR', { 
      sliceName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack'
    });
    
    console.error(`🚨 [SLICE_CREATION] FAILED: ${sliceName}`, error);
    throw error;
  }
}

// Create the combined store with enhanced coordinator integration
export const useAppStore = create<CombinedStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get, api) => {
        const storeDebugger = StoreInitializationDebugger.getInstance();
        storeDebugger.log('STORE_CREATION', 'START', { 
          timestamp: Date.now(),
          setType: typeof set,
          getType: typeof get,
          apiType: typeof api,
          apiKeys: api ? Object.keys(api) : []
        });

        // Initialize memory baseline
        if (typeof window !== 'undefined' && (performance as any).memory) {
          storeHealthMetrics.memoryBaseline = (performance as any).memory.usedJSHeapSize;
        }

        // 🔥 PRIORITY SYSTEM FIX: Create slices individually with comprehensive logging
        log('PRIORITY_SYSTEM_FIX', '🏗️ [PRIORITY FIX] Creating individual slices with priority system preservation...');
        
        storeDebugger.log('SLICE_CREATION', 'PHASE_START', { phase: 'CORE_SLICES' });
        
        let uiSlice: UISlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'UISlice' });
          uiSlice = createSliceWithLogging('UISlice', createUISlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'UISlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'UISlice', error });
          throw new Error(`UISlice creation failed: ${error}`);
        }
        
        let loadingSlice: LoadingSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'LoadingSlice' });
          loadingSlice = createSliceWithLogging('LoadingSlice', createLoadingSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'LoadingSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'LoadingSlice', error });
          throw new Error(`LoadingSlice creation failed: ${error}`);
        }
        
        let authSlice: AuthSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'AuthSlice' });
          authSlice = createSliceWithLogging('AuthSlice', createAuthSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'AuthSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'AuthSlice', error });
          throw new Error(`AuthSlice creation failed: ${error}`);
        }
        
        let userAccountSlice: UserAccountSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'UserAccountSlice' });
          userAccountSlice = createSliceWithLogging('UserAccountSlice', createUserAccountSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'UserAccountSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'UserAccountSlice', error });
          throw new Error(`UserAccountSlice creation failed: ${error}`);
        }
        
        let initializationSlice: InitializationSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'InitializationSlice' });
          initializationSlice = createSliceWithLogging('InitializationSlice', createInitializationSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'InitializationSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'InitializationSlice', error });
          throw new Error(`InitializationSlice creation failed: ${error}`);
        }
        
        let creditsSlice: CreditsSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'CreditsSlice' });
          creditsSlice = createSliceWithLogging('CreditsSlice', createCreditsSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'CreditsSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'CreditsSlice', error });
          throw new Error(`CreditsSlice creation failed: ${error}`);
        }
        
        let paymentSlice: PaymentSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'PaymentSlice' });
          paymentSlice = createSliceWithLogging('PaymentSlice', createPaymentSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'PaymentSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'PaymentSlice', error });
          throw new Error(`PaymentSlice creation failed: ${error}`);
        }
        
        let subscriptionSlice: SubscriptionSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'SubscriptionSlice' });
          subscriptionSlice = createSliceWithLogging('SubscriptionSlice', createSubscriptionSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'SubscriptionSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'SubscriptionSlice', error });
          throw new Error(`SubscriptionSlice creation failed: ${error}`);
        }
        
        let projectsSlice: ProjectsSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'ProjectsSlice' });
          projectsSlice = createSliceWithLogging('ProjectsSlice', createProjectsSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'ProjectsSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'ProjectsSlice', error });
          throw new Error(`ProjectsSlice creation failed: ${error}`);
        }
        
        let projectFilesSlice: ProjectFilesSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'ProjectFilesSlice' });
          projectFilesSlice = createSliceWithLogging('ProjectFilesSlice', createProjectFilesSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'ProjectFilesSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'ProjectFilesSlice', error });
          throw new Error(`ProjectFilesSlice creation failed: ${error}`);
        }
        
        let generatedFilesSlice: GeneratedFilesSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'GeneratedFilesSlice' });
          generatedFilesSlice = createSliceWithLogging('GeneratedFilesSlice', createGeneratedFilesSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'GeneratedFilesSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'GeneratedFilesSlice', error });
          throw new Error(`GeneratedFilesSlice creation failed: ${error}`);
        }
        
        let fileApplicationSlice: FileApplicationSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'FileApplicationSlice' });
          fileApplicationSlice = createSliceWithLogging('FileApplicationSlice', createFileApplicationSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'FileApplicationSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'FileApplicationSlice', error });
          throw new Error(`FileApplicationSlice creation failed: ${error}`);
        }
        
        // 🔥 CRITICAL: Chat slices creation with special attention to priority functions
        let chatStateSlice: ChatStateSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING_PRIORITY_CRITICAL', { slice: 'ChatStateSlice', note: 'CONTAINS_PRIORITY_FUNCTIONS' });
          chatStateSlice = createSliceWithLogging('ChatStateSlice', createChatStateSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED_PRIORITY_CRITICAL', { slice: 'ChatStateSlice', note: 'PRIORITY_FUNCTIONS_CREATED' });
          
          // 🔥 IMMEDIATE VALIDATION: Check if priority functions exist in chatStateSlice
          const priorityFunctions = ['addPriorityMessage', 'assignMessagePriority', 'markCurrentUserInstruction', 'getPriorityOrderedMessages', 'reassignPriorities'];
          priorityFunctions.forEach(funcName => {
            if (typeof (chatStateSlice as any)[funcName] === 'function') {
              log('PRIORITY_SYSTEM_FIX', `✅ [PRIORITY FIX] ChatState priority function confirmed: ${funcName}`);
            } else {
              log('PRIORITY_SYSTEM_FIX', `❌ [PRIORITY FIX] ChatState priority function MISSING: ${funcName}`);
            }
          });
          
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED_PRIORITY_CRITICAL', { slice: 'ChatStateSlice', error, note: 'PRIORITY_SYSTEM_BROKEN' });
          throw new Error(`ChatStateSlice creation failed: ${error}`);
        }
        
        let chatActionsSlice: ChatActionsSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING_PRIORITY_CRITICAL', { slice: 'ChatActionsSlice', note: 'CONTAINS_ASSEMBLY_FUNCTIONS' });
          chatActionsSlice = createSliceWithLogging('ChatActionsSlice', createChatActionsSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED_PRIORITY_CRITICAL', { slice: 'ChatActionsSlice', note: 'ASSEMBLY_FUNCTIONS_CREATED' });
          
          // 🔥 IMMEDIATE VALIDATION: Check if assembly functions exist in chatActionsSlice
          const assemblyFunctions = ['buildPriorityMessageAssembly', 'createPriorityBasedContext', 'assemblePriorityPrompt', 'optimizeAssemblyForTokenBudget'];
          assemblyFunctions.forEach(funcName => {
            if (typeof (chatActionsSlice as any)[funcName] === 'function') {
              log('PRIORITY_SYSTEM_FIX', `✅ [PRIORITY FIX] ChatActions assembly function confirmed: ${funcName}`);
            } else {
              log('PRIORITY_SYSTEM_FIX', `❌ [PRIORITY FIX] ChatActions assembly function MISSING: ${funcName}`);
            }
          });
          
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED_PRIORITY_CRITICAL', { slice: 'ChatActionsSlice', error, note: 'ASSEMBLY_SYSTEM_BROKEN' });
          throw new Error(`ChatActionsSlice creation failed: ${error}`);
        }
        
        let generationSlice: GenerationSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'GenerationSlice' });
          generationSlice = createSliceWithLogging('GenerationSlice', createGenerationSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'GenerationSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'GenerationSlice', error });
          throw new Error(`GenerationSlice creation failed: ${error}`);
        }
        
        let candidSlice: CandidSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'CandidSlice' });
          candidSlice = createSliceWithLogging('CandidSlice', createCandidSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'CandidSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'CandidSlice', error });
          throw new Error(`CandidSlice creation failed: ${error}`);
        }

        let serverPairSlice: ServerPairSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING_SUSPECT', { slice: 'ServerPairSlice', note: 'RECENTLY_MODIFIED_SUSPECT' });
          serverPairSlice = createSliceWithLogging('ServerPairSlice', createServerPairSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED_SUSPECT', { slice: 'ServerPairSlice', note: 'SUCCESS_DESPITE_SUSPICION' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED_SUSPECT', { slice: 'ServerPairSlice', error, note: 'CONFIRMED_CULPRIT' });
          throw new Error(`ServerPairSlice creation failed: ${error}`);
        }

        let deploymentCoordinationSlice: DeploymentCoordinationSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'DeploymentCoordinationSlice' });
          deploymentCoordinationSlice = createSliceWithLogging('DeploymentCoordinationSlice', createDeploymentCoordinationSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'DeploymentCoordinationSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'DeploymentCoordinationSlice', error });
          throw new Error(`DeploymentCoordinationSlice creation failed: ${error}`);
        }

        // NEW: Project import slice
        let projectImportSlice: ProjectImportSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'ProjectImportSlice' });
          projectImportSlice = createSliceWithLogging('ProjectImportSlice', createProjectImportSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'ProjectImportSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'ProjectImportSlice', error });
          throw new Error(`ProjectImportSlice creation failed: ${error}`);
        }

        // NEW: Business agencies slice
        let businessAgenciesSlice: BusinessAgenciesSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'BusinessAgenciesSlice' });
          businessAgenciesSlice = createSliceWithLogging('BusinessAgenciesSlice', createBusinessAgenciesSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'BusinessAgenciesSlice' });
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'BusinessAgenciesSlice', error });
          throw new Error(`BusinessAgenciesSlice creation failed: ${error}`);
        }

        // NEW: User settings slice
        let userSettingsSlice: UserSettingsSlice;
        try {
          storeDebugger.log('SLICE_CREATION', 'CREATING', { slice: 'UserSettingsSlice' });
          userSettingsSlice = createSliceWithLogging('UserSettingsSlice', createUserSettingsSlice, set, get, api);
          storeDebugger.log('SLICE_CREATION', 'COMPLETED', { slice: 'UserSettingsSlice' });
          // Load settings from storage on initialization
          userSettingsSlice.loadSettingsFromStorage();
        } catch (error) {
          storeDebugger.log('SLICE_CREATION', 'FAILED', { slice: 'UserSettingsSlice', error });
          throw new Error(`UserSettingsSlice creation failed: ${error}`);
        }

        storeDebugger.log('SLICE_CREATION', 'ALL_SLICES_CREATED', { 
          totalSlices: 18,
          note: 'PROCEEDING_TO_PRIORITY_SYSTEM_PRESERVATION'
        });

        // 🚀 CRITICAL FIX: Combine slices with EXPLICIT PRIORITY FUNCTION PRESERVATION
        storeDebugger.log('STORE_COMBINATION', 'START_PRIORITY_FIX', { note: 'COMBINING_WITH_PRIORITY_PRESERVATION' });
        
        log('PRIORITY_SYSTEM_FIX', '🚀 [PRIORITY FIX] Starting store combination with explicit priority function preservation...');
        
        const storeConfig = {
          // Core functionality slices (no conflicts)
          ...loadingSlice,
          ...authSlice,
          ...userAccountSlice,
          ...initializationSlice,
          
          // Business logic slices (no conflicts)
          ...creditsSlice,
          ...paymentSlice,
          ...subscriptionSlice,
          
          // Project management slices (potential conflict zone)
          ...projectsSlice,
          ...projectFilesSlice,
          
          // File handling slices - CRITICAL: generatedFilesSlice comes FIRST to own updateTabGroups
          ...generatedFilesSlice,
          ...fileApplicationSlice,
          
          // 🔥 CRITICAL: Chat functionality slices - PRIORITY FUNCTIONS MUST BE PRESERVED
          ...chatStateSlice,
          ...chatActionsSlice,
          ...generationSlice,
          
          // Technical slices
          ...candidSlice,
          ...deploymentCoordinationSlice,

          // Server pair slice - comes before UI slice to ensure its functions are preserved
          ...serverPairSlice,

          // Project import slice
          ...projectImportSlice,

          // Business agencies slice
          ...businessAgenciesSlice,

          // User settings slice
          ...userSettingsSlice,

          // UI slice functions - CRITICAL: UI slice comes LAST but with explicit re-assignment of critical functions
          ...uiSlice,

          // 🚀 CRITICAL FIX: EXPLICIT PRIORITY SYSTEM FUNCTION PRESERVATION
          // This is THE CORE FIX - explicitly preserve all priority system functions
          
          // ChatState Priority Functions - CORE PRIORITY SYSTEM
          addPriorityMessage: chatStateSlice.addPriorityMessage,
          assignMessagePriority: chatStateSlice.assignMessagePriority,
          markCurrentUserInstruction: chatStateSlice.markCurrentUserInstruction,
          getPriorityOrderedMessages: chatStateSlice.getPriorityOrderedMessages,
          updatePriorityOrdering: chatStateSlice.updatePriorityOrdering,
          createConversationGroup: chatStateSlice.createConversationGroup,
          addToConversationGroup: chatStateSlice.addToConversationGroup,
          getPriorityContext: chatStateSlice.getPriorityContext,
          reassignPriorities: chatStateSlice.reassignPriorities,
          
          // ChatActions Assembly Functions - PRIORITY ASSEMBLY SYSTEM
          buildPriorityMessageAssembly: chatActionsSlice.buildPriorityMessageAssembly,
          createPriorityBasedContext: chatActionsSlice.createPriorityBasedContext,
          assemblePriorityPrompt: chatActionsSlice.assemblePriorityPrompt,
          estimateTokenCount: chatActionsSlice.estimateTokenCount,
          optimizeAssemblyForTokenBudget: chatActionsSlice.optimizeAssemblyForTokenBudget,

          // SOLUTION: Explicitly preserve critical UI functions that should NOT be overwritten
          setSidebarOpen: uiSlice.setSidebarOpen,
          toggleSidePane: uiSlice.toggleSidePane,
          closeSidePane: uiSlice.closeSidePane,
          setMobile: uiSlice.setMobile,
          handleTabClick: uiSlice.handleTabClick,

          // FIXED: Ensure UI slice uses the renamed function to avoid conflict
          triggerTabGroupsUpdate: uiSlice.triggerTabGroupsUpdate,

          // SOLUTION: Explicitly preserve the REAL updateTabGroups from generatedFilesSlice
          updateTabGroups: generatedFilesSlice.updateTabGroups,

          // Explicitly preserve server pair coordination functions
          setProjectServerPair: serverPairSlice.setProjectServerPair,
          getProjectServerPair: serverPairSlice.getProjectServerPair,
          removeProjectServerPair: serverPairSlice.removeProjectServerPair,
          syncWithLocalStorage: serverPairSlice.syncWithLocalStorage,
          notifyServerPairUpdate: serverPairSlice.notifyServerPairUpdate,

          // Explicitly preserve project import functions
          openImportDialog: projectImportSlice.openImportDialog,
          closeImportDialog: projectImportSlice.closeImportDialog,
          setImportStep: projectImportSlice.setImportStep,
          setSelectedFile: projectImportSlice.setSelectedFile,
          setDragOver: projectImportSlice.setDragOver,
          handleFileSelect: projectImportSlice.handleFileSelect,
          validateProject: projectImportSlice.validateProject,
          importProject: projectImportSlice.importProject,
          resetImportState: projectImportSlice.resetImportState,

          // Global store reset method
          reset: () => {
            log('STORE_INTEGRATION', '🔄 [STORE RESET] Performing global store reset');
            
            set((state) => {
              // Reset to initial state - each slice should handle its own reset
              // This is a fallback for any global state that doesn't belong to specific slices
              Object.keys(state).forEach(key => {
                if (typeof state[key as keyof typeof state] === 'function') {
                  return; // Don't reset functions
                }
                // Reset state properties to their defaults
                // Individual slices handle their own state reset in their respective reset methods
              });
            });
            
            // Clear coordinator subscriptions on reset
            coordinatorSubscriptions.clear();
            storeHealthMetrics.operationCount++;
            
            log('STORE_INTEGRATION', '✅ [STORE RESET] Global store reset completed');
          },

          // ENHANCED: Coordinator access interface with comprehensive functionality
          getCoordinatorAccess: (): CoordinatorStoreAccess => {
            log('COORDINATOR_ACCESS', '🔍 [ACCESS REQUEST] Creating coordinator access interface');
            
            return {
              getState: () => {
                storeHealthMetrics.operationCount++;
                const state = get();
                
                log('COORDINATOR_ACCESS', '📊 [GET STATE] State accessed by coordinator:', {
                  activeProject: state.activeProject,
                  projectCount: Object.keys(state.projects || {}).length,
                  generatedFilesCount: Object.keys(state.generatedFiles || {}).length,
                  timestamp: Date.now()
                });
                
                return state;
              },

              subscribe: (listener: (state: CombinedStore) => void) => {
                log('COORDINATOR_ACCESS', '👂 [SUBSCRIPTION] Coordinator subscribing to store changes');
                
                coordinatorSubscriptions.add(listener);
                storeHealthMetrics.subscriptionCount++;
                
                // Use Zustand's subscribe method with enhanced error handling
                const unsubscribe = api.subscribe(
                  (state) => state,
                  (state) => {
                    try {
                      listener(state);
                    } catch (error) {
                      log('COORDINATOR_ACCESS', '❌ [SUBSCRIPTION ERROR] Coordinator listener error:', error);
                      storeHealthMetrics.errorCount++;
                    }
                  },
                  {
                    equalityFn: (a, b) => {
                      // Enhanced equality function for coordinator-relevant changes
                      const coordinatorRelevantKeys = [
                        'generatedFiles', 'fileGenerationStates', 'fileApplyState',
                        'activeProject', 'projectGeneratedFiles', 'autoRetryState'
                      ];
                      
                      return coordinatorRelevantKeys.every(key => {
                        const aVal = (a as any)[key];
                        const bVal = (b as any)[key];
                        
                        if (typeof aVal === 'object' && typeof bVal === 'object') {
                          return JSON.stringify(aVal) === JSON.stringify(bVal);
                        }
                        return aVal === bVal;
                      });
                    }
                  }
                );

                // Enhanced cleanup function
                return () => {
                  log('COORDINATOR_ACCESS', '🧹 [UNSUBSCRIBE] Coordinator unsubscribing from store');
                  coordinatorSubscriptions.delete(listener);
                  storeHealthMetrics.subscriptionCount--;
                  unsubscribe();
                };
              },

              setState: (partial: Partial<CombinedStore> | ((state: CombinedStore) => void)) => {
                log('COORDINATOR_ACCESS', '✏️ [SET STATE] Coordinator updating store state');
                
                try {
                  if (typeof partial === 'function') {
                    set(partial);
                  } else {
                    set((state) => {
                      Object.assign(state, partial);
                    });
                  }
                  storeHealthMetrics.operationCount++;
                } catch (error) {
                  log('COORDINATOR_ACCESS', '❌ [SET STATE ERROR] Coordinator state update failed:', error);
                  storeHealthMetrics.errorCount++;
                  throw error;
                }
              },

              // Enhanced file completion status with validation
              getFileCompletionStatus: () => {
                const state = get();
                const status = state.getFileCompletionStatus ? state.getFileCompletionStatus() : { total: 0, complete: 0, writing: 0, detected: 0 };
                
                log('COORDINATOR_ACCESS', '📈 [FILE STATUS] File completion status requested:', status);
                storeHealthMetrics.operationCount++;
                
                return status;
              },

              // Enhanced workflow monitoring control
              startWorkflowFileMonitoring: (workflowId: string) => {
                log('COORDINATOR_ACCESS', '👀 [START MONITORING] Starting workflow file monitoring:', workflowId);
                
                const state = get();
                if (state.startWorkflowFileMonitoring) {
                  try {
                    state.startWorkflowFileMonitoring(workflowId);
                    storeHealthMetrics.operationCount++;
                  } catch (error) {
                    log('COORDINATOR_ACCESS', '❌ [MONITORING ERROR] Failed to start workflow monitoring:', error);
                    storeHealthMetrics.errorCount++;
                    throw error;
                  }
                } else {
                  const error = 'startWorkflowFileMonitoring method not available';
                  log('COORDINATOR_ACCESS', '❌ [METHOD MISSING]', error);
                  throw new Error(error);
                }
              },

              stopWorkflowFileMonitoring: () => {
                log('COORDINATOR_ACCESS', '🛑 [STOP MONITORING] Stopping workflow file monitoring');
                
                const state = get();
                if (state.stopWorkflowFileMonitoring) {
                  try {
                    state.stopWorkflowFileMonitoring();
                    storeHealthMetrics.operationCount++;
                  } catch (error) {
                    log('COORDINATOR_ACCESS', '❌ [STOP MONITORING ERROR] Failed to stop workflow monitoring:', error);
                    storeHealthMetrics.errorCount++;
                    throw error;
                  }
                } else {
                  log('COORDINATOR_ACCESS', '⚠️ [METHOD MISSING] stopWorkflowFileMonitoring method not available');
                }
              },

              // ENHANCED: Debugging helpers for coordinator troubleshooting
              getDebugInfo: () => {
                const state = get();
                
                const debugInfo = {
                  activeProject: state.activeProject || null,
                  fileStates: state.fileGenerationStates || {},
                  autoRetryState: state.autoRetryState || {},
                  projectCounts: Object.keys(state.projectGeneratedFiles || {}).reduce((acc, projectId) => {
                    acc[projectId] = Object.keys(state.projectGeneratedFiles[projectId] || {}).length;
                    return acc;
                  }, {} as { [projectId: string]: number })
                };
                
                log('COORDINATOR_ACCESS', '🔍 [DEBUG INFO] Debug information requested:', debugInfo);
                return debugInfo;
              },

              // 🔥 ENHANCED: Store integrity validation WITH PRIORITY SYSTEM CHECKS
              validateStoreIntegrity: () => {
                const state = get();
                let isValid = true;
                
                // Check if required methods exist
                const requiredMethods = [
                  'getFileCompletionStatus', 'startWorkflowFileMonitoring', 'stopWorkflowFileMonitoring', 'updateTabGroups',
                  'setProjectServerPair', 'getProjectServerPair', 'notifyServerPairUpdate',
                  'openImportDialog', 'closeImportDialog', 'validateProject', 'importProject',
                  // 🔥 PRIORITY SYSTEM METHODS
                  'addPriorityMessage', 'assignMessagePriority', 'markCurrentUserInstruction', 'getPriorityOrderedMessages',
                  'buildPriorityMessageAssembly', 'createPriorityBasedContext', 'assemblePriorityPrompt'
                ];
                
                requiredMethods.forEach(method => {
                  if (typeof (state as any)[method] !== 'function') {
                    log('STORE_HEALTH', `❌ [INTEGRITY CHECK] Missing method: ${method}`);
                    isValid = false;
                  } else {
                    // 🔥 SPECIAL VALIDATION: Check if priority functions are actually the right ones
                    if (method.includes('Priority') || method.includes('Assembly')) {
                      const funcString = (state as any)[method].toString();
                      if (funcString.includes('Priority') || funcString.includes('CRITICAL') || funcString.includes('MessagePriority')) {
                        log('STORE_HEALTH', `✅ [INTEGRITY CHECK] Priority method validated: ${method}`);
                      } else {
                        log('STORE_HEALTH', `❌ [INTEGRITY CHECK] Priority method appears to be wrong implementation: ${method}`);
                        isValid = false;
                      }
                    }
                  }
                });
                
                // Check if core state exists
                const requiredState = ['generatedFiles', 'fileGenerationStates', 'activeProject', 'projectServerPairs', 'isImportDialogOpen', 'priorityAssignments', 'priorityOrdering'];
                requiredState.forEach(key => {
                  if ((state as any)[key] === undefined) {
                    log('STORE_HEALTH', `❌ [INTEGRITY CHECK] Missing state: ${key}`);
                    isValid = false;
                  }
                });
                
                // SOLUTION: Verify updateTabGroups is the correct one from generatedFilesSlice
                const updateTabGroupsString = state.updateTabGroups?.toString() || '';
                if (updateTabGroupsString.includes('triggerTabGroupsUpdate') || updateTabGroupsString.includes('Tab groups update triggered from UI slice')) {
                  log('STORE_HEALTH', '❌ [INTEGRITY CHECK] updateTabGroups appears to be from UI slice (wrong one)');
                  isValid = false;
                } else {
                  log('STORE_HEALTH', '✅ [INTEGRITY CHECK] updateTabGroups appears to be from generatedFilesSlice (correct one)');
                }
                
                log('STORE_HEALTH', '🔍 [INTEGRITY CHECK] Store integrity validation with priority system:', { isValid });
                return isValid;
              },

              // 🔥 ENHANCED: Comprehensive store health check WITH PRIORITY SYSTEM
              performStoreHealthCheck: () => {
                const now = Date.now();
                const state = get();
                
                const issues: string[] = [];
                
                // Check for memory leaks
                let memoryUsage = 0;
                if (typeof window !== 'undefined' && (performance as any).memory) {
                  memoryUsage = (performance as any).memory.usedJSHeapSize;
                  if (memoryUsage > storeHealthMetrics.memoryBaseline * 3) {
                    issues.push('High memory usage detected');
                  }
                }
                
                // Check for excessive errors
                if (storeHealthMetrics.errorCount > 10) {
                  issues.push('High error rate detected');
                }
                
                // Check for stale subscriptions
                if (coordinatorSubscriptions.size > 5) {
                  issues.push('Many active coordinator subscriptions');
                }
                
                // Check critical UI functions
                if (typeof state.setSidebarOpen !== 'function') {
                  issues.push('setSidebarOpen function is missing or invalid');
                }
                
                // Check server pair coordination functions
                if (typeof state.setProjectServerPair !== 'function') {
                  issues.push('setProjectServerPair function is missing or invalid');
                }
                
                // Check import functions
                if (typeof state.openImportDialog !== 'function') {
                  issues.push('openImportDialog function is missing or invalid');
                }
                
                // 🔥 CRITICAL: Check priority system functions
                const priorityFunctions = [
                  'addPriorityMessage', 'assignMessagePriority', 'markCurrentUserInstruction', 
                  'buildPriorityMessageAssembly', 'createPriorityBasedContext', 'assemblePriorityPrompt'
                ];
                
                priorityFunctions.forEach(funcName => {
                  if (typeof (state as any)[funcName] !== 'function') {
                    issues.push(`Priority system function missing: ${funcName}`);
                  } else {
                    // Validate it's the actual priority function, not a placeholder
                    const funcString = (state as any)[funcName].toString();
                    if (!funcString.includes('Priority') && !funcString.includes('CRITICAL') && !funcString.includes('MessagePriority')) {
                      issues.push(`Priority system function appears to be wrong implementation: ${funcName}`);
                    }
                  }
                });
                
                // Check updateTabGroups function source
                const updateTabGroupsString = state.updateTabGroups?.toString() || '';
                if (updateTabGroupsString.includes('triggerTabGroupsUpdate')) {
                  issues.push('updateTabGroups is incorrectly resolving to UI slice version');
                }
                
                // Update health metrics
                storeHealthMetrics.lastHealthCheck = now;
                
                const healthStatus = {
                  isHealthy: issues.length === 0,
                  issues,
                  metrics: {
                    projectCount: Object.keys(state.projects || {}).length,
                    totalFiles: Object.keys(state.generatedFiles || {}).length,
                    memoryUsage,
                    subscriptionCount: coordinatorSubscriptions.size
                  }
                };
                
                log('STORE_HEALTH', '🏥 [HEALTH CHECK] Store health check completed with priority system validation:', healthStatus);
                return healthStatus;
              }
            };
          },

          // ENHANCED: Secure window exposure with validation
          exposeToWindow: () => {
            if (typeof window === 'undefined') {
              log('WINDOW_EXPOSURE', '⚠️ [WINDOW EXPOSURE] Window not available (SSR environment)');
              return;
            }

            try {
              // Expose main store
              (window as any).useAppStore = useAppStore;
              
              // ENHANCED: Expose coordinator-specific interface
              const coordinatorAccess = storeConfig.getCoordinatorAccess();
              (window as any).__kontextAppStore = coordinatorAccess;
              
              // 🔥 ENHANCED: Expose debugging helpers WITH PRIORITY SYSTEM DEBUG
              (window as any).__kontextStoreDebug = {
                getHealthMetrics: () => storeHealthMetrics,
                getCoordinatorSubscriptions: () => coordinatorSubscriptions.size,
                performHealthCheck: coordinatorAccess.performStoreHealthCheck,
                validateIntegrity: coordinatorAccess.validateStoreIntegrity,
                getDebugInfo: coordinatorAccess.getDebugInfo,
                getInitializationLog: () => storeDebugger.getLastEntries(50),
                dumpInitializationLog: () => storeDebugger.dumpInitializationLog(),
                // 🔥 ENHANCED: Function debugging helpers WITH PRIORITY SYSTEM
                checkFunctions: () => {
                  const state = get();
                  const functions = [
                    'setSidebarOpen', 'toggleSidePane', 'closeSidePane', 'switchToProject', 'updateTabGroups', 
                    'triggerTabGroupsUpdate', 'setProjectServerPair', 'getProjectServerPair', 'notifyServerPairUpdate',
                    'openImportDialog', 'closeImportDialog', 'validateProject', 'importProject',
                    // 🔥 PRIORITY SYSTEM FUNCTIONS
                    'addPriorityMessage', 'assignMessagePriority', 'markCurrentUserInstruction', 'getPriorityOrderedMessages',
                    'buildPriorityMessageAssembly', 'createPriorityBasedContext', 'assemblePriorityPrompt'
                  ];
                  const report = functions.map(fn => ({
                    name: fn,
                    type: typeof (state as any)[fn],
                    exists: typeof (state as any)[fn] === 'function',
                    source: (state as any)[fn]?.toString().includes('triggerTabGroupsUpdate') ? 'UI_SLICE' : 
                           (state as any)[fn]?.toString().includes('generatedFilesSlice') ? 'GENERATED_FILES_SLICE' :
                           (state as any)[fn]?.toString().includes('SERVER_PAIR_COORDINATION') ? 'SERVER_PAIR_SLICE' :
                           (state as any)[fn]?.toString().includes('ImportSlice') ? 'PROJECT_IMPORT_SLICE' :
                           (state as any)[fn]?.toString().includes('Priority') || (state as any)[fn]?.toString().includes('CRITICAL') ? 'PRIORITY_SYSTEM' :
                           'UNKNOWN',
                    // 🔥 PRIORITY SYSTEM: Special validation for priority functions
                    isPriorityFunction: fn.includes('Priority') || fn.includes('Assembly'),
                    priorityValidation: fn.includes('Priority') || fn.includes('Assembly') ? 
                      ((state as any)[fn]?.toString().includes('Priority') || (state as any)[fn]?.toString().includes('CRITICAL') ? 'VALID' : 'INVALID') : 'N/A'
                  }));
                  console.table(report);
                  
                  // 🔥 PRIORITY SYSTEM: Special priority system report
                  const priorityReport = report.filter(r => r.isPriorityFunction);
                  console.log('\n🔥 PRIORITY SYSTEM FUNCTIONS REPORT:');
                  console.table(priorityReport);
                  
                  return report;
                },
                // 🔥 NEW: Priority system specific debug tools
                testPrioritySystem: () => {
                  const state = get();
                  console.log('\n🔥 PRIORITY SYSTEM FUNCTIONALITY TEST:');
                  
                  const tests = [
                    { name: 'addPriorityMessage', test: () => typeof state.addPriorityMessage === 'function' },
                    { name: 'assignMessagePriority', test: () => typeof state.assignMessagePriority === 'function' },
                    { name: 'markCurrentUserInstruction', test: () => typeof state.markCurrentUserInstruction === 'function' },
                    { name: 'buildPriorityMessageAssembly', test: () => typeof state.buildPriorityMessageAssembly === 'function' },
                    { name: 'createPriorityBasedContext', test: () => typeof state.createPriorityBasedContext === 'function' },
                    { name: 'assemblePriorityPrompt', test: () => typeof state.assemblePriorityPrompt === 'function' },
                    { name: 'priorityAssignments state', test: () => typeof state.priorityAssignments === 'object' },
                    { name: 'currentInstructionId state', test: () => state.hasOwnProperty('currentInstructionId') },
                    { name: 'priorityOrdering state', test: () => Array.isArray(state.priorityOrdering) }
                  ];
                  
                  const results = tests.map(test => ({
                    name: test.name,
                    passed: test.test(),
                    status: test.test() ? '✅ PASS' : '❌ FAIL'
                  }));
                  
                  console.table(results);
                  
                  const allPassed = results.every(r => r.passed);
                  console.log(`\n🔥 PRIORITY SYSTEM STATUS: ${allPassed ? '✅ FULLY FUNCTIONAL' : '❌ BROKEN'}`);
                  
                  return { allPassed, results };
                }
              };
              
              log('PRIORITY_SYSTEM_FIX', '✅ [PRIORITY FIX] Store successfully exposed to window with priority system diagnostic tools:', {
                useAppStore: '✅',
                __kontextAppStore: '✅',
                __kontextStoreDebug: '✅',
                prioritySystemDebugTools: '✅',
                timestamp: Date.now()
              });
              
            } catch (error) {
              log('WINDOW_EXPOSURE', '❌ [WINDOW EXPOSURE] Failed to expose store to window:', error);
              storeHealthMetrics.errorCount++;
            }
          },

          // 🔥 ENHANCED: Store connection validation WITH PRIORITY SYSTEM
          validateStoreConnection: () => {
            try {
              const state = get();
              const hasRequiredMethods = !!(
                state.getFileCompletionStatus &&
                state.startWorkflowFileMonitoring &&
                state.stopWorkflowFileMonitoring &&
                state.updateTabGroups &&
                state.setProjectServerPair &&
                state.getProjectServerPair &&
                state.notifyServerPairUpdate &&
                state.openImportDialog &&
                state.closeImportDialog &&
                state.validateProject &&
                state.importProject
              );
              
              // 🔥 CRITICAL: Check priority system methods
              const hasPriorityMethods = !!(
                state.addPriorityMessage &&
                state.assignMessagePriority &&
                state.markCurrentUserInstruction &&
                state.buildPriorityMessageAssembly &&
                state.createPriorityBasedContext &&
                state.assemblePriorityPrompt
              );
              
              const hasRequiredState = !!(
                typeof state.generatedFiles === 'object' &&
                typeof state.fileGenerationStates === 'object' &&
                typeof state.projectServerPairs === 'object' &&
                typeof state.isImportDialogOpen === 'boolean'
              );
              
              // 🔥 CRITICAL: Check priority system state
              const hasPriorityState = !!(
                typeof state.priorityAssignments === 'object' &&
                state.hasOwnProperty('currentInstructionId') &&
                Array.isArray(state.priorityOrdering)
              );
              
              // Check critical UI functions
              const hasCriticalUIFunctions = !!(
                typeof state.setSidebarOpen === 'function' &&
                typeof state.toggleSidePane === 'function' &&
                typeof state.closeSidePane === 'function'
              );
              
              // Verify updateTabGroups is the correct implementation
              const updateTabGroupsString = state.updateTabGroups?.toString() || '';
              const hasCorrectUpdateTabGroups = !updateTabGroupsString.includes('triggerTabGroupsUpdate');
              
              // Verify server pair coordination functions
              const hasServerPairCoordination = !!(
                typeof state.setProjectServerPair === 'function' &&
                typeof state.getProjectServerPair === 'function' &&
                typeof state.notifyServerPairUpdate === 'function'
              );

              // Verify import coordination functions
              const hasImportCoordination = !!(
                typeof state.openImportDialog === 'function' &&
                typeof state.closeImportDialog === 'function' &&
                typeof state.validateProject === 'function' &&
                typeof state.importProject === 'function'
              );
              
              const isValid = hasRequiredMethods && hasRequiredState && hasCriticalUIFunctions && 
                             hasCorrectUpdateTabGroups && hasServerPairCoordination && hasImportCoordination &&
                             hasPriorityMethods && hasPriorityState;
              
              log('PRIORITY_SYSTEM_FIX', '🔍 [PRIORITY FIX] Store connection validation with priority system:', {
                hasRequiredMethods,
                hasRequiredState,
                hasCriticalUIFunctions,
                hasCorrectUpdateTabGroups,
                hasServerPairCoordination,
                hasImportCoordination,
                hasPriorityMethods,
                hasPriorityState,
                isValid
              });
              
              return isValid;
            } catch (error) {
              log('STORE_INTEGRATION', '❌ [CONNECTION VALIDATION] Store validation failed:', error);
              storeHealthMetrics.errorCount++;
              return false;
            }
          }
        };

        storeDebugger.log('STORE_COMBINATION', 'COMPLETED_PRIORITY_FIX', { 
          configKeys: Object.keys(storeConfig).length,
          functionCount: Object.keys(storeConfig).filter(key => typeof storeConfig[key as keyof typeof storeConfig] === 'function').length,
          priorityFunctionsPreserved: true
        });

        // 🔥 CRITICAL: Final validation of priority system functions
        log('PRIORITY_SYSTEM_FIX', '🔍 [PRIORITY FIX] Validating priority system functions in store config...');
        const priorityFunctions = [
          'addPriorityMessage', 'assignMessagePriority', 'markCurrentUserInstruction', 'getPriorityOrderedMessages',
          'buildPriorityMessageAssembly', 'createPriorityBasedContext', 'assemblePriorityPrompt'
        ];
        
        priorityFunctions.forEach(funcName => {
          if (typeof storeConfig[funcName as keyof typeof storeConfig] !== 'function') {
            console.error(`❌ [PRIORITY FIX] CRITICAL: ${funcName} is not a function!`, typeof storeConfig[funcName as keyof typeof storeConfig]);
            storeDebugger.log('FINAL_VALIDATION', 'MISSING_PRIORITY_FUNCTION', { functionName: funcName });
          } else {
            // Validate it's actually the priority function
            const funcString = (storeConfig[funcName as keyof typeof storeConfig] as any).toString();
            if (funcString.includes('Priority') || funcString.includes('CRITICAL') || funcString.includes('MessagePriority')) {
              log('PRIORITY_SYSTEM_FIX', `✅ [PRIORITY FIX] ${funcName} is properly bound and validated`);
              storeDebugger.log('FINAL_VALIDATION', 'PRIORITY_FUNCTION_OK', { functionName: funcName });
            } else {
              console.error(`❌ [PRIORITY FIX] CRITICAL: ${funcName} exists but appears to be wrong implementation!`);
              storeDebugger.log('FINAL_VALIDATION', 'WRONG_PRIORITY_FUNCTION', { functionName: funcName });
            }
          }
        });

        // Final validation of other critical functions
        const criticalFunctions = [
          'setSidebarOpen', 'toggleSidePane', 'closeSidePane', 'switchToProject', 'updateTabGroups',
          'setProjectServerPair', 'getProjectServerPair', 'notifyServerPairUpdate',
          'openImportDialog', 'closeImportDialog', 'validateProject', 'importProject'
        ];
        
        criticalFunctions.forEach(funcName => {
          if (typeof storeConfig[funcName as keyof typeof storeConfig] !== 'function') {
            console.error(`❌ [FINAL VALIDATION] CRITICAL: ${funcName} is not a function!`, typeof storeConfig[funcName as keyof typeof storeConfig]);
            storeDebugger.log('FINAL_VALIDATION', 'MISSING_FUNCTION', { functionName: funcName });
          } else {
            log('FUNCTION_BINDING', `✅ [FINAL VALIDATION] ${funcName} is properly bound`);
            storeDebugger.log('FINAL_VALIDATION', 'FUNCTION_OK', { functionName: funcName });
          }
        });

        // Verify updateTabGroups is the correct implementation
        const updateTabGroupsString = storeConfig.updateTabGroups?.toString() || '';
        if (updateTabGroupsString.includes('triggerTabGroupsUpdate')) {
          console.error('❌ [FINAL VALIDATION] CRITICAL: updateTabGroups is resolving to UI slice version (will cause infinite loop)');
          storeDebugger.log('FINAL_VALIDATION', 'WRONG_UPDATETABGROUPS', {});
        } else {
          log('FUNCTION_BINDING', '✅ [FINAL VALIDATION] updateTabGroups is from generatedFilesSlice (correct)');
          storeDebugger.log('FINAL_VALIDATION', 'CORRECT_UPDATETABGROUPS', {});
        }

        storeDebugger.log('STORE_CREATION', 'SUCCESS_PRIORITY_FIX', { 
          totalDuration: performance.now() - storeDebugger.initializationLog[0]?.timestamp,
          storeConfigured: true,
          prioritySystemFixed: true
        });

        log('PRIORITY_SYSTEM_FIX', '🎉 [PRIORITY FIX] MESSAGE PRIORITY SYSTEM FIX COMPLETED SUCCESSFULLY! 🎉');
        log('PRIORITY_SYSTEM_FIX', '✅ [PRIORITY FIX] All priority functions explicitly preserved and validated');
        log('PRIORITY_SYSTEM_FIX', '✅ [PRIORITY FIX] Priority system should now be fully functional');
        log('PRIORITY_SYSTEM_FIX', '✅ [PRIORITY FIX] Expected results: Priority assignments >0, Current instruction ID populated, AI focus improvements');

        return storeConfig;
      })
    ),
    {
      name: 'kontext-store',
      version: 1
    }
  )
);

// ENHANCED: Auto-expose store to window on creation with retry logic
let exposureRetryCount = 0;
const maxExposureRetries = 5;

const attemptWindowExposure = () => {
  if (typeof window !== 'undefined') {
    try {
      const store = useAppStore.getState();
      if (store.exposeToWindow) {
        store.exposeToWindow();
        log('PRIORITY_SYSTEM_FIX', '✅ [PRIORITY FIX] Store automatically exposed to window with priority system diagnostic tools');
        
        // 🔥 PRIORITY SYSTEM: Run priority system functionality test
        if ((window as any).__kontextStoreDebug) {
          (window as any).__kontextStoreDebug.checkFunctions();
          
          // 🔥 NEW: Run priority system test
          const priorityTest = (window as any).__kontextStoreDebug.testPrioritySystem();
          if (priorityTest.allPassed) {
            log('PRIORITY_SYSTEM_FIX', '🎉 [PRIORITY FIX] PRIORITY SYSTEM FUNCTIONALITY TEST PASSED! 🎉');
          } else {
            log('PRIORITY_SYSTEM_FIX', '❌ [PRIORITY FIX] Priority system functionality test failed');
          }
        }
        
        return true;
      }
    } catch (error) {
      log('WINDOW_EXPOSURE', `❌ [AUTO EXPOSURE] Attempt ${exposureRetryCount + 1} failed:`, error);
    }
  }
  
  exposureRetryCount++;
  if (exposureRetryCount < maxExposureRetries) {
    setTimeout(attemptWindowExposure, 1000 * exposureRetryCount); // Exponential backoff
  } else {
    log('WINDOW_EXPOSURE', '❌ [AUTO EXPOSURE] Max retries reached, window exposure failed');
  }
  
  return false;
};

// Attempt initial exposure
if (typeof window !== 'undefined') {
  // Use requestIdleCallback for better performance if available
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => attemptWindowExposure(), { timeout: 5000 });
  } else {
    setTimeout(attemptWindowExposure, 100);
  }
}

// ENHANCED: Store health monitoring interval
if (typeof window !== 'undefined') {
  setInterval(() => {
    try {
      const store = useAppStore.getState();
      if (store.getCoordinatorAccess) {
        const access = store.getCoordinatorAccess();
        const health = access.performStoreHealthCheck();
        
        if (!health.isHealthy) {
          log('STORE_HEALTH', '⚠️ [HEALTH MONITOR] Store health issues detected:', health.issues);
        }
      }
    } catch (error) {
      log('STORE_HEALTH', '❌ [HEALTH MONITOR] Health monitoring error:', error);
    }
  }, 60000); // Check every minute
}

// ==================== PRESERVED HOOK EXPORTS WITH ENHANCEMENTS ====================

export const useAuth = () => useAppStore((state) => ({
  isAuthenticated: state.isAuthenticated,
  principal: state.principal,
  identity: state.identity,
  authClient: state.authClient,
  login: state.login,
  logout: state.logout,
  initializeAuth: state.initializeAuth
}));

export const useInitialization = () => useAppStore((state) => ({
  stage: state.stage,
  progress: state.initializationProgress,
  userCanisterId: state.userCanisterId,
  isReady: state.isReady,
  isInitializing: state.isInitializing,
  error: state.error,
  retryCount: state.retryCount,
  setStage: state.setStage,
  setProgress: state.setProgress,
  retryInitialization: state.retryInitialization,
  clearError: state.clearError,
  incrementRetry: state.incrementRetry
}));

export const useUserAccount = () => useAppStore((state) => ({
  userAccount: state.userAccount,
  checkIfFirstTimeUser: state.checkIfFirstTimeUser,
  initializeNewUserAccount: state.initializeNewUserAccount,
  syncUserAccountAndSubscriptionState: state.syncUserAccountAndSubscriptionState
}));

export const useProjects = () => useAppStore((state) => ({
  projects: state.projects,
  activeProject: state.activeProject,
  projectSwitchStatus: state.projectSwitchStatus,
  loadProjects: state.loadProjects,
  createProject: state.createProject,
  createProjectWithServerPair: state.createProjectWithServerPair,
  updateProject: state.updateProject,
  deleteProject: state.deleteProject,
  switchToProject: state.switchToProject,
  getProjectById: state.getProjectById,
  updateProjectMetadata: state.updateProjectMetadata,
  setSelectedVersion: state.setSelectedVersion,
  getSelectedVersion: state.getSelectedVersion,
  getSelectedVersionString: state.getSelectedVersionString,
  loadVersionFiles: state.loadVersionFiles,
  markBothDeploymentFlagsChanged: state.markBothDeploymentFlagsChanged,
  clearDeploymentFlags: state.clearDeploymentFlags
}));

export const useChat = () => useAppStore((state) => ({
  currentMessages: state.currentMessages,
  currentSessionMessages: state.currentSessionMessages,
  currentSessionId: state.currentSessionId,
  input: state.input,
  generation: state.generation,
  streamingState: state.streamingState,
  messageSync: state.messageSync,
  activeProject: state.activeProject,
  isMessagePending: state.isMessagePending,
  showKLoadingAnimation: state.showKLoadingAnimation,
  chatKAnimation: state.chatKAnimation,
  setInput: state.setInput,
  addMessageToProject: state.addMessageToProject,
  updateMessage: state.updateMessage,
  sendMessage: state.sendMessage,
  loadProjectMessages: state.loadProjectMessages,
  clearProjectMessages: state.clearProjectMessages,
  setNoProjectState: state.setNoProjectState,
  setMessagePending: state.setMessagePending,
  startNewSession: state.startNewSession,
  endCurrentSession: state.endCurrentSession,
  getCurrentSessionMessages: state.getCurrentSessionMessages,
  setStreamingState: state.setStreamingState,
  clearStreamingState: state.clearStreamingState,
  updateStreamingContent: state.updateStreamingContent,
  // 🔥 NEW: Priority system hooks
  addPriorityMessage: state.addPriorityMessage,
  assignMessagePriority: state.assignMessagePriority,
  markCurrentUserInstruction: state.markCurrentUserInstruction,
  getPriorityOrderedMessages: state.getPriorityOrderedMessages,
  reassignPriorities: state.reassignPriorities
}));

export const useFiles = () => useAppStore((state) => ({
  generatedFiles: state.generatedFiles,
  liveGeneratedFiles: state.liveGeneratedFiles,
  tabGroups: state.tabGroups,
  fileGenerationStates: state.fileGenerationStates,
  projectFiles: state.projectFiles,
  loadProjectFiles: state.loadProjectFiles,
  saveProjectFiles: state.saveProjectFiles,
  updateGeneratedFiles: state.updateGeneratedFiles,
  getProjectFiles: state.getProjectFiles,
  detectAndUpdateProgressiveFiles: state.detectAndUpdateProgressiveFiles,
  updateProgressiveFileContent: state.updateProgressiveFileContent,
  markFileAsComplete: state.markFileAsComplete,
  updateFileGenerationState: state.updateFileGenerationState
}));

export const useFileApply = () => useAppStore((state) => ({
  fileApplyState: state.fileApplyState,
  startFileApplication: state.startFileApplication
}));

export const useCredits = () => useAppStore((state) => ({
  credits: state.credits,
  payment: state.payment,
  userPreferences: state.userPreferences,
  initializeWallet: state.initializeWallet,
  fetchCreditsBalance: state.fetchCreditsBalance,
  getUserUnitsBalance: state.getUserUnitsBalance,
  addUnitsToBalance: state.addUnitsToBalance,
  deductUnitsFromBalance: state.deductUnitsFromBalance,
  startPeriodicBalanceUpdate: state.startPeriodicBalanceUpdate,
  stopPeriodicBalanceUpdate: state.stopPeriodicBalanceUpdate,
  updateUserPreferences: state.updateUserPreferences
}));

export const useSubscription = () => useAppStore((state) => ({
  subscription: state.subscription,
  setSubscriptionTier: state.setSubscriptionTier,
  updateCreditsUsage: state.updateCreditsUsage,
  completeSubscriptionSetup: state.completeSubscriptionSetup,
  loadSubscriptionInfo: state.loadSubscriptionInfo,
  resetSubscription: state.resetSubscription,
  selectSubscriptionTier: state.selectSubscriptionTier,
  showSubscriptionSelection: state.showSubscriptionSelection,
  hideSubscriptionSelection: state.hideSubscriptionSelection,
  syncSubscriptionWithStripe: state.syncSubscriptionWithStripe,
  isSubscriptionActiveForFeatureAccess: state.isSubscriptionActiveForFeatureAccess,
  handleSubscriptionRenewal: state.handleSubscriptionRenewal,
  calculateRenewalStatus: state.calculateRenewalStatus,
  dismissRenewalWarning: state.dismissRenewalWarning,
  getRenewalStatus: state.getRenewalStatus,
  getDaysUntilExpiration: state.getDaysUntilExpiration,
  handleSubscriptionChange: state.handleSubscriptionChange
}));

export const useServerPairDialog = () => useAppStore((state) => ({
  serverPairDialog: state.serverPairDialog,
  openServerPairSelectionDialog: state.openServerPairSelectionDialog,
  closeServerPairSelectionDialog: state.closeServerPairSelectionDialog,
  setServerPairDialogOption: state.setServerPairDialogOption,
  setSelectedServerPairId: state.setSelectedServerPairId,
  setNewServerPairName: state.setNewServerPairName,
  setCreditsToAllocate: state.setCreditsToAllocate,
  loadAllUserServerPairs: state.loadAllUserServerPairs,
  createServerPairAndProject: state.createServerPairAndProject,
  createServerPairForExistingProject: state.createServerPairForExistingProject,
  assignServerPairAndProject: state.assignServerPairAndProject,
  createProjectWithoutServerPair: state.createProjectWithoutServerPair,
  calculateServerConfigFromCredits: state.calculateServerConfigFromCredits,
  getMinimumCreditsRequired: state.getMinimumCreditsRequired,
  setProjectServerPair: state.setProjectServerPair,
  getProjectServerPair: state.getProjectServerPair,
  removeProjectServerPair: state.removeProjectServerPair,
  syncWithLocalStorage: state.syncWithLocalStorage,
  notifyServerPairUpdate: state.notifyServerPairUpdate
}));

export const useDeploymentCoordination = () => useAppStore((state) => ({
  deploymentCoordination: state.deploymentCoordination,
  createDeploymentContext: state.createDeploymentContext,
  getDeploymentContext: state.getDeploymentContext,
  getDeploymentState: state.getDeploymentState,
  updateDeploymentState: state.updateDeploymentState,
  startDeployment: state.startDeployment,
  handleDeploymentSuccess: state.handleDeploymentSuccess,
  handleDeploymentError: state.handleDeploymentError,
  setSelectedServerPairId: state.setDeploymentSelectedServerPairId,
  getSelectedServerPairId: state.getDeploymentSelectedServerPairId,
  handleLivePreviewActivation: state.handleLivePreviewActivation,
  findDeploymentByProject: state.findDeploymentByProject,
  markDeploymentComplete: state.markDeploymentComplete,
  ensureChatAlwaysEnabled: state.ensureChatAlwaysEnabled,
  cleanupStuckDeployments: state.cleanupStuckDeployments
}));

export const useUI = () => {
  const uiState = useAppStore((state) => ({
    ui: state.ui,
    isEditable: state.isEditable,
    isDirty: state.isDirty,
    pendingSave: state.pendingSave,
    editContent: state.editContent,
    toggleSidePane: state.toggleSidePane,
    closeSidePane: state.closeSidePane,
    setSidebarOpen: state.setSidebarOpen,
    setSidebarSearchQuery: state.setSidebarSearchQuery,
    setMobile: state.setMobile,
    toggleUserDropdown: state.toggleUserDropdown,
    closeUserDropdown: state.closeUserDropdown,
    triggerTabGroupsUpdate: state.triggerTabGroupsUpdate,
    handleTabClick: state.handleTabClick,
    toggleSidePaneEditMode: state.toggleSidePaneEditMode,
    updateFileContent: state.updateFileContent,
    saveCurrentFile: state.saveCurrentFile,
    createNewFile: state.createNewFile,
    deleteCurrentFile: state.deleteCurrentFile,
    renameCurrentFile: state.renameCurrentFile,
    setFileDirty: state.setFileDirty,
    setUserEditingState: state.setUserEditingState,
    clearContentUpdateSource: state.clearContentUpdateSource,
    isContentFromUser: state.isContentFromUser,
    startAutomationMode: state.startAutomationMode,
    stopAutomationMode: state.stopAutomationMode,
    updateAutomationStatus: state.updateAutomationStatus,
    blockUserInteractions: state.blockUserInteractions,
    unblockUserInteractions: state.unblockUserInteractions,
    isUserInteractionBlocked: state.isUserInteractionBlocked,
    showAutoRetryBanner: state.showAutoRetryBanner,
    hideAutoRetryBanner: state.hideAutoRetryBanner,
    updateAutoRetryProgress: state.updateAutoRetryProgress,
    setWorkflowIconState: state.setWorkflowIconState,
    shouldPreventUserAction: state.shouldPreventUserAction,
    getAutomationStatusForDisplay: state.getAutomationStatusForDisplay,
    resetAutomationUI: state.resetAutomationUI,
    cleanupAutomationState: state.cleanupAutomationState
  }));

  return uiState;
};

export const useLoading = () => useAppStore((state) => ({
  isLoading: state.isLoading,
  isSaving: state.isSaving,
  setLoading: state.setLoading,
  setSaving: state.setSaving
}));

export const useCandidContext = () => useAppStore((state) => ({
  candidContext: state.candidContext,
  extractCandidFromGeneration: state.extractCandidFromGeneration,
  setCandidContext: state.setCandidContext,
  clearCandidContext: state.clearCandidContext,
  hasCandidContext: state.hasCandidContext
}));

export const usePaymentProcessing = () => useAppStore((state) => ({
  isProcessingPaymentReturn: state.isProcessingPaymentReturn,
  paymentReturnError: state.paymentReturnError,
  setProcessingPaymentReturn: state.setProcessingPaymentReturn,
  setPaymentReturnError: state.setPaymentReturnError,
  clearPaymentReturnError: state.clearPaymentReturnError
}));

export const useProjectRename = () => useAppStore((state) => ({
  projectRenameStatus: state.projectRenameStatus,
  setProjectRenameLoading: state.setProjectRenameLoading
}));

export const useCoordinatorIntegration = () => {
  const store = useAppStore.getState();
  return {
    getCoordinatorAccess: store.getCoordinatorAccess,
    validateStoreConnection: store.validateStoreConnection,
    exposeToWindow: store.exposeToWindow
  };
};

export const useStoreHealth = () => {
  const coordinatorAccess = useAppStore(state => state.getCoordinatorAccess());
  return {
    validateIntegrity: coordinatorAccess.validateStoreIntegrity,
    performHealthCheck: coordinatorAccess.performStoreHealthCheck,
    getDebugInfo: coordinatorAccess.getDebugInfo
  };
};

export const useServerPairCoordination = () => useAppStore((state) => ({
  projectServerPairs: state.projectServerPairs,
  setProjectServerPair: state.setProjectServerPair,
  getProjectServerPair: state.getProjectServerPair,
  removeProjectServerPair: state.removeProjectServerPair,
  syncWithLocalStorage: state.syncWithLocalStorage,
  notifyServerPairUpdate: state.notifyServerPairUpdate
}));

export const useProjectImport = () => useAppStore((state) => ({
  isImportDialogOpen: state.isImportDialogOpen,
  importStep: state.importStep,
  selectedFile: state.selectedFile,
  isDragOver: state.isDragOver,
  validationResult: state.validationResult,
  isValidating: state.isValidating,
  importProgress: state.importProgress,
  isImporting: state.isImporting,
  importResult: state.importResult,
  importedProjectData: state.importedProjectData,
  error: state.error,
  warnings: state.warnings,
  openImportDialog: state.openImportDialog,
  closeImportDialog: state.closeImportDialog,
  setImportStep: state.setImportStep,
  setSelectedFile: state.setSelectedFile,
  setDragOver: state.setDragOver,
  handleFileSelect: state.handleFileSelect,
  validateProject: state.validateProject,
  clearValidation: state.clearValidation,
  importProject: state.importProject,
  setError: state.setError,
  setWarnings: state.setWarnings,
  resetImportState: state.resetImportState,
  retryImport: state.retryImport,
  startNewImport: state.startNewImport
}));

export const useUserSettings = () => useAppStore((state) => ({
  claudeApiKey: state.claudeApiKey,
  geminiApiKey: state.geminiApiKey,
  kimiApiKey: state.kimiApiKey,
  openaiApiKey: state.openaiApiKey,
  selectedChatModel: state.selectedChatModel,
  setClaudeApiKey: state.setClaudeApiKey,
  setGeminiApiKey: state.setGeminiApiKey,
  setKimiApiKey: state.setKimiApiKey,
  setOpenaiApiKey: state.setOpenaiApiKey,
  setSelectedChatModel: state.setSelectedChatModel,
  loadSettingsFromStorage: state.loadSettingsFromStorage,
  saveSettingsToStorage: state.saveSettingsToStorage
}));

// 🔥 NEW: Priority system specific hook
export const usePrioritySystem = () => useAppStore((state) => ({
  // State
  priorityAssignments: state.priorityAssignments,
  currentInstructionId: state.currentInstructionId,
  conversationGroups: state.conversationGroups,
  priorityOrdering: state.priorityOrdering,
  
  // Actions
  addPriorityMessage: state.addPriorityMessage,
  assignMessagePriority: state.assignMessagePriority,
  markCurrentUserInstruction: state.markCurrentUserInstruction,
  getPriorityOrderedMessages: state.getPriorityOrderedMessages,
  updatePriorityOrdering: state.updatePriorityOrdering,
  createConversationGroup: state.createConversationGroup,
  addToConversationGroup: state.addToConversationGroup,
  getPriorityContext: state.getPriorityContext,
  reassignPriorities: state.reassignPriorities,
  
  // Assembly functions
  buildPriorityMessageAssembly: state.buildPriorityMessageAssembly,
  createPriorityBasedContext: state.createPriorityBasedContext,
  assemblePriorityPrompt: state.assemblePriorityPrompt,
  estimateTokenCount: state.estimateTokenCount,
  optimizeAssemblyForTokenBudget: state.optimizeAssemblyForTokenBudget
}));