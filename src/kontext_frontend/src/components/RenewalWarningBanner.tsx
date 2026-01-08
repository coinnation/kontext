import React from 'react';
import { useSubscription } from '../store/appStore';

export const RenewalWarningBanner: React.FC = () => {
  const {
    subscription,
    getRenewalStatus,
    getDaysUntilExpiration,
    dismissRenewalWarning,
    handleSubscriptionRenewal
  } = useSubscription();

  const renewalStatus = getRenewalStatus();
  const daysUntilExpiration = getDaysUntilExpiration();

  // Don't show banner if user dismissed it or subscription is active
  if (renewalStatus === 'ACTIVE' || subscription.renewalWarningDismissed) {
    return null;
  }

  const handleManageSubscription = async () => {
    await handleSubscriptionRenewal();
  };

  const handleDismiss = () => {
    dismissRenewalWarning();
  };

  const getWarningContent = () => {
    if (renewalStatus === 'EXPIRED') {
      return {
        icon: '⚠️',
        title: 'Subscription Expired',
        message: 'Your subscription has expired. Renew now to continue using premium features.',
        urgency: 'high',
        actionText: 'Renew Now'
      };
    } else if (renewalStatus === 'WARNING') {
      const dayText = daysUntilExpiration === 1 ? 'day' : 'days';
      return {
        icon: '📅',
        title: `${daysUntilExpiration} ${dayText} remaining`,
        message: `Your subscription expires in ${daysUntilExpiration} ${dayText}. Manage your subscription to avoid interruption.`,
        urgency: daysUntilExpiration && daysUntilExpiration <= 3 ? 'high' : 'medium',
        actionText: 'Manage Subscription'
      };
    }
    return null;
  };

  const warningContent = getWarningContent();
  if (!warningContent) return null;

  return (
    <>
      <style jsx>{`
        .renewal-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          background: linear-gradient(135deg, 
            ${warningContent.urgency === 'high' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.95)'}, 
            ${warningContent.urgency === 'high' ? 'rgba(220, 38, 38, 0.95)' : 'rgba(217, 119, 6, 0.95)'}
          );
          backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid ${warningContent.urgency === 'high' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'};
          box-shadow: 0 4px 20px ${warningContent.urgency === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'};
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .banner-content {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          gap: 1rem;
        }

        .banner-left {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
        }

        .banner-icon {
          font-size: 1.5rem;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .banner-text {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .banner-title {
          font-size: 1rem;
          font-weight: 600;
          color: #ffffff;
          margin: 0;
        }

        .banner-message {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
        }

        .banner-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .banner-button {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .banner-button:hover {
          background: rgba(255, 255, 255, 0.25);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .banner-button.primary {
          background: rgba(255, 255, 255, 0.9);
          color: ${warningContent.urgency === 'high' ? '#dc2626' : '#d97706'};
          border-color: transparent;
        }

        .banner-button.primary:hover {
          background: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .dismiss-button {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .dismiss-button:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }

        @media (max-width: 768px) {
          .banner-content {
            padding: 1rem;
            flex-direction: column;
            gap: 1rem;
          }

          .banner-left {
            justify-content: center;
            text-align: center;
          }

          .banner-actions {
            justify-content: center;
            width: 100%;
          }

          .banner-button {
            flex: 1;
            justify-content: center;
            max-width: 200px;
          }

          .banner-text {
            align-items: center;
          }
        }
      `}</style>

      <div className="renewal-banner">
        <div className="banner-content">
          <div className="banner-left">
            <div className="banner-icon">{warningContent.icon}</div>
            <div className="banner-text">
              <h3 className="banner-title">{warningContent.title}</h3>
              <p className="banner-message">{warningContent.message}</p>
            </div>
          </div>

          <div className="banner-actions">
            <button 
              className="banner-button primary"
              onClick={handleManageSubscription}
            >
              {warningContent.actionText}
            </button>
            
            {renewalStatus === 'WARNING' && (
              <button 
                className="dismiss-button"
                onClick={handleDismiss}
                title="Dismiss until next session"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};