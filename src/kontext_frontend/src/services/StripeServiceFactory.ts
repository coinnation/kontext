/**
 * StripeServiceFactory
 * 
 * 🔄 SMART FALLBACK SYSTEM
 * - Tries SecureStripeService first (backend-based, secure)
 * - Falls back to legacy StripeService on failure
 * - Logs all failures for monitoring
 * - Allows gradual migration without breaking production
 * 
 * Usage:
 *   import { stripeService } from './services/StripeServiceFactory';
 *   await stripeService.initialize();
 *   const result = await stripeService.createPaymentIntent(...);
 */

import { SecureStripeService, secureStripeService } from './SecureStripeService';
import { StripeService } from './StripeService';
import { subscriptionService, SubscriptionService } from './SubscriptionService';
import type { Stripe } from '@stripe/stripe-js';

class StripeServiceFactory {
  private _secureService: SecureStripeService | null = null;
  private _legacyService: StripeService | null = null;
  private useSecure: boolean = true; // Default to secure
  private failureCount: number = 0;
  private readonly MAX_FAILURES_BEFORE_FALLBACK = 3;
  
  // Track which methods have failed (for granular fallback)
  private methodFailures: Map<string, number> = new Map();

  constructor() {
    // Services are now lazy-initialized to avoid circular initialization issues
  }

  // Lazy-initialize secure service
  private get secureService(): SecureStripeService {
    if (!this._secureService) {
      this._secureService = secureStripeService;
    }
    return this._secureService;
  }

  // Lazy-initialize legacy service
  private get legacyService(): StripeService {
    if (!this._legacyService) {
      this._legacyService = StripeService.getInstance();
    }
    return this._legacyService;
  }

