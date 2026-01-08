import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { userCanisterService } from './UserCanisterService';
import { AgentDeploymentService } from './AgentDeploymentService';
import { idlFactory as agencyIdlFactory } from '../../candid/agency.did.js';
import { idlFactory as agentIdlFactory } from '../../candid/agent.did.js';
import type { 
  _SERVICE as AgencyWorkflowActor,
  Agency,
  AgentStep as CandidAgentStep,
  Execution,
  StepResult,
  ExecutionStatus,
  TriggerConfig,
  TriggerType,
  ScheduleType,
  ConditionType,
  RetryConfig,
  ExecutionLimits,
  AgentMetrics,
  ActivityEvent,
  ErrorLog,
  Approval,
  AgentIdentity,
  AgentConfig,
  WorkflowConfig
} from '../../candid/agency.did.d.ts';
import type { _SERVICE as AgentService } from '../../candid/agent.did.d.ts';

// ==================== ENHANCED TYPES ====================

// Frontend types that match the enhanced Candid interface
export type LoopConfig = 
  | { forEach: { arraySource: string; itemVariable: string; indexVariable: string; maxIterations?: number } }
  | { whileLoop: { condition: string; maxIterations?: number } }
  | { repeat: { count: number; indexVariable?: string } }
  | { none: null };

export type StepTarget = 
  | { agent: { agentCanisterId: string; agentConfig?: any } }
  | { agency: { agencyId: string; inputMapping: string } };

export interface AgentStep {
  agentCanisterId: string; // Keep for backward compatibility
  agentName: string;
  inputTemplate: string;
  triggerConfig?: TriggerConfig;
  requiresApproval?: boolean;
  retryOnFailure?: boolean;
  timeout?: number;
  // NEW: Loop and nested workflow support
  stepTarget?: StepTarget; // Replaces agentCanisterId when provided
  loopConfig?: LoopConfig; // Loop configuration
}

// NEW: Connection types for graph-based workflows
export interface ConnectionCondition {
  onSuccess?: null;
  onFailure?: null;
  always?: null;
  ifContains?: { field: string; value: string };
  ifEquals?: { field: string; value: string };
}

export interface AgentConnection {
  sourceStepIndex: number;
  targetStepIndex: number;
  condition: ConnectionCondition;
}

interface Agency {
  id: string;
  name: string;
  description: string;
  steps: AgentStep[];
  connections?: AgentConnection[]; // NEW: Graph structure for conditional/parallel execution
  created: number;
  updated: number;
  triggerEnabled: boolean;
  globalTriggers: TriggerConfig[];
  owner: string;
  executionMode: string;
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  enabled: boolean;
}

interface Execution {
  id: string;
  agencyId: string;
  agencyName: string;
  input: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'triggered' | 'scheduled' | 'waiting_approval' | 'paused';
  currentStep: number;
  results: StepResult[];
  startTime: number;
  endTime?: number;
  error?: string;
  triggerSource?: string;
  executionMode: string;
  totalAgents: number;
  agentFailures: number;
  cyclesUsed: number;
  triggeredBy: string;
  metadata: [string, string][];
  pausedAt?: number;
  resumedAt?: number;
}

interface StepResult {
  stepIndex: number;
  agentName: string;
  input: string;
  output: string;
  duration: number;
  success: boolean;
  error?: string;
  triggerUsed?: string;
  agentMetrics?: AgentMetrics;
  retryCount: number;
  approvalRequired: boolean;
  approvalStatus?: string;
}

interface TriggerConfig {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastTriggered?: number;
  nextRun?: number;
  owner: string;
  inputTemplate: string;
  conditions: [string, string][];
  retryConfig?: RetryConfig;
  executionLimits?: ExecutionLimits;
  triggerCount: number;
  lastResult?: string;
}

interface AgentMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  successRate: number;
  avgResponseTime: number;
  totalCyclesUsed: number;
  totalApprovals: number;
  pendingApprovals: number;
  activeErrors: number;
  mcpToolsConfigured: number;
}

interface ActivityEvent {
  id: string;
  timestamp: number;
  eventType: string;
  taskId?: string;
  details: string;
  metadata: [string, string][];
  severity: string;
}

interface ErrorLog {
  id: string;
  timestamp: number;
  errorType: string;
  errorMessage: string;
  taskId?: string;
  context: string;
  stackTrace?: string;
  resolved: boolean;
}

interface Approval {
  id: string;
  taskId: string;
  timestamp: number;
  action: string;
  reasoning: string;
  confidence: number;
  status: string;
  approvedBy?: string;
  approvedAt?: number;
}

// NEW: Trigger creation interfaces
interface CreateScheduledTriggerRequest {
  agencyId: string;
  name: string;
  description: string;
  schedule: ScheduleType;
  inputTemplate: string;
  retryConfig?: RetryConfig;
  executionLimits?: ExecutionLimits;
}

interface CreateConditionTriggerRequest {
  agencyId: string;
  name: string;
  description: string;
  condition: ConditionType;
  inputTemplate: string;
  retryConfig?: RetryConfig;
  executionLimits?: ExecutionLimits;
}

interface CreateWebhookTriggerRequest {
  agencyId: string;
  name: string;
  description: string;
  source: string;
  signature?: string;
  inputTemplate: string;
  retryConfig?: RetryConfig;
  executionLimits?: ExecutionLimits;
}

// Server pair interface for consistent architecture
interface ServerPair {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
}

// ==================== ENHANCED SERVICE CLASS ====================

class AgencyServiceClass {
  
