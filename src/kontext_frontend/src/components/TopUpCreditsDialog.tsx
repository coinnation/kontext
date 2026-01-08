import React, { useState, useEffect, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useCanister } from '../useCanister';
import { useAppStore } from '../store/appStore';
import { CreditsService } from '../services/CreditsService';
import { stripeService } from '../services/StripeServiceFactory';
// 🔥 CRITICAL: Don't import loadStripe at top level - it will be dynamically imported when needed

// 🔥 FIX: Lazy load Stripe Elements to prevent initialization errors
// Defer lazy creation until first access to avoid initialization order issues
// Use 'any' type instead of React.LazyExoticComponent to prevent "Cannot access before initialization" errors
let _StripeElementsWrapper: any = null;
const getStripeElementsWrapper = () => {
  if (!_StripeElementsWrapper) {
    _StripeElementsWrapper = React.lazy(() => 
      import('@stripe/react-stripe-js').then(module => ({
        default: ({ children, stripe }: { children: React.ReactNode; stripe: any }) => {
          const { Elements } = module;
          return <Elements stripe={stripe}>{children}</Elements>;
        }
      }))
    );
  }
  return _StripeElementsWrapper;
};

let _PaymentFormWrapper: any = null;
const getPaymentFormWrapper = () => {
  if (!_PaymentFormWrapper) {
    _PaymentFormWrapper = React.lazy(() => 
      import('@stripe/react-stripe-js').then(async (stripeModule) => {
        const { CardElement, useStripe, useElements } = stripeModule;
    
    return {
      default: function PaymentForm({ 
        amount, 
        onPaymentSuccess, 
        onPaymentError,
        isProcessing,
        setIsProcessing,
        identity,
        estimatedCredits,
        estimatedUnits,
        xdrRate
      }: {
        amount: number;
        onPaymentSuccess: (paymentIntentId: string, unitsAdded: number) => void;
        onPaymentError: (error: string) => void;
        isProcessing: boolean;
        setIsProcessing: (processing: boolean) => void;
        identity: any;
        estimatedCredits: number;
        estimatedUnits: number;
        xdrRate: number;
      }) {
        const stripe = useStripe();
        const elements = useElements();
        const userCanisterId = useAppStore(state => state.userCanisterId);
        const principal = useAppStore(state => state.principal);

        const handleSubmit = async (event: React.FormEvent) => {
          event.preventDefault();

          if (!stripe || !elements || !userCanisterId || !principal) {
            onPaymentError('Payment system not ready');
            return;
          }

          const card = elements.getElement(CardElement);
          if (!card) {
            onPaymentError('Card element not found');
            return;
          }

          setIsProcessing(true);

          try {
            console.log('💳 [PaymentForm] Starting units-based payment process');

            const result = await stripeService.processPaymentWithElements(
              amount,
              elements,
              userCanisterId,
              principal.toString(),
              identity
            );

            if (result.success && result.paymentIntentId) {
              console.log('✅ [PaymentForm] Units-based payment successful:', result.paymentIntentId);
              onPaymentSuccess(result.paymentIntentId, result.unitsAdded || estimatedUnits);
            } else {
              console.error('❌ [PaymentForm] Units-based payment failed:', result.error);
              onPaymentError(result.error || 'Payment failed');
            }
          } catch (error) {
            console.error('❌ [PaymentForm] Payment processing error:', error);
            onPaymentError(error instanceof Error ? error.message : 'Payment failed');
          } finally {
            setIsProcessing(false);
          }
        };

        return (
          <form onSubmit={handleSubmit} className="w-full">
            <div className="bg-gray-800 bg-opacity-50 border border-gray-600 border-opacity-50 p-4 rounded-lg mb-4">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#ffffff',
                      backgroundColor: 'transparent',
                      '::placeholder': {
                        color: '#9ca3af',
                      },
                    },
                    invalid: {
                      color: '#ef4444',
                    },
                  },
                  hidePostalCode: false,
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={!stripe || isProcessing || !userCanisterId || !principal}
              className="w-full px-6 py-4 rounded-xl font-bold text-base md:text-lg transition-all duration-300 ease-in-out"
              style={{
                background: (!stripe || isProcessing || !userCanisterId || !principal) 
                  ? 'rgba(255, 107, 53, 0.3)' 
                  : 'linear-gradient(135deg, #f97316, #fbbf24)',
                color: '#ffffff',
                boxShadow: (!stripe || isProcessing || !userCanisterId || !principal) 
                  ? 'none' 
                  : '0 4px 15px rgba(255, 107, 53, 0.4)',
                opacity: (!stripe || isProcessing || !userCanisterId || !principal) ? 0.6 : 1,
                cursor: (!stripe || isProcessing || !userCanisterId || !principal) ? 'not-allowed' : 'pointer'
              }}
              onMouseEnter={(e) => {
                if (stripe && !isProcessing && userCanisterId && principal) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = (!stripe || isProcessing || !userCanisterId || !principal) 
                  ? 'none' 
                  : '0 4px 15px rgba(255, 107, 53, 0.4)';
              }}
            >
              {isProcessing ? (
                <div className="flex items-center justify-center gap-2 text-sm md:text-base">
                  <div className="w-4 h-4 border-2 border-white border-opacity-30 border-t-white rounded-full animate-spin"></div>
                  Processing...
                </div>
              ) : !stripe ? (
                'Loading Stripe...'
              ) : !userCanisterId || !principal ? (
                'Auth Required...'
              ) : (
                <>
                  <span className="md:hidden">💳 Pay ${amount.toFixed(2)}</span>
                  <span className="hidden md:inline">💰 Pay ${amount.toFixed(2)} → Get {estimatedCredits.toLocaleString()} Credits</span>
                </>
              )}
            </button>
          </form>
        );
      }
    };
  })
);
  }
  return _PaymentFormWrapper;
};

