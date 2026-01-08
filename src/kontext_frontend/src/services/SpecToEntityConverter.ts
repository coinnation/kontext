/**
 * Service for converting AI-generated specs into actual platform entities
 * Handles creation of agents, workflows, and business agencies from specs
 */

import { AgentDeploymentService } from './AgentDeploymentService';
import { AgencyService } from './AgencyService';
import { BusinessAgencyStorageService } from './BusinessAgencyStorageService';
import type {
  AgentSpec,
  WorkflowSpec,
  BusinessAgencySpec
} from '../types/agentSpec';
import type { Identity } from '@dfinity/agent';
import type { AgentConfig } from '../candid/agent.did.d.ts';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as agentIdlFactory } from '../../candid/agent.did.js';
import type { _SERVICE as AgentService } from '../candid/agent.did.d.ts';

export interface ConversionContext {
  projectId: string;
  userCanisterId: string;
  identity: Identity;
  principal: any;
  serverPairId?: string; // Selected server pair for deployment
  mcpAuthValues?: Record<string, string>; // MCP authentication tokens from dependency resolution
}

export interface ConversionResult {
  success: boolean;
  entityId?: string;
  entityName?: string;
  error?: string;
  warnings?: string[];
}

export class SpecToEntityConverter {
  /**
   * Create an agent from an AgentSpec
   */
  async createAgentFromSpec(
    spec: AgentSpec,
    context: ConversionContext,
    onProgress?: (message: string) => void
  ): Promise<ConversionResult> {
    try {
      console.log(`🤖 [SpecConverter] Creating agent from spec: ${spec.name}`);

      if (!context.serverPairId) {
        throw new Error('Server pair ID is required to create an agent');
      }

      // Validate principal
      if (!context.principal) {
        throw new Error('Principal is required to create an agent');
      }

      // Import Principal to check if it's already a Principal object
      const { Principal } = await import('@dfinity/principal');
      
      // Ensure principal is a Principal object
      let principal: Principal;
      if (context.principal instanceof Principal) {
        principal = context.principal;
      } else if (typeof context.principal === 'string') {
        if (!context.principal.trim()) {
          throw new Error('Principal cannot be empty');
        }
        principal = Principal.fromText(context.principal);
      } else {
        // Try to get principal from identity
        principal = context.identity.getPrincipal();
      }

      // Resolve canister IDs from server pair
      const { userCanisterService } = await import('./UserCanisterService');
      const userActor = await userCanisterService.getUserActor(context.userCanisterId, context.identity);
      const pairsResult = await userActor.getProjectServerPairs(context.projectId);
      
      if (!pairsResult || !('ok' in pairsResult) || pairsResult.ok.length === 0) {
        throw new Error('No server pairs found for this project');
      }

      // Find the server pair matching the serverPairId
      const serverPair = pairsResult.ok.find((pair: any) => pair.pairId === context.serverPairId);
      if (!serverPair) {
        throw new Error(`Server pair with ID ${context.serverPairId} not found`);
      }

      const frontendCanisterId = serverPair.frontendCanisterId.toText();
      const backendCanisterId = serverPair.backendCanisterId.toText();

      if (!frontendCanisterId || !backendCanisterId) {
        throw new Error('Server pair is missing canister IDs');
      }

      console.log(`📋 [SpecConverter] Resolved canister IDs from server pair:`);
      console.log(`   Frontend: ${frontendCanisterId}`);
      console.log(`   Backend: ${backendCanisterId}`);
      console.log(`   Principal: ${principal.toText()}`);

      // Build MCP tokens from spec and resolved auth values
      const mcpTokens: Array<[string, string]> = [];
      const mcpServerIds: string[] = spec.mcpServers.map(s => s.serverId);

      // Cache for server configs to avoid multiple fetches
      const serverConfigCache = new Map<string, { authTokenKey: string }>();

      // Map MCP servers to tokens using resolved auth values
      for (const mcpServer of spec.mcpServers) {
        if (mcpServer.authConfig) {
          let token = '';
          let tokenKey = mcpServer.serverId; // Default to serverId
          
          // Try to fetch the correct authTokenKey from backend MCP service
          if (!serverConfigCache.has(mcpServer.serverId)) {
            try {
              const response = await fetch(`https://ai.coinnation.io/api/mcp/mcp-servers/${mcpServer.serverId}`);
              if (response.ok) {
                const serverConfig = await response.json();
                if (serverConfig.authTokenKey) {
                  serverConfigCache.set(mcpServer.serverId, { authTokenKey: serverConfig.authTokenKey });
                  tokenKey = serverConfig.authTokenKey;
                } else {
                  // Fallback: construct token key from serverId
                  const serverIdUpper = mcpServer.serverId.toUpperCase();
                  tokenKey = `${serverIdUpper}_AUTH_TOKEN`;
                  serverConfigCache.set(mcpServer.serverId, { authTokenKey: tokenKey });
                }
              } else {
                // Fallback if endpoint doesn't exist or server not found
                const serverIdUpper = mcpServer.serverId.toUpperCase();
                tokenKey = `${serverIdUpper}_AUTH_TOKEN`;
                serverConfigCache.set(mcpServer.serverId, { authTokenKey: tokenKey });
              }
            } catch (error) {
              console.warn(`Could not fetch MCP server config for ${mcpServer.serverId}, using fallback:`, error);
              // Fallback: try common patterns
              const serverIdUpper = mcpServer.serverId.toUpperCase();
              tokenKey = `${serverIdUpper}_AUTH_TOKEN`;
              serverConfigCache.set(mcpServer.serverId, { authTokenKey: tokenKey });
            }
          } else {
            // Use cached token key
            tokenKey = serverConfigCache.get(mcpServer.serverId)!.authTokenKey;
          }
          
          // Check if we have a resolved token for this server
          if (context.mcpAuthValues) {
            // Try multiple possible keys (authTokenKey, serverId, and variations)
            token = context.mcpAuthValues[tokenKey] || 
                    context.mcpAuthValues[mcpServer.serverId] || 
                    context.mcpAuthValues[`${mcpServer.serverId}_TOKEN`] ||
                    context.mcpAuthValues[`${mcpServer.serverId.toUpperCase()}_AUTH_TOKEN`] ||
                    '';
          }
          
          // Use the correct token key from backend configuration
          // This ensures the agent receives tokens with the correct key names (e.g., "ZAPIER_AUTH_TOKEN")
          mcpTokens.push([tokenKey, token]);
          
          console.log(`🔑 [SpecConverter] MCP token configured: ${tokenKey} = ${token ? '***' : '(empty)'}`);
        }
      }

      // Convert spec to AgentConfig with MCP servers from spec
      const agentConfig: AgentConfig = {
        name: spec.name,
        description: spec.description,
        instructions: spec.instructions,
        confidenceThreshold: spec.config.confidenceThreshold,
        temperature: spec.config.temperature,
        maxTokens: BigInt(spec.config.maxTokens),
        requireApproval: spec.config.requireApproval,
        defaultMcpServers: mcpServerIds, // Use MCP servers from spec
        mcpClientEndpoint: 'https://ai.coinnation.io/api/mcp', // Set MCP client endpoint
        claudeApiKey: '', // Will be set by user later
        mcpTokens: mcpTokens.length > 0 ? mcpTokens : [] // Include resolved tokens
      };

      onProgress?.('Deploying agent...');

      // Deploy agent using existing deployment service
      const deploymentResult = await AgentDeploymentService.deployAgent(
        {
          agentName: spec.name,
          serverPairId: context.serverPairId!,
          frontendCanisterId,
          backendCanisterId,
          projectId: context.projectId,
          userCanisterId: context.userCanisterId,
          identity: context.identity,
          principal
        },
        (progress) => {
          console.log(`📊 [SpecConverter] Deployment progress: ${progress.message} (${progress.percent}%)`);
          onProgress?.(progress.message);
        }
      );

      if (!deploymentResult.success) {
        throw new Error(deploymentResult.error || 'Agent deployment failed');
      }

      onProgress?.('Initializing agent with configuration...');

      // After deployment, initialize the agent with the spec configuration
      try {
        const agent = new HttpAgent({ 
          identity: context.identity, 
          host: process.env.NODE_ENV === 'production' ? 'https://ic0.app' : 'http://localhost:4943'
        });

        if (process.env.NODE_ENV !== 'production') {
          await agent.fetchRootKey();
        }

        const agentActor = Actor.createActor<AgentService>(agentIdlFactory, {
          agent,
          canisterId: backendCanisterId,
        });

        const initResult = await agentActor.initializeFromKontext(agentConfig);

        if ('err' in initResult) {
          console.warn('⚠️ [SpecConverter] Failed to initialize agent with spec config:', initResult.err);
          // Continue anyway - agent is deployed, user can configure manually
        } else {
          console.log('✅ [SpecConverter] Agent initialized with spec configuration including MCP servers:', initResult.ok);
        }
      } catch (initError) {
        console.warn('⚠️ [SpecConverter] Error initializing agent with spec config:', initError);
        // Continue anyway - agent is deployed, user can configure manually
      }

      const warnings: string[] = [];
      
      // Warn about missing MCP tokens if any
      const missingTokens = mcpTokens.filter(([_, token]) => !token || token.trim() === '');
      if (missingTokens.length > 0) {
        warnings.push(`Some MCP servers need authentication tokens configured: ${missingTokens.map(([serverId]) => serverId).join(', ')}`);
      }

      // Warn about external setup requirements
      if (spec.dependencies.requiresExternalSetup.length > 0) {
        warnings.push(...spec.dependencies.requiresExternalSetup.map(s => 
          `Remember to complete: ${s.service} - ${s.action}`
        ));
      }

      onProgress?.('Agent created successfully!');

      // Use backendCanisterId directly (we already have it from the server pair)
      // This ensures we always have a valid Principal string, not a URL
      const entityId = backendCanisterId.trim();
      
      // Final validation - ensure it's a valid Principal format
      if (!entityId || entityId === '' || entityId.includes(':')) {
        console.error('❌ [SpecConverter] Invalid backendCanisterId:', entityId);
        throw new Error(`Invalid agent canister ID: "${entityId}". Expected a valid Principal ID (e.g., "4mc2w-6qaaa-aaaaa-qde2a-cai").`);
      }

      console.log(`✅ [SpecConverter] Agent created with canister ID: ${entityId}`);

      // Save agent to localStorage so it appears in Single Agent tab
      try {
        const stored = localStorage.getItem(`deployed-agents-${context.projectId}`);
        const existingAgents = stored ? JSON.parse(stored) : [];
        
        // Get server pair info for the agent
        const userActor = await userCanisterService.getUserActor(context.userCanisterId, context.identity);
        const pairsResult = await userActor.getProjectServerPairs(context.projectId);
        
        let serverPairName = 'Unknown Server Pair';
        let frontendCanisterId = '';
        
        if (pairsResult && 'ok' in pairsResult) {
          const serverPair = pairsResult.ok.find((pair: any) => pair.pairId === context.serverPairId);
          if (serverPair) {
            serverPairName = serverPair.name || 'Unknown Server Pair';
            frontendCanisterId = serverPair.frontendCanisterId.toText();
          }
        }
        
        const newAgent = {
          id: `agent_${Date.now()}`,
          name: spec.name,
          serverPairId: context.serverPairId || '',
          serverPairName: serverPairName,
          backendCanisterId: entityId,
          frontendCanisterId: frontendCanisterId,
          backendUrl: '',
          frontendUrl: '',
          deployedAt: Date.now(),
          status: 'active' as const
        };
        
        // Add to existing agents (avoid duplicates)
        const agentExists = existingAgents.some((a: any) => a.backendCanisterId === newAgent.backendCanisterId);
        if (!agentExists) {
          const updatedAgents = [...existingAgents, newAgent];
          localStorage.setItem(`deployed-agents-${context.projectId}`, JSON.stringify(updatedAgents));
          console.log('✅ [SpecConverter] Saved agent to localStorage:', newAgent);
        } else {
          console.log('⚠️ [SpecConverter] Agent already exists in localStorage, skipping save');
        }
      } catch (storageError) {
        console.error('❌ [SpecConverter] Failed to save agent to localStorage:', storageError);
        // Continue anyway - agent is created, user can refresh
      }

      return {
        success: true,
        entityId: entityId, // Use backend canister ID directly
        entityName: spec.name,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('❌ [SpecConverter] Failed to create agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a workflow from a WorkflowSpec
   */
  async createWorkflowFromSpec(
    spec: WorkflowSpec,
    context: ConversionContext
  ): Promise<ConversionResult> {
    try {
      console.log(`🔄 [SpecConverter] Creating workflow from spec: ${spec.name}`);

      // First, create any agents that don't exist
      // Each agent must use its assigned server pair (one agent per server pair)
      const createdAgentIds: string[] = [];
      const serverPairAssignments = (spec as any).serverPairAssignments || {};
      
      for (const step of spec.steps) {
        if (step.agentSpec && !step.agentCanisterId) {
          console.log(`Creating agent for step: ${step.agentName}`);
          
          // Get the server pair ID assigned to this step
          const stepServerPairId = (step as any).serverPairId || serverPairAssignments[step.stepId];
          if (!stepServerPairId) {
            throw new Error(`No server pair assigned to step ${step.agentName}. Each agent requires its own server pair.`);
          }
          
          // Create agent with the specific server pair
          const agentContext = {
            ...context,
            serverPairId: stepServerPairId
          };
          
          const agentResult = await this.createAgentFromSpec(step.agentSpec, agentContext);
          
          if (agentResult.success && agentResult.entityId) {
            createdAgentIds.push(agentResult.entityId);
            step.agentCanisterId = agentResult.entityId;
          } else {
            throw new Error(`Failed to create agent for step ${step.agentName}: ${agentResult.error}`);
          }
        }
      }

      // Convert workflow spec to agency format
      // AgencyService is exported as a singleton instance, not a class
      // Build agent steps with validation
      const agentSteps = spec.steps.map((step, index) => {
        // NEW: Handle nested workflows (sub-workflows)
        let stepTarget: any = undefined;
        let agentCanisterId: string | undefined = undefined;
        
        if (step.nestedWorkflow) {
          // This step executes a nested workflow
          stepTarget = {
            agency: {
              agencyId: step.nestedWorkflow.workflowId,
              inputMapping: step.nestedWorkflow.inputMapping || step.inputTemplate
            }
          };
          // For nested workflows, we still need a placeholder agentCanisterId for backward compatibility
          // Use a dummy value - the backend will use stepTarget instead
          agentCanisterId = '2vxsx-fae'; // Anonymous principal as placeholder
        } else {
          // Regular agent step - validate agentCanisterId
          agentCanisterId = step.agentCanisterId;
        
        if (!agentCanisterId) {
          throw new Error(`Step ${index + 1} (${step.agentName}) is missing agentCanisterId. Please ensure all steps have agents assigned.`);
        }
        
        // Ensure it's a string
        if (typeof agentCanisterId !== 'string') {
          console.error(`Invalid agentCanisterId type for step ${step.agentName}:`, agentCanisterId, typeof agentCanisterId);
          throw new Error(`Step ${index + 1} (${step.agentName}) has invalid agentCanisterId type: ${typeof agentCanisterId}. Expected a valid Principal string.`);
        }
        
        // Trim and validate it's not empty
        agentCanisterId = agentCanisterId.trim();
        if (!agentCanisterId || agentCanisterId === 'undefined' || agentCanisterId === 'null' || agentCanisterId.includes(':')) {
          console.error(`Invalid agentCanisterId value for step ${step.agentName}:`, agentCanisterId);
          throw new Error(`Step ${index + 1} (${step.agentName}) has invalid agentCanisterId: "${agentCanisterId}". Expected a valid Principal ID (e.g., "4mc2w-6qaaa-aaaaa-qde2a-cai").`);
        }
        
        // Validate it looks like a Principal (basic check - should be alphanumeric with hyphens)
        if (!/^[a-z0-9-]+$/.test(agentCanisterId)) {
          console.error(`Invalid agentCanisterId format for step ${step.agentName}:`, agentCanisterId);
          throw new Error(`Step ${index + 1} (${step.agentName}) has invalid agentCanisterId format: "${agentCanisterId}". Principal IDs should only contain lowercase letters, numbers, and hyphens.`);
          }
          
          // Set stepTarget for regular agent steps
          stepTarget = {
            agent: {
              agentCanisterId: agentCanisterId,
              agentConfig: undefined
            }
          };
        }
        
        // NEW: Convert loop configuration
        let loopConfig: any = undefined;
        if (step.loopConfig && step.loopConfig.type !== 'none') {
          if (step.loopConfig.type === 'for_each' && step.loopConfig.forEach) {
            loopConfig = {
              forEach: {
                arraySource: step.loopConfig.forEach.arraySource,
                itemVariable: step.loopConfig.forEach.itemVariable || 'item',
                indexVariable: step.loopConfig.forEach.indexVariable || 'index',
                maxIterations: step.loopConfig.forEach.maxIterations
              }
            };
          } else if (step.loopConfig.type === 'while_loop' && step.loopConfig.whileLoop) {
            loopConfig = {
              whileLoop: {
                condition: step.loopConfig.whileLoop.condition,
                maxIterations: step.loopConfig.whileLoop.maxIterations || 100
              }
            };
          } else if (step.loopConfig.type === 'repeat' && step.loopConfig.repeat) {
            loopConfig = {
              repeat: {
                count: step.loopConfig.repeat.count,
                indexVariable: step.loopConfig.repeat.indexVariable
              }
            };
          }
        }
        
        return {
          agentCanisterId: agentCanisterId!, // Keep for backward compatibility
          agentName: step.agentName,
          inputTemplate: step.inputTemplate,
          requiresApproval: step.requiresApproval,
          retryOnFailure: step.retryOnFailure,
          timeout: step.timeout ? Number(step.timeout) : undefined, // Convert to number, not BigInt
          agentConfig: undefined, // Will be fetched from agent
          triggerConfig: undefined,
          // NEW: Add loop and nested workflow support
          stepTarget: stepTarget,
          loopConfig: loopConfig
        };
      });

      // Validate context before creating agency
      if (typeof context.projectId !== 'string' || context.projectId.trim() === '') {
        throw new Error(`Invalid projectId in context: expected string, got ${typeof context.projectId} (${JSON.stringify(context.projectId)})`);
      }
      if (typeof context.userCanisterId !== 'string' || context.userCanisterId.trim() === '') {
        throw new Error(`Invalid userCanisterId in context: expected string, got ${typeof context.userCanisterId}`);
      }
      if (!context.identity) {
        throw new Error('Missing identity in context');
      }

      console.log('✅ [SpecConverter] Creating workflow with validated context:', {
        projectId: context.projectId,
        projectIdType: typeof context.projectId,
        userCanisterId: context.userCanisterId,
        userCanisterIdType: typeof context.userCanisterId,
        hasIdentity: !!context.identity,
        stepsCount: agentSteps.length
      });

      // Convert connections from spec format to AgentConnection format if needed
      const connections = spec.connections?.map((conn) => {
        // Find step indices for source and target
        const sourceIndex = spec.steps.findIndex(s => s.stepId === conn.from);
        const targetIndex = spec.steps.findIndex(s => s.stepId === conn.to);
        
        // Convert condition format from spec to AgencyService format
        let condition: any = { always: null }; // Default to always
        if (conn.condition) {
          const condType = (conn.condition as any).type;
          if (condType === 'on_success') {
            condition = { onSuccess: null };
          } else if (condType === 'on_error' || condType === 'on_failure') {
            condition = { onFailure: null };
          } else if (condType === 'always') {
            condition = { always: null };
          } else if ((conn.condition as any).ifContains) {
            condition = { ifContains: (conn.condition as any).ifContains };
          } else if ((conn.condition as any).ifEquals) {
            condition = { ifEquals: (conn.condition as any).ifEquals };
          }
        }
        
        return {
          sourceStepIndex: sourceIndex >= 0 ? sourceIndex : 0,
          targetStepIndex: targetIndex >= 0 ? targetIndex : 0,
          condition
        };
      });

      // Create the workflow/agency
      // Note: AgencyService.createAgency expects individual parameters, not an object
      const createResult = await AgencyService.createAgency(
        spec.name,
        spec.description || '',
        agentSteps,
        context.projectId,
        context.userCanisterId,
        context.identity,
        connections // Optional connections parameter
      );

      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create workflow');
      }

      if (!createResult.agencyId) {
        throw new Error('Workflow created but no agency ID returned');
      }

      const agencyId = createResult.agencyId;
      const triggerWarnings: string[] = [];

      // Create global triggers if specified in the spec
      if (spec.globalTriggers && spec.globalTriggers.length > 0) {
        console.log(`⏰ [SpecConverter] Creating ${spec.globalTriggers.length} global trigger(s) for workflow...`);
        
        for (let i = 0; i < spec.globalTriggers.length; i++) {
          const triggerSpec = spec.globalTriggers[i];
          try {
            if (triggerSpec.type === 'scheduled') {
              // Extract schedule configuration
              const config = triggerSpec.config || {};
              const scheduleType = config.scheduleType || config.type || 'interval';
              
              let schedule: any;
              
              if (scheduleType === 'interval') {
                const seconds = config.intervalSeconds || config.seconds || 3600;
                schedule = { interval: { seconds: BigInt(seconds) } };
              } else if (scheduleType === 'cron') {
                const cronExpression = config.cronExpression || config.expression || '0 * * * *';
                schedule = { cron: { expression: cronExpression } };
              } else if (scheduleType === 'once') {
                const timestamp = config.onceTimestamp || config.timestamp || BigInt(Date.now() * 1_000_000);
                schedule = { once: { timestamp } };
              } else if (scheduleType === 'recurring') {
                const pattern = config.pattern || 'hourly';
                const nextRun = config.nextRun || BigInt(Date.now() * 1_000_000);
                schedule = { recurring: { pattern, nextRun } };
              } else {
                // Default to interval if unknown
                schedule = { interval: { seconds: BigInt(3600) } };
              }

              const result = await AgencyService.createScheduledTrigger({
                agencyId,
                name: config.name || `Scheduled Trigger ${i + 1}`,
                description: config.description || `Automated scheduled trigger for ${spec.name}`,
                schedule,
                inputTemplate: config.inputTemplate || '{input}',
                retryConfig: config.retryConfig,
                executionLimits: config.executionLimits
              }, context.projectId, context.userCanisterId, context.identity);
              
              if (!result.success) {
                console.warn(`⚠️ [SpecConverter] Failed to create scheduled trigger ${i + 1}: ${result.error}`);
                triggerWarnings.push(`Failed to create scheduled trigger: ${result.error}`);
              } else {
                console.log(`✅ [SpecConverter] Created scheduled trigger: ${result.trigger?.name || 'unnamed'}`);
              }
            } else if (triggerSpec.type === 'webhook') {
              const config = triggerSpec.config || {};
              const result = await AgencyService.createWebhookTrigger({
                agencyId,
                name: config.name || `Webhook Trigger ${i + 1}`,
                description: config.description || `Webhook trigger for ${spec.name}`,
                source: config.source || config.endpoint || 'unknown',
                signature: config.signature,
                inputTemplate: config.inputTemplate || '{input}',
                retryConfig: config.retryConfig,
                executionLimits: config.executionLimits
              }, context.projectId, context.userCanisterId, context.identity);
              
              if (!result.success) {
                console.warn(`⚠️ [SpecConverter] Failed to create webhook trigger ${i + 1}: ${result.error}`);
                triggerWarnings.push(`Failed to create webhook trigger: ${result.error}`);
              } else {
                console.log(`✅ [SpecConverter] Created webhook trigger: ${result.trigger?.name || 'unnamed'}`);
              }
            } else if (triggerSpec.type === 'condition' || (triggerSpec.config as any)?.conditionType) {
              // Support both 'condition' type and config with conditionType
              const config = triggerSpec.config || {};
              const conditionType = config.conditionType || 'threshold';
              
              let condition: any;
              
              if (conditionType === 'threshold') {
                condition = {
                  threshold: {
                    metric: config.metric || 'value',
                    operator: config.operator || '>',
                    value: config.threshold || config.value || 0
                  }
                };
              } else if (conditionType === 'http_check') {
                condition = {
                  http_check: {
                    url: config.httpUrl || config.url || '',
                    expected_status: BigInt(config.expectedStatus || config.expected_status || 200)
                  }
                };
              } else if (conditionType === 'custom') {
                condition = {
                  custom: {
                    expression: config.customExpression || config.expression || 'true',
                    variables: config.variables || []
                  }
                };
              } else {
                // Default to threshold
                condition = {
                  threshold: {
                    metric: 'value',
                    operator: '>',
                    value: 0
                  }
                };
              }

              const result = await AgencyService.createConditionTrigger({
                agencyId,
                name: config.name || `Condition Trigger ${i + 1}`,
                description: config.description || `Condition-based trigger for ${spec.name}`,
                condition,
                inputTemplate: config.inputTemplate || '{input}',
                retryConfig: config.retryConfig,
                executionLimits: config.executionLimits
              }, context.projectId, context.userCanisterId, context.identity);
              
              if (!result.success) {
                console.warn(`⚠️ [SpecConverter] Failed to create condition trigger ${i + 1}: ${result.error}`);
                triggerWarnings.push(`Failed to create condition trigger: ${result.error}`);
              } else {
                console.log(`✅ [SpecConverter] Created condition trigger: ${result.trigger?.name || 'unnamed'}`);
              }
            } else if (triggerSpec.type === 'manual') {
              // Manual triggers don't need to be created - they're always available
              console.log(`ℹ️ [SpecConverter] Manual trigger specified - no creation needed (always available)`);
            } else {
              console.warn(`⚠️ [SpecConverter] Unknown trigger type: ${triggerSpec.type}`);
              triggerWarnings.push(`Unknown trigger type: ${triggerSpec.type}`);
            }
          } catch (error) {
            console.error(`❌ [SpecConverter] Error creating trigger ${i + 1}:`, error);
            triggerWarnings.push(`Error creating trigger ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
        console.log(`✅ [SpecConverter] Completed trigger creation for workflow ${spec.name}`);
      }

      return {
        success: true,
        entityId: agencyId,
        entityName: spec.name,
        warnings: [
          ...spec.dependencies.requiresMcpAuth.map(auth => 
            `Configure ${auth.authType} authentication for ${auth.serverId}`
          ),
          ...triggerWarnings
        ]
      };
    } catch (error) {
      console.error('❌ [SpecConverter] Failed to create workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a business agency from a BusinessAgencySpec
   */
  async createBusinessAgencyFromSpec(
    spec: BusinessAgencySpec,
    context: ConversionContext
  ): Promise<ConversionResult> {
    try {
      console.log(`🏢 [SpecConverter] Creating business agency from spec: ${spec.name}`);

      // Create agents first
      const createdAgentIds: string[] = [];
      
      for (const agentRef of spec.agents) {
        if (agentRef.agentSpec && !agentRef.agentCanisterId) {
          const agentResult = await this.createAgentFromSpec(agentRef.agentSpec, context);
          
          if (agentResult.success && agentResult.entityId) {
            createdAgentIds.push(agentResult.entityId);
            agentRef.agentCanisterId = agentResult.entityId;
          } else {
            console.warn(`Failed to create agent ${agentRef.agentSpec.name}: ${agentResult.error}`);
          }
        }
      }

      // Create workflows
      const createdWorkflowIds: string[] = [];
      
      for (const workflowRef of spec.workflows) {
        if (workflowRef.workflowSpec && !workflowRef.workflowId) {
          const workflowResult = await this.createWorkflowFromSpec(workflowRef.workflowSpec, context);
          
          if (workflowResult.success && workflowResult.entityId) {
            createdWorkflowIds.push(workflowResult.entityId);
            workflowRef.workflowId = workflowResult.entityId;
          } else {
            console.warn(`Failed to create workflow ${workflowRef.workflowSpec.name}: ${workflowResult.error}`);
          }
        }
      }

      // Collect all agent and workflow IDs
      const agentIds = spec.agents
        .map(a => a.agentCanisterId)
        .filter((id): id is string => Boolean(id));
      
      const workflowIds = spec.workflows
        .map(w => w.workflowId)
        .filter((id): id is string => Boolean(id));

      // Create business agency
      const agency = {
        name: spec.name,
        description: spec.description,
        category: spec.category,
        icon: spec.icon,
        color: spec.color,
        agentIds,
        workflowIds,
        goals: spec.goals.map(goal => ({
          name: goal.name,
          description: goal.description,
          target: goal.target,
          status: 'active' as const,
          taskMapping: goal.taskMapping
        })),
        metrics: {
          totalExecutions: 0,
          successRate: 0,
          averageResponseTime: 0,
          lastUpdated: Date.now()
        },
        created: Date.now(),
        updated: Date.now(),
        owner: context.userCanisterId,
        projectId: context.projectId
      };

      // Save to storage
      const saved = BusinessAgencyStorageService.saveBusinessAgency(
        agency,
        context.userCanisterId,
        context.projectId
      );

      if (!saved) {
        throw new Error('Failed to save business agency');
      }

      return {
        success: true,
        entityId: agency.id || `agency_${Date.now()}`,
        entityName: spec.name,
        warnings: [
          ...spec.dependencies.requiresMcpAuth.map(auth => 
            `Configure ${auth.authType} authentication for ${auth.serverId}`
          ),
          ...spec.dependencies.requiresExternalSetup.map(setup => 
            `Complete external setup: ${setup.service} - ${setup.action}`
          )
        ]
      };
    } catch (error) {
      console.error('❌ [SpecConverter] Failed to create business agency:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

