import Array "mo:base/Array";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Option "mo:base/Option";
import Buffer "mo:base/Buffer";
import Nat "mo:base/Nat";
import SubscriptionTypes "subscription_types";

module SubscriptionManager {
    
    type SubscriptionTier = SubscriptionTypes.SubscriptionTier;
    type SubscriptionPlan = SubscriptionTypes.SubscriptionPlan;
    type SubscriptionPlanInput = SubscriptionTypes.SubscriptionPlanInput;
    type PlanFeature = SubscriptionTypes.PlanFeature;
    
    public class SubscriptionPlans() {
        
        // Store plans in a buffer for easy updates
        private var plans: Buffer.Buffer<SubscriptionPlan> = Buffer.Buffer<SubscriptionPlan>(4);
        
        // Initialize with default plans
        public func initializeDefaultPlans() {
            if (plans.size() == 0) {
                // FREE tier
                plans.add({
                    tier = #FREE;
                    name = "Free";
                    description = "Perfect for exploring Kontext";
                    monthlyPrice = 0;
                    originalPrice = null;
                    discountPercentage = null;
                    monthlyCredits = 1000;
                    hostingCredits = 500;
                    maxProjects = ?1;
                    features = [
                        { description = "1K AI credits"; enabled = true; order = 0 },
                        { description = "500 hosting credits"; enabled = true; order = 1 },
                        { description = "1 project"; enabled = true; order = 2 },
                        { description = "Basic IDE"; enabled = true; order = 3 },
                        { description = "Forum & documentation"; enabled = true; order = 4 }
                    ];
                    badges = [];
                    ctaText = "Continue with Free Tier";
                    isActive = true;
                    order = 0;
                    stripeProductId = null;
                    stripePriceId = null;
                    createdAt = Time.now();
                    updatedAt = Time.now();
                });
                
                // STARTER tier
                plans.add({
                    tier = #STARTER;
                    name = "Starter";
                    description = "Perfect for learning and small projects";
                    monthlyPrice = 100; // $1.00
                    originalPrice = ?1500; // $15.00
                    discountPercentage = ?93;
                    monthlyCredits = 10000;
                    hostingCredits = 5000;
                    maxProjects = ?3;
                    features = [
                        { description = "10K credits per month"; enabled = true; order = 0 },
                        { description = "Support: Forum & documentation"; enabled = true; order = 1 }
                    ];
                    badges = ["Most Popular", "LAUNCH SPECIAL"];
                    ctaText = "Start Building Now";
                    isActive = true;
                    order = 1;
                    stripeProductId = null;
                    stripePriceId = null;
                    createdAt = Time.now();
                    updatedAt = Time.now();
                });
                
                // DEVELOPER tier
                plans.add({
                    tier = #DEVELOPER;
                    name = "Developer";
                    description = "For professional developers who need power";
                    monthlyPrice = 5000; // $50.00
                    originalPrice = ?7900; // $79.00
                    discountPercentage = ?37;
                    monthlyCredits = 50000;
                    hostingCredits = 25000;
                    maxProjects = ?10;
                    features = [
                        { description = "50K credits per month"; enabled = true; order = 0 },
                        { description = "Custom domain purchasing"; enabled = true; order = 1 },
                        { description = "Agents and agent workflows"; enabled = true; order = 2 },
                        { description = "Basic customer support"; enabled = true; order = 3 }
                    ];
                    badges = ["37% OFF"];
                    ctaText = "Unlock Pro Features";
                    isActive = true;
                    order = 2;
                    stripeProductId = null;
                    stripePriceId = null;
                    createdAt = Time.now();
                    updatedAt = Time.now();
                });
                
                // PRO tier
                plans.add({
                    tier = #PRO;
                    name = "Pro";
                    description = "For teams & agencies scaling fast";
                    monthlyPrice = 10000; // $100.00
                    originalPrice = ?14900; // $149.00
                    discountPercentage = ?33;
                    monthlyCredits = 75000;
                    hostingCredits = 50000;
                    maxProjects = null; // unlimited
                    features = [
                        { description = "75K credits per month"; enabled = true; order = 0 },
                        { description = "Custom domain purchasing"; enabled = true; order = 1 },
                        { description = "Agents and agent workflows"; enabled = true; order = 2 },
                        { description = "Business agency dashboard"; enabled = true; order = 3 },
                        { description = "VIP customer support"; enabled = true; order = 4 }
                    ];
                    badges = ["33% OFF"];
                    ctaText = "Scale Your Business";
                    isActive = true;
                    order = 3;
                    stripeProductId = null;
                    stripePriceId = null;
                    createdAt = Time.now();
                    updatedAt = Time.now();
                });
            };
        };
        
        // Get all plans (admin only)
        public func getAllPlans() : [SubscriptionPlan] {
            Buffer.toArray(plans)
        };
        
