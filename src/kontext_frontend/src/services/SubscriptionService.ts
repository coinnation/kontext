// 🔥 CRITICAL: Use type-only import to prevent top-level Stripe initialization
import type { Stripe } from '@stripe/stripe-js';
import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/agent';
import { 
  SubscriptionTier, 
  SubscriptionPlan, 
  SubscriptionState, 
  SubscriptionCheckoutSession,
  BillingInfo,
  StripeProductMapping
} from '../types';
import { userCanisterService } from './UserCanisterService';
import { CreditsService } from './CreditsService';
import { economyMetricsService } from './EconomyMetricsService';

export interface SubscriptionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface SubscriptionCreditAllocation {
  success: boolean;
  unitsAllocated?: number;
  creditsEquivalent?: number;
  error?: string;
}

export class SubscriptionService {
  private static instance: SubscriptionService;
  private stripe: Stripe | null = null;
  private mainActor: any = null;
  private publishableKey: string | null = null;

  // Cache for dynamically loaded plans
  private cachedPlans: SubscriptionPlan[] | null = null;
  private plansLoadPromise: Promise<SubscriptionPlan[]> | null = null;

  private constructor() {}

  public static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  public setMainActor(actor: any): void {
    this.mainActor = actor;
    console.log('🔄 [SubscriptionService] Main actor injected for subscription operations');
  }

  public async initialize(): Promise<Stripe | null> {
    try {
      if (!this.stripe) {
        if (!this.mainActor) {
          throw new Error('Main actor not set. Cannot get Stripe keys.');
        }

        console.log('🔄 [SubscriptionService] Getting Stripe keys from canister...');
        
        // Get publishable key (using existing StripeService pattern)
        this.publishableKey = await this.mainActor.getStripePublishableKey();
        
        if (!this.publishableKey) {
          throw new Error('Failed to get Stripe publishable key from canister');
        }

        console.log('🔄 [SubscriptionService] Dynamically loading Stripe for subscriptions...');
        const { loadStripe } = await import('@stripe/stripe-js');
        this.stripe = await loadStripe(this.publishableKey);
        
        if (!this.stripe) {
          throw new Error('Failed to load Stripe for subscriptions');
        }
        
        console.log('✅ [SubscriptionService] Stripe initialized successfully for subscriptions');
      }
      
      return this.stripe;
    } catch (error) {
      console.error('❌ [SubscriptionService] Failed to initialize Stripe:', error);
      return null;
    }
  }

  /**
   * Fetch subscription plans from backend dynamically
   * Returns cached plans if available, otherwise fetches from backend
   */
  public async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    // Return cached plans if available
    if (this.cachedPlans) {
      return this.cachedPlans;
    }

    // If already loading, return existing promise
    if (this.plansLoadPromise) {
      return this.plansLoadPromise;
    }

    // Load plans from backend
    this.plansLoadPromise = this.loadPlansFromBackend();
    
