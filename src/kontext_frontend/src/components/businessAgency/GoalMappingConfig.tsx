import React, { useState } from 'react';
import type { GoalTaskMapping } from '../../types/businessAgency';

interface GoalMappingConfigProps {
  mapping: GoalTaskMapping | undefined;
  availableAgents: Array<{ backendCanisterId: string; name: string }>;
  onChange: (mapping: GoalTaskMapping | undefined) => void;
  onClose: () => void;
}

export const GoalMappingConfig: React.FC<GoalMappingConfigProps> = ({
  mapping,
  availableAgents,
  onChange,
  onClose
}) => {
  const [config, setConfig] = useState<GoalTaskMapping>(mapping || {
    countMethod: 'completed',
    timeWindow: { type: 'all_time' }
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newMetadataKey, setNewMetadataKey] = useState('');
  const [newMetadataValue, setNewMetadataValue] = useState('');

  const updateConfig = (updates: Partial<GoalTaskMapping>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const toggleAgent = (agentId: string) => {
    const current = config.agentIds || [];
    const updated = current.includes(agentId)
      ? current.filter(id => id !== agentId)
      : [...current, agentId];
    updateConfig({ agentIds: updated.length > 0 ? updated : undefined });
  };

  const toggleTriggerType = (type: string) => {
    const current = config.triggerTypes || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    updateConfig({ triggerTypes: updated.length > 0 ? updated : undefined });
  };

  const toggleTaskStatus = (status: string) => {
    const current = config.taskStatus || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    updateConfig({ taskStatus: updated.length > 0 ? updated : undefined });
  };

  const toggleMcpTool = (tool: string) => {
    const current = config.mcpToolsUsed || [];
    const updated = current.includes(tool)
      ? current.filter(t => t !== tool)
      : [...current, tool];
    updateConfig({ mcpToolsUsed: updated.length > 0 ? updated : undefined });
  };

  const addMetadata = () => {
    if (!newMetadataKey.trim() || !newMetadataValue.trim()) return;
    const current = config.triggerMetadata || [];
    updateConfig({
      triggerMetadata: [...current, { key: newMetadataKey.trim(), value: newMetadataValue.trim() }]
    });
    setNewMetadataKey('');
    setNewMetadataValue('');
  };

  const removeMetadata = (index: number) => {
    const current = config.triggerMetadata || [];
    updateConfig({
      triggerMetadata: current.filter((_, i) => i !== index)
    });
  };

  const handleSave = () => {
    // Clean up empty arrays
    const cleaned: GoalTaskMapping = {
      countMethod: config.countMethod,
      ...(config.agentIds && config.agentIds.length > 0 ? { agentIds: config.agentIds } : {}),
      ...(config.triggerTypes && config.triggerTypes.length > 0 ? { triggerTypes: config.triggerTypes } : {}),
      ...(config.taskStatus && config.taskStatus.length > 0 ? { taskStatus: config.taskStatus } : {}),
      ...(config.mcpToolsUsed && config.mcpToolsUsed.length > 0 ? { mcpToolsUsed: config.mcpToolsUsed } : {}),
      ...(config.triggerMetadata && config.triggerMetadata.length > 0 ? { triggerMetadata: config.triggerMetadata } : {}),
      ...(config.inputContains ? { inputContains: config.inputContains } : {}),
      ...(config.resultContains ? { resultContains: config.resultContains } : {}),
      ...(config.timeWindow ? { timeWindow: config.timeWindow } : {}),
    };
    onChange(cleaned);
    onClose();
  };

  return (
    <div style={{
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
      zIndex: 10001,
      padding: '1rem'
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    }}
    >
      <div style={{
        background: 'var(--secondary-black)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        padding: '2rem',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        overflow: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Configure Task Mapping</h3>
            <p className="text-sm text-gray-400 mt-1">
              Define which agent tasks count toward this goal's progress
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
          >
            ×
          </button>
        </div>

        {/* Explanation Box */}
        <div className="mb-4 p-4" style={{
          background: 'rgba(59, 130, 246, 0.15)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <div className="text-sm font-semibold text-white mb-2">💡 How This Works</div>
          <div className="text-xs text-gray-300 space-y-1">
            <p>
              <strong>Task Mapping</strong> connects your goal to actual agent task performance. 
              Instead of guessing, you specify exactly which tasks should count toward your goal.
            </p>
            <p>
              <strong>Example:</strong> If your goal is "Complete 50 webhook tasks", you would:
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Set <strong>Count Method</strong> to "Completed Tasks"</li>
              <li>Select <strong>Trigger Types</strong> → "webhook"</li>
              <li>Select <strong>Task Status</strong> → "completed"</li>
              <li>Leave <strong>Agents</strong> empty to track all agents, or select specific ones</li>
            </ul>
            <p className="mt-2">
              The goal will automatically update as matching tasks are completed by your agents!
            </p>
          </div>
        </div>

        {/* Quick Start Templates */}
        <div className="mb-4 p-3" style={{
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <div className="text-sm font-semibold text-white mb-2">🚀 Quick Start Templates</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setConfig({
                  countMethod: 'completed',
                  taskStatus: ['completed'],
                  timeWindow: { type: 'all_time' }
                });
              }}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '6px',
                color: '#10B981',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ✓ All Completed Tasks
            </button>
            <button
              onClick={() => {
                setConfig({
                  countMethod: 'completed',
                  triggerTypes: ['webhook'],
                  taskStatus: ['completed'],
                  timeWindow: { type: 'all_time' }
                });
              }}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                borderRadius: '6px',
                color: '#8B5CF6',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🔗 Webhook Tasks Only
            </button>
            <button
              onClick={() => {
                setConfig({
                  countMethod: 'completed',
                  triggerTypes: ['scheduled'],
                  taskStatus: ['completed'],
                  timeWindow: { type: 'last_days', value: 30 }
                });
              }}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '6px',
                color: '#f59e0b',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ⏰ Scheduled (Last 30 Days)
            </button>
            <button
              onClick={() => {
                setConfig({
                  countMethod: 'successful',
                  taskStatus: ['completed'],
                  timeWindow: { type: 'all_time' }
                });
              }}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '6px',
                color: '#22c55e',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ✅ Successful Tasks Only
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Count Method */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Count Method <span className="text-yellow-400">*</span>
            </label>
            <select
              value={config.countMethod}
              onChange={(e) => updateConfig({ countMethod: e.target.value as any })}
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
              <option value="total">Total Tasks - Count all matching tasks</option>
              <option value="completed">Completed Tasks - Only count finished tasks</option>
              <option value="successful">Successful Tasks - Only count tasks with successful results</option>
              <option value="failed">Failed Tasks - Only count failed tasks</option>
              <option value="unique_tools">Unique Tools Used - Count distinct MCP tools used</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              This determines how matching tasks are counted toward your goal progress
            </p>
          </div>

          {/* Agent Selection */}
          {availableAgents.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Track Specific Agents
                <span className="text-xs text-gray-400 ml-2 font-normal">
                  (Leave empty to track all agents in this agency)
                </span>
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
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
                      checked={config.agentIds?.includes(agent.backendCanisterId) || false}
                      onChange={() => toggleAgent(agent.backendCanisterId)}
                    />
                    <span className="text-sm text-white">{agent.name}</span>
                    <span className="text-xs text-gray-400 ml-auto font-mono">
                      {agent.backendCanisterId.slice(0, 8)}...
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Trigger Types */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Trigger Types
              <span className="text-xs text-gray-400 ml-2 font-normal">
                (Leave empty to track all trigger types)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {['webhook', 'scheduled', 'manual', 'condition'].map(type => (
                <label
                  key={type}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: config.triggerTypes?.includes(type)
                      ? 'rgba(59, 130, 246, 0.2)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${config.triggerTypes?.includes(type) ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-color)'}`,
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.triggerTypes?.includes(type) || false}
                    onChange={() => toggleTriggerType(type)}
                  />
                  <span className="text-sm text-white capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Task Status */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Task Status
              <span className="text-xs text-gray-400 ml-2 font-normal">
                (Leave empty to track all statuses)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {['completed', 'running', 'failed', 'pending'].map(status => (
                <label
                  key={status}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: config.taskStatus?.includes(status)
                      ? 'rgba(59, 130, 246, 0.2)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${config.taskStatus?.includes(status) ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-color)'}`,
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.taskStatus?.includes(status) || false}
                    onChange={() => toggleTaskStatus(status)}
                  />
                  <span className="text-sm text-white capitalize">{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Time Window */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Time Window
            </label>
            <div className="flex gap-2">
              <select
                value={config.timeWindow?.type || 'all_time'}
                onChange={(e) => updateConfig({
                  timeWindow: {
                    type: e.target.value as any,
                    value: e.target.value !== 'all_time' && e.target.value !== 'since_date' ? config.timeWindow?.value : undefined,
                    sinceDate: e.target.value === 'since_date' ? config.timeWindow?.sinceDate : undefined
                  }
                })}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.875rem'
                }}
              >
                <option value="all_time">All Time</option>
                <option value="last_days">Last N Days</option>
                <option value="last_weeks">Last N Weeks</option>
                <option value="last_months">Last N Months</option>
                <option value="since_date">Since Date</option>
              </select>
              {(config.timeWindow?.type === 'last_days' || 
                config.timeWindow?.type === 'last_weeks' || 
                config.timeWindow?.type === 'last_months') && (
                <input
                  type="number"
                  min="1"
                  value={config.timeWindow?.value || ''}
                  onChange={(e) => updateConfig({
                    timeWindow: {
                      ...config.timeWindow!,
                      value: parseInt(e.target.value) || undefined
                    }
                  })}
                  placeholder="Number"
                  style={{
                    width: '100px',
                    padding: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                />
              )}
              {config.timeWindow?.type === 'since_date' && (
                <input
                  type="date"
                  value={config.timeWindow?.sinceDate 
                    ? new Date(config.timeWindow.sinceDate).toISOString().split('T')[0]
                    : ''}
                  onChange={(e) => updateConfig({
                    timeWindow: {
                      ...config.timeWindow!,
                      sinceDate: e.target.value ? new Date(e.target.value).getTime() : undefined
                    }
                  })}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                />
              )}
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              color: '#3B82F6',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Options
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-3" style={{
              padding: '1rem',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px'
            }}>
              {/* Input Contains */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Input Contains (text filter)
                </label>
                <input
                  type="text"
                  value={config.inputContains || ''}
                  onChange={(e) => updateConfig({ inputContains: e.target.value || undefined })}
                  placeholder="e.g., 'customer inquiry'"
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
              </div>

              {/* Result Contains */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Result Contains (text filter)
                </label>
                <input
                  type="text"
                  value={config.resultContains || ''}
                  onChange={(e) => updateConfig({ resultContains: e.target.value || undefined })}
                  placeholder="e.g., 'success'"
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
              </div>

              {/* Trigger Metadata */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Trigger Metadata (key-value pairs)
                </label>
                <div className="space-y-2 mb-2">
                  {config.triggerMetadata?.map((meta, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm text-white flex-1">
                        {meta.key} = {meta.value}
                      </span>
                      <button
                        onClick={() => removeMetadata(idx)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '4px',
                          color: '#ef4444',
                          fontSize: '0.65rem',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMetadataKey}
                    onChange={(e) => setNewMetadataKey(e.target.value)}
                    placeholder="Key"
                    style={{
                      flex: 1,
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
                    value={newMetadataValue}
                    onChange={(e) => setNewMetadataValue(e.target.value)}
                    placeholder="Value"
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  />
                  <button
                    onClick={addMetadata}
                    disabled={!newMetadataKey.trim() || !newMetadataValue.trim()}
                    style={{
                      padding: '0.5rem 1rem',
                      background: (!newMetadataKey.trim() || !newMetadataValue.trim())
                        ? 'rgba(107, 114, 128, 0.2)'
                        : 'rgba(16, 185, 129, 0.3)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '6px',
                      color: '#10B981',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: (!newMetadataKey.trim() || !newMetadataValue.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (!newMetadataKey.trim() || !newMetadataValue.trim()) ? 0.5 : 1
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* MCP Tools */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  MCP Tools Used (comma-separated)
                </label>
                <input
                  type="text"
                  value={config.mcpToolsUsed?.join(', ') || ''}
                  onChange={(e) => {
                    const tools = e.target.value
                      .split(',')
                      .map(t => t.trim())
                      .filter(t => t.length > 0);
                    updateConfig({ mcpToolsUsed: tools.length > 0 ? tools : undefined });
                  }}
                  placeholder="e.g., 'file_read, database_query'"
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
              </div>
            </div>
          )}
        </div>

        {/* Summary Preview */}
        <div className="mt-4 p-3" style={{
          background: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        }}>
          <div className="text-sm font-semibold text-white mb-2">📋 Mapping Summary</div>
          <div className="text-xs text-gray-300 space-y-1">
            <div>• <strong>Count Method:</strong> {config.countMethod}</div>
            <div>• <strong>Agents:</strong> {config.agentIds && config.agentIds.length > 0 
              ? `${config.agentIds.length} selected` 
              : 'All agents in agency'}</div>
            <div>• <strong>Trigger Types:</strong> {config.triggerTypes && config.triggerTypes.length > 0 
              ? config.triggerTypes.join(', ') 
              : 'All types'}</div>
            <div>• <strong>Task Status:</strong> {config.taskStatus && config.taskStatus.length > 0 
              ? config.taskStatus.join(', ') 
              : 'All statuses'}</div>
            <div>• <strong>Time Window:</strong> {
              config.timeWindow?.type === 'all_time' ? 'All time' :
              config.timeWindow?.type === 'last_days' ? `Last ${config.timeWindow.value} days` :
              config.timeWindow?.type === 'last_weeks' ? `Last ${config.timeWindow.value} weeks` :
              config.timeWindow?.type === 'last_months' ? `Last ${config.timeWindow.value} months` :
              config.timeWindow?.type === 'since_date' ? `Since ${new Date(config.timeWindow.sinceDate || 0).toLocaleDateString()}` :
              'All time'
            }</div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'rgba(107, 114, 128, 0.2)',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '8px',
              color: '#9CA3AF',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Save Mapping
          </button>
        </div>
      </div>
    </div>
  );
};

