import React, { useState } from 'react';
import type { BusinessAgency, AgencyGoal, GoalTaskMapping } from '../../types/businessAgency';
import { GoalMappingConfig } from './GoalMappingConfig';

interface BusinessAgencyDetailsModalProps {
  agency: BusinessAgency;
  metrics?: any;
  agents: any[];
  workflows: any[];
  workflowExecutions?: any[];
  onClose: () => void;
  onUpdate: (agencyId: string, updates: Partial<BusinessAgency>) => Promise<boolean>;
  onAddGoal: (agencyId: string, goal: Omit<AgencyGoal, 'id'>) => Promise<boolean>;
  onUpdateGoal: (agencyId: string, goalId: string, updates: Partial<AgencyGoal>) => Promise<boolean>;
  onDeleteGoal: (agencyId: string, goalId: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
}

export const BusinessAgencyDetailsModal: React.FC<BusinessAgencyDetailsModalProps> = ({ 
  agency, 
  metrics, 
  agents, 
  workflows, 
  workflowExecutions = [], 
  onClose, 
  onUpdate, 
  onAddGoal, 
  onUpdateGoal, 
  onDeleteGoal, 
  onRefresh 
}) => {
  const matchedAgents = agents.filter(a => agency.agentIds.includes(a.backendCanisterId));
  const matchedWorkflows = workflows.filter(w => agency.workflowIds.includes(w.id));
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [showAddGoalForm, setShowAddGoalForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: '', description: '', target: '', currentValue: '' });
  const [editingGoal, setEditingGoal] = useState<{ name: string; description: string; target: string; currentValue: string; status: 'active' | 'completed' | 'paused'; taskMapping?: GoalTaskMapping; manualTracking?: boolean } | null>(null);
  const [showMappingConfig, setShowMappingConfig] = useState(false);
  const [mappingForGoal, setMappingForGoal] = useState<string | null>(null);
  const [isEditingAgency, setIsEditingAgency] = useState(false);
  const [editingAgencyData, setEditingAgencyData] = useState({
    name: agency.name,
    description: agency.description,
    category: agency.category,
    icon: agency.icon,
    color: agency.color || '#FF6B35'
  });
  const [showManageResources, setShowManageResources] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(agency.agentIds);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>(agency.workflowIds);
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);

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
          maxWidth: '800px',
          maxHeight: '90vh',
          padding: '2rem',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section - Clean and Organized */}
        <div style={{
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid var(--border-color)'
        }}>
          {isEditingAgency ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Edit Agency</h2>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9CA3AF',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                    e.currentTarget.style.color = '#9CA3AF';
                  }}
                >
                  ×
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                    Agency Name
                  </label>
                  <input
                    type="text"
                    value={editingAgencyData.name}
                    onChange={(e) => setEditingAgencyData({ ...editingAgencyData, name: e.target.value })}
                    placeholder="Enter agency name"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '1rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                    Description
                  </label>
                  <textarea
                    value={editingAgencyData.description}
                    onChange={(e) => setEditingAgencyData({ ...editingAgencyData, description: e.target.value })}
                    placeholder="Describe the purpose of this agency..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      resize: 'vertical',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                      Category
                    </label>
                    <select
                      value={editingAgencyData.category}
                      onChange={(e) => setEditingAgencyData({ ...editingAgencyData, category: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
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
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                      Icon
                    </label>
                    <input
                      type="text"
                      value={editingAgencyData.icon}
                      onChange={(e) => setEditingAgencyData({ ...editingAgencyData, icon: e.target.value })}
                      placeholder="🏛️"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '1rem',
                        textAlign: 'center',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                      Color
                    </label>
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center'
                    }}>
                      <input
                        type="color"
                        value={editingAgencyData.color}
                        onChange={(e) => setEditingAgencyData({ ...editingAgencyData, color: e.target.value })}
                        style={{
                          width: '100%',
                          height: '44px',
                          padding: '0',
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={async () => {
                      await onUpdate(agency.id, {
                        name: editingAgencyData.name,
                        description: editingAgencyData.description,
                        category: editingAgencyData.category,
                        icon: editingAgencyData.icon,
                        color: editingAgencyData.color
                      });
                      setIsEditingAgency(false);
                      await onRefresh();
                    }}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingAgency(false);
                      setEditingAgencyData({
                        name: agency.name,
                        description: agency.description,
                        category: agency.category,
                        icon: agency.icon,
                        color: agency.color || '#FF6B35'
                      });
                    }}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(107, 114, 128, 0.2)',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                      borderRadius: '8px',
                      color: '#9CA3AF',
                      fontSize: '0.875rem',
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
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Header Row 1: Title and Actions */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4 flex-1">
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: agency.color || 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.5rem',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                  }}>
                    {agency.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-white mb-1">{agency.name}</h2>
                    <p className="text-sm text-gray-400 leading-relaxed">{agency.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-1 rounded-full" style={{
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: '#3B82F6',
                        fontWeight: 600,
                        textTransform: 'capitalize'
                      }}>
                        {agency.category}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => {
                      const exportData = {
                        agency: {
                          id: agency.id,
                          name: agency.name,
                          description: agency.description,
                          category: agency.category,
                          icon: agency.icon,
                          color: agency.color,
                          agentIds: agency.agentIds,
                          workflowIds: agency.workflowIds,
                          goals: agency.goals,
                          metrics: metrics,
                          created: agency.created,
                          updated: agency.updated
                        },
                        exportedAt: new Date().toISOString(),
                        version: '1.0'
                      };
                      
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${agency.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export_${new Date().toISOString().split('T')[0]}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'rgba(139, 92, 246, 0.15)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#8B5CF6',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.25)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    title="Export agency data as JSON"
                  >
                    📥 Export
                  </button>
                  <button
                    onClick={() => setIsEditingAgency(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#3B82F6',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    title="Edit agency details"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={onClose}
                    style={{
                      background: 'rgba(107, 114, 128, 0.15)',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                      borderRadius: '8px',
                      color: '#9CA3AF',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
                    title="Close"
                  >
                    ×
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Metrics Section */}
        {metrics && !isEditingAgency && (
          <div style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Performance Metrics</h3>
                <p className="text-xs text-gray-400">Real-time performance tracking</p>
              </div>
              <button
                onClick={async () => {
                  setIsRefreshingMetrics(true);
                  await onRefresh();
                  setTimeout(() => setIsRefreshingMetrics(false), 500);
                }}
                disabled={isRefreshingMetrics}
                style={{
                  padding: '0.5rem 1rem',
                  background: isRefreshingMetrics 
                    ? 'rgba(59, 130, 246, 0.3)' 
                    : 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  color: '#3B82F6',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: isRefreshingMetrics ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isRefreshingMetrics) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isRefreshingMetrics) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {isRefreshingMetrics ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                    Refreshing...
                  </>
                ) : (
                  <>🔄 Refresh</>
                )}
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                padding: '1rem',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-semibold">Total Executions</div>
                <div className="text-2xl font-bold text-blue-400">{metrics.totalExecutions}</div>
              </div>
              <div style={{
                padding: '1rem',
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-semibold">Success Rate</div>
                <div className="text-2xl font-bold text-green-400">{metrics.successRate.toFixed(1)}%</div>
              </div>
              <div style={{
                padding: '1rem',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(245, 158, 11, 0.2)'
              }}>
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-semibold">Avg Response</div>
                <div className="text-2xl font-bold text-orange-400">{metrics.averageResponseTime.toFixed(1)}s</div>
              </div>
              <div style={{
                padding: '1rem',
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(139, 92, 246, 0.2)'
              }}>
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-semibold">Active Agents</div>
                <div className="text-2xl font-bold text-purple-400">{matchedAgents.length}</div>
              </div>
            </div>
            {metrics.businessImpact && Object.keys(metrics.businessImpact).length > 0 && (
              <div style={{
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid var(--border-color)'
              }}>
                <h4 className="text-sm font-semibold text-white mb-3">Business Impact</h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '0.75rem'
                }}>
                  {Object.entries(metrics.businessImpact).map(([key, value]) => (
                    <div key={key} style={{
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div className="text-xs text-gray-400 mb-1 capitalize" style={{
                        textTransform: 'capitalize'
                      }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-lg font-bold text-white">{String(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Historical Metrics */}
            {metrics.history && metrics.history.length > 0 && (
              <div style={{
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-color)'
              }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400">Performance Trend (Last 30 Days)</div>
                  <div className="text-xs text-gray-500">
                    {metrics.history.length} data points
                  </div>
                </div>
                <div style={{
                  height: '120px',
                  position: 'relative',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '2px'
                }}>
                  {metrics.history.slice(-20).map((snapshot: any, idx: number) => {
                    const maxExecutions = Math.max(...metrics.history.map((h: any) => h.totalExecutions), 1);
                    const height = (snapshot.totalExecutions / maxExecutions) * 100;
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          height: `${Math.max(5, height)}%`,
                          background: snapshot.successRate >= 80
                            ? 'linear-gradient(to top, #10B981, #059669)'
                            : snapshot.successRate >= 50
                            ? 'linear-gradient(to top, #f59e0b, #d97706)'
                            : 'linear-gradient(to top, #ef4444, #dc2626)',
                          borderRadius: '2px',
                          minHeight: '4px',
                          opacity: 0.8,
                          transition: 'all 0.2s ease'
                        }}
                        title={`${new Date(snapshot.timestamp).toLocaleDateString()}: ${snapshot.totalExecutions} executions, ${snapshot.successRate.toFixed(1)}% success`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>Older</span>
                  <span>Recent</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agents Section */}
        {!isEditingAgency && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Agents</h3>
                <p className="text-xs text-gray-400">{matchedAgents.length} agent{matchedAgents.length !== 1 ? 's' : ''} assigned</p>
              </div>
              <button
                onClick={() => {
                  setShowManageResources(true);
                  setSelectedAgentIds(agency.agentIds);
                  setSelectedWorkflowIds(agency.workflowIds);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: showManageResources 
                    ? 'rgba(107, 114, 128, 0.2)' 
                    : 'rgba(59, 130, 246, 0.15)',
                  border: `1px solid ${showManageResources 
                    ? 'rgba(107, 114, 128, 0.3)' 
                    : 'rgba(59, 130, 246, 0.3)'}`,
                  borderRadius: '8px',
                  color: showManageResources ? '#9CA3AF' : '#3B82F6',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!showManageResources) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showManageResources) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                  }
                }}
              >
                {showManageResources ? 'Cancel' : '✏️ Manage'}
              </button>
            </div>
          {showManageResources ? (
            <div style={{
              padding: '1rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <div className="text-sm font-semibold text-white mb-3">Select Agents</div>
              {agents.length === 0 ? (
                <div className="text-sm text-yellow-400">No agents available</div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {agents.map((agent: any) => (
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
                      <span className="text-xs text-gray-400 ml-auto font-mono">
                        {agent.backendCanisterId.slice(0, 8)}...
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={async () => {
                    await onUpdate(agency.id, {
                      agentIds: selectedAgentIds,
                      workflowIds: selectedWorkflowIds
                    });
                    setShowManageResources(false);
                    await onRefresh();
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: 'rgba(16, 185, 129, 0.3)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '6px',
                    color: '#10B981',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setShowManageResources(false);
                    setSelectedAgentIds(agency.agentIds);
                    setSelectedWorkflowIds(agency.workflowIds);
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '6px',
                    color: '#9CA3AF',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {matchedAgents.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-4">No agents assigned to this agency</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {matchedAgents.map((agent: any) => (
                    <div
                      key={agent.backendCanisterId}
                      style={{
                        padding: '1rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <div className="text-sm text-white font-semibold mb-1">{agent.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{agent.backendCanisterId}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          </div>
        )}

        {/* Goals Section */}
        {!isEditingAgency && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Goals</h3>
                <p className="text-xs text-gray-400">
                  {agency.goals?.length || 0} goal{(agency.goals?.length || 0) !== 1 ? 's' : ''} • 
                  {agency.goals?.filter(g => g.status === 'active').length || 0} active
                </p>
              </div>
              <button
                onClick={() => setShowAddGoalForm(true)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  color: '#10B981',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                + Add Goal
              </button>
            </div>

          {/* Add Goal Form */}
          {showAddGoalForm && (
            <div style={{
              padding: '1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <h5 className="text-sm font-semibold text-white mb-2">Add New Goal</h5>
              <p className="text-xs text-gray-400 mb-3">
                💡 Tip: After creating, click "Map" to configure which agent tasks count toward this goal
              </p>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Goal name"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                />
                <input
                  type="text"
                  placeholder="Target (e.g., 10 pieces/month)"
                  value={newGoal.target}
                  onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (newGoal.name.trim() && newGoal.target.trim()) {
                        // Try to auto-generate mapping based on goal name
                        const { GoalMappingService } = await import('../../services/GoalMappingService');
                        const autoMapping = GoalMappingService.createDefaultMapping(
                          { name: newGoal.name, description: newGoal.description, target: newGoal.target, status: 'active' } as any,
                          agency.category
                        );
                        
                        await onAddGoal(agency.id, {
                          name: newGoal.name.trim(),
                          description: newGoal.description.trim(),
                          target: newGoal.target.trim(),
                          status: 'active',
                          taskMapping: autoMapping
                        });
                        setNewGoal({ name: '', description: '', target: '', currentValue: '' });
                        setShowAddGoalForm(false);
                        await onRefresh();
                      }
                    }}
                    disabled={!newGoal.name.trim() || !newGoal.target.trim()}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: (!newGoal.name.trim() || !newGoal.target.trim())
                        ? 'rgba(107, 114, 128, 0.2)'
                        : 'rgba(16, 185, 129, 0.3)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '6px',
                      color: '#10B981',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: (!newGoal.name.trim() || !newGoal.target.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (!newGoal.name.trim() || !newGoal.target.trim()) ? 0.5 : 1
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowAddGoalForm(false);
                      setNewGoal({ name: '', description: '', target: '', currentValue: '' });
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: 'rgba(107, 114, 128, 0.2)',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                      borderRadius: '6px',
                      color: '#9CA3AF',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Goals List */}
          {agency.goals && agency.goals.length > 0 ? (
            <div className="space-y-2">
              {agency.goals.map(goal => {
                // Calculate progress percentage
                let progressPercent = 0;
                if (goal.currentValue && goal.target) {
                  const targetMatch = goal.target.match(/(\d+)/);
                  const currentMatch = goal.currentValue.match(/(\d+\.?\d*)/);
                  if (targetMatch && currentMatch) {
                    const targetNum = parseFloat(targetMatch[1]);
                    const currentNum = parseFloat(currentMatch[1]);
                    if (targetNum > 0) {
                      progressPercent = Math.min(100, (currentNum / targetNum) * 100);
                    }
                  }
                }
                
                return (
                <div
                  key={goal.id}
                  style={{
                    padding: '0.75rem',
                    background: goal.status === 'active' 
                      ? 'rgba(16, 185, 129, 0.1)' 
                      : goal.status === 'completed'
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'rgba(107, 114, 128, 0.1)',
                    borderRadius: '6px',
                    border: `1px solid ${goal.status === 'active' 
                      ? 'rgba(16, 185, 129, 0.3)' 
                      : goal.status === 'completed'
                      ? 'rgba(59, 130, 246, 0.3)'
                      : 'rgba(107, 114, 128, 0.3)'}`
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm text-white font-semibold">{goal.name}</div>
                      {goal.description && (
                        <div className="text-xs text-gray-400 mt-1">{goal.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded" style={{
                        background: goal.status === 'active' 
                          ? 'rgba(16, 185, 129, 0.2)' 
                          : goal.status === 'completed'
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'rgba(107, 114, 128, 0.2)',
                        color: goal.status === 'active' 
                          ? '#10B981' 
                          : goal.status === 'completed'
                          ? '#3B82F6'
                          : '#9CA3AF',
                        fontWeight: 600
                      }}>
                        {goal.status}
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  {goal.status === 'active' && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">
                          {goal.currentValue || '0'} / {goal.target}
                        </span>
                        <span className="text-xs font-semibold" style={{
                          color: progressPercent >= 100 ? '#10B981' : progressPercent >= 50 ? '#f59e0b' : '#ef4444'
                        }}>
                          {progressPercent.toFixed(0)}%
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(100, progressPercent)}%`,
                          height: '100%',
                          background: progressPercent >= 100 
                            ? 'linear-gradient(90deg, #10B981, #059669)' 
                            : progressPercent >= 50 
                            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                            : 'linear-gradient(90deg, #ef4444, #dc2626)',
                          transition: 'width 0.3s ease',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>
                  )}
                  
                  {goal.status === 'completed' && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400">✓ Completed</span>
                        {goal.currentValue && (
                          <span className="text-xs text-gray-400">
                            Achieved: {goal.currentValue}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Task Mapping Indicator */}
                  {goal.taskMapping ? (
                    <div className="mb-2 p-2" style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '4px',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-blue-400 font-semibold">📊 Task Mapping Active</div>
                          <div className="text-xs text-gray-400 mt-1">
                            Count: {goal.taskMapping.countMethod} • 
                            {goal.taskMapping.triggerTypes?.length ? ` Triggers: ${goal.taskMapping.triggerTypes.join(', ')}` : ' All triggers'} •
                            {goal.taskMapping.taskStatus?.length ? ` Status: ${goal.taskMapping.taskStatus.join(', ')}` : ' All statuses'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-2 p-2" style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      borderRadius: '4px',
                      border: '1px solid rgba(245, 158, 11, 0.2)'
                    }}>
                      <div className="text-xs text-yellow-400 font-semibold">⚠️ No Task Mapping</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Goal uses keyword matching. Click "Map" below to configure task tracking.
                      </div>
                    </div>
                  )}

                  {editingGoalId === goal.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingGoal!.name}
                        onChange={(e) => setEditingGoal({ ...editingGoal!, name: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '0.875rem'
                        }}
                      />
                      <input
                        type="text"
                        value={editingGoal!.target}
                        onChange={(e) => setEditingGoal({ ...editingGoal!, target: e.target.value })}
                        placeholder="Target"
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '0.875rem'
                        }}
                      />
                      <input
                        type="text"
                        value={editingGoal!.currentValue || ''}
                        onChange={(e) => setEditingGoal({ ...editingGoal!, currentValue: e.target.value })}
                        placeholder="Current value (optional)"
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '0.875rem'
                        }}
                      />
                      <select
                        value={editingGoal!.status}
                        onChange={(e) => setEditingGoal({ ...editingGoal!, status: e.target.value as any })}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '0.875rem'
                        }}
                      >
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="paused">Paused</option>
                      </select>
                      
                      {/* Task Mapping Configuration */}
                      <div className="flex items-center justify-between p-2" style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.3)'
                      }}>
                        <div>
                          <div className="text-xs font-semibold text-white">Task Mapping</div>
                          <div className="text-xs text-gray-400">
                            {editingGoal!.taskMapping 
                              ? `${editingGoal!.taskMapping.countMethod} tasks${editingGoal!.taskMapping.triggerTypes?.length ? ` (${editingGoal!.taskMapping.triggerTypes.join(', ')})` : ''}`
                              : 'Not configured (uses keyword matching)'}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setMappingForGoal(goal.id);
                            setShowMappingConfig(true);
                          }}
                          style={{
                            padding: '0.25rem 0.75rem',
                            background: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '4px',
                            color: '#3B82F6',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {editingGoal!.taskMapping ? 'Edit' : 'Configure'}
                        </button>
                      </div>

                      {/* Manual Tracking Toggle */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={editingGoal!.manualTracking || false}
                          onChange={(e) => setEditingGoal({ ...editingGoal!, manualTracking: e.target.checked })}
                        />
                        <span className="text-xs text-white">Manual tracking (disable auto-updates)</span>
                      </label>

                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await onUpdateGoal(agency.id, goal.id, {
                              name: editingGoal!.name,
                              target: editingGoal!.target,
                              currentValue: editingGoal!.currentValue || undefined,
                              status: editingGoal!.status,
                              taskMapping: editingGoal!.taskMapping,
                              manualTracking: editingGoal!.manualTracking
                            });
                            setEditingGoalId(null);
                            setEditingGoal(null);
                            await onRefresh();
                          }}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'rgba(16, 185, 129, 0.3)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            borderRadius: '6px',
                            color: '#10B981',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingGoalId(null);
                            setEditingGoal(null);
                          }}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'rgba(107, 114, 128, 0.2)',
                            border: '1px solid rgba(107, 114, 128, 0.3)',
                            borderRadius: '6px',
                            color: '#9CA3AF',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setMappingForGoal(goal.id);
                            setEditingGoal({
                              name: goal.name,
                              description: goal.description || '',
                              target: goal.target,
                              currentValue: goal.currentValue || '',
                              status: goal.status,
                              taskMapping: goal.taskMapping,
                              manualTracking: goal.manualTracking
                            });
                            setShowMappingConfig(true);
                          }}
                          style={{
                            padding: '0.25rem 0.75rem',
                            background: goal.taskMapping 
                              ? 'rgba(139, 92, 246, 0.2)' 
                              : 'rgba(245, 158, 11, 0.2)',
                            border: goal.taskMapping
                              ? '1px solid rgba(139, 92, 246, 0.3)'
                              : '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '4px',
                            color: goal.taskMapping ? '#8B5CF6' : '#f59e0b',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title={goal.taskMapping ? "Edit task mapping" : "Configure task mapping - Click to connect this goal to agent tasks"}
                        >
                          {goal.taskMapping ? '📊 Edit Map' : '📊 Map Tasks'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingGoalId(goal.id);
                            setEditingGoal({
                              name: goal.name,
                              description: goal.description || '',
                              target: goal.target,
                              currentValue: goal.currentValue || '',
                              status: goal.status,
                              taskMapping: goal.taskMapping,
                              manualTracking: goal.manualTracking
                            });
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '4px',
                            color: '#3B82F6',
                            fontSize: '0.65rem',
                            cursor: 'pointer'
                          }}
                          title="Edit goal"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete goal "${goal.name}"?`)) {
                              await onDeleteGoal(agency.id, goal.id);
                              await onRefresh();
                            }
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '4px',
                            color: '#ef4444',
                            fontSize: '0.65rem',
                            cursor: 'pointer'
                          }}
                          title="Delete goal"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-400">No goals set. Click "Add Goal" to create one.</div>
          )}
          </div>
        )}

        {/* Activity Timeline */}
        {!isEditingAgency && workflowExecutions.length > 0 && (
          <div className="mb-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white mb-1">Recent Activity</h3>
              <p className="text-xs text-gray-400">
                {workflowExecutions.filter((e: any) => 
                  agency.workflowIds.includes(e.agencyId)
                ).slice(0, 10).length} recent execution{workflowExecutions.filter((e: any) => 
                  agency.workflowIds.includes(e.agencyId)
                ).slice(0, 10).length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {workflowExecutions
                .filter((exec: any) => agency.workflowIds.includes(exec.agencyId))
                .sort((a: any, b: any) => (b.startTime || 0) - (a.startTime || 0))
                .slice(0, 10)
                .map((exec: any) => {
                  const statusColors: Record<string, string> = {
                    completed: '#10B981',
                    running: '#3B82F6',
                    failed: '#ef4444',
                    pending: '#f59e0b',
                    paused: '#9CA3AF'
                  };
                  const statusColor = statusColors[exec.status] || '#9CA3AF';
                  const execDate = exec.startTime ? new Date(exec.startTime) : new Date();
                  const timeAgo = execDate.getTime() > Date.now() - 86400000 
                    ? `${Math.floor((Date.now() - execDate.getTime()) / 3600000)}h ago`
                    : execDate.toLocaleDateString();
                  
                  return (
                    <div
                      key={exec.id}
                      style={{
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        borderLeft: `3px solid ${statusColor}`
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm text-white font-semibold">
                          {exec.agencyName || 'Workflow Execution'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded" style={{
                            background: `${statusColor}20`,
                            color: statusColor,
                            fontWeight: 600
                          }}>
                            {exec.status}
                          </span>
                          <span className="text-xs text-gray-400">{timeAgo}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 truncate" title={exec.input}>
                        {exec.input || 'No input'}
                      </div>
                      {exec.error && (
                        <div className="text-xs text-red-400 mt-1">Error: {exec.error}</div>
                      )}
                      {exec.status === 'completed' && exec.endTime && (
                        <div className="text-xs text-gray-500 mt-1">
                          Duration: {((exec.endTime - exec.startTime) / 1000).toFixed(1)}s
                        </div>
                      )}
                    </div>
                  );
                })}
              {workflowExecutions.filter((e: any) => agency.workflowIds.includes(e.agencyId)).length === 0 && (
                <div className="text-sm text-gray-400 text-center py-4">
                  No recent activity
                </div>
              )}
            </div>
          </div>
        )}

        {/* Task Mapping Configuration Modal */}
        {showMappingConfig && mappingForGoal && (
          <GoalMappingConfig
            mapping={editingGoal?.taskMapping || (mappingForGoal ? agency.goals.find(g => g.id === mappingForGoal)?.taskMapping : undefined)}
            availableAgents={agents}
            onChange={(mapping) => {
              if (editingGoal) {
                setEditingGoal({ ...editingGoal, taskMapping: mapping });
              } else if (mappingForGoal) {
                // Update goal directly if not in edit mode
                const goal = agency.goals.find(g => g.id === mappingForGoal);
                if (goal) {
                  onUpdateGoal(agency.id, goal.id, { taskMapping: mapping }).then(() => {
                    onRefresh();
                  });
                }
              }
            }}
            onClose={() => {
              setShowMappingConfig(false);
              setMappingForGoal(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

