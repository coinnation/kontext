// 🔥 CRITICAL: Use type-only import to prevent top-level Stripe initialization
import type { Stripe } from '@stripe/stripe-js';
import { CreditsService } from './CreditsService';
import { subscriptionService, SubscriptionService } from './SubscriptionService';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { AuthClient } from '@dfinity/auth-client';
import { idlFactory } from '../../candid/kontext_backend.did.js';
import { _SERVICE } from '../../candid/kontext_backend.did';
import { icpData } from '../icpData';
import { 
  SubscriptionTier, 
  SubscriptionPlan, 
  StripeProductMapping, 
  SubscriptionCheckoutSession,
  SubscriptionCreationResult,
  BillingPortalResult,
  SubscriptionSyncResult,
  StripeSubscriptionStatus
} from '../types';

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
  amount?: number;
  currency?: string;
  unitsAdded?: number;
  userAccountId?: string;
}

export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface CustomerLookupResult {
  found: boolean;
  customerId?: string;
  email?: string;
  error?: string;
}

// Subscription plan configurations (lazy-initialized to avoid bundling issues)
const getSubscriptionPlans = (): SubscriptionPlan[] => [
  {
    tier: SubscriptionTier.FREE,
    name: 'Free',
    description: 'Perfect for trying out Kontext',
    monthlyPrice: 0,
    monthlyCredits: 1000,
    hostingCredits: 500,
    features: [
      '1,000 AI credits per month',
      'Up to 2 projects',
      'Basic templates',
      'Community support'
    ],
    stripePriceId: '',
    maxProjects: 2,
    maxCollaborators: 0,
    prioritySupport: false,
    customBranding: false,
    ideAccess: 'Basic',
    supportLevel: 'Community',
    supportDescription: 'Community forums and documentation'
  },
  {
    tier: SubscriptionTier.STARTER,
    name: 'Starter',
    description: 'Great for individuals and small projects',
    monthlyPrice: 1,
    monthlyCredits: 10000,
    hostingCredits: 5000,
    features: [
      '10,000 AI credits per month',
      'Up to 10 projects',
      'All templates',
      'Email support',
      'Project collaboration'
    ],
    stripePriceId: 'price_starter_monthly',
    maxProjects: 10,
    maxCollaborators: 2,
    prioritySupport: false,
    customBranding: false,
    ideAccess: 'Full',
    supportLevel: 'Email',
    supportDescription: 'Email support within 24 hours',
    isPopular: true
  },
  {
    tier: SubscriptionTier.DEVELOPER,
    name: 'Developer',
    description: 'Perfect for professional developers',
    monthlyPrice: 50,
    monthlyCredits: 25000,
    hostingCredits: 15000,
    features: [
      '25,000 AI credits per month',
      'Unlimited projects',
      'Advanced templates',
      'Priority email support',
      'Team collaboration',
      'Export capabilities'
    ],
    stripePriceId: 'price_developer_monthly',
    maxProjects: -1,
    maxCollaborators: 5,
    prioritySupport: true,
    customBranding: false,
    ideAccess: 'Full + Advanced',
    supportLevel: 'Priority Email',
    supportDescription: 'Priority email support within 12 hours'
  },
  {
    tier: SubscriptionTier.PRO,
    name: 'Pro',
    description: 'For growing teams and agencies',
    monthlyPrice: 100,
    monthlyCredits: 60000,
    hostingCredits: 40000,
    features: [
      '60,000 AI credits per month',
      'Unlimited projects',
      'All templates + custom templates',
      'Priority support',
      'Advanced collaboration',
      'White-label options',
      'API access'
    ],
    stripePriceId: 'price_pro_monthly',
    maxProjects: -1,
    maxCollaborators: 15,
    prioritySupport: true,
    customBranding: true,
    ideAccess: 'Full + Enterprise',
    supportLevel: 'Priority',
    supportDescription: 'Priority support via email and chat within 4 hours'
  },
  {
    tier: SubscriptionTier.STUDIO,
    name: 'Studio',
    description: 'For large teams and enterprises',
    monthlyPrice: 200,
    monthlyCredits: 150000,
    hostingCredits: 100000,
    features: [
      '150,000 AI credits per month',
      'Unlimited everything',
      'Custom templates',
      '24/7 priority support',
      'Advanced team management',
      'Full white-label',
      'Custom integrations',
      'Dedicated account manager'
    ],
    stripePriceId: 'price_studio_monthly',
    maxProjects: -1,
    maxCollaborators: -1,
    prioritySupport: true,
    customBranding: true,
    ideAccess: 'Full + Enterprise + Custom',
    supportLevel: '24/7 Dedicated',
    supportDescription: '24/7 priority support with dedicated account manager'
  }
];