interface TopUpCreditsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ✅ Old PaymentForm component removed - now using lazy-loaded PaymentFormWrapper above
// This prevents @stripe/react-stripe-js initialization errors by deferring import until needed

export function TopUpCreditsDialog({ isOpen, onClose, onSuccess }: TopUpCreditsDialogProps) {
  const userCanisterId = useAppStore(state => state.userCanisterId);
  const identity = useAppStore(state => state.identity);
  const principal = useAppStore(state => state.principal);
  const { actor: mainActor } = useCanister('main');
  
  const [topUpAmount, setTopUpAmount] = useState<string>('10.00');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [pricingInfo, setPricingInfo] = useState<any>(null);
  const [stripeInitialized, setStripeInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [paymentCalculation, setPaymentCalculation] = useState<{
    usdAmount: number;
    unitsAmount: number;
    estimatedCredits: number;
    xdrRate: number;
  } | null>(null);

  // Initialize Stripe
  useEffect(() => {
    if (!isOpen) return;

    const initStripe = async () => {
      try {
        console.log('🔄 [TopUpCreditsDialog] Initializing Stripe with units system...');
        
        if (mainActor && principal) {
          stripeService.setMainActor(mainActor);
          console.log('✅ [TopUpCreditsDialog] Main actor injected into StripeService');

          const stripe = await stripeService.initialize();
          
          if (stripe) {
            setStripePromise(Promise.resolve(stripe));
            setStripeInitialized(true);
            
            const pricing = await stripeService.getPricingInfo();
            setPricingInfo(pricing);
            
            console.log('✅ [TopUpCreditsDialog] Stripe initialized with units-based pricing system');
          } else {
            throw new Error('Failed to initialize Stripe');
          }
        } else {
          console.warn('⚠️ [TopUpCreditsDialog] Missing mainActor or principal, cannot initialize payments');
          setError('Payment system not ready. Please ensure you are logged in.');
        }
      } catch (err) {
        console.error('❌ [TopUpCreditsDialog] Stripe initialization error:', err);
        setError('Failed to initialize payment system: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };

    if (mainActor && principal) {
      initStripe();
    }
  }, [isOpen, mainActor, principal]);

  // Calculate payment details when amount changes
  useEffect(() => {
    if (!isOpen) return;

    const calculatePayment = async () => {
      if (!topUpAmount) return;
      
      try {
        const usdAmount = parseFloat(topUpAmount);
        if (isNaN(usdAmount) || usdAmount <= 0) return;
        
        const paymentDetails = await CreditsService.calculatePaymentDetails(usdAmount);
        
        setPaymentCalculation({
          usdAmount: paymentDetails.usdAmount,
          unitsAmount: paymentDetails.unitsAmount,
          estimatedCredits: paymentDetails.estimatedCredits,
          xdrRate: paymentDetails.xdrRate
        });
        
        console.log('💰 [TopUpCreditsDialog] Units-based payment calculation updated:', paymentDetails);
      } catch (error) {
        console.error('❌ [TopUpCreditsDialog] Error calculating payment:', error);
        setPaymentCalculation(null);
      }
    };

    calculatePayment();
  }, [topUpAmount, isOpen]);

  // Handle payment success
  const handlePaymentSuccess = (paymentIntentId: string, unitsAdded: number) => {
    const amount = parseFloat(topUpAmount);
    const creditsEstimate = paymentCalculation?.estimatedCredits || 0;
    
    setSuccess(`🎉 Payment successful! Credits added to your account.\n\n💳 Payment ID: ${paymentIntentId.substring(0, 20)}...\n💰 Amount: $${amount.toFixed(2)}\n🏆 Credits Added: ${creditsEstimate.toLocaleString()} credits`);
    
    setTopUpAmount('10.00');
    
    // Refresh credits balance after a delay
    setTimeout(() => {
      const store = useAppStore.getState();
      if (store.fetchCreditsBalance) {
        store.fetchCreditsBalance();
      }
      if (onSuccess) {
        onSuccess();
      }
    }, 2000);
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Auto-clear messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, onClose]);

  const portalRoot = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure portal root exists
  useEffect(() => {
    if (!portalRoot.current) {
      let existingPortalRoot = document.getElementById('dialog-portal-root') as HTMLDivElement;
      if (!existingPortalRoot) {
        existingPortalRoot = document.createElement('div');
        existingPortalRoot.id = 'dialog-portal-root';
        existingPortalRoot.style.position = 'fixed';
        existingPortalRoot.style.top = '0';
        existingPortalRoot.style.left = '0';
        existingPortalRoot.style.width = '100%';
        existingPortalRoot.style.height = '100%';
        existingPortalRoot.style.pointerEvents = 'none';
        existingPortalRoot.style.zIndex = '10001';
        document.body.appendChild(existingPortalRoot);
      }
      portalRoot.current = existingPortalRoot;
    }
    // 🔥 FIX: Only set mounted when dialog should be open
    if (isOpen) {
      setMounted(true);
    }
  }, [isOpen]);

  // 🔥 FIX: Ensure dialog stays mounted when open, even if mounted state hasn't updated yet
  if (!isOpen) {
    if (mounted) {
      // Reset mounted state when dialog closes
      setTimeout(() => setMounted(false), 300);
    }
    return null;
  }
  
  if (!mounted || !portalRoot.current) {
    // Ensure mounted state is set when dialog opens
    if (isOpen && !mounted) {
      setMounted(true);
    }
    return null;
  }

  const dialogContent = (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem',
      pointerEvents: 'auto'
    }} onClick={(e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    }}>
      <div style={{
        background: 'rgb(17, 17, 17)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '2rem',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9)'
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #f97316, #fbbf24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            💎 Add Credits
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#ef4444',
            fontSize: '0.9rem',
            whiteSpace: 'pre-line'
          }}>
            ❌ {error}
          </div>
        )}

        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#10b981',
            fontSize: '0.9rem',
            whiteSpace: 'pre-line'
          }}>
            {success}
          </div>
        )}

        {/* System Information */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#10b981',
            marginBottom: '0.5rem'
          }}>
            💰 Credit Pricing
          </h3>
          <div style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '0.85rem',
            lineHeight: '1.6'
          }}>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>How it works:</strong> Pay with USD and receive credits directly
            </p>
          </div>
        </div>

        {/* Payment Form */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '0.5rem'
          }}>
            Amount (USD)
          </label>
          <input
            type="number"
            value={topUpAmount}
            onChange={(e) => setTopUpAmount(e.target.value)}
            min="1"
            max="10000"
            step="0.01"
            disabled={isProcessingPayment || !stripeInitialized}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              background: 'rgba(55, 65, 81, 0.5)',
              color: '#ffffff',
              fontSize: '1rem',
              marginBottom: '1rem',
              opacity: (isProcessingPayment || !stripeInitialized) ? 0.6 : 1
            }}
          />

          {paymentCalculation && (
            <div style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <div style={{ marginBottom: '0.5rem' }}><strong>You will receive:</strong></div>
              <div style={{ marginBottom: '0.25rem' }}>
                🏆 <strong>~{paymentCalculation.estimatedCredits.toLocaleString()} credits</strong> (${paymentCalculation.usdAmount.toFixed(2)})
              </div>
            </div>
          )}

          {stripePromise && stripeInitialized && paymentCalculation && (() => {
            const StripeElementsWrapper = getStripeElementsWrapper();
            const PaymentFormWrapper = getPaymentFormWrapper();
            return (
              <Suspense fallback={<div style={{ textAlign: 'center', padding: '1rem' }}>Loading payment form...</div>}>
                <StripeElementsWrapper stripe={stripePromise}>
                  <PaymentFormWrapper
                    amount={parseFloat(topUpAmount) || 0}
                    onPaymentSuccess={handlePaymentSuccess}
                    onPaymentError={handlePaymentError}
                    isProcessing={isProcessingPayment}
                    setIsProcessing={setIsProcessingPayment}
                    identity={identity}
                    estimatedCredits={paymentCalculation.estimatedCredits}
                    estimatedUnits={paymentCalculation.unitsAmount}
                    xdrRate={paymentCalculation.xdrRate}
                  />
                </StripeElementsWrapper>
              </Suspense>
            );
          })()}

          {!stripeInitialized && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '1rem',
              color: '#f59e0b',
              fontSize: '0.85rem',
              textAlign: 'center'
            }}>
              ⏳ Initializing payment system...
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );

  return createPortal(dialogContent, portalRoot.current!);
}
