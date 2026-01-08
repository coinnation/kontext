import React, { useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Execution, Agency } from '../../services/AgencyService';
import type { WorkflowNode, WorkflowEdge } from './types';
import { convertAgentStepsToWorkflow } from './utils';
import { AgentNode } from './AgentNode';
import { ConnectionEdge } from './ConnectionEdge';

interface ExecutionGraphVisualizationProps {
  execution: Execution;
  agency?: Agency;
  className?: string;
}

const nodeTypes = {
  agent: AgentNode,
};

const edgeTypes = {
  default: ConnectionEdge,
  conditional: ConnectionEdge,
};

const ExecutionGraphVisualizationInternal: React.FC<ExecutionGraphVisualizationProps> = ({
  execution,
  agency,
  className = ''
}) => {
  const { fitView } = useReactFlow();

  // Convert agency steps to workflow nodes/edges
  const workflowData = useMemo(() => {
    if (!agency || !agency.steps) {
      return { nodes: [], edges: [] };
    }

    return convertAgentStepsToWorkflow(agency.steps, agency.connections || []);
  }, [agency]);

  // Create execution-aware nodes with status highlighting
  const executionNodes = useMemo(() => {
    return workflowData.nodes.map((node, index) => {
      // Find corresponding execution result
      const result = execution.results.find(r => r.stepIndex === index);
      
      let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
      if (result) {
        status = result.success ? 'completed' : 'failed';
      } else if (execution.status === 'running' && execution.currentStep === index) {
        status = 'running';
      } else if (execution.currentStep > index) {
        // Step should have completed but no result found - treat as completed
        status = 'completed';
      }

      // Get output for display
      const output = result?.output;
      const error = result?.error;

      return {
        ...node,
        data: {
          ...node.data,
          executionStatus: status,
          executionOutput: output,
          executionError: error,
          executionDuration: result?.duration,
        },
        style: {
          ...node.style,
          // Highlight based on execution status
          border: status === 'running' 
            ? '3px solid #3B82F6' 
            : status === 'completed'
            ? '3px solid #10B981'
            : status === 'failed'
            ? '3px solid #EF4444'
            : '2px solid rgba(107, 114, 128, 0.3)',
          boxShadow: status === 'running'
            ? '0 0 20px rgba(59, 130, 246, 0.5)'
            : status === 'completed'
            ? '0 0 15px rgba(16, 185, 129, 0.3)'
            : status === 'failed'
            ? '0 0 15px rgba(239, 68, 68, 0.3)'
            : 'none',
        },
      };
    });
  }, [workflowData.nodes, execution]);

  // Create execution-aware edges with path highlighting
  const executionEdges = useMemo(() => {
    return workflowData.edges.map((edge, index) => {
      // Determine if this edge was taken during execution
      const sourceIndex = parseInt(edge.source.replace('agent-', ''));
      const targetIndex = parseInt(edge.target.replace('agent-', ''));
      
      const sourceResult = execution.results.find(r => r.stepIndex === sourceIndex);
      const targetResult = execution.results.find(r => r.stepIndex === targetIndex);
      
      // Edge was taken if source completed and target has a result or is current
      const wasTaken = sourceResult?.success && (
        targetResult !== undefined || 
        (execution.status === 'running' && execution.currentStep === targetIndex)
      );

      return {
        ...edge,
        animated: wasTaken && execution.status === 'running',
        style: {
          ...edge.style,
          stroke: wasTaken 
            ? (targetResult?.success !== false ? '#10B981' : '#EF4444')
            : edge.style?.stroke || '#6b7280',
          strokeWidth: wasTaken ? 3 : 2,
          opacity: wasTaken ? 1 : 0.5,
        },
        data: {
          ...edge.data,
          wasExecuted: wasTaken,
        },
      };
    });
  }, [workflowData.edges, execution]);

  // Auto-fit view on mount
  React.useEffect(() => {
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 100);
  }, [fitView]);

  // Calculate execution statistics
  const stats = useMemo(() => {
    const completed = execution.results.filter(r => r.success).length;
    const failed = execution.results.filter(r => !r.success).length;
    const total = execution.totalAgents;
    const pending = total - completed - failed;
    
    return { completed, failed, pending, total };
  }, [execution]);

  return (
    <div className={`flex flex-col h-full ${className}`} style={{
      background: 'var(--primary-black)',
      minHeight: 0,
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Header with execution info */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(255, 255, 255, 0.02)',
        flexShrink: 0
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{
              width: '32px',
              height: '32px',
              background: execution.status === 'completed' 
                ? 'rgba(16, 185, 129, 0.2)' 
                : execution.status === 'failed'
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}>
              {execution.status === 'completed' ? '✅' : execution.status === 'failed' ? '❌' : '⚡'}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Execution: {execution.agencyName || 'Unknown'}
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>Status: <span className="text-white capitalize">{execution.status}</span></span>
                <span>Step {execution.currentStep + 1} of {execution.totalAgents}</span>
                {execution.endTime && (
                  <span>Duration: {Math.round((execution.endTime - execution.startTime) / 1000)}s</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Execution stats */}
          <div className="flex items-center gap-3">
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem'
            }}>
              <span className="text-green-400 font-semibold">{stats.completed}</span>
              <span className="text-gray-400 ml-1">Completed</span>
            </div>
            {stats.failed > 0 && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem'
              }}>
                <span className="text-red-400 font-semibold">{stats.failed}</span>
                <span className="text-gray-400 ml-1">Failed</span>
              </div>
            )}
            {stats.pending > 0 && (
              <div style={{
                background: 'rgba(107, 114, 128, 0.1)',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                borderRadius: '6px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem'
              }}>
                <span className="text-gray-400 font-semibold">{stats.pending}</span>
                <span className="text-gray-500 ml-1">Pending</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Graph visualization */}
      <div style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        background: 'var(--secondary-black)'
      }}>
        <ReactFlow
          nodes={executionNodes}
          edges={executionEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          minZoom={0.3}
          maxZoom={1.5}
          style={{
            background: 'var(--secondary-black)',
            width: '100%',
            height: '100%'
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#374151" gap={20} />
          <Controls className="border" style={{
            background: 'var(--secondary-black)',
            borderColor: 'var(--border-color)'
          }} />
          
          {/* Legend */}
          <Panel position="top-right" className="m-2">
            <div style={{
              background: 'rgba(17, 17, 17, 0.95)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.75rem',
              minWidth: '180px'
            }}>
              <div className="text-white font-semibold mb-2">Execution Status</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: '#10B981',
                    borderRadius: '50%',
                    border: '2px solid #10B981'
                  }}></div>
                  <span className="text-gray-300">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: '#3B82F6',
                    borderRadius: '50%',
                    border: '2px solid #3B82F6',
                    animation: 'pulse 2s infinite'
                  }}></div>
                  <span className="text-gray-300">Running</span>
                </div>
                <div className="flex items-center gap-2">
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: '#EF4444',
                    borderRadius: '50%',
                    border: '2px solid #EF4444'
                  }}></div>
                  <span className="text-gray-300">Failed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: 'transparent',
                    borderRadius: '50%',
                    border: '2px solid rgba(107, 114, 128, 0.5)'
                  }}></div>
                  <span className="text-gray-300">Pending</span>
                </div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Step outputs panel (collapsible) */}
      {execution.results.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(17, 17, 17, 0.95)',
          maxHeight: '200px',
          overflowY: 'auto',
          flexShrink: 0
        }} className="chat-scrollbar">
          <div style={{ padding: '0.75rem 1rem' }}>
            <div className="text-sm font-semibold text-white mb-2">Step Outputs</div>
            <div className="space-y-2">
              {execution.results.map((result, index) => (
                <div
                  key={index}
                  style={{
                    background: result.success 
                      ? 'rgba(16, 185, 129, 0.1)' 
                      : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${result.success 
                      ? 'rgba(16, 185, 129, 0.3)' 
                      : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.8rem'
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span>{result.success ? '✅' : '❌'}</span>
                      <span className="text-white font-medium">
                        Step {result.stepIndex + 1}: {result.agentName}
                      </span>
                    </div>
                    {result.duration && (
                      <span className="text-gray-400 text-xs">
                        {Math.round(result.duration / 1000)}s
                      </span>
                    )}
                  </div>
                  {result.output && (
                    <div className="text-gray-300 text-xs mt-1 font-mono break-all line-clamp-2">
                      {result.output}
                    </div>
                  )}
                  {result.error && (
                    <div className="text-red-400 text-xs mt-1 font-mono break-all line-clamp-2">
                      {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrapper with ReactFlowProvider
export const ExecutionGraphVisualizationWrapper: React.FC<ExecutionGraphVisualizationProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ExecutionGraphVisualizationInternal {...props} />
    </ReactFlowProvider>
  );
};
