import React from 'react';
import type { BusinessAgency } from '../../types/businessAgency';

interface BusinessAgencyCardProps {
  agency: BusinessAgency;
  metrics?: any;
  agents: any[];
  workflows: any[];
  onSelect: () => void;
  onDelete: () => void;
}

export const BusinessAgencyCard: React.FC<BusinessAgencyCardProps> = ({ 
  agency, 
  metrics, 
  agents, 
  workflows, 
  onSelect, 
  onDelete 
}) => {
  const matchedAgents = agents.filter(a => agency.agentIds.includes(a.backendCanisterId));
  const matchedWorkflows = workflows.filter(w => agency.workflowIds.includes(w.id));

  return (
    <div
      onClick={onSelect}
      style={{
        background: 'rgba(17, 17, 17, 0.8)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1rem',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = agency.color || 'var(--accent-orange)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div style={{
            width: '40px',
            height: '40px',
            background: agency.color || 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            flexShrink: 0
          }}>
            {agency.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate" title={agency.name}>
              {agency.name}
            </h3>
            <p className="text-xs text-gray-400 line-clamp-1" title={agency.description}>
              {agency.description}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
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
            width: '22px',
            height: '22px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
          }}
          title="Delete agency"
        >
          🗑️
        </button>
      </div>

      {/* Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.5rem',
        padding: '0.75rem',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        fontSize: '0.8rem'
      }}>
        <div>
          <div style={{ color: '#888', marginBottom: '0.25rem', fontSize: '0.7rem' }}>Agents</div>
          <div style={{ color: '#3B82F6', fontWeight: 700, fontSize: '1.1rem' }}>
            {matchedAgents.length}
          </div>
        </div>
        <div>
          <div style={{ color: '#888', marginBottom: '0.25rem', fontSize: '0.7rem' }}>Workflows</div>
          <div style={{ color: '#8B5CF6', fontWeight: 700, fontSize: '1.1rem' }}>
            {matchedWorkflows.length}
          </div>
        </div>
        {metrics && (
          <>
            <div>
              <div style={{ color: '#888', marginBottom: '0.25rem', fontSize: '0.7rem' }}>Executions</div>
              <div style={{ color: '#10B981', fontWeight: 700, fontSize: '1.1rem' }}>
                {metrics.totalExecutions}
              </div>
            </div>
            <div>
              <div style={{ color: '#888', marginBottom: '0.25rem', fontSize: '0.7rem' }}>Success Rate</div>
              <div style={{ color: '#10B981', fontWeight: 700, fontSize: '1.1rem' }}>
                {metrics.successRate.toFixed(1)}%
              </div>
            </div>
          </>
        )}
      </div>

      {/* Goals Preview */}
      {agency.goals && agency.goals.length > 0 && (
        <div style={{
          padding: '0.5rem',
          background: 'rgba(255, 107, 53, 0.1)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 107, 53, 0.2)'
        }}>
          <div className="text-xs text-gray-400 mb-1">Active Goals: {agency.goals.filter(g => g.status === 'active').length}</div>
          {agency.goals.filter(g => g.status === 'active').slice(0, 2).map(goal => (
            <div key={goal.id} className="text-xs text-white truncate" title={goal.name}>
              • {goal.name}: {goal.target}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

