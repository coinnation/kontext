// Kontext App - Main Entry Point
// 🔥 FIX: Import React FIRST before anything else to prevent initialization errors
import React, { useState, useEffect, useRef, startTransition, Suspense } from 'react';

// Performance tracking
// 🔥 FIX: Don't import perf at module level - causes React initialization errors
// import { perf } from './utils/performance';

// 🚀 PWA OPTIMIZATION: Lazy load all conditional components for near-instant load times
const ChatInterface = React.lazy(async () => {
  // 🚀 PWA OPTIMIZATION: Check if ChatInterface was preloaded first
  try {
    const { chatPreloadService } = await import('./services/ChatPreloadService');
    const preloadedModule = await chatPreloadService.getPreloadedChat();
    
    if (preloadedModule && preloadedModule.ChatInterface) {
      console.log('✅ [PWA] ChatInterface loaded from preload cache - instant!');
      return { default: preloadedModule.ChatInterface };
    }
  } catch (error) {
    console.warn('⚠️ [PWA] Preload check failed, falling back to lazy load:', error);
  }
  
  // Fallback to normal lazy loading if preload not available
  const module = await import('./components/ChatInterface');
  console.log('✅ [PWA] ChatInterface lazy loaded (preload not available)');
  return { default: module.ChatInterface };
});

const InitializationOverlay = React.lazy(() => 
  import('./components/InitializationOverlay').then(module => {
    console.log('✅ [PWA] InitializationOverlay lazy loaded');
    return { default: module.InitializationOverlay };
  })
);

const AdminInterface = React.lazy(() => 
  import('./components/AdminInterface').then(module => {
    console.log('✅ [PWA] AdminInterface lazy loaded');
    return { default: module.AdminInterface };
  })
);

const ProfileInterface = React.lazy(() => 
  import('./components/ProfileInterface').then(module => {
    console.log('✅ [PWA] ProfileInterface lazy loaded');
    return { default: module.ProfileInterface };
  })
);

const DocumentationInterface = React.lazy(() => 
  import('./components/DocumentationInterface').then(module => {
    console.log('✅ [PWA] DocumentationInterface lazy loaded');
    return { default: module.DocumentationInterface };
  })
);

const MarketplaceStore = React.lazy(() => 
  import('./components/MarketplaceStore').then(module => {
    console.log('✅ [PWA] MarketplaceStore lazy loaded');
    return { default: module.MarketplaceStore };
  })
);

const UniversityApp = React.lazy(() =>
  import('./components/university/UniversityApp').then(module => {
    console.log('✅ [PWA] UniversityApp lazy loaded');
    return { default: module.UniversityApp };
  })
);

const PlatformForum = React.lazy(() =>
  import('./components/PlatformForum').then(module => {
    console.log('✅ [PWA] PlatformForum lazy loaded');
    return { default: module.PlatformForum };
  })
);

const UserProfilePage = React.lazy(() =>
  import('./components/UserProfilePage').then(module => {
    console.log('✅ [PWA] UserProfilePage lazy loaded');
    return { default: module.UserProfilePage };
  })
);

const SubscriptionSelectionInterface = React.lazy(() => 
  import('./components/SubscriptionSelectionInterface').then(module => {
    console.log('✅ [PWA] SubscriptionSelectionInterface lazy loaded');
    return { default: module.SubscriptionSelectionInterface };
  })
);

const InitializationRecoveryDialog = React.lazy(() => 
  import('./components/InitializationRecoveryDialog').then(module => {
    console.log('✅ [PWA] InitializationRecoveryDialog lazy loaded');
    return { default: module.InitializationRecoveryDialog };
  })
);

// Keep these eagerly loaded as they're always visible on landing page
import { UserDropdown } from './components/UserDropdown';
import { RenewalWarningBanner } from './components/RenewalWarningBanner';
import { KontextLoadingScreen } from './components/KontextLoadingScreen';

// Store hooks
import { useAppStore, useAuth, useInitialization, useSubscription } from './store/appStore';

// Types
import { SubscriptionTier, PaymentProcessingState, PaymentProcessingError } from './types';

// Services
// 🚀 PWA OPTIMIZATION: Lazy load services that aren't needed on initial render
import { optimizedInitializationService } from './services/OptimizedInitialization';
// 🔥 FIX: Import preload services lazily to prevent early Monaco initialization
// import { monacoPreloadService } from './services/MonacoPreloadService';
// import { chatPreloadService } from './services/ChatPreloadService';
// Note: StripeService, WasmDeploymentService, etc. are lazy-loaded when needed

// Styles
import './styles.css';


function AppContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // 🔥 FIX: Persist UI state across page refreshes using localStorage
  const [showChat, setShowChat] = useState(() => {
    try {
      return localStorage.getItem('ui-state-showChat') === 'true';
    } catch {
      return false;
    }
  });
  const [showAdmin, setShowAdmin] = useState(() => {
    try {
      return localStorage.getItem('ui-state-showAdmin') === 'true';
    } catch {
      return false;
    }
  });
  const [showProfile, setShowProfile] = useState(() => {
    try {
      return localStorage.getItem('ui-state-showProfile') === 'true';
    } catch {
      return false;
    }
  });
  const [showDocumentation, setShowDocumentation] = useState(() => {
    try {
      return localStorage.getItem('ui-state-showDocumentation') === 'true';
    } catch {
      return false;
    }
  });
  const [showMarketplace, setShowMarketplace] = useState(() => {
    try {
      return localStorage.getItem('ui-state-showMarketplace') === 'true';
    } catch {
      return false;
    }
  });

  const [showUniversity, setShowUniversity] = useState(() => {
    try {
      return localStorage.getItem('ui-state-showUniversity') === 'true';
    } catch {
      return false;
    }
  });

  const [showForum, setShowForum] = useState(() => {
    try {
      return localStorage.getItem('ui-state-showForum') === 'true';
    } catch {
      return false;
    }
  });
  
  const [isRedirectingToSubscription, setIsRedirectingToSubscription] = useState(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  
  // NEW: Store pending subscription tier selection (for auto-continue after login)
  const [pendingSubscriptionTier, setPendingSubscriptionTier] = useState<SubscriptionTier | null>(null);
  
  // NEW: Monaco preload state tracking
  const [monacoPreloadState, setMonacoPreloadState] = useState<{
    hasStarted: boolean;
    isComplete: boolean;
    isInProgress: boolean;
  }>({
    hasStarted: false,
    isComplete: false,
    isInProgress: false
  });

  // 🚀 PWA OPTIMIZATION: Track ChatInterface preload state
  const [chatPreloadState, setChatPreloadState] = useState<{
    hasStarted: boolean;
    isComplete: boolean;
    isInProgress: boolean;
  }>({
    hasStarted: false,
    isComplete: false,
    isInProgress: false
  });
  
  // NEW: Payment processing state
  const [paymentProcessingState, setPaymentProcessingState] = useState<PaymentProcessingState>({
    isProcessing: false,
    stage: null,
    progress: 0,
    message: '',
    error: null,
    sessionId: null
  });

  // Get state and actions from Zustand store
  const {
    stage,
    progress,
    error,
    isReady,
    clearError,
    retryInitialization,
    setStage
  } = useInitialization();

  const {
    isAuthenticated,
    principal,
    identity,
    login,
    logout,
    initializeAuth
  } = useAuth();

  // Subscription state and actions
  const {
    subscription,
    completeSubscriptionSetup,
    syncSubscriptionWithStripe,
    isSubscriptionActiveForFeatureAccess,
    handleSubscriptionRenewal,
    getRenewalStatus,
    getDaysUntilExpiration,
    dismissRenewalWarning,
    selectSubscriptionTier,
    hideSubscriptionSelection,
    showSubscriptionSelection,
    handleSubscriptionChange
  } = useSubscription();

  // Get initialization recovery state (must be declared before useEffect that uses it)
  const initializationRecovery = useAppStore(state => state.initializationRecovery);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);

  // Show recovery dialog when recovery is needed
  useEffect(() => {
    if (initializationRecovery?.needsRecovery && !showRecoveryDialog) {
      setShowRecoveryDialog(true);
    } else if (!initializationRecovery?.needsRecovery && showRecoveryDialog) {
      setShowRecoveryDialog(false);
    }
  }, [initializationRecovery?.needsRecovery, showRecoveryDialog]);

  // Handler for retrying initialization
  const handleRecoveryRetry = async () => {
    if (!principal || !initializationRecovery) return;

    const { initializationRecoveryService } = await import('./services/InitializationRecoveryService');
    const recoveryInfo = initializationRecoveryService.getRecoveryInfo(principal.toString());
    
    if (!recoveryInfo.state) {
      console.error('No recovery state found');
      return;
    }

    const state = recoveryInfo.state;

    // Retry with the stored subscription data
    try {
      setPaymentProcessingState({
        isProcessing: true,
        stage: 'CREATING_CANISTER',
        progress: 10,
        message: 'Retrying account setup...',
        error: null,
        sessionId: state.sessionId || null
      });

      const success = await completeSubscriptionSetup({
        tier: (state.subscriptionTier as SubscriptionTier) || SubscriptionTier.STARTER,
        monthlyCredits: state.monthlyCredits || 10000,
        customerId: state.customerId || undefined,
        subscriptionId: state.subscriptionId || undefined,
        billingCycleStart: state.billingCycleStart || undefined,
        billingCycleEnd: state.billingCycleEnd || undefined,
        sessionId: state.sessionId || undefined
      });

      if (success) {
        setShowRecoveryDialog(false);
        setPaymentProcessingState({
          isProcessing: false,
          stage: null,
          progress: 0,
          message: '',
          error: null,
          sessionId: null
        });
      }
    } catch (error) {
      console.error('Recovery retry failed:', error);
      setPaymentProcessingState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Retry failed',
        stage: null,
        isProcessing: false
      }));
    }
  };

  // Get full app store for optimization
  const appStore = useAppStore();
  const setMobile = useAppStore(state => state.setMobile);

  // Check if user is admin
  const ADMIN_PRINCIPALS = [
    "li46q-ibtpp-tv7ld-kbpqz-x6tra-qwarp-b4g4o-gzam2-jaxig-qeuwa-xqe",
    "bvpvy-zi75h-rmbcb-56guz-cscdg-apewo-gl6jq-f2t7y-rzcqa-zpilt-eqe"
  ];
  const isAdmin = principal ? ADMIN_PRINCIPALS.includes(principal.toString()) : false;

  // NEW: Renewal state
  const renewalStatus = getRenewalStatus();
  const daysUntilExpiration = getDaysUntilExpiration();
  const showRenewalWarning = isAuthenticated && 
    stage === 'READY' && 
    renewalStatus === 'WARNING' && 
    !subscription.renewalWarningDismissed &&
    subscription.currentTier !== SubscriptionTier.FREE;

  // NEW: Get subscription selection UI state (must be declared before useEffect that uses it)
  const showSubscriptionSelectionUI = useAppStore(state => state.ui.showSubscriptionSelection);

  // 🔥 FIX: Persist UI state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('ui-state-showChat', String(showChat));
    } catch (e) {
      console.warn('Failed to persist showChat state:', e);
    }
  }, [showChat]);

  useEffect(() => {
    try {
      localStorage.setItem('ui-state-showAdmin', String(showAdmin));
    } catch (e) {
      console.warn('Failed to persist showAdmin state:', e);
    }
  }, [showAdmin]);

  useEffect(() => {
    try {
      localStorage.setItem('ui-state-showProfile', String(showProfile));
    } catch (e) {
      console.warn('Failed to persist showProfile state:', e);
    }
  }, [showProfile]);

  useEffect(() => {
    try {
      localStorage.setItem('ui-state-showDocumentation', String(showDocumentation));
    } catch (e) {
      console.warn('Failed to persist showDocumentation state:', e);
    }
  }, [showDocumentation]);

  // 🔥 FIX: Restore UI state from localStorage when app is ready and authenticated
  // Use a ref to track if we've already restored to avoid multiple restorations
  const hasRestoredState = useRef(false);
  
  useEffect(() => {
    // Only restore state when app is ready and user is authenticated, and we haven't restored yet
    if (stage === 'READY' && isAuthenticated && !hasRestoredState.current) {
      try {
        const savedShowChat = localStorage.getItem('ui-state-showChat') === 'true';
        const savedShowAdmin = localStorage.getItem('ui-state-showAdmin') === 'true';
        const savedShowProfile = localStorage.getItem('ui-state-showProfile') === 'true';
        const savedShowDocumentation = localStorage.getItem('ui-state-showDocumentation') === 'true';

        // Restore saved state
        if (savedShowChat) setShowChat(true);
        if (savedShowAdmin) setShowAdmin(true);
        if (savedShowProfile) setShowProfile(true);
        if (savedShowDocumentation) setShowDocumentation(true);
        
        hasRestoredState.current = true;
      } catch (e) {
        console.warn('Failed to restore UI state from localStorage:', e);
      }
    }
    
    // Reset restoration flag when user logs out or app becomes unready
    if (stage !== 'READY' || !isAuthenticated) {
      hasRestoredState.current = false;
    }
  }, [stage, isAuthenticated]); // Only run when stage or auth status changes

  // 🔥 FIX: Ensure page sections are ALWAYS visible when returning to landing page
  useEffect(() => {
    // Run whenever we're on the landing page (chat/admin/profile/subscription/documentation/marketplace/university/forum closed)
    if (!showChat && !showAdmin && !showProfile && !showSubscriptionSelectionUI && !showDocumentation && !showMarketplace && !showUniversity && !showForum && stage === 'READY') {
      // Function to force visibility of all sections
      const ensureSectionsVisible = () => {
        const sectionsToRestore = [
          '.features',
          '.trust',
          '.testimonials',
          '.cta-section',
          '.footer'
        ];

        sectionsToRestore.forEach((selector) => {
          const section = document.querySelector(selector);
          if (section instanceof HTMLElement) {
            const computedStyle = window.getComputedStyle(section);
            
            // Remove any hiding styles - be aggressive about it
            if (computedStyle.display === 'none') {
              section.style.display = '';
            }
            if (computedStyle.visibility === 'hidden') {
              section.style.visibility = 'visible';
            }
            if (computedStyle.opacity === '0') {
              section.style.opacity = '1';
            }
            
            // Ensure proper height
            if (computedStyle.height === '0px') {
              section.style.height = '';
            }
            if (computedStyle.minHeight === '0px') {
              section.style.minHeight = '';
            }
            
            // Force reflow to ensure styles are applied
            void section.offsetHeight;

            // 🔥 CRITICAL FIX: Also ensure all animate-on-scroll elements within sections are visible
            const animatedElements = section.querySelectorAll('.animate-on-scroll');
            animatedElements.forEach((el) => {
              if (el instanceof HTMLElement) {
                // Force the animated class to be added
                el.classList.add('animated');
                // Also force visibility via inline styles
                el.style.opacity = '1';
                el.style.visibility = 'visible';
                el.style.transform = 'translateY(0)';
              }
            });
          }
        });

        // 🔥 ADDITIONAL FIX: Re-trigger IntersectionObserver for all animate-on-scroll elements
        // This ensures elements that weren't in viewport get animated when returning
        const allAnimatedElements = document.querySelectorAll('.animate-on-scroll');
        allAnimatedElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            // Force visibility immediately
            el.classList.add('animated');
            el.style.opacity = '1';
            el.style.visibility = 'visible';
            el.style.transform = 'translateY(0)';
          }
        });

        // Ensure body/html are scrollable
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.height = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.height = '';
      };

      // Run immediately
      ensureSectionsVisible();

      // Also run after a short delay to catch any late-rendering issues
      const timeoutId = setTimeout(() => {
        ensureSectionsVisible();
      }, 200);

      // Run again after React has fully rendered
      const secondTimeoutId = setTimeout(() => {
        ensureSectionsVisible();
      }, 500);

      // Run one more time to catch any animation delays
      const thirdTimeoutId = setTimeout(() => {
        ensureSectionsVisible();
      }, 1000);

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(secondTimeoutId);
        clearTimeout(thirdTimeoutId);
      };
    }
  }, [showChat, showAdmin, showProfile, showSubscriptionSelectionUI, showDocumentation, showMarketplace, showUniversity, showForum, stage]);

  // 🔥 ADDITIONAL FIX: Re-initialize page animations when returning to landing page
  useEffect(() => {
    // When returning from admin/profile/subscription/documentation/marketplace/university/forum to landing page
    if (!showChat && !showAdmin && !showProfile && !showSubscriptionSelectionUI && !showDocumentation && !showMarketplace && !showUniversity && !showForum && stage === 'READY' && pageLoaded) {
      const timeoutId = setTimeout(() => {
        // Re-trigger all animate-on-scroll elements to be visible
        document.querySelectorAll('.animate-on-scroll').forEach((el) => {
          if (el instanceof HTMLElement) {
            el.classList.add('animated');
            el.style.opacity = '1';
            el.style.visibility = 'visible';
            el.style.transform = 'translateY(0)';
          }
        });

        // Ensure all sections are visible
        const sectionsToRestore = [
          '.features',
          '.trust',
          '.testimonials',
          '.cta-section',
          '.footer'
        ];

        sectionsToRestore.forEach((selector) => {
          const section = document.querySelector(selector);
          if (section instanceof HTMLElement) {
            section.style.display = '';
            section.style.visibility = 'visible';
            section.style.opacity = '1';
          }
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [showChat, showAdmin, showProfile, showSubscriptionSelectionUI, showDocumentation, showMarketplace, showUniversity, showForum, stage, pageLoaded]);

  // 🔥 CRITICAL FIX: Check for Stripe return and initialize auth IMMEDIATELY
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasStripeReturn = urlParams.get('session_id') && 
      (urlParams.get('subscription_success') || urlParams.get('subscription_change_success'));
    
    if (hasStripeReturn) {
      console.log('🔥 [App] Stripe return detected - AGGRESSIVE auth restoration mode activated');
      
      // AGGRESSIVE: Try to restore auth BEFORE normal initialization
      const aggressiveRestore = async () => {
        try {
          const { getSharedAuthClient } = await import('./services/SharedAuthClient');
          const authClient = await getSharedAuthClient();
          
          // 🔥 STEP 1: Check if delegation chain is in localStorage (backup from before redirect)
          const storedDelegation = localStorage.getItem('stripe_redirect_delegation');
          console.log('🔍 [App] Checking for delegation backup:', { 
            exists: !!storedDelegation, 
            size: storedDelegation ? `${(storedDelegation.length / 1024).toFixed(2)} KB` : 'N/A'
          });
          
          if (storedDelegation) {
            console.log('🔄 [App] Found delegation chain backup in localStorage - restoring to IndexedDB...');
            
            try {
              // 🔍 VERIFIED: These are the correct values from @dfinity/auth-client source code
              const IDB_KEY = 'delegation'; // ✅ FIXED: Was 'ic-delegation', should be 'delegation'
              const IDB_DB_NAME = 'auth-client-db';
              const IDB_STORE_NAME = 'ic-keyval';
              
              console.log('📦 [App] IndexedDB Config:', { IDB_KEY, IDB_DB_NAME, IDB_STORE_NAME });
              
              // 🔥 CRITICAL: auth-client stores delegation as JSON STRING
              // We should restore it AS-IS (as a string), not parse it first
              console.log('✅ [App] Delegation string loaded:', {
                type: typeof storedDelegation,
                isString: typeof storedDelegation === 'string',
                length: storedDelegation.length
              });
              
              // Parse only to check expiration, but we'll store the original string
              try {
                const delegationObj = JSON.parse(storedDelegation);
                console.log('✅ [App] Delegation parsed for validation:', {
                  type: typeof delegationObj,
                  hasChain: !!delegationObj.delegationChain,
                  chainLength: delegationObj.delegationChain?.length
                });
                
                // Check expiration
                const expiration = delegationObj.delegationChain?.[0]?.delegation?.expiration;
                if (expiration) {
                  const expirationMs = Number(expiration) / 1_000_000;
                  const expiresIn = expirationMs - Date.now();
                  console.log('⏰ [App] Delegation expires in:', Math.floor(expiresIn / 1000 / 60), 'minutes');
                  
                  if (expiresIn < 0) {
                    console.error('❌ [App] Delegation is EXPIRED! Cannot restore.');
                    localStorage.removeItem('stripe_redirect_delegation');
                    throw new Error('Delegation expired');
                  }
                }
              } catch (parseError) {
                console.error('❌ [App] Failed to parse delegation for validation:', parseError);
                localStorage.removeItem('stripe_redirect_delegation');
                throw parseError;
              }
              
              await new Promise<void>((resolve, reject) => {
                const idbRequest = indexedDB.open(IDB_DB_NAME);
                
                idbRequest.onsuccess = () => {
                  console.log('✅ [App] IndexedDB opened successfully');
                  const db = idbRequest.result;
                  const transaction = db.transaction([IDB_STORE_NAME], 'readwrite');
                  const store = transaction.objectStore(IDB_STORE_NAME);
                  // 🔥 FIX: Store AS-IS (as string), don't parse first
                  const putRequest = store.put(storedDelegation, IDB_KEY);
                  
                  putRequest.onsuccess = () => {
                    console.log('✅ [App] Delegation chain restored to IndexedDB!');
                    localStorage.removeItem('stripe_redirect_delegation');
                    resolve();
                  };
                  
                  putRequest.onerror = (event) => {
                    console.error('❌ [App] Failed to restore delegation to IndexedDB:', event);
                    reject(new Error('IndexedDB put failed'));
                  };
                };
                
                idbRequest.onerror = (event) => {
                  console.error('❌ [App] Failed to open IndexedDB for restoration:', event);
                  reject(new Error('IndexedDB open failed'));
                };
              });
              
              // Give IndexedDB a moment to propagate
              await new Promise(resolve => setTimeout(resolve, 200));
              console.log('✅ [App] IndexedDB propagation delay complete');
              
            } catch (restoreError) {
              console.error('❌ [App] Delegation restoration failed:', restoreError);
              console.log('⚠️  [App] Will attempt to get identity from AuthClient anyway...');
            }
          } else {
            console.warn('⚠️  [App] No delegation backup found in localStorage');
          }
          
          // 🔥 STEP 2: Get identity directly from AuthClient
          console.log('🔄 [App] Getting identity directly from AuthClient (aggressive mode)...');
          const identity = authClient.getIdentity();
          const restoredPrincipal = identity.getPrincipal();
          
          console.log('🔍 [App] Identity from AuthClient:', restoredPrincipal.toString());
          
          // Check if it's a real identity (not anonymous)
          if (restoredPrincipal.toString() !== '2vxsx-fae') {
            console.log('✅ [App] AGGRESSIVE RESTORE SUCCESS - found real identity!');
            
            // Force update the store immediately using the proper setter
            const state = (useAppStore as any).getState();
            console.log('🔍 [App] Calling setAuth with restored identity...');
            
            // Use the setAuth method from authSlice
            if (state.setAuth) {
              state.setAuth(true, restoredPrincipal, identity, authClient);
              console.log('✅ [App] Auth state forcefully restored using setAuth()');
            } else {
              console.error('❌ [App] setAuth method not found in store!');
            }
          } else {
            console.warn('⚠️ [App] Got anonymous identity - delegation may have expired');
          }
          
          // Now run normal init
          await initializeAuth();
          console.log('✅ [App] Auth initialized for Stripe return');
          
          // Wait for auth state to propagate
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          setStripeAuthReady(true);
          console.log('✅ [App] Stripe auth ready flag set');
        } catch (error) {
          console.error('❌ [App] Failed to initialize auth for Stripe return:', error);
          // Still set ready so handler can proceed
          setStripeAuthReady(true);
        }
      };
      
      aggressiveRestore();
    } else {
      // Not a Stripe return, mark as ready immediately
      setStripeAuthReady(true);
    }
  }, [initializeAuth]); // Run once on mount, stripeAuthReady is set inside

  // 🚀 PWA OPTIMIZATION: Defer initialization until after first paint for instant load (UNLESS returning from Stripe)
  useEffect(() => {
    // Check if we're returning from Stripe - if so, skip deferred init (already handled above)
    const urlParams = new URLSearchParams(window.location.search);
    const hasStripeReturn = urlParams.get('session_id') && 
      (urlParams.get('subscription_success') || urlParams.get('subscription_change_success'));
    
    if (hasStripeReturn) {
      console.log('⏭️ [App] Skipping deferred initialization - already initialized for Stripe return');
      return;
    }

    // Use requestIdleCallback or setTimeout to defer non-critical initialization
    const deferInit = () => {
      const initializeOptimized = async () => {
        try {
          console.log('🚀 [App] Starting optimized initialization...');
          
          // Use your existing optimized initialization service
          await optimizedInitializationService.optimizeInitialization(
            appStore.principal || null,
            appStore.identity || null,
            appStore,
            appStore
          );
          
        } catch (error) {
          console.error('❌ [App] Optimized initialization failed, falling back:', error);
          
          // Fall back to regular initialization
          try {
            await appStore.initializeAuth();
          } catch (fallbackError) {
            console.error('❌ [App] Fallback initialization also failed:', fallbackError);
          }
        }
      };

      initializeOptimized();
    };

    // Defer initialization to allow first paint
    if ('requestIdleCallback' in window) {
      requestIdleCallback(deferInit, { timeout: 2000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(deferInit, 100);
    }
  }, [initializeAuth]); // Empty dependency array - only run once on mount

  // NEW: Smart Monaco background preloading after initial render
  useEffect(() => {
    const startMonacoPreload = async () => {
      try {
        // Wait for the page to be loaded and rendered
        if (!pageLoaded) return;
        
        console.log('🎨 [Monaco] Checking conditions for background preload...');
        
        // Only start preload if conditions are favorable
        const shouldPreload = 
          // Page is ready
          pageLoaded && 
          // App initialization is complete (no errors)
          stage !== 'ERROR' &&
          // Not in the middle of critical operations
          !paymentProcessingState.isProcessing &&
          !isRedirectingToSubscription;
        
        if (!shouldPreload) {
          console.log('⏸️ [Monaco] Deferring preload - waiting for better conditions');
          return;
        }
        
        console.log('🚀 [Monaco] Starting intelligent background preload...');
        
        // Update state to reflect preload start
        setMonacoPreloadState(prev => ({
          ...prev,
          hasStarted: true,
          isInProgress: true
        }));
        
        // 🔥 DISABLED: Monaco preload causes serviceIds error with DFX deployment
        // Monaco will be loaded on-demand when SidePane is opened instead
        console.log('⚠️  [Monaco] Background preload DISABLED - will load on-demand');
        setMonacoPreloadState(prev => ({
          ...prev,
          isComplete: false,
          isInProgress: false
        }));
        
        // // Start background preload (non-blocking)
        // monacoPreloadService.startBackgroundPreload().then(() => {
        //   console.log('✅ [Monaco] Background preload completed successfully!');
        //   setMonacoPreloadState(prev => ({
        //     ...prev,
        //     isComplete: true,
        //     isInProgress: false
        //   }));
        // }).catch((error) => {
        //   console.warn('⚠️ [Monaco] Background preload failed (graceful fallback):', error);
        //   setMonacoPreloadState(prev => ({
        //     ...prev,
        //     isComplete: false,
        //     isInProgress: false
        //   }));
        // });
        
      } catch (error) {
        console.error('❌ [Monaco] Error in preload initialization:', error);
        setMonacoPreloadState(prev => ({
          ...prev,
          isComplete: false,
          isInProgress: false
        }));
      }
    };

    // Use requestIdleCallback for optimal timing, fallback to setTimeout
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(startMonacoPreload, { timeout: 3000 });
    } else {
      setTimeout(startMonacoPreload, 2000);
    }
  }, [pageLoaded, stage, paymentProcessingState.isProcessing, isRedirectingToSubscription]);

  // ENHANCED: Smart Monaco preload triggers based on user behavior
  useEffect(() => {
    if (monacoPreloadState.hasStarted || !pageLoaded) return;
    
    let interactionTimer: NodeJS.Timeout | null = null;
    
    const handleUserInteraction = () => {
      if (interactionTimer) return; // Already scheduled
      
      // Delay slightly to avoid interfering with the user's action
      interactionTimer = setTimeout(() => {
        if (!monacoPreloadState.hasStarted) {
          // 🔥 DISABLED: Monaco preload causes serviceIds error with DFX deployment
          console.log('👆 [Monaco] User interaction detected - preload DISABLED (will load on-demand)');
          // if ('requestIdleCallback' in window) {
          //   (window as any).requestIdleCallback(() => {
          //     monacoPreloadService.startBackgroundPreload();
          //   });
          // } else {
          //   setTimeout(() => {
          //     monacoPreloadService.startBackgroundPreload();
          //   }, 100);
          // }
          // setMonacoPreloadState(prev => ({ ...prev, hasStarted: true, isInProgress: true }));
        }
        interactionTimer = null;
      }, 500);
    };
    
    // Listen for various user interaction signals
    const events = ['mousemove', 'scroll', 'keydown', 'click', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { passive: true, once: true });
    });
    
    return () => {
      if (interactionTimer) {
        clearTimeout(interactionTimer);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [pageLoaded, monacoPreloadState.hasStarted]);

  // ENHANCED: Authentication-based Monaco preloading
  // 🚀 PWA OPTIMIZATION: Defer Monaco preload significantly for instant initial load
  useEffect(() => {
    // When user successfully logs in, they're likely to use the editor soon
    if (isAuthenticated && stage === 'READY' && !monacoPreloadState.hasStarted) {
      console.log('🔐 [Monaco] User authenticated successfully - scheduling deferred preload');
      
      // 🚀 PWA: Defer Monaco preload longer to prioritize initial page load
      const preloadMonaco = () => {
        if (!monacoPreloadState.hasStarted) {
          // 🔥 DISABLED: Monaco preload causes serviceIds error with DFX deployment
          console.log('🔐 [Monaco] Preload DISABLED - will load on-demand');
          // monacoPreloadService.startBackgroundPreload();
          // setMonacoPreloadState(prev => ({ 
          //   ...prev, 
          //   hasStarted: true, 
          //   isInProgress: true 
          // }));
        }
      };

      // Use requestIdleCallback with longer timeout for non-blocking preload
      if ('requestIdleCallback' in window) {
        requestIdleCallback(preloadMonaco, { timeout: 8000 }); // 8 second timeout
      } else {
        setTimeout(preloadMonaco, 3000); // 3 second delay for browsers without requestIdleCallback
      }
    }
  }, [isAuthenticated, stage, monacoPreloadState.hasStarted]);

  // 🚀 PWA OPTIMIZATION: Preload ChatInterface in background after user is authenticated
  useEffect(() => {
    // When user successfully logs in, they're likely to use chat soon
    if (isAuthenticated && stage === 'READY' && !chatPreloadState.hasStarted) {
      console.log('💬 [Chat] User authenticated successfully - scheduling ChatInterface preload');
      
      // 🚀 PWA: Defer ChatInterface preload to prioritize initial page load
      const preloadChat = () => {
        if (!chatPreloadState.hasStarted) {
          // 🔥 DISABLED: Chat preload loads ChatInterface which triggers Monaco initialization error
          console.log('💬 [Chat] Chat preload DISABLED - will load on-demand');
          // chatPreloadService.startBackgroundPreload().then(() => {
          //   console.log('✅ [Chat] Background preload completed successfully!');
          //   setChatPreloadState(prev => ({
          //     ...prev,
          //     isComplete: true,
          //     isInProgress: false
          //   }));
          // }).catch((error) => {
          //   console.warn('⚠️ [Chat] Background preload failed (graceful fallback):', error);
          //   setChatPreloadState(prev => ({
          //     ...prev,
          //     isComplete: false,
          //     isInProgress: false
          //   }));
          // });
          
          // setChatPreloadState(prev => ({ 
          //   ...prev, 
          //   hasStarted: true, 
          //   isInProgress: true 
          // }));
        }
      };

      // Use requestIdleCallback with timeout for non-blocking preload
      // Start slightly after Monaco to stagger resource usage
      if ('requestIdleCallback' in window) {
        requestIdleCallback(preloadChat, { timeout: 10000 }); // 10 second timeout
      } else {
        setTimeout(preloadChat, 4000); // 4 second delay (after Monaco's 3s)
      }
    }
  }, [isAuthenticated, stage, chatPreloadState.hasStarted]);

  // 🚀 PWA OPTIMIZATION: Smart ChatInterface preload on user interaction (similar to Monaco)
  useEffect(() => {
    // Only preload if user is authenticated and ready, and preload hasn't started
    if (!isAuthenticated || stage !== 'READY' || chatPreloadState.hasStarted || !pageLoaded) {
      return;
    }

    let interactionTimer: NodeJS.Timeout | null = null;

    const handleUserInteraction = () => {
      // Clear any existing timer
      if (interactionTimer) {
        clearTimeout(interactionTimer);
      }

      // Start preload after a short delay (user is showing intent to interact)
      interactionTimer = setTimeout(() => {
        if (!chatPreloadState.hasStarted) {
          // 🔥 DISABLED: Chat preload loads ChatInterface which triggers Monaco initialization error
          console.log('👆 [Chat] User interaction detected - Chat preload DISABLED (will load on-demand)');
          // chatPreloadService.startBackgroundPreload().then(() => {
          //   console.log('✅ [Chat] Interaction-triggered preload completed!');
          //   setChatPreloadState(prev => ({
          //     ...prev,
          //     isComplete: true,
          //     isInProgress: false,
          //     hasStarted: true
          //   }));
          // }).catch((error) => {
          //   console.warn('⚠️ [Chat] Interaction-triggered preload failed:', error);
          //   setChatPreloadState(prev => ({
          //     ...prev,
          //     isComplete: false,
          //     isInProgress: false,
          //     hasStarted: true
          //   }));
          // });
          
          // setChatPreloadState(prev => ({ 
          //   ...prev, 
          //   hasStarted: true, 
          //   isInProgress: true 
          // }));
        }
      }, 500);
    };
    
    // Listen for various user interaction signals
    const events = ['mousemove', 'scroll', 'keydown', 'click', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { passive: true, once: true });
    });
    
    return () => {
      if (interactionTimer) {
        clearTimeout(interactionTimer);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [pageLoaded, chatPreloadState.hasStarted, isAuthenticated, stage]);

  // Handle mobile responsive
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setMobile(isMobile);
      setMobileMenuOpen(false);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setMobile]);

  // Track processed session IDs to prevent duplicate subscription setups
  const [processedSessionIds, setProcessedSessionIds] = useState<Set<string>>(new Set());
  
  // Track if auth initialization is complete for Stripe returns
  const [stripeAuthReady, setStripeAuthReady] = useState(false);

  // ENHANCED: Handle subscription success return from Stripe with improved UX
  useEffect(() => {
    const handleSubscriptionReturn = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      const subscriptionSuccess = urlParams.get('subscription_success');
      
      if (sessionId && subscriptionSuccess === 'true') {
        // 🔥 CRITICAL: Wait for auth to be ready before processing
        if (!stripeAuthReady) {
          console.log('⏳ [App] Waiting for Stripe auth initialization...');
          return; // Will retry when stripeAuthReady becomes true
        }
        
        // 🔥 CRITICAL: Try to recover session ID from localStorage if auth is lost
        try {
          const storedSessionId = localStorage.getItem('stripe_checkout_session_id');
          if (storedSessionId && storedSessionId !== sessionId) {
            console.log('⚠️ [App] Session ID mismatch - stored:', storedSessionId, 'URL:', sessionId);
          }
          // Clear stored session ID after use
          localStorage.removeItem('stripe_checkout_session_id');
        } catch (e) {
          console.warn('⚠️ [App] Could not access localStorage for session recovery:', e);
        }
        
        // 🔥 CRITICAL: Prevent multiple executions for the same session
        if (processedSessionIds.has(sessionId)) {
          console.log('⏭️ [App] Session already processed, skipping:', sessionId);
          return;
        }
        
        // Mark as processed immediately to prevent race conditions
        setProcessedSessionIds(prev => new Set([...prev, sessionId]));
        
        console.log('🎉 [App] User returned from successful Stripe subscription:', sessionId);
        
        // 🔥 CRITICAL FIX: Wait for authentication to complete before processing subscription
        // Auth should already be initialized (see immediate init above), but double-check
        let currentPrincipal = principal;
        let currentIdentity = identity;
        
        if (!currentPrincipal || !currentIdentity) {
          console.log('⏳ [App] Auth not yet available, waiting up to 10 seconds...');
          
          // Wait up to 10 seconds for auth to complete (it should be fast since we init immediately above)
          let attempts = 0;
          while (attempts < 20 && (!currentPrincipal || !currentIdentity)) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
            
            // Check current auth state from store
            const state = (useAppStore as any).getState();
            currentPrincipal = state.principal;
            currentIdentity = state.identity;
            
            if (currentPrincipal && currentIdentity) {
              console.log('✅ [App] Authentication restored after Stripe redirect (attempt ' + attempts + ')');
              break;
            }
          }
          
          // If still no auth after waiting, try recovery from localStorage
          if (!currentPrincipal) {
            console.warn('⚠️ [App] Auth not restored, attempting recovery from localStorage...');
            
            try {
              const storedPrincipal = localStorage.getItem('stripe_redirect_principal');
              const storedTimestamp = localStorage.getItem('stripe_redirect_timestamp');
              
              if (storedPrincipal && storedTimestamp) {
                const timeSinceRedirect = Date.now() - parseInt(storedTimestamp, 10);
                // Only attempt recovery if redirect was recent (within 5 minutes)
                if (timeSinceRedirect < 5 * 60 * 1000) {
                  console.log('🔄 [App] Attempting to restore auth for principal:', storedPrincipal);
                  
                  // 🔥 FIX: FORCE restore auth from AuthClient - don't check isAuthenticated first
                  const { getSharedAuthClient } = await import('./services/SharedAuthClient');
                  const authClient = await getSharedAuthClient();
                  
                  try {
                    // 🔥 CRITICAL: Get identity directly from AuthClient (it's stored in IndexedDB)
                    const identity = authClient.getIdentity();
                    const restoredPrincipal = identity.getPrincipal();
                    
                    console.log('🔍 [App] Identity from AuthClient:', restoredPrincipal.toString());
                    console.log('🔍 [App] Expected principal:', storedPrincipal);
                    
                    if (restoredPrincipal.toString() === storedPrincipal || restoredPrincipal.toString() !== '2vxsx-fae') {
                      console.log('✅ [App] Auth recovered from AuthClient!');
                      const state = (useAppStore as any).getState();
                      
                      // Use the setAuth method with correct parameter order
                      if (state.setAuth) {
                        console.log('🔍 [App] Calling setAuth with recovered identity...');
                        state.setAuth(true, restoredPrincipal, identity, authClient);
                        console.log('✅ [App] setAuth called successfully');
                        currentPrincipal = restoredPrincipal;
                        currentIdentity = identity;
                      } else {
                        console.error('❌ [App] setAuth method not found in store!');
                      }
                    } else {
                      console.warn('⚠️ [App] Principal mismatch - stored:', storedPrincipal, 'recovered:', restoredPrincipal.toString());
                    }
                  } catch (identityError) {
                    console.error('❌ [App] Failed to get identity from AuthClient:', identityError);
                    // Identity might be anonymous - this is expected if session truly expired
                  }
                } else {
                  console.warn('⚠️ [App] Stored principal too old, skipping recovery');
                }
              }
            } catch (recoveryError) {
              console.error('❌ [App] Recovery attempt failed:', recoveryError);
            }
          }
          
          // If still no auth after recovery attempt, this is a critical error
          if (!currentPrincipal) {
            console.error('❌ [App] CRITICAL: Authentication not restored after Stripe redirect after 10 seconds and recovery attempt');
            console.error('❌ [App] Auth state:', {
              isAuthenticated,
              hasPrincipal: !!currentPrincipal,
              hasIdentity: !!currentIdentity
            });
            
            // Clean up localStorage
            localStorage.removeItem('stripe_redirect_principal');
            localStorage.removeItem('stripe_redirect_timestamp');
            
            setPaymentProcessingState({
              isProcessing: false,
              stage: null,
              progress: 0,
              message: '',
              error: 'Authentication lost after payment. Please log in again and contact support with session ID: ' + sessionId,
              sessionId
            });
            return;
          }
          
          // Clean up localStorage on successful auth restoration
          localStorage.removeItem('stripe_redirect_principal');
          localStorage.removeItem('stripe_redirect_timestamp');
        }
        
        try {
          // NEW: Immediately set payment processing state and hide subscription selection
          setPaymentProcessingState({
            isProcessing: true,
            stage: 'VERIFYING_PAYMENT',
            progress: 10,
            message: 'Verifying your payment with Stripe...',
            error: null,
            sessionId
          });

          // Hide subscription selection immediately to prevent confusion
          hideSubscriptionSelection();

          // Verify the subscription with Stripe first
          setPaymentProcessingState(prev => ({
            ...prev,
            progress: 25,
            message: 'Confirming subscription details...'
          }));

          // 🔥 FIX: Get subscription details from URL or stored state instead of frontend Stripe verification
          // Frontend cannot verify with Stripe secret key - this is handled by webhooks on backend
          console.log('💳 [App] Processing subscription for session:', sessionId);
          
          // Get tier from URL or use stored pending tier
          const urlParams = new URLSearchParams(window.location.search);
          const tierFromUrl = urlParams.get('tier');
          
          // Determine tier and credits (default to STARTER if not specified)
          let tier = SubscriptionTier.STARTER;
          let monthlyCredits = 10000;
          
          if (tierFromUrl) {
            tier = tierFromUrl as SubscriptionTier;
            // Set credits based on tier
            switch(tier) {
              case SubscriptionTier.STARTER:
                monthlyCredits = 10000;
                break;
              case SubscriptionTier.DEVELOPER:
                monthlyCredits = 25000;
                break;
              case SubscriptionTier.PRO:
                monthlyCredits = 60000;
                break;
              case SubscriptionTier.STUDIO:
                monthlyCredits = 150000;
                break;
            }
          }
          
          console.log('💳 [App] Setting up subscription:', {
            tier,
            monthlyCredits,
            sessionId
          });
            
          setPaymentProcessingState(prev => ({
            ...prev,
            stage: 'CREATING_CANISTER',
            progress: 40,
            message: 'Setting up your development environment...'
          }));

          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // 🎣 DUAL-TRACK SUBSCRIPTION SYSTEM:
          // 
          // Frontend (This Code):
          //   - Provides IMMEDIATE user feedback and canister creation
          //   - Uses tier from URL for instant setup
          //   - Gives user access right away for best UX
          //
          // Webhook (Backend - Source of Truth):
          //   - Receives Stripe events asynchronously
          //   - Updates subscription with VERIFIED customer/subscription IDs
          //   - Handles lifecycle: renewals, upgrades, cancellations, payment failures
          //   - Ensures data integrity and prevents fraud
          //
          // Why Both?
          //   - Frontend = Speed & UX (user doesn't wait)
          //   - Webhook = Security & Reliability (data is verified)
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          
          const now = Date.now();
          const success = await completeSubscriptionSetup({
            tier,
            monthlyCredits,
            customerId: undefined, // Webhook will set the real Stripe customer ID
            subscriptionId: sessionId, // Temporary, webhook will update with real subscription ID
            billingCycleStart: now,
            billingCycleEnd: now + (30 * 24 * 60 * 60 * 1000), // 30 days from now, webhook will update
            sessionId: sessionId // Pass session ID for recovery
          });
          
          if (success) {
            console.log('✅ [App] Subscription setup completed successfully with canister creation');
            
            setPaymentProcessingState(prev => ({
              ...prev,
              stage: 'FINALIZING_SETUP',
              progress: 100,
              message: 'Welcome to Kontext! Your workspace is ready.'
            }));

            // NEW: Clear cache since user subscription changed
            if (currentPrincipal) {
              optimizedInitializationService.invalidateSubscriptionCache(currentPrincipal);
            }

            // NEW: Start Monaco preload for successful subscribers (they'll use the editor)
            // 🔥 DISABLED: Monaco preload causes serviceIds error with DFX deployment
            console.log('🎨 [Monaco] Successful subscriber - preload DISABLED (will load on-demand)');
            // if (!monacoPreloadState.hasStarted) {
            //   monacoPreloadService.startBackgroundPreload();
            //   setMonacoPreloadState(prev => ({ 
            //     ...prev, 
            //     hasStarted: true, 
            //     isInProgress: true 
            //   }));
            // }

            // Clean up URL parameters and reset state after a brief success display
            setTimeout(() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              setPaymentProcessingState({
                isProcessing: false,
                stage: null,
                progress: 0,
                message: '',
                error: null,
                sessionId: null
              });
            }, 2000);
          } else {
            // Check if recovery is available
            const { initializationRecoveryService } = await import('./services/InitializationRecoveryService');
            if (currentPrincipal) {
              const recoveryInfo = initializationRecoveryService.getRecoveryInfo(currentPrincipal.toString());
              if (recoveryInfo.canRetry) {
                // Recovery is available - the recovery dialog will be shown by the store state
                console.log('🔄 [App] Recovery available - user can retry setup');
                return; // Don't throw error, let recovery dialog handle it
              }
            }
            throw new Error('Failed to complete subscription setup');
          }
        } catch (error) {
          console.error('❌ [App] Error handling subscription return:', error);
          
          const paymentError: PaymentProcessingError = {
            type: error instanceof Error && error.message.includes('canister')
              ? 'CANISTER_CREATION_FAILED'
              : error instanceof Error && error.message.includes('setup')
              ? 'WASM_DEPLOYMENT_FAILED'
              : 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : 'An unknown error occurred during setup',
            canRetry: true,
            contactSupport: true
          };

          setPaymentProcessingState({
            isProcessing: false,
            stage: null,
            progress: 0,
            message: '',
            error: `Setup failed after payment: ${paymentError.message}. Please contact support with session ID: ${sessionId}`,
            sessionId
          });

          // Clean up URL parameters even on error
          setTimeout(() => {
            window.history.replaceState({}, document.title, window.location.pathname);
          }, 1000);
        }
      }
      
      // Handle subscription cancellation
      const subscriptionCanceled = urlParams.get('subscription_canceled');
      if (subscriptionCanceled === 'true') {
        console.log('⚠️ [App] User canceled subscription - returning to selection');
        // Clean up URL and potentially show subscription selection again
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Handle subscription change success
      const subscriptionChangeSuccess = urlParams.get('subscription_change_success');
      const changeSessionId = urlParams.get('session_id');
      
      if (changeSessionId && subscriptionChangeSuccess === 'true') {
        // 🔥 CRITICAL: Wait for auth to be ready before processing
        if (!stripeAuthReady) {
          console.log('⏳ [App] Waiting for Stripe auth initialization for subscription change...');
          return; // Will retry when stripeAuthReady becomes true
        }
        
        // 🔥 CRITICAL: Prevent multiple executions for the same session
        if (processedSessionIds.has(changeSessionId)) {
          console.log('⏭️ [App] Change session already processed, skipping:', changeSessionId);
          return;
        }
        
        // Mark as processed immediately to prevent race conditions
        setProcessedSessionIds(prev => new Set([...prev, changeSessionId]));
        
        console.log('🔄 [App] User returned from subscription change:', changeSessionId);
        
        // 🔥 CRITICAL FIX: Wait for authentication to complete before processing subscription change
        let currentPrincipal = principal;
        let currentIdentity = identity;
        
        if (!currentPrincipal || !currentIdentity) {
          console.log('⏳ [App] Auth not yet available for subscription change, waiting up to 10 seconds...');
          
          let attempts = 0;
          while (attempts < 20 && (!currentPrincipal || !currentIdentity)) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
            
            const state = (useAppStore as any).getState();
            currentPrincipal = state.principal;
            currentIdentity = state.identity;
            
            if (currentPrincipal && currentIdentity) {
              console.log('✅ [App] Authentication restored after subscription change redirect (attempt ' + attempts + ')');
              break;
            }
          }
          
          if (!currentPrincipal) {
            console.error('❌ [App] CRITICAL: Authentication not restored after subscription change redirect');
            setPaymentProcessingState({
              isProcessing: false,
              stage: null,
              progress: 0,
              message: '',
              error: 'Authentication lost after subscription change. Please log in again.',
              sessionId: changeSessionId
            });
            return;
          }
        }
        
        try {
          setPaymentProcessingState({
            isProcessing: true,
            stage: 'VERIFYING_PAYMENT',
            progress: 10,
            message: 'Syncing your subscription change...',
            error: null,
            sessionId: changeSessionId
          });

          const { subscriptionService } = await import('./services/SubscriptionService');
          const { userCanisterService } = await import('./services/UserCanisterService');
          const { useAppStore } = await import('./store/appStore');
          
          // Get user context
          const appStore = useAppStore.getState();
          const userCanisterId = appStore.userCanisterId;
          const identity = appStore.identity;
          
          if (!userCanisterId || !identity) {
            throw new Error('User authentication required');
          }

          // Use stripeService to verify and get subscription details
          const { stripeService } = await import('./services/StripeService');
          const verificationResult = await stripeService.verifySubscription(changeSessionId);
          
          if (!verificationResult.success || !verificationResult.subscription) {
            throw new Error(verificationResult.error || 'Failed to verify subscription change');
          }

          const subscriptionId = verificationResult.subscription.id;

          setPaymentProcessingState(prev => ({
            ...prev,
            progress: 50,
            message: 'Updating your subscription...'
          }));

          // Use the subscription slice method to handle the change
          const success = await handleSubscriptionChange(subscriptionId);

          if (success) {
            console.log('✅ [App] Subscription change handled successfully');
            
            setPaymentProcessingState(prev => ({
              ...prev,
              stage: 'FINALIZING_SETUP',
              progress: 100,
              message: 'Subscription updated successfully!'
            }));

            // Clean up URL parameters
            setTimeout(() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              setPaymentProcessingState({
                isProcessing: false,
                stage: null,
                progress: 0,
                message: '',
                error: null,
                sessionId: null
              });
            }, 2000);
          } else {
            throw new Error('Failed to sync subscription change');
          }
        } catch (error) {
          console.error('❌ [App] Error handling subscription change return:', error);
          
          setPaymentProcessingState({
            isProcessing: false,
            stage: null,
            progress: 0,
            message: '',
            error: error instanceof Error ? error.message : 'Failed to process subscription change',
            sessionId: changeSessionId
          });

          // Clean up URL parameters
          setTimeout(() => {
            window.history.replaceState({}, document.title, window.location.pathname);
          }, 1000);
        }
      }

      // Handle subscription change cancellation
      const subscriptionChangeCancelled = urlParams.get('subscription_change_cancelled');
      if (subscriptionChangeCancelled === 'true') {
        console.log('⚠️ [App] User canceled subscription change');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    
    // Always run the handler - it checks internally for Stripe return URLs and auth state
    // For Stripe returns, auth is initialized immediately (see above), so it will be available
    handleSubscriptionReturn();
  }, [stripeAuthReady, principal, identity, completeSubscriptionSetup, hideSubscriptionSelection, monacoPreloadState.hasStarted, handleSubscriptionChange, processedSessionIds]);

  // FIXED: Enhanced effects with controlled initialization to prevent auto-scroll
  useEffect(() => {
    // Wait for page to be fully loaded before initializing animations
    const initializePageAnimations = () => {
      // Create animated particles
      const createParticles = () => {
        const particlesContainer = document.getElementById('particles');
        if (particlesContainer) {
          const particleCount = 50;
          particlesContainer.innerHTML = '';

          for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 20 + 's';
            particle.style.animationDuration = (Math.random() * 10 + 15) + 's';
            particlesContainer.appendChild(particle);
          }
        }
      };

      // FIXED: Navbar scroll effect with no initial scroll
      const handleScroll = () => {
        const navbar = document.getElementById('navbar');
        if (navbar && pageLoaded) { // Only apply effects after page is loaded
          if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
          } else {
            navbar.classList.remove('scrolled');
          }
        }
      };

      // Mouse tracking for feature cards (no scroll effects)
      const handleMouseMove = (e: MouseEvent) => {
        if (!pageLoaded) return; // Prevent during initial load
        
        const card = e.currentTarget as HTMLElement;
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        card.style.setProperty('--mouse-x', x + '%');
        card.style.setProperty('--mouse-y', y + '%');
      };

      // FIXED: Controlled scroll animations that don't trigger auto-scroll
      const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      };

      const observer = new IntersectionObserver((entries) => {
        if (!pageLoaded) return; // Don't trigger animations during initial load
        
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animated');
          }
        });
      }, observerOptions);

      // Initialize components without causing scroll
      createParticles();
      
      // FIXED: Only add scroll listener after page is loaded
      if (pageLoaded) {
        window.addEventListener('scroll', handleScroll);
      }
      
      document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mousemove', handleMouseMove as EventListener);
      });

      // FIXED: Only observe elements after page is loaded
      if (pageLoaded) {
        document.querySelectorAll('.animate-on-scroll').forEach(el => {
          observer.observe(el);
        });
      }

      // Add staggered animation delays to feature cards (no layout shift)
      document.querySelectorAll('.feature-card').forEach((card, index) => {
        (card as HTMLElement).style.animationDelay = (index * 0.1) + 's';
      });

      // Enhanced floating document interactions (no scroll effects)
      document.querySelectorAll('.doc-card').forEach((card, index) => {
        const cardElement = card as HTMLElement;
        cardElement.style.animationDelay = (index * 0.2) + 's';
        
        card.addEventListener('mousemove', (e: Event) => {
          if (!pageLoaded) return;
          
          const mouseEvent = e as MouseEvent;
          const rect = cardElement.getBoundingClientRect();
          const x = mouseEvent.clientX - rect.left;
          const y = mouseEvent.clientY - rect.top;
          
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          
          const tiltX = (y - centerY) / centerY * 10;
          const tiltY = (centerX - x) / centerX * 10;
          
          cardElement.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(20px)`;
        });

        card.addEventListener('mouseleave', () => {
          cardElement.style.transform = '';
        });

        card.addEventListener('click', () => {
          cardElement.style.transform = 'scale(1.1) translateZ(50px)';
          setTimeout(() => {
            cardElement.style.transform = '';
          }, 300);
        });
      });

      return () => {
        window.removeEventListener('scroll', handleScroll);
        observer.disconnect();
      };
    };

    // FIXED: Initialize animations only after a brief delay to ensure DOM is ready
    const timer = setTimeout(() => {
      setPageLoaded(true);
      initializePageAnimations();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [pageLoaded]);

  // Cleanup Monaco preload service on unmount
  useEffect(() => {
    return () => {
      // Don't reset the service on unmount since other components might use it
      // The service is designed to be persistent across component lifecycles
      // 🔥 DISABLED: Monaco preload service removed
      console.log('🧹 [App] Unmounting - Monaco preload DISABLED');
    };
  }, []);

  // FIXED: Smooth scroll function that only works on user interaction
  const scrollToSection = (sectionId: string) => {
    if (!pageLoaded) return; // Prevent scrolling during initial load
    
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  // ENHANCED: Subscription check with renewal status blocking
  const checkSubscriptionAndProceed = async (actionCallback: () => void, actionName: string = "premium feature") => {
    if (!isAuthenticated || stage !== 'READY') {
      console.log(`🔒 [App] Cannot access ${actionName} - user not ready`);
      return;
    }

    console.log(`🔍 [App] Checking subscription status for ${actionName}`);
    
    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Subscription check timeout')), 10000);
    });

    try {
      await Promise.race([
        (async () => {
          // Check if subscription is active for feature access (uses existing synced state)
          const isActive = isSubscriptionActiveForFeatureAccess();
          console.log(`📊 [App] Subscription active for ${actionName}:`, isActive);

          // Get current renewal status from existing state
          const currentRenewalStatus = getRenewalStatus();
          const daysRemaining = getDaysUntilExpiration();

          if (currentRenewalStatus === 'EXPIRED') {
            // Subscription is expired, redirect to Stripe
            console.log(`🚫 [App] Subscription expired for ${actionName}, redirecting to Stripe`);
            
            if (subscription.customerId) {
              console.log(`💳 [App] Redirecting expired user to Stripe billing portal for renewal...`);
              await handleSubscriptionRenewal();
            } else {
              console.log(`🔄 [App] No customer ID found for expired user, redirecting to subscription selection...`);
              window.location.href = '/?subscription_selection=true';
            }
            return;
          }

          if (isActive) {
            // Subscription is active, proceed with action
            console.log(`✅ [App] Subscription active, proceeding to ${actionName}`);
            actionCallback();
          } else {
            // Subscription needs renewal, redirect to Stripe
            console.log(`🚫 [App] Subscription requires renewal for ${actionName}, redirecting to Stripe`);
            
            if (subscription.customerId) {
              console.log(`💳 [App] Redirecting to Stripe billing portal for renewal...`);
              await handleSubscriptionRenewal();
            } else {
              console.log(`🔄 [App] No customer ID found, redirecting to subscription selection...`);
              window.location.href = '/?subscription_selection=true';
            }
          }
        })(),
        timeoutPromise
      ]);

    } catch (error) {
      console.error(`❌ [App] Error checking subscription for ${actionName}:`, error);
      
      // On error or timeout, allow access with warning (graceful degradation)
      console.log(`⚠️ [App] Subscription check failed, allowing access to ${actionName} with warning`);
      actionCallback();
    }
  };

  const handleGetStarted = async () => {
    console.log('🚀 [App] Get Started clicked - checking subscription and access');
    
    if (error) {
      clearError();
    }

    if (stage === 'ERROR') {
      await retryInitialization();
      return;
    } else if (stage === 'IDLE') {
      const success = await login();
      if (!success) {
        console.error('Login failed');
      }
      return;
    } else if (stage !== 'READY') {
      console.log('🔄 [App] System not ready yet, stage:', stage);
      return;
    }

    // ✅ FIXED: Now that ChatInterface is eager, no need for complex async handling
    startTransition(() => {
      checkSubscriptionAndProceed(() => {
        console.log('🎯 [App] Opening chat interface after subscription verification');
        
        // 🔥 DISABLED: Monaco preload service removed to fix DFX deployment
        console.log('🚀 [Monaco] Preload DISABLED - will load on-demand when SidePane opens');
        
        setShowChat(true);
      }, 'AI chat assistant');
    });
  };

  const handleOpenProfile = async () => {
    console.log('👤 [App] Profile requested - checking subscription and access');
    
    if (stage !== 'READY') {
      console.log('🔄 [App] System not ready for profile access, stage:', stage);
      return;
    }

    // ✅ FIXED: Start transition BEFORE async work
    startTransition(() => {
      checkSubscriptionAndProceed(() => {
        console.log('👤 [App] Opening profile interface after subscription verification');
        setShowProfile(true);
      }, 'account & billing');
    });
  };

  const handleOpenAdmin = async () => {
    console.log('🔐 [App] Admin access requested - checking subscription and permissions');
    
    if (error) {
      clearError();
    }

    if (stage === 'ERROR') {
      retryInitialization();
      return;
    } else if (stage === 'IDLE') {
      login();
      return;
    } else if (stage !== 'READY' || !isAdmin) {
      console.log('🚫 [App] Admin access denied - not ready or not admin');
      return;
    }

    // ✅ FIXED: Start transition BEFORE async work
    startTransition(() => {
      checkSubscriptionAndProceed(() => {
        console.log('🔐 [App] Opening admin interface after subscription verification');
        setShowAdmin(true);
      }, 'admin panel');
    });
  };

  const handleRetryInitialization = () => {
    clearError();
    retryInitialization();
  };

  const handleCloseChat = () => {
    console.log('❌ [App] User closed chat interface');
    
    // 🔥 FIX: Close any open dropdowns first (like UserCreditsDropdown)
    // This ensures dropdowns don't interfere with page restoration
    try {
      if (appStore && typeof appStore.closeUserDropdown === 'function') {
        appStore.closeUserDropdown();
      }
    } catch (e) {
      console.warn('Could not close user dropdown:', e);
    }
    
    // ✅ FIXED: Wrap in startTransition to prevent React Error #306
    startTransition(() => {
      setShowChat(false);
    });
    
    // 🔥 FIX: Ensure page content is visible when chat closes (works for both mobile and desktop)
    // Use setTimeout to ensure this runs after React state update and ChatInterface unmounts
    setTimeout(() => {
      // Clear any body/html styles that ChatInterface or other components might have set
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.overflowX = '';
      document.body.style.overflowY = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.overflowX = '';
      document.documentElement.style.overflowY = '';
      document.documentElement.style.height = '';
      
      // Ensure the main container is visible and scrollable
      const mainContainer = document.querySelector('div[style*="box-sizing"]');
      if (mainContainer instanceof HTMLElement) {
        mainContainer.style.overflow = 'visible';
        mainContainer.style.height = 'auto';
        mainContainer.style.minHeight = '100vh';
      }
      
      // Remove any fixed positioning or z-index issues from dropdowns
      const dropdowns = document.querySelectorAll('[class*="dropdown"], [class*="Dropdown"], [style*="z-index"]');
      dropdowns.forEach((el) => {
        if (el instanceof HTMLElement) {
          // Only remove problematic styles, not all z-index
          const computedStyle = window.getComputedStyle(el);
          if (computedStyle.position === 'fixed' && parseInt(computedStyle.zIndex) > 1000) {
            // This might be a dropdown overlay, but we'll let React handle it
          }
        }
      });
      
      // Scroll to top to ensure hero section is visible
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Force a reflow to ensure styles are applied
      void document.body.offsetHeight;
      
      // Additional check: ensure all sections are visible and have content
      const sectionsToCheck = [
        '.features',
        '.trust', 
        '.testimonials',
        '.cta-section',
        '.footer'
      ];
      
      sectionsToCheck.forEach((selector) => {
        const section = document.querySelector(selector);
        if (section instanceof HTMLElement) {
          const computedStyle = window.getComputedStyle(section);
          
          // Force visibility
          if (computedStyle.display === 'none') {
            section.style.display = '';
          }
          if (computedStyle.visibility === 'hidden') {
            section.style.visibility = '';
          }
          if (computedStyle.opacity === '0') {
            section.style.opacity = '';
          }
          
          // Ensure height is not zero
          if (computedStyle.height === '0px' || computedStyle.minHeight === '0px') {
            section.style.height = '';
            section.style.minHeight = '';
          }
          
          // 🔥 FIX: Ensure sections are not hidden by z-index or positioning
          if (computedStyle.position === 'fixed' && parseInt(computedStyle.zIndex) > 1000) {
            section.style.position = '';
            section.style.zIndex = '';
          }
          
          // 🔥 FIX: Ensure pointer events are enabled
          if (computedStyle.pointerEvents === 'none') {
            section.style.pointerEvents = '';
          }
          
          // Force a reflow to ensure styles are applied
          void section.offsetHeight;
        }
      });
      
      // 🔥 FIX: Force React to re-render sections by triggering a state update
      // This ensures content is properly restored
      const forceRerender = () => {
        // Trigger a minimal state update to force re-render
        setPageLoaded(prev => !prev);
        setTimeout(() => setPageLoaded(prev => !prev), 50);
      };
      forceRerender();
      
      // Also check if sections have children (content might be missing)
      sectionsToCheck.forEach((selector) => {
        const section = document.querySelector(selector);
        if (section instanceof HTMLElement && section.children.length === 0) {
          console.warn(`⚠️ [App] Section ${selector} has no children - might need re-render`);
        }
      });
    }, 150); // Slightly longer delay to ensure dropdown cleanup completes
  };

  const handleCloseAdmin = () => {
    console.log('❌ [App] User closed admin interface');
    // ✅ FIXED: Wrap in startTransition to prevent React Error #306
    startTransition(() => {
      setShowAdmin(false);
    });
  };

  const handleCloseProfile = () => {
    console.log('❌ [App] User closed profile interface');
    // ✅ FIXED: Wrap in startTransition to prevent React Error #306
    startTransition(() => {
      setShowProfile(false);
    });
  };

  const handleOpenMarketplace = async () => {
    console.log('🛒 [App] Marketplace requested');
    
    if (stage !== 'READY') {
      console.log('🔄 [App] System not ready for marketplace access, stage:', stage);
      return;
    }

    startTransition(() => {
      setShowMarketplace(true);
      localStorage.setItem('ui-state-showMarketplace', 'true');
    });
  };

  const handleCloseMarketplace = () => {
    console.log('❌ [App] User closed marketplace');
    startTransition(() => {
      setShowMarketplace(false);
      localStorage.setItem('ui-state-showMarketplace', 'false');
    });
  };

  const handleOpenUniversity = async () => {
    console.log('🎓 [App] University requested');
    
    if (stage !== 'READY') {
      console.log('🔄 [App] System not ready for university access, stage:', stage);
      return;
    }

    startTransition(() => {
      setShowUniversity(true);
      localStorage.setItem('ui-state-showUniversity', 'true');
    });
  };

  const handleCloseUniversity = () => {
    console.log('❌ [App] User closed university');
    startTransition(() => {
      setShowUniversity(false);
      localStorage.setItem('ui-state-showUniversity', 'false');
    });
  };

  const handleOpenForum = async () => {
    console.log('💬 [App] Forum requested');
    
    if (stage !== 'READY') {
      console.log('🔄 [App] System not ready for forum access, stage:', stage);
      return;
    }

    startTransition(() => {
      setShowForum(true);
      localStorage.setItem('ui-state-showForum', 'true');
    });
  };

  const handleCloseForum = () => {
    console.log('❌ [App] User closed forum');
    startTransition(() => {
      setShowForum(false);
      localStorage.setItem('ui-state-showForum', 'false');
    });
  };

  // OPTIMIZED: Handle logout with cache cleanup
  const handleLogout = () => {
    console.log('🚪 [App] User logging out');
    
    // NEW: Clear cache before logout to ensure fresh state on next login
    if (principal) {
      optimizedInitializationService.invalidateCacheOnLogout(principal);
    }
    
    // 🔥 FIX: Close any open dropdowns and dialogs first
    try {
      if (appStore && typeof appStore.closeUserDropdown === 'function') {
        appStore.closeUserDropdown();
      }
    } catch (e) {
      console.warn('Could not close user dropdown:', e);
    }
    
    // 🔥 FIX: Clean up all portal overlays that might block clicks
    setTimeout(() => {
      // Remove any portal roots that might be blocking
      const portalRoots = document.querySelectorAll('#portal-root, #dialog-portal-root');
      portalRoots.forEach((root) => {
        if (root instanceof HTMLElement) {
          root.style.pointerEvents = 'none';
          // Remove all children to clean up
          while (root.firstChild) {
            root.removeChild(root.firstChild);
          }
        }
      });
      
      // Remove any backdrop overlays
      const backdrops = document.querySelectorAll('[style*="backdrop-filter"], [style*="rgba(0, 0, 0, 0.75)"]');
      backdrops.forEach((backdrop) => {
        if (backdrop instanceof HTMLElement && backdrop.style.position === 'fixed') {
          backdrop.remove();
        }
      });
      
      // Ensure body is clickable
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
      document.documentElement.style.pointerEvents = '';
      document.documentElement.style.overflow = '';
    }, 100);
    
    logout();
    
    // 🔥 FIX: Reset stage to IDLE after logout so buttons are enabled
    setStage('IDLE');
    
    // ✅ FIXED: Wrap in startTransition to prevent React Error #306
    startTransition(() => {
      setShowChat(false);
      setShowAdmin(false);
      setShowProfile(false);
      setShowMarketplace(false);
      setIsRedirectingToSubscription(false);
    });

    // 🔥 FIX: Clear persisted UI state on logout
    try {
      localStorage.removeItem('ui-state-showChat');
      localStorage.removeItem('ui-state-showAdmin');
      localStorage.removeItem('ui-state-showProfile');
      localStorage.removeItem('ui-state-showDocumentation');
      localStorage.removeItem('ui-state-showMarketplace');
    } catch (e) {
      console.warn('Failed to clear persisted UI state on logout:', e);
    }
    
    // Reset payment processing state on logout
    setPaymentProcessingState({
      isProcessing: false,
      stage: null,
      progress: 0,
      message: '',
      error: null,
      sessionId: null
    });
    
    // NEW: Reset Monaco preload state on logout
    setMonacoPreloadState({
      hasStarted: false,
      isComplete: false,
      isInProgress: false
    });
  };

  // NEW: Handle renewal warning dismissal
  const handleDismissRenewalWarning = () => {
    dismissRenewalWarning();
  };

  // NEW: Handle renewal action from banner
  const handleRenewalAction = async () => {
    console.log('💳 [App] User clicked renewal action from banner');
    await handleSubscriptionRenewal();
  };

  // NEW: Auto-continue subscription selection after login completes (backup mechanism)
  // Note: The main flow in handleSubscriptionTierSelected should handle this, but this is a safety net
  useEffect(() => {
    if (pendingSubscriptionTier && isAuthenticated && principal) {
      // Small delay to ensure handleSubscriptionTierSelected has a chance to proceed first
      const timeoutId = setTimeout(() => {
        // Only proceed if pending tier is still set (meaning handleSubscriptionTierSelected didn't complete)
        if (pendingSubscriptionTier) {
          console.log('✅ [App] Authentication complete - automatically proceeding with subscription selection (via useEffect)');
          
          const proceedWithSubscription = async () => {
            try {
              const tier = pendingSubscriptionTier;
              setPendingSubscriptionTier(null); // Clear immediately to prevent duplicate calls
              
              const success = await selectSubscriptionTier(tier);
              if (success) {
                console.log('✅ [App] Subscription tier selection successful');
                
                // Invalidate subscription cache since it will change
                if (principal) {
                  optimizedInitializationService.invalidateSubscriptionCache(principal);
                }
              } else {
                console.error('❌ [App] Subscription tier selection failed');
              }
            } catch (error) {
              console.error('❌ [App] Error in subscription tier selection:', error);
            }
          };
          
          proceedWithSubscription();
        }
      }, 500); // 500ms delay to let handleSubscriptionTierSelected proceed first
      
      return () => clearTimeout(timeoutId);
    }
  }, [pendingSubscriptionTier, isAuthenticated, principal, selectSubscriptionTier]);

  // NEW: Handle subscription tier selection - require login if not authenticated
  const handleSubscriptionTierSelected = async (tier: SubscriptionTier) => {
    console.log('💳 [App] User selected subscription tier:', tier);
    
    // Check if user is authenticated - if not, store tier and prompt login
    if (!isAuthenticated) {
      console.log('🔐 [App] User not authenticated - storing tier and prompting login');
      
      // Store the tier so we can auto-continue after login
      setPendingSubscriptionTier(tier);
      
      const success = await login();
      
      if (!success) {
        console.error('❌ [App] Login failed - cannot proceed with subscription');
        setPendingSubscriptionTier(null);
        throw new Error('Login failed');
      }
      
      // Wait for authentication to complete - read state directly from store for real-time updates
      const maxWaitTime = 15000; // 15 seconds max wait
      const startTime = Date.now();
      
      while ((Date.now() - startTime) < maxWaitTime) {
        const currentState = (useAppStore as any).getState();
        if (currentState.isAuthenticated && currentState.principal) {
          console.log('✅ [App] Authentication detected in store');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Check final state
      const finalState = (useAppStore as any).getState();
      if (!finalState.isAuthenticated || !finalState.principal) {
        console.error('❌ [App] Authentication timeout - cannot proceed');
        setPendingSubscriptionTier(null);
        throw new Error('Authentication timeout');
      }
      
      // Authentication complete - the useEffect will handle proceeding with subscription
      // But we'll also proceed here to ensure it happens immediately
      console.log('✅ [App] Authentication complete - proceeding with subscription');
      // Don't return - let it fall through to proceed immediately
    }
    
    // User is authenticated - proceed with subscription
    try {
      // Clear any pending tier since we're proceeding now
      if (pendingSubscriptionTier) {
        setPendingSubscriptionTier(null);
      }
      
      const success = await selectSubscriptionTier(tier);
      if (success) {
        console.log('✅ [App] Subscription tier selection successful');
        
        // NEW: Invalidate subscription cache since it will change
        if (principal) {
          optimizedInitializationService.invalidateSubscriptionCache(principal);
        }
      } else {
        console.error('❌ [App] Subscription tier selection failed');
        throw new Error('Subscription selection failed');
      }
    } catch (error) {
      console.error('❌ [App] Error in subscription tier selection:', error);
      setPendingSubscriptionTier(null);
      throw error; // Re-throw so the UI can handle it
    }
  };

  // NEW: Handle free tier selection (skip subscription)
  const handleSkipSubscriptionForNow = () => {
    console.log('🎯 [App] User chose to skip subscription for now - continuing with free tier');
    hideSubscriptionSelection();
    // User will continue with free tier limitations
  };

  // NEW: Handle closing subscription selection (browse features)
  const handleCloseSubscriptionSelection = () => {
    console.log('🌐 [App] User chose to browse features instead of selecting subscription');
    hideSubscriptionSelection();
    // Reset to idle state to allow browsing without forcing subscription
    // This allows users to explore the landing page features
  };

  // NEW: Handle payment processing retry
  const handleRetryPaymentProcessing = () => {
    console.log('🔄 [App] Retrying payment processing');
    
    // Reset payment processing state and trigger the subscription return handler again
    setPaymentProcessingState({
      isProcessing: false,
      stage: null,
      progress: 0,
      message: '',
      error: null,
      sessionId: null
    });
    
    // Re-trigger the return handler if we have a session ID
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    if (sessionId) {
      window.location.reload(); // Simple reload to re-trigger the handler
    }
  };

  // FIXED: Allow viewing pricing page without login - only require login when selecting a plan
  const handlePricingClick = async () => {
    console.log('💰 [App] Pricing link clicked - showing pricing page (login not required)');
    
    // Show subscription selection immediately - no login required to view pricing
    showSubscriptionSelection();
  };

  // NEW: Show recovery dialog when needed (lazy loaded)
  if (showRecoveryDialog && initializationRecovery) {
    return (
      <Suspense fallback={
        <KontextLoadingScreen 
          message="Loading Recovery Dialog"
          subtitle="Preparing recovery options..."
          isMobile={window.innerWidth <= 768}
        />
      }>
        <InitializationRecoveryDialog
          onClose={() => setShowRecoveryDialog(false)}
          onRetry={handleRecoveryRetry}
        />
      </Suspense>
    );
  }

  // NEW: Show payment processing overlay when processing Stripe return
  if (paymentProcessingState.isProcessing) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(20px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(255, 107, 53, 0.1))',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '20px',
          padding: '3rem',
          textAlign: 'center',
          maxWidth: '500px',
          margin: '2rem'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 2rem',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            animation: 'pulse 2s infinite'
          }}>
            🎉
          </div>
          <h3 style={{
            color: '#ffffff',
            fontSize: '1.8rem',
            fontWeight: '700',
            marginBottom: '1rem'
          }}>
            Setting up your workspace...
          </h3>
          <p style={{
            color: '#10b981',
            fontSize: '1.1rem',
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            {paymentProcessingState.message}
          </p>
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Progress</span>
              <span style={{ color: '#10b981', fontWeight: '600' }}>{paymentProcessingState.progress}%</span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${paymentProcessingState.progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
          </div>
          <p style={{
            color: '#6b7280',
            fontSize: '0.9rem',
            lineHeight: '1.5'
          }}>
            Thank you for choosing Kontext! We're preparing your development environment with all the tools you need to build amazing applications.
          </p>
        </div>
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}</style>
      </div>
    );
  }

  // NEW: Show payment processing error overlay
  if (paymentProcessingState.error) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(20px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(255, 107, 53, 0.1))',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '20px',
          padding: '3rem',
          textAlign: 'center',
          maxWidth: '500px',
          margin: '2rem'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 2rem',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem'
          }}>
            ⚠️
          </div>
          <h3 style={{
            color: '#ffffff',
            fontSize: '1.8rem',
            fontWeight: '700',
            marginBottom: '1rem'
          }}>
            Setup encountered an issue
          </h3>
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '10px',
            padding: '1.5rem',
            marginBottom: '2rem',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <p style={{
              color: '#ef4444',
              fontSize: '1rem',
              lineHeight: '1.5',
              marginBottom: '1rem'
            }}>
              {paymentProcessingState.error}
            </p>
            {paymentProcessingState.sessionId && (
              <p style={{
                color: '#6b7280',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                wordBreak: 'break-all'
              }}>
                Session ID: {paymentProcessingState.sessionId}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={handleRetryPaymentProcessing}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0px)')}
            >
              Try Again
            </button>
            <button
              onClick={() => {
                setPaymentProcessingState({
                  isProcessing: false,
                  stage: null,
                  progress: 0,
                  message: '',
                  error: null,
                  sessionId: null
                });
                window.location.href = '/';
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show initialization overlay when needed (but not during subscription selection browsing or payment processing)
  const showInitializationOverlay = stage !== 'IDLE' && 
                                   stage !== 'READY' && 
                                   stage !== 'ERROR' && 
                                   stage !== 'SELECTING_SUBSCRIPTION' &&
                                   !paymentProcessingState.isProcessing;
  const showRetry = stage === 'ERROR';

  // 🚀 PWA OPTIMIZATION: Lazy load subscription selection interface
  if (showSubscriptionSelectionUI && !paymentProcessingState.isProcessing) {
    const isMobile = window.innerWidth <= 768;
    return (
      <Suspense fallback={
        <KontextLoadingScreen 
          message="Loading Subscription Selection"
          subtitle="Preparing subscription options..."
          isMobile={isMobile}
        />
      }>
        <SubscriptionSelectionInterface
          onTierSelected={handleSubscriptionTierSelected}
          onSkipForNow={handleSkipSubscriptionForNow}
          onClose={handleCloseSubscriptionSelection}
          allowClose={true}
        />
      </Suspense>
    );
  }

  // 🚀 PWA OPTIMIZATION: Lazy load profile interface
  if (showProfile && stage === 'READY') {
    const isMobile = window.innerWidth <= 768;
    return (
      <Suspense fallback={
        <KontextLoadingScreen 
          message="Loading Profile"
          subtitle="Preparing your profile settings..."
          isMobile={isMobile}
        />
      }>
        <ProfileInterface onClose={handleCloseProfile} />
      </Suspense>
    );
  }

  // 🚀 PWA OPTIMIZATION: Lazy load admin interface
  if (showAdmin && stage === 'READY' && isAdmin) {
    const isMobile = window.innerWidth <= 768;
    return (
      <Suspense fallback={
        <KontextLoadingScreen 
          message="Loading Admin Panel"
          subtitle="Preparing administrative tools..."
          isMobile={isMobile}
        />
      }>
        <AdminInterface onClose={handleCloseAdmin} />
      </Suspense>
    );
  }

  // 🚀 PWA OPTIMIZATION: Lazy load chat interface
  if (showChat && stage === 'READY') {
    const isMobile = window.innerWidth <= 768;
    return (
      <Suspense fallback={
        <KontextLoadingScreen 
          message="Loading Chat Interface"
          subtitle="Preparing your AI assistant..."
          isMobile={isMobile}
        />
      }>
        <ChatInterface onClose={handleCloseChat} />
      </Suspense>
    );
  }

  // 🚀 PWA OPTIMIZATION: Lazy load documentation interface
  if (showDocumentation) {
    const isMobile = window.innerWidth <= 768;
    return (
      <Suspense fallback={
        <KontextLoadingScreen 
          message="Loading Documentation"
          subtitle="Preparing documentation..."
          isMobile={isMobile}
        />
      }>
        <DocumentationInterface 
          onClose={() => setShowDocumentation(false)}
          onOpenProfile={handleOpenProfile}
          onOpenAdmin={isAdmin ? handleOpenAdmin : undefined}
          onLogout={handleLogout}
          isAdmin={isAdmin}
        />
      </Suspense>
    );
  }

  // 🚀 PWA OPTIMIZATION: Lazy load marketplace
  if (showMarketplace && stage === 'READY') {
    const isMobile = window.innerWidth <= 768;
    return (
      <Suspense fallback={
        <KontextLoadingScreen
          message="Loading Marketplace"
          subtitle="Preparing the app store..."
          isMobile={isMobile}
        />
      }>
        <MarketplaceStore onClose={handleCloseMarketplace} />
      </Suspense>
    );
  }

  if (showUniversity && stage === 'READY') {
    const isMobile = window.innerWidth <= 768;
    return (
      <Suspense fallback={
        <KontextLoadingScreen
          message="Loading Kontext University"
          subtitle="Preparing your courses..."
          isMobile={isMobile}
        />
      }>
        <UniversityApp onClose={handleCloseUniversity} />
      </Suspense>
    );
  }

  if (showForum && stage === 'READY') {
    const isMobile = window.innerWidth <= 768;
    return (
      <Suspense fallback={
        <KontextLoadingScreen
          message="Loading Community Forum"
          subtitle="Connecting to discussions..."
          isMobile={isMobile}
        />
      }>
        <PlatformForum onClose={handleCloseForum} />
      </Suspense>
    );
  }

  // Show subscription redirect overlay
  if (isRedirectingToSubscription) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(20px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(16, 185, 129, 0.1))',
          border: '1px solid rgba(255, 107, 53, 0.3)',
          borderRadius: '20px',
          padding: '3rem',
          textAlign: 'center',
          maxWidth: '500px',
          margin: '2rem'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            margin: '0 auto 2rem',
            background: 'linear-gradient(135deg, #ff6b35, #10b981)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            animation: 'pulse 2s infinite'
          }}>
            💳
          </div>
          <h3 style={{
            color: '#ffffff',
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            Updating Subscription...
          </h3>
          <p style={{
            color: '#9ca3af',
            fontSize: '1rem',
            lineHeight: '1.6',
            marginBottom: '2rem'
          }}>
            Redirecting you to manage your subscription. You'll be back in just a moment.
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: '#ff6b35',
              borderRadius: '50%',
              animation: 'bounce 1.4s infinite ease-in-out both',
              animationDelay: '-0.32s'
            }}></div>
            <div style={{
              width: '8px',
              height: '8px',
              background: '#10b981',
              borderRadius: '50%',
              animation: 'bounce 1.4s infinite ease-in-out both',
              animationDelay: '-0.16s'
            }}></div>
            <div style={{
              width: '8px',
              height: '8px',
              background: '#ff6b35',
              borderRadius: '50%',
              animation: 'bounce 1.4s infinite ease-in-out both'
            }}></div>
          </div>
        </div>
        <style jsx>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ margin: 0, padding: 0, boxSizing: 'border-box', minHeight: '100vh', overflow: 'visible' }}>
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary-black: #0a0a0a;
            --secondary-black: #111111;
            --accent-orange: #ff6b35;
            --accent-orange-light: #ff8c5a;
            --accent-green: #10b981;
            --accent-green-light: #34d399;
            --text-gray: #9ca3af;
            --text-light-gray: #e5e7eb;
            --border-color: rgba(255, 255, 255, 0.1);
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--primary-black);
            color: #ffffff;
            line-height: 1.6;
            overflow-x: hidden;
        }

        .bg-particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
        }

        .particle {
            position: absolute;
            width: 2px;
            height: 2px;
            background: var(--accent-orange);
            border-radius: 50%;
            animation: float 20s infinite linear;
            opacity: 0.3;
        }

        @keyframes float {
            0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
            10% { opacity: 0.3; }
            90% { opacity: 0.3; }
            100% { transform: translateY(-100px) rotate(360deg); opacity: 0; }
        }

        .navbar {
            background: rgba(10, 10, 10, 0.8);
            backdrop-filter: blur(20px) saturate(180%);
            border-bottom: 1px solid rgba(255, 107, 53, 0.2);
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            padding: 0 2rem;
            transition: all 0.3s ease;
        }

        .navbar.scrolled {
            background: rgba(10, 10, 10, 0.95);
            box-shadow: 0 8px 32px rgba(255, 107, 53, 0.1);
        }

        .nav-container {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 0;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 1.75rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--accent-orange), var(--accent-green));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-decoration: none;
            position: relative;
        }

        .logo-icon {
            width: 40px;
            height:40px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
        }

        .logo-icon img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 12px;
        }

        .logo-icon::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            animation: logoShine 3s ease-in-out infinite;
            z-index: 1;
        }

        @keyframes logoShine {
            0%, 100% { transform: rotate(0deg) translate(-50%, -50%); }
            50% { transform: rotate(180deg) translate(-50%, -50%); }
        }

        .logo::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--accent-orange), var(--accent-green));
            transition: width 0.3s ease;
        }

        .logo:hover::after {
            width: 100%;
        }

        .nav-links {
            display: flex;
            list-style: none;
            gap: 2.5rem;
        }

        .nav-links a {
            color: var(--text-gray);
            text-decoration: none;
            font-weight: 500;
            font-size: 0.95rem;
            transition: all 0.3s ease;
            position: relative;
            cursor: pointer;
        }

        .nav-links a::before {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 50%;
            width: 0;
            height: 2px;
            background: var(--accent-orange);
            transition: all 0.3s ease;
            transform: translateX(-50%);
        }

        .nav-links a:hover {
            color: #ffffff;
            transform: translateY(-1px);
        }

        .nav-links a:hover::before {
            width: 100%;
        }

        .nav-buttons {
            display: flex;
            gap: 1rem;
            align-items: center;
        }

        .cta-button {
            background: linear-gradient(135deg, var(--accent-orange), #f59e0b);
            color: #ffffff;
            padding: 0.85rem 2rem;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.95rem;
            transition: all 0.4s ease;
            box-shadow: 0 8px 32px rgba(245, 158, 11, 0.3);
            position: relative;
            overflow: hidden;
            border: none;
            cursor: pointer;
        }

        .cta-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.6s;
        }

        .cta-button:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 15px 40px rgba(245, 158, 11, 0.5);
        }

        .cta-button:hover::before {
            left: 100%;
        }

        .cta-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .hero {
            background: radial-gradient(ellipse at center, rgba(255, 107, 53, 0.08) 0%, transparent 50%), 
                        linear-gradient(135deg, var(--primary-black) 0%, #151515 50%, var(--primary-black) 100%);
            padding: 8rem 2rem 4rem;
            position: relative;
            overflow: hidden;
            min-height: 100vh;
            display: flex;
            align-items: center;
        }

        .hero::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(circle at 15% 85%, rgba(16, 185, 129, 0.1) 0%, transparent 40%),
                radial-gradient(circle at 85% 15%, rgba(255, 107, 53, 0.1) 0%, transparent 40%);
            animation: pulseBackground 12s ease-in-out infinite alternate;
        }

        @keyframes pulseBackground {
            0% { opacity: 0.6; transform: scale(1) rotate(0deg); }
            100% { opacity: 1; transform: scale(1.02) rotate(0.5deg); }
        }

        .hero-layout {
            max-width: 1400px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4rem;
            align-items: center;
            position: relative;
            z-index: 2;
        }

        .hero-text {
            position: relative;
            z-index: 3;
        }

        .hero h1 {
            font-size: 3.2rem;
            font-weight: 700;
            margin-bottom: 1.5rem;
            color: #ffffff;
            line-height: 1.2;
            letter-spacing: -0.01em;
            font-family: 'Inter', system-ui, sans-serif;
            animation: slideInLeft 1s ease-out;
        }

        .hero .highlight {
            background: linear-gradient(135deg, var(--accent-orange), var(--accent-green));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            position: relative;
        }

        .hero .highlight::after {
            content: '';
            position: absolute;
            bottom: 2px;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--accent-orange), var(--accent-green));
            border-radius: 2px;
            opacity: 0.3;
        }

        @keyframes slideInLeft {
            0% { opacity: 0; transform: translateX(-30px); }
            100% { opacity: 1; transform: translateX(0); }
        }

        .hero p {
            font-size: 1.2rem;
            color: var(--text-gray);
            margin-bottom: 2.5rem;
            font-weight: 400;
            line-height: 1.7;
            animation: slideInLeft 1s ease-out 0.2s both;
        }

        .hero-prompt {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            padding: 2rem;
            backdrop-filter: blur(20px) saturate(180%);
            position: relative;
            overflow: hidden;
            animation: slideInLeft 1s ease-out 0.4s both;
            margin-bottom: 2rem;
        }

        .hero-prompt::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--accent-orange), var(--accent-green), transparent);
            animation: shimmer 4s linear infinite;
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        .prompt-text {
            color: var(--accent-green);
            font-family: 'JetBrains Mono', 'SF Mono', monospace;
            font-size: 1rem;
            margin-bottom: 1.5rem;
            font-weight: 500;
            letter-spacing: 0.3px;
        }

        .prompt-buttons {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .prompt-btn {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #ffffff;
            padding: 0.75rem 1.5rem;
            border-radius: 10px;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            cursor: pointer;
        }

        .prompt-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(16, 185, 129, 0.1));
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .prompt-btn:hover {
            transform: translateY(-1px);
            border-color: var(--accent-orange);
            box-shadow: 0 8px 25px rgba(255, 107, 53, 0.25);
        }

        .prompt-btn:hover::before {
            opacity: 1;
        }

        .cta-primary {
            background: linear-gradient(135deg, var(--accent-orange), #f59e0b);
            color: #ffffff;
            padding: 1rem 2.5rem;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.1rem;
            transition: all 0.4s ease;
            box-shadow: 0 8px 32px rgba(245, 158, 11, 0.3);
            position: relative;
            overflow: hidden;
            display: inline-block;
            animation: slideInLeft 1s ease-out 0.6s both;
            border: none;
            cursor: pointer;
        }

        .cta-primary::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.6s;
        }

        .cta-primary:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 15px 45px rgba(245, 158, 11, 0.4);
        }

        .cta-primary:hover::before {
            left: 100%;
        }

        .cta-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .auth-status {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 16px;
            padding: 2rem;
            backdrop-filter: blur(20px) saturate(180%);
            position: relative;
            overflow: hidden;
            animation: slideInLeft 1s ease-out 0.4s both;
            margin-bottom: 2rem;
        }

        .auth-status-title {
            color: var(--accent-green);
            font-size: 1.2rem;
            margin-bottom: 1rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .principal-display {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 1rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            color: var(--text-light-gray);
            word-break: break-all;
            margin-bottom: 1rem;
        }

        .logout-btn {
            background: rgba(255, 107, 53, 0.1);
            border: 1px solid var(--accent-orange);
            color: var(--accent-orange);
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .logout-btn:hover {
            background: var(--accent-orange);
            color: #ffffff;
        }

        /* Floating Documents Canvas */
        .hero-visual {
            position: relative;
            height: 600px;
            perspective: 1000px;
        }

        .floating-docs {
            position: absolute;
            width: 100%;
            height: 100%;
        }

        .doc-card {
            position: absolute;
            background: linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.08));
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            backdrop-filter: blur(20px);
            padding: 1.5rem;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
            transition: all 0.6s ease;
            cursor: pointer;
            overflow: hidden;
        }

        .doc-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--accent-orange), var(--accent-green));
        }

        .doc-card:hover {
            transform: translateY(-10px) rotateY(5deg) scale(1.05);
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
            border-color: rgba(255, 107, 53, 0.3);
        }

        /* Individual document positioning and animations */
        .doc-1 {
            top: 10%;
            left: 15%;
            width: 280px;
            height: 200px;
            animation: float1 8s ease-in-out infinite;
            z-index: 3;
        }

        .doc-2 {
            top: 25%;
            right: 10%;
            width: 250px;
            height: 180px;
            animation: float2 10s ease-in-out infinite reverse;
            z-index: 2;
        }

        .doc-3 {
            bottom: 30%;
            left: 20%;
            width: 260px;
            height: 190px;
            animation: float3 12s ease-in-out infinite;
            z-index: 1;
        }

        .doc-4 {
            bottom: 15%;
            right: 25%;
            width: 240px;
            height: 170px;
            animation: float4 9s ease-in-out infinite reverse;
            z-index: 4;
        }

        .doc-5 {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 300px;
            height: 220px;
            animation: float5 11s ease-in-out infinite;
            z-index: 5;
        }

        @keyframes float1 {
            0%, 100% { transform: translateY(0px) rotateZ(2deg); }
            50% { transform: translateY(-20px) rotateZ(-2deg); }
        }

        @keyframes float2 {
            0%, 100% { transform: translateY(0px) rotateZ(-1deg); }
            50% { transform: translateY(-15px) rotateZ(3deg); }
        }

        @keyframes float3 {
            0%, 100% { transform: translateY(0px) rotateZ(1deg); }
            50% { transform: translateY(-25px) rotateZ(-1deg); }
        }

        @keyframes float4 {
            0%, 100% { transform: translateY(0px) rotateZ(-2deg); }
            50% { transform: translateY(-18px) rotateZ(1deg); }
        }

        @keyframes float5 {
            0%, 100% { transform: translate(-50%, -50%) rotateZ(0deg); }
            50% { transform: translate(-50%, -60%) rotateZ(-1deg); }
        }

        .doc-title {
            font-size: 1rem;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 0.5rem;
        }

        .doc-subtitle {
            font-size: 0.8rem;
            color: var(--text-gray);
            margin-bottom: 1rem;
        }

        .doc-preview {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .preview-line {
            height: 8px;
            background: linear-gradient(90deg, rgba(255, 107, 53, 0.3), rgba(16, 185, 129, 0.3));
            border-radius: 4px;
            opacity: 0.6;
        }

        .preview-line.short {
            width: 60%;
        }

        .preview-line.medium {
            width: 80%;
        }

        .preview-line.long {
            width: 100%;
        }

        .doc-icon {
            position: absolute;
            bottom: 1rem;
            right: 1rem;
            font-size: 1.5rem;
            opacity: 0.7;
        }

        /* Enhanced Features Section */
        .features {
            padding: 8rem 2rem;
            background: linear-gradient(180deg, var(--primary-black) 0%, var(--secondary-black) 100%);
            position: relative;
        }

        .features::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--accent-orange), transparent);
        }

        .features-container {
            max-width: 1400px;
            margin: 0 auto;
            position: relative;
            z-index: 2;
        }

        .features-header {
            text-align: center;
            margin-bottom: 5rem;
        }

        .features-header h2 {
            font-size: 3.5rem;
            font-weight: 800;
            margin-bottom: 1.5rem;
            background: linear-gradient(135deg, #ffffff, var(--text-gray));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.01em;
        }

        .features-header p {
            color: var(--text-gray);
            font-size: 1.2rem;
            max-width: 700px;
            margin: 0 auto;
            line-height: 1.7;
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 2.5rem;
            margin-top: 5rem;
        }

        .feature-card {
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(16, 185, 129, 0.05));
            border: 1px solid rgba(255, 107, 53, 0.2);
            border-radius: 24px;
            padding: 3rem;
            transition: all 0.5s ease;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            box-shadow: 0 8px 32px rgba(255, 107, 53, 0.1);
        }

        .feature-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--accent-orange), var(--accent-green));
            transform: scaleX(0.3);
            transform-origin: left;
            transition: transform 0.5s ease;
        }

        .feature-card::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 107, 53, 0.15) 0%, transparent 50%);
            opacity: 0.6;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }

        .feature-card:nth-child(odd) {
            border-image: linear-gradient(45deg, rgba(255, 107, 53, 0.3), rgba(16, 185, 129, 0.2)) 1;
            animation: borderPulse 4s ease-in-out infinite;
        }

        .feature-card:nth-child(even) {
            border-image: linear-gradient(-45deg, rgba(16, 185, 129, 0.3), rgba(255, 107, 53, 0.2)) 1;
            animation: borderPulse 4s ease-in-out infinite 2s;
        }

        @keyframes borderPulse {
            0%, 100% { 
                box-shadow: 0 8px 32px rgba(255, 107, 53, 0.1),
                           inset 0 1px 0 rgba(255, 255, 255, 0.1);
            }
            50% { 
                box-shadow: 0 12px 48px rgba(255, 107, 53, 0.2),
                           inset 0 1px 0 rgba(255, 255, 255, 0.15);
            }
        }

        .feature-card:hover {
            transform: translateY(-10px) scale(1.02);
            box-shadow: 0 30px 60px rgba(255, 107, 53, 0.25), 
                       0 0 0 1px rgba(255, 107, 53, 0.3),
                       inset 0 1px 0 rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 107, 53, 0.4);
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.12), rgba(16, 185, 129, 0.08));
        }

        .feature-card:hover::before {
            transform: scaleX(1);
        }

        .feature-card:hover::after {
            opacity: 1;
        }

        .feature-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, var(--accent-orange), #f59e0b);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            margin-bottom: 2rem;
            position: relative;
            overflow: hidden;
            transition: all 0.4s ease;
            box-shadow: 0 8px 24px rgba(255, 107, 53, 0.3),
                       inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .feature-icon::before {
            content: '';
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
            transform: rotate(45deg);
            transition: transform 0.6s ease;
            animation: iconShimmer 3s ease-in-out infinite;
        }

        @keyframes iconShimmer {
            0%, 100% { transform: rotate(45deg) translate(-100%, -100%); }
            50% { transform: rotate(45deg) translate(100%, 100%); }
        }

        .feature-card:hover .feature-icon {
            transform: scale(1.1) rotate(5deg);
            box-shadow: 0 15px 40px rgba(255, 107, 53, 0.4),
                       inset 0 2px 0 rgba(255, 255, 255, 0.3);
        }

        .feature-card:hover .feature-icon::before {
            transform: rotate(45deg) translate(50%, 50%);
        }

        .feature-card h3 {
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 1.5rem;
            color: #ffffff;
            letter-spacing: -0.01em;
        }

        .feature-card p {
            color: var(--text-gray);
            line-height: 1.8;
            font-size: 1.05rem;
        }

        /* Trust Section with floating elements */
        .trust {
            padding: 8rem 2rem;
            background: var(--primary-black);
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .floating-shapes {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }

        .shape {
            position: absolute;
            opacity: 0.1;
            animation: floatShapes 20s infinite linear;
        }

        .shape:nth-child(1) {
            top: 20%;
            left: 10%;
            animation-delay: 0s;
        }

        .shape:nth-child(2) {
            top: 60%;
            right: 10%;
            animation-delay: -5s;
        }

        .shape:nth-child(3) {
            bottom: 20%;
            left: 20%;
            animation-delay: -10s;
        }

        @keyframes floatShapes {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            25% { transform: translateY(-20px) rotate(90deg); }
            50% { transform: translateY(0px) rotate(180deg); }
            75% { transform: translateY(20px) rotate(270deg); }
        }

        .trust-container {
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
            z-index: 2;
        }

        .trust h2 {
            font-size: 3rem;
            font-weight: 800;
            margin-bottom: 1.5rem;
            background: linear-gradient(135deg, #ffffff, var(--text-gray));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .trust p {
            color: var(--text-gray);
            font-size: 1.2rem;
            margin-bottom: 4rem;
            line-height: 1.7;
        }

        .company-logos {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 4rem;
            flex-wrap: wrap;
        }

        .company-logo {
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--text-gray);
            padding: 1.5rem 2.5rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            transition: all 0.4s ease;
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
        }

        .company-logo::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 107, 53, 0.1), transparent);
            transition: left 0.6s ease;
        }

        .company-logo:hover {
            color: #ffffff;
            border-color: rgba(255, 107, 53, 0.3);
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(255, 107, 53, 0.2);
        }

        .company-logo:hover::before {
            left: 100%;
        }

        /* Enhanced Testimonials */
        .testimonials {
            padding: 8rem 2rem;
            background: linear-gradient(180deg, var(--secondary-black) 0%, var(--primary-black) 100%);
            position: relative;
        }

        .testimonials-container {
            max-width: 1300px;
            margin: 0 auto;
        }

        .testimonials h2 {
            text-align: center;
            font-size: 3rem;
            font-weight: 800;
            margin-bottom: 4rem;
            background: linear-gradient(135deg, #ffffff, var(--text-gray));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .testimonial-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 3rem;
        }

        .testimonial {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 3rem;
            position: relative;
            transition: all 0.4s ease;
            overflow: hidden;
        }

        .testimonial::before {
            content: '"';
            position: absolute;
            top: -10px;
            left: 20px;
            font-size: 6rem;
            color: var(--accent-orange);
            opacity: 0.3;
            font-family: serif;
        }

        .testimonial:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
            border-color: rgba(255, 107, 53, 0.2);
        }

        .testimonial-text {
            color: var(--text-light-gray);
            font-style: italic;
            margin-bottom: 2rem;
            line-height: 1.8;
            font-size: 1.1rem;
            position: relative;
            z-index: 2;
        }

        .testimonial-author {
            display: flex;
            align-items: center;
            gap: 1.5rem;
            position: relative;
            z-index: 2;
        }

        .author-avatar {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, var(--accent-green), #059669);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 1.2rem;
            position: relative;
            overflow: hidden;
        }

        .author-avatar::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            animation: avatarShine 3s ease-in-out infinite;
        }

        @keyframes avatarShine {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(180deg); }
        }

        .author-info h4 {
            font-weight: 700;
            color: #ffffff;
            font-size: 1.1rem;
        }

        .author-info p {
            color: var(--text-gray);
            font-size: 0.95rem;
        }

        /* Enhanced CTA Section - More Professional */
        .cta-section {
            background: linear-gradient(135deg, var(--accent-orange), #f59e0b, var(--accent-green));
            background-size: 400% 400%;
            animation: gradientShift 12s ease infinite;
            padding: 5rem 2rem;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        .cta-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 60%);
        }

        .cta-content {
            position: relative;
            z-index: 2;
            max-width: 800px;
            margin: 0 auto;
        }

        .cta-content h2 {
            font-size: 2.8rem;
            font-weight: 800;
            margin-bottom: 1rem;
            color: #ffffff;
            text-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            letter-spacing: -0.01em;
        }

        .cta-content p {
            font-size: 1.2rem;
            margin-bottom: 2.5rem;
            color: rgba(255, 255, 255, 0.9);
            font-weight: 400;
        }

        .cta-buttons {
            display: flex;
            gap: 1.5rem;
            justify-content: center;
            flex-wrap: wrap;
        }

        .cta-primary-btn {
            background: #000000;
            color: #ffffff;
            padding: 1.2rem 2.5rem;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 700;
            font-size: 1.1rem;
            transition: all 0.4s ease;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
            position: relative;
            overflow: hidden;
            border: none;
            cursor: pointer;
        }

        .cta-secondary-btn {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            padding: 1.2rem 2.5rem;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.1rem;
            border: 1px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            transition: all 0.4s ease;
            cursor: pointer;
        }

        .cta-primary-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.6s ease;
        }

        .cta-primary-btn:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .cta-primary-btn:hover::before {
            left: 100%;
        }

        .cta-secondary-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
            border-color: rgba(255, 255, 255, 0.4);
        }

        /* Professional Footer */
        .footer {
            background: linear-gradient(180deg, var(--secondary-black) 0%, #0f0f0f 100%);
            padding: 4rem 2rem 2rem;
            border-top: 1px solid rgba(255, 107, 53, 0.1);
        }

        .footer-container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .footer-content {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 4rem;
            margin-bottom: 3rem;
        }

        .footer-brand {
            max-width: 400px;
        }

        .footer-logo {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
        }

        .footer-logo-icon {
            width: 45px;
            height: 45px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
        }

        .footer-logo-icon img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 12px;
        }

        .footer-logo-icon::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            animation: logoShine 3s ease-in-out infinite;
            z-index: 1;
        }

        .footer-logo-text {
            font-size: 1.8rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--accent-orange), var(--accent-green));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .footer-description {
            color: var(--text-gray);
            line-height: 1.7;
            margin-bottom: 2rem;
            font-size: 1rem;
        }

        .social-links {
            display: flex;
            gap: 1rem;
        }

        .social-link {
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-gray);
            text-decoration: none;
            font-size: 1.2rem;
            transition: all 0.3s ease;
        }

        .social-link:hover {
            background: rgba(255, 107, 53, 0.1);
            border-color: var(--accent-orange);
            color: #ffffff;
            transform: translateY(-2px);
        }

        .footer-section h3 {
            font-size: 1.1rem;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 1.5rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .footer-links {
            list-style: none;
            padding: 0;
        }

        .footer-links li {
            margin-bottom: 0.75rem;
        }

        .footer-links a {
            color: var(--text-gray);
            text-decoration: none;
            font-size: 0.95rem;
            transition: all 0.3s ease;
            position: relative;
            cursor: pointer;
        }

        .footer-links a::before {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 0;
            height: 1px;
            background: var(--accent-orange);
            transition: width 0.3s ease;
        }

        .footer-links a:hover {
            color: #ffffff;
            transform: translateX(4px);
        }

        .footer-links a:hover::before {
            width: 100%;
        }

        .footer-bottom {
            padding-top: 2rem;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }

        .footer-copyright {
            color: var(--text-gray);
            font-size: 0.9rem;
        }

        .footer-legal {
            display: flex;
            gap: 2rem;
        }

        .footer-legal a {
            color: var(--text-gray);
            text-decoration: none;
            font-size: 0.9rem;
            transition: color 0.3s ease;
            cursor: pointer;
        }

        .footer-legal a:hover {
            color: #ffffff;
        }

        /* FIXED: Scroll animations that don't auto-trigger */
        .animate-on-scroll {
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.6s ease;
        }

        .animate-on-scroll.animated {
            opacity: 1;
            transform: translateY(0);
        }

        /* Responsive design for hero */
        @media (max-width: 1024px) {
            .hero-layout {
                grid-template-columns: 1fr;
                gap: 3rem;
                text-align: center;
            }

            .hero-visual {
                height: 400px;
            }

            .doc-card {
                transform: scale(0.8);
            }

            .nav-links {
                display: none;
            }

            .footer-content {
                grid-template-columns: 1fr 1fr;
                gap: 3rem;
            }

            .features-grid {
                grid-template-columns: 1fr;
                gap: 2rem;
            }
        }

        @media (max-width: 768px) {
            .hero h1 {
                font-size: 2.5rem;
            }
            
            .hero p {
                font-size: 1.1rem;
            }

            .hero-visual {
                display: none;
            }

            .navbar {
                padding: 0 1rem;
            }

            .nav-buttons {
                flex-direction: column;
                gap: 0.5rem;
            }

            .footer-content {
                grid-template-columns: 1fr;
                gap: 2.5rem;
            }

            .footer-bottom {
                flex-direction: column;
                text-align: center;
            }

            .cta-content h2 {
                font-size: 2.2rem;
            }

            .cta-buttons {
                flex-direction: column;
                align-items: center;
            }

            .cta-primary-btn, .cta-secondary-btn {
                width: 100%;
                max-width: 300px;
            }

            .feature-card {
                padding: 2rem;
            }

            .features-header h2 {
                font-size: 2.5rem;
            }

            .company-logos {
                gap: 2rem;
            }
        }
      `}</style>

      {/* Animated background particles */}
      <div className="bg-particles" id="particles"></div>

      {/* Initialization Overlay (now includes subscription selection) */}
      {/* 🚀 PWA OPTIMIZATION: Lazy load initialization overlay */}
      {(showInitializationOverlay || showRetry) && (
        <Suspense fallback={
          <KontextLoadingScreen 
            message="Initializing Kontext"
            subtitle="Setting up your workspace..."
            isMobile={window.innerWidth <= 768}
          />
        }>
          <InitializationOverlay
            isVisible={showInitializationOverlay || showRetry}
            progress={progress}
            onRetry={showRetry ? handleRetryInitialization : undefined}
            showRetry={showRetry}
            canCancel={false}
          />
        </Suspense>
      )}

      {/* NEW: Renewal Warning Banner */}
      {showRenewalWarning && (
        <RenewalWarningBanner
          daysUntilExpiration={daysUntilExpiration || 0}
          subscriptionTier={subscription.currentTier}
          onManageSubscription={handleRenewalAction}
          onDismiss={handleDismissRenewalWarning}
        />
      )}

      {/* Navigation */}
      <nav className="navbar" id="navbar">
        <div className="nav-container">
          <a href="#" className="logo">
            <div className="logo-icon">
              <img 
                src="https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/KCP_LOGO.png" 
                alt="Kontext Logo" 
              />
            </div>
            Kontext
          </a>
          <ul className="nav-links">
            <li><a onClick={() => scrollToSection('features')}>✨ Features</a></li>
            <li><a onClick={handlePricingClick}>💳 Pricing</a></li>
            <li><a onClick={(e) => { e.preventDefault(); setShowDocumentation(true); }} style={{ cursor: 'pointer' }}>📚 Documentation</a></li>
            {isAuthenticated && stage === 'READY' && (
              <>
                <li><a onClick={(e) => { e.preventDefault(); handleOpenUniversity(); }} style={{ cursor: 'pointer' }}>🎓 University</a></li>
                <li><a onClick={(e) => { e.preventDefault(); handleOpenMarketplace(); }} style={{ cursor: 'pointer' }}>🛒 Marketplace</a></li>
                <li><a onClick={(e) => { e.preventDefault(); handleOpenForum(); }} style={{ cursor: 'pointer' }}>💬 Forum</a></li>
              </>
            )}
            <li><a href="#support">🆘 Support</a></li>
          </ul>
          <div className="nav-buttons">
            {isAuthenticated && stage === 'READY' ? (
              <UserDropdown 
                onOpenProfile={handleOpenProfile}
                onOpenAdmin={isAdmin ? handleOpenAdmin : undefined}
                onOpenMarketplace={handleOpenMarketplace}
                onOpenUniversity={handleOpenUniversity}
                onOpenForum={handleOpenForum}
                onLogout={handleLogout}
              />
            ) : (
              <button 
                className="cta-button"
                onClick={handleGetStarted}
                disabled={stage === 'AUTHENTICATING' || (stage !== 'IDLE' && stage !== 'READY' && stage !== 'ERROR') || isRedirectingToSubscription || paymentProcessingState.isProcessing}
              >
                {paymentProcessingState.isProcessing ? 'Setting up workspace...' :
                 isRedirectingToSubscription ? 'Checking subscription...' :
                 stage === 'AUTHENTICATING' ? 'Connecting...' : 
                 stage === 'READY' ? 'Get Started' : 
                 stage === 'ERROR' ? 'Retry Setup' :
                 stage !== 'IDLE' ? 'Setting Up...' : 'Get Started'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-layout">
          <div className="hero-text">
            <h1>Transform your ideas into <span className="highlight">intelligent applications</span></h1>
            <p>Build powerful, context-aware applications with natural language. From concept to production in minutes, not months.</p>
            
            {isAuthenticated ? (
              <div className="auth-status">
                <div className="auth-status-title">
                  <span>🎉</span> Welcome back{isAdmin ? ', Admin' : ''}!
                  {subscription.isActive && (
                    <span style={{
                      marginLeft: '1rem',
                      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: '600'
                    }}>
                      {subscription.currentTier} TIER
                    </span>
                  )}
                </div>
                <div 
                  className="principal-display"
                  onClick={async (e) => {
                    if (principal) {
                      try {
                        await navigator.clipboard.writeText(principal.toString());
                        // Show temporary feedback
                        const target = e.currentTarget;
                        const originalText = target.textContent || '';
                        target.textContent = 'Principal: ✓ Copied!';
                        target.style.color = '#10b981';
                        setTimeout(() => {
                          if (target.textContent === 'Principal: ✓ Copied!') {
                            target.textContent = originalText;
                            target.style.color = 'var(--text-light-gray)';
                          }
                        }, 2000);
                      } catch (err) {
                        console.error('Failed to copy:', err);
                      }
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  title="Click to copy Principal ID"
                >
                  Principal: {principal?.toString()}
                </div>
                {stage === 'READY' ? (
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button 
                      className="cta-primary"
                      onClick={handleGetStarted}
                      disabled={isRedirectingToSubscription || paymentProcessingState.isProcessing}
                    >
                      {paymentProcessingState.isProcessing ? 'Setting up workspace...' :
                       isRedirectingToSubscription ? 'Checking subscription...' : 'Open AI Assistant'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(255, 107, 53, 0.1)',
                      border: '1px solid rgba(255, 107, 53, 0.3)',
                      borderRadius: '8px',
                      color: '#ff6b35',
                      fontSize: '0.9rem',
                      flex: 1
                    }}>
                      {progress.message}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hero-prompt">
                <div className="prompt-text">$ kontext create "task management app with AI-powered suggestions"</div>
                <div className="prompt-buttons">
                  <button className="prompt-btn">✨ Get suggestions</button>
                  <button className="prompt-btn">📝 Write a prompt</button>
                </div>
              </div>
            )}

            {!isAuthenticated && (
              <button 
                className="cta-primary"
                onClick={handleGetStarted}
                disabled={stage !== 'IDLE' || isRedirectingToSubscription || paymentProcessingState.isProcessing}
              >
                {paymentProcessingState.isProcessing ? 'Setting up workspace...' :
                 isRedirectingToSubscription ? 'Checking subscription...' :
                 stage === 'AUTHENTICATING' ? 'Connecting...' : 'Start Building Today'}
              </button>
            )}

            {error && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '0.9rem'
              }}>
                {error}
                <button 
                  onClick={clearError}
                  style={{
                    marginLeft: '1rem',
                    background: 'none',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    color: '#ef4444',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* NEW: Monaco preload status indicator (only for debugging) */}
            {monacoPreloadState.hasStarted && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                borderRadius: '8px',
                color: '#10b981',
                fontSize: '0.75rem',
                display: localStorage.getItem('monaco-preload-debug') === 'true' ? 'block' : 'none'
              }}>
                🎨 Monaco: {monacoPreloadState.isComplete ? '✅ Ready' : 
                          monacoPreloadState.isInProgress ? '⏳ Loading...' : '🚀 Preload started'}
              </div>
            )}
          </div>

          {/* Right side - Floating Documents */}
          <div className="hero-visual">
            <div className="floating-docs">
              <div className="doc-card doc-1">
                <div className="doc-title">Food Delivery App</div>
                <div className="doc-subtitle">Restaurant ordering</div>
                <div className="doc-preview">
                  <div className="preview-line long"></div>
                  <div className="preview-line medium"></div>
                  <div className="preview-line short"></div>
                </div>
                <div className="doc-icon">📊</div>
              </div>

              <div className="doc-card doc-2">
                <div className="doc-title">Booking Platform</div>
                <div className="doc-subtitle">Appointments & reservations</div>
                <div className="doc-preview">
                  <div className="preview-line medium"></div>
                  <div className="preview-line long"></div>
                  <div className="preview-line short"></div>
                  <div className="preview-line medium"></div>
                </div>
                <div className="doc-icon">🎨</div>
              </div>

              <div className="doc-card doc-3">
                <div className="doc-title">Online Store</div>
                <div className="doc-subtitle">Sell products online</div>
                <div className="doc-preview">
                  <div className="preview-line short"></div>
                  <div className="preview-line long"></div>
                  <div className="preview-line medium"></div>
                </div>
                <div className="doc-icon">⚡</div>
              </div>

              <div className="doc-card doc-4">
                <div className="doc-title">Rental Marketplace</div>
                <div className="doc-subtitle">List & rent items</div>
                <div className="doc-preview">
                  <div className="preview-line long"></div>
                  <div className="preview-line short"></div>
                  <div className="preview-line medium"></div>
                  <div className="preview-line short"></div>
                </div>
                <div className="doc-icon">📱</div>
              </div>

              <div className="doc-card doc-5">
                <div className="doc-title">Task Manager</div>
                <div className="doc-subtitle">Organize your work</div>
                <div className="doc-preview">
                  <div className="preview-line medium"></div>
                  <div className="preview-line long"></div>
                  <div className="preview-line short"></div>
                  <div className="preview-line long"></div>
                </div>
                <div className="doc-icon">🧠</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features">
        <div className="features-container">
          <div className="features-header animate-on-scroll">
            <h2>Build smarter, ship faster</h2>
            <p>Kontext combines the power of AI with intuitive development tools to help you create applications that understand context and deliver exceptional user experiences.</p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card animate-on-scroll">
              <div className="feature-icon">🧠</div>
              <h3>AI-Powered Development</h3>
              <p>Leverage advanced language models to generate, optimize, and enhance your applications with intelligent features that understand user context and intent.</p>
            </div>
            
            <div className="feature-card animate-on-scroll">
              <div className="feature-icon">⚡</div>
              <h3>Instant Deployment</h3>
              <p>Go from idea to live application in minutes. Our streamlined deployment process handles infrastructure, scaling, and monitoring automatically.</p>
            </div>
            
            <div className="feature-card animate-on-scroll">
              <div className="feature-icon">🔧</div>
              <h3>Smart Integrations</h3>
              <p>Connect with your favorite tools and services seamlessly. Built-in integrations for databases, APIs, and third-party services with intelligent data mapping.</p>
            </div>
            
            <div className="feature-card animate-on-scroll">
              <div className="feature-icon">🎯</div>
              <h3>Context-Aware UI</h3>
              <p>Create interfaces that adapt to user behavior and preferences. Dynamic components that learn and evolve based on usage patterns and feedback.</p>
            </div>
            
            <div className="feature-card animate-on-scroll">
              <div className="feature-icon">🛡️</div>
              <h3>Enterprise Security</h3>
              <p>Built with security-first principles. End-to-end encryption, compliance with major standards, and granular access controls for team collaboration.</p>
            </div>
            
            <div className="feature-card animate-on-scroll">
              <div className="feature-icon">📊</div>
              <h3>Real-time Analytics</h3>
              <p>Understand how your applications perform with detailed analytics, user insights, and AI-powered recommendations for optimization.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="trust">
        <div className="floating-shapes">
          <div className="shape" style={{width: '60px', height: '60px', background: 'linear-gradient(45deg, var(--accent-orange), var(--accent-green))', borderRadius: '50%', opacity: 0.1}}></div>
          <div className="shape" style={{width: '40px', height: '40px', background: 'var(--accent-green)', borderRadius: '50%', opacity: 0.1}}></div>
          <div className="shape" style={{width: '80px', height: '80px', background: 'var(--accent-orange)', borderRadius: '50%', opacity: 0.1}}></div>
        </div>
        
        <div className="trust-container">
          <h2 className="animate-on-scroll">Trusted by innovators everywhere</h2>
          <p className="animate-on-scroll">From startups to Fortune 500 companies, developers choose Kontext to build the next generation of intelligent applications.</p>
          
          <div className="company-logos animate-on-scroll">
            <div className="company-logo">TechCorp</div>
            <div className="company-logo">InnovateLabs</div>
            <div className="company-logo">DataFlow</div>
            <div className="company-logo">CloudScale</div>
            <div className="company-logo">AI Systems</div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="testimonials-container">
          <h2 className="animate-on-scroll">What developers are saying</h2>
          
          <div className="testimonial-grid">
            <div className="testimonial animate-on-scroll">
              <div className="testimonial-text">
                "Kontext transformed our development workflow. What used to take weeks now happens in hours. The AI understands exactly what we need."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">SJ</div>
                <div className="author-info">
                  <h4>Sarah Johnson</h4>
                  <p>Lead Developer, TechStart</p>
                </div>
              </div>
            </div>
            
            <div className="testimonial animate-on-scroll">
              <div className="testimonial-text">
                "The context-awareness feature is incredible. Our users love how the app anticipates their needs and adapts to their workflow."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">MK</div>
                <div className="author-info">
                  <h4>Michael Kim</h4>
                  <p>Product Manager, InnovateLabs</p>
                </div>
              </div>
            </div>
            
            <div className="testimonial animate-on-scroll">
              <div className="testimonial-text">
                "Finally, a platform that makes AI development accessible. We've built three production apps in the time it used to take for one prototype."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">AL</div>
                <div className="author-info">
                  <h4>Alex Lopez</h4>
                  <p>CTO, DataFlow Systems</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2 className="animate-on-scroll">Ready to transform your ideas?</h2>
          <p className="animate-on-scroll">Join thousands of developers building the future with intelligent applications</p>
          <div className="cta-buttons animate-on-scroll">
            <button 
              className="cta-primary-btn" 
              onClick={handleGetStarted}
              disabled={isRedirectingToSubscription || paymentProcessingState.isProcessing}
            >
              {paymentProcessingState.isProcessing ? 'Setting up workspace...' :
               isRedirectingToSubscription ? 'Checking subscription...' : 'Start Building Today'}
            </button>
            <button className="cta-secondary-btn" onClick={() => scrollToSection('features')}>
              View Documentation
            </button>
          </div>
        </div>
      </section>

      {/* Professional Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="footer-logo">
                <div className="footer-logo-icon">
                  <img 
                    src="https://pwi5a-sqaaa-aaaaa-qcfgq-cai.raw.icp0.io/projects/project-mfvtjz8x-hc7uz/KCP_LOGO.png" 
                    alt="Kontext Logo" 
                  />
                </div>
                <div className="footer-logo-text">Kontext</div>
              </div>
              <p className="footer-description">
                Kontext is the AI-powered platform that lets developers build fully functioning applications in minutes. Transform your ideas into intelligent, context-aware apps with natural language.
              </p>
              <div className="social-links">
                <a href="#" className="social-link">𝕏</a>
                <a href="#" className="social-link">💬</a>
                <a href="#" className="social-link">💼</a>
                <a href="#" className="social-link">🐙</a>
              </div>
            </div>

            <div className="footer-section">
              <h3>Product</h3>
              <ul className="footer-links">
                <li><a href="#">Features</a></li>
                <li><a href="#">Integrations</a></li>
                <li><a href="#">Enterprise</a></li>
                <li><a onClick={handlePricingClick}>Pricing</a></li>
                <li><a href="#">API Reference</a></li>
                <li><a href="#">Roadmap</a></li>
                <li><a href="#">Changelog</a></li>
                <li><a href="#">Feature Request</a></li>
              </ul>
            </div>

            <div className="footer-section">
              <h3>Resources</h3>
              <ul className="footer-links">
                <li><a href="#">Docs & FAQs</a></li>
                <li><a href="#">Tutorials</a></li>
                <li><a href="#">Community</a></li>
                <li><a href="#">Templates</a></li>
                <li><a href="#">Security</a></li>
                <li><a href="#">Status</a></li>
                <li><a href="#">Report Issue</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>

            <div className="footer-section">
              <h3>Legal</h3>
              <ul className="footer-links">
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
                <li><a href="#">Cookie Policy</a></li>
                <li><a href="#">GDPR</a></li>
                <li><a href="#">Compliance</a></li>
                <li><a href="#">Licenses</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <div className="footer-copyright">
              © 2025 Kontext Inc. All rights reserved.
            </div>
            <div className="footer-legal">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Router component that checks the URL path
function AppRouter() {
  // Check if we're on a profile page route using plain JavaScript
  const isProfileRoute = window.location.pathname.startsWith('/profile/');
  
  if (isProfileRoute) {
    return (
      <Suspense fallback={
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#ffffff'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid rgba(255, 107, 53, 0.2)',
              borderTopColor: '#ff6b35',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}></div>
            <div style={{ fontSize: '1.2rem', color: 'rgba(255, 255, 255, 0.6)' }}>
              Loading profile...
            </div>
          </div>
        </div>
      }>
        <UserProfilePage />
      </Suspense>
    );
  }
  
  return <AppContent />;
}

export function App() {
  return <AppRouter />;
}
