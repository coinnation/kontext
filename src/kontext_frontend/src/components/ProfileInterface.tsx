// 🔥 FIX: Import lazy as React.lazy to prevent initialization errors
import React, { useState, useEffect, Suspense } from 'react';
import { useCanister } from '../useCanister';
import { useAppStore } from '../store/appStore';
import { CreditsService } from '../services/CreditsService';
import { stripeService } from '../services/StripeServiceFactory';
import type { PaymentResult } from '../services/StripeService';
import { userCanisterService } from '../services/UserCanisterService';
import { subscriptionService } from '../services/SubscriptionService';
import { serverPairProjectResolver, ServerPairWithProject } from '../services/ServerPairProjectResolver';
import { Principal } from '@dfinity/principal';
import { MarketplaceItemCreator } from './MarketplaceItemCreator';
// 🔥 REMOVED: loadStripe import was unused and causing top-level initialization
import { SubscriptionTier, SubscriptionPlan, UserProfile, AccountPreferences, ExternalServiceTokens } from '../types';

// 🔥 FIX: Lazy load Stripe Elements to avoid initialization errors
// This prevents @stripe/react-stripe-js from being executed at module load time
const StripeElementsWrapper = React.lazy(() => 
  import('@stripe/react-stripe-js').then(module => ({
    default: ({ children, stripe }: { children: React.ReactNode; stripe: any }) => {
      const { Elements } = module;
      return <Elements stripe={stripe}>{children}</Elements>;
    }
  }))
);

// Lazy load the PaymentForm to ensure hooks are only used when Stripe is ready
const PaymentFormWrapper = React.lazy(() => 
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
        
        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          
          if (!stripe || !elements) {
            onPaymentError('Stripe not initialized');
            return;
          }
          
          const cardElement = elements.getElement(CardElement);
          if (!cardElement) {
            onPaymentError('Card element not found');
            return;
          }
          
          setIsProcessing(true);
          
          try {
            console.log('💳 [PaymentForm] Processing payment...', {
              amount,
              estimatedCredits,
              estimatedUnits
            });
            
            const result = await stripeService.processPayment(
              amount,
              cardElement,
              estimatedCredits,
              estimatedUnits,
              userCanisterId!,
              identity
            );
            
            if (result.success && result.paymentIntentId) {
              console.log('✅ [PaymentForm] Payment successful:', result);
              onPaymentSuccess(result.paymentIntentId, result.unitsAdded || estimatedUnits);
            } else {
              console.error('❌ [PaymentForm] Payment failed:', result.error);
              onPaymentError(result.error || 'Payment failed');
            }
          } catch (error) {
            console.error('❌ [PaymentForm] Payment error:', error);
            onPaymentError(error instanceof Error ? error.message : 'Payment failed');
          } finally {
            setIsProcessing(false);
          }
        };
        
        return (
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div style={{
              padding: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              marginBottom: '1rem'
            }}>
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#ffffff',
                      '::placeholder': {
                        color: 'rgba(255, 255, 255, 0.5)',
                      },
                    },
                    invalid: {
                      color: '#ef4444',
                    },
                  },
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={!stripe || isProcessing}
              style={{
                width: '100%',
                padding: '1rem',
                background: isProcessing 
                  ? 'rgba(255, 107, 53, 0.5)' 
                  : 'linear-gradient(135deg, var(--accent-green), #059669)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
            </button>
          </form>
        );
      }
    };
  })
);

interface ProfileInterfaceProps {
  onClose: () => void;
}

// ✅ Old PaymentForm component removed - now using lazy-loaded PaymentFormWrapper above
// This prevents @stripe/react-stripe-js initialization errors by deferring import until needed

