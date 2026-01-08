/**
 * Component for selecting or creating agents and workflows for business agency
 */

import React, { useState, useEffect } from 'react';
import { useAppStore, useServerPairDialog, useCredits } from '../../store/appStore';
import { SpecToEntityConverter } from '../../services/SpecToEntityConverter';
import { AgencyService } from '../../services/AgencyService';
import { useCanister } from '../../useCanister';
import type { BusinessAgencySpec, WorkflowSpec } from '../../types/agentSpec';
import { WorkflowAgentSelection } from './WorkflowAgentSelection';
import { ProgressDialog } from './ProgressDialog';
import { icpPriceService } from '../../services/IcpPriceService';
import type { IcpPriceData } from '../../services/IcpPriceService';

interface AgencyResourceSelectionProps {
  spec: BusinessAgencySpec;
  onComplete: (updatedSpec: BusinessAgencySpec) => void;
  onCancel: () => void;
}

interface DeployedAgent {
  id: string;
  name: string;
  backendCanisterId: string;
  frontendCanisterId: string;
  status: string;
}

interface ExistingWorkflow {
  id: string;
  name: string;
  description: string;
}

interface ServerPair {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
}

export const AgencyResourceSelection: React.FC<AgencyResourceSelectionProps> = ({
  spec,
  onComplete,
  onCancel
}) => {
  const { activeProject, userCanisterId, identity, principal } = useAppStore();
  const { actor: mainActor } = useCanister();
  const { createServerPairForExistingProject } = useServerPairDialog();
  const { credits } = useCredits();
  
  const [existingAgents, setExistingAgents] = useState<DeployedAgent[]>([]);
  const [existingWorkflows, setExistingWorkflows] = useState<ExistingWorkflow[]>([]);
  const [availableServerPairs, setAvailableServerPairs] = useState<ServerPair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<Record<string, string>>({}); // agent index -> agentCanisterId
  const [selectedWorkflows, setSelectedWorkflows] = useState<Record<string, string>>({}); // workflow index -> workflowId
  const [creatingAgents, setCreatingAgents] = useState<Set<number>>(new Set());
  const [creatingWorkflows, setCreatingWorkflows] = useState<Set<number>>(new Set());
  const [showWorkflowAgentSelection, setShowWorkflowAgentSelection] = useState<number | null>(null); // workflow index
  const [converter] = useState(() => new SpecToEntityConverter());
  
  // Server pair selection/creation state for agents
  const [showServerPairSelection, setShowServerPairSelection] = useState<Record<number, boolean>>({}); // agent index -> true if showing selection
  const [selectedServerPairForCreation, setSelectedServerPairForCreation] = useState<Record<number, string>>({}); // agent index -> serverPairId
  const [pendingAgentCreation, setPendingAgentCreation] = useState<{ 
    agentIndex: number; 
    agentSpec: any;
  } | null>(null);
  const [isCreatingServerPair, setIsCreatingServerPair] = useState(false);
  const [serverPairCreationProgress, setServerPairCreationProgress] = useState<string>('');
  const [serverPairCreationProgressPercent, setServerPairCreationProgressPercent] = useState<number>(0);
  const [icpPriceData, setIcpPriceData] = useState<IcpPriceData | null>(null);
  const [isLoadingIcpPrice, setIsLoadingIcpPrice] = useState(true);
  
  // Agent creation progress state
  const [agentCreationProgress, setAgentCreationProgress] = useState<Record<number, { message: string; percent: number }>>({}); // agent index -> progress

  // Load ICP price data
  useEffect(() => {
    const loadIcpPrice = async () => {
      try {
        setIsLoadingIcpPrice(true);
        const priceData = await icpPriceService.getCurrentPrice();
        setIcpPriceData(priceData);
      } catch (error) {
        console.error('Failed to load ICP price data:', error);
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
    loadIcpPrice();
  }, []);

  // Load existing agents, workflows, and server pairs
  useEffect(() => {
    const loadResources = async () => {
      // Validate project ID
      const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || null;
      if (!projectId || typeof projectId !== 'string' || !userCanisterId || !identity) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Load agents
        const stored = localStorage.getItem(`deployed-agents-${projectId}`);
        if (stored) {
          const agents = JSON.parse(stored) as DeployedAgent[];
          setExistingAgents(agents.filter(a => a.status === 'active'));
        }

        // Load workflows
        const result = await AgencyService.getAgencies(
          projectId,
          userCanisterId,
          identity
        );
        if (result.success && result.agencies) {
          setExistingWorkflows(result.agencies.map(w => ({
            id: w.id,
            name: w.name,
            description: w.description || ''
          })));
        }

        // Load server pairs
        const { userCanisterService } = await import('../../services/UserCanisterService');
        const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
        const pairsResult = await userActor.getProjectServerPairs(projectId);
        
        if (pairsResult && 'ok' in pairsResult) {
          const pairs = pairsResult.ok.map((pair: any) => ({
            pairId: pair.pairId,
            name: pair.name,
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          setAvailableServerPairs(pairs);
        }
      } catch (error) {
        console.error('Failed to load resources:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadResources();
  }, [activeProject, userCanisterId, identity]);

  // Helper functions for server pair management
  const getMinimumCreditsRequired = () => {
    // Minimum credits needed for server pair creation (same as new project flow)
    return 1000;
  };

  const calculateServerConfigFromCredits = (credits: number) => {
    // Basic validation - same as workflow path
    if (credits < 1000) {
      return { canCreateServers: false, message: 'Insufficient credits. Minimum 1,000 credits required.' };
    }
    return { canCreateServers: true, message: '' };
  };

  const getAvailableServerPairsForAgent = (agentIndex: number) => {
    // Get server pairs that aren't already assigned to other agents being created
    const assignedPairIds = new Set(
      Object.entries(selectedServerPairForCreation)
        .filter(([idx]) => idx !== agentIndex.toString())
        .map(([, pairId]) => pairId)
    );
    return availableServerPairs.filter(pair => !assignedPairIds.has(pair.pairId));
  };

  const handleAgentSelection = (agentIndex: number, agentCanisterId: string) => {
    setSelectedAgents(prev => ({
      ...prev,
      [agentIndex]: agentCanisterId
    }));
    // Clear server pair selection when selecting existing agent
    setShowServerPairSelection(prev => {
      const next = { ...prev };
      delete next[agentIndex];
      return next;
    });
    setSelectedServerPairForCreation(prev => {
      const next = { ...prev };
      delete next[agentIndex];
      return next;
    });
  };

  const handleWorkflowSelection = (workflowIndex: number, workflowId: string) => {
    setSelectedWorkflows(prev => ({
      ...prev,
      [workflowIndex]: workflowId
    }));
  };

  const handleShowServerPairSelection = (agentIndex: number, agentSpec: any) => {
    setPendingAgentCreation({ agentIndex, agentSpec });
    setShowServerPairSelection(prev => ({ ...prev, [agentIndex]: true }));
  };

  const handleServerPairSelectedForCreation = async (agentIndex: number, serverPairId: string) => {
    if (!pendingAgentCreation || pendingAgentCreation.agentIndex !== agentIndex) {
      return;
    }

    // Hide selection UI
    setShowServerPairSelection(prev => {
      const next = { ...prev };
      delete next[agentIndex];
      return next;
    });

    // Store selection
    setSelectedServerPairForCreation(prev => ({
      ...prev,
      [agentIndex]: serverPairId
    }));

    // Create agent with selected server pair
    await createAgentWithServerPair(agentIndex, pendingAgentCreation.agentSpec, serverPairId);
    
    // Clear pending
    setPendingAgentCreation(null);
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
      const defaultCredits = 4400;
      const minimumCredits = getMinimumCreditsRequired();
      const userCredits = credits?.balance || 0;
      
      if (userCredits < minimumCredits) {
        throw new Error(`Insufficient credits. You need at least ${minimumCredits.toLocaleString()} credits to create a server pair, but you only have ${userCredits.toLocaleString()}.`);
      }

      const finalCredits = Math.max(minimumCredits, Math.min(defaultCredits, userCredits));

      // Validate server config
      const serverConfig = calculateServerConfigFromCredits(finalCredits);
      if (!serverConfig.canCreateServers) {
        throw new Error(serverConfig.message);
      }

      setServerPairCreationProgress('Creating server pair...');

      // Use agent name for server pair naming
      const agentName = pendingAgentCreation.agentSpec?.name || `Agent ${pendingAgentCreation.agentIndex + 1}`;
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
        }
      );

      if (!result.success || !result.serverPairId) {
        throw new Error(result.error || 'Failed to create server pair');
      }

      setServerPairCreationProgress('Refreshing server pairs list...');
      setServerPairCreationProgressPercent(90);

      // Refresh server pairs list
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
            frontendCanisterId: pair.frontendCanisterId.toText(),
            backendCanisterId: pair.backendCanisterId.toText()
          }));
          
          const foundPair = pairs.find((p: any) => p.pairId === result.serverPairId);
          if (foundPair) {
            setAvailableServerPairs(pairs);
            break;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        retries++;
      }
      
      if (retries >= maxRetries) {
        throw new Error(`Server pair ${result.serverPairId} was created but not found in project. Please try again.`);
      }

      setServerPairCreationProgress('Server pair ready!');
      setServerPairCreationProgressPercent(100);

      // Store pending agent creation before clearing state
      const pendingAgentIndex = pendingAgentCreation.agentIndex;
      const pendingAgentSpec = pendingAgentCreation.agentSpec;
      const newServerPairId = result.serverPairId;

      // Close dialog
      setPendingAgentCreation(null);
      setIsCreatingServerPair(false);
      setServerPairCreationProgress('');
      setServerPairCreationProgressPercent(0);

      // Hide server pair selection UI
      setShowServerPairSelection(prev => {
        const next = { ...prev };
        delete next[pendingAgentIndex];
        return next;
      });

      // Store selection
      setSelectedServerPairForCreation(prev => ({
        ...prev,
        [pendingAgentIndex]: newServerPairId
      }));

      // Create agent with new server pair
      await createAgentWithServerPair(pendingAgentIndex, pendingAgentSpec, newServerPairId);
    } catch (error) {
      console.error('Server pair creation failed:', error);
      alert(`Failed to create server pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsCreatingServerPair(false);
      setServerPairCreationProgress('');
      setServerPairCreationProgressPercent(0);
    }
  };

  const createAgentWithServerPair = async (agentIndex: number, agentSpec: any, serverPairId: string) => {
    if (!activeProject || !userCanisterId || !identity || !principal) {
      alert('Missing required project or authentication information');
      return;
    }

    // Validate serverPairId
    if (!serverPairId || typeof serverPairId !== 'string' || serverPairId.trim() === '') {
      console.error('Invalid serverPairId:', serverPairId);
      alert(`Invalid server pair ID: ${serverPairId}. Please try creating the server pair again.`);
      return;
    }

    setCreatingAgents(prev => new Set([...prev, agentIndex]));
    
    // Initialize progress
    setAgentCreationProgress(prev => ({
      ...prev,
      [agentIndex]: { message: 'Initializing agent deployment...', percent: 0 }
    }));

    try {
      const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || null;
      
      const conversionContext = {
        projectId,
        userCanisterId,
        identity,
        principal,
        serverPairId: serverPairId.trim()
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
            [agentIndex]: { message: progressMessage, percent: progressPercent }
          }));
        }
      );

      if (result.success && result.entityId) {
        setSelectedAgents(prev => ({
          ...prev,
          [agentIndex]: result.entityId!
        }));

        // Refresh agents list
        const stored = localStorage.getItem(`deployed-agents-${projectId}`);
        if (stored) {
          try {
            const agents = JSON.parse(stored);
            setExistingAgents(agents.filter((a: any) => a.status === 'active'));
          } catch (error) {
            console.error('Failed to refresh agents:', error);
          }
        }

        setAgentCreationProgress(prev => ({
          ...prev,
          [agentIndex]: { message: `Agent "${result.entityName}" created successfully!`, percent: 100 }
        }));
        
        // Auto-close after success
        setTimeout(() => {
          setAgentCreationProgress(prev => {
            const next = { ...prev };
            delete next[agentIndex];
            return next;
          });
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to create agent');
      }
    } catch (error) {
      console.error('Agent creation failed:', error);
      setAgentCreationProgress(prev => ({
        ...prev,
        [agentIndex]: { message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, percent: 0 }
      }));
      
      // Keep error visible for a bit, then clear
      setTimeout(() => {
        setAgentCreationProgress(prev => {
          const next = { ...prev };
          delete next[agentIndex];
          return next;
        });
      }, 5000);
      
      alert(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCreatingAgents(prev => {
        const next = new Set(prev);
        next.delete(agentIndex);
        return next;
      });
    }
  };

  const handleCreateWorkflow = async (workflowIndex: number, workflowSpec: WorkflowSpec) => {
    // Validate and extract projectId as string
    const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || null;
    
    if (!projectId || typeof projectId !== 'string' || !userCanisterId || !identity || !principal) {
      alert('Missing required project or authentication information');
      return;
    }

    // Check if workflow needs agent selection first
    const stepsNeedingAgents = workflowSpec.steps.filter(step => 
      !step.agentCanisterId && step.agentSpec
    );

    if (stepsNeedingAgents.length > 0) {
      // Show workflow agent selection for this workflow
      setShowWorkflowAgentSelection(workflowIndex);
      return;
    }

    // Proceed with workflow creation
    await proceedWithWorkflowCreation(workflowIndex, workflowSpec);
  };

  const proceedWithWorkflowCreation = async (workflowIndex: number, workflowSpec: WorkflowSpec) => {
    setCreatingWorkflows(prev => new Set([...prev, workflowIndex]));

    try {
      // Validate and extract projectId as string
      const projectId = typeof activeProject === 'string' ? activeProject : (activeProject as any)?.id || null;
      
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Invalid project ID. Please select a project first.');
      }
      
      if (!userCanisterId || typeof userCanisterId !== 'string') {
        throw new Error('Missing user canister ID. Please ensure you are authenticated.');
      }
      
      if (!identity || !principal) {
        throw new Error('Missing authentication information. Please ensure you are authenticated.');
      }

      // Get server pair
      const { userCanisterService } = await import('../../services/UserCanisterService');
      const userActor = await userCanisterService.getUserActor(userCanisterId, identity);
      const pairsResult = await userActor.getProjectServerPairs(projectId);
      
      if (!pairsResult || !('ok' in pairsResult) || pairsResult.ok.length === 0) {
        throw new Error('No server pair available. Please create one first.');
      }

      const serverPairId = pairsResult.ok[0].pairId;

      const result = await converter.createWorkflowFromSpec(workflowSpec, {
        projectId,
        userCanisterId,
        identity,
        principal,
        serverPairId
      });

      if (result.success && result.entityId) {
        setSelectedWorkflows(prev => ({
          ...prev,
          [workflowIndex]: result.entityId!
        }));

        // Refresh workflows list
        const workflowsResult = await AgencyService.getAgencies(
          projectId,
          userCanisterId,
          identity
        );
        if (workflowsResult.success && workflowsResult.agencies) {
          setExistingWorkflows(workflowsResult.agencies.map(w => ({
            id: w.id,
            name: w.name,
            description: w.description || ''
          })));
        }

        alert(`Workflow "${result.entityName}" created successfully!`);
      } else {
        throw new Error(result.error || 'Failed to create workflow');
      }
    } catch (error) {
      console.error('Workflow creation failed:', error);
      alert(`Failed to create workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCreatingWorkflows(prev => {
        const next = new Set(prev);
        next.delete(workflowIndex);
        return next;
      });
    }
  };

  const handleWorkflowAgentSelectionComplete = async (workflowIndex: number, updatedWorkflowSpec: WorkflowSpec) => {
    setShowWorkflowAgentSelection(null);
    await proceedWithWorkflowCreation(workflowIndex, updatedWorkflowSpec);
  };

  const handleProceed = () => {
    // Update spec with selected agents and workflows
    const updatedSpec: BusinessAgencySpec = {
      ...spec,
      agents: spec.agents.map((agent, index) => {
        const selectedAgentId = selectedAgents[index];
        if (selectedAgentId) {
          return {
            ...agent,
            agentCanisterId: selectedAgentId,
            agentSpec: undefined // Clear agentSpec since we're using existing agent
          };
        }
        return agent;
      }),
      workflows: spec.workflows.map((workflow, index) => {
        const selectedWorkflowId = selectedWorkflows[index];
        if (selectedWorkflowId) {
          return {
            ...workflow,
            workflowId: selectedWorkflowId,
            workflowSpec: undefined // Clear workflowSpec since we're using existing workflow
          };
        }
        return workflow;
      })
    };

    // Validate all agents and workflows are configured
    const missingAgents = updatedSpec.agents.filter((agent, index) => !agent.agentCanisterId);
    const missingWorkflows = updatedSpec.workflows.filter((workflow, index) => !workflow.workflowId);

    if (missingAgents.length > 0 || missingWorkflows.length > 0) {
      const missing = [
        ...missingAgents.map((a, i) => `Agent: ${a.role || `Agent ${i + 1}`}`),
        ...missingWorkflows.map((w, i) => `Workflow: ${w.purpose || `Workflow ${i + 1}`}`)
      ];
      alert(`Please select or create all required resources:\n${missing.join('\n')}`);
      return;
    }

    onComplete(updatedSpec);
  };

  const allResourcesConfigured = 
    spec.agents.every((agent, index) => selectedAgents[index] || agent.agentCanisterId) &&
    spec.workflows.every((workflow, index) => selectedWorkflows[index] || workflow.workflowId);

  // If showing workflow agent selection, render that instead
  if (showWorkflowAgentSelection !== null) {
    const workflow = spec.workflows[showWorkflowAgentSelection];
    if (workflow.workflowSpec) {
      return (
        <WorkflowAgentSelection
          spec={workflow.workflowSpec}
          availableServerPairs={availableServerPairs}
          onComplete={(updatedSpec) => {
            // Update the workflow spec in the agency spec and proceed
            handleWorkflowAgentSelectionComplete(showWorkflowAgentSelection, updatedSpec);
          }}
          onCancel={() => setShowWorkflowAgentSelection(null)}
        />
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ gap: '1rem' }}>
        <div className="text-white text-lg font-medium" style={{ fontSize: '1.125rem' }}>
          Loading resources...
        </div>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: '#10B981',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Calculate progress
  const configuredAgents = spec.agents.filter((agent, index) => 
    selectedAgents[index] || agent.agentCanisterId
  ).length;
  const configuredWorkflows = spec.workflows.filter((workflow, index) => 
    selectedWorkflows[index] || workflow.workflowId
  ).length;
  const totalRequired = spec.agents.length + spec.workflows.length;
  const totalConfigured = configuredAgents + configuredWorkflows;
  const progressPercent = totalRequired > 0 ? (totalConfigured / totalRequired) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0, maxHeight: '100%', overflow: 'hidden', padding: '0.75rem' }}>
      {/* Header with Progress Summary */}
      <div className="flex-shrink-0 mb-4" style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>
              Configure Agency Resources
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-gray)', margin: 0, lineHeight: 1.4 }}>
              Select existing resources or create new ones for this agency.
              {spec.agents.some(a => a.agentSpec) && (
                <span style={{ display: 'block', marginTop: '0.375rem', color: 'rgba(59, 130, 246, 0.9)' }}>
                  💡 Each new agent requires its own dedicated server pair.
                </span>
              )}
            </p>
          </div>
          {/* Progress Indicator */}
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            minWidth: '140px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Progress
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10B981', marginBottom: '0.25rem' }}>
              {totalConfigured}/{totalRequired}
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: progressPercent === 100 
                  ? 'linear-gradient(90deg, #10B981, #059669)' 
                  : 'linear-gradient(90deg, #3B82F6, #2563EB)',
                transition: 'width 0.3s ease',
                borderRadius: '3px'
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, paddingRight: '0.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Agents Section - Grid Layout */}
          {spec.agents.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1rem' }}>🤖</span>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                  Agents <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 400 }}>({configuredAgents}/{spec.agents.length})</span>
                </h4>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(380px, 100%), 1fr))',
                gap: '0.75rem',
                alignItems: 'start'
              }}>
                {spec.agents.map((agent, index) => {
                  const selectedAgentId = selectedAgents[index] || agent.agentCanisterId;
                  const isCreating = creatingAgents.has(index);
                  const hasAgentSpec = !!agent.agentSpec;
                  const selectedAgent = existingAgents.find(a => a.backendCanisterId === selectedAgentId);

                  return (
                    <div
                      key={index}
                      style={{
                        padding: '0.875rem',
                        background: selectedAgentId 
                          ? 'rgba(16, 185, 129, 0.08)' 
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
                      {/* Compact Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <div style={{
                              width: '24px',
                              height: '24px',
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
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: selectedAgentId ? '#10B981' : '#3B82F6',
                              flexShrink: 0
                            }}>
                              {index + 1}
                            </div>
                            <h5 style={{ 
                              fontSize: '0.9375rem', 
                              fontWeight: 600, 
                              color: '#ffffff', 
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {agent.role}
                            </h5>
                          </div>
                          {agent.agentSpec && (
                            <p style={{ 
                              fontSize: '0.75rem', 
                              color: 'var(--text-gray)', 
                              margin: '0 0 0 1.75rem',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {agent.agentSpec.description}
                            </p>
                          )}
                        </div>
                        {selectedAgentId && (
                          <div style={{
                            padding: '0.25rem 0.5rem',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#10B981',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <span>✓</span>
                            <span>Done</span>
                          </div>
                        )}
                      </div>

                      {selectedAgentId ? (
                        <div style={{ 
                          padding: '0.625rem',
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: '6px',
                          fontSize: '0.8125rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                Selected Agent
                              </div>
                              <div style={{ color: '#ffffff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {selectedAgent?.name || selectedAgentId.slice(0, 20) + '...'}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedAgents(prev => {
                                  const next = { ...prev };
                                  delete next[index];
                                  return next;
                                });
                              }}
                              style={{
                                padding: '0.25rem 0.5rem',
                                background: 'rgba(107, 114, 128, 0.15)',
                                border: '1px solid rgba(107, 114, 128, 0.3)',
                                borderRadius: '4px',
                                color: '#9CA3AF',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                                e.currentTarget.style.color = '#ef4444';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(107, 114, 128, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.3)';
                                e.currentTarget.style.color = '#9CA3AF';
                              }}
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {existingAgents.length > 0 && (
                            <div>
                              <label style={{ 
                                display: 'block',
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                color: '#ffffff', 
                                marginBottom: '0.375rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                Select Existing Agent
                              </label>
                              {/* Visual Agent Cards */}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                gap: '0.5rem',
                                marginBottom: hasAgentSpec ? '0.5rem' : '0'
                              }}>
                                {existingAgents.slice(0, 6).map(agentOption => (
                                  <button
                                    key={agentOption.id}
                                    onClick={() => handleAgentSelection(index, agentOption.backendCanisterId)}
                                    style={{
                                      padding: '0.625rem',
                                      background: selectedAgents[index] === agentOption.backendCanisterId
                                        ? 'rgba(59, 130, 246, 0.2)'
                                        : 'rgba(255, 255, 255, 0.03)',
                                      border: `1px solid ${selectedAgents[index] === agentOption.backendCanisterId
                                        ? 'rgba(59, 130, 246, 0.4)'
                                        : 'rgba(255, 255, 255, 0.1)'}`,
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (selectedAgents[index] !== agentOption.backendCanisterId) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (selectedAgents[index] !== agentOption.backendCanisterId) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                      }
                                    }}
                                  >
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {agentOption.name}
                                    </div>
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-gray)' }}>
                                      {agentOption.status}
                                    </div>
                                  </button>
                                ))}
                              </div>
                              {existingAgents.length > 6 && (
                                <select
                                  value={selectedAgents[index] || ''}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAgentSelection(index, e.target.value);
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
                                    marginTop: '0.5rem'
                                  }}
                                  onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                  }}
                                  onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                  }}
                                >
                                  <option value="" style={{ background: '#111111' }}>-- Or choose from {existingAgents.length - 6} more --</option>
                                  {existingAgents.slice(6).map(agentOption => (
                                    <option key={agentOption.id} value={agentOption.backendCanisterId} style={{ background: '#111111' }}>
                                      {agentOption.name} ({agentOption.status})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}

                          {hasAgentSpec && (
                            <div>
                              {existingAgents.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                                  <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
                                  <span style={{ fontSize: '0.6875rem', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                    OR
                                  </span>
                                  <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
                                </div>
                              )}
                              <label style={{ 
                                display: 'block',
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                color: '#ffffff', 
                                marginBottom: '0.375rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                Create New Agent
                              </label>
                              <div style={{
                                padding: '0.75rem',
                                background: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                borderRadius: '8px',
                                marginBottom: '0.5rem'
                              }}>
                                <div style={{ fontSize: '0.8125rem', lineHeight: 1.4 }}>
                                  <div style={{ marginBottom: '0.375rem' }}>
                                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>Name:</span>{' '}
                                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{agent.agentSpec?.name}</span>
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                                    {agent.agentSpec?.description}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Server Pair Selection UI - Compact */}
                              {showServerPairSelection[index] ? (
                                <div style={{
                                  padding: '0.625rem',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '6px',
                                  marginBottom: '0.5rem'
                                }}>
                                  <label style={{
                                    display: 'block',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    marginBottom: '0.375rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    Server Pair
                                  </label>
                                  <select
                                    value={selectedServerPairForCreation[index] || ''}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        setSelectedServerPairForCreation(prev => ({
                                          ...prev,
                                          [index]: e.target.value
                                        }));
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
                                      minHeight: '36px',
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
                                    {getAvailableServerPairsForAgent(index).map(pair => (
                                      <option key={pair.pairId} value={pair.pairId} style={{ background: '#111111' }}>
                                        {pair.name}
                                      </option>
                                    ))}
                                  </select>
                                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                                    <button
                                      onClick={() => handleServerPairSelectedForCreation(index, selectedServerPairForCreation[index])}
                                      disabled={!selectedServerPairForCreation[index] || isCreating}
                                      style={{
                                        flex: 1,
                                        padding: '0.5rem 0.75rem',
                                        background: selectedServerPairForCreation[index] && !isCreating
                                          ? 'linear-gradient(135deg, #10B981, #059669)'
                                          : 'rgba(16, 185, 129, 0.3)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: '#ffffff',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: selectedServerPairForCreation[index] && !isCreating ? 'pointer' : 'not-allowed',
                                        opacity: selectedServerPairForCreation[index] && !isCreating ? 1 : 0.5,
                                        transition: 'all 0.2s ease',
                                        minHeight: '32px'
                                      }}
                                    >
                                      Create
                                    </button>
                                    <button
                                      onClick={handleCreateServerPair}
                                      disabled={isCreatingServerPair || !mainActor || !icpPriceData}
                                      style={{
                                        padding: '0.5rem 0.75rem',
                                        background: isCreatingServerPair || !mainActor || !icpPriceData
                                          ? 'rgba(59, 130, 246, 0.3)'
                                          : 'rgba(59, 130, 246, 0.15)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        borderRadius: '6px',
                                        color: '#3B82F6',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: isCreatingServerPair || !mainActor || !icpPriceData ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s ease',
                                        minHeight: '32px',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      ➕ New
                                    </button>
                                    <button
                                      onClick={() => {
                                        setShowServerPairSelection(prev => {
                                          const next = { ...prev };
                                          delete next[index];
                                          return next;
                                        });
                                        setPendingAgentCreation(null);
                                      }}
                                      style={{
                                        padding: '0.5rem 0.625rem',
                                        background: 'rgba(107, 114, 128, 0.15)',
                                        border: '1px solid rgba(107, 114, 128, 0.3)',
                                        borderRadius: '6px',
                                        color: '#9CA3AF',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        minHeight: '32px'
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleShowServerPairSelection(index, agent.agentSpec!)}
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
                                    boxShadow: isCreating ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.25)'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isCreating) {
                                      e.currentTarget.style.transform = 'translateY(-1px)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = isCreating ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.25)';
                                  }}
                                >
                                  {isCreating ? '⏳ Creating...' : `✨ Create Agent`}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Workflows Section - Grid Layout */}
          {spec.workflows.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1rem' }}>🔄</span>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                  Workflows <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 400 }}>({configuredWorkflows}/{spec.workflows.length})</span>
                </h4>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(380px, 100%), 1fr))',
                gap: '0.75rem',
                alignItems: 'start'
              }}>
                {spec.workflows.map((workflow, index) => {
                  const selectedWorkflowId = selectedWorkflows[index] || workflow.workflowId;
                  const isCreating = creatingWorkflows.has(index);
                  const hasWorkflowSpec = !!workflow.workflowSpec;
                  const selectedWorkflow = existingWorkflows.find(w => w.id === selectedWorkflowId);

                  return (
                    <div
                      key={index}
                      style={{
                        padding: '0.875rem',
                        background: selectedWorkflowId 
                          ? 'rgba(16, 185, 129, 0.08)' 
                          : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${selectedWorkflowId 
                          ? 'rgba(16, 185, 129, 0.3)' 
                          : 'rgba(139, 92, 246, 0.2)'}`,
                        borderRadius: '10px',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedWorkflowId ? '0 2px 8px rgba(16, 185, 129, 0.1)' : 'none',
                        height: 'fit-content'
                      }}
                      onMouseEnter={(e) => {
                        if (!selectedWorkflowId) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedWorkflowId) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.2)';
                        }
                      }}
                    >
                      {/* Compact Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <div style={{
                              width: '24px',
                              height: '24px',
                              background: selectedWorkflowId 
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))' 
                                : 'rgba(139, 92, 246, 0.15)',
                              border: `1px solid ${selectedWorkflowId 
                                ? 'rgba(16, 185, 129, 0.4)' 
                                : 'rgba(139, 92, 246, 0.3)'}`,
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: selectedWorkflowId ? '#10B981' : '#8B5CF6',
                              flexShrink: 0
                            }}>
                              {index + 1}
                            </div>
                            <h5 style={{ 
                              fontSize: '0.9375rem', 
                              fontWeight: 600, 
                              color: '#ffffff', 
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {workflow.purpose}
                            </h5>
                          </div>
                          {workflow.workflowSpec && (
                            <p style={{ 
                              fontSize: '0.75rem', 
                              color: 'var(--text-gray)', 
                              margin: '0 0 0 1.75rem',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {workflow.workflowSpec.description}
                            </p>
                          )}
                        </div>
                        {selectedWorkflowId && (
                          <div style={{
                            padding: '0.25rem 0.5rem',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#10B981',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <span>✓</span>
                            <span>Done</span>
                          </div>
                        )}
                      </div>

                      {selectedWorkflowId ? (
                        <div style={{ 
                          padding: '0.625rem',
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: '6px',
                          fontSize: '0.8125rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                Selected Workflow
                              </div>
                              <div style={{ color: '#ffffff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {selectedWorkflow?.name || selectedWorkflowId.slice(0, 20) + '...'}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedWorkflows(prev => {
                                  const next = { ...prev };
                                  delete next[index];
                                  return next;
                                });
                              }}
                              style={{
                                padding: '0.25rem 0.5rem',
                                background: 'rgba(107, 114, 128, 0.15)',
                                border: '1px solid rgba(107, 114, 128, 0.3)',
                                borderRadius: '4px',
                                color: '#9CA3AF',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                                e.currentTarget.style.color = '#ef4444';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(107, 114, 128, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.3)';
                                e.currentTarget.style.color = '#9CA3AF';
                              }}
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {existingWorkflows.length > 0 && (
                            <div>
                              <label style={{ 
                                display: 'block',
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                color: '#ffffff', 
                                marginBottom: '0.375rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                Select Existing Workflow
                              </label>
                              {/* Visual Workflow Cards */}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                gap: '0.5rem',
                                marginBottom: hasWorkflowSpec ? '0.5rem' : '0'
                              }}>
                                {existingWorkflows.slice(0, 6).map(workflowOption => (
                                  <button
                                    key={workflowOption.id}
                                    onClick={() => handleWorkflowSelection(index, workflowOption.id)}
                                    style={{
                                      padding: '0.625rem',
                                      background: selectedWorkflows[index] === workflowOption.id
                                        ? 'rgba(139, 92, 246, 0.2)'
                                        : 'rgba(255, 255, 255, 0.03)',
                                      border: `1px solid ${selectedWorkflows[index] === workflowOption.id
                                        ? 'rgba(139, 92, 246, 0.4)'
                                        : 'rgba(255, 255, 255, 0.1)'}`,
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (selectedWorkflows[index] !== workflowOption.id) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (selectedWorkflows[index] !== workflowOption.id) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                      }
                                    }}
                                  >
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {workflowOption.name}
                                    </div>
                                    {workflowOption.description && (
                                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {workflowOption.description}
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                              {existingWorkflows.length > 6 && (
                                <select
                                  value={selectedWorkflows[index] || ''}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleWorkflowSelection(index, e.target.value);
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
                                    marginTop: '0.5rem'
                                  }}
                                  onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                  }}
                                  onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                  }}
                                >
                                  <option value="" style={{ background: '#111111' }}>-- Or choose from {existingWorkflows.length - 6} more --</option>
                                  {existingWorkflows.slice(6).map(workflowOption => (
                                    <option key={workflowOption.id} value={workflowOption.id} style={{ background: '#111111' }}>
                                      {workflowOption.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}

                          {hasWorkflowSpec && (
                            <div>
                              {existingWorkflows.length > 0 && (
                                <div className="flex items-center gap-3 my-3">
                                  <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
                                  <span className="text-gray-400 text-xs font-medium" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR</span>
                                  <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
                                </div>
                              )}
                              <label className="block text-sm font-semibold text-white mb-2.5" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                Create New Workflow
                              </label>
                              <div style={{
                                padding: '1.25rem',
                                background: 'rgba(139, 92, 246, 0.08)',
                                border: '1px solid rgba(139, 92, 246, 0.25)',
                                borderRadius: '12px',
                                marginBottom: '0.75rem'
                              }}>
                                <div className="text-sm text-gray-300" style={{ fontSize: '0.875rem', lineHeight: '1.6' }}>
                                  <div className="mb-1.5">
                                    <span className="text-gray-400 font-medium">Name:</span>{' '}
                                    <span className="text-white">{workflow.workflowSpec?.name}</span>
                                  </div>
                                  <div className="mb-1.5">
                                    <span className="text-gray-400 font-medium">Description:</span>{' '}
                                    <span className="text-gray-300">{workflow.workflowSpec?.description}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400 font-medium">Steps:</span>{' '}
                                    <span className="text-white">{workflow.workflowSpec?.steps.length || 0} agent(s)</span>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleCreateWorkflow(index, workflow.workflowSpec!)}
                                disabled={isCreating}
                                style={{
                                  width: '100%',
                                  padding: '0.875rem 1.5rem',
                                  background: isCreating
                                    ? 'rgba(139, 92, 246, 0.3)'
                                    : 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                                  border: 'none',
                                  borderRadius: '10px',
                                  color: '#ffffff',
                                  fontSize: '0.9375rem',
                                  fontWeight: 600,
                                  cursor: isCreating ? 'not-allowed' : 'pointer',
                                  opacity: isCreating ? 0.7 : 1,
                                  transition: 'all 0.2s ease',
                                  boxShadow: isCreating ? 'none' : '0 4px 14px rgba(139, 92, 246, 0.25)'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isCreating) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.35)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = isCreating ? 'none' : '0 4px 14px rgba(139, 92, 246, 0.25)';
                                }}
                              >
                                {isCreating ? '⏳ Creating Workflow...' : `✨ Create "${workflow.workflowSpec?.name}" Workflow`}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-shrink-0" style={{ paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '0.875rem 1.75rem',
            background: 'rgba(107, 114, 128, 0.15)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
            borderRadius: '10px',
            color: '#9CA3AF',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(107, 114, 128, 0.25)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(107, 114, 128, 0.15)';
            e.currentTarget.style.color = '#9CA3AF';
            e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.3)';
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleProceed}
          disabled={!allResourcesConfigured}
          style={{
            flex: 1,
            padding: '0.875rem 1.75rem',
            background: allResourcesConfigured
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : 'rgba(16, 185, 129, 0.3)',
            border: 'none',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: allResourcesConfigured ? 'pointer' : 'not-allowed',
            opacity: allResourcesConfigured ? 1 : 0.5,
            transition: 'all 0.2s ease',
            boxShadow: allResourcesConfigured ? '0 4px 14px rgba(16, 185, 129, 0.25)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (allResourcesConfigured) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.35)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = allResourcesConfigured ? '0 4px 14px rgba(16, 185, 129, 0.25)' : 'none';
          }}
        >
          {allResourcesConfigured 
            ? `✨ Create Agency (${spec.agents.length} agents, ${spec.workflows.length} workflows)` 
            : `Configure ${spec.agents.filter((a, i) => !selectedAgents[i] && !a.agentCanisterId).length + spec.workflows.filter((w, i) => !selectedWorkflows[i] && !w.workflowId).length} more resource(s)`}
        </button>
      </div>

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

      {/* Agent Creation Progress - Show for each agent that's creating */}
      {Object.entries(agentCreationProgress).map(([agentIndex, progress]) => {
        const agent = spec.agents[parseInt(agentIndex)];
        const agentName = agent?.agentSpec?.name || agent?.role || 'Agent';
        
        return (
          <ProgressDialog
            key={agentIndex}
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