  /**
   * Log failure and decide whether to fallback permanently
   */
  private logFailure(method: string, error: any): void {
    console.error(`❌ [StripeServiceFactory] ${method} failed with SecureStripeService:`, error);
    
    // Increment global failure counter
    this.failureCount++;
    
    // Increment method-specific failure counter
    const currentFailures = this.methodFailures.get(method) || 0;
    this.methodFailures.set(method, currentFailures + 1);
    
    // If too many failures globally, switch to legacy permanently for this session
    if (this.failureCount >= this.MAX_FAILURES_BEFORE_FALLBACK) {
      console.warn(
        `⚠️ [StripeServiceFactory] Too many failures (${this.failureCount}). ` +
        `Switching to legacy StripeService for remainder of session.`
      );
      this.useSecure = false;
    }
    
    // Log to external monitoring (if available)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: {
          service: 'SecureStripeService',
          method: method,
          fallback: 'active'
        }
      });
    }
  }

  /**
   * Execute with fallback logic
   */
  private async executeWithFallback<T>(
    method: string,
    secureOperation: () => Promise<T>,
    legacyOperation: () => Promise<T>
  ): Promise<T> {
    // If already switched to legacy, use it directly
    if (!this.useSecure) {
      console.log(`🔄 [StripeServiceFactory] ${method} - using legacy service (fallback mode active)`);
      return legacyOperation();
    }

    try {
      console.log(`🔐 [StripeServiceFactory] ${method} - trying secure service first`);
      const result = await secureOperation();
      
      // Reset failure counter on success
      if (this.failureCount > 0) {
        console.log(`✅ [StripeServiceFactory] ${method} succeeded - resetting failure counter`);
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      this.logFailure(method, error);
      
      // Fallback to legacy service
      console.warn(`⚠️ [StripeServiceFactory] ${method} - falling back to legacy service`);
      
      try {
        return await legacyOperation();
      } catch (legacyError) {
        console.error(`❌ [StripeServiceFactory] ${method} - BOTH services failed:`, {
          secureError: error,
          legacyError
        });
        throw legacyError; // Throw the legacy error as final result
      }
    }
  }

  /**
   * Initialize both services
   */
  public async initialize(): Promise<void> {
    console.log('🔄 [StripeServiceFactory] Initializing services...');
    
    // Try secure first
    try {
      await this.secureService.initialize();
      console.log('✅ [StripeServiceFactory] SecureStripeService initialized');
    } catch (error) {
      console.error('❌ [StripeServiceFactory] SecureStripeService initialization failed:', error);
      this.logFailure('initialize', error);
    }
    
    // Always initialize legacy as backup
    try {
      await this.legacyService.initialize();
      console.log('✅ [StripeServiceFactory] Legacy StripeService initialized (backup)');
    } catch (error) {
      console.error('❌ [StripeServiceFactory] Legacy StripeService initialization failed:', error);
    }
  }

  /**
   * Create Payment Intent
   */
  public async createPaymentIntent(
    amountInCents: number,
    currency: string = 'usd',
    description: string = 'Kontext Credits Purchase'
  ): Promise<any> {
    return this.executeWithFallback(
      'createPaymentIntent',
      () => this.secureService.createPaymentIntent(amountInCents, currency, description),
      () => this.legacyService.createPaymentIntent(amountInCents, currency, description)
    );
  }

  /**
   * Create Checkout Session
   */
  public async createCheckoutSession(
    tier: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<any> {
    return this.executeWithFallback(
      'createCheckoutSession',
      () => this.secureService.createCheckoutSession(tier, priceId, successUrl, cancelUrl),
      () => this.legacyService.createCheckoutSession(tier, priceId, successUrl, cancelUrl)
    );
  }

  /**
   * Verify Payment Intent
   */
  public async verifyPaymentIntent(paymentIntentId: string): Promise<any> {
    return this.executeWithFallback(
      'verifyPaymentIntent',
      () => this.secureService.verifyPaymentIntent(paymentIntentId),
      () => this.legacyService.verifyPaymentIntent(paymentIntentId)
    );
  }

  /**
   * Get Subscription Status (with caching)
   */
  public async getSubscriptionStatus(forceRefresh: boolean = false): Promise<any> {
    return this.executeWithFallback(
      'getSubscriptionStatus',
      () => this.secureService.getSubscriptionStatus(forceRefresh),
      async () => {
        // Legacy service doesn't have forceRefresh, so just call it
        const result = await this.legacyService.checkSubscriptionStatus();
        return {
          success: true,
          ...result,
          cached: false
        };
      }
    );
  }

  /**
   * Create Billing Portal Session
   */
  public async createBillingPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<any> {
    return this.executeWithFallback(
      'createBillingPortalSession',
      () => this.secureService.createBillingPortalSession(customerId, returnUrl),
      () => this.legacyService.createBillingPortalSession(customerId, returnUrl)
    );
  }

  /**
   * Search Customer
   */
  public async searchCustomer(userPrincipal: string): Promise<any> {
    return this.executeWithFallback(
      'searchCustomer',
      () => this.secureService.searchCustomer(userPrincipal),
      () => this.legacyService.searchCustomer(userPrincipal)
    );
  }

  /**
   * Get Stripe instance (for confirmPayment, etc.)
   */
  public getStripe(): Stripe | null {
    // Try secure first, fallback to legacy
    return this.secureService.getStripe() || this.legacyService.getStripe();
  }

  /**
   * Get publishable key
   */
  public getPublishableKey(): string | null {
    return this.secureService.getPublishableKey() || this.legacyService.getPublishableKey();
  }

  /**
   * Clear cache (for both services)
   */
  public clearCache(): void {
    this.secureService.clearCache();
    console.log('🗑️ [StripeServiceFactory] Caches cleared');
  }

  /**
   * Force switch to legacy service (for emergency override)
   */
  public forceLegacyMode(): void {
    console.warn('⚠️ [StripeServiceFactory] FORCED LEGACY MODE - SecureStripeService disabled');
    this.useSecure = false;
  }

  /**
   * Re-enable secure service (after fixes)
   */
  public enableSecureMode(): void {
    console.log('✅ [StripeServiceFactory] Re-enabling SecureStripeService');
    this.useSecure = true;
    this.failureCount = 0;
    this.methodFailures.clear();
  }

  /**
   * Get current mode
   */
  public getCurrentMode(): 'secure' | 'legacy' {
    return this.useSecure ? 'secure' : 'legacy';
  }

  /**
   * Get failure stats (for monitoring dashboard)
   */
  public getFailureStats(): {
    totalFailures: number;
    methodFailures: Record<string, number>;
    currentMode: 'secure' | 'legacy';
  } {
    const stats: Record<string, number> = {};
    this.methodFailures.forEach((count, method) => {
      stats[method] = count;
    });

    return {
      totalFailures: this.failureCount,
      methodFailures: stats,
      currentMode: this.getCurrentMode()
    };
  }

  /**
   * Set main actor for both services (for backward compatibility)
   */
  public setMainActor(actor: any): void {
    console.log('🔄 [StripeServiceFactory] Setting main actor for both services');
    this.legacyService.setMainActor(actor);
    // SecureStripeService doesn't need setMainActor as it creates its own actor
  }

  /**
   * Get subscription service (for backward compatibility)
   */
  public getSubscriptionService(): SubscriptionService {
    return subscriptionService;
  }

  /**
   * Get pricing info (delegates to legacy service)
   */
  public async getPricingInfo(): Promise<{
    xdrRate: number;
    estimatedCreditsPerUSD: number;
    minAmountUSD: number;
    maxAmountUSD: number;
    description: string;
  } | null> {
    return this.legacyService.getPricingInfo();
  }

  /**
   * Process payment (delegates to legacy service)
   * This is a wrapper for processPaymentWithElements that matches the ProfileInterface signature
   */
  public async processPayment(
    amount: number,
    cardElement: any,
    estimatedCredits: number,
    estimatedUnits: number,
    userCanisterId: string,
    identity: any
  ): Promise<any> {
    // Get the principal from identity
    const userPrincipal = identity?.getPrincipal?.()?.toText() || '';
    
    // Create a mock Elements object with getElement method for the card element
    const elements = {
      getElement: (type: string) => {
        if (type === 'card') {
          return cardElement;
        }
        return null;
      }
    };
    
    // Use legacy service's processPaymentWithElements
    return this.legacyService.processPaymentWithElements(
      amount,
      elements,
      userCanisterId,
      userPrincipal,
      identity
    );
  }
}

// Export singleton instance
export const stripeService = new StripeServiceFactory();

// Export for type checking
export type { StripeServiceFactory };



