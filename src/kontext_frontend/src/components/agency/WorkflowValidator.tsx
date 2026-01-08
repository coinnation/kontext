import React from 'react';
import type { ValidationResult } from './types';

interface WorkflowValidatorProps {
  validation: ValidationResult;
  onFixError?: (nodeId: string, errorType: string) => void;
  className?: string;
  isCompact?: boolean;
}

export const WorkflowValidator: React.FC<WorkflowValidatorProps> = ({
  validation,
  onFixError,
  className = '',
  isCompact = false
}) => {
  const hasIssues = validation.errors.length > 0 || validation.warnings.length > 0;

  if (isCompact) {
    if (!hasIssues) {
      return (
        <div className={`p-2 border-l-4 ${className}`} style={{
          background: 'rgba(16, 185, 129, 0.1)',
          borderColor: 'var(--accent-green)'
        }}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" style={{ color: 'var(--accent-green)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--accent-green)' }}>Workflow Valid</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`space-y-2 p-2 ${className}`}>
        {validation.errors.length > 0 && (
          <div className="p-2 border-l-4" style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: '#ef4444'
          }}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-red-400 text-sm font-medium">
                {validation.errors.length} Error{validation.errors.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="p-2 border-l-4" style={{
            background: 'rgba(245, 158, 11, 0.1)',
            borderColor: '#f59e0b'
          }}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-yellow-400 text-sm font-medium">
                {validation.warnings.length} Warning{validation.warnings.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!hasIssues) {
    return (
      <div className={`p-4 rounded-lg border ${className}`} style={{
        background: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'var(--accent-green)'
      }}>
        <div className="flex items-center gap-3">
          <div style={{ color: 'var(--accent-green)' }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium" style={{ color: 'var(--accent-green)' }}>Workflow Valid</h3>
            <p className="text-sm" style={{ color: 'var(--accent-green-light)' }}>Your workflow is ready for execution</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="p-4 rounded-lg border" style={{
          background: 'rgba(239, 68, 68, 0.1)',
          borderColor: '#ef4444'
        }}>
          <div className="flex items-start gap-3">
            <div className="text-red-400 flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-red-400 font-medium mb-2">
                {validation.errors.length} Error{validation.errors.length !== 1 ? 's' : ''} Found
              </h3>
              <div className="space-y-3">
                {validation.errors.map((error, index) => (
                  <div key={index} className="rounded p-3" style={{ background: 'rgba(185, 28, 28, 0.2)' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-red-300 text-sm font-medium">{error.message}</p>
                        {error.suggestion && (
                          <p className="text-red-400 text-xs mt-1">💡 {error.suggestion}</p>
                        )}
                        {error.nodeId && (
                          <p className="text-red-400 text-xs mt-1">📍 Node: {error.nodeId}</p>
                        )}
                      </div>
                      {error.nodeId && onFixError && (
                        <button
                          onClick={() => onFixError(error.nodeId!, error.type)}
                          className="text-red-400 hover:text-red-300 text-xs underline ml-3 flex-shrink-0"
                        >
                          Fix
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="p-4 rounded-lg border" style={{
          background: 'rgba(245, 158, 11, 0.1)',
          borderColor: '#f59e0b'
        }}>
          <div className="flex items-start gap-3">
            <div className="text-yellow-400 flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-yellow-400 font-medium mb-2">
                {validation.warnings.length} Suggestion{validation.warnings.length !== 1 ? 's' : ''}
              </h3>
              <div className="space-y-2">
                {validation.warnings.map((warning, index) => (
                  <div key={index} className="rounded p-3" style={{ background: 'rgba(217, 119, 6, 0.2)' }}>
                    <p className="text-yellow-300 text-sm">{warning.message}</p>
                    <p className="text-yellow-400 text-xs mt-1">💡 {warning.suggestion}</p>
                    {warning.nodeId && (
                      <p className="text-yellow-400 text-xs mt-1">📍 Node: {warning.nodeId}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="p-3 rounded-lg border" style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'var(--border-color)'
      }}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Workflow Status:</span>
          <span style={{ color: validation.isValid ? 'var(--accent-green)' : '#ef4444' }}>
            {validation.isValid ? 'Ready to execute' : 'Needs attention'}
          </span>
        </div>
      </div>
    </div>
  );
};