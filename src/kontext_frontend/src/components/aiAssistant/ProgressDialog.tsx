/**
 * Beautiful progress dialog for AI generation and entity creation
 * Enhanced to match AgentOperationProgressOverlay styling
 */

import React from 'react';
import { createPortal } from 'react-dom';

interface ProgressDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  progress?: number; // 0-100
  phase?: 'generating' | 'creating' | 'deploying' | 'success' | 'error';
  error?: string;
  onClose?: () => void;
}

export const ProgressDialog: React.FC<ProgressDialogProps> = ({
  isOpen,
  title,
  message,
  progress,
  phase = 'generating',
  error,
  onClose
}) => {
  if (!isOpen) return null;

  const getPhaseIcon = () => {
    switch (phase) {
      case 'generating':
        return '✨';
      case 'creating':
        return '🚀';
      case 'deploying':
        return '🤖';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'generating':
        return '#3B82F6'; // Blue for generation
      case 'creating':
        return '#8B5CF6'; // Purple for creation
      case 'deploying':
        return '#10B981'; // Green for deployment
      case 'success':
        return '#10B981'; // Green for success
      case 'error':
        return '#EF4444'; // Red for error
      default:
        return '#6B7280'; // Gray default
    }
  };

  const color = getPhaseColor();
  const showProgress = progress !== undefined && phase !== 'success' && phase !== 'error';

  const dialogContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100002,
        padding: '1rem',
        animation: 'fadeIn 0.3s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && (phase === 'success' || phase === 'error')) {
          onClose?.();
        }
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, var(--secondary-black), var(--primary-black))',
          border: `2px solid ${color}`,
          borderRadius: '20px',
          padding: '3rem',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          boxShadow: `0 25px 70px ${color}40, 0 0 0 1px rgba(255, 255, 255, 0.1)`,
          animation: 'slideUp 0.3s ease-out',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Animation - Spinning Circular Indicator */}
        <div style={{
          position: 'relative',
          width: '120px',
          height: '120px',
          margin: '0 auto 2rem',
          background: `conic-gradient(${color} 0deg, ${color} ${phase === 'success' ? 360 : (showProgress && progress !== undefined ? progress * 3.6 : 180)}deg, rgba(255, 255, 255, 0.1) ${phase === 'success' ? 360 : (showProgress && progress !== undefined ? progress * 3.6 : 180)}deg)`,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: (phase === 'generating' || phase === 'creating') ? 'spin 2s linear infinite' : 'none'
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
            {getPhaseIcon()}
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
          <span>{message}</span>
          {error && (
            <span style={{ 
              fontSize: '0.85rem', 
              color: '#EF4444',
              marginTop: '0.5rem'
            }}>
              {error}
            </span>
          )}
        </p>

        {/* Progress bar if percentage is provided */}
        {showProgress && progress !== undefined && (
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${color}, ${color}80)`,
              transition: 'width 0.3s ease',
              borderRadius: '4px'
            }} />
          </div>
        )}

        {/* Progress percentage display */}
        {showProgress && progress !== undefined && (
          <p style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#ffffff',
            marginBottom: '1.5rem'
          }}>
            {progress}%
          </p>
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
            {phase === 'generating' && '✨ AI Generation System'}
            {phase === 'creating' && '🚀 Entity Creation System'}
            {phase === 'deploying' && '🤖 Agent Deployment System'}
            {phase === 'success' && '✅ Operation Complete'}
            {phase === 'error' && '❌ Operation Failed'}
          </div>
          <div>
            {phase === 'generating' && 'Using advanced AI to analyze requirements and generate specifications'}
            {phase === 'creating' && 'Deploying and configuring your entity with maximum efficiency'}
            {phase === 'deploying' && 'Deploying and initializing your agent with full configuration'}
            {phase === 'success' && 'Your entity has been successfully created and is ready to use'}
            {phase === 'error' && 'An error occurred during the operation. Please try again.'}
          </div>
        </div>

        {/* Close Button (only for success/error) */}
        {(phase === 'success' || phase === 'error') && (
          <button
            onClick={onClose}
            style={{
              marginTop: '1.5rem',
              width: '100%',
              padding: '0.75rem 1.5rem',
              background: `linear-gradient(135deg, ${color}, ${color}80)`,
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: `0 4px 15px ${color}40`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 6px 20px ${color}60`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = `0 4px 15px ${color}40`;
            }}
          >
            {phase === 'success' ? 'Continue' : 'Close'}
          </button>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(20px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
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

  let portalRoot = document.getElementById('ai-progress-dialog-root');
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.id = 'ai-progress-dialog-root';
    portalRoot.style.position = 'fixed';
    portalRoot.style.top = '0';
    portalRoot.style.left = '0';
    portalRoot.style.width = '100%';
    portalRoot.style.height = '100%';
    portalRoot.style.pointerEvents = 'none';
    portalRoot.style.zIndex = '100002';
    document.body.appendChild(portalRoot);
  }

  return createPortal(dialogContent, portalRoot);
};

