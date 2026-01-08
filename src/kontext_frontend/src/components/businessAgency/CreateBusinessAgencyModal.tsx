import React, { useState } from 'react';
import type { BusinessAgency, BusinessAgencyTemplate } from '../../types/businessAgency';

interface CreateBusinessAgencyModalProps {
  template: BusinessAgencyTemplate | null;
  availableAgents: any[];
  availableWorkflows: any[];
  onCreate: (agency: Omit<BusinessAgency, 'id' | 'created' | 'updated' | 'owner'>) => Promise<void>;
  onClose: () => void;
}

export const CreateBusinessAgencyModal: React.FC<CreateBusinessAgencyModalProps> = ({ 
  template, 
  availableAgents, 
  availableWorkflows, 
  onCreate, 
  onClose 
}) => {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState<BusinessAgency['category']>(template?.category || 'custom');
  const [icon, setIcon] = useState(template?.icon || '🏛️');
  const [color, setColor] = useState(template?.color || '#FF6B35');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>([]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Agency name is required');
      return;
    }

    const agencyData: Omit<BusinessAgency, 'id' | 'created' | 'updated' | 'owner'> = {
      name: name.trim(),
      description: description.trim(),
      category,
      icon,
      color,
      agentIds: selectedAgentIds,
      workflowIds: selectedWorkflowIds,
      goals: template?.defaultGoals.map(goal => ({
        id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: goal.name,
        description: '',
        target: goal.target,
        status: 'active' as const,
      })) || [],
      metrics: {
        totalExecutions: 0,
        successRate: 0,
        averageResponseTime: 0,
        lastUpdated: Date.now(),
      },
    };

    await onCreate(agencyData);
  };

  return (
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
          onClose();
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
        <h3 className="text-xl font-bold text-white mb-4">
          {template ? `Create ${template.name}` : 'Create Business Agency'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Marketing Agency"
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.5rem',
                color: '#ffffff',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this agency..."
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.5rem',
                color: '#ffffff',
                fontSize: '0.875rem',
                resize: 'vertical'
              }}
            />
          </div>

          {!template && (
            <>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BusinessAgency['category'])}
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
                  <option value="marketing">Marketing</option>
                  <option value="sales">Sales</option>
                  <option value="support">Support</option>
                  <option value="operations">Operations</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Icon</label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="🏛️"
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Select Agents</label>
            {availableAgents.length === 0 ? (
              <div className="text-sm text-yellow-400 mb-2">
                ⚠️ No agents available. Deploy agents first, then add them to this agency.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {availableAgents.map(agent => (
                  <label
                    key={agent.backendCanisterId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAgentIds.includes(agent.backendCanisterId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAgentIds([...selectedAgentIds, agent.backendCanisterId]);
                        } else {
                          setSelectedAgentIds(selectedAgentIds.filter(id => id !== agent.backendCanisterId));
                        }
                      }}
                    />
                    <span className="text-sm text-white">{agent.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {agent.backendCanisterId.slice(0, 8)}...
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Select Workflows</label>
            {availableWorkflows.length === 0 ? (
              <div className="text-sm text-yellow-400 mb-2">
                ⚠️ No workflows available. Create workflows first, then add them to this agency.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {availableWorkflows.map(workflow => (
                  <label
                    key={workflow.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedWorkflowIds.includes(workflow.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedWorkflowIds([...selectedWorkflowIds, workflow.id]);
                        } else {
                          setSelectedWorkflowIds(selectedWorkflowIds.filter(id => id !== workflow.id));
                        }
                      }}
                    />
                    <span className="text-sm text-white">{workflow.name || 'Unnamed Workflow'}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'rgba(107, 114, 128, 0.2)',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '8px',
              color: '#9CA3AF',
              padding: '0.75rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            style={{
              flex: 1,
              background: !name.trim()
                ? 'rgba(107, 114, 128, 0.2)'
                : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '0.75rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: !name.trim() ? 'not-allowed' : 'pointer',
              opacity: !name.trim() ? 0.5 : 1
            }}
          >
            Create Agency
          </button>
        </div>
      </div>
    </div>
  );
};

