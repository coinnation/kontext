import React, { useState } from 'react';
import { DeploymentButtonState, DeploymentContext } from '../types/deploymentCoordination';

interface DeploymentButtonProps {
  deploymentContext: DeploymentContext;
  buttonState: DeploymentButtonState;
  onDeploy: (context: DeploymentContext) => void;
  onViewApp: (url: string) => void;
  isMobile?: boolean;
}

export const DeploymentButton: React.FC<DeploymentButtonProps> = ({
  deploymentContext,
  buttonState,
  onDeploy,
  onViewApp,
  isMobile = false
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (buttonState.status === 'ready' || buttonState.status === 'error') {
      onDeploy(deploymentContext);
    } else if (buttonState.status === 'success' && buttonState.deployedUrl) {
      onViewApp(buttonState.deployedUrl);
    }
  };

  const getButtonContent = () => {
    switch (buttonState.status) {
      case 'ready':
        return '🚀 Deploy App';
      case 'deploying':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderTop: '2px solid #ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Deploying... {buttonState.progress ? `${buttonState.progress}%` : ''}
          </div>
        );
      case 'success':
        return '✅ View Live App';
      case 'error':
        return '❌ Deploy Failed - Retry';
      default:
        return '🚀 Deploy App';
    }
  };

  const getButtonStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: isMobile ? '0.75rem 1rem' : '0.625rem 1.25rem',
      borderRadius: '8px',
      border: 'none',
      fontSize: isMobile ? '0.9rem' : '0.85rem',
      fontWeight: '600',
      cursor: buttonState.status === 'deploying' ? 'not-allowed' : 'pointer',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      minHeight: '44px',
      minWidth: isMobile ? '140px' : '120px',
      opacity: buttonState.status === 'deploying' ? 0.8 : 1,
      transform: isHovered && buttonState.status !== 'deploying' ? 'translateY(-1px)' : 'translateY(0)',
      boxShadow: buttonState.status === 'deploying' ? 'none' : undefined
    };

    switch (buttonState.status) {
      case 'ready':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, var(--accent-orange), #f59e0b)',
          color: '#ffffff',
          boxShadow: isHovered ? '0 6px 20px rgba(255, 107, 53, 0.4)' : '0 3px 12px rgba(255, 107, 53, 0.3)'
        };
      case 'deploying':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#ffffff',
          cursor: 'not-allowed'
        };
      case 'success':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, var(--accent-green), #059669)',
          color: '#ffffff',
          boxShadow: isHovered ? '0 6px 20px rgba(16, 185, 129, 0.4)' : '0 3px 12px rgba(16, 185, 129, 0.3)'
        };
      case 'error':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: '#ffffff',
          boxShadow: isHovered ? '0 6px 20px rgba(239, 68, 68, 0.4)' : '0 3px 12px rgba(239, 68, 68, 0.3)'
        };
      default:
        return baseStyle;
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={buttonState.status === 'deploying'}
        style={getButtonStyle()}
        title={
          buttonState.status === 'error' && buttonState.error 
            ? `Error: ${buttonState.error}` 
            : undefined
        }
      >
        {getButtonContent()}
      </button>

      {/* Deployment Status Details */}
      {buttonState.status === 'success' && buttonState.duration && (
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--accent-green)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          ⚡ Deployed in {(buttonState.duration / 1000).toFixed(1)}s
        </div>
      )}

      {buttonState.status === 'error' && buttonState.error && (
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: '#ef4444',
          lineHeight: 1.3,
          maxWidth: '300px'
        }}>
          {buttonState.error.length > 100 
            ? `${buttonState.error.substring(0, 100)}...` 
            : buttonState.error}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};