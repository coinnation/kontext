import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppStore } from '../../store/appStore';

// Mobile responsiveness helper
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

import { AgentNode } from './AgentNode';
import { ConnectionEdge } from './ConnectionEdge';
import { AgentPalette } from './AgentPalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import { EdgeConfigPanel } from './EdgeConfigPanel'; // NEW: Edge configuration panel
import { WorkflowValidator } from './WorkflowValidator';
import { TemplateLibrary } from './TemplateLibrary';
import { ExecutionModeSelector } from './ExecutionModeSelector';

import type { 
  WorkflowNode, 
  WorkflowEdge, 
  AgentTemplate, 
  CanvasState,
  WorkflowTemplate
} from './types';
import { 
  generateId, 
  validateWorkflow, 
  convertWorkflowToAgentSteps,
  convertEdgesToConnections,
  convertAgentStepsToWorkflow,
  autoLayout,
  exportWorkflow,
  importWorkflow,
  getAgentIcon
} from './utils';
import type { AgentStep, AgentConnection } from '../../services/AgencyService';
import type { ScheduleType, ConditionType, RetryConfig, ExecutionLimits } from '../../candid/agency.did.d.ts';

// Simplified Trigger Creation Form Component
const TriggerCreationFormContent: React.FC<{
  type: 'scheduled' | 'condition' | 'webhook';
  onCreateTrigger: (config: any) => Promise<void>;
  onClose: () => void;
}> = ({ type, onCreateTrigger, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    inputTemplate: '{input}',
    // Scheduled
    scheduleType: 'interval' as 'interval' | 'cron' | 'once' | 'recurring',
    intervalSeconds: 3600,
    cronExpression: '0 9 * * *',
    // Webhook
    source: '',
    signature: '',
    // Condition
    conditionType: 'threshold' as 'threshold' | 'http_check' | 'custom',
    metric: 'value',
    operator: '>',
    threshold: 0,
    httpUrl: '',
    expectedStatus: 200,
    customExpression: 'true',
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    setIsCreating(true);
    try {
      let config: any = {
        name: formData.name,
        description: formData.description,
        inputTemplate: formData.inputTemplate,
      };

      if (type === 'scheduled') {
        let schedule: ScheduleType;
        if (formData.scheduleType === 'interval') {
          schedule = { interval: { seconds: BigInt(formData.intervalSeconds) } };
        } else if (formData.scheduleType === 'cron') {
          schedule = { cron: { expression: formData.cronExpression } };
        } else if (formData.scheduleType === 'once') {
          schedule = { once: { timestamp: BigInt(Date.now() * 1_000_000) } };
        } else {
          schedule = { recurring: { pattern: 'hourly', nextRun: BigInt(Date.now() * 1_000_000) } };
        }
        config.schedule = schedule;
      } else if (type === 'webhook') {
        config.source = formData.source || 'webhook';
        config.signature = formData.signature || undefined;
      } else if (type === 'condition') {
        let condition: ConditionType;
        if (formData.conditionType === 'threshold') {
          condition = { threshold: { metric: formData.metric, operator: formData.operator, value: formData.threshold } };
        } else if (formData.conditionType === 'http_check') {
          condition = { http_check: { url: formData.httpUrl, expected_status: BigInt(formData.expectedStatus) } };
        } else {
          condition = { custom: { expression: formData.customExpression, variables: [] } };
        }
        config.condition = condition;
      }

      await onCreateTrigger(config);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400 mb-4">
        {type === 'scheduled' && 'Schedule this workflow to run automatically at specific times or intervals.'}
        {type === 'webhook' && 'Allow external systems to trigger this workflow via webhook.'}
        {type === 'condition' && 'Trigger this workflow when specific conditions are met.'}
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Trigger Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Daily Report Trigger"
          style={{
            width: '100%',
            background: 'rgba(31, 31, 31, 0.8)',
            border: '1px solid rgba(75, 85, 99, 0.5)',
            borderRadius: '8px',
            color: '#ffffff',
            padding: '0.75rem',
            fontSize: '0.9rem',
            outline: 'none'
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
          rows={2}
          style={{
            width: '100%',
            background: 'rgba(31, 31, 31, 0.8)',
            border: '1px solid rgba(75, 85, 99, 0.5)',
            borderRadius: '8px',
            color: '#ffffff',
            padding: '0.75rem',
            fontSize: '0.9rem',
            outline: 'none',
            resize: 'vertical'
          }}
        />
      </div>

      {type === 'scheduled' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Schedule Type
            </label>
            <select
              value={formData.scheduleType}
              onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value as any })}
              style={{
                width: '100%',
                background: 'rgba(31, 31, 31, 0.8)',
                border: '1px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '0.75rem',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            >
              <option value="interval">Interval (every X seconds)</option>
              <option value="cron">Cron Expression</option>
            </select>
          </div>

          {formData.scheduleType === 'interval' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Interval (seconds)
              </label>
              <input
                type="number"
                value={formData.intervalSeconds}
                onChange={(e) => setFormData({ ...formData, intervalSeconds: parseInt(e.target.value) || 3600 })}
                placeholder="3600"
                min={1}
                style={{
                  width: '100%',
                  background: 'rgba(31, 31, 31, 0.8)',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: 3600 = every hour, 86400 = daily
              </p>
            </div>
          )}

          {formData.scheduleType === 'cron' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cron Expression
              </label>
              <input
                type="text"
                value={formData.cronExpression}
                onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                placeholder="0 9 * * *"
                style={{
                  width: '100%',
                  background: 'rgba(31, 31, 31, 0.8)',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: minute hour day month weekday (e.g., "0 9 * * *" = 9am daily)
              </p>
            </div>
          )}
        </>
      )}

      {type === 'webhook' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Webhook Source
          </label>
          <input
            type="text"
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            placeholder="e.g., github, zapier, custom"
            style={{
              width: '100%',
              background: 'rgba(31, 31, 31, 0.8)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '0.75rem',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
        </div>
      )}

      {type === 'condition' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Condition Type
            </label>
            <select
              value={formData.conditionType}
              onChange={(e) => setFormData({ ...formData, conditionType: e.target.value as any })}
              style={{
                width: '100%',
                background: 'rgba(31, 31, 31, 0.8)',
                border: '1px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '0.75rem',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            >
              <option value="threshold">Threshold</option>
              <option value="http_check">HTTP Check</option>
              <option value="custom">Custom Expression</option>
            </select>
          </div>

          {formData.conditionType === 'threshold' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Metric
                </label>
                <input
                  type="text"
                  value={formData.metric}
                  onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                  placeholder="e.g., success_rate"
                  style={{
                    width: '100%',
                    background: 'rgba(31, 31, 31, 0.8)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Operator
                  </label>
                  <select
                    value={formData.operator}
                    onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(31, 31, 31, 0.8)',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  >
                    <option value=">">Greater than</option>
                    <option value="<">Less than</option>
                    <option value="==">Equal to</option>
                    <option value=">=">Greater or equal</option>
                    <option value="<=">Less or equal</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Threshold Value
                  </label>
                  <input
                    type="number"
                    value={formData.threshold}
                    onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      background: 'rgba(31, 31, 31, 0.8)',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {formData.conditionType === 'http_check' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL
                </label>
                <input
                  type="text"
                  value={formData.httpUrl}
                  onChange={(e) => setFormData({ ...formData, httpUrl: e.target.value })}
                  placeholder="https://example.com/health"
                  style={{
                    width: '100%',
                    background: 'rgba(31, 31, 31, 0.8)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Expected Status Code
                </label>
                <input
                  type="number"
                  value={formData.expectedStatus}
                  onChange={(e) => setFormData({ ...formData, expectedStatus: parseInt(e.target.value) || 200 })}
                  placeholder="200"
                  style={{
                    width: '100%',
                    background: 'rgba(31, 31, 31, 0.8)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </>
          )}

          {formData.conditionType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Custom Expression
              </label>
              <textarea
                value={formData.customExpression}
                onChange={(e) => setFormData({ ...formData, customExpression: e.target.value })}
                placeholder="e.g., {metric} > 90"
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(31, 31, 31, 0.8)',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>
          )}
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Input Template
        </label>
        <textarea
          value={formData.inputTemplate}
          onChange={(e) => setFormData({ ...formData, inputTemplate: e.target.value })}
          placeholder="{input}"
          rows={2}
          style={{
            width: '100%',
            background: 'rgba(31, 31, 31, 0.8)',
            border: '1px solid rgba(75, 85, 99, 0.5)',
            borderRadius: '8px',
            color: '#ffffff',
            padding: '0.75rem',
            fontSize: '0.9rem',
            outline: 'none',
            resize: 'vertical'
          }}
        />
        <p className="text-xs text-gray-500 mt-1">
          This will be passed to the workflow when the trigger fires
        </p>
      </div>

      <div className="flex gap-4">
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
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isCreating || !formData.name.trim()}
          style={{
            flex: 1,
            background: (isCreating || !formData.name.trim())
              ? 'rgba(107, 114, 128, 0.2)'
              : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            padding: '0.75rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: (isCreating || !formData.name.trim()) ? 'not-allowed' : 'pointer',
            opacity: (isCreating || !formData.name.trim()) ? 0.5 : 1
          }}
        >
          {isCreating ? '⏳ Creating...' : '✅ Create Trigger'}
        </button>
      </div>
    </div>
  );
};

// Simple Collapsible Agent Palette Component (drag-to-resize removed)
const ResizableAgentPalette: React.FC<{
  children: React.ReactNode;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  minHeight: number;
  defaultHeight: number;
  maxHeight: number;
}> = ({ children, isCollapsed, onToggleCollapse, minHeight, defaultHeight }) => {
  return (
    <div 
      className="relative flex flex-col"
      style={{
        height: isCollapsed ? `${minHeight}px` : `${defaultHeight}px`,
        transition: 'height 0.2s ease',
        overflow: 'hidden'
      }}
    >
      {children}
    </div>
  );
};

const nodeTypes = {
  agent: AgentNode,
};

const edgeTypes = {
  default: ConnectionEdge,
  conditional: ConnectionEdge,
};

interface WorkflowCanvasInternalProps {
  initialAgentSteps?: AgentStep[];
  initialConnections?: AgentConnection[]; // NEW: Optional initial connections
  onWorkflowChange: (agentSteps: AgentStep[]) => void;
  onConnectionsChange?: (connections: AgentConnection[]) => void; // NEW: Callback for connections changes
  executionMode: 'sequential' | 'parallel' | 'conditional';
  onExecutionModeChange: (mode: 'sequential' | 'parallel' | 'conditional') => void;
  availableAgents?: string[] | Array<{ canisterId: string; name: string }>;
  className?: string;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  onCreateAgency?: (name: string, description: string, agentSteps: AgentStep[], connections?: AgentConnection[]) => void;
  onExecute?: (input: string, agentSteps: AgentStep[]) => void;
  workflowName?: string;
  workflowDescription?: string;
  agencyWorkflowCanisterId?: string; // Agency workflow canister ID to exclude from agent canister IDs
  // NEW: Trigger management props
  agencyId?: string; // Current agency ID (if editing existing workflow)
  triggers?: Array<any>; // Array of TriggerConfig
  onExecuteTrigger?: (triggerId: string) => Promise<void>; // Execute workflow via trigger
  onCreateTrigger?: (type: 'scheduled' | 'webhook' | 'condition', config: any) => Promise<void>; // Create new trigger
  onToggleTrigger?: (triggerId: string) => Promise<void>; // Enable/disable trigger
  onDeleteTrigger?: (triggerId: string) => Promise<void>; // Delete trigger
}

const WorkflowCanvasInternal: React.FC<WorkflowCanvasInternalProps> = ({
  initialAgentSteps = [],
  initialConnections = [], // NEW: Optional initial connections
  onWorkflowChange,
  onConnectionsChange, // NEW: Callback for connections changes
  executionMode,
  onExecutionModeChange,
  availableAgents = [],
  className = '',
  onFullscreenToggle,
  isFullscreen = false,
  onCreateAgency,
  onExecute,
  workflowName = '',
  workflowDescription = '',
  agencyWorkflowCanisterId,
  // NEW: Trigger management props
  agencyId,
  triggers = [],
  onExecuteTrigger,
  onCreateTrigger,
  onToggleTrigger,
  onDeleteTrigger
}) => {
  // Mobile detection
  const isMobile = useIsMobile();
  
  const reactFlowInstance = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Convert initial agent steps to workflow format (with connections if provided)
  const initialWorkflow = initialAgentSteps.length > 0 
    ? convertAgentStepsToWorkflow(initialAgentSteps, initialConnections)
    : { nodes: [], edges: [] };

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(
    initialWorkflow.nodes.map(node => ({
      ...node,
      type: 'agent',
      draggable: true // Ensure nodes are draggable when loaded from existing agency - no dragHandle restriction
    }))
  );
  
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(
    initialWorkflow.edges.map(edge => ({
      ...edge,
      type: 'default'
    }))
  );

  // UI state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null); // NEW: Track selected edge
  const [isDragging, setIsDragging] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showEdgeConfigPanel, setShowEdgeConfigPanel] = useState(false); // NEW: Show edge config panel
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [showSaveAgencyDialog, setShowSaveAgencyDialog] = useState(false);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [executeDialogTab, setExecuteDialogTab] = useState<'manual' | 'triggers'>('manual'); // NEW: Tab state for execute dialog
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [agencyName, setAgencyName] = useState(workflowName);
  const [agencyDescription, setAgencyDescription] = useState(workflowDescription);
  const [executionInput, setExecutionInput] = useState('');
  // NEW: Trigger management state
  const [showTriggerForm, setShowTriggerForm] = useState(false);
  const [triggerFormType, setTriggerFormType] = useState<'scheduled' | 'condition' | 'webhook' | null>(null);
  const [isExecutingTrigger, setIsExecutingTrigger] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false); // Start expanded so agents are visible
  const [showMobilePalette, setShowMobilePalette] = useState(false); // Mobile: show palette as modal
  const activeProject = useAppStore(state => state.activeProject);
  
  // On mobile, start with palette collapsed
  useEffect(() => {
    if (isMobile) {
      setPaletteCollapsed(true);
    }
  }, [isMobile]);
  
  // Validation
  const validation = validateWorkflow(nodes, edges, executionMode);

  // Canvas state
  const canvasState: CanvasState = {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId: null,
    isDragging,
    isConnecting,
    connectionSource,
    executionMode,
    zoomLevel,
    canvasPosition: { x: 0, y: 0 }
  };

  // Ensure nodes remain draggable when editor reopens or when nodes are added
  // REMOVED dragHandle requirement - nodes should be draggable from anywhere
  useEffect(() => {
    setNodes(currentNodes => 
      currentNodes.map(node => ({
        ...node,
        draggable: true // Always ensure nodes are draggable - no dragHandle restriction
      }))
    );
  }, [nodes.length, initialAgentSteps.length, setNodes]); // Re-apply draggable when nodes change

  // Fit view only on initial load or when nodes are added (not on every render)
  useEffect(() => {
    if (nodes.length > 0 && reactFlowInstance) {
      // Small delay to ensure ReactFlow is fully rendered
      const timer = setTimeout(() => {
        reactFlowInstance.fitView({ 
          padding: 0.2, 
          maxZoom: 1.2, 
          minZoom: 0.4,
          duration: 300 
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialAgentSteps.length]); // Only when initial steps change, not on every node update

  // Update parent component when workflow changes
  useEffect(() => {
    // Extract available agent canister IDs from availableAgents prop
    const availableAgentCanisterIds = Array.isArray(availableAgents) && availableAgents.length > 0
      ? availableAgents
          .filter((agent): agent is { canisterId: string; name: string } => 
            typeof agent === 'object' && agent !== null && 'canisterId' in agent
          )
          .map(agent => agent.canisterId)
      : undefined;
    
    const agentSteps = convertWorkflowToAgentSteps(nodes, edges, availableAgentCanisterIds, agencyWorkflowCanisterId);
    onWorkflowChange(agentSteps);
    
    // NEW: Also notify parent of connections changes
    if (onConnectionsChange) {
      const connections = convertEdgesToConnections(nodes, edges, availableAgentCanisterIds, agencyWorkflowCanisterId);
      onConnectionsChange(connections);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, agencyWorkflowCanisterId]); // Removed onWorkflowChange from deps to prevent infinite loops

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node<WorkflowNode>) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null); // Clear edge selection when node is selected
    setShowConfigPanel(true);
    setShowEdgeConfigPanel(false);
  }, []);

  // NEW: Handle edge selection
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge<WorkflowEdge>) => {
    event.stopPropagation();
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null); // Clear node selection when edge is selected
    setShowEdgeConfigPanel(true);
    setShowConfigPanel(false);
  }, []);

  // Handle edge creation
  const onConnect = useCallback(
    (params: Connection) => {
      const edge: WorkflowEdge = {
        id: generateId('edge'),
        source: params.source!,
        target: params.target!,
        type: 'default',
        animated: executionMode === 'sequential',
        data: {
          condition: { always: null }, // NEW: Default to always condition
        },
      };

      setEdges((eds) => addEdge(edge, eds));
      setIsConnecting(false);
      setConnectionSource(null);
    },
    [setEdges, executionMode]
  );

  // Handle drag start from palette
  const onDragStart = useCallback((event: React.DragEvent, agentTemplate: AgentTemplate) => {
    setIsDragging(true);
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      type: 'agent',
      template: agentTemplate
    }));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  // Handle drop on canvas
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);

      const reactFlowBounds = canvasRef.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      try {
        const data = JSON.parse(event.dataTransfer.getData('application/reactflow'));
        if (data.type === 'agent' && data.template) {
          const template: AgentTemplate = data.template;
          
          const position = reactFlowInstance.project({
            x: event.clientX - reactFlowBounds.left,
            y: event.clientY - reactFlowBounds.top,
          });

          // CRITICAL: Validate that the template's canister ID is not the agency workflow canister ID
          if (agencyWorkflowCanisterId && template.canisterId === agencyWorkflowCanisterId) {
            console.error(`❌ [WorkflowCanvas] Cannot create agent node with agency workflow canister ID "${template.canisterId}". This agent was incorrectly deployed to the workflow canister. Please deploy it to a separate agent canister.`);
            // Still create the node but mark it as unconfigured and add a validation error
            const newNode: WorkflowNode = {
              id: generateId('agent'),
              type: 'agent',
              position,
              data: {
                agentName: template.name,
                agentCanisterId: '', // Clear the invalid canister ID
                inputTemplate: template.defaultConfig.inputTemplate,
                requiresApproval: template.defaultConfig.requiresApproval,
                retryOnFailure: template.defaultConfig.retryOnFailure,
                timeout: template.defaultConfig.timeout,
                description: template.description,
                icon: template.icon,
                status: 'error',
                validationErrors: [`Invalid canister ID: This agent was deployed to the agency workflow canister. Please deploy it to a separate agent canister and update this node.`],
              },
            };
            setNodes((nds) => nds.concat(newNode));
            return;
          }

          const newNode: WorkflowNode = {
            id: generateId('agent'),
            type: 'agent',
            position,
            data: {
              agentName: template.name,
              agentCanisterId: template.canisterId || '',
              inputTemplate: template.defaultConfig.inputTemplate,
              requiresApproval: template.defaultConfig.requiresApproval,
              retryOnFailure: template.defaultConfig.retryOnFailure,
              timeout: template.defaultConfig.timeout,
              description: template.description,
              icon: template.icon,
              status: template.canisterId ? 'configured' : 'unconfigured',
              validationErrors: [],
            },
          };

          setNodes((nds) => nds.concat(newNode));
        }
      } catch (error) {
        console.error('Failed to parse drop data:', error);
      }
    },
    [reactFlowInstance, setNodes]
  );

  // Handle drag over
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Update node data
  const onUpdateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode['data']>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { 
              ...node, 
              data: { 
                ...node.data, 
                ...updates,
                icon: updates.agentName ? getAgentIcon(updates.agentName) : node.data.icon
              } 
            }
          : node
      )
    );
    setShowConfigPanel(false);
    setSelectedNodeId(null);
  }, [setNodes]);

  // NEW: Update edge data (for condition configuration)
  const onUpdateEdge = useCallback((edgeId: string, updates: Partial<WorkflowEdge>) => {
    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === edgeId
          ? { ...edge, ...updates }
          : edge
      )
    );
    setShowEdgeConfigPanel(false);
    setSelectedEdgeId(null);
  }, [setEdges]);

  // Toolbar actions
  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn();
    setZoomLevel(reactFlowInstance.getZoom());
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut();
    setZoomLevel(reactFlowInstance.getZoom());
  }, [reactFlowInstance]);

  const handleZoomToFit = useCallback(() => {
    reactFlowInstance.fitView();
    setZoomLevel(reactFlowInstance.getZoom());
  }, [reactFlowInstance]);

  const handleAutoLayout = useCallback(() => {
    const layoutedNodes = autoLayout(nodes, edges, executionMode);
    setNodes(layoutedNodes);
  }, [nodes, edges, executionMode, setNodes]);

  const handleClear = useCallback(() => {
    if (window.confirm('Are you sure you want to clear the entire workflow? This cannot be undone.')) {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      setShowConfigPanel(false);
    }
  }, [setNodes, setEdges]);

  const handleExport = useCallback(() => {
    const workflowData = exportWorkflow(nodes, edges, {
      name: 'Exported Workflow',
      description: 'Workflow exported from canvas',
    });
    
    const blob = new Blob([workflowData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workflow.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event: any) => {
      const file = event.target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const json = e.target?.result as string;
            const { nodes: importedNodes, edges: importedEdges } = importWorkflow(json);
            setNodes(importedNodes.map(node => ({ ...node, type: 'agent' })));
            setEdges(importedEdges);
          } catch (error) {
            alert('Failed to import workflow: Invalid file format');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [setNodes, setEdges]);

  const handleSelectTemplate = useCallback((template: WorkflowTemplate) => {
    if (nodes.length > 0) {
      if (!window.confirm('This will replace your current workflow. Continue?')) {
        return;
      }
    }

    setNodes(template.nodes.map(node => ({ ...node, type: 'agent' })));
    setEdges(template.edges);
    onExecutionModeChange(template.executionMode);
    
    // Fit view after template load
    setTimeout(() => {
      reactFlowInstance.fitView();
    }, 100);
  }, [nodes, setNodes, setEdges, onExecutionModeChange, reactFlowInstance]);

  // Save current workflow as a template
  const handleSaveAsTemplate = useCallback(() => {
    if (nodes.length === 0) {
      alert('Cannot save empty workflow as template');
      return;
    }

    // Check if at least one agent has a canister ID (real agent)
    const hasRealAgents = nodes.some(node => 
      node.type === 'agent' && node.data.agentCanisterId && node.data.agentCanisterId.trim() !== ''
    );

    if (!hasRealAgents) {
      alert('Please configure at least one agent with a canister ID before saving as template');
      return;
    }

    setShowSaveTemplateDialog(true);
  }, [nodes]);

  // Helper function to recursively convert BigInt values to strings for JSON serialization
  const sanitizeForJSON = useCallback((obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle BigInt values
    if (typeof obj === 'bigint') {
      return obj.toString();
    }

    // Handle Principal objects (convert to text)
    if (obj && typeof obj === 'object' && (
      obj._isPrincipal || 
      (obj.constructor && obj.constructor.name === 'Principal') ||
      (typeof obj.toText === 'function' && typeof obj.toString === 'function' && obj._arr)
    )) {
      return obj.toText ? obj.toText() : obj.toString();
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeForJSON(item));
    }

    // Handle objects
    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = sanitizeForJSON(value);
      }
      return result;
    }

    // Return primitives as-is
    return obj;
  }, []);

  const handleConfirmSaveTemplate = useCallback(() => {
    if (!templateName.trim() || !activeProject) {
      alert('Please enter a template name');
      return;
    }

    try {
      // Create template from current workflow
      const template: WorkflowTemplate = {
        id: `saved-${Date.now()}`,
        name: templateName.trim(),
        description: templateDescription.trim() || 'Saved workflow template',
        category: 'general',
        nodes: nodes.map(node => sanitizeForJSON({ ...node })),
        edges: edges.map(edge => sanitizeForJSON({ ...edge })),
        executionMode,
        difficulty: 'intermediate',
        estimatedTime: '5-15 minutes',
        tags: ['saved', 'custom']
      };

      // Load existing templates
      const storageKey = `workflow-templates-${activeProject}`;
      const existing = localStorage.getItem(storageKey);
      const templates = existing ? JSON.parse(existing) : [];

      // Add new template
      templates.push(template);

      // Save to localStorage (now safe from BigInt values)
      localStorage.setItem(storageKey, JSON.stringify(templates));

      alert(`Template "${templateName}" saved successfully!`);
      setShowSaveTemplateDialog(false);
      setTemplateName('');
      setTemplateDescription('');
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    }
  }, [templateName, templateDescription, nodes, edges, executionMode, activeProject, sanitizeForJSON]);

  // Save current workflow as an agency
  const handleSaveAsAgency = useCallback(() => {
    if (nodes.length === 0) {
      alert('Cannot save empty workflow as agency');
      return;
    }

    // Check if at least one agent has a canister ID (real agent)
    const hasRealAgents = nodes.some(node => 
      node.type === 'agent' && node.data.agentCanisterId && node.data.agentCanisterId.trim() !== ''
    );

    if (!hasRealAgents) {
      alert('Please configure at least one agent with a canister ID before saving as agency');
      return;
    }

    setShowSaveAgencyDialog(true);
  }, [nodes]);

  const handleConfirmSaveAgency = useCallback(async () => {
    if (!agencyName.trim()) {
      alert('Please enter an agency name');
      return;
    }

    if (!onCreateAgency) {
      console.error('❌ [WorkflowCanvas] onCreateAgency callback is not provided');
      alert('Cannot save workflow: Create workflow handler is not available');
      return;
    }

    try {
      console.log('💾 [WorkflowCanvas] Starting save workflow process...', {
        agencyName: agencyName.trim(),
        nodesCount: nodes.length,
        edgesCount: edges.length,
        hasOnCreateAgency: !!onCreateAgency
      });

      // Extract available agent canister IDs from availableAgents prop
      const availableAgentCanisterIds = Array.isArray(availableAgents) && availableAgents.length > 0
        ? availableAgents
            .filter((agent): agent is { canisterId: string; name: string } => 
              typeof agent === 'object' && agent !== null && 'canisterId' in agent
            )
            .map(agent => agent.canisterId)
        : undefined;
      
      // Convert workflow to agent steps and connections
      const agentSteps = convertWorkflowToAgentSteps(nodes, edges, availableAgentCanisterIds, agencyWorkflowCanisterId);
      const connections = convertEdgesToConnections(nodes, edges, availableAgentCanisterIds, agencyWorkflowCanisterId);
      
      console.log('💾 [WorkflowCanvas] Converted to agent steps and connections:', {
        stepsCount: agentSteps.length,
        connectionsCount: connections.length,
        steps: agentSteps.map(s => ({ name: s.agentName, canisterId: s.agentCanisterId }))
      });
      
      // Call the parent's create workflow handler with agent steps and connections
      await onCreateAgency(
        agencyName.trim(), 
        agencyDescription.trim() || 'Workflow created from canvas',
        agentSteps,
        connections
      );
      
      console.log('✅ [WorkflowCanvas] Workflow save completed successfully');
      
      setShowSaveAgencyDialog(false);
      setAgencyName('');
      setAgencyDescription('');
    } catch (error) {
      console.error('❌ [WorkflowCanvas] Failed to save workflow:', error);
      alert(`Failed to save workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [agencyName, agencyDescription, nodes, edges, availableAgents, agencyWorkflowCanisterId, onCreateAgency]);

  // Execute workflow directly
  const handleExecute = useCallback(() => {
    if (nodes.length === 0) {
      alert('Cannot execute empty workflow');
      return;
    }

    // Check if at least one agent has a canister ID (real agent)
    const hasRealAgents = nodes.some(node => 
      node.type === 'agent' && node.data.agentCanisterId && node.data.agentCanisterId.trim() !== ''
    );

    if (!hasRealAgents) {
      alert('Please configure at least one agent with a canister ID before executing');
      return;
    }

    setShowExecuteDialog(true);
  }, [nodes]);

  const handleConfirmExecute = useCallback(() => {
    if (!executionInput.trim() || !onExecute) {
      alert('Please enter execution input');
      return;
    }

    try {
      // Convert current workflow nodes/edges to agent steps for execution
      // Extract available agent canister IDs from availableAgents prop
      const availableAgentCanisterIds = Array.isArray(availableAgents) && availableAgents.length > 0
        ? availableAgents
            .filter((agent): agent is { canisterId: string; name: string } => 
              typeof agent === 'object' && agent !== null && 'canisterId' in agent
            )
            .map(agent => agent.canisterId)
        : undefined;
      
      const agentSteps = convertWorkflowToAgentSteps(nodes, edges, availableAgentCanisterIds, agencyWorkflowCanisterId);
      onExecute(executionInput.trim(), agentSteps);
      setShowExecuteDialog(false);
      setExecutionInput('');
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      alert('Failed to execute workflow');
    }
  }, [executionInput, onExecute, nodes, edges, executionMode]);

  // Delete selected elements
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't delete if user is typing in an input field, textarea, or contenteditable element
    const activeElement = document.activeElement;
    const isTyping = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      (activeElement as HTMLElement).isContentEditable ||
      (activeElement as HTMLElement).contentEditable === 'true'
    );

    if (event.key === 'Delete' || event.key === 'Backspace') {
      // Delete node or edge if not typing in an input field
      if (selectedNodeId && !isTyping) {
        setNodes((nds) => nds.filter(node => node.id !== selectedNodeId));
        setSelectedNodeId(null);
        setShowConfigPanel(false);
      } else if (selectedEdgeId && !isTyping) {
        // NEW: Delete selected edge
        setEdges((eds) => eds.filter(edge => edge.id !== selectedEdgeId));
        setSelectedEdgeId(null);
        setShowEdgeConfigPanel(false);
      }
    } else if (event.key === 'Escape') {
      // Only close panel if not typing in an input field
      if (!isTyping) {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setShowConfigPanel(false);
        setShowEdgeConfigPanel(false);
      }
    }
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Get selected node
  const selectedNode = selectedNodeId ? nodes.find(node => node.id === selectedNodeId) || null : null;

  return (
    <div className={`flex flex-col h-full ${className}`} style={{ 
      background: 'var(--primary-black)',
      minHeight: 0,
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Desktop: Top section - Agent Palette (Horizontal) and Execution Mode */}
      {!isMobile && (
        <div className="flex-shrink-0 border-b" style={{ 
          borderColor: 'var(--border-color)',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          {/* Agent Palette - Resizable with drag handle */}
          <ResizableAgentPalette
            isCollapsed={paletteCollapsed}
            onToggleCollapse={() => setPaletteCollapsed(!paletteCollapsed)}
            minHeight={40}
            defaultHeight={160}
            maxHeight={320}
          >
            <AgentPalette
              deployedAgents={Array.isArray(availableAgents) && availableAgents.length > 0 && typeof availableAgents[0] === 'object' 
                ? availableAgents as Array<{ canisterId: string; name: string }>
                : (Array.isArray(availableAgents) ? availableAgents.map((id: string) => ({ canisterId: id, name: id.slice(0, 8) + '...' })) : [])}
              onDragStart={onDragStart}
              className="h-full"
              isHorizontal={true}
              isCollapsed={paletteCollapsed}
              onToggleCollapse={() => setPaletteCollapsed(!paletteCollapsed)}
            />
          </ResizableAgentPalette>

          {/* Execution Mode Selector - Compact - Only show when palette expanded */}
          {!paletteCollapsed && (
            <div className="px-2 py-1 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <ExecutionModeSelector
                value={executionMode}
                onChange={onExecutionModeChange}
                isCompact={true}
              />
            </div>
          )}
        </div>
      )}

      {/* Mobile: Floating button to open agent palette */}
      {isMobile && (
        <>
          <div className="flex-shrink-0 border-b px-3 py-2 flex items-center justify-between" style={{ 
            borderColor: 'var(--border-color)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <button
              onClick={() => setShowMobilePalette(true)}
              style={{
                background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '0.6rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                minHeight: '44px'
              }}
            >
              <span>➕</span>
              <span>Add Agent</span>
            </button>
            <ExecutionModeSelector
              value={executionMode}
              onChange={onExecutionModeChange}
              isCompact={true}
            />
          </div>

          {/* Mobile Agent Palette Modal */}
          {showMobilePalette && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.9)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--secondary-black)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h3 className="text-lg font-bold text-white">Add Agent</h3>
                <button
                  onClick={() => setShowMobilePalette(false)}
                  style={{
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '8px',
                    color: '#9CA3AF',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    minWidth: '44px',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <AgentPalette
                  deployedAgents={Array.isArray(availableAgents) && availableAgents.length > 0 && typeof availableAgents[0] === 'object' 
                    ? availableAgents as Array<{ canisterId: string; name: string }>
                    : (Array.isArray(availableAgents) ? availableAgents.map((id: string) => ({ canisterId: id, name: id.slice(0, 8) + '...' })) : [])}
                  onDragStart={onDragStart}
                  className="h-full"
                  isHorizontal={false}
                  isCollapsed={false}
                  onToggleCollapse={() => {}}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden" style={{ minHeight: 0, display: 'flex', flexDirection: 'row' }}>
        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden border" style={{
          background: 'var(--secondary-black)',
          borderColor: 'var(--border-color)',
          minHeight: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div ref={canvasRef} className="w-full h-full flex-1 min-h-0" style={{ minHeight: 0, position: 'relative' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick} // NEW: Handle edge clicks
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodesDraggable={true}
              connectionLineType="bezier"
              connectionMode="loose"
              connectionRadius={30}
              snapToGrid={false}
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
              <Controls 
                className="border" 
                style={{ 
                  background: 'var(--secondary-black)', 
                  borderColor: 'var(--border-color)'
                }}
                showZoom={!isMobile}
                showFitView={!isMobile}
                showInteractive={!isMobile}
              />
              
              {/* Canvas Panels - Desktop */}
              {!isMobile && (
                <Panel position="top-left" className="m-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTemplates(true)}
                      className="px-3 py-2 border text-white text-xs rounded-lg transition-all duration-200 flex items-center gap-2"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'var(--border-color)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                        e.currentTarget.style.borderColor = 'var(--accent-orange)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Templates
                    </button>

                    {/* Compact toolbar */}
                    <div className="flex gap-1">
                    <button
                      onClick={handleZoomIn}
                      className="p-2 border text-white text-xs rounded transition-all duration-200"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'var(--border-color)'
                      }}
                      title="Zoom In"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                        e.currentTarget.style.borderColor = 'var(--accent-orange)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <button
                      onClick={handleZoomOut}
                      className="p-2 border text-white text-xs rounded transition-all duration-200"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'var(--border-color)'
                      }}
                      title="Zoom Out"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                        e.currentTarget.style.borderColor = 'var(--accent-orange)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <button
                      onClick={handleZoomToFit}
                      className="p-2 border text-white text-xs rounded transition-all duration-200"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'var(--border-color)'
                      }}
                      title="Fit View"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                        e.currentTarget.style.borderColor = 'var(--accent-orange)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>
                    <button
                      onClick={handleAutoLayout}
                      className="p-2 border text-white text-xs rounded transition-all duration-200"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'var(--border-color)'
                      }}
                      title="Auto Layout"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                        e.currentTarget.style.borderColor = 'var(--accent-orange)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    {onExecute && (
                      <button
                        onClick={handleExecute}
                        disabled={nodes.length === 0}
                        className="px-3 py-2 border text-white text-xs rounded-lg transition-all duration-200 flex items-center gap-2"
                        style={{
                          background: nodes.length === 0 
                            ? 'rgba(107, 114, 128, 0.2)' 
                            : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                          borderColor: nodes.length === 0 
                            ? 'rgba(107, 114, 128, 0.3)' 
                            : 'transparent',
                          opacity: nodes.length === 0 ? 0.5 : 1,
                          cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          boxShadow: nodes.length === 0 ? 'none' : '0 4px 15px rgba(255, 107, 53, 0.3)'
                        }}
                        title="Execute this workflow"
                        onMouseEnter={(e) => {
                          if (nodes.length > 0) {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (nodes.length > 0) {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
                          }
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>▶️ Execute</span>
                      </button>
                    )}
                    <button
                      onClick={handleSaveAsTemplate}
                      disabled={nodes.length === 0}
                      className="px-3 py-2 border text-white text-xs rounded-lg transition-all duration-200 flex items-center gap-2"
                      style={{
                        background: nodes.length === 0 
                          ? 'rgba(107, 114, 128, 0.2)' 
                          : 'rgba(16, 185, 129, 0.15)',
                        borderColor: nodes.length === 0 
                          ? 'rgba(107, 114, 128, 0.3)' 
                          : 'rgba(16, 185, 129, 0.4)',
                        opacity: nodes.length === 0 ? 0.5 : 1,
                        cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
                        fontWeight: 600
                      }}
                      title="Save current workflow as a template"
                      onMouseEnter={(e) => {
                        if (nodes.length > 0) {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                          e.currentTarget.style.borderColor = 'var(--accent-green)';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (nodes.length > 0) {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      <span>Save Template</span>
                    </button>
                  </div>
                </div>
              </Panel>
              )}

              {/* Mobile Canvas Panels - Touch-friendly */}
              {isMobile && (
                <Panel position="top-left" className="m-2">
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setShowTemplates(true)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        padding: '0.6rem 0.75rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        minHeight: '44px'
                      }}
                    >
                      <span>📋</span>
                      <span>Templates</span>
                    </button>

                    {/* Mobile toolbar - Vertical stack */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleZoomIn}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: '#ffffff',
                            padding: '0.6rem',
                            cursor: 'pointer',
                            minWidth: '44px',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Zoom In"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                        <button
                          onClick={handleZoomOut}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: '#ffffff',
                            padding: '0.6rem',
                            cursor: 'pointer',
                            minWidth: '44px',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Zoom Out"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <button
                          onClick={handleZoomToFit}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: '#ffffff',
                            padding: '0.6rem',
                            cursor: 'pointer',
                            minWidth: '44px',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Fit View"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                        </button>
                        <button
                          onClick={handleAutoLayout}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: '#ffffff',
                            padding: '0.6rem',
                            cursor: 'pointer',
                            minWidth: '44px',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Auto Layout"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                        </button>
                      </div>
                      {onExecute && (
                        <button
                          onClick={handleExecute}
                          disabled={nodes.length === 0}
                          style={{
                            width: '100%',
                            background: nodes.length === 0 
                              ? 'rgba(107, 114, 128, 0.2)' 
                              : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: nodes.length === 0 ? 0.5 : 1,
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                          }}
                          title="Execute this workflow"
                        >
                          <span>▶️</span>
                          <span>Execute</span>
                        </button>
                      )}
                      <button
                        onClick={handleSaveAsTemplate}
                        disabled={nodes.length === 0}
                        style={{
                          width: '100%',
                          background: nodes.length === 0 
                            ? 'rgba(107, 114, 128, 0.2)' 
                            : 'rgba(16, 185, 129, 0.15)',
                          border: `1px solid ${nodes.length === 0 ? 'rgba(107, 114, 128, 0.3)' : 'rgba(16, 185, 129, 0.4)'}`,
                          borderRadius: '8px',
                          color: '#ffffff',
                          padding: '0.75rem',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: nodes.length === 0 ? 0.5 : 1,
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                        title="Save current workflow as a template"
                      >
                        <span>💾</span>
                        <span>Save Template</span>
                      </button>
                    </div>
                  </div>
                </Panel>
              )}

              <Panel position="bottom-right" className="m-2">
                <div className="text-xs px-2 py-1 rounded border" style={{
                  color: 'var(--text-gray)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'var(--border-color)',
                  fontSize: isMobile ? '0.7rem' : '0.75rem',
                  padding: isMobile ? '0.4rem 0.6rem' : '0.5rem 0.75rem'
                }}>
                  {nodes.length} nodes • {edges.length} connections
                </div>
              </Panel>
            </ReactFlow>
          </div>

          {/* Canvas Instructions */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              margin: 0,
              padding: 0
            }}>
              <div className="text-center p-6 rounded-lg border max-w-sm mx-auto" style={{
                background: 'rgba(17, 17, 17, 0.95)',
                borderColor: 'var(--border-color)',
                backdropFilter: 'blur(10px)',
                position: 'relative',
                left: 'auto',
                right: 'auto'
              }}>
                <div className="text-3xl mb-3">🎯</div>
                <h3 className="text-lg font-semibold text-white mb-2">Build Your Workflow</h3>
                <p className="text-gray-400 text-sm mb-3">
                  {isMobile 
                    ? 'Tap "Add Agent" to add agents to your workflow'
                    : 'Drag agents from the palette above to create your workflow'}
                </p>
                <div className="space-y-1 text-xs text-gray-500">
                  {isMobile ? (
                    <>
                      <p>• Tap "Add Agent" button to open agent palette</p>
                      <p>• Tap agents to add them to the canvas</p>
                      <p>• Tap on agents to configure them</p>
                      <p>• Tap on connections to set conditions</p>
                      <p>• Use pinch to zoom, drag to pan</p>
                    </>
                  ) : (
                    <>
                      <p>• Drag agents from the horizontal palette</p>
                      <p>• Connect agents by dragging between points</p>
                      <p>• Click on agents to configure them</p>
                      <p>• Click on connections to set conditions</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop: Configuration Panel - Right side */}
        {!isMobile && showConfigPanel && selectedNode && (
          <div className="w-80 flex-shrink-0 border-l overflow-y-auto" style={{ 
            borderColor: 'var(--border-color)',
            background: 'var(--secondary-black)',
            maxHeight: '100%'
          }}>
            <NodeConfigPanel
              node={selectedNode}
              onUpdateNode={onUpdateNode}
              onClose={() => {
                setShowConfigPanel(false);
                setSelectedNodeId(null);
              }}
              availableAgents={availableAgents}
              className="h-full"
            />
          </div>
        )}

        {/* Desktop: Edge Configuration Panel - Right side */}
        {!isMobile && showEdgeConfigPanel && selectedEdgeId && (
          <div className="w-80 flex-shrink-0 border-l overflow-y-auto" style={{ 
            borderColor: 'var(--border-color)',
            background: 'var(--secondary-black)',
            maxHeight: '100%'
          }}>
            <EdgeConfigPanel
              edge={edges.find(e => e.id === selectedEdgeId) || null}
              onUpdateEdge={onUpdateEdge}
              onClose={() => {
                setShowEdgeConfigPanel(false);
                setSelectedEdgeId(null);
              }}
              className="h-full"
            />
          </div>
        )}

        {/* Mobile: Node Configuration Panel - Full screen modal */}
        {isMobile && showConfigPanel && selectedNode && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--secondary-black)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 className="text-lg font-bold text-white">Configure Agent</h3>
              <button
                onClick={() => {
                  setShowConfigPanel(false);
                  setSelectedNodeId(null);
                }}
                style={{
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '8px',
                  color: '#9CA3AF',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <NodeConfigPanel
                node={selectedNode}
                onUpdateNode={onUpdateNode}
                onClose={() => {
                  setShowConfigPanel(false);
                  setSelectedNodeId(null);
                }}
                availableAgents={availableAgents}
                className="h-full"
              />
            </div>
          </div>
        )}

        {/* Mobile: Edge Configuration Panel - Full screen modal */}
        {isMobile && showEdgeConfigPanel && selectedEdgeId && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--secondary-black)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 className="text-lg font-bold text-white">Configure Connection</h3>
              <button
                onClick={() => {
                  setShowEdgeConfigPanel(false);
                  setSelectedEdgeId(null);
                }}
                style={{
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '8px',
                  color: '#9CA3AF',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <EdgeConfigPanel
                edge={edges.find(e => e.id === selectedEdgeId) || null}
                onUpdateEdge={onUpdateEdge}
                onClose={() => {
                  setShowEdgeConfigPanel(false);
                  setSelectedEdgeId(null);
                }}
                className="h-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom section - Validation - More compact */}
      <div className="flex-shrink-0 border-t" style={{ 
        borderColor: 'var(--border-color)',
        background: 'rgba(255, 255, 255, 0.02)',
        maxHeight: '80px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '70px' }}>
          <WorkflowValidator
            validation={validation}
            onFixError={(nodeId) => {
              setSelectedNodeId(nodeId);
              setShowConfigPanel(true);
            }}
            isCompact={true}
          />
        </div>
      </div>

      {/* Template Library Modal */}
      <TemplateLibrary
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={handleSelectTemplate}
        activeProject={activeProject}
      />

      {/* Save as Agency Dialog */}
      {showSaveAgencyDialog && onCreateAgency && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'rgba(17, 17, 17, 0.95)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              padding: '2rem',
              borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 className="text-xl font-bold text-white">Save Workflow as Agency</h3>
              <button
                onClick={() => setShowSaveAgencyDialog(false)}
                style={{
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '8px',
                  color: '#9CA3AF',
                  padding: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div style={{ padding: '2rem' }}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Agency Name *
                  </label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="My Workflow Agency"
                    style={{
                      width: '100%',
                      background: 'rgba(31, 31, 31, 0.8)',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3B82F6';
                      e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={agencyDescription}
                    onChange={(e) => setAgencyDescription(e.target.value)}
                    placeholder="Describe what this workflow does..."
                    rows={3}
                    style={{
                      width: '100%',
                      background: 'rgba(31, 31, 31, 0.8)',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3B82F6';
                      e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowSaveAgencyDialog(false);
                    setAgencyName('');
                    setAgencyDescription('');
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '8px',
                    color: '#9CA3AF',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSaveAgency}
                  disabled={!agencyName.trim()}
                  style={{
                    flex: 1,
                    background: !agencyName.trim()
                      ? 'rgba(107, 114, 128, 0.2)'
                      : 'rgba(59, 130, 246, 0.8)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: !agencyName.trim() ? 'not-allowed' : 'pointer',
                    opacity: !agencyName.trim() ? 0.5 : 1
                  }}
                >
                  💾 Save Workflow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execute Workflow Dialog */}
      {showExecuteDialog && onExecute && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'rgba(17, 17, 17, 0.95)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              padding: '2rem',
              borderBottom: '1px solid rgba(255, 107, 53, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 className="text-xl font-bold text-white">Execute Workflow</h3>
              <button
                onClick={() => setShowExecuteDialog(false)}
                style={{
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '8px',
                  color: '#9CA3AF',
                  padding: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid rgba(255, 107, 53, 0.2)',
              padding: '0 2rem'
            }}>
              <button
                onClick={() => setExecuteDialogTab('manual')}
                style={{
                  padding: '1rem 1.5rem',
                  background: executeDialogTab === 'manual' ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: executeDialogTab === 'manual' ? '2px solid var(--accent-orange)' : '2px solid transparent',
                  color: executeDialogTab === 'manual' ? '#ffffff' : '#9CA3AF',
                  fontSize: '0.9rem',
                  fontWeight: executeDialogTab === 'manual' ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                📝 Manual
              </button>
              {agencyId && (
                <button
                  onClick={() => setExecuteDialogTab('triggers')}
                  style={{
                    padding: '1rem 1.5rem',
                    background: executeDialogTab === 'triggers' ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
                    border: 'none',
                    borderBottom: executeDialogTab === 'triggers' ? '2px solid var(--accent-orange)' : '2px solid transparent',
                    color: executeDialogTab === 'triggers' ? '#ffffff' : '#9CA3AF',
                    fontSize: '0.9rem',
                    fontWeight: executeDialogTab === 'triggers' ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  ⚡ Triggers
                  {triggers.length > 0 && (
                    <span style={{
                      marginLeft: '0.5rem',
                      background: 'var(--accent-orange)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '10px',
                      display: 'inline-block'
                    }}>
                      {triggers.length}
                    </span>
                  )}
                </button>
              )}
            </div>
            
            <div style={{ padding: '2rem' }}>
              {executeDialogTab === 'manual' ? (
                <>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Execution Input *
                  </label>
                  <textarea
                    value={executionInput}
                    onChange={(e) => setExecutionInput(e.target.value)}
                    placeholder="Enter the input that will be processed by the workflow..."
                    rows={4}
                    style={{
                      width: '100%',
                      background: 'rgba(31, 31, 31, 0.8)',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: '100px'
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
                  <p className="text-xs text-gray-500 mt-2">
                    This input will be passed to the first agent in the workflow sequence
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowExecuteDialog(false);
                    setExecutionInput('');
                        setExecuteDialogTab('manual');
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '8px',
                    color: '#9CA3AF',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmExecute}
                  disabled={!executionInput.trim()}
                  style={{
                    flex: 1,
                    background: !executionInput.trim()
                      ? 'rgba(107, 114, 128, 0.2)'
                      : 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: !executionInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: !executionInput.trim() ? 0.5 : 1,
                    boxShadow: !executionInput.trim() ? 'none' : '0 4px 15px rgba(255, 107, 53, 0.3)'
                  }}
                >
                  ▶️ Execute Workflow
                </button>
              </div>
                </>
              ) : (
                <>
                  {/* Triggers Tab */}
                  <div className="space-y-4">
                    {!agencyId ? (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        textAlign: 'center'
                      }}>
                        <p className="text-gray-300 mb-2">
                          ⚠️ Save the workflow first to manage triggers
                        </p>
                        <p className="text-sm text-gray-500">
                          Triggers can only be created for saved workflows
                        </p>
            </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-semibold text-white">Workflow Triggers</h4>
                            <p className="text-sm text-gray-400 mt-1">
                              Automatically execute this workflow on a schedule or via webhook
                            </p>
          </div>
                          {onCreateTrigger && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setTriggerFormType('scheduled');
                                  setShowTriggerForm(true);
                                }}
                                style={{
                                  background: 'rgba(59, 130, 246, 0.2)',
                                  border: '1px solid #3B82F6',
                                  borderRadius: '8px',
                                  padding: '0.5rem 1rem',
                                  color: '#3B82F6',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                + Scheduled
                              </button>
                              <button
                                onClick={() => {
                                  setTriggerFormType('webhook');
                                  setShowTriggerForm(true);
                                }}
                                style={{
                                  background: 'rgba(16, 185, 129, 0.2)',
                                  border: '1px solid #10B981',
                                  borderRadius: '8px',
                                  padding: '0.5rem 1rem',
                                  color: '#10B981',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                + Webhook
                              </button>
                            </div>
                          )}
                        </div>

                        {triggers.length === 0 ? (
                          <div style={{
                            background: 'rgba(75, 85, 99, 0.1)',
                            border: '1px dashed rgba(75, 85, 99, 0.3)',
                            borderRadius: '8px',
                            padding: '2rem',
                            textAlign: 'center'
                          }}>
                            <p className="text-gray-400 mb-2">No triggers configured</p>
                            <p className="text-sm text-gray-500">
                              Create a scheduled or webhook trigger to automatically execute this workflow
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {triggers.map((trigger: any) => {
                              const triggerType = trigger.triggerType || {};
                              const isScheduled = 'scheduled' in triggerType;
                              const isWebhook = 'webhook' in triggerType;
                              const isCondition = 'condition' in triggerType;
                              
                              return (
                                <div
                                  key={trigger.id}
                                  style={{
                                    background: 'rgba(31, 31, 31, 0.8)',
                                    border: `1px solid ${trigger.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(75, 85, 99, 0.3)'}`,
                                    borderRadius: '8px',
                                    padding: '1rem'
                                  }}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-white font-semibold">{trigger.name}</span>
                                        <span style={{
                                          background: trigger.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                                          color: trigger.enabled ? '#10B981' : '#9CA3AF',
                                          fontSize: '0.7rem',
                                          padding: '0.2rem 0.5rem',
                                          borderRadius: '4px',
                                          fontWeight: 600
                                        }}>
                                          {trigger.enabled ? '✓ Enabled' : '○ Disabled'}
                                        </span>
                                        {isScheduled && <span style={{ color: '#3B82F6', fontSize: '0.75rem' }}>⏰ Scheduled</span>}
                                        {isWebhook && <span style={{ color: '#10B981', fontSize: '0.75rem' }}>🪝 Webhook</span>}
                                        {isCondition && <span style={{ color: '#8B5CF6', fontSize: '0.75rem' }}>🎯 Condition</span>}
                                      </div>
                                      {trigger.description && (
                                        <p className="text-sm text-gray-400 mb-2">{trigger.description}</p>
                                      )}
                                      {isScheduled && triggerType.scheduled?.schedule && (
                                        <p className="text-xs text-gray-500">
                                          {('cron' in triggerType.scheduled.schedule) && `Cron: ${triggerType.scheduled.schedule.cron.expression}`}
                                          {('interval' in triggerType.scheduled.schedule) && `Interval: Every ${triggerType.scheduled.schedule.interval.seconds.toString()}s`}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                      {onExecuteTrigger && trigger.enabled && (
                                        <button
                                          onClick={async () => {
                                            if (!trigger.id) return;
                                            setIsExecutingTrigger(trigger.id);
                                            try {
                                              await onExecuteTrigger(trigger.id);
                                              setShowExecuteDialog(false);
                                            } catch (error) {
                                              console.error('Failed to execute trigger:', error);
                                              alert('Failed to execute trigger');
                                            } finally {
                                              setIsExecutingTrigger(null);
                                            }
                                          }}
                                          disabled={isExecutingTrigger === trigger.id}
                                          style={{
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            border: '1px solid #10B981',
                                            borderRadius: '6px',
                                            padding: '0.5rem',
                                            color: '#10B981',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem'
                                          }}
                                          title="Execute now"
                                        >
                                          {isExecutingTrigger === trigger.id ? '⏳' : '▶️'}
                                        </button>
                                      )}
                                      {onToggleTrigger && (
                                        <button
                                          onClick={async () => {
                                            if (!trigger.id) return;
                                            try {
                                              await onToggleTrigger(trigger.id);
                                            } catch (error) {
                                              console.error('Failed to toggle trigger:', error);
                                            }
                                          }}
                                          style={{
                                            background: trigger.enabled ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                            border: `1px solid ${trigger.enabled ? '#ef4444' : '#10B981'}`,
                                            borderRadius: '6px',
                                            padding: '0.5rem',
                                            color: trigger.enabled ? '#ef4444' : '#10B981',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem'
                                          }}
                                          title={trigger.enabled ? 'Disable' : 'Enable'}
                                        >
                                          {trigger.enabled ? '⏸️' : '▶️'}
                                        </button>
                                      )}
                                      {onDeleteTrigger && (
                                        <button
                                          onClick={async () => {
                                            if (!trigger.id || !confirm('Delete this trigger?')) return;
                                            try {
                                              await onDeleteTrigger(trigger.id);
                                            } catch (error) {
                                              console.error('Failed to delete trigger:', error);
                                            }
                                          }}
                                          style={{
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            border: '1px solid #ef4444',
                                            borderRadius: '6px',
                                            padding: '0.5rem',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem'
                                          }}
                                          title="Delete"
                                        >
                                          🗑️
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={() => {
                        setShowExecuteDialog(false);
                        setExecuteDialogTab('manual');
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(107, 114, 128, 0.2)',
                        border: '1px solid rgba(107, 114, 128, 0.3)',
                        borderRadius: '8px',
                        color: '#9CA3AF',
                        padding: '0.75rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trigger Creation Form Modal */}
      {showTriggerForm && triggerFormType && onCreateTrigger && agencyId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '1rem',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'rgba(17, 17, 17, 0.95)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              padding: '2rem',
              borderBottom: '1px solid rgba(255, 107, 53, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 className="text-xl font-bold text-white">
                Create {triggerFormType === 'scheduled' ? 'Scheduled' : triggerFormType === 'webhook' ? 'Webhook' : 'Condition'} Trigger
              </h3>
              <button
                onClick={() => {
                  setShowTriggerForm(false);
                  setTriggerFormType(null);
                }}
                style={{
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '8px',
                  color: '#9CA3AF',
                  padding: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div style={{ padding: '2rem' }}>
              <TriggerCreationFormContent
                type={triggerFormType}
                onCreateTrigger={async (config) => {
                  try {
                    await onCreateTrigger(triggerFormType, config);
                    setShowTriggerForm(false);
                    setTriggerFormType(null);
                  } catch (error) {
                    console.error('Failed to create trigger:', error);
                    alert(error instanceof Error ? error.message : 'Failed to create trigger');
                  }
                }}
                onClose={() => {
                  setShowTriggerForm(false);
                  setTriggerFormType(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Save Template Dialog */}
      {showSaveTemplateDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'rgba(17, 17, 17, 0.95)',
            border: '1px solid rgba(255, 107, 53, 0.2)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            padding: '2rem',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 className="text-xl font-bold text-white mb-4">Save Workflow as Template</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="My Customer Support Workflow"
                  style={{
                    width: '100%',
                    background: 'rgba(31, 31, 31, 0.8)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem 1rem',
                    fontSize: '0.9rem',
                    outline: 'none'
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Describe what this workflow does..."
                  rows={3}
                  style={{
                    width: '100%',
                    background: 'rgba(31, 31, 31, 0.8)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0.75rem 1rem',
                    fontSize: '0.9rem',
                    outline: 'none',
                    resize: 'vertical'
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
              </div>

              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '0.85rem',
                color: '#10B981'
              }}>
                <p className="font-medium mb-1">This template will include:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{nodes.length} agent node{nodes.length !== 1 ? 's' : ''} with real canister IDs</li>
                  <li>{edges.length} connection{edges.length !== 1 ? 's' : ''}</li>
                  <li>Execution mode: {executionMode}</li>
                  <li>All agent configurations (input templates, timeouts, etc.)</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSaveTemplateDialog(false);
                  setTemplateName('');
                  setTemplateDescription('');
                }}
                style={{
                  flex: 1,
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '8px',
                  color: '#9CA3AF',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSaveTemplate}
                disabled={!templateName.trim()}
                style={{
                  flex: 1,
                  background: !templateName.trim()
                    ? 'rgba(107, 114, 128, 0.2)'
                    : 'linear-gradient(135deg, var(--accent-green), #059669)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: !templateName.trim() ? 'not-allowed' : 'pointer',
                  opacity: !templateName.trim() ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                💾 Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface WorkflowCanvasProps extends WorkflowCanvasInternalProps {}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInternal {...props} />
    </ReactFlowProvider>
  );
};