  /**
   * Get server pairs for a project (following AgentManagementInterface pattern)
   */
  private async getProjectServerPairs(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<ServerPair[]> {
    try {
      console.log(`🔍 Loading server pairs for project: ${projectId}`);
      
      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      const serverPairsResult = await userActor.getProjectServerPairs(projectId);

      if (serverPairsResult && 'ok' in serverPairsResult) {
        const pairs = serverPairsResult.ok.map((pair: any) => ({
          pairId: pair.pairId,
          name: pair.name,
          createdAt: Number(pair.createdAt) / 1_000_000,
          creditsAllocated: Number(pair.creditsAllocated),
          frontendCanisterId: pair.frontendCanisterId.toText(),
          backendCanisterId: pair.backendCanisterId.toText()
        }));
        
        console.log(`✅ Loaded ${pairs.length} server pairs for project ${projectId}`);
        return pairs;
      } else {
        console.log(`❌ Failed to load server pairs: ${serverPairsResult.err}`);
        return [];
      }
    } catch (error) {
      console.error('Failed to load server pairs:', error);
      return [];
    }
  }

  /**
   * Get the selected server pair for a project (using agency-specific localStorage key)
   */
  private async getSelectedServerPair(
    projectId: string, 
    serverPairs: ServerPair[]
  ): Promise<ServerPair | null> {
    if (serverPairs.length === 0) {
      console.log('❌ No server pairs available for project');
      return null;
    }

    // NO CACHING - use backend state only
    // Get the selected server pair from backend canister
    try {
      const selectedPairId = await getSelectedServerPairForProject(projectId);
      if (selectedPairId) {
        const selectedPair = serverPairs.find(p => p.pairId === selectedPairId);
        if (selectedPair) {
          console.log(`🎯 Using selected agency workflow server pair from backend: ${selectedPair.name} (${selectedPair.backendCanisterId})`);
          return selectedPair;
        }
      }
    } catch (error) {
      console.error('❌ Failed to get selected server pair from backend:', error);
    }

    // Default to first server pair if no selection or error
    const defaultPair = serverPairs[0];
    console.log(`🎯 Using default server pair for agency workflow: ${defaultPair.name} (${defaultPair.backendCanisterId})`);
    return defaultPair;
  }

  /**
   * Check if workflow engine is initialized for a project
   * (Now checks if the backend canister supports agency workflows)
   */
  public async checkInitialized(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ initialized: boolean; error?: string }> {
    try {
      console.log(`🔍 Checking agency workflow initialization for project: ${projectId}`);
      
      // Load server pairs for the project
      const serverPairs = await this.getProjectServerPairs(projectId, userCanisterId, identity);
      if (serverPairs.length === 0) {
        console.log(`❌ No server pairs available - agency workflows not initialized`);
        return { initialized: false, error: 'No server pairs available for project' };
      }

      // Get the selected server pair
      const selectedServerPair = await this.getSelectedServerPair(projectId, serverPairs);
      if (!selectedServerPair) {
        console.log(`❌ No valid server pair selected - agency workflows not initialized`);
        return { initialized: false, error: 'No valid server pair selected' };
      }

      // Try to create an agency actor and check its health
      try {
        const actor = await this.createAgencyActor(selectedServerPair.backendCanisterId, identity);
        const health = await actor.health();
        
        console.log(`✅ Agency workflow canister is healthy: ${health}`);
        return { initialized: true };
      } catch (error) {
        console.log(`❌ Agency workflow canister not responding - may need initialization`);
        return { initialized: false, error: 'Agency workflow canister not responding' };
      }
    } catch (error) {
      console.error('Failed to check agency workflow initialization:', error);
      return { 
        initialized: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Initialize agency workflow on the backend canister
   * (Now initializes agency functionality on existing backend canister)
   */
  /**
   * Set Kontext owner for the agency workflow canister
   */
  public async setKontextOwner(
    projectId: string,
    userCanisterId: string,
    identity: Identity,
    ownerPrincipal: string
  ): Promise<{ ok?: string; err?: string }> {
    try {
      console.log(`🏢 [AgencyService] Setting Kontext owner: ${ownerPrincipal}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      const result = await actor.setKontextOwner(Principal.fromText(ownerPrincipal));
      
      if ('ok' in result) {
        console.log(`✅ [AgencyService] Kontext owner set successfully: ${result.ok}`);
        return { ok: result.ok };
      } else {
        console.error(`❌ [AgencyService] Failed to set Kontext owner: ${result.err}`);
        return { err: result.err };
      }
    } catch (error) {
      console.error('❌ [AgencyService] Error setting Kontext owner:', error);
      return { err: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get Kontext owner for the agency workflow canister
   */
  public async getKontextOwner(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ ok?: string | null; err?: string }> {
    try {
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      const result = await actor.getKontextOwner();
      // result is ?Principal (optional), so check if it exists
      return { ok: result.length > 0 && result[0] ? result[0].toString() : null };
    } catch (error) {
      console.error('❌ [AgencyService] Error getting Kontext owner:', error);
      return { err: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get authorized managers for the agency workflow canister
   */
  public async getAuthorizedManagers(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ ok?: string[]; err?: string }> {
    try {
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      const managers = await actor.getAuthorizedManagers();
      return { ok: managers.map(p => p.toString()) };
    } catch (error) {
      console.error('❌ [AgencyService] Error getting authorized managers:', error);
      return { err: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Initialize agency workflow from Kontext
   */
  public async initializeFromKontext(
    projectId: string,
    userCanisterId: string,
    identity: Identity,
    workflowConfig?: {
      defaultTimeout?: number;
      defaultExecutionMode?: string;
      name?: string;
      description?: string;
      enabled?: boolean;
      maxConcurrentExecutions?: number;
    }
  ): Promise<{ ok?: string; err?: string }> {
    try {
      console.log(`🏢 [AgencyService] Initializing from Kontext for project: ${projectId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      // Create WorkflowConfig with defaults if not provided
      const config: WorkflowConfig = {
        defaultTimeout: BigInt(workflowConfig?.defaultTimeout || 300), // 5 minutes default
        defaultExecutionMode: workflowConfig?.defaultExecutionMode || 'sequential',
        name: workflowConfig?.name || 'Kontext Workflow',
        description: workflowConfig?.description || 'Workflow initialized from Kontext',
        enabled: workflowConfig?.enabled !== false, // Default to true
        maxConcurrentExecutions: BigInt(workflowConfig?.maxConcurrentExecutions || 1)
      };
      
      const result = await actor.initializeFromKontext(config);
      
      if ('ok' in result) {
        console.log(`✅ [AgencyService] Initialized from Kontext: ${result.ok}`);
        return { ok: result.ok };
      } else {
        console.error(`❌ [AgencyService] Failed to initialize from Kontext: ${result.err}`);
        return { err: result.err };
      }
    } catch (error) {
      console.error('❌ [AgencyService] Error initializing from Kontext:', error);
      return { err: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Claim Kontext management for the agency workflow canister
   */
  public async claimKontextManagement(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ ok?: string; err?: string }> {
    try {
      console.log('🏢 [AgencyService] Attempting to claim Kontext management...');
      const kontextPrincipal = identity.getPrincipal().toText();
      
      // Step 1: Try to set Kontext owner (will work if owner is null, even if canister is initialized)
      const setOwnerResult = await this.setKontextOwner(projectId, userCanisterId, identity, kontextPrincipal);
      
      if ('err' in setOwnerResult) {
        console.warn('⚠️ [AgencyService] Failed to set Kontext owner:', setOwnerResult.err);
        // Continue anyway - might already be set
      } else {
        console.log('✅ [AgencyService] Kontext owner set:', setOwnerResult.ok);
      }

      // Step 2: Try to initialize from Kontext (will add Kontext as manager if already initialized)
      const initResult = await this.initializeFromKontext(projectId, userCanisterId, identity);
      if ('ok' in initResult) {
        console.log('✅ [AgencyService] Kontext management claimed successfully:', initResult.ok);
        return { ok: 'Kontext management claimed successfully' };
      } else {
        console.warn('⚠️ [AgencyService] Failed to initialize from Kontext:', initResult.err);
        return { err: initResult.err };
      }
    } catch (error) {
      console.error('❌ [AgencyService] Error claiming Kontext management:', error);
      return { err: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Helper: Try to claim Kontext management if not authorized
   */
  private async ensureKontextManagement(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ authorized: boolean; error?: string }> {
    try {
      // Check if we're authorized by trying to get authorized managers
      const managersResult = await this.getAuthorizedManagers(projectId, userCanisterId, identity);
      const kontextPrincipal = identity.getPrincipal().toText();
      
      if ('ok' in managersResult) {
        const isAuthorized = managersResult.ok.includes(kontextPrincipal);
        if (isAuthorized) {
          return { authorized: true };
        }
      }

      // Not authorized - try to claim management
      console.log('⚠️ [AgencyService] Kontext not authorized, attempting to claim management...');
      const claimResult = await this.claimKontextManagement(projectId, userCanisterId, identity);
      
      if ('ok' in claimResult) {
        console.log('✅ [AgencyService] Kontext management claimed successfully');
        return { authorized: true };
      } else {
        const errorMsg = claimResult.err || 'Failed to claim management';
        console.error('❌ [AgencyService] Failed to claim management:', errorMsg);
        return { authorized: false, error: errorMsg };
      }
    } catch (error) {
      console.error('❌ [AgencyService] Error checking/claiming management:', error);
      return { authorized: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  public async initializeAgencyCanister(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; canisterId?: string; error?: string }> {
    try {
      console.log(`🚀 Initializing agency workflow for project: ${projectId}`);
      
      // Load server pairs for the project
      const serverPairs = await this.getProjectServerPairs(projectId, userCanisterId, identity);
      if (serverPairs.length === 0) {
        return { success: false, error: 'No server pairs available for project' };
      }

      // Get the selected server pair
      const selectedServerPair = await this.getSelectedServerPair(projectId, serverPairs);
      if (!selectedServerPair) {
        return { success: false, error: 'No valid server pair selected' };
      }

      console.log(`🎯 Using backend canister for agency workflows: ${selectedServerPair.backendCanisterId}`);

      // STEP 1: Set Kontext owner BEFORE initialization (allows claiming ownership even if already initialized)
      const kontextPrincipal = identity.getPrincipal().toText();
      const setOwnerResult = await this.setKontextOwner(projectId, userCanisterId, identity, kontextPrincipal);
      if ('err' in setOwnerResult) {
        console.warn(`⚠️ Failed to set Kontext owner before initialization: ${setOwnerResult.err}`);
        // Continue anyway - might already be set or will be set during initialization
      } else {
        console.log(`✅ Kontext owner set before initialization: ${setOwnerResult.ok}`);
      }

      // STEP 2: Initialize the agency workflow functionality on the backend canister
      const agencyActor = await this.createAgencyActor(selectedServerPair.backendCanisterId, identity);
      
      // Try initializeFromKontext first (handles already-initialized case)
      // Pass WorkflowConfig with defaults for defaultTimeout, maxConcurrentExecutions, etc.
      let initResult;
      try {
        const workflowConfig: WorkflowConfig = {
          defaultTimeout: BigInt(300), // 5 minutes default
          defaultExecutionMode: 'sequential',
          name: 'Kontext Workflow',
          description: 'Workflow initialized from Kontext',
          enabled: true,
          maxConcurrentExecutions: BigInt(1)
        };
        initResult = await agencyActor.initializeFromKontext(workflowConfig);
      } catch (error) {
        // Fallback to regular initialize if initializeFromKontext doesn't exist or fails
        console.log('⚠️ initializeFromKontext not available, trying regular initialize...');
        initResult = await agencyActor.initialize(identity.getPrincipal());
      }
      
      if ('ok' in initResult) {
        console.log(`✅ Agency workflow initialized successfully on canister: ${selectedServerPair.backendCanisterId}`);
        return { 
          success: true, 
          canisterId: selectedServerPair.backendCanisterId 
        };
      } else {
        console.error(`❌ Failed to initialize agency workflow: ${initResult.err}`);
        return { 
          success: false, 
          error: `Initialization failed: ${initResult.err}` 
        };
      }
    } catch (error) {
      console.error('Failed to initialize agency workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get canister details for an initialized workflow engine
   * (Now returns the backend canister from server pairs)
   */
  public async getCanisterDetails(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; canisterId?: string; backendUrl?: string; error?: string }> {
    try {
      console.log(`📋 Getting agency canister details for project: ${projectId}`);
      
      // Load server pairs for the project
      const serverPairs = await this.getProjectServerPairs(projectId, userCanisterId, identity);
      if (serverPairs.length === 0) {
        return { success: false, error: 'No server pairs available for project' };
      }

      // Get the selected server pair
      const selectedServerPair = await this.getSelectedServerPair(projectId, serverPairs);
      if (!selectedServerPair) {
        return { success: false, error: 'No valid server pair selected' };
      }

      const canisterId = selectedServerPair.backendCanisterId;
      const backendUrl = `https://${canisterId}.icp0.io`;
      
      console.log(`✅ Agency canister details: ${canisterId}`);
      
      return {
        success: true,
        canisterId,
        backendUrl
      };
    } catch (error) {
      console.error('Failed to get canister details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Create an AgencyWorkflow actor directly from canister ID
   * (Following the same pattern as AgentManagementInterface)
   */
  /**
   * Create an agent actor to interact with an agent canister
   */
  private async createAgentActor(canisterId: string, identity: Identity): Promise<AgentService> {
    const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4943'
      : 'https://icp0.io';
    
    const agent = new HttpAgent({ identity, host });
    
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      await agent.fetchRootKey();
    }
    
    return Actor.createActor<AgentService>(agentIdlFactory, {
      agent,
      canisterId,
    });
  }

  /**
   * Helper method to register agents with the agency workflow
   * This ensures agents are registered before they can be used in workflows
   */
  private async registerAgentsIfNeeded(
    agentCanisterIds: string[],
    agencyActor: AgencyWorkflowActor,
    identity: Identity
  ): Promise<void> {
    // Filter out empty or invalid canister IDs
    const validCanisterIds = agentCanisterIds.filter(id => 
      id && id.trim() !== '' && id.trim() !== 'aaaaa-aa'
    );
    
    if (validCanisterIds.length === 0) {
      console.warn('⚠️ [AgencyService] No valid agent canister IDs to register');
      return;
    }
    
    const uniqueAgentCanisterIds = [...new Set(validCanisterIds)];
    
    console.log(`📝 Checking registration for ${uniqueAgentCanisterIds.length} unique agents...`);
    
    for (const agentCanisterId of uniqueAgentCanisterIds) {
      try {
        // Check if agent is already registered
        const registeredAgents = await agencyActor.getRegisteredAgents();
        const isAlreadyRegistered = registeredAgents.some(
          ([canisterId]) => canisterId.toText() === agentCanisterId
        );
        
        if (isAlreadyRegistered) {
          console.log(`✅ Agent ${agentCanisterId} is already registered`);
          continue;
        }
        
        console.log(`📝 Registering new agent: ${agentCanisterId}...`);
        
        // Fetch agent identity from the agent canister
        const agentActor = await this.createAgentActor(agentCanisterId, identity);
        const agentIdentityResult = await agentActor.getAgentIdentity();
        
        // Convert optional result
        const agentIdentity = Array.isArray(agentIdentityResult) && agentIdentityResult.length > 0
          ? agentIdentityResult[0]
          : null;
        
        if (!agentIdentity) {
          console.warn(`⚠️ Could not get agent identity for ${agentCanisterId}, skipping registration`);
          continue;
        }
        
        // Convert AgentIdentity to AgentConfig
        const agentConfig: AgentConfig = {
          name: agentIdentity.name,
          description: agentIdentity.description,
          instructions: agentIdentity.instructions,
          mcpClientEndpoint: agentIdentity.mcpClientEndpoint,
          claudeApiKey: agentIdentity.claudeApiKey,
          defaultMcpServers: agentIdentity.defaultMcpServers,
          mcpTokens: agentIdentity.mcpTokens,
          requireApproval: agentIdentity.requireApproval,
          confidenceThreshold: agentIdentity.confidenceThreshold,
          maxTokens: typeof agentIdentity.maxTokens === 'bigint' ? agentIdentity.maxTokens : BigInt(agentIdentity.maxTokens),
          temperature: (agentIdentity as any).temperature || 0.7,
        };
        
        // Register the agent
        const registerResult = await agencyActor.registerAgent(Principal.fromText(agentCanisterId), agentConfig);
        
        if ('ok' in registerResult) {
          console.log(`✅ Registered agent ${agentCanisterId} with agency workflow`);
        } else {
          console.warn(`⚠️ Failed to register agent ${agentCanisterId}: ${registerResult.err}`);
          // Continue anyway - the backend might handle this gracefully
        }
      } catch (error) {
        console.warn(`⚠️ Error registering agent ${agentCanisterId}:`, error);
        // Continue with other agents
      }
    }
  }

  private async createAgencyActor(
    canisterId: string,
    identity: Identity
  ): Promise<AgencyWorkflowActor> {
    try {
      console.log(`🎭 Creating agency actor for canister: ${canisterId}`);
      
      // Create agent (same pattern as AgentManagementInterface)
      const agent = new HttpAgent({ 
        identity, 
        host: process.env.NODE_ENV === 'production' ? 'https://icp0.io' : 'http://localhost:4943'
      });
      
      if (process.env.NODE_ENV !== 'production') {
        await agent.fetchRootKey();
      }
      
      // Create actor with proper Candid IDL
      const actor = Actor.createActor<AgencyWorkflowActor>(agencyIdlFactory, {
        agent,
        canisterId,
      });
      
      console.log(`✅ Agency actor created successfully for canister: ${canisterId}`);
      return actor;
    } catch (error) {
      console.error('Failed to create agency actor:', error);
      throw error;
    }
  }

  /**
   * Get the AgencyWorkflow canister actor for a project
   * (Now uses server pairs instead of user canister methods)
   */
  /**
   * Helper to check if error is due to agency workflow not being initialized
   */
  private isAgencyWorkflowNotInitialized(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.includes('no query method') ||
      errorMessage.includes('no update method') ||
      errorMessage.includes('method-not-found') ||
      errorMessage.includes('getAgencies') ||
      errorMessage.includes('getAllExecutions') ||
      errorMessage.includes('getAgencyExecutions') ||
      errorMessage.includes('getExecution') ||
      errorMessage.includes('getRecentActivity') ||
      errorMessage.includes('getActiveErrors') ||
      errorMessage.includes('getPendingApprovals')
    );
  }

  /**
   * Helper to format agency workflow initialization error message
   */
  private getAgencyWorkflowError(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorMessage;
  }

  private async getAgencyActor(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<AgencyWorkflowActor> {
    try {
      console.log(`🎭 Getting agency actor for project: ${projectId}`);
      
      // Load server pairs for the project
      const serverPairs = await this.getProjectServerPairs(projectId, userCanisterId, identity);
      if (serverPairs.length === 0) {
        throw new Error('No server pairs available for project');
      }

      // Get the selected server pair
      const selectedServerPair = await this.getSelectedServerPair(projectId, serverPairs);
      if (!selectedServerPair) {
        throw new Error('No valid server pair selected');
      }

      console.log(`🎯 Using agency workflow canister ID: ${selectedServerPair.backendCanisterId}`);
      console.log(`📝 Server Pair: ${selectedServerPair.name} (${selectedServerPair.pairId})`);
      console.log(`🔒 INDEPENDENT DEPLOYMENT: Agency workflow uses its own dedicated server pair`);
      console.log(`📝 This canister should have query methods: getAgencies(), getAllExecutions(), etc.`);

      // Create and return the agency actor
      const actor = await this.createAgencyActor(selectedServerPair.backendCanisterId, identity);
      
      console.log(`✅ Agency actor created successfully for canister: ${selectedServerPair.backendCanisterId}`);
      return actor;
    } catch (error) {
      console.error('❌ Failed to get agency actor:', error);
      throw error;
    }
  }
  
  /**
   * Convert frontend AgentStep to Candid AgentStep
   */
  private toCanisterAgentStep(step: AgentStep): CandidAgentStep {
    // NEW: Handle stepTarget (nested workflows or agents)
    let stepTarget: any = undefined;
    let agentCanisterId: Principal;
    
    if (step.stepTarget) {
      // Use stepTarget if provided (new format)
      if ('agency' in step.stepTarget) {
        // Nested workflow
        stepTarget = {
          agency: {
            agencyId: step.stepTarget.agency.agencyId,
            inputMapping: step.stepTarget.agency.inputMapping
          }
        };
        // Use placeholder for backward compatibility
        agentCanisterId = Principal.fromText('2vxsx-fae');
      } else if ('agent' in step.stepTarget) {
        // Regular agent
        stepTarget = {
          agent: {
            agentCanisterId: Principal.fromText(step.stepTarget.agent.agentCanisterId),
            agentConfig: step.stepTarget.agent.agentConfig ? [step.stepTarget.agent.agentConfig] : []
          }
        };
        agentCanisterId = Principal.fromText(step.stepTarget.agent.agentCanisterId);
      } else {
        throw new Error(`Invalid stepTarget format for step "${step.agentName}"`);
      }
    } else {
      // Backward compatibility: use agentCanisterId
    if (!step.agentCanisterId || step.agentCanisterId.trim() === '') {
      throw new Error(`Agent step "${step.agentName}" has an empty canister ID. Please configure a valid agent canister ID.`);
      }
      try {
        agentCanisterId = Principal.fromText(step.agentCanisterId);
      } catch (error) {
        if (error instanceof Error && error.message.includes('checksum')) {
          throw new Error(`Invalid canister ID for agent "${step.agentName}": "${step.agentCanisterId}". Please provide a valid Principal ID.`);
        }
        throw error;
      }
    }
    
    // NEW: Convert loopConfig to Candid format
    let loopConfig: any = undefined;
    if (step.loopConfig) {
      if ('forEach' in step.loopConfig) {
        loopConfig = {
          forEach: {
            arraySource: step.loopConfig.forEach.arraySource,
            itemVariable: step.loopConfig.forEach.itemVariable,
            indexVariable: step.loopConfig.forEach.indexVariable,
            maxIterations: step.loopConfig.forEach.maxIterations ? [BigInt(step.loopConfig.forEach.maxIterations)] : []
          }
        };
      } else if ('whileLoop' in step.loopConfig) {
        loopConfig = {
          whileLoop: {
            condition: step.loopConfig.whileLoop.condition,
            maxIterations: step.loopConfig.whileLoop.maxIterations ? [BigInt(step.loopConfig.whileLoop.maxIterations)] : []
          }
        };
      } else if ('repeat' in step.loopConfig) {
        loopConfig = {
          repeat: {
            count: BigInt(step.loopConfig.repeat.count),
            indexVariable: step.loopConfig.repeat.indexVariable ? [step.loopConfig.repeat.indexVariable] : []
          }
        };
      }
      // 'none' is handled by undefined loopConfig
    }
    
    try {
      return {
        agentCanisterId: agentCanisterId, // Keep for backward compatibility
        agentName: step.agentName,
        inputTemplate: step.inputTemplate,
        agentConfig: [],
        triggerConfig: step.triggerConfig ? [step.triggerConfig] : [],
        requiresApproval: step.requiresApproval || false,
        retryOnFailure: step.retryOnFailure || false,
        timeout: step.timeout ? [BigInt(step.timeout)] : [],
        // NEW: Add stepTarget and loopConfig
        stepTarget: stepTarget ? [stepTarget] : [],
        loopConfig: loopConfig ? [loopConfig] : []
      } as any; // Type assertion needed because Candid types may not be fully updated yet
    } catch (error) {
      if (error instanceof Error && error.message.includes('checksum')) {
        throw new Error(`Invalid canister ID for agent "${step.agentName}": "${step.agentCanisterId}". Please provide a valid Principal ID.`);
      }
      throw error;
    }
  }
  
  /**
   * Convert Candid AgentStep to frontend AgentStep
   */
  private fromCanisterAgentStep(step: CandidAgentStep): AgentStep {
    // NEW: Handle stepTarget and loopConfig from backend
    let stepTarget: StepTarget | undefined = undefined;
    let agentCanisterId = step.agentCanisterId.toText();
    
    // Check if stepTarget exists (new format)
    if ((step as any).stepTarget && (step as any).stepTarget.length > 0) {
      const target = (step as any).stepTarget[0];
      if (target.agency) {
        stepTarget = {
          agency: {
            agencyId: target.agency.agencyId,
            inputMapping: target.agency.inputMapping
          }
        };
      } else if (target.agent) {
        stepTarget = {
          agent: {
            agentCanisterId: target.agent.agentCanisterId.toText(),
            agentConfig: target.agent.agentConfig.length > 0 ? target.agent.agentConfig[0] : undefined
          }
        };
        agentCanisterId = target.agent.agentCanisterId.toText();
      }
    }
    
    // NEW: Convert loopConfig from backend
    let loopConfig: LoopConfig | undefined = undefined;
    if ((step as any).loopConfig && (step as any).loopConfig.length > 0) {
      const loop = (step as any).loopConfig[0];
      if (loop.forEach) {
        loopConfig = {
          forEach: {
            arraySource: loop.forEach.arraySource,
            itemVariable: loop.forEach.itemVariable,
            indexVariable: loop.forEach.indexVariable,
            maxIterations: loop.forEach.maxIterations.length > 0 ? Number(loop.forEach.maxIterations[0]) : undefined
          }
        };
      } else if (loop.whileLoop) {
        loopConfig = {
          whileLoop: {
            condition: loop.whileLoop.condition,
            maxIterations: loop.whileLoop.maxIterations.length > 0 ? Number(loop.whileLoop.maxIterations[0]) : undefined
          }
        };
      } else if (loop.repeat) {
        loopConfig = {
          repeat: {
            count: Number(loop.repeat.count),
            indexVariable: loop.repeat.indexVariable.length > 0 ? loop.repeat.indexVariable[0] : undefined
          }
        };
      }
    }
    
    return {
      agentCanisterId: agentCanisterId,
      agentName: step.agentName,
      inputTemplate: step.inputTemplate,
      triggerConfig: step.triggerConfig.length > 0 ? step.triggerConfig[0] : undefined,
      requiresApproval: step.requiresApproval,
      retryOnFailure: step.retryOnFailure,
      timeout: step.timeout.length > 0 ? Number(step.timeout[0]) : undefined,
      // NEW: Include stepTarget and loopConfig
      stepTarget: stepTarget,
      loopConfig: loopConfig
    };
  }
  
  /**
   * Convert Candid ExecutionStatus to string
   */
  private fromCanisterExecutionStatus(status: ExecutionStatus): 'pending' | 'running' | 'completed' | 'failed' | 'triggered' | 'scheduled' | 'waiting_approval' | 'paused' {
    if ('pending' in status) return 'pending';
    if ('running' in status) return 'running';
    if ('completed' in status) return 'completed';
    if ('failed' in status) return 'failed';
    if ('triggered' in status) return 'triggered';
    if ('scheduled' in status) return 'scheduled';
    if ('waiting_approval' in status) return 'waiting_approval';
    if ('paused' in status) return 'paused';
    return 'failed'; // default fallback
  }
  
  /**
   * Convert frontend ConnectionCondition to Candid ConnectionCondition
   */
  private toCanisterConnectionCondition(condition: ConnectionCondition): any {
    if (condition.onSuccess !== undefined) {
      return { onSuccess: null };
    }
    if (condition.onFailure !== undefined) {
      return { onFailure: null };
    }
    if (condition.always !== undefined) {
      return { always: null };
    }
    if (condition.ifContains) {
      return { ifContains: { field: condition.ifContains.field, value: condition.ifContains.value } };
    }
    if (condition.ifEquals) {
      return { ifEquals: { field: condition.ifEquals.field, value: condition.ifEquals.value } };
    }
    // Default to always
    return { always: null };
  }

  /**
   * Convert Candid ConnectionCondition to frontend ConnectionCondition
   */
  private fromCanisterConnectionCondition(condition: any): ConnectionCondition {
    if ('onSuccess' in condition) {
      return { onSuccess: null };
    }
    if ('onFailure' in condition) {
      return { onFailure: null };
    }
    if ('always' in condition) {
      return { always: null };
    }
    if ('ifContains' in condition) {
      return { ifContains: { field: condition.ifContains.field, value: condition.ifContains.value } };
    }
    if ('ifEquals' in condition) {
      return { ifEquals: { field: condition.ifEquals.field, value: condition.ifEquals.value } };
    }
    // Default to always
    return { always: null };
  }

  /**
   * Convert frontend AgentConnection to Candid AgentConnection
   */
  private toCanisterConnection(connection: AgentConnection): any {
    return {
      sourceStepIndex: BigInt(connection.sourceStepIndex),
      targetStepIndex: BigInt(connection.targetStepIndex),
      condition: this.toCanisterConnectionCondition(connection.condition),
    };
  }

  /**
   * Convert Candid AgentConnection to frontend AgentConnection
   */
  private fromCanisterConnection(connection: any): AgentConnection {
    return {
      sourceStepIndex: Number(connection.sourceStepIndex),
      targetStepIndex: Number(connection.targetStepIndex),
      condition: this.fromCanisterConnectionCondition(connection.condition),
    };
  }

  /**
   * Convert Candid Agency to frontend Agency
   */
  private fromCanisterAgency(agency: any): Agency {
    return {
      id: agency.id,
      name: agency.name,
      description: agency.description,
      steps: agency.steps.map((step: any) => this.fromCanisterAgentStep(step)),
      connections: agency.connections ? agency.connections.map((conn: any) => this.fromCanisterConnection(conn)) : [], // NEW: Include connections
      created: Number(agency.created) / 1_000_000,
      updated: Number(agency.updated) / 1_000_000,
      triggerEnabled: agency.triggerEnabled,
      globalTriggers: agency.globalTriggers || [],
      owner: agency.owner.toText(),
      executionMode: agency.executionMode || 'sequential',
      maxConcurrentExecutions: Number(agency.maxConcurrentExecutions) || 1,
      defaultTimeout: Number(agency.defaultTimeout) || 300,
      enabled: agency.enabled !== undefined ? agency.enabled : true,
    };
  }
  
  /**
   * Convert Candid Execution to frontend Execution
   */
  private fromCanisterExecution(execution: any): Execution {
    return {
      id: execution.id,
      agencyId: execution.agencyId,
      agencyName: execution.agencyName,
      input: execution.input,
      status: this.fromCanisterExecutionStatus(execution.status),
      currentStep: Number(execution.currentStep),
      results: execution.results.map((result: any) => ({
        stepIndex: Number(result.stepIndex),
        agentName: result.agentName,
        input: result.input,
        output: result.output,
        duration: Number(result.duration),
        success: result.success,
        error: result.error.length > 0 ? result.error[0] : undefined,
        triggerUsed: result.triggerUsed.length > 0 ? result.triggerUsed[0] : undefined,
        agentMetrics: result.agentMetrics.length > 0 ? {
          totalTasks: Number(result.agentMetrics[0].totalTasks),
          successfulTasks: Number(result.agentMetrics[0].successfulTasks),
          failedTasks: Number(result.agentMetrics[0].failedTasks),
          successRate: Number(result.agentMetrics[0].successRate),
          avgResponseTime: Number(result.agentMetrics[0].avgResponseTime),
          totalCyclesUsed: Number(result.agentMetrics[0].totalCyclesUsed),
          totalApprovals: Number(result.agentMetrics[0].totalApprovals),
          pendingApprovals: Number(result.agentMetrics[0].pendingApprovals),
          activeErrors: Number(result.agentMetrics[0].activeErrors),
          mcpToolsConfigured: Number(result.agentMetrics[0].mcpToolsConfigured),
        } : undefined,
        retryCount: Number(result.retryCount) || 0,
        approvalRequired: result.approvalRequired || false,
        approvalStatus: result.approvalStatus.length > 0 ? result.approvalStatus[0] : undefined,
      })),
      startTime: Number(execution.startTime) / 1_000_000,
      endTime: execution.endTime.length > 0 ? Number(execution.endTime[0]) / 1_000_000 : undefined,
      error: execution.error.length > 0 ? execution.error[0] : undefined,
      triggerSource: execution.triggerSource.length > 0 ? execution.triggerSource[0] : undefined,
      executionMode: execution.executionMode,
      totalAgents: Number(execution.totalAgents),
      agentFailures: Number(execution.agentFailures),
      cyclesUsed: Number(execution.cyclesUsed) || 0,
      triggeredBy: execution.triggeredBy,
      metadata: execution.metadata || [],
      pausedAt: execution.pausedAt.length > 0 ? Number(execution.pausedAt[0]) / 1_000_000 : undefined,
      resumedAt: execution.resumedAt.length > 0 ? Number(execution.resumedAt[0]) / 1_000_000 : undefined,
    };
  }

  /**
   * Convert Candid ActivityEvent to frontend ActivityEvent
   */
  private fromCanisterActivityEvent(event: any): ActivityEvent {
    return {
      id: event.id,
      timestamp: Number(event.timestamp) / 1_000_000,
      eventType: event.eventType,
      taskId: event.taskId.length > 0 ? event.taskId[0] : undefined,
      details: event.details,
      metadata: event.metadata || [],
      severity: event.severity,
    };
  }

  /**
   * Convert Candid ErrorLog to frontend ErrorLog
   */
  private fromCanisterErrorLog(error: any): ErrorLog {
    return {
      id: error.id,
      timestamp: Number(error.timestamp) / 1_000_000,
      errorType: error.errorType,
      errorMessage: error.errorMessage,
      taskId: error.taskId.length > 0 ? error.taskId[0] : undefined,
      context: error.context,
      stackTrace: error.stackTrace.length > 0 ? error.stackTrace[0] : undefined,
      resolved: error.resolved,
    };
  }

  /**
   * Convert Candid Approval to frontend Approval
   */
  private fromCanisterApproval(approval: any): Approval {
    return {
      id: approval.id,
      taskId: approval.taskId,
      timestamp: Number(approval.timestamp) / 1_000_000,
      action: approval.action,
      reasoning: approval.reasoning,
      confidence: Number(approval.confidence),
      status: approval.status,
      approvedBy: approval.approvedBy.length > 0 ? approval.approvedBy[0].toText() : undefined,
      approvedAt: approval.approvedAt.length > 0 ? Number(approval.approvedAt[0]) / 1_000_000 : undefined,
    };
  }
  
  /**
   * Create a new agency (enhanced with trigger support and connections)
   */
  public async createAgency(
    name: string,
    description: string,
    steps: AgentStep[],
    projectId: string,
    userCanisterId: string,
    identity: Identity,
    connections?: AgentConnection[] // NEW: Optional connections parameter
  ): Promise<{ success: boolean; agencyId?: string; error?: string }> {
    try {
      console.log(`🏢 Creating enhanced agency: ${name} with ${steps.length} steps and ${connections?.length || 0} connections`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access. If the agency workflow was initialized by the independent UI first, you may need to manually add Kontext as a manager.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      // CRITICAL: Filter out steps with empty or invalid canister IDs before processing
      const validSteps = steps.filter(step => {
        const hasValidCanisterId = step.agentCanisterId && 
                                   step.agentCanisterId.trim() !== '' &&
                                   step.agentCanisterId.trim() !== 'aaaaa-aa';
        if (!hasValidCanisterId) {
          console.warn(`⚠️ [AgencyService] Skipping step "${step.agentName}" - missing or invalid canister ID`);
        }
        return hasValidCanisterId;
      });
      
      if (validSteps.length === 0) {
        return {
          success: false,
          error: 'No valid agent steps found. All steps must have valid agent canister IDs configured. Please configure agent canister IDs in the workflow editor before creating the agency.',
        };
      }
      
      if (validSteps.length < steps.length) {
        console.warn(`⚠️ [AgencyService] Filtered out ${steps.length - validSteps.length} steps with invalid canister IDs. Creating agency with ${validSteps.length} valid steps.`);
      }
      
      // CRITICAL: Register all agents before creating the agency
      const agentCanisterIds = validSteps.map(step => step.agentCanisterId);
      await this.registerAgentsIfNeeded(agentCanisterIds, actor, identity);
      
      // Convert steps to canister format
      const canisterSteps = validSteps.map(step => this.toCanisterAgentStep(step));
      
      // Convert connections to canister format (use empty array if not provided)
      const canisterConnections = (connections || []).map(conn => this.toCanisterConnection(conn));
      
      const result = await actor.createAgency(name, description, canisterSteps, canisterConnections);
      
      if ('ok' in result) {
        console.log(`✅ Enhanced agency created successfully: ${result.ok}`);
        return {
          success: true,
          agencyId: result.ok,
        };
      } else {
        console.log(`❌ Agency creation failed: ${result.err}`);
        return {
          success: false,
          error: result.err,
        };
      }
    } catch (error) {
      console.error('Failed to create agency:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Create a scheduled trigger for an agency
   */
  public async createScheduledTrigger(
    request: CreateScheduledTriggerRequest,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; trigger?: TriggerConfig; error?: string }> {
    try {
      console.log(`⏰ Creating scheduled trigger for agency: ${request.agencyId}`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const triggerType: TriggerType = { scheduled: { schedule: request.schedule } };
      
      const result = await actor.createAgencyTrigger(
        request.agencyId,
        request.name,
        request.description,
        triggerType,
        request.inputTemplate,
        request.retryConfig ? [request.retryConfig] : [],
        request.executionLimits ? [request.executionLimits] : []
      );
      
      if ('ok' in result) {
        console.log(`✅ Scheduled trigger created successfully`);
        return {
          success: true,
          trigger: result.ok,
        };
      } else {
        console.log(`❌ Scheduled trigger creation failed: ${result.err}`);
        return {
          success: false,
          error: result.err,
        };
      }
    } catch (error) {
      console.error('Failed to create scheduled trigger:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Create a condition trigger for an agency
   */
  public async createConditionTrigger(
    request: CreateConditionTriggerRequest,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; trigger?: TriggerConfig; error?: string }> {
    try {
      console.log(`🎯 Creating condition trigger for agency: ${request.agencyId}`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const triggerType: TriggerType = { condition: { condition: request.condition } };
      
      const result = await actor.createAgencyTrigger(
        request.agencyId,
        request.name,
        request.description,
        triggerType,
        request.inputTemplate,
        request.retryConfig ? [request.retryConfig] : [],
        request.executionLimits ? [request.executionLimits] : []
      );
      
      if ('ok' in result) {
        console.log(`✅ Condition trigger created successfully`);
        return {
          success: true,
          trigger: result.ok,
        };
      } else {
        console.log(`❌ Condition trigger creation failed: ${result.err}`);
        return {
          success: false,
          error: result.err,
        };
      }
    } catch (error) {
      console.error('Failed to create condition trigger:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Create a webhook trigger for an agency
   */
  public async createWebhookTrigger(
    request: CreateWebhookTriggerRequest,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; trigger?: TriggerConfig; error?: string }> {
    try {
      console.log(`🪝 Creating webhook trigger for agency: ${request.agencyId}`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const triggerType: TriggerType = { 
        webhook: { 
          source: request.source, 
          signature: request.signature ? [request.signature] : [] 
        } 
      };
      
      const result = await actor.createAgencyTrigger(
        request.agencyId,
        request.name,
        request.description,
        triggerType,
        request.inputTemplate,
        request.retryConfig ? [request.retryConfig] : [],
        request.executionLimits ? [request.executionLimits] : []
      );
      
      if ('ok' in result) {
        console.log(`✅ Webhook trigger created successfully`);
        return {
          success: true,
          trigger: result.ok,
        };
      } else {
        console.log(`❌ Webhook trigger creation failed: ${result.err}`);
        return {
          success: false,
          error: result.err,
        };
      }
    } catch (error) {
      console.error('Failed to create webhook trigger:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Get all triggers for an agency
   */
  public async getAgencyTriggers(
    agencyId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; triggers: TriggerConfig[]; error?: string }> {
    try {
      console.log(`📋 Getting triggers for agency: ${agencyId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const triggers = await actor.getAgencyTriggers(agencyId);
      
      console.log(`✅ Retrieved ${triggers.length} triggers for agency ${agencyId}`);
      
      return {
        success: true,
        triggers: triggers,
      };
    } catch (error) {
      console.error('Failed to get agency triggers:', error);
      return {
        success: false,
        triggers: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Update a trigger
   */
  public async updateAgencyTrigger(
    agencyId: string,
    triggerId: string,
    name?: string,
    description?: string,
    enabled?: boolean,
    inputTemplate?: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`✏️ Updating trigger: ${triggerId} for agency: ${agencyId}`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.updateAgencyTrigger(
        agencyId,
        triggerId,
        name ? [name] : [],
        description ? [description] : [],
        enabled !== undefined ? [enabled] : [],
        inputTemplate ? [inputTemplate] : []
      );
      
      if ('ok' in result) {
        console.log(`✅ Trigger updated successfully: ${triggerId}`);
        return { success: true };
      } else {
        console.log(`❌ Trigger update failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to update trigger:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Delete a trigger
   */
  public async deleteAgencyTrigger(
    agencyId: string,
    triggerId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🗑️ Deleting trigger: ${triggerId} from agency: ${agencyId}`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.deleteAgencyTrigger(agencyId, triggerId);
      
      if ('ok' in result) {
        console.log(`✅ Trigger deleted successfully: ${triggerId}`);
        return { success: true };
      } else {
        console.log(`❌ Trigger deletion failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to delete trigger:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Toggle trigger enabled/disabled
   */
  public async toggleAgencyTrigger(
    agencyId: string,
    triggerId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; enabled?: boolean; error?: string }> {
    try {
      console.log(`🔄 Toggling trigger: ${triggerId} for agency: ${agencyId}`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.toggleAgencyTrigger(agencyId, triggerId);
      
      if ('ok' in result) {
        const enabled = result.ok === 'enabled';
        console.log(`✅ Trigger ${enabled ? 'enabled' : 'disabled'}: ${triggerId}`);
        return { success: true, enabled };
      } else {
        console.log(`❌ Trigger toggle failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to toggle trigger:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Execute a trigger manually
   */
  public async executeAgencyTrigger(
    agencyId: string,
    triggerId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    try {
      console.log(`▶️ Manually executing trigger: ${triggerId} for agency: ${agencyId}`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.executeAgencyTrigger(agencyId, triggerId);
      
      if ('ok' in result) {
        console.log(`✅ Trigger executed successfully: ${result.ok}`);
        return { success: true, executionId: result.ok };
      } else {
        console.log(`❌ Trigger execution failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to execute trigger:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Get trigger execution history
   */
  public async getTriggerHistory(
    agencyId: string,
    triggerId: string,
    limit: number,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; executions: Execution[]; error?: string }> {
    try {
      console.log(`📋 Getting trigger history: ${triggerId} for agency: ${agencyId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const executions = await actor.getTriggerHistory(agencyId, triggerId, BigInt(limit));
      
      const converted = executions.map(exec => this.fromCanisterExecution(exec));
      
      console.log(`✅ Retrieved ${converted.length} trigger executions`);
      
      return {
        success: true,
        executions: converted,
      };
    } catch (error) {
      console.error('Failed to get trigger history:', error);
      return {
        success: false,
        executions: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Get agency metrics
   */
  public async getAgencyMetrics(
    agencyId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; metrics?: any; error?: string }> {
    try {
      console.log(`📊 Getting metrics for agency: ${agencyId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const metricsOpt = await actor.getAgencyMetrics(agencyId);
      
      if (metricsOpt.length === 0) {
        return {
          success: false,
          error: 'No metrics available for agency',
        };
      }
      
      const metrics = {
        totalExecutions: Number(metricsOpt[0].totalExecutions),
        successfulExecutions: Number(metricsOpt[0].successfulExecutions),
        failedExecutions: Number(metricsOpt[0].failedExecutions),
        averageExecutionTime: Number(metricsOpt[0].averageExecutionTime),
        totalCyclesUsed: Number(metricsOpt[0].totalCyclesUsed),
        activeAgents: Number(metricsOpt[0].activeAgents),
        triggersConfigured: Number(metricsOpt[0].triggersConfigured),
        pendingApprovals: Number(metricsOpt[0].pendingApprovals),
        executionSuccessRate: Number(metricsOpt[0].executionSuccessRate),
        lastExecutionAt: metricsOpt[0].lastExecutionAt.length > 0 ? Number(metricsOpt[0].lastExecutionAt[0]) / 1_000_000 : undefined,
      };
      
      console.log(`✅ Retrieved metrics for agency ${agencyId}:`, metrics);
      
      return {
        success: true,
        metrics,
      };
    } catch (error) {
      console.error('Failed to get agency metrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Register an agent with the agency workflow
   */
  public async registerAgent(
    agentCanisterId: string,
    agentConfig: AgentConfig,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`📝 Registering agent: ${agentCanisterId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.registerAgent(Principal.fromText(agentCanisterId), agentConfig);
      
      if ('ok' in result) {
        console.log(`✅ Agent registered successfully: ${result.ok}`);
        return { success: true, message: result.ok };
      } else {
        console.log(`❌ Agent registration failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to register agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Unregister an agent from the agency workflow
   */
  public async unregisterAgent(
    agentCanisterId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🗑️ Unregistering agent: ${agentCanisterId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.unregisterAgent(Principal.fromText(agentCanisterId));
      
      if ('ok' in result) {
        console.log(`✅ Agent unregistered successfully`);
        return { success: true };
      } else {
        console.log(`❌ Agent unregistration failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to unregister agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Get all registered agents
   */
  public async getRegisteredAgents(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; agents: Array<{ canisterId: string; identity: AgentIdentity }>; error?: string }> {
    try {
      console.log(`📋 Getting registered agents`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const registeredAgents = await actor.getRegisteredAgents();
      
      const converted = registeredAgents.map(([canisterId, agentIdentity]) => ({
        canisterId: canisterId.toText(),
        identity: {
          ...agentIdentity,
          createdAt: Number(agentIdentity.createdAt) / 1_000_000,
          maxTokens: Number(agentIdentity.maxTokens),
          owner: agentIdentity.owner.toText(),
        }
      }));
      
      console.log(`✅ Retrieved ${converted.length} registered agents`);
      
      return {
        success: true,
        agents: converted,
      };
    } catch (error) {
      console.error('Failed to get registered agents:', error);
      return {
        success: false,
        agents: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Get health status of an agent canister
   */
  public async getAgentHealth(
    agentCanisterId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; health?: string; error?: string }> {
    try {
      console.log(`🏥 Checking health of agent: ${agentCanisterId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const health = await actor.getAgentHealth(Principal.fromText(agentCanisterId));
      
      console.log(`✅ Agent health: ${health}`);
      
      return {
        success: true,
        health,
      };
    } catch (error) {
      console.error('Failed to check agent health:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Pause execution
   */
  public async pauseExecution(
    executionId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`⏸️ Pausing execution: ${executionId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.pauseExecution(executionId);
      
      if ('ok' in result) {
        console.log(`✅ Execution paused successfully: ${executionId}`);
        return { success: true };
      } else {
        console.log(`❌ Execution pause failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to pause execution:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Resume execution
   */
  public async resumeExecution(
    executionId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`▶️ Resuming execution: ${executionId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.resumeExecution(executionId);
      
      if ('ok' in result) {
        console.log(`✅ Execution resumed successfully: ${executionId}`);
        return { success: true };
      } else {
        console.log(`❌ Execution resume failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to resume execution:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Cancel execution
   */
  public async cancelExecution(
    executionId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`❌ Cancelling execution: ${executionId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.cancelExecution(executionId);
      
      if ('ok' in result) {
        console.log(`✅ Execution cancelled successfully: ${executionId}`);
        return { success: true };
      } else {
        console.log(`❌ Execution cancellation failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to cancel execution:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Retry failed step
   */
  public async retryFailedStep(
    executionId: string,
    stepIndex: number,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`🔄 Retrying failed step: ${stepIndex} in execution: ${executionId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.retryFailedStep(executionId, BigInt(stepIndex));
      
      if ('ok' in result) {
        console.log(`✅ Step retry initiated: ${result.ok}`);
        return { success: true, message: result.ok };
      } else {
        console.log(`❌ Step retry failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to retry step:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Get recent activity
   */
  public async getRecentActivity(
    limit: number,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; activities: ActivityEvent[]; error?: string }> {
    try {
      console.log(`📋 Getting recent activity (limit: ${limit})`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const activities = await actor.getRecentActivity(BigInt(limit));
      
      const converted = activities.map(activity => this.fromCanisterActivityEvent(activity));
      
      console.log(`✅ Retrieved ${converted.length} activity events`);
      
      return {
        success: true,
        activities: converted,
      };
    } catch (error) {
      console.error('Failed to get recent activity:', error);
      return {
        success: false,
        activities: [],
        error: this.getAgencyWorkflowError(error),
      };
    }
  }

  /**
   * NEW: Get active errors
   */
  public async getActiveErrors(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; errors: ErrorLog[]; error?: string }> {
    try {
      console.log(`🚨 Getting active errors`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const errors = await actor.getActiveErrors();
      
      const converted = errors.map(error => this.fromCanisterErrorLog(error));
      
      console.log(`✅ Retrieved ${converted.length} active errors`);
      
      return {
        success: true,
        errors: converted,
      };
    } catch (error) {
      console.error('Failed to get active errors:', error);
      return {
        success: false,
        errors: [],
        error: this.getAgencyWorkflowError(error),
      };
    }
  }

  /**
   * NEW: Get pending approvals
   */
  public async getPendingApprovals(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; approvals: Approval[]; error?: string }> {
    try {
      console.log(`👤 Getting pending approvals`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const approvals = await actor.getPendingApprovals();
      
      const converted = approvals.map(approval => this.fromCanisterApproval(approval));
      
      console.log(`✅ Retrieved ${converted.length} pending approvals`);
      
      return {
        success: true,
        approvals: converted,
      };
    } catch (error) {
      console.error('Failed to get pending approvals:', error);
      return {
        success: false,
        approvals: [],
        error: this.getAgencyWorkflowError(error),
      };
    }
  }

  /**
   * NEW: Process approval
   */
  public async processApproval(
    approvalId: string,
    approved: boolean,
    reason?: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`✅ Processing approval: ${approvalId} (${approved ? 'approved' : 'rejected'})`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.processApproval(approvalId, approved, reason ? [reason] : []);
      
      if ('ok' in result) {
        console.log(`✅ Approval processed successfully: ${result.ok}`);
        return { success: true, message: result.ok };
      } else {
        console.log(`❌ Approval processing failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to process approval:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Toggle agency enabled/disabled
   */
  public async toggleAgency(
    agencyId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; enabled?: boolean; error?: string }> {
    try {
      console.log(`🔄 Toggling agency: ${agencyId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.toggleAgency(agencyId);
      
      if ('ok' in result) {
        console.log(`✅ Agency ${result.ok ? 'enabled' : 'disabled'}: ${agencyId}`);
        return { success: true, enabled: result.ok };
      } else {
        console.log(`❌ Agency toggle failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to toggle agency:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ===== EXISTING METHODS =====
  
  /**
   * Get all agencies for a project
   */
  public async getAgencies(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; agencies: Agency[]; error?: string }> {
    try {
      console.log(`📋 Getting enhanced agencies for project: ${projectId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      // Log the canister ID being used (extract from actor if possible)
      console.log(`🔍 Calling getAgencies() as query method on agency workflow canister`);
      
      // Call the query method - should automatically use query call based on IDL
      const agencies = await actor.getAgencies();
      
      // Convert from canister format
      const converted: Agency[] = agencies.map(agency => this.fromCanisterAgency(agency));
      
      console.log(`✅ Retrieved ${converted.length} enhanced agencies`);
      
      return {
        success: true,
        agencies: converted,
      };
    } catch (error) {
      console.error('❌ Failed to get agencies:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error details: ${errorMsg}`);
      return {
        success: false,
        agencies: [],
        error: errorMsg,
      };
    }
  }
  
  /**
   * Get a specific agency by ID
   */
  public async getAgency(
    agencyId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; agency?: Agency; error?: string }> {
    try {
      console.log(`📋 Getting enhanced agency: ${agencyId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const agencyOpt = await actor.getAgency(agencyId);
      
      if (agencyOpt.length === 0) {
        return {
          success: false,
          error: 'Agency not found',
        };
      }
      
      const agency = this.fromCanisterAgency(agencyOpt[0]);
      
      console.log(`✅ Retrieved enhanced agency: ${agency.name} (triggers: ${agency.globalTriggers.length})`);
      
      return {
        success: true,
        agency,
      };
    } catch (error) {
      console.error('Failed to get agency:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Update an existing agency (enhanced with connections)
   */
  public async updateAgency(
    agencyId: string,
    name: string,
    description: string,
    steps: AgentStep[],
    projectId: string,
    userCanisterId: string,
    identity: Identity,
    connections?: AgentConnection[] // NEW: Optional connections parameter
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`✏️ Updating enhanced agency: ${agencyId} with ${connections?.length || 0} connections`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const canisterSteps = steps.map(step => this.toCanisterAgentStep(step));
      
      // Convert connections to canister format (use empty array if not provided)
      const canisterConnections = (connections || []).map(conn => this.toCanisterConnection(conn));
      
      const result = await actor.updateAgency(agencyId, name, description, canisterSteps, canisterConnections);
      
      if ('ok' in result) {
        console.log(`✅ Enhanced agency updated successfully: ${agencyId}`);
        return { success: true };
      } else {
        console.log(`❌ Agency update failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to update agency:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Delete an agency
   */
  public async deleteAgency(
    agencyId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🗑️ Deleting enhanced agency: ${agencyId}`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.deleteAgency(agencyId);
      
      if ('ok' in result) {
        console.log(`✅ Enhanced agency deleted successfully: ${agencyId}`);
        return { success: true };
      } else {
        console.log(`❌ Agency deletion failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to delete agency:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Execute an agency (supports both manual and trigger-based execution)
   */
  public async executeAgency(
    agencyId: string,
    input: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    try {
      console.log(`▶️ Executing enhanced agency: ${agencyId}`);
      
      // Ensure Kontext has management access
      const authCheck = await this.ensureKontextManagement(projectId, userCanisterId, identity);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: `Unauthorized: ${authCheck.error || 'Kontext does not have management access.'}`
        };
      }
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      // CRITICAL: Register all agents before executing (in case new agents were added after agency creation)
      // Get the agency to see what agents it uses
      try {
        const agencyResult = await actor.getAgency(agencyId);
        if (Array.isArray(agencyResult) && agencyResult.length > 0) {
          const agency = agencyResult[0];
          const agentCanisterIds = agency.steps.map((step: any) => step.agentCanisterId.toText());
          console.log(`📝 Ensuring ${agentCanisterIds.length} agents are registered before execution...`);
          await this.registerAgentsIfNeeded(agentCanisterIds, actor, identity);
        } else {
          console.warn(`⚠️ Could not fetch agency ${agencyId} - agency not found`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch agency ${agencyId} to check agents:`, error);
        // Continue with execution anyway - registration might not be critical if agents are already registered
      }
      
      const result = await actor.executeAgency(agencyId, input);
      
      if ('ok' in result) {
        console.log(`✅ Enhanced agency execution started: ${result.ok}`);
        return {
          success: true,
          executionId: result.ok,
        };
      } else {
        console.log(`❌ Agency execution failed: ${result.err}`);
        return {
          success: false,
          error: result.err,
        };
      }
    } catch (error) {
      console.error('Failed to execute agency:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Get execution status (enhanced with trigger and agent metrics)
   */
  public async getExecutionStatus(
    executionId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; execution?: Execution; error?: string }> {
    try {
      console.log(`📊 Getting enhanced execution status: ${executionId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const executionOpt = await actor.getExecution(executionId);
      
      if (executionOpt.length === 0) {
        return {
          success: false,
          error: 'Execution not found',
        };
      }
      
      const execution = this.fromCanisterExecution(executionOpt[0]);
      
      console.log(`📈 Enhanced execution status: ${execution.status} (step ${execution.currentStep}, mode: ${execution.executionMode})`);
      
      return {
        success: true,
        execution,
      };
    } catch (error) {
      console.error('Failed to get execution status:', error);
      return {
        success: false,
        error: this.getAgencyWorkflowError(error),
      };
    }
  }

  /**
   * Get all executions for a specific agency
   */
  public async getAgencyExecutions(
    agencyId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; executions: Execution[]; error?: string }> {
    try {
      console.log(`📋 Getting enhanced executions for agency: ${agencyId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const executions = await actor.getAgencyExecutions(agencyId);
      
      // Convert from canister format
      const converted = executions.map(exec => this.fromCanisterExecution(exec));
      
      console.log(`✅ Retrieved ${converted.length} enhanced executions for agency ${agencyId}`);
      
      return {
        success: true,
        executions: converted,
      };
    } catch (error) {
      console.error('Failed to get agency executions:', error);
      return {
        success: false,
        executions: [],
        error: this.getAgencyWorkflowError(error),
      };
    }
  }

  /**
   * Get all executions across all agencies (enhanced)
   */
  public async getAllExecutions(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; executions: Execution[]; error?: string }> {
    try {
      console.log(`📋 Getting all enhanced executions for project: ${projectId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      // Log the canister ID being used
      console.log(`🔍 Calling getAllExecutions() as query method on agency workflow canister`);
      
      // Call the query method - should automatically use query call based on IDL
      const executions = await actor.getAllExecutions();
      
      // Convert from canister format
      const converted = executions.map(exec => this.fromCanisterExecution(exec));
      
      console.log(`✅ Retrieved ${converted.length} total enhanced executions`);
      
      return {
        success: true,
        executions: converted,
      };
    } catch (error) {
      console.error('❌ Failed to get all executions:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error details: ${errorMsg}`);
      return {
        success: false,
        executions: [],
        error: errorMsg,
      };
    }
  }

  /**
   * Get agency canister health status
   */
  public async getAgencyCanisterHealth(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; health?: string; error?: string }> {
    try {
      console.log(`🏥 Checking enhanced agency canister health for project: ${projectId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const health = await actor.health();
      
      console.log(`✅ Enhanced agency canister health: ${health}`);
      
      return {
        success: true,
        health,
      };
    } catch (error) {
      console.error('Failed to check agency canister health:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get agency canister status and statistics (enhanced)
   */
  public async getAgencyCanisterStatus(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ 
    success: boolean; 
    status?: {
      initialized: boolean;
      initializedAt: number;
      owner: string;
      agencyCount: number;
      executionCount: number;
      triggerCount: number;
      scheduledExecutions: number;
      registeredAgents: number;
      activeExecutions: number;
      totalCyclesUsed: number;
    }; 
    error?: string;
  }> {
    try {
      console.log(`📊 Getting enhanced agency canister status for project: ${projectId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const status = await actor.getStatus();
      
      const convertedStatus = {
        initialized: status.initialized,
        initializedAt: Number(status.initializedAt) / 1_000_000,
        owner: status.owner.toText(),
        agencyCount: Number(status.agencyCount),
        executionCount: Number(status.executionCount),
        triggerCount: Number(status.triggerCount),
        scheduledExecutions: Number(status.scheduledExecutions),
        registeredAgents: Number(status.registeredAgents),
        activeExecutions: Number(status.activeExecutions),
        totalCyclesUsed: Number(status.totalCyclesUsed),
      };
      
      console.log(`✅ Enhanced agency canister status:`, convertedStatus);
      
      return {
        success: true,
        status: convertedStatus,
      };
    } catch (error) {
      console.error('Failed to get agency canister status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the owner of the agency canister
   */
  public async getAgencyCanisterOwner(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; owner?: string; error?: string }> {
    try {
      console.log(`👤 Getting enhanced agency canister owner for project: ${projectId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const owner = await actor.getOwner();
      
      console.log(`✅ Enhanced agency canister owner: ${owner.toText()}`);
      
      return {
        success: true,
        owner: owner.toText(),
      };
    } catch (error) {
      console.error('Failed to get agency canister owner:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Resolve an error
   */
  public async resolveError(
    errorId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`✅ Resolving error: ${errorId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.resolveError(errorId);
      
      if ('ok' in result) {
        console.log(`✅ Error resolved successfully`);
        return { success: true };
      } else {
        console.log(`❌ Error resolution failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to resolve error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Cleanup old executions
   */
  public async cleanupOldExecutions(
    maxAge: number,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`🧹 Cleaning up executions older than ${maxAge} seconds`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.cleanupOldExecutions(BigInt(maxAge));
      
      if ('ok' in result) {
        console.log(`✅ Cleanup completed: ${result.ok}`);
        return { success: true, message: result.ok };
      } else {
        console.log(`❌ Cleanup failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to cleanup old executions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Register a webhook
   */
  public async registerWebhook(
    name: string,
    source: string,
    signature: string | undefined,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; triggerId?: string; error?: string }> {
    try {
      console.log(`🪝 Registering webhook: ${name}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.registerWebhook(name, source, signature ? [signature] : []);
      
      if ('ok' in result) {
        console.log(`✅ Webhook registered: ${result.ok}`);
        return { success: true, triggerId: result.ok };
      } else {
        console.log(`❌ Webhook registration failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to register webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Unregister a webhook
   */
  public async unregisterWebhook(
    triggerId: string,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🗑️ Unregistering webhook: ${triggerId}`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.unregisterWebhook(triggerId);
      
      if ('ok' in result) {
        console.log(`✅ Webhook unregistered successfully`);
        return { success: true };
      } else {
        console.log(`❌ Webhook unregistration failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to unregister webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Get all webhooks
   */
  public async getWebhooks(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; webhooks: Array<{ triggerId: string; config: TriggerConfig }>; error?: string }> {
    try {
      console.log(`📋 Getting webhooks`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const webhooks = await actor.getWebhooks();
      
      const converted = webhooks.map(([triggerId, config]) => ({
        triggerId,
        config: this.fromCanisterTriggerConfig(config)
      }));
      
      console.log(`✅ Retrieved ${converted.length} webhooks`);
      
      return {
        success: true,
        webhooks: converted,
      };
    } catch (error) {
      console.error('Failed to get webhooks:', error);
      return {
        success: false,
        webhooks: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Process event queue
   */
  public async processEventQueue(
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`🔄 Processing event queue`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const result = await actor.processEventQueue();
      
      if ('ok' in result) {
        console.log(`✅ Event queue processed: ${result.ok}`);
        return { success: true, message: result.ok };
      } else {
        console.log(`❌ Event queue processing failed: ${result.err}`);
        return { success: false, error: result.err };
      }
    } catch (error) {
      console.error('Failed to process event queue:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NEW: Get approval history
   */
  public async getApprovalHistory(
    limit: number,
    projectId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<{ success: boolean; approvals: Approval[]; error?: string }> {
    try {
      console.log(`📋 Getting approval history (limit: ${limit})`);
      
      const actor = await this.getAgencyActor(projectId, userCanisterId, identity);
      
      const approvals = await actor.getApprovalHistory(BigInt(limit));
      
      const converted = approvals.map(approval => this.fromCanisterApproval(approval));
      
      console.log(`✅ Retrieved ${converted.length} approval history entries`);
      
      return {
        success: true,
        approvals: converted,
      };
    } catch (error) {
      console.error('Failed to get approval history:', error);
      return {
        success: false,
        approvals: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete all workflow data and redeploy agency workflow from scratch
   * This will:
   * 1. Redeploy the agency workflow WASM (reinstall mode - clears all data)
   * 2. Re-initialize the workflow system
   */
  public async resetAgencyWorkflow(
    projectId: string,
    userCanisterId: string,
    identity: Identity,
    onProgress?: (progress: { stage: string; message: string; percent: number }) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔄 Starting agency workflow reset for project: ${projectId}`);
      
      onProgress?.({
        stage: 'preparing',
        message: 'Preparing workflow reset...',
        percent: 0
      });

      // Step 1: Get the backend canister ID
      const serverPairs = await this.getProjectServerPairs(projectId, userCanisterId, identity);
      if (serverPairs.length === 0) {
        return { success: false, error: 'No server pairs available for project' };
      }

      const selectedServerPair = this.getSelectedServerPair(projectId, serverPairs);
      if (!selectedServerPair) {
        return { success: false, error: 'No valid server pair selected' };
      }

      console.log(`🎯 Resetting agency workflow on canister: ${selectedServerPair.backendCanisterId}`);

      onProgress?.({
        stage: 'redeploying',
        message: 'Redeploying agency workflow WASM (this will clear all data)...',
        percent: 20
      });

      // Step 2: Redeploy agency workflow WASM (reinstall mode clears all data)
      const deployResult = await AgentDeploymentService.deployAgencyWorkflow({
        projectId,
        serverPairId: selectedServerPair.pairId,
        backendCanisterId: selectedServerPair.backendCanisterId,
        frontendCanisterId: selectedServerPair.frontendCanisterId, // Include frontend for UI deployment
        userCanisterId,
        identity,
        principal: identity.getPrincipal()
      }, (progress) => {
        // Map deployment progress to our progress callback
        onProgress?.({
          stage: progress.stage,
          message: progress.message,
          percent: 20 + (progress.percent * 0.7) // 20-90% for deployment
        });
      });

      if (!deployResult.success) {
        return { success: false, error: deployResult.error || 'Failed to redeploy agency workflow' };
      }

      onProgress?.({
        stage: 'initializing',
        message: 'Re-initializing agency workflow system...',
        percent: 90
      });

      // Step 3: Re-initialize the workflow system
      const initResult = await this.initializeAgencyCanister(projectId, userCanisterId, identity);
      
      if (!initResult.success) {
        return { success: false, error: initResult.error || 'Failed to re-initialize agency workflow' };
      }

      onProgress?.({
        stage: 'complete',
        message: 'Agency workflow reset complete!',
        percent: 100
      });

      console.log(`✅ Agency workflow reset completed successfully`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to reset agency workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Helper: Convert Candid TriggerConfig to frontend TriggerConfig
   */
  private fromCanisterTriggerConfig(trigger: TriggerConfig): TriggerConfig {
    return {
      id: trigger.id,
      name: trigger.name,
      description: trigger.description,
      triggerType: trigger.triggerType,
      enabled: trigger.enabled,
      createdAt: Number(trigger.createdAt) / 1_000_000,
      updatedAt: Number(trigger.updatedAt) / 1_000_000,
      lastTriggered: trigger.lastTriggered.length > 0 ? Number(trigger.lastTriggered[0]) / 1_000_000 : undefined,
      nextRun: trigger.nextRun.length > 0 ? Number(trigger.nextRun[0]) / 1_000_000 : undefined,
      owner: trigger.owner.toText(),
      inputTemplate: trigger.inputTemplate,
      conditions: trigger.conditions,
      retryConfig: trigger.retryConfig.length > 0 ? {
        maxRetries: Number(trigger.retryConfig[0].maxRetries),
        backoffMultiplier: trigger.retryConfig[0].backoffMultiplier,
        initialDelaySeconds: Number(trigger.retryConfig[0].initialDelaySeconds),
      } : undefined,
      executionLimits: trigger.executionLimits.length > 0 ? {
        maxConcurrentTasks: Number(trigger.executionLimits[0].maxConcurrentTasks),
        maxExecutionsPerHour: Number(trigger.executionLimits[0].maxExecutionsPerHour),
        timeoutSeconds: Number(trigger.executionLimits[0].timeoutSeconds),
      } : undefined,
      triggerCount: Number(trigger.triggerCount),
      lastResult: trigger.lastResult.length > 0 ? trigger.lastResult[0] : undefined,
    };
  }
}

// ==================== SINGLETON EXPORT ====================

export const AgencyService = new AgencyServiceClass();

// Export enhanced types for use in components
export type {
  Agency,
  AgentStep,
  Execution,
  StepResult,
  TriggerConfig,
  AgentMetrics,
  ActivityEvent,
  ErrorLog,
  Approval,
  CreateScheduledTriggerRequest,
  CreateConditionTriggerRequest,
  CreateWebhookTriggerRequest,
  ScheduleType,
  ConditionType,
  TriggerType,
  RetryConfig,
  ExecutionLimits
};

// Export connection types
export type { ConnectionCondition, AgentConnection, LoopConfig, StepTarget };