    try {
      const plans = await this.plansLoadPromise;
      this.cachedPlans = plans;
      return plans;
    } finally {
      this.plansLoadPromise = null;
    }
  }

  /**
   * Load plans from backend and convert to frontend format
   */
  private async loadPlansFromBackend(): Promise<SubscriptionPlan[]> {
    try {
      const { PlatformCanisterService } = await import('./PlatformCanisterService');
      const { getSharedAuthClient } = await import('./SharedAuthClient');
      
      const authClient = await getSharedAuthClient();
      const identity = authClient.getIdentity();
      const service = PlatformCanisterService.createWithIdentity(identity);
      await service.initialize();

      const result = await service.getActiveSubscriptionPlans();
      
      if ('ok' in result) {
        const backendPlans = result.ok;
        
        // Convert backend plans to frontend format
        const frontendPlans: SubscriptionPlan[] = backendPlans
          .filter(plan => plan.isActive)
          .sort((a, b) => a.order - b.order)
          .map(plan => this.convertBackendPlanToFrontend(plan));
        
        console.log('✅ [SubscriptionService] Loaded', frontendPlans.length, 'plans from backend');
        return frontendPlans;
      } else {
        console.error('❌ [SubscriptionService] Failed to load plans:', result.err);
        return this.getFallbackPlans();
      }
    } catch (error) {
      console.error('❌ [SubscriptionService] Error loading plans from backend:', error);
      return this.getFallbackPlans();
    }
  }

  /**
   * Convert backend plan format to frontend format
   */
  private convertBackendPlanToFrontend(backendPlan: any): SubscriptionPlan {
    const isPopular = backendPlan.badges.includes('Most Popular');
    const savings = backendPlan.discountPercentage && backendPlan.discountPercentage > 0
      ? `${backendPlan.discountPercentage}% OFF`
      : undefined;

    return {
      tier: backendPlan.tier,
      name: backendPlan.name,
      description: backendPlan.description,
      monthlyPrice: backendPlan.monthlyPrice / 100, // Convert cents to dollars
      originalPrice: backendPlan.originalPrice ? backendPlan.originalPrice / 100 : undefined,
      monthlyCredits: backendPlan.monthlyCredits,
      hostingCredits: backendPlan.hostingCredits,
      features: backendPlan.features
        .filter((f: any) => f.enabled)
        .sort((a: any, b: any) => a.order - b.order)
        .map((f: any) => f.description),
      stripePriceId: {
        test: backendPlan.stripePriceId || '',
        live: backendPlan.stripePriceId || ''
      },
      maxProjects: backendPlan.maxProjects,
      maxCollaborators: 0, // Not in backend type currently
      prioritySupport: false, // Derived from features
      customBranding: false, // Derived from features
      ideAccess: 'Basic', // Derived from tier
      supportLevel: 'Community', // Derived from features
      supportDescription: '', // Derived from features
      isPopular,
      buttonText: backendPlan.ctaText || 'Subscribe',
      badge: backendPlan.badges.filter((b: string) => b !== 'Most Popular')[0],
      savings,
      icon: this.getIconForTier(backendPlan.tier),
      color: this.getColorForTier(backendPlan.tier)
    };
  }

  /**
   * Get icon emoji for tier
   */
  private getIconForTier(tier: SubscriptionTier): string {
    switch (tier) {
      case SubscriptionTier.STARTER: return '🚀';
      case SubscriptionTier.DEVELOPER: return '💻';
      case SubscriptionTier.PRO: return '⚡';
      case SubscriptionTier.ENTERPRISE: return '🏢';
      default: return '📦';
    }
  }

  /**
   * Get color for tier
   */
  private getColorForTier(tier: SubscriptionTier): string {
    switch (tier) {
      case SubscriptionTier.STARTER: return '#10b981';
      case SubscriptionTier.DEVELOPER: return '#3b82f6';
      case SubscriptionTier.PRO: return '#8b5cf6';
      case SubscriptionTier.ENTERPRISE: return '#f59e0b';
      default: return '#6b7280';
    }
  }

  /**
   * Fallback plans in case backend is unavailable
   */
  private getFallbackPlans(): SubscriptionPlan[] {
    console.warn('⚠️ [SubscriptionService] Using fallback hardcoded plans');
    return [
      {
        tier: SubscriptionTier.STARTER,
        name: 'Starter',
        description: 'Perfect for learning and small projects',
        monthlyPrice: 1,
        originalPrice: 15,
        monthlyCredits: 10000,
        hostingCredits: 0,
        features: ['10K credits per month', 'Support: Forum & documentation'],
        stripePriceId: { test: 'price_starter_test_id', live: 'price_starter_live_id' },
        maxProjects: 3,
        maxCollaborators: 2,
        prioritySupport: false,
        customBranding: false,
        ideAccess: 'Basic',
        supportLevel: 'Community',
        supportDescription: 'Forum & documentation',
        isPopular: true,
        buttonText: 'Start Building Now',
        badge: 'LAUNCH SPECIAL',
        savings: '93% OFF',
        icon: '🚀',
        color: '#10b981'
      }
    ];
  }

  /**
   * Clear cached plans to force reload from backend
   */
  public clearPlanCache(): void {
    this.cachedPlans = null;
    this.plansLoadPromise = null;
  }

  public async getPlanByTier(tier: SubscriptionTier): Promise<SubscriptionPlan | null> {
    const plans = await this.getSubscriptionPlans();
    return plans.find(plan => plan.tier === tier) || null;
  }

  /**
   * FIXED: Convert promised subscription credits to units using REVERSE of proven units-to-credits conversion
   * This ensures users receive exactly the promised credit amount
   * Now uses CreditsService.calculateUnitsForCredits for consistency and accuracy
   */
  private async convertPromisedCreditsToUnits(
    promisedCredits: number
  ): Promise<{ unitsNeeded: number; conversionRate: number; verificationCredits: number }> {
    try {
      console.log('💰 [SubscriptionService] Converting PROMISED credits to required units:', promisedCredits);
      
      // Use the centralized CreditsService method for consistency
      const unitsNeeded = await CreditsService.calculateUnitsForCredits(promisedCredits);
      
      // Verify the conversion by converting back to credits
      const verificationCredits = await CreditsService.convertUnitsToCredits(unitsNeeded);
      const conversionRate = unitsNeeded / promisedCredits;
      
      console.log('💰 [SubscriptionService] FIXED credit-to-units conversion (using CreditsService):', {
        promisedCredits,
        unitsNeeded,
        conversionRate: conversionRate.toFixed(6),
        verificationCredits,
        accuracy: `${((verificationCredits / promisedCredits) * 100).toFixed(2)}%`,
        note: 'Using centralized CreditsService.calculateUnitsForCredits for consistency'
      });
      
      return { 
        unitsNeeded, 
        conversionRate,
        verificationCredits
      };
    } catch (error) {
      console.error('❌ [SubscriptionService] Error in FIXED credit-to-units conversion:', error);
      
      // Fallback: Use simple approximation if conversion fails
      // Based on observation that ~11,360 units = ~83,529 credits, so ~1 unit = ~7.35 credits
      const estimatedUnitsPerCredit = 1 / 7.35;
      const fallbackUnits = Math.ceil(promisedCredits * estimatedUnitsPerCredit); // Use ceil to ensure at least promised amount
      
      console.warn('⚠️ [SubscriptionService] Using fallback conversion for promised credits');
      
      return { 
        unitsNeeded: fallbackUnits, 
        conversionRate: estimatedUnitsPerCredit,
        verificationCredits: promisedCredits // Assume accuracy in fallback
      };
    }
  }

  /**
   * FIXED: Allocate subscription credits by converting PROMISED credits to correct units
   * Users see "25,000 credits" on plan - they should receive exactly that amount
   */
  public async allocateSubscriptionCredits(
    tier: SubscriptionTier,
    userCanisterId: string,
    identity: Identity,
    addUnitsToBalance: (units: number) => Promise<boolean>
  ): Promise<SubscriptionCreditAllocation> {
    try {
      const plan = await this.getPlanByTier(tier);
      if (!plan) {
        throw new Error(`Plan not found for tier: ${tier}`);
      }

      console.log('🎁 [SubscriptionService] FIXED: Allocating PROMISED subscription credits for tier:', tier);
      console.log('💰 [SubscriptionService] PROMISED credits to deliver:', plan.monthlyCredits);

      // FIXED: Convert PROMISED credits to required units (reverse of units-to-credits)
      const { unitsNeeded, conversionRate, verificationCredits } = await this.convertPromisedCreditsToUnits(
        plan.monthlyCredits
      );

      console.log('🔄 [SubscriptionService] Adding calculated units to balance via store method...');
      
      // Add the calculated units needed to deliver the promised credits
      const success = await addUnitsToBalance(unitsNeeded);
      
      if (success) {
        console.log('✅ [SubscriptionService] FIXED: Subscription credits allocated successfully:', {
          tier,
          promisedCredits: plan.monthlyCredits,
          unitsAllocated: unitsNeeded,
          verificationCredits,
          accuracy: `${((verificationCredits / plan.monthlyCredits) * 100).toFixed(2)}%`,
          conversionRate
        });

        return {
          success: true,
          unitsAllocated: unitsNeeded,
          creditsEquivalent: verificationCredits // Use verification credits for accuracy
        };
      } else {
        throw new Error('Failed to add calculated units to balance');
      }

    } catch (error) {
      console.error('❌ [SubscriptionService] Failed to allocate PROMISED subscription credits:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Credit allocation failed'
      };
    }
  }

  /**
   * Check if user should receive monthly credit refresh
   */
  public shouldRefreshMonthlyCredits(
    billingCycleStart: number | null,
    billingCycleEnd: number | null,
    lastCreditAllocation?: number
  ): boolean {
    if (!billingCycleStart || !billingCycleEnd) {
      return false;
    }

    const now = Date.now();
    
    // If we're in a current billing cycle and haven't allocated credits for this cycle
    if (now >= billingCycleStart && now < billingCycleEnd) {
      // Check if we've already allocated credits for this cycle
      if (!lastCreditAllocation || lastCreditAllocation < billingCycleStart) {
        return true;
      }
    }

    return false;
  }

  /**
   * FIXED: Refresh monthly subscription credits using promised credit amounts
   */
  public async refreshMonthlyCreditsIfNeeded(
    subscription: any,
    addUnitsToBalance: (units: number) => Promise<boolean>
  ): Promise<{ refreshed: boolean; error?: string }> {
    try {
      if (subscription.currentTier === SubscriptionTier.FREE || !subscription.isActive) {
        return { refreshed: false };
      }

      const shouldRefresh = this.shouldRefreshMonthlyCredits(
        subscription.billingCycleStart,
        subscription.billingCycleEnd,
        subscription.lastCreditAllocation
      );

      if (!shouldRefresh) {
        return { refreshed: false };
      }

      console.log('🔄 [SubscriptionService] FIXED: Refreshing monthly subscription credits...');

      // Get current user data from the app store (we'll need to pass this in)
      const { userCanisterId, identity } = await this.getCurrentUserContext();
      
      if (!userCanisterId || !identity) {
        throw new Error('User context not available for credit refresh');
      }

      // FIXED: Use promised credit allocation method
      const allocation = await this.allocateSubscriptionCredits(
        subscription.currentTier,
        userCanisterId,
        identity,
        addUnitsToBalance
      );

      if (allocation.success) {
        console.log('✅ [SubscriptionService] FIXED: Monthly credits refreshed successfully');
        return { refreshed: true };
      } else {
        throw new Error(allocation.error || 'Credit allocation failed');
      }

    } catch (error) {
      console.error('❌ [SubscriptionService] Failed to refresh monthly credits:', error);
      return {
        refreshed: false,
        error: error instanceof Error ? error.message : 'Credit refresh failed'
      };
    }
  }

  /**
   * Get current user context - this will be injected from the store
   */
  private async getCurrentUserContext(): Promise<{
    userCanisterId: string | null;
    identity: Identity | null;
  }> {
    // This method will be overridden when the service is used from the store context
    throw new Error('User context not available - method should be overridden');
  }

  /**
   * Set user context provider for credit allocation operations
   */
  public setUserContextProvider(
    provider: () => Promise<{ userCanisterId: string | null; identity: Identity | null }>
  ): void {
    this.getCurrentUserContext = provider;
  }

  public async createCheckoutSession(
    tier: SubscriptionTier,
    userCanisterId: string,
    identity: Identity
  ): Promise<SubscriptionCheckoutSession | null> {
    try {
      console.log('💳 [SubscriptionService] Creating checkout session for tier:', tier);
      
      if (!this.mainActor) {
        throw new Error('Main actor not available for checkout session creation');
      }

      const stripe = await this.initialize();
      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      const plan = await this.getPlanByTier(tier);
      if (!plan) {
        throw new Error(`Plan not found for tier: ${tier}`);
      }

      // Determine environment and get appropriate price ID
      const isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
      const priceId = isDevelopment ? plan.stripePriceId.test : plan.stripePriceId.live;

      console.log('🎯 [SubscriptionService] Using price ID:', priceId, 'for environment:', isDevelopment ? 'test' : 'live');

      // Get or create Stripe customer
      const principal = identity.getPrincipal().toString();
      let customerId: string | null = null;

      try {
        // Try to get existing customer ID from backend
        const customerResult = await this.mainActor.getStripeCustomerId();
        if ('ok' in customerResult) {
          customerId = customerResult.ok;
          console.log('✅ [SubscriptionService] Found existing customer:', customerId);
        }
      } catch (error) {
        console.log('ℹ️ [SubscriptionService] No existing customer found, will create new one');
      }

      // Create checkout session
      const checkoutSessionData = {
        mode: 'subscription' as const,
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        success_url: `${window.location.origin}/?subscription_success=true&session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
        cancel_url: `${window.location.origin}/?subscription_cancelled=true`,
        customer: customerId || undefined,
        customer_creation: customerId ? undefined : 'always' as const,
        metadata: {
          user_canister_id: userCanisterId,
          user_principal: principal,
          subscription_tier: tier,
          created_at: Date.now().toString()
        },
        subscription_data: {
          metadata: {
            user_canister_id: userCanisterId,
            user_principal: principal,
            subscription_tier: tier
          }
        }
      };

      // Use main actor to create checkout session (if method exists)
      let checkoutSession: any;
      
      try {
        if (typeof this.mainActor.createStripeCheckoutSession === 'function') {
          const sessionResult = await this.mainActor.createStripeCheckoutSession(
            JSON.stringify(checkoutSessionData)
          );
          
          if ('ok' in sessionResult) {
            checkoutSession = JSON.parse(sessionResult.ok);
          } else {
            throw new Error('Backend checkout session creation failed: ' + sessionResult.err);
          }
        } else {
          throw new Error('Backend checkout session method not available');
        }
      } catch (backendError) {
        console.warn('⚠️ [SubscriptionService] Backend checkout session creation failed, using direct Stripe API');
        
        // Fallback to direct Stripe API call (requires secret key from canister)
        const secretKeyResult = await this.mainActor.getStripeSecretKey();
        if ('ok' in secretKeyResult) {
          const secretKey = secretKeyResult.ok;
          
          const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${secretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              'mode': 'subscription',
              'line_items[0][price]': priceId,
              'line_items[0][quantity]': '1',
              'success_url': checkoutSessionData.success_url,
              'cancel_url': checkoutSessionData.cancel_url,
              'metadata[user_canister_id]': userCanisterId,
              'metadata[user_principal]': principal,
              'metadata[subscription_tier]': tier,
              'subscription_data[metadata][user_canister_id]': userCanisterId,
              'subscription_data[metadata][user_principal]': principal,
              'subscription_data[metadata][subscription_tier]': tier,
              ...(customerId && { 'customer': customerId }),
              ...(!customerId && { 'customer_creation': 'always' })
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Stripe API error: ${errorData.error?.message || 'Unknown error'}`);
          }

          checkoutSession = await response.json();
        } else {
          throw new Error('Cannot create checkout session: no backend method and no secret key available');
        }
      }

      if (!checkoutSession || !checkoutSession.id || !checkoutSession.url) {
        throw new Error('Invalid checkout session response from Stripe');
      }

      console.log('✅ [SubscriptionService] Checkout session created:', checkoutSession.id);

      return {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        tier: tier,
        customerId: checkoutSession.customer
      };

    } catch (error) {
      console.error('❌ [SubscriptionService] Failed to create checkout session:', error);
      return null;
    }
  }

  /**
   * FIXED: Verify subscription and allocate PROMISED credits immediately
   */
  public async verifySubscriptionAfterCheckout(
    sessionId: string,
    userCanisterId: string,
    identity: Identity,
    addUnitsToBalance: (units: number) => Promise<boolean>
  ): Promise<SubscriptionResult> {
    try {
      console.log('🔍 [SubscriptionService] FIXED: Verifying subscription after checkout:', sessionId);
      
      if (!this.mainActor) {
        throw new Error('Main actor not available for subscription verification');
      }

      // Get session details from Stripe
      const sessionResult = await this.mainActor.getStripeCheckoutSession(sessionId);
      if ('err' in sessionResult) {
        throw new Error('Failed to retrieve checkout session: ' + sessionResult.err);
      }

      const session = JSON.parse(sessionResult.ok);
      
      if (session.payment_status !== 'paid') {
        throw new Error('Payment not completed');
      }

      if (!session.subscription) {
        throw new Error('No subscription created');
      }

      // Get subscription details
      const subscriptionResult = await this.mainActor.getStripeSubscription(session.subscription);
      if ('err' in subscriptionResult) {
        throw new Error('Failed to retrieve subscription: ' + subscriptionResult.err);
      }

      const subscription = JSON.parse(subscriptionResult.ok);
      const tier = subscription.metadata?.subscription_tier as SubscriptionTier;
      
      if (!tier || !Object.values(SubscriptionTier).includes(tier)) {
        throw new Error('Invalid subscription tier in metadata');
      }

      const plan = await this.getPlanByTier(tier);
      if (!plan) {
        throw new Error('Plan configuration not found for tier: ' + tier);
      }

      // FIXED: Allocate PROMISED subscription credits immediately using corrected conversion
      console.log('🎁 [SubscriptionService] FIXED: Allocating PROMISED initial subscription credits...');
      console.log('💰 [SubscriptionService] User expects to receive:', plan.monthlyCredits, 'credits');
      
      const creditAllocation = await this.allocateSubscriptionCredits(
        tier,
        userCanisterId,
        identity,
        addUnitsToBalance
      );

      if (!creditAllocation.success) {
        console.warn('⚠️ [SubscriptionService] Subscription verified but PROMISED credit allocation failed:', creditAllocation.error);
        // Continue with subscription setup even if credit allocation fails - can be retried later
      } else {
        console.log('✅ [SubscriptionService] PROMISED credits allocated successfully:', creditAllocation.creditsEquivalent, 'credits');
      }

      // Update backend with subscription information
      const updateResult = await userCanisterService.updateSubscriptionTier(
        userCanisterId,
        identity,
        tier,
        plan.monthlyCredits,
        {
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          billingCycleStart: subscription.current_period_start * 1000,
          billingCycleEnd: subscription.current_period_end * 1000,
          lastCreditAllocation: creditAllocation.success ? Date.now() : undefined
        }
      );

      if (!updateResult.success) {
        throw new Error('Failed to update subscription in backend: ' + updateResult.error);
      }

      console.log('✅ [SubscriptionService] FIXED: Subscription verified and activated with PROMISED credits:', tier);

      // Track subscription event in economy metrics
      try {
        const userPrincipal = identity.getPrincipal().toString();
        economyMetricsService.trackSubscription({
          userId: userCanisterId,
          userPrincipal: userPrincipal,
          eventType: 'subscribed',
          tier: tier,
          monthlyCredits: plan.monthlyCredits,
          priceUSD: plan.price,
          timestamp: Date.now(),
          subscriptionId: subscription.id,
          customerId: subscription.customer
        });
      } catch (trackingError) {
        console.warn('⚠️ [SubscriptionService] Failed to track subscription event:', trackingError);
      }

      return {
        success: true,
        data: {
          tier,
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          billingCycleStart: subscription.current_period_start * 1000,
          billingCycleEnd: subscription.current_period_end * 1000,
          promisedCredits: plan.monthlyCredits,
          actualCreditsDelivered: creditAllocation.creditsEquivalent || 0,
          unitsAllocated: creditAllocation.unitsAllocated,
          creditAllocationSuccess: creditAllocation.success
        }
      };

    } catch (error) {
      console.error('❌ [SubscriptionService] Subscription verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Subscription verification failed'
      };
    }
  }

  public async getCurrentSubscription(
    userCanisterId: string,
    identity: Identity
  ): Promise<SubscriptionState | null> {
    try {
      console.log('📊 [SubscriptionService] Fetching current subscription status');
      
      // Get subscription info from backend
      const subscriptionInfo = await userCanisterService.getSubscriptionInfo(userCanisterId, identity);
      if (!subscriptionInfo) {
        return this.createDefaultSubscriptionState();
      }

      // If we have a Stripe subscription ID, get current status from Stripe
      if (subscriptionInfo.subscriptionId && this.mainActor) {
        try {
          const stripeSubResult = await this.mainActor.getStripeSubscription(subscriptionInfo.subscriptionId);
          if ('ok' in stripeSubResult) {
            const stripeSubscription = JSON.parse(stripeSubResult.ok);
            
            return {
              currentTier: subscriptionInfo.tier,
              isActive: stripeSubscription.status === 'active',
              customerId: stripeSubscription.customer,
              subscriptionId: stripeSubscription.id,
              billingCycleStart: stripeSubscription.current_period_start * 1000,
              billingCycleEnd: stripeSubscription.current_period_end * 1000,
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
              paymentMethod: null // Would need separate API call to get payment method details
            };
          }
        } catch (stripeError) {
          console.warn('⚠️ [SubscriptionService] Could not fetch current Stripe subscription status:', stripeError);
        }
      }

      // Fallback to backend-only subscription state
      return {
        currentTier: subscriptionInfo.tier,
        isActive: subscriptionInfo.isActive,
        customerId: subscriptionInfo.customerId,
        subscriptionId: subscriptionInfo.subscriptionId,
        billingCycleStart: subscriptionInfo.billingCycleStart,
        billingCycleEnd: subscriptionInfo.billingCycleEnd,
        cancelAtPeriodEnd: false,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
        paymentMethod: null
      };

    } catch (error) {
      console.error('❌ [SubscriptionService] Failed to get current subscription:', error);
      return this.createDefaultSubscriptionState();
    }
  }

  private createDefaultSubscriptionState(): SubscriptionState {
    return {
      currentTier: SubscriptionTier.FREE,
      isActive: false,
      customerId: null,
      subscriptionId: null,
      billingCycleStart: null,
      billingCycleEnd: null,
      cancelAtPeriodEnd: false,
      lastUpdated: Date.now(),
      isLoading: false,
      error: null,
      paymentMethod: null
    };
  }

  public async openCustomerPortal(
    customerId: string,
    returnUrl?: string
  ): Promise<string | null> {
    try {
      console.log('🔗 [SubscriptionService] Opening customer portal for:', customerId);
      
      if (!this.mainActor) {
        throw new Error('Main actor not available for customer portal');
      }

      const portalUrl = returnUrl || window.location.origin;
      
      const portalResult = await this.mainActor.createStripeCustomerPortal(customerId, portalUrl);
      if ('err' in portalResult) {
        throw new Error('Failed to create customer portal session: ' + portalResult.err);
      }

      const portal = JSON.parse(portalResult.ok);
      return portal.url;

    } catch (error) {
      console.error('❌ [SubscriptionService] Failed to open customer portal:', error);
      return null;
    }
  }

  public async cancelSubscription(
    subscriptionId: string,
    userCanisterId: string,
    identity: Identity
  ): Promise<SubscriptionResult> {
    try {
      console.log('❌ [SubscriptionService] Cancelling subscription:', subscriptionId);
      
      if (!this.mainActor) {
        throw new Error('Main actor not available for subscription cancellation');
      }

      // Cancel subscription in Stripe
      const cancelResult = await this.mainActor.cancelStripeSubscription(subscriptionId);
      if ('err' in cancelResult) {
        throw new Error('Failed to cancel subscription: ' + cancelResult.err);
      }

      // Update backend to reflect cancellation
      const updateResult = await userCanisterService.updateSubscriptionTier(
        userCanisterId,
        identity,
        SubscriptionTier.FREE,
        0, // No credits for cancelled subscription
        {
          customerId: null,
          subscriptionId: null,
          billingCycleStart: null,
          billingCycleEnd: null
        }
      );

      if (!updateResult.success) {
        console.warn('⚠️ [SubscriptionService] Stripe cancellation succeeded but backend update failed:', updateResult.error);
      }

      console.log('✅ [SubscriptionService] Subscription cancelled successfully');

      return {
        success: true,
        data: { cancelled: true }
      };

    } catch (error) {
      console.error('❌ [SubscriptionService] Failed to cancel subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Subscription cancellation failed'
      };
    }
  }

  public async getBillingInfo(customerId: string): Promise<BillingInfo | null> {
    try {
      if (!this.mainActor || !customerId) {
        return null;
      }

      // Get upcoming invoice
      const upcomingResult = await this.mainActor.getStripeUpcomingInvoice(customerId);
      const paymentHistoryResult = await this.mainActor.getStripePaymentHistory(customerId);

      const billingInfo: BillingInfo = {
        upcomingInvoice: null,
        paymentHistory: []
      };

      if ('ok' in upcomingResult) {
        const upcoming = JSON.parse(upcomingResult.ok);
        billingInfo.upcomingInvoice = {
          amount: upcoming.amount_due,
          currency: upcoming.currency,
          periodStart: upcoming.period_start * 1000,
          periodEnd: upcoming.period_end * 1000
        };
      }

      if ('ok' in paymentHistoryResult) {
        const history = JSON.parse(paymentHistoryResult.ok);
        billingInfo.paymentHistory = history.data.map((payment: any) => ({
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          created: payment.created * 1000,
          invoiceUrl: payment.receipt_url
        }));
      }

      return billingInfo;

    } catch (error) {
      console.error('❌ [SubscriptionService] Failed to get billing info:', error);
      return null;
    }
  }

  public formatPrice(amount: number, currency: string = 'usd'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  public formatCredits(credits: number): string {
    if (credits === 0) return '0';
    if (credits < 1000) return credits.toString();
    if (credits < 1000000) return `${(credits / 1000).toFixed(1)}K`;
    return `${(credits / 1000000).toFixed(1)}M`;
  }

  public async getTierDisplayName(tier: SubscriptionTier): Promise<string> {
    const plan = await this.getPlanByTier(tier);
    return plan?.name || tier;
  }

  public async getTierIcon(tier: SubscriptionTier): Promise<string> {
    const plan = await this.getPlanByTier(tier);
    return plan?.icon || '📦';
  }

  public async getTierColor(tier: SubscriptionTier): Promise<string> {
    const plan = await this.getPlanByTier(tier);
    return plan?.color || '#6b7280';
  }

  public isUpgrade(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
    const tierOrder = [
      SubscriptionTier.FREE,
      SubscriptionTier.STARTER,
      SubscriptionTier.DEVELOPER,
      SubscriptionTier.PRO,
      SubscriptionTier.STUDIO
    ];
    
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(targetTier);
    
    return targetIndex > currentIndex;
  }

  public getStripeInstance(): Stripe | null {
    return this.stripe;
  }

  /**
   * Change subscription tier (upgrade or downgrade)
   * This creates a new checkout session for the new tier
   */
  public async changeSubscriptionTier(
    newTier: SubscriptionTier,
    userCanisterId: string,
    identity: Identity,
    currentSubscriptionId?: string
  ): Promise<SubscriptionCheckoutSession | null> {
    try {
      console.log('🔄 [SubscriptionService] Changing subscription tier to:', newTier);
      
      if (!this.mainActor) {
        throw new Error('Main actor not available for subscription change');
      }

      const plan = await this.getPlanByTier(newTier);
      if (!plan) {
        throw new Error(`Plan not found for tier: ${newTier}`);
      }

      // Determine environment and get appropriate price ID
      const isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
      const priceId = isDevelopment ? plan.stripePriceId.test : plan.stripePriceId.live;

      console.log('🎯 [SubscriptionService] Using price ID for new tier:', priceId);

      // Get or create Stripe customer
      const principal = identity.getPrincipal().toString();
      let customerId: string | null = null;

      try {
        const customerResult = await this.mainActor.getStripeCustomerId();
        if ('ok' in customerResult) {
          customerId = customerResult.ok;
          console.log('✅ [SubscriptionService] Found existing customer:', customerId);
        }
      } catch (error) {
        console.log('ℹ️ [SubscriptionService] No existing customer found');
      }

      if (!customerId) {
        throw new Error('Customer ID required for subscription change');
      }

      // Create checkout session for subscription change
      // Stripe will handle prorating automatically
      const checkoutSessionData = {
        mode: 'subscription' as const,
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        success_url: `${window.location.origin}/?subscription_change_success=true&session_id={CHECKOUT_SESSION_ID}&tier=${newTier}`,
        cancel_url: `${window.location.origin}/?subscription_change_cancelled=true`,
        customer: customerId,
        subscription_data: {
          metadata: {
            user_canister_id: userCanisterId,
            user_principal: principal,
            subscription_tier: newTier,
            is_change: 'true'
          }
        },
        // If we have a current subscription, Stripe will handle the change automatically
        // when the customer completes checkout
      };

      let checkoutSession: any;
      
      try {
        if (typeof this.mainActor.createStripeCheckoutSession === 'function') {
          const sessionResult = await this.mainActor.createStripeCheckoutSession(
            JSON.stringify(checkoutSessionData)
          );
          
          if ('ok' in sessionResult) {
            checkoutSession = JSON.parse(sessionResult.ok);
          } else {
            throw new Error('Backend checkout session creation failed: ' + sessionResult.err);
          }
        } else {
          throw new Error('Backend checkout session method not available');
        }
      } catch (backendError) {
        console.warn('⚠️ [SubscriptionService] Backend checkout session creation failed, using direct Stripe API');
        
        const secretKeyResult = await this.mainActor.getStripeSecretKey();
        if ('ok' in secretKeyResult) {
          const secretKey = secretKeyResult.ok;
          
          const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${secretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              'mode': 'subscription',
              'line_items[0][price]': priceId,
              'line_items[0][quantity]': '1',
              'success_url': checkoutSessionData.success_url,
              'cancel_url': checkoutSessionData.cancel_url,
              'customer': customerId,
              'subscription_data[metadata][user_canister_id]': userCanisterId,
              'subscription_data[metadata][user_principal]': principal,
              'subscription_data[metadata][subscription_tier]': newTier,
              'subscription_data[metadata][is_change]': 'true'
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Stripe API error: ${errorData.error?.message || 'Unknown error'}`);
          }

          checkoutSession = await response.json();
        } else {
          throw new Error('Cannot create checkout session: no backend method and no secret key available');
        }
      }

      if (!checkoutSession || !checkoutSession.id || !checkoutSession.url) {
        throw new Error('Invalid checkout session response from Stripe');
      }

      console.log('✅ [SubscriptionService] Subscription change checkout session created:', checkoutSession.id);

      return {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        tier: newTier,
        customerId: checkoutSession.customer
      };

    } catch (error) {
      console.error('❌ [SubscriptionService] Failed to change subscription tier:', error);
      return null;
    }
  }

  /**
   * Sync subscription changes from Stripe after a tier change
   * This should be called when returning from Stripe checkout or when webhook is received
   */
  public async syncSubscriptionChange(
    subscriptionId: string,
    userCanisterId: string,
    identity: Identity,
    addUnitsToBalance: (units: number) => Promise<boolean>
  ): Promise<SubscriptionResult> {
    try {
      console.log('🔄 [SubscriptionService] Syncing subscription change:', subscriptionId);
      
      if (!this.mainActor) {
        throw new Error('Main actor not available for subscription sync');
      }

      // Get subscription details from Stripe
      const subscriptionResult = await this.mainActor.getStripeSubscription(subscriptionId);
      if ('err' in subscriptionResult) {
        throw new Error('Failed to retrieve subscription: ' + subscriptionResult.err);
      }

      const subscription = JSON.parse(subscriptionResult.ok);
      const tier = subscription.metadata?.subscription_tier as SubscriptionTier;
      
      if (!tier || !Object.values(SubscriptionTier).includes(tier)) {
        throw new Error('Invalid subscription tier in metadata');
      }

      const plan = await this.getPlanByTier(tier);
      if (!plan) {
        throw new Error('Plan configuration not found for tier: ' + tier);
      }

      // Calculate credit adjustment based on tier change
      // NOTE: Credits are ADDED to existing balance (not replaced)
      // User receives full monthly credits for the new tier since they're paying for it
      // (Stripe handles payment prorating, but user gets full tier benefits including credits)
      console.log('🎁 [SubscriptionService] Allocating credits for new subscription tier:', tier);
      console.log('💰 [SubscriptionService] Credits will be ADDED to existing balance (not replaced)');
      console.log('💳 [SubscriptionService] User receives full monthly credits for new tier (payment prorating handled by Stripe)');
      
      const creditAllocation = await this.allocateSubscriptionCredits(
        tier,
        userCanisterId,
        identity,
        addUnitsToBalance
      );

      if (!creditAllocation.success) {
        console.warn('⚠️ [SubscriptionService] Subscription change verified but credit allocation failed:', creditAllocation.error);
      } else {
        console.log('✅ [SubscriptionService] Credits allocated for subscription change:', creditAllocation.creditsEquivalent, 'credits');
      }

      // Update backend with new subscription information
      const updateResult = await userCanisterService.updateSubscriptionTier(
        userCanisterId,
        identity,
        tier,
        plan.monthlyCredits,
        {
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          billingCycleStart: subscription.current_period_start * 1000,
          billingCycleEnd: subscription.current_period_end * 1000,
          lastCreditAllocation: creditAllocation.success ? Date.now() : undefined
        }
      );

      if (!updateResult.success) {
        throw new Error('Failed to update subscription in backend: ' + updateResult.error);
      }

      console.log('✅ [SubscriptionService] Subscription change synced successfully:', tier);

      return {
        success: true,
        data: {
          tier,
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          billingCycleStart: subscription.current_period_start * 1000,
          billingCycleEnd: subscription.current_period_end * 1000,
          promisedCredits: plan.monthlyCredits,
          actualCreditsDelivered: creditAllocation.creditsEquivalent || 0,
          unitsAllocated: creditAllocation.unitsAllocated,
          creditAllocationSuccess: creditAllocation.success
        }
      };

    } catch (error) {
      console.error('❌ [SubscriptionService] Failed to sync subscription change:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Subscription sync failed'
      };
    }
  }
}

export const subscriptionService = SubscriptionService.getInstance();