        // Get active plans (public)
        public func getActivePlans() : [SubscriptionPlan] {
            let activePlans = Buffer.Buffer<SubscriptionPlan>(plans.size());
            for (plan in plans.vals()) {
                if (plan.isActive) {
                    activePlans.add(plan);
                };
            };
            Buffer.toArray(activePlans)
        };
        
        // Get plan by tier
        public func getPlanByTier(tier: SubscriptionTier) : ?SubscriptionPlan {
            for (plan in plans.vals()) {
                if (plan.tier == tier) {
                    return ?plan;
                };
            };
            null
        };
        
        // Create or update a plan (admin only)
        public func upsertPlan(input: SubscriptionPlanInput) : SubscriptionPlan {
            let now = Time.now();
            
            // Check if plan exists
            var existingIndex : ?Nat = null;
            var i = 0;
            label findLoop for (plan in plans.vals()) {
                if (plan.tier == input.tier) {
                    existingIndex := ?i;
                    break findLoop;
                };
                i += 1;
            };
            
            let newPlan : SubscriptionPlan = {
                tier = input.tier;
                name = input.name;
                description = input.description;
                monthlyPrice = input.monthlyPrice;
                originalPrice = input.originalPrice;
                discountPercentage = input.discountPercentage;
                monthlyCredits = input.monthlyCredits;
                hostingCredits = input.hostingCredits;
                maxProjects = input.maxProjects;
                features = input.features;
                badges = input.badges;
                ctaText = input.ctaText;
                isActive = input.isActive;
                order = input.order;
                stripeProductId = input.stripeProductId;
                stripePriceId = input.stripePriceId;
                createdAt = switch (existingIndex) {
                    case (null) { now };
                    case (?idx) { plans.get(idx).createdAt };
                };
                updatedAt = now;
            };
            
            switch (existingIndex) {
                case (null) {
                    // Create new
                    plans.add(newPlan);
                };
                case (?idx) {
                    // Update existing
                    plans.put(idx, newPlan);
                };
            };
            
            newPlan
        };
        
        // Delete a plan (admin only)
        public func deletePlan(tier: SubscriptionTier) : Bool {
            var found = false;
            let newPlans = Buffer.Buffer<SubscriptionPlan>(plans.size());
            
            for (plan in plans.vals()) {
                if (plan.tier != tier) {
                    newPlans.add(plan);
                } else {
                    found := true;
                };
            };
            
            if (found) {
                plans := newPlans;
            };
            
            found
        };
        
