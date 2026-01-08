import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Principal } from '@dfinity/principal';
import { useAppStore } from '../../store/appStore';
import { AgencyService } from '../../services/AgencyService';
import { AgentDeploymentService } from '../../services/AgentDeploymentService';
import { WorkflowCanvas } from './WorkflowCanvas';
import { convertWorkflowToAgentSteps, convertAgentStepsToWorkflow } from './utils';
import { userCanisterService } from '../../services/UserCanisterService';
import { 
  getSelectedServerPairForProject, 
  setSelectedServerPairForProject 
} from '../../services/CanisterStateService';
import { WorkflowExecutionMonitor } from '../WorkflowExecutionMonitor';
import { AgentOperationProgressOverlay, type AgentOperationProgress } from '../AgentOperationProgressOverlay';
import type {
  Agency,
  AgentStep,
  AgentConnection,
  Execution,
  TriggerConfig,
  AgentMetrics,
  ActivityEvent,
  ErrorLog,
  Approval,
  ScheduleType,
  ConditionType,
  TriggerType,
  RetryConfig,
  ExecutionLimits
} from '../../services/AgencyService';

// Enhanced types for UI state
interface UIState {
  loading: boolean;
  initialLoading: boolean; // Only true on first load, not during refreshes
  error: string | null;
  initialized: boolean;
  initializing: boolean;
  selectedAgency: Agency | null;
  selectedExecution: Execution | null;
  showCreateForm: boolean;
  showAdvancedEditor: boolean;
  showExecutionDetails: boolean;
  showTriggerForm: boolean;
  showMetrics: boolean;
  showActivity: boolean;
  showApprovals: boolean;
  showErrors: boolean;
  activeTab: 'agencies' | 'executions' | 'triggers' | 'monitoring' | 'approvals';
  activeView: 'dashboard' | 'templates' | 'simple-builder';
  isFullscreen: boolean;
  frontendUrl?: string; // URL to the independent agency workflow UI
}

interface FormData {
  name: string;
  description: string;
  steps: AgentStep[];
  connections?: AgentConnection[]; // NEW: Track connections
  executionMode: 'sequential' | 'parallel' | 'conditional';
}

interface TriggerFormData {
  name: string;
  description: string;
  triggerType: 'scheduled' | 'condition' | 'webhook' | 'manual';
  inputTemplate: string;
  scheduleType?: 'interval' | 'cron' | 'once' | 'recurring';
  intervalSeconds?: number;
  cronExpression?: string;
  onceTimestamp?: number;
  conditionType?: 'threshold' | 'http_check' | 'webhook' | 'custom';
  webhookSource?: string;
  webhookSignature?: string;
  enabled: boolean;
}

interface AgentStepFormData {
  agentCanisterId: string;
  agentName: string;
  inputTemplate: string;
  requiresApproval: boolean;
  retryOnFailure: boolean;
  timeout?: number;
}

interface ServerPair {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  steps: AgentStep[];
  executionMode: 'sequential' | 'parallel' | 'conditional';
}

// Stable store selector to prevent re-renders
const selectStoreData = (state: any) => ({
  identity: state.identity,
  userCanisterId: state.userCanisterId,
  activeProject: state.activeProject,
  projects: state.projects,
  isAuthenticated: state.isAuthenticated,
  stage: state.stage,
  isReady: state.isReady,
  currentProject: state.activeProject ? state.projects.find((p: any) => p.id === state.activeProject) || null : null
});

// Local storage keys for persistence
const getInitializationKey = (projectId: string) => `agency-initialized-${projectId}`;
const getServerPairKey = (projectId: string) => `agency-server-pair-${projectId}`;

// Mobile responsiveness helper
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