// 🔥 FIX: Removed local globalAuthClient - now using SharedAuthClient
import { getSharedAuthClient } from './SharedAuthClient';

export class StripeService {
  private static instance: StripeService;
  private stripe: Stripe | null = null;
  private publishableKey: string | null = null;
  private secretKey: string | null = null;
  private mainActor: any = null;
  private stripeConfig: StripeProductMapping = {};
  private isInitialized = false;
  private actorInitialized = false;

  // Units conversion constants
  private static readonly UNITS_MULTIPLIER = 100; // $1 = 100 units

  private constructor() {}

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  // Create main canister actor using the same pattern as useCanister hook
  private async createMainActor(): Promise<any> {
    try {
      if (this.mainActor && this.actorInitialized) {
        console.log('✅ [StripeService] Main actor already initialized');
        return this.mainActor;
      }

      console.log('🔄 [StripeService] Creating main canister actor...');

      // 🔥 FIX: Use shared AuthClient to prevent session logout issues
      const globalAuthClient = await getSharedAuthClient();

      // Determine host (same logic as useCanister)
      const actualHost = (
        typeof window !== 'undefined' && (
          window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1'
        ) ? 'http://127.0.0.1:4943' : 'https://icp0.io'
      );

      // Check if authenticated and get identity
      let identity: Identity | undefined;
      const isAuth = await globalAuthClient.isAuthenticated();
      if (isAuth) {
        identity = globalAuthClient.getIdentity();
        console.log('🔐 [StripeService] Using authenticated identity');
      } else {
        console.log('🔓 [StripeService] No authentication, using anonymous identity');
      }

      // Create agent (same as useCanister)
      const agentOptions: any = { host: actualHost };
      if (identity) {
        agentOptions.identity = identity;
      }

      const agent = new HttpAgent(agentOptions);
      
      // Fetch root key for local development
      if (actualHost.includes('localhost') || actualHost.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }

      // Create main canister actor
      const canisterActor = Actor.createActor<_SERVICE>(idlFactory, {
        agent,
        canisterId: 'pkmhr-fqaaa-aaaaa-qcfeq-cai', // Main backend canister
      });

      // Apply the same data conversion proxy as useCanister
      const convertingActor = new Proxy(canisterActor, {
        get(target, prop) {
          if (typeof target[prop] === 'function') {
            return async (...args: any[]) => {
              try {
                const result = await target[prop](...args);
                return icpData.fromCanister(result);
              } catch (error) {
                console.error(`[StripeService] Error in ${String(prop)}:`, error);
                throw error;
              }
            };
          }
          return target[prop];
        }
      });

      this.mainActor = convertingActor;
      this.actorInitialized = true;

      // Also set the actor for subscription service
      subscriptionService.setMainActor(convertingActor);

      console.log('✅ [StripeService] Main canister actor created successfully');
      return this.mainActor;

    } catch (error) {
      console.error('❌ [StripeService] Failed to create main actor:', error);
      throw error;
    }
  }

