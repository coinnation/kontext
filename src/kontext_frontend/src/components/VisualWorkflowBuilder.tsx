import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { AgencyService } from '../services/AgencyService';

// ==================== TYPES ====================

interface Position {
  x: number;
  y: number;
}

interface AgentNode {
  id: string;
  type: 'agent' | 'start' | 'end' | 'condition' | 'parallel';
  position: Position;
  data: {
    agentName?: string;
    agentCanisterId?: string;
    inputTemplate?: string;
    label?: string;
    condition?: string;
    description?: string;
    triggerConfig?: any;
  };
  width: number;
  height: number;
}

interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: 'default' | 'condition' | 'error' | 'success';
  label?: string;
  animated?: boolean;
}

interface WorkflowData {
  nodes: AgentNode[];
  connections: Connection[];
  name: string;
  description: string;
}

interface DragState {
  isDragging: boolean;
  nodeId: string | null;
  offset: Position;
}

interface ConnectionState {
  isConnecting: boolean;
  sourceNodeId: string | null;
  sourceHandle: string | null;
  mousePosition: Position;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Mobile responsiveness helper
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return isMobile;
};

// ==================== MAIN COMPONENT ====================

export const VisualWorkflowBuilder: React.FC<{
  onSave: (workflowData: WorkflowData) => void;
  onClose: () => void;
  initialData?: WorkflowData;
}> = ({ onSave, onClose, initialData }) => {
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const {
    activeProject,
    userCanisterId,
    identity,
  } = useAppStore(state => ({
    activeProject: state.activeProject,
    userCanisterId: state.userCanisterId,
    identity: state.identity,
  }));

  // State management
  const [workflowName, setWorkflowName] = useState(initialData?.name || '');
  const [workflowDescription, setWorkflowDescription] = useState(initialData?.description || '');
  const [nodes, setNodes] = useState<AgentNode[]>(initialData?.nodes || []);
  const [connections, setConnections] = useState<Connection[]>(initialData?.connections || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({ isDragging: false, nodeId: null, offset: { x: 0, y: 0 } });
  const [connectionState, setConnectionState] = useState<ConnectionState>({ isConnecting: false, sourceNodeId: null, sourceHandle: null, mousePosition: { x: 0, y: 0 } });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [showNodePanel, setShowNodePanel] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [], warnings: [] });
  const [isSaving, setIsSaving] = useState(false);

  // Initialize with start node if empty
  useEffect(() => {
    if (nodes.length === 0) {
      const startNode: AgentNode = {
        id: 'start-node',
        type: 'start',
        position: { x: 100, y: 200 },
        data: { label: 'Start' },
        width: 120,
        height: 60
      };
      setNodes([startNode]);
    }
  }, [nodes.length]);

  // ==================== NODE MANAGEMENT ====================

  const addNode = useCallback((type: AgentNode['type'], position?: Position) => {
    const nodePosition = position || { x: 200 + nodes.length * 250, y: 200 };
    const newNode: AgentNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      position: nodePosition,
      data: getDefaultNodeData(type),
      width: getNodeDimensions(type).width,
      height: getNodeDimensions(type).height
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setShowNodePanel(true);
  }, [nodes.length]);

  const getDefaultNodeData = (type: AgentNode['type']) => {
    switch (type) {
      case 'agent':
        return {
          agentName: 'New Agent',
          inputTemplate: '{{previousOutput}}',
          description: 'Agent description'
        };
      case 'condition':
        return {
          label: 'Condition',
          condition: 'output.contains("success")',
          description: 'Conditional branching'
        };
      case 'parallel':
        return {
          label: 'Parallel Split',
          description: 'Execute multiple branches in parallel'
        };
      case 'end':
        return {
          label: 'End',
          description: 'Workflow completion'
        };
      default:
        return { label: 'Node' };
    }
  };

  const getNodeDimensions = (type: AgentNode['type']) => {
    switch (type) {
      case 'agent':
        return { width: 200, height: 120 };
      case 'condition':
        return { width: 160, height: 100 };
      case 'parallel':
        return { width: 180, height: 80 };
      case 'start':
      case 'end':
        return { width: 120, height: 60 };
      default:
        return { width: 160, height: 80 };
    }
  };

  const updateNode = useCallback((nodeId: string, updates: Partial<AgentNode>) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, ...updates } : node
    ));
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'start-node') return; // Don't delete start node

    setNodes(prev => prev.filter(node => node.id !== nodeId));
    setConnections(prev => prev.filter(conn => 
      conn.sourceNodeId !== nodeId && conn.targetNodeId !== nodeId
    ));
    
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      setShowNodePanel(false);
    }
  }, [selectedNodeId]);

  // ==================== CONNECTION MANAGEMENT ====================

  const startConnection = useCallback((nodeId: string, handle: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setConnectionState({
      isConnecting: true,
      sourceNodeId: nodeId,
      sourceHandle: handle,
      mousePosition: { x: event.clientX, y: event.clientY }
    });
  }, []);

  const updateConnectionPosition = useCallback((event: React.MouseEvent) => {
    if (connectionState.isConnecting) {
      setConnectionState(prev => ({
        ...prev,
        mousePosition: { x: event.clientX, y: event.clientY }
      }));
    }
  }, [connectionState.isConnecting]);

  const completeConnection = useCallback((targetNodeId: string, targetHandle: string) => {
    if (!connectionState.isConnecting || !connectionState.sourceNodeId) return;

    // Prevent self-connection
    if (connectionState.sourceNodeId === targetNodeId) {
      setConnectionState({ isConnecting: false, sourceNodeId: null, sourceHandle: null, mousePosition: { x: 0, y: 0 } });
      return;
    }

    // Check for existing connection
    const existingConnection = connections.find(conn =>
      conn.sourceNodeId === connectionState.sourceNodeId &&
      conn.targetNodeId === targetNodeId
    );

    if (existingConnection) {
      setConnectionState({ isConnecting: false, sourceNodeId: null, sourceHandle: null, mousePosition: { x: 0, y: 0 } });
      return;
    }

    const newConnection: Connection = {
      id: `connection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceNodeId: connectionState.sourceNodeId,
      targetNodeId,
      sourceHandle: connectionState.sourceHandle || undefined,
      targetHandle: targetHandle,
      type: 'default'
    };

    setConnections(prev => [...prev, newConnection]);
    setConnectionState({ isConnecting: false, sourceNodeId: null, sourceHandle: null, mousePosition: { x: 0, y: 0 } });
  }, [connectionState, connections]);

  const deleteConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
    if (selectedConnectionId === connectionId) {
      setSelectedConnectionId(null);
    }
  }, [selectedConnectionId]);

  // ==================== DRAG & DROP ====================

  const handleMouseDown = useCallback((nodeId: string, event: React.MouseEvent) => {
    if (event.button !== 0) return; // Only handle left click

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offset = {
      x: (event.clientX - rect.left - pan.x) / zoom - node.position.x,
      y: (event.clientY - rect.top - pan.y) / zoom - node.position.y
    };

    setDragState({
      isDragging: true,
      nodeId,
      offset
    });

    setSelectedNodeId(nodeId);
    event.preventDefault();
  }, [nodes, pan, zoom]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    // Update connection preview
    updateConnectionPosition(event);

    // Handle node dragging
    if (dragState.isDragging && dragState.nodeId) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const newPosition = {
        x: (event.clientX - rect.left - pan.x) / zoom - dragState.offset.x,
        y: (event.clientY - rect.top - pan.y) / zoom - dragState.offset.y
      };

      updateNode(dragState.nodeId, { position: newPosition });
    }
  }, [dragState, pan, zoom, updateNode, updateConnectionPosition]);

  const handleMouseUp = useCallback(() => {
    setDragState({ isDragging: false, nodeId: null, offset: { x: 0, y: 0 } });
    setConnectionState(prev => ({ ...prev, isConnecting: false, sourceNodeId: null, sourceHandle: null }));
  }, []);

  // ==================== VALIDATION ====================

  const validateWorkflow = useCallback((): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for workflow name
    if (!workflowName.trim()) {
      errors.push('Workflow name is required');
    }

    // Check for isolated nodes
    const isolatedNodes = nodes.filter(node => {
      if (node.type === 'start') return false;
      const hasIncoming = connections.some(conn => conn.targetNodeId === node.id);
      const hasOutgoing = connections.some(conn => conn.sourceNodeId === node.id);
      return !hasIncoming && !hasOutgoing;
    });

    if (isolatedNodes.length > 0) {
      warnings.push(`${isolatedNodes.length} isolated nodes found`);
    }

    // Check for agents without configuration
    const unconfiguredAgents = nodes.filter(node => 
      node.type === 'agent' && (!node.data.agentName || !node.data.agentCanisterId)
    );

    if (unconfiguredAgents.length > 0) {
      errors.push(`${unconfiguredAgents.length} agents need configuration`);
    }

    // Check for end node
    const hasEndNode = nodes.some(node => node.type === 'end');
    if (!hasEndNode && nodes.length > 1) {
      warnings.push('Consider adding an end node');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [workflowName, nodes, connections]);

  // ==================== SAVE & EXPORT ====================

  const handleSave = useCallback(async () => {
    const validation = validateWorkflow();
    setValidation(validation);

    if (!validation.isValid) {
      setShowValidation(true);
      return;
    }

    setIsSaving(true);

    try {
      const workflowData: WorkflowData = {
        nodes,
        connections,
        name: workflowName,
        description: workflowDescription
      };

      await onSave(workflowData);
    } catch (error) {
      console.error('Failed to save workflow:', error);
    } finally {
      setIsSaving(false);
    }
  }, [validateWorkflow, nodes, connections, workflowName, workflowDescription, onSave]);

  // ==================== RENDER HELPERS ====================

  const getNodeStyle = (node: AgentNode, isSelected: boolean) => {
    const baseStyle = {
      position: 'absolute' as const,
      left: node.position.x,
      top: node.position.y,
      width: node.width,
      height: node.height,
      borderRadius: '8px',
      border: isSelected ? '2px solid #ff6b35' : '1px solid rgba(255, 255, 255, 0.2)',
      background: getNodeBackground(node.type),
      color: '#ffffff',
      cursor: 'grab',
      userSelect: 'none' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px',
      transition: 'all 0.2s ease',
      boxShadow: isSelected ? '0 0 20px rgba(255, 107, 53, 0.5)' : '0 4px 8px rgba(0, 0, 0, 0.3)',
    };

    return baseStyle;
  };

  const getNodeBackground = (type: AgentNode['type']) => {
    switch (type) {
      case 'start':
        return 'linear-gradient(135deg, #10B981, #059669)';
      case 'end':
        return 'linear-gradient(135deg, #EF4444, #DC2626)';
      case 'agent':
        return 'linear-gradient(135deg, #8B5CF6, #7C3AED)';
      case 'condition':
        return 'linear-gradient(135deg, #F59E0B, #D97706)';
      case 'parallel':
        return 'linear-gradient(135deg, #06B6D4, #0891B2)';
      default:
        return 'linear-gradient(135deg, #6B7280, #4B5563)';
    }
  };

  const getNodeIcon = (type: AgentNode['type']) => {
    switch (type) {
      case 'start': return '▶️';
      case 'end': return '🏁';
      case 'agent': return '🤖';
      case 'condition': return '🔀';
      case 'parallel': return '⚡';
      default: return '📦';
    }
  };

  const renderNode = (node: AgentNode) => {
    const isSelected = selectedNodeId === node.id;
    const isConnecting = connectionState.isConnecting;

    return (
      <div
        key={node.id}
        style={getNodeStyle(node, isSelected)}
        onMouseDown={(e) => handleMouseDown(node.id, e)}
        onClick={() => {
          if (isConnecting && connectionState.sourceNodeId !== node.id) {
            completeConnection(node.id, 'input');
          } else {
            setSelectedNodeId(node.id);
            if (node.type === 'agent') {
              setShowNodePanel(true);
            }
          }
        }}
      >
        {/* Connection handles */}
        {node.type !== 'start' && (
          <div
            style={{
              position: 'absolute',
              left: '-8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#10B981',
              border: '2px solid #ffffff',
              cursor: 'crosshair',
              zIndex: 10
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (isConnecting) {
                completeConnection(node.id, 'input');
              }
            }}
          />
        )}

        {node.type !== 'end' && (
          <div
            style={{
              position: 'absolute',
              right: '-8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#EF4444',
              border: '2px solid #ffffff',
              cursor: 'crosshair',
              zIndex: 10
            }}
            onMouseDown={(e) => startConnection(node.id, 'output', e)}
          />
        )}

        {/* Node content */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
            {getNodeIcon(node.type)}
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px' }}>
            {node.data.label || node.data.agentName || node.type}
          </div>
          {node.data.description && (
            <div style={{ fontSize: '0.7rem', opacity: 0.8, lineHeight: 1.2 }}>
              {node.data.description}
            </div>
          )}
        </div>

        {/* Delete button for non-start nodes */}
        {node.type !== 'start' && isSelected && (
          <button
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#EF4444',
              border: 'none',
              color: '#ffffff',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(node.id);
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  const renderConnection = (connection: Connection) => {
    const sourceNode = nodes.find(n => n.id === connection.sourceNodeId);
    const targetNode = nodes.find(n => n.id === connection.targetNodeId);

    if (!sourceNode || !targetNode) return null;

    const sourceX = sourceNode.position.x + sourceNode.width;
    const sourceY = sourceNode.position.y + sourceNode.height / 2;
    const targetX = targetNode.position.x;
    const targetY = targetNode.position.y + targetNode.height / 2;

    const midX = (sourceX + targetX) / 2;
    
    const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY} ${midX} ${targetY} ${targetX} ${targetY}`;

    const isSelected = selectedConnectionId === connection.id;

    return (
      <g key={connection.id}>
        <path
          d={path}
          stroke={isSelected ? '#ff6b35' : '#ffffff'}
          strokeWidth={isSelected ? 3 : 2}
          fill="none"
          opacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => setSelectedConnectionId(connection.id)}
        />
        
        {/* Arrow marker */}
        <circle
          cx={targetX - 6}
          cy={targetY}
          r="4"
          fill={isSelected ? '#ff6b35' : '#ffffff'}
        />

        {/* Connection label */}
        {connection.label && (
          <text
            x={midX}
            y={(sourceY + targetY) / 2 - 10}
            fill="#ffffff"
            fontSize="12"
            textAnchor="middle"
            style={{ userSelect: 'none' }}
          >
            {connection.label}
          </text>
        )}

        {/* Delete button for selected connection */}
        {isSelected && (
          <circle
            cx={midX}
            cy={(sourceY + targetY) / 2}
            r="12"
            fill="#EF4444"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              deleteConnection(connection.id);
            }}
          />
        )}
        {isSelected && (
          <text
            x={midX}
            y={(sourceY + targetY) / 2 + 4}
            fill="#ffffff"
            fontSize="12"
            textAnchor="middle"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={(e) => {
              e.stopPropagation();
              deleteConnection(connection.id);
            }}
          >
            ×
          </text>
        )}
      </g>
    );
  };

  const renderConnectionPreview = () => {
    if (!connectionState.isConnecting || !connectionState.sourceNodeId) return null;

    const sourceNode = nodes.find(n => n.id === connectionState.sourceNodeId);
    if (!sourceNode) return null;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const sourceX = sourceNode.position.x + sourceNode.width;
    const sourceY = sourceNode.position.y + sourceNode.height / 2;
    const targetX = (connectionState.mousePosition.x - rect.left - pan.x) / zoom;
    const targetY = (connectionState.mousePosition.y - rect.top - pan.y) / zoom;

    const midX = (sourceX + targetX) / 2;
    const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY} ${midX} ${targetY} ${targetX} ${targetY}`;

    return (
      <path
        d={path}
        stroke="#ff6b35"
        strokeWidth={2}
        fill="none"
        opacity={0.5}
        strokeDasharray="5,5"
      />
    );
  };

  // ==================== RENDER ====================

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#0a0a0a',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '1rem' : '1.5rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h1 style={{ 
            color: '#ffffff', 
            fontSize: isMobile ? '1.25rem' : '1.5rem', 
            fontWeight: 700, 
            margin: '0 0 0.5rem 0' 
          }}>
            🎨 Visual Workflow Builder
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
            Design agent workflows with drag-and-drop interface
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowValidation(true)}
            style={{
              background: validation.isValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${validation.isValid ? '#10B981' : '#EF4444'}`,
              color: validation.isValid ? '#10B981' : '#EF4444',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {validation.isValid ? '✅' : '⚠️'} Validate
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              background: 'linear-gradient(135deg, #ff6b35, #10B981)',
              border: 'none',
              color: '#ffffff',
              padding: '0.5rem 1.5rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1
            }}
          >
            {isSaving ? '💾 Saving...' : '💾 Save Workflow'}
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #EF4444',
              color: '#EF4444',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          width: isMobile ? '100%' : '250px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '1rem',
          overflowY: 'auto',
          position: isMobile ? 'absolute' : 'relative',
          zIndex: isMobile ? 100 : 1,
          height: isMobile ? 'auto' : '100%',
          top: isMobile ? '80px' : 'auto',
          left: isMobile ? (showNodePanel ? '0' : '-100%') : 'auto',
          transition: 'left 0.3s ease'
        }}>
          {/* Workflow info */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#ffffff', fontSize: '1rem', margin: '0 0 1rem 0' }}>
              📋 Workflow Details
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Name
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="My Agent Workflow"
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  padding: '0.5rem',
                  color: '#ffffff',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Description
              </label>
              <textarea
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Describe what this workflow does..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  padding: '0.5rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  resize: 'vertical' as const
                }}
              />
            </div>
          </div>

          {/* Node types */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#ffffff', fontSize: '1rem', margin: '0 0 1rem 0' }}>
              🎯 Add Nodes
            </h3>
            
            {[
              { type: 'agent' as const, label: 'AI Agent', icon: '🤖', desc: 'Individual AI agent' },
              { type: 'condition' as const, label: 'Condition', icon: '🔀', desc: 'Conditional branching' },
              { type: 'parallel' as const, label: 'Parallel', icon: '⚡', desc: 'Parallel execution' },
              { type: 'end' as const, label: 'End Node', icon: '🏁', desc: 'Workflow termination' },
            ].map((nodeType) => (
              <button
                key={nodeType.type}
                onClick={() => addNode(nodeType.type)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{nodeType.icon}</span>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {nodeType.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                    {nodeType.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Canvas controls */}
          <div>
            <h3 style={{ color: '#ffffff', fontSize: '1rem', margin: '0 0 1rem 0' }}>
              🎛️ Canvas Controls
            </h3>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))}
                style={{
                  flex: 1,
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10B981',
                  color: '#10B981',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                🔍+
              </button>
              <button
                onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
                style={{
                  flex: 1,
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid #EF4444',
                  color: '#EF4444',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                🔍-
              </button>
              <button
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                style={{
                  flex: 1,
                  background: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid #6B7280',
                  color: '#6B7280',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                🎯
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#aaa', textAlign: 'center' }}>
              Zoom: {(zoom * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div 
          ref={canvasRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: 'radial-gradient(circle at 50% 50%, rgba(255, 107, 53, 0.05) 0%, rgba(0, 0, 0, 0.3) 100%)',
            cursor: connectionState.isConnecting ? 'crosshair' : 'default'
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => {
            setSelectedNodeId(null);
            setSelectedConnectionId(null);
            setShowNodePanel(false);
          }}
        >
          {/* Grid pattern */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: 0.1
            }}
          >
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#ffffff" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Transform container */}
          <div
            style={{
              position: 'absolute',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: '100%',
              height: '100%'
            }}
          >
            {/* Connections SVG */}
            <svg
              ref={svgRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible'
              }}
            >
              {connections.map(renderConnection)}
              {renderConnectionPreview()}
            </svg>

            {/* Nodes */}
            {nodes.map(renderNode)}
          </div>

          {/* Instructions */}
          {nodes.length <= 1 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#666',
              pointerEvents: 'none'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>
                🎨
              </div>
              <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>
                Start Building Your Workflow
              </h3>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                Add AI agents from the sidebar and connect them to create powerful workflows
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile toggle button */}
      {isMobile && (
        <button
          onClick={() => setShowNodePanel(!showNodePanel)}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff6b35, #10B981)',
            border: 'none',
            color: '#ffffff',
            fontSize: '1.5rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 200
          }}
        >
          {showNodePanel ? '✕' : '+'}
        </button>
      )}

      {/* Validation Modal */}
      {showValidation && (
        <ValidationModal
          validation={validation}
          onClose={() => setShowValidation(false)}
        />
      )}

      {/* Node Editor Panel */}
      {showNodePanel && selectedNodeId && (
        <NodeEditorPanel
          node={nodes.find(n => n.id === selectedNodeId)!}
          onUpdate={(updates) => updateNode(selectedNodeId, updates)}
          onClose={() => setShowNodePanel(false)}
          isMobile={isMobile}
        />
      )}
    </div>
  );
};

// ==================== VALIDATION MODAL ====================

const ValidationModal: React.FC<{
  validation: ValidationResult;
  onClose: () => void;
}> = ({ validation, onClose }) => {
  return (
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
      zIndex: 2000,
      padding: '1rem'
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '70vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#ffffff', fontSize: '1.5rem', margin: 0 }}>
            {validation.isValid ? '✅ Validation Passed' : '⚠️ Validation Issues'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.5rem',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>

        {validation.errors.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#EF4444', fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              🚨 Errors
            </h3>
            <ul style={{ color: '#EF4444', paddingLeft: '1.5rem' }}>
              {validation.errors.map((error, index) => (
                <li key={index} style={{ marginBottom: '0.5rem' }}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#F59E0B', fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              ⚠️ Warnings
            </h3>
            <ul style={{ color: '#F59E0B', paddingLeft: '1.5rem' }}>
              {validation.warnings.map((warning, index) => (
                <li key={index} style={{ marginBottom: '0.5rem' }}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {validation.isValid && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10B981',
            borderRadius: '8px',
            padding: '1rem',
            color: '#10B981'
          }}>
            🎉 Your workflow is valid and ready to save!
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #ff6b35, #10B981)',
            border: 'none',
            color: '#ffffff',
            padding: '0.75rem',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

// ==================== NODE EDITOR PANEL ====================

const NodeEditorPanel: React.FC<{
  node: AgentNode;
  onUpdate: (updates: Partial<AgentNode>) => void;
  onClose: () => void;
  isMobile: boolean;
}> = ({ node, onUpdate, onClose, isMobile }) => {
  const [localData, setLocalData] = useState(node.data);

  const handleSave = () => {
    onUpdate({ data: localData });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: isMobile ? '100%' : '400px',
      height: '100%',
      background: '#1a1a1a',
      borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
      padding: '2rem',
      overflowY: 'auto',
      zIndex: 1500
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2 style={{ color: '#ffffff', fontSize: '1.3rem', margin: 0 }}>
          {getNodeIcon(node.type)} Edit {node.type} Node
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#ffffff',
            fontSize: '1.5rem',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>

      {node.type === 'agent' && (
        <div className="space-y-4">
          <div>
            <label style={{ display: 'block', color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Agent Name
            </label>
            <input
              type="text"
              value={localData.agentName || ''}
              onChange={(e) => setLocalData(prev => ({ ...prev, agentName: e.target.value }))}
              placeholder="My AI Agent"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '0.75rem',
                color: '#ffffff',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Agent Canister ID
            </label>
            <input
              type="text"
              value={localData.agentCanisterId || ''}
              onChange={(e) => setLocalData(prev => ({ ...prev, agentCanisterId: e.target.value }))}
              placeholder="rdmx6-jaaaa-aaaaa-aaadq-cai"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '0.75rem',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Input Template
            </label>
            <textarea
              value={localData.inputTemplate || ''}
              onChange={(e) => setLocalData(prev => ({ ...prev, inputTemplate: e.target.value }))}
              placeholder="{{previousOutput}}"
              rows={4}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '0.75rem',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                resize: 'vertical' as const
              }}
            />
            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
              Use {{previousOutput}} to reference the previous step's output
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Description
            </label>
            <textarea
              value={localData.description || ''}
              onChange={(e) => setLocalData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What does this agent do?"
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '0.75rem',
                color: '#ffffff',
                fontSize: '0.9rem',
                resize: 'vertical' as const
              }}
            />
          </div>
        </div>
      )}

      {node.type === 'condition' && (
        <div className="space-y-4">
          <div>
            <label style={{ display: 'block', color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Condition Label
            </label>
            <input
              type="text"
              value={localData.label || ''}
              onChange={(e) => setLocalData(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Success Check"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '0.75rem',
                color: '#ffffff',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Condition Expression
            </label>
            <input
              type="text"
              value={localData.condition || ''}
              onChange={(e) => setLocalData(prev => ({ ...prev, condition: e.target.value }))}
              placeholder="output.contains('success')"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '0.75rem',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Description
            </label>
            <textarea
              value={localData.description || ''}
              onChange={(e) => setLocalData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="When should this condition trigger?"
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '0.75rem',
                color: '#ffffff',
                fontSize: '0.9rem',
                resize: 'vertical' as const
              }}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg, #ff6b35, #10B981)',
            border: 'none',
            color: '#ffffff',
            padding: '0.75rem',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          💾 Save Changes
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            background: 'rgba(107, 114, 128, 0.2)',
            border: '1px solid #6B7280',
            color: '#6B7280',
            padding: '0.75rem',
            borderRadius: '6px',
            fontSize: '0.9rem',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// Helper function to get node icon
function getNodeIcon(type: AgentNode['type']) {
  switch (type) {
    case 'start': return '▶️';
    case 'end': return '🏁';
    case 'agent': return '🤖';
    case 'condition': return '🔀';
    case 'parallel': return '⚡';
    default: return '📦';
  }
}