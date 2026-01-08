import React from 'react';
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import type { WorkflowEdge } from './types';
import type { ConnectionCondition } from '../../services/AgencyService';

interface ConnectionEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: any;
  targetPosition: any;
  data?: WorkflowEdge['data'];
  style?: React.CSSProperties;
  markerEnd?: string;
  selected?: boolean;
}

// Helper function to get condition label
function getConditionLabel(condition: ConnectionCondition | undefined): string {
  if (!condition) return '';
  if (condition.onSuccess !== undefined) return 'On Success';
  if (condition.onFailure !== undefined) return 'On Failure';
  if (condition.always !== undefined) return 'Always';
  if (condition.ifContains) return `If Contains: ${condition.ifContains.field} = ${condition.ifContains.value}`;
  if (condition.ifEquals) return `If Equals: ${condition.ifEquals.field} = ${condition.ifEquals.value}`;
  return 'Always';
}

// Helper function to get condition color
function getConditionColor(condition: ConnectionCondition | undefined): string {
  if (!condition) return '#6b7280';
  if (condition.onSuccess !== undefined) return '#10B981'; // Green
  if (condition.onFailure !== undefined) return '#EF4444'; // Red
  if (condition.always !== undefined) return '#6b7280'; // Gray
  if (condition.ifContains || condition.ifEquals) return '#F59E0B'; // Yellow/Orange
  return '#6b7280';
}

export const ConnectionEdge: React.FC<ConnectionEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
  selected = false
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const condition = data?.condition;
  const conditionLabel = getConditionLabel(condition);
  const conditionColor = getConditionColor(condition);
  const isConditional = condition && !condition.always;

  const getEdgeStyle = () => {
    const baseStyle = {
      strokeWidth: selected ? 3 : 2,
      ...style,
    };

    if (isConditional) {
      return {
        ...baseStyle,
        stroke: conditionColor,
        strokeDasharray: condition.onSuccess || condition.onFailure ? '8,4' : '5,5',
      };
    }

    return {
      ...baseStyle,
      stroke: selected ? '#ff6b35' : '#6b7280',
    };
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={getEdgeStyle()}
      />
      
      {/* Condition label - Show for all conditions except "always" */}
      {isConditional && conditionLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              style={{
                background: conditionColor,
                color: '#ffffff',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                border: `1px solid ${conditionColor}`,
                whiteSpace: 'nowrap',
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={conditionLabel}
            >
              {conditionLabel}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Regular label (fallback) */}
      {data?.label && !isConditional && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div style={{
              background: 'rgba(17, 17, 17, 0.9)',
              color: '#9CA3AF',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '10px',
              border: '1px solid rgba(75, 85, 99, 0.5)',
            }}>
              {data.label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};