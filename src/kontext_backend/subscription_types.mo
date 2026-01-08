import Principal "mo:base/Principal";
import Time "mo:base/Time";

module SubscriptionTypes {
    
    // Subscription Tier enum
    public type SubscriptionTier = {
        #FREE;
        #STARTER;
        #DEVELOPER;
        #PRO;
        #ENTERPRISE;
    };
    
    // Individual feature item for a plan
    public type PlanFeature = {
        description: Text;
        enabled: Bool;
        order: Nat;
    };
    
    // Complete subscription plan configuration
    public type SubscriptionPlan = {
        tier: SubscriptionTier;
        name: Text;
        description: Text;
        monthlyPrice: Nat; // In cents (e.g., 5000 = $50.00)
        originalPrice: ?Nat; // Original price before discount (for showing savings)
        discountPercentage: ?Nat; // e.g., 37 for 37% off
        monthlyCredits: Nat;
        hostingCredits: Nat;
        maxProjects: ?Nat; // null = unlimited
        features: [PlanFeature];
        badges: [Text]; // e.g., ["Most Popular", "LAUNCH SPECIAL"]
        ctaText: Text; // Call-to-action button text
        isActive: Bool;
        order: Nat; // Display order
        stripeProductId: ?Text;
        stripePriceId: ?Text;
        createdAt: Int;
        updatedAt: Int;
    };
    
    // Request to create/update a plan
    public type SubscriptionPlanInput = {
        tier: SubscriptionTier;
        name: Text;
        description: Text;
        monthlyPrice: Nat;
        originalPrice: ?Nat;
        discountPercentage: ?Nat;
        monthlyCredits: Nat;
        hostingCredits: Nat;
        maxProjects: ?Nat;
        features: [PlanFeature];
        badges: [Text];
        ctaText: Text;
        isActive: Bool;
        order: Nat;
        stripeProductId: ?Text;
        stripePriceId: ?Text;
    };
    
}