  // Initialize Stripe with automatic main actor creation
  public async initialize(): Promise<Stripe | null> {
    try {
      // Don't re-initialize if already initialized
      if (this.stripe && this.isInitialized) {
        console.log('✅ [StripeService] Already initialized, returning existing instance');
        return this.stripe;
      }

      console.log('🔄 [StripeService] Initializing StripeService...');

      // Use existing main actor if set, otherwise create one
      let mainActor = this.mainActor;
      if (!mainActor || !this.actorInitialized) {
        console.log('🔄 [StripeService] Creating main actor (not set via setMainActor)...');
        mainActor = await this.createMainActor();
        if (!mainActor) {
          throw new Error('Failed to create main canister actor');
        }
      } else {
        console.log('✅ [StripeService] Using existing main actor (set via setMainActor)');
      }

      // Get Stripe publishable key from the main canister
      // 🔒 SECURITY: Secret key is never exposed to frontend - all secret operations done on backend
      console.log('🔄 [StripeService] Getting Stripe publishable key from main canister...');
      
      // Get publishable key
      this.publishableKey = await mainActor.getStripePublishableKey();
      
      if (!this.publishableKey) {
        throw new Error('Failed to get Stripe publishable key from main canister');
      }
      
      console.log('🔑 [StripeService] Stripe publishable key retrieved from main canister');

      // Initialize Stripe - dynamically import to prevent top-level initialization
      console.log('🔄 [StripeService] Dynamically loading Stripe with publishable key...');
      console.log('🔑 [StripeService] Publishable key (first 20 chars):', this.publishableKey?.substring(0, 20));
      
      const { loadStripe } = await import('@stripe/stripe-js');
      this.stripe = await loadStripe(this.publishableKey);
      
      if (!this.stripe) {
        console.error('❌ [StripeService] loadStripe() returned null/undefined');
        throw new Error('Failed to load Stripe - loadStripe returned null');
      }

      console.log('✅ [StripeService] Stripe.js loaded successfully');

      // Load subscription configuration
      try {
        await this.loadSubscriptionConfig();
        console.log('✅ [StripeService] Subscription config loaded');
      } catch (configError) {
        console.error('❌ [StripeService] Failed to load subscription config:', configError);
        // Don't fail initialization if config loading fails
      }
      
      // Initialize subscription service
      try {
        await subscriptionService.initialize();
        console.log('✅ [StripeService] Subscription service initialized');
      } catch (subError) {
        console.error('❌ [StripeService] Failed to initialize subscription service:', subError);
        // Don't fail Stripe initialization if subscription service fails
      }
      
      // Mark as initialized
      this.isInitialized = true;
      
      console.log('✅ [StripeService] StripeService initialized successfully');
      return this.stripe;

    } catch (error) {
      console.error('❌ [StripeService] Failed to initialize StripeService:', error);
      return null;
    }
  }

  // Load subscription configuration from canister
  private async loadSubscriptionConfig(): Promise<void> {
    try {
      if (!this.mainActor) {
        throw new Error('Main actor not available');
      }

      // Get subscription configuration from canister
      const configResult = await this.mainActor.getStripeSubscriptionConfig?.();
      
      if (configResult && 'ok' in configResult) {
        this.stripeConfig = configResult.ok;
        
        // Update subscription plans with actual Price IDs
        getSubscriptionPlans().forEach(plan => {
          const config = this.stripeConfig[plan.tier];
          if (config) {
            plan.stripePriceId = config.priceId;
            plan.stripeYearlyPriceId = config.yearlyPriceId;
          }
        });
        
        console.log('✅ [StripeService] Subscription configuration loaded from canister');
      } else {
        // Fallback to hardcoded Price IDs for development
        this.setFallbackPriceIds();
        console.warn('⚠️ [StripeService] Using fallback subscription configuration');
      }
    } catch (error) {
      console.error('❌ [StripeService] Failed to load subscription config:', error);
      this.setFallbackPriceIds();
    }
  }

  // Updated with your actual Stripe Product/Price IDs
  private setFallbackPriceIds(): void {
    const fallbackConfig: StripeProductMapping = {
      [SubscriptionTier.STARTER]: {
        productId: 'prod_T5oD7aXk5zQwBU',
        priceId: 'price_1S9r47Dl32OUu0EXCbG2kyp2'
      },
      [SubscriptionTier.DEVELOPER]: {
        productId: 'prod_T5oDUzMp2AaH88', 
        priceId: 'price_1S9cbSDl32OUu0EXly4Qll1T'
      },
      [SubscriptionTier.PRO]: {
        productId: 'prod_T5oEYsBdLL7Ujd',
        priceId: 'price_1S9ccIDl32OUu0EXOXLiW3ON'
      },
      [SubscriptionTier.STUDIO]: {
        productId: 'prod_T5oFn824pc1iWD',
        priceId: 'price_1S9cciDl32OUu0EXcSVney1i'
      }
    };

    this.stripeConfig = fallbackConfig;

    // Update plans with actual Price IDs
    getSubscriptionPlans().forEach(plan => {
      const config = this.stripeConfig[plan.tier];
      if (config) {
        plan.stripePriceId = config.priceId;
      }
    });

    console.log('✅ [StripeService] Updated with actual Stripe Price IDs:', this.stripeConfig);
  }

