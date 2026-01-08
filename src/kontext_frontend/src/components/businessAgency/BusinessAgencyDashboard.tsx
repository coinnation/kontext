/**
 * Business Agency Dashboard - Embedded and Fullscreen View
 * Similar to WorkflowCanvas pattern - can be embedded in tab space or opened fullscreen
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { BusinessAgency, AgencyGoal, GoalTaskMapping } from '../../types/businessAgency';
import { GoalMappingConfig } from './GoalMappingConfig';
import { CostCalculationService } from '../../services/CostCalculationService';

interface BusinessAgencyDashboardProps {
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
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
  className?: string;
}

export const BusinessAgencyDashboard: React.FC<BusinessAgencyDashboardProps> = ({ 
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
  onRefresh,
  isFullscreen = false,
  onFullscreenToggle,
  className = ''
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

  // Dashboard content component (reusable for both embedded and fullscreen)
  const DashboardContent: React.FC = () => (
    <div 
      className={`flex flex-col h-full ${className}`}
      style={{ 
        background: isFullscreen ? 'var(--primary-black)' : 'transparent',
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Header Section */}
      <div style={{
        padding: isFullscreen ? '1rem 1.5rem' : '1rem',
        borderBottom: '1px solid var(--border-color)',
        background: isFullscreen ? 'rgba(17, 17, 17, 0.98)' : 'transparent',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {!isEditingAgency && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: isFullscreen ? '48px' : '40px',
                  height: isFullscreen ? '48px' : '40px',
                  background: agency.color || 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isFullscreen ? '1.75rem' : '1.5rem',
                  flexShrink: 0
                }}>
                  {agency.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{
                    fontSize: isFullscreen ? '1.5rem' : '1.25rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    margin: '0 0 0.25rem 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {agency.name}
                  </h2>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-gray)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {agency.description}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
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
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsEditingAgency(true);
                  }}
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
                {onFullscreenToggle && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onFullscreenToggle();
                    }}
                    style={{
                      padding: '0.5rem',
                      background: isFullscreen ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '6px',
                      color: '#3B82F6',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px'
                    }}
                    title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isFullscreen ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)';
                    }}
                  >
                    {isFullscreen ? '⤓' : '⤢'}
                  </button>
                )}
                {!isFullscreen && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onClose();
                    }}
                    style={{
                      background: 'rgba(107, 114, 128, 0.15)',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                      borderRadius: '6px',
                      color: '#9CA3AF',
                      fontSize: '1.125rem',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
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
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div 
        ref={(el) => {
          // Store scroll position reference
          if (el) {
            (el as any)._scrollContainer = true;
            el.setAttribute('data-scroll-container', 'true');
          }
        }}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isFullscreen ? '1.5rem' : '1rem',
          minHeight: 0
        }} 
        className="chat-scrollbar"
        onScroll={(e) => {
          // Prevent scroll jumping - maintain scroll position
          e.stopPropagation();
        }}
      >
        {/* Centered Container with Max Width */}
        <div style={{
          maxWidth: isFullscreen ? '1400px' : '1200px',
          margin: '0 auto',
          width: '100%',
          paddingBottom: '2rem'
        }}>
        {/* Edit Agency Form - Now in scrollable area */}
        {isEditingAgency && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
            padding: '2rem',
            marginBottom: '2rem',
            maxWidth: '800px',
            margin: '0 auto 2rem auto'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Edit Agency
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {onFullscreenToggle && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onFullscreenToggle();
                      }}
                      style={{
                        padding: '0.5rem',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '6px',
                        color: '#3B82F6',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px'
                      }}
                      title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    >
                      {isFullscreen ? '⤓' : '⤢'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    // Preserve scroll position
                    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
                    const scrollPos = scrollContainer?.scrollTop || 0;
                      setIsEditingAgency(false);
                      setEditingAgencyData({
                        name: agency.name,
                        description: agency.description,
                        category: agency.category,
                        icon: agency.icon,
                        color: agency.color || '#FF6B35'
                      });
                    // Restore scroll position after state update
                    requestAnimationFrame(() => {
                      if (scrollContainer) {
                        scrollContainer.scrollTop = scrollPos;
                      }
                    });
                    }}
                    style={{
                      background: 'rgba(107, 114, 128, 0.15)',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                      borderRadius: '6px',
                      color: '#9CA3AF',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
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
                    title="Cancel"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    color: 'var(--text-gray)',
                    marginBottom: '0.5rem'
                  }}>
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
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      minHeight: '44px',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                  />
                </div>
                
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    color: 'var(--text-gray)',
                    marginBottom: '0.5rem'
                  }}>
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
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      resize: 'vertical',
                      transition: 'all 0.2s ease',
                      fontFamily: 'inherit',
                      outline: 'none',
                      minHeight: '80px'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      color: 'var(--text-gray)',
                      marginBottom: '0.5rem'
                    }}>
                      Category
                    </label>
                    <select
                      value={editingAgencyData.category}
                      onChange={(e) => setEditingAgencyData({ ...editingAgencyData, category: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#ffffff',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minHeight: '44px',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                      <option value="marketing" style={{ background: '#111111' }}>Marketing</option>
                      <option value="sales" style={{ background: '#111111' }}>Sales</option>
                      <option value="support" style={{ background: '#111111' }}>Support</option>
                      <option value="operations" style={{ background: '#111111' }}>Operations</option>
                      <option value="custom" style={{ background: '#111111' }}>Custom</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      color: 'var(--text-gray)',
                      marginBottom: '0.5rem'
                    }}>
                      Icon
                    </label>
                    <input
                      type="text"
                      value={editingAgencyData.icon}
                      onChange={(e) => setEditingAgencyData({ ...editingAgencyData, icon: e.target.value })}
                      placeholder="🏢"
                      maxLength={2}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#ffffff',
                        fontSize: '1.25rem',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        minHeight: '44px',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      color: 'var(--text-gray)',
                      marginBottom: '0.5rem'
                    }}>
                      Color
                    </label>
                    <input
                      type="color"
                      value={editingAgencyData.color}
                      onChange={(e) => setEditingAgencyData({ ...editingAgencyData, color: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.25rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        height: '44px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  gap: '0.75rem', 
                  justifyContent: 'flex-end',
                  marginTop: '0.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
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
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minHeight: '44px',
                      whiteSpace: 'nowrap'
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
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Preserve scroll position
                      const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
                      const scrollPos = scrollContainer?.scrollTop || 0;
                      await onUpdate(agency.id, editingAgencyData);
                      setIsEditingAgency(false);
                      // Restore scroll position after state update
                      requestAnimationFrame(() => {
                        if (scrollContainer) {
                          scrollContainer.scrollTop = scrollPos;
                        }
                      });
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minHeight: '44px',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
        )}
        {/* Metrics Section */}
        {metrics && !isEditingAgency && (
          <div style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.25rem 0' }}>
                  Performance Metrics
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', margin: 0 }}>
                  Real-time performance tracking
                </p>
              </div>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
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
              >
                {isRefreshingMetrics ? (
                  <>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid rgba(59, 130, 246, 0.3)',
                      borderTopColor: '#3B82F6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Total Executions
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#60A5FA' }}>
                  {metrics.totalExecutions}
                </div>
              </div>
              <div style={{
                padding: '1rem',
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Success Rate
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#34D399' }}>
                  {metrics.successRate.toFixed(1)}%
                </div>
              </div>
              <div style={{
                padding: '1rem',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(245, 158, 11, 0.2)'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Avg Response
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#FBBF24' }}>
                  {metrics.averageResponseTime.toFixed(1)}s
                </div>
              </div>
              <div style={{
                padding: '1rem',
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(139, 92, 246, 0.2)'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Active Agents
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#A78BFA' }}>
                  {matchedAgents.length}
                </div>
              </div>
            </div>

            {/* Cost Metrics Section */}
            {metrics?.costMetrics && (
              <div style={{
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid var(--border-color)'
              }}>
                <h4 style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  💰 Cost Analytics
                </h4>
                
                {/* Cost Overview Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  {/* Total Cost */}
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem'
                  }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Total Cost
                    </div>
                    <div style={{ color: '#3B82F6', fontSize: '1.5rem', fontWeight: 600 }}>
                      {CostCalculationService.formatCost(metrics.costMetrics.totalUsd)}
                    </div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                      {CostCalculationService.formatCredits(metrics.costMetrics.totalCredits)} credits
                    </div>
                  </div>

                  {/* Average Cost Per Execution */}
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem'
                  }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Avg Cost/Execution
                    </div>
                    <div style={{ color: '#10B981', fontSize: '1.5rem', fontWeight: 600 }}>
                      {CostCalculationService.formatCost(metrics.costMetrics.averageCostPerExecution)}
                    </div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                      {metrics.totalExecutions} executions
                    </div>
                  </div>

                  {/* Total Cycles */}
                  <div style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem'
                  }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Total Cycles
                    </div>
                    <div style={{ color: '#8B5CF6', fontSize: '1.5rem', fontWeight: 600 }}>
                      {(Number(metrics.costMetrics.totalCycles) / 1_000_000_000_000).toFixed(3)}T
                    </div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                      {Number(metrics.costMetrics.totalCycles).toLocaleString()} cycles
                    </div>
                  </div>

                  {/* Total Tokens */}
                  {metrics.costMetrics.totalTokens > 0 && (
                    <div style={{
                      background: 'rgba(236, 72, 153, 0.1)',
                      border: '1px solid rgba(236, 72, 153, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem'
                    }}>
                      <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        Total Tokens
                      </div>
                      <div style={{ color: '#EC4899', fontSize: '1.5rem', fontWeight: 600 }}>
                        {(metrics.costMetrics.totalTokens / 1_000_000).toFixed(2)}M
                      </div>
                      <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                        {metrics.costMetrics.totalTokens.toLocaleString()} tokens
                      </div>
                    </div>
                  )}

                  {/* Token Cost */}
                  {metrics.costMetrics.totalTokenCostUsd > 0 && (
                    <div style={{
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem'
                    }}>
                      <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        AI Token Cost
                      </div>
                      <div style={{ color: '#FBBF24', fontSize: '1.5rem', fontWeight: 600 }}>
                        {CostCalculationService.formatCost(metrics.costMetrics.totalTokenCostUsd)}
                      </div>
                      <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                        {metrics.costMetrics.averageTokensPerTask > 0 && (
                          <>Avg: {Math.round(metrics.costMetrics.averageTokensPerTask).toLocaleString()} tokens/task</>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cost Breakdown */}
                {metrics.costMetrics.totalTokenCostUsd > 0 && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px'
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'rgba(255, 255, 255, 0.6)',
                      marginBottom: '0.5rem'
                    }}>
                      Cost Breakdown
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          background: '#3B82F6',
                          borderRadius: '2px'
                        }} />
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Infrastructure (Cycles)</span>
                      </div>
                      <span style={{ color: '#3B82F6', fontWeight: 600 }}>
                        {CostCalculationService.formatCost(metrics.costMetrics.totalUsd - metrics.costMetrics.totalTokenCostUsd)}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.85rem',
                      marginTop: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          background: '#FBBF24',
                          borderRadius: '2px'
                        }} />
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>AI Usage (Tokens)</span>
                      </div>
                      <span style={{ color: '#FBBF24', fontWeight: 600 }}>
                        {CostCalculationService.formatCost(metrics.costMetrics.totalTokenCostUsd)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Budget Goals Tracking */}
                {agency.goals.filter(g => 
                  g.goalType === 'budget' || 
                  g.goalType === 'total_spend' || 
                  g.goalType === 'cost_per_outcome'
                ).length > 0 && (
                  <div style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '1rem',
                    marginTop: '1rem'
                  }}>
                    <h5 style={{
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      marginBottom: '0.75rem'
                    }}>
                      Budget Goals
                    </h5>
                    {agency.goals
                      .filter(g => g.goalType === 'budget' || g.goalType === 'total_spend' || g.goalType === 'cost_per_outcome')
                      .map(goal => {
                        const targetMatch = goal.target.match(/(\d+\.?\d*)/);
                        const targetValue = targetMatch ? parseFloat(targetMatch[1]) : 0;
                        const currentValue = goal.goalType === 'cost_per_outcome' 
                          ? metrics.costMetrics.averageCostPerExecution
                          : metrics.costMetrics.totalUsd;
                        const percentage = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
                        const status = percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'on_track';
                        const statusColor = status === 'exceeded' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10B981';

                        return (
                          <div key={goal.id} style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            marginBottom: '0.5rem'
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.5rem'
                            }}>
                              <span style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 500 }}>
                                {goal.name}
                              </span>
                              <span style={{
                                color: statusColor,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                padding: '0.25rem 0.5rem',
                                background: `${statusColor}15`,
                                borderRadius: '4px'
                              }}>
                                {status === 'exceeded' ? '⚠️ Exceeded' : status === 'warning' ? '⚠️ Warning' : '✅ On Track'}
                              </span>
                            </div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.5rem',
                              fontSize: '0.75rem',
                              color: 'rgba(255, 255, 255, 0.6)'
                            }}>
                              <span>
                                {CostCalculationService.formatCost(currentValue)} / {CostCalculationService.formatCost(targetValue)}
                              </span>
                              <span>{percentage.toFixed(1)}%</span>
                            </div>
                            <div style={{
                              width: '100%',
                              height: '6px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(100, percentage)}%`,
                                height: '100%',
                                background: statusColor,
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
            
            {/* Historical Metrics */}
            {metrics.history && metrics.history.length > 0 && (
              <div style={{
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                    Performance Trend (Last 30 Days)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(156, 163, 175, 0.7)' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'rgba(156, 163, 175, 0.7)' }}>
                  <span>Older</span>
                  <span>Recent</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agents Section */}
        {!isEditingAgency && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.25rem 0' }}>
                  Agents
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', margin: 0 }}>
                  {matchedAgents.length} agent{matchedAgents.length !== 1 ? 's' : ''} assigned
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
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
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.75rem' }}>
                  Select Agents
                </div>
                {agents.length === 0 ? (
                  <div style={{ fontSize: '0.875rem', color: '#FBBF24' }}>No agents available</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
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
                        <span style={{ fontSize: '0.875rem', color: '#ffffff' }}>{agent.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginLeft: 'auto', fontFamily: 'ui-monospace, monospace' }}>
                          {agent.backendCanisterId.slice(0, 8)}...
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
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
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
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
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-gray)', textAlign: 'center', padding: '1rem' }}>
                    No agents assigned to this agency
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: '0.5rem'
                  }}>
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
                        <div style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: 600, marginBottom: '0.25rem' }}>
                          {agent.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', fontFamily: 'ui-monospace, monospace' }}>
                          {agent.backendCanisterId}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Workflows Section */}
        {!isEditingAgency && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.25rem 0' }}>
                  Workflows
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', margin: 0 }}>
                  {matchedWorkflows.length} workflow{matchedWorkflows.length !== 1 ? 's' : ''} assigned
                </p>
              </div>
            </div>
            {matchedWorkflows.length === 0 ? (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-gray)', textAlign: 'center', padding: '1rem' }}>
                No workflows assigned to this agency
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '0.5rem'
              }}>
                {matchedWorkflows.map((workflow: any) => (
                  <div
                    key={workflow.id}
                    style={{
                      padding: '1rem',
                      background: 'rgba(139, 92, 246, 0.1)',
                      borderRadius: '10px',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                    }}
                  >
                    <div style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: 600, marginBottom: '0.25rem' }}>
                      {workflow.name}
                    </div>
                    {workflow.description && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                        {workflow.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Goals Section */}
        {!isEditingAgency && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.25rem 0' }}>
                  Goals
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', margin: 0 }}>
                  {agency.goals?.length || 0} goal{(agency.goals?.length || 0) !== 1 ? 's' : ''} • 
                  {' '}{agency.goals?.filter(g => g.status === 'active').length || 0} active
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddGoalForm(true);
                }}
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
                <h5 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.5rem' }}>
                  Add New Goal
                </h5>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.75rem' }}>
                  💡 Tip: After creating, click "Map" to configure which agent tasks count toward this goal
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (newGoal.name.trim() && newGoal.target.trim()) {
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
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: 600 }}>
                            {goal.name}
                          </div>
                          {goal.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                              {goal.description}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
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
                        <div style={{ marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                              {goal.currentValue || '0'} / {goal.target}
                            </span>
                            <span style={{
                              fontSize: '0.75rem',
                              color: progressPercent >= 100 ? '#10B981' : progressPercent >= 50 ? '#f59e0b' : '#ef4444',
                              fontWeight: 600
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
                        <div style={{ marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#10B981' }}>✓ Completed</span>
                            {goal.currentValue && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                                Achieved: {goal.currentValue}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Task Mapping Indicator */}
                      {goal.taskMapping ? (
                        <div style={{
                          marginBottom: '0.5rem',
                          padding: '0.5rem',
                          background: 'rgba(59, 130, 246, 0.1)',
                          borderRadius: '4px',
                          border: '1px solid rgba(59, 130, 246, 0.2)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#60A5FA', fontWeight: 600 }}>
                                📊 Task Mapping Active
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                                Count: {goal.taskMapping.countMethod} • 
                                {goal.taskMapping.triggerTypes?.length ? ` Triggers: ${goal.taskMapping.triggerTypes.join(', ')}` : ' All triggers'} •
                                {goal.taskMapping.taskStatus?.length ? ` Status: ${goal.taskMapping.taskStatus.join(', ')}` : ' All statuses'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          marginBottom: '0.5rem',
                          padding: '0.5rem',
                          background: 'rgba(245, 158, 11, 0.1)',
                          borderRadius: '4px',
                          border: '1px solid rgba(245, 158, 11, 0.2)'
                        }}>
                          <div style={{ fontSize: '0.75rem', color: '#FBBF24', fontWeight: 600 }}>
                            ⚠️ No Task Mapping
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                            Goal uses keyword matching. Click "Map" below to configure task tracking.
                          </div>
                        </div>
                      )}

                      {editingGoalId === goal.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                              fontSize: '0.875rem',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="active" style={{ background: '#111111' }}>Active</option>
                            <option value="completed" style={{ background: '#111111' }}>Completed</option>
                            <option value="paused" style={{ background: '#111111' }}>Paused</option>
                          </select>
                          
                          {/* Task Mapping Configuration */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem',
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: '6px',
                            border: '1px solid rgba(59, 130, 246, 0.3)'
                          }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ffffff' }}>
                                Task Mapping
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                                {editingGoal!.taskMapping 
                                  ? `${editingGoal!.taskMapping.countMethod} tasks${editingGoal!.taskMapping.triggerTypes?.length ? ` (${editingGoal!.taskMapping.triggerTypes.join(', ')})` : ''}`
                                  : 'Not configured (uses keyword matching)'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                            <span style={{ fontSize: '0.75rem', color: '#ffffff' }}>
                              Manual tracking (disable auto-updates)
                            </span>
                          </label>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingGoalId(null);
                                setEditingGoal(null);
                              }}
                              style={{
                                flex: 1,
                                padding: '0.5rem',
                                background: 'rgba(107, 114, 114, 0.2)',
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
              <div style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                No goals set. Click "Add Goal" to create one.
              </div>
            )}
          </div>
        )}

        {/* Activity Timeline */}
        {!isEditingAgency && workflowExecutions.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.25rem 0' }}>
                Recent Activity
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', margin: 0 }}>
                {workflowExecutions.filter((e: any) => 
                  agency.workflowIds.includes(e.agencyId)
                ).slice(0, 10).length} recent execution{workflowExecutions.filter((e: any) => 
                  agency.workflowIds.includes(e.agencyId)
                ).slice(0, 10).length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <div style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: 600 }}>
                          {exec.agencyName || 'Workflow Execution'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            background: `${statusColor}20`,
                            color: statusColor,
                            fontWeight: 600
                          }}>
                            {exec.status}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>{timeAgo}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={exec.input}>
                        {exec.input || 'No input'}
                      </div>
                      {exec.error && (
                        <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '0.25rem' }}>
                          Error: {exec.error}
                        </div>
                      )}
                      {exec.status === 'completed' && exec.endTime && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(156, 163, 175, 0.7)', marginTop: '0.25rem' }}>
                          Duration: {((exec.endTime - exec.startTime) / 1000).toFixed(1)}s
                        </div>
                      )}
                    </div>
                  );
                })}
              {workflowExecutions.filter((e: any) => agency.workflowIds.includes(e.agencyId)).length === 0 && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-gray)', textAlign: 'center', padding: '1rem' }}>
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
    </div>
  );

  // Render fullscreen via portal or embedded
  if (isFullscreen) {
    return createPortal(
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        background: 'var(--primary-black)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        isolation: 'isolate'
      }}>
        <DashboardContent />
      </div>,
      document.body
    );
  }

  return <DashboardContent />;
};

