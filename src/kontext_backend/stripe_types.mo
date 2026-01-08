module StripeTypes {
    
    // ===== STRIPE CONFIGURATION =====
    
    public type StripeConfig = {
        secretKey: Text;
        publishableKey: Text;
        webhookSecret: Text;
    };
    
    // ===== PAYMENT INTENT =====
    
    public type PaymentIntentRequest = {
        amountInCents: Nat;
        currency: Text;
        userPrincipal: Principal;
        description: Text;
    };
    
    public type PaymentIntentResponse = {
        id: Text;
        clientSecret: Text;
        amount: Nat;
        status: Text;
    };
    
    // ===== CHECKOUT SESSION =====
    
    public type CheckoutSessionRequest = {
        priceId: Text;
        userPrincipal: Principal;
        tier: Text;
        isYearly: Bool;
        successUrl: Text;
        cancelUrl: Text;
    };
    
    public type CheckoutSessionResponse = {
        id: Text;
        url: Text;
    };
    
    // ===== SUBSCRIPTION =====
    
    public type SubscriptionStatus = {
        subscriptionId: Text;
        status: Text; // 'active', 'canceled', 'past_due', 'incomplete'
        currentPeriodEnd: Nat64;
        cancelAtPeriodEnd: Bool;
    };
    
    // ===== CUSTOMER =====
    
    public type CustomerLookupResult = {
        customerId: Text;
        email: ?Text;
        metadata: [(Text, Text)];
    };
    
    // ===== WEBHOOK EVENT =====
    
    public type WebhookEvent = {
        id: Text;
        eventType: Text; // 'payment_intent.succeeded', 'customer.subscription.created', etc.
        data: Text; // JSON string of event data
        timestamp: Nat64;
        processed: Bool;
    };
    
    // ===== PAYMENT VERIFICATION =====
    
    public type PaymentVerification = {
        paymentIntentId: Text;
        amountReceived: Nat;
        currency: Text;
        status: Text;
        metadata: [(Text, Text)];
    };
    
    // ===== BILLING PORTAL =====
    
    public type BillingPortalRequest = {
        customerId: Text;
        returnUrl: Text;
    };
    
    public type BillingPortalResponse = {
        url: Text;
    };
}

