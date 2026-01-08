import React, { useState, useEffect } from 'react';
import type { WorkflowEdge } from './types';
import type { ConnectionCondition } from '../../services/AgencyService';

interface EdgeConfigPanelProps {
  edge: WorkflowEdge | null;
  onUpdateEdge: (edgeId: string, updates: Partial<WorkflowEdge>) => void;
  onClose: () => void;
  className?: string;
}

export const EdgeConfigPanel: React.FC<EdgeConfigPanelProps> = ({
  edge,
  onUpdateEdge,
  onClose,
  className = ''
}) => {
  const [conditionType, setConditionType] = useState<'always' | 'onSuccess' | 'onFailure' | 'ifContains' | 'ifEquals'>('always');
  const [fieldValue, setFieldValue] = useState('output');
  const [valueValue, setValueValue] = useState('');

  useEffect(() => {
    if (edge?.data?.condition) {
      const condition = edge.data.condition;
      if (condition.always !== undefined) {
        setConditionType('always');
      } else if (condition.onSuccess !== undefined) {
        setConditionType('onSuccess');
      } else if (condition.onFailure !== undefined) {
        setConditionType('onFailure');
      } else if (condition.ifContains) {
        setConditionType('ifContains');
        setFieldValue(condition.ifContains.field);
        setValueValue(condition.ifContains.value);
      } else if (condition.ifEquals) {
        setConditionType('ifEquals');
        setFieldValue(condition.ifEquals.field);
        setValueValue(condition.ifEquals.value);
      }
    } else {
      // Default to always
      setConditionType('always');
      setFieldValue('output');
      setValueValue('');
    }
  }, [edge]);

  const handleSave = () => {
    if (!edge) return;

    let condition: ConnectionCondition;
    
    switch (conditionType) {
      case 'always':
        condition = { always: null };
        break;
      case 'onSuccess':
        condition = { onSuccess: null };
        break;
      case 'onFailure':
        condition = { onFailure: null };
        break;
      case 'ifContains':
        if (!fieldValue.trim() || !valueValue.trim()) {
          alert('Please provide both field and value for "If Contains" condition');
          return;
        }
        condition = { ifContains: { field: fieldValue.trim(), value: valueValue.trim() } };
        break;
      case 'ifEquals':
        if (!fieldValue.trim() || !valueValue.trim()) {
          alert('Please provide both field and value for "If Equals" condition');
          return;
        }
        condition = { ifEquals: { field: fieldValue.trim(), value: valueValue.trim() } };
        break;
      default:
        condition = { always: null };
    }

    // Generate label
    const label = getConditionLabel(condition);

    onUpdateEdge(edge.id, {
      data: {
        condition,
        label,
      },
      type: conditionType === 'always' ? 'default' : 'conditional',
    });

    onClose();
  };

  const getConditionLabel = (condition: ConnectionCondition): string => {
    if (condition.onSuccess !== undefined) return 'On Success';
    if (condition.onFailure !== undefined) return 'On Failure';
    if (condition.always !== undefined) return 'Always';
    if (condition.ifContains) return `If Contains: ${condition.ifContains.field} = ${condition.ifContains.value}`;
    if (condition.ifEquals) return `If Equals: ${condition.ifEquals.field} = ${condition.ifEquals.value}`;
    return 'Always';
  };

  if (!edge) {
    return null;
  }

  const isTier2Condition = conditionType === 'ifContains' || conditionType === 'ifEquals';

  return (
    <div className={`flex flex-col h-full ${className}`} style={{
      background: 'var(--secondary-black)',
      borderLeft: '1px solid var(--border-color)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 107, 53, 0.1)',
      }}>
        <div className="flex items-center gap-2">
          <div style={{
            width: '24px',
            height: '24px',
            background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9rem'
          }}>
            🔗
          </div>
          <h3 className="text-base font-semibold text-white">Connection Condition</h3>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(107, 114, 128, 0.2)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
            borderRadius: '4px',
            color: '#9CA3AF',
            padding: '0.25rem 0.5rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.3)';
            e.currentTarget.style.color = '#9CA3AF';
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem',
      }} className="chat-scrollbar">
        <div className="space-y-4">
          {/* Condition Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Condition Type *
            </label>
            <select
              value={conditionType}
              onChange={(e) => {
                const newType = e.target.value as typeof conditionType;
                setConditionType(newType);
                // Reset field/value when switching away from Tier 2
                if (newType !== 'ifContains' && newType !== 'ifEquals') {
                  setFieldValue('output');
                  setValueValue('');
                }
              }}
              style={{
                width: '100%',
                background: 'rgba(31, 31, 31, 0.8)',
                border: '1px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '0.75rem',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-orange)';
                e.target.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <option value="always" style={{ background: '#1f1f1f' }}>Always (Default)</option>
              <option value="onSuccess" style={{ background: '#1f1f1f' }}>On Success (Tier 1)</option>
              <option value="onFailure" style={{ background: '#1f1f1f' }}>On Failure (Tier 1)</option>
              <option value="ifContains" style={{ background: '#1f1f1f' }}>If Contains (Tier 2)</option>
              <option value="ifEquals" style={{ background: '#1f1f1f' }}>If Equals (Tier 2)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {conditionType === 'always' && 'Connection always executes'}
              {conditionType === 'onSuccess' && 'Connection executes only if previous step succeeded'}
              {conditionType === 'onFailure' && 'Connection executes only if previous step failed'}
              {conditionType === 'ifContains' && 'Connection executes if the specified field contains the value'}
              {conditionType === 'ifEquals' && 'Connection executes if the specified field equals the value'}
            </p>
          </div>

          {/* Tier 2 Condition Fields */}
          {isTier2Condition && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Field *
                </label>
                <select
                  value={fieldValue}
                  onChange={(e) => setFieldValue(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(31, 31, 31, 0.8)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent-orange)';
                    e.target.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="output" style={{ background: '#1f1f1f' }}>output - Step output text</option>
                  <option value="status" style={{ background: '#1f1f1f' }}>status - Step status (success/failure)</option>
                  <option value="error" style={{ background: '#1f1f1f' }}>error - Error message (if any)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Field to check from the previous step's result
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Value *
                </label>
                <input
                  type="text"
                  value={valueValue}
                  onChange={(e) => setValueValue(e.target.value)}
                  placeholder={conditionType === 'ifContains' ? 'Value to search for...' : 'Exact value to match...'}
                  style={{
                    width: '100%',
                    background: 'rgba(31, 31, 31, 0.8)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent-orange)';
                    e.target.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {conditionType === 'ifContains' 
                    ? 'The connection executes if the field contains this value (case-sensitive)'
                    : 'The connection executes if the field exactly equals this value (case-sensitive)'}
                </p>
              </div>
            </>
          )}

          {/* Preview */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            marginTop: '1rem'
          }}>
            <div className="text-xs text-blue-400 font-medium mb-2">Preview:</div>
            <div className="text-sm text-gray-300">
              {(() => {
                let previewCondition: ConnectionCondition;
                switch (conditionType) {
                  case 'always':
                    previewCondition = { always: null };
                    break;
                  case 'onSuccess':
                    previewCondition = { onSuccess: null };
                    break;
                  case 'onFailure':
                    previewCondition = { onFailure: null };
                    break;
                  case 'ifContains':
                    previewCondition = { ifContains: { field: fieldValue, value: valueValue } };
                    break;
                  case 'ifEquals':
                    previewCondition = { ifEquals: { field: fieldValue, value: valueValue } };
                    break;
                }
                return getConditionLabel(previewCondition);
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        gap: '0.75rem',
      }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            background: 'rgba(107, 114, 128, 0.2)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
            borderRadius: '8px',
            color: '#9CA3AF',
            padding: '0.75rem',
            fontSize: '0.9rem',
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
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg, var(--accent-green), #059669)',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            padding: '0.75rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
          }}
        >
          Save Condition
        </button>
      </div>
    </div>
  );
};