export function ProfileInterface({ onClose }: ProfileInterfaceProps) {
  const userCanisterId = useAppStore(state => state.userCanisterId);
  const identity = useAppStore(state => state.identity);
  const principal = useAppStore(state => state.principal);
  const { actor: mainActor } = useCanister();
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🔥 FIX: Load tier display info when subscription tier changes
  // (subscription is retrieved from useAppStore below)
  useEffect(() => {
    const loadTierInfo = async () => {
      const subscription = useAppStore.getState().subscription;
      
      if (!subscription.currentTier || subscription.currentTier === SubscriptionTier.FREE) {
        setTierDisplayInfo({
          icon: '📦',
          name: 'Free'
        });
        return;
      }

      try {
        const [icon, name] = await Promise.all([
          subscriptionService.getTierIcon(subscription.currentTier),
          subscriptionService.getTierDisplayName(subscription.currentTier)
        ]);
        setTierDisplayInfo({ icon, name });
      } catch (error) {
        console.error('❌ [ProfileInterface] Error loading tier info:', error);
        // Fallback to basic values
        setTierDisplayInfo({
          icon: '📦',
          name: subscription.currentTier
        });
      }
    };

    loadTierInfo();
    
    // Subscribe to subscription changes
    const unsubscribe = useAppStore.subscribe(
      (state) => state.subscription.currentTier,
      () => loadTierInfo()
    );
    
    return unsubscribe;
  }, []);
  
  // State management
  const [activeTab, setActiveTab] = useState<'dashboard' | 'billing' | 'subscription' | 'account' | 'usage' | 'hosting' | 'publicprofile' | 'marketplace'>('dashboard');
  const [balance, setBalance] = useState<{
    credits: number;
    units: number;
    usdEquivalent: number;
    lastUpdated: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 🔥 FIX: State for async-loaded tier display info
  const [tierDisplayInfo, setTierDisplayInfo] = useState<{
    icon: string;
    name: string;
  }>({
    icon: '📦',
    name: 'Free'
  });
  
  // Units-based payment state
  const [topUpAmount, setTopUpAmount] = useState<string>('10.00');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [pricingInfo, setPricingInfo] = useState<any>(null);
  const [stripeInitialized, setStripeInitialized] = useState(false);
  const [currentXdrRate, setCurrentXdrRate] = useState<number | null>(null);
  
  // Payment calculation state
  const [paymentCalculation, setPaymentCalculation] = useState<{
    usdAmount: number;
    unitsAmount: number;
    estimatedCredits: number;
    xdrRate: number;
  } | null>(null);

  // ULTRA-ENHANCED: Hosting Tab State with Maximum Parallelism
  const [resolvedServerPairs, setResolvedServerPairs] = useState<ServerPairWithProject[]>([]);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [isLoadingServerPairs, setIsLoadingServerPairs] = useState(false);
  const [serverPairMoves, setServerPairMoves] = useState<{[pairId: string]: string}>({});
  const [isMovingServerPair, setIsMovingServerPair] = useState<string | null>(null);
  
  // Subscription management state
  const subscription = useAppStore(state => state.subscription);
  const [isChangingSubscription, setIsChangingSubscription] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState<string | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  
  // Account preferences state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [accountPreferences, setAccountPreferences] = useState<AccountPreferences | null>(null);
  const [externalServices, setExternalServices] = useState<ExternalServiceTokens | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Form state for account tab
  const [profileForm, setProfileForm] = useState<Partial<UserProfile>>({});
  const [preferencesForm, setPreferencesForm] = useState<Partial<AccountPreferences>>({});
  const [githubToken, setGithubToken] = useState<string>('');
  
  // ULTRA-ENHANCED: Parallel processing state with performance tracking
  const [parallelOperationStats, setParallelOperationStats] = useState<{
    lastLoadTime: number;
    lastMoveTime: number;
    totalOperations: number;
    averageOperationTime: number;
    parallelEfficiency: number;
  }>({
    lastLoadTime: 0,
    lastMoveTime: 0,
    totalOperations: 0,
    averageOperationTime: 0,
    parallelEfficiency: 0
  });

  // ULTRA-ENHANCED: Cache for lightning-fast lookups
  const [serverPairProjectCache, setServerPairProjectCache] = useState<Map<string, string>>(new Map());
  const [cacheStats, setCacheStats] = useState<{
    hits: number;
    misses: number;
    efficiency: number;
    lastUpdate: number;
  }>({
    hits: 0,
    misses: 0,
    efficiency: 0,
    lastUpdate: 0
  });

  // ULTRA-ENHANCED: Maximum Parallelism Server Pair Loading with Performance Monitoring
  const loadAllServerPairsUltraParallel = async () => {
    if (!userCanisterId || !identity) return;
    
    try {
      setIsLoadingServerPairs(true);
      console.log('🚀 [ProfileInterface] ULTRA-PARALLEL: Starting MAXIMUM parallelism server pairs loading...');
      
      const loadStartTime = Date.now();
      
      // PHASE 1: ULTRA-PARALLEL data loading with maximum concurrency
      const [serverPairsResult, projectsResult, existingCache] = await Promise.all([
        userCanisterService.getAllUserServerPairs(userCanisterId, identity),
        userCanisterService.loadUserProjects(userCanisterId, identity),
        Promise.resolve(serverPairProjectResolver.getCacheStats()) // Leverage existing cache
      ]);
      
      const dataLoadTime = Date.now() - loadStartTime;
      console.log(`⚡ [ProfileInterface] ULTRA-PARALLEL: Data loading completed in ${dataLoadTime}ms with maximum parallelism`);
      
      if (!serverPairsResult.success || !serverPairsResult.serverPairs) {
        throw new Error(serverPairsResult.error || 'Failed to load server pairs');
      }

      if (!projectsResult.success || !projectsResult.projects) {
        throw new Error(projectsResult.error || 'Failed to load projects');
      }

      setUserProjects(projectsResult.projects);

      // PHASE 2: ULTRA-PARALLEL resolution with cache optimization
      const resolutionStartTime = Date.now();
      
      // Use maximum parallelism resolver with cache pre-warming
      const resolvedPairs = await serverPairProjectResolver.resolveServerPairProjects(
        serverPairsResult.serverPairs,
        userCanisterId,
        identity,
        projectsResult.projects
      );
      
      const resolutionTime = Date.now() - resolutionStartTime;

      // PHASE 3: Build ultra-fast lookup cache for instant move operations
      const cacheStartTime = Date.now();
      const newCache = new Map<string, string>();
      
      await Promise.all(resolvedPairs.map(async (pair) => {
        if (pair.projectId) {
          newCache.set(pair.pairId, pair.projectId);
        }
      }));
      
      setServerPairProjectCache(newCache);
      const cacheTime = Date.now() - cacheStartTime;

      setResolvedServerPairs(resolvedPairs);
      
      const totalTime = Date.now() - loadStartTime;
      const parallelEfficiency = Math.min(100, Math.round((serverPairsResult.serverPairs.length / (totalTime / 1000)) * 10));

      // Update performance statistics
      setParallelOperationStats(prev => ({
        lastLoadTime: totalTime,
        lastMoveTime: prev.lastMoveTime,
        totalOperations: prev.totalOperations + 1,
        averageOperationTime: Math.round((prev.averageOperationTime * prev.totalOperations + totalTime) / (prev.totalOperations + 1)),
        parallelEfficiency: parallelEfficiency
      }));

      setCacheStats({
        hits: 0,
        misses: 0,
        efficiency: 100,
        lastUpdate: Date.now()
      });
      
      console.log(`🎉 [ProfileInterface] ULTRA-PARALLEL: MAXIMUM parallelism loading completed in ${totalTime}ms:`);
      console.log(`   ⚡ Data Load: ${dataLoadTime}ms (${serverPairsResult.serverPairs.length} pairs, ${projectsResult.projects.length} projects)`);
      console.log(`   🚀 Resolution: ${resolutionTime}ms (parallel processing)`);
      console.log(`   💾 Cache Build: ${cacheTime}ms (${newCache.size} mappings)`);
      console.log(`   📊 Performance: ~${Math.round(resolvedPairs.length / (totalTime / 1000))} pairs/second`);
      console.log(`   🔥 Parallel Efficiency: ${parallelEfficiency}%`);
      
    } catch (error) {
      console.error('❌ [ProfileInterface] ULTRA-PARALLEL: Maximum parallelism loading failed:', error);
      setError('Failed to load server pairs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoadingServerPairs(false);
    }
  };

  // Load server pairs when hosting tab is activated - now uses maximum parallelism
  useEffect(() => {
    if (activeTab === 'hosting') {
      loadAllServerPairsUltraParallel();
    }
  }, [activeTab, userCanisterId, identity]);

  // Load account preferences when account tab is activated
  useEffect(() => {
    if (activeTab === 'account' && userCanisterId && identity) {
      loadAccountPreferences();
    }
  }, [activeTab, userCanisterId, identity]);

  // Load account preferences
  const loadAccountPreferences = async () => {
    if (!userCanisterId || !identity) return;
    
    try {
      setIsLoadingProfile(true);
      setError(null);
      
      console.log('📋 [ProfileInterface] Loading account preferences...');
      
      // Load all preference data in parallel
      const [profileResult, preferencesResult, servicesResult] = await Promise.all([
        userCanisterService.getUserProfile(userCanisterId, identity),
        userCanisterService.getAccountPreferences(userCanisterId, identity),
        userCanisterService.getExternalServiceTokens(userCanisterId, identity)
      ]);
      
      if (profileResult.success && profileResult.profile) {
        setUserProfile(profileResult.profile);
        setProfileForm(profileResult.profile);
      }
      
      if (preferencesResult.success && preferencesResult.preferences) {
        setAccountPreferences(preferencesResult.preferences);
        setPreferencesForm(preferencesResult.preferences);
      }
      
      if (servicesResult.success && servicesResult.tokens) {
        setExternalServices(servicesResult.tokens);
        if (servicesResult.tokens.github?.accessToken) {
          setGithubToken('••••••••'); // Mask the token
        }
      }
      
      console.log('✅ [ProfileInterface] Account preferences loaded');
    } catch (err) {
      console.error('❌ [ProfileInterface] Error loading account preferences:', err);
      setError('Failed to load account preferences: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Save account preferences
  const saveAccountPreferences = async () => {
    if (!userCanisterId || !identity) return;
    
    try {
      setIsSavingProfile(true);
      setError(null);
      
      console.log('💾 [ProfileInterface] Saving account preferences...');
      
      // Save all changes in parallel
      const promises: Promise<any>[] = [];
      
      if (Object.keys(profileForm).length > 0) {
        promises.push(userCanisterService.updateUserProfile(userCanisterId, identity, profileForm));
      }
      
      if (Object.keys(preferencesForm).length > 0) {
        promises.push(userCanisterService.updateAccountPreferences(userCanisterId, identity, preferencesForm));
      }
      
      if (githubToken && githubToken !== '••••••••') {
        promises.push(userCanisterService.updateExternalServiceTokens(userCanisterId, identity, {
          github: {
            accessToken: githubToken,
            tokenExpiry: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
            connectedRepositories: []
          }
        }));
      }
      
      const results = await Promise.all(promises);
      
      const allSuccess = results.every(r => r.success);
      
      if (allSuccess) {
        setSuccess('✅ Account preferences saved successfully!');
        // Reload preferences
        await loadAccountPreferences();
      } else {
        const errors = results.filter(r => !r.success).map(r => r.error).join(', ');
        setError('Some preferences failed to save: ' + errors);
      }
      
      console.log('✅ [ProfileInterface] Account preferences saved');
    } catch (err) {
      console.error('❌ [ProfileInterface] Error saving account preferences:', err);
      setError('Failed to save account preferences: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Initialize Stripe and inject main actor
  useEffect(() => {
    const initStripe = async () => {
      try {
        console.log('🔄 [ProfileInterface] Initializing Stripe with units system...');
        
        if (!mainActor) {
          console.warn('⚠️ [ProfileInterface] mainActor not ready yet, waiting...');
          return;
        }
        
        if (!principal) {
          console.warn('⚠️ [ProfileInterface] Missing principal, cannot initialize payments');
          setError('Payment system not ready. Please ensure you are logged in.');
          return;
        }
        
        // Check if getStripePublishableKey method exists
        if (typeof mainActor.getStripePublishableKey !== 'function') {
          console.error('❌ [ProfileInterface] getStripePublishableKey method not found on mainActor');
          setError('Payment system configuration error. Please refresh the page.');
          return;
        }
        
        stripeService.setMainActor(mainActor);
        subscriptionService.setMainActor(mainActor);
        console.log('✅ [ProfileInterface] Main actor injected into StripeService and SubscriptionService');

        // Initialize the service (returns void)
        await stripeService.initialize();
        
        // Get the Stripe instance after initialization
        const stripe = stripeService.getStripe();
        
        if (stripe) {
          setStripePromise(Promise.resolve(stripe));
          setStripeInitialized(true);
          
          const pricing = await stripeService.getPricingInfo();
          setPricingInfo(pricing);
          
          console.log('✅ [ProfileInterface] Stripe initialized with units-based pricing system');
          console.log('💱 [ProfileInterface] XDR Rate:', pricing?.xdrRate);
        } else {
          throw new Error('Failed to get Stripe instance after initialization');
        }
      } catch (err) {
        console.error('❌ [ProfileInterface] Stripe initialization error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError('Failed to initialize payment system: ' + errorMessage);
      }
    };

    if (mainActor && principal) {
      initStripe();
    }
  }, [mainActor, principal]);

  // Calculate payment details when amount changes
  useEffect(() => {
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
        
        console.log('💰 [ProfileInterface] Units-based payment calculation updated:', paymentDetails);
      } catch (error) {
        console.error('❌ [ProfileInterface] Error calculating payment:', error);
        setPaymentCalculation(null);
      }
    };

    calculatePayment();
  }, [topUpAmount]);

  useEffect(() => {
    if (pricingInfo?.xdrRate) {
      if (pricingInfo.xdrRate instanceof Promise) {
        pricingInfo.xdrRate.then((rate: number) => {
          setCurrentXdrRate(rate);
        });
      } else {
        setCurrentXdrRate(pricingInfo.xdrRate);
      }
    }
  }, [pricingInfo]);

  // Load units-derived credits balance
  const loadBalance = async () => {
    if (!userCanisterId || !identity) {
      console.warn('⚠️ [ProfileInterface] Cannot load balance - missing canister or identity');
      setError('User canister not available. Please try refreshing the page.');
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);

      console.log('💰 [ProfileInterface] Loading credits balance from user canister:', userCanisterId);

      const balanceData = await CreditsService.fetchUserBalance(userCanisterId, identity);
      
      if (balanceData) {
        setBalance({
          credits: balanceData.credits,
          units: balanceData.units,
          usdEquivalent: balanceData.usdEquivalent,
          lastUpdated: balanceData.lastUpdated
        });
        console.log('💰 [ProfileInterface] Credits balance loaded:', {
          credits: balanceData.credits,
          usd: '$' + balanceData.usdEquivalent.toFixed(2)
        });
      } else {
        setError('Unable to load credits balance');
      }
    } catch (err) {
      console.error('❌ [ProfileInterface] Error loading credits balance:', err);
      setError(`Failed to load balance: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ULTRA-ENHANCED: Lightning-Fast Server Pair Move with Maximum Parallelism
  const handleMoveServerPairUltraParallel = async (pairId: string) => {
    const newProjectId = serverPairMoves[pairId];
    if (!newProjectId || !userCanisterId || !identity) return;
    
    try {
      setIsMovingServerPair(pairId);
      console.log('🚀 [ProfileInterface] ULTRA-PARALLEL: Starting LIGHTNING-FAST server pair move with maximum parallelism...');
      
      const moveStartTime = Date.now();
      
      // ULTRA-ENHANCED: Cache-powered pre-validation for instant feedback
      const cachedProjectId = serverPairProjectCache.get(pairId);
      if (cachedProjectId === newProjectId) {
        setSuccess(`Server pair is already in the target project!`);
        setIsMovingServerPair(null);
        return;
      }

      // Update cache stats for hits/misses
      setCacheStats(prev => ({
        ...prev,
        hits: cachedProjectId ? prev.hits + 1 : prev.hits,
        misses: cachedProjectId ? prev.misses : prev.misses + 1,
        efficiency: Math.round(((prev.hits + (cachedProjectId ? 1 : 0)) / (prev.hits + prev.misses + 1)) * 100)
      }));

      // ULTRA-PARALLEL: Execute move with maximum performance optimizations
      const moveResult = await userCanisterService.moveServerPairToProjectUltraParallel(
        pairId,
        newProjectId,
        userCanisterId,
        identity,
        (phase, message, timeMs) => {
          console.log(`⚡ [ProfileInterface] ULTRA-PARALLEL Move Phase [${phase}]: ${message} (${timeMs}ms)`);
        }
      );
      
      const moveTime = Date.now() - moveStartTime;
      console.log(`⚡ [ProfileInterface] ULTRA-PARALLEL: Server move completed in ${moveTime}ms with maximum efficiency`);
      
      if (moveResult.success) {
        // INSTANT: Update local cache immediately for next operation
        serverPairProjectCache.set(pairId, newProjectId);
        
        const performanceMessage = moveResult.performanceMetrics 
          ? `\n🚀 Performance: ${moveResult.performanceMetrics.parallelOperations} parallel ops, ${moveResult.performanceMetrics.concurrencyLevel} concurrency, avg ${moveResult.performanceMetrics.averageOperationTime}ms/op`
          : '';

        setSuccess(`🎉 Server pair moved successfully in ${moveTime}ms!${performanceMessage}\n\n⚡ ULTRA-PARALLEL processing achieved maximum efficiency!`);
        
        // Clear the selection
        setServerPairMoves(prev => {
          const updated = { ...prev };
          delete updated[pairId];
          return updated;
        });
        
        // Update performance statistics
        setParallelOperationStats(prev => ({
          lastLoadTime: prev.lastLoadTime,
          lastMoveTime: moveTime,
          totalOperations: prev.totalOperations + 1,
          averageOperationTime: Math.round((prev.averageOperationTime * (prev.totalOperations - 1) + moveTime) / prev.totalOperations),
          parallelEfficiency: Math.min(100, Math.round(100 - (moveTime / 1000))) // Efficiency based on speed
        }));
        
        // ULTRA-PARALLEL: Refresh with maximum parallelism and intelligent cache reuse
        const refreshStartTime = Date.now();
        
        // Clear resolver cache but keep our local cache for continuity
        serverPairProjectResolver.clearCaches();
        
        // Reload with ultra-parallel processing
        await loadAllServerPairsUltraParallel();
        
        const refreshTime = Date.now() - refreshStartTime;
        console.log(`🔄 [ProfileInterface] ULTRA-PARALLEL: Cache refresh with maximum parallelism completed in ${refreshTime}ms`);
        
      } else {
        setError(`❌ Failed to move server pair: ${moveResult.error}\n\nThis may be due to network latency or backend processing time. Please try again.`);
      }
      
    } catch (error) {
      console.error('❌ [ProfileInterface] ULTRA-PARALLEL: Server move failed:', error);
      setError(`❌ Error in ultra-parallel server move: ${error instanceof Error ? error.message : 'Unknown error'}\n\nThe system attempted maximum parallelism but encountered an issue. Please try again.`);
    } finally {
      setIsMovingServerPair(null);
    }
  };

  // Handle payment success with units addition confirmation
  const handlePaymentSuccess = (paymentIntentId: string, unitsAdded: number) => {
    const amount = parseFloat(topUpAmount);
    const creditsEstimate = paymentCalculation?.estimatedCredits || 0;
    
    setSuccess(`🎉 Payment successful! Credits added to your account.\n\n💳 Payment ID: ${paymentIntentId.substring(0, 20)}...\n💰 Amount: $${amount.toFixed(2)}\n🏆 Credits Added: ${creditsEstimate.toLocaleString()} credits\n\nYour balance will update automatically.`);
    
    setTopUpAmount('10.00');
    setTimeout(() => {
      loadBalance();
    }, 2000);
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Load balance on mount
  useEffect(() => {
    if (userCanisterId && identity) {
      console.log('🔄 [ProfileInterface] Component mounted with canister:', userCanisterId);
      loadBalance();
    } else {
      console.warn('⚠️ [ProfileInterface] Missing required data:', { userCanisterId: !!userCanisterId, identity: !!identity });
      setError('User canister not initialized. Please try refreshing the page.');
      setIsLoading(false);
    }
  }, [userCanisterId, identity]);

  // Auto-clear messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 15000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Load subscription plans from backend
  useEffect(() => {
    const loadPlans = async () => {
      try {
        setPlansLoading(true);
        const plans = await subscriptionService.getSubscriptionPlans();
        setSubscriptionPlans(plans);
        console.log('✅ [ProfileInterface] Loaded', plans.length, 'subscription plans');
      } catch (error) {
        console.error('❌ [ProfileInterface] Failed to load subscription plans:', error);
      } finally {
        setPlansLoading(false);
      }
    };

    loadPlans();
  }, []);

  // Calculate hosting statistics
  const hostingStats = {
    total: resolvedServerPairs.length,
    matched: resolvedServerPairs.filter(p => p.status === 'matched').length,
    mismatched: resolvedServerPairs.filter(p => p.status === 'mismatched').length,
    unknown: resolvedServerPairs.filter(p => p.status === 'unknown').length
  };

  return (
    <div className="fixed inset-0 text-white overflow-auto z-50" style={{ background: 'var(--kontext-primary-black)' }}>
      {/* Header - Matching DocumentationInterface Style */}
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
            }}>User Profile</span>
          </h1>
        </div>

        {/* Right Side - Close Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flex: '0 0 auto'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#ef4444',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tab Navigation - Full Width */}
      <div style={{ 
        background: 'rgba(17, 17, 17, 0.8)', 
        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
        width: '100%'
      }}>
        <div className="flex gap-0 overflow-x-auto lg:overflow-visible" style={{ width: '100%' }}>
            {[
              { id: 'dashboard', label: '📊 Dashboard', shortLabel: '📊' },
              { id: 'billing', label: '💰 Billing', shortLabel: '💰' },
              { id: 'subscription', label: '💳 Subscription', shortLabel: '💳' },
              { id: 'account', label: '⚙️ Account', shortLabel: '⚙️' },
              { id: 'usage', label: '📈 Usage', shortLabel: '📈' },
              { id: 'hosting', label: '🌐 Hosting', shortLabel: '🌐' },
              { id: 'publicprofile', label: '🎨 Public Profile', shortLabel: '🎨' },
              { id: 'marketplace', label: '🛒 Marketplace', shortLabel: '🛒' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="px-3 py-3 lg:px-6 lg:py-4 font-medium text-sm lg:text-base whitespace-nowrap border-b-2 transition-all duration-300 min-w-fit"
                style={{
                  borderBottomColor: activeTab === tab.id ? 'var(--kontext-orange)' : 'transparent',
                  background: activeTab === tab.id ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--kontext-text-primary)' : 'var(--kontext-text-tertiary)'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.color = 'var(--kontext-text-primary)';
                    e.currentTarget.style.background = 'var(--kontext-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.color = 'var(--kontext-text-tertiary)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span className="lg:hidden">{tab.shortLabel}</span>
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            ))}
          </div>
      </div>

      {/* Main Content - Full Width */}
      <div style={{ width: '100%', padding: isMobile ? '1rem' : '2rem 3rem' }}>
        {/* Status Messages */}
        {error && (
          <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-xl p-4 mb-6 text-red-400 text-sm lg:text-base leading-relaxed whitespace-pre-line">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-xl p-4 mb-6 text-green-400 text-sm lg:text-base leading-relaxed whitespace-pre-line">
            {success}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header Section */}
            <div className="mb-8 lg:mb-12">
              <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold mb-2 lg:mb-3" style={{ 
                background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-0.02em'
              }}>
                Account Overview
              </h2>
              <p className="text-sm lg:text-base text-gray-400">
                Manage your credits and account activity
              </p>
            </div>

            {isLoading ? (
              <div className="text-center py-16 lg:py-24">
                <div className="w-12 h-12 lg:w-16 lg:h-16 border-4 border-orange-500 border-opacity-20 border-t-orange-500 rounded-full animate-spin mx-auto mb-6"></div>
                <p className="text-gray-400 text-base lg:text-lg">Loading your credits balance...</p>
              </div>
            ) : (
              <>
                {/* Enhanced Credits Balance Card */}
                <div className="flex justify-center mb-8 lg:mb-12">
                  <div className="w-full max-w-lg lg:max-w-2xl relative group">
                    {/* Glow effect behind card */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>
                    
                    {/* Main card */}
                    <div className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 rounded-3xl p-8 lg:p-12 text-center overflow-hidden shadow-2xl transform transition-all duration-300 hover:scale-[1.02]">
                      {/* Animated background pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-amber-300 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                      </div>
                      
                      {/* Trophy icon - more prominent */}
                      <div className="absolute top-4 right-4 lg:top-6 lg:right-6 text-5xl lg:text-7xl opacity-20 animate-bounce" style={{ animationDuration: '3s' }}>🏆</div>
                      
                      {/* Content */}
                      <div className="relative z-10">
                        <div className="flex items-center justify-center gap-2 mb-4 lg:mb-6">
                          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                          <h3 className="text-sm lg:text-base font-semibold text-white/90 uppercase tracking-wider">
                            Your Credits Balance
                          </h3>
                          <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                        </div>
                        
                        <div className="text-4xl lg:text-6xl xl:text-7xl font-black mb-6 lg:mb-8 leading-none text-white drop-shadow-lg">
                          {balance ? CreditsService.formatCreditsDisplay(balance.credits) : '0'}
                        </div>
                        
                        <div className="text-lg lg:text-xl font-semibold text-white/80 mb-6 lg:mb-8">
                          Credits
                        </div>
                        
                        {balance && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                            <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs lg:text-sm text-white/80">
                              Updated {new Date(balance.lastUpdated).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Quick Actions Section */}
                <div className="rounded-2xl p-8 lg:p-10 text-center relative overflow-hidden" style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15))',
                  border: '2px solid rgba(16, 185, 129, 0.3)',
                  boxShadow: '0 8px 32px rgba(16, 185, 129, 0.1)'
                }}>
                  {/* Subtle background pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-green-400 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-400 rounded-full blur-2xl"></div>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-center gap-3 mb-6 lg:mb-8">
                      <div className="w-1 h-8 bg-green-400 rounded-full"></div>
                      <h3 className="text-lg lg:text-xl font-bold" style={{ 
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}>
                        Quick Actions
                      </h3>
                      <div className="w-1 h-8 bg-green-400 rounded-full"></div>
                    </div>
                    
                    <div className="flex justify-center">
                      <button
                        onClick={() => setActiveTab('billing')}
                        className="group relative px-8 py-4 lg:px-10 lg:py-5 rounded-2xl font-bold text-base lg:text-lg transition-all duration-300 overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                          color: '#ffffff',
                          boxShadow: '0 8px 24px rgba(255, 107, 53, 0.4)',
                          transform: 'translateY(0)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                          e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 107, 53, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0) scale(1)';
                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 107, 53, 0.4)';
                        }}
                      >
                        {/* Shine effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        
                        <span className="relative z-10 flex items-center gap-3">
                          <span className="text-xl lg:text-2xl">💎</span>
                          <span>Purchase More Credits</span>
                          <svg className="w-5 h-5 lg:w-6 lg:h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Purchase Credits
            </h2>

            {/* Current Balance Summary */}
            <div className="rounded-xl p-4 lg:p-6 mb-6 lg:mb-8" style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <h3 className="text-base lg:text-lg font-semibold mb-4" style={{ color: '#10b981', fontWeight: 600 }}>Current Balance</h3>
              {balance ? (
                <div className="text-center">
                  <div className="text-2xl lg:text-3xl xl:text-4xl font-bold text-orange-500 mb-2">
                    {CreditsService.formatCreditsDisplay(balance.credits)} Credits
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 text-center text-sm lg:text-base">Loading balance...</div>
              )}
            </div>

            {/* Units Purchase Section */}
            <div className="rounded-xl p-6 lg:p-8" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h3 className="text-lg lg:text-xl font-semibold mb-4 lg:mb-6" style={{ 
                background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                💎 Purchase Credits
              </h3>

              {!stripeInitialized && (
                <div className="bg-amber-500 bg-opacity-10 border border-amber-500 border-opacity-30 rounded-lg p-4 mb-6 text-amber-400 text-sm lg:text-base">
                  ⏳ Initializing units-based payment system...
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                <div>
                  <label className="block text-sm lg:text-base text-gray-400 mb-2">
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
                    className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base mb-4 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />

                  {paymentCalculation && (
                    <div className="rounded-lg p-4 mb-6 text-sm lg:text-base" style={{ 
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      color: 'rgba(255, 255, 255, 0.9)'
                    }}>
                      <div className="mb-2" style={{ fontWeight: 600 }}><strong>You will receive:</strong></div>
                      <div className="mb-1">🏆 <strong>~{paymentCalculation.estimatedCredits.toLocaleString()} Credits</strong></div>
                      <div className="text-xs lg:text-sm mt-2" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        Rate: ${paymentCalculation.xdrRate.toFixed(4)}/XDR • Credits calculated from real IC computational costs
                      </div>
                    </div>
                  )}

                  {stripePromise && stripeInitialized && paymentCalculation && (
                    <div className="mt-6">
                      <Suspense fallback={<div className="text-center py-4">Loading payment form...</div>}>
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
                    </div>
                  )}
                </div>

                <div className="rounded-xl p-4 lg:p-6" style={{ 
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <h4 className="text-sm lg:text-base font-semibold mb-4" style={{ color: '#10b981', fontWeight: 600 }}>
                    🔄 How Units Work
                  </h4>
                  <ul className="text-gray-300 text-xs lg:text-sm leading-relaxed space-y-2 pl-6">
                    <li className="list-disc">Pay with USD via Stripe</li>
                    <li className="list-disc">Credits calculated from real IC computational costs</li>
                    <li className="list-disc">Immune to crypto market volatility</li>
                    <li className="list-disc">Only real computational cost changes affect credits</li>
                    <li className="list-disc text-gray-400">
                      Rate: ${pricingInfo?.xdrRate?.toFixed(4) || '1.35'}/XDR
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Subscription Management
            </h2>

            {subscriptionError && (
              <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-xl p-4 mb-6 text-red-400 text-sm lg:text-base">
                ❌ {subscriptionError}
              </div>
            )}

            {subscriptionSuccess && (
              <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-xl p-4 mb-6 text-green-400 text-sm lg:text-base">
                ✅ {subscriptionSuccess}
              </div>
            )}

            {/* Current Subscription */}
            <div className="rounded-xl p-6 lg:p-8 mb-6 lg:mb-8" style={{
              background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(251, 191, 36, 0.2))',
              border: '1px solid rgba(255, 107, 53, 0.4)',
              boxShadow: '0 4px 15px rgba(255, 107, 53, 0.2)'
            }}>
              <h3 className="text-lg lg:text-xl font-semibold mb-4" style={{ 
                background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>Current Plan</h3>
              {subscription.currentTier && subscription.currentTier !== SubscriptionTier.FREE ? (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">{tierDisplayInfo.icon}</span>
                    <div>
                      <div className="text-2xl lg:text-3xl font-bold text-white">
                        {tierDisplayInfo.name}
                      </div>
                      <div className="text-sm lg:text-base text-gray-300">
                        {subscription.monthlyCredits.toLocaleString()} credits per month
                      </div>
                    </div>
                  </div>
                  
                  {subscription.isActive ? (
                    <div className="bg-green-500 bg-opacity-20 text-green-400 px-4 py-2 rounded-lg inline-block mb-4">
                      ✓ Active
                    </div>
                  ) : (
                    <div className="bg-red-500 bg-opacity-20 text-red-400 px-4 py-2 rounded-lg inline-block mb-4">
                      ⚠ Inactive
                    </div>
                  )}

                  {subscription.billingCycleEnd && (
                    <div className="text-sm lg:text-base text-gray-300">
                      Next billing date: {new Date(subscription.billingCycleEnd).toLocaleDateString()}
                    </div>
                  )}

                  {subscription.customerId && (
                    <div className="mt-4">
                      <button
                        onClick={async () => {
                          try {
                            setIsChangingSubscription(true);
                            setSubscriptionError(null);
                            
                            const portalUrl = await subscriptionService.openCustomerPortal(
                              subscription.customerId!,
                              window.location.origin
                            );
                            
                            if (portalUrl) {
                              window.location.href = portalUrl;
                            } else {
                              setSubscriptionError('Failed to open billing portal. Please try again.');
                            }
                          } catch (error) {
                            setSubscriptionError(error instanceof Error ? error.message : 'Failed to open billing portal');
                          } finally {
                            setIsChangingSubscription(false);
                          }
                        }}
                        disabled={isChangingSubscription}
                        className="px-6 py-3 rounded-lg font-semibold transition-all duration-300"
                        style={{
                          background: 'var(--kontext-gradient-button)',
                          color: 'var(--kontext-text-primary)',
                          boxShadow: 'var(--kontext-shadow-primary)',
                          opacity: isChangingSubscription ? 0.5 : 1,
                          cursor: isChangingSubscription ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          if (!isChangingSubscription) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = 'var(--kontext-shadow-interactive)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'var(--kontext-shadow-primary)';
                        }}
                      >
                        {isChangingSubscription ? 'Opening...' : 'Manage Subscription in Stripe Portal'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-xl lg:text-2xl font-semibold text-gray-300 mb-4">Free Plan</div>
                  <div className="text-sm lg:text-base text-gray-400 mb-4">
                    You're currently on the free plan. Upgrade to unlock more features and credits.
                  </div>
                </div>
              )}
            </div>

            {/* Available Plans */}
            <div className="mb-6 lg:mb-8">
              <h3 className="text-lg lg:text-xl font-semibold mb-4 text-white">Available Plans</h3>
              {plansLoading ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 border-3 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'rgba(255, 107, 53, 0.3)', borderTopColor: 'var(--kontext-orange)' }}></div>
                  <p className="text-gray-400">Loading subscription plans...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                  {subscriptionPlans.map((plan) => {
                  const isCurrentPlan = subscription.currentTier === plan.tier;
                  const isUpgrade = subscription.currentTier !== SubscriptionTier.FREE && 
                                   subscriptionService.isUpgrade(subscription.currentTier, plan.tier);
                  const isDowngrade = subscription.currentTier !== SubscriptionTier.FREE && 
                                     !isUpgrade && !isCurrentPlan;

                  return (
                    <div
                      key={plan.tier}
                      className={`
                        bg-gray-800 bg-opacity-50 border rounded-xl p-6 lg:p-8
                        ${isCurrentPlan 
                          ? 'border-orange-500 border-opacity-50 bg-orange-500 bg-opacity-10' 
                          : 'border-gray-600 border-opacity-50'
                        }
                        ${plan.isPopular ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
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

                      {isCurrentPlan ? (
                        <div className="bg-orange-500 bg-opacity-20 text-orange-400 px-4 py-2 rounded-lg text-center font-semibold">
                          Current Plan
                        </div>
                      ) : subscription.currentTier === SubscriptionTier.FREE ? (
                        <button
                          onClick={async () => {
                            try {
                              setIsChangingSubscription(true);
                              setSubscriptionError(null);
                              
                              if (!userCanisterId || !identity) {
                                setSubscriptionError('User authentication required');
                                return;
                              }

                              subscriptionService.setMainActor(mainActor);
                              const checkoutSession = await subscriptionService.createCheckoutSession(
                                plan.tier,
                                userCanisterId,
                                identity
                              );

                              if (checkoutSession) {
                                window.location.href = checkoutSession.url;
                              } else {
                                setSubscriptionError('Failed to create checkout session. Please try again.');
                              }
                            } catch (error) {
                              setSubscriptionError(error instanceof Error ? error.message : 'Failed to start subscription');
                            } finally {
                              setIsChangingSubscription(false);
                            }
                          }}
                          disabled={isChangingSubscription}
                          className="w-full px-4 py-3 rounded-lg font-semibold transition-all duration-300"
                          style={{
                            background: 'var(--kontext-gradient-button)',
                            color: 'var(--kontext-text-primary)',
                            boxShadow: 'var(--kontext-shadow-primary)',
                            opacity: isChangingSubscription ? 0.5 : 1,
                            cursor: isChangingSubscription ? 'not-allowed' : 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            if (!isChangingSubscription) {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = 'var(--kontext-shadow-interactive)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'var(--kontext-shadow-primary)';
                          }}
                        >
                          {isChangingSubscription ? 'Processing...' : 'Subscribe'}
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              setIsChangingSubscription(true);
                              setSubscriptionError(null);
                              
                              if (!userCanisterId || !identity) {
                                setSubscriptionError('User authentication required');
                                return;
                              }

                              subscriptionService.setMainActor(mainActor);
                              const checkoutSession = await subscriptionService.changeSubscriptionTier(
                                plan.tier,
                                userCanisterId,
                                identity,
                                subscription.subscriptionId || undefined
                              );

                              if (checkoutSession) {
                                window.location.href = checkoutSession.url;
                              } else {
                                setSubscriptionError('Failed to change subscription. Please try again.');
                              }
                            } catch (error) {
                              setSubscriptionError(error instanceof Error ? error.message : 'Failed to change subscription');
                            } finally {
                              setIsChangingSubscription(false);
                            }
                          }}
                          disabled={isChangingSubscription}
                          className={`
                            w-full px-4 py-3 rounded-lg font-semibold transition-all duration-300
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${isUpgrade 
                              ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
                              : 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white'
                            }
                          `}
                        >
                          {isChangingSubscription 
                            ? 'Processing...' 
                            : isUpgrade 
                              ? 'Upgrade' 
                              : 'Downgrade'
                          }
                        </button>
                      )}
                    </div>
                  );
                  })}
                </div>
              )}
            </div>

            {/* Information */}
            <div className="rounded-xl p-4 lg:p-6" style={{ background: 'rgba(255, 107, 53, 0.1)', border: '1px solid var(--kontext-border-accent)' }}>
              <h4 className="text-base lg:text-lg font-semibold mb-3" style={{ color: 'var(--kontext-orange)' }}>About Subscription Changes</h4>
              <ul className="text-sm lg:text-base text-gray-300 space-y-2">
                <li>• Upgrades take effect immediately with prorated billing</li>
                <li>• Downgrades take effect at the end of your current billing period</li>
                <li>• Credits are adjusted based on your new plan</li>
                <li>• You can manage payment methods and billing in the Stripe portal</li>
              </ul>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Account Settings & Profile
            </h2>

            {isLoadingProfile ? (
              <div className="text-center py-16 lg:py-24">
                <div className="w-12 h-12 lg:w-16 lg:h-16 border-4 border-orange-500 border-opacity-20 border-t-orange-500 rounded-full animate-spin mx-auto mb-6"></div>
                <p className="text-gray-400 text-base lg:text-lg">Loading your preferences...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* User Profile Section */}
                <div className="rounded-xl p-6 lg:p-8" style={{
                  background: 'rgba(17, 17, 17, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <h3 className="text-lg lg:text-xl font-semibold mb-6" style={{ 
                    background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    👤 User Profile
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    {/* Username */}
                    <div>
                      <label className="block text-sm lg:text-base text-gray-400 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={profileForm.username || ''}
                        onChange={(e) => setProfileForm({...profileForm, username: e.target.value})}
                        placeholder="Enter username"
                        className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>

                    {/* Display Name */}
                    <div>
                      <label className="block text-sm lg:text-base text-gray-400 mb-2">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={profileForm.displayName || ''}
                        onChange={(e) => setProfileForm({...profileForm, displayName: e.target.value})}
                        placeholder="Enter display name"
                        className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm lg:text-base text-gray-400 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={profileForm.email || ''}
                        onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                        placeholder="Enter email"
                        className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>

                    {/* Website */}
                    <div>
                      <label className="block text-sm lg:text-base text-gray-400 mb-2">
                        Website
                      </label>
                      <input
                        type="url"
                        value={profileForm.website || ''}
                        onChange={(e) => setProfileForm({...profileForm, website: e.target.value})}
                        placeholder="https://..."
                        className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>

                    {/* GitHub */}
                    <div>
                      <label className="block text-sm lg:text-base text-gray-400 mb-2">
                        GitHub Username
                      </label>
                      <input
                        type="text"
                        value={profileForm.github || ''}
                        onChange={(e) => setProfileForm({...profileForm, github: e.target.value})}
                        placeholder="@username"
                        className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="mt-4 lg:mt-6">
                    <label className="block text-sm lg:text-base text-gray-400 mb-2">
                      Bio
                    </label>
                    <textarea
                      value={profileForm.bio || ''}
                      onChange={(e) => setProfileForm({...profileForm, bio: e.target.value})}
                      placeholder="Tell us about yourself..."
                      rows={4}
                      className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Social Links */}
                  <div className="mt-4 lg:mt-6">
                    <h4 className="text-base lg:text-lg font-semibold mb-4 text-white">🔗 Social Links</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">OpenChat</label>
                        <input
                          type="text"
                          value={profileForm.socials?.openchat || ''}
                          onChange={(e) => setProfileForm({
                            ...profileForm, 
                            socials: {...(profileForm.socials || {}), openchat: e.target.value}
                          })}
                          placeholder="OpenChat handle"
                          className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Twitter</label>
                        <input
                          type="text"
                          value={profileForm.socials?.twitter || ''}
                          onChange={(e) => setProfileForm({
                            ...profileForm, 
                            socials: {...(profileForm.socials || {}), twitter: e.target.value}
                          })}
                          placeholder="@username"
                          className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Discord</label>
                        <input
                          type="text"
                          value={profileForm.socials?.discord || ''}
                          onChange={(e) => setProfileForm({
                            ...profileForm, 
                            socials: {...(profileForm.socials || {}), discord: e.target.value}
                          })}
                          placeholder="username#0000"
                          className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Telegram</label>
                        <input
                          type="text"
                          value={profileForm.socials?.telegram || ''}
                          onChange={(e) => setProfileForm({
                            ...profileForm, 
                            socials: {...(profileForm.socials || {}), telegram: e.target.value}
                          })}
                          placeholder="@username"
                          className="w-full p-3 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* API Credentials Section */}
                <div className="rounded-xl p-6 lg:p-8" style={{
                  background: 'rgba(17, 17, 17, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <h3 className="text-lg lg:text-xl font-semibold mb-6" style={{ 
                    background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    🔑 API Credentials
                  </h3>
                  
                  <div>
                    <label className="block text-sm lg:text-base text-gray-400 mb-2">
                      GitHub Access Token
                    </label>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_..."
                      className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Used for repository access and deployments
                    </p>
                  </div>
                </div>

                {/* Notification Preferences Section */}
                <div className="rounded-xl p-6 lg:p-8" style={{
                  background: 'rgba(17, 17, 17, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <h3 className="text-lg lg:text-xl font-semibold mb-6" style={{ 
                    background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    🔔 Notification Preferences
                  </h3>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(55, 65, 81, 0.3)',
                      borderRadius: '8px',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <input
                        type="checkbox"
                        checked={preferencesForm.notificationPreferences?.channelPreferences?.email || false}
                        onChange={(e) => setPreferencesForm({
                          ...preferencesForm,
                          notificationPreferences: {
                            ...(preferencesForm.notificationPreferences || { channelPreferences: { email: false, discord: false, telegram: false, inApp: false } }),
                            channelPreferences: {
                              ...(preferencesForm.notificationPreferences?.channelPreferences || { email: false, discord: false, telegram: false, inApp: false }),
                              email: e.target.checked
                            }
                          }
                        })}
                        className="w-5 h-5"
                      />
                      <span className="text-sm text-white">📧 Email</span>
                    </div>
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(55, 65, 81, 0.3)',
                      borderRadius: '8px',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <input
                        type="checkbox"
                        checked={preferencesForm.notificationPreferences?.channelPreferences?.discord || false}
                        onChange={(e) => setPreferencesForm({
                          ...preferencesForm,
                          notificationPreferences: {
                            ...(preferencesForm.notificationPreferences || { channelPreferences: { email: false, discord: false, telegram: false, inApp: false } }),
                            channelPreferences: {
                              ...(preferencesForm.notificationPreferences?.channelPreferences || { email: false, discord: false, telegram: false, inApp: false }),
                              discord: e.target.checked
                            }
                          }
                        })}
                        className="w-5 h-5"
                      />
                      <span className="text-sm text-white">💬 Discord</span>
                    </div>
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(55, 65, 81, 0.3)',
                      borderRadius: '8px',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <input
                        type="checkbox"
                        checked={preferencesForm.notificationPreferences?.channelPreferences?.telegram || false}
                        onChange={(e) => setPreferencesForm({
                          ...preferencesForm,
                          notificationPreferences: {
                            ...(preferencesForm.notificationPreferences || { channelPreferences: { email: false, discord: false, telegram: false, inApp: false } }),
                            channelPreferences: {
                              ...(preferencesForm.notificationPreferences?.channelPreferences || { email: false, discord: false, telegram: false, inApp: false }),
                              telegram: e.target.checked
                            }
                          }
                        })}
                        className="w-5 h-5"
                      />
                      <span className="text-sm text-white">✈️ Telegram</span>
                    </div>
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(55, 65, 81, 0.3)',
                      borderRadius: '8px',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <input
                        type="checkbox"
                        checked={preferencesForm.notificationPreferences?.channelPreferences?.inApp || false}
                        onChange={(e) => setPreferencesForm({
                          ...preferencesForm,
                          notificationPreferences: {
                            ...(preferencesForm.notificationPreferences || { channelPreferences: { email: false, discord: false, telegram: false, inApp: false } }),
                            channelPreferences: {
                              ...(preferencesForm.notificationPreferences?.channelPreferences || { email: false, discord: false, telegram: false, inApp: false }),
                              inApp: e.target.checked
                            }
                          }
                        })}
                        className="w-5 h-5"
                      />
                      <span className="text-sm text-white">🔔 In-App</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="block text-sm lg:text-base text-gray-400 mb-2">
                      Digest Frequency
                    </label>
                    <select
                      value={preferencesForm.notificationPreferences?.digestFrequency || 'daily'}
                      onChange={(e) => setPreferencesForm({
                        ...preferencesForm,
                        notificationPreferences: {
                          ...(preferencesForm.notificationPreferences || { channelPreferences: { email: false, discord: false, telegram: false, inApp: false } }),
                          digestFrequency: e.target.value
                        }
                      })}
                      className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="realtime">Real-time</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                </div>

                {/* UI Preferences Section */}
                <div className="rounded-xl p-6 lg:p-8" style={{
                  background: 'rgba(17, 17, 17, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <h3 className="text-lg lg:text-xl font-semibold mb-6" style={{ 
                    background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    🎨 UI Preferences
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    <div>
                      <label className="block text-sm lg:text-base text-gray-400 mb-2">
                        Timezone
                      </label>
                      <input
                        type="text"
                        value={preferencesForm.timezone || 'UTC'}
                        onChange={(e) => setPreferencesForm({...preferencesForm, timezone: e.target.value})}
                        placeholder="UTC"
                        className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm lg:text-base text-gray-400 mb-2">
                        Default Visibility
                      </label>
                      <select
                        value={preferencesForm.defaultVisibility || 'Private'}
                        onChange={(e) => setPreferencesForm({...preferencesForm, defaultVisibility: e.target.value as any})}
                        className="w-full p-3 lg:p-4 rounded-lg border border-gray-600 border-opacity-50 bg-gray-800 bg-opacity-50 text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="Public">Public</option>
                        <option value="Private">Private</option>
                        <option value="Contacts">Contacts Only</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={saveAccountPreferences}
                  disabled={isSavingProfile}
                  className="w-full px-6 py-4 rounded-xl font-bold text-base lg:text-lg transition-all duration-300 ease-in-out"
                  style={{
                    background: isSavingProfile 
                      ? 'rgba(255, 107, 53, 0.3)' 
                      : 'linear-gradient(135deg, #f97316, #fbbf24)',
                    color: '#ffffff',
                    boxShadow: isSavingProfile 
                      ? 'none' 
                      : '0 4px 15px rgba(255, 107, 53, 0.4)',
                    opacity: isSavingProfile ? 0.6 : 1,
                    cursor: isSavingProfile ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSavingProfile) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isSavingProfile 
                      ? 'none' 
                      : '0 4px 15px rgba(255, 107, 53, 0.4)';
                  }}
                >
                  {isSavingProfile ? (
                    <div className="flex items-center justify-center gap-2 text-sm lg:text-base">
                      <div className="w-4 h-4 border-2 border-white border-opacity-30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </div>
                  ) : (
                    '💾 Save Account Preferences'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <div>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Usage Analytics
            </h2>
            
            <div className="rounded-xl p-8 lg:p-12 text-center" style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <div className="text-4xl lg:text-5xl xl:text-6xl mb-4 lg:mb-6">📊</div>
              <h3 className="text-lg lg:text-xl font-semibold mb-4 text-white">Analytics Dashboard</h3>
              <p className="text-gray-400 text-sm lg:text-base">
                Detailed usage analytics and reporting features are coming soon.
              </p>
            </div>
          </div>
        )}

        {/* ULTRA-ENHANCED: Hosting Tab with Maximum Parallelism and Lightning-Fast Operations */}
        {activeTab === 'hosting' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              🌐⚡ Ultra-Parallel Server Pair Management
            </h2>

            {/* ULTRA-ENHANCED: Performance Dashboard */}
            {(parallelOperationStats.totalOperations > 0 || cacheStats.lastUpdate > 0) && (
              <div className="rounded-xl p-4 lg:p-6 mb-6 lg:mb-8" style={{ 
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                <h3 className="text-base lg:text-lg font-semibold mb-4" style={{ 
                  background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontWeight: 600
                }}>
                  ⚡ Ultra-Parallel Performance Dashboard
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-black bg-opacity-30 rounded-lg p-3 text-center">
                    <div className="text-lg lg:text-xl font-bold text-purple-400">
                      {parallelOperationStats.lastLoadTime}ms
                    </div>
                    <div className="text-xs lg:text-sm text-gray-400">Last Load</div>
                  </div>
                  <div className="bg-black bg-opacity-30 rounded-lg p-3 text-center">
                    <div className="text-lg lg:text-xl font-bold text-green-400">
                      {parallelOperationStats.lastMoveTime}ms
                    </div>
                    <div className="text-xs lg:text-sm text-gray-400">Last Move</div>
                  </div>
                  <div className="bg-black bg-opacity-30 rounded-lg p-3 text-center">
                    <div className="text-lg lg:text-xl font-bold" style={{ color: 'var(--kontext-orange)' }}>
                      {parallelOperationStats.parallelEfficiency}%
                    </div>
                    <div className="text-xs lg:text-sm text-gray-400">Efficiency</div>
                  </div>
                  <div className="bg-black bg-opacity-30 rounded-lg p-3 text-center">
                    <div className="text-lg lg:text-xl font-bold text-orange-400">
                      {cacheStats.efficiency}%
                    </div>
                    <div className="text-xs lg:text-sm text-gray-400">Cache Hit</div>
                  </div>
                </div>
              </div>
            )}

            {/* ULTRA-ENHANCED: Summary Statistics with Performance Metrics */}
            {resolvedServerPairs.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 lg:mb-8">
                <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(255, 107, 53, 0.1)', border: '1px solid var(--kontext-border-accent)' }}>
                  <div className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--kontext-orange)' }}>{hostingStats.total}</div>
                  <div className="text-xs lg:text-sm text-gray-400">Total Pairs</div>
                </div>
                <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-lg p-4 text-center">
                  <div className="text-2xl lg:text-3xl font-bold text-green-400">{hostingStats.matched}</div>
                  <div className="text-xs lg:text-sm text-gray-400">Matched</div>
                </div>
                <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-lg p-4 text-center">
                  <div className="text-2xl lg:text-3xl font-bold text-yellow-400">{hostingStats.mismatched}</div>
                  <div className="text-xs lg:text-sm text-gray-400">Mismatched</div>
                </div>
                <div className="bg-gray-500 bg-opacity-10 border border-gray-500 border-opacity-30 rounded-lg p-4 text-center">
                  <div className="text-2xl lg:text-3xl font-bold text-gray-400">{hostingStats.unknown}</div>
                  <div className="text-xs lg:text-sm text-gray-400">Unknown</div>
                </div>
              </div>
            )}

            {isLoadingServerPairs ? (
              <div className="text-center py-12 lg:py-16 text-gray-400">
                <div className="w-10 h-10 lg:w-12 lg:h-12 border-3 border-purple-500 border-opacity-30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                <div className="text-base lg:text-lg font-semibold mb-2">Ultra-Parallel Processing Active</div>
                <div className="text-sm lg:text-base">Loading server pairs with maximum parallelism...</div>
                {parallelOperationStats.averageOperationTime > 0 && (
                  <div className="text-xs text-purple-400 mt-2">
                    Average operation time: {parallelOperationStats.averageOperationTime}ms
                  </div>
                )}
              </div>
            ) : (
              <div>
                {resolvedServerPairs.length === 0 ? (
                  <div className="rounded-xl p-8 lg:p-12 text-center" style={{ background: 'var(--kontext-glass-bg-light)', border: '1px solid var(--kontext-border-primary)' }}>
                    <div className="text-4xl lg:text-5xl xl:text-6xl mb-4 lg:mb-6 opacity-50">🌐</div>
                    <h3 className="text-lg lg:text-xl font-semibold mb-2 text-white">No Server Pairs Found</h3>
                    <p className="text-gray-400 text-sm lg:text-base">
                      Create server pairs in your projects to manage them here with ultra-parallel processing.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                    {resolvedServerPairs.map((serverPair) => (
                      <div
                        key={serverPair.pairId}
                        className="bg-gray-800 bg-opacity-50 border border-gray-600 border-opacity-50 rounded-xl p-4 lg:p-6 transition-all duration-200 hover:bg-gray-700 hover:bg-opacity-50 hover:border-purple-500 hover:border-opacity-50"
                      >
                        {/* ULTRA-ENHANCED: Server Pair Header with Performance Indicators */}
                        <div className="flex justify-between items-start mb-4 gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base lg:text-lg font-semibold mb-1 break-words text-white flex items-center gap-2">
                              🚀 {serverPair.name}
                              {serverPairProjectCache.has(serverPair.pairId) && (
                                <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(255, 107, 53, 0.2)', color: 'var(--kontext-orange)' }}>⚡ Cached</span>
                              )}
                            </h4>
                            <div className="text-xs lg:text-sm text-gray-400">
                              Created {new Date(serverPair.createdAt / 1_000_000).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="bg-green-500 bg-opacity-20 text-green-400 px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap">
                              {serverPair.creditsAllocated} Credits
                            </div>
                            {/* ULTRA-ENHANCED: Status with Performance Context */}
                            <div className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                              serverPair.status === 'matched' 
                                ? 'bg-green-500 bg-opacity-20 text-green-400'
                                : serverPair.status === 'mismatched'
                                ? 'bg-yellow-500 bg-opacity-20 text-yellow-400'
                                : 'bg-gray-500 bg-opacity-20 text-gray-400'
                            }`}>
                              {serverPair.status === 'matched' ? '✓ Matched' : 
                               serverPair.status === 'mismatched' ? '⚠ Mixed' : '? Unknown'}
                            </div>
                          </div>
                        </div>

                        {/* ULTRA-ENHANCED: Current Project Display with Cache Status */}
                        <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(255, 107, 53, 0.1)', border: '1px solid var(--kontext-border-accent)' }}>
                          <div className="flex justify-between items-center mb-1">
                            <div className="text-xs lg:text-sm text-purple-400 font-semibold">
                              Current Project Assignment
                            </div>
                            {serverPairProjectCache.has(serverPair.pairId) && (
                              <div className="text-xs text-purple-300">⚡ Fast</div>
                            )}
                          </div>
                          <div className="text-sm lg:text-base font-medium break-words text-white">
                            {serverPair.projectName || serverPair.projectId || 'Unassigned'}
                          </div>
                          {serverPair.statusDetails && (
                            <div className="text-xs text-gray-400 mt-1">
                              {serverPair.statusDetails}
                            </div>
                          )}
                        </div>

                        {/* ULTRA-ENHANCED: Project Selection with Smart Defaults */}
                        <div className="mb-4">
                          <label className="block text-xs lg:text-sm text-gray-400 mb-2 font-medium">
                            ⚡ Ultra-Fast Move to Project
                          </label>
                          <select
                            value={serverPairMoves[serverPair.pairId] || ''}
                            onChange={(e) => setServerPairMoves(prev => ({
                              ...prev,
                              [serverPair.pairId]: e.target.value
                            }))}
                            className="w-full p-2 lg:p-3 rounded-lg border text-sm lg:text-base focus:outline-none focus:ring-2 focus:border-transparent"
                            style={{
                              borderColor: 'var(--kontext-border-primary)',
                              background: 'var(--kontext-glass-bg-medium)',
                              color: 'var(--kontext-text-primary)'
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = 'var(--kontext-orange)';
                              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.2)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = 'var(--kontext-border-primary)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <option value="" className="bg-gray-800">Select a project for lightning-fast move...</option>
                            {userProjects
                              .filter(project => project.id !== serverPair.projectId) // Don't show current project
                              .map(project => (
                              <option key={project.id} value={project.id} className="bg-gray-800">
                                {project.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* ULTRA-ENHANCED: Server Details with Performance Context */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3 mb-4">
                          <div className="rounded-lg p-3" style={{ background: 'rgba(255, 107, 53, 0.1)', border: '1px solid var(--kontext-border-accent)' }}>
                            <div className="text-xs lg:text-sm mb-1" style={{ color: 'var(--kontext-orange)' }}>Frontend</div>
                            <div className="text-xs lg:text-sm font-mono break-all text-gray-300">
                              {typeof serverPair.frontendCanisterId === 'string' 
                                ? serverPair.frontendCanisterId.substring(0, 8) + '...'
                                : serverPair.frontendCanisterId.substring(0, 8) + '...'
                              }
                            </div>
                          </div>
                          <div className="bg-orange-500 bg-opacity-10 border border-orange-500 border-opacity-30 rounded-lg p-3">
                            <div className="text-xs lg:text-sm text-orange-400 mb-1">Backend</div>
                            <div className="text-xs lg:text-sm font-mono break-all text-gray-300">
                              {typeof serverPair.backendCanisterId === 'string'
                                ? serverPair.backendCanisterId.substring(0, 8) + '...'
                                : serverPair.backendCanisterId.substring(0, 8) + '...'
                              }
                            </div>
                          </div>
                        </div>

                        {/* ULTRA-ENHANCED: Move Button with Maximum Parallel Processing */}
                        <button
                          onClick={() => handleMoveServerPairUltraParallel(serverPair.pairId)}
                          disabled={!serverPairMoves[serverPair.pairId] || isMovingServerPair === serverPair.pairId}
                          className="w-full px-4 py-2 lg:py-3 rounded-lg font-semibold text-sm lg:text-base transition-all duration-300"
                          style={{
                            background: (!serverPairMoves[serverPair.pairId] || isMovingServerPair === serverPair.pairId)
                              ? 'rgba(255, 107, 53, 0.3)'
                              : 'var(--kontext-gradient-button)',
                            color: 'var(--kontext-text-primary)',
                            boxShadow: 'var(--kontext-shadow-primary)',
                            opacity: (!serverPairMoves[serverPair.pairId] || isMovingServerPair === serverPair.pairId) ? 0.6 : 1,
                            cursor: (!serverPairMoves[serverPair.pairId] || isMovingServerPair === serverPair.pairId) ? 'not-allowed' : 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            if (serverPairMoves[serverPair.pairId] && isMovingServerPair !== serverPair.pairId) {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = 'var(--kontext-shadow-interactive)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'var(--kontext-shadow-primary)';
                          }}
                        >
                          {isMovingServerPair === serverPair.pairId ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-3 h-3 border-2 border-white border-opacity-30 border-t-white rounded-full animate-spin"></div>
                              ⚡ Ultra-Parallel Moving...
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <span>🚀</span>
                              <span className="hidden sm:inline">Lightning-Fast Move</span>
                              <span className="sm:hidden">Fast Move</span>
                              {serverPairProjectCache.has(serverPair.pairId) && <span className="text-xs">⚡</span>}
                            </div>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Public Profile Editor */}
        {activeTab === 'publicprofile' && (
          <PublicProfileEditor 
            userCanisterId={userCanisterId} 
            identity={identity} 
          />
        )}

        {/* Marketplace Item Creator */}
        {activeTab === 'marketplace' && userCanisterId && identity && principal && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left" style={{ 
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              🛒 List on Marketplace
            </h2>
            
            <div className="rounded-xl p-6 lg:p-8" style={{
              background: 'rgba(17, 17, 17, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <MarketplaceItemCreator
                userCanisterId={userCanisterId}
                identity={identity}
                principal={principal}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Public Profile Editor Component
function PublicProfileEditor({ userCanisterId, identity }: { userCanisterId: string | null, identity: any }) {
  const principal = useAppStore(state => state.principal);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [profile, setProfile] = useState<any>({
    displayName: '',
    bio: '',
    tagline: '',
    avatarUrl: '',
    bannerUrl: '',
    location: '',
    timezone: '',
    website: '',
    email: '',
    socialLinks: {
      twitter: '',
      github: '',
      linkedin: '',
      discord: '',
      telegram: '',
      medium: '',
      youtube: '',
      custom: []
    },
    title: '',
    company: '',
    skills: [],
    interests: [],
    featuredProjects: [],
    showMarketplace: true,
    showStats: true,
    customSections: [],
    isPublic: true,
    theme: null
  });
  const [skillInput, setSkillInput] = useState('');
  const [interestInput, setInterestInput] = useState('');

  useEffect(() => {
    loadProfile();
  }, [userCanisterId]);

  const loadProfile = async () => {
    if (!userCanisterId || !identity) return;

    try {
      setLoading(true);
      const result = await userCanisterService.getPublicProfile(userCanisterId, identity);
      if (result) {
        setProfile(result);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userCanisterId || !identity) return;

    try {
      setSaving(true);
      setMessage(null);
      
      await userCanisterService.updatePublicProfile(userCanisterId, identity, profile);
      
      setMessage({ type: 'success', text: '✅ Profile updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: `❌ Failed to update profile: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !profile.skills.includes(skillInput.trim())) {
      setProfile({ ...profile, skills: [...profile.skills, skillInput.trim()] });
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setProfile({ ...profile, skills: profile.skills.filter((s: string) => s !== skill) });
  };

  const handleAddInterest = () => {
    if (interestInput.trim() && !profile.interests.includes(interestInput.trim())) {
      setProfile({ ...profile, interests: [...profile.interests, interestInput.trim()] });
      setInterestInput('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setProfile({ ...profile, interests: profile.interests.filter((i: string) => i !== interest) });
  };

  const copyProfileLink = () => {
    if (!principal) {
      setMessage({ type: 'error', text: '❌ Principal not available' });
      setTimeout(() => setMessage(null), 2000);
      return;
    }
    const link = `${window.location.origin}/profile/${principal}`;
    navigator.clipboard.writeText(link);
    setMessage({ type: 'success', text: '✅ Profile link copied to clipboard!' });
    setTimeout(() => setMessage(null), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', color: 'rgba(255, 255, 255, 0.6)' }}>
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h2 style={{ 
          fontSize: '2rem', 
          fontWeight: 700,
          background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          🎨 Your Public Profile
        </h2>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '1rem' }}>
          Create your professional Kontext Business Card
        </p>
        
        <button
          onClick={copyProfileLink}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
            border: 'none',
            borderRadius: '12px',
            color: '#ffffff',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '1rem'
          }}
        >
          📋 Copy Profile Link
        </button>
      </div>

      {message && (
        <div style={{
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          background: message.type === 'success' 
            ? 'rgba(16, 185, 129, 0.1)' 
            : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: message.type === 'success' ? '#10b981' : '#ef4444'
        }}>
          {message.text}
        </div>
      )}

      {/* Privacy Toggle */}
      <div style={{
        padding: '1.5rem',
        background: 'rgba(255, 107, 53, 0.1)',
        border: '1px solid rgba(255, 107, 53, 0.3)',
        borderRadius: '12px',
        marginBottom: '2rem'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={profile.isPublic}
            onChange={(e) => setProfile({ ...profile, isPublic: e.target.checked })}
            style={{ width: '20px', height: '20px' }}
          />
          <span style={{ fontWeight: 600 }}>
            {profile.isPublic ? '🌍 Public Profile' : '🔒 Private Profile'}
          </span>
        </label>
        <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.5rem', marginLeft: '2rem' }}>
          {profile.isPublic 
            ? 'Your profile is visible to everyone'
            : 'Only you can see your profile'}
        </p>
      </div>

      {/* Basic Info */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ffffff' }}>Basic Information</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Display Name
            </label>
            <input
              type="text"
              value={profile.displayName}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              placeholder="Your Name"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Tagline
            </label>
            <input
              type="text"
              value={profile.tagline}
              onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
              placeholder="Full-stack ICP Developer"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Title
            </label>
            <input
              type="text"
              value={profile.title}
              onChange={(e) => setProfile({ ...profile, title: e.target.value })}
              placeholder="Senior Developer"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Company
            </label>
            <input
              type="text"
              value={profile.company}
              onChange={(e) => setProfile({ ...profile, company: e.target.value })}
              placeholder="DFINITY Foundation"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Location
            </label>
            <input
              type="text"
              value={profile.location}
              onChange={(e) => setProfile({ ...profile, location: e.target.value })}
              placeholder="San Francisco, CA"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
            Bio
          </label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            placeholder="Tell the world about yourself..."
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#ffffff',
              resize: 'vertical'
            }}
          />
        </div>
      </div>

      {/* Contact & Social */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ffffff' }}>Contact & Social</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Website
            </label>
            <input
              type="url"
              value={profile.website}
              onChange={(e) => setProfile({ ...profile, website: e.target.value })}
              placeholder="https://yoursite.com"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              𝕏 Twitter
            </label>
            <input
              type="text"
              value={profile.socialLinks.twitter}
              onChange={(e) => setProfile({ 
                ...profile, 
                socialLinks: { ...profile.socialLinks, twitter: e.target.value }
              })}
              placeholder="username"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              🐙 GitHub
            </label>
            <input
              type="text"
              value={profile.socialLinks.github}
              onChange={(e) => setProfile({ 
                ...profile, 
                socialLinks: { ...profile.socialLinks, github: e.target.value }
              })}
              placeholder="username"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              💼 LinkedIn
            </label>
            <input
              type="text"
              value={profile.socialLinks.linkedin}
              onChange={(e) => setProfile({ 
                ...profile, 
                socialLinks: { ...profile.socialLinks, linkedin: e.target.value }
              })}
              placeholder="username"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff'
              }}
            />
          </div>
        </div>
      </div>

      {/* Skills */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ffffff' }}>Skills & Expertise</h3>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
            placeholder="Add a skill..."
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#ffffff'
            }}
          />
          <button
            onClick={handleAddSkill}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Add
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {profile.skills.map((skill: string) => (
            <div
              key={skill}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(255, 107, 53, 0.1)',
                border: '1px solid rgba(255, 107, 53, 0.3)',
                borderRadius: '8px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {skill}
              <button
                onClick={() => handleRemoveSkill(skill)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: '0'
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Display Settings */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ffffff' }}>Display Settings</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={profile.showStats}
              onChange={(e) => setProfile({ ...profile, showStats: e.target.checked })}
              style={{ width: '20px', height: '20px' }}
            />
            <span>Show project statistics (deployments, project count)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={profile.showMarketplace}
              onChange={(e) => setProfile({ ...profile, showMarketplace: e.target.checked })}
              style={{ width: '20px', height: '20px' }}
            />
            <span>Show marketplace listings</span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '1rem 3rem',
            background: saving 
              ? 'rgba(255, 107, 53, 0.5)' 
              : 'linear-gradient(135deg, #ff6b35, #f59e0b)',
            border: 'none',
            borderRadius: '12px',
            color: '#ffffff',
            fontSize: '1.1rem',
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 20px rgba(255, 107, 53, 0.4)',
            transition: 'all 0.3s ease'
          }}
        >
          {saving ? '💾 Saving...' : '💾 Save Profile'}
        </button>
      </div>
    </div>
  );
}