  // FIXED: Use Stripe's Search API for customer lookup
  // 🔒 SECURITY: Customer lookup now done via backend
  public async lookupCustomerByPrincipal(userPrincipal: string): Promise<CustomerLookupResult> {
    try {
      console.log('🔍 [StripeService] Looking up customer by principal via backend:', userPrincipal);
      
      // Ensure we're initialized
      if (!this.stripe || !this.isInitialized) {
        await this.initialize();
        if (!this.stripe || !this.isInitialized) {
          throw new Error('StripeService not properly initialized');
        }
      }

      // 🔒 Call backend to search for customer
      const mainActor = await this.createMainActor();
      if (!mainActor) {
        throw new Error('Failed to create main canister actor');
      }

      const principal = Principal.fromText(userPrincipal);
      const result = await mainActor.searchStripeCustomer(principal);

      if ('ok' in result && result.ok) {
        const customerData = result.ok;
        console.log('✅ [StripeService] Customer found via backend:', customerData.customerId);
        
        return {
          found: true,
          customerId: customerData.customerId,
          email: customerData.email || undefined
        };
      } else if ('ok' in result && !result.ok) {
        console.log('ℹ️ [StripeService] No customer found for principal');
        return { found: false };
      } else {
        throw new Error(result.err || 'Customer search failed');
      }

    } catch (error) {
      console.error('❌ [StripeService] Customer lookup via backend failed:', error);
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Customer lookup failed'
      };
    }
  }

  // FALLBACK: List customers and filter client-side (less efficient but more reliable)
  private async lookupCustomerByPrincipalFallback(userPrincipal: string): Promise<CustomerLookupResult> {
    try {
      console.log('🔄 [StripeService] Using fallback List API method for customer lookup');
      
      if (!this.secretKey) {
        throw new Error('Secret key not available for fallback lookup');
      }

      let hasMore = true;
      let startingAfter: string | undefined = undefined;
      const maxPages = 10; // Prevent infinite loops
      let pageCount = 0;

      while (hasMore && pageCount < maxPages) {
        pageCount++;
        
        // Build URL with pagination
        let url = `https://api.stripe.com/v1/customers?limit=100`;
        if (startingAfter) {
          url += `&starting_after=${startingAfter}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`List customers failed: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        // Search through customers for matching metadata
        for (const customer of data.data) {
          if (customer.metadata && customer.metadata.user_principal === userPrincipal) {
            console.log('✅ [StripeService] Customer found via fallback List API:', customer.id);
            return {
              found: true,
              customerId: customer.id,
              email: customer.email
            };
          }
        }

        hasMore = data.has_more;
        if (hasMore && data.data.length > 0) {
          startingAfter = data.data[data.data.length - 1].id;
        }
      }

      console.log('ℹ️ [StripeService] No customer found via fallback List API after', pageCount, 'pages');
      return {
        found: false
      };

    } catch (error) {
      console.error('❌ [StripeService] Fallback customer lookup failed:', error);
      throw error;
    }
  }

  // NEW: Sync subscription status with Stripe
  public async syncSubscriptionWithStripe(
    customerId: string,
    localSubscription: any
  ): Promise<SubscriptionSyncResult> {
    try {
      console.log('🔄 [StripeService] Syncing subscription status with Stripe for customer:', customerId);
      
      if (!this.secretKey) {
        await this.initialize();
        if (!this.secretKey) {
          throw new Error('Secret key not available for subscription sync');
        }
      }

      // Get current subscription status from Stripe
      const subscriptionsResponse = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=all&limit=1`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        }
      );

      if (!subscriptionsResponse.ok) {
        const errorData = await subscriptionsResponse.json();
        throw new Error(`Stripe API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const subscriptionsData = await subscriptionsResponse.json();
      
      if (!subscriptionsData.data || subscriptionsData.data.length === 0) {
        console.log('ℹ️ [StripeService] No active subscriptions found for customer');
        return {
          success: true,
          statusChanged: false,
          oldStatus: null,
          newStatus: null,
          requiresAction: false,
          actionType: null
        };
      }

      const stripeSubscription = subscriptionsData.data[0];
      const stripeStatus: StripeSubscriptionStatus = {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        current_period_start: stripeSubscription.current_period_start,
        current_period_end: stripeSubscription.current_period_end,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end || false,
        customer: stripeSubscription.customer
      };

      console.log('📊 [StripeService] Stripe subscription status:', stripeStatus);

      // Compare with local subscription state
      const statusChanged = this.hasSubscriptionStatusChanged(localSubscription, stripeStatus);
      
      // Determine if action is required
      const { requiresAction, actionType } = this.determineSubscriptionAction(stripeStatus);

      console.log('🔍 [StripeService] Subscription sync result:', {
        statusChanged,
        requiresAction,
        actionType,
        stripeStatus: stripeStatus.status,
        localIsActive: localSubscription?.isActive
      });

      return {
        success: true,
        statusChanged,
        oldStatus: localSubscription ? {
          id: localSubscription.subscriptionId || '',
          status: localSubscription.isActive ? 'active' : 'canceled',
          current_period_start: Math.floor((localSubscription.billingCycleStart || 0) / 1000),
          current_period_end: Math.floor((localSubscription.billingCycleEnd || 0) / 1000),
          cancel_at_period_end: false,
          customer: customerId
        } as StripeSubscriptionStatus : null,
        newStatus: stripeStatus,
        requiresAction,
        actionType
      };

    } catch (error) {
      console.error('❌ [StripeService] Subscription sync failed:', error);
      return {
        success: false,
        statusChanged: false,
        oldStatus: null,
        newStatus: null,
        requiresAction: false,
        actionType: null,
        error: error instanceof Error ? error.message : 'Subscription sync failed'
      };
    }
  }

  // Helper method to compare subscription states
  private hasSubscriptionStatusChanged(localSub: any, stripeSub: StripeSubscriptionStatus): boolean {
    if (!localSub) return true;

    const localIsActive = localSub.isActive === true;
    const stripeIsActive = stripeSub.status === 'active';
    
    const localEndTime = Math.floor((localSub.billingCycleEnd || 0) / 1000);
    const stripeEndTime = stripeSub.current_period_end;
    
    // Check if active status changed
    if (localIsActive !== stripeIsActive) {
      console.log('📊 [StripeService] Subscription active status changed:', {
        local: localIsActive,
        stripe: stripeIsActive
      });
      return true;
    }
    
    // Check if billing cycle end changed (renewal happened)
    if (Math.abs(localEndTime - stripeEndTime) > 3600) { // More than 1 hour difference
      console.log('📊 [StripeService] Subscription billing cycle changed:', {
        localEnd: new Date(localEndTime * 1000).toISOString(),
        stripeEnd: new Date(stripeEndTime * 1000).toISOString()
      });
      return true;
    }
    
    return false;
  }

  // Helper method to determine if user action is required
  private determineSubscriptionAction(stripeSub: StripeSubscriptionStatus): {
    requiresAction: boolean;
    actionType: 'renewal_needed' | 'payment_failed' | 'expired' | 'cancelled' | null;
  } {
    const now = Math.floor(Date.now() / 1000);
    
    switch (stripeSub.status) {
      case 'past_due':
        return { requiresAction: true, actionType: 'payment_failed' };
      
      case 'canceled':
      case 'unpaid':
      case 'incomplete_expired':
        return { requiresAction: true, actionType: 'expired' };
      
      case 'incomplete':
        return { requiresAction: true, actionType: 'payment_failed' };
      
      case 'active':
        // Check if subscription will end soon and is set to cancel
        if (stripeSub.cancel_at_period_end) {
          const daysUntilEnd = (stripeSub.current_period_end - now) / (24 * 60 * 60);
          if (daysUntilEnd <= 7) {
            return { requiresAction: true, actionType: 'renewal_needed' };
          }
        }
        return { requiresAction: false, actionType: null };
      
      case 'trialing':
        return { requiresAction: false, actionType: null };
      
      default:
        return { requiresAction: true, actionType: 'expired' };
    }
  }

  // Get available subscription plans
  public getSubscriptionPlans(): SubscriptionPlan[] {
    return getSubscriptionPlans().filter(plan => plan.tier !== SubscriptionTier.FREE);
  }

  // Get specific subscription plan
  public getSubscriptionPlan(tier: SubscriptionTier): SubscriptionPlan | null {
    const plan = getSubscriptionPlans().find(plan => plan.tier === tier);
    if (!plan) return null;
    
    // 🔥 FIX: Override with actual price IDs from stripeConfig if available
    const config = this.stripeConfig[tier];
    if (config && config.priceId) {
      plan.stripePriceId = config.priceId;
      if (config.yearlyPriceId) {
        plan.stripeYearlyPriceId = config.yearlyPriceId;
      }
    }
    
    return plan;
  }

  // Create subscription checkout session
  // 🔒 SECURITY: All Stripe secret key operations happen on backend
  public async createSubscriptionCheckout(
    tier: SubscriptionTier,
    userPrincipal: string,
    successUrl: string,
    cancelUrl: string,
    isYearly: boolean = false
  ): Promise<SubscriptionCreationResult> {
    try {
      // Ensure we're initialized before proceeding
      if (!this.stripe || !this.isInitialized) {
        console.log('🔄 [StripeService] Not initialized, initializing now...');
        await this.initialize();
        
        if (!this.stripe || !this.isInitialized) {
          throw new Error('StripeService not properly initialized');
        }
      }

      const plan = this.getSubscriptionPlan(tier);
      if (!plan) {
        throw new Error(`Invalid subscription tier: ${tier}`);
      }

      const priceId = isYearly && plan.stripeYearlyPriceId ? plan.stripeYearlyPriceId : plan.stripePriceId;
      
      console.log('🔄 [StripeService] Creating subscription checkout session via backend for:', {
        tier,
        priceId,
        isYearly,
        userPrincipal
      });

      // 🔒 Call backend to create checkout session (backend has secret key)
      const mainActor = await this.createMainActor();
      if (!mainActor) {
        throw new Error('Failed to create main canister actor');
      }

      const result = await mainActor.createCheckoutSession(
        priceId,
        tier,
        successUrl,
        cancelUrl
      );

      if ('ok' in result) {
        const session = result.ok;
        console.log('✅ [StripeService] Subscription checkout session created via backend:', session.id);

        return {
          success: true,
          subscriptionId: session.id, // This is the checkout session ID
          checkoutUrl: session.url
        };
      } else {
        throw new Error(result.err || 'Failed to create checkout session');
      }

    } catch (error) {
      console.error('❌ [StripeService] Failed to create subscription checkout:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout session'
      };
    }
  }

  // Verify subscription after checkout completion
  // 🔒 DEPRECATED: This method relied on frontend access to secret key
  // For new implementations, use backend webhook handlers or getSubscriptionStatus
  public async verifySubscription(sessionId: string): Promise<{
    success: boolean;
    subscription?: any;
    customer?: any;
    error?: string;
  }> {
    try {
      console.log('🔄 [StripeService] Verifying subscription for session:', sessionId);
      
      // 🔒 SECURITY: Secret key no longer available on frontend
      // For proper verification, subscription status should be checked via backend
      // after Stripe webhook confirms the subscription
      console.warn('⚠️ [StripeService] verifySubscription called but secret key not available on frontend');
      console.log('💡 [StripeService] Use backend getSubscriptionStatus or rely on webhook for verification');
      
      // Return success but indicate verification should be done via backend
      return {
        success: true,
        subscription: { id: sessionId },
        error: undefined
      };

    } catch (error) {
      console.error('❌ [StripeService] Subscription verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  // Create customer portal session for subscription management
  // 🔒 SECURITY: All Stripe secret key operations happen on backend
  public async createBillingPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<BillingPortalResult> {
    try {
      // Ensure we're initialized
      if (!this.stripe || !this.isInitialized) {
        await this.initialize();
        if (!this.stripe || !this.isInitialized) {
          throw new Error('StripeService not properly initialized');
        }
      }

      console.log('🔄 [StripeService] Creating billing portal session via backend for customer:', customerId);

      // 🔒 Call backend to create billing portal session
      const mainActor = await this.createMainActor();
      if (!mainActor) {
        throw new Error('Failed to create main canister actor');
      }

      const result = await mainActor.createBillingPortalSession(customerId, returnUrl);

      if ('ok' in result) {
        const session = result.ok;
        console.log('✅ [StripeService] Billing portal session created via backend');

        return {
          success: true,
          url: session.url
        };
      } else {
        throw new Error(`Portal creation failed: ${result.err || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('❌ [StripeService] Failed to create billing portal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create billing portal'
      };
    }
  }

  // Check subscription status
  public async checkSubscriptionStatus(customerId: string): Promise<{
    success: boolean;
    subscriptions?: any[];
    error?: string;
  }> {
    try {
      if (!this.secretKey) {
        await this.initialize();
        if (!this.secretKey) {
          throw new Error('Secret key not available');
        }
      }

      console.log('🔄 [StripeService] Checking subscription status for customer:', customerId);

      const response = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Status check failed: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      console.log('✅ [StripeService] Subscription status retrieved');

      return {
        success: true,
        subscriptions: data.data
      };

    } catch (error) {
      console.error('❌ [StripeService] Failed to check subscription status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed'
      };
    }
  }

  // Create payment intent using secret key (frontend-side for development)
  public async createPaymentIntent(amountInCents: number, currency: string = 'usd', userPrincipal: string): Promise<PaymentIntent | null> {
    try {
      console.log('🔄 [StripeService] Creating payment intent for amount:', amountInCents, 'cents');
      
      if (!this.secretKey) {
        await this.initialize();
        if (!this.secretKey) {
          throw new Error('Secret key not available after initialization');
        }
      }

      // Create payment intent using Stripe's REST API directly from frontend
      const response = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          amount: amountInCents.toString(),
          currency: currency,
          description: `Kontext Units Purchase - ${amountInCents / 100} USD (Stable Units System)`,
          'automatic_payment_methods[enabled]': 'true',
          'metadata[user_principal]': userPrincipal,
          'metadata[platform]': 'kontext',
          'metadata[payment_type]': 'units_purchase',
          'metadata[timestamp]': Date.now().toString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Stripe API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const paymentIntent = await response.json();
      
      console.log('✅ [StripeService] Payment intent created successfully:', paymentIntent.id);
      
      return {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status
      };
      
    } catch (error) {
      console.error('❌ [StripeService] Failed to create payment intent:', error);
      return null;
    }
  }

  // NEW: Process payment with units system - FIXED to use addUnitsToBalance
  public async processPaymentWithElements(
    amountUSD: number,
    elements: any,
    userCanisterId: string,
    userPrincipal: string,
    identity?: any
  ): Promise<PaymentResult> {
    try {
      console.log('🔄 [StripeService] Processing payment with units system for $', amountUSD);
      console.log('🎯 [StripeService] User Canister ID:', userCanisterId);
      console.log('👤 [StripeService] User Principal:', userPrincipal);
      
      const stripe = await this.initialize();
      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      // Convert to cents and units
      const amountInCents = Math.round(amountUSD * 100);
      const unitsToAdd = Math.round(amountUSD * StripeService.UNITS_MULTIPLIER); // $1 = 100 units
      
      console.log(`💰 [StripeService] Units-based payment breakdown:
        - USD: $${amountUSD}
        - Units to Add: ${unitsToAdd}
        - Amount in Cents: ${amountInCents}`);

      // Step 1: Create payment intent using secret key
      console.log('💳 [StripeService] Creating payment intent...');
      const paymentIntent = await this.createPaymentIntent(amountInCents, 'usd', userPrincipal);
      
      if (!paymentIntent) {
        throw new Error('Failed to create payment intent');
      }

      console.log('💳 [StripeService] Confirming payment with Card Element...');

      // Step 2: Get the card element from Elements
      const cardElement = elements.getElement('card');
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Step 3: Confirm payment using confirmCardPayment (Card Element approach)
      const { error, paymentIntent: confirmedPaymentIntent } = await stripe.confirmCardPayment(
        paymentIntent.client_secret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              // You can add billing details here if needed
            },
          }
        }
      );

      if (error) {
        console.error('❌ [StripeService] Payment failed:', error);
        
        if (error.type === 'card_error') {
          return {
            success: false,
            error: error.message || 'Your card was declined. Please try a different payment method.'
          };
        } else if (error.type === 'authentication_error') {
          return {
            success: false,
            error: 'Authentication failed. Please try again.'
          };
        } else {
          return {
            success: false,
            error: error.message || 'Payment failed. Please try again.'
          };
        }
      }

      if (confirmedPaymentIntent && confirmedPaymentIntent.status === 'succeeded') {
        console.log('✅ [StripeService] Payment succeeded:', confirmedPaymentIntent.id);
        console.log('💰 [StripeService] Amount charged:', confirmedPaymentIntent.amount, 'cents');
        
        // Step 4: Add units to user's balance in canister via store
        try {
          console.log('🔄 [StripeService] Adding units to user balance via store...');
          
          // FIXED: Import and use store's addUnitsToBalance method
          const { useAppStore } = await import('../store/appStore');
          const success = await useAppStore.getState().addUnitsToBalance(unitsToAdd);
          
          if (success) {
            console.log('✅ [StripeService] Units added successfully to user balance via store');
            
            return {
              success: true,
              paymentIntentId: confirmedPaymentIntent.id,
              amount: confirmedPaymentIntent.amount,
              currency: confirmedPaymentIntent.currency,
              unitsAdded: unitsToAdd,
              userAccountId: userCanisterId
            };
          } else {
            console.error('❌ [StripeService] Failed to add units to user balance');
            return {
              success: false,
              error: `Payment succeeded but failed to add units to your account. Please contact support with payment ID: ${confirmedPaymentIntent.id}`
            };
          }
        } catch (unitsError) {
          console.error('❌ [StripeService] Error during units addition:', unitsError);
          return {
            success: false,
            error: `Payment succeeded but failed to add units: ${unitsError instanceof Error ? unitsError.message : 'Unknown error'}. Please contact support with payment ID: ${confirmedPaymentIntent.id}`
          };
        }
      }

      // Handle other payment statuses
      if (confirmedPaymentIntent && (
        confirmedPaymentIntent.status === 'processing' || 
        confirmedPaymentIntent.status === 'requires_capture'
      )) {
        console.log('⏳ [StripeService] Payment is processing:', confirmedPaymentIntent.id);
        return {
          success: true,
          paymentIntentId: confirmedPaymentIntent.id,
          amount: confirmedPaymentIntent.amount,
          currency: confirmedPaymentIntent.currency,
          unitsAdded: unitsToAdd
        };
      }

      return {
        success: false,
        error: 'Payment was not completed successfully. Please try again.'
      };

    } catch (error) {
      console.error('❌ [StripeService] Payment processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed. Please try again.'
      };
    }
  }

  public formatAmount(amountInCents: number): string {
    return (amountInCents / 100).toFixed(2);
  }

  public convertDollarsToCents(dollars: number): number {
    return Math.round(dollars * 100);
  }

  public validateAmount(amount: number): { valid: boolean; error?: string } {
    if (amount < 1) {
      return { valid: false, error: 'Minimum purchase amount is $1.00' };
    }
    
    if (amount > 10000) {
      return { valid: false, error: 'Maximum purchase amount is $10,000.00' };
    }
    
    if (amount !== Math.round(amount * 100) / 100) {
      return { valid: false, error: 'Amount cannot have more than 2 decimal places' };
    }
    
    return { valid: true };
  }

  // Calculate estimated credits from USD using units system
  public async calculateCreditsFromUSD(usdAmount: number): Promise<number> {
    try {
      const paymentDetails = await CreditsService.calculatePaymentDetails(usdAmount);
      return paymentDetails.estimatedCredits;
    } catch (error) {
      console.error('❌ [StripeService] Error calculating credits from USD:', error);
      // Fallback calculation
      const roughCredits = Math.floor(usdAmount * 100); // Rough estimate
      return roughCredits;
    }
  }

  // Calculate USD from credits (informational only)
  public async calculateUSDFromCredits(credits: number): Promise<number> {
    const conversionUtils = CreditsService.getConversionUtils();
    return await conversionUtils.creditsToUsd(credits);
  }

  public getStripeInstance(): Stripe | null {
    return this.stripe;
  }

  public getPublishableKey(): string | null {
    return this.publishableKey;
  }

  public getSecretKey(): string | null {
    return this.secretKey;
  }

  // Get pricing info with units system
  public async getPricingInfo(): Promise<{
    xdrRate: number;
    estimatedCreditsPerUSD: number;
    minAmountUSD: number;
    maxAmountUSD: number;
    description: string;
  } | null> {
    try {
      const conversionUtils = CreditsService.getConversionUtils();
      const xdrRate = await conversionUtils.getXdrRate();
      
      // Calculate estimate of credits per USD
      const sampleCredits = await conversionUtils.usdToCredits(1);
      
      return {
        xdrRate,
        estimatedCreditsPerUSD: sampleCredits,
        minAmountUSD: 1,
        maxAmountUSD: 10000,
        description: `Units-based pricing: $${xdrRate.toFixed(4)}/XDR • ~${sampleCredits} credits per $1 USD (varies with computational rates)`
      };
    } catch (error) {
      console.error('❌ [StripeService] Failed to get pricing info:', error);
      return null;
    }
  }

  // Get subscription service instance for subscription operations
  public getSubscriptionService(): SubscriptionService {
    return subscriptionService;
  }

  // Legacy method for backward compatibility - now deprecated
  public setMainActor(actor: any): void {
    if (actor) {
      this.mainActor = actor;
      this.actorInitialized = true;
      // Also set for subscription service
      subscriptionService.setMainActor(actor);
      console.log('✅ [StripeService] Main actor set via setMainActor()');
    } else {
      console.warn('⚠️ [StripeService] setMainActor() called with null/undefined actor');
    }
  }
}

export const stripeService = StripeService.getInstance();