        // Generate comprehensive AI prompt for subscription enforcement
        public func getSubscriptionPrompt() : Text {
            var prompt = "# KONTEXT SUBSCRIPTION TIERS - COMPREHENSIVE ENFORCEMENT GUIDE\n\n";
            prompt #= "This document provides a complete overview of all subscription tiers and their restrictions.\n";
            prompt #= "Use this information to enforce proper access control and feature gating throughout the application.\n\n";
            prompt #= "═══════════════════════════════════════════════════════════════════════════════\n\n";
            
            // Sort plans by order
            let sortedPlans = Array.sort<SubscriptionPlan>(
                Buffer.toArray(plans),
                func(a, b) {
                    if (a.order < b.order) { #less } 
                    else if (a.order > b.order) { #greater } 
                    else { #equal }
                }
            );
            
            for (plan in sortedPlans.vals()) {
                // Header
                prompt #= "## " # plan.name # " TIER";
                switch (plan.tier) {
                    case (#FREE) { prompt #= " (FREE)" };
                    case (#STARTER) { prompt #= " (STARTER)" };
                    case (#DEVELOPER) { prompt #= " (DEVELOPER)" };
                    case (#PRO) { prompt #= " (PRO)" };
                    case (#ENTERPRISE) { prompt #= " (ENTERPRISE)" };
                };
                prompt #= "\n\n";
                
                // Status
                prompt #= "**Status**: " # (if (plan.isActive) { "✅ ACTIVE" } else { "❌ INACTIVE" }) # "\n";
                
                // Pricing
                let price = plan.monthlyPrice / 100;
                let cents = plan.monthlyPrice % 100;
                prompt #= "**Price**: $" # Nat.toText(price) # "." # (if (cents < 10) { "0" } else { "" }) # Nat.toText(cents) # "/month\n";
                
                if (plan.originalPrice != null) {
                    let origPrice = Option.get(plan.originalPrice, 0) / 100;
                    let origCents = Option.get(plan.originalPrice, 0) % 100;
                    prompt #= "**Original Price**: $" # Nat.toText(origPrice) # "." # (if (origCents < 10) { "0" } else { "" }) # Nat.toText(origCents);
                    
                    if (plan.discountPercentage != null) {
                        prompt #= " (" # Nat.toText(Option.get(plan.discountPercentage, 0)) # "% OFF)";
                    };
                    prompt #= "\n";
                };
                
                prompt #= "\n### 🎯 RESOURCE LIMITS (ENFORCE THESE!)\n\n";
                
                // Credits
                prompt #= "- **Monthly AI Credits**: " # Nat.toText(plan.monthlyCredits) # " credits\n";
                prompt #= "  - This is the maximum AI usage per billing cycle\n";
                prompt #= "  - Block AI features when credits exhausted\n";
                prompt #= "  - Show credit warnings at 80% and 90%\n\n";
                
                // Hosting
                prompt #= "- **Hosting Credits**: " # Nat.toText(plan.hostingCredits) # " credits\n";
                prompt #= "  - Used for deployment and canister hosting\n";
                prompt #= "  - Block deployments when exhausted\n\n";
                
                // Projects
                switch (plan.maxProjects) {
                    case (null) {
                        prompt #= "- **Max Projects**: UNLIMITED ♾️\n";
                        prompt #= "  - No restrictions on project creation\n\n";
                    };
                    case (?max) {
                        prompt #= "- **Max Projects**: " # Nat.toText(max) # "\n";
                        prompt #= "  - Prevent creating more than " # Nat.toText(max) # " project(s)\n";
                        prompt #= "  - Show upgrade prompt when limit reached\n\n";
                    };
                };
                
                // Features
                if (plan.features.size() > 0) {
                    prompt #= "### ✨ FEATURES & CAPABILITIES\n\n";
                    
                    let enabledFeatures = Array.filter<PlanFeature>(
                        plan.features,
                        func(f) { f.enabled }
                    );
                    
                    let disabledFeatures = Array.filter<PlanFeature>(
                        plan.features,
                        func(f) { not f.enabled }
                    );
                    
                    if (enabledFeatures.size() > 0) {
                        prompt #= "**Enabled Features (✅ ALLOW ACCESS):**\n";
                        for (feature in enabledFeatures.vals()) {
                            prompt #= "- ✅ " # feature.description # "\n";
                        };
                        prompt #= "\n";
                    };
                    
                    if (disabledFeatures.size() > 0) {
                        prompt #= "**Disabled Features (🚫 BLOCK ACCESS):**\n";
                        for (feature in disabledFeatures.vals()) {
                            prompt #= "- 🚫 " # feature.description # "\n";
                        };
                        prompt #= "\n";
                    };
                };
                
                // Badges (for context)
                if (plan.badges.size() > 0) {
                    prompt #= "### 🏷️ Marketing Badges\n";
                    for (badge in plan.badges.vals()) {
                        prompt #= "- " # badge # "\n";
                    };
                    prompt #= "\n";
                };
                
                prompt #= "---\n\n";
            };
            
            // Summary enforcement guide
            prompt #= "═══════════════════════════════════════════════════════════════════════════════\n\n";
            prompt #= "## 🛡️ ENFORCEMENT CHECKLIST\n\n";
            prompt #= "When reviewing the application code, ensure:\n\n";
            prompt #= "1. **Project Creation**: Check tier's maxProjects limit before allowing new projects\n";
            prompt #= "2. **AI Usage**: Deduct from monthlyCredits on each AI call, block when exhausted\n";
            prompt #= "3. **Deployments**: Deduct from hostingCredits, block deployments if insufficient\n";
            prompt #= "4. **Feature Gating**: Hide/disable features marked as disabled for the tier\n";
            prompt #= "5. **Upgrade Prompts**: Show clear upgrade CTAs when limits are reached\n";
            prompt #= "6. **Credit Display**: Always show remaining credits to users\n";
            prompt #= "7. **Tier Identification**: Use the tier enum (FREE, STARTER, DEVELOPER, PRO, ENTERPRISE)\n";
            prompt #= "8. **Admin Bypass**: Admin users should bypass all subscription checks\n\n";
            prompt #= "### 🎯 Key Enforcement Points in Code:\n\n";
            prompt #= "- **Frontend**: `SubscriptionSelectionInterface.tsx`, `ProfileInterface.tsx`, `ChatInterface.tsx`\n";
            prompt #= "- **State Management**: `subscriptionSlice.ts`, `initializationSlice.ts`\n";
            prompt #= "- **Services**: `StripeService.ts`, `UserCanisterService.ts`, `DeploymentService.tsx`\n";
            prompt #= "- **Backend**: User canister credit checks, platform canister tier validation\n\n";
            prompt #= "### 🔍 What to Look For:\n\n";
            prompt #= "- Hardcoded credit amounts (should come from subscription plan)\n";
            prompt #= "- Missing project count checks\n";
            prompt #= "- Features accessible without tier checks\n";
            prompt #= "- Deployment flows without hosting credit validation\n";
            prompt #= "- UI elements that should be hidden for lower tiers\n\n";
            prompt #= "═══════════════════════════════════════════════════════════════════════════════\n";
            
            prompt
        };
        
        // Stable storage helpers
        public func toStableData() : [SubscriptionPlan] {
            Buffer.toArray(plans)
        };
        
        public func fromStableData(data: [SubscriptionPlan]) {
            plans := Buffer.Buffer<SubscriptionPlan>(data.size());
            for (plan in data.vals()) {
                plans.add(plan);
            };
        };
    }
}

