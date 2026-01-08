import React, { useState, useEffect } from 'react';
import { SubscriptionTier, SubscriptionPlan } from '../types';
import { stripeService } from '../services/StripeServiceFactory';
import { useAppStore } from '../store/appStore';
import { subscriptionService } from '../services/SubscriptionService';

// Add logo shine animation
const logoShineStyle = `
  @keyframes logoShine {
    0% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
    100% {
      transform: translateX(100%) translateY(100%) rotate(45deg);
    }
  }
`;

interface SubscriptionSelectionInterfaceProps {
  onTierSelected: (tier: SubscriptionTier) => Promise<void>;
  onSkipForNow?: () => void;
  onClose?: () => void;
  isProcessing?: boolean;
  allowClose?: boolean;
}

export function SubscriptionSelectionInterface({ 
  onTierSelected, 
  onSkipForNow, 
  onClose,
  isProcessing = false,
  allowClose = true
}: SubscriptionSelectionInterfaceProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredTier, setHoveredTier] = useState<SubscriptionTier | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Load plans from backend dynamically
  useEffect(() => {
    const loadPlans = async () => {
      try {
        setPlansLoading(true);
        const plans = await subscriptionService.getSubscriptionPlans();
        setSubscriptionPlans(plans);
      } catch (error) {
        console.error('❌ Failed to load subscription plans:', error);
        setError('Failed to load subscription plans. Please try again.');
      } finally {
        setPlansLoading(false);
      }
    };

    loadPlans();
  }, []);

  const handleTierSelection = async (tier: SubscriptionTier) => {
    try {
      setError(null);
      setSelectedTier(tier);
      setIsLoading(true);
      
      await onTierSelected(tier);
      
      // Keep loading state active - don't reset it here
      // It will be reset when the subscription process completes (redirect to Stripe)
      // or if there's an error
    } catch (error) {
      console.error('Error selecting subscription tier:', error);
      setError(error instanceof Error ? error.message : 'Failed to process subscription');
      setSelectedTier(null);
      setIsLoading(false);
    }
    // Note: We don't reset isLoading in finally because:
    // 1. If login is required, we want to keep loading while auth happens
    // 2. If Stripe redirect happens, the component unmounts anyway
    // 3. Only reset on explicit error
  };

  const handleClose = () => {
    if (onClose && allowClose && !isLoading && !selectedTier) {
      onClose();
    }
  };

  const formatCredits = (credits: number): string => {
    if (credits < 1000) return credits.toString();
    if (credits < 1000000) return `${(credits / 1000).toFixed(0)}K`;
    return `${(credits / 1000000).toFixed(1)}M`;
  };

  // Enhanced processing overlay with better UX
  if (isProcessing || isLoading || plansLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--kontext-primary-black)' }}>
        <div className="text-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-4 rounded-full animate-spin mx-auto" style={{ 
              borderColor: 'rgba(255, 107, 53, 0.3)',
              borderTopColor: 'var(--kontext-orange)'
            }}></div>
            <div className="absolute inset-0 w-24 h-24 border-4 border-transparent rounded-full animate-ping mx-auto opacity-20" style={{
              borderTopColor: 'var(--kontext-orange)'
            }}></div>
            <div className="absolute inset-4 w-16 h-16 rounded-full flex items-center justify-center" style={{
              background: 'var(--kontext-gradient-button)'
            }}>
              <span className="text-2xl">🎉</span>
            </div>
          </div>
          <h3 className="text-3xl font-bold mb-4" style={{ color: 'var(--kontext-text-primary)' }}>Setting up your workspace...</h3>
          <div className="rounded-lg p-4 mb-4 max-w-md mx-auto" style={{
            background: 'var(--kontext-glass-bg-medium)',
            border: '1px solid var(--kontext-border-primary)'
          }}>
            <p className="text-lg font-semibold mb-2" style={{ color: 'var(--kontext-orange)' }}>What's happening:</p>
            <ul className="text-sm space-y-2 text-left" style={{ color: 'var(--kontext-text-secondary)' }}>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--kontext-orange)' }}></span>
                Creating your development environment
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ 
                  background: 'var(--kontext-green)',
                  animationDelay: '0.5s'
                }}></span>
                Installing AI development tools
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ 
                  background: 'var(--kontext-orange)',
                  animationDelay: '1s'
                }}></span>
                Configuring your subscription
              </li>
            </ul>
          </div>
          <p className="text-lg" style={{ color: 'var(--kontext-text-tertiary)' }}>Get ready to build something amazing!</p>
        </div>
      </div>
    );
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <>
      <style>{logoShineStyle}</style>
      <div className="flex flex-col h-screen text-white relative overflow-hidden" style={{ background: 'var(--kontext-primary-black)' }}>
      {/* Header - Matching Admin/Profile Interface */}
      <div style={{
        background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.15) 0%, transparent 50%), linear-gradient(135deg, rgb(17, 17, 17) 0%, #1a1a1a 50%, rgb(17, 17, 17) 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '1rem' : '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexShrink: 0,
        minHeight: '70px'
      }}>
        {/* Logo and Title - Far Left */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flex: '0 0 auto'
        }}>
          <img
            src="https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/KCP_LOGO.png"
            alt="Kontext Logo"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px'
            }}
          />
          <h1 style={{
            margin: 0,
            fontSize: isMobile ? '1.25rem' : '1.5rem',
            fontWeight: 700,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>Kontext</span>
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.6)',
              marginLeft: '0.5rem'
            }}>Subscription Selection</span>
          </h1>
        </div>

        {/* Right Side - Close Button */}
        {allowClose && onClose && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flex: '0 0 auto'
          }}>
            <button
              onClick={handleClose}
              disabled={isLoading || selectedTier !== null}
              style={{
                padding: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                cursor: (isLoading || selectedTier) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                opacity: (isLoading || selectedTier) ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLoading && !selectedTier) {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.currentTarget.style.borderColor = '#ef4444';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-pulse" style={{ background: 'rgba(255, 107, 53, 0.2)' }}></div>
        <div className="absolute top-1/3 -left-40 w-60 h-60 rounded-full blur-3xl animate-pulse" style={{ 
          background: 'rgba(16, 185, 129, 0.2)',
          animationDelay: '1s'
        }}></div>
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ 
          background: 'rgba(255, 107, 53, 0.2)',
          animationDelay: '2s'
        }}></div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--kontext-primary-black)' }}>

        {/* Error Message */}
        {error && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem 2rem' }}>
            <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-xl p-4 text-red-400 text-sm lg:text-base">
              ❌ {error}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
          <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
            background: 'linear-gradient(135deg, #f97316, #fbbf24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Choose Your Plan
          </h2>

          {/* Available Plans */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            {subscriptionPlans.map((plan) => {
              return (
                <div
                  key={plan.tier}
                  className={`
                    bg-gray-800 bg-opacity-50 border rounded-xl p-6 lg:p-8
                    ${plan.isPopular ? 'border-orange-500 border-opacity-50 ring-2 ring-gray-600 ring-opacity-50' : 'border-gray-600 border-opacity-50'}
                  `}
                >
                  {plan.isPopular && (
                    <div className="text-xs font-semibold px-3 py-1 rounded-full inline-block mb-3" style={{ background: 'rgba(255, 107, 53, 0.2)', color: 'var(--kontext-orange)' }}>
                      Most Popular
                    </div>
                  )}
                  
                  {plan.badge && (
                    <div className="bg-green-500 bg-opacity-20 text-green-400 text-xs font-semibold px-3 py-1 rounded-full inline-block mb-3">
                      {plan.badge}
                    </div>
                  )}
                  
                  <h4 className="text-xl lg:text-2xl font-bold text-white mb-2">{plan.name}</h4>
                  {plan.description && (
                    <p className="text-sm lg:text-base text-gray-400 mb-3">{plan.description}</p>
                  )}
                  
                  {/* Pricing */}
                  <div className="mb-4">
                    {plan.originalPrice && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base lg:text-lg text-gray-500 line-through">${plan.originalPrice}</span>
                        {plan.savings && (
                          <span className="bg-green-500 bg-opacity-20 text-green-400 text-xs font-semibold px-2 py-1 rounded">
                            {plan.savings}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl lg:text-4xl font-bold text-white">${plan.monthlyPrice}</span>
                      <span className="text-base lg:text-lg text-gray-400">/month</span>
                    </div>
                  </div>
                  
                  <div className="text-sm lg:text-base text-gray-300 mb-4">
                    {plan.monthlyCredits.toLocaleString()} credits/month
                  </div>

                  <ul className="text-xs lg:text-sm text-gray-400 mb-6 space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-400 mt-1">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleTierSelection(plan.tier)}
                    disabled={selectedTier !== null && selectedTier !== plan.tier}
                    className="w-full px-4 py-3 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: selectedTier === plan.tier
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'var(--kontext-gradient-button)',
                      color: 'var(--kontext-text-primary)',
                      boxShadow: 'var(--kontext-shadow-primary)',
                      opacity: (selectedTier !== null && selectedTier !== plan.tier) ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedTier || selectedTier === plan.tier) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = 'var(--kontext-shadow-interactive)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--kontext-shadow-primary)';
                    }}
                  >
                    {selectedTier === plan.tier ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </span>
                    ) : (
                      plan.buttonText || 'Subscribe'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Free Option */}
        {onSkipForNow && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
            <div className="rounded-xl p-6 lg:p-8 text-center" style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)'
            }}>
              <h3 className="text-lg lg:text-xl font-semibold mb-4 text-white">Not ready to subscribe?</h3>
              <p className="text-sm lg:text-base text-gray-400 mb-6">
                Start with our free tier: 1K AI credits, 500 hosting credits, 1 project, basic IDE
              </p>
              <button
                onClick={onSkipForNow}
                disabled={selectedTier !== null}
                className="px-6 py-3 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--kontext-glass-bg-medium)',
                  border: '1px solid var(--kontext-border-primary)',
                  color: 'var(--kontext-text-primary)'
                }}
                onMouseEnter={(e) => {
                  if (!selectedTier) {
                    e.currentTarget.style.background = 'var(--kontext-glass-bg-strong)';
                    e.currentTarget.style.borderColor = 'var(--kontext-border-accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--kontext-glass-bg-medium)';
                  e.currentTarget.style.borderColor = 'var(--kontext-border-primary)';
                }}
              >
                Continue with Free Tier
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
