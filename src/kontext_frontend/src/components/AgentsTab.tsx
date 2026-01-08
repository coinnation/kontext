import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { AgentIntegrationService, IntegratedAgent } from '../services/AgentIntegrationService';
import { WorkflowIntegrationService, IntegratedWorkflow } from '../services/WorkflowIntegrationService';
import { BusinessAgencyIntegrationService, IntegratedBusinessAgency } from '../services/BusinessAgencyIntegrationService';
import { WorkflowContextualAwarenessService } from '../services/WorkflowContextualAwarenessService';
import { BusinessAgencyContextualAwarenessService } from '../services/BusinessAgencyContextualAwarenessService';
import { AgencyService } from '../services/AgencyService';
import type { AgentIdentity } from '../../candid/agent.did.d.ts';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as agentIdlFactory } from '../../candid/agent.did.js';
import { ProgressDialog } from './aiAssistant/ProgressDialog';

interface AgentsTabProps {
  isMobile: boolean;
}

interface AvailableAgent {
  canisterId: string;
  name: string;
  description?: string;
  status: string;
}

export const AgentsTab: React.FC<AgentsTabProps> = ({ isMobile }) => {
  const activeProject = useAppStore(state => state.activeProject);
  const identity = useAppStore(state => state.identity);
  const userCanisterId = useAppStore(state => state.userCanisterId);
  
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([]);
  const [integratedAgents, setIntegratedAgents] = useState<IntegratedAgent[]>([]);
  const [availableWorkflows, setAvailableWorkflows] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [integratedWorkflows, setIntegratedWorkflows] = useState<IntegratedWorkflow[]>([]);
  const [availableBusinessAgencies, setAvailableBusinessAgencies] = useState<Array<{ id: string; name: string; description: string; category: string; icon: string }>>([]);
  const [integratedBusinessAgencies, setIntegratedBusinessAgencies] = useState<IntegratedBusinessAgency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIntegrating, setIsIntegrating] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'agent' | 'workflow' | 'business-agency'>('agent');
  const [selectedAgent, setSelectedAgent] = useState<AvailableAgent | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [selectedBusinessAgency, setSelectedBusinessAgency] = useState<string | null>(null);
  const [integrationLevel, setIntegrationLevel] = useState<'minimal' | 'moderate' | 'deep' | 'autonomous'>('moderate');
  const [workflowIntegrationLevel, setWorkflowIntegrationLevel] = useState<'execution' | 'monitoring' | 'full'>('full');
  const [businessAgencyIntegrationType, setBusinessAgencyIntegrationType] = useState<'dashboard' | 'metrics' | 'goals' | 'full'>('full');
  const [integrationProgress, setIntegrationProgress] = useState<{ message: string; percent: number } | null>(null);
  
  // Load available agents from localStorage
  useEffect(() => {
    if (!activeProject) return;
    
    const loadAgents = async () => {
      setIsLoading(true);
      try {
        // Load deployed agents
        const stored = localStorage.getItem(`deployed-agents-${activeProject}`);
        if (stored) {
          const agents = JSON.parse(stored);
          const activeAgents = agents.filter((a: any) => a.status === 'active');
          
          // Fetch agent identities for descriptions
          const agentsWithData = await Promise.all(
            activeAgents.map(async (agent: any) => {
              try {
                if (!identity) return null;
                
                const agentActor = Actor.createActor(agentIdlFactory, {
                  agent: new HttpAgent({
                    identity,
                    host: window.location.hostname === 'localhost' ? 'http://localhost:4943' : 'https://ic0.app'
                  }),
                  canisterId: agent.backendCanisterId
                });
                
                const agentIdentity = await agentActor.getAgentIdentity();
                if (agentIdentity.length === 0) return null;
                
                return {
                  canisterId: agent.backendCanisterId,
                  name: agent.name || agentIdentity[0].name,
                  description: agentIdentity[0].description,
                  status: agent.status
                };
              } catch (error) {
                console.warn(`Failed to load agent ${agent.backendCanisterId}:`, error);
                return {
                  canisterId: agent.backendCanisterId,
                  name: agent.name,
                  description: undefined,
                  status: agent.status
                };
              }
            })
          );
          
          setAvailableAgents(agentsWithData.filter(Boolean) as AvailableAgent[]);
        }
        
        // Load integrated agents
        const integrations = AgentIntegrationService.getProjectIntegrations(activeProject);
        setIntegratedAgents(integrations);
        
        // Load workflows
        if (userCanisterId && identity) {
          const workflowsResult = await AgencyService.getAgencies(
            activeProject,
            userCanisterId,
            identity
          );
          
          if (workflowsResult.success) {
            setAvailableWorkflows(workflowsResult.agencies.map(a => ({
              id: a.id,
              name: a.name,
              description: a.description
            })));
          }
          
          // Load integrated workflows
          const workflowIntegrations = WorkflowIntegrationService.getProjectWorkflowIntegrations(activeProject);
          setIntegratedWorkflows(workflowIntegrations);
        }
        
        // Load business agencies
        if (userCanisterId) {
          const businessAgencies = await BusinessAgencyContextualAwarenessService
            .discoverProjectBusinessAgencies(userCanisterId, activeProject);
          
          setAvailableBusinessAgencies(businessAgencies.map(a => ({
            id: a.agencyId,
            name: a.name,
            description: a.description,
            category: a.category,
            icon: a.icon
          })));
          
          // Load integrated business agencies
          const businessAgencyIntegrations = BusinessAgencyIntegrationService
            .getProjectBusinessAgencyIntegrations(activeProject);
          setIntegratedBusinessAgencies(businessAgencyIntegrations);
        }
      } catch (error) {
        console.error('Failed to load resources:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAgents();
  }, [activeProject, identity, userCanisterId]);
  
  const handleAddAgent = useCallback(async () => {
    if (!selectedAgent || !activeProject || !identity || !userCanisterId) return;
    
    setIsIntegrating(true);
    try {
      // Get backend canister ID from project
      // For now, we'll need to get it from server pairs
      // This is a simplified version - you may need to adjust based on your project structure
      const userActor = await (await import('../services/UserCanisterService')).userCanisterService.getUserActor(userCanisterId, identity);
      const serverPairsResult = await userActor.getProjectServerPairs(activeProject);
      
      if (!('ok' in serverPairsResult) || serverPairsResult.ok.length === 0) {
        throw new Error('No server pairs found for this project');
      }
      
      const backendCanisterId = serverPairsResult.ok[0].backendCanisterId.toText();
      
      // Get agent identity
      const agentActor = Actor.createActor(agentIdlFactory, {
        agent: new HttpAgent({
          identity,
          host: window.location.hostname === 'localhost' ? 'http://localhost:4943' : 'https://ic0.app'
        }),
        canisterId: selectedAgent.canisterId
      });
      
      const agentIdentityResult = await agentActor.getAgentIdentity();
      if (agentIdentityResult.length === 0) {
        throw new Error('Failed to get agent identity');
      }
      
      const agentIdentity = agentIdentityResult[0];
      
      // Integrate agent with progress tracking
      setIntegrationProgress({ message: 'Discovering agent capabilities...', percent: 10 });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setIntegrationProgress({ message: 'Discovering app capabilities...', percent: 30 });
      
      // Start integration (this will internally update progress)
      const integrationPromise = AgentIntegrationService.integrateAgentWithApp(
        selectedAgent.canisterId,
        activeProject,
        backendCanisterId,
        identity,
        agentIdentity,
        {
          integrationLevel,
          autoImplement: true
        }
      );
      
      setIntegrationProgress({ message: 'Generating integration strategy...', percent: 50 });
      
      const result = await integrationPromise;
      
      setIntegrationProgress({ message: 'Implementing integration...', percent: 80 });
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Reload integrations
      const integrations = AgentIntegrationService.getProjectIntegrations(activeProject);
      setIntegratedAgents(integrations);
      
      setIntegrationProgress({ message: 'Integration complete!', percent: 100 });
      
      // Close progress dialog after a brief delay
      setTimeout(() => {
        setIntegrationProgress(null);
        setShowAddDialog(false);
        setSelectedAgent(null);
      }, 1500);
    } catch (error) {
      console.error('Failed to integrate agent:', error);
      setIntegrationProgress(null);
      alert(`Failed to integrate agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsIntegrating(false);
    }
  }, [selectedAgent, activeProject, identity, userCanisterId, integrationLevel]);
  
  const handleToggleIntegration = useCallback((integrationId: string, enabled: boolean) => {
    if (!activeProject) return;
    
    AgentIntegrationService.updateIntegration(activeProject, integrationId, { isEnabled: enabled });
    const integrations = AgentIntegrationService.getProjectIntegrations(activeProject);
    setIntegratedAgents(integrations);
  }, [activeProject]);
  
  const handleRemoveIntegration = useCallback((integrationId: string) => {
    if (!activeProject) return;
    
    if (confirm('Are you sure you want to remove this agent integration?')) {
      AgentIntegrationService.removeIntegration(activeProject, integrationId);
      const integrations = AgentIntegrationService.getProjectIntegrations(activeProject);
      setIntegratedAgents(integrations);
    }
  }, [activeProject]);
  
  const handleAddWorkflow = useCallback(async () => {
    if (!selectedWorkflow || !activeProject || !identity || !userCanisterId) return;
    
    setIsIntegrating(true);
    try {
      const result = await WorkflowIntegrationService.integrateWorkflowWithApp(
        selectedWorkflow,
        activeProject,
        userCanisterId,
        identity,
        {
          integrationLevel: workflowIntegrationLevel,
          autoImplement: true
        }
      );
      
      // Reload integrations
      const integrations = WorkflowIntegrationService.getProjectWorkflowIntegrations(activeProject);
      setIntegratedWorkflows(integrations);
      
      setShowAddDialog(false);
      setSelectedWorkflow(null);
    } catch (error) {
      console.error('Failed to integrate workflow:', error);
      alert(`Failed to integrate workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsIntegrating(false);
    }
  }, [selectedWorkflow, activeProject, identity, userCanisterId, workflowIntegrationLevel]);
  
  const handleToggleWorkflowIntegration = useCallback((integrationId: string, enabled: boolean) => {
    if (!activeProject) return;
    
    WorkflowIntegrationService.updateWorkflowIntegration(activeProject, integrationId, { isEnabled: enabled });
    const integrations = WorkflowIntegrationService.getProjectWorkflowIntegrations(activeProject);
    setIntegratedWorkflows(integrations);
  }, [activeProject]);
  
  const handleRemoveWorkflowIntegration = useCallback((integrationId: string) => {
    if (!activeProject) return;
    
    if (confirm('Are you sure you want to remove this workflow integration?')) {
      WorkflowIntegrationService.removeWorkflowIntegration(activeProject, integrationId);
      const integrations = WorkflowIntegrationService.getProjectWorkflowIntegrations(activeProject);
      setIntegratedWorkflows(integrations);
    }
  }, [activeProject]);
  
  const handleAddBusinessAgency = useCallback(async () => {
    if (!selectedBusinessAgency || !activeProject || !identity || !userCanisterId) return;
    
    setIsIntegrating(true);
    try {
      const result = await BusinessAgencyIntegrationService.integrateBusinessAgencyWithApp(
        selectedBusinessAgency,
        userCanisterId,
        activeProject,
        identity,
        {
          integrationType: businessAgencyIntegrationType,
          autoImplement: true
        }
      );
      
      // Reload integrations
      const integrations = BusinessAgencyIntegrationService.getProjectBusinessAgencyIntegrations(activeProject);
      setIntegratedBusinessAgencies(integrations);
      
      setShowAddDialog(false);
      setSelectedBusinessAgency(null);
    } catch (error) {
      console.error('Failed to integrate business agency:', error);
      alert(`Failed to integrate business agency: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsIntegrating(false);
    }
  }, [selectedBusinessAgency, activeProject, identity, userCanisterId, businessAgencyIntegrationType]);
  
  const handleToggleBusinessAgencyIntegration = useCallback((integrationId: string, enabled: boolean) => {
    if (!activeProject) return;
    
    BusinessAgencyIntegrationService.updateBusinessAgencyIntegration(activeProject, integrationId, { isEnabled: enabled });
    const integrations = BusinessAgencyIntegrationService.getProjectBusinessAgencyIntegrations(activeProject);
    setIntegratedBusinessAgencies(integrations);
  }, [activeProject]);
  
  const handleRemoveBusinessAgencyIntegration = useCallback((integrationId: string) => {
    if (!activeProject) return;
    
    if (confirm('Are you sure you want to remove this business agency integration?')) {
      BusinessAgencyIntegrationService.removeBusinessAgencyIntegration(activeProject, integrationId);
      const integrations = BusinessAgencyIntegrationService.getProjectBusinessAgencyIntegrations(activeProject);
      setIntegratedBusinessAgencies(integrations);
    }
  }, [activeProject]);
  
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-gray)'
      }}>
        Loading agents...
      </div>
    );
  }
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      height: '100%'
    }}>
      {/* Header */}
      <div>
        <h2 style={{
          fontSize: isMobile ? '1.5rem' : '2rem',
          fontWeight: 700,
          color: '#ffffff',
          margin: '0 0 0.5rem 0'
        }}>
          Agent & Workflow Integration
        </h2>
        <p style={{
          fontSize: isMobile ? '0.9rem' : '1rem',
          color: 'var(--text-gray)',
          margin: 0
        }}>
          Connect agents, workflows, and business agencies to your app to enable AI-powered features, automation, and business intelligence
        </p>
      </div>
      
      {/* Add Buttons */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <button
          onClick={() => {
            setDialogType('agent');
            setShowAddDialog(true);
          }}
          style={{
            background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.15))',
            border: '1px solid rgba(255, 107, 53, 0.4)',
            borderRadius: '12px',
            padding: '1rem 1.5rem',
            color: '#ffffff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            transition: 'all 0.2s ease',
            flex: '1 1 200px'
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>🤖</span>
          <span>Add Agent</span>
        </button>
        <button
          onClick={() => {
            setDialogType('workflow');
            setShowAddDialog(true);
          }}
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(16, 185, 129, 0.15))',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '12px',
            padding: '1rem 1.5rem',
            color: '#ffffff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            transition: 'all 0.2s ease',
            flex: '1 1 200px'
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>🔄</span>
          <span>Add Workflow</span>
        </button>
        <button
          onClick={() => {
            setDialogType('business-agency');
            setShowAddDialog(true);
          }}
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.15))',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '12px',
            padding: '1rem 1.5rem',
            color: '#ffffff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            transition: 'all 0.2s ease',
            flex: '1 1 200px'
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>📊</span>
          <span>Add Business Agency</span>
        </button>
      </div>
      
      {/* Integrated Agents Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#ffffff',
          margin: '0 0 1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>🤖</span>
          <span>Integrated Agents ({integratedAgents.length})</span>
        </h3>
        
        {integratedAgents.length === 0 ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            color: 'var(--text-gray)'
          }}>
            <p style={{ margin: 0 }}>No agents integrated yet.</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {integratedAgents.map(integration => {
              const agent = availableAgents.find(a => a.canisterId === integration.agentCanisterId);
              return (
                <div
                  key={integration.id}
                  style={{
                    background: integration.isEnabled
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${integration.isEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '12px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        margin: '0 0 0.5rem 0'
                      }}>
                        {agent?.name || integration.agentName}
                      </h4>
                      <p style={{
                        fontSize: '0.9rem',
                        color: 'var(--text-gray)',
                        margin: 0
                      }}>
                        {agent?.description || integration.agentDescription || 'No description'}
                      </p>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={integration.isEnabled}
                          onChange={(e) => handleToggleIntegration(integration.id, e.target.checked)}
                          style={{
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{
                          color: integration.isEnabled ? '#10b981' : 'var(--text-gray)',
                          fontSize: '0.9rem',
                          fontWeight: 600
                        }}>
                          {integration.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                      <button
                        onClick={() => handleRemoveIntegration(integration.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid #ef4444',
                          borderRadius: '8px',
                          color: '#ef4444',
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Integrated Workflows Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#ffffff',
          margin: '0 0 1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>🔄</span>
          <span>Integrated Workflows ({integratedWorkflows.length})</span>
        </h3>
        
        {integratedWorkflows.length === 0 ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            color: 'var(--text-gray)'
          }}>
            <p style={{ margin: 0 }}>No workflows integrated yet.</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {integratedWorkflows.map(integration => {
              const workflow = availableWorkflows.find(w => w.id === integration.workflowId);
              return (
                <div
                  key={integration.id}
                  style={{
                    background: integration.isEnabled
                      ? 'rgba(139, 92, 246, 0.1)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${integration.isEnabled ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '12px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        margin: '0 0 0.5rem 0'
                      }}>
                        {workflow?.name || integration.workflowName}
                      </h4>
                      <p style={{
                        fontSize: '0.9rem',
                        color: 'var(--text-gray)',
                        margin: 0
                      }}>
                        {workflow?.description || integration.workflowDescription || 'No description'}
                      </p>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={integration.isEnabled}
                          onChange={(e) => handleToggleWorkflowIntegration(integration.id, e.target.checked)}
                          style={{
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{
                          color: integration.isEnabled ? '#8b5cf6' : 'var(--text-gray)',
                          fontSize: '0.9rem',
                          fontWeight: 600
                        }}>
                          {integration.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                      <button
                        onClick={() => handleRemoveWorkflowIntegration(integration.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid #ef4444',
                          borderRadius: '8px',
                          color: '#ef4444',
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-gray)'
                  }}>
                    <strong style={{ color: '#ffffff' }}>Integration Level:</strong>{' '}
                    <span style={{ textTransform: 'capitalize' }}>
                      {integration.integrationLevel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Integrated Business Agencies Section */}
      <div>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#ffffff',
          margin: '0 0 1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>📊</span>
          <span>Integrated Business Agencies ({integratedBusinessAgencies.length})</span>
        </h3>
        
        {integratedBusinessAgencies.length === 0 ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            color: 'var(--text-gray)'
          }}>
            <p style={{ margin: 0 }}>No business agencies integrated yet.</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {integratedBusinessAgencies.map(integration => {
              const agency = availableBusinessAgencies.find(a => a.id === integration.agencyId);
              return (
                <div
                  key={integration.id}
                  style={{
                    background: integration.isEnabled
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${integration.isEnabled ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '12px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        background: agency?.icon ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #10b981)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem'
                      }}>
                        {agency?.icon || '📊'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          margin: '0 0 0.5rem 0'
                        }}>
                          {agency?.name || integration.agencyName}
                        </h4>
                        <p style={{
                          fontSize: '0.9rem',
                          color: 'var(--text-gray)',
                          margin: 0
                        }}>
                          {agency?.description || integration.agencyDescription || 'No description'}
                        </p>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={integration.isEnabled}
                          onChange={(e) => handleToggleBusinessAgencyIntegration(integration.id, e.target.checked)}
                          style={{
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{
                          color: integration.isEnabled ? '#3b82f6' : 'var(--text-gray)',
                          fontSize: '0.9rem',
                          fontWeight: 600
                        }}>
                          {integration.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                      <button
                        onClick={() => handleRemoveBusinessAgencyIntegration(integration.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid #ef4444',
                          borderRadius: '8px',
                          color: '#ef4444',
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-gray)'
                  }}>
                    <strong style={{ color: '#ffffff' }}>Integration Type:</strong>{' '}
                    <span style={{ textTransform: 'capitalize' }}>
                      {integration.integrationType}
                    </span>
                    {' • '}
                    <strong style={{ color: '#ffffff' }}>Category:</strong>{' '}
                    <span style={{ textTransform: 'capitalize' }}>
                      {integration.category}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Add Dialog */}
      {showAddDialog && (
        <>
          <div
            onClick={() => setShowAddDialog(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 1000,
              backdropFilter: 'blur(4px)'
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: isMobile ? '90%' : '600px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            background: 'var(--primary-black)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            zIndex: 1001,
            padding: '2rem',
            overflow: 'auto'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 1.5rem 0'
            }}>
              {dialogType === 'agent' && 'Add Agent to App Context'}
              {dialogType === 'workflow' && 'Add Workflow to App Context'}
              {dialogType === 'business-agency' && 'Add Business Agency to App Context'}
            </h2>
            
            {dialogType === 'agent' && (
              <>
                {availableAgents.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    color: 'var(--text-gray)'
                  }}>
                    <p>No agents available. Deploy an agent first.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        marginBottom: '0.5rem'
                      }}>
                        Select Agent
                      </label>
                      <select
                        value={selectedAgent?.canisterId || ''}
                        onChange={(e) => {
                          const agent = availableAgents.find(a => a.canisterId === e.target.value);
                          setSelectedAgent(agent || null);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="">-- Select an agent --</option>
                        {availableAgents.map(agent => (
                          <option key={agent.canisterId} value={agent.canisterId}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        marginBottom: '0.5rem'
                      }}>
                        Integration Level
                      </label>
                      <select
                        value={integrationLevel}
                        onChange={(e) => setIntegrationLevel(e.target.value as any)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="minimal">Minimal - Agent can read app data</option>
                        <option value="moderate">Moderate - Agent can read and write app data</option>
                        <option value="deep">Deep - Agent and app work together bidirectionally</option>
                        <option value="autonomous">Autonomous - Agent can run app autonomously</option>
                      </select>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      justifyContent: 'flex-end'
                    }}>
                      <button
                        onClick={() => setShowAddDialog(false)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddAgent}
                        disabled={!selectedAgent || isIntegrating}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: selectedAgent && !isIntegrating
                            ? 'linear-gradient(135deg, #ff6b35, #10b981)'
                            : 'rgba(255, 255, 255, 0.1)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem',
                          fontWeight: 600,
                          cursor: selectedAgent && !isIntegrating ? 'pointer' : 'not-allowed',
                          opacity: selectedAgent && !isIntegrating ? 1 : 0.5
                        }}
                      >
                        {isIntegrating ? 'Integrating...' : 'Integrate Agent'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
            
            {dialogType === 'workflow' && (
              <>
                {availableWorkflows.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    color: 'var(--text-gray)'
                  }}>
                    <p>No workflows available. Create a workflow first.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        marginBottom: '0.5rem'
                      }}>
                        Select Workflow
                      </label>
                      <select
                        value={selectedWorkflow || ''}
                        onChange={(e) => setSelectedWorkflow(e.target.value || null)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="">-- Select a workflow --</option>
                        {availableWorkflows.map(workflow => (
                          <option key={workflow.id} value={workflow.id}>
                            {workflow.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        marginBottom: '0.5rem'
                      }}>
                        Integration Level
                      </label>
                      <select
                        value={workflowIntegrationLevel}
                        onChange={(e) => setWorkflowIntegrationLevel(e.target.value as any)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="execution">Execution - Execute workflows from app</option>
                        <option value="monitoring">Monitoring - Monitor workflow execution</option>
                        <option value="full">Full - Execute and monitor workflows</option>
                      </select>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      justifyContent: 'flex-end'
                    }}>
                      <button
                        onClick={() => setShowAddDialog(false)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddWorkflow}
                        disabled={!selectedWorkflow || isIntegrating}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: selectedWorkflow && !isIntegrating
                            ? 'linear-gradient(135deg, #8b5cf6, #10b981)'
                            : 'rgba(255, 255, 255, 0.1)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem',
                          fontWeight: 600,
                          cursor: selectedWorkflow && !isIntegrating ? 'pointer' : 'not-allowed',
                          opacity: selectedWorkflow && !isIntegrating ? 1 : 0.5
                        }}
                      >
                        {isIntegrating ? 'Integrating...' : 'Integrate Workflow'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
            
            {dialogType === 'business-agency' && (
              <>
                {availableBusinessAgencies.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    color: 'var(--text-gray)'
                  }}>
                    <p>No business agencies available. Create a business agency first.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        marginBottom: '0.5rem'
                      }}>
                        Select Business Agency
                      </label>
                      <select
                        value={selectedBusinessAgency || ''}
                        onChange={(e) => setSelectedBusinessAgency(e.target.value || null)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="">-- Select a business agency --</option>
                        {availableBusinessAgencies.map(agency => (
                          <option key={agency.id} value={agency.id}>
                            {agency.icon} {agency.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        marginBottom: '0.5rem'
                      }}>
                        Integration Type
                      </label>
                      <select
                        value={businessAgencyIntegrationType}
                        onChange={(e) => setBusinessAgencyIntegrationType(e.target.value as any)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="dashboard">Dashboard - Full business agency dashboard</option>
                        <option value="metrics">Metrics - Business impact metrics widget</option>
                        <option value="goals">Goals - Goals tracker component</option>
                        <option value="full">Full - All components (dashboard, metrics, goals, costs)</option>
                      </select>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      justifyContent: 'flex-end'
                    }}>
                      <button
                        onClick={() => setShowAddDialog(false)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddBusinessAgency}
                        disabled={!selectedBusinessAgency || isIntegrating}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: selectedBusinessAgency && !isIntegrating
                            ? 'linear-gradient(135deg, #3b82f6, #10b981)'
                            : 'rgba(255, 255, 255, 0.1)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '1rem',
                          fontWeight: 600,
                          cursor: selectedBusinessAgency && !isIntegrating ? 'pointer' : 'not-allowed',
                          opacity: selectedBusinessAgency && !isIntegrating ? 1 : 0.5
                        }}
                      >
                        {isIntegrating ? 'Integrating...' : 'Integrate Business Agency'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
      
      {/* Integration Progress Dialog */}
      {integrationProgress && (
        <ProgressDialog
          isOpen={true}
          title="Integrating Agent"
          message={integrationProgress.message}
          phase="deploying"
          progress={integrationProgress.percent}
          onClose={() => {
            // Don't allow closing during integration
          }}
        />
      )}
    </div>
  );
};

