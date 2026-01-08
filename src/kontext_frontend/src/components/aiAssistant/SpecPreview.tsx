/**
 * Component for previewing and editing generated specs
 */

import React from 'react';
import type { AgentSpec, WorkflowSpec, BusinessAgencySpec } from '../../types/agentSpec';

interface SpecPreviewProps {
  spec: AgentSpec | WorkflowSpec | BusinessAgencySpec;
  specType: 'agent' | 'workflow' | 'agency';
  onEdit: () => void;
  onCreate: () => void;
  onCancel: () => void;
}

export const SpecPreview: React.FC<SpecPreviewProps> = ({
  spec,
  specType,
  onEdit,
  onCreate,
  onCancel
}) => {
  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0, maxHeight: '100%', padding: '1rem', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex-shrink-0 mb-4" style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0 0 0.5rem 0'
            }}>
              Generated Specification
            </h3>
            <p style={{
              color: 'var(--text-gray)',
              margin: 0,
              fontSize: '0.95rem',
              lineHeight: 1.4
            }}>
              Review the AI-generated {specType} configuration
            </p>
          </div>
          <button
            onClick={onEdit}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minHeight: '44px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <span>✏️</span> Edit Prompt
          </button>
        </div>
      </div>

      {/* JSON Preview Card */}
      <div 
        className="flex-1 mb-4" 
        style={{
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }}
      >
        <pre style={{
          color: '#E5E7EB',
          fontSize: '0.8125rem',
          lineHeight: '1.7',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: 0,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
        }}>
          {JSON.stringify(spec, null, 2)}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-shrink-0" style={{ paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            minHeight: '44px'
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
          onClick={onCreate}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            minHeight: '44px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
          }}
        >
          ✨ Create {specType === 'agent' ? 'Agent' : specType === 'workflow' ? 'Workflow' : 'Agency'}
        </button>
      </div>
    </div>
  );
};

