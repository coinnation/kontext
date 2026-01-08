import { detectMessageDomain } from '../utils/messageDomainDetection';
import { useAppStore } from '../store/appStore';
import { MessagePriority } from '../types';

export interface GlobalWorkflowState {
  workflowId: string;
  projectId: string;
  phase: 'IDLE' | 'MESSAGE_INJECTION' | 'AI_PROCESSING' | 'FILE_APPLICATION' | 'DEPLOYMENT' | 'COMPLETED' | 'FAILED';
  startTime: number;
  lastActivity: number;
  executionCount: number;
  maxExecutions: number;
  isLocked: boolean;
  files: { [fileName: string]: string };
  originalMessageId: string;
  errorType: 'deployment-error' | 'frontend-error';
  lastError?: string;
  messageInjectionStartTime?: number;
  aiProcessingStartTime?: number;
  fileApplicationStartTime?: number;
  deploymentStartTime?: number;
  lastErrorClassification?: 'compilation' | 'bundling' | 'deployment' | 'network' | 'unknown';
  isTransitioning: boolean;
  phaseStartTime: number;
  lastSuccessfulPhase?: string;
  failureCount: number;
  lastPhaseTransition: number;
  // SIMPLIFIED: Basic integration state only
  messageInjected: boolean;
  deploymentContext?: any;
  // NEW: Extended workflow lifetime tracking
  automationPipelineActive: boolean;
  fileApplicationTriggered: boolean;
  deploymentTriggered: boolean;
  extendedTimeout: boolean;
  createdAt: number;
  lastCleanupAttempt?: number;
  protectedFromCleanup: boolean;
  // 🆕 CRITICAL: Auto-retry deployment control
  shouldAutoRetryDeploy: boolean;
  deploymentRetryReady: boolean;
  isRetryDeployment: boolean;
  // 🆕 NEW: Sequential error and UI completion tracking
  isSequentialError: boolean;
  sequentialErrorCount: number;
  uiCompletionSignaled: boolean;
  originalWorkflowId?: string;
  // 🔧 FIX: Prevent duplicate execution count increments
  deploymentIncrementApplied: boolean;
  // 🆕 ENHANCED: Store processed error message directly in workflow
  processedErrorMessage?: string;
  hasProcessedErrorContext: boolean;
  errorProcessingTimestamp?: number;
  // 🆕 NEW: Final attempt tracking
  isFinalAttempt: boolean;
  hasReachedMaxAttempts: boolean;
  // 🔧 CRITICAL FIX: Store completion phase info for UI callbacks
  completedPhase?: string;
  completedDeployedUrl?: string;
}

export interface WorkflowResult {
  success: boolean;
  phase: string;
  error?: string;
  deployedUrl?: string;
  duration?: number;
  errorClassification?: string;
  isFinalAttempt?: boolean;
  maxAttemptsReached?: boolean;
}

export interface CoordinatorState {
  isCoordinating: boolean;
  workflows: GlobalWorkflowState[];
  projectMappings: { [projectId: string]: string };
  storeConnected: boolean;
  lastActivity: number;
}

// Enhanced Logging System with comprehensive workflow tracking
interface AutoRetryLog {
  timestamp: number;
  workflowId: string;
  level: 'TRACE' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  phase: string;
  operation: string;
  message: string;
  data?: any;
  stateSnapshot?: Partial<GlobalWorkflowState>;
  correlationId: string;
  // NEW: Enhanced tracking fields
  workflowLifecycleEvent?: 'CREATED' | 'PHASE_CHANGED' | 'CLEANUP_ATTEMPTED' | 'CLEANUP_EXECUTED' | 'DESTROYED';
  cleanupReason?: string;
  timingSensitive?: boolean;
}

class AutoRetryDebugLogger {
  private logs: AutoRetryLog[] = [];
  private maxLogs = 2000; // Increased for better debugging
  private isEnabled = true;
  private correlationCounter = 0;

  private generateCorrelationId(): string {
    return `AR${++this.correlationCounter}${Date.now().toString(36).slice(-4)}`;
  }

  log(
    level: 'TRACE' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL',
    workflowId: string,
    phase: string,
    operation: string,
    message: string,
    data?: any,
    stateSnapshot?: Partial<GlobalWorkflowState>,
    lifecycleEvent?: 'CREATED' | 'PHASE_CHANGED' | 'CLEANUP_ATTEMPTED' | 'CLEANUP_EXECUTED' | 'DESTROYED',
    cleanupReason?: string
  ): void {
    if (!this.isEnabled) return;

    const correlationId = this.generateCorrelationId();
    const logEntry: AutoRetryLog = {
      timestamp: Date.now(),
      workflowId: workflowId || 'SYSTEM',
      level,
      phase: phase || 'UNKNOWN',
      operation,
      message,
      data,
      stateSnapshot,
      correlationId,
      workflowLifecycleEvent: lifecycleEvent,
      cleanupReason,
      timingSensitive: level === 'CRITICAL' || lifecycleEvent !== undefined
    };

    this.logs.push(logEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs + 200);
    }

    const emoji = {
      'TRACE': '🔍',
      'INFO': '📋',
      'WARN': '⚠️',
      'ERROR': '🚨',
      'CRITICAL': '💥'
    }[level];

    const timestamp = new Date(logEntry.timestamp).toISOString().slice(11, 23);
    const shortWorkflowId = workflowId ? workflowId.slice(-8) : 'SYSTEM';
    const phaseColor = this.getPhaseColor(phase);
    
    // Enhanced logging format for critical events
    if (lifecycleEvent) {
      console.log(
        `%c🤖 [AUTO-RETRY] ${emoji} %c[${timestamp}] %c[${shortWorkflowId}] %c[${phase}] %c[${lifecycleEvent}] %c${operation}%c\n   ${message}`,
        'color: #ff6b35; font-weight: bold;',
        'color: #888; font-size: 11px;',
        'color: #0ea5e9; font-weight: bold;',
        `color: ${phaseColor}; font-weight: bold;`,
        'color: #dc2626; font-weight: bold;', // Red for lifecycle events
        'color: #10b981; font-weight: bold;',
        'color: #ffffff;'
      );
    } else {
      console.log(
        `%c🤖 [AUTO-RETRY] ${emoji} %c[${timestamp}] %c[${shortWorkflowId}] %c[${phase}] %c${operation}%c\n   ${message}`,
        'color: #ff6b35; font-weight: bold;',
        'color: #888; font-size: 11px;',
        'color: #0ea5e9; font-weight: bold;',
        `color: ${phaseColor}; font-weight: bold;`,
        'color: #10b981; font-weight: bold;',
        'color: #ffffff;'
      );
    }

    if (data && Object.keys(data).length > 0) {
      console.log(`   📊 Data:`, data);
    }

    if (stateSnapshot) {
      console.log(`   📸 State:`, stateSnapshot);
    }

    if (cleanupReason) {
      console.log(`   🧹 Cleanup Reason: ${cleanupReason}`);
    }

    if (level === 'ERROR' || level === 'CRITICAL') {
      console.error(`${emoji} [AUTO-RETRY-${level}] ${message}`, { workflowId, phase, operation, data });
    }
  }

  private getPhaseColor(phase: string): string {
    switch (phase) {
      case 'MESSAGE_INJECTION': return '#f59e0b';
      case 'AI_PROCESSING': return '#8b5cf6';
      case 'FILE_APPLICATION': return '#3b82f6';
      case 'DEPLOYMENT': return '#ef4444';
      case 'COMPLETED': return '#10b981';
      case 'FAILED': return '#dc2626';
      default: return '#6b7280';
    }
  }

  info(workflowId: string, phase: string, operation: string, message: string, data?: any, state?: Partial<GlobalWorkflowState>) {
    this.log('INFO', workflowId, phase, operation, message, data, state);
  }

  warn(workflowId: string, phase: string, operation: string, message: string, data?: any, state?: Partial<GlobalWorkflowState>) {
    this.log('WARN', workflowId, phase, operation, message, data, state);
  }

  error(workflowId: string, phase: string, operation: string, message: string, data?: any, state?: Partial<GlobalWorkflowState>) {
    this.log('ERROR', workflowId, phase, operation, message, data, state);
  }

  critical(workflowId: string, phase: string, operation: string, message: string, data?: any, state?: Partial<GlobalWorkflowState>, lifecycleEvent?: any, cleanupReason?: string) {
    this.log('CRITICAL', workflowId, phase, operation, message, data, state, lifecycleEvent, cleanupReason);
  }

  trace(workflowId: string, phase: string, operation: string, message: string, data?: any, state?: Partial<GlobalWorkflowState>) {
    this.log('TRACE', workflowId, phase, operation, message, data, state);
  }

  workflowCreated(workflow: GlobalWorkflowState, reason: string, triggers: any) {
    this.critical(
      workflow.workflowId,
      workflow.phase,
      'WORKFLOW_CREATED',
      `🚀 Workflow created - ${reason}`,
      {
        projectId: workflow.projectId,
        errorType: workflow.errorType,
        fileCount: Object.keys(workflow.files).length,
        triggers,
        createdAt: workflow.createdAt,
        protectedFromCleanup: workflow.protectedFromCleanup,
        isSequentialError: workflow.isSequentialError,
        sequentialErrorCount: workflow.sequentialErrorCount,
        hasProcessedErrorContext: workflow.hasProcessedErrorContext,
        processedMessageLength: workflow.processedErrorMessage?.length || 0
      },
      {
        workflowId: workflow.workflowId,
        projectId: workflow.projectId,
        phase: workflow.phase,
        startTime: workflow.startTime,
        executionCount: workflow.executionCount,
        automationPipelineActive: workflow.automationPipelineActive
      },
      'CREATED'
    );
  }

  workflowCleanupAttempted(workflowId: string, reason: string, allowed: boolean, workflow?: GlobalWorkflowState) {
    this.critical(
      workflowId,
      workflow?.phase || 'UNKNOWN',
      'CLEANUP_ATTEMPTED',
      `🧹 Cleanup attempted - ${reason} - ${allowed ? 'ALLOWED' : 'BLOCKED'}`,
      {
        reason,
        allowed,
        isProtected: workflow?.protectedFromCleanup,
        automationActive: workflow?.automationPipelineActive,
        age: workflow ? Date.now() - workflow.createdAt : 'unknown',
        lastActivity: workflow ? Date.now() - workflow.lastActivity : 'unknown'
      },
      workflow ? {
        workflowId: workflow.workflowId,
        phase: workflow.phase,
        protectedFromCleanup: workflow.protectedFromCleanup,
        automationPipelineActive: workflow.automationPipelineActive
      } : undefined,
      'CLEANUP_ATTEMPTED',
      reason
    );
  }

  workflowDestroyed(workflowId: string, reason: string, workflow?: GlobalWorkflowState) {
    this.critical(
      workflowId,
      workflow?.phase || 'UNKNOWN',
      'WORKFLOW_DESTROYED',
      `💀 Workflow destroyed - ${reason}`,
      {
        reason,
        duration: workflow ? Date.now() - workflow.createdAt : 'unknown',
        finalPhase: workflow?.phase,
        wasProtected: workflow?.protectedFromCleanup
      },
      workflow,
      'DESTROYED',
      reason
    );
  }

  phaseTransition(workflow: GlobalWorkflowState, fromPhase: string, toPhase: string, reason: string, conditions: any) {
    this.critical(
      workflow.workflowId,
      toPhase,
      'PHASE_TRANSITION',
      `🔄 Phase transition: ${fromPhase} → ${toPhase} - ${reason}`,
      {
        duration: Date.now() - workflow.phaseStartTime,
        conditions,
        executionCount: workflow.executionCount,
        failureCount: workflow.failureCount,
        automationActive: workflow.automationPipelineActive
      },
      {
        phase: toPhase,
        phaseStartTime: workflow.phaseStartTime,
        lastActivity: workflow.lastActivity,
        isTransitioning: workflow.isTransitioning,
        protectedFromCleanup: workflow.protectedFromCleanup
      },
      'PHASE_CHANGED'
    );
  }

  clearLogs(): void {
    this.logs = [];
    console.log('🤖 [AUTO-RETRY-DEBUG] Logs cleared');
  }

  getLogs(workflowId?: string): AutoRetryLog[] {
    let filtered = this.logs;
    if (workflowId) {
      filtered = filtered.filter(log => log.workflowId === workflowId);
    }
    return filtered.slice(-200); // Return more logs for debugging
  }

  getWorkflowLifecycleLogs(workflowId: string): AutoRetryLog[] {
    return this.logs
      .filter(log => log.workflowId === workflowId && log.workflowLifecycleEvent)
      .slice(-50);
  }
}

