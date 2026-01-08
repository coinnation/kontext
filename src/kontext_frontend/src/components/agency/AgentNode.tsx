import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { WorkflowNode } from './types';

interface AgentNodeProps {
  data: WorkflowNode['data'];
  selected?: boolean;
  id: string;
}

export const AgentNode: React.FC<AgentNodeProps> = memo(({ data, selected = false, id }) => {
  const getNodeStyle = () => {
    const baseClasses = "bg-gray-800 border-2 rounded-lg p-2 shadow-lg transition-all duration-200 min-w-[160px] max-w-[220px]";
    
    if (selected) {
      return `${baseClasses} border-orange-500 shadow-orange-500/20`;
    }
    
    // NEW: Prioritize execution status over configuration status
    if (data.executionStatus) {
      switch (data.executionStatus) {
        case 'running':
          return `${baseClasses} border-blue-500 shadow-blue-500/30`;
        case 'completed':
          return `${baseClasses} border-green-500 shadow-green-500/20`;
        case 'failed':
          return `${baseClasses} border-red-500 shadow-red-500/20`;
        case 'pending':
          return `${baseClasses} border-gray-500 opacity-60`;
        default:
          return `${baseClasses} border-gray-600`;
      }
    }
    
    switch (data.status) {
      case 'configured':
        return `${baseClasses} border-green-500 hover:border-green-400`;
      case 'unconfigured':
        return `${baseClasses} border-yellow-500 hover:border-yellow-400`;
      case 'error':
        return `${baseClasses} border-red-500 hover:border-red-400`;
      default:
        return `${baseClasses} border-gray-600 hover:border-gray-500`;
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'configured': return 'text-green-400';
      case 'unconfigured': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'valid': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (data.status) {
      case 'configured': return '✅';
      case 'unconfigured': return '⚠️';
      case 'error': return '❌';
      case 'valid': return '✅';
      default: return '⚙️';
    }
  };

  // Add pulsing animation for running agents
  const isRunning = data.executionStatus === 'running';
  
  return (
    <div 
      className={getNodeStyle()}
      style={isRunning ? {
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.4)',
        borderColor: '#3B82F6',
        borderWidth: '3px'
      } : undefined}
    >
      {/* Input Handle - Larger and more visible */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!bg-blue-400 hover:!scale-125 transition-all"
        style={{
          left: '-8px',
          cursor: 'crosshair'
        }}
      />
      
      {/* Header */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-lg" title={data.description || 'Agent'}>
            {data.icon || '⚙️'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
            <h3 className="text-white font-semibold text-xs truncate" title={data.agentName}>
              {data.agentName}
            </h3>
              {/* NEW: Loop and nested workflow indicators */}
              {data.stepTarget && 'agency' in data.stepTarget && (
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1 rounded" title="Nested Workflow">
                  🔄
                </span>
              )}
              {data.loopConfig && (
                <span 
                  className="text-[10px] bg-purple-500/20 text-purple-300 px-1 rounded" 
                  title={
                    'forEach' in data.loopConfig ? `Loop: For Each in ${data.loopConfig.forEach.arraySource}` :
                    'whileLoop' in data.loopConfig ? `Loop: While ${data.loopConfig.whileLoop.condition}` :
                    'repeat' in data.loopConfig ? `Loop: Repeat ${data.loopConfig.repeat.count} times` :
                    'Loop'
                  }
                >
                  🔁
                </span>
              )}
            </div>
            <p className={`text-[10px] ${getStatusColor()}`}>
              {data.executionStatus 
                ? (data.executionStatus === 'running' ? 'Running...' :
                   data.executionStatus === 'completed' ? 'Completed' :
                   data.executionStatus === 'failed' ? 'Failed' :
                   'Pending')
                : (data.status === 'configured' ? 'Ready' : 
                   data.status === 'unconfigured' ? 'Needs Config' :
                   data.status === 'error' ? 'Error' : 'Valid')}
            </p>
          </div>
        </div>
        <span className="text-sm" title={data.status}>
          {getStatusIcon()}
        </span>
      </div>

      {/* Agent Details */}
      <div className="space-y-1 mb-1.5">
        {data.agentCanisterId && (
          <div className="text-[10px] text-gray-400">
            <span className="font-medium">Canister:</span>
            <span className="ml-1 font-mono text-gray-300">
              {data.agentCanisterId.slice(0, 6)}...{data.agentCanisterId.slice(-3)}
            </span>
          </div>
        )}
        
        <div className="text-[10px] text-gray-400">
          <span className="font-medium">Input:</span>
          <span className="ml-1 text-gray-300 truncate block">
            {data.inputTemplate || '{input}'}
          </span>
        </div>
      </div>

      {/* Configuration Indicators */}
      <div className="flex items-center gap-1 flex-wrap">
        {data.requiresApproval && (
          <span className="px-1.5 py-0.5 bg-blue-900 bg-opacity-50 text-blue-400 text-[10px] rounded border border-blue-500" title="Requires approval">
            👤
          </span>
        )}
        {data.retryOnFailure && (
          <span className="px-1.5 py-0.5 bg-green-900 bg-opacity-50 text-green-400 text-[10px] rounded border border-green-500" title="Retry enabled">
            🔄
          </span>
        )}
        {data.timeout && (
          <span className="px-1.5 py-0.5 bg-purple-900 bg-opacity-50 text-purple-400 text-[10px] rounded border border-purple-500" title={`Timeout: ${data.timeout}s`}>
            ⏱️{data.timeout}s
          </span>
        )}
      </div>

      {/* Execution Output/Error (NEW) */}
      {data.executionStatus && (
        <div className="mt-1.5 space-y-1">
          {data.executionOutput && (
            <div className="p-1.5 bg-green-900 bg-opacity-30 border border-green-500 rounded">
              <div className="text-green-400 text-[10px] font-medium mb-0.5">Output:</div>
              <div className="text-green-300 text-[10px] line-clamp-2 font-mono">
                {data.executionOutput}
              </div>
            </div>
          )}
          {data.executionError && (
            <div className="p-1.5 bg-red-900 bg-opacity-30 border border-red-500 rounded">
              <div className="text-red-400 text-[10px] font-medium mb-0.5">Error:</div>
              <div className="text-red-300 text-[10px] line-clamp-2 font-mono">
                {data.executionError}
              </div>
            </div>
          )}
          {data.executionDuration && (
            <div className="text-[10px] text-gray-400">
              Duration: {Math.round(data.executionDuration / 1000)}s
            </div>
          )}
        </div>
      )}

      {/* Validation Errors */}
      {!data.executionStatus && data.validationErrors && data.validationErrors.length > 0 && (
        <div className="mt-1.5 p-1.5 bg-red-900 bg-opacity-30 border border-red-500 rounded">
          <div className="text-red-400 text-[10px] font-medium mb-0.5">Issues:</div>
          {data.validationErrors.slice(0, 2).map((error, index) => (
            <div key={index} className="text-red-300 text-[10px]">
              • {error}
            </div>
          ))}
          {data.validationErrors.length > 2 && (
            <div className="text-red-400 text-[10px]">
              +{data.validationErrors.length - 2} more...
            </div>
          )}
        </div>
      )}

      {/* Output Handle - Larger and more visible */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-orange-500 !border-2 !border-white hover:!bg-orange-400 hover:!scale-125 transition-all"
        style={{
          right: '-8px',
          cursor: 'crosshair'
        }}
      />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';