export const AgenciesManagementInterface: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  console.log('🏢 [AgencyManagement] Component initializing...');
  
  // Mobile detection
  const isMobile = useIsMobile();
  
  // FIXED: Single stable store subscription to prevent infinite re-renders
  const stableStoreData = useAppStore(selectStoreData);
  
  // Extract values from stable store data
  const { 
    identity, 
    userCanisterId, 
    activeProject,
    currentProject,
    isAuthenticated,
    isReady 
  } = stableStoreData;

  console.log('🏢 [AgencyManagement] Store state analysis:', {
    hasIdentity: !!identity,
    identityType: identity?.constructor?.name,
    identityPrincipal: identity?.getPrincipal?.()?.toString(),
    userCanisterId,
    userCanisterIdType: typeof userCanisterId,
    userCanisterIdLength: userCanisterId?.length,
    activeProject,
    hasCurrentProject: !!currentProject,
    currentProjectId: currentProject?.id,
    currentProjectName: currentProject?.name,
    isAuthenticated,
    timestamp: new Date().toISOString()
  });

  // FIXED: Stable UI state with proper initial values and persistence check
  const [uiState, setUIState] = useState<UIState>(() => {
    const initialized = activeProject ? localStorage.getItem(getInitializationKey(activeProject)) === 'true' : false;
    const frontendUrl = activeProject ? localStorage.getItem(`agency-frontend-url-${activeProject}`) || undefined : undefined;
    return {
      loading: false,
      initialLoading: true, // Start with initial loading true
      error: null,
      initialized,
      frontendUrl: frontendUrl || undefined,
      initializing: false,
      selectedAgency: null,
      selectedExecution: null,
      showCreateForm: false,
      showAdvancedEditor: false,
      showExecutionDetails: false,
      showTriggerForm: false,
      showMetrics: false,
      showActivity: false,
      showApprovals: false,
      showErrors: false,
      activeTab: 'agencies',
      activeView: 'dashboard',
      isFullscreen: false
    };
  });

  // Data State
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [hasInitialSave, setHasInitialSave] = useState(false); // Track if agency has been saved at least once
  const [currentAgencyId, setCurrentAgencyId] = useState<string | null>(null); // Track current agency ID if editing
  const [showSaveAgencyModal, setShowSaveAgencyModal] = useState(false);
  const [saveAgencyName, setSaveAgencyName] = useState('');
  const [saveAgencyDescription, setSaveAgencyDescription] = useState('');
  const [showDeleteAgencyModal, setShowDeleteAgencyModal] = useState(false);
  const [agencyToDelete, setAgencyToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showTemplateAgentSelector, setShowTemplateAgentSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [templateAgentSelections, setTemplateAgentSelections] = useState<Map<number, string>>(new Map());
  // Track agency ID for workflow reuse (prevents creating new workflow on each execution)
  const [workflowAgencyIdMap, setWorkflowAgencyIdMap] = useState<Map<string, string>>(new Map()); // Maps workflow name to agency ID
  const [triggers, setTriggers] = useState<TriggerConfig[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [registeredAgents, setRegisteredAgents] = useState<Array<{ canisterId: string; name: string }>>([]);
  const [deploymentProgress, setDeploymentProgress] = useState<{
    stage: string;
    message: string;
    percent: number;
  } | null>(null);

  // Server pair management state
  const [serverPairs, setServerPairs] = useState<ServerPair[]>([]);
  const [selectedServerPair, setSelectedServerPair] = useState<string>('');
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const [showServerPairDialog, setShowServerPairDialog] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showChangeServerModal, setShowChangeServerModal] = useState(false);
  const [resetWithNewServerPair, setResetWithNewServerPair] = useState(false);

  // Form State
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    steps: [],
    executionMode: 'sequential'
  });

  // Memoize callbacks to prevent infinite loops
  const handleWorkflowChange = useCallback((agentSteps: AgentStep[]) => {
    setFormData(prev => ({ ...prev, steps: agentSteps }));
  }, []);

  // NEW: Handle connections changes
  const handleConnectionsChange = useCallback((connections: AgentConnection[]) => {
    setFormData(prev => ({ ...prev, connections }));
  }, []);

  const handleExecutionModeChange = useCallback((mode: 'sequential' | 'parallel' | 'conditional') => {
    setFormData(prev => ({ ...prev, executionMode: mode }));
  }, []);

  const [triggerFormData, setTriggerFormData] = useState<TriggerFormData>({
    name: '',
    description: '',
    triggerType: 'manual',
    inputTemplate: '{input}',
    enabled: true
  });

  const [stepFormData, setStepFormData] = useState<AgentStepFormData>({
    agentCanisterId: '',
    agentName: '',
    inputTemplate: '{input}',
    requiresApproval: false,
    retryOnFailure: true
  });

  const [executionInput, setExecutionInput] = useState('');
  const [executionProgress, setExecutionProgress] = useState<AgentOperationProgress | null>(null);
  const [resetProgress, setResetProgress] = useState<AgentOperationProgress | null>(null);

  // FIXED: Use refs to prevent infinite loops
  const initializationAttemptedRef = useRef(false);
  const loadingDataRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  // FIXED: Stable helper function to update UI state
  const updateUIState = useCallback((updates: Partial<UIState>) => {
    // Removed console.logs to prevent infinite loops
    setUIState(prev => ({ ...prev, ...updates }));
  }, []);

  // FIXED: Check if system is ready with stable values
  const systemReady = isAuthenticated && identity && userCanisterId && currentProject;
  
  console.log('🎯 [AgencyManagement] Readiness check:', {
    isAuthenticated,
    hasIdentity: !!identity,
    hasUserCanisterId: !!userCanisterId,
    hasCurrentProject: !!currentProject,
    systemReady,
    readinessFormula: `${isAuthenticated} && ${!!identity} && ${!!userCanisterId} && ${!!currentProject} = ${systemReady}`
  });

  // Check initialization status from localStorage when project changes
  useEffect(() => {
    if (activeProject) {
      const loadInitialState = async () => {
        const initialized = localStorage.getItem(getInitializationKey(activeProject)) === 'true';
        const savedFrontendUrl = localStorage.getItem(`agency-frontend-url-${activeProject}`);
        
        // Load server pair from canister
        try {
          const savedServerPair = await getSelectedServerPairForProject(activeProject);
          
          updateUIState({ 
            initialized,
            frontendUrl: savedFrontendUrl || undefined
          });
          
          if (savedServerPair) {
            setSelectedServerPair(savedServerPair);
          }
          
          console.log('🏢 [AgencyManagement] Persistence check:', {
            projectId: activeProject,
            initialized,
            savedServerPair,
            frontendUrl: savedFrontendUrl || 'none'
          });
        } catch (error) {
          console.error('[AgenciesManagement] Failed to load server pair:', error);
          // NO FALLBACK - always use fresh data from backend
        }
      };
      
      loadInitialState();
    }
  }, [activeProject]);

  // FIXED: Load server pairs with stable dependencies  
  useEffect(() => {
    const loadServerPairs = async () => {
      if (!userCanisterId || !identity || !activeProject) {
        console.log('🏢 [AgencyManagement] ServerPairs loading skipped - missing prerequisites');
        return;
      }

      try {
        console.log('🏢 [AgencyManagement] Starting server pairs loading...');
        setIsLoadingServers(true);
        
        const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
        const serverPairsResult = await userActor.getProjectServerPairs(activeProject);

        if (serverPairsResult && 'ok' in serverPairsResult) {
          const pairs = serverPairsResult.ok.map((pair: any) => ({
            pairId: pair.pairId,
            name: pair.name,
            createdAt: Number(pair.createdAt) / 1_000_000,
            creditsAllocated: Number(pair.creditsAllocated),
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          
          setServerPairs(pairs);
          console.log('✅ [AgencyManagement] Server pairs loaded:', pairs.length);
          
          // Restore or auto-select server pair from canister
          try {
            const savedServerPair = await getSelectedServerPairForProject(activeProject);
            if (savedServerPair && pairs.find(p => p.pairId === savedServerPair)) {
              setSelectedServerPair(savedServerPair);
            } else if (!selectedServerPair && pairs.length > 0) {
              const firstPair = pairs[0].pairId;
              setSelectedServerPair(firstPair);
              // Save auto-selected pair
              await setSelectedServerPairForProject(activeProject, firstPair);
            }
          } catch (error) {
            console.error('❌ [AgencyManagement] Failed to restore server pair:', error);
            // NO FALLBACK - if backend fails, user must manually select
            if (!selectedServerPair && pairs.length > 0) {
              setSelectedServerPair(pairs[0].pairId);
            }
          }
        }
      } catch (error) {
        console.error('❌ [AgencyManagement] Failed to load server pairs:', error);
      } finally {
        setIsLoadingServers(false);
      }
    };

    loadServerPairs();
  }, [userCanisterId, identity, activeProject, selectedServerPair]);

  // FIXED: Initialize the agency workflow system with proper state management and persistence
  const initializeAgencyWorkflow = useCallback(async () => {
    if (!systemReady || initializationAttemptedRef.current) {
      console.log('⚠️ [AgencyManagement] System not ready or already attempted initialization');
      return;
    }

    if (!selectedServerPair) {
      const errorMsg = 'Please select a server pair first.';
      console.log('⚠️ [AgencyManagement]', errorMsg);
      updateUIState({ error: errorMsg });
      return;
    }

    console.log('🚀 [AgencyManagement] All prerequisites met, proceeding with initialization...');
    initializationAttemptedRef.current = true;
    updateUIState({ initializing: true, error: null });
    setDeploymentProgress(null);
    setShowServerPairDialog(false);

    try {
      console.log('🏢 [AgencyManagement] Checking if already initialized...');
      
      const checkResult = await AgencyService.checkInitialized(
        currentProject.id,
        userCanisterId,
        identity
      );

      if (checkResult.initialized) {
        console.log('✅ [AgencyManagement] Agency workflow already initialized');
        
        // Save initialization state to localStorage
        localStorage.setItem(getInitializationKey(activeProject), 'true');
        
        // Save server pair to canister - NO FALLBACK
        try {
          await setSelectedServerPairForProject(activeProject, selectedServerPair);
        } catch (error) {
          console.error('❌ [AgencyManagement] Failed to save server pair to canister:', error);
          // NO FALLBACK - if this fails, it should be visible to the user
        }
        
        // Load saved frontend URL if available, or construct from server pair
        let savedFrontendUrl = localStorage.getItem(`agency-frontend-url-${activeProject}`);
        if (!savedFrontendUrl) {
          const serverPair = serverPairs.find(p => p.pairId === selectedServerPair);
          if (serverPair?.frontendCanisterId) {
            savedFrontendUrl = `https://${serverPair.frontendCanisterId}.icp0.io`;
            localStorage.setItem(`agency-frontend-url-${activeProject}`, savedFrontendUrl);
            console.log(`🎨 [AgencyManagement] Constructed frontend URL from server pair: ${savedFrontendUrl}`);
          }
        }
        
        updateUIState({ 
          initialized: true, 
          initializing: false,
          frontendUrl: savedFrontendUrl || undefined
        });
        // Call loadAllData after state is updated
        setTimeout(() => loadAllData(), 100);
        return;
      }

      console.log('🔧 [AgencyManagement] Agency workflow not initialized, deploying...');
      
      const availableServerPair = serverPairs.find(pair => 
        pair.pairId === selectedServerPair && 
        pair.backendCanisterId
      );

      if (!availableServerPair) {
        throw new Error('Selected server pair not found or invalid.');
      }

      const deployResult = await AgentDeploymentService.deployAgencyWorkflow({
        projectId: currentProject.id,
        serverPairId: availableServerPair.pairId,
        backendCanisterId: availableServerPair.backendCanisterId,
        frontendCanisterId: availableServerPair.frontendCanisterId, // Include frontend canister for UI deployment
        userCanisterId: userCanisterId,
        identity: identity,
        principal: identity.getPrincipal()
      }, (progress) => {
        setDeploymentProgress(progress);
      });

      if (deployResult.success) {
        console.log('✅ [AgencyManagement] Agency workflow deployment successful');
        
        // Save initialization state to localStorage
        localStorage.setItem(getInitializationKey(activeProject), 'true');
        
        // Save server pair to canister - NO FALLBACK
        try {
          await setSelectedServerPairForProject(activeProject, selectedServerPair);
        } catch (error) {
          console.error('❌ [AgencyManagement] Failed to save server pair to canister:', error);
          // NO FALLBACK - if this fails, it should be visible to the user
        }
        
        // Get frontend URL from deployment result, or construct from server pair
        let frontendUrl = deployResult.frontendUrl;
        if (!frontendUrl && availableServerPair?.frontendCanisterId) {
          frontendUrl = `https://${availableServerPair.frontendCanisterId}.icp0.io`;
          console.log(`🎨 [AgencyManagement] Constructed frontend URL from server pair: ${frontendUrl}`);
        }
        
        // Save frontend URL if available
        if (frontendUrl) {
          localStorage.setItem(`agency-frontend-url-${activeProject}`, frontendUrl);
          console.log(`🎨 [AgencyManagement] Frontend UI available at: ${frontendUrl}`);
        }
        
        updateUIState({ 
          initialized: true, 
          initializing: false, 
          error: null,
          frontendUrl: frontendUrl
        });
        setDeploymentProgress(null);
        // Call loadAllData after state is updated
        setTimeout(() => loadAllData(), 100);
      } else {
        console.error('❌ [AgencyManagement] Failed to initialize agency workflow:', deployResult.error);
        updateUIState({ 
          initialized: false, 
          initializing: false,
          error: `Initialization failed: ${deployResult.error}` 
        });
        setDeploymentProgress(null);
        initializationAttemptedRef.current = false; // Allow retry
      }
    } catch (error) {
      console.error('❌ [AgencyManagement] Agency workflow initialization error:', error);
      updateUIState({ 
        initialized: false, 
        initializing: false,
        error: error instanceof Error ? error.message : 'Unknown initialization error'
      });
      setDeploymentProgress(null);
      initializationAttemptedRef.current = false; // Allow retry
    }
  }, [systemReady, currentProject, userCanisterId, identity, selectedServerPair, serverPairs, updateUIState, activeProject]);

  // Reset workflow data and redeploy from scratch (optionally with new server pair)
  const resetAgencyWorkflow = useCallback(async (showServerPairSelection: boolean = false) => {
    if (!systemReady || !currentProject) {
      return;
    }

    // Show confirmation modal instead of window.confirm
    setResetWithNewServerPair(showServerPairSelection);
    setShowResetConfirmModal(true);
  }, [systemReady, currentProject]);

  // Actually perform the reset after confirmation
  const performReset = useCallback(async () => {
    if (!systemReady || !currentProject) {
      return;
    }

    setShowResetConfirmModal(false);
    updateUIState({ initializing: true, error: null });
    setDeploymentProgress(null);
    const startTime = Date.now();

    // Show reset progress overlay
    setResetProgress({
      phase: 'initializing',
      message: 'Preparing to reset agency workflow system...',
      timeMs: 0,
      percentage: 0
    });

    // Update progress timer
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setResetProgress(prev => prev ? {
        ...prev,
        timeMs: elapsed
      } : null);
    }, 100);

    try {
      console.log('🔄 [AgencyManagement] Resetting agency workflow...');

      const resetResult = await AgencyService.resetAgencyWorkflow(
        currentProject.id,
        userCanisterId,
        identity,
        (progress) => {
          // Update both deployment progress (for initialization screen) and reset progress overlay
          setDeploymentProgress({
            stage: progress.stage,
            message: progress.message,
            percent: progress.percent
          });

          // Map deployment progress stages to reset progress phases
          let phase = 'processing';
          let message = progress.message;
          
          if (progress.stage === 'complete') {
            phase = 'complete';
            message = 'Agency workflow reset complete!';
          } else if (progress.stage === 'error') {
            phase = 'error';
          } else if (progress.stage.includes('deploy') || progress.stage === 'backend' || progress.stage === 'frontend') {
            phase = 'deploying';
            message = `Deploying workflow: ${progress.message}`;
          } else if (progress.stage === 'initializing') {
            phase = 'initializing';
            message = `Initializing: ${progress.message}`;
          }

          setResetProgress({
            phase,
            message,
            timeMs: Date.now() - startTime,
            percentage: progress.percent
          });
        }
      );

      clearInterval(progressInterval);
      const totalTime = Date.now() - startTime;

      if (resetResult.success) {
        console.log('✅ [AgencyManagement] Agency workflow reset successful');
        
        // Update progress to show success
        setResetProgress({
          phase: 'complete',
          message: 'Agency workflow reset successfully! Re-initializing...',
          timeMs: totalTime,
          percentage: 100
        });

        // Clear initialization state from localStorage (keep initialization state, remove server pair key)
        localStorage.removeItem(getInitializationKey(activeProject));
        localStorage.removeItem(`agency-frontend-url-${activeProject}`);
        
        // Reset state
        updateUIState({ initialized: false, initializing: false, error: null, frontendUrl: undefined });
        setDeploymentProgress(null);
        initializationAttemptedRef.current = false; // Allow re-initialization
        
        // Clear reset progress after a brief delay
        setTimeout(() => {
          setResetProgress(null);
          
          // If showing server pair selection, open the dialog; otherwise re-initialize with same pair
          if (resetWithNewServerPair) {
            setShowServerPairDialog(true);
            setUserDismissedDialog(false); // Reset when user explicitly wants to initialize
          } else {
            // Re-initialize the workflow with the same server pair
            setTimeout(() => {
              initializeAgencyWorkflow();
            }, 1000);
          }
        }, 2000);
      } else {
        console.error('❌ [AgencyManagement] Failed to reset agency workflow:', resetResult.error);
        setResetProgress({
          phase: 'error',
          message: `Reset failed: ${resetResult.error}`,
          timeMs: totalTime,
          percentage: 0
        });
        setTimeout(() => {
          setResetProgress(null);
        }, 3000);
        updateUIState({ 
          initialized: false, 
          initializing: false,
          error: `Reset failed: ${resetResult.error}` 
        });
        setDeploymentProgress(null);
        initializationAttemptedRef.current = false;
      }
      } catch (error) {
      clearInterval(progressInterval);
      const totalTime = Date.now() - startTime;
      console.error('❌ [AgencyManagement] Agency workflow reset error:', error);
      setResetProgress({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Unknown reset error',
        timeMs: totalTime,
        percentage: 0
      });
      setTimeout(() => {
        setResetProgress(null);
      }, 3000);
      updateUIState({ 
        initialized: false, 
        initializing: false,
        error: error instanceof Error ? error.message : 'Unknown reset error'
      });
      setDeploymentProgress(null);
      initializationAttemptedRef.current = false;
    }
  }, [systemReady, currentProject, userCanisterId, identity, resetWithNewServerPair, activeProject, updateUIState, initializeAgencyWorkflow]);

  // FIXED: Load all data with proper guards and stable dependencies
  // Removed agencies.length and executions.length from deps to prevent infinite loops
  const loadAllData = useCallback(async () => {
    if (!systemReady || loadingDataRef.current) {
      console.log('⚠️ [AgencyManagement] Skipping loadAllData - system not ready or already loading');
      return;
    }
    
    console.log('📊 [AgencyManagement] Starting loadAllData...');
    loadingDataRef.current = true;
    
    // Only show full loading spinner on initial load (when we have no data)
    const isInitialLoad = agencies.length === 0 && executions.length === 0;
    if (isInitialLoad) {
      updateUIState({ loading: true, initialLoading: true });
    } else {
      // For background refreshes, just set a subtle loading indicator
      updateUIState({ loading: true, initialLoading: false });
    }

    try {
      await Promise.all([
        loadAgencies(),
        loadExecutions(),
        loadActivities(),
        loadErrors(),
        loadApprovals(),
        loadRegisteredAgents()
      ]);
      
      console.log('✅ [AgencyManagement] All data loaded successfully');
    } catch (error) {
      console.error('❌ [AgencyManagement] Failed to load data:', error);
      updateUIState({ error: error instanceof Error ? error.message : 'Failed to load data' });
    } finally {
      loadingDataRef.current = false;
      updateUIState({ loading: false, initialLoading: false });
      hasLoadedOnceRef.current = true; // Mark that we've loaded at least once
    }
  }, [systemReady, currentProject?.id, userCanisterId, identity]); // Removed agencies.length and executions.length to prevent infinite loops

  // FIXED: Individual load functions with stable dependencies
  const loadAgencies = useCallback(async () => {
    if (!systemReady) return;

    try {
      const result = await AgencyService.getAgencies(
        currentProject.id,
        userCanisterId,
        identity
      );

      if (result.success) {
        setAgencies(result.agencies);
        console.log(`✅ [AgencyManagement] Loaded ${result.agencies.length} agencies`);
      } else {
        console.error('❌ [AgencyManagement] Failed to load agencies:', result.error);
        updateUIState({ error: result.error || 'Failed to load agencies' });
      }
    } catch (error) {
      console.error('❌ [AgencyManagement] Error loading agencies:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateUIState({ error: errorMsg });
    }
  }, [systemReady, currentProject?.id, userCanisterId, identity]);

  const loadExecutions = useCallback(async () => {
    if (!systemReady) return;

    try {
      const result = await AgencyService.getAllExecutions(
        currentProject.id,
        userCanisterId,
        identity
      );

      if (result.success) {
        setExecutions(result.executions);
        console.log(`✅ [AgencyManagement] Loaded ${result.executions.length} executions`);
      } else {
        console.error('❌ [AgencyManagement] Failed to load executions:', result.error);
        updateUIState({ error: result.error || 'Failed to load executions' });
      }
    } catch (error) {
      console.error('❌ [AgencyManagement] Error loading executions:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateUIState({ error: errorMsg });
    }
  }, [systemReady, currentProject?.id, userCanisterId, identity]);

  const loadActivities = useCallback(async () => {
    if (!systemReady) return;

    try {
      const result = await AgencyService.getRecentActivity(
        50,
        currentProject.id,
        userCanisterId,
        identity
      );

      if (result.success) {
        setActivities(result.activities);
        console.log(`✅ [AgencyManagement] Loaded ${result.activities.length} activities`);
      } else {
        console.error('❌ [AgencyManagement] Failed to load activities:', result.error);
      }
    } catch (error) {
      console.error('❌ [AgencyManagement] Error loading activities:', error);
    }
  }, [systemReady, currentProject?.id, userCanisterId, identity]);

  const loadErrors = useCallback(async () => {
    if (!systemReady) return;

    try {
      const result = await AgencyService.getActiveErrors(
        currentProject.id,
        userCanisterId,
        identity
      );

      if (result.success) {
        setErrors(result.errors);
        console.log(`✅ [AgencyManagement] Loaded ${result.errors.length} errors`);
      } else {
        console.error('❌ [AgencyManagement] Failed to load errors:', result.error);
      }
    } catch (error) {
      console.error('❌ [AgencyManagement] Error loading errors:', error);
    }
  }, [systemReady, currentProject?.id, userCanisterId, identity]);

  const loadApprovals = useCallback(async () => {
    if (!systemReady) return;

    try {
      const result = await AgencyService.getPendingApprovals(
        currentProject.id,
        userCanisterId,
        identity
      );

      if (result.success) {
        setApprovals(result.approvals);
        console.log(`✅ [AgencyManagement] Loaded ${result.approvals.length} approvals`);
      } else {
        console.error('❌ [AgencyManagement] Failed to load approvals:', result.error);
      }
    } catch (error) {
      console.error('❌ [AgencyManagement] Error loading approvals:', error);
    }
  }, [systemReady, currentProject?.id, userCanisterId, identity]);

  // Load triggers for a specific agency
  const loadTriggers = useCallback(async (agencyId: string) => {
    if (!systemReady || !agencyId) return;

    try {
      const result = await AgencyService.getAgencyTriggers(
        agencyId,
        currentProject.id,
        userCanisterId,
        identity
      );

      if (result.success) {
        setTriggers(result.triggers);
        console.log(`✅ [AgencyManagement] Loaded ${result.triggers.length} triggers for agency ${agencyId}`);
      } else {
        console.error('❌ [AgencyManagement] Failed to load triggers:', result.error);
        setTriggers([]);
      }
    } catch (error) {
      console.error('❌ [AgencyManagement] Error loading triggers:', error);
      setTriggers([]);
    }
  }, [systemReady, currentProject?.id, userCanisterId, identity]);

  // Trigger management functions
  const handleCreateScheduledTrigger = useCallback(async (
    name: string,
    description: string,
    schedule: ScheduleType,
    inputTemplate: string,
    retryConfig?: RetryConfig,
    executionLimits?: ExecutionLimits
  ) => {
    if (!currentAgencyId || !systemReady) {
      throw new Error('No agency selected');
    }

    const result = await AgencyService.createScheduledTrigger({
      agencyId: currentAgencyId,
      name,
      description,
      schedule,
      inputTemplate,
      retryConfig,
      executionLimits
    }, currentProject.id, userCanisterId, identity);

    if (result.success) {
      await loadTriggers(currentAgencyId);
      return result;
    } else {
      throw new Error(result.error || 'Failed to create trigger');
    }
  }, [currentAgencyId, systemReady, currentProject?.id, userCanisterId, identity, loadTriggers]);

  const handleCreateWebhookTrigger = useCallback(async (
    name: string,
    description: string,
    source: string,
    signature: string | undefined,
    inputTemplate: string,
    retryConfig?: RetryConfig,
    executionLimits?: ExecutionLimits
  ) => {
    if (!currentAgencyId || !systemReady) {
      throw new Error('No agency selected');
    }

    const result = await AgencyService.createWebhookTrigger({
      agencyId: currentAgencyId,
      name,
      description,
      source,
      signature,
      inputTemplate,
      retryConfig,
      executionLimits
    }, currentProject.id, userCanisterId, identity);

    if (result.success) {
      await loadTriggers(currentAgencyId);
      return result;
    } else {
      throw new Error(result.error || 'Failed to create trigger');
    }
  }, [currentAgencyId, systemReady, currentProject?.id, userCanisterId, identity, loadTriggers]);

  const handleCreateConditionTrigger = useCallback(async (
    name: string,
    description: string,
    condition: ConditionType,
    inputTemplate: string,
    retryConfig?: RetryConfig,
    executionLimits?: ExecutionLimits
  ) => {
    if (!currentAgencyId || !systemReady) {
      throw new Error('No agency selected');
    }

    const result = await AgencyService.createConditionTrigger({
      agencyId: currentAgencyId,
      name,
      description,
      condition,
      inputTemplate,
      retryConfig,
      executionLimits
    }, currentProject.id, userCanisterId, identity);

    if (result.success) {
      await loadTriggers(currentAgencyId);
      return result;
    } else {
      throw new Error(result.error || 'Failed to create trigger');
    }
  }, [currentAgencyId, systemReady, currentProject?.id, userCanisterId, identity, loadTriggers]);

  const handleToggleTrigger = useCallback(async (triggerId: string) => {
    if (!currentAgencyId || !systemReady) return;

    try {
      const agency = agencies.find(a => a.id === currentAgencyId);
      if (!agency) return;

      const trigger = triggers.find(t => t.id === triggerId);
      if (!trigger) return;

      const result = await AgencyService.toggleAgencyTrigger(
        currentAgencyId,
        triggerId,
        currentProject.id,
        userCanisterId,
        identity
      );

      if (result.success) {
        await loadTriggers(currentAgencyId);
      } else {
        throw new Error(result.error || 'Failed to toggle trigger');
      }
    } catch (error) {
      console.error('Failed to toggle trigger:', error);
      throw error;
    }
  }, [currentAgencyId, systemReady, currentProject?.id, userCanisterId, identity, agencies, triggers, loadTriggers]);

  const handleDeleteTrigger = useCallback(async (triggerId: string) => {
    if (!currentAgencyId || !systemReady) return;

    try {
      const result = await AgencyService.deleteAgencyTrigger(
        currentAgencyId,
        triggerId,
        currentProject.id,
        userCanisterId,
        identity
      );

      if (result.success) {
        await loadTriggers(currentAgencyId);
      } else {
        throw new Error(result.error || 'Failed to delete trigger');
      }
    } catch (error) {
      console.error('Failed to delete trigger:', error);
      throw error;
    }
  }, [currentAgencyId, systemReady, currentProject?.id, userCanisterId, identity, loadTriggers]);

  const handleExecuteTrigger = useCallback(async (triggerId: string) => {
    if (!currentAgencyId || !systemReady) return;

    try {
      const result = await AgencyService.executeAgencyTrigger(
        currentAgencyId,
        triggerId,
        currentProject.id,
        userCanisterId,
        identity
      );

      if (result.success) {
        await loadExecutions();
      } else {
        throw new Error(result.error || 'Failed to execute trigger');
      }
    } catch (error) {
      console.error('Failed to execute trigger:', error);
      throw error;
    }
  }, [currentAgencyId, systemReady, currentProject?.id, userCanisterId, identity, loadExecutions]);

  const loadRegisteredAgents = useCallback(async () => {
    if (!systemReady || !activeProject) return;

    try {
      // Load deployed agents from localStorage (same storage as single agent interface)
      const stored = localStorage.getItem(`deployed-agents-${activeProject}`);
      let agents: Array<{ canisterId: string; name: string }> = [];

      if (stored) {
        try {
          const deployedAgents = JSON.parse(stored);
          // Filter to only active agents and extract their info
          // CRITICAL: Also filter out the agency workflow canister ID if we know it
          const selectedPair = selectedServerPair && serverPairs.length > 0 
            ? serverPairs.find((p: ServerPair) => p.pairId === selectedServerPair) 
            : null;
          const agencyWorkflowCanisterId = selectedPair?.backendCanisterId || null;
          
          const activeAgents = deployedAgents.filter((agent: any) => 
            agent.status === 'active' && 
            agent.backendCanisterId && 
            agent.name &&
            (!agencyWorkflowCanisterId || agent.backendCanisterId !== agencyWorkflowCanisterId) // Exclude agency workflow canister
          );
          
          agents = activeAgents.map((agent: any) => ({
            canisterId: agent.backendCanisterId,
            name: agent.name
          }));
          
          if (deployedAgents.length !== activeAgents.length) {
            console.log(`✅ [AgencyManagement] Loaded ${agents.length} deployed agents from localStorage (filtered out ${deployedAgents.length - activeAgents.length} agency workflow canisters)`);
          } else {
            console.log(`✅ [AgencyManagement] Loaded ${agents.length} deployed agents from localStorage`);
          }
        } catch (parseError) {
          console.warn('⚠️ [AgencyManagement] Failed to parse deployed agents from localStorage:', parseError);
        }
      }

      // Fallback: If no deployed agents found, use server pairs as before
      // (for backward compatibility, but this is less ideal)
      if (agents.length === 0) {
        agents = serverPairs
          .filter(pair => pair.backendCanisterId)
          .map(pair => ({
            canisterId: pair.backendCanisterId,
            name: pair.name || `Server Pair ${pair.pairId.slice(0, 8)}`
          }));
        
        console.log(`⚠️ [AgencyManagement] No deployed agents found, using ${agents.length} server pairs as fallback`);
      }

      setRegisteredAgents(agents);
      console.log(`✅ [AgencyManagement] Total ${agents.length} agent canisters available for workflows`);
    } catch (error) {
      console.error('❌ [AgencyManagement] Error loading registered agents:', error);
    }
  }, [systemReady, activeProject, serverPairs, selectedServerPair]);

  // Remaining callback functions (create, execute, etc.)
  // 🔧 FIX: Accept parameters directly to avoid stale closure issues
  const createAgency = useCallback(async (name?: string, description?: string, steps?: AgentStep[], connections?: AgentConnection[]) => {
    // Use provided parameters or fall back to formData state
    // 🔧 FIX: If name is provided (even if empty string), use it; otherwise fall back to formData
    // But if provided name is empty/whitespace, try formData as fallback
    let agencyName: string;
    if (name !== undefined) {
      const trimmedProvided = name.trim();
      agencyName = trimmedProvided || formData.name || '';
    } else {
      agencyName = formData.name || '';
    }
    
    const agencyDescription = description !== undefined ? description : (formData.description || '');
    const agencySteps = steps !== undefined ? steps : formData.steps;

    // 🔧 FIX: Validate name is provided with better error message
    const trimmedName = (agencyName || name || '').trim();
    if (!trimmedName) {
      console.error('❌ [AgencyManagement] createAgency called without name:', { 
        providedName: name, 
        formDataName: formData.name,
        agencyName,
        trimmedName
      });
      updateUIState({ error: 'Agency name is required' });
      return;
    }
    
    // Use the trimmed name for the actual creation
    const finalName = trimmedName;

    // Validate steps have valid canister IDs
    const validSteps = agencySteps.filter(step => 
      step.agentCanisterId && 
      step.agentCanisterId.trim() !== '' &&
      step.agentCanisterId.trim() !== 'aaaaa-aa'
    );
    
    if (validSteps.length === 0) {
      const errorMsg = agencySteps.length === 0
        ? 'Please add at least one agent step using the workflow canvas'
        : 'All agent steps must have valid canister IDs configured. Please configure agent canister IDs in the workflow editor before creating the agency.';
      updateUIState({ error: errorMsg });
      return;
    }
    
    if (validSteps.length < agencySteps.length) {
      console.warn(`⚠️ [AgencyManagement] Filtering out ${agencySteps.length - validSteps.length} steps with invalid canister IDs`);
      updateUIState({ 
        error: `${agencySteps.length - validSteps.length} step(s) have invalid or missing canister IDs and will be excluded. Please configure valid agent canister IDs for all steps.`,
      });
      // Continue with valid steps, but warn the user
    }
    
    // Use only valid steps
    const finalSteps = validSteps;

    // Validate userCanisterId before creating agency
    if (!userCanisterId || userCanisterId.trim() === '') {
      console.error('❌ [AgencyManagement] Invalid userCanisterId:', userCanisterId);
      updateUIState({ error: 'Invalid user canister ID. Please ensure you are properly authenticated.' });
      return;
    }

    // Validate Principal can be created from userCanisterId
    try {
      Principal.fromText(userCanisterId);
    } catch (error) {
      console.error('❌ [AgencyManagement] Invalid Principal format for userCanisterId:', userCanisterId, error);
      updateUIState({ error: `Invalid user canister ID format: ${userCanisterId}. Please check your authentication.` });
      return;
    }

    updateUIState({ loading: true, error: null });

    try {
      const result = await AgencyService.createAgency(
        finalName,
        agencyDescription || '',
        finalSteps, // Use validated steps
        currentProject.id,
        userCanisterId,
        identity,
        connections // NEW: Pass connections
      );

      if (result.success) {
        console.log('✅ [AgencyManagement] Agency created successfully:', result.agencyId);
        setHasInitialSave(true);
        setCurrentAgencyId(result.agencyId || null);
        setFormData({ name: '', description: '', steps: [], connections: [], executionMode: 'sequential' });
        updateUIState({ showCreateForm: false, showAdvancedEditor: false, activeView: 'dashboard', error: null });
        await loadAgencies();
      } else {
        updateUIState({ error: `Failed to create workflow: ${result.error}` });
      }
    } catch (error) {
      console.error('❌ [AgencyManagement] Error creating agency:', error);
      updateUIState({ error: error instanceof Error ? error.message : 'Failed to create workflow' });
    }

    updateUIState({ loading: false });
  }, [systemReady, formData, currentProject?.id, userCanisterId, identity, updateUIState, loadAgencies]);

  // Load triggers when agency is selected
  useEffect(() => {
    if (currentAgencyId && systemReady) {
      loadTriggers(currentAgencyId);
    } else {
      setTriggers([]);
    }
  }, [currentAgencyId, systemReady, loadTriggers]);

  const executeAgency = useCallback(async (agencyId: string, input: string) => {
    if (!systemReady) return;

    updateUIState({ loading: true, error: null });
    const startTime = Date.now();

    try {
      const agency = agencies.find(a => a.id === agencyId);
      const stepsCount = agency?.steps.length || 0;

      console.log('🚀 [AgencyManagement] Starting agency execution:', {
        agencyId,
        inputLength: input.length,
        stepsCount
      });

      // Show progress overlay
      setExecutionProgress({
        phase: 'initializing',
        message: `Preparing to execute workflow with ${stepsCount} agent${stepsCount !== 1 ? 's' : ''}...`,
        timeMs: 0
      });

      // Simulate progress updates during execution
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setExecutionProgress(prev => prev ? {
          ...prev,
          timeMs: elapsed,
          message: prev.message || 'Processing workflow execution...'
        } : null);
      }, 100);

      const result = await AgencyService.executeAgency(
        agencyId,
        input,
        currentProject.id,
        userCanisterId,
        identity
      );

      clearInterval(progressInterval);
      const totalTime = Date.now() - startTime;

      if (result.success) {
        console.log('✅ [AgencyManagement] Agency execution started:', {
          executionId: result.executionId,
          agencyId,
          inputLength: input.length
        });

        // Update progress to show success
        setExecutionProgress({
          phase: 'complete',
          message: `Workflow execution started successfully! Execution ID: ${result.executionId?.substring(0, 8)}...`,
          timeMs: totalTime
        });

        // Clear progress after a brief delay and transition to monitor
        setTimeout(() => {
          setExecutionProgress(null);
          setExecutionInput('');
          // Open execution monitor if execution ID is available
          if (result.executionId) {
            const execution = executions.find(e => e.id === result.executionId);
            if (execution) {
              updateUIState({ 
                selectedExecution: execution,
                showExecutionDetails: true 
              });
            } else {
              // Load executions to find the new one
              loadExecutions().then(() => {
                const newExecution = executions.find(e => e.id === result.executionId);
                if (newExecution) {
                  updateUIState({ 
                    selectedExecution: newExecution,
                    showExecutionDetails: true 
                  });
                }
              });
            }
          }
        }, 1500);

        await loadExecutions();
        
        // Log execution details for debugging
        setTimeout(async () => {
          await loadExecutions();
          const execution = executions.find(e => e.id === result.executionId);
          if (execution) {
            console.log('📊 [AgencyManagement] Execution details:', {
              id: execution.id,
              status: execution.status,
              currentStep: execution.currentStep,
              totalAgents: execution.totalAgents,
              resultsCount: execution.results.length,
              results: execution.results.map(r => ({
                stepIndex: r.stepIndex,
                agentName: r.agentName,
                success: r.success,
                hasOutput: !!r.output,
                hasError: !!r.error
              }))
            });
          }
        }, 1000);
      } else {
        console.error('❌ [AgencyManagement] Agency execution failed:', result.error);
        setExecutionProgress({
          phase: 'error',
          message: `Failed to execute workflow: ${result.error}`,
          timeMs: totalTime
        });
        setTimeout(() => {
          setExecutionProgress(null);
        }, 3000);
        updateUIState({ error: `Failed to execute agency: ${result.error}` });
      }
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('❌ [AgencyManagement] Error executing agency:', error);
      setExecutionProgress({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Failed to execute agency',
        timeMs: totalTime
      });
      setTimeout(() => {
        setExecutionProgress(null);
      }, 3000);
      updateUIState({ error: error instanceof Error ? error.message : 'Failed to execute agency' });
    }

    updateUIState({ loading: false });
  }, [systemReady, currentProject?.id, userCanisterId, identity, updateUIState, loadExecutions, agencies, executions]);

  // DISABLED: Auto-save is completely disabled
  // User must manually save the agency first with a name before any auto-save can occur
  // This prevents the confusing UX where changes are auto-saved before the user has even named the agency
  
  // REMOVED: Auto-save useEffect - completely disabled per user request

  const handleDeleteAgency = useCallback(async (agencyId: string) => {
    if (!systemReady) return;

    updateUIState({ loading: true, error: null });

    try {
      const result = await AgencyService.deleteAgency(
        agencyId,
        currentProject.id,
        userCanisterId,
        identity
      );

      if (result.success) {
        console.log('✅ [AgencyManagement] Agency deleted successfully:', agencyId);
        await loadAgencies();
        await loadExecutions();
      } else {
        updateUIState({ error: `Failed to delete workflow: ${result.error}` });
      }
    } catch (error) {
      console.error('❌ [AgencyManagement] Error deleting agency:', error);
      updateUIState({ error: error instanceof Error ? error.message : 'Failed to delete workflow' });
    }

    updateUIState({ loading: false });
  }, [systemReady, currentProject?.id, userCanisterId, identity, updateUIState, loadAgencies, loadExecutions]);

  // FIXED: Main initialization effect with stable dependencies
  // Only auto-show dialog if user hasn't explicitly closed it
  const [userDismissedDialog, setUserDismissedDialog] = useState(false);
  
  useEffect(() => {
    if (!systemReady || uiState.initialized || uiState.initializing || isLoadingServers || userDismissedDialog) {
      return;
    }

    if (serverPairs.length > 0 && !showServerPairDialog) {
      setShowServerPairDialog(true);
    }
  }, [systemReady, uiState.initialized, uiState.initializing, serverPairs.length, isLoadingServers, showServerPairDialog, userDismissedDialog]);

  // Load data once on mount/initialization, then refresh in background
  useEffect(() => {
    if (!uiState.initialized || !systemReady) {
      return;
    }

    // Load data immediately on first initialization
    if (!hasLoadedOnceRef.current) {
      console.log('🔄 [AgencyManagement] Initial data load');
      hasLoadedOnceRef.current = true;
      loadAllData();
    }

    // Background refresh every 5 seconds (silent, no loading indicator)
    const interval = setInterval(() => {
      if (!loadingDataRef.current && !uiState.loading) {
        console.log('🔄 [AgencyManagement] Background refresh (silent)');
        // Load silently in background without showing loading state
        loadAgencies().catch(err => console.warn('Background refresh failed:', err));
        loadExecutions().catch(err => console.warn('Background refresh failed:', err));
      }
    }, 5000); // 5 seconds for background refresh - faster for testing manual tasks

    return () => clearInterval(interval);
  }, [uiState.initialized, systemReady, loadAgencies, loadExecutions]); // Only depend on initialized state

  // Listen for localStorage changes to detect new agent deployments
  useEffect(() => {
    if (!activeProject) return;

    const handleStorageChange = (e: StorageEvent) => {
      // Check if the change is to deployed agents for this project
      if (e.key === `deployed-agents-${activeProject}` && e.newValue) {
        console.log('🔄 [AgencyManagement] Detected new agent deployment, refreshing agent list...');
        loadRegisteredAgents();
      }
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events (from same window)
    const handleCustomStorageChange = () => {
      console.log('🔄 [AgencyManagement] Detected agent deployment in same window, refreshing agent list...');
      loadRegisteredAgents();
    };

    // Listen for custom event that can be dispatched when agents are deployed
    window.addEventListener('agent-deployed', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('agent-deployed', handleCustomStorageChange);
    };
  }, [activeProject, loadRegisteredAgents]);

  // Format date helper
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get status color helper (FIXED: Using proper Kontext colors)
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'running': return 'text-orange-400';
      case 'failed': return 'text-red-400';
      case 'paused': return 'text-yellow-400';
      case 'pending': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  // Pre-built workflow templates for quick selection
  const workflowTemplates: WorkflowTemplate[] = [
    {
      id: 'customer-support-basic',
      name: 'Customer Support Workflow',
      description: 'Basic customer support with AI response and human escalation',
      category: 'customer-service',
      icon: '👥',
      executionMode: 'sequential',
      steps: [
        {
          agentCanisterId: '',
          agentName: 'Ticket Classifier',
          inputTemplate: 'Classify this support ticket: {input}',
          requiresApproval: false,
          retryOnFailure: true,
          timeout: 30
        },
        {
          agentCanisterId: '',
          agentName: 'AI Response Generator',
          inputTemplate: 'Generate response for: {input}',
          requiresApproval: true,
          retryOnFailure: true,
          timeout: 60
        }
      ]
    },
    {
      id: 'data-processing-pipeline',
      name: 'Data Processing Pipeline',
      description: 'Validate, transform, and store data automatically',
      category: 'data-processing',
      icon: '📊',
      executionMode: 'sequential',
      steps: [
        {
          agentCanisterId: '',
          agentName: 'Data Validator',
          inputTemplate: 'Validate data: {input}',
          requiresApproval: false,
          retryOnFailure: true,
          timeout: 30
        },
        {
          agentCanisterId: '',
          agentName: 'Data Transformer',
          inputTemplate: 'Transform data: {input}',
          requiresApproval: false,
          retryOnFailure: true,
          timeout: 60
        }
      ]
    },
    {
      id: 'content-moderation',
      name: 'Content Moderation',
      description: 'AI content screening with human review',
      category: 'moderation',
      icon: '🛡️',
      executionMode: 'conditional',
      steps: [
        {
          agentCanisterId: '',
          agentName: 'Content Scanner',
          inputTemplate: 'Scan content: {input}',
          requiresApproval: false,
          retryOnFailure: true,
          timeout: 45
        },
        {
          agentCanisterId: '',
          agentName: 'Human Reviewer',
          inputTemplate: 'Review flagged content: {input}',
          requiresApproval: true,
          retryOnFailure: false,
          timeout: 3600
        }
      ]
    }
  ];

  const handleTemplateSelect = useCallback((template: WorkflowTemplate) => {
    // Get available agents (excluding agency workflow canister)
    const availableAgents = registeredAgents.filter(agent => {
      const selectedPair = selectedServerPair && serverPairs.length > 0 
        ? serverPairs.find((p: ServerPair) => p.pairId === selectedServerPair) 
        : null;
      const agencyWorkflowCanisterId = selectedPair?.backendCanisterId;
      
      if (agencyWorkflowCanisterId && agent.canisterId === agencyWorkflowCanisterId) {
        return false;
      }
      return true;
    });
    
    // If we have agents available, show selection modal with optional auto-assignment
    if (availableAgents.length > 0) {
      // Pre-select agents if we have enough (user can change them)
      const initialSelections = new Map<number, string>();
      template.steps.forEach((step, index) => {
        if (availableAgents[index]) {
          initialSelections.set(index, availableAgents[index].canisterId);
        }
      });
      
      setSelectedTemplate(template);
      setTemplateAgentSelections(initialSelections);
      setShowTemplateAgentSelector(true);
    } else {
      // No agents available - load template and show error
      setFormData({
        name: template.name,
        description: template.description,
        steps: template.steps,
        connections: [],
        executionMode: template.executionMode
      });
      updateUIState({ 
        activeView: 'simple-builder',
        error: '⚠️ No agents available. Please deploy agents first, then configure them in the workflow editor.' 
      });
    }
  }, [registeredAgents, selectedServerPair, serverPairs, updateUIState]);

  console.log('🎨 [AgencyManagement] About to render component');

  // Show loading state during initialization
  if (!systemReady) {
    return (
      <div className="h-full flex items-center justify-center" style={{ 
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(10px)'
      }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-white mb-2">Setting Up</h3>
          <p className="text-gray-400">Preparing agency management system...</p>
        </div>
      </div>
    );
  }

  // Show server pair selection dialog - ENHANCED UX
  if (showServerPairDialog && !uiState.initialized) {
    return (
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
          overflowY: 'auto'
        }}
        onClick={(e) => {
          // Close modal when clicking outside (only if not initializing)
          if (e.target === e.currentTarget && !uiState.initializing) {
            setShowServerPairDialog(false);
          }
        }}
      >
        <div 
          style={{
            background: 'rgba(17, 17, 17, 0.98)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            borderRadius: '20px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(20px)',
            margin: 'auto',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Prominent Close button - top right */}
          {!uiState.initializing && (
          <button
              onClick={() => {
                setShowServerPairDialog(false);
                setUserDismissedDialog(true);
              }}
            style={{
              position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(107, 114, 128, 0.3)',
                border: '2px solid rgba(107, 114, 128, 0.5)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
                width: '36px',
                height: '36px',
                fontSize: '1.2rem',
                fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(107, 114, 128, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.5)';
                e.currentTarget.style.transform = 'scale(1)';
            }}
              title="Close (you can set this up later)"
            >
              ✕
          </button>
          )}

          <div className="text-center" style={{ paddingRight: uiState.initializing ? '0' : '3rem' }}>
              {/* Welcome Header */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(255, 107, 53, 0.4)',
                  fontSize: '1.5rem'
                }}>
                  🏢
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white m-0">Welcome to Workflows!</h3>
                  <p className="text-gray-400 text-sm mt-1">Set up your multi-agent workflow system</p>
              </div>
              </div>

              {/* Step-by-step explanation */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                textAlign: 'left'
              }}>
                <p className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
                  <span>📋</span> What we're setting up:
                </p>
                <ul className="text-gray-300 text-xs space-y-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span>A dedicated system to run multi-agent workflows</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span>Automated scheduling and triggers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span>Workflow execution monitoring</span>
                  </li>
                </ul>
                <p className="text-gray-400 text-xs mt-3 pt-3 border-t border-gray-700">
                  <strong className="text-white">Don't worry:</strong> This is separate from your agents and won't affect existing deployments.
                </p>
              </div>
              
              {uiState.error && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <p className="text-red-400 text-xs">{uiState.error}</p>
                </div>
              )}

              {isLoadingServers ? (
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-3"></div>
                  <p className="text-gray-300 text-sm font-medium">Loading your server pairs...</p>
                  <p className="text-gray-500 text-xs mt-1">This will only take a moment</p>
                </div>
              ) : serverPairs.length === 0 ? (
                <div>
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '2px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem', textAlign: 'center' }}>🏗️</div>
                    <p className="text-yellow-400 mb-3 font-semibold text-base text-center">You need a server pair first</p>
                    <p className="text-gray-300 text-sm leading-relaxed text-center mb-4">
                      Before setting up workflows, you need to create a server pair. This provides the computing resources your workflows will run on.
                    </p>
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                      <p className="text-white text-xs font-semibold mb-2">📝 Quick Steps:</p>
                      <ol className="text-gray-300 text-xs space-y-1.5" style={{ listStyle: 'decimal', paddingLeft: '1.25rem' }}>
                        <li>Click "Go to Hosting Tab" below</li>
                        <li>Create a new server pair (or use an existing one)</li>
                        <li>Return here to complete workflow setup</li>
                      </ol>
                  </div>
                  </div>
                  <div className="flex gap-3">
                  <button
                    onClick={() => setShowServerPairDialog(false)}
                    style={{
                        flex: 1,
                      background: 'rgba(107, 114, 128, 0.2)',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                      borderRadius: '8px',
                      color: '#9CA3AF',
                        padding: '0.75rem 1.25rem',
                        fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                      Maybe Later
                    </button>
                    <button
                      onClick={() => {
                        setShowServerPairDialog(false);
                        setUserDismissedDialog(true);
                        // TODO: Navigate to hosting tab
                        alert('Please go to the Hosting tab to create a server pair, then return here.');
                      }}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        padding: '0.75rem 1.25rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)'
                      }}
                    >
                      Go to Hosting Tab →
                  </button>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Step 1: Select Server Pair */}
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div style={{
                        width: '24px',
                        height: '24px',
                        background: selectedServerPair ? 'var(--accent-green)' : 'rgba(75, 85, 99, 0.5)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        {selectedServerPair ? '✓' : '1'}
                      </div>
                      <label className="block text-base font-semibold text-white">
                        Step 1: Choose Your Server Pair
                    </label>
                    </div>
                    <p className="text-gray-400 text-xs mb-3 ml-7">
                      Select which server pair will run your workflows. This won't affect your existing agents.
                    </p>
                    <select
                      value={selectedServerPair}
                      onChange={(e) => {
                        setSelectedServerPair(e.target.value);
                        updateUIState({ error: null }); // Clear any previous errors
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(31, 31, 31, 0.9)',
                        border: selectedServerPair 
                          ? '2px solid var(--accent-green)' 
                          : '2px solid rgba(75, 85, 99, 0.5)',
                        borderRadius: '10px',
                        color: '#ffffff',
                        padding: '0.875rem 1rem',
                        fontSize: '0.95rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--accent-orange)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = selectedServerPair 
                          ? 'var(--accent-green)' 
                          : 'rgba(75, 85, 99, 0.5)';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <option value="" style={{ background: '#1f1f1f', color: '#9CA3AF' }}>
                        👇 Choose a server pair from the list...
                      </option>
                      {serverPairs.map(pair => (
                        <option key={pair.pairId} value={pair.pairId} style={{ background: '#1f1f1f' }}>
                          {pair.name} • {pair.creditsAllocated.toLocaleString()} credits
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedServerPair && (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '2px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '12px',
                      padding: '1rem',
                      marginBottom: '1.5rem'
                    }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-green-400 text-lg">✓</span>
                        <p className="font-semibold text-green-400 text-sm">
                          {serverPairs.find(p => p.pairId === selectedServerPair)?.name}
                        </p>
                        </div>
                      <p className="text-gray-300 text-xs leading-relaxed">
                        This server pair will host your workflow system. Your agents will continue running on their own server pairs.
                          </p>
                        </div>
                  )}

                  {/* Step 2: Initialize */}
                  {selectedServerPair && (
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div style={{
                          width: '24px',
                          height: '24px',
                          background: uiState.initializing ? 'var(--accent-orange)' : 'rgba(75, 85, 99, 0.5)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          flexShrink: 0
                        }}>
                          {uiState.initializing ? '⏳' : '2'}
                      </div>
                        <label className="block text-base font-semibold text-white">
                          Step 2: Set Up Your Workflow System
                        </label>
                      </div>
                      <p className="text-gray-400 text-xs mb-3 ml-7">
                        This will deploy the workflow engine. It takes about 30-60 seconds.
                      </p>
                    </div>
                  )}

                  {/* Error message */}
                  {uiState.error && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '2px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '10px',
                      padding: '1rem',
                      marginBottom: '1.5rem'
                    }}>
                      <p className="text-red-400 text-sm font-medium mb-1">⚠️ Error</p>
                      <p className="text-red-300 text-xs">{uiState.error}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    {!uiState.initializing && (
                      <button
                        onClick={() => {
                          setShowServerPairDialog(false);
                          setUserDismissedDialog(true);
                        }}
                        style={{
                          flex: selectedServerPair ? 1 : 2,
                          background: 'rgba(107, 114, 128, 0.2)',
                          border: '1px solid rgba(107, 114, 128, 0.3)',
                          borderRadius: '10px',
                          color: '#9CA3AF',
                          padding: '0.875rem 1.5rem',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(107, 114, 128, 0.3)';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
                          e.currentTarget.style.color = '#9CA3AF';
                        }}
                      >
                        Set Up Later
                      </button>
                    )}
                    <button
                      onClick={initializeAgencyWorkflow}
                      disabled={!selectedServerPair || uiState.initializing}
                      style={{
                        flex: selectedServerPair ? 2 : 1,
                        background: !selectedServerPair || uiState.initializing
                          ? 'rgba(107, 114, 128, 0.2)'
                          : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                        border: 'none',
                        borderRadius: '10px',
                        color: '#ffffff',
                        padding: '0.875rem 1.5rem',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        cursor: !selectedServerPair || uiState.initializing ? 'not-allowed' : 'pointer',
                        opacity: !selectedServerPair || uiState.initializing ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        boxShadow: !selectedServerPair || uiState.initializing ? 'none' : '0 4px 20px rgba(255, 107, 53, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedServerPair && !uiState.initializing) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 25px rgba(255, 107, 53, 0.5)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedServerPair && !uiState.initializing) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 107, 53, 0.4)';
                        }
                      }}
                    >
                      {uiState.initializing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Setting Up...</span>
                        </>
                      ) : (
                        <>
                          <span>🚀</span>
                          <span>Start Setup</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    );
  }

  // Show initialization screen with deployment progress - ENHANCED UX
  if (!uiState.initialized && uiState.initializing) {
    const getStepInfo = () => {
      if (!deploymentProgress) {
        return { step: 1, total: 4, title: 'Preparing...', description: 'Getting everything ready' };
      }
      
      const stage = deploymentProgress.stage.toLowerCase();
      if (stage.includes('initializing') || stage.includes('prepare')) {
        return { step: 1, total: 4, title: 'Preparing System', description: 'Setting up the workflow engine' };
      } else if (stage.includes('backend') || stage.includes('deploy')) {
        return { step: 2, total: 4, title: 'Deploying Backend', description: 'Setting up the workflow server' };
      } else if (stage.includes('frontend') || stage.includes('bundle')) {
        return { step: 3, total: 4, title: 'Deploying Interface', description: 'Setting up the workflow dashboard' };
      } else if (stage.includes('complete') || stage.includes('finish')) {
        return { step: 4, total: 4, title: 'Almost Done!', description: 'Finalizing setup' };
      }
      return { step: 2, total: 4, title: 'Setting Up...', description: deploymentProgress.message || 'Deploying workflow system' };
    };

    const stepInfo = getStepInfo();
    const progressPercent = deploymentProgress?.percent || (stepInfo.step / stepInfo.total * 100);

    return (
      <div className="h-full flex items-center justify-center" style={{ 
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          background: 'rgba(17, 17, 17, 0.98)',
          border: '2px solid rgba(255, 107, 53, 0.3)',
          borderRadius: '20px',
          padding: '2.5rem',
          maxWidth: '550px',
          width: '100%',
          margin: '0 1rem',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(20px)',
          position: 'relative'
        }}>
          {/* Cancel button during initialization */}
          <button
            onClick={() => {
              if (confirm('Are you sure you want to cancel setup? You can start again later.')) {
                updateUIState({ initializing: false, error: null });
                initializationAttemptedRef.current = false;
                setShowServerPairDialog(true);
            setUserDismissedDialog(false); // Reset when user explicitly wants to initialize
              }
            }}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'rgba(107, 114, 128, 0.3)',
              border: '1px solid rgba(107, 114, 128, 0.5)',
              borderRadius: '8px',
              color: '#9CA3AF',
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(107, 114, 128, 0.3)';
              e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.5)';
              e.currentTarget.style.color = '#9CA3AF';
            }}
          >
            Cancel
          </button>

          <div className="text-center" style={{ paddingRight: '4rem' }}>
            {/* Animated icon */}
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 1.5rem',
              position: 'relative'
            }}>
              <div className="animate-spin rounded-full h-20 w-20 border-4 border-transparent border-t-orange-500 border-r-green-500 mx-auto"></div>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '2rem'
              }}>
                🏢
              </div>
            </div>

            {/* Step indicator */}
            <div style={{
              background: 'rgba(255, 107, 53, 0.1)',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              borderRadius: '12px',
              padding: '0.75rem 1.25rem',
              display: 'inline-block',
              marginBottom: '1.5rem'
            }}>
              <p className="text-orange-400 text-sm font-semibold">
                Step {stepInfo.step} of {stepInfo.total}
              </p>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">
              {stepInfo.title}
            </h3>
            <p className="text-gray-300 mb-6 leading-relaxed text-sm">
              {stepInfo.description}
            </p>
            
            {/* Progress bar */}
              <div style={{
                width: '100%',
              height: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
                overflow: 'hidden',
              marginBottom: '1.5rem',
              position: 'relative'
              }}>
                <div style={{
                width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-green))',
                borderRadius: '8px',
                transition: 'width 0.5s ease',
                boxShadow: '0 0 20px rgba(255, 107, 53, 0.5)'
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)'
              }}>
                {Math.round(progressPercent)}%
              </div>
            </div>

            {/* Detailed progress message */}
            {deploymentProgress && (
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '10px',
              padding: '1rem',
                marginBottom: '1rem'
              }}>
                <p className="text-blue-300 text-xs leading-relaxed">
                  {deploymentProgress.message}
                </p>
              </div>
            )}

            {/* What's happening info */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '10px',
              padding: '1rem',
              marginTop: '1.5rem'
            }}>
              <p className="text-gray-400 text-xs leading-relaxed">
                <strong className="text-white">What's happening:</strong> We're deploying your workflow system to the Internet Computer. This typically takes 30-60 seconds. Please don't close this window.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show advanced workflow editor - FIXED: Now fits within tab instead of full screen overlay
  if (uiState.showAdvancedEditor) {
    // Fullscreen mode - Chrome DevTools style undock
    if (uiState.isFullscreen) {
      // Use portal to render at document root level, ensuring it's above sidebar toggle (z-index 999)
      const fullscreenContent = (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000, // Much higher than sidebar toggle (999) to ensure it's on top
          background: 'var(--primary-black)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          isolation: 'isolate', // Create new stacking context
        }}>
          {/* Minimal Header for Fullscreen */}
          <div style={{
            background: 'rgba(17, 17, 17, 0.98)',
            borderBottom: '1px solid rgba(255, 107, 53, 0.3)',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            backdropFilter: 'blur(10px)'
          }}>
            <div className="flex items-center gap-2">
              <div style={{
                width: '24px',
                height: '24px',
                background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem'
              }}>
                🎭
              </div>
              <h2 className="text-sm font-semibold text-white">
                Workflow Editor{formData.name ? `: ${formData.name}` : ''} (Fullscreen)
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (currentAgencyId && hasInitialSave) {
                    // Check if agency still exists before updating
                    const agencyExists = agencies.some(a => a.id === currentAgencyId);
                    if (!agencyExists) {
                      // Agency was deleted, reset state and create as new
                      console.warn('⚠️ [AgencyManagement] Agency not found, resetting to create new');
                      setCurrentAgencyId(null);
                      setHasInitialSave(false);
                      setSaveAgencyName(formData.name || '');
                      setSaveAgencyDescription(formData.description || '');
                      setShowSaveAgencyModal(true);
                      return;
                    }
                    
                    // Update existing agency
                    updateUIState({ loading: true, error: null });
                    try {
                        const result = await AgencyService.updateAgency(
                          currentAgencyId,
                          formData.name,
                          formData.description,
                          formData.steps,
                          currentProject.id,
                          userCanisterId,
                          identity,
                          formData.connections || [] // Use connections from formData
                        );
                      if (result.success) {
                        await loadAgencies();
                        updateUIState({ loading: false });
                      } else {
                        updateUIState({ error: `Failed to update agency: ${result.error}`, loading: false });
                      }
                    } catch (error) {
                      updateUIState({ error: error instanceof Error ? error.message : 'Failed to update agency', loading: false });
                    }
                  } else {
                    // Show modal for new agency
                    setSaveAgencyName(formData.name || '');
                    setSaveAgencyDescription(formData.description || '');
                    setShowSaveAgencyModal(true);
                  }
                }}
                disabled={formData.steps.length === 0 || uiState.loading}
                style={{
                  background: (formData.steps.length === 0 || uiState.loading)
                    ? 'rgba(107, 114, 128, 0.2)'
                    : 'linear-gradient(135deg, var(--accent-green), #059669)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#ffffff',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: (formData.steps.length === 0 || uiState.loading) ? 'not-allowed' : 'pointer',
                  opacity: (formData.steps.length === 0 || uiState.loading) ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                {uiState.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    {hasInitialSave ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    💾 {hasInitialSave ? 'Save' : 'Save as Agency'}
                  </>
                )}
              </button>
              
              <button
                onClick={() => updateUIState({ isFullscreen: !uiState.isFullscreen })}
                style={{
                  background: uiState.isFullscreen ? 'rgba(255, 107, 53, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                  border: `1px solid ${uiState.isFullscreen ? 'var(--accent-orange)' : 'rgba(107, 114, 128, 0.3)'}`,
                  borderRadius: '4px',
                  color: uiState.isFullscreen ? '#ff6b35' : '#9CA3AF',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title={uiState.isFullscreen ? "Exit Fullscreen (Dock)" : "Enter Fullscreen (Undock)"}
              >
                {uiState.isFullscreen ? '⤓ Dock' : '⤢ Maximize'}
              </button>
              
              <button
                onClick={() => {
                  updateUIState({ showAdvancedEditor: false, isFullscreen: false });
                  setHasInitialSave(false);
                  setCurrentAgencyId(null);
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '4px',
                  color: '#ef4444',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Full Screen Workflow Canvas - Maximum space */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            background: 'var(--primary-black)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <WorkflowCanvas
              initialAgentSteps={formData.steps}
              initialConnections={currentAgencyId ? (agencies.find(a => a.id === currentAgencyId)?.connections || []) : []} // NEW: Pass connections when editing
              onWorkflowChange={handleWorkflowChange}
              onConnectionsChange={handleConnectionsChange} // NEW: Track connections changes
              executionMode={formData.executionMode}
              onExecutionModeChange={handleExecutionModeChange}
              availableAgents={registeredAgents}
              agencyWorkflowCanisterId={selectedServerPair && serverPairs.length > 0 
                ? serverPairs.find((p: ServerPair) => p.pairId === selectedServerPair)?.backendCanisterId 
                : undefined}
              className="h-full"
              onFullscreenToggle={() => updateUIState({ isFullscreen: !uiState.isFullscreen })}
              isFullscreen={true}
              agencyId={currentAgencyId || undefined}
              triggers={triggers}
              onExecuteTrigger={handleExecuteTrigger}
              onCreateTrigger={async (type, config) => {
                if (type === 'scheduled') {
                  await handleCreateScheduledTrigger(
                    config.name,
                    config.description,
                    config.schedule,
                    config.inputTemplate || '{input}',
                    config.retryConfig,
                    config.executionLimits
                  );
                } else if (type === 'webhook') {
                  await handleCreateWebhookTrigger(
                    config.name,
                    config.description,
                    config.source,
                    config.signature,
                    config.inputTemplate || '{input}',
                    config.retryConfig,
                    config.executionLimits
                  );
                } else if (type === 'condition') {
                  await handleCreateConditionTrigger(
                    config.name,
                    config.description,
                    config.condition,
                    config.inputTemplate || '{input}',
                    config.retryConfig,
                    config.executionLimits
                  );
                }
              }}
              onToggleTrigger={handleToggleTrigger}
              onDeleteTrigger={handleDeleteTrigger}
              onCreateAgency={async (name, description, agentSteps, connections) => {
                // 🔧 FIX: Pass parameters directly to avoid stale closure issues
                console.log('💾 [AgencyManagement] onCreateAgency called from WorkflowCanvas:', {
                  name,
                  description,
                  stepsCount: agentSteps.length,
                  connectionsCount: connections?.length || 0
                });
                setFormData(prev => ({ ...prev, name, description, steps: agentSteps }));
                // Call createAgency with the new values directly instead of relying on state update
                await createAgency(name, description, agentSteps, connections);
              }}
              onExecute={(input, agentSteps) => {
                // Validate agent steps before creating agency
                if (agentSteps.length === 0) {
                  updateUIState({ error: 'No valid agents in workflow. Please ensure all agents have valid canister IDs.' });
                  return;
                }
                
                // Check for invalid agent canister IDs (empty or agency workflow canister)
                const invalidSteps = agentSteps.filter(step => 
                  !step.agentCanisterId || 
                  step.agentCanisterId.trim() === '' ||
                  (selectedServerPair && serverPairs.length > 0 
                    ? serverPairs.find((p: ServerPair) => p.pairId === selectedServerPair)?.backendCanisterId 
                    : null) === step.agentCanisterId
                );
                
                if (invalidSteps.length > 0) {
                  updateUIState({ 
                    error: `Invalid agent canister IDs found. Please configure valid agent canister IDs for: ${invalidSteps.map(s => s.agentName).join(', ')}` 
                  });
                  return;
                }
                
                // FIX: Reuse existing workflow instead of creating new one each time
                const workflowName = formData.name || 'Unnamed Workflow';
                let agencyIdToExecute: string | null = null;
                
                // Check if we have a cached agency ID for this workflow name
                if (workflowAgencyIdMap.has(workflowName)) {
                  const cachedAgencyId = workflowAgencyIdMap.get(workflowName)!;
                  // Verify the agency still exists and matches the current workflow
                  const existingAgency = agencies.find(a => a.id === cachedAgencyId);
                  if (existingAgency && 
                      existingAgency.steps.length === agentSteps.length &&
                      existingAgency.steps.every((step, idx) => 
                        step.agentCanisterId === agentSteps[idx].agentCanisterId &&
                        step.agentName === agentSteps[idx].agentName
                      )) {
                    // Agency exists and matches - reuse it
                    console.log(`♻️ Reusing existing workflow: ${workflowName} (${cachedAgencyId})`);
                    agencyIdToExecute = cachedAgencyId;
                  } else {
                    // Agency doesn't exist or doesn't match - remove from cache
                    setWorkflowAgencyIdMap(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(workflowName);
                      return newMap;
                    });
                  }
                }
                
                // If no cached agency, check if an agency with this name already exists
                if (!agencyIdToExecute) {
                  const existingAgency = agencies.find(a => 
                    a.name === workflowName &&
                    a.steps.length === agentSteps.length &&
                    a.steps.every((step, idx) => 
                      step.agentCanisterId === agentSteps[idx].agentCanisterId &&
                      step.agentName === agentSteps[idx].agentName
                    )
                  );
                  
                  if (existingAgency) {
                    // Found matching agency - reuse it
                    console.log(`♻️ Found existing workflow to reuse: ${workflowName} (${existingAgency.id})`);
                    agencyIdToExecute = existingAgency.id;
                    // Cache it for future executions
                    setWorkflowAgencyIdMap(prev => new Map(prev).set(workflowName, existingAgency.id));
                  }
                }
                
                // If we have an agency ID, execute it directly
                if (agencyIdToExecute) {
                  executeAgency(agencyIdToExecute, input).catch(error => {
                    console.error('Failed to execute workflow:', error);
                    updateUIState({ error: error instanceof Error ? error.message : 'Failed to execute workflow' });
                  });
                  return;
                }
                
                // No existing agency found - create one and cache it for future reuse
                console.log(`🆕 Creating new workflow for execution: ${workflowName}`);
                AgencyService.createAgency(
                  workflowName,
                  formData.description || 'Workflow for execution',
                  agentSteps,
                  currentProject.id,
                  userCanisterId,
                  identity
                ).then(result => {
                  if (result.success && result.agencyId) {
                    // Cache the agency ID for future executions
                    setWorkflowAgencyIdMap(prev => new Map(prev).set(workflowName, result.agencyId!));
                    // Execute the newly created agency
                    return executeAgency(result.agencyId, input);
                  } else {
                    throw new Error(result.error || 'Failed to create workflow');
                  }
                }).catch(error => {
                  console.error('Failed to create/execute workflow:', error);
                  updateUIState({ error: error instanceof Error ? error.message : 'Failed to execute workflow' });
                });
              }}
              workflowName={formData.name}
              workflowDescription={formData.description}
            />
          </div>
        </div>
      );

      // Render using portal to ensure it's above all other elements including sidebar toggle
      if (typeof document === 'undefined') {
        return null; // SSR safety
      }
      
      // Save Workflow Modal - Portal to document.body to ensure it's above the fullscreen editor
      const saveAgencyModal = showSaveAgencyModal && typeof document !== 'undefined' && document.body ? (
        createPortal((
          <div 
            style={{ 
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100000, // Extremely high z-index to ensure it's above everything including the editor
              padding: '1rem',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowSaveAgencyModal(false);
              }
            }}
          >
            <div 
              style={{
                background: 'var(--secondary-black)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '500px',
                padding: '2rem',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4">Save Workflow</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Agency Name *
                  </label>
                  <input
                    type="text"
                    value={saveAgencyName}
                    onChange={(e) => setSaveAgencyName(e.target.value)}
                    placeholder="Enter agency name"
                    className="w-full px-3 py-2 border rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    style={{
                      background: 'var(--tertiary-black)',
                      borderColor: 'var(--border-color)'
                    }}
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={saveAgencyDescription}
                    onChange={(e) => setSaveAgencyDescription(e.target.value)}
                    placeholder="Enter agency description (optional)"
                    rows={3}
                    className="w-full px-3 py-2 border rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    style={{
                      background: 'var(--tertiary-black)',
                      borderColor: 'var(--border-color)'
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSaveAgencyModal(false);
                    setSaveAgencyName('');
                    setSaveAgencyDescription('');
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '8px',
                    color: '#9CA3AF',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!saveAgencyName.trim()) {
                      alert('Please enter an agency name');
                      return;
                    }
                    
                    // Close modal first
                    setShowSaveAgencyModal(false);
                    
                    // Update formData with the values from modal
                    setFormData(prev => ({ 
                      ...prev, 
                      name: saveAgencyName.trim(),
                      description: saveAgencyDescription.trim()
                    }));
                    
                    // Wait a tick to ensure state is updated, then create workflow
                    setTimeout(async () => {
                      console.log('💾 [AgencyManagement] Creating new agency from modal (fullscreen)...', {
                        name: saveAgencyName.trim(),
                        description: saveAgencyDescription.trim(),
                        stepsCount: formData.steps.length
                      });
                      // Use the modal values directly to avoid timing issues
                      await createAgency(saveAgencyName.trim(), saveAgencyDescription.trim(), formData.steps);
                      setSaveAgencyName('');
                      setSaveAgencyDescription('');
                    }, 0);
                  }}
                  disabled={!saveAgencyName.trim() || uiState.loading}
                  style={{
                    flex: 1,
                    background: !saveAgencyName.trim() || uiState.loading
                      ? 'rgba(107, 114, 128, 0.2)'
                      : 'linear-gradient(135deg, var(--accent-green), #059669)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: !saveAgencyName.trim() || uiState.loading ? 'not-allowed' : 'pointer',
                    opacity: !saveAgencyName.trim() || uiState.loading ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {uiState.loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    '💾 Save Workflow'
                  )}
                </button>
              </div>
            </div>
          </div>
        ), document.body)
      ) : null;
      
      // Return both portals as siblings - modal will render AFTER editor in DOM, ensuring it's on top
      return (
        <>
          {createPortal(fullscreenContent, document.body)}
          {saveAgencyModal}
        </>
      );
    }

    // Normal embedded mode
    return (
      <>
        <div style={{
          height: '100%',
          minHeight: 0,
          background: 'var(--primary-black)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Minimal Header for Advanced Editor - Maximize canvas space */}
          <div style={{
            background: 'rgba(17, 17, 17, 0.95)',
            borderBottom: '1px solid rgba(255, 107, 53, 0.2)',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div className="flex items-center gap-2">
              <div style={{
                width: '28px',
                height: '28px',
                background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem'
              }}>
                🎭
              </div>
              <h2 className="text-base font-semibold text-white">
                Workflow Editor{formData.name ? `: ${formData.name}` : ''}
              </h2>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (formData.steps.length === 0) {
                      alert('Please add at least one agent to the workflow');
                      return;
                    }

                    if (currentAgencyId && hasInitialSave) {
                      // Check if agency still exists before updating
                      const agencyExists = agencies.some(a => a.id === currentAgencyId);
                      if (!agencyExists) {
                        // Agency was deleted, reset state and create as new
                        console.warn('⚠️ [AgencyManagement] Agency not found, resetting to create new');
                        setCurrentAgencyId(null);
                        setHasInitialSave(false);
                        setSaveAgencyName(formData.name || '');
                        setSaveAgencyDescription(formData.description || '');
                        setShowSaveAgencyModal(true);
                        return;
                      }
                      
                      // Update existing agency - no modal needed
                      updateUIState({ loading: true, error: null });
                      try {
                        const result = await AgencyService.updateAgency(
                          currentAgencyId,
                          formData.name || 'Unnamed Agency',
                          formData.description || '',
                          formData.steps,
                          currentProject.id,
                          userCanisterId,
                          identity,
                          formData.connections || [] // Use connections from formData
                        );
                        if (result.success) {
                          await loadAgencies();
                          updateUIState({ loading: false });
                        } else {
                          updateUIState({ error: `Failed to update agency: ${result.error}`, loading: false });
                        }
                      } catch (error) {
                        updateUIState({ error: error instanceof Error ? error.message : 'Failed to update agency', loading: false });
                      }
                    } else {
                      // Show modal for new agency
                      setSaveAgencyName(formData.name || '');
                      setSaveAgencyDescription(formData.description || '');
                      setShowSaveAgencyModal(true);
                    }
                  }}
                  disabled={formData.steps.length === 0 || uiState.loading}
                  style={{
                    background: (formData.steps.length === 0 || uiState.loading)
                      ? 'rgba(107, 114, 128, 0.2)'
                      : 'linear-gradient(135deg, var(--accent-green), #059669)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: (formData.steps.length === 0 || uiState.loading) ? 'not-allowed' : 'pointer',
                    opacity: (formData.steps.length === 0 || uiState.loading) ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {uiState.loading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      {hasInitialSave ? 'Saving...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      💾 {hasInitialSave ? 'Save' : 'Save as Agency'}
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => updateUIState({ isFullscreen: !uiState.isFullscreen })}
                  style={{
                    background: uiState.isFullscreen ? 'rgba(255, 107, 53, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                    border: `1px solid ${uiState.isFullscreen ? 'var(--accent-orange)' : 'rgba(107, 114, 128, 0.3)'}`,
                    borderRadius: '6px',
                    color: uiState.isFullscreen ? '#ff6b35' : '#9CA3AF',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title={uiState.isFullscreen ? "Exit Fullscreen (Dock)" : "Enter Fullscreen (Undock)"}
                >
                  {uiState.isFullscreen ? '⤓ Dock' : '⤢ Maximize'}
                </button>
                
                <button
                  onClick={() => {
                    updateUIState({ showAdvancedEditor: false });
                    setHasInitialSave(false);
                    setCurrentAgencyId(null);
                  }}
                  style={{
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '6px',
                    color: '#9CA3AF',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Full Screen Workflow Canvas - Maximize space */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            background: 'var(--primary-black)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            <WorkflowCanvas
              initialAgentSteps={formData.steps}
              initialConnections={currentAgencyId ? (agencies.find(a => a.id === currentAgencyId)?.connections || []) : []} // NEW: Pass connections when editing
              onWorkflowChange={handleWorkflowChange}
              onConnectionsChange={handleConnectionsChange} // NEW: Track connections changes
              executionMode={formData.executionMode}
              onExecutionModeChange={handleExecutionModeChange}
              availableAgents={registeredAgents}
              agencyWorkflowCanisterId={selectedServerPair && serverPairs.length > 0 
                ? serverPairs.find((p: ServerPair) => p.pairId === selectedServerPair)?.backendCanisterId 
                : undefined}
              onCreateAgency={async (name, description, agentSteps, connections) => {
                // 🔧 FIX: Pass parameters directly to avoid stale closure issues
                console.log('💾 [AgencyManagement] onCreateAgency called from WorkflowCanvas (embedded):', {
                  name,
                  description,
                  stepsCount: agentSteps.length,
                  connectionsCount: connections?.length || 0
                });
                setFormData(prev => ({ ...prev, name, description, steps: agentSteps }));
                // Call createAgency with the new values directly instead of relying on state update
                await createAgency(name, description, agentSteps, connections);
              }}
              onExecute={async (input, agentSteps) => {
                // Validate agent steps before creating agency
                if (agentSteps.length === 0) {
                  updateUIState({ error: 'No valid agents in workflow. Please ensure all agents have valid canister IDs.' });
                  return;
                }
                
                // Check for invalid agent canister IDs (empty or agency workflow canister)
                const selectedPair = selectedServerPair && serverPairs.length > 0 
                  ? serverPairs.find((p: ServerPair) => p.pairId === selectedServerPair) 
                  : null;
                const invalidSteps = agentSteps.filter(step => 
                  !step.agentCanisterId || 
                  step.agentCanisterId.trim() === '' ||
                  (selectedPair && step.agentCanisterId === selectedPair.backendCanisterId)
                );
              
                if (invalidSteps.length > 0) {
                  updateUIState({ 
                    error: `Invalid agent canister IDs found. Please configure valid agent canister IDs for: ${invalidSteps.map(s => s.agentName).join(', ')}` 
                  });
                  return;
                }
                
                // FIX: Reuse existing workflow instead of creating new one each time
                const workflowName = formData.name || 'Unnamed Workflow';
                let agencyIdToExecute: string | null = null;
                
                // Check if we have a cached agency ID for this workflow name
                if (workflowAgencyIdMap.has(workflowName)) {
                  const cachedAgencyId = workflowAgencyIdMap.get(workflowName)!;
                  // Verify the agency still exists and matches the current workflow
                  const existingAgency = agencies.find(a => a.id === cachedAgencyId);
                  if (existingAgency && 
                      existingAgency.steps.length === agentSteps.length &&
                      existingAgency.steps.every((step, idx) => 
                        step.agentCanisterId === agentSteps[idx].agentCanisterId &&
                        step.agentName === agentSteps[idx].agentName
                      )) {
                    // Agency exists and matches - reuse it
                    console.log(`♻️ Reusing existing workflow: ${workflowName} (${cachedAgencyId})`);
                    agencyIdToExecute = cachedAgencyId;
                  } else {
                    // Agency doesn't exist or doesn't match - remove from cache
                    setWorkflowAgencyIdMap(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(workflowName);
                      return newMap;
                    });
                  }
                }
                
                // If no cached agency, check if an agency with this name already exists
                if (!agencyIdToExecute) {
                  const existingAgency = agencies.find(a => 
                    a.name === workflowName &&
                    a.steps.length === agentSteps.length &&
                    a.steps.every((step, idx) => 
                      step.agentCanisterId === agentSteps[idx].agentCanisterId &&
                      step.agentName === agentSteps[idx].agentName
                    )
                  );
                  
                  if (existingAgency) {
                    // Found matching agency - reuse it
                    console.log(`♻️ Found existing workflow to reuse: ${workflowName} (${existingAgency.id})`);
                    agencyIdToExecute = existingAgency.id;
                    // Cache it for future executions
                    setWorkflowAgencyIdMap(prev => new Map(prev).set(workflowName, existingAgency.id));
                  }
                }
                
                // If we have an agency ID, execute it directly
                if (agencyIdToExecute) {
                  try {
                    await executeAgency(agencyIdToExecute, input);
                  } catch (error) {
                    console.error('Failed to execute workflow:', error);
                    updateUIState({ error: error instanceof Error ? error.message : 'Failed to execute workflow' });
                  }
                  return;
                }
                
                // No existing agency found - create one and cache it for future reuse
                console.log(`🆕 Creating new workflow for execution: ${workflowName}`);
                try {
                  const result = await AgencyService.createAgency(
                    workflowName,
                    formData.description || 'Workflow for execution',
                    agentSteps,
                    currentProject.id,
                    userCanisterId,
                    identity
                  );
                  
                  if (result.success && result.agencyId) {
                    // Cache the agency ID for future executions
                    setWorkflowAgencyIdMap(prev => new Map(prev).set(workflowName, result.agencyId!));
                    // Execute the newly created agency
                    await executeAgency(result.agencyId, input);
                  } else {
                    throw new Error(result.error || 'Failed to create workflow');
                  }
                } catch (error) {
                  console.error('Failed to create/execute workflow:', error);
                  updateUIState({ error: error instanceof Error ? error.message : 'Failed to execute workflow' });
                }
              }}
              workflowName={formData.name}
              workflowDescription={formData.description}
              className="h-full"
              onFullscreenToggle={() => updateUIState({ isFullscreen: !uiState.isFullscreen })}
              isFullscreen={false}
              agencyId={currentAgencyId || undefined}
              triggers={triggers}
              onExecuteTrigger={handleExecuteTrigger}
              onCreateTrigger={async (type, config) => {
                if (type === 'scheduled') {
                  await handleCreateScheduledTrigger(
                    config.name,
                    config.description,
                    config.schedule,
                    config.inputTemplate || '{input}',
                    config.retryConfig,
                    config.executionLimits
                  );
                } else if (type === 'webhook') {
                  await handleCreateWebhookTrigger(
                    config.name,
                    config.description,
                    config.source,
                    config.signature,
                    config.inputTemplate || '{input}',
                    config.retryConfig,
                    config.executionLimits
                  );
                } else if (type === 'condition') {
                  await handleCreateConditionTrigger(
                    config.name,
                    config.description,
                    config.condition,
                    config.inputTemplate || '{input}',
                    config.retryConfig,
                    config.executionLimits
                  );
                }
              }}
              onToggleTrigger={handleToggleTrigger}
              onDeleteTrigger={handleDeleteTrigger}
            />
          </div>
        </div>

        {/* Save Workflow Modal - Portal to document.body to ensure it's above the embedded editor */}
        {showSaveAgencyModal && typeof document !== 'undefined' && document.body && createPortal((
          <div 
            style={{ 
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100000, // Extremely high z-index to ensure it's above everything including the editor
              padding: '1rem',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowSaveAgencyModal(false);
              }
            }}
          >
            <div 
              style={{
                background: 'var(--secondary-black)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '500px',
                padding: '2rem',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4">Save Workflow</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Agency Name *
                  </label>
                  <input
                    type="text"
                    value={saveAgencyName}
                    onChange={(e) => setSaveAgencyName(e.target.value)}
                    placeholder="Enter agency name"
                    className="w-full px-3 py-2 border rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    style={{
                      background: 'var(--tertiary-black)',
                      borderColor: 'var(--border-color)'
                    }}
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={saveAgencyDescription}
                    onChange={(e) => setSaveAgencyDescription(e.target.value)}
                    placeholder="Enter agency description (optional)"
                    rows={3}
                    className="w-full px-3 py-2 border rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    style={{
                      background: 'var(--tertiary-black)',
                      borderColor: 'var(--border-color)'
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSaveAgencyModal(false);
                    setSaveAgencyName('');
                    setSaveAgencyDescription('');
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '8px',
                    color: '#9CA3AF',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!saveAgencyName.trim()) {
                      alert('Please enter an agency name');
                      return;
                    }
                    
                    // Close modal first
                    setShowSaveAgencyModal(false);
                    
                    // Update formData with the values from modal
                    setFormData(prev => ({ 
                      ...prev, 
                      name: saveAgencyName.trim(),
                      description: saveAgencyDescription.trim()
                    }));
                    
                    // Wait a tick to ensure state is updated, then create workflow
                    setTimeout(async () => {
                      console.log('💾 [AgencyManagement] Creating new agency from modal...', {
                        name: saveAgencyName.trim(),
                        description: saveAgencyDescription.trim(),
                        stepsCount: formData.steps.length
                      });
                      // Use the modal values directly to avoid timing issues
                      await createAgency(saveAgencyName.trim(), saveAgencyDescription.trim(), formData.steps);
                      setSaveAgencyName('');
                      setSaveAgencyDescription('');
                    }, 0);
                  }}
                  disabled={!saveAgencyName.trim() || uiState.loading}
                  style={{
                    flex: 1,
                    background: !saveAgencyName.trim() || uiState.loading
                      ? 'rgba(107, 114, 128, 0.2)'
                      : 'linear-gradient(135deg, var(--accent-green), #059669)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: !saveAgencyName.trim() || uiState.loading ? 'not-allowed' : 'pointer',
                    opacity: !saveAgencyName.trim() || uiState.loading ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {uiState.loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    '💾 Save Workflow'
                  )}
                </button>
              </div>
            </div>
          </div>
        ), document.body)}
      </>
    );
  }

  // MAIN DASHBOARD VIEW - Polished and Professional
  return (
    <>
      {/* Agent Operation Progress Overlays */}
      <AgentOperationProgressOverlay
        progress={executionProgress}
        title="Executing Workflow"
        icon="🤖"
        color="#ff6b35"
      />
      <AgentOperationProgressOverlay
        progress={resetProgress}
        title="Resetting Workflow Engine"
        icon="🔄"
        color="#f59e0b"
      />
      
      <div className="h-full flex flex-col" style={{ 
        background: 'var(--primary-black)',
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Compact Header - Only show when NOT in advanced editor */}
      {!uiState.showAdvancedEditor && (
        <>
        {/* Breadcrumb Navigation */}
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.01)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8rem',
          color: 'var(--text-gray)',
          flexShrink: 0
        }}>
          <span style={{
            color: '#ffffff',
            fontWeight: 600,
            padding: '0.25rem 0.5rem',
            borderRadius: '4px'
          }}>
            🤖 Agents
          </span>
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ 
            color: 'var(--accent-orange)', 
            fontWeight: 600 
          }}>
            Multi-Agent Workflows
          </span>
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ 
            color: '#ffffff',
            fontWeight: uiState.activeTab === 'agencies' ? 600 : 400
          }}>
            {uiState.activeTab === 'agencies' ? 'Workflows' : 'Executions'}
          </span>
        </div>

        <div style={{
          background: 'rgba(255, 107, 53, 0.03)', // Level 1: Orange tint
          borderBottom: '2px solid rgba(255, 107, 53, 0.2)',
          padding: '0.75rem 1rem',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)'
              }}>
                🏢
              </div>
              <h2 className="text-lg font-semibold text-white">Workflows</h2>
              {uiState.initialized && selectedServerPair && (
                <div className="text-xs text-gray-400 ml-3 flex items-center gap-2 flex-wrap">
                  <span>Deployed to:</span>
                  <span className="text-gray-300 font-medium">
                    {serverPairs.find(p => p.pairId === selectedServerPair)?.name || 'Unknown'}
                  </span>
                  <button
                    onClick={() => {
                      setShowChangeServerModal(true);
                    }}
                    className="text-blue-400 hover:text-blue-300 underline text-sm font-semibold ml-2 px-2 py-1 rounded hover:bg-blue-500/10 transition-colors"
                    title="Change server pair (will require redeployment)"
                  >
                    Change Workflow Servers
                  </button>
                </div>
              )}
            </div>

            {/* Visually Separated Action Buttons */}
            <div className="flex items-center gap-2">
              <div style={{
                width: '1px',
                height: '24px',
                background: 'var(--border-color)',
                marginRight: '0.5rem',
                opacity: 0.5
              }} />
              <span style={{
                fontSize: '0.7rem',
                color: 'var(--text-gray)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginRight: '0.25rem',
                opacity: 0.6
              }}>Actions:</span>
              <button
                onClick={() => updateUIState({ activeView: 'templates' })}
                style={{
                  background: 'rgba(75, 85, 99, 0.2)',
                  border: '1px solid rgba(75, 85, 99, 0.3)',
                  borderRadius: '6px',
                  color: '#9CA3AF',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(75, 85, 99, 0.2)';
                  e.currentTarget.style.color = '#9CA3AF';
                }}
              >
                📋 Templates
              </button>
              
              <button
                onClick={() => updateUIState({ activeView: 'simple-builder' })}
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  color: '#3B82F6',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  e.currentTarget.style.color = '#3B82F6';
                }}
              >
                ⚡ Quick
              </button>

              <button
                onClick={() => updateUIState({ showAdvancedEditor: true })}
                style={{
                  background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 107, 53, 0.3)';
                }}
              >
                🚀 Editor
              </button>


              {uiState.initialized && (
                <button
                  onClick={() => resetAgencyWorkflow(false)}
                  disabled={uiState.initializing || showResetConfirmModal}
                  style={{
                    background: uiState.initializing 
                      ? 'rgba(107, 114, 128, 0.2)' 
                      : 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '6px',
                    color: uiState.initializing ? '#9CA3AF' : '#ef4444',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: uiState.initializing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: uiState.initializing ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!uiState.initializing) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!uiState.initializing) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                      e.currentTarget.style.color = '#ef4444';
                    }
                  }}
                  title="Reset workflow: Delete all data and redeploy from scratch"
                >
                  🔄 Reset
                </button>
              )}

              {uiState.frontendUrl && (
                <button
                  onClick={() => window.open(uiState.frontendUrl, '_blank', 'noopener,noreferrer')}
                  style={{
                    background: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    color: '#3B82F6',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                    e.currentTarget.style.color = '#3B82F6';
                  }}
                  title="Open workflow independent UI in a new tab"
                >
                  🌐 UI
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Level 2: Tab Navigation with Enhanced Visuals */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.02)', // Level 2: Green tint
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '0.75rem 1rem 0 2rem', // Aligned with content area padding
          flexShrink: 0,
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          overflowY: 'visible', // Allow tabs to extend upward without clipping
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
          position: 'relative',
          marginTop: '0.25rem' // Additional space to prevent clipping
        }}>
          <button
            onClick={() => updateUIState({ activeTab: 'agencies', activeView: 'dashboard' })}
            style={{
              position: 'relative',
              background: uiState.activeTab === 'agencies' 
                ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(16, 185, 129, 0.1))'
                : 'transparent',
              border: uiState.activeTab === 'agencies'
                ? '1px solid rgba(255, 107, 53, 0.4)'
                : '1px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: uiState.activeTab === 'agencies' ? '#ffffff' : '#9CA3AF',
              padding: '0.75rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: uiState.activeTab === 'agencies' ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              boxShadow: uiState.activeTab === 'agencies'
                ? '0 -4px 12px rgba(255, 107, 53, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                : 'none',
              transform: uiState.activeTab === 'agencies' ? 'translateY(-2px)' : 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              if (uiState.activeTab !== 'agencies') {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (uiState.activeTab !== 'agencies') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <span style={{
              fontSize: '1rem',
              display: 'inline-block',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: uiState.activeTab === 'agencies' ? 'scale(1.2) rotate(5deg)' : 'scale(1)',
              filter: uiState.activeTab === 'agencies'
                ? 'drop-shadow(0 4px 8px rgba(255, 107, 53, 0.4))'
                : 'none',
              opacity: uiState.activeTab === 'agencies' ? 1 : 0.7,
              marginRight: '0.5rem'
            }}>
              🏢
            </span>
            <span>Workflows</span>
            {uiState.activeTab === 'agencies' && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-green))',
                boxShadow: '0 0 8px rgba(255, 107, 53, 0.6)',
                borderRadius: '1px 1px 0 0'
              }} />
            )}
          </button>
          
          <button
            onClick={() => updateUIState({ activeTab: 'executions' })}
            style={{
              position: 'relative',
              background: uiState.activeTab === 'executions' 
                ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(16, 185, 129, 0.1))'
                : 'transparent',
              border: uiState.activeTab === 'executions'
                ? '1px solid rgba(255, 107, 53, 0.4)'
                : '1px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: uiState.activeTab === 'executions' ? '#ffffff' : '#9CA3AF',
              padding: '0.75rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: uiState.activeTab === 'executions' ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              boxShadow: uiState.activeTab === 'executions'
                ? '0 -4px 12px rgba(255, 107, 53, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                : 'none',
              transform: uiState.activeTab === 'executions' ? 'translateY(-2px)' : 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              if (uiState.activeTab !== 'executions') {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (uiState.activeTab !== 'executions') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <span style={{
              fontSize: '1rem',
              display: 'inline-block',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: uiState.activeTab === 'executions' ? 'scale(1.2) rotate(5deg)' : 'scale(1)',
              filter: uiState.activeTab === 'executions'
                ? 'drop-shadow(0 4px 8px rgba(255, 107, 53, 0.4))'
                : 'none',
              opacity: uiState.activeTab === 'executions' ? 1 : 0.7,
              marginRight: '0.5rem'
            }}>
              📊
            </span>
            <span>Executions</span>
            {executions.length > 0 && (
              <span style={{
                marginLeft: '0.5rem',
                background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '10px',
                boxShadow: '0 2px 4px rgba(255, 107, 53, 0.3)',
                display: 'inline-block',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {executions.length}
              </span>
            )}
            {uiState.activeTab === 'executions' && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-green))',
                boxShadow: '0 0 8px rgba(255, 107, 53, 0.6)',
                borderRadius: '1px 1px 0 0'
              }} />
            )}
          </button>
        </div>
        </>
      )}

      {/* Change Server Pair Confirmation Modal */}
      {showChangeServerModal && (
        <div 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowChangeServerModal(false);
            }
          }}
        >
          <div 
            style={{
              background: 'rgba(17, 17, 17, 0.98)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div className="text-center">
              <div style={{
                width: '64px',
                height: '64px',
                background: 'rgba(59, 130, 246, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto',
                border: '2px solid rgba(59, 130, 246, 0.4)'
              }}>
                <span style={{ fontSize: '2rem' }}>🔄</span>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-3">Change Workflow Servers</h3>
              <p className="text-gray-300 mb-4 leading-relaxed">
                Changing the server pair will require <strong className="text-blue-400">redeploying the agency workflow</strong>.
              </p>
              <p className="text-gray-400 text-sm mb-6">
                This will reset the workflow engine and you'll need to re-initialize it with the new server pair.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowChangeServerModal(false)}
                  style={{
                    flex: 1,
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '8px',
                    color: '#9CA3AF',
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(107, 114, 128, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowChangeServerModal(false);
                    setShowServerPairDialog(true);
            setUserDismissedDialog(false); // Reset when user explicitly wants to initialize
                    updateUIState({ initialized: false }); // Allow re-selection
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: '8px',
                    color: '#3B82F6',
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                    e.currentTarget.style.color = '#3B82F6';
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirmModal && (
        <div 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowResetConfirmModal(false);
            }
          }}
        >
          <div 
            style={{
              background: 'rgba(17, 17, 17, 0.98)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div className="text-center">
              <div style={{
                width: '64px',
                height: '64px',
                background: 'rgba(239, 68, 68, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto',
                border: '2px solid rgba(239, 68, 68, 0.4)'
              }}>
                <span style={{ fontSize: '2rem' }}>⚠️</span>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-3">Reset Agency Workflow</h3>
              <p className="text-gray-300 mb-4 leading-relaxed">
                This will <strong className="text-red-400">delete ALL workflow data</strong> including:
              </p>
              <ul className="text-left text-gray-400 text-sm mb-6 space-y-1" style={{ listStyle: 'none', padding: 0 }}>
                <li>• All agencies and workflows</li>
                <li>• All execution history</li>
                <li>• All triggers and configurations</li>
                <li>• All registered agents</li>
              </ul>
              <p className="text-red-400 font-medium mb-6">
                This action cannot be undone. Are you sure you want to continue?
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirmModal(false)}
                  style={{
                    flex: 1,
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '8px',
                    color: '#9CA3AF',
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(107, 114, 128, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={performReset}
                  style={{
                    flex: 1,
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '8px',
                    color: '#ef4444',
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                >
                  Yes, Reset Workflow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-auto" style={{ position: 'relative' }}>
        {/* Subtle loading indicator for background refreshes */}
        {uiState.loading && !uiState.initialLoading && agencies.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 100,
            background: 'rgba(17, 17, 17, 0.95)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
            <span className="text-gray-300 text-sm">Refreshing...</span>
          </div>
        )}
        
        {/* Full loading spinner only on initial load - Show once, then load in background */}
        {uiState.initialLoading && agencies.length === 0 ? (
          <div className="flex items-center justify-center" style={{ minHeight: '400px', height: '100%' }}>
            <div className="text-center">
              <div style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 1.5rem auto',
                position: 'relative'
              }}>
                <div className="animate-spin rounded-full border-4 border-transparent border-t-orange-500 border-r-orange-500" style={{
                  width: '100%',
                  height: '100%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '48px',
                  height: '48px',
                  background: 'rgba(255, 107, 53, 0.1)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  🏢
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Loading Workflows</h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
                Fetching your workflows, executions, and agent configurations...
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Error Display */}
            {uiState.error && (
              <div className="p-6 m-6 rounded-lg border" style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.3)'
              }}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-red-400 text-sm">{uiState.error}</p>
                  </div>
                  <button
                    onClick={() => updateUIState({ error: null })}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Agencies Tab View - Empty state is handled in dashboard view */}

            {/* Executions Tab View */}
            {uiState.activeTab === 'executions' && (
              <div style={{ 
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: isMobile ? '1rem 1rem 1rem 2rem' : '1.5rem 1.5rem 1.5rem 2rem' // Reduced left padding for content area
              }} className="chat-scrollbar">
                <div className="mb-6">
                  <h3 className={`font-semibold text-white mb-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>All Executions</h3>
                  <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    View and monitor all workflow executions, including AI responses from each agent step
                  </p>
                </div>

                {executions.length === 0 ? (
                  <div className="text-center py-12">
                    <div style={{
                      width: '80px',
                      height: '80px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1.5rem auto',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <span style={{ fontSize: '2rem' }}>📊</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">No executions yet</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Execute a workflow to see execution history and AI responses here
                    </p>
                    <button
                      onClick={() => updateUIState({ activeTab: 'agencies' })}
                      style={{
                        background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        padding: '0.75rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Go to Workflows →
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Desktop Executions List */}
                    {!isMobile && (
                      <div className="space-y-4">
                        {executions
                          .sort((a, b) => b.startTime - a.startTime)
                          .map((execution) => {
                            const agency = agencies.find(a => a.id === execution.agencyId);
                            const statusColors: Record<string, string> = {
                              'completed': '#10B981',
                              'running': '#3B82F6',
                              'failed': '#EF4444',
                              'pending': '#F59E0B',
                              'triggered': '#8B5CF6',
                              'scheduled': '#06B6D4'
                            };
                            const statusIcons: Record<string, string> = {
                              'completed': '✅',
                              'running': '⚡',
                              'failed': '❌',
                              'pending': '⏳',
                              'triggered': '🎯',
                              'scheduled': '📅'
                            };

                            return (
                              <div
                                key={execution.id}
                                onClick={() => updateUIState({ 
                                  selectedExecution: execution,
                                  showExecutionDetails: true 
                                })}
                                style={{
                                  background: 'rgba(17, 17, 17, 0.8)',
                                  border: '1px solid rgba(255, 107, 53, 0.2)',
                                  borderRadius: '12px',
                                  padding: '1.5rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  backdropFilter: 'blur(10px)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.4)';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.2)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span style={{ fontSize: '1.5rem' }}>
                                        {statusIcons[execution.status] || '📊'}
                                      </span>
                                      <div>
                                        <h4 className="text-lg font-semibold text-white">
                                          {execution.agencyName || 'Unknown Workflow'}
                                        </h4>
                                        <p className="text-xs text-gray-400">
                                          {new Date(execution.startTime).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                      <span style={{ 
                                        color: statusColors[execution.status] || '#9CA3AF',
                                        fontWeight: 600,
                                        textTransform: 'capitalize'
                                      }}>
                                        {execution.status}
                                      </span>
                                      <span className="text-gray-400">
                                        Step {execution.currentStep + 1} of {execution.totalAgents}
                                      </span>
                                      {execution.endTime && (
                                        <span className="text-gray-400">
                                          Duration: {Math.round((execution.endTime - execution.startTime) / 1000)}s
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUIState({ 
                                        selectedExecution: execution,
                                        showExecutionDetails: true 
                                      });
                                    }}
                                    style={{
                                      background: 'rgba(59, 130, 246, 0.2)',
                                      border: '1px solid rgba(59, 130, 246, 0.4)',
                                      borderRadius: '6px',
                                      color: '#3B82F6',
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.85rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                                      e.currentTarget.style.color = '#ffffff';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                                      e.currentTarget.style.color = '#3B82F6';
                                    }}
                                  >
                                    View Details →
                                  </button>
                                </div>
                                
                                {/* Execution Summary */}
                                <div style={{
                                  background: 'rgba(0, 0, 0, 0.3)',
                                  borderRadius: '8px',
                                  padding: '1rem',
                                  marginTop: '1rem'
                                }}>
                                  <div className="text-xs text-gray-400 mb-2">Input:</div>
                                  <div className="text-sm text-gray-300 font-mono break-all">
                                    {execution.input || 'No input'}
                                  </div>
                                  
                                  {execution.results && execution.results.length > 0 && (
                                    <div className="mt-3">
                                      <div className="text-xs text-gray-400 mb-2">
                                        Agent Steps ({execution.results.length}):
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {execution.results.map((result, idx) => (
                                          <div
                                            key={idx}
                                            style={{
                                              background: result.success 
                                                ? 'rgba(16, 185, 129, 0.1)' 
                                                : 'rgba(239, 68, 68, 0.1)',
                                              border: `1px solid ${result.success 
                                                ? 'rgba(16, 185, 129, 0.3)' 
                                                : 'rgba(239, 68, 68, 0.3)'}`,
                                              borderRadius: '6px',
                                              padding: '0.5rem 0.75rem',
                                              fontSize: '0.75rem'
                                            }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <span>{result.success ? '✅' : '❌'}</span>
                                              <span className="text-gray-300">{result.agentName}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Mobile Executions List - Optimized for touch */}
                    {isMobile && (
                      <div className="space-y-3">
                        {executions
                          .sort((a, b) => b.startTime - a.startTime)
                          .map((execution) => {
                            const statusColors: Record<string, string> = {
                              'completed': '#10B981',
                              'running': '#3B82F6',
                              'failed': '#EF4444',
                              'pending': '#F59E0B',
                              'triggered': '#8B5CF6',
                              'scheduled': '#06B6D4'
                            };
                            const statusIcons: Record<string, string> = {
                              'completed': '✅',
                              'running': '⚡',
                              'failed': '❌',
                              'pending': '⏳',
                              'triggered': '🎯',
                              'scheduled': '📅'
                            };

                            return (
                              <div
                                key={execution.id}
                                onClick={() => updateUIState({ 
                                  selectedExecution: execution,
                                  showExecutionDetails: true 
                                })}
                                style={{
                                  background: 'rgba(17, 17, 17, 0.8)',
                                  border: '1px solid rgba(255, 107, 53, 0.2)',
                                  borderRadius: '12px',
                                  padding: '1rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  backdropFilter: 'blur(10px)'
                                }}
                              >
                                {/* Mobile Header - Horizontal layout */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>
                                      {statusIcons[execution.status] || '📊'}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-base font-bold text-white truncate" title={execution.agencyName || 'Unknown Workflow'}>
                                        {execution.agencyName || 'Unknown Workflow'}
                                      </h4>
                                      <p className="text-xs text-gray-400">
                                        {new Date(execution.startTime).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>
                                  <div style={{
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '6px',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    background: `${statusColors[execution.status] || '#9CA3AF'}20`,
                                    color: statusColors[execution.status] || '#9CA3AF',
                                    border: `1px solid ${statusColors[execution.status] || '#9CA3AF'}40`,
                                    textTransform: 'capitalize',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {execution.status}
                                  </div>
                                </div>

                                {/* Mobile Metrics - Compact horizontal grid */}
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(3, 1fr)',
                                  gap: '0.5rem',
                                  marginBottom: '0.75rem',
                                  padding: '0.5rem',
                                  background: 'rgba(0, 0, 0, 0.3)',
                                  borderRadius: '8px',
                                  fontSize: '0.7rem'
                                }}>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>Step</div>
                                    <div style={{ color: '#3B82F6', fontWeight: 700, fontSize: '0.9rem' }}>
                                      {execution.currentStep + 1}/{execution.totalAgents}
                                    </div>
                                  </div>
                                  {execution.endTime && (
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>Duration</div>
                                      <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.9rem' }}>
                                        {Math.round((execution.endTime - execution.startTime) / 1000)}s
                                      </div>
                                    </div>
                                  )}
                                  {execution.results && execution.results.length > 0 && (
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>Results</div>
                                      <div style={{ color: '#10B981', fontWeight: 700, fontSize: '0.9rem' }}>
                                        {execution.results.length}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Mobile Input Preview - Truncated */}
                                <div style={{
                                  background: 'rgba(0, 0, 0, 0.3)',
                                  borderRadius: '6px',
                                  padding: '0.75rem',
                                  marginBottom: '0.75rem'
                                }}>
                                  <div className="text-xs text-gray-400 mb-1">Input:</div>
                                  <div className="text-xs text-gray-300 font-mono break-all line-clamp-2">
                                    {execution.input || 'No input'}
                                  </div>
                                </div>

                                {/* Mobile Agent Steps - Compact badges */}
                                {execution.results && execution.results.length > 0 && (
                                  <div>
                                    <div className="text-xs text-gray-400 mb-1">
                                      Steps ({execution.results.length}):
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {execution.results.slice(0, 4).map((result, idx) => (
                                        <div
                                          key={idx}
                                          style={{
                                            background: result.success 
                                              ? 'rgba(16, 185, 129, 0.1)' 
                                              : 'rgba(239, 68, 68, 0.1)',
                                            border: `1px solid ${result.success 
                                              ? 'rgba(16, 185, 129, 0.3)' 
                                              : 'rgba(239, 68, 68, 0.3)'}`,
                                            borderRadius: '4px',
                                            padding: '0.4rem 0.5rem',
                                            fontSize: '0.7rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem'
                                          }}
                                        >
                                          <span>{result.success ? '✅' : '❌'}</span>
                                          <span className="text-gray-300 truncate" style={{ maxWidth: '80px' }} title={result.agentName}>
                                            {result.agentName}
                                          </span>
                                        </div>
                                      ))}
                                      {execution.results.length > 4 && (
                                        <div style={{
                                          background: 'rgba(107, 114, 128, 0.1)',
                                          border: '1px solid rgba(107, 114, 128, 0.3)',
                                          borderRadius: '4px',
                                          padding: '0.4rem 0.5rem',
                                          fontSize: '0.7rem',
                                          color: '#9CA3AF'
                                        }}>
                                          +{execution.results.length - 4}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Mobile View Button - Full width, touch-friendly */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateUIState({ 
                                      selectedExecution: execution,
                                      showExecutionDetails: true 
                                    });
                                  }}
                                  style={{
                                    width: '100%',
                                    background: 'rgba(59, 130, 246, 0.2)',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    borderRadius: '8px',
                                    color: '#3B82F6',
                                    padding: '0.75rem',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    marginTop: '0.75rem',
                                    minHeight: '44px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                  }}
                                >
                                  <span>📊</span>
                                  <span>View Details</span>
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Dashboard View */}
            {uiState.activeTab === 'agencies' && uiState.activeView === 'dashboard' && (
              <div style={{ 
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '0.75rem 1rem 0.75rem 2rem' // Reduced left padding for content area
              }} className="chat-scrollbar">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">Your Workflows</h3>
                    <p className="text-xs text-gray-400">
                      {agencies.length} workflow{agencies.length !== 1 ? 's' : ''} configured
                    </p>
                  </div>
                  {agencies.length > 0 && (
                    <button
                      onClick={() => updateUIState({ showAdvancedEditor: true })}
                      style={{
                        background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#ffffff',
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 107, 53, 0.3)';
                      }}
                    >
                      🚀 Create Workflow
                    </button>
                  )}
                </div>

                {agencies.length === 0 ? (
                  <div className="text-center py-4">
                    <div style={{
                      width: '80px',
                      height: '80px',
                      background: 'rgba(255, 107, 53, 0.1)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem auto',
                      border: '1px solid rgba(255, 107, 53, 0.2)'
                    }}>
                      <span style={{ fontSize: '2rem' }}>🏢</span>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-white mb-2">No workflows yet</h3>
                    <p className="text-gray-400 mb-4 text-sm leading-relaxed max-w-lg mx-auto">
                      Create your first workflow to orchestrate sophisticated multi-agent processes.
                    </p>
                    
                    {uiState.frontendUrl && (
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '12px',
                        padding: '1rem 1.5rem',
                        marginBottom: '1.5rem',
                        maxWidth: '600px',
                        margin: '0 auto 1.5rem auto'
                      }}>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-blue-400 font-semibold text-sm mb-1">🌐 Decentralized Frontend Available</p>
                            <p className="text-gray-400 text-xs">
                              Access the workflow's independent UI running on the Internet Computer
                            </p>
                          </div>
                          <a
                            href={uiState.frontendUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(uiState.frontendUrl, '_blank', 'noopener,noreferrer');
                            }}
                            style={{
                              background: 'rgba(59, 130, 246, 0.2)',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              borderRadius: '6px',
                              color: '#3B82F6',
                              padding: '0.5rem 1rem',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                              e.currentTarget.style.color = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                              e.currentTarget.style.color = '#3B82F6';
                            }}
                          >
                            Open UI →
                          </a>
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-500/20">
                          <a
                            href={uiState.frontendUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-300 hover:text-blue-200 text-xs font-mono break-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(uiState.frontendUrl, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            {uiState.frontendUrl}
                          </a>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => updateUIState({ activeView: 'templates' })}
                        style={{
                          background: 'rgba(75, 85, 99, 0.2)',
                          border: '1px solid rgba(75, 85, 99, 0.3)',
                          borderRadius: '6px',
                          color: '#9CA3AF',
                          padding: '0.5rem 1rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        📋 Templates
                      </button>
                      
                      <button
                        onClick={() => updateUIState({ showAdvancedEditor: true })}
                        style={{
                          background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#ffffff',
                          padding: '0.5rem 1.25rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)'
                        }}
                      >
                        🚀 Create Workflow
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Desktop Workflow Cards */}
                    {!isMobile && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {agencies.map(agency => (
                        <div key={agency.id} style={{
                          background: 'rgba(17, 17, 17, 0.8)',
                          border: '1px solid rgba(255, 107, 53, 0.2)',
                          borderRadius: '12px',
                          padding: '1rem',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                          backdropFilter: 'blur(10px)',
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                        className="hover:border-orange-500/50"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        >
                        {/* Header with icon, name, status, and delete */}
                        <div className="flex items-start justify-between mb-2">
                          <div style={{
                            width: '36px',
                            height: '36px',
                            background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            flexShrink: 0
                          }}>
                            🏢
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '8px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              background: agency.enabled 
                                ? 'rgba(16, 185, 129, 0.2)' 
                                : 'rgba(107, 114, 128, 0.2)',
                              color: agency.enabled ? '#10B981' : '#9CA3AF',
                              border: agency.enabled 
                                ? '1px solid rgba(16, 185, 129, 0.3)' 
                                : '1px solid rgba(107, 114, 128, 0.3)',
                              whiteSpace: 'nowrap',
                              height: '22px',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              {agency.enabled ? 'Active' : 'Disabled'}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAgencyToDelete({ id: agency.id, name: agency.name });
                                setShowDeleteAgencyModal(true);
                              }}
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '4px',
                                padding: '0.25rem',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '0.7rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease',
                                width: '22px',
                                height: '22px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                                e.currentTarget.style.color = '#ffffff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.color = '#ef4444';
                              }}
                              title="Delete workflow"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Agency Name */}
                        <h4 className="text-lg font-bold text-white mb-0.5 truncate" title={agency.name}>
                          {agency.name}
                        </h4>
                        <p className="text-gray-400 text-xs line-clamp-1 mb-1.5" style={{ minHeight: '14px' }} title={agency.description}>{agency.description}</p>

                        {/* Metrics in 2x2 grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '0.75rem',
                          marginBottom: '0.5rem',
                          padding: '0.75rem',
                          paddingRight: '0.5rem',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          flex: 1,
                          fontSize: '0.8rem'
                        }}>
                          <div>
                            <div style={{ color: '#888', marginBottom: '0.25rem' }}>Agents</div>
                            <div style={{ color: '#3B82F6', fontWeight: 700, fontSize: '1.2rem' }}>
                              {agency.steps.length}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#888', marginBottom: '0.25rem' }}>Triggers</div>
                            <div style={{ color: '#8B5CF6', fontWeight: 700, fontSize: '1.2rem' }}>
                              {agency.globalTriggers.length}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#888', marginBottom: '0.25rem' }}>Mode</div>
                            <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '1.2rem', textTransform: 'capitalize' }}>
                              {agency.executionMode}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#888', marginBottom: '0.25rem' }}>Executions</div>
                            <div style={{ color: '#10B981', fontWeight: 700, fontSize: '1.2rem' }}>
                              {executions.filter(e => e.agencyId === agency.id).length}
                            </div>
                          </div>
                        </div>
                        
                        {/* Recent Execution Status with Progress Indicator */}
                        {(() => {
                          const recentExecutions = executions
                            .filter(e => e.agencyId === agency.id)
                            .sort((a, b) => b.startTime - a.startTime)
                            .slice(0, 1);
                          const latest = recentExecutions[0];
                          const isRunning = latest?.status === 'running';
                          
                          if (latest) {
                            const statusColors: Record<string, string> = {
                              'completed': '#10B981',
                              'running': '#3B82F6',
                              'failed': '#EF4444',
                              'pending': '#F59E0B'
                            };
                            
                            // Calculate progress for running executions
                            const progress = isRunning && latest.totalAgents > 0
                              ? Math.round((latest.currentStep / latest.totalAgents) * 100)
                              : latest.status === 'completed' ? 100 : 0;
                            
                            return (
                              <div style={{
                                background: isRunning 
                                  ? 'rgba(59, 130, 246, 0.15)' 
                                  : 'rgba(59, 130, 246, 0.1)',
                                border: `1px solid ${statusColors[latest.status] || '#9CA3AF'}40`,
                                borderRadius: '6px',
                                padding: '0.4rem 0.5rem',
                                marginBottom: '0.75rem',
                                position: 'relative',
                                overflow: 'hidden'
                              }}>
                                {/* Progress bar for running executions */}
                                {isRunning && (
                                  <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '2px',
                                    background: `linear-gradient(90deg, ${statusColors[latest.status] || '#3B82F6'}, ${statusColors[latest.status] || '#3B82F6'}80)`,
                                    transform: `translateX(-${100 - progress}%)`,
                                    transition: 'transform 0.3s ease',
                                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                  }} />
                                )}
                                
                                <div className="flex items-center justify-between text-xs" style={{ position: 'relative', zIndex: 1 }}>
                                  <div className="flex items-center gap-2">
                                    {isRunning && (
                                      <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: statusColors[latest.status] || '#3B82F6',
                                        animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                        boxShadow: `0 0 8px ${statusColors[latest.status] || '#3B82F6'}80`
                                      }} />
                                    )}
                                    <span className="text-gray-400">{isRunning ? 'Executing' : 'Latest'}:</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isRunning && latest.totalAgents > 0 && (
                                      <span style={{ 
                                        color: '#888',
                                        fontSize: '0.65rem',
                                        fontWeight: 500
                                      }}>
                                        {latest.currentStep + 1}/{latest.totalAgents}
                                      </span>
                                    )}
                                    <span style={{ 
                                      color: statusColors[latest.status] || '#9CA3AF',
                                      fontWeight: 600,
                                      textTransform: 'capitalize'
                                    }}>
                                      {latest.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Action Buttons - Stacked vertically */}
                        <div className="flex flex-col gap-1.5 mt-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateUIState({ selectedAgency: agency });
                              setExecutionInput('');
                            }}
                            style={{
                              width: '100%',
                              background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#ffffff',
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem'
                            }}
                          >
                            ▶️ Execute
                          </button>
                          <div className="flex gap-1.5">
                            {(() => {
                              const recentExecution = executions
                                .filter(e => e.agencyId === agency.id)
                                .sort((a, b) => b.startTime - a.startTime)[0];
                              
                              if (recentExecution) {
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUIState({ 
                                        selectedExecution: recentExecution,
                                        showExecutionDetails: true 
                                      });
                                    }}
                                    style={{
                                      flex: 1,
                                      background: 'rgba(59, 130, 246, 0.2)',
                                      border: '1px solid rgba(59, 130, 246, 0.4)',
                                      borderRadius: '6px',
                                      color: '#3B82F6',
                                      padding: '0.4rem 0.5rem',
                                      fontSize: '0.875rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '0.3rem'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                                      e.currentTarget.style.color = '#ffffff';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                                      e.currentTarget.style.color = '#3B82F6';
                                    }}
                                  >
                                    📊 View
                                  </button>
                                );
                              }
                              return null;
                            })()}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData({
                                  name: agency.name,
                                  description: agency.description,
                                  steps: agency.steps,
                                  connections: agency.connections || [], // NEW: Include connections when editing
                                  executionMode: agency.executionMode as any
                                });
                                setHasInitialSave(true); // Editing existing agency, so it's been saved
                                setCurrentAgencyId(agency.id);
                                // Load triggers for the selected agency
                                if (agency.id) {
                                  loadTriggers(agency.id);
                                }
                                updateUIState({ showAdvancedEditor: true });
                                // Note: Connections will be passed via initialConnections prop to WorkflowCanvas
                              }}
                              style={{
                                flex: 1,
                                background: 'rgba(75, 85, 99, 0.2)',
                                border: '1px solid rgba(75, 85, 99, 0.3)',
                                borderRadius: '6px',
                                color: '#9CA3AF',
                                padding: '0.4rem 0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        </div>
                      </div>
                      ))}
                      </div>
                    )}

                    {/* Mobile Workflow Cards - Optimized for touch */}
                    {isMobile && (
                      <div className="space-y-3">
                        {agencies.map(agency => (
                        <div key={agency.id} style={{
                          background: 'rgba(17, 17, 17, 0.8)',
                          border: '1px solid rgba(255, 107, 53, 0.2)',
                          borderRadius: '12px',
                          padding: '1rem',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                          backdropFilter: 'blur(10px)',
                          width: '100%'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateUIState({ selectedAgency: agency });
                          setExecutionInput('');
                        }}
                        >
                          {/* Mobile Header - Horizontal layout */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div style={{
                                width: '32px',
                                height: '32px',
                                background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1rem',
                                flexShrink: 0
                              }}>
                                🏢
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-base font-bold text-white truncate" title={agency.name}>
                                  {agency.name}
                                </h4>
                                <p className="text-gray-400 text-xs line-clamp-1" title={agency.description}>
                                  {agency.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <div style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                background: agency.enabled 
                                  ? 'rgba(16, 185, 129, 0.2)' 
                                  : 'rgba(107, 114, 128, 0.2)',
                                color: agency.enabled ? '#10B981' : '#9CA3AF',
                                border: agency.enabled 
                                  ? '1px solid rgba(16, 185, 129, 0.3)' 
                                  : '1px solid rgba(107, 114, 128, 0.3)',
                                whiteSpace: 'nowrap',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center'
                              }}>
                                {agency.enabled ? 'Active' : 'Disabled'}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAgencyToDelete({ id: agency.id, name: agency.name });
                                  setShowDeleteAgencyModal(true);
                                }}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '4px',
                                  padding: '0.25rem',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease',
                                  width: '20px',
                                  height: '20px'
                                }}
                                title="Delete workflow"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          {/* Mobile Metrics - Horizontal scroll or compact grid */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                            padding: '0.5rem',
                            background: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            fontSize: '0.7rem'
                          }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>Agents</div>
                              <div style={{ color: '#3B82F6', fontWeight: 700, fontSize: '1rem' }}>
                                {agency.steps.length}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>Triggers</div>
                              <div style={{ color: '#8B5CF6', fontWeight: 700, fontSize: '1rem' }}>
                                {agency.globalTriggers.length}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>Mode</div>
                              <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.85rem', textTransform: 'capitalize' }}>
                                {agency.executionMode.slice(0, 4)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ color: '#888', marginBottom: '0.2rem', fontSize: '0.65rem' }}>Exec</div>
                              <div style={{ color: '#10B981', fontWeight: 700, fontSize: '1rem' }}>
                                {executions.filter(e => e.agencyId === agency.id).length}
                              </div>
                            </div>
                          </div>

                          {/* Mobile Action Buttons - Full width, touch-friendly */}
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateUIState({ selectedAgency: agency });
                                setExecutionInput('');
                              }}
                              style={{
                                width: '100%',
                                background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#ffffff',
                                padding: '0.75rem',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                minHeight: '44px' // Touch-friendly minimum
                              }}
                            >
                              ▶️ Execute
                            </button>
                            <div className="flex gap-2">
                              {(() => {
                                const recentExecution = executions
                                  .filter(e => e.agencyId === agency.id)
                                  .sort((a, b) => b.startTime - a.startTime)[0];
                                
                                if (recentExecution) {
                                  const isRunning = recentExecution.status === 'running';
                                  const statusColors: Record<string, string> = {
                                    'completed': '#10B981',
                                    'running': '#3B82F6',
                                    'failed': '#EF4444',
                                    'pending': '#F59E0B'
                                  };
                                  const progress = isRunning && recentExecution.totalAgents > 0
                                    ? Math.round((recentExecution.currentStep / recentExecution.totalAgents) * 100)
                                    : recentExecution.status === 'completed' ? 100 : 0;
                                  
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateUIState({ 
                                          selectedExecution: recentExecution,
                                          showExecutionDetails: true 
                                        });
                                      }}
                                      style={{
                                        flex: 1,
                                        background: isRunning 
                                          ? 'rgba(59, 130, 246, 0.25)' 
                                          : 'rgba(59, 130, 246, 0.2)',
                                        border: `1px solid ${statusColors[recentExecution.status] || '#3B82F6'}60`,
                                        borderRadius: '8px',
                                        color: statusColors[recentExecution.status] || '#3B82F6',
                                        padding: '0.6rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.3rem',
                                        minHeight: '44px', // Touch-friendly
                                        position: 'relative',
                                        overflow: 'hidden'
                                      }}
                                    >
                                      {/* Progress bar for running executions */}
                                      {isRunning && (
                                        <div style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          right: 0,
                                          height: '2px',
                                          background: `linear-gradient(90deg, ${statusColors[recentExecution.status] || '#3B82F6'}, ${statusColors[recentExecution.status] || '#3B82F6'}80)`,
                                          transform: `translateX(-${100 - progress}%)`,
                                          transition: 'transform 0.3s ease',
                                          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                        }} />
                                      )}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', position: 'relative', zIndex: 1 }}>
                                        {isRunning && (
                                          <div style={{
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            background: statusColors[recentExecution.status] || '#3B82F6',
                                            animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                            boxShadow: `0 0 6px ${statusColors[recentExecution.status] || '#3B82F6'}80`
                                          }} />
                                        )}
                                        <span>📊 {isRunning ? 'Executing' : 'View'}</span>
                                        {isRunning && recentExecution.totalAgents > 0 && (
                                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                            {recentExecution.currentStep + 1}/{recentExecution.totalAgents}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData({
                                    name: agency.name,
                                    description: agency.description,
                                    steps: agency.steps,
                                    connections: agency.connections || [],
                                    executionMode: agency.executionMode as any
                                  });
                                  setHasInitialSave(true);
                                  setCurrentAgencyId(agency.id);
                                  // Load triggers for the selected agency
                                  if (agency.id) {
                                    loadTriggers(agency.id);
                                  }
                                  updateUIState({ showAdvancedEditor: true });
                                }}
                                style={{
                                  flex: 1,
                                  background: 'rgba(75, 85, 99, 0.2)',
                                  border: '1px solid rgba(75, 85, 99, 0.3)',
                                  borderRadius: '8px',
                                  color: '#9CA3AF',
                                  padding: '0.6rem',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3rem',
                                  minHeight: '44px' // Touch-friendly
                                }}
                              >
                                ✏️ Edit
                              </button>
                            </div>
                          </div>
                        </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Templates View */}
            {uiState.activeView === 'templates' && (
              <div style={{ 
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '1.5rem'
              }} className="chat-scrollbar">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Workflow Templates</h3>
                    <p className="text-gray-400">Choose from pre-built templates to get started quickly</p>
                  </div>
                  <button
                    onClick={() => updateUIState({ activeView: 'dashboard' })}
                    style={{
                      background: 'rgba(107, 114, 128, 0.2)',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                      borderRadius: '6px',
                      color: '#9CA3AF',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(107, 114, 128, 0.3)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
                      e.currentTarget.style.color = '#9CA3AF';
                    }}
                  >
                    ← Back to Dashboard
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {workflowTemplates.map(template => (
                    <div key={template.id} style={{
                      background: 'rgba(17, 17, 17, 0.8)',
                      border: '1px solid rgba(255, 107, 53, 0.2)',
                      borderRadius: '16px',
                      padding: '1.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    className="hover:border-orange-500/50"
                    onClick={() => handleTemplateSelect(template)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div style={{
                          width: '48px',
                          height: '48px',
                          background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem'
                        }}>
                          {template.icon}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white">{template.name}</h4>
                          <p className="text-xs text-gray-400 capitalize">{template.category}</p>
                        </div>
                      </div>
                      
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{template.description}</p>
                      
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        color: '#9CA3AF'
                      }}>
                        <span>{template.steps.length} steps</span>
                        <span className="capitalize">{template.executionMode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Simple Builder View */}
            {uiState.activeView === 'simple-builder' && (
              <div style={{ 
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '1.5rem'
              }} className="chat-scrollbar">
                <div className="max-w-4xl mx-auto">
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-white mb-2">Quick Workflow Builder</h3>
                    <p className="text-gray-400">Create sequential workflows with an intuitive form-based interface</p>
                  </div>

                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div style={{
                      background: 'rgba(17, 17, 17, 0.8)',
                      border: '1px solid rgba(255, 107, 53, 0.2)',
                      borderRadius: '16px',
                      padding: '2rem',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <h4 className="text-lg font-semibold text-white mb-4">Workflow Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-3">
                            Workflow Name *
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter workflow name"
                            style={{
                              width: '100%',
                              background: 'rgba(31, 31, 31, 0.8)',
                              border: '1px solid rgba(75, 85, 99, 0.5)',
                              borderRadius: '8px',
                              color: '#ffffff',
                              padding: '0.75rem 1rem',
                              fontSize: '0.9rem',
                              outline: 'none',
                              transition: 'all 0.2s ease'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = 'var(--accent-orange)';
                              e.target.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-3">
                            Description
                          </label>
                          <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe what this workflow does"
                            style={{
                              width: '100%',
                              background: 'rgba(31, 31, 31, 0.8)',
                              border: '1px solid rgba(75, 85, 99, 0.5)',
                              borderRadius: '8px',
                              color: '#ffffff',
                              padding: '0.75rem 1rem',
                              fontSize: '0.9rem',
                              outline: 'none',
                              transition: 'all 0.2s ease'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = 'var(--accent-orange)';
                              e.target.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Steps List */}
                    <div style={{
                      background: 'rgba(17, 17, 17, 0.8)',
                      border: '1px solid rgba(255, 107, 53, 0.2)',
                      borderRadius: '16px',
                      padding: '2rem',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-white">Workflow Steps</h4>
                        <span className="text-sm text-gray-400">
                          {formData.steps.length} step{formData.steps.length !== 1 ? 's' : ''} configured
                        </span>
                      </div>

                      <div className="space-y-3 mb-6">
                        {formData.steps.map((step, index) => (
                          <div key={index} style={{
                            background: 'rgba(31, 31, 31, 0.5)',
                            border: '1px solid rgba(75, 85, 99, 0.3)',
                            borderRadius: '8px',
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem'
                          }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.9rem',
                              fontWeight: 'bold',
                              color: '#ffffff'
                            }}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-medium">{step.agentName}</div>
                              <div className="text-gray-400 text-sm">{step.inputTemplate}</div>
                            </div>
                            <button
                              onClick={() => {
                                const newSteps = formData.steps.filter((_, i) => i !== index);
                                setFormData(prev => ({ ...prev, steps: newSteps }));
                              }}
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '6px',
                                color: '#ef4444',
                                padding: '0.5rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add Step Form */}
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(75, 85, 99, 0.3)',
                        borderRadius: '8px',
                        padding: '1.5rem'
                      }}>
                        <h5 className="text-white font-medium mb-3">Add New Step</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <input
                            type="text"
                            value={stepFormData.agentName}
                            onChange={(e) => setStepFormData(prev => ({ ...prev, agentName: e.target.value }))}
                            placeholder="Agent name"
                            style={{
                              background: 'rgba(31, 31, 31, 0.8)',
                              border: '1px solid rgba(75, 85, 99, 0.5)',
                              borderRadius: '6px',
                              color: '#ffffff',
                              padding: '0.75rem',
                              fontSize: '0.9rem',
                              outline: 'none'
                            }}
                          />
                          <input
                            type="text"
                            value={stepFormData.inputTemplate}
                            onChange={(e) => setStepFormData(prev => ({ ...prev, inputTemplate: e.target.value }))}
                            placeholder="Input template (e.g., Process: {input})"
                            style={{
                              background: 'rgba(31, 31, 31, 0.8)',
                              border: '1px solid rgba(75, 85, 99, 0.5)',
                              borderRadius: '6px',
                              color: '#ffffff',
                              padding: '0.75rem',
                              fontSize: '0.9rem',
                              outline: 'none'
                            }}
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (stepFormData.agentName && stepFormData.inputTemplate) {
                              const newStep: AgentStep = {
                                agentCanisterId: stepFormData.agentCanisterId,
                                agentName: stepFormData.agentName,
                                inputTemplate: stepFormData.inputTemplate,
                                requiresApproval: stepFormData.requiresApproval,
                                retryOnFailure: stepFormData.retryOnFailure,
                                timeout: stepFormData.timeout
                              };
                              setFormData(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
                              setStepFormData({
                                agentCanisterId: '',
                                agentName: '',
                                inputTemplate: '{input}',
                                requiresApproval: false,
                                retryOnFailure: true
                              });
                            }
                          }}
                          disabled={!stepFormData.agentName || !stepFormData.inputTemplate}
                          style={{
                            background: !stepFormData.agentName || !stepFormData.inputTemplate
                              ? 'rgba(107, 114, 128, 0.2)'
                              : 'linear-gradient(135deg, var(--accent-green), #059669)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#ffffff',
                            padding: '0.75rem 1.5rem',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: !stepFormData.agentName || !stepFormData.inputTemplate ? 'not-allowed' : 'pointer',
                            opacity: !stepFormData.agentName || !stepFormData.inputTemplate ? 0.5 : 1,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Add Step
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-4 pt-4">
                      <button
                        onClick={() => updateUIState({ activeView: 'dashboard' })}
                        style={{
                          background: 'rgba(107, 114, 128, 0.2)',
                          border: '1px solid rgba(107, 114, 128, 0.3)',
                          borderRadius: '8px',
                          color: '#9CA3AF',
                          padding: '0.75rem 1.5rem',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Cancel
                      </button>
                      
                      <button
                        onClick={() => updateUIState({ showAdvancedEditor: true })}
                        style={{
                          background: 'rgba(59, 130, 246, 0.2)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '8px',
                          color: '#3B82F6',
                          padding: '0.75rem 1.5rem',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Open Advanced Editor
                      </button>
                      
                      <button
                        onClick={() => createAgency()}
                        disabled={!formData.name || formData.steps.length === 0 || uiState.loading}
                        style={{
                          background: !formData.name || formData.steps.length === 0 || uiState.loading
                            ? 'rgba(107, 114, 128, 0.2)'
                            : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#ffffff',
                          padding: '0.75rem 2rem',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          cursor: !formData.name || formData.steps.length === 0 || uiState.loading ? 'not-allowed' : 'pointer',
                          opacity: !formData.name || formData.steps.length === 0 || uiState.loading ? 0.5 : 1,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          boxShadow: !formData.name || formData.steps.length === 0 || uiState.loading ? 'none' : '0 4px 15px rgba(255, 107, 53, 0.3)'
                        }}
                      >
                        {uiState.loading && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        )}
                        Create Workflow
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Execute Agency Modal */}
      {uiState.selectedAgency && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'rgba(17, 17, 17, 0.95)',
            border: '1px solid rgba(255, 107, 53, 0.2)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{
              padding: '2rem',
              borderBottom: '1px solid rgba(255, 107, 53, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Execute: {uiState.selectedAgency.name}</h3>
                <p className="text-gray-400">{uiState.selectedAgency.description}</p>
              </div>
              <button
                onClick={() => updateUIState({ selectedAgency: null })}
                style={{
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '8px',
                  color: '#9CA3AF',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '2rem' }}>
              <div className="space-y-6">
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(75, 85, 99, 0.3)',
                  borderRadius: '8px',
                  padding: '1.5rem'
                }}>
                  <h4 className="text-white font-semibold mb-3">Workflow Configuration</h4>
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                      <span className="text-gray-400">Steps:</span>
                      <span className="text-white ml-2 font-medium">{uiState.selectedAgency.steps.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Mode:</span>
                      <span className="text-white ml-2 font-medium capitalize">{uiState.selectedAgency.executionMode}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Triggers:</span>
                      <span className="text-white ml-2 font-medium">{uiState.selectedAgency.globalTriggers.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Status:</span>
                      <span style={{
                        color: uiState.selectedAgency.enabled ? '#10B981' : '#9CA3AF',
                        marginLeft: '0.5rem',
                        fontWeight: 600
                      }}>
                        {uiState.selectedAgency.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Execution Input
                  </label>
                  <textarea
                    value={executionInput}
                    onChange={(e) => setExecutionInput(e.target.value)}
                    rows={4}
                    placeholder="Enter the input that will be processed by the workflow..."
                    style={{
                      width: '100%',
                      background: 'rgba(31, 31, 31, 0.8)',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '1rem',
                      fontSize: '0.9rem',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: '100px',
                      lineHeight: 1.5
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--accent-orange)';
                      e.target.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    This input will be passed to the first agent in the workflow sequence
                  </p>
                </div>

                <div className="flex items-center justify-end gap-4 pt-4">
                  <button
                    onClick={() => updateUIState({ selectedAgency: null })}
                    style={{
                      background: 'rgba(107, 114, 128, 0.2)',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                      borderRadius: '8px',
                      color: '#9CA3AF',
                      padding: '0.75rem 1.5rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeAgency(uiState.selectedAgency!.id, executionInput)}
                    disabled={!executionInput.trim() || uiState.loading}
                    style={{
                      background: !executionInput.trim() || uiState.loading
                        ? 'rgba(107, 114, 128, 0.2)'
                        : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '0.75rem 2rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: !executionInput.trim() || uiState.loading ? 'not-allowed' : 'pointer',
                      opacity: !executionInput.trim() || uiState.loading ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: !executionInput.trim() || uiState.loading ? 'none' : '0 4px 15px rgba(255, 107, 53, 0.3)'
                    }}
                  >
                    {uiState.loading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    ▶️ Execute Workflow
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Execution Monitor Modal */}
      {uiState.showExecutionDetails && uiState.selectedExecution && (
        <WorkflowExecutionMonitor
          execution={uiState.selectedExecution}
          agency={agencies.find(a => a.id === uiState.selectedExecution!.agencyId)}
          onClose={() => updateUIState({ 
            showExecutionDetails: false,
            selectedExecution: null 
          })}
          onRerun={async () => {
            if (uiState.selectedExecution && uiState.selectedAgency) {
              const input = uiState.selectedExecution.input;
              await executeAgency(uiState.selectedAgency.id, input);
              updateUIState({ 
                showExecutionDetails: false,
                selectedExecution: null 
              });
            }
          }}
        />
      )}

      {/* Save Workflow Modal - Always use portal to ensure it appears above everything (for dashboard view) */}
      {showSaveAgencyModal && typeof document !== 'undefined' && document.body && createPortal((
        <div 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000, // Extremely high z-index to ensure it's above everything
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSaveAgencyModal(false);
            }
          }}
        >
          <div 
            style={{
              background: 'var(--secondary-black)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '500px',
              padding: '2rem',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">Save Agency</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agency Name *
                </label>
                <input
                  type="text"
                  value={saveAgencyName}
                  onChange={(e) => setSaveAgencyName(e.target.value)}
                  placeholder="Enter agency name"
                  className="w-full px-3 py-2 border rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  style={{
                    background: 'var(--tertiary-black)',
                    borderColor: 'var(--border-color)'
                  }}
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={saveAgencyDescription}
                  onChange={(e) => setSaveAgencyDescription(e.target.value)}
                  placeholder="Enter agency description (optional)"
                  rows={3}
                  className="w-full px-3 py-2 border rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  style={{
                    background: 'var(--tertiary-black)',
                    borderColor: 'var(--border-color)'
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSaveAgencyModal(false);
                  setSaveAgencyName('');
                  setSaveAgencyDescription('');
                }}
                style={{
                  flex: 1,
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '8px',
                  color: '#9CA3AF',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!saveAgencyName.trim()) {
                    alert('Please enter an agency name');
                    return;
                  }
                  
                  // Close modal first
                  setShowSaveAgencyModal(false);
                  
                  // Update formData with the values from modal
                  setFormData(prev => ({ 
                    ...prev, 
                    name: saveAgencyName.trim(),
                    description: saveAgencyDescription.trim()
                  }));
                  
                  // Wait a tick to ensure state is updated, then create agency
                  setTimeout(async () => {
                    console.log('💾 [AgencyManagement] Creating new agency from modal...', {
                      name: saveAgencyName.trim(),
                      description: saveAgencyDescription.trim(),
                      stepsCount: formData.steps.length
                    });
                    // Use the modal values directly to avoid timing issues
                    await createAgency(saveAgencyName.trim(), saveAgencyDescription.trim(), formData.steps);
                    setSaveAgencyName('');
                    setSaveAgencyDescription('');
                  }, 0);
                }}
                disabled={!saveAgencyName.trim() || uiState.loading}
                style={{
                  flex: 1,
                  background: !saveAgencyName.trim() || uiState.loading
                    ? 'rgba(107, 114, 128, 0.2)'
                    : 'linear-gradient(135deg, var(--accent-green), #059669)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: !saveAgencyName.trim() || uiState.loading ? 'not-allowed' : 'pointer',
                  opacity: !saveAgencyName.trim() || uiState.loading ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {uiState.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                    Saving...
                  </>
                ) : (
                  '💾 Save Workflow'
                )}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Template Agent Selection Modal */}
      {showTemplateAgentSelector && selectedTemplate && (
        <div 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTemplateAgentSelector(false);
              setSelectedTemplate(null);
              setTemplateAgentSelections(new Map());
            }
          }}
        >
          <div 
            style={{
              background: 'var(--secondary-black)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              padding: '2rem',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-2">Configure Template Agents</h3>
            <p className="text-gray-400 text-sm mb-2">
              Select agents for each step in the "{selectedTemplate.name}" template.
            </p>
            <p className="text-gray-500 text-xs mb-6">
              💡 <strong>Tip:</strong> You can reuse the same agent for multiple steps. You can also change these selections later in the workflow editor.
            </p>

            <div className="space-y-4 mb-6">
              {selectedTemplate.steps.map((step, index) => {
                const availableAgents = registeredAgents.filter(agent => {
                  const selectedPair = selectedServerPair && serverPairs.length > 0 
                    ? serverPairs.find((p: ServerPair) => p.pairId === selectedServerPair) 
                    : null;
                  const agencyWorkflowCanisterId = selectedPair?.backendCanisterId;
                  
                  if (agencyWorkflowCanisterId && agent.canisterId === agencyWorkflowCanisterId) {
                    return false;
                  }
                  return true;
                });

                const selectedAgentId = templateAgentSelections.get(index) || '';
                
                // Check if this agent is used in other steps (for visual indicator)
                const agentUsageCount = Array.from(templateAgentSelections.values())
                  .filter(id => id === selectedAgentId && id !== '').length;
                const isReused = agentUsageCount > 1;

                return (
                  <div
                    key={index}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: isReused 
                        ? '1px solid rgba(139, 92, 246, 0.4)' 
                        : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '1rem'
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{step.agentName}</span>
                        <span className="text-xs text-gray-400">(Step {index + 1})</span>
                      </div>
                      {isReused && (
                        <span 
                          className="text-xs"
                          style={{
                            color: '#8B5CF6',
                            background: 'rgba(139, 92, 246, 0.2)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontWeight: 600
                          }}
                          title="This agent is used in multiple steps"
                        >
                          🔄 Reused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{step.inputTemplate}</p>
                    
                    {availableAgents.length === 0 ? (
                      <div className="text-sm text-yellow-400">
                        ⚠️ No agents available. Please deploy agents first, then try again.
                      </div>
                    ) : (
                      <select
                        value={selectedAgentId}
                        onChange={(e) => {
                          const newSelections = new Map(templateAgentSelections);
                          newSelections.set(index, e.target.value);
                          setTemplateAgentSelections(newSelections);
                        }}
                        style={{
                          width: '100%',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '0.5rem',
                          color: '#ffffff',
                          fontSize: '0.875rem'
                        }}
                      >
                        <option value="">-- Select an agent --</option>
                        {availableAgents.map((agent) => {
                          // Show usage count in dropdown if agent is already selected elsewhere
                          const usageInOtherSteps = Array.from(templateAgentSelections.entries())
                            .filter(([idx, id]) => idx !== index && id === agent.canisterId).length;
                          const usageLabel = usageInOtherSteps > 0 
                            ? ` (used in ${usageInOtherSteps} other step${usageInOtherSteps > 1 ? 's' : ''})` 
                            : '';
                          
                          return (
                            <option key={agent.canisterId} value={agent.canisterId}>
                              {agent.name} ({agent.canisterId.slice(0, 8)}...){usageLabel}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowTemplateAgentSelector(false);
                    setSelectedTemplate(null);
                    setTemplateAgentSelections(new Map());
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '8px',
                    color: '#9CA3AF',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Load template into form and open advanced editor
                    setFormData({
                      name: selectedTemplate.name,
                      description: selectedTemplate.description,
                      steps: selectedTemplate.steps,
                      connections: [],
                      executionMode: selectedTemplate.executionMode
                    });

                    setShowTemplateAgentSelector(false);
                    setSelectedTemplate(null);
                    setTemplateAgentSelections(new Map());
                    updateUIState({ 
                      showAdvancedEditor: true,
                      activeView: 'simple-builder',
                      error: 'Template loaded! Please configure agent canister IDs for each step in the workflow editor before creating the workflow.' 
                    });
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '8px',
                    color: '#F59E0B',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title="Open advanced editor to configure agents manually"
                >
                  Open Advanced Editor
                </button>
              </div>
              <button
                onClick={() => {
                  // Check if all steps have agents selected
                  const allSelected = selectedTemplate.steps.every((_, index) => {
                    return templateAgentSelections.has(index) && templateAgentSelections.get(index) !== '';
                  });

                  if (!allSelected) {
                    updateUIState({ 
                      error: 'Please select an agent for all steps before continuing.' 
                    });
                    return;
                  }

                  // Create steps with selected agents
                  const stepsWithAgents = selectedTemplate.steps.map((step, index) => ({
                    ...step,
                    agentCanisterId: templateAgentSelections.get(index) || '',
                  }));

                  setFormData({
                    name: selectedTemplate.name,
                    description: selectedTemplate.description,
                    steps: stepsWithAgents,
                    connections: [],
                    executionMode: selectedTemplate.executionMode
                  });

                  setShowTemplateAgentSelector(false);
                  setSelectedTemplate(null);
                  setTemplateAgentSelections(new Map());
                  updateUIState({ activeView: 'simple-builder', error: null });
                }}
                disabled={!selectedTemplate.steps.every((_, index) => {
                  return templateAgentSelections.has(index) && templateAgentSelections.get(index) !== '';
                })}
                style={{
                  flex: 1,
                  background: selectedTemplate.steps.every((_, index) => {
                    return templateAgentSelections.has(index) && templateAgentSelections.get(index) !== '';
                  })
                    ? 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))'
                    : 'rgba(107, 114, 128, 0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: selectedTemplate.steps.every((_, index) => {
                    return templateAgentSelections.has(index) && templateAgentSelections.get(index) !== '';
                  }) ? 'pointer' : 'not-allowed',
                  opacity: selectedTemplate.steps.every((_, index) => {
                    return templateAgentSelections.has(index) && templateAgentSelections.get(index) !== '';
                  }) ? 1 : 0.5,
                  transition: 'all 0.2s ease'
                }}
              >
                Continue to Workflow Editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Workflow Modal */}
      {showDeleteAgencyModal && agencyToDelete && (
        <div 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001, // Higher than fullscreen editor to ensure it appears on top
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteAgencyModal(false);
              setAgencyToDelete(null);
            }
          }}
        >
          <div 
            style={{
              background: 'var(--secondary-black)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '500px',
              padding: '2rem',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">Delete Workflow</h3>
            
            <div className="mb-6">
              <p className="text-gray-300 mb-2">
                Are you sure you want to delete <strong className="text-white">"{agencyToDelete.name}"</strong>?
              </p>
              <p className="text-red-400 text-sm">
                ⚠️ This action cannot be undone. All workflow configurations and execution history will be permanently deleted.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteAgencyModal(false);
                  setAgencyToDelete(null);
                }}
                style={{
                  flex: 1,
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '8px',
                  color: '#9CA3AF',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleDeleteAgency(agencyToDelete.id);
                  setShowDeleteAgencyModal(false);
                  setAgencyToDelete(null);
                }}
                disabled={uiState.loading}
                style={{
                  flex: 1,
                  background: uiState.loading
                    ? 'rgba(107, 114, 128, 0.2)'
                    : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: uiState.loading ? 'not-allowed' : 'pointer',
                  opacity: uiState.loading ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {uiState.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  '🗑️ Delete Workflow'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};