const debugLogger = new AutoRetryDebugLogger();

class AutoRetryCoordinatorService {
  private activeWorkflows: Map<string, GlobalWorkflowState> = new Map();
  private projectWorkflowMap: Map<string, string> = new Map();
  private storeUnsubscribers: Map<string, () => void> = new Map();
  private appStoreReference: any = null;
  private storeConnectionRetries = 0;
  private readonly BASE_WORKFLOW_TIMEOUT = 10 * 60 * 1000; // 10 minutes base
  private readonly EXTENDED_WORKFLOW_TIMEOUT = 30 * 60 * 1000; // 30 minutes for automation
  private readonly MAX_EXECUTIONS = 3;
  private readonly MESSAGE_INJECTION_TIMEOUT = 30 * 1000; // 30 seconds
  private readonly MAX_STORE_CONNECTION_RETRIES = 20;
  private readonly CALLBACK_RETRY_ATTEMPTS = 5;
  private readonly CALLBACK_RETRY_DELAY = 1000;
  // 🆕 ENHANCED: Function availability polling configuration
  private readonly FUNCTION_POLL_MAX_ATTEMPTS = 30; // 3 seconds total
  private readonly FUNCTION_POLL_INTERVAL = 100; // 100ms intervals
  // 🆕 NEW: Sequential error handling configuration
  private readonly SEQUENTIAL_ERROR_TIMEOUT = 5000; // 5 seconds to consider errors sequential
  private readonly MAX_SEQUENTIAL_ERRORS = 5; // Maximum sequential errors before giving up

  private cleanupInterval: NodeJS.Timeout;
  private subscribers: Array<(state: CoordinatorState) => void> = [];

