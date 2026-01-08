/**
 * Component for selecting or creating agents for workflow steps
 */

import React, { useState, useEffect } from 'react';
import { useAppStore, useServerPairDialog, useCredits } from '../../store/appStore';
import { SpecToEntityConverter } from '../../services/SpecToEntityConverter';
import { useCanister } from '../../useCanister';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ProgressDialog } from './ProgressDialog';
import { icpPriceService, IcpPriceData } from '../../services/IcpPriceService';
import type { WorkflowSpec } from '../../types/agentSpec';

interface WorkflowAgentSelectionProps {
  spec: WorkflowSpec;
  availableServerPairs: Array<{
    pairId: string;
    name: string;
    frontendCanisterId: string;
    backendCanisterId: string;
  }>;
  onComplete: (updatedSpec: WorkflowSpec) => void;
  onCancel: () => void;
  onRefreshServerPairs?: () => Promise<void>; // Callback to refresh server pairs list
}

interface DeployedAgent {
  id: string;
  name: string;
  backendCanisterId: string;
  frontendCanisterId: string;
  status: string;
  serverPairId?: string;
  serverPairName?: string;
}

export const WorkflowAgentSelection: React.FC<WorkflowAgentSelectionProps> = ({
  spec,
  availableServerPairs,
  onComplete,
  onCancel,
  onRefreshServerPairs
}) => {
  const { activeProject, userCanisterId, identity, principal } = useAppStore();
  const { actor: mainActor } = useCanister();
  const { createServerPairForExistingProject, calculateServerConfigFromCredits, getMinimumCreditsRequired } = useServerPairDialog();
  const { credits } = useCredits();
  const [existingAgents, setExistingAgents] = useState<DeployedAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<Record<string, string>>({}); // stepId -> agentCanisterId
  const [assignedServerPairs, setAssignedServerPairs] = useState<Record<string, string>>({}); // stepId -> serverPairId
  const [creatingAgents, setCreatingAgents] = useState<Set<string>>(new Set());
  const [editingSteps, setEditingSteps] = useState<Set<string>>(new Set()); // stepId -> true if user wants to change agent
  const [converter] = useState(() => new SpecToEntityConverter());
  
  // Server pair creation state
  const [showCreateServerPairDialog, setShowCreateServerPairDialog] = useState(false);
  const [pendingAgentCreation, setPendingAgentCreation] = useState<{ 
    stepId: string; 
    agentSpec: any; 
    agentName?: string;
    existingAgentId?: string;
  } | null>(null);
  const [isCreatingServerPair, setIsCreatingServerPair] = useState(false);
  const [serverPairCreationProgress, setServerPairCreationProgress] = useState<string>('');
  const [serverPairCreationProgressPercent, setServerPairCreationProgressPercent] = useState<number>(0);
  const [localServerPairs, setLocalServerPairs] = useState(availableServerPairs);
  const [icpPriceData, setIcpPriceData] = useState<IcpPriceData | null>(null);
  const [isLoadingIcpPrice, setIsLoadingIcpPrice] = useState(true);
  // Server pair selection state for new agent creation
  const [showServerPairSelection, setShowServerPairSelection] = useState<Record<string, boolean>>({}); // stepId -> true if showing selection
  const [selectedServerPairForCreation, setSelectedServerPairForCreation] = useState<Record<string, string>>({}); // stepId -> serverPairId
  // Agent creation progress state
  const [agentCreationProgress, setAgentCreationProgress] = useState<Record<string, { message: string; percent: number }>>({}); // stepId -> progress
  
  // Update local server pairs when prop changes
  useEffect(() => {
    setLocalServerPairs(availableServerPairs);
  }, [availableServerPairs]);

  // Initialize ICP price service (consistent with new project flow)
  useEffect(() => {
    const initializeIcpPricing = async () => {
      setIsLoadingIcpPrice(true);
      try {
        const priceData = await icpPriceService.getCurrentPrice();
        setIcpPriceData(priceData);
      } catch (error) {
        console.error('Failed to initialize ICP pricing:', error);
        // Fallback to default price
        setIcpPriceData({ 
          price: 10.0, 
          timestamp: Date.now(),
          source: 'cryptocompare' as const,
          cacheAge: 0 
        });
      } finally {
        setIsLoadingIcpPrice(false);
      }
    };

    initializeIcpPricing();
  }, []);

  // Track which server pairs are available (not yet assigned)
  const getAvailableServerPairs = () => {
    const assignedPairIds = new Set(Object.values(assignedServerPairs));
    return localServerPairs.filter(pair => !assignedPairIds.has(pair.pairId));
  };

  // Load existing agents and auto-assign server pairs for pre-configured agents
  useEffect(() => {
    const loadAgents = async () => {
      if (!activeProject) {
        setIsLoadingAgents(false);
        return;
      }

      try {
        setIsLoadingAgents(true);
        const stored = localStorage.getItem(`deployed-agents-${activeProject}`);
        if (stored) {
          const agents = JSON.parse(stored) as DeployedAgent[];
          setExistingAgents(agents);
        }
      } catch (error) {
        console.error('Failed to load agents:', error);
      } finally {
        setIsLoadingAgents(false);
      }
    };

    loadAgents();
  }, [activeProject]);

  // Auto-assign server pairs for pre-configured agents (steps that already have agentCanisterId)
  useEffect(() => {
    if (existingAgents.length === 0 || availableServerPairs.length === 0) {
      return;
    }

    spec.steps.forEach(step => {
      if (step.agentCanisterId && !assignedServerPairs[step.stepId]) {
        // Find the agent in the loaded agents
        const agent = existingAgents.find(a => a.backendCanisterId === step.agentCanisterId);
        if (agent) {
          // Try to find server pair by agent's serverPairId first (most reliable)
          if ((agent as any).serverPairId) {
            const serverPairById = availableServerPairs.find(pair => 
              pair.pairId === (agent as any).serverPairId
            );
            if (serverPairById) {
              setAssignedServerPairs(prev => ({
                ...prev,
                [step.stepId]: serverPairById.pairId
              }));
              return;
            }
          }
          
          // Fallback: Find the server pair that has this agent's backend canister
          const serverPair = availableServerPairs.find(pair => 
            pair.backendCanisterId === agent.backendCanisterId
          );
          if (serverPair) {
            setAssignedServerPairs(prev => ({
              ...prev,
              [step.stepId]: serverPair.pairId
            }));
          }
        }
      }
    });
  }, [existingAgents, availableServerPairs, spec.steps]);

  const handleAgentSelection = (stepId: string, agentCanisterId: string) => {
    setSelectedAgents(prev => ({
      ...prev,
      [stepId]: agentCanisterId
    }));
    
    // Find which server pair this agent is on
    const agent = existingAgents.find(a => a.backendCanisterId === agentCanisterId);
    if (agent) {
      // Find the server pair that has this agent's backend canister
      const serverPair = availableServerPairs.find(pair => 
        pair.backendCanisterId === agent.backendCanisterId
      );
      if (serverPair) {
        setAssignedServerPairs(prev => ({
          ...prev,
          [stepId]: serverPair.pairId
        }));
      }
    }
  };

  const handleCreateAgent = async (stepId: string, agentSpec: any) => {
    if (!activeProject || !userCanisterId || !identity || !principal) {
      alert('Missing required project or authentication information');
      return;
    }

    // Show server pair selection UI for this step
    setShowServerPairSelection(prev => ({ ...prev, [stepId]: true }));
    setPendingAgentCreation({ stepId, agentSpec });
  };

  const handleServerPairSelectedForCreation = async (stepId: string, serverPairId: string) => {
    if (!pendingAgentCreation || pendingAgentCreation.stepId !== stepId) {
      return;
    }

    // Hide selection UI
    setShowServerPairSelection(prev => {
      const next = { ...prev };
      delete next[stepId];
      return next;
    });

    // Store selection
    setSelectedServerPairForCreation(prev => ({ ...prev, [stepId]: serverPairId }));

    // Create agent with selected server pair
    await createAgentWithServerPair(stepId, pendingAgentCreation.agentSpec, serverPairId);
    
    // Clear pending creation
    setPendingAgentCreation(null);
  };

  const handleCreateNewServerPairForAgent = async (stepId: string) => {
    if (!pendingAgentCreation || pendingAgentCreation.stepId !== stepId) {
      return;
    }

    // Hide selection UI temporarily
    setShowServerPairSelection(prev => {
      const next = { ...prev };
      delete next[stepId];
      return next;
    });

    // Show create server pair dialog
    setShowCreateServerPairDialog(true);
  };

  const createAgentWithServerPair = async (stepId: string, agentSpec: any, serverPairId: string) => {
    if (!activeProject || !userCanisterId || !identity || !principal) {
      alert('Missing required project or authentication information');
      return;
    }

    // Validate serverPairId is not empty or invalid
    if (!serverPairId || typeof serverPairId !== 'string' || serverPairId.trim() === '') {
      console.error('Invalid serverPairId:', serverPairId);
      alert(`Invalid server pair ID: ${serverPairId}. Please try creating the server pair again.`);
      return;
    }

    console.log('📝 Creating agent with context:', {
      stepId,
      serverPairId,
      projectId: activeProject,
      agentName: agentSpec?.name
    });

    // Assign the server pair to this step
    setAssignedServerPairs(prev => ({
      ...prev,
      [stepId]: serverPairId
    }));

    setCreatingAgents(prev => new Set([...prev, stepId]));
    
    // Initialize progress
    setAgentCreationProgress(prev => ({
      ...prev,
      [stepId]: { message: 'Initializing agent deployment...', percent: 0 }
    }));

    try {
      const conversionContext = {
        projectId: activeProject,
        userCanisterId,
        identity,
        principal,
        serverPairId: serverPairId.trim() // Ensure no whitespace
      };

      const result = await converter.createAgentFromSpec(
        agentSpec, 
        conversionContext,
        (progressMessage: string) => {
          // Map progress messages to percentages
          let progressPercent = 20;
          if (progressMessage.includes('Resolving') || progressMessage.includes('Resolved')) {
            progressPercent = 30;
          } else if (progressMessage.includes('Deploying')) {
            progressPercent = 50;
          } else if (progressMessage.includes('Initializing') || progressMessage.includes('Configuration')) {
            progressPercent = 80;
          } else if (progressMessage.includes('complete') || progressMessage.includes('Complete') || progressMessage.includes('success')) {
            progressPercent = 100;
          } else if (progressMessage.includes('Building') || progressMessage.includes('Creating')) {
            progressPercent = 40;
          }
          
          setAgentCreationProgress(prev => ({
            ...prev,
            [stepId]: { message: progressMessage, percent: progressPercent }
          }));
        }
      );

      if (result.success && result.entityId) {
        // Update selected agents
        setSelectedAgents(prev => ({
          ...prev,
          [stepId]: result.entityId!
        }));

        // Refresh agents list
        const stored = localStorage.getItem(`deployed-agents-${activeProject}`);
        if (stored) {
          try {
            const agents = JSON.parse(stored);
            setExistingAgents(agents);
          } catch (error) {
            console.error('Failed to refresh agents:', error);
          }
        }

        setAgentCreationProgress(prev => ({
          ...prev,
          [stepId]: { message: `Agent "${result.entityName}" created successfully!`, percent: 100 }
        }));
        
        // Auto-close after success
        setTimeout(() => {
          setAgentCreationProgress(prev => {
            const next = { ...prev };
            delete next[stepId];
            return next;
          });
        }, 2000);
        
        alert(`Agent "${result.entityName}" created successfully!`);
      } else {
        throw new Error(result.error || 'Failed to create agent');
      }
    } catch (error) {
      console.error('Agent creation failed:', error);
      setAgentCreationProgress(prev => ({
        ...prev,
        [stepId]: { message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, percent: 0 }
      }));
      
      // Keep error visible for a bit, then clear
      setTimeout(() => {
        setAgentCreationProgress(prev => {
          const next = { ...prev };
          delete next[stepId];
          return next;
        });
      }, 5000);
      
      alert(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCreatingAgents(prev => {
        const next = new Set(prev);
        next.delete(stepId);
        return next;
      });
    }
  };

  const handleCreateServerPair = async () => {
    if (!activeProject || !userCanisterId || !identity || !principal || !pendingAgentCreation) {
      return;
    }

    if (!mainActor) {
      alert('Platform wallet not connected. Please ensure you are authenticated.');
      return;
    }

    if (!icpPriceData) {
      alert('ICP pricing data is loading. Please wait a moment and try again.');
      return;
    }

    setIsCreatingServerPair(true);
    setServerPairCreationProgress('Initializing server pair creation...');
    setServerPairCreationProgressPercent(0);

    try {
      // Get project name
      const store = useAppStore.getState();
      const projects = store.projects || [];
      const project = projects.find((p: any) => p.id === activeProject);
      const projectName = project?.name || 'AI Agent Project';

      // Use consistent credits calculation (same as new project flow)
      const defaultCredits = 4400; // Same default as new project flow
      const minimumCredits = getMinimumCreditsRequired();
      const userCredits = credits?.balance || 0;
      
      if (userCredits < minimumCredits) {
        throw new Error(`Insufficient credits. You need at least ${minimumCredits.toLocaleString()} credits to create a server pair, but you only have ${userCredits.toLocaleString()}.`);
      }

      // Use same credits calculation as new project flow
      const finalCredits = Math.max(minimumCredits, Math.min(defaultCredits, userCredits));

      // Validate server config
      const serverConfig = calculateServerConfigFromCredits(finalCredits);
      if (!serverConfig.canCreateServers) {
        throw new Error(serverConfig.message);
      }

      setServerPairCreationProgress('Creating server pair...');

      // Use slice method for consistent server pair creation
      // Use agent name if available, otherwise fall back to step ID
      // Find the step to get the agent name
      const step = spec.steps.find(s => s.stepId === pendingAgentCreation.stepId);
      const agentName = pendingAgentCreation.agentName || 
                       step?.agentName ||
                       pendingAgentCreation.agentSpec?.name || 
                       `Agent ${pendingAgentCreation.stepId}`;
      const serverPairName = `${agentName} Servers`;
      
      const result = await createServerPairForExistingProject(
        activeProject,
        projectName,
        serverPairName,
        finalCredits,
        mainActor,
        icpPriceData,
        (status: string, progress: number) => {
          setServerPairCreationProgress(status);
          setServerPairCreationProgressPercent(progress);
        },
        'AgencyWorkflowPair' // Pool type for agency workflow agents
      );

      if (!result.success || !result.serverPairId) {
        console.error('Server pair creation result:', result);
        throw new Error(result.error || 'Failed to create server pair');
      }

      console.log('✅ Server pair created successfully:', {
        serverPairId: result.serverPairId,
        stepId: pendingAgentCreation.stepId
      });

      setServerPairCreationProgress('Refreshing server pairs list...');
      setServerPairCreationProgressPercent(90);

      // Refresh server pairs list and verify the new server pair is available
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      
      // Retry logic to ensure server pair is available
      let pairsResult: any;
      let retries = 0;
      const maxRetries = 5;
      
      while (retries < maxRetries) {
        pairsResult = await userActor.getProjectServerPairs(activeProject);
        
        if (pairsResult && 'ok' in pairsResult) {
          const pairs = pairsResult.ok.map((pair: any) => ({
            pairId: pair.pairId,
            name: pair.name,
            createdAt: Number(pair.createdAt) / 1_000_000,
            creditsAllocated: Number(pair.creditsAllocated),
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          
          // Check if the newly created server pair is in the list
          const foundPair = pairs.find((p: any) => p.pairId === result.serverPairId);
          if (foundPair) {
            setLocalServerPairs(pairs);
            break; // Server pair found, exit retry loop
          }
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
        retries++;
      }
      
      // Verify server pair was found
      if (retries >= maxRetries) {
        throw new Error(`Server pair ${result.serverPairId} was created but not found in project. Please try again.`);
      }

      // Also call onRefreshServerPairs if provided
      if (onRefreshServerPairs) {
        await onRefreshServerPairs();
      }

      setServerPairCreationProgress('Server pair ready!');
      setServerPairCreationProgressPercent(100);

      // Store pending agent creation before clearing state
      const pendingStepId = pendingAgentCreation.stepId;
      const pendingAgentSpec = pendingAgentCreation.agentSpec;
      const existingAgentId = pendingAgentCreation.existingAgentId;
      const newServerPairId = result.serverPairId;

      // Close dialog
      setShowCreateServerPairDialog(false);
      setPendingAgentCreation(null);
      setIsCreatingServerPair(false);
      setServerPairCreationProgress('');
      setServerPairCreationProgressPercent(0);

      // Hide server pair selection UI
      setShowServerPairSelection(prev => {
        const next = { ...prev };
        delete next[pendingStepId];
        return next;
      });

      // If we're creating a new server pair for an existing pre-configured agent
      if (existingAgentId && !pendingAgentSpec) {
        // Just assign the new server pair to the existing agent
        setAssignedServerPairs(prev => ({
          ...prev,
          [pendingStepId]: newServerPairId
        }));
        console.log('✅ Assigned new server pair to existing agent:', {
          stepId: pendingStepId,
          agentId: existingAgentId,
          serverPairId: newServerPairId
        });
      } else if (pendingAgentSpec) {
        // Create a new agent with the newly created server pair
        console.log('🚀 Creating agent with server pair:', {
          stepId: pendingStepId,
          serverPairId: newServerPairId,
          agentName: pendingAgentSpec?.name
        });
        
        await createAgentWithServerPair(
          pendingStepId,
          pendingAgentSpec,
          newServerPairId
        );
      }
    } catch (error) {
      console.error('Server pair creation failed:', error);
      alert(`Failed to create server pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsCreatingServerPair(false);
    }
  };

  const handleProceed = () => {
    // Validate all steps have agents and server pairs assigned
    const missingAgents = spec.steps.filter(step => {
      const hasAgent = selectedAgents[step.stepId] || step.agentCanisterId;
      const hasServerPair = assignedServerPairs[step.stepId];
      return !hasAgent || !hasServerPair;
    });
    
    if (missingAgents.length > 0) {
      alert(`Please select or create agents for all steps. Each agent must have its own server pair assigned.\n\nMissing: ${missingAgents.map(s => s.agentName).join(', ')}`);
      return;
    }

    // Update spec with selected agents and store server pair assignments
    const updatedSpec: WorkflowSpec = {
      ...spec,
      steps: spec.steps.map(step => {
        const selectedAgentId = selectedAgents[step.stepId] || step.agentCanisterId;
        if (selectedAgentId) {
          // Validate the agentCanisterId before using it
          const agentCanisterId = typeof selectedAgentId === 'string' ? selectedAgentId.trim() : String(selectedAgentId).trim();
          
          // Ensure it's a valid Principal format (no colons, no URLs)
          if (agentCanisterId.includes(':') || agentCanisterId.includes('://')) {
            console.error(`❌ [WorkflowAgentSelection] Invalid agentCanisterId for step ${step.agentName}:`, agentCanisterId);
            throw new Error(`Invalid agent canister ID for step "${step.agentName}": "${agentCanisterId}". Expected a valid Principal ID (e.g., "4mc2w-6qaaa-aaaaa-qde2a-cai"), not a URL.`);
          }
          
          // Validate it looks like a Principal (basic check)
          if (!/^[a-z0-9-]+$/.test(agentCanisterId)) {
            console.error(`❌ [WorkflowAgentSelection] Invalid agentCanisterId format for step ${step.agentName}:`, agentCanisterId);
            throw new Error(`Invalid agent canister ID format for step "${step.agentName}": "${agentCanisterId}". Principal IDs should only contain lowercase letters, numbers, and hyphens.`);
          }
          
          console.log(`✅ [WorkflowAgentSelection] Step "${step.agentName}" using agent canister ID: ${agentCanisterId}`);
          
          return {
            ...step,
            agentCanisterId: agentCanisterId,
            agentSpec: undefined, // Clear agentSpec since we're using existing agent
            // Store server pair ID in a custom field (we'll use this in conversion)
            serverPairId: assignedServerPairs[step.stepId]
          } as any;
        }
        return step;
      })
    };

    // Store server pair assignments in the spec metadata for later use
    (updatedSpec as any).serverPairAssignments = assignedServerPairs;

    onComplete(updatedSpec);
  };

  const allStepsHaveAgents = spec.steps.every(step => 
    selectedAgents[step.stepId] || step.agentCanisterId
  );

  const handleChangeAgent = (stepId: string) => {
    setEditingSteps(prev => new Set([...prev, stepId]));
    // Clear the selected agent for this step so user can choose a new one
    setSelectedAgents(prev => {
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
    // Also clear server pair assignment
    setAssignedServerPairs(prev => {
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0, maxHeight: '100%', overflow: 'hidden', padding: '0.5rem' }}>
      {/* Header - More Compact */}
      <div className="flex-shrink-0 mb-2" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: '700',
          color: '#ffffff',
          margin: '0 0 0.25rem 0'
        }}>
          Configure Workflow Agents
        </h3>
        <p style={{
          color: 'var(--text-gray)',
          margin: 0,
          fontSize: '0.8125rem',
          lineHeight: 1.3
        }}>
          This workflow requires <strong style={{ color: '#ffffff' }}>{spec.steps.length} agent(s)</strong>. Each agent requires its own dedicated server pair.
          {availableServerPairs.length > 0 && (
            <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.75rem', color: 'rgba(59, 130, 246, 0.9)' }}>
              You have {availableServerPairs.length} server pair(s) available.
            </span>
          )}
        </p>
      </div>

      {/* Steps Container - More Compact Grid Layout */}
      <div className="flex-1 overflow-y-auto mb-2" style={{ minHeight: 0, paddingRight: '0.5rem' }}>
        <div style={{
          maxWidth: '100%',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(400px, 100%), 1fr))',
          gap: '0.75rem',
          alignItems: 'start'
        }}>
          {spec.steps.map((step, index) => {
            const isEditing = editingSteps.has(step.stepId);
            const selectedAgentId = isEditing ? selectedAgents[step.stepId] : (selectedAgents[step.stepId] || step.agentCanisterId);
            const isCreating = creatingAgents.has(step.stepId);
            const hasAgentSpec = !!step.agentSpec;

            return (
              <div
                key={step.stepId}
                style={{
                  padding: '0.75rem',
                  background: selectedAgentId 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${selectedAgentId 
                    ? 'rgba(16, 185, 129, 0.3)' 
                    : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '10px',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedAgentId ? '0 2px 8px rgba(16, 185, 129, 0.1)' : 'none',
                  height: 'fit-content'
                }}
                onMouseEnter={(e) => {
                  if (!selectedAgentId) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selectedAgentId) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
              >
                {/* Step Header - More Compact */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        background: selectedAgentId 
                          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))' 
                          : 'rgba(59, 130, 246, 0.15)',
                        border: `1px solid ${selectedAgentId 
                          ? 'rgba(16, 185, 129, 0.4)' 
                          : 'rgba(59, 130, 246, 0.3)'}`,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: selectedAgentId ? '#10B981' : '#3B82F6',
                        flexShrink: 0
                      }}>
                        {index + 1}
                      </div>
                      <h4 style={{
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {step.agentName}
                      </h4>
                    </div>
                    {step.inputTemplate && (
                      <p style={{
                        color: 'var(--text-gray)',
                        fontSize: '0.75rem',
                        margin: '0 0 0 2.25rem',
                        lineHeight: 1.3,
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '0.25rem 0.375rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {step.inputTemplate}
                      </p>
                    )}
                  </div>
                  {selectedAgentId && !isEditing && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.375rem 0.625rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#10B981',
                      flexShrink: 0
                    }}>
                      <span>✓</span>
                      <span>Configured</span>
                    </div>
                  )}
                </div>

                {selectedAgentId && !isEditing ? (
                  <div style={{
                    padding: '0.625rem',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    color: 'var(--text-gray)'
                  }}>
                    <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Using agent:</span>{' '}
                        <strong style={{ color: '#ffffff' }}>
                          {existingAgents.find(a => a.backendCanisterId === selectedAgentId)?.name || selectedAgentId}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                        <button
                          onClick={() => handleChangeAgent(step.stepId)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          }}
                        >
                          Change
                        </button>
                        {/* Always show "Create New Server Pair" button for pre-configured agents */}
                        <button
                          onClick={() => {
                            // For pre-configured agents, we can create a new server pair
                            // If there's an agent spec, we can create a new agent with new server pair
                            // Otherwise, we'll create a new server pair for the existing agent
                            if (hasAgentSpec) {
                              setPendingAgentCreation({ 
                                stepId: step.stepId, 
                                agentSpec: step.agentSpec!,
                                agentName: step.agentName
                              });
                              setShowServerPairSelection(prev => ({ ...prev, [step.stepId]: true }));
                            } else {
                              // Create a new server pair for the existing pre-configured agent
                              // Directly trigger server pair creation dialog
                              setPendingAgentCreation({ 
                                stepId: step.stepId, 
                                agentSpec: null, // No new agent spec, just new server pair
                                agentName: step.agentName,
                                existingAgentId: selectedAgentId
                              });
                              setShowCreateServerPairDialog(true);
                            }
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '4px',
                            color: '#60A5FA',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                          }}
                        >
                          {hasAgentSpec ? 'Create New' : 'New Server Pair'}
                        </button>
                      </div>
                    </div>
                    {assignedServerPairs[step.stepId] && (
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Server Pair: {availableServerPairs.find(p => p.pairId === assignedServerPairs[step.stepId])?.name || assignedServerPairs[step.stepId].slice(0, 8)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Select from existing agents */}
                    {existingAgents.length > 0 && (
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#ffffff',
                          marginBottom: '0.375rem'
                        }}>
                          Select Existing Agent
                        </label>
                        <select
                          value={selectedAgents[step.stepId] || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAgentSelection(step.stepId, e.target.value);
                              setEditingSteps(prev => {
                                const next = new Set(prev);
                                next.delete(step.stepId);
                                return next;
                              });
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            minHeight: '36px'
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.5)';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          }}
                        >
                          <option value="" style={{ background: '#111111' }}>-- Choose an agent --</option>
                          {existingAgents.map(agent => (
                            <option key={agent.id} value={agent.backendCanisterId} style={{ background: '#111111' }}>
                              {agent.name} ({agent.status})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Create new agent option */}
                    {hasAgentSpec && (
                      <div>
                        {existingAgents.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
                            <span style={{
                              fontSize: '0.6875rem',
                              color: 'rgba(255, 255, 255, 0.5)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              fontWeight: 600
                            }}>
                              OR
                            </span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
                          </div>
                        )}
                        <label style={{
                          display: 'block',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#ffffff',
                          marginBottom: '0.375rem'
                        }}>
                          Create New Agent
                        </label>
                        <div style={{
                          padding: '0.5rem',
                          background: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          borderRadius: '6px',
                          marginBottom: '0.375rem'
                        }}>
                          <div style={{ fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--text-gray)' }}>
                            <div style={{ marginBottom: '0.375rem' }}>
                              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>Name:</span>{' '}
                              <span style={{ color: '#ffffff' }}>{step.agentSpec?.name}</span>
                            </div>
                            <div>
                              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>Description:</span>{' '}
                              <span style={{ color: 'var(--text-gray)' }}>{step.agentSpec?.description}</span>
                            </div>
                          </div>
                        </div>

                        {/* Server Pair Selection UI */}
                        {showServerPairSelection[step.stepId] ? (
                          <div style={{
                            padding: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            marginBottom: '0.5rem'
                          }}>
                            <label style={{
                              display: 'block',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              color: '#ffffff',
                              marginBottom: '0.5rem'
                            }}>
                              Select Server Pair
                            </label>
                            <select
                              value={selectedServerPairForCreation[step.stepId] || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setSelectedServerPairForCreation(prev => ({
                                    ...prev,
                                    [step.stepId]: e.target.value
                                  }));
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '0.625rem 0.875rem',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '0.8125rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                minHeight: '38px',
                                marginBottom: '0.5rem'
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.5)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                              }}
                            >
                              <option value="" style={{ background: '#111111' }}>-- Choose a server pair --</option>
                              {getAvailableServerPairs().map(pair => (
                                <option key={pair.pairId} value={pair.pairId} style={{ background: '#111111' }}>
                                  {pair.name}
                                </option>
                              ))}
                            </select>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => handleServerPairSelectedForCreation(step.stepId, selectedServerPairForCreation[step.stepId])}
                                disabled={!selectedServerPairForCreation[step.stepId] || isCreating}
                                style={{
                                  flex: 1,
                                  padding: '0.625rem 1rem',
                                  background: selectedServerPairForCreation[step.stepId] && !isCreating
                                    ? 'linear-gradient(135deg, #10B981, #059669)'
                                    : 'rgba(16, 185, 129, 0.3)',
                                  border: 'none',
                                  borderRadius: '6px',
                                  color: '#ffffff',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  cursor: selectedServerPairForCreation[step.stepId] && !isCreating ? 'pointer' : 'not-allowed',
                                  opacity: selectedServerPairForCreation[step.stepId] && !isCreating ? 1 : 0.5,
                                  transition: 'all 0.2s ease',
                                  minHeight: '38px'
                                }}
                              >
                                {isCreating ? '⏳ Creating...' : '✨ Create Agent'}
                              </button>
                              <button
                                onClick={() => handleCreateNewServerPairForAgent(step.stepId)}
                                disabled={isCreating}
                                style={{
                                  padding: '0.625rem 1rem',
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  borderRadius: '6px',
                                  color: '#3B82F6',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  cursor: isCreating ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s ease',
                                  minHeight: '38px',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isCreating) {
                                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isCreating) {
                                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                  }
                                }}
                              >
                                ➕ New Pair
                              </button>
                              <button
                                onClick={() => {
                                  setShowServerPairSelection(prev => {
                                    const next = { ...prev };
                                    delete next[step.stepId];
                                    return next;
                                  });
                                  setPendingAgentCreation(null);
                                }}
                                style={{
                                  padding: '0.625rem 0.75rem',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  border: '1px solid rgba(255, 255, 255, 0.2)',
                                  borderRadius: '6px',
                                  color: '#ffffff',
                                  fontSize: '0.8125rem',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  minHeight: '38px'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCreateAgent(step.stepId, step.agentSpec!)}
                            disabled={isCreating}
                            style={{
                              width: '100%',
                              padding: '0.625rem 1rem',
                              background: isCreating
                                ? 'rgba(59, 130, 246, 0.3)'
                                : 'linear-gradient(135deg, #3B82F6, #2563EB)',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#ffffff',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              cursor: isCreating ? 'not-allowed' : 'pointer',
                              opacity: isCreating ? 0.7 : 1,
                              transition: 'all 0.2s ease',
                              minHeight: '38px',
                              boxShadow: isCreating ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)'
                            }}
                            onMouseEnter={(e) => {
                              if (!isCreating) {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = isCreating ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)';
                            }}
                          >
                            {isCreating ? '⏳ Creating...' : `✨ Create "${step.agentSpec?.name}"`}
                          </button>
                        )}
                      </div>
                    )}

                    {!hasAgentSpec && existingAgents.length === 0 && (
                      <div style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        color: '#fbbf24'
                      }}>
                        ⚠️ No existing agents found and no agent spec provided. Please create an agent first.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons - More Compact */}
      <div className="flex gap-2 flex-shrink-0" style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '0.625rem 1.25rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            minHeight: '38px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleProceed}
          disabled={!allStepsHaveAgents}
          style={{
            flex: 1,
            padding: '0.625rem 1.25rem',
            background: allStepsHaveAgents
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : 'rgba(16, 185, 129, 0.3)',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: allStepsHaveAgents ? 'pointer' : 'not-allowed',
            opacity: allStepsHaveAgents ? 1 : 0.5,
            transition: 'all 0.2s ease',
            boxShadow: allStepsHaveAgents ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
            minHeight: '38px'
          }}
          onMouseEnter={(e) => {
            if (allStepsHaveAgents) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = allStepsHaveAgents ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none';
          }}
        >
          {allStepsHaveAgents 
            ? `✨ Create Workflow (${spec.steps.length} agents configured)` 
            : `Configure ${spec.steps.filter(s => !selectedAgents[s.stepId] && !s.agentCanisterId).length} more agent(s)`}
        </button>
      </div>

      {/* Server Pair Creation Dialog */}
      {showCreateServerPairDialog && (
        <ConfirmationDialog
          isOpen={showCreateServerPairDialog}
          title="Create New Server Pair"
          message="No available server pairs found. Each agent requires its own dedicated server pair (frontend + backend canister). Would you like to create a new server pair for this agent? This will allocate credits (default: 4,500, minimum: 2,500)."
          type="info"
          onConfirm={handleCreateServerPair}
          onCancel={() => {
            setShowCreateServerPairDialog(false);
            setPendingAgentCreation(null);
          }}
          confirmLabel="Create Server Pair"
          cancelLabel="Cancel"
        />
      )}

      {/* Server Pair Creation Progress */}
      {isCreatingServerPair && (
        <ProgressDialog
          isOpen={isCreatingServerPair}
          title="Creating Server Pair"
          message={serverPairCreationProgress || "Creating server pair..."}
          phase="creating"
          progress={serverPairCreationProgressPercent}
          onClose={() => {
            // Don't allow closing during creation
          }}
        />
      )}

      {/* Agent Creation Progress - Show for each step that's creating */}
      {Object.entries(agentCreationProgress).map(([stepId, progress]) => {
        const step = spec.steps.find(s => s.stepId === stepId);
        const agentName = step?.agentName || step?.agentSpec?.name || 'Agent';
        
        return (
          <ProgressDialog
            key={stepId}
            isOpen={true}
            title={`Deploying ${agentName}`}
            message={progress.message || "Deploying agent..."}
            phase="deploying"
            progress={progress.percent}
            onClose={() => {
              // Don't allow closing during creation
            }}
          />
        );
      })}
    </div>
  );
};

