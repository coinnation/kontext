import React from 'react';
import { createPortal } from 'react-dom';

export interface AgentOperationProgress {
  phase: string;
  message: string;
  timeMs?: number;
  percentage?: number;
}

interface AgentOperationProgressOverlayProps {
  progress: AgentOperationProgress | null;
  title?: string;
  icon?: string;
  color?: string;
}

export const AgentOperationProgressOverlay: React.FC<AgentOperationProgressOverlayProps> = ({
  progress,
  title = 'Processing Agent Operation',
  icon = '🤖',
  color = '#8b5cf6'
}) => {
  if (!progress) return null;

  // Render using portal to ensure it's above all other elements
  const overlayContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.95)',
      backdropFilter: 'blur(12px)',
      zIndex: 100002,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
        border: `2px solid ${color}`,
        borderRadius: '20px',
        padding: '3rem',
        textAlign: 'center',
        maxWidth: '500px',
        width: '90%',
        boxShadow: `0 25px 70px ${color}40, 0 0 0 1px rgba(255, 255, 255, 0.1)`
      }}>
        {/* Progress Animation */}
        <div style={{
          position: 'relative',
          width: '120px',
          height: '120px',
          margin: '0 auto 2rem',
          background: `conic-gradient(${color} 0deg, ${color} 180deg, rgba(255, 255, 255, 0.1) 180deg)`,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'spin 2s linear infinite'
        }}>
          <div style={{
            width: '90px',
            height: '90px',
            background: 'var(--primary-black)',
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: color
          }}>
            {icon}
          </div>
        </div>
        
        <h3 style={{
          fontSize: '1.4rem',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: '0.5rem',
          lineHeight: 1.2
        }}>
          {title}
        </h3>
        
        <p style={{
          color: 'var(--text-gray)',
          fontSize: '0.95rem',
          lineHeight: 1.5,
          marginBottom: '2rem',
          minHeight: '3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <span>🔄 Phase: {progress.phase}</span>
          <span>{progress.message}</span>
          {progress.timeMs !== undefined && progress.timeMs > 0 && (
            <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>
              ({progress.timeMs}ms)
            </span>
          )}
        </p>

        {/* Progress bar if percentage is provided */}
        {progress.percentage !== undefined && (
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: `${progress.percentage}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${color}, ${color}80)`,
              transition: 'width 0.3s ease',
              borderRadius: '4px'
            }} />
          </div>
        )}

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: `${color}20`,
          border: `1px solid ${color}50`,
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: 'var(--text-gray)'
        }}>
          <div style={{ 
            fontWeight: 600, 
            color: color, 
            marginBottom: '0.5rem'
          }}>
            🌐 Metadata-Based System
          </div>
          <div>Using ultra-parallel operations for maximum speed and reliability</div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  // Render using portal to ensure proper stacking
  if (typeof document === 'undefined') {
    return null; // SSR safety
  }

  let portalRoot = document.getElementById('agent-operation-progress-root');
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.id = 'agent-operation-progress-root';
    portalRoot.style.position = 'fixed';
    portalRoot.style.top = '0';
    portalRoot.style.left = '0';
    portalRoot.style.width = '100%';
    portalRoot.style.height = '100%';
    portalRoot.style.pointerEvents = 'none';
    portalRoot.style.zIndex = '100002';
    document.body.appendChild(portalRoot);
  }

  return createPortal(overlayContent, portalRoot);
};