  constructor() {
    debugLogger.critical('SYSTEM', 'INITIALIZATION', 'COORDINATOR_START', '🎯 AutoRetryCoordinator initializing with ENHANCED ERROR CONTEXT INTEGRATION and DIRECT MESSAGE INJECTION');
    
    // Increase cleanup interval to be less aggressive
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredWorkflows();
      this.performHealthCheck();
    }, 60000); // Changed from 30s to 60s
    
    this.establishReliableStoreConnection();
    
    if (typeof window !== 'undefined') {
      (window as any).__autoRetryCoordinator = this;
      (window as any).__autoRetryDebugLogger = debugLogger;
      
      // Enhanced debugging functions
      (window as any).__debugWorkflowLifecycle = (workflowId: string) => {
        const logs = debugLogger.getWorkflowLifecycleLogs(workflowId);
        console.table(logs.map(log => ({
          time: new Date(log.timestamp).toISOString().slice(11, 19),
          event: log.workflowLifecycleEvent,
          phase: log.phase,
          operation: log.operation,
          message: log.message.substring(0, 50),
          cleanupReason: log.cleanupReason
        })));
        return logs;
      };
    }

    debugLogger.critical('SYSTEM', 'INITIALIZATION', 'COORDINATOR_READY', '✅ AutoRetryCoordinator initialization complete with ENHANCED ERROR CONTEXT INTEGRATION and DIRECT MESSAGE INJECTION');
  }

  private establishReliableStoreConnection(): void {
    const attemptConnection = () => {
      if (this.storeConnectionRetries >= this.MAX_STORE_CONNECTION_RETRIES) {
        debugLogger.error('SYSTEM', 'STORE_CONNECTION', 'MAX_RETRIES_REACHED', 'Max store connection retries reached');
        return;
      }

      if (typeof window !== 'undefined') {
        const appStore = (window as any).useAppStore;
        if (appStore && appStore.getState && typeof appStore.getState === 'function') {
          try {
            const testState = appStore.getState();
            if (testState && typeof testState === 'object') {
              this.appStoreReference = appStore;
              debugLogger.info('SYSTEM', 'STORE_CONNECTION', 'CONNECTION_SUCCESS', 'Store connection established');
              this.notifySubscribers();
              return;
            }
          } catch (error) {
            debugLogger.warn('SYSTEM', 'STORE_CONNECTION', 'CONNECTION_TEST_FAILED', 'Store connection test failed', { error });
          }
        }
      }

      this.storeConnectionRetries++;
      const backoffDelay = Math.min(1000 * Math.pow(1.5, this.storeConnectionRetries), 10000);
      setTimeout(attemptConnection, backoffDelay);
    };

    attemptConnection();
  }

  public subscribe(callback: (state: CoordinatorState) => void): () => void {
    this.subscribers.push(callback);
    this.notifySubscribers();
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers(): void {
    const state: CoordinatorState = {
      isCoordinating: this.activeWorkflows.size > 0,
      workflows: Array.from(this.activeWorkflows.values()),
      projectMappings: Object.fromEntries(this.projectWorkflowMap.entries()),
      storeConnected: !!this.appStoreReference,
      lastActivity: Date.now()
    };
    
    this.subscribers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        debugLogger.error('SYSTEM', 'SUBSCRIPTION', 'SUBSCRIBER_ERROR', 'Subscriber notification failed', { error });
      }
    });
  }

  // 🔧 CRITICAL FIX: Accept processed error message directly instead of trying to retrieve it
  public startAutoRetryWorkflow(
    projectId: string, 
    files: { [fileName: string]: string }, 
    errorType: 'deployment-error' | 'frontend-error',
    lastError?: string,
    deploymentContext?: any,
    processedErrorMessage?: string // 🆕 NEW: Accept processed message directly
  ): string | null {
    debugLogger.info('SYSTEM', 'WORKFLOW_VALIDATION', 'START_REQUEST', '🎯 Auto-retry workflow start requested with DIRECT ERROR MESSAGE INJECTION', {
      projectId,
      errorType,
      fileCount: Object.keys(files).length,
      hasError: !!lastError,
      hasDeploymentContext: !!deploymentContext,
      hasProcessedMessage: !!processedErrorMessage,
      processedMessageLength: processedErrorMessage?.length || 0
    });

    // 🔧 FIXED: Use provided processed message directly
    const hasProcessedErrorContext = !!(processedErrorMessage && processedErrorMessage.trim().length > 0);

    debugLogger.critical('SYSTEM', 'ERROR_CONTEXT_INTEGRATION', 'DIRECT_INJECTION', '💉 USING DIRECT PROCESSED ERROR MESSAGE INJECTION', {
      hasProcessedErrorContext,
      processedMessageLength: processedErrorMessage?.length || 0,
      processedMessagePreview: processedErrorMessage?.substring(0, 100) || 'none',
      rawErrorAvailable: !!lastError,
      rawErrorPreview: lastError?.substring(0, 100) || 'none',
      injectionMethod: 'DIRECT_PARAMETER'
    });

    // 🆕 ENHANCED: Detect sequential errors before standard validation
    const sequentialErrorInfo = this.detectSequentialError(projectId, errorType);
    
    if (sequentialErrorInfo.isSequential && sequentialErrorInfo.sequentialCount >= this.MAX_SEQUENTIAL_ERRORS) {
      debugLogger.error('SYSTEM', 'SEQUENTIAL_ERROR_LIMIT', 'MAX_SEQUENTIAL_ERRORS', 
        `Maximum sequential errors reached (${this.MAX_SEQUENTIAL_ERRORS}) - blocking workflow`, {
        projectId,
        sequentialCount: sequentialErrorInfo.sequentialCount,
        maxAllowed: this.MAX_SEQUENTIAL_ERRORS
      });
      return null;
    }

    // 🔧 CRITICAL FIX: Check if a workflow is already in MESSAGE_INJECTION phase (just started)
    const existingWorkflowId = this.projectWorkflowMap.get(projectId);
    if (existingWorkflowId) {
      const existingWorkflow = this.activeWorkflows.get(existingWorkflowId);
      if (existingWorkflow && existingWorkflow.phase === 'MESSAGE_INJECTION') {
        const timeSinceStart = Date.now() - existingWorkflow.startTime;
        // If workflow started less than 5 seconds ago, it's likely a duplicate start attempt
        if (timeSinceStart < 5000) {
          debugLogger.warn('SYSTEM', 'WORKFLOW_VALIDATION', 'DUPLICATE_START_PREVENTED', 
            '🚫 Preventing duplicate workflow start - workflow already in MESSAGE_INJECTION phase', { 
            projectId,
            existingWorkflowId,
            timeSinceStart,
            messageInjected: existingWorkflow.messageInjected
          });
          return null;
        }
      }
    }

    // Enhanced validation with sequential error support
    if (!this.canStartAutoRetry(projectId)) {
      debugLogger.warn('SYSTEM', 'WORKFLOW_VALIDATION', 'START_BLOCKED', '🚫 Workflow start blocked by validation', { projectId });
      return null;
    }

    if (!this.appStoreReference) {
      debugLogger.error('SYSTEM', 'STORE_CONNECTION', 'NO_STORE_CONNECTION', '❌ Cannot start workflow - store connection not established');
      return null;
    }

    // 🔧 CRITICAL FIX: Force cleanup of any existing workflow for this project
    const cleanupSuccess = this.forceProjectWorkflowCleanup(projectId, 
      `Starting new workflow for ${sequentialErrorInfo.isSequential ? 'sequential' : 'initial'} error with ${hasProcessedErrorContext ? 'processed' : 'raw'} error context via DIRECT INJECTION`
    );
    
    if (!cleanupSuccess) {
      debugLogger.error('SYSTEM', 'WORKFLOW_VALIDATION', 'CLEANUP_FAILED', '❌ Failed to cleanup existing workflow', { projectId });
      return null;
    }

    // Small delay to ensure cleanup notification reaches all subscribers
    setTimeout(() => {
      debugLogger.info('SYSTEM', 'WORKFLOW_VALIDATION', 'CLEANUP_NOTIFICATION_SENT', 'Cleanup notification sent to all subscribers');
    }, 50);

    const workflowId = `autoretry_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const errorClassification = this.classifyError(lastError || '', errorType);
    const now = Date.now();
    
    // 🔧 FIX: Start execution count at 0, will be incremented to 1 when deployment is triggered
    const workflow: GlobalWorkflowState = {
      workflowId,
      projectId,
      phase: 'MESSAGE_INJECTION',
      startTime: now,
      lastActivity: now,
      executionCount: 0, // 🔧 FIX: Start at 0, increment when deployment actually triggers
      maxExecutions: this.MAX_EXECUTIONS,
      isLocked: false,
      files,
      originalMessageId: `error_${Date.now()}`,
      errorType,
      lastError,
      messageInjectionStartTime: now,
      lastErrorClassification: errorClassification,
      isTransitioning: false,
      phaseStartTime: now,
      failureCount: 0,
      lastPhaseTransition: now,
      // SIMPLIFIED: Basic integration state
      messageInjected: false,
      deploymentContext,
      // NEW: Enhanced automation pipeline tracking
      automationPipelineActive: true,
      fileApplicationTriggered: false,
      deploymentTriggered: false,
      extendedTimeout: true, // Enable extended timeout for automation
      createdAt: now,
      protectedFromCleanup: true, // Protect from cleanup during automation
      // 🆕 CRITICAL: Auto-retry deployment control
      shouldAutoRetryDeploy: false, // Initially false - will be set to true after file application
      deploymentRetryReady: false,
      isRetryDeployment: false,
      // 🆕 NEW: Sequential error tracking
      isSequentialError: sequentialErrorInfo.isSequential,
      sequentialErrorCount: sequentialErrorInfo.sequentialCount,
      uiCompletionSignaled: false,
      originalWorkflowId: sequentialErrorInfo.existingWorkflow?.workflowId,
      // 🔧 FIX: Prevent duplicate execution count increments
      deploymentIncrementApplied: false,
      // 🔧 FIXED: Store processed error message directly in workflow
      processedErrorMessage: processedErrorMessage || undefined,
      hasProcessedErrorContext,
      errorProcessingTimestamp: hasProcessedErrorContext ? now : undefined,
      // 🆕 NEW: Final attempt tracking
      isFinalAttempt: false,
      hasReachedMaxAttempts: false
    };

    debugLogger.workflowCreated(workflow, `${sequentialErrorInfo.isSequential ? 'Sequential' : 'Initial'} error-triggered auto-retry (${errorType}) with ${hasProcessedErrorContext ? 'DIRECT PROCESSED ERROR CONTEXT INJECTION' : 'raw error only'}`, {
      errorClassification,
      hasDeploymentContext: !!deploymentContext,
      isSequential: sequentialErrorInfo.isSequential,
      sequentialCount: sequentialErrorInfo.sequentialCount,
      startingExecutionCount: workflow.executionCount,
      forcedCleanup: true,
      hasProcessedErrorContext,
      processedErrorMessageLength: processedErrorMessage?.length || 0,
      injectionMethod: 'DIRECT_PARAMETER'
    });

    this.activeWorkflows.set(workflowId, workflow);
    this.projectWorkflowMap.set(projectId, workflowId);
    
    // Immediate notification to ensure DeploymentInterface sees the new workflow
    this.notifySubscribers();
    
    // Start the workflow with message injection
    this.executeMessageInjection(workflowId);
    
    return workflowId;
  }

  // 🆕 ENHANCED: Detect sequential errors and handling
  private detectSequentialError(projectId: string, errorType: 'deployment-error' | 'frontend-error'): {
    isSequential: boolean;
    existingWorkflow: GlobalWorkflowState | null;
    sequentialCount: number;
  } {
    const existingWorkflowId = this.projectWorkflowMap.get(projectId);
    if (!existingWorkflowId) {
      return { isSequential: false, existingWorkflow: null, sequentialCount: 0 };
    }

    const existingWorkflow = this.activeWorkflows.get(existingWorkflowId);
    if (!existingWorkflow) {
      return { isSequential: false, existingWorkflow: null, sequentialCount: 0 };
    }

    const now = Date.now();
    const timeSinceLastActivity = now - existingWorkflow.lastActivity;
    const timeSinceLastError = now - existingWorkflow.phaseStartTime;

    // Detect if this is a sequential error (error occurred soon after deployment)
    const isRecentDeploymentError = existingWorkflow.phase === 'DEPLOYMENT' && 
                                   timeSinceLastActivity < this.SEQUENTIAL_ERROR_TIMEOUT;
    
    const isStaleCompletedWorkflow = (existingWorkflow.phase === 'COMPLETED' || existingWorkflow.phase === 'FAILED') &&
                                   timeSinceLastError < this.SEQUENTIAL_ERROR_TIMEOUT;

    const isSequential = isRecentDeploymentError || isStaleCompletedWorkflow;
    const sequentialCount = isSequential ? existingWorkflow.sequentialErrorCount + 1 : 0;

    debugLogger.info(existingWorkflowId, existingWorkflow.phase, 'SEQUENTIAL_DETECTION', 
      `Sequential error detection: ${isSequential ? 'YES' : 'NO'}`, {
      timeSinceLastActivity,
      timeSinceLastError,
      isRecentDeploymentError,
      isStaleCompletedWorkflow,
      currentPhase: existingWorkflow.phase,
      sequentialCount,
      errorType
    });

    return { isSequential, existingWorkflow, sequentialCount };
  }

  // 🆕 ENHANCED: Improved canStartAutoRetry with sequential error support
  public canStartAutoRetry(projectId: string): boolean {
    const existingWorkflowId = this.projectWorkflowMap.get(projectId);
    if (!existingWorkflowId) {
      debugLogger.info('SYSTEM', 'VALIDATION', 'CAN_START_AUTO_RETRY', 'No existing workflow - can start', { projectId });
      return true;
    }

    const existingWorkflow = this.activeWorkflows.get(existingWorkflowId);
    if (!existingWorkflow) {
      debugLogger.warn('SYSTEM', 'VALIDATION', 'CAN_START_AUTO_RETRY', 'Workflow ID exists but workflow not found - cleaning up', { 
        projectId, 
        existingWorkflowId 
      });
      // Clean up orphaned mapping
      this.projectWorkflowMap.delete(projectId);
      return true;
    }

    const now = Date.now();
    const timeSinceActivity = now - existingWorkflow.lastActivity;

    // 🆕 NEW: Check if workflow has reached maximum attempts
    if (existingWorkflow.hasReachedMaxAttempts) {
      debugLogger.critical(existingWorkflowId, existingWorkflow.phase, 'MAX_ATTEMPTS_REACHED', 
        '🚫 Cannot start new workflow - existing workflow has reached maximum attempts', {
        timeSinceActivity,
        executionCount: existingWorkflow.executionCount,
        maxExecutions: existingWorkflow.maxExecutions,
        hasReachedMaxAttempts: existingWorkflow.hasReachedMaxAttempts,
        projectId,
        currentPhase: existingWorkflow.phase
      });
      return false;
    }

    // 🆕 ENHANCED: Allow sequential errors by detecting stale deployment workflows
    if (existingWorkflow.phase === 'DEPLOYMENT' && timeSinceActivity < this.SEQUENTIAL_ERROR_TIMEOUT) {
      debugLogger.critical(existingWorkflowId, existingWorkflow.phase, 'SEQUENTIAL_ERROR_DETECTED', 
        '🔄 Sequential error during deployment - allowing new workflow with cleanup', {
        timeSinceActivity,
        threshold: this.SEQUENTIAL_ERROR_TIMEOUT,
        projectId,
        currentPhase: existingWorkflow.phase
      });
      
      return true; // Don't cleanup here - let startAutoRetryWorkflow handle it
    }

    // 🆕 ENHANCED: Allow starting new workflows for completed/failed workflows that are stale
    if ((existingWorkflow.phase === 'COMPLETED' || existingWorkflow.phase === 'FAILED') && 
        timeSinceActivity < this.SEQUENTIAL_ERROR_TIMEOUT) {
      debugLogger.critical(existingWorkflowId, existingWorkflow.phase, 'SEQUENTIAL_ERROR_DETECTED', 
        '🔄 Sequential error after completed/failed workflow - allowing new workflow', {
        timeSinceActivity,
        threshold: this.SEQUENTIAL_ERROR_TIMEOUT,
        projectId,
        currentPhase: existingWorkflow.phase
      });
      
      return true; // Don't cleanup here - let startAutoRetryWorkflow handle it
    }

    // Standard validation for truly active workflows
    if (existingWorkflow.phase !== 'COMPLETED' && existingWorkflow.phase !== 'FAILED') {
      if (timeSinceActivity < 30000) { // 30 seconds
        debugLogger.warn(existingWorkflowId, existingWorkflow.phase, 'VALIDATION', 'Cannot start new workflow - existing active workflow', {
          timeSinceActivity,
          existingPhase: existingWorkflow.phase,
          projectId
        });
        return false;
      }
    }

    debugLogger.info(existingWorkflowId, existingWorkflow.phase, 'VALIDATION', 'Can start new workflow - existing workflow is old or inactive', {
      timeSinceActivity,
      existingPhase: existingWorkflow.phase,
      projectId
    });

    return true;
  }

  // 🔧 NEW: Force project workflow cleanup with immediate notification
  private forceProjectWorkflowCleanup(projectId: string, reason: string): boolean {
    const existingWorkflowId = this.projectWorkflowMap.get(projectId);
    if (!existingWorkflowId) {
      debugLogger.info('SYSTEM', 'FORCE_CLEANUP', 'NO_WORKFLOW_TO_CLEAN', 'No workflow to force cleanup', { projectId });
      return true;
    }

    const existingWorkflow = this.activeWorkflows.get(existingWorkflowId);
    if (!existingWorkflow) {
      debugLogger.warn('SYSTEM', 'FORCE_CLEANUP', 'ORPHANED_MAPPING', 'Found orphaned project mapping - cleaning up', { 
        projectId, 
        existingWorkflowId 
      });
      this.projectWorkflowMap.delete(projectId);
      this.notifySubscribers(); // Immediate notification
      return true;
    }

    debugLogger.critical(existingWorkflowId, existingWorkflow.phase, 'FORCE_CLEANUP', 
      `🧹 FORCE CLEANUP: ${reason}`, {
      projectId,
      workflowId: existingWorkflowId,
      currentPhase: existingWorkflow.phase,
      automationActive: existingWorkflow.automationPipelineActive,
      protectedFromCleanup: existingWorkflow.protectedFromCleanup
    });

    // Force cleanup regardless of protection status
    this.projectWorkflowMap.delete(projectId);
    this.activeWorkflows.delete(existingWorkflowId);
    this.cleanupWorkflowSubscriptions(existingWorkflowId);
    
    debugLogger.workflowDestroyed(existingWorkflowId, `Force cleanup: ${reason}`, existingWorkflow);
    
    // Immediate notification to ensure other components see the cleanup
    this.notifySubscribers();
    
    return true;
  }

  // 🆕 ENHANCED: Message injection using stored processed error message
  private async executeMessageInjection(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      debugLogger.error(workflowId, 'MESSAGE_INJECTION', 'WORKFLOW_NOT_FOUND', 'Workflow not found for message injection');
      return;
    }

    // 🔧 CRITICAL FIX: Prevent duplicate message injection
    if (workflow.messageInjected) {
      debugLogger.warn(workflowId, workflow.phase, 'MESSAGE_INJECTION', '⚠️ Message already injected - skipping duplicate injection', {
        messageInjected: workflow.messageInjected,
        currentPhase: workflow.phase,
        lastActivity: workflow.lastActivity,
        timeSinceInjection: Date.now() - (workflow.messageInjectionStartTime || workflow.startTime)
      });
      return;
    }

    debugLogger.critical(workflowId, workflow.phase, 'MESSAGE_INJECTION', '📝 Starting ENHANCED message injection with DIRECT STORED PROCESSED MESSAGE', {
      isSequential: workflow.isSequentialError,
      sequentialCount: workflow.sequentialErrorCount,
      executionCount: workflow.executionCount,
      hasProcessedErrorContext: workflow.hasProcessedErrorContext,
      processedMessageLength: workflow.processedErrorMessage?.length || 0,
      injectionSource: 'STORED_IN_WORKFLOW',
      messageInjected: workflow.messageInjected // Should be false at this point
    });

    const fixPrompt = this.generateEnhancedFixPromptWithDirectMessage(workflow);
    
    try {
      // Enhanced callback availability verification with retry
      const callbacksAvailable = await this.verifyCallbacksAvailable();
      if (!callbacksAvailable) {
        throw new Error('Chat interface callbacks not available after retries');
      }

      // Switch to chat tab first
      const tabChangeCallback = (window as any).__chatInterfaceTabChange;
      debugLogger.trace(workflowId, workflow.phase, 'MESSAGE_INJECTION', '🔄 Switching to chat tab');
      tabChangeCallback('chat');

      // Small delay to ensure tab switch completes
      await this.delay(500);

      // Inject the message with verification
      const submitMessageCallback = (window as any).__chatInterfaceSubmitMessage;
      debugLogger.critical(workflowId, workflow.phase, 'MESSAGE_INJECTION', '📤 Injecting ENHANCED fix prompt message with DIRECT STORED PROCESSED CONTEXT', {
        promptLength: fixPrompt.length,
        promptPreview: fixPrompt.substring(0, 100) + '...',
        isSequential: workflow.isSequentialError,
        executionCount: workflow.executionCount,
        hasProcessedErrorContext: workflow.hasProcessedErrorContext,
        usedProcessedMessage: workflow.hasProcessedErrorContext,
        injectionSource: 'WORKFLOW_STORED_MESSAGE'
      });
      
      await submitMessageCallback(fixPrompt);

      // CRITICAL: Update workflow state but DON'T mark as complete
      workflow.messageInjected = true;
      workflow.lastActivity = Date.now();
      workflow.phase = 'AI_PROCESSING';
      workflow.phaseStartTime = Date.now();
      workflow.lastPhaseTransition = Date.now();
      // KEEP: automationPipelineActive = true
      // KEEP: protectedFromCleanup = true
      
      debugLogger.phaseTransition(workflow, 'MESSAGE_INJECTION', 'AI_PROCESSING', 'Message injection successful with DIRECT STORED PROCESSED CONTEXT, transitioning to AI processing', {
        messageInjected: true,
        automationStillActive: workflow.automationPipelineActive,
        protectedFromCleanup: workflow.protectedFromCleanup,
        isSequential: workflow.isSequentialError,
        executionCount: workflow.executionCount,
        hasProcessedErrorContext: workflow.hasProcessedErrorContext,
        enhancedPromptUsed: true,
        injectionMethod: 'DIRECT_STORED_MESSAGE'
      });

      this.notifySubscribers();

    } catch (error) {
      debugLogger.error(workflowId, workflow.phase, 'MESSAGE_INJECTION', '❌ Enhanced message injection with direct stored context failed', { error });
      await this.handleWorkflowError(workflowId, `Enhanced message injection failed: ${error}`);
    }
  }

  // 🔧 COMPLETELY REWRITTEN: Use stored processed message directly
  private generateEnhancedFixPromptWithDirectMessage(workflow: GlobalWorkflowState): string {
    debugLogger.critical(workflow.workflowId, workflow.phase, 'PROMPT_GENERATION', '🔍 GENERATING ENHANCED FIX PROMPT WITH DIRECT STORED MESSAGE', {
      hasProcessedErrorContext: workflow.hasProcessedErrorContext,
      processedMessageLength: workflow.processedErrorMessage?.length || 0,
      errorType: workflow.errorType,
      isSequential: workflow.isSequentialError,
      executionCount: workflow.executionCount,
      isFinalAttempt: workflow.isFinalAttempt,
      messageSource: 'WORKFLOW_STORED'
    });

    // 🔧 FIXED: Use stored processed error message if available
    if (workflow.hasProcessedErrorContext && workflow.processedErrorMessage) {
      const enhancedProcessedMessage = this.enhanceStoredProcessedErrorMessage(workflow, workflow.processedErrorMessage);
      
      debugLogger.critical(workflow.workflowId, workflow.phase, 'PROMPT_GENERATION', '✅ USING STORED PROCESSED ERROR MESSAGE WITH CODE CONTEXT - OPTIMAL PATH', {
        originalMessageLength: workflow.processedErrorMessage.length,
        enhancedMessageLength: enhancedProcessedMessage.length,
        isSequential: workflow.isSequentialError,
        executionCount: workflow.executionCount,
        errorType: workflow.errorType,
        isFinalAttempt: workflow.isFinalAttempt,
        messageSource: 'WORKFLOW_STORED_ENHANCED'
      });
      
      return enhancedProcessedMessage;
    }

    // 🆕 FALLBACK: Generate minimal prompt without file extraction instructions
    const fallbackPrompt = this.generateMinimalFallbackPrompt(workflow);
    
    debugLogger.warn(workflow.workflowId, workflow.phase, 'PROMPT_GENERATION', '⚠️ USING FALLBACK PROMPT - NO STORED PROCESSED MESSAGE', {
      fallbackLength: fallbackPrompt.length,
      isSequential: workflow.isSequentialError,
      executionCount: workflow.executionCount,
      errorType: workflow.errorType,
      reason: 'No stored processed error message in workflow',
      isFinalAttempt: workflow.isFinalAttempt,
      messageSource: 'FALLBACK_GENERATED'
    });

    return fallbackPrompt;
  }

  // 🆕 ENHANCED: Enhance stored processed error message with workflow context and final attempt handling
  private enhanceStoredProcessedErrorMessage(workflow: GlobalWorkflowState, storedProcessedMessage: string): string {
    const errorTypeText = workflow.errorType === 'deployment-error' ? 'backend compilation' : 'frontend bundling';
    const classificationText = workflow.lastErrorClassification || 'unknown';
    
    // Build execution context with final attempt awareness
    let executionContext = '';
    let finalAttemptWarning = '';
    
    if (workflow.executionCount > 0) {
      const attemptNumber = workflow.executionCount;
      const maxAttempts = workflow.maxExecutions;
      
      if (attemptNumber >= maxAttempts) {
        executionContext = ` (🚨 FINAL AUTO-RETRY ATTEMPT ${attemptNumber}/${maxAttempts})`;
        finalAttemptWarning = `\n🚨 **THIS IS THE FINAL ATTEMPT** - If this fails, manual intervention will be required!\n`;
      } else {
        executionContext = ` (Auto-retry attempt ${attemptNumber}/${maxAttempts})`;
      }
    } else {
      executionContext = ` (Will be attempt 1/${workflow.maxExecutions})`;
    }
    
    let sequentialContext = '';
    if (workflow.isSequentialError) {
      sequentialContext = ` [Sequential Error #${workflow.sequentialErrorCount}]`;
    }

    // Create enhanced header with final attempt emphasis
    const enhancedHeader = `🤖 **AUTO-RETRY SYSTEM ACTIVATED${executionContext}${sequentialContext}**
${finalAttemptWarning}
The deployment system detected ${errorTypeText} errors (${classificationText} type) and is automatically requesting fixes.

**Context Information:**
- **Error Classification**: ${classificationText}
- **Error Type**: ${workflow.errorType}
- **Execution Status**: ${workflow.executionCount + 1}/${workflow.maxExecutions} attempts
${workflow.isSequentialError ? `- **Sequential Error**: This is error #${workflow.sequentialErrorCount} in the same deployment session` : ''}
- **Error Processing**: Enhanced with code context and line-specific details (STORED)
${workflow.isFinalAttempt || workflow.executionCount >= workflow.maxExecutions ? '- **🚨 FINAL ATTEMPT**: This is the last automatic retry - please provide the most comprehensive fix possible' : ''}

**Auto-Retry Process:**
The system will automatically:
1. ✅ Apply your corrected files
2. 🚀 Retry the deployment  
3. 🔁 Continue until success (max ${workflow.maxExecutions} attempts)
${workflow.isFinalAttempt || workflow.executionCount >= workflow.maxExecutions ? '\n🚨 **If this attempt fails, auto-retry will stop and manual intervention will be required.**' : ''}

---

`;

    // Append the stored processed message (which contains the detailed error analysis and code context)
    const enhancedMessage = enhancedHeader + storedProcessedMessage;

    debugLogger.info(workflow.workflowId, workflow.phase, 'PROMPT_ENHANCEMENT', 'Enhanced stored processed error message with workflow context and final attempt handling', {
      originalLength: storedProcessedMessage.length,
      enhancedLength: enhancedMessage.length,
      addedContextLength: enhancedHeader.length,
      executionCount: workflow.executionCount,
      isSequential: workflow.isSequentialError,
      isFinalAttempt: workflow.isFinalAttempt || workflow.executionCount >= workflow.maxExecutions,
      finalAttemptWarningAdded: !!finalAttemptWarning,
      messageSource: 'STORED_ENHANCED'
    });

    return enhancedMessage;
  }

  // 🆕 ENHANCED: Generate minimal fallback prompt with final attempt handling
  private generateMinimalFallbackPrompt(workflow: GlobalWorkflowState): string {
    const errorTypeText = workflow.errorType === 'deployment-error' ? 'backend compilation' : 'frontend bundling';
    const classificationText = workflow.lastErrorClassification || 'unknown';
    
    let executionContext = '';
    let finalAttemptWarning = '';
    
    if (workflow.executionCount > 0) {
      const attemptNumber = workflow.executionCount;
      const maxAttempts = workflow.maxExecutions;
      
      if (attemptNumber >= maxAttempts) {
        executionContext = ` (🚨 FINAL AUTO-RETRY ATTEMPT ${attemptNumber}/${maxAttempts})`;
        finalAttemptWarning = `\n🚨 **THIS IS THE FINAL ATTEMPT** - If this fails, manual intervention will be required!\n`;
      } else {
        executionContext = ` (Auto-retry attempt ${attemptNumber}/${maxAttempts})`;
      }
    } else {
      executionContext = ` (Will be attempt 1/${workflow.maxExecutions})`;
    }
    
    let sequentialContext = '';
    if (workflow.isSequentialError) {
      sequentialContext = ` [Sequential Error #${workflow.sequentialErrorCount}]`;
    }

    const prompt = `🤖 **AUTO-RETRY SYSTEM ACTIVATED${executionContext}${sequentialContext}**
${finalAttemptWarning}
The deployment system detected ${errorTypeText} errors (${classificationText} type) and is automatically requesting fixes.

**Error Classification**: ${classificationText}
**Error Type**: ${workflow.errorType}
**Current Status**: ${workflow.executionCount + 1}/${workflow.maxExecutions} attempts
${workflow.isSequentialError ? `**Sequential Error**: This is error #${workflow.sequentialErrorCount} in the same deployment session` : ''}
${workflow.isFinalAttempt || workflow.executionCount >= workflow.maxExecutions ? '**🚨 FINAL ATTEMPT**: This is the last automatic retry - please provide the most comprehensive fix possible' : ''}

**Error Details:**
${workflow.lastError || 'Compilation/bundling failed with errors'}

**Request:**
Please analyze the errors above and provide corrected code files. Focus specifically on ${classificationText} issues.${workflow.isFinalAttempt || workflow.executionCount >= workflow.maxExecutions ? ' Since this is the final attempt, please provide the most thorough and comprehensive fix possible.' : ''} 

The system will automatically:
1. ✅ Apply your corrected files
2. 🚀 Retry the deployment  
3. 🔁 Continue until success (max ${workflow.maxExecutions} attempts)
${workflow.isFinalAttempt || workflow.executionCount >= workflow.maxExecutions ? '\n🚨 **If this attempt fails, auto-retry will stop and manual intervention will be required.**' : ''}

Please provide complete corrected files that address these ${errorTypeText} issues.`;

    return prompt;
  }

  // Error classification (unchanged)
  private classifyError(errorMessage: string, errorType: 'deployment-error' | 'frontend-error'): 'compilation' | 'bundling' | 'deployment' | 'network' | 'unknown' {
    const lowerError = errorMessage.toLowerCase();
    
    if (lowerError.includes('network') || lowerError.includes('timeout') || 
        lowerError.includes('connection') || lowerError.includes('fetch')) {
      return 'network';
    } else if (errorType === 'deployment-error') {
      if (lowerError.includes('type error') || lowerError.includes('parse error') ||
          lowerError.includes('syntax error') || lowerError.includes('unbound') ||
          lowerError.includes('actor') || lowerError.includes('motoko')) {
        return 'compilation';
      } else {
        return 'deployment';
      }
    } else if (errorType === 'frontend-error') {
      if (lowerError.includes('module') || lowerError.includes('import') ||
          lowerError.includes('typescript') || lowerError.includes('jsx') ||
          lowerError.includes('syntax')) {
        return 'bundling';
      } else {
        return 'deployment';
      }
    }
    
    return 'unknown';
  }

  // Enhanced callback availability verification with retry logic (unchanged)
  private async verifyCallbacksAvailable(): Promise<boolean> {
    for (let attempt = 1; attempt <= this.CALLBACK_RETRY_ATTEMPTS; attempt++) {
      const tabChangeCallback = (window as any).__chatInterfaceTabChange;
      const submitMessageCallback = (window as any).__chatInterfaceSubmitMessage;
      
      if (tabChangeCallback && typeof tabChangeCallback === 'function' &&
          submitMessageCallback && typeof submitMessageCallback === 'function') {
        
        debugLogger.trace('SYSTEM', 'CALLBACK_VERIFICATION', 'CALLBACKS_AVAILABLE', `Callbacks verified on attempt ${attempt}`);
        return true;
      }
      
      if (attempt < this.CALLBACK_RETRY_ATTEMPTS) {
        debugLogger.warn('SYSTEM', 'CALLBACK_VERIFICATION', 'CALLBACKS_UNAVAILABLE', `Callbacks not available, attempt ${attempt}/${this.CALLBACK_RETRY_ATTEMPTS}`);
        await this.delay(this.CALLBACK_RETRY_DELAY * attempt);
      }
    }
    
    debugLogger.error('SYSTEM', 'CALLBACK_VERIFICATION', 'CALLBACKS_FAILED', 'Callbacks not available after all retry attempts');
    return false;
  }

  // 🆕 ENHANCED: Function availability polling with robust retry logic
  private async pollForFunctionAvailability(functionName: string, maxAttempts: number = this.FUNCTION_POLL_MAX_ATTEMPTS): Promise<boolean> {
    debugLogger.info('SYSTEM', 'FUNCTION_POLLING', 'POLL_START', `🔍 Polling for function availability: ${functionName}`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const func = (window as any)[functionName];
      
      if (func && typeof func === 'function') {
        debugLogger.info('SYSTEM', 'FUNCTION_POLLING', 'FUNCTION_AVAILABLE', `✅ Function ${functionName} available on attempt ${attempt}`);
        return true;
      }

      if (attempt < maxAttempts) {
        debugLogger.trace('SYSTEM', 'FUNCTION_POLLING', 'FUNCTION_UNAVAILABLE', `⏳ Function ${functionName} not available, attempt ${attempt}/${maxAttempts}`);
        await this.delay(this.FUNCTION_POLL_INTERVAL);
      }
    }

    debugLogger.error('SYSTEM', 'FUNCTION_POLLING', 'FUNCTION_TIMEOUT', `❌ Function ${functionName} not available after ${maxAttempts} attempts (${maxAttempts * this.FUNCTION_POLL_INTERVAL}ms)`);
    return false;
  }

  // NEW: Method to mark file application as triggered (called from fileApplicationSlice)
  public markFileApplicationTriggered(workflowId: string): void {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      workflow.fileApplicationTriggered = true;
      workflow.lastActivity = Date.now();
      workflow.phase = 'FILE_APPLICATION';
      workflow.phaseStartTime = Date.now();
      
      debugLogger.phaseTransition(workflow, 'AI_PROCESSING', 'FILE_APPLICATION', 'File application triggered by automation system', {
        fileApplicationTriggered: true,
        automationActive: workflow.automationPipelineActive,
        isSequential: workflow.isSequentialError,
        executionCount: workflow.executionCount
      });
      
      this.notifySubscribers();
    }
  }

  // 🔧 ENHANCED: Mark deployment as triggered with fixed execution count increment and final attempt handling
  public markDeploymentTriggered(workflowId: string): void {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      debugLogger.error(workflowId, 'DEPLOYMENT', 'WORKFLOW_NOT_FOUND', 'Workflow not found for deployment trigger');
      return;
    }

    debugLogger.info(workflowId, workflow.phase, 'MARK_DEPLOYMENT_TRIGGERED', 'Deployment trigger requested', {
      currentPhase: workflow.phase,
      currentExecutionCount: workflow.executionCount,
      deploymentIncrementApplied: workflow.deploymentIncrementApplied,
      maxExecutions: workflow.maxExecutions
    });

    // Only proceed if we're transitioning from FILE_APPLICATION to DEPLOYMENT
    if (workflow.phase !== 'FILE_APPLICATION') {
      debugLogger.warn(workflowId, workflow.phase, 'MARK_DEPLOYMENT_TRIGGERED', 'Deployment trigger from unexpected phase', {
        expectedPhase: 'FILE_APPLICATION',
        actualPhase: workflow.phase
      });
    }

    workflow.deploymentTriggered = true;
    workflow.lastActivity = Date.now();
    workflow.phase = 'DEPLOYMENT';
    workflow.phaseStartTime = Date.now();
    
    // 🔧 CRITICAL FIX: Only increment execution count once per workflow, allowing up to maxExecutions
    if (!workflow.deploymentIncrementApplied && workflow.executionCount < workflow.maxExecutions) {
      workflow.executionCount += 1;
      workflow.deploymentIncrementApplied = true; // Prevent further increments
      
      // 🆕 NEW: Check if this is the final attempt
      if (workflow.executionCount >= workflow.maxExecutions) {
        workflow.isFinalAttempt = true;
        debugLogger.critical(workflowId, workflow.phase, 'FINAL_ATTEMPT_DETECTED', 
          `🚨 FINAL ATTEMPT DETECTED - This is attempt ${workflow.executionCount}/${workflow.maxExecutions}`, {
          finalAttempt: true,
          executionCount: workflow.executionCount,
          maxExecutions: workflow.maxExecutions,
          noMoreAttemptsAfterThis: true
        });
      }
      
      debugLogger.critical(workflowId, workflow.phase, 'EXECUTION_COUNT_INCREMENT', 
        `📊 Execution count incremented: ${workflow.executionCount - 1} → ${workflow.executionCount}${workflow.isFinalAttempt ? ' (FINAL ATTEMPT)' : ''}`, {
        newExecutionCount: workflow.executionCount,
        maxExecutions: workflow.maxExecutions,
        isSequential: workflow.isSequentialError,
        attemptDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
        incrementApplied: true,
        isFinalAttempt: workflow.isFinalAttempt,
        finalAttemptWarning: workflow.isFinalAttempt ? 'NO MORE ATTEMPTS AFTER THIS' : 'More attempts available'
      });
    } else if (workflow.deploymentIncrementApplied) {
      debugLogger.warn(workflowId, workflow.phase, 'EXECUTION_COUNT_SKIP', 
        '⏭️ Skipping execution count increment - already applied', {
        currentExecutionCount: workflow.executionCount,
        maxExecutions: workflow.maxExecutions,
        attemptDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
        isFinalAttempt: workflow.isFinalAttempt
      });
    } else {
      // This should not happen with the new logic, but keeping for safety
      debugLogger.critical(workflowId, workflow.phase, 'EXECUTION_COUNT_MAX_REACHED', 
        '🚫 MAXIMUM ATTEMPTS REACHED - Cannot increment execution count', {
        currentExecutionCount: workflow.executionCount,
        maxExecutions: workflow.maxExecutions,
        hasReachedMax: true
      });
      
      // Mark as having reached max attempts
      workflow.hasReachedMaxAttempts = true;
      workflow.isFinalAttempt = true;
    }
      
    // 🆕 CRITICAL: Enable auto-retry deployment flags
    workflow.shouldAutoRetryDeploy = true;
    workflow.deploymentRetryReady = true;
    workflow.isRetryDeployment = true;
    
    debugLogger.phaseTransition(workflow, 'FILE_APPLICATION', 'DEPLOYMENT', 'Deployment triggered by automation system - ENHANCED EXECUTION ORCHESTRATION WITH FINAL ATTEMPT HANDLING', {
      deploymentTriggered: true,
      automationActive: workflow.automationPipelineActive,
      shouldAutoRetryDeploy: workflow.shouldAutoRetryDeploy,
      deploymentRetryReady: workflow.deploymentRetryReady,
      isRetryDeployment: workflow.isRetryDeployment,
      isSequential: workflow.isSequentialError,
      executionCount: workflow.executionCount,
      executionDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
      deploymentIncrementApplied: workflow.deploymentIncrementApplied,
      isFinalAttempt: workflow.isFinalAttempt,
      hasReachedMaxAttempts: workflow.hasReachedMaxAttempts,
      finalAttemptStatus: workflow.isFinalAttempt ? 'THIS IS THE FINAL ATTEMPT' : `${workflow.maxExecutions - workflow.executionCount} attempts remaining`
    });
    
    this.notifySubscribers();
    
    // 🆕 ENHANCED: Trigger deployment execution with robust function polling
    setTimeout(() => {
      this.triggerEnhancedAutoRetryDeployment(workflowId);
    }, 1000); // 1 second delay to ensure state propagation
  }

  // 🆕 ENHANCED: Comprehensive deployment execution orchestration with function polling and final attempt handling
  private async triggerEnhancedAutoRetryDeployment(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      debugLogger.error(workflowId, 'DEPLOYMENT', 'WORKFLOW_NOT_FOUND', 'Workflow not found for enhanced auto-retry deployment');
      return;
    }

    if (!workflow.shouldAutoRetryDeploy || !workflow.deploymentRetryReady) {
      debugLogger.warn(workflowId, workflow.phase, 'DEPLOYMENT', 'Enhanced auto-retry deployment not ready or not enabled', {
        shouldAutoRetryDeploy: workflow.shouldAutoRetryDeploy,
        deploymentRetryReady: workflow.deploymentRetryReady
      });
      return;
    }

    debugLogger.critical(workflowId, workflow.phase, 'ENHANCED_AUTO_RETRY_DEPLOYMENT', 
      `🚀 TRIGGERING ENHANCED AUTO-RETRY DEPLOYMENT${workflow.isFinalAttempt ? ' (FINAL ATTEMPT)' : ''} ORCHESTRATION!`, {
      projectId: workflow.projectId,
      executionCount: workflow.executionCount,
      executionDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
      isRetryDeployment: workflow.isRetryDeployment,
      isSequential: workflow.isSequentialError,
      isFinalAttempt: workflow.isFinalAttempt,
      hasReachedMaxAttempts: workflow.hasReachedMaxAttempts,
      finalAttemptWarning: workflow.isFinalAttempt ? 'NO MORE ATTEMPTS AFTER THIS' : 'More attempts available'
    });

    try {
      // Step 1: Verify and execute tab change with polling
      const tabChangeCallback = (window as any).__chatInterfaceTabChange;
      if (tabChangeCallback && typeof tabChangeCallback === 'function') {
        debugLogger.info(workflowId, workflow.phase, 'ENHANCED_AUTO_RETRY_DEPLOYMENT', 
          `🔄 Switching to deploy tab for enhanced auto-retry deployment${workflow.isFinalAttempt ? ' (FINAL ATTEMPT)' : ''}`);
        tabChangeCallback('deploy');
        
        // Wait for tab switch to complete
        await this.delay(800);
      } else {
        debugLogger.error(workflowId, workflow.phase, 'ENHANCED_AUTO_RETRY_DEPLOYMENT', '❌ Tab change callback not available');
        throw new Error('Tab change callback not available');
      }

      // Step 2: Poll for executeDeployment function availability
      const executeDeploymentAvailable = await this.pollForFunctionAvailability('__executeDeployment', this.FUNCTION_POLL_MAX_ATTEMPTS);
      
      if (!executeDeploymentAvailable) {
        throw new Error(`executeDeployment function not available after ${this.FUNCTION_POLL_MAX_ATTEMPTS * this.FUNCTION_POLL_INTERVAL}ms polling`);
      }

      // Step 3: Execute deployment with verified function availability and timeout protection
      const executeDeployment = (window as any).__executeDeployment;
      debugLogger.critical(workflowId, workflow.phase, 'ENHANCED_AUTO_RETRY_DEPLOYMENT', 
        `⚡ EXECUTING ENHANCED AUTO-RETRY DEPLOYMENT${workflow.isFinalAttempt ? ' (FINAL ATTEMPT)' : ''} NOW WITH VERIFIED FUNCTION!`);
      
      // 🔧 CRITICAL FIX: Add timeout protection to prevent hung state
      // Deployment execution should return quickly (it's async), so we use a short timeout
      // The actual deployment will continue in the background
      const DEPLOYMENT_INIT_TIMEOUT = 5000; // 5 seconds to initiate deployment
      const deploymentPromise = executeDeployment();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Deployment initiation timed out after ${DEPLOYMENT_INIT_TIMEOUT}ms`)), DEPLOYMENT_INIT_TIMEOUT);
      });
      
      try {
        await Promise.race([deploymentPromise, timeoutPromise]);
        
        debugLogger.info(workflowId, workflow.phase, 'ENHANCED_AUTO_RETRY_DEPLOYMENT', 
          `✅ Enhanced auto-retry deployment execution initiated successfully${workflow.isFinalAttempt ? ' (FINAL ATTEMPT)' : ''} with function polling`, {
          executionCount: workflow.executionCount,
          executionDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
          isFinalAttempt: workflow.isFinalAttempt,
          hasReachedMaxAttempts: workflow.hasReachedMaxAttempts
        });
      } catch (timeoutError) {
        // If timeout occurs, log but don't fail - deployment may have started
        debugLogger.warn(workflowId, workflow.phase, 'ENHANCED_AUTO_RETRY_DEPLOYMENT', 
          `⏱️ Deployment initiation timeout - deployment may have started in background`, {
          timeoutError,
          executionCount: workflow.executionCount,
          note: 'Deployment may still be running - monitoring will detect completion or failure'
        });
        // Don't throw - let the deployment continue and be monitored by the error handler
      }
      
    } catch (error) {
      debugLogger.error(workflowId, workflow.phase, 'ENHANCED_AUTO_RETRY_DEPLOYMENT', 
        `❌ Enhanced auto-retry deployment execution failed${workflow.isFinalAttempt ? ' (FINAL ATTEMPT)' : ''}`, { 
        error,
        executionCount: workflow.executionCount,
        executionDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
        isFinalAttempt: workflow.isFinalAttempt,
        hasReachedMaxAttempts: workflow.hasReachedMaxAttempts
      });
      
      // Mark workflow as failed with final attempt context
      await this.handleWorkflowError(workflowId, 
        `Enhanced auto-retry deployment execution failed${workflow.isFinalAttempt ? ' (FINAL ATTEMPT)' : ''}: ${error}`
      );
    }
  }

  // NEW: Method to handle file generation completion (called from generatedFilesSlice)
  public onFileGenerationComplete(workflowId: string, files: { [fileName: string]: string }): void {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      debugLogger.info(workflowId, workflow.phase, 'FILE_GENERATION_COMPLETE', '📁 File generation completed, automation will continue', {
        fileCount: Object.keys(files).length,
        automationActive: workflow.automationPipelineActive,
        isSequential: workflow.isSequentialError,
        executionCount: workflow.executionCount
      });
      
      // Update workflow but keep it active for automation pipeline
      workflow.lastActivity = Date.now();
      // DON'T mark as complete here - let the automation pipeline complete naturally
      
      this.notifySubscribers();
    }
  }

  // NEW: Method to determine if coordinator should handle completion
  public shouldCoordinatorHandleCompletion(workflowId: string, projectId: string): {
    shouldHandle: boolean;
    preferredOwner: 'coordinator' | 'generatedFiles';
    reason: string;
  } {
    const workflow = this.activeWorkflows.get(workflowId) || this.getProjectWorkflow(projectId);
    
    if (!workflow) {
      return {
        shouldHandle: false,
        preferredOwner: 'generatedFiles',
        reason: 'No active workflow found'
      };
    }

    if (workflow.automationPipelineActive) {
      return {
        shouldHandle: true,
        preferredOwner: 'coordinator',
        reason: 'Automation pipeline is active - coordinator should handle'
      };
    }

    return {
      shouldHandle: false,
      preferredOwner: 'generatedFiles',
      reason: 'No automation pipeline - let generatedFiles handle'
    };
  }

  // 🆕 ENHANCED: Complete workflow with immediate UI signaling and final attempt handling
  public async completeWorkflow(workflowId: string, result: WorkflowResult): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      debugLogger.warn(workflowId, 'UNKNOWN', 'COMPLETE_WORKFLOW', 'Workflow not found for completion', { result });
      return;
    }

    // 🆕 NEW: Update workflow flags based on completion result
    if (!result.success && workflow.executionCount >= workflow.maxExecutions) {
      workflow.hasReachedMaxAttempts = true;
      workflow.isFinalAttempt = true;
    }

    debugLogger.critical(workflowId, workflow.phase, 'COMPLETE_WORKFLOW', 
      `${result.success ? '✅' : '❌'} Completing enhanced auto-retry workflow${workflow.isFinalAttempt ? ' (FINAL ATTEMPT)' : ''} with IMMEDIATE UI SIGNALING`, {
      success: result.success,
      phase: result.phase,
      error: result.error,
      deployedUrl: result.deployedUrl,
      duration: result.duration,
      isSequential: workflow.isSequentialError,
      finalExecutionCount: workflow.executionCount,
      executionDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
      hadProcessedErrorContext: workflow.hasProcessedErrorContext,
      isFinalAttempt: workflow.isFinalAttempt,
      hasReachedMaxAttempts: workflow.hasReachedMaxAttempts,
      maxAttemptsReached: !result.success && workflow.hasReachedMaxAttempts
    });

    // 🔧 CRITICAL FIX: Store completion phase before changing to COMPLETED/FAILED
    // This allows UI callbacks to know what phase completed (e.g., 'deployment')
    workflow.completedPhase = result.phase;
    workflow.completedDeployedUrl = result.deployedUrl;
    
    if (result.success) {
      workflow.phase = 'COMPLETED';
    } else {
      workflow.phase = 'FAILED';
      workflow.lastError = result.error || 'Workflow failed';
      
      // 🆕 NEW: Add final attempt context to error message
      if (workflow.hasReachedMaxAttempts) {
        workflow.lastError = `Maximum attempts reached (${workflow.executionCount}/${workflow.maxExecutions}): ${workflow.lastError}`;
      }
    }

    workflow.lastActivity = Date.now();
    // 🆕 CRITICAL FIX: Immediately disable automation and signal UI completion
    workflow.automationPipelineActive = false;
    workflow.uiCompletionSignaled = true;
    
    // 🆕 ENHANCED: Keep protectedFromCleanup true initially to prevent race conditions
    workflow.protectedFromCleanup = true;

    // 🆕 CRITICAL: Immediately notify subscribers with completion state for UI update
    debugLogger.critical(workflowId, workflow.phase, 'UI_COMPLETION_SIGNAL', 
      `🎯 SENDING IMMEDIATE UI COMPLETION SIGNAL${workflow.isFinalAttempt ? ' (FINAL ATTEMPT COMPLETED)' : ''} - UI should exit automation mode NOW`, {
      success: result.success,
      uiCompletionSignaled: workflow.uiCompletionSignaled,
      automationPipelineActive: workflow.automationPipelineActive,
      finalExecutionCount: workflow.executionCount,
      executionDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
      hadProcessedErrorContext: workflow.hasProcessedErrorContext,
      isFinalAttempt: workflow.isFinalAttempt,
      hasReachedMaxAttempts: workflow.hasReachedMaxAttempts,
      maxAttemptsMessage: workflow.hasReachedMaxAttempts ? 'AUTO-RETRY STOPPING - MAXIMUM ATTEMPTS REACHED' : 'Auto-retry available for future errors'
    });
    
    this.notifySubscribers();

    // 🆕 ENHANCED: Delayed cleanup that doesn't affect UI state
    setTimeout(() => {
      const currentWorkflow = this.activeWorkflows.get(workflowId);
      if (currentWorkflow) {
        currentWorkflow.protectedFromCleanup = false;
        debugLogger.info(workflowId, currentWorkflow.phase, 'DELAYED_CLEANUP_PREP', 
          `🕐 Preparing workflow for cleanup after UI completion delay${currentWorkflow.isFinalAttempt ? ' (FINAL ATTEMPT COMPLETED)' : ''}`);
      }
      
      // Final cleanup after additional delay to ensure UI has processed completion
      setTimeout(() => {
        this.cleanupWorkflow(workflowId, 
          `Enhanced workflow ${result.success ? 'completed successfully' : 'failed'}${workflow.isFinalAttempt ? ' after final attempt' : ''} - post-UI cleanup`);
      }, 2000); // Additional 2 second delay for UI processing
      
    }, 1000); // 1 second delay before preparing for cleanup
    
    // 🆕 NEW: Mark auto-retry messages as resolved when workflow completes
    if (result.success || workflow.hasReachedMaxAttempts) {
      this.markAutoRetryMessagesResolved(workflowId, workflow.projectId);
    }
  }

  /**
   * Mark auto-retry messages as resolved when workflow completes
   */
  private markAutoRetryMessagesResolved = async (
    workflowId: string,
    projectId: string
  ): Promise<void> => {
    try {
      const storeState = useAppStore.getState();
      const messages = storeState.projectMessages?.[projectId] || [];
      
      // Find all messages related to this workflow
      const relatedMessages = messages.filter((msg: any) => {
        const domain = detectMessageDomain(msg);
        return domain.domain === 'auto-retry' && 
               (domain.relatedWorkflowId === workflowId ||
                msg.content.includes(workflowId));
      });
      
      console.log(`🔄 [AUTO-RETRY] Marking ${relatedMessages.length} messages as resolved for workflow ${workflowId}`);
      
      // Update messages to mark as resolved
      relatedMessages.forEach((msg: any) => {
        const domain = detectMessageDomain(msg);
        domain.resolved = true;
        domain.resolvedAt = Date.now();
        
        // Update message's domain context
        msg.domainContext = domain;
        
        // Downgrade priority if it was HIGH
        if (msg.priorityContext && msg.priorityContext.priority === MessagePriority.HIGH) {
          msg.priorityContext.priority = MessagePriority.LOW;
          msg.priorityContext.priorityReason = "Resolved auto-retry issue - low priority for future contexts";
          
          // Update in store
          useAppStore.setState((state: any) => {
            if (state.priorityAssignments && state.priorityAssignments[msg.id]) {
              state.priorityAssignments[msg.id].priority = MessagePriority.LOW;
              state.priorityAssignments[msg.id].priorityReason = "Resolved auto-retry issue - low priority for future contexts";
            }
          });
        }
      });
      
      console.log(`✅ [AUTO-RETRY] Marked ${relatedMessages.length} messages as resolved`);
    } catch (error) {
      console.error(`❌ [AUTO-RETRY] Failed to mark messages as resolved:`, error);
    }
  };

  // Validation methods
  public canStartAutoRetry_Legacy(projectId: string): boolean {
    // Keep legacy method for backward compatibility, but redirect to enhanced version
    return this.canStartAutoRetry(projectId);
  }

  // Workflow management methods
  public getWorkflowState(workflowId: string): GlobalWorkflowState | null {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      debugLogger.trace(workflowId, workflow.phase, 'GET_STATE', 'Workflow state retrieved', {
        phase: workflow.phase,
        automationActive: workflow.automationPipelineActive,
        protectedFromCleanup: workflow.protectedFromCleanup,
        uiCompletionSignaled: workflow.uiCompletionSignaled,
        isSequential: workflow.isSequentialError,
        executionCount: workflow.executionCount,
        executionDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
        hasProcessedErrorContext: workflow.hasProcessedErrorContext,
        isFinalAttempt: workflow.isFinalAttempt,
        hasReachedMaxAttempts: workflow.hasReachedMaxAttempts
      });
    }
    return workflow || null;
  }

  public getProjectWorkflow(projectId: string): GlobalWorkflowState | null {
    const workflowId = this.projectWorkflowMap.get(projectId);
    if (!workflowId) {
      debugLogger.trace('UNKNOWN', 'PROJECT_LOOKUP', 'NO_WORKFLOW', 'No workflow found for project', { projectId });
      return null;
    }
    
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      debugLogger.trace(workflowId, workflow.phase, 'PROJECT_LOOKUP', 'Project workflow found', {
        projectId,
        phase: workflow.phase,
        automationActive: workflow.automationPipelineActive,
        protectedFromCleanup: workflow.protectedFromCleanup,
        uiCompletionSignaled: workflow.uiCompletionSignaled,
        isSequential: workflow.isSequentialError,
        executionCount: workflow.executionCount,
        executionDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
        hasProcessedErrorContext: workflow.hasProcessedErrorContext,
        isFinalAttempt: workflow.isFinalAttempt,
        hasReachedMaxAttempts: workflow.hasReachedMaxAttempts
      });
    } else {
      debugLogger.warn(workflowId, 'UNKNOWN', 'PROJECT_LOOKUP', 'Workflow ID exists but workflow not found', { 
        projectId, 
        workflowId,
        allWorkflows: Array.from(this.activeWorkflows.keys())
      });
    }
    
    return workflow || null;
  }

  public isProjectInAutoRetry(projectId: string): boolean {
    const workflow = this.getProjectWorkflow(projectId);
    // 🔧 CRITICAL FIX: Check both phase and automationPipelineActive to prevent false positives
    // A workflow that's COMPLETED/FAILED or has automation disabled should not be considered "in auto-retry"
    const isInAutoRetry = workflow !== null && 
                         workflow.phase !== 'COMPLETED' && 
                         workflow.phase !== 'FAILED' &&
                         workflow.automationPipelineActive === true;
    
    debugLogger.trace(workflow?.workflowId || 'NONE', workflow?.phase || 'NONE', 'PROJECT_STATUS_CHECK', 'Checking if project is in auto-retry', {
      projectId,
      isInAutoRetry,
      workflowExists: !!workflow,
      phase: workflow?.phase,
      automationActive: workflow?.automationPipelineActive,
      uiCompletionSignaled: workflow?.uiCompletionSignaled,
      isSequential: workflow?.isSequentialError,
      executionCount: workflow?.executionCount,
      executionDisplay: workflow ? `${workflow.executionCount}/${workflow.maxExecutions}` : 'N/A',
      hasProcessedErrorContext: workflow?.hasProcessedErrorContext,
      isFinalAttempt: workflow?.isFinalAttempt,
      hasReachedMaxAttempts: workflow?.hasReachedMaxAttempts,
      reason: !workflow ? 'No workflow' : 
              workflow.phase === 'COMPLETED' ? 'Workflow completed' :
              workflow.phase === 'FAILED' ? 'Workflow failed' :
              workflow.automationPipelineActive === false ? 'Automation disabled' :
              'Active auto-retry'
    });
    
    return isInAutoRetry;
  }

  public forceCleanupWorkflow(projectId: string): void {
    const workflowId = this.projectWorkflowMap.get(projectId);
    if (workflowId) {
      debugLogger.critical(workflowId, 'CLEANUP', 'FORCE_CLEANUP', '🧹 Force cleaning workflow', { projectId }, undefined, 'CLEANUP_ATTEMPTED', 'Force cleanup requested');
      this.cleanupWorkflow(workflowId, 'Force cleanup requested');
    }
  }

  // 🆕 ENHANCED: Mark workflow as complete with immediate UI signaling and final attempt handling
  public markWorkflowComplete(workflowId: string, success: boolean, phase?: string): void {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      debugLogger.warn(workflowId, 'UNKNOWN', 'MARK_COMPLETE', 'Cannot mark non-existent workflow as complete', { success, phase });
      return;
    }

    const finalPhase = success ? 'COMPLETED' : 'FAILED';
    
    // CRITICAL: If automation pipeline is still active, don't mark as complete yet
    if (workflow.automationPipelineActive && success && !workflow.uiCompletionSignaled) {
      debugLogger.warn(workflowId, workflow.phase, 'MARK_COMPLETE', '⚠️ Automation pipeline still active - deferring completion until UI signaling is ready', {
        success,
        phase: phase || finalPhase,
        automationActive: workflow.automationPipelineActive,
        fileAppTriggered: workflow.fileApplicationTriggered,
        deploymentTriggered: workflow.deploymentTriggered,
        uiCompletionSignaled: workflow.uiCompletionSignaled,
        executionCount: workflow.executionCount,
        isFinalAttempt: workflow.isFinalAttempt
      });
      
      // Just update the activity time but don't complete
      workflow.lastActivity = Date.now();
      this.notifySubscribers();
      return;
    }

    // 🆕 NEW: Check if workflow has reached maximum attempts
    if (!success && workflow.executionCount >= workflow.maxExecutions) {
      workflow.hasReachedMaxAttempts = true;
      workflow.isFinalAttempt = true;
    }

    workflow.phase = finalPhase;
    workflow.lastActivity = Date.now();
    workflow.isTransitioning = false;
    
    // 🆕 CRITICAL FIX: Immediately disable automation and signal UI completion
    workflow.automationPipelineActive = false;
    workflow.uiCompletionSignaled = true;
    workflow.protectedFromCleanup = true; // Keep protected initially

    const duration = Date.now() - workflow.startTime;
    
    debugLogger.critical(workflowId, finalPhase, 'WORKFLOW_COMPLETE', 
      `${success ? '✅' : '❌'} Enhanced workflow ${success ? 'completed' : 'failed'}${workflow.isFinalAttempt ? ' (FINAL ATTEMPT)' : ''} after ${duration}ms with IMMEDIATE UI SIGNALING`, {
      success,
      duration,
      attempts: workflow.executionCount,
      phase: phase || finalPhase,
      fileAppTriggered: workflow.fileApplicationTriggered,
      deploymentTriggered: workflow.deploymentTriggered,
      uiCompletionSignaled: workflow.uiCompletionSignaled,
      isSequential: workflow.isSequentialError,
      finalExecutionCount: workflow.executionCount,
      executionDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
      hadProcessedErrorContext: workflow.hasProcessedErrorContext,
      isFinalAttempt: workflow.isFinalAttempt,
      hasReachedMaxAttempts: workflow.hasReachedMaxAttempts,
      maxAttemptsMessage: workflow.hasReachedMaxAttempts ? 'MAXIMUM ATTEMPTS REACHED - AUTO-RETRY STOPPING' : 'Auto-retry available for future errors'
    }, workflow, 'PHASE_CHANGED');

    // 🆕 CRITICAL: Immediately notify subscribers for UI update
    this.notifySubscribers();

    // 🆕 ENHANCED: Delayed cleanup that doesn't affect UI responsiveness
    setTimeout(() => {
      const currentWorkflow = this.activeWorkflows.get(workflowId);
      if (currentWorkflow) {
        currentWorkflow.protectedFromCleanup = false;
      }
      
      setTimeout(() => {
        this.cleanupWorkflow(workflowId, 
          `Enhanced workflow ${success ? 'completed successfully' : 'failed'}${workflow.isFinalAttempt ? ' after final attempt' : ''} - delayed cleanup`);
      }, 2000); // Additional delay for UI processing
      
    }, 1000); // 1 second initial delay
  }

  // Error handling
  private async handleWorkflowError(workflowId: string, error: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    const isFinalAttempt = workflow?.isFinalAttempt || false;
    const hasReachedMax = workflow?.hasReachedMaxAttempts || false;
    
    debugLogger.error(workflowId, 'ERROR_HANDLING', 'WORKFLOW_ERROR', 
      `🚨 Enhanced workflow error${isFinalAttempt ? ' (FINAL ATTEMPT)' : ''}: ${error}`, {
      isFinalAttempt,
      hasReachedMaxAttempts: hasReachedMax,
      executionCount: workflow?.executionCount,
      maxExecutions: workflow?.maxExecutions
    });
    
    this.markWorkflowComplete(workflowId, false, 'error');
  }

  // Utility methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ENHANCED: Cleanup workflow with comprehensive lifecycle tracking
  private cleanupWorkflow(workflowId: string, reason: string = 'Unknown'): void {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      debugLogger.warn(workflowId, 'UNKNOWN', 'CLEANUP', '⚠️ Cannot cleanup non-existent workflow', { reason });
      return;
    }

    debugLogger.workflowCleanupAttempted(workflowId, reason, true, workflow);
    
    debugLogger.info(workflowId, workflow.phase, 'CLEANUP', `🧹 Cleaning up enhanced workflow: ${reason}`, {
      duration: Date.now() - workflow.createdAt,
      phase: workflow.phase,
      automationWasActive: workflow.automationPipelineActive,
      uiCompletionSignaled: workflow.uiCompletionSignaled,
      isSequential: workflow.isSequentialError,
      finalExecutionCount: workflow.executionCount,
      executionDisplay: `${workflow.executionCount}/${workflow.maxExecutions}`,
      hadProcessedErrorContext: workflow.hasProcessedErrorContext,
      isFinalAttempt: workflow.isFinalAttempt,
      hasReachedMaxAttempts: workflow.hasReachedMaxAttempts
    });
    
    this.projectWorkflowMap.delete(workflow.projectId);
    this.activeWorkflows.delete(workflowId);
    this.cleanupWorkflowSubscriptions(workflowId);
    
    debugLogger.workflowDestroyed(workflowId, reason, workflow);
    
    this.notifySubscribers();
  }

  private cleanupWorkflowSubscriptions(workflowId: string): void {
    debugLogger.trace(workflowId, 'CLEANUP', 'SUBSCRIPTION_CLEANUP', 'Starting subscription cleanup');
    
    for (const [key, unsubscribe] of this.storeUnsubscribers.entries()) {
      if (key.includes(workflowId)) {
        try {
          unsubscribe();
        } catch (error) {
          debugLogger.warn('SYSTEM', 'CLEANUP', 'SUBSCRIPTION_ERROR', `Error cleaning subscription ${key}`, { error });
        }
        this.storeUnsubscribers.delete(key);
      }
    }
  }

  // ENHANCED: Cleanup expired workflows with comprehensive protection logic
  private cleanupExpiredWorkflows(): void {
    const now = Date.now();
    const expiredWorkflows: Array<{workflowId: string, reason: string}> = [];

    for (const [workflowId, workflow] of this.activeWorkflows.entries()) {
      workflow.lastCleanupAttempt = now;
      
      // CRITICAL: Check if workflow is protected from cleanup
      if (workflow.protectedFromCleanup) {
        debugLogger.workflowCleanupAttempted(workflowId, 'Protected from cleanup', false, workflow);
        continue;
      }
      
      // CRITICAL: Check if automation pipeline is active
      if (workflow.automationPipelineActive) {
        debugLogger.workflowCleanupAttempted(workflowId, 'Automation pipeline active', false, workflow);
        continue;
      }
      
      // 🆕 NEW: Don't cleanup workflows that have completed but haven't signaled UI completion yet
      if ((workflow.phase === 'COMPLETED' || workflow.phase === 'FAILED') && !workflow.uiCompletionSignaled) {
        debugLogger.workflowCleanupAttempted(workflowId, 'Waiting for UI completion signal', false, workflow);
        continue;
      }
      
      // Use extended timeout if workflow had extended timeout enabled
      const timeout = workflow.extendedTimeout ? this.EXTENDED_WORKFLOW_TIMEOUT : this.BASE_WORKFLOW_TIMEOUT;
      const age = now - workflow.createdAt;
      const timeSinceActivity = now - workflow.lastActivity;
      
      let shouldExpire = false;
      let expireReason = '';
      
      if (age > timeout) {
        shouldExpire = true;
        expireReason = `Age exceeded timeout (${age}ms > ${timeout}ms)`;
      } else if (timeSinceActivity > timeout && workflow.phase !== 'AI_PROCESSING') {
        shouldExpire = true;
        expireReason = `Inactive too long (${timeSinceActivity}ms > ${timeout}ms)`;
      }
      
      if (shouldExpire) {
        debugLogger.workflowCleanupAttempted(workflowId, expireReason, true, workflow);
        expiredWorkflows.push({workflowId, reason: expireReason});
      }
    }

    if (expiredWorkflows.length > 0) {
      debugLogger.warn('SYSTEM', 'CLEANUP', 'EXPIRED_WORKFLOWS', `🧹 Cleaning up ${expiredWorkflows.length} expired workflows`, {
        workflows: expiredWorkflows
      });
      
      expiredWorkflows.forEach(({workflowId, reason}) => {
        this.cleanupWorkflow(workflowId, reason);
      });
    }
  }

  private performHealthCheck(): void {
    const activeCount = this.activeWorkflows.size;
    const protectedCount = Array.from(this.activeWorkflows.values()).filter(w => w.protectedFromCleanup).length;
    const automationActiveCount = Array.from(this.activeWorkflows.values()).filter(w => w.automationPipelineActive).length;
    const completedWithoutUISignal = Array.from(this.activeWorkflows.values()).filter(w => 
      (w.phase === 'COMPLETED' || w.phase === 'FAILED') && !w.uiCompletionSignaled
    ).length;
    const sequentialErrorCount = Array.from(this.activeWorkflows.values()).filter(w => w.isSequentialError).length;
    const withProcessedErrorContext = Array.from(this.activeWorkflows.values()).filter(w => w.hasProcessedErrorContext).length;
    const finalAttemptCount = Array.from(this.activeWorkflows.values()).filter(w => w.isFinalAttempt).length;
    const maxAttemptsReachedCount = Array.from(this.activeWorkflows.values()).filter(w => w.hasReachedMaxAttempts).length;
    
    if (activeCount === 0) {
      debugLogger.trace('SYSTEM', 'HEALTH_CHECK', 'HEALTH_CHECK_CLEAN', '✅ Health check passed - no active workflows');
    } else {
      debugLogger.info('SYSTEM', 'HEALTH_CHECK', 'HEALTH_CHECK_ACTIVE', `📊 Enhanced health check: ${activeCount} workflows active`, {
        activeCount,
        protectedCount,
        automationActiveCount,
        completedWithoutUISignal,
        sequentialErrorCount,
        withProcessedErrorContext,
        finalAttemptCount,
        maxAttemptsReachedCount,
        workflows: Array.from(this.activeWorkflows.values()).map(w => ({
          id: w.workflowId.slice(-8),
          phase: w.phase,
          protected: w.protectedFromCleanup,
          automation: w.automationPipelineActive,
          uiSignaled: w.uiCompletionSignaled,
          sequential: w.isSequentialError,
          hasErrorContext: w.hasProcessedErrorContext,
          age: Date.now() - w.createdAt,
          executionCount: w.executionCount,
          executionDisplay: `${w.executionCount}/${w.maxExecutions}`,
          isFinalAttempt: w.isFinalAttempt,
          hasReachedMax: w.hasReachedMaxAttempts
        }))
      });
    }
  }

  public destroy(): void {
    debugLogger.info('SYSTEM', 'DESTRUCTION', 'COORDINATOR_DESTROY', '🧹 Destroying enhanced coordinator service with DIRECT ERROR CONTEXT INJECTION and FINAL ATTEMPT HANDLING');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.storeUnsubscribers.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        debugLogger.warn('SYSTEM', 'DESTRUCTION', 'CLEANUP_ERROR', 'Error during cleanup', { error });
      }
    });
    this.storeUnsubscribers.clear();
    
    this.activeWorkflows.clear();
    this.projectWorkflowMap.clear();
    this.subscribers = [];
  }
}

export const autoRetryCoordinator = new AutoRetryCoordinatorService();

// Enhanced window exposure with debugging functions
if (typeof window !== 'undefined') {
  (window as any).__autoRetryCoordinator = autoRetryCoordinator;
  (window as any).__autoRetryDebugLogger = debugLogger;
}