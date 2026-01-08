import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { AgencyService } from '../../services/AgencyService';
import { BusinessAgencyService } from '../../services/BusinessAgencyService';
import type { BusinessAgency, BusinessAgencyTemplate } from '../../types/businessAgency';
import { BusinessAgencyCard } from './BusinessAgencyCard';
import { CreateBusinessAgencyModal } from './CreateBusinessAgencyModal';
import { DeleteBusinessAgencyModal } from './DeleteBusinessAgencyModal';
import { EmptyBusinessAgenciesState } from './EmptyBusinessAgenciesState';
import { BusinessAgencyDashboard } from './BusinessAgencyDashboard';
import type { Task as CandidTask } from '../../../candid/agent.did.d.ts';

export const BusinessAgenciesTab: React.FC = () => {
  const {
    activeProject,
    userCanisterId,
    identity,
  } = useAppStore(state => ({
    activeProject: state.activeProject,
    userCanisterId: state.userCanisterId,
    identity: state.identity,
  }));

  const businessAgencies = useAppStore(state => state.businessAgencies || []);
  const businessAgenciesLoading = useAppStore(state => state.businessAgenciesLoading || false);
  const loadBusinessAgencies = useAppStore(state => state.loadBusinessAgencies);
  const createBusinessAgency = useAppStore(state => state.createBusinessAgency);
  const deleteBusinessAgency = useAppStore(state => state.deleteBusinessAgency);
  const updateBusinessAgency = useAppStore(state => state.updateBusinessAgency);
  const addAgencyGoal = useAppStore(state => state.addAgencyGoal);
  const updateAgencyGoal = useAppStore(state => state.updateAgencyGoal);
  const deleteAgencyGoal = useAppStore(state => state.deleteAgencyGoal);

  // Load agents and workflows for reference
  const [deployedAgents, setDeployedAgents] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowExecutions, setWorkflowExecutions] = useState<any[]>([]);
  const [agentTasksMap, setAgentTasksMap] = useState<Map<string, CandidTask[]>>(new Map());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<BusinessAgencyTemplate | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agencyToDelete, setAgencyToDelete] = useState<BusinessAgency | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<BusinessAgency | null>(null);
  const [isDashboardFullscreen, setIsDashboardFullscreen] = useState(false);

  // Load agencies on mount
  useEffect(() => {
    if (userCanisterId && identity && loadBusinessAgencies) {
      loadBusinessAgencies().catch((error) => {
        console.error('Failed to load business agencies:', error);
      });
    }
  }, [userCanisterId, identity, activeProject, loadBusinessAgencies]);

  // Load deployed agents from localStorage
  useEffect(() => {
    if (!activeProject) return;
    
    const stored = localStorage.getItem(`deployed-agents-${activeProject}`);
    if (stored) {
      try {
        const agents = JSON.parse(stored);
        setDeployedAgents(agents.filter((a: any) => a.status === 'active'));
      } catch (error) {
        console.error('Failed to load deployed agents:', error);
      }
    }
  }, [activeProject]);

  // Load workflows (from AgenciesManagementInterface pattern)
  useEffect(() => {
    if (!activeProject || !userCanisterId || !identity) return;

    const loadWorkflows = async () => {
      try {
        const result = await AgencyService.getAgencies(
          activeProject,
          userCanisterId,
          identity
        );
        if (result.success && result.agencies) {
          setWorkflows(result.agencies);
        }
      } catch (error) {
        console.error('Failed to load workflows:', error);
      }
    };

    loadWorkflows();
  }, [activeProject, userCanisterId, identity]);

  // Load workflow executions
  useEffect(() => {
    if (!activeProject || !userCanisterId || !identity) return;

    const loadExecutions = async () => {
      try {
        const result = await AgencyService.getAllExecutions(
          activeProject,
          userCanisterId,
          identity
        );
        if (result.success && result.executions) {
          setWorkflowExecutions(result.executions);
        }
      } catch (error) {
        console.error('Failed to load executions:', error);
      }
    };

    loadExecutions();
  }, [activeProject, userCanisterId, identity]);

  // Load agent tasks for all agents in agencies
  useEffect(() => {
    if (!activeProject || !userCanisterId || !identity || !businessAgencies.length) return;

    const loadAgentTasks = async () => {
      try {
        // Get all unique agent IDs from all agencies
        const allAgentIds = new Set<string>();
        businessAgencies.forEach(agency => {
          agency.agentIds.forEach(id => allAgentIds.add(id));
        });

        // Load tasks for each agent
        const tasksMap = new Map<string, CandidTask[]>();
        const loadPromises = Array.from(allAgentIds).map(async (agentCanisterId) => {
          try {
            // Use AgentServiceClass pattern from AgentManagementInterface
            // We'll create the actor directly to avoid circular dependency
            const { Actor, HttpAgent } = await import('@dfinity/agent');
            const { Principal } = await import('@dfinity/principal');
            const agentDidModule = await import('../../../candid/agent.did.js');
            const agentIdlFactory = agentDidModule.idlFactory;
            const agent = new HttpAgent({ identity, host: 'https://icp-api.io' });
            const actor = Actor.createActor(agentIdlFactory, {
              agent,
              canisterId: Principal.fromText(agentCanisterId),
            });
            
            // Get tasks
            const tasksResult = await actor.getAllTasks(BigInt(100)); // Get last 100 tasks
            if (tasksResult && Array.isArray(tasksResult) && tasksResult.length > 0) {
              tasksMap.set(agentCanisterId, tasksResult as any);
            }
          } catch (error) {
            console.error(`Failed to load tasks for agent ${agentCanisterId}:`, error);
          }
        });

        await Promise.allSettled(loadPromises);
        setAgentTasksMap(tasksMap);
      } catch (error) {
        console.error('Failed to load agent tasks:', error);
      }
    };

    loadAgentTasks();
  }, [activeProject, userCanisterId, identity, businessAgencies]);

  const handleCreateFromTemplate = (template: BusinessAgencyTemplate) => {
    setSelectedTemplate(template);
    setShowCreateModal(true);
  };

  const handleCreateAgency = async (agencyData: Omit<BusinessAgency, 'id' | 'created' | 'updated' | 'owner'>) => {
    const success = await createBusinessAgency(agencyData);
    if (success) {
      setShowCreateModal(false);
      setSelectedTemplate(null);
    }
  };

  const handleDeleteAgency = async (agency: BusinessAgency) => {
    const success = await deleteBusinessAgency(agency.id);
    if (success) {
      setShowDeleteModal(false);
      setAgencyToDelete(null);
    }
  };

  // Calculate metrics for agencies and auto-update goals
  const [agencyMetricsMap, setAgencyMetricsMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!businessAgencies.length) {
      setAgencyMetricsMap(new Map());
      return;
    }

    const calculateMetrics = async () => {
      const map = new Map<string, any>();
      
      await Promise.all(businessAgencies.map(async (agency) => {
        // Get agent data
        const agentDataMap = new Map<string, any>();
        agency.agentIds.forEach(agentId => {
          const agent = deployedAgents.find(a => a.backendCanisterId === agentId);
          if (agent) {
            // Get tasks for this agent
            const tasks = agentTasksMap.get(agentId) || [];
            agentDataMap.set(agentId, { tasks });
          }
        });

        // Calculate metrics (now async)
        const metrics = await BusinessAgencyService.calculateAgencyMetrics(
          agency,
          agentDataMap,
          workflowExecutions
        );
        map.set(agency.id, metrics);
        
        // NEW: Collect all tasks for agents in this agency
        const allAgencyTasks: Array<{ task: CandidTask; agentCanisterId: string }> = [];
        agency.agentIds.forEach(agentCanisterId => {
          const tasks = agentTasksMap.get(agentCanisterId) || [];
          tasks.forEach(task => {
            allAgencyTasks.push({ task, agentCanisterId });
          });
        });
        
        // Auto-update goals from metrics and tasks
        if (agency.goals && agency.goals.length > 0) {
          const updatedGoals = BusinessAgencyService.updateGoalProgressFromMetrics(
            agency.goals,
            metrics,
            agency.category,
            allAgencyTasks.length > 0 ? allAgencyTasks : undefined
          );
          
          // Check if any goals changed
          const goalsChanged = updatedGoals.some((goal, idx) => {
            const original = agency.goals[idx];
            return goal.currentValue !== original?.currentValue || goal.status !== original?.status;
          });
          
          // Auto-save if goals changed
          if (goalsChanged) {
            updateBusinessAgency(agency.id, {
              goals: updatedGoals,
              metrics: metrics
            }).catch(err => console.error('Failed to auto-update goals:', err));
          }
        }
      }));

      setAgencyMetricsMap(map);
    };

    calculateMetrics();
  }, [businessAgencies, deployedAgents, workflowExecutions, agentTasksMap, updateBusinessAgency]);

  // If an agency is selected, show embedded dashboard instead of cards
  if (selectedAgency && !isDashboardFullscreen) {
    return (
      <div className="h-full flex flex-col" style={{ 
        background: 'var(--primary-black)',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Header with back button */}
        <div style={{ 
          padding: '1rem', 
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedAgency(null);
            }}
            style={{
              padding: '0.5rem',
              background: 'rgba(107, 114, 128, 0.15)',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '6px',
              color: '#9CA3AF',
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(107, 114, 128, 0.25)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(107, 114, 128, 0.15)';
              e.currentTarget.style.color = '#9CA3AF';
            }}
            title="Back to agencies list"
          >
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
              Business Agency Dashboard
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', margin: '0.25rem 0 0 0' }}>
              View and manage agency details, metrics, and goals
            </p>
          </div>
        </div>

        {/* Embedded Dashboard */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <BusinessAgencyDashboard
            agency={selectedAgency}
            metrics={agencyMetricsMap.get(selectedAgency.id)}
            agents={deployedAgents}
            workflows={workflows}
            workflowExecutions={workflowExecutions}
            onClose={() => setSelectedAgency(null)}
            onUpdate={updateBusinessAgency}
            onAddGoal={addAgencyGoal}
            onUpdateGoal={updateAgencyGoal}
            onDeleteGoal={deleteAgencyGoal}
            onRefresh={async () => {
              await loadBusinessAgencies();
              if (activeProject && userCanisterId && identity) {
                try {
                  const workflowsResult = await AgencyService.getAgencies(activeProject, userCanisterId, identity);
                  if (workflowsResult.success && workflowsResult.agencies) {
                    setWorkflows(workflowsResult.agencies);
                  }
                  const executionsResult = await AgencyService.getAllExecutions(activeProject, userCanisterId, identity);
                  if (executionsResult.success && executionsResult.executions) {
                    setWorkflowExecutions(executionsResult.executions);
                  }
                } catch (error) {
                  console.error('Failed to refresh data:', error);
                }
              }
            }}
            isFullscreen={false}
            onFullscreenToggle={() => setIsDashboardFullscreen(true)}
            className="h-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ 
      background: 'var(--primary-black)',
      minHeight: 0,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0
      }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Business Agencies</h2>
            <p className="text-sm text-gray-400 mt-1">
              Organize agents and workflows by business purpose
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            + Create Agency
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }} className="chat-scrollbar">
        {businessAgenciesLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading agencies...</div>
          </div>
        ) : businessAgencies.length === 0 ? (
          <EmptyBusinessAgenciesState onCreateFromTemplate={handleCreateFromTemplate} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {businessAgencies.map(agency => {
              const metrics = agencyMetricsMap.get(agency.id);
              return (
                <BusinessAgencyCard
                  key={agency.id}
                  agency={agency}
                  metrics={metrics}
                  agents={deployedAgents}
                  workflows={workflows}
                  onSelect={() => setSelectedAgency(agency)}
                  onDelete={() => {
                    setAgencyToDelete(agency);
                    setShowDeleteModal(true);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Create Agency Modal */}
      {showCreateModal && (
        <CreateBusinessAgencyModal
          template={selectedTemplate}
          availableAgents={deployedAgents}
          availableWorkflows={workflows}
          onCreate={handleCreateAgency}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && agencyToDelete && (
        <DeleteBusinessAgencyModal
          agency={agencyToDelete}
          onConfirm={() => handleDeleteAgency(agencyToDelete)}
          onCancel={() => {
            setShowDeleteModal(false);
            setAgencyToDelete(null);
          }}
        />
      )}

      {/* Fullscreen Dashboard (via portal) */}
      {selectedAgency && isDashboardFullscreen && (
        <BusinessAgencyDashboard
          agency={selectedAgency}
          metrics={agencyMetricsMap.get(selectedAgency.id)}
          agents={deployedAgents}
          workflows={workflows}
          workflowExecutions={workflowExecutions}
          onClose={() => {
            setIsDashboardFullscreen(false);
            setSelectedAgency(null);
          }}
          onUpdate={updateBusinessAgency}
          onAddGoal={addAgencyGoal}
          onUpdateGoal={updateAgencyGoal}
          onDeleteGoal={deleteAgencyGoal}
          onRefresh={async () => {
            await loadBusinessAgencies();
            if (activeProject && userCanisterId && identity) {
              try {
                const workflowsResult = await AgencyService.getAgencies(activeProject, userCanisterId, identity);
                if (workflowsResult.success && workflowsResult.agencies) {
                  setWorkflows(workflowsResult.agencies);
                }
                const executionsResult = await AgencyService.getAllExecutions(activeProject, userCanisterId, identity);
                if (executionsResult.success && executionsResult.executions) {
                  setWorkflowExecutions(executionsResult.executions);
                }
              } catch (error) {
                console.error('Failed to refresh data:', error);
              }
            }
          }}
          isFullscreen={true}
          onFullscreenToggle={() => setIsDashboardFullscreen(false)}
        />
      )}
    </div>
  );
};

