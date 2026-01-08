import React, { useEffect, useState } from 'react';
import { SubscriptionSelectionInterface } from './SubscriptionSelectionInterface';
import { useAppStore, useSubscription } from '../store/appStore';
import { SubscriptionTier, InitializationStageWithSubscription } from '../types';

export interface InitializationOverlayProps {
  isVisible: boolean;
  progress: { percent: number; message: string };
  onRetry?: () => void;
  onCancel?: () => void;
  showRetry?: boolean;
  canCancel?: boolean;
}

export const InitializationOverlay: React.FC<InitializationOverlayProps> = ({
  isVisible,
  progress,
  onRetry,
  onCancel,
  showRetry = false,
  canCancel = false
}) => {
  const [displayMessage, setDisplayMessage] = useState('');
  const [animationPhase, setAnimationPhase] = useState(0);
  
  // FIXED: Use correct subscription state and actions from AppStore
  const { 
    subscription,
    selectSubscriptionTier,
    hideSubscriptionSelection
  } = useSubscription();
  
  const { 
    stage, 
    ui 
  } = useAppStore(state => ({
    stage: state.stage,
    ui: state.ui
  }));

  // Smooth message transitions
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayMessage(progress.message);
    }, 150);
    return () => clearTimeout(timer);
  }, [progress.message]);

  // Logo pulse animation phases
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 3);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // FIXED: Handle subscription tier selection with proper method
  const handleTierSelection = async (tier: SubscriptionTier) => {
    try {
      console.log('🎯 [InitializationOverlay] User selected subscription tier:', tier);
      const success = await selectSubscriptionTier(tier);
      
      if (!success) {
        console.error('❌ [InitializationOverlay] Subscription tier selection failed');
      }
      // If successful, the user will be redirected to Stripe checkout for paid tiers
      // or continue with initialization for free tier
    } catch (error) {
      console.error('❌ [InitializationOverlay] Error selecting subscription tier:', error);
    }
  };

  const handleSkipSubscription = () => {
    console.log('⏭️ [InitializationOverlay] User chose to skip subscription');
    hideSubscriptionSelection();
    // This will trigger the free tier initialization flow
    // by hiding the subscription selection UI
  };

  // FIXED: Show subscription selection interface with correct conditions
  if (isVisible && ui.showSubscriptionSelection && stage === 'SELECTING_SUBSCRIPTION') {
    return (
      <SubscriptionSelectionInterface
        onTierSelected={handleTierSelection}
        onSkipForNow={handleSkipSubscription}
        isProcessing={subscription.isLoading}
      />
    );
  }

  // Show regular initialization overlay
  if (!isVisible) return null;

  // USER-FRIENDLY: Enhanced stage detection with non-technical, encouraging messages
  const getStageDisplay = (): { title: string; subtitle: string; color: string; icon: string } => {
    const stageTyped = stage as InitializationStageWithSubscription;
    
    switch (stageTyped) {
      case 'PROCESSING_PAYMENT_RETURN':
        return {
          title: 'Payment Processing',
          subtitle: 'Confirming your subscription...',
          color: '#10b981',
          icon: '💳'
        };
      case 'CREATING_CANISTER':
      case 'CREATING_WORKSPACE':
        return {
          title: 'Setting Up Your Workspace',
          subtitle: 'Getting your workspace ready...',
          color: '#8b5cf6',
          icon: '🏗️'
        };
      case 'DOWNLOADING_WASM':
        return {
          title: 'Downloading Tools',
          subtitle: 'Getting the latest development tools for you...',
          color: '#f59e0b',
          icon: '📥'
        };
      case 'UPLOADING_WASM':
      case 'WORKSPACE_DEPLOYMENT':
        return {
          title: 'Installing Your Tools',
          subtitle: 'Setting up everything you need...',
          color: '#f59e0b',
          icon: '⚙️'
        };
      case 'DEPLOYING_WASM':
        return {
          title: 'Making Everything Work',
          subtitle: 'Putting it all together...',
          color: '#f59e0b',
          icon: '🔧'
        };
      case 'FINALIZING_WASM':
        return {
          title: 'Finalizing Installation',
          subtitle: 'Adding the finishing touches...',
          color: '#f59e0b',
          icon: '✨'
        };
      case 'CONNECTING_WORKSPACE':
        return {
          title: 'Connecting Everything',
          subtitle: 'Linking everything together...',
          color: '#6366f1',
          icon: '🔗'
        };
      case 'ACCOUNT_INITIALIZATION':
        return {
          title: 'Creating Your Account',
          subtitle: 'Setting up your profile...',
          color: '#8b5cf6',
          icon: '👤'
        };
      case 'SYNCING_SUBSCRIPTION':
        return {
          title: 'Syncing Your Plan',
          subtitle: 'Checking your subscription...',
          color: '#6366f1',
          icon: '🔄'
        };
      case 'SELECTING_SUBSCRIPTION':
        return {
          title: 'Choose Your Plan',
          subtitle: 'Select the perfect plan for your development needs...',
          color: '#8b5cf6',
          icon: '💎'
        };
      case 'PROCESSING_SUBSCRIPTION':
      case 'WORKSPACE_SETUP':
        return {
          title: 'Setting Up Your Subscription',
          subtitle: 'Preparing your personalized development experience...',
          color: '#10b981',
          icon: '⚡'
        };
      case 'INSTALLING_ENVIRONMENT':
        return {
          title: 'Installing Your Tools',
          subtitle: 'Getting everything ready for you...',
          color: '#f59e0b',
          icon: '📦'
        };
      // USER-FRIENDLY: Translate technical zeroing stages to friendly account setup messages
      case 'ACCOUNT_PREPARATION':
        return {
          title: 'Preparing Your Account',
          subtitle: 'Making sure everything is set up perfectly for you...',
          color: '#8b5cf6',
          icon: '🎯'
        };
      case 'ACCOUNT_OPTIMIZATION':
        return {
          title: 'Optimizing Your Setup',
          subtitle: 'Fine-tuning your account for the best experience...',
          color: '#8b5cf6',
          icon: '⚡'
        };
      case 'ACCOUNT_VERIFICATION':
        return {
          title: 'Finalizing Your Account',
          subtitle: 'Ensuring everything is working perfectly...',
          color: '#10b981',
          icon: '🔍'
        };
      case 'ACCOUNT_READY':
        return {
          title: 'Account Ready!',
          subtitle: 'Your development environment is perfectly configured!',
          color: '#10b981',
          icon: '✅'
        };
      case 'ACCOUNT_PARTIAL':
        return {
          title: 'Nearly Complete',
          subtitle: 'Just a few more optimizations...',
          color: '#f59e0b',
          icon: '⚠️'
        };
      case 'ACCOUNT_SETUP_CONTINUING':
        return {
          title: 'Continuing Setup',
          subtitle: 'Working on your account configuration...',
          color: '#8b5cf6',
          icon: '🔄'
        };
      case 'BILLING_SETUP':
        return {
          title: 'Securing Your Billing',
          subtitle: 'Safely storing your payment information...',
          color: '#10b981',
          icon: '🔒'
        };
      case 'SUBSCRIPTION_ACTIVATION':
        return {
          title: 'Activating Your Subscription',
          subtitle: 'Unlocking all your premium features...',
          color: '#10b981',
          icon: '🚀'
        };
      case 'BACKEND_UPDATE':
        return {
          title: 'Updating Your Profile',
          subtitle: 'Saving your subscription preferences...',
          color: '#6366f1',
          icon: '📊'
        };
      case 'CANISTER_READY':
        return {
          title: 'Setting Up Your Credits',
          subtitle: 'Getting your credits ready...',
          color: '#10b981',
          icon: '💰'
        };
      case 'CREDIT_DELIVERY':
      case 'ALLOCATING_CREDITS':
        return {
          title: 'Delivering Your Credits',
          subtitle: 'Adding your subscription credits to your account...',
          color: '#10b981',
          icon: '🎁'
        };
      default:
        return {
          title: 'Welcome to Kontext',
          subtitle: displayMessage || 'Preparing your amazing development experience...',
          color: '#ff6b35',
          icon: 'K'
        };
    }
  };

  const stageDisplay = getStageDisplay();

  return (
    <>
      <style jsx>{`
        .initialization-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 10, 10, 0.95);
          backdrop-filter: blur(20px) saturate(180%);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .overlay-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          max-width: 500px;
          padding: 2rem;
          position: relative;
        }

        .logo-container {
          position: relative;
          margin-bottom: 2rem;
        }

        .kontext-logo {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, ${stageDisplay.color} 0%, ${stageDisplay.color}dd 50%, #10b981 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 2.2rem;
          color: #ffffff;
          position: relative;
          overflow: hidden;
          animation: logoPulse 2s ease-in-out infinite;
          box-shadow: 0 8px 32px ${stageDisplay.color}66,
                      0 0 0 0 ${stageDisplay.color}4d;
        }

        @keyframes logoPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 8px 32px ${stageDisplay.color}66,
                        0 0 0 0 ${stageDisplay.color}4d;
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 12px 40px ${stageDisplay.color}99,
                        0 0 0 8px ${stageDisplay.color}26;
          }
          100% {
            transform: scale(1);
            box-shadow: 0 8px 32px ${stageDisplay.color}66,
                        0 0 0 0 ${stageDisplay.color}4d;
          }
        }

        .logo-shine {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, 
            transparent, 
            rgba(255, 255, 255, 0.3), 
            transparent
          );
          animation: logoShine 3s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes logoShine {
          0% { transform: rotate(0deg) translate(-50%, -50%); }
          100% { transform: rotate(180deg) translate(-50%, -50%); }
        }

        .progress-section {
          width: 100%;
          margin-bottom: 2rem;
        }

        .progress-text {
          font-size: 1.2rem;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 0.5rem;
          min-height: 1.5rem;
          transition: opacity 0.3s ease;
        }

        .progress-subtext {
          font-size: 1rem;
          color: #9ca3af;
          margin-bottom: 1.5rem;
          min-height: 1.5rem;
          transition: all 0.3s ease;
          opacity: 0.8;
          line-height: 1.4;
        }

        .progress-bar-container {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
          position: relative;
          margin-bottom: 1rem;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, ${stageDisplay.color}, #10b981);
          border-radius: 4px;
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .progress-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, 
            transparent, 
            rgba(255, 255, 255, 0.4), 
            transparent
          );
          animation: shimmer 2.5s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        .progress-percentage {
          font-size: 0.9rem;
          color: ${stageDisplay.color};
          font-weight: 600;
          text-align: right;
        }

        .floating-dots {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          gap: 8px;
          z-index: -1;
        }

        .floating-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: ${stageDisplay.color}4d;
          animation: floatingDot 2s ease-in-out infinite;
        }

        .floating-dot:nth-child(1) { animation-delay: 0s; }
        .floating-dot:nth-child(2) { animation-delay: 0.5s; }
        .floating-dot:nth-child(3) { animation-delay: 1s; }

        @keyframes floatingDot {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-top: 1rem;
        }

        .action-button {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
          min-width: 100px;
        }

        .retry-button {
          background: linear-gradient(135deg, ${stageDisplay.color}, #10b981);
          color: #ffffff;
          box-shadow: 0 4px 15px ${stageDisplay.color}4d;
        }

        .retry-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px ${stageDisplay.color}66;
        }

        .cancel-button {
          background: rgba(255, 255, 255, 0.1);
          color: #9ca3af;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .cancel-button:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .error-state {
          color: #ef4444;
        }

        .error-state .progress-bar {
          background: #ef4444;
        }

        .error-state .kontext-logo {
          animation: logoError 2s ease-in-out infinite;
        }

        @keyframes logoError {
          0%, 100% { 
            box-shadow: 0 8px 32px rgba(239, 68, 68, 0.4),
                        0 0 0 0 rgba(239, 68, 68, 0.3);
          }
          50% { 
            box-shadow: 0 12px 40px rgba(239, 68, 68, 0.6),
                        0 0 0 4px rgba(239, 68, 68, 0.15);
          }
        }

        .payment-processing .kontext-logo {
          animation: logoPaymentProcessing 3s ease-in-out infinite;
        }

        @keyframes logoPaymentProcessing {
          0%, 100% { 
            box-shadow: 0 8px 32px rgba(16, 185, 129, 0.4),
                        0 0 0 0 rgba(16, 185, 129, 0.3);
          }
          50% { 
            box-shadow: 0 12px 40px rgba(16, 185, 129, 0.6),
                        0 0 0 8px rgba(16, 185, 129, 0.15);
          }
        }

        .workspace-creation .kontext-logo {
          animation: logoWorkspaceCreation 2.5s ease-in-out infinite;
        }

        @keyframes logoWorkspaceCreation {
          0%, 100% { 
            box-shadow: 0 8px 32px rgba(139, 92, 246, 0.4),
                        0 0 0 0 rgba(139, 92, 246, 0.3);
          }
          50% { 
            box-shadow: 0 12px 40px rgba(139, 92, 246, 0.6),
                        0 0 0 6px rgba(139, 92, 246, 0.15);
          }
        }

        .environment-setup .kontext-logo {
          animation: logoEnvironmentSetup 2s ease-in-out infinite;
        }

        @keyframes logoEnvironmentSetup {
          0%, 100% { 
            box-shadow: 0 8px 32px rgba(245, 158, 11, 0.4),
                        0 0 0 0 rgba(245, 158, 11, 0.3);
          }
          50% { 
            box-shadow: 0 12px 40px rgba(245, 158, 11, 0.6),
                        0 0 0 8px rgba(245, 158, 11, 0.15);
          }
        }

        .account-setup .kontext-logo {
          animation: logoAccountSetup 2s ease-in-out infinite;
        }

        @keyframes logoAccountSetup {
          0%, 100% { 
            box-shadow: 0 8px 32px rgba(139, 92, 246, 0.4),
                        0 0 0 0 rgba(139, 92, 246, 0.3);
          }
          50% { 
            box-shadow: 0 12px 40px rgba(139, 92, 246, 0.6),
                        0 0 0 8px rgba(139, 92, 246, 0.15);
          }
        }

        .credits-setup .kontext-logo {
          animation: logoCreditsSetup 2s ease-in-out infinite;
        }

        @keyframes logoCreditsSetup {
          0%, 100% { 
            box-shadow: 0 8px 32px rgba(16, 185, 129, 0.4),
                        0 0 0 0 rgba(16, 185, 129, 0.3);
          }
          50% { 
            box-shadow: 0 12px 40px rgba(16, 185, 129, 0.6),
                        0 0 0 8px rgba(16, 185, 129, 0.15);
          }
        }

        @media (max-width: 768px) {
          .overlay-content {
            padding: 1.5rem;
            max-width: 90%;
          }

          .kontext-logo {
            width: 70px;
            height: 70px;
            font-size: 2rem;
          }

          .progress-text {
            font-size: 1.1rem;
          }

          .progress-subtext {
            font-size: 0.9rem;
          }

          .action-buttons {
            flex-direction: column;
            width: 100%;
          }

          .action-button {
            width: 100%;
          }
        }
      `}</style>

      <div className="initialization-overlay">
        <div className="overlay-content">
          <div className="floating-dots">
            <div className="floating-dot"></div>
            <div className="floating-dot"></div>
            <div className="floating-dot"></div>
          </div>

          <div className="logo-container">
            <div className={`kontext-logo ${
              progress.percent === 0 && progress.message.includes('failed') ? 'error-state' : 
              stage === 'PROCESSING_PAYMENT_RETURN' || stage === 'PROCESSING_SUBSCRIPTION' ? 'payment-processing' :
              stage === 'CREATING_CANISTER' || stage === 'CREATING_WORKSPACE' ? 'workspace-creation' :
              stage === 'DOWNLOADING_WASM' || stage === 'UPLOADING_WASM' || stage === 'DEPLOYING_WASM' || stage === 'FINALIZING_WASM' || stage === 'INSTALLING_ENVIRONMENT' || stage === 'WORKSPACE_DEPLOYMENT' ? 'environment-setup' :
              stage === 'ACCOUNT_INITIALIZATION' || stage === 'ACCOUNT_PREPARATION' || stage === 'ACCOUNT_OPTIMIZATION' || stage === 'ACCOUNT_VERIFICATION' || stage === 'ACCOUNT_SETUP_CONTINUING' ? 'account-setup' :
              stage === 'CANISTER_READY' || stage === 'ALLOCATING_CREDITS' || stage === 'CREDIT_DELIVERY' ? 'credits-setup' :
              ''
            }`}>
              <div className="logo-shine"></div>
              {stageDisplay.icon}
            </div>
          </div>

          <div className="progress-section">
            <div className="progress-text">
              {stageDisplay.title}
            </div>
            
            <div 
              className={`progress-subtext ${progress.percent === 0 && progress.message.includes('failed') ? 'error-state' : ''}`}
              style={{ 
                opacity: displayMessage ? 1 : 0,
                transform: displayMessage ? 'translateY(0)' : 'translateY(10px)'
              }}
            >
              {stageDisplay.subtitle}
            </div>

            <div className="progress-bar-container">
              <div 
                className={`progress-bar ${progress.percent === 0 && progress.message.includes('failed') ? 'error-state' : ''}`}
                style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
              />
            </div>

            <div className="progress-percentage">
              {Math.round(progress.percent)}%
            </div>
          </div>

          {/* USER-FRIENDLY: Success message with encouraging tone */}
          {stage === 'READY' && (
            <div className="success-message" style={{ 
              color: '#10b981', 
              fontSize: '0.9rem', 
              marginTop: '1rem',
              textAlign: 'center'
            }}>
              🎉 Welcome to Kontext!<br />
              <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>
                Your development environment is ready and your credits are available!
              </span>
            </div>
          )}

          {(showRetry || canCancel) && (
            <div className="action-buttons">
              {showRetry && onRetry && (
                <button 
                  className="action-button retry-button"
                  onClick={onRetry}
                >
                  Try Again
                </button>
              )}
              {canCancel && onCancel && (
                <button 
                  className="action-button cancel-button"
                  onClick={onCancel}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};