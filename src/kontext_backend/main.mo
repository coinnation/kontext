// src/backend/src/main/main.mo
import CrudBase "./CrudBase";
import StandardTypes "./StandardTypes";
import canister "./canister";
import wallet "./wallet";
import MarketplaceTypes "./marketplace_types";
import StripeTypes "./stripe_types";
import StripeIntegration "./stripe_integration";
import AnalyticsTypes "./analytics_types";
import FinancialAnalyticsTypes "./financial_analytics_types";
import NotificationTypes "./notification_types";
import NotificationManager "./notification_manager";
import PoolTypes "./pool_types";
import PoolManager "./pool_manager";
import UniversityTypes "./university_types";
import UniversityManager "./university_manager";
import ForumTypes "./forum_types";
import ForumManager "./forum_manager";
import SubscriptionTypes "./subscription_types";
import SubscriptionManager "./subscription_manager";
import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Int "mo:base/Int";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Error "mo:base/Error";
import Buffer "mo:base/Buffer";
import Hash "mo:base/Hash";
import Float "mo:base/Float";
import Cycles "mo:base/ExperimentalCycles";
import Blob "mo:base/Blob";
import Nat8 "mo:base/Nat8";
import Nat64 "mo:base/Nat64";
import Order "mo:base/Order";
import L "mo:cn-logger/logger";

actor Main {
    // === LOGGING SUPPORT ===
    private stable var stableLogger : ?L.StableLoggerData = null;
    
    private let logger = L.Logger(
        stableLogger,
        ?{
            maxSize = 20000;  // Match user canister capacity
            retentionDays = 7;
        }
    );
    
    // Log initialization to verify logger is working
    let _ = do {
        logger.info("🚀 Platform canister initialized - logging system active");
        logger.info("📊 Logger configuration: maxSize=20000, retentionDays=7");
        logger.info("📍 This is the PLATFORM canister (kontext_backend)");
        logger.info("🔧 cn-logger version: active and ready");
    };

    // Simple LogEntry type to satisfy canister service
    type LogEntry = {
        message: Text;
        level: Text;
        timestamp: Text;
        details: ?Text;
    };

    type CanisterDefaultSettings = {
        memoryGB: Nat;
        computeAllocation: Nat;
        freezingThreshold: ?Nat;
        durationInDays: Nat;
        cyclesAmount: Nat;
    };

    // WASM upload session type for chunked uploads
    type WasmUploadSession = {
        sessionId: Text;
        fileName: Text;
        chunks: HashMap.HashMap<Nat, [Nat8]>;
        totalChunks: Nat;
        receivedChunks: Nat;
        totalSize: Nat;
        createdAt: Int;
    };

    // Wallet types from wallet service
    type Wallet = wallet.Wallet;
    type Transaction = wallet.Transaction;
    type TransactionType = wallet.TransactionType;

    // Payment tracking types - enhanced with proper cycles calculations
    type PaymentRecord = {
        paymentIntentId: Text;
        userPrincipal: Principal;
        amountUSD: Float;
        creditsGranted: Nat;
        tbCyclesRequested: Float;
        icpSpent: Nat; // e8s
        timestamp: Int;
        status: PaymentStatus;
    };

    type PaymentStatus = {
        #pending;
        #completed;
        #failed;
        #refunded;
    };

    // ===============================
    // STRIPE & ADMIN CONFIGURATION
    // ===============================
    
    // SECURE: Stripe secret key for payment processing (kept in canister)
    // TODO: Set via admin function after deployment
    private stable var stripeSecretKey: Text = "sk_live_YOUR_STRIPE_SECRET_KEY_HERE";
    
    // Stripe publishable key for frontend (safe to expose)
    // TODO: Set via admin function after deployment
    private stable var stripePublishableKey: Text = "pk_live_YOUR_STRIPE_PUBLISHABLE_KEY_HERE";
    
    // Stripe webhook secret for verifying webhook signatures
    // TODO: Set this from your Stripe webhook settings after deployment
    private stable var stripeWebhookSecret: Text = "";
    
    // ===============================
    // AI MODEL API KEYS (Platform-level)
    // ===============================
    
    // Claude (Anthropic) API key
    // TODO: Set via admin function after deployment
    private stable var claudeApiKey: Text = "";
    
    // OpenAI API key
    // TODO: Set via admin function after deployment
    private stable var openaiApiKey: Text = "";
    
    // Google Gemini API key
    // TODO: Set via admin function after deployment
    private stable var geminiApiKey: Text = "";
    
    // Kimi (Moonshot AI) API key
    // TODO: Set via admin function after deployment
    private stable var kimiApiKey: Text = "";
    
    // ===============================
    // SUBSCRIPTION CACHING (Phase 1: Prevent excessive Stripe API calls)
    // ===============================
    
    public type CachedSubscription = {
        tier: Text;              // 'free', 'starter', 'pro', 'enterprise'
        active: Bool;            // Is subscription currently active?
        expiresAt: Nat64;        // When billing cycle ends (nanoseconds)
        stripeCustomerId: ?Text; // Stripe customer ID
        lastChecked: Nat64;      // When we last verified with Stripe
    };
    
    private stable var subscriptionCacheEntries: [(Principal, CachedSubscription)] = [];
    private var subscriptionCache = HashMap.HashMap<Principal, CachedSubscription>(0, Principal.equal, Principal.hash);
    
    private let SUBSCRIPTION_CACHE_TTL : Nat64 = 3600_000_000_000; // 1 hour in nanoseconds
    
    // ===============================
    // ANALYTICS SYSTEM (Comprehensive Platform Intelligence)
    // ===============================
    
    // Counter for analytics record IDs
    private stable var nextAnalyticsId: Nat = 1;
    
    // 1. USER ACTIVITY ANALYTICS
    private stable var userActivityRecords: [AnalyticsTypes.UserActivityRecord] = [];
    private stable var userFirstSeenMap: [(Principal, Nat64)] = []; // Track user registration date
    private var userFirstSeen = HashMap.HashMap<Principal, Nat64>(0, Principal.equal, Principal.hash);
    
    // 2. FEATURE USAGE ANALYTICS
    private stable var featureUsageRecords: [AnalyticsTypes.FeatureUsageRecord] = [];
    
    // 3. REVENUE ANALYTICS
    private stable var revenueRecords: [AnalyticsTypes.RevenueRecord] = [];
    
    // 4. MARKETPLACE ANALYTICS
    private stable var marketplaceRecords: [AnalyticsTypes.MarketplaceRecord] = [];
    
    // 5. ERROR TRACKING
    private stable var errorRecords: [AnalyticsTypes.ErrorRecord] = [];
    
    // 6. PERFORMANCE METRICS
    private stable var performanceRecords: [AnalyticsTypes.PerformanceRecord] = [];
    
    // 7. SYSTEM HEALTH METRICS
    private stable var systemHealthRecords: [AnalyticsTypes.SystemHealthRecord] = [];
    private stable var lastSystemHealthCheck: Nat64 = 0;
    
    // DATA RETENTION LIMITS (to prevent unbounded growth)
    private let MAX_ACTIVITY_RECORDS : Nat = 100_000; // ~10MB
    private let MAX_FEATURE_RECORDS : Nat = 50_000;   // ~5MB
    private let MAX_REVENUE_RECORDS : Nat = 10_000;   // ~1MB
    private let MAX_MARKETPLACE_RECORDS : Nat = 20_000; // ~2MB
    private let MAX_ERROR_RECORDS : Nat = 10_000;     // ~1MB
    private let MAX_PERFORMANCE_RECORDS : Nat = 50_000; // ~5MB
    private let MAX_HEALTH_RECORDS : Nat = 1_000;     // ~100KB
    
    // Cached metrics (updated periodically to avoid recalculation on every query)
    private stable var cachedUserMetrics: ?AnalyticsTypes.UserMetrics = null;
    private stable var cachedFeatureMetrics: ?AnalyticsTypes.FeatureMetrics = null;
    private stable var cachedRevenueMetrics: ?AnalyticsTypes.RevenueMetrics = null;
    private stable var cachedMarketplaceMetrics: ?AnalyticsTypes.MarketplaceMetrics = null;
    private stable var cachedErrorMetrics: ?AnalyticsTypes.ErrorMetrics = null;
    private stable var cachedPerformanceMetrics: ?AnalyticsTypes.PerformanceMetrics = null;
    private stable var lastMetricsCacheUpdate: Nat64 = 0;
    private let METRICS_CACHE_TTL : Nat64 = 300_000_000_000; // 5 minutes in nanoseconds
    
    // ===============================
    // FINANCIAL ANALYTICS (Treasury & Revenue Management)
    // ===============================
    
    // Counter for financial records
    private stable var nextDomainId: Nat = 1;
    private stable var nextTeamMemberId: Nat = 1;
    private stable var nextFinancialRevenueId: Nat = 1;
    
    // Domain purchase tracking
    private stable var domainPurchases: [FinancialAnalyticsTypes.DomainPurchase] = [];
    
    // Team member management
    private stable var teamMembers: [FinancialAnalyticsTypes.TeamMember] = [];
    
    // Financial revenue records (includes 7% commission tracking)
    private stable var financialRevenueRecords: [FinancialAnalyticsTypes.RevenueRecord] = [];
    
    // User credits tracking (for reserve calculations)
    private stable var userCreditsMap: [(Principal, Nat)] = [];
    private var userCredits = HashMap.HashMap<Principal, Nat>(0, Principal.equal, Principal.hash);
    
    // ===============================
    // NOTIFICATION SYSTEM (Pull-based, Cost-Effective)
    // ===============================
    
    // Notification manager instance
    private let notificationManager = NotificationManager.NotificationManager();
    
    // Stable storage for notifications
    private stable var stableNotifications : NotificationManager.StableData = {
        notifications = [];
        nextId = 1;
        userStatuses = [];
    };
    
    // ===============================
    // CANISTER POOL MANAGEMENT
    // ===============================
    
    // Pool manager instance
    private let poolManager = PoolManager.PoolManager();
    
    // Stable storage for pools
    private stable var stablePoolData : ?PoolManager.StableData = null;
    
    // ===============================
    // KONTEXT UNIVERSITY
    // ===============================
    
    // University manager instance
    private let universityManager = UniversityManager.UniversityManager(logger);
    
    // Stable storage for university
    private stable var stableUniversityData : ?UniversityManager.StableData = null;
    
    // ===============================
    // PLATFORM FORUM
    // ===============================
    
    // Forum manager instance
    private let forumManager = ForumManager.ForumManager(logger);
    
    // Stable storage for forum
    private stable var stableForumData : ?ForumManager.StableData = null;
    
    // ===============================
    // SUBSCRIPTION PLAN MANAGEMENT
    // ===============================
    
    // Subscription manager instance
    private let subscriptionManager = SubscriptionManager.SubscriptionPlans();
    
    // Stable storage for subscription plans
    private stable var stableSubscriptionPlans : [SubscriptionTypes.SubscriptionPlan] = [];
    
    // Current balances (manually set by admin)
    private stable var currentClaudeBalanceUSD: Float = 0.0;
    private stable var currentICPBalance: Float = 0.0;
    
    // Cached XDR rate (fetched via HTTP outcall)
    private stable var cachedXDRRate: ?FinancialAnalyticsTypes.XDRRate = null;
    private stable var lastXDRRateUpdate: Nat64 = 0;
    private let XDR_RATE_CACHE_TTL : Nat64 = 3600_000_000_000; // 1 hour
    
    // Financial analytics constants
    private let CLAUDE_INPUT_COST_PER_MILLION : Float = 3.0;
    private let CLAUDE_OUTPUT_COST_PER_MILLION : Float = 15.0;
    private let AVG_TOKENS_PER_CREDIT : Float = 150.0;
    private let CREDIT_USD_VALUE : Float = 0.01; // 1 credit = $0.01
    private let CREDIT_COMMISSION_PERCENT : Float = 20.0; // 20% markup on credit usage
    
    // ADMIN: Principal with administrative privileges
    private stable var adminPrincipal: Text = "bvpvy-zi75h-rmbcb-56guz-cscdg-apewo-gl6jq-f2t7y-rzcqa-zpilt-eqe";

    // ===============================
    // REMOTE FILE STORAGE CONFIGURATION
    // ===============================
    
    // Asset canister for remote file storage (WASMs, prompts, rules, etc.)
    private stable var remoteAssetCanisterId: Text = "pwi5a-sqaaa-aaaaa-qcfgq-cai";
    private stable var remoteFilesBasePath: Text = "projects/project-mfvtjz8x-hc7uz";
    
    // Individual file paths (relative to base path)
    // WASMs
    private stable var userCanisterWasmPath: Text = "wasms/user.wasm";
    private stable var assetStorageWasmPath: Text = "wasms/assetstorage.wasm.gz";
    private stable var agentWasmPath: Text = "wasms/agent.wasm";
    private stable var agentWasmGzPath: Text = "wasms/agent.wasm.gz";
    private stable var agencyWasmPath: Text = "wasms/agency.wasm";
    private stable var agencyWasmGzPath: Text = "wasms/agency.wasm.gz";
    
    // Prompts and Rules
    private stable var backendPromptPath: Text = "backend_prompt.md";
    private stable var frontendPromptPath: Text = "frontend_prompt.md";
    private stable var backendRulesPath: Text = "backend_rules.md";
    private stable var frontendRulesPath: Text = "frontend_rules.md";

    // ===============================
    // PRICING CONSTANTS
    // ===============================
    
    // Platform pricing: $2 per 1000 credits, 1000 credits = 1 TB cycles
    private let CREDITS_PER_USD: Nat = 500; // 500 credits per $1 = $2 per 1000 credits
    private let CREDITS_PER_TB: Nat = 1000; // 1000 credits = 1 TB cycles
    private let CYCLES_PER_TB: Nat = 1_000_000_000_000; // 1 trillion cycles = 1 TB

    // Validation bounds for ICP amounts (to prevent suspicious requests)
    private let MIN_USD_AMOUNT: Float = 1.0;
    private let MAX_USD_AMOUNT: Float = 10000.0;
    private let MAX_ICP_PER_USD_RATIO: Float = 10.0; // Max 10 ICP per $1 (safety check)

    // ===============================
    // STABLE STORAGE DECLARATIONS
    // ===============================
    private stable var userPlatformCanistersEntries : [(Principal, Principal)] = [];
    private stable var canisterDefaultsBackup: ?CanisterDefaultSettings = null;
    private stable var userCreationMapEntries : [(Principal, Int)] = [];
    private stable var adminPrincipals : [Text] = [
        "pkmhr-fqaaa-aaaaa-qcfeq-cai",
        "pdpmn-tyaaa-aaaaa-qcffa-cai",
        "bvpvy-zi75h-rmbcb-56guz-cscdg-apewo-gl6jq-f2t7y-rzcqa-zpilt-eqe"  // User admin principal
    ];
    private stable var wasmUploadSessionsEntries : [(Text, {
        sessionId: Text;
        fileName: Text;
        totalChunks: Nat;
        receivedChunks: Nat;
        totalSize: Nat;
        createdAt: Int;
    })] = [];
    private stable var assembledWasmsEntries : [(Text, [Nat8])] = [];
    private stable var paymentRecordsEntries : [(Text, PaymentRecord)] = [];

    // ===============================
    // PLATFORM WALLET STATE (STABLE)
    // ===============================
    private stable var platformWalletData : ?Wallet = null;

    // ===============================
    // TRANSIENT STATE VARIABLES
    // ===============================
    private var userPlatformCanisters = HashMap.HashMap<Principal, Principal>(10, Principal.equal, Principal.hash);
    private var canisterDefaults: ?CanisterDefaultSettings = null;
    private var userCreationMap = HashMap.HashMap<Principal, Int>(10, Principal.equal, Principal.hash);
    private var wasmUploadSessions = HashMap.HashMap<Text, WasmUploadSession>(10, Text.equal, Text.hash);
    private var assembledWasms = HashMap.HashMap<Text, [Nat8]>(10, Text.equal, Text.hash);
    private var paymentRecords = HashMap.HashMap<Text, PaymentRecord>(10, Text.equal, Text.hash);

    // ===============================
    // WALLET SERVICE SETUP (PRODUCTION ONLY)
    // ===============================
    private let walletService = wallet.WalletService(func () : Bool {
        // Always return false - this platform never runs locally
        false
    });

    // ===============================
    // ADMIN & SECURITY HELPER FUNCTIONS
    // ===============================

    private func _isAdmin(principal: Principal) : Bool {
        let callerText = Principal.toText(principal);

        // Check against the main admin principal
        if (callerText == adminPrincipal) {
            return true;
        };

        // Check against legacy admin principals array
        for (adminText in adminPrincipals.vals()) {
            if (adminText == callerText) {
                return true;
            };
        };

        return false;
    };

    private func _isAuthorizedCaller(caller: Principal) : Bool {
        // For now, same as admin check, but can be extended
        _isAdmin(caller)
    };

    // ===============================
    // PAYMENT VALIDATION HELPERS (WITH LOGGING)
    // ===============================

    private func validatePaymentAmount(usdAmount: Float, icpE8s: Nat) : Bool {
        logger.info("PAYMENT_VALIDATION: Validating payment amount USD=" # Float.toText(usdAmount) # " ICP_e8s=" # Nat.toText(icpE8s));
        
        // Check USD bounds
        if (usdAmount < MIN_USD_AMOUNT or usdAmount > MAX_USD_AMOUNT) {
            logger.warn("PAYMENT_VALIDATION: USD amount out of bounds. Amount=" # Float.toText(usdAmount) # " Min=" # Float.toText(MIN_USD_AMOUNT) # " Max=" # Float.toText(MAX_USD_AMOUNT));
            return false;
        };

        // Check ICP-to-USD ratio for reasonableness (prevent obviously wrong calculations)
        let icpAmount = Float.fromInt(Int.abs(icpE8s)) / 100_000_000.0; // Convert e8s to ICP
        let icpPerUsdRatio = icpAmount / usdAmount;
        
        if (icpPerUsdRatio > MAX_ICP_PER_USD_RATIO) {
            logger.warn("PAYMENT_VALIDATION: ICP/USD ratio too high. ICP=" # Float.toText(icpAmount) # " USD=" # Float.toText(usdAmount) # " Ratio=" # Float.toText(icpPerUsdRatio) # " Max=" # Float.toText(MAX_ICP_PER_USD_RATIO));
            return false; // Suspiciously high ICP amount for the USD paid
        };

        logger.info("PAYMENT_VALIDATION: Payment amount validated successfully");
        return true;
    };

    private func calculateExpectedCredits(usdAmount: Float) : Nat {
        let credits = Int.abs(Float.toInt(usdAmount * Float.fromInt(CREDITS_PER_USD)));
        logger.info("PAYMENT_CALCULATION: Expected credits for USD=" # Float.toText(usdAmount) # " Credits=" # Nat.toText(credits));
        credits
    };

    private func calculateExpectedTBCycles(credits: Nat) : Float {
        let tbCycles = Float.fromInt(credits) / Float.fromInt(CREDITS_PER_TB);
        logger.info("PAYMENT_CALCULATION: Expected TB cycles for Credits=" # Nat.toText(credits) # " TB=" # Float.toText(tbCycles));
        tbCycles
    };

    // ===============================
    // STRIPE CONFIGURATION METHODS
    // ===============================

    // Get Stripe publishable key (public - safe for frontend)
    public query func getStripePublishableKey() : async Text {
        stripePublishableKey
    };

    // ❌ REMOVED: getStripeSecretKey() - SECRET KEY MUST NEVER BE EXPOSED TO FRONTEND
    // Use backend Stripe functions below instead (createPaymentIntent, createCheckoutSession, etc.)

    // Update Stripe keys (admin only)
    public shared(msg) func updateStripeKeys(newSecretKey: Text, newPublishableKey: Text) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        if (Text.size(newSecretKey) < 10) {
            return #err("Invalid secret key: Key too short");
        };
        
        if (not Text.startsWith(newSecretKey, #text "sk_live_") and not Text.startsWith(newSecretKey, #text "sk_test_")) {
            return #err("Invalid secret key: Must be a valid Stripe secret key (sk_live_ or sk_test_)");
        };

        if (Text.size(newPublishableKey) < 10) {
            return #err("Invalid publishable key: Key too short");
        };
        
        if (not Text.startsWith(newPublishableKey, #text "pk_live_") and not Text.startsWith(newPublishableKey, #text "pk_test_")) {
            return #err("Invalid publishable key: Must be a valid Stripe publishable key (pk_live_ or pk_test_)");
        };
        
        stripeSecretKey := newSecretKey;
        stripePublishableKey := newPublishableKey;
        #ok("Stripe keys updated successfully")
    };

    // Update Stripe webhook secret (admin only)
    public shared(msg) func updateStripeWebhookSecret(newWebhookSecret: Text) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        if (Text.size(newWebhookSecret) < 10) {
            return #err("Invalid webhook secret: Key too short");
        };
        
        if (not Text.startsWith(newWebhookSecret, #text "whsec_")) {
            return #err("Invalid webhook secret: Must start with whsec_");
        };
        
        stripeWebhookSecret := newWebhookSecret;
        #ok("Stripe webhook secret updated successfully")
    };

    // ===============================
    // AI MODEL API KEY MANAGEMENT
    // ===============================
    
    // Update Claude API key (admin only)
    public shared(msg) func updateClaudeApiKey(newApiKey: Text) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        if (Text.size(newApiKey) < 10) {
            return #err("Invalid API key: Key too short");
        };
        
        if (not Text.startsWith(newApiKey, #text "sk-ant-")) {
            return #err("Invalid Claude API key: Must start with sk-ant-");
        };
        
        claudeApiKey := newApiKey;
        #ok("Claude API key updated successfully")
    };
    
    // Update OpenAI API key (admin only)
    public shared(msg) func updateOpenAIApiKey(newApiKey: Text) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        if (Text.size(newApiKey) < 10) {
            return #err("Invalid API key: Key too short");
        };
        
        if (not Text.startsWith(newApiKey, #text "sk-")) {
            return #err("Invalid OpenAI API key: Must start with sk-");
        };
        
        openaiApiKey := newApiKey;
        #ok("OpenAI API key updated successfully")
    };
    
    // Update Gemini API key (admin only)
    public shared(msg) func updateGeminiApiKey(newApiKey: Text) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        if (Text.size(newApiKey) < 10) {
            return #err("Invalid API key: Key too short");
        };
        
        if (not Text.startsWith(newApiKey, #text "AIza")) {
            return #err("Invalid Gemini API key: Must start with AIza");
        };
        
        geminiApiKey := newApiKey;
        #ok("Gemini API key updated successfully")
    };
    
    // Update Kimi API key (admin only)
    public shared(msg) func updateKimiApiKey(newApiKey: Text) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        if (Text.size(newApiKey) < 10) {
            return #err("Invalid API key: Key too short");
        };
        
        kimiApiKey := newApiKey;
        #ok("Kimi API key updated successfully")
    };
    
    // Get AI API keys (query - can be used by platform services)
    public query func getClaudeApiKey() : async Text {
        claudeApiKey
    };
    
    public query func getOpenAIApiKey() : async Text {
        openaiApiKey
    };
    
    public query func getGeminiApiKey() : async Text {
        geminiApiKey
    };
    
    public query func getKimiApiKey() : async Text {
        kimiApiKey
    };

    // ===============================
    // 🔐 SECURE STRIPE BACKEND API
    // All Stripe operations happen in canister - secret key NEVER exposed
    // ===============================
    
    /**
     * Create Payment Intent (for one-time credit purchases)
     * 🔐 BACKEND ONLY - Frontend never sees secret key
     */
    public shared(msg) func createPaymentIntent(
        amountInCents: Nat,
        currency: Text,
        description: Text
    ) : async Result.Result<{
        id: Text;
        clientSecret: Text;
        amount: Nat;
    }, Text> {
        
        logger.info("🚀 [Stripe] createPaymentIntent called by " # Principal.toText(msg.caller));
        logger.info("💰 [Stripe] Amount: " # Nat.toText(amountInCents) # " cents (" # currency # ")");
        logger.info("📝 [Stripe] Description: " # description);
        
        // Validate authenticated user
        if (Principal.isAnonymous(msg.caller)) {
            logger.warn("❌ [Stripe] Unauthorized: Anonymous caller");
            return #err("Unauthorized: Authentication required");
        };
        
        // Validate amount
        if (amountInCents < 100) { // Minimum $1.00
            logger.warn("❌ [Stripe] Invalid amount: Below minimum ($1.00)");
            return #err("Invalid amount: Minimum $1.00");
        };
        
        if (amountInCents > 100_000_00) { // Maximum $100,000
            logger.warn("❌ [Stripe] Invalid amount: Above maximum ($100,000)");
            return #err("Invalid amount: Maximum $100,000");
        };
        
        // Create config
        let config = {
            secretKey = stripeSecretKey;
            publishableKey = stripePublishableKey;
            webhookSecret = stripeWebhookSecret;
        };
        
        logger.info("🌐 [Stripe] Calling Stripe API for payment intent...");
        let result = await StripeIntegration.createPaymentIntent(
            config,
            amountInCents,
            currency,
            msg.caller,
            description
        );
        
        switch (result) {
            case (#ok(intent)) {
                logger.info("✅ [Stripe] Payment intent created successfully");
                logger.info("🔑 [Stripe] Intent ID: " # intent.id);
            };
            case (#err(errorMsg)) {
                logger.error("❌ [Stripe] Payment intent failed: " # errorMsg);
            };
        };
        
        result
    };
    
    /**
     * Create Checkout Session (for subscriptions)
     * 🔐 BACKEND ONLY
     */
    public shared(msg) func createCheckoutSession(
        priceId: Text,
        tier: Text,
        successUrl: Text,
        cancelUrl: Text
    ) : async Result.Result<{
        id: Text;
        url: Text;
    }, Text> {
        
        logger.info("🚀 [Stripe] createCheckoutSession called by " # Principal.toText(msg.caller));
        logger.info("📋 [Stripe] Price ID: " # priceId);
        logger.info("🎯 [Stripe] Tier: " # tier);
        
        if (Principal.isAnonymous(msg.caller)) {
            logger.warn("❌ [Stripe] Unauthorized: Anonymous caller");
            return #err("Unauthorized: Authentication required");
        };
        
        if (Text.size(priceId) == 0) {
            logger.warn("❌ [Stripe] Invalid: Empty price ID");
            return #err("Invalid price ID");
        };
        
        let config = {
            secretKey = stripeSecretKey;
            publishableKey = stripePublishableKey;
            webhookSecret = stripeWebhookSecret;
        };
        
        logger.info("🌐 [Stripe] Calling Stripe API...");
        let result = await StripeIntegration.createCheckoutSession(
            config,
            priceId,
            msg.caller,
            tier,
            successUrl,
            cancelUrl
        );
        
        switch (result) {
            case (#ok(session)) {
                logger.info("✅ [Stripe] Checkout session created successfully");
                logger.info("🔗 [Stripe] Session ID: " # session.id);
                logger.info("🌍 [Stripe] Session URL: " # session.url);
            };
            case (#err(errorMsg)) {
                logger.error("❌ [Stripe] Checkout session failed: " # errorMsg);
            };
        };
        
        result
    };
    
    /**
     * Verify Payment Intent
     * 🔐 BACKEND ONLY
     */
    public shared(msg) func verifyPaymentIntent(
        paymentIntentId: Text
    ) : async Result.Result<{
        id: Text;
        status: Text;
        amount: Nat;
        currency: Text;
    }, Text> {
        
        if (Principal.isAnonymous(msg.caller)) {
            return #err("Unauthorized: Authentication required");
        };
        
        let config = {
            secretKey = stripeSecretKey;
            publishableKey = stripePublishableKey;
            webhookSecret = stripeWebhookSecret;
        };
        
        await StripeIntegration.verifyPaymentIntent(config, paymentIntentId)
    };
    
    /**
     * Create Billing Portal Session
     * 🔐 BACKEND ONLY
     */
    public shared(msg) func createBillingPortalSession(
        customerId: Text,
        returnUrl: Text
    ) : async Result.Result<{ url: Text }, Text> {
        
        if (Principal.isAnonymous(msg.caller)) {
            return #err("Unauthorized: Authentication required");
        };
        
        let config = {
            secretKey = stripeSecretKey;
            publishableKey = stripePublishableKey;
            webhookSecret = stripeWebhookSecret;
        };
        
        await StripeIntegration.createBillingPortalSession(config, customerId, returnUrl)
    };
    
    /**
     * Search for customer by principal
     * 🔐 BACKEND ONLY
     */
    public shared(msg) func searchStripeCustomer(
        userPrincipal: Principal
    ) : async Result.Result<?{ customerId: Text; email: ?Text }, Text> {
        
        if (Principal.isAnonymous(msg.caller)) {
            return #err("Unauthorized: Authentication required");
        };
        
        // Admin can search any user, regular users can only search themselves
        if (not _isAdmin(msg.caller) and msg.caller != userPrincipal) {
            return #err("Unauthorized: Can only search your own customer record");
        };
        
        let config = {
            secretKey = stripeSecretKey;
            publishableKey = stripePublishableKey;
            webhookSecret = stripeWebhookSecret;
        };
        
        await StripeIntegration.searchCustomer(config, userPrincipal)
    };
    
    /**
     * Get Subscription Status (with 1-hour caching)
     * 🚀 PHASE 1: Prevents excessive Stripe API calls on every page refresh
     * 
     * Returns cached subscription status if:
     * - Cache exists for user
     * - Cache is less than 1 hour old
     * - forceRefresh is false
     * 
     * Otherwise, returns cached value WITHOUT checking Stripe (check only on login/manual refresh)
     */
    public shared(msg) func getSubscriptionStatus(
        forceRefresh: Bool
    ) : async Result.Result<{
        tier: Text;
        active: Bool;
        expiresAt: Nat64;
        stripeCustomerId: ?Text;
        cached: Bool;
    }, Text> {
        
        if (Principal.isAnonymous(msg.caller)) {
            return #err("Unauthorized: Authentication required");
        };
        
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        // Check cache first (unless force refresh)
        switch (subscriptionCache.get(msg.caller)) {
            case (?cached) {
                let cacheAge = now - cached.lastChecked;
                
                // If cache is fresh OR not forcing refresh, return cached value
                if (cacheAge < SUBSCRIPTION_CACHE_TTL or not forceRefresh) {
                    return #ok({
                        tier = cached.tier;
                        active = cached.active;
                        expiresAt = cached.expiresAt;
                        stripeCustomerId = cached.stripeCustomerId;
                        cached = true;
                    });
                };
            };
            case null { };
        };
        
        // Cache miss or force refresh - check Stripe
        // NOTE: In production, this should primarily be called:
        // 1. On user login
        // 2. On manual "Refresh Status" button click
        // 3. After subscription purchase/update
        // NOT on every page refresh!
        
        let config = {
            secretKey = stripeSecretKey;
            publishableKey = stripePublishableKey;
            webhookSecret = stripeWebhookSecret;
        };
        
        let customerResult = await StripeIntegration.searchCustomer(config, msg.caller);
        
        switch (customerResult) {
            case (#ok(?customer)) {
                // Customer found in Stripe
                // TODO: In Phase 2 (webhooks), get actual subscription data from Stripe API
                // For now, assume active subscription if customer exists
                
                let newCache : CachedSubscription = {
                    tier = "pro"; // TODO: Get from Stripe subscription data
                    active = true;
                    expiresAt = now + (30 * 24 * 3600_000_000_000); // 30 days from now (placeholder)
                    stripeCustomerId = ?customer.customerId;
                    lastChecked = now;
                };
                
                // Update cache
                subscriptionCache.put(msg.caller, newCache);
                
                #ok({
                    tier = newCache.tier;
                    active = newCache.active;
                    expiresAt = newCache.expiresAt;
                    stripeCustomerId = newCache.stripeCustomerId;
                    cached = false;
                })
            };
            case (#ok(null)) {
                // No customer found - free tier
                let freeCache : CachedSubscription = {
                    tier = "free";
                    active = false;
                    expiresAt = 0;
                    stripeCustomerId = null;
                    lastChecked = now;
                };
                
                subscriptionCache.put(msg.caller, freeCache);
                
                #ok({
                    tier = "free";
                    active = false;
                    expiresAt = 0;
                    stripeCustomerId = null;
                    cached = false;
                })
            };
            case (#err(msg)) {
                #err("Failed to check subscription: " # msg)
            };
        };
    };
    
    /**
     * Update Subscription Cache (called after payment/subscription events)
     * Allows manual cache updates without calling Stripe
     */
    public shared(msg) func updateSubscriptionCache(
        userPrincipal: Principal,
        tier: Text,
        active: Bool,
        expiresAt: Nat64,
        stripeCustomerId: ?Text
    ) : async Result.Result<(), Text> {
        
        // Only admin or the user themselves can update
        if (not _isAdmin(msg.caller) and msg.caller != userPrincipal) {
            return #err("Unauthorized");
        };
        
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        let newCache : CachedSubscription = {
            tier = tier;
            active = active;
            expiresAt = expiresAt;
            stripeCustomerId = stripeCustomerId;
            lastChecked = now;
        };
        
        subscriptionCache.put(userPrincipal, newCache);
        #ok(())
    };
    
    /**
     * Clear Subscription Cache (for testing/debugging)
     */
    public shared(msg) func clearSubscriptionCache() : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        subscriptionCache := HashMap.HashMap<Principal, CachedSubscription>(0, Principal.equal, Principal.hash);
        #ok(())
    };

    // Get admin principal (admin only)
    public shared(msg) func getAdminPrincipal() : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        #ok(adminPrincipal)
    };

    // Update admin principal (current admin only)
    public shared(msg) func updateAdminPrincipal(newAdminPrincipal: Text) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        // Validate the principal format
        try {
            let _ = Principal.fromText(newAdminPrincipal);
            adminPrincipal := newAdminPrincipal;
            #ok("Admin principal updated successfully")
        } catch (error) {
            #err("Invalid principal format: " # Error.message(error))
        }
    };

    // Check if caller is admin (public for frontend verification)
    public shared(msg) func isAdmin() : async Bool {
        _isAdmin(msg.caller)
    };

    // Get current caller's principal (utility method)
    public shared(msg) func getCallerPrincipal() : async Text {
        Principal.toText(msg.caller)
    };

    // ===============================
    // ADMIN MANAGEMENT
    // ===============================

    // Add a new admin (only existing admins can add new admins)
    public shared(msg) func addAdmin(newAdminPrincipal: Principal) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Only admins can add new admins");
        };

        let newAdminText = Principal.toText(newAdminPrincipal);
        
        // Check if already an admin
        if (_isAdmin(newAdminPrincipal)) {
            return #err("Principal is already an admin");
        };

        // Add to adminPrincipals array
        let buffer = Buffer.Buffer<Text>(adminPrincipals.size() + 1);
        for (admin in adminPrincipals.vals()) {
            buffer.add(admin);
        };
        buffer.add(newAdminText);
        adminPrincipals := Buffer.toArray(buffer);

        logger.info("ADMIN_ADDED: New admin added by " # Principal.toText(msg.caller) # " - New Admin: " # newAdminText);
        #ok("Admin added successfully: " # newAdminText)
    };

    // Remove an admin (only existing admins can remove admins)
    public shared(msg) func removeAdmin(adminToRemove: Principal) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Only admins can remove admins");
        };

        let removeAdminText = Principal.toText(adminToRemove);
        
        // Prevent removing the main admin principal
        if (removeAdminText == adminPrincipal) {
            return #err("Cannot remove the main admin principal");
        };

        // Check if the admin exists
        if (not _isAdmin(adminToRemove)) {
            return #err("Principal is not an admin");
        };

        // Remove from adminPrincipals array
        let buffer = Buffer.Buffer<Text>(adminPrincipals.size());
        var found = false;
        for (admin in adminPrincipals.vals()) {
            if (admin != removeAdminText) {
                buffer.add(admin);
            } else {
                found := true;
            };
        };

        if (not found) {
            return #err("Admin not found in the list");
        };

        adminPrincipals := Buffer.toArray(buffer);

        logger.info("ADMIN_REMOVED: Admin removed by " # Principal.toText(msg.caller) # " - Removed Admin: " # removeAdminText);
        #ok("Admin removed successfully: " # removeAdminText)
    };

    // Get list of all admins (only admins can view this)
    public shared(msg) func getAdmins() : async Result.Result<[Text], Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Only admins can view admin list");
        };

        let buffer = Buffer.Buffer<Text>(adminPrincipals.size() + 1);
        buffer.add(adminPrincipal); // Add main admin
        for (admin in adminPrincipals.vals()) {
            buffer.add(admin);
        };

        #ok(Buffer.toArray(buffer))
    };

    // ===============================
    // ENHANCED PAYMENT PROCESSING METHODS (WITH COMPREHENSIVE LOGGING)
    // ===============================

    // New method: Record payment with frontend-calculated ICP amount
    public shared(msg) func recordPaymentWithCalculatedICP(
        paymentIntentId: Text,
        amountUSD: Float,
        userCanisterId: Principal,
        credits: Nat,
        tbCycles: Float,
        icpE8sCalculated: Nat
    ) : async Result.Result<Text, Text> {
        let caller = Principal.toText(msg.caller);
        let canisterIdText = Principal.toText(userCanisterId);
        
        logger.info("PAYMENT_START: Payment processing started PaymentID=" # paymentIntentId # " Caller=" # caller # " UserCanister=" # canisterIdText # " USD=" # Float.toText(amountUSD) # " Credits=" # Nat.toText(credits) # " TB=" # Float.toText(tbCycles) # " ICP_e8s=" # Nat.toText(icpE8sCalculated));
        
        try {
            // Validate payment bounds
            logger.info("PAYMENT_VALIDATION: Starting payment validation");
            if (not validatePaymentAmount(amountUSD, icpE8sCalculated)) {
                let errorMsg = "Invalid payment amount or ICP calculation. USD: " # Float.toText(amountUSD) # ", ICP e8s: " # Nat.toText(icpE8sCalculated);
                logger.error("PAYMENT_ERROR: " # errorMsg);
                return #err(errorMsg);
            };

            // Check if payment already recorded
            logger.info("PAYMENT_CHECK: Checking for duplicate payment PaymentID=" # paymentIntentId);
            switch (paymentRecords.get(paymentIntentId)) {
                case (?existingRecord) {
                    let errorMsg = "Payment already recorded: " # paymentIntentId;
                    logger.warn("PAYMENT_DUPLICATE: " # errorMsg);
                    return #err(errorMsg);
                };
                case null {
                    logger.info("PAYMENT_CHECK: No duplicate found, proceeding");
                };
            };
            
            // Validate credits calculation (should match our expected calculation)
            logger.info("PAYMENT_VALIDATION: Validating credits calculation");
            let expectedCredits = calculateExpectedCredits(amountUSD);
            if (credits < expectedCredits * 90 / 100 or credits > expectedCredits * 110 / 100) { // Allow 10% variance
                let errorMsg = "Credits calculation mismatch. Expected: " # Nat.toText(expectedCredits) # ", Got: " # Nat.toText(credits);
                logger.error("PAYMENT_VALIDATION_ERROR: " # errorMsg);
                return #err(errorMsg);
            };

            // Validate TB cycles calculation
            logger.info("PAYMENT_VALIDATION: Validating TB cycles calculation");
            let expectedTBCycles = calculateExpectedTBCycles(credits);
            let tbCyclesDiff = if (tbCycles > expectedTBCycles) { tbCycles - expectedTBCycles } else { expectedTBCycles - tbCycles };
            if (tbCyclesDiff > 0.1) { // Allow small floating point differences
                let errorMsg = "TB cycles calculation mismatch. Expected: " # Float.toText(expectedTBCycles) # ", Got: " # Float.toText(tbCycles);
                logger.error("PAYMENT_VALIDATION_ERROR: " # errorMsg);
                return #err(errorMsg);
            };
            
            logger.info("PAYMENT_VALIDATION: All validations passed, creating payment record");
            
            // Create payment record
            let paymentRecord: PaymentRecord = {
                paymentIntentId = paymentIntentId;
                userPrincipal = msg.caller;
                amountUSD = amountUSD;
                creditsGranted = credits;
                tbCyclesRequested = tbCycles;
                icpSpent = icpE8sCalculated;
                timestamp = Time.now();
                status = #completed;
            };
            
            paymentRecords.put(paymentIntentId, paymentRecord);
            logger.info("PAYMENT_RECORD: Payment record created and stored PaymentID=" # paymentIntentId);
            
            // Credit the user's canister using the exact calculated ICP amount
            logger.info("PAYMENT_TOPUP: Starting canister top-up UserCanister=" # canisterIdText # " ICP_e8s=" # Nat.toText(icpE8sCalculated));
            let topUpResult = await topUpUserCanisterWithExactICP(userCanisterId, icpE8sCalculated);
            
            switch (topUpResult) {
                case (#ok(message)) {
                    let successMsg = "Payment recorded successfully! Added " # Nat.toText(credits) # " credits (" # Float.toText(tbCycles) # " TB cycles) to your account. " # message;
                    logger.info("PAYMENT_SUCCESS: " # successMsg);
                    #ok(successMsg)
                };
                case (#err(error)) {
                    logger.error("PAYMENT_TOPUP_FAILED: Top-up failed for PaymentID=" # paymentIntentId # " Error=" # error);
                    
                    // Update payment status to failed
                    let failedRecord = {
                        paymentRecord with
                        status = #failed;
                    };
                    paymentRecords.put(paymentIntentId, failedRecord);
                    logger.info("PAYMENT_STATUS: Updated payment status to failed PaymentID=" # paymentIntentId);
                    
                    let errorMsg = "Payment recorded but crediting failed: " # error;
                    #err(errorMsg)
                };
            }
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.error("PAYMENT_EXCEPTION: Payment processing exception PaymentID=" # paymentIntentId # " Error=" # errorMsg);
            #err("Payment processing error: " # errorMsg)
        }
    };

    // Legacy method: Record a payment made through frontend Stripe integration (updated to use new method)
    public shared(msg) func recordPaymentAndCreditUser(
        paymentIntentId: Text,
        amountUSD: Float,
        userCanisterId: Principal
    ) : async Result.Result<Text, Text> {
        logger.info("PAYMENT_LEGACY: Legacy payment method called PaymentID=" # paymentIntentId # " USD=" # Float.toText(amountUSD));
        
        // Calculate expected values using backend logic for backward compatibility
        let credits = calculateExpectedCredits(amountUSD);
        let tbCycles = calculateExpectedTBCycles(credits);
        
        // Use a fallback ICP calculation (not as accurate as frontend, but functional)
        let approximateIcpE8s = Nat.max(
            Int.abs(Float.toInt(amountUSD * 25_000_000.0)), // ~$0.40 per 100M e8s (fallback rate)
            100_000 // Minimum 0.001 ICP
        );
        
        logger.info("PAYMENT_LEGACY: Calculated fallback values Credits=" # Nat.toText(credits) # " TB=" # Float.toText(tbCycles) # " ICP_e8s=" # Nat.toText(approximateIcpE8s));
        
        // Call the new method
        await recordPaymentWithCalculatedICP(paymentIntentId, amountUSD, userCanisterId, credits, tbCycles, approximateIcpE8s)
    };

    // Enhanced helper method: Top up user canister with exact ICP amount
    public shared(msg) func topUpUserCanisterWithExactICP(
        userCanisterId: Principal,
        icpE8s: Nat
    ) : async Result.Result<Text, Text> {
        let canisterIdText = Principal.toText(userCanisterId);
        let caller = Principal.toText(msg.caller);
        
        logger.info("TOPUP_START: Starting user canister top-up UserCanister=" # canisterIdText # " ICP_e8s=" # Nat.toText(icpE8s) # " Caller=" # caller);
        
        // Check if the platform wallet exists
        switch (platformWalletData) {
            case (null) {
                let errorMsg = "Platform wallet not initialized. Please create platform wallet first.";
                logger.error("TOPUP_ERROR: " # errorMsg);
                return #err(errorMsg);
            };
            case (?wallet) {
                logger.info("TOPUP_WALLET: Platform wallet found, proceeding with CMC top-up");
                
                // Use the exact ICP amount provided
                let result = await topUpCanisterCMC(userCanisterId, icpE8s);
                
                switch (result) {
                    case (#ok(msg)) {
                        let successMsg = "Platform successfully topped up user canister with " # Nat.toText(icpE8s) # " e8s: " # msg;
                        logger.info("TOPUP_SUCCESS: " # successMsg);
                        #ok(successMsg)
                    };
                    case (#err(e)) {
                        let errorMsg = "Platform top-up failed: " # e;
                        logger.error("TOPUP_FAILED: " # errorMsg);
                        #err(errorMsg)
                    };
                }
            };
        }
    };

    // Get payment history for a user (admin or own payments) - enhanced with cycles info
    public shared(msg) func getPaymentHistory(userPrincipal: ?Principal) : async Result.Result<[PaymentRecord], Text> {
        let caller = Principal.toText(msg.caller);
        
        let targetPrincipal = switch (userPrincipal) {
            case (?p) {
                let targetText = Principal.toText(p);
                if (not _isAdmin(msg.caller) and not Principal.equal(p, msg.caller)) {
                    logger.warn("PAYMENT_HISTORY: Unauthorized access attempt Caller=" # caller # " Target=" # targetText);
                    return #err("Unauthorized: Can only view own payments or admin access required");
                };
                logger.info("PAYMENT_HISTORY: Loading payment history for specific user Target=" # targetText # " Caller=" # caller);
                p
            };
            case null {
                if (not _isAdmin(msg.caller)) {
                    logger.warn("PAYMENT_HISTORY: Non-admin attempted to view all payments Caller=" # caller);
                    return #err("Unauthorized: Admin access required to view all payments");
                };
                logger.info("PAYMENT_HISTORY: Admin loading all payment history Caller=" # caller);
                msg.caller // This will be ignored in the filter below for admins
            };
        };

        let filteredPayments = Buffer.Buffer<PaymentRecord>(10);
        
        for ((_, record) in paymentRecords.entries()) {
            if (userPrincipal == null or Principal.equal(record.userPrincipal, targetPrincipal)) {
                filteredPayments.add(record);
            };
        };

        let resultArray = Buffer.toArray(filteredPayments);
        logger.info("PAYMENT_HISTORY: Found " # Nat.toText(resultArray.size()) # " payment records");
        #ok(resultArray)
    };

    // Verify a payment exists (for frontend confirmation)
    public shared(msg) func verifyPayment(paymentIntentId: Text) : async Result.Result<PaymentRecord, Text> {
        let caller = Principal.toText(msg.caller);
        logger.info("PAYMENT_VERIFY: Verifying payment PaymentID=" # paymentIntentId # " Caller=" # caller);
        
        switch (paymentRecords.get(paymentIntentId)) {
            case (?record) {
                if (not _isAdmin(msg.caller) and not Principal.equal(record.userPrincipal, msg.caller)) {
                    logger.warn("PAYMENT_VERIFY: Unauthorized verification attempt PaymentID=" # paymentIntentId # " Caller=" # caller);
                    return #err("Unauthorized: Can only verify own payments");
                };
                logger.info("PAYMENT_VERIFY: Payment verified successfully PaymentID=" # paymentIntentId);
                #ok(record)
            };
            case null {
                let errorMsg = "Payment not found: " # paymentIntentId;
                logger.warn("PAYMENT_VERIFY: " # errorMsg # " Caller=" # caller);
                #err(errorMsg)
            };
        }
    };

    // Get pricing information
    public query func getPricingInfo() : async {
        creditsPerUSD: Nat;
        minAmountUSD: Float;
        maxAmountUSD: Float;
        description: Text;
    } {
        {
            creditsPerUSD = CREDITS_PER_USD;
            minAmountUSD = MIN_USD_AMOUNT;
            maxAmountUSD = MAX_USD_AMOUNT;
            description = "$2 per 1000 credits - Fixed rate for hosting on the Internet Computer";
        }
    };

    // ===============================
    // SYSTEM LIFECYCLE METHODS
    // ===============================
    system func preupgrade() {
        logger.info("⚠️ Platform canister preupgrade started - saving state...");
        logger.info("💾 Persisting: subscriptions, analytics, notifications, pools, university, forum");
        
        // Save logger state FIRST
        stableLogger := ?logger.toStable();
        
        // Save subscription cache
        subscriptionCacheEntries := Iter.toArray(subscriptionCache.entries());
        
        // Save analytics data
        userFirstSeenMap := Iter.toArray(userFirstSeen.entries());
        
        // Save financial analytics data
        userCreditsMap := Iter.toArray(userCredits.entries());
        
        // Save notification system state
        stableNotifications := notificationManager.toStable();
        
        // Save pool manager state
        stablePoolData := ?poolManager.toStable();
        
        // Save university system state
        stableUniversityData := ?universityManager.toStable();
        
        // Save forum system state
        stableForumData := ?forumManager.toStable();
        
        // Save subscription plans
        stableSubscriptionPlans := subscriptionManager.toStableData();
        
        // Save marketplace review system
        projectReviewsEntries := Iter.toArray(projectReviewsMap.entries());
        reviewVotesEntries := Iter.toArray(reviewVotesMap.entries());
        reviewReportsEntries := Iter.toArray(reviewReportsMap.entries());
        
        // Save listing fee payments
        listingFeePaymentsEntries := Iter.toArray(listingFeePaymentsMap.entries());
        
        // Save project imports
        projectImportsEntries := Iter.toArray(projectImportsMap.entries());
        
        // Save user platform canisters mapping
        userPlatformCanistersEntries := Iter.toArray(userPlatformCanisters.entries());
        
        // Save canister defaults
        canisterDefaultsBackup := canisterDefaults;
        
        // Save user creation map
        userCreationMapEntries := Iter.toArray(userCreationMap.entries());
        
    //     // Save WASM upload sessions (convert to stable format)
    //     let sessionBuffer = Buffer.Buffer<(Text, {
    //         sessionId: Text;
    //         fileName: Text;
    //         totalChunks: Nat;
    //         receivedChunks: Nat;
    //         totalSize: Nat;
    //         createdAt: Int;
    //     })>(wasmUploadSessions.size());
        
    //     for ((sessionId, session) in wasmUploadSessions.entries()) {
    //         sessionBuffer.add((sessionId, {
    //             sessionId = session.sessionId;
    //             fileName = session.fileName;
    //             totalChunks = session.totalChunks;
    //             receivedChunks = session.receivedChunks;
    //             totalSize = session.totalSize;
    //             createdAt = session.createdAt;
    //         }));
    //     };
    //     wasmUploadSessionsEntries := Buffer.toArray(sessionBuffer);
        
    //     // Save assembled WASMs
    //     assembledWasmsEntries := Iter.toArray(assembledWasms.entries());
        
        // Save payment records
        paymentRecordsEntries := Iter.toArray(paymentRecords.entries());
    };

    system func postupgrade() {
        // ✅ Log the upgrade BEFORE saving state
        logger.info("🔄 Platform canister postupgrade started");
        logger.info("📊 Restoring subscription cache, notifications, pools, university, forum data...");
        
        // Restore subscription cache
        subscriptionCache := HashMap.fromIter<Principal, CachedSubscription>(
            subscriptionCacheEntries.vals(),
            subscriptionCacheEntries.size(),
            Principal.equal,
            Principal.hash
        );
        subscriptionCacheEntries := [];
        
        logger.info("✅ Platform canister postupgrade completed successfully");
        
        // Save logger state for next upgrade
        stableLogger := ?logger.toStable();
        
        // Restore notification system state
        notificationManager.fromStable(stableNotifications);
        
        // Restore pool manager state
        switch (stablePoolData) {
            case (?data) {
                poolManager.fromStable(data);
                stablePoolData := null;
            };
            case null {};
        };
        
        // Restore university system state
        switch (stableUniversityData) {
            case (?data) {
                universityManager.fromStable(data);
                stableUniversityData := null;
            };
            case null {};
        };

        // Restore forum system state
        switch (stableForumData) {
            case (?data) {
                forumManager.fromStable(data);
                stableForumData := null;
            };
            case null {};
        };
        
        // Restore subscription plans
        if (stableSubscriptionPlans.size() > 0) {
            subscriptionManager.fromStableData(stableSubscriptionPlans);
        } else {
            // Initialize with default plans if no saved data
            subscriptionManager.initializeDefaultPlans();
        };

        // Restore marketplace review system
        projectReviewsMap := HashMap.fromIter<Text, ProjectReview>(
            projectReviewsEntries.vals(),
            projectReviewsEntries.size(),
            Text.equal,
            Text.hash
        );
        projectReviewsEntries := [];
        
        reviewVotesMap := HashMap.fromIter<Text, [ReviewVote]>(
            reviewVotesEntries.vals(),
            reviewVotesEntries.size(),
            Text.equal,
            Text.hash
        );
        reviewVotesEntries := [];
        
        reviewReportsMap := HashMap.fromIter<Text, ReviewReport>(
            reviewReportsEntries.vals(),
            reviewReportsEntries.size(),
            Text.equal,
            Text.hash
        );
        reviewReportsEntries := [];
        
        // Restore listing fee payments
        listingFeePaymentsMap := HashMap.fromIter<Text, ListingFeePayment>(
            listingFeePaymentsEntries.vals(),
            listingFeePaymentsEntries.size(),
            Text.equal,
            Text.hash
        );
        listingFeePaymentsEntries := [];
        
        // Restore project imports
        projectImportsMap := HashMap.fromIter<Text, ProjectImport>(
            projectImportsEntries.vals(),
            projectImportsEntries.size(),
            Text.equal,
            Text.hash
        );
        projectImportsEntries := [];
        
        // Restore analytics data
        userFirstSeen := HashMap.fromIter<Principal, Nat64>(
            userFirstSeenMap.vals(),
            userFirstSeenMap.size(),
            Principal.equal,
            Principal.hash
        );
        userFirstSeenMap := [];
        
        // Restore financial analytics data
        userCredits := HashMap.fromIter<Principal, Nat>(
            userCreditsMap.vals(),
            userCreditsMap.size(),
            Principal.equal,
            Principal.hash
        );
        userCreditsMap := [];
        
        // Restore user platform canisters mapping
        userPlatformCanisters := HashMap.fromIter<Principal, Principal>(
            userPlatformCanistersEntries.vals(),
            userPlatformCanistersEntries.size(),
            Principal.equal,
            Principal.hash
        );
        
        // Restore canister defaults
        canisterDefaults := canisterDefaultsBackup;
        
        // Restore user creation map
        userCreationMap := HashMap.fromIter<Principal, Int>(
            userCreationMapEntries.vals(),
            userCreationMapEntries.size(),
            Principal.equal,
            Principal.hash
        );
        
    //     // Restore WASM upload sessions (convert from stable format)
    //     wasmUploadSessions := HashMap.HashMap<Text, WasmUploadSession>(
    //         wasmUploadSessionsEntries.size(),
    //         Text.equal,
    //         Text.hash
    //     );
        
    //     for ((sessionId, stableSession) in wasmUploadSessionsEntries.vals()) {
    //         let chunksMap = HashMap.HashMap<Nat, [Nat8]>(
    //             stableSession.totalChunks,
    //             Nat.equal,
    //             func(n: Nat): Hash.Hash { Text.hash(Nat.toText(n)) }
    //         );
            
    //         wasmUploadSessions.put(sessionId, {
    //             sessionId = stableSession.sessionId;
    //             fileName = stableSession.fileName;
    //             chunks = chunksMap;
    //             totalChunks = stableSession.totalChunks;
    //             receivedChunks = stableSession.receivedChunks;
    //             totalSize = stableSession.totalSize;
    //             createdAt = stableSession.createdAt;
    //         });
    //     };
        
    //     // Restore assembled WASMs
    //     assembledWasms := HashMap.fromIter<Text, [Nat8]>(
    //         assembledWasmsEntries.vals(),
    //         assembledWasmsEntries.size(),
    //         Text.equal,
    //         Text.hash
    //     );

    //     // Restore payment records
    //     paymentRecords := HashMap.fromIter<Text, PaymentRecord>(
    //         paymentRecordsEntries.vals(),
    //         paymentRecordsEntries.size(),
    //         Text.equal,
    //         Text.hash
    //     );
    };

    // ===============================
    // PLATFORM WALLET FUNCTIONS
    // ===============================

    public func createPlatformWallet() : async Text {
        switch (platformWalletData) {
            case (?_existing) {
                return "Platform wallet already exists";
            };
            case null {
                let platformPrincipal = Principal.fromActor(Main);
                let newWallet = walletService.createWallet(platformPrincipal);
                platformWalletData := ?newWallet;
                return "Platform wallet created successfully";
            };
        };
    };

    public query func getPlatformWalletId() : async ?{
        principal: Text;
        subaccount: Text;
        accountIdentifier: Text;
    } {
        switch (platformWalletData) {
            case (?wallet) {
                let id = walletService.getWalletId(wallet);
                ?id
            };
            case null null;
        }
    };

    public func getPlatformBalance() : async Nat {
        switch (platformWalletData) {
            case (null) { return 0; };
            case (?wallet) {
                let newBalance = await walletService.getBalance(wallet);
                platformWalletData := ?{
                    principal = wallet.principal;
                    subaccount = wallet.subaccount;
                    balance = newBalance;
                    transactions = wallet.transactions;
                };
                return newBalance;
            };
        };
    };

    public func getPlatformCycleBalance() : async Nat {
        switch (platformWalletData) {
            case (null) {
                return 0;
            };
            case (?wallet) {
                await walletService.getCycleBalance(wallet);
            };
        };
    };

    public func sendICPFromPlatform(toPrincipal: Principal, amount: Nat) : async Result.Result<Text, Text> {
        switch (platformWalletData) {
            case (null) {
                #err("Platform wallet not initialized")
            };
            case (?wallet) {
                if (amount == 0) {
                    return #err("Amount must be greater than 0");
                };
                
                try {
                    // Get the recipient's wallet with default subaccount
                    let defaultSubaccount = walletService.createDefaultSubaccount();
                    let toWallet = walletService.createWalletWithSubaccount(toPrincipal, defaultSubaccount);
                    
                    let result = await walletService.sendICP(wallet, toWallet, amount);
                    
                    // If the transaction was successful, add a transaction record
                    if (Text.startsWith(result, #text "Transaction successful")) {
                        let updatedWallet = walletService.addTransaction(
                            wallet,
                            #sent,
                            Principal.toText(toPrincipal),
                            amount,
                            false,
                            ?"Platform payment"
                        );
                        
                        platformWalletData := ?updatedWallet;
                    };
                    
                    #ok(result)
                } catch (error) {
                    let errorMsg = Error.message(error);
                    #err(errorMsg)
                }
            };
        };
    };

    public func sendICPFromPlatformToAccountId(toAccountId: Text, amount: Nat) : async Result.Result<Text, Text> {
        switch (platformWalletData) {
            case (null) {
                #err("Platform wallet not initialized")
            };
            case (?wallet) {
                if (amount == 0) {
                    return #err("Amount must be greater than 0");
                };
                
                try {
                    let result = await walletService.sendICPToAccountId(wallet, toAccountId, amount);
                    
                    // If the transaction was successful, add a transaction record
                    if (Text.startsWith(result, #text "Transaction successful")) {
                        let updatedWallet = walletService.addTransaction(
                            wallet,
                            #canister,
                            toAccountId,
                            amount,
                            false,
                            ?"Platform canister top-up"
                        );
                        
                        platformWalletData := ?updatedWallet;
                    };
                    
                    #ok(result)
                } catch (error) {
                    let errorMsg = Error.message(error);
                    #err(errorMsg)
                }
            };
        };
    };

    public func topUpCanisterCMC(canisterId: Principal, amount: Nat) : async Result.Result<Text, Text> {
        let canisterIdText = Principal.toText(canisterId);
        logger.info("CMC_TOPUP_START: Starting CMC top-up CanisterID=" # canisterIdText # " Amount=" # Nat.toText(amount) # "e8s");
        
        switch (platformWalletData) {
            case (null) {
                let errorMsg = "Platform wallet not initialized";
                logger.error("CMC_TOPUP_ERROR: " # errorMsg);
                return #err(errorMsg);
            };
            case (?wallet) {
                if (amount == 0) {
                    let errorMsg = "Amount must be greater than 0";
                    logger.error("CMC_TOPUP_ERROR: " # errorMsg);
                    return #err(errorMsg);
                };
                
                try {
                    logger.info("CMC_TOPUP: Checking platform wallet balance");
                    let actualBalance = await walletService.getBalance(wallet);
                    logger.info("CMC_TOPUP: Platform wallet balance=" # Nat.toText(actualBalance) # "e8s");
                    
                    if (actualBalance < amount + 10_000) { // 10_000 e8s = ICP fee
                        let errorMsg = "Insufficient platform funds. Have " # Nat.toText(actualBalance) # 
                                       " e8s but need " # Nat.toText(amount + 10_000) # " e8s (including fee).";
                        logger.error("CMC_TOPUP_INSUFFICIENT_FUNDS: " # errorMsg);
                        return #err(errorMsg);
                    };
                    
                    logger.info("CMC_TOPUP: Sufficient funds available, calculating CMC subaccount");
                    
                    // Calculate the correct CMC subaccount for this canister
                    let cmcPrincipal = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");
                    
                    // Create the dfx-compatible subaccount (first byte is length, followed by principal bytes)
                    let canisterIdBlob = Principal.toBlob(canisterId);
                    let principalBytes = Blob.toArray(canisterIdBlob);
                    let array = Buffer.Buffer<Nat8>(32);
                    array.add(Nat8.fromNat(principalBytes.size()));
                    for (byte in principalBytes.vals()) {
                        array.add(byte);
                    };
                    while (array.size() < 32) {
                        array.add(0);
                    };
                    let canisterIdBytes = Buffer.toArray(array);
                    
                    let subaccount = Blob.fromArray(canisterIdBytes);
                    
                    // Get the account identifier for the CMC with this subaccount
                    let toAccountId = walletService.accountIdentifier(cmcPrincipal, subaccount);
                    let toAccountIdHex = walletService.blobToHex(Blob.fromArray(toAccountId));
                    
                    logger.info("CMC_TOPUP: Sending to CMC account AccountID=" # toAccountIdHex);
                    
                    // Send ICP to the correct account
                    let result = await walletService.sendICPToAccountId(wallet, toAccountIdHex, amount);
                    
                    // Update wallet data if successful
                    if (Text.startsWith(result, #text "Transaction successful")) {
                        logger.info("CMC_TOPUP_SUCCESS: Transaction successful, updating wallet data");
                        let updatedWallet = walletService.addTransaction(
                            wallet,
                            #canister,
                            Principal.toText(canisterId),
                            amount,
                            false,
                            ?"Platform CMC canister top-up"
                        );
                        
                        platformWalletData := ?updatedWallet;
                        logger.info("CMC_TOPUP_COMPLETE: Wallet data updated successfully");
                    } else {
                        logger.warn("CMC_TOPUP_PARTIAL: Transaction completed but not marked as successful Result=" # result);
                    };
                    
                    logger.info("CMC_TOPUP_FINAL: CMC top-up process completed Result=" # result);
                    #ok(result)
                } catch (error) {
                    let errorMsg = Error.message(error);
                    logger.error("CMC_TOPUP_EXCEPTION: CMC top-up exception CanisterID=" # canisterIdText # " Error=" # errorMsg);
                    #err(errorMsg)
                }
            };
        };
    };

    // Legacy function kept for compatibility
    public shared(msg) func topUpUserCanisterFromPlatform(
        userCanisterId: Principal,
        icpAmount: Float
    ) : async Result.Result<Text, Text> {
        let e8sAmount = Int.abs(Float.toInt(icpAmount * 100_000_000));
        logger.info("LEGACY_TOPUP: Legacy top-up method called ICP=" # Float.toText(icpAmount) # " e8s=" # Nat.toText(e8sAmount));
        await topUpUserCanisterWithExactICP(userCanisterId, e8sAmount)
    };

    public query func getPlatformTransactions(limit: ?Nat) : async [Transaction] {
        switch (platformWalletData) {
            case (null) { [] };
            case (?wallet) {
                let maxTransactions = switch (limit) {
                    case (null) { 10 };
                    case (?max) { max };
                };
                
                walletService.getRecentTransactions(wallet, maxTransactions)
            };
        };
    };

    // Function to receive cycles into the platform wallet
    public func wallet_receive() : async { accepted: Nat64 } {
        let available = Cycles.available();
        let accepted = Cycles.accept(available);
        
        { accepted = Nat64.fromNat(accepted) };
    };

    // ===============================
    // CANISTER SERVICE SETUP
    // ===============================

    private var canisterService = canister.CanisterService(
        func (logs: [LogEntry]) { 
            // Simple placeholder for log processing - just ignore the logs for now
            ()
        }
    );

    // ===============================
    // CHUNKING LOGIC
    // ===============================

    private func generateSessionId() : Text {
        let now = Int.abs(Time.now());
        let moduloValue = now % 10000;
        let counter : Nat = Int.abs(moduloValue) + 10000;
        return Nat.toText(now) # "-" # Nat.toText(counter);
    };

    private func natHash(n: Nat): Hash.Hash {
        Text.hash(Nat.toText(n))
    };

    public shared(msg) func startWasmUploadSession(
        fileName: Text,
        totalChunks: Nat,
        totalSize: Nat
    ) : async Result.Result<Text, Text> {
        let sessionId = generateSessionId();
        let chunksMap = HashMap.HashMap<Nat, [Nat8]>(totalChunks, Nat.equal, natHash);

        wasmUploadSessions.put(sessionId, {
            sessionId = sessionId;
            fileName = fileName;
            chunks = chunksMap;
            totalChunks = totalChunks;
            receivedChunks = 0;
            totalSize = totalSize;
            createdAt = Time.now();
        });

        #ok(sessionId)
    };

    public shared(msg) func uploadWasmChunk(
        sessionId: Text,
        chunkIndex: Nat,
        chunkData: [Nat8]
    ) : async Result.Result<{receivedChunks: Nat; totalChunks: Nat}, Text> {
        switch (wasmUploadSessions.get(sessionId)) {
            case null {
                #err("Upload session not found")
            };
            case (?session) {
                if (chunkIndex >= session.totalChunks) {
                    return #err("Invalid chunk index");
                };

                session.chunks.put(chunkIndex, chunkData);

                let updatedSession = {
                    session with
                    receivedChunks = session.receivedChunks + 1
                };

                wasmUploadSessions.put(sessionId, updatedSession);

                #ok({
                    receivedChunks = updatedSession.receivedChunks;
                    totalChunks = updatedSession.totalChunks;
                })
            };
        };
    };

    public shared(msg) func finalizeWasmUpload(
        sessionId: Text
    ) : async Result.Result<Text, Text> {
        switch (wasmUploadSessions.get(sessionId)) {
            case null {
                #err("Upload session not found")
            };
            case (?session) {
                if (session.receivedChunks < session.totalChunks) {
                    return #err("Not all chunks received: " #
                        Nat.toText(session.receivedChunks) # "/" #
                        Nat.toText(session.totalChunks));
                };

                let wasmBuffer = Buffer.Buffer<Nat8>(session.totalSize);

                for (i in Iter.range(0, session.totalChunks - 1)) {
                    switch (session.chunks.get(i)) {
                        case (?chunk) {
                            for (byte in chunk.vals()) {
                                wasmBuffer.add(byte);
                            };
                        };
                        case null {
                            return #err("Missing chunk: " # Nat.toText(i));
                        };
                    };
                };

                let combinedWasm = Buffer.toArray(wasmBuffer);

                let storageKey = session.fileName;
                assembledWasms.put(storageKey, combinedWasm);

                wasmUploadSessions.delete(sessionId);

                #ok("WASM assembled successfully. Storage Key: " # storageKey)
            };
        };
    };

    public shared(msg) func deployStoredWasm(
        fileName: Text,
        canisterId: Principal,
        userPrincipal: Principal
    ) : async Result.Result<Text, Text> {
        let storageKey = fileName;

        switch (assembledWasms.get(storageKey)) {
            case null {
                return #err("No stored WASM found. Make sure the WASM was properly assembled with finalizeWasmUpload.");
            };
            case (?wasmBytes) {
                try {
                    let result = await canisterService.deployToExistingCanister(
                        canisterId,
                        wasmBytes,
                        ?userPrincipal  // Pass user principal to preserve controllers
                    );

                    switch (result) {
                        case (#ok(_)) {
                            assembledWasms.delete(storageKey);
                        };
                        case (#err(_)) {
                            // Keep the WASM in case deployment needs to be retried
                        };
                    };

                    return result;
                } catch (error) {
                    let errorMsg = Error.message(error);
                    return #err("Error deploying WASM: " # errorMsg);
                };
            };
        };
    };

    // ===============================
    // CANISTER MANAGEMENT
    // ===============================

    public shared(msg) func updateCanisterDefaults(settings: CanisterDefaultSettings) : async Result.Result<Text, Text> {
        if (settings.memoryGB < 1) {
            return #err("Memory allocation must be at least 1 GB");
        };

        if (settings.cyclesAmount < 100_000_000_000) {
            return #err("Cycles amount must be at least 100B (100_000_000_000)");
        };

        canisterDefaults := ?settings;

        return #ok("Updated canister default settings");
    };

    public shared(_msg) func createCanisterWithSettings(
        userPrincipal: Principal,
        memoryGB: Nat,
        computeAllocation: Nat,
        freezingThreshold: ?Nat,
        durationInDays: Nat,
        cyclesAmount: Nat
    ): async Result.Result<Text, Text> {
        var finalMemoryGB = memoryGB;
        var finalComputeAllocation = computeAllocation;
        var finalFreezingThreshold = freezingThreshold;
        var finalDurationInDays = durationInDays;
        var finalCyclesAmount = cyclesAmount;

        switch (canisterDefaults) {
            case (null) {
                // No system defaults, using provided values
            };
            case (?defaults) {
                if (memoryGB == 1) {
                    finalMemoryGB := defaults.memoryGB;
                };

                if (computeAllocation == 1) {
                    finalComputeAllocation := defaults.computeAllocation;
                };

                if (freezingThreshold == null) {
                    finalFreezingThreshold := defaults.freezingThreshold;
                };

                if (durationInDays == 30) {
                    finalDurationInDays := defaults.durationInDays;
                };

                if (cyclesAmount == 100_000_000_000) {
                    finalCyclesAmount := defaults.cyclesAmount;
                };
            };
        };

        if (finalMemoryGB == 0) {
            return #err("Memory allocation must be at least 1 GB");
        };

        if (finalCyclesAmount < 100_000_000_000) {
            return #err("Cycles amount must be at least 100B (100_000_000_000)");
        };

        try {
            let result = await canisterService.createCanisterWithSettings(
                userPrincipal,
                finalMemoryGB,
                finalComputeAllocation,
                finalFreezingThreshold,
                finalDurationInDays,
                finalCyclesAmount
            );

            switch(result) {
                case (#ok(canisterId)) {
                    switch(userPlatformCanisters.get(userPrincipal)) {
                        case (?existing) {
                            // Found existing mapping
                        };
                        case null {
                            // No existing mapping found
                        };
                    };

                    userPlatformCanisters.put(userPrincipal, Principal.fromText(canisterId));

                    let now = Int.abs(Time.now());
                    userCreationMap.put(userPrincipal, now);

                    let filteredEntries = Array.filter<(Principal, Principal)>(
                        userPlatformCanistersEntries,
                        func((user, _)) { user != userPrincipal }
                    );

                    userPlatformCanistersEntries := Array.append(
                        filteredEntries,
                        [(userPrincipal, Principal.fromText(canisterId))]
                    );

                    #ok(canisterId)
                };
                case (#err(e)) {
                    #err(e)
                };
            };
        } catch (error) {
            #err("Exception while creating canister: " # Error.message(error))
        };
    };

    public shared(msg) func getUserPlatformCanister(userPrincipal: Principal) : async [Principal] {
        switch(userPlatformCanisters.get(userPrincipal)) {
            case (?canister) {
                return [canister];
            };
            case null {
                for ((p, c) in userPlatformCanistersEntries.vals()) {
                    if (Principal.equal(p, userPrincipal)) {
                        userPlatformCanisters.put(userPrincipal, c);
                        return [c];
                    };
                };

                return [];
            };
        };
    };

    public shared(msg) func removeUserPlatformCanister(userPrincipal: Principal) : async Result.Result<Text, Text> {
        var canisterDeleteStatus = "No canister found";

        switch(userPlatformCanisters.get(userPrincipal)) {
            case null {
                // No platform canister found for user
            };
            case (?canisterId) {
                try {
                    let deleteResult = await canisterService.deleteCanister(canisterId);
                    canisterDeleteStatus := switch(deleteResult) {
                        case (#ok(_)) "Canister deleted successfully";
                        case (#err(e)) "Failed to delete canister: " # e;
                    };
                } catch(e) {
                    canisterDeleteStatus := "Exception while deleting canister: " # Error.message(e);
                };
            };
        };

        userPlatformCanisters.delete(userPrincipal);
        userPlatformCanistersEntries := Array.filter<(Principal, Principal)>(
            userPlatformCanistersEntries,
            func((user, _)) { user != userPrincipal }
        );

        #ok("User platform entries removed. " # canisterDeleteStatus)
    };

    public shared(msg) func deployToExistingCanister(
        canisterId: Principal,
        wasm: [Nat8]
    ) : async Result.Result<Text, Text> {
        var isOwner = false;

        label l for ((userPrincipal, userCanister) in userPlatformCanisters.entries()) {
            if (Principal.equal(userCanister, canisterId) and Principal.equal(userPrincipal, msg.caller)) {
                isOwner := true;
                break l;
            };
        };

        let result = await canisterService.deployToExistingCanister(
            canisterId,
            wasm,
            ?msg.caller  // Pass user principal to preserve controllers
        );

        return result;
    };

    public shared(msg) func deleteCanister(
        canisterId: Principal
    ) : async Result.Result<Text, Text> {
        var isOwner = false;
        var ownerPrincipal : ?Principal = null;

        label owner_search
        for ((userPrincipal, userCanister) in userPlatformCanisters.entries()) {
            if (Principal.equal(userCanister, canisterId)) {
                isOwner := Principal.equal(userPrincipal, msg.caller);
                ownerPrincipal := ?userPrincipal;
                break owner_search;
            };
        };

        let result = await canisterService.deleteCanister(canisterId);

        switch (result, ownerPrincipal) {
            case (#ok(_), ?owner) {
                userPlatformCanisters.delete(owner);
                userPlatformCanistersEntries := Array.filter<(Principal, Principal)>(
                    userPlatformCanistersEntries,
                    func((user, _)) { user != owner }
                );
            };
            case (_, _) {
                // No mapping cleanup needed
            };
        };

        return result;
    };

    // === LOGGING METHODS ===
    public func logInfo(message: Text) : async () {
        logger.info(message);
    };

    public func logWarn(message: Text) : async () {
        logger.warn(message);
    };

    public func logError(message: Text) : async () {
        logger.error(message);
    };

    public func logDebug(message: Text) : async () {
        logger.dbg(message);
    };

    public query func getLogs() : async [Text] {
        logger.getLogs()
    };

    public query func getNewLogsSince(marker: Nat, maxLogsOpt: ?Nat) : async {
        logs: [Text];
        nextMarker: Nat;
    } {
        logger.getNewLogsSince(marker, maxLogsOpt)
    };

    public func clearAllLogs() : async Nat {
        logger.clearLogs();
        logger.info("🗑️ Logs cleared");
        return 0;
    };
    
    // Test method to verify logging is working
    public func generateTestLogs() : async () {
        logger.info("✅ Test log 1: INFO level");
        logger.warn("⚠️ Test log 2: WARN level");
        logger.error("❌ Test log 3: ERROR level");
        logger.info("🔍 Test log 4: This is a test to verify the logging system is functioning correctly");
        logger.info("🎯 Test log 5: If you can see this, the logger is working!");
    };
    
    // Debug method to check logger status
    public query func getLoggerStatus() : async {
        logsAvailable: Bool;
        loggerInitialized: Bool;
        canisterType: Text;
    } {
        {
            logsAvailable = true;  // If this method returns, logger exists
            loggerInitialized = true;
            canisterType = "PLATFORM_CANISTER";
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 🛒 MARKETPLACE INTEGRATION
    // ═══════════════════════════════════════════════════════════════════════════

    // Marketplace type aliases
    type MarketplaceListing = MarketplaceTypes.MarketplaceListing;
    type ListingTier = MarketplaceTypes.ListingTier;
    type VerifiedPurchase = MarketplaceTypes.VerifiedPurchase;
    type DownloadToken = MarketplaceTypes.DownloadToken;
    type DownloadAttempt = MarketplaceTypes.DownloadAttempt;
    type ProjectImport = MarketplaceTypes.ProjectImport;
    type ImportMethod = MarketplaceTypes.ImportMethod;
    type PurchaseStatus = MarketplaceTypes.PurchaseStatus;
    type PayoutStatus = MarketplaceTypes.PayoutStatus;
    type ProjectReview = MarketplaceTypes.ProjectReview;
    type SellerResponse = MarketplaceTypes.SellerResponse;
    type ReviewSummary = MarketplaceTypes.ReviewSummary;
    type ReviewVote = MarketplaceTypes.ReviewVote;
    type ReviewReport = MarketplaceTypes.ReviewReport;
    type ReportReason = MarketplaceTypes.ReportReason;
    type ReportStatus = MarketplaceTypes.ReportStatus;
    type ListingFeePayment = MarketplaceTypes.ListingFeePayment;
    type ListingFeeType = MarketplaceTypes.ListingFeeType;
    type FeePaymentStatus = MarketplaceTypes.FeePaymentStatus;
    type ListingFeeConfig = MarketplaceTypes.ListingFeeConfig;

    // University type aliases
    type AcademicProgram = UniversityTypes.AcademicProgram;
    type Course = UniversityTypes.Course;
    type Lesson = UniversityTypes.Lesson;
    type ProgramEnrollment = UniversityTypes.ProgramEnrollment;
    type CourseEnrollment = UniversityTypes.CourseEnrollment;
    type VideoProgress = UniversityTypes.VideoProgress;
    type Degree = UniversityTypes.Degree;
    type CourseReview = UniversityTypes.CourseReview;
    type Assessment = UniversityTypes.Assessment;
    type AssessmentSubmission = UniversityTypes.AssessmentSubmission;
    type Discussion = UniversityTypes.Discussion;
    type Instructor = UniversityTypes.Instructor;
    type Achievement = UniversityTypes.Achievement;
    type LearningPath = UniversityTypes.LearningPath;
    type DifficultyLevel = UniversityTypes.DifficultyLevel;
    type AccessTier = UniversityTypes.AccessTier;
    type DegreeType = UniversityTypes.DegreeType;
    type EnrollmentStatus = UniversityTypes.EnrollmentStatus;

    // Stable storage for marketplace
    private stable var marketplaceListingsEntries: [(Text, MarketplaceListing)] = [];
    private var marketplaceListingsMap = HashMap.HashMap<Text, MarketplaceListing>(0, Text.equal, Text.hash);

    private stable var verifiedPurchasesEntries: [(Text, VerifiedPurchase)] = [];
    private var verifiedPurchases = HashMap.HashMap<Text, VerifiedPurchase>(0, Text.equal, Text.hash);

    private stable var downloadTokensEntries: [(Text, DownloadToken)] = [];
    private var downloadTokensMap = HashMap.HashMap<Text, DownloadToken>(0, Text.equal, Text.hash);

    private stable var downloadAttemptsEntries: [(Text, [DownloadAttempt])] = [];
    private var downloadAttempts = HashMap.HashMap<Text, [DownloadAttempt]>(0, Text.equal, Text.hash);

    // Review system storage
    private stable var projectReviewsEntries: [(Text, ProjectReview)] = [];
    private var projectReviewsMap = HashMap.HashMap<Text, ProjectReview>(0, Text.equal, Text.hash);

    private stable var reviewVotesEntries: [(Text, [ReviewVote])] = [];
    private var reviewVotesMap = HashMap.HashMap<Text, [ReviewVote]>(0, Text.equal, Text.hash);

    private stable var reviewReportsEntries: [(Text, ReviewReport)] = [];
    private var reviewReportsMap = HashMap.HashMap<Text, ReviewReport>(0, Text.equal, Text.hash);

    // Listing fee payments storage
    private stable var listingFeePaymentsEntries: [(Text, ListingFeePayment)] = [];
    private var listingFeePaymentsMap = HashMap.HashMap<Text, ListingFeePayment>(0, Text.equal, Text.hash);

    // Project imports storage
    private stable var projectImportsEntries: [(Text, ProjectImport)] = [];
    private var projectImportsMap = HashMap.HashMap<Text, ProjectImport>(0, Text.equal, Text.hash);

    // Listing fee configuration (admin adjustable)
    private stable var listingFeeConfig: ListingFeeConfig = {
        basicFee = 999;                // $9.99 - Basic tier
        featuredFee = 2599;            // $25.99 - Featured tier
        premiumFee = 4999;             // $49.99 - Premium tier
        featuredDurationDays = 0;      // 0 = permanent featured status
        premiumDurationDays = 0;       // 0 = permanent premium status
    };

    // Constants for marketplace
    private let TOKEN_EXPIRY_HOURS: Nat64 = 48;  // 48 hours
    private let MAX_DOWNLOAD_ATTEMPTS: Nat = 3;
    private let TOKEN_REFRESH_COOLDOWN: Nat64 = 300_000_000_000; // 5 minutes in nanoseconds

    // ═══════════════════════════════════════════════════════════════════════════
    // MARKETPLACE LISTING MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    // Register a project listing (called by seller)
    public shared(msg) func registerMarketplaceListing(
        projectId: Text,
        userCanisterId: Principal,
        exportId: Text,
        title: Text,
        description: Text,
        price: Nat,
        stripeAccountId: Text,
        previewImages: [Text],
        demoUrl: ?Text,
        category: Text,
        tags: [Text],
        version: Text
    ) : async Result.Result<MarketplaceListing, Text> {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        let listingId = generateListingId(projectId, userCanisterId, now);
        
        logger.info("MARKETPLACE_LISTING: Creating listing ListingID=" # listingId # " Project=" # projectId # " Seller=" # Principal.toText(msg.caller));
        
        let listing: MarketplaceListing = {
            listingId = listingId;
            projectId = projectId;
            userCanisterId = userCanisterId;
            seller = msg.caller;
            exportId = exportId;
            title = title;
            description = description;
            price = price;
            stripeAccountId = stripeAccountId;
            previewImages = previewImages;
            demoUrl = demoUrl;
            category = category;
            tags = tags;
            version = version;
            listedAt = now;
            updatedAt = now;
            totalSales = 0;
            isPublished = false;  // Must be approved by platform
            isActive = true;
            listingTier = #basic;  // Starts as basic tier
            featuredUntil = null;  // No featured status yet
            premiumUntil = null;   // No premium status yet
        };
        
        marketplaceListingsMap.put(listingId, listing);
        logger.info("MARKETPLACE_LISTING: Listing created successfully ListingID=" # listingId);
        
        #ok(listing)
    };

    // Update listing (seller only)
    public shared(msg) func updateMarketplaceListing(
        listingId: Text,
        price: ?Nat,
        title: ?Text,
        description: ?Text,
        previewImages: ?[Text],
        demoUrl: ?(?Text),
        tags: ?[Text],
        version: ?Text,
        isActive: ?Bool
    ) : async Result.Result<MarketplaceListing, Text> {
        switch (marketplaceListingsMap.get(listingId)) {
            case (?listing) {
                if (not Principal.equal(listing.seller, msg.caller) and not _isAdmin(msg.caller)) {
                    logger.warn("MARKETPLACE_UPDATE: Unauthorized update attempt ListingID=" # listingId # " Caller=" # Principal.toText(msg.caller));
                    return #err("Unauthorized: Only seller or admin can update listing");
                };
                
                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                let updated: MarketplaceListing = {
                    listingId = listing.listingId;
                    projectId = listing.projectId;
                    userCanisterId = listing.userCanisterId;
                    seller = listing.seller;
                    exportId = listing.exportId;
                    title = switch (title) { case (?t) { t }; case null { listing.title }; };
                    description = switch (description) { case (?d) { d }; case null { listing.description }; };
                    price = switch (price) { case (?p) { p }; case null { listing.price }; };
                    stripeAccountId = listing.stripeAccountId;
                    previewImages = switch (previewImages) { case (?imgs) { imgs }; case null { listing.previewImages }; };
                    demoUrl = switch (demoUrl) { case (?demo) { demo }; case null { listing.demoUrl }; };
                    category = listing.category;
                    tags = switch (tags) { case (?t) { t }; case null { listing.tags }; };
                    version = switch (version) { case (?v) { v }; case null { listing.version }; };
                    listedAt = listing.listedAt;
                    updatedAt = now;
                    totalSales = listing.totalSales;
                    isPublished = listing.isPublished;
                    isActive = switch (isActive) { case (?a) { a }; case null { listing.isActive }; };
                    listingTier = listing.listingTier;       // Preserve tier
                    featuredUntil = listing.featuredUntil;   // Preserve expiration
                    premiumUntil = listing.premiumUntil;     // Preserve expiration
                };
                
                marketplaceListingsMap.put(listingId, updated);
                logger.info("MARKETPLACE_UPDATE: Listing updated ListingID=" # listingId);
                
                #ok(updated)
            };
            case null {
                #err("Listing not found")
            };
        }
    };

    // Publish listing (admin only)
    public shared(msg) func publishListing(listingId: Text) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        switch (marketplaceListingsMap.get(listingId)) {
            case (?listing) {
                let updated = {
                    listing with
                    isPublished = true;
                    updatedAt = Nat64.fromNat(Int.abs(Time.now()));
                };
                
                marketplaceListingsMap.put(listingId, updated);
                logger.info("MARKETPLACE_PUBLISH: Listing published ListingID=" # listingId);
                
                #ok()
            };
            case null {
                #err("Listing not found")
            };
        }
    };

    // Unpublish listing (admin only)
    public shared(msg) func unpublishListing(listingId: Text) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        switch (marketplaceListingsMap.get(listingId)) {
            case (?listing) {
                let updated = {
                    listing with
                    isPublished = false;
                    updatedAt = Nat64.fromNat(Int.abs(Time.now()));
                };
                
                marketplaceListingsMap.put(listingId, updated);
                logger.info("MARKETPLACE_UNPUBLISH: Listing unpublished ListingID=" # listingId);
                
                #ok()
            };
            case null {
                #err("Listing not found")
            };
        }
    };

    // Delete listing (admin only) - for policy violations, orphaned listings, etc.
    public shared(msg) func deleteMarketplaceListing(listingId: Text) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        switch (marketplaceListingsMap.get(listingId)) {
            case (?listing) {
                marketplaceListingsMap.delete(listingId);
                logger.info("MARKETPLACE_DELETE: Listing deleted ListingID=" # listingId # " by admin " # Principal.toText(msg.caller));
                #ok(())
            };
            case null {
                #err("Listing not found")
            };
        }
    };

    // Get listing
    public query func getMarketplaceListing(listingId: Text) : async ?MarketplaceListing {
        marketplaceListingsMap.get(listingId)
    };

    // Get all published listings
    public query func getPublishedListings() : async [MarketplaceListing] {
        let allListings = Iter.toArray(marketplaceListingsMap.vals());
        Array.filter<MarketplaceListing>(
            allListings,
            func(listing: MarketplaceListing): Bool {
                listing.isPublished and listing.isActive
            }
        )
    };

    // Get published listings (paginated)
    public query func getPublishedListingsPaginated(
        limit: Nat,
        offset: Nat
    ) : async ([MarketplaceListing], Nat) {
        let allListings = Iter.toArray(marketplaceListingsMap.vals());
        let published = Array.filter<MarketplaceListing>(
            allListings,
            func(listing: MarketplaceListing): Bool {
                listing.isPublished and listing.isActive
            }
        );
        // Sort by newest first
        let sorted = Array.sort(published, func(a: MarketplaceListing, b: MarketplaceListing) : Order.Order {
            Nat64.compare(b.listedAt, a.listedAt)
        });
        let total = sorted.size();
        let start = Nat.min(offset, total);
        let end = Nat.min(start + limit, total);
        let paginated = Array.tabulate(end - start, func(i: Nat) : MarketplaceListing {
            sorted[start + i]
        });
        (paginated, total)
    };

    // Get listings by category
    public query func getListingsByCategory(category: Text) : async [MarketplaceListing] {
        let allListings = Iter.toArray(marketplaceListingsMap.vals());
        Array.filter<MarketplaceListing>(
            allListings,
            func(listing: MarketplaceListing): Bool {
                listing.isPublished and listing.isActive and listing.category == category
            }
        )
    };

    // Get listings by category (paginated)
    public query func getListingsByCategoryPaginated(
        category: Text,
        limit: Nat,
        offset: Nat
    ) : async ([MarketplaceListing], Nat) {
        let allListings = Iter.toArray(marketplaceListingsMap.vals());
        let filtered = Array.filter<MarketplaceListing>(
            allListings,
            func(listing: MarketplaceListing): Bool {
                listing.isPublished and listing.isActive and listing.category == category
            }
        );
        // Sort by newest first
        let sorted = Array.sort(filtered, func(a: MarketplaceListing, b: MarketplaceListing) : Order.Order {
            Nat64.compare(b.listedAt, a.listedAt)
        });
        let total = sorted.size();
        let start = Nat.min(offset, total);
        let end = Nat.min(start + limit, total);
        let paginated = Array.tabulate(end - start, func(i: Nat) : MarketplaceListing {
            sorted[start + i]
        });
        (paginated, total)
    };

    // Get seller's listings
    public query(msg) func getSellerListings() : async [MarketplaceListing] {
        let allListings = Iter.toArray(marketplaceListingsMap.vals());
        Array.filter<MarketplaceListing>(
            allListings,
            func(listing: MarketplaceListing): Bool {
                Principal.equal(listing.seller, msg.caller)
            }
        )
    };

    // Get seller's listings (paginated)
    public query(msg) func getSellerListingsPaginated(
        limit: Nat,
        offset: Nat
    ) : async ([MarketplaceListing], Nat) {
        let allListings = Iter.toArray(marketplaceListingsMap.vals());
        let sellerListings = Array.filter<MarketplaceListing>(
            allListings,
            func(listing: MarketplaceListing): Bool {
                Principal.equal(listing.seller, msg.caller)
            }
        );
        let sorted = Array.sort(sellerListings, func(a: MarketplaceListing, b: MarketplaceListing) : Order.Order {
            Nat64.compare(b.updatedAt, a.updatedAt)
        });
        let total = sorted.size();
        let start = Nat.min(offset, total);
        let end = Nat.min(start + limit, total);
        let paginated = Array.tabulate(end - start, func(i: Nat) : MarketplaceListing {
            sorted[start + i]
        });
        (paginated, total)
    };

    // Get all listings (admin only) - includes unpublished for moderation
    public query(msg) func getAllListings() : async Result.Result<[MarketplaceListing], Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        #ok(Iter.toArray(marketplaceListingsMap.vals()))
    };

    // Get all listings (admin only, paginated)
    public query(msg) func getAllListingsPaginated(
        limit: Nat,
        offset: Nat
    ) : async Result.Result<([MarketplaceListing], Nat), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        let allListings = Iter.toArray(marketplaceListingsMap.vals());
        let sorted = Array.sort(allListings, func(a: MarketplaceListing, b: MarketplaceListing) : Order.Order {
            Nat64.compare(b.updatedAt, a.updatedAt)
        });
        let total = sorted.size();
        let start = Nat.min(offset, total);
        let end = Nat.min(start + limit, total);
        let paginated = Array.tabulate(end - start, func(i: Nat) : MarketplaceListing {
            sorted[start + i]
        });
        #ok(paginated, total)
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PURCHASE & PAYMENT VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    // Verify purchase after Stripe payment (webhook endpoint)
    public shared(msg) func verifyPurchase(
        listingId: Text,
        buyer: Principal,
        stripePaymentIntentId: Text,
        amountPaid: Nat
    ) : async Result.Result<VerifiedPurchase, Text> {
        logger.info("MARKETPLACE_PURCHASE: Verifying purchase ListingID=" # listingId # " Buyer=" # Principal.toText(buyer) # " PaymentIntent=" # stripePaymentIntentId);
        
        // Get listing
        switch (marketplaceListingsMap.get(listingId)) {
            case (?listing) {
                // Verify amount
                if (amountPaid < listing.price) {
                    logger.error("MARKETPLACE_PURCHASE: Amount mismatch Expected=" # Nat.toText(listing.price) # " Paid=" # Nat.toText(amountPaid));
                    return #err("Payment amount mismatch");
                };
                
                // Check if already purchased
                let existingPurchases = Iter.toArray(verifiedPurchases.vals());
                let duplicate = Array.find<VerifiedPurchase>(
                    existingPurchases,
                    func(p: VerifiedPurchase): Bool {
                        p.stripePaymentIntentId == stripePaymentIntentId
                    }
                );
                
                switch (duplicate) {
                    case (?existing) {
                        logger.warn("MARKETPLACE_PURCHASE: Duplicate purchase attempt PaymentIntent=" # stripePaymentIntentId);
                        return #ok(existing);  // Return existing purchase
                    };
                    case null {};
                };
                
                let now = Nat64.fromNat(Int.abs(Time.now()));
                let purchaseId = generatePurchaseId(listingId, buyer, now);
                
                let purchase: VerifiedPurchase = {
                    purchaseId = purchaseId;
                    listingId = listingId;
                    buyer = buyer;
                    stripePaymentIntentId = stripePaymentIntentId;
                    amountPaid = amountPaid;
                    userCanisterId = listing.userCanisterId;
                    exportId = listing.exportId;
                    projectId = listing.projectId;
                    purchasedAt = now;
                    status = #completed;
                };
                
                verifiedPurchases.put(purchaseId, purchase);
                
                // Update listing stats
                let updatedListing = {
                    listing with
                    totalSales = listing.totalSales + 1;
                    updatedAt = now;
                };
                marketplaceListingsMap.put(listingId, updatedListing);
                
                logger.info("MARKETPLACE_PURCHASE: Purchase verified PurchaseID=" # purchaseId);
                
                #ok(purchase)
            };
            case null {
                logger.error("MARKETPLACE_PURCHASE: Listing not found ListingID=" # listingId);
                #err("Listing not found")
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // DOWNLOAD TOKEN MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    // Generate download token after purchase
    public shared(msg) func generateDownloadToken(
        purchaseId: Text
    ) : async Result.Result<{ tokenId: Text; downloadUrl: Text; expiresAt: Nat64 }, Text> {
        logger.info("MARKETPLACE_TOKEN: Generating download token PurchaseID=" # purchaseId # " Caller=" # Principal.toText(msg.caller));
        
        switch (verifiedPurchases.get(purchaseId)) {
            case (?purchase) {
                // Verify buyer
                if (not Principal.equal(purchase.buyer, msg.caller) and not _isAdmin(msg.caller)) {
                    logger.warn("MARKETPLACE_TOKEN: Unauthorized token request PurchaseID=" # purchaseId);
                    return #err("Unauthorized: Only buyer can generate download token");
                };
                
                // Check for existing active token
                let existingTokens = Iter.toArray(downloadTokensMap.vals());
                let activeToken = Array.find<DownloadToken>(
                    existingTokens,
                    func(t: DownloadToken): Bool {
                        t.purchaseId == purchaseId and 
                        not t.isRevoked and 
                        t.downloadCount < t.maxDownloads
                    }
                );
                
                switch (activeToken) {
                    case (?token) {
                        // Check cooldown
                        let now = Nat64.fromNat(Int.abs(Time.now()));
                        switch (token.lastUsedAt) {
                            case (?lastUsed) {
                                if (now < lastUsed + TOKEN_REFRESH_COOLDOWN) {
                                    logger.warn("MARKETPLACE_TOKEN: Cooldown active PurchaseID=" # purchaseId);
                                    return #err("Please wait before requesting a new token");
                                };
                            };
                            case null {};
                        };
                        
                        // Return existing token
                        let userCanisterIdText = Principal.toText(purchase.userCanisterId);
                        let url = "https://" # userCanisterIdText # ".raw.icp0.io/download/" # token.tokenId;
                        
                        logger.info("MARKETPLACE_TOKEN: Returning existing token TokenID=" # token.tokenId);
                        
                        return #ok({
                            tokenId = token.tokenId;
                            downloadUrl = url;
                            expiresAt = token.expiresAt;
                        });
                    };
                    case null {};
                };
                
                // Generate new token
                let now = Nat64.fromNat(Int.abs(Time.now()));
                let tokenId = generateTokenId(purchaseId, now);
                let expiresAt = now + (TOKEN_EXPIRY_HOURS * 3_600_000_000_000); // hours to nanoseconds
                
                let token: DownloadToken = {
                    tokenId = tokenId;
                    purchaseId = purchaseId;
                    listingId = purchase.listingId;
                    buyer = purchase.buyer;
                    userCanisterId = purchase.userCanisterId;
                    exportId = purchase.exportId;
                    maxDownloads = MAX_DOWNLOAD_ATTEMPTS;
                    downloadCount = 0;
                    createdAt = now;
                    expiresAt = expiresAt;
                    lastUsedAt = null;
                    isRevoked = false;
                    revokedAt = null;
                    revokedReason = null;
                };
                
                downloadTokensMap.put(tokenId, token);
                
                // Call user canister to generate download token
                // Note: This assumes user canister has generateDownloadToken function
                // You'll need to add this inter-canister call
                
                let userCanisterIdText = Principal.toText(purchase.userCanisterId);
                let url = "https://" # userCanisterIdText # ".raw.icp0.io/download/" # tokenId;
                
                logger.info("MARKETPLACE_TOKEN: New token generated TokenID=" # tokenId # " Expires=" # Nat64.toText(expiresAt));
                
                #ok({
                    tokenId = tokenId;
                    downloadUrl = url;
                    expiresAt = expiresAt;
                })
            };
            case null {
                logger.error("MARKETPLACE_TOKEN: Purchase not found PurchaseID=" # purchaseId);
                #err("Purchase not found")
            };
        }
    };

    // Validate download token (called by user canister)
    public query func validateDownloadToken(tokenId: Text) : async Result.Result<DownloadToken, Text> {
        switch (downloadTokensMap.get(tokenId)) {
            case (?token) {
                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                // Check if revoked
                if (token.isRevoked) {
                    return #err("Token has been revoked");
                };
                
                // Check expiration
                if (now > token.expiresAt) {
                    return #err("Token has expired");
                };
                
                // Check download limit
                if (token.downloadCount >= token.maxDownloads) {
                    return #err("Download limit reached");
                };
                
                #ok(token)
            };
            case null {
                #err("Invalid token")
            };
        }
    };

    // Mark token as used (called by user canister after download)
    public func markTokenUsed(tokenId: Text) : async Result.Result<(), Text> {
        switch (downloadTokensMap.get(tokenId)) {
            case (?token) {
                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                let updated: DownloadToken = {
                    tokenId = token.tokenId;
                    purchaseId = token.purchaseId;
                    listingId = token.listingId;
                    buyer = token.buyer;
                    userCanisterId = token.userCanisterId;
                    exportId = token.exportId;
                    maxDownloads = token.maxDownloads;
                    downloadCount = token.downloadCount + 1;
                    createdAt = token.createdAt;
                    expiresAt = token.expiresAt;
                    lastUsedAt = ?now;
                    isRevoked = token.isRevoked;
                    revokedAt = token.revokedAt;
                    revokedReason = token.revokedReason;
                };
                
                downloadTokensMap.put(tokenId, updated);
                logger.info("MARKETPLACE_TOKEN: Token marked as used TokenID=" # tokenId # " Downloads=" # Nat.toText(updated.downloadCount));
                
                #ok()
            };
            case null {
                #err("Token not found")
            };
        }
    };

    // Revoke token (admin or seller)
    public shared(msg) func revokeDownloadToken(
        tokenId: Text,
        reason: Text
    ) : async Result.Result<(), Text> {
        switch (downloadTokensMap.get(tokenId)) {
            case (?token) {
                // Check authorization
                let canRevoke = _isAdmin(msg.caller) or (
                    switch (marketplaceListingsMap.get(token.listingId)) {
                        case (?listing) { Principal.equal(listing.seller, msg.caller) };
                        case null { false };
                    }
                );
                
                if (not canRevoke) {
                    return #err("Unauthorized");
                };
                
                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                let updated: DownloadToken = {
                    token with
                    isRevoked = true;
                    revokedAt = ?now;
                    revokedReason = ?reason;
                };
                
                downloadTokensMap.put(tokenId, updated);
                logger.info("MARKETPLACE_TOKEN: Token revoked TokenID=" # tokenId # " Reason=" # reason);
                
                #ok()
            };
            case null {
                #err("Token not found")
            };
        }
    };

    // Get buyer's purchases
    public query(msg) func getBuyerPurchases() : async [VerifiedPurchase] {
        let allPurchases = Iter.toArray(verifiedPurchases.vals());
        Array.filter<VerifiedPurchase>(
            allPurchases,
            func(p: VerifiedPurchase): Bool {
                Principal.equal(p.buyer, msg.caller)
            }
        )
    };

    // Get seller's sales
    public query(msg) func getSellerSales() : async [VerifiedPurchase] {
        let allPurchases = Iter.toArray(verifiedPurchases.vals());
        Array.filter<VerifiedPurchase>(
            allPurchases,
            func(p: VerifiedPurchase): Bool {
                switch (marketplaceListingsMap.get(p.listingId)) {
                    case (?listing) { Principal.equal(listing.seller, msg.caller) };
                    case null { false };
                }
            }
        )
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // REVIEW SYSTEM
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Create a review for a purchased project
     */
    public shared(msg) func createReview(
        listingId: Text,
        purchaseId: Text,
        rating: Nat,
        title: Text,
        comment: Text,
        pros: [Text],
        cons: [Text],
        wouldRecommend: Bool
    ) : async Result.Result<Text, Text> {
        // Validate rating
        if (rating < 1 or rating > 5) {
            return #err("Rating must be between 1 and 5 stars");
        };

        // Verify purchase exists and belongs to caller
        switch (verifiedPurchases.get(purchaseId)) {
            case null { return #err("Purchase not found") };
            case (?purchase) {
                if (not Principal.equal(purchase.buyer, msg.caller)) {
                    return #err("You can only review your own purchases");
                };
                if (purchase.listingId != listingId) {
                    return #err("Purchase does not match listing");
                };
                if (purchase.status != #completed) {
                    return #err("Can only review completed purchases");
                };
            };
        };

        // Check if user already reviewed this purchase
        for ((_, review) in projectReviewsMap.entries()) {
            if (review.purchaseId == purchaseId and Principal.equal(review.reviewer, msg.caller)) {
                return #err("You have already reviewed this purchase");
            };
        };

        // Generate review ID
        let now = Nat64.fromNat(Int.abs(Time.now()));
        let reviewId = generateReviewId(listingId, msg.caller, now);

        let review: ProjectReview = {
            reviewId = reviewId;
            listingId = listingId;
            purchaseId = purchaseId;
            reviewer = msg.caller;
            rating = rating;
            title = title;
            comment = comment;
            pros = pros;
            cons = cons;
            wouldRecommend = wouldRecommend;
            createdAt = now;
            updatedAt = now;
            isVerifiedPurchase = true;
            helpfulCount = 0;
            reportCount = 0;
            isHidden = false;
            hiddenReason = null;
            sellerResponse = null;
        };

        projectReviewsMap.put(reviewId, review);
        logger.info("Review created: " # reviewId # " for listing " # listingId);

        #ok(reviewId)
    };

    /**
     * Update a review
     */
    public shared(msg) func updateReview(
        reviewId: Text,
        rating: ?Nat,
        title: ?Text,
        comment: ?Text,
        pros: ?[Text],
        cons: ?[Text],
        wouldRecommend: ?Bool
    ) : async Result.Result<(), Text> {
        switch (projectReviewsMap.get(reviewId)) {
            case null { return #err("Review not found") };
            case (?review) {
                if (not Principal.equal(review.reviewer, msg.caller)) {
                    return #err("You can only update your own reviews");
                };

                // Validate rating if provided
                switch (rating) {
                    case (?r) {
                        if (r < 1 or r > 5) {
                            return #err("Rating must be between 1 and 5 stars");
                        };
                    };
                    case null {};
                };

                let now = Nat64.fromNat(Int.abs(Time.now()));
                let updatedReview: ProjectReview = {
                    reviewId = review.reviewId;
                    listingId = review.listingId;
                    purchaseId = review.purchaseId;
                    reviewer = review.reviewer;
                    rating = switch (rating) { case (?r) r; case null review.rating };
                    title = switch (title) { case (?t) t; case null review.title };
                    comment = switch (comment) { case (?c) c; case null review.comment };
                    pros = switch (pros) { case (?p) p; case null review.pros };
                    cons = switch (cons) { case (?c) c; case null review.cons };
                    wouldRecommend = switch (wouldRecommend) { case (?w) w; case null review.wouldRecommend };
                    createdAt = review.createdAt;
                    updatedAt = now;
                    isVerifiedPurchase = review.isVerifiedPurchase;
                    helpfulCount = review.helpfulCount;
                    reportCount = review.reportCount;
                    isHidden = review.isHidden;
                    hiddenReason = review.hiddenReason;
                    sellerResponse = review.sellerResponse;
                };

                projectReviewsMap.put(reviewId, updatedReview);
                logger.info("Review updated: " # reviewId);
                #ok(())
            };
        }
    };

    /**
     * Delete a review
     */
    public shared(msg) func deleteReview(reviewId: Text) : async Result.Result<(), Text> {
        switch (projectReviewsMap.get(reviewId)) {
            case null { return #err("Review not found") };
            case (?review) {
                // Only reviewer or admin can delete
                if (not Principal.equal(review.reviewer, msg.caller) and not _isAdmin(msg.caller)) {
                    return #err("Only the reviewer or admin can delete a review");
                };

                projectReviewsMap.delete(reviewId);
                reviewVotesMap.delete(reviewId);
                logger.info("Review deleted: " # reviewId);
                #ok(())
            };
        }
    };

    /**
     * Get reviews for a listing
     */
    public query func getListingReviews(listingId: Text) : async [ProjectReview] {
        let allReviews = Iter.toArray(projectReviewsMap.vals());
        Array.filter<ProjectReview>(
            allReviews,
            func(r: ProjectReview): Bool {
                r.listingId == listingId and not r.isHidden
            }
        )
    };

    /**
     * Get review summary/statistics for a listing
     */
    public query func getListingReviewSummary(listingId: Text) : async ReviewSummary {
        let reviews = Array.filter<ProjectReview>(
            Iter.toArray(projectReviewsMap.vals()),
            func(r: ProjectReview): Bool {
                r.listingId == listingId and not r.isHidden
            }
        );

        let totalReviews = reviews.size();
        
        if (totalReviews == 0) {
            return {
                listingId = listingId;
                totalReviews = 0;
                averageRating = 0.0;
                ratingDistribution = [0, 0, 0, 0, 0];
                recommendationRate = 0.0;
                verifiedPurchaseRate = 0.0;
            };
        };

        var totalRating: Nat = 0;
        var recommendCount: Nat = 0;
        var verifiedCount: Nat = 0;
        var oneStarCount: Nat = 0;
        var twoStarCount: Nat = 0;
        var threeStarCount: Nat = 0;
        var fourStarCount: Nat = 0;
        var fiveStarCount: Nat = 0;

        for (review in reviews.vals()) {
            totalRating += review.rating;
            if (review.wouldRecommend) { recommendCount += 1 };
            if (review.isVerifiedPurchase) { verifiedCount += 1 };

            switch (review.rating) {
                case 1 { oneStarCount += 1 };
                case 2 { twoStarCount += 1 };
                case 3 { threeStarCount += 1 };
                case 4 { fourStarCount += 1 };
                case 5 { fiveStarCount += 1 };
                case _ {};
            };
        };

        let avgRating = Float.fromInt(totalRating) / Float.fromInt(totalReviews);
        let recommendRate = (Float.fromInt(recommendCount) / Float.fromInt(totalReviews)) * 100.0;
        let verifiedRate = (Float.fromInt(verifiedCount) / Float.fromInt(totalReviews)) * 100.0;

        {
            listingId = listingId;
            totalReviews = totalReviews;
            averageRating = avgRating;
            ratingDistribution = [oneStarCount, twoStarCount, threeStarCount, fourStarCount, fiveStarCount];
            recommendationRate = recommendRate;
            verifiedPurchaseRate = verifiedRate;
        }
    };

    /**
     * Seller responds to a review
     */
    public shared(msg) func respondToReview(
        reviewId: Text,
        responseText: Text
    ) : async Result.Result<(), Text> {
        switch (projectReviewsMap.get(reviewId)) {
            case null { return #err("Review not found") };
            case (?review) {
                // Verify caller is the seller
                switch (marketplaceListingsMap.get(review.listingId)) {
                    case null { return #err("Listing not found") };
                    case (?listing) {
                        if (not Principal.equal(listing.seller, msg.caller)) {
                            return #err("Only the seller can respond to reviews");
                        };

                        let now = Nat64.fromNat(Int.abs(Time.now()));
                        let response: SellerResponse = {
                            responseText = responseText;
                            respondedAt = now;
                            updatedAt = now;
                        };

                        let updatedReview: ProjectReview = {
                            reviewId = review.reviewId;
                            listingId = review.listingId;
                            purchaseId = review.purchaseId;
                            reviewer = review.reviewer;
                            rating = review.rating;
                            title = review.title;
                            comment = review.comment;
                            pros = review.pros;
                            cons = review.cons;
                            wouldRecommend = review.wouldRecommend;
                            createdAt = review.createdAt;
                            updatedAt = now;
                            isVerifiedPurchase = review.isVerifiedPurchase;
                            helpfulCount = review.helpfulCount;
                            reportCount = review.reportCount;
                            isHidden = review.isHidden;
                            hiddenReason = review.hiddenReason;
                            sellerResponse = ?response;
                        };

                        projectReviewsMap.put(reviewId, updatedReview);
                        logger.info("Seller responded to review: " # reviewId);
                        #ok(())
                    };
                };
            };
        }
    };

    /**
     * Vote on review helpfulness
     */
    public shared(msg) func voteReviewHelpful(
        reviewId: Text,
        isHelpful: Bool
    ) : async Result.Result<(), Text> {
        switch (projectReviewsMap.get(reviewId)) {
            case null { return #err("Review not found") };
            case (?review) {
                // Check if user already voted
                let existingVotes = switch (reviewVotesMap.get(reviewId)) {
                    case null { [] };
                    case (?votes) { votes };
                };

                for (vote in existingVotes.vals()) {
                    if (Principal.equal(vote.voter, msg.caller)) {
                        return #err("You have already voted on this review");
                    };
                };

                // Add vote
                let now = Nat64.fromNat(Int.abs(Time.now()));
                let newVote: ReviewVote = {
                    reviewId = reviewId;
                    voter = msg.caller;
                    isHelpful = isHelpful;
                    votedAt = now;
                };

                let updatedVotes = Array.append<ReviewVote>(existingVotes, [newVote]);
                reviewVotesMap.put(reviewId, updatedVotes);

                // Update helpful count
                if (isHelpful) {
                    let updatedReview: ProjectReview = {
                        reviewId = review.reviewId;
                        listingId = review.listingId;
                        purchaseId = review.purchaseId;
                        reviewer = review.reviewer;
                        rating = review.rating;
                        title = review.title;
                        comment = review.comment;
                        pros = review.pros;
                        cons = review.cons;
                        wouldRecommend = review.wouldRecommend;
                        createdAt = review.createdAt;
                        updatedAt = review.updatedAt;
                        isVerifiedPurchase = review.isVerifiedPurchase;
                        helpfulCount = review.helpfulCount + 1;
                        reportCount = review.reportCount;
                        isHidden = review.isHidden;
                        hiddenReason = review.hiddenReason;
                        sellerResponse = review.sellerResponse;
                    };
                    projectReviewsMap.put(reviewId, updatedReview);
                };

                #ok(())
            };
        }
    };

    /**
     * Report a review for moderation
     */
    public shared(msg) func reportReview(
        reviewId: Text,
        reason: ReportReason,
        description: Text
    ) : async Result.Result<Text, Text> {
        switch (projectReviewsMap.get(reviewId)) {
            case null { return #err("Review not found") };
            case (?review) {
                let now = Nat64.fromNat(Int.abs(Time.now()));
                let reportId = generateReportId(reviewId, msg.caller, now);

                let report: ReviewReport = {
                    reportId = reportId;
                    reviewId = reviewId;
                    reporter = msg.caller;
                    reason = reason;
                    description = description;
                    reportedAt = now;
                    status = #pending;
                    resolvedBy = null;
                    resolvedAt = null;
                    resolution = null;
                };

                reviewReportsMap.put(reportId, report);

                // Update report count on review
                let updatedReview: ProjectReview = {
                    reviewId = review.reviewId;
                    listingId = review.listingId;
                    purchaseId = review.purchaseId;
                    reviewer = review.reviewer;
                    rating = review.rating;
                    title = review.title;
                    comment = review.comment;
                    pros = review.pros;
                    cons = review.cons;
                    wouldRecommend = review.wouldRecommend;
                    createdAt = review.createdAt;
                    updatedAt = review.updatedAt;
                    isVerifiedPurchase = review.isVerifiedPurchase;
                    helpfulCount = review.helpfulCount;
                    reportCount = review.reportCount + 1;
                    isHidden = review.isHidden;
                    hiddenReason = review.hiddenReason;
                    sellerResponse = review.sellerResponse;
                };
                projectReviewsMap.put(reviewId, updatedReview);

                logger.info("Review reported: " # reviewId # " Report ID: " # reportId);
                #ok(reportId)
            };
        }
    };

    /**
     * Hide a review (admin only)
     */
    public shared(msg) func hideReview(
        reviewId: Text,
        reason: Text
    ) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        switch (projectReviewsMap.get(reviewId)) {
            case null { return #err("Review not found") };
            case (?review) {
                let updatedReview: ProjectReview = {
                    reviewId = review.reviewId;
                    listingId = review.listingId;
                    purchaseId = review.purchaseId;
                    reviewer = review.reviewer;
                    rating = review.rating;
                    title = review.title;
                    comment = review.comment;
                    pros = review.pros;
                    cons = review.cons;
                    wouldRecommend = review.wouldRecommend;
                    createdAt = review.createdAt;
                    updatedAt = review.updatedAt;
                    isVerifiedPurchase = review.isVerifiedPurchase;
                    helpfulCount = review.helpfulCount;
                    reportCount = review.reportCount;
                    isHidden = true;
                    hiddenReason = ?reason;
                    sellerResponse = review.sellerResponse;
                };

                projectReviewsMap.put(reviewId, updatedReview);
                logger.info("Review hidden by admin: " # reviewId);
                #ok(())
            };
        }
    };

    /**
     * Unhide a review (admin only)
     */
    public shared(msg) func unhideReview(reviewId: Text) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        switch (projectReviewsMap.get(reviewId)) {
            case null { return #err("Review not found") };
            case (?review) {
                let updatedReview: ProjectReview = {
                    reviewId = review.reviewId;
                    listingId = review.listingId;
                    purchaseId = review.purchaseId;
                    reviewer = review.reviewer;
                    rating = review.rating;
                    title = review.title;
                    comment = review.comment;
                    pros = review.pros;
                    cons = review.cons;
                    wouldRecommend = review.wouldRecommend;
                    createdAt = review.createdAt;
                    updatedAt = review.updatedAt;
                    isVerifiedPurchase = review.isVerifiedPurchase;
                    helpfulCount = review.helpfulCount;
                    reportCount = review.reportCount;
                    isHidden = false;
                    hiddenReason = null;
                    sellerResponse = review.sellerResponse;
                };

                projectReviewsMap.put(reviewId, updatedReview);
                logger.info("Review unhidden by admin: " # reviewId);
                #ok(())
            };
        }
    };

    /**
     * Get pending review reports (admin only)
     */
    public query(msg) func getPendingReviewReports() : async Result.Result<[ReviewReport], Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let allReports = Iter.toArray(reviewReportsMap.vals());
        let pendingReports = Array.filter<ReviewReport>(
            allReports,
            func(r: ReviewReport): Bool {
                r.status == #pending
            }
        );

        #ok(pendingReports)
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // LISTING FEE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get current listing fee configuration (public query)
     */
    public query func getListingFeeConfig() : async ListingFeeConfig {
        listingFeeConfig
    };

    /**
     * Update listing fee configuration (admin only)
     */
    public shared(msg) func updateListingFeeConfig(
        basicFee: ?Nat,
        featuredFee: ?Nat,
        premiumFee: ?Nat,
        featuredDurationDays: ?Nat,
        premiumDurationDays: ?Nat
    ) : async Result.Result<ListingFeeConfig, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        listingFeeConfig := {
            basicFee = switch(basicFee) { case (?v) v; case null listingFeeConfig.basicFee };
            featuredFee = switch(featuredFee) { case (?v) v; case null listingFeeConfig.featuredFee };
            premiumFee = switch(premiumFee) { case (?v) v; case null listingFeeConfig.premiumFee };
            featuredDurationDays = switch(featuredDurationDays) { case (?v) v; case null listingFeeConfig.featuredDurationDays };
            premiumDurationDays = switch(premiumDurationDays) { case (?v) v; case null listingFeeConfig.premiumDurationDays };
        };

        logger.info("Listing fee config updated by admin: " # Principal.toText(msg.caller));
        #ok(listingFeeConfig)
    };

    /**
     * Record listing fee payment (called after Stripe payment confirmed)
     */
    public shared(msg) func recordListingFeePayment(
        listingId: Text,
        stripePaymentIntentId: Text,
        amountPaid: Nat,
        feeType: ListingFeeType
    ) : async Result.Result<ListingFeePayment, Text> {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        let paymentId = generatePaymentId(listingId, msg.caller, now);

        // Verify the listing exists
        switch (marketplaceListingsMap.get(listingId)) {
            case null { return #err("Listing not found") };
            case (?listing) {
                // Verify caller is the seller
                if (listing.seller != msg.caller) {
                    return #err("Unauthorized: Only the seller can pay listing fee");
                };

                // Create payment record
                let payment: ListingFeePayment = {
                    paymentId = paymentId;
                    listingId = listingId;
                    seller = msg.caller;
                    stripePaymentIntentId = stripePaymentIntentId;
                    amountPaid = amountPaid;
                    feeType = feeType;
                    paidAt = now;
                    status = #completed;
                    refundedAt = null;
                    refundReason = null;
                };

                listingFeePaymentsMap.put(paymentId, payment);
                logger.info("Listing fee payment recorded: " # paymentId # " for listing: " # listingId);

                #ok(payment)
            };
        }
    };

    /**
     * Check if listing fee is paid for a listing
     */
    public query func isListingFeePaid(listingId: Text) : async Bool {
        // Check if any completed payment exists for this listing
        for ((_, payment) in listingFeePaymentsMap.entries()) {
            if (payment.listingId == listingId and payment.status == #completed) {
                return true;
            };
        };
        false
    };

    /**
     * Get all fee payments for a seller
     */
    public query(msg) func getSellerFeePayments() : async [ListingFeePayment] {
        let allPayments = Iter.toArray(listingFeePaymentsMap.vals());
        Array.filter<ListingFeePayment>(
            allPayments,
            func(p: ListingFeePayment): Bool {
                p.seller == msg.caller
            }
        )
    };

    /**
     * Get fee payment by ID (admin only)
     */
    public query(msg) func getFeePaymentById(paymentId: Text) : async Result.Result<ListingFeePayment, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        switch (listingFeePaymentsMap.get(paymentId)) {
            case null { #err("Payment not found") };
            case (?payment) { #ok(payment) };
        }
    };

    /**
     * Refund listing fee (admin only)
     */
    public shared(msg) func refundListingFee(
        paymentId: Text,
        refundReason: Text
    ) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        switch (listingFeePaymentsMap.get(paymentId)) {
            case null { return #err("Payment not found") };
            case (?payment) {
                if (payment.status == #refunded) {
                    return #err("Payment already refunded");
                };

                let now = Nat64.fromNat(Int.abs(Time.now()));
                let updatedPayment: ListingFeePayment = {
                    paymentId = payment.paymentId;
                    listingId = payment.listingId;
                    seller = payment.seller;
                    stripePaymentIntentId = payment.stripePaymentIntentId;
                    amountPaid = payment.amountPaid;
                    feeType = payment.feeType;
                    paidAt = payment.paidAt;
                    status = #refunded;
                    refundedAt = ?now;
                    refundReason = ?refundReason;
                };

                listingFeePaymentsMap.put(paymentId, updatedPayment);
                logger.info("Listing fee refunded by admin: " # paymentId # " Reason: " # refundReason);

                #ok(())
            };
        }
    };

    /**
     * Upgrade listing tier (after fee payment)
     */
    public shared(msg) func upgradeListingTier(
        listingId: Text,
        newTier: ListingTier
    ) : async Result.Result<MarketplaceListing, Text> {
        switch (marketplaceListingsMap.get(listingId)) {
            case null { return #err("Listing not found") };
            case (?listing) {
                if (listing.seller != msg.caller) {
                    return #err("Unauthorized: Only the seller can upgrade listing");
                };

                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                // Calculate expiration dates if duration is set
                let featuredExpiry = if (listingFeeConfig.featuredDurationDays > 0) {
                    let durationNanos = Nat64.fromNat(listingFeeConfig.featuredDurationDays * 24 * 60 * 60) * 1_000_000_000;
                    ?(now + durationNanos)
                } else {
                    null  // Permanent
                };

                let premiumExpiry = if (listingFeeConfig.premiumDurationDays > 0) {
                    let durationNanos = Nat64.fromNat(listingFeeConfig.premiumDurationDays * 24 * 60 * 60) * 1_000_000_000;
                    ?(now + durationNanos)
                } else {
                    null  // Permanent
                };

                let updatedListing: MarketplaceListing = {
                    listingId = listing.listingId;
                    projectId = listing.projectId;
                    userCanisterId = listing.userCanisterId;
                    seller = listing.seller;
                    exportId = listing.exportId;
                    title = listing.title;
                    description = listing.description;
                    price = listing.price;
                    stripeAccountId = listing.stripeAccountId;
                    previewImages = listing.previewImages;
                    demoUrl = listing.demoUrl;
                    category = listing.category;
                    tags = listing.tags;
                    version = listing.version;
                    listedAt = listing.listedAt;
                    updatedAt = now;
                    totalSales = listing.totalSales;
                    isPublished = listing.isPublished;
                    isActive = listing.isActive;
                    listingTier = newTier;
                    featuredUntil = switch(newTier) {
                        case (#featured) featuredExpiry;
                        case (#premium) premiumExpiry;
                        case (#basic) null;
                    };
                    premiumUntil = switch(newTier) {
                        case (#premium) premiumExpiry;
                        case _ null;
                    };
                };

                marketplaceListingsMap.put(listingId, updatedListing);
                logger.info("Listing tier upgraded: " # listingId # " to tier: " # debug_show(newTier));

                #ok(updatedListing)
            };
        }
    };

    /**
     * Import purchased project directly to buyer's workspace
     */
    public shared(msg) func importPurchasedProject(
        purchaseId: Text,
        buyerUserCanisterId: Principal
    ) : async Result.Result<Text, Text> {
        // Verify purchase exists and belongs to caller
        switch (verifiedPurchases.get(purchaseId)) {
            case null { return #err("Purchase not found") };
            case (?purchase) {
                if (purchase.buyer != msg.caller) {
                    return #err("Unauthorized: Purchase does not belong to you");
                };

                if (purchase.status != #completed) {
                    return #err("Purchase not completed yet");
                };

                // Get the listing to get export info
                switch (marketplaceListingsMap.get(purchase.listingId)) {
                    case null { return #err("Listing not found") };
                    case (?listing) {
                        let now = Nat64.fromNat(Int.abs(Time.now()));
                        let importId = generateImportId(purchaseId, msg.caller, now);

                        // Call buyer's user canister to import the project
                        // This will be done via inter-canister call
                        let userCanisterActor: actor {
                            importMarketplaceProject: (
                                sellerUserCanisterId: Principal,
                                exportId: Text,
                                projectName: Text
                            ) -> async Result.Result<Text, Text>;
                        } = actor(Principal.toText(buyerUserCanisterId));

                        try {
                            let importResult = await userCanisterActor.importMarketplaceProject(
                                listing.userCanisterId,
                                listing.exportId,
                                listing.title # " (from Marketplace)"
                            );

                            switch (importResult) {
                                case (#err(e)) { return #err("Failed to import project: " # e) };
                                case (#ok(newProjectId)) {
                                    // Record the import
                                    let importRecord: ProjectImport = {
                                        importId = importId;
                                        purchaseId = purchaseId;
                                        listingId = listing.listingId;
                                        buyer = msg.caller;
                                        buyerUserCanisterId = buyerUserCanisterId;
                                        importedProjectId = newProjectId;
                                        importedAt = now;
                                        importMethod = #directImport;
                                    };

                                    projectImportsMap.put(importId, importRecord);
                                    logger.info("Project imported: " # importId # " Purchase: " # purchaseId # " NewProjectID: " # newProjectId);

                                    #ok(newProjectId)
                                };
                            };
                        } catch (error) {
                            #err("Inter-canister call failed: " # Error.message(error))
                        };
                    };
                };
            };
        }
    };

    /**
     * Get import history for buyer
     */
    public query(msg) func getBuyerImports() : async [ProjectImport] {
        let allImports = Iter.toArray(projectImportsMap.vals());
        Array.filter<ProjectImport>(
            allImports,
            func(imp: ProjectImport): Bool {
                imp.buyer == msg.caller
            }
        )
    };

    /**
     * Check if listing tier has expired
     */
    public query func isListingTierActive(listingId: Text) : async Bool {
        switch (marketplaceListingsMap.get(listingId)) {
            case null { false };
            case (?listing) {
                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                // Check if featured/premium status has expired
                switch (listing.listingTier) {
                    case (#basic) { true };
                    case (#featured) {
                        switch (listing.featuredUntil) {
                            case null { true };  // Permanent
                            case (?expiry) { now < expiry };
                        };
                    };
                    case (#premium) {
                        switch (listing.premiumUntil) {
                            case null { true };  // Permanent
                            case (?expiry) { now < expiry };
                        };
                    };
                }
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // KONTEXT UNIVERSITY - PROGRAM MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Create a new academic program (Admin/Instructor only)
     */
    public shared(msg) func createAcademicProgram(
        title: Text,
        description: Text,
        shortDescription: Text,
        thumbnailUrl: Text,
        instructorName: Text,
        courseIds: [Text],
        requiredCourses: [Text],
        electiveCourses: [Text],
        totalCredits: Nat,
        estimatedHours: Nat,
        difficulty: DifficultyLevel,
        category: Text,
        tags: [Text],
        prerequisites: [Text],
        degreeType: DegreeType
    ) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let programId = universityManager.createProgram(
            title,
            description,
            shortDescription,
            thumbnailUrl,
            msg.caller,
            instructorName,
            courseIds,
            requiredCourses,
            electiveCourses,
            totalCredits,
            estimatedHours,
            difficulty,
            category,
            tags,
            prerequisites,
            degreeType
        );

        #ok(programId)
    };

    /**
     * Get academic program by ID
     */
    public query func getAcademicProgram(programId: Text) : async ?AcademicProgram {
        universityManager.getProgram(programId)
    };

    /**
     * Get all published programs
     */
    public query func getPublishedPrograms() : async [AcademicProgram] {
        universityManager.getPublishedPrograms()
    };

    /**
     * Get published programs (paginated)
     */
    public query func getPublishedProgramsPaginated(
        limit: Nat,
        offset: Nat
    ) : async ([AcademicProgram], Nat) {
        let allPrograms = universityManager.getPublishedPrograms();
        let sorted = Array.sort(allPrograms, func(a: AcademicProgram, b: AcademicProgram) : Order.Order {
            Nat64.compare(b.createdAt, a.createdAt)
        });
        let total = sorted.size();
        let start = Nat.min(offset, total);
        let end = Nat.min(start + limit, total);
        let paginated = Array.tabulate(end - start, func(i: Nat) : AcademicProgram {
            sorted[start + i]
        });
        (paginated, total)
    };

    /**
     * Get all programs (including unpublished) - Admin only
     */
    public query(msg) func getAllPrograms() : async Result.Result<[AcademicProgram], Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        #ok(universityManager.getAllPrograms())
    };

    /**
     * Get all programs (including unpublished, paginated) - Admin only
     */
    public query(msg) func getAllProgramsPaginated(
        limit: Nat,
        offset: Nat
    ) : async Result.Result<([AcademicProgram], Nat), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        let allPrograms = universityManager.getAllPrograms();
        let sorted = Array.sort(allPrograms, func(a: AcademicProgram, b: AcademicProgram) : Order.Order {
            Nat64.compare(b.updatedAt, a.updatedAt)
        });
        let total = sorted.size();
        let start = Nat.min(offset, total);
        let end = Nat.min(start + limit, total);
        let paginated = Array.tabulate(end - start, func(i: Nat) : AcademicProgram {
            sorted[start + i]
        });
        #ok(paginated, total)
    };

    /**
     * Update academic program (Admin/Instructor only)
     */
    public shared(msg) func updateAcademicProgram(
        programId: Text,
        title: ?Text,
        description: ?Text,
        shortDescription: ?Text,
        courseIds: ?[Text],
        isPublished: ?Bool
    ) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let success = universityManager.updateProgram(
            programId,
            title,
            description,
            shortDescription,
            courseIds,
            isPublished
        );

        if (success) {
            #ok(())
        } else {
            #err("Program not found")
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // KONTEXT UNIVERSITY - COURSE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Create a new course (Admin/Instructor only)
     */
    public shared(msg) func createCourse(
        programId: ?Text,
        title: Text,
        description: Text,
        shortDescription: Text,
        thumbnailUrl: Text,
        instructorName: Text,
        lessonIds: [Text],
        credits: Nat,
        estimatedHours: Nat,
        difficulty: DifficultyLevel,
        category: Text,
        tags: [Text],
        prerequisites: [Text],
        accessTier: AccessTier,
        syllabus: [UniversityTypes.SyllabusItem]
    ) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let courseId = universityManager.createCourse(
            programId,
            title,
            description,
            shortDescription,
            thumbnailUrl,
            msg.caller,
            instructorName,
            lessonIds,
            credits,
            estimatedHours,
            difficulty,
            category,
            tags,
            prerequisites,
            accessTier,
            syllabus
        );

        #ok(courseId)
    };

    /**
     * Get course by ID
     */
    public query func getCourse(courseId: Text) : async ?Course {
        universityManager.getCourse(courseId)
    };

    /**
     * Get all published courses
     */
    public query func getPublishedCourses() : async [Course] {
        universityManager.getPublishedCourses()
    };

    /**
     * Get published courses (paginated)
     */
    public query func getPublishedCoursesPaginated(
        limit: Nat,
        offset: Nat
    ) : async ([Course], Nat) {
        let allCourses = universityManager.getPublishedCourses();
        let sorted = Array.sort(allCourses, func(a: Course, b: Course) : Order.Order {
            Nat64.compare(b.createdAt, a.createdAt)
        });
        let total = sorted.size();
        let start = Nat.min(offset, total);
        let end = Nat.min(start + limit, total);
        let paginated = Array.tabulate(end - start, func(i: Nat) : Course {
            sorted[start + i]
        });
        (paginated, total)
    };

    /**
     * Get all courses (including unpublished) - Admin only
     */
    public query(msg) func getAllCourses() : async Result.Result<[Course], Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        #ok(universityManager.getAllCourses())
    };

    /**
     * Get all courses (including unpublished, paginated) - Admin only
     */
    public query(msg) func getAllCoursesPaginated(
        limit: Nat,
        offset: Nat
    ) : async Result.Result<([Course], Nat), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        let allCourses = universityManager.getAllCourses();
        let sorted = Array.sort(allCourses, func(a: Course, b: Course) : Order.Order {
            Nat64.compare(b.updatedAt, a.updatedAt)
        });
        let total = sorted.size();
        let start = Nat.min(offset, total);
        let end = Nat.min(start + limit, total);
        let paginated = Array.tabulate(end - start, func(i: Nat) : Course {
            sorted[start + i]
        });
        #ok(paginated, total)
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // LEARNING PATHS (Admin only)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Create a learning path (Admin only)
     */
    public shared(msg) func createLearningPath(
        title: Text,
        description: Text,
        programIds: [Text],
        courseIds: [Text],
        estimatedHours: Nat,
        difficulty: DifficultyLevel,
        forRole: Text
    ) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let pathId = universityManager.createLearningPath(
            title,
            description,
            programIds,
            courseIds,
            estimatedHours,
            difficulty,
            forRole
        );

        #ok(pathId)
    };

    /**
     * Get all learning paths
     */
    public query func getLearningPaths() : async [LearningPath] {
        universityManager.getLearningPaths()
    };

    /**
     * Get courses by access tier
     */
    public query func getCoursesByTier(tier: AccessTier) : async [Course] {
        universityManager.getCoursesByTier(tier)
    };

    /**
     * Get courses by access tier (paginated)
     */
    public query func getCoursesByTierPaginated(
        tier: AccessTier,
        limit: Nat,
        offset: Nat
    ) : async ([Course], Nat) {
        let tierCourses = universityManager.getCoursesByTier(tier);
        let sorted = Array.sort(tierCourses, func(a: Course, b: Course) : Order.Order {
            Nat64.compare(b.createdAt, a.createdAt)
        });
        let total = sorted.size();
        let start = Nat.min(offset, total);
        let end = Nat.min(start + limit, total);
        let paginated = Array.tabulate(end - start, func(i: Nat) : Course {
            sorted[start + i]
        });
        (paginated, total)
    };

    /**
     * Update academic course (Admin/Instructor only)
     */
    public shared(msg) func updateAcademicCourse(
        courseId: Text,
        title: ?Text,
        description: ?Text,
        shortDescription: ?Text,
        lessonIds: ?[Text],
        isPublished: ?Bool,
        isActive: ?Bool
    ) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let success = universityManager.updateCourse(
            courseId,
            title,
            description,
            shortDescription,
            lessonIds,
            isPublished,
            isActive
        );

        if (success) {
            #ok(())
        } else {
            #err("Course not found")
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // KONTEXT UNIVERSITY - LESSON MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Create a new lesson/video (Admin/Instructor only)
     */
    public shared(msg) func createLesson(
        courseId: Text,
        title: Text,
        description: Text,
        youtubeVideoId: Text,
        duration: Nat,
        orderIndex: Nat,
        accessTier: AccessTier,
        isFree: Bool,
        resources: [UniversityTypes.LessonResource],
        transcript: ?Text
    ) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let lessonId = universityManager.createLesson(
            courseId,
            title,
            description,
            youtubeVideoId,
            duration,
            orderIndex,
            accessTier,
            isFree,
            resources,
            transcript
        );

        #ok(lessonId)
    };

    /**
     * Get lesson by ID
     */
    public query func getLesson(lessonId: Text) : async ?Lesson {
        universityManager.getLesson(lessonId)
    };

    /**
     * Get lessons by course ID
     */
    public query func getLessonsByCourse(courseId: Text) : async [Lesson] {
        universityManager.getLessonsByCourse(courseId)
    };

    /**
     * Get lessons by course (paginated)
     */
    public query func getLessonsByCoursePaginated(
        courseId: Text,
        limit: Nat,
        offset: Nat
    ) : async ([Lesson], Nat) {
        let courseLessons = universityManager.getLessonsByCourse(courseId);
        let sorted = Array.sort(courseLessons, func(a: Lesson, b: Lesson) : Order.Order {
            Nat64.compare(b.createdAt, a.createdAt)
        });
        let total = sorted.size();
        let start = Nat.min(offset, total);
        let end = Nat.min(start + limit, total);
        let paginated = Array.tabulate(end - start, func(i: Nat) : Lesson {
            sorted[start + i]
        });
        (paginated, total)
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // KONTEXT UNIVERSITY - ENROLLMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Enroll in academic program
     */
    public shared(msg) func enrollInProgram(programId: Text) : async Result.Result<Text, Text> {
        let enrollmentId = universityManager.enrollInProgram(programId, msg.caller);
        #ok(enrollmentId)
    };

    /**
     * Enroll in course
     */
    public shared(msg) func enrollInCourse(courseId: Text) : async Result.Result<Text, Text> {
        let enrollmentId = universityManager.enrollInCourse(courseId, msg.caller);
        #ok(enrollmentId)
    };

    /**
     * Get student's enrollments
     */
    public query(msg) func getMyEnrollments() : async {
        programs: [ProgramEnrollment];
        courses: [CourseEnrollment];
    } {
        universityManager.getStudentEnrollments(msg.caller)
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // KONTEXT UNIVERSITY - VIDEO PROGRESS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Update video progress
     */
    public shared(msg) func updateVideoProgress(
        lessonId: Text,
        watchedDuration: Nat,
        totalDuration: Nat,
        lastPosition: Nat,
        playbackSpeed: Float,
        isCompleted: Bool
    ) : async Result.Result<Text, Text> {
        let progressId = universityManager.updateVideoProgress(
            lessonId,
            msg.caller,
            watchedDuration,
            totalDuration,
            lastPosition,
            playbackSpeed,
            isCompleted
        );
        #ok(progressId)
    };

    /**
     * Get video progress
     */
    public query(msg) func getVideoProgress(lessonId: Text) : async ?VideoProgress {
        universityManager.getVideoProgress(lessonId, msg.caller)
    };

    /**
     * Add note to video at specific timestamp
     */
    public shared(msg) func addVideoNote(
        lessonId: Text,
        timestamp: Nat,
        content: Text
    ) : async Result.Result<(), Text> {
        let success = universityManager.addVideoNote(
            lessonId,
            msg.caller,
            timestamp,
            content
        );
        if (success) {
            #ok(())
        } else {
            #err("Failed to add note")
        }
    };

    /**
     * Add bookmark to video at specific timestamp
     */
    public shared(msg) func addVideoBookmark(
        lessonId: Text,
        timestamp: Nat,
        title: Text
    ) : async Result.Result<(), Text> {
        let success = universityManager.addVideoBookmark(
            lessonId,
            msg.caller,
            timestamp,
            title
        );
        if (success) {
            #ok(())
        } else {
            #err("Failed to add bookmark")
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    private func generateListingId(projectId: Text, userCanisterId: Principal, timestamp: Nat64) : Text {
        let seed = projectId # Principal.toText(userCanisterId) # Nat64.toText(timestamp);
        let hash = Text.hash(seed);
        "listing_" # Nat32.toText(hash) # "_" # Nat64.toText(timestamp)
    };

    private func generateReviewId(listingId: Text, reviewer: Principal, timestamp: Nat64) : Text {
        let seed = listingId # Principal.toText(reviewer) # Nat64.toText(timestamp);
        let hash = Text.hash(seed);
        "review_" # Nat32.toText(hash) # "_" # Nat64.toText(timestamp)
    };

    private func generateReportId(reviewId: Text, reporter: Principal, timestamp: Nat64) : Text {
        let seed = reviewId # Principal.toText(reporter) # Nat64.toText(timestamp);
        let hash = Text.hash(seed);
        "report_" # Nat32.toText(hash) # "_" # Nat64.toText(timestamp)
    };

    private func generatePurchaseId(listingId: Text, buyer: Principal, timestamp: Nat64) : Text {
        let seed = listingId # Principal.toText(buyer) # Nat64.toText(timestamp);
        let hash = Text.hash(seed);
        "purchase_" # Nat32.toText(hash) # "_" # Nat64.toText(timestamp)
    };

    private func generatePaymentId(listingId: Text, seller: Principal, timestamp: Nat64) : Text {
        let seed = listingId # Principal.toText(seller) # Nat64.toText(timestamp) # "fee";
        let hash = Text.hash(seed);
        "feepay_" # Nat32.toText(hash) # "_" # Nat64.toText(timestamp)
    };

    private func generateImportId(purchaseId: Text, buyer: Principal, timestamp: Nat64) : Text {
        let seed = purchaseId # Principal.toText(buyer) # Nat64.toText(timestamp) # "import";
        let hash = Text.hash(seed);
        "import_" # Nat32.toText(hash) # "_" # Nat64.toText(timestamp)
    };

    private func generateTokenId(purchaseId: Text, timestamp: Nat64) : Text {
        let seed = purchaseId # Nat64.toText(timestamp);
        let hash = Text.hash(seed);
        "token_" # Nat32.toText(hash) # "_" # Nat64.toText(timestamp)
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ANALYTICS SYSTEM - DATA COLLECTION FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Track user activity
     */
    public shared(msg) func trackUserActivity(
        action: AnalyticsTypes.UserAction,
        sessionId: ?Text,
        metadata: ?Text
    ) : async () {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        // Track user first seen (registration date)
        if (userFirstSeen.get(msg.caller) == null) {
            userFirstSeen.put(msg.caller, now);
        };
        
        let record: AnalyticsTypes.UserActivityRecord = {
            id = nextAnalyticsId;
            userId = msg.caller;
            action = action;
            timestamp = now;
            sessionId = sessionId;
            metadata = metadata;
        };
        
        nextAnalyticsId += 1;
        
        // Add record and enforce limit
        userActivityRecords := Array.append<AnalyticsTypes.UserActivityRecord>(
            userActivityRecords,
            [record]
        );
        
        if (userActivityRecords.size() > MAX_ACTIVITY_RECORDS) {
            // Keep only the most recent records
            let startIndex = userActivityRecords.size() - MAX_ACTIVITY_RECORDS;
            userActivityRecords := Array.tabulate<AnalyticsTypes.UserActivityRecord>(
                MAX_ACTIVITY_RECORDS,
                func(i) { userActivityRecords[startIndex + i] }
            );
        };
    };
    
    /**
     * Track feature usage
     */
    public shared(msg) func trackFeatureUsage(
        feature: AnalyticsTypes.FeatureType,
        aiModel: ?AnalyticsTypes.AIModel,
        tokensConsumed: ?Nat,
        durationMs: ?Nat,
        success: Bool,
        errorMessage: ?Text
    ) : async () {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        let record: AnalyticsTypes.FeatureUsageRecord = {
            id = nextAnalyticsId;
            userId = msg.caller;
            feature = feature;
            timestamp = now;
            aiModel = aiModel;
            tokensConsumed = tokensConsumed;
            durationMs = durationMs;
            success = success;
            errorMessage = errorMessage;
        };
        
        nextAnalyticsId += 1;
        
        featureUsageRecords := Array.append<AnalyticsTypes.FeatureUsageRecord>(
            featureUsageRecords,
            [record]
        );
        
        if (featureUsageRecords.size() > MAX_FEATURE_RECORDS) {
            let startIndex = featureUsageRecords.size() - MAX_FEATURE_RECORDS;
            featureUsageRecords := Array.tabulate<AnalyticsTypes.FeatureUsageRecord>(
                MAX_FEATURE_RECORDS,
                func(i) { featureUsageRecords[startIndex + i] }
            );
        };
    };
    
    /**
     * Track revenue
     */
    public shared(msg) func trackRevenue(
        amountCents: Nat,
        currency: Text,
        tier: ?Text,
        paymentType: AnalyticsTypes.PaymentType,
        status: AnalyticsTypes.PaymentStatus,
        stripePaymentId: ?Text
    ) : async () {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        let record: AnalyticsTypes.RevenueRecord = {
            id = nextAnalyticsId;
            userId = msg.caller;
            amountCents = amountCents;
            currency = currency;
            tier = tier;
            paymentType = paymentType;
            timestamp = now;
            status = status;
            stripePaymentId = stripePaymentId;
        };
        
        nextAnalyticsId += 1;
        
        revenueRecords := Array.append<AnalyticsTypes.RevenueRecord>(
            revenueRecords,
            [record]
        );
        
        if (revenueRecords.size() > MAX_REVENUE_RECORDS) {
            let startIndex = revenueRecords.size() - MAX_REVENUE_RECORDS;
            revenueRecords := Array.tabulate<AnalyticsTypes.RevenueRecord>(
                MAX_REVENUE_RECORDS,
                func(i) { revenueRecords[startIndex + i] }
            );
        };
        
        // Invalidate revenue metrics cache
        cachedRevenueMetrics := null;
    };
    
    /**
     * Track marketplace activity
     */
    public shared(msg) func trackMarketplaceActivity(
        listingId: Text,
        sellerId: Principal,
        buyerId: ?Principal,
        action: AnalyticsTypes.MarketplaceAction,
        priceCents: ?Nat,
        category: ?Text
    ) : async () {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        let record: AnalyticsTypes.MarketplaceRecord = {
            id = nextAnalyticsId;
            listingId = listingId;
            sellerId = sellerId;
            buyerId = buyerId;
            action = action;
            priceCents = priceCents;
            timestamp = now;
            category = category;
        };
        
        nextAnalyticsId += 1;
        
        marketplaceRecords := Array.append<AnalyticsTypes.MarketplaceRecord>(
            marketplaceRecords,
            [record]
        );
        
        if (marketplaceRecords.size() > MAX_MARKETPLACE_RECORDS) {
            let startIndex = marketplaceRecords.size() - MAX_MARKETPLACE_RECORDS;
            marketplaceRecords := Array.tabulate<AnalyticsTypes.MarketplaceRecord>(
                MAX_MARKETPLACE_RECORDS,
                func(i) { marketplaceRecords[startIndex + i] }
            );
        };
        
        // Invalidate marketplace metrics cache
        cachedMarketplaceMetrics := null;
    };
    
    /**
     * Track errors
     */
    public shared(msg) func trackError(
        errorType: AnalyticsTypes.ErrorType,
        errorMessage: Text,
        feature: ?Text,
        severity: AnalyticsTypes.ErrorSeverity,
        stackTrace: ?Text
    ) : async Nat {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        let record: AnalyticsTypes.ErrorRecord = {
            id = nextAnalyticsId;
            userId = ?msg.caller;
            errorType = errorType;
            errorMessage = errorMessage;
            feature = feature;
            severity = severity;
            timestamp = now;
            resolved = false;
            resolvedAt = null;
            stackTrace = stackTrace;
        };
        
        let errorId = nextAnalyticsId;
        nextAnalyticsId += 1;
        
        errorRecords := Array.append<AnalyticsTypes.ErrorRecord>(
            errorRecords,
            [record]
        );
        
        if (errorRecords.size() > MAX_ERROR_RECORDS) {
            let startIndex = errorRecords.size() - MAX_ERROR_RECORDS;
            errorRecords := Array.tabulate<AnalyticsTypes.ErrorRecord>(
                MAX_ERROR_RECORDS,
                func(i) { errorRecords[startIndex + i] }
            );
        };
        
        // Invalidate error metrics cache
        cachedErrorMetrics := null;
        
        errorId
    };
    
    /**
     * Resolve error
     */
    public shared(msg) func resolveError(errorId: Nat) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        errorRecords := Array.map<AnalyticsTypes.ErrorRecord, AnalyticsTypes.ErrorRecord>(
            errorRecords,
            func(record) {
                if (record.id == errorId) {
                    {
                        record with
                        resolved = true;
                        resolvedAt = ?now;
                    }
                } else {
                    record
                }
            }
        );
        
        cachedErrorMetrics := null;
        #ok(())
    };
    
    /**
     * Track performance
     */
    public shared(msg) func trackPerformance(
        operation: AnalyticsTypes.OperationType,
        durationMs: Nat,
        success: Bool
    ) : async () {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        let record: AnalyticsTypes.PerformanceRecord = {
            id = nextAnalyticsId;
            operation = operation;
            durationMs = durationMs;
            success = success;
            timestamp = now;
            userId = ?msg.caller;
        };
        
        nextAnalyticsId += 1;
        
        performanceRecords := Array.append<AnalyticsTypes.PerformanceRecord>(
            performanceRecords,
            [record]
        );
        
        if (performanceRecords.size() > MAX_PERFORMANCE_RECORDS) {
            let startIndex = performanceRecords.size() - MAX_PERFORMANCE_RECORDS;
            performanceRecords := Array.tabulate<AnalyticsTypes.PerformanceRecord>(
                MAX_PERFORMANCE_RECORDS,
                func(i) { performanceRecords[startIndex + i] }
            );
        };
        
        // Invalidate performance metrics cache
        cachedPerformanceMetrics := null;
    };
    
    /**
     * Record system health snapshot
     */
    public shared(msg) func recordSystemHealth() : async () {
        if (not _isAdmin(msg.caller)) {
            return;
        };
        
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        // Only record once per hour to avoid spam
        if (now - lastSystemHealthCheck < 3600_000_000_000) {
            return;
        };
        
        lastSystemHealthCheck := now;
        
        let record: AnalyticsTypes.SystemHealthRecord = {
            id = nextAnalyticsId;
            timestamp = now;
            cyclesBalance = Cycles.balance();
            memoryUsed = 0; // Would need to track this separately
            storageUsed = 0; // Would need to calculate
            httpOutcallsToday = 0; // Would need to track
            activeUsers = 0; // Would calculate from recent activity
            totalUsers = userFirstSeen.size();
        };
        
        nextAnalyticsId += 1;
        
        systemHealthRecords := Array.append<AnalyticsTypes.SystemHealthRecord>(
            systemHealthRecords,
            [record]
        );
        
        if (systemHealthRecords.size() > MAX_HEALTH_RECORDS) {
            let startIndex = systemHealthRecords.size() - MAX_HEALTH_RECORDS;
            systemHealthRecords := Array.tabulate<AnalyticsTypes.SystemHealthRecord>(
                MAX_HEALTH_RECORDS,
                func(i) { systemHealthRecords[startIndex + i] }
            );
        };
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ANALYTICS SYSTEM - HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    private func isWithinDateRange(timestamp: Nat64, startDate: ?Nat64, endDate: ?Nat64) : Bool {
        let afterStart = switch (startDate) {
            case (?start) { timestamp >= start };
            case null { true };
        };
        
        let beforeEnd = switch (endDate) {
            case (?end) { timestamp <= end };
            case null { true };
        };
        
        afterStart and beforeEnd
    };
    
    private func getTimeWindowBounds(window: AnalyticsTypes.TimeWindow) : (Nat64, Nat64) {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        switch (window) {
            case (#Last24Hours) {
                let start : Nat64 = if (now > 86400_000_000_000) { now - 86400_000_000_000 } else { 0 };
                (start, now)
            };
            case (#Last7Days) {
                let start : Nat64 = if (now > 604800_000_000_000) { now - 604800_000_000_000 } else { 0 };
                (start, now)
            };
            case (#Last30Days) {
                let start : Nat64 = if (now > 2592000_000_000_000) { now - 2592000_000_000_000 } else { 0 };
                (start, now)
            };
            case (#Last90Days) {
                let start : Nat64 = if (now > 7776000_000_000_000) { now - 7776000_000_000_000 } else { 0 };
                (start, now)
            };
            case (#AllTime) {
                (0 : Nat64, now)
            };
            case (#Custom(range)) {
                (range.startDate, range.endDate)
            };
        }
    };
    
    private func countUniqueUsers(records: [AnalyticsTypes.UserActivityRecord], startDate: ?Nat64, endDate: ?Nat64) : Nat {
        let uniqueUsers = HashMap.HashMap<Principal, Bool>(0, Principal.equal, Principal.hash);
        
        for (record in records.vals()) {
            if (isWithinDateRange(record.timestamp, startDate, endDate)) {
                uniqueUsers.put(record.userId, true);
            };
        };
        
        uniqueUsers.size()
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ANALYTICS SYSTEM - METRICS CALCULATION (Part 1 of 3)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Calculate user activity metrics
     */
    private func calculateUserMetrics(startDate: ?Nat64, endDate: ?Nat64) : AnalyticsTypes.UserMetrics {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        let oneDayAgo : Nat64 = if (now > 86400_000_000_000) { now - 86400_000_000_000 } else { 0 };
        let oneWeekAgo : Nat64 = if (now > 604800_000_000_000) { now - 604800_000_000_000 } else { 0 };
        let oneMonthAgo : Nat64 = if (now > 2592000_000_000_000) { now - 2592000_000_000_000 } else { 0 };
        
        let activeToday = countUniqueUsers(userActivityRecords, ?oneDayAgo, ?now);
        let activeThisWeek = countUniqueUsers(userActivityRecords, ?oneWeekAgo, ?now);
        let activeThisMonth = countUniqueUsers(userActivityRecords, ?oneMonthAgo, ?now);
        
        // Count new users
        var newToday : Nat = 0;
        var newThisWeek : Nat = 0;
        var newThisMonth : Nat = 0;
        
        for ((userId, firstSeen) in userFirstSeen.entries()) {
            if (firstSeen >= oneDayAgo) { newToday += 1 };
            if (firstSeen >= oneWeekAgo) { newThisWeek += 1 };
            if (firstSeen >= oneMonthAgo) { newThisMonth += 1 };
        };
        
        // Calculate averages
        let totalUsers = userFirstSeen.size();
        let totalActions = userActivityRecords.size();
        let avgActionsPerUser = if (totalUsers > 0) {
            Float.fromInt(totalActions) / Float.fromInt(totalUsers)
        } else { 0.0 };
        
        // Top users (simplified - count actions per user)
        let userActionCounts = HashMap.HashMap<Principal, Nat>(0, Principal.equal, Principal.hash);
        for (record in userActivityRecords.vals()) {
            let count = switch (userActionCounts.get(record.userId)) {
                case (?c) { c + 1 };
                case null { 1 };
            };
            userActionCounts.put(record.userId, count);
        };
        
        let topUsersArray = Array.sort<(Principal, Nat)>(
            Iter.toArray(userActionCounts.entries()),
            func(a, b) {
                if (a.1 > b.1) { #less } else if (a.1 < b.1) { #greater } else { #equal }
            }
        );
        
        let topUsers = if (topUsersArray.size() > 10) {
            Array.tabulate<(Principal, Nat)>(10, func(i) { topUsersArray[i] })
        } else {
            topUsersArray
        };
        
        {
            totalUsers = totalUsers;
            totalUsersAllTime = totalUsers;
            activeUsersToday = activeToday;
            activeUsersThisWeek = activeThisWeek;
            activeUsersThisMonth = activeThisMonth;
            newUsersToday = newToday;
            newUsersThisWeek = newThisWeek;
            newUsersThisMonth = newThisMonth;
            avgSessionsPerUser = 1.0; // Simplified
            avgActionsPerUser = avgActionsPerUser;
            topUsers = topUsers;
        }
    };
    
    /**
     * Calculate feature usage metrics
     */
    private func calculateFeatureMetrics(startDate: ?Nat64, endDate: ?Nat64) : AnalyticsTypes.FeatureMetrics {
        var projectsCreated : Nat = 0;
        var projectsDeployed : Nat = 0;
        var aiRequestsTotal : Nat = 0;
        var aiRequestsByClaude : Nat = 0;
        var aiRequestsByOpenAI : Nat = 0;
        var aiRequestsByGemini : Nat = 0;
        var aiRequestsByKimi : Nat = 0;
        var agentsDeployed : Nat = 0;
        var databaseQueries : Nat = 0;
        var filesStored : Nat = 0;
        var totalTokens : Nat = 0;
        var totalDurationMs : Nat = 0;
        var successCount : Nat = 0;
        
        let featureCounts = HashMap.HashMap<Text, Nat>(0, Text.equal, Text.hash);
        
        for (record in featureUsageRecords.vals()) {
            if (isWithinDateRange(record.timestamp, startDate, endDate)) {
                // Count by feature type
                switch (record.feature) {
                    case (#ProjectCreate) { projectsCreated += 1 };
                    case (#ProjectDeploy) { projectsDeployed += 1 };
                    case (#AIChat) { aiRequestsTotal += 1 };
                    case (#AgentWorkflow) { agentsDeployed += 1 };
                    case (#DatabaseInterface) { databaseQueries += 1 };
                    case (#FileStorage) { filesStored += 1 };
                    case (_) { };
                };
                
                // Count by AI model
                switch (record.aiModel) {
                    case (? #Claude) { aiRequestsByClaude += 1 };
                    case (? #OpenAI) { aiRequestsByOpenAI += 1 };
                    case (? #Gemini) { aiRequestsByGemini += 1 };
                    case (? #Kimi) { aiRequestsByKimi += 1 };
                    case null { };
                };
                
                // Aggregate tokens and duration
                switch (record.tokensConsumed) {
                    case (?tokens) { totalTokens += tokens };
                    case null { };
                };
                
                switch (record.durationMs) {
                    case (?duration) { totalDurationMs += duration };
                    case null { };
                };
                
                if (record.success) {
                    successCount += 1;
                };
            };
        };
        
        let totalRecords = featureUsageRecords.size();
        let avgTokensPerRequest = if (aiRequestsTotal > 0) {
            Float.fromInt(totalTokens) / Float.fromInt(aiRequestsTotal)
        } else { 0.0 };
        
        let avgDurationMs = if (totalRecords > 0) {
            Float.fromInt(totalDurationMs) / Float.fromInt(totalRecords)
        } else { 0.0 };
        
        let successRate = if (totalRecords > 0) {
            Float.fromInt(successCount) / Float.fromInt(totalRecords)
        } else { 0.0 };
        
        {
            totalFeatureUsage = totalRecords;
            projectsCreated = projectsCreated;
            projectsDeployed = projectsDeployed;
            aiRequestsTotal = aiRequestsTotal;
            aiRequestsByClaude = aiRequestsByClaude;
            aiRequestsByOpenAI = aiRequestsByOpenAI;
            aiRequestsByGemini = aiRequestsByGemini;
            aiRequestsByKimi = aiRequestsByKimi;
            agentsDeployed = agentsDeployed;
            databaseQueries = databaseQueries;
            filesStored = filesStored;
            avgTokensPerRequest = avgTokensPerRequest;
            avgDurationMs = avgDurationMs;
            successRate = successRate;
            mostUsedFeatures = []; // Simplified
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ANALYTICS SYSTEM - METRICS CALCULATION (Part 2 of 3)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Calculate revenue metrics
     */
    private func calculateRevenueMetrics(startDate: ?Nat64, endDate: ?Nat64) : AnalyticsTypes.RevenueMetrics {
        var totalRevenueCents : Nat = 0;
        var revenueFromSubscriptions : Nat = 0;
        var revenueFromCredits : Nat = 0;
        var revenueFromMarketplace : Nat = 0;
        var revenueByFree : Nat = 0;
        var revenueByStarter : Nat = 0;
        var revenueByPro : Nat = 0;
        var revenueByEnterprise : Nat = 0;
        
        let payingUsers = HashMap.HashMap<Principal, Bool>(0, Principal.equal, Principal.hash);
        let usersByTier = HashMap.HashMap<Text, Nat>(0, Text.equal, Text.hash);
        
        // Calculate MRR (Monthly Recurring Revenue) - subscriptions only
        var mrrCents : Nat = 0;
        let now = Nat64.fromNat(Int.abs(Time.now()));
        let oneMonthAgo : Nat64 = if (now > 2592000_000_000_000) { now - 2592000_000_000_000 } else { 0 };
        
        for (record in revenueRecords.vals()) {
            if (isWithinDateRange(record.timestamp, startDate, endDate)) {
                switch (record.status) {
                    case (#Succeeded) {
                        totalRevenueCents += record.amountCents;
                        
                        // Track paying users
                        payingUsers.put(record.userId, true);
                        
                        // By payment type
                        switch (record.paymentType) {
                            case (#Subscription) {
                                revenueFromSubscriptions += record.amountCents;
                                
                                // MRR calculation (if in last month)
                                if (record.timestamp >= oneMonthAgo) {
                                    mrrCents += record.amountCents;
                                };
                            };
                            case (#Credits) {
                                revenueFromCredits += record.amountCents;
                            };
                            case (#MarketplaceSale or #MarketplacePlatformFee) {
                                revenueFromMarketplace += record.amountCents;
                            };
                        };
                        
                        // By tier
                        switch (record.tier) {
                            case (?"free") { revenueByFree += record.amountCents };
                            case (?"starter") { revenueByStarter += record.amountCents };
                            case (?"pro") { revenueByPro += record.amountCents };
                            case (?"enterprise") { revenueByEnterprise += record.amountCents };
                            case (_) { };
                        };
                    };
                    case (_) { };
                };
            };
        };
        
        let arrCents = mrrCents * 12; // Annual Recurring Revenue
        
        let totalUsers = userFirstSeen.size();
        let avgRevenuePerUser = if (totalUsers > 0) {
            totalRevenueCents / totalUsers
        } else { 0 };
        
        // Simplified metrics (would need more data for accurate calculation)
        let churnRate = 0.0;
        let retentionRate = 1.0;
        let conversionRate = if (totalUsers > 0) {
            Float.fromInt(payingUsers.size()) / Float.fromInt(totalUsers)
        } else { 0.0 };
        
        let avgLifetimeValueCents = if (payingUsers.size() > 0) {
            totalRevenueCents / payingUsers.size()
        } else { 0 };
        
        {
            mrrCents = mrrCents;
            arrCents = arrCents;
            totalRevenueCents = totalRevenueCents;
            revenueFromSubscriptions = revenueFromSubscriptions;
            revenueFromCredits = revenueFromCredits;
            revenueFromMarketplace = revenueFromMarketplace;
            revenueByFree = revenueByFree;
            revenueByStarter = revenueByStarter;
            revenueByPro = revenueByPro;
            revenueByEnterprise = revenueByEnterprise;
            avgRevenuePerUser = avgRevenuePerUser;
            payingUsers = payingUsers.size();
            usersByFree = 0; // Would need subscription data
            usersByStarter = 0;
            usersByPro = 0;
            usersByEnterprise = 0;
            churnRate = churnRate;
            retentionRate = retentionRate;
            conversionRate = conversionRate;
            avgLifetimeValueCents = avgLifetimeValueCents;
        }
    };
    
    /**
     * Calculate marketplace metrics
     */
    private func calculateMarketplaceMetrics(startDate: ?Nat64, endDate: ?Nat64) : AnalyticsTypes.MarketplaceMetrics {
        var totalViews : Nat = 0;
        var totalSales : Nat = 0;
        var totalRevenueCents : Nat = 0;
        var platformFeesCollectedCents : Nat = 0;
        
        let now = Nat64.fromNat(Int.abs(Time.now()));
        let oneWeekAgo : Nat64 = if (now > 604800_000_000_000) { now - 604800_000_000_000 } else { 0 };
        let oneMonthAgo : Nat64 = if (now > 2592000_000_000_000) { now - 2592000_000_000_000 } else { 0 };
        
        var salesThisWeek : Nat = 0;
        var salesThisMonth : Nat = 0;
        
        let sellerSales = HashMap.HashMap<Principal, Nat>(0, Principal.equal, Principal.hash);
        let categoryListings = HashMap.HashMap<Text, Nat>(0, Text.equal, Text.hash);
        
        for (record in marketplaceRecords.vals()) {
            if (isWithinDateRange(record.timestamp, startDate, endDate)) {
                switch (record.action) {
                    case (#ListingViewed) {
                        totalViews += 1;
                    };
                    case (#ProjectSold) {
                        totalSales += 1;
                        
                        // Count sales by seller
                        let count = switch (sellerSales.get(record.sellerId)) {
                            case (?c) { c + 1 };
                            case null { 1 };
                        };
                        sellerSales.put(record.sellerId, count);
                        
                        // Revenue
                        switch (record.priceCents) {
                            case (?price) {
                                totalRevenueCents += price;
                                // Assume 10% platform fee
                                platformFeesCollectedCents += price / 10;
                            };
                            case null { };
                        };
                        
                        // Time-based counts
                        if (record.timestamp >= oneWeekAgo) {
                            salesThisWeek += 1;
                        };
                        if (record.timestamp >= oneMonthAgo) {
                            salesThisMonth += 1;
                        };
                    };
                    case (#ListingCreated) {
                        // Count by category
                        switch (record.category) {
                            case (?cat) {
                                let count = switch (categoryListings.get(cat)) {
                                    case (?c) { c + 1 };
                                    case null { 1 };
                                };
                                categoryListings.put(cat, count);
                            };
                            case null { };
                        };
                    };
                    case (_) { };
                };
            };
        };
        
        let avgSalePriceCents = if (totalSales > 0) {
            totalRevenueCents / totalSales
        } else { 0 };
        
        let conversionRate = if (totalViews > 0) {
            Float.fromInt(totalSales) / Float.fromInt(totalViews)
        } else { 0.0 };
        
        // Top sellers
        let topSellersArray = Array.sort<(Principal, Nat)>(
            Iter.toArray(sellerSales.entries()),
            func(a, b) {
                if (a.1 > b.1) { #less } else if (a.1 < b.1) { #greater } else { #equal }
            }
        );
        
        let topSellers = if (topSellersArray.size() > 10) {
            Array.tabulate<(Principal, Nat)>(10, func(i) { topSellersArray[i] })
        } else {
            topSellersArray
        };
        
        // Top categories
        let topCategoriesArray = Iter.toArray(categoryListings.entries());
        
        {
            totalListings = marketplaceListingsMap.size();
            activeListings = marketplaceListingsMap.size(); // Simplified
            totalSales = totalSales;
            totalRevenueCents = totalRevenueCents;
            platformFeesCollectedCents = platformFeesCollectedCents;
            avgSalePriceCents = avgSalePriceCents;
            totalViews = totalViews;
            conversionRate = conversionRate;
            topSellers = topSellers;
            topCategories = topCategoriesArray;
            salesThisWeek = salesThisWeek;
            salesThisMonth = salesThisMonth;
            avgTimeToPurchase = 0; // Would need more complex calculation
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ANALYTICS SYSTEM - METRICS CALCULATION (Part 3 of 3)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Calculate error metrics
     */
    private func calculateErrorMetrics(startDate: ?Nat64, endDate: ?Nat64) : AnalyticsTypes.ErrorMetrics {
        var totalErrors : Nat = 0;
        var unresolvedErrors : Nat = 0;
        var errorsByLow : Nat = 0;
        var errorsByMedium : Nat = 0;
        var errorsByHigh : Nat = 0;
        var errorsByCritical : Nat = 0;
        var errorsByDeployment : Nat = 0;
        var errorsByPayment : Nat = 0;
        var errorsByAPI : Nat = 0;
        var errorsByCanister : Nat = 0;
        var errorsByAuth : Nat = 0;
        var totalResolutionTimeMs : Nat = 0;
        var resolvedCount : Nat = 0;
        
        let now = Nat64.fromNat(Int.abs(Time.now()));
        let oneDayAgo : Nat64 = if (now > 86400_000_000_000) { now - 86400_000_000_000 } else { 0 };
        let oneWeekAgo : Nat64 = if (now > 604800_000_000_000) { now - 604800_000_000_000 } else { 0 };
        let oneMonthAgo : Nat64 = if (now > 2592000_000_000_000) { now - 2592000_000_000_000 } else { 0 };
        
        var errorsToday : Nat = 0;
        var errorsThisWeek : Nat = 0;
        var errorsThisMonth : Nat = 0;
        
        for (record in errorRecords.vals()) {
            if (isWithinDateRange(record.timestamp, startDate, endDate)) {
                totalErrors += 1;
                
                if (not record.resolved) {
                    unresolvedErrors += 1;
                };
                
                // By severity
                switch (record.severity) {
                    case (#Low) { errorsByLow += 1 };
                    case (#Medium) { errorsByMedium += 1 };
                    case (#High) { errorsByHigh += 1 };
                    case (#Critical) { errorsByCritical += 1 };
                };
                
                // By type
                switch (record.errorType) {
                    case (#DeploymentFailed) { errorsByDeployment += 1 };
                    case (#PaymentFailed) { errorsByPayment += 1 };
                    case (#APIError) { errorsByAPI += 1 };
                    case (#CanisterError) { errorsByCanister += 1 };
                    case (#AuthenticationError) { errorsByAuth += 1 };
                    case (_) { };
                };
                
                // Resolution time
                if (record.resolved) {
                    switch (record.resolvedAt) {
                        case (?resolvedTime) {
                            if (resolvedTime > record.timestamp) {
                                let resolutionTime = resolvedTime - record.timestamp;
                                totalResolutionTimeMs += Nat64.toNat(resolutionTime / 1_000_000); // Convert to ms
                                resolvedCount += 1;
                            };
                        };
                        case null { };
                    };
                };
                
                // Time-based counts
                if (record.timestamp >= oneDayAgo) {
                    errorsToday += 1;
                };
                if (record.timestamp >= oneWeekAgo) {
                    errorsThisWeek += 1;
                };
                if (record.timestamp >= oneMonthAgo) {
                    errorsThisMonth += 1;
                };
            };
        };
        
        let avgResolutionTimeMs = if (resolvedCount > 0) {
            totalResolutionTimeMs / resolvedCount
        } else { 0 };
        
        // Error rate (errors per 1000 operations)
        let totalOperations = featureUsageRecords.size();
        let errorRate = if (totalOperations > 0) {
            (Float.fromInt(totalErrors) / Float.fromInt(totalOperations)) * 1000.0
        } else { 0.0 };
        
        {
            totalErrors = totalErrors;
            unresolvedErrors = unresolvedErrors;
            errorsByLow = errorsByLow;
            errorsByMedium = errorsByMedium;
            errorsByHigh = errorsByHigh;
            errorsByCritical = errorsByCritical;
            errorsByDeployment = errorsByDeployment;
            errorsByPayment = errorsByPayment;
            errorsByAPI = errorsByAPI;
            errorsByCanister = errorsByCanister;
            errorsByAuth = errorsByAuth;
            errorRate = errorRate;
            avgResolutionTimeMs = avgResolutionTimeMs;
            errorsToday = errorsToday;
            errorsThisWeek = errorsThisWeek;
            errorsThisMonth = errorsThisMonth;
        }
    };
    
    /**
     * Calculate performance metrics
     */
    private func calculatePerformanceMetrics(startDate: ?Nat64, endDate: ?Nat64) : AnalyticsTypes.PerformanceMetrics {
        var totalOperations : Nat = 0;
        var totalDurationMs : Nat = 0;
        var successCount : Nat = 0;
        
        var deploymentTimes : [Nat] = [];
        var aiRequestTimes : [Nat] = [];
        var databaseQueryTimes : [Nat] = [];
        var fileUploadTimes : [Nat] = [];
        
        let durations = Buffer.Buffer<Nat>(0);
        
        for (record in performanceRecords.vals()) {
            if (isWithinDateRange(record.timestamp, startDate, endDate)) {
                totalOperations += 1;
                totalDurationMs += record.durationMs;
                durations.add(record.durationMs);
                
                if (record.success) {
                    successCount += 1;
                };
                
                // Collect by operation type
                switch (record.operation) {
                    case (#Deployment) {
                        deploymentTimes := Array.append<Nat>(deploymentTimes, [record.durationMs]);
                    };
                    case (#AIRequest) {
                        aiRequestTimes := Array.append<Nat>(aiRequestTimes, [record.durationMs]);
                    };
                    case (#DatabaseQuery) {
                        databaseQueryTimes := Array.append<Nat>(databaseQueryTimes, [record.durationMs]);
                    };
                    case (#FileUpload) {
                        fileUploadTimes := Array.append<Nat>(fileUploadTimes, [record.durationMs]);
                    };
                    case (_) { };
                };
            };
        };
        
        let avgResponseTimeMs = if (totalOperations > 0) {
            totalDurationMs / totalOperations
        } else { 0 };
        
        // Calculate percentiles (simplified - would need proper sorting)
        let durationsArray = Buffer.toArray(durations);
        let sortedDurations = Array.sort<Nat>(durationsArray, Nat.compare);
        
        let p95Index = (sortedDurations.size() * 95) / 100;
        let p99Index = (sortedDurations.size() * 99) / 100;
        
        let p95ResponseTimeMs = if (sortedDurations.size() > 0 and p95Index < sortedDurations.size()) {
            sortedDurations[p95Index]
        } else { 0 };
        
        let p99ResponseTimeMs = if (sortedDurations.size() > 0 and p99Index < sortedDurations.size()) {
            sortedDurations[p99Index]
        } else { 0 };
        
        let medianResponseTimeMs = if (sortedDurations.size() > 0) {
            sortedDurations[sortedDurations.size() / 2]
        } else { 0 };
        
        // Averages by operation type
        let avgDeploymentTimeMs = if (deploymentTimes.size() > 0) {
            Array.foldLeft<Nat, Nat>(deploymentTimes, 0, func(a, b) { a + b }) / deploymentTimes.size()
        } else { 0 };
        
        let avgAIRequestTimeMs = if (aiRequestTimes.size() > 0) {
            Array.foldLeft<Nat, Nat>(aiRequestTimes, 0, func(a, b) { a + b }) / aiRequestTimes.size()
        } else { 0 };
        
        let avgDatabaseQueryTimeMs = if (databaseQueryTimes.size() > 0) {
            Array.foldLeft<Nat, Nat>(databaseQueryTimes, 0, func(a, b) { a + b }) / databaseQueryTimes.size()
        } else { 0 };
        
        let avgFileUploadTimeMs = if (fileUploadTimes.size() > 0) {
            Array.foldLeft<Nat, Nat>(fileUploadTimes, 0, func(a, b) { a + b }) / fileUploadTimes.size()
        } else { 0 };
        
        let overallSuccessRate = if (totalOperations > 0) {
            Float.fromInt(successCount) / Float.fromInt(totalOperations)
        } else { 0.0 };
        
        {
            totalOperations = totalOperations;
            avgResponseTimeMs = avgResponseTimeMs;
            medianResponseTimeMs = medianResponseTimeMs;
            p95ResponseTimeMs = p95ResponseTimeMs;
            p99ResponseTimeMs = p99ResponseTimeMs;
            avgDeploymentTimeMs = avgDeploymentTimeMs;
            avgAIRequestTimeMs = avgAIRequestTimeMs;
            avgDatabaseQueryTimeMs = avgDatabaseQueryTimeMs;
            avgFileUploadTimeMs = avgFileUploadTimeMs;
            slowestOperations = []; // Simplified
            cacheHitRate = 0.0; // Would need cache tracking
            overallSuccessRate = overallSuccessRate;
        }
    };
    
    /**
     * Calculate system health metrics
     */
    private func calculateSystemHealthMetrics() : AnalyticsTypes.SystemHealthMetrics {
        let currentCycles = Cycles.balance();
        
        // Calculate burn rate from recent health records
        let cyclesBurnRatePerDay = if (systemHealthRecords.size() >= 2) {
            let recent = systemHealthRecords[systemHealthRecords.size() - 1];
            let previous = systemHealthRecords[systemHealthRecords.size() - 2];
            
            if (recent.timestamp > previous.timestamp and recent.cyclesBalance < previous.cyclesBalance) {
                let cyclesBurned : Nat = previous.cyclesBalance - recent.cyclesBalance;
                let timeDiffNat64 : Nat64 = recent.timestamp - previous.timestamp;
                let timeDiff : Nat = Nat64.toNat(timeDiffNat64);
                let dayInNanoseconds : Nat = 86400_000_000_000;
                
                if (timeDiff > 0) {
                    (cyclesBurned * dayInNanoseconds) / timeDiff
                } else { 0 : Nat }
            } else { 0 : Nat }
        } else { 0 : Nat };
        
        let estimatedDaysRemaining : Nat = if (cyclesBurnRatePerDay > 0) {
            currentCycles / cyclesBurnRatePerDay
        } else { 999 : Nat };
        
        // Determine health status
        let healthStatus : AnalyticsTypes.HealthStatus = if (estimatedDaysRemaining < 7) {
            #Critical
        } else if (estimatedDaysRemaining < 30) {
            #Warning
        } else {
            #Healthy
        };
        
        let alerts = Buffer.Buffer<Text>(0);
        if (estimatedDaysRemaining < 7) {
            alerts.add("Critical: Less than 7 days of cycles remaining!");
        };
        if (estimatedDaysRemaining < 30) {
            alerts.add("Warning: Less than 30 days of cycles remaining");
        };
        
        {
            currentCycles = currentCycles;
            cyclesBurnRatePerDay = cyclesBurnRatePerDay;
            estimatedDaysRemaining = estimatedDaysRemaining;
            memoryUsedBytes = 0; // Would need to track
            memoryCapacityBytes = 4_000_000_000; // 4GB typical
            memoryUtilizationPercent = 0.0;
            storageUsedBytes = 0; // Would calculate from stored data
            storageCapacityBytes = 8_000_000_000; // 8GB typical
            storageUtilizationPercent = 0.0;
            httpOutcallsToday = 0; // Would need to track
            httpOutcallsThisMonth = 0;
            activeUsers = 0; // Would calculate from recent activity
            totalUsers = userFirstSeen.size();
            healthStatus = healthStatus;
            alerts = Buffer.toArray(alerts);
            lastUpgradeTime = null; // Would track
            uptimePercent = 99.9; // Would calculate
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ANALYTICS SYSTEM - ADMIN QUERY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Get user activity metrics
     */
    public query(msg) func getUserActivityMetrics(
        timeWindow: AnalyticsTypes.TimeWindow
    ) : async Result.Result<AnalyticsTypes.UserMetrics, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        // Check cache
        let now = Nat64.fromNat(Int.abs(Time.now()));
        if (now - lastMetricsCacheUpdate < METRICS_CACHE_TTL) {
            switch (cachedUserMetrics) {
                case (?metrics) { return #ok(metrics) };
                case null { };
            };
        };
        
        let (startDate, endDate) = getTimeWindowBounds(timeWindow);
        let metrics = calculateUserMetrics(?startDate, ?endDate);
        
        cachedUserMetrics := ?metrics;
        lastMetricsCacheUpdate := now;
        
        #ok(metrics)
    };
    
    /**
     * Get feature usage metrics
     */
    public query(msg) func getFeatureUsageMetrics(
        timeWindow: AnalyticsTypes.TimeWindow
    ) : async Result.Result<AnalyticsTypes.FeatureMetrics, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        let (startDate, endDate) = getTimeWindowBounds(timeWindow);
        let metrics = calculateFeatureMetrics(?startDate, ?endDate);
        
        #ok(metrics)
    };
    
    /**
     * Get revenue metrics
     */
    public query(msg) func getRevenueMetrics(
        timeWindow: AnalyticsTypes.TimeWindow
    ) : async Result.Result<AnalyticsTypes.RevenueMetrics, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        let (startDate, endDate) = getTimeWindowBounds(timeWindow);
        let metrics = calculateRevenueMetrics(?startDate, ?endDate);
        
        #ok(metrics)
    };
    
    /**
     * Get marketplace metrics
     */
    public query(msg) func getMarketplaceMetrics(
        timeWindow: AnalyticsTypes.TimeWindow
    ) : async Result.Result<AnalyticsTypes.MarketplaceMetrics, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        let (startDate, endDate) = getTimeWindowBounds(timeWindow);
        let metrics = calculateMarketplaceMetrics(?startDate, ?endDate);
        
        #ok(metrics)
    };
    
    /**
     * Get error metrics
     */
    public query(msg) func getErrorMetrics(
        timeWindow: AnalyticsTypes.TimeWindow
    ) : async Result.Result<AnalyticsTypes.ErrorMetrics, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        let (startDate, endDate) = getTimeWindowBounds(timeWindow);
        let metrics = calculateErrorMetrics(?startDate, ?endDate);
        
        #ok(metrics)
    };
    
    /**
     * Get performance metrics
     */
    public query(msg) func getPerformanceMetrics(
        timeWindow: AnalyticsTypes.TimeWindow
    ) : async Result.Result<AnalyticsTypes.PerformanceMetrics, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        let (startDate, endDate) = getTimeWindowBounds(timeWindow);
        let metrics = calculatePerformanceMetrics(?startDate, ?endDate);
        
        #ok(metrics)
    };
    
    /**
     * Get system health metrics
     */
    public query(msg) func getSystemHealthMetrics() : async Result.Result<AnalyticsTypes.SystemHealthMetrics, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        let metrics = calculateSystemHealthMetrics();
        #ok(metrics)
    };
    
    /**
     * Get comprehensive dashboard data
     */
    public query(msg) func getDashboardData(
        timeWindow: AnalyticsTypes.TimeWindow
    ) : async Result.Result<AnalyticsTypes.DashboardData, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin access required");
        };
        
        let (startDate, endDate) = getTimeWindowBounds(timeWindow);
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        let dashboard: AnalyticsTypes.DashboardData = {
            userActivity = calculateUserMetrics(?startDate, ?endDate);
            featureUsage = calculateFeatureMetrics(?startDate, ?endDate);
            revenue = calculateRevenueMetrics(?startDate, ?endDate);
            marketplace = calculateMarketplaceMetrics(?startDate, ?endDate);
            errors = calculateErrorMetrics(?startDate, ?endDate);
            performance = calculatePerformanceMetrics(?startDate, ?endDate);
            systemHealth = calculateSystemHealthMetrics();
            generatedAt = now;
        };
        
        #ok(dashboard)
    };
    
    /**
     * Clear analytics cache (admin only)
     */
    public shared(msg) func clearAnalyticsCache() : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        cachedUserMetrics := null;
        cachedFeatureMetrics := null;
        cachedRevenueMetrics := null;
        cachedMarketplaceMetrics := null;
        cachedErrorMetrics := null;
        cachedPerformanceMetrics := null;
        lastMetricsCacheUpdate := 0;
        
        #ok(())
    };
    
    /**
     * Get analytics data counts (for debugging)
     */
    public query(msg) func getAnalyticsDataCounts() : async Result.Result<{
        userActivityRecords: Nat;
        featureUsageRecords: Nat;
        revenueRecords: Nat;
        marketplaceRecords: Nat;
        errorRecords: Nat;
        performanceRecords: Nat;
        systemHealthRecords: Nat;
        totalUsers: Nat;
    }, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        #ok({
            userActivityRecords = userActivityRecords.size();
            featureUsageRecords = featureUsageRecords.size();
            revenueRecords = revenueRecords.size();
            marketplaceRecords = marketplaceRecords.size();
            errorRecords = errorRecords.size();
            performanceRecords = performanceRecords.size();
            systemHealthRecords = systemHealthRecords.size();
            totalUsers = userFirstSeen.size();
        })
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FINANCIAL ANALYTICS - TREASURY MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Calculate AI Token Reserve
     * Shows how much $ needed in Claude API account
     */
    public query(msg) func calculateAITokenReserve() : async Result.Result<FinancialAnalyticsTypes.AITokenReserve, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        // Calculate total credits remaining across all users
        var totalCreditsRemaining : Nat = 0;
        for ((_, credits) in userCredits.entries()) {
            totalCreditsRemaining += credits;
        };
        
        // Calculate max tokens needed
        let maxTokens = Float.fromInt(totalCreditsRemaining) * AVG_TOKENS_PER_CREDIT;
        
        // Calculate costs (80% input, 20% output)
        let inputCost = (maxTokens * 0.8 * CLAUDE_INPUT_COST_PER_MILLION) / 1_000_000.0;
        let outputCost = (maxTokens * 0.2 * CLAUDE_OUTPUT_COST_PER_MILLION) / 1_000_000.0;
        let requiredBalance = inputCost + outputCost;
        
        // Calculate metrics
        let shortfall = requiredBalance - currentClaudeBalanceUSD;
        let reserveRatio = if (requiredBalance > 0.0) {
            currentClaudeBalanceUSD / requiredBalance
        } else { 999.0 };
        
        // Estimate days of reserve (simplified - would track historical usage)
        let daysOfReserve = if (requiredBalance > 0.0) {
            Int.abs(Float.toInt((currentClaudeBalanceUSD / requiredBalance) * 90.0))
        } else { 999 };
        
        #ok({
            totalCreditsRemaining = totalCreditsRemaining;
            claudeInputCostPerMillion = CLAUDE_INPUT_COST_PER_MILLION;
            claudeOutputCostPerMillion = CLAUDE_OUTPUT_COST_PER_MILLION;
            avgTokensPerCredit = AVG_TOKENS_PER_CREDIT;
            maxPotentialAICostUSD = requiredBalance;
            requiredClaudeBalance = requiredBalance;
            currentClaudeBalance = currentClaudeBalanceUSD;
            shortfallUSD = shortfall;
            reserveRatio = reserveRatio;
            daysOfReserve = daysOfReserve;
            lastCalculated = Nat64.fromNat(Int.abs(Time.now()));
        })
    };
    
    /**
     * Calculate ICP Reserve
     * Shows how much ICP needed in platform wallet
     */
    public shared(msg) func calculateICPReserve() : async Result.Result<FinancialAnalyticsTypes.ICPReserve, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        // Calculate total credits remaining
        var totalCreditsRemaining : Nat = 0;
        for ((_, credits) in userCredits.entries()) {
            totalCreditsRemaining += credits;
        };
        
        // Fetch or use cached XDR rate
        let xdrRate = await getXDRRate();
        
        // Calculate USD value of credits
        let creditsValueUSD = Float.fromInt(totalCreditsRemaining) * CREDIT_USD_VALUE;
        
        // Convert to XDR
        let xdrNeeded = creditsValueUSD / xdrRate.usdPerXDR;
        
        // Convert to cycles (1 XDR = 1 Trillion cycles)
        let cyclesNeeded = Int.abs(Float.toInt(xdrNeeded * 1_000_000_000_000.0));
        
        // Convert to ICP
        let icpNeeded = xdrNeeded / xdrRate.icpPerXDR;
        let usdNeeded = icpNeeded * (xdrRate.usdPerXDR / xdrRate.icpPerXDR);
        
        // Calculate shortfall
        let shortfallICP = icpNeeded - currentICPBalance;
        let shortfallUSD = shortfallICP * (xdrRate.usdPerXDR / xdrRate.icpPerXDR);
        
        // Calculate reserve ratio
        let reserveRatio = if (icpNeeded > 0.0) {
            currentICPBalance / icpNeeded
        } else { 999.0 };
        
        // Estimate days of reserve
        let daysOfReserve = if (icpNeeded > 0.0) {
            Int.abs(Float.toInt((currentICPBalance / icpNeeded) * 90.0))
        } else { 999 };
        
        #ok({
            totalCreditsRemaining = totalCreditsRemaining;
            xdrRate = xdrRate;
            cyclesPerTrillion = 1_000_000_000_000;
            maxPotentialCyclesNeeded = cyclesNeeded;
            maxPotentialXDRNeeded = xdrNeeded;
            maxPotentialICPNeeded = icpNeeded;
            maxPotentialUSDNeeded = usdNeeded;
            currentICPBalance = currentICPBalance;
            currentUSDValue = currentICPBalance * (xdrRate.usdPerXDR / xdrRate.icpPerXDR);
            reserveRatio = reserveRatio;
            shortfallICP = shortfallICP;
            shortfallUSD = shortfallUSD;
            daysOfReserve = daysOfReserve;
            lastCalculated = Nat64.fromNat(Int.abs(Time.now()));
        })
    };
    
    /**
     * Get or fetch XDR rate (with caching)
     */
    private func getXDRRate() : async FinancialAnalyticsTypes.XDRRate {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        
        // Check cache
        switch (cachedXDRRate) {
            case (?rate) {
                if (now - lastXDRRateUpdate < XDR_RATE_CACHE_TTL) {
                    return rate;
                };
            };
            case null { };
        };
        
        // Fetch new rate (would use HTTP outcall in production)
        // For now, use hardcoded values
        let newRate : FinancialAnalyticsTypes.XDRRate = {
            usdPerXDR = 1.37;
            icpPerXDR = 0.7; // Example: 1 ICP = 0.7 XDR
            lastUpdated = now;
        };
        
        cachedXDRRate := ?newRate;
        lastXDRRateUpdate := now;
        
        newRate
    };
    
    /**
     * Update current balances (admin only)
     */
    public shared(msg) func updateCurrentBalances(
        claudeBalanceUSD: Float,
        icpBalance: Float
    ) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        currentClaudeBalanceUSD := claudeBalanceUSD;
        currentICPBalance := icpBalance;
        
        #ok(())
    };
    
    /**
     * Get subscription allocations
     */
    public query func getSubscriptionAllocations() : async [FinancialAnalyticsTypes.SubscriptionAllocation] {
        [
            {
                tier = "starter";
                monthlyPriceCents = 2900;
                icpFundingPercent = 40.0;
                aiFundingPercent = 35.0;
                platformRevenuePercent = 25.0;
                icpFundingUSD = 11.60;
                aiFundingUSD = 10.15;
                platformRevenueUSD = 7.25;
                rationale = "New users deploy more, need cycles";
            },
            {
                tier = "pro";
                monthlyPriceCents = 4900;
                icpFundingPercent = 30.0;
                aiFundingPercent = 45.0;
                platformRevenuePercent = 25.0;
                icpFundingUSD = 14.70;
                aiFundingUSD = 22.05;
                platformRevenueUSD = 12.25;
                rationale = "Power users use more AI";
            },
            {
                tier = "enterprise";
                monthlyPriceCents = 9900;
                icpFundingPercent = 35.0;
                aiFundingPercent = 40.0;
                platformRevenuePercent = 25.0;
                icpFundingUSD = 34.65;
                aiFundingUSD = 39.60;
                platformRevenueUSD = 24.75;
                rationale = "Balanced heavy usage";
            }
        ]
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FINANCIAL ANALYTICS - DOMAIN TRACKING
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Track domain purchase
     */
    public shared(msg) func trackDomainPurchase(
        domainName: Text,
        domainType: FinancialAnalyticsTypes.DomainType,
        costCents: Nat,
        provider: Text
    ) : async Result.Result<Nat, Text> {
        let now = Nat64.fromNat(Int.abs(Time.now()));
        let oneYear = 31536000_000_000_000 : Nat64; // 1 year in nanoseconds
        
        let purchase : FinancialAnalyticsTypes.DomainPurchase = {
            id = nextDomainId;
            userId = msg.caller;
            domainName = domainName;
            domainType = domainType;
            costCents = costCents;
            provider = provider;
            timestamp = now;
            renewalDate = ?(now + oneYear);
            autoRenew = true;
        };
        
        domainPurchases := Array.append(domainPurchases, [purchase]);
        let purchaseId = nextDomainId;
        nextDomainId += 1;
        
        #ok(purchaseId)
    };
    
    /**
     * Get domain statistics
     */
    public query(msg) func getDomainStatistics() : async Result.Result<FinancialAnalyticsTypes.DomainStatistics, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        var totalCost : Nat = 0;
        var purchasesThisMonth : Nat = 0;
        
        let now = Nat64.fromNat(Int.abs(Time.now()));
        let oneMonthAgo : Nat64 = if (now > 2592000_000_000_000) { 
            now - 2592000_000_000_000 
        } else { 0 };
        
        for (purchase in domainPurchases.vals()) {
            totalCost += purchase.costCents;
            
            if (purchase.timestamp >= oneMonthAgo) {
                purchasesThisMonth += 1;
            };
        };
        
        // Calculate average and forecast
        let avgPerMonth = if (domainPurchases.size() > 0) {
            Float.fromInt(purchasesThisMonth)
        } else { 0.0 };
        
        let avgCost = if (domainPurchases.size() > 0) {
            totalCost / domainPurchases.size()
        } else { 0 };
        
        let forecastedMonthlyCost = Int.abs(Float.toInt(avgPerMonth * Float.fromInt(avgCost)));
        
        // Calculate renewals in next 30 days
        let thirtyDaysFromNow = now + 2592000_000_000_000;
        var renewalsNext30 : Nat = 0;
        var renewalCost : Nat = 0;
        
        for (purchase in domainPurchases.vals()) {
            switch (purchase.renewalDate) {
                case (?renewal) {
                    if (renewal >= now and renewal <= thirtyDaysFromNow) {
                        renewalsNext30 += 1;
                        renewalCost += purchase.costCents;
                    };
                };
                case null { };
            };
        };
        
        // Recommended NameSilo balance (3 months of forecasted purchases)
        let requiredBalance = Float.fromInt(forecastedMonthlyCost * 3) / 100.0;
        
        #ok({
            totalDomainsPurchased = domainPurchases.size();
            domainsByType = []; // Simplified for now
            totalCostCents = totalCost;
            avgCostPerDomainCents = avgCost;
            purchasesThisMonth = purchasesThisMonth;
            avgPurchasesPerMonth = avgPerMonth;
            forecastedMonthlyCostCents = forecastedMonthlyCost;
            requiredNameSiloBalanceUSD = requiredBalance;
            renewalsNext30Days = renewalsNext30;
            renewalCostNext30DaysCents = renewalCost;
        })
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FINANCIAL ANALYTICS - TEAM MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Add team member
     */
    public shared(msg) func addTeamMember(
        name: Text,
        role: Text,
        revenueSharePercent: Float,
        subscriptionShare: Bool,
        creditCommissionShare: Bool,
        marketplaceShare: Bool
    ) : async Result.Result<Nat, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        let member : FinancialAnalyticsTypes.TeamMember = {
            id = nextTeamMemberId;
            name = name;
            role = role;
            revenueSharePercent = revenueSharePercent;
            subscriptionShare = subscriptionShare;
            creditCommissionShare = creditCommissionShare;
            marketplaceShare = marketplaceShare;
            active = true;
            addedAt = Nat64.fromNat(Int.abs(Time.now()));
        };
        
        teamMembers := Array.append(teamMembers, [member]);
        let memberId = nextTeamMemberId;
        nextTeamMemberId += 1;
        
        #ok(memberId)
    };
    
    /**
     * Get team members
     */
    public query(msg) func getTeamMembers() : async Result.Result<[FinancialAnalyticsTypes.TeamMember], Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        #ok(teamMembers)
    };
    
    /**
     * Update team member
     */
    public shared(msg) func updateTeamMember(
        memberId: Nat,
        revenueSharePercent: ?Float,
        active: ?Bool
    ) : async Result.Result<(), Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        teamMembers := Array.map<FinancialAnalyticsTypes.TeamMember, FinancialAnalyticsTypes.TeamMember>(
            teamMembers,
            func(member) {
                if (member.id == memberId) {
                    {
                        member with
                        revenueSharePercent = switch (revenueSharePercent) {
                            case (?percent) { percent };
                            case null { member.revenueSharePercent };
                        };
                        active = switch (active) {
                            case (?isActive) { isActive };
                            case null { member.active };
                        };
                    }
                } else {
                    member
                }
            }
        );
        
        #ok(())
    };
    
    /**
     * Calculate team earnings
     */
    public query(msg) func calculateTeamEarnings() : async Result.Result<FinancialAnalyticsTypes.TeamEarningsReport, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        // Calculate revenue from last 30 days
        let now = Nat64.fromNat(Int.abs(Time.now()));
        let oneMonthAgo : Nat64 = if (now > 2592000_000_000_000) { 
            now - 2592000_000_000_000 
        } else { 0 };
        
        var subscriptionRevenue : Nat = 0;
        var creditCommission : Nat = 0;
        var marketplaceRevenue : Nat = 0;
        
        // Sum revenue from financial revenue records
        for (record in financialRevenueRecords.vals()) {
            if (record.timestamp >= oneMonthAgo) {
                switch (record.source) {
                    case (#Subscription) {
                        subscriptionRevenue += record.amountCents;
                    };
                    case (#CreditConsumption) {
                        creditCommission += record.commissionCents;
                    };
                    case (#MarketplaceCommission) {
                        marketplaceRevenue += record.commissionCents;
                    };
                    case (_) { };
                };
            };
        };
        
        let totalRevenue = subscriptionRevenue + creditCommission + marketplaceRevenue;
        
        // Calculate each team member's earnings
        let memberEarningsBuffer = Buffer.Buffer<FinancialAnalyticsTypes.TeamMemberEarnings>(0);
        var totalTeamPayouts : Nat = 0;
        
        for (member in teamMembers.vals()) {
            if (member.active) {
                var earnings : Nat = 0;
                var subEarnings : Nat = 0;
                var creditEarnings : Nat = 0;
                var marketEarnings : Nat = 0;
                
                if (member.subscriptionShare) {
                    subEarnings := Int.abs(Float.toInt(
                        Float.fromInt(subscriptionRevenue) * member.revenueSharePercent / 100.0
                    ));
                    earnings += subEarnings;
                };
                
                if (member.creditCommissionShare) {
                    creditEarnings := Int.abs(Float.toInt(
                        Float.fromInt(creditCommission) * member.revenueSharePercent / 100.0
                    ));
                    earnings += creditEarnings;
                };
                
                if (member.marketplaceShare) {
                    marketEarnings := Int.abs(Float.toInt(
                        Float.fromInt(marketplaceRevenue) * member.revenueSharePercent / 100.0
                    ));
                    earnings += marketEarnings;
                };
                
                totalTeamPayouts += earnings;
                
                memberEarningsBuffer.add({
                    memberId = member.id;
                    memberName = member.name;
                    revenueSharePercent = member.revenueSharePercent;
                    subscriptionEarnings = subEarnings;
                    creditCommissionEarnings = creditEarnings;
                    marketplaceEarnings = marketEarnings;
                    totalEarnings = earnings;
                    earningsThisMonth = earnings;
                    earningsLastMonth = 0; // Would track historically
                    earningsAllTime = 0; // Would calculate from all time
                    calculatedAt = now;
                });
            };
        };
        
        #ok({
            totalPlatformRevenue = totalRevenue;
            totalTeamPayouts = totalTeamPayouts;
            platformRetainedRevenue = if (totalRevenue >= totalTeamPayouts) {
                totalRevenue - totalTeamPayouts
            } else { 0 };
            memberEarnings = Buffer.toArray(memberEarningsBuffer);
            generatedAt = now;
        })
    };
    
    /**
     * Get credit commission percentage
     */
    public query func getCreditCommissionPercent() : async Float {
        CREDIT_COMMISSION_PERCENT
    };
    
    /**
     * Track credit commission revenue (20% markup)
     */
    public shared(msg) func trackCreditCommission(
        userId: Principal,
        baseCostCredits: Nat,
        commissionCredits: Nat
    ) : async () {
        let record : FinancialAnalyticsTypes.RevenueRecord = {
            id = nextFinancialRevenueId;
            userId = userId;
            source = #CreditConsumption;
            amountCents = commissionCredits; // Commission in cents
            commissionCents = commissionCredits;
            netAmountCents = baseCostCredits + commissionCredits;
            timestamp = Nat64.fromNat(Int.abs(Time.now()));
        };
        
        financialRevenueRecords := Array.append(financialRevenueRecords, [record]);
        nextFinancialRevenueId += 1;
    };
    
    /**
     * Get complete financial dashboard
     */
    public shared(msg) func getFinancialDashboard() : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        // This is a simplified version - full implementation would return structured data
        let aiReserve = switch (await calculateAITokenReserve()) {
            case (#ok(reserve)) { reserve };
            case (#err(_)) { 
                // Return default if error
                {
                    totalCreditsRemaining = 0;
                    claudeInputCostPerMillion = CLAUDE_INPUT_COST_PER_MILLION;
                    claudeOutputCostPerMillion = CLAUDE_OUTPUT_COST_PER_MILLION;
                    avgTokensPerCredit = AVG_TOKENS_PER_CREDIT;
                    maxPotentialAICostUSD = 0.0;
                    requiredClaudeBalance = 0.0;
                    currentClaudeBalance = 0.0;
                    shortfallUSD = 0.0;
                    reserveRatio = 0.0;
                    daysOfReserve = 0;
                    lastCalculated = 0;
                }
            };
        };
        
        #ok("Financial dashboard data retrieved - see individual endpoints for details")
    };

    // ===============================
    // NOTIFICATION SYSTEM (Pull-based - FREE Query Calls)
    // ===============================

    /**
     * Create a new platform notification (Admin only)
     */
    public shared(msg) func createNotification(
        severity: NotificationTypes.NotificationSeverity,
        category: NotificationTypes.NotificationCategory,
        audience: NotificationTypes.NotificationAudience,
        title: Text,
        message: Text,
        icon: ?Text,
        metadata: ?[(Text, Text)],
        actions: ?[NotificationTypes.NotificationAction],
        expiresAt: ?Nat64,
        isPinned: Bool
    ) : async Result.Result<Nat, Text> {
        // Verify admin access
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        try {
            let notificationId = notificationManager.createNotification(
                severity,
                category,
                audience,
                title,
                message,
                icon,
                metadata,
                actions,
                expiresAt,
                msg.caller,
                isPinned
            );

            logger.info("Notification created: ID=" # Nat.toText(notificationId) # " by " # Principal.toText(msg.caller));
            #ok(notificationId)
        } catch (e) {
            logger.error("Failed to create notification: " # Error.message(e));
            #err("Failed to create notification: " # Error.message(e))
        };
    };

    /**
     * Get notifications for the current user (Query - FREE)
     */
    public query(msg) func getNotifications(
        since: Nat64,
        limit: ?Nat
    ) : async [NotificationTypes.NotificationEvent] {
        // Get user's subscription tier
        let userTier = switch (subscriptionCache.get(msg.caller)) {
            case (?cached) { ?cached.tier };
            case (null) { ?"free" };
        };

        // Get user's registration date
        let userCreatedAt = switch (userFirstSeen.get(msg.caller)) {
            case (?timestamp) { timestamp };
            case (null) {
                // Default to current time if not found
                let now = Nat64.fromNat(Int.abs(Time.now()));
                now
            };
        };

        // Last active is now (since they're querying)
        let now = Nat64.fromNat(Int.abs(Time.now()));

        notificationManager.getNotificationsForUser(
            msg.caller,
            since,
            userTier,
            userCreatedAt,
            now,
            limit
        )
    };

    /**
     * Get unread notification count (Query - FREE)
     */
    public query(msg) func getUnreadNotificationCount() : async Nat {
        // Get user's subscription tier
        let userTier = switch (subscriptionCache.get(msg.caller)) {
            case (?cached) { ?cached.tier };
            case (null) { ?"free" };
        };

        // Get user's registration date
        let userCreatedAt = switch (userFirstSeen.get(msg.caller)) {
            case (?timestamp) { timestamp };
            case (null) {
                let now = Nat64.fromNat(Int.abs(Time.now()));
                now
            };
        };

        let now = Nat64.fromNat(Int.abs(Time.now()));

        notificationManager.getUnreadCount(
            msg.caller,
            userTier,
            userCreatedAt,
            now
        )
    };

    /**
     * Mark notifications as read
     */
    public shared(msg) func markNotificationsAsRead(timestamp: Nat64) : async () {
        notificationManager.markAsRead(msg.caller, timestamp);
        logger.info("Notifications marked as read for user " # Principal.toText(msg.caller));
    };

    /**
     * Dismiss a specific notification
     */
    public shared(msg) func dismissNotification(notificationId: Nat) : async () {
        notificationManager.dismissNotification(msg.caller, notificationId);
        logger.info("Notification " # Nat.toText(notificationId) # " dismissed by user " # Principal.toText(msg.caller));
    };

    /**
     * Get all notifications (Admin only)
     */
    public query(msg) func getAllNotifications() : async Result.Result<[NotificationTypes.NotificationEvent], Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        #ok(notificationManager.getAllNotifications())
    };

    /**
     * Get notification statistics (Admin only)
     */
    public query(msg) func getNotificationStats() : async Result.Result<NotificationTypes.NotificationStats, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        #ok(notificationManager.getStats())
    };

    /**
     * Delete a specific notification (Admin only)
     */
    public shared(msg) func deleteNotification(notificationId: Nat) : async Result.Result<Bool, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let deleted = notificationManager.deleteNotification(notificationId);
        if (deleted) {
            logger.info("Notification " # Nat.toText(notificationId) # " deleted by admin " # Principal.toText(msg.caller));
            #ok(true)
        } else {
            #err("Notification not found")
        }
    };

    /**
     * Prune old notifications (Admin only)
     */
    public shared(msg) func pruneOldNotifications() : async Result.Result<Nat, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let pruned = notificationManager.pruneOldNotifications();
        logger.info(Nat.toText(pruned) # " old notifications pruned by admin " # Principal.toText(msg.caller));
        #ok(pruned)
    };

    // ===============================
    // CANISTER POOL MANAGEMENT (Admin Only)
    // ===============================

    /**
     * Add a user canister to the pool
     */
    public shared(msg) func addUserCanisterToPool(
        canisterId: Principal,
        memoryGB: Nat,
        durationDays: Nat,
        metadata: ?[(Text, Text)]
    ) : async Result.Result<Bool, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let added = poolManager.addUserCanisterToPool(canisterId, memoryGB, durationDays, metadata);
        if (added) {
            logger.info("User canister " # Principal.toText(canisterId) # " added to pool by admin " # Principal.toText(msg.caller));
            #ok(true)
        } else {
            #err("Failed to add user canister to pool")
        }
    };

    /**
     * Add a server pair to the pool
     */
    public shared(msg) func addServerPairToPool(
        pairId: Text,
        frontendCanisterId: Principal,
        backendCanisterId: Principal,
        poolType: PoolTypes.CanisterPoolType,
        metadata: ?[(Text, Text)]
    ) : async Result.Result<Bool, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let added = poolManager.addServerPairToPool(pairId, frontendCanisterId, backendCanisterId, poolType, metadata);
        if (added) {
            logger.info("Server pair " # pairId # " added to pool by admin " # Principal.toText(msg.caller));
            #ok(true)
        } else {
            #err("Failed to add server pair to pool")
        }
    };

    /**
     * Get an available user canister from the pool (for user creation flow)
     */
    public shared func getAvailableUserCanisterFromPool() : async ?PoolTypes.PooledCanister {
        poolManager.getAvailableUserCanister()
    };

    /**
     * Get an available server pair from the pool (for server pair creation flow)
     */
    public shared func getAvailableServerPairFromPool(poolType: PoolTypes.CanisterPoolType) : async ?PoolTypes.PooledServerPair {
        poolManager.getAvailableServerPair(poolType)
    };

    /**
     * Assign a pooled user canister to a user
     */
    public shared func assignUserCanisterFromPool(
        canisterId: Principal,
        userPrincipal: Principal
    ) : async Result.Result<Bool, Text> {
        let assigned = poolManager.assignUserCanister(canisterId, userPrincipal);
        if (assigned) {
            logger.info("Pool user canister " # Principal.toText(canisterId) # " assigned to " # Principal.toText(userPrincipal));
            
            // Also add to the user platform canisters mapping
            userPlatformCanisters.put(userPrincipal, canisterId);
            let now = Int.abs(Time.now());
            userCreationMap.put(userPrincipal, now);
            
            #ok(true)
        } else {
            #err("Failed to assign user canister from pool")
        }
    };

    /**
     * Assign a pooled server pair to a user
     */
    public shared func assignServerPairFromPool(
        pairId: Text,
        userPrincipal: Principal
    ) : async Result.Result<Bool, Text> {
        let assigned = poolManager.assignServerPair(pairId, userPrincipal);
        if (assigned) {
            logger.info("Pool server pair " # pairId # " assigned to " # Principal.toText(userPrincipal));
            #ok(true)
        } else {
            #err("Failed to assign server pair from pool")
        }
    };

    /**
     * Remove a user canister from the pool
     */
    public shared(msg) func removeUserCanisterFromPool(canisterId: Principal) : async Result.Result<Bool, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let removed = poolManager.removeUserCanisterFromPool(canisterId);
        if (removed) {
            logger.info("User canister " # Principal.toText(canisterId) # " removed from pool by admin " # Principal.toText(msg.caller));
            #ok(true)
        } else {
            #err("Canister not found in pool")
        }
    };

    /**
     * Remove a server pair from the pool
     */
    public shared(msg) func removeServerPairFromPool(pairId: Text) : async Result.Result<Bool, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let removed = poolManager.removeServerPairFromPool(pairId);
        if (removed) {
            logger.info("Server pair " # pairId # " removed from pool by admin " # Principal.toText(msg.caller));
            #ok(true)
        } else {
            #err("Server pair not found in pool")
        }
    };

    /**
     * Get pool statistics
     */
    public query(msg) func getPoolStats(poolType: PoolTypes.CanisterPoolType) : async Result.Result<PoolTypes.PoolStats, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        #ok(poolManager.getPoolStats(poolType))
    };

    /**
     * Get all user canisters in pool
     */
    public query(msg) func getAllPooledUserCanisters() : async Result.Result<[PoolTypes.PooledCanister], Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        #ok(poolManager.getAllUserCanisters())
    };

    /**
     * Get all server pairs in pool
     */
    public query(msg) func getAllPooledServerPairs(poolType: ?PoolTypes.CanisterPoolType) : async Result.Result<[PoolTypes.PooledServerPair], Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        #ok(poolManager.getAllServerPairs(poolType))
    };

    /**
     * Update user canister cycle balance in pool
     */
    public shared(msg) func updatePooledUserCanisterCycles(canisterId: Principal, cycles: Nat) : async Result.Result<Bool, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        poolManager.updateUserCanisterCycles(canisterId, cycles);
        #ok(true)
    };

    /**
     * Update server pair cycle balances in pool
     */
    public shared(msg) func updatePooledServerPairCycles(
        pairId: Text,
        frontendCycles: Nat,
        backendCycles: Nat
    ) : async Result.Result<Bool, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        poolManager.updateServerPairCycles(pairId, frontendCycles, backendCycles);
        #ok(true)
    };

    // ===============================
    // USER CANISTER ADMIN MANAGEMENT (Admin Only)
    // ===============================

    /**
     * Get user canister information for admin troubleshooting
     */
    public shared(msg) func getUserCanisterInfo(userPrincipal: Principal) : async Result.Result<PoolTypes.UserCanisterInfo, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        switch (userPlatformCanisters.get(userPrincipal)) {
            case (?userCanisterId) {
                try {
                    let canisterActor: actor {
                        canister_status: shared { canister_id: Principal } -> async {
                            status: { #running; #stopping; #stopped };
                            settings: {
                                controllers: [Principal];
                                compute_allocation: Nat;
                                memory_allocation: Nat;
                                freezing_threshold: Nat;
                            };
                            module_hash: ?Blob;
                            memory_size: Nat;
                            cycles: Nat;
                            idle_cycles_burned_per_day: Nat;
                        };
                    } = actor("aaaaa-aa");

                    let status = await canisterActor.canister_status({ canister_id = userCanisterId });
                    
                    let statusText = switch (status.status) {
                        case (#running) { "running" };
                        case (#stopping) { "stopping" };
                        case (#stopped) { "stopped" };
                    };

                    let createdAt : Nat64 = switch (userCreationMap.get(userPrincipal)) {
                        case (?timestamp) { Nat64.fromIntWrap(timestamp) };
                        case null { 0 };
                    };

                    let info: PoolTypes.UserCanisterInfo = {
                        userPrincipal = userPrincipal;
                        userCanisterId = userCanisterId;
                        cycleBalance = status.cycles;
                        memorySize = status.memory_size;
                        createdAt = createdAt;
                        lastTopup = null; // Could track this if needed
                        totalTopups = 0; // Could track this if needed
                        controllers = status.settings.controllers;
                        status = statusText;
                    };

                    logger.info("Admin " # Principal.toText(msg.caller) # " retrieved info for user canister " # Principal.toText(userCanisterId));
                    #ok(info)
                } catch (e) {
                    #err("Failed to get canister info: " # Error.message(e))
                }
            };
            case null {
                #err("User canister not found for principal: " # Principal.toText(userPrincipal))
            };
        };
    };

    /**
     * Top up a user's canister (Admin only - for support/troubleshooting)
     */
    public shared(msg) func adminTopUpUserCanister(
        userPrincipal: Principal,
        icpE8s: Nat
    ) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        switch (userPlatformCanisters.get(userPrincipal)) {
            case (?userCanisterId) {
                logger.info("ADMIN_TOPUP: Admin " # Principal.toText(msg.caller) # " topping up user canister " # Principal.toText(userCanisterId) # " with " # Nat.toText(icpE8s) # " e8s");
                
                // Use the existing topUpCanisterCMC function
                let result = await topUpCanisterCMC(userCanisterId, icpE8s);
                
                switch (result) {
                    case (#ok(msg_)) {
                        let successMsg = "Admin successfully topped up user canister with " # Nat.toText(icpE8s) # " e8s: " # msg_;
                        logger.info("ADMIN_TOPUP_SUCCESS: " # successMsg);
                        #ok(successMsg)
                    };
                    case (#err(e)) {
                        logger.error("ADMIN_TOPUP_FAILED: " # e);
                        #err("Admin top-up failed: " # e)
                    };
                }
            };
            case null {
                #err("User canister not found for principal: " # Principal.toText(userPrincipal))
            };
        };
    };

    /**
     * Replace a user's canister with a new one (Admin only - for critical issues)
     * Note: This is a placeholder - actual implementation would need data migration logic
     */
    public shared(msg) func adminReplaceUserCanister(
        userPrincipal: Principal,
        newCanisterId: Principal,
        reason: Text
    ) : async Result.Result<PoolTypes.CanisterReplacementInfo, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        switch (userPlatformCanisters.get(userPrincipal)) {
            case (?oldCanisterId) {
                // Update the user's canister mapping
                userPlatformCanisters.put(userPrincipal, newCanisterId);
                
                let replacementInfo: PoolTypes.CanisterReplacementInfo = {
                    userPrincipal = userPrincipal;
                    oldCanisterId = oldCanisterId;
                    newCanisterId = newCanisterId;
                    replacedAt = Nat64.fromIntWrap(Time.now());
                    reason = reason;
                    dataTransferred = false; // Would need actual migration logic
                };

                logger.info("ADMIN_REPLACE: Admin " # Principal.toText(msg.caller) # " replaced user canister. Old: " # Principal.toText(oldCanisterId) # " New: " # Principal.toText(newCanisterId) # " Reason: " # reason);
                
                #ok(replacementInfo)
            };
            case null {
                // User doesn't have a canister yet, just assign the new one
                userPlatformCanisters.put(userPrincipal, newCanisterId);
                let now = Int.abs(Time.now());
                userCreationMap.put(userPrincipal, now);
                
                let replacementInfo: PoolTypes.CanisterReplacementInfo = {
                    userPrincipal = userPrincipal;
                    oldCanisterId = Principal.fromText("aaaaa-aa"); // Placeholder
                    newCanisterId = newCanisterId;
                    replacedAt = Nat64.fromIntWrap(Time.now());
                    reason = "First canister assignment: " # reason;
                    dataTransferred = false;
                };

                logger.info("ADMIN_ASSIGN: Admin " # Principal.toText(msg.caller) # " assigned first canister to user. Canister: " # Principal.toText(newCanisterId));
                
                #ok(replacementInfo)
            };
        };
    };

    /**
     * Get all users with their canister IDs (Admin only - for overview)
     */
    public query(msg) func getAllUserCanisters() : async Result.Result<[(Principal, Principal)], Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        let entries = Iter.toArray(userPlatformCanisters.entries());
        #ok(entries)
    };

    // ===============================
    // WASM CONFIGURATION MANAGEMENT (Admin & Public Query)
    // ===============================

    /**
     * Get remote files configuration (Public query)
     * Includes WASMs, prompts, rules, and other remotely stored files
     */
    public query func getRemoteFilesConfig() : async {
        assetCanisterId: Text;
        basePath: Text;
        userCanisterWasm: Text;
        assetStorageWasm: Text;
        agentWasm: Text;
        agentWasmGz: Text;
        agencyWasm: Text;
        agencyWasmGz: Text;
        backendPrompt: Text;
        frontendPrompt: Text;
        backendRules: Text;
        frontendRules: Text;
    } {
        {
            assetCanisterId = remoteAssetCanisterId;
            basePath = remoteFilesBasePath;
            userCanisterWasm = userCanisterWasmPath;
            assetStorageWasm = assetStorageWasmPath;
            agentWasm = agentWasmPath;
            agentWasmGz = agentWasmGzPath;
            agencyWasm = agencyWasmPath;
            agencyWasmGz = agencyWasmGzPath;
            backendPrompt = backendPromptPath;
            frontendPrompt = frontendPromptPath;
            backendRules = backendRulesPath;
            frontendRules = frontendRulesPath;
        }
    };

    /**
     * Deprecated: Use getRemoteFilesConfig() instead
     * Kept for backward compatibility
     */
    public query func getWasmConfig() : async {
        assetCanisterId: Text;
        basePath: Text;
        userCanisterWasm: Text;
        assetStorageWasm: Text;
        agentWasm: Text;
        agentWasmGz: Text;
        agencyWasm: Text;
        agencyWasmGz: Text;
    } {
        {
            assetCanisterId = remoteAssetCanisterId;
            basePath = remoteFilesBasePath;
            userCanisterWasm = userCanisterWasmPath;
            assetStorageWasm = assetStorageWasmPath;
            agentWasm = agentWasmPath;
            agentWasmGz = agentWasmGzPath;
            agencyWasm = agencyWasmPath;
            agencyWasmGz = agencyWasmGzPath;
        }
    };

    /**
     * Update remote files configuration (Admin only)
     * Includes WASMs, prompts, rules, and other remotely stored files
     */
    public shared(msg) func updateRemoteFilesConfig(
        assetCanisterId: ?Text,
        basePath: ?Text,
        userCanisterWasm: ?Text,
        assetStorageWasm: ?Text,
        agentWasm: ?Text,
        agentWasmGz: ?Text,
        agencyWasm: ?Text,
        agencyWasmGz: ?Text,
        backendPrompt: ?Text,
        frontendPrompt: ?Text,
        backendRules: ?Text,
        frontendRules: ?Text
    ) : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };

        // Update each field if provided
        switch (assetCanisterId) {
            case (?id) { remoteAssetCanisterId := id };
            case null {};
        };
        switch (basePath) {
            case (?path) { remoteFilesBasePath := path };
            case null {};
        };
        switch (userCanisterWasm) {
            case (?path) { userCanisterWasmPath := path };
            case null {};
        };
        switch (assetStorageWasm) {
            case (?path) { assetStorageWasmPath := path };
            case null {};
        };
        switch (agentWasm) {
            case (?path) { agentWasmPath := path };
            case null {};
        };
        switch (agentWasmGz) {
            case (?path) { agentWasmGzPath := path };
            case null {};
        };
        switch (agencyWasm) {
            case (?path) { agencyWasmPath := path };
            case null {};
        };
        switch (agencyWasmGz) {
            case (?path) { agencyWasmGzPath := path };
            case null {};
        };
        switch (backendPrompt) {
            case (?path) { backendPromptPath := path };
            case null {};
        };
        switch (frontendPrompt) {
            case (?path) { frontendPromptPath := path };
            case null {};
        };
        switch (backendRules) {
            case (?path) { backendRulesPath := path };
            case null {};
        };
        switch (frontendRules) {
            case (?path) { frontendRulesPath := path };
            case null {};
        };

        logger.info("Remote files config updated by admin " # Principal.toText(msg.caller));
        #ok("Remote files configuration updated successfully")
    };

    /**
     * Deprecated: Use updateRemoteFilesConfig() instead
     * Kept for backward compatibility
     */
    public shared(msg) func updateWasmConfig(
        assetCanisterId: ?Text,
        basePath: ?Text,
        userCanisterWasm: ?Text,
        assetStorageWasm: ?Text,
        agentWasm: ?Text,
        agentWasmGz: ?Text,
        agencyWasm: ?Text,
        agencyWasmGz: ?Text
    ) : async Result.Result<Text, Text> {
        // Forward to new function
        await updateRemoteFilesConfig(
            assetCanisterId,
            basePath,
            userCanisterWasm,
            assetStorageWasm,
            agentWasm,
            agentWasmGz,
            agencyWasm,
            agencyWasmGz,
            null, null, null, null // No prompt/rules updates
        )
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PLATFORM FORUM API
    // ═══════════════════════════════════════════════════════════════════════════

    // ─────────────────────────────────────────────────────────────────────────────
    // Category Management (Admin Only)
    // ─────────────────────────────────────────────────────────────────────────────

    public shared(msg) func createForumCategory(
        name: Text,
        description: Text,
        icon: Text,
        slug: Text,
        color: Text,
        orderIndex: Nat
    ) : async Text {
        if (not _isAdmin(msg.caller)) {
            throw Error.reject("Unauthorized: Admin only");
        };
        forumManager.createCategory(name, description, icon, slug, color, orderIndex)
    };

    public shared(msg) func updateForumCategory(
        categoryId: Text,
        name: ?Text,
        description: ?Text,
        icon: ?Text,
        color: ?Text,
        orderIndex: ?Nat,
        isActive: ?Bool
    ) : async Bool {
        if (not _isAdmin(msg.caller)) {
            throw Error.reject("Unauthorized: Admin only");
        };
        forumManager.updateCategory(categoryId, name, description, icon, color, orderIndex, isActive)
    };

    public shared(msg) func deleteForumCategory(categoryId: Text) : async Bool {
        if (not _isAdmin(msg.caller)) {
            throw Error.reject("Unauthorized: Admin only");
        };
        forumManager.deleteCategory(categoryId)
    };

    public query func getForumCategory(categoryId: Text) : async ?ForumTypes.ForumCategory {
        forumManager.getCategory(categoryId)
    };

    public query func getAllForumCategories() : async [ForumTypes.ForumCategory] {
        forumManager.getAllCategories()
    };

    public query func getActiveForumCategories() : async [ForumTypes.ForumCategory] {
        forumManager.getActiveCategories()
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // Thread Management
    // ─────────────────────────────────────────────────────────────────────────────

    public shared(msg) func createForumThread(
        categoryId: Text,
        title: Text,
        content: Text,
        tags: [Text]
    ) : async Text {
        // Get user's display name (could be from user profile or principal)
        let authorName = Principal.toText(msg.caller); // TODO: Get from user profile
        forumManager.createThread(categoryId, msg.caller, authorName, title, content, tags)
    };

    public query func getForumThread(threadId: Text) : async ?ForumTypes.ForumThread {
        forumManager.getThread(threadId)
    };

    public shared func incrementForumThreadViews(threadId: Text) : async Bool {
        forumManager.incrementViewCount(threadId)
    };

    public query func getForumThreadsByCategory(categoryId: Text) : async [ForumTypes.ForumThread] {
        forumManager.getThreadsByCategory(categoryId)
    };

    public query func getForumThreadsByCategoryPaginated(
        categoryId: Text,
        limit: Nat,
        offset: Nat
    ) : async ([ForumTypes.ForumThread], Nat) {
        forumManager.getThreadsByCategoryPaginated(categoryId, limit, offset)
    };

    public shared(msg) func pinForumThread(threadId: Text, isPinned: Bool) : async Bool {
        if (not _isAdmin(msg.caller)) {
            return false;
        };
        forumManager.pinThread(threadId, isPinned)
    };

    public shared(msg) func lockForumThread(threadId: Text, isLocked: Bool) : async Bool {
        if (not _isAdmin(msg.caller)) {
            return false;
        };
        forumManager.lockThread(threadId, isLocked)
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // Reply Management
    // ─────────────────────────────────────────────────────────────────────────────

    public shared(msg) func createForumReply(
        threadId: Text,
        content: Text,
        quotedReplyId: ?Text
    ) : async Text {
        let authorName = Principal.toText(msg.caller); // TODO: Get from user profile
        forumManager.createReply(threadId, msg.caller, authorName, content, quotedReplyId)
    };

    public query func getForumReplies(threadId: Text) : async [ForumTypes.ForumReply] {
        forumManager.getReplies(threadId)
    };

    public query func getForumRepliesPaginated(
        threadId: Text,
        limit: Nat,
        offset: Nat
    ) : async ([ForumTypes.ForumReply], Nat) {
        forumManager.getRepliesPaginated(threadId, limit, offset)
    };

    public shared(msg) func updateForumThread(
        threadId: Text,
        title: ?Text,
        content: ?Text,
        tags: ?[Text]
    ) : async Bool {
        // Only author or admin can update
        switch (forumManager.getThread(threadId)) {
            case null { false };
            case (?thread) {
                if (thread.author != msg.caller and not _isAdmin(msg.caller)) {
                    return false;
                };
                forumManager.updateThread(threadId, title, content, tags)
            };
        };
    };

    public shared(msg) func deleteForumThread(threadId: Text) : async Bool {
        // Only author or admin can delete
        switch (forumManager.getThread(threadId)) {
            case null { false };
            case (?thread) {
                if (thread.author != msg.caller and not _isAdmin(msg.caller)) {
                    return false;
                };
                forumManager.deleteThread(threadId)
            };
        };
    };

    public shared(msg) func updateForumReply(
        threadId: Text,
        replyId: Text,
        content: Text
    ) : async Bool {
        // Only author or admin can update
        let replyList = forumManager.getReplies(threadId);
        switch (Array.find(replyList, func(r: ForumTypes.ForumReply) : Bool { r.replyId == replyId })) {
            case null { false };
            case (?reply) {
                if (reply.author != msg.caller and not _isAdmin(msg.caller)) {
                    return false;
                };
                forumManager.updateReply(threadId, replyId, content)
            };
        }
    };

    public shared(msg) func deleteForumReply(
        threadId: Text,
        replyId: Text
    ) : async Bool {
        // Only author or admin can delete
        let replyList = forumManager.getReplies(threadId);
        switch (Array.find(replyList, func(r: ForumTypes.ForumReply) : Bool { r.replyId == replyId })) {
            case null { false };
            case (?reply) {
                if (reply.author != msg.caller and not _isAdmin(msg.caller)) {
                    return false;
                };
                forumManager.deleteReply(threadId, replyId)
            };
        }
    };

    public shared(msg) func markAcceptedAnswer(
        threadId: Text,
        replyId: Text
    ) : async Bool {
        switch (forumManager.getThread(threadId)) {
            case null { false };
            case (?thread) {
                if (thread.author != msg.caller) {
                    return false;
                };
                forumManager.markAcceptedAnswer(threadId, replyId)
            };
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // Voting System
    // ─────────────────────────────────────────────────────────────────────────────

    public shared(msg) func voteOnForumThread(
        threadId: Text,
        voteType: ForumTypes.VoteType
    ) : async Bool {
        forumManager.voteOnThread(msg.caller, threadId, voteType);
    };

    public shared(msg) func voteOnForumReply(
        threadId: Text,
        replyId: Text,
        voteType: ForumTypes.VoteType
    ) : async Bool {
        forumManager.voteOnReply(msg.caller, threadId, replyId, voteType);
    };

    // Search
    public query func searchForum(searchQuery: Text) : async [ForumTypes.SearchResult] {
        forumManager.searchForum(searchQuery)
    };

    public query func searchForumPaginated(
        searchQuery: Text,
        limit: Nat,
        offset: Nat
    ) : async ([ForumTypes.SearchResult], Nat) {
        forumManager.searchForumPaginated(searchQuery, limit, offset)
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // User Profiles
    // ─────────────────────────────────────────────────────────────────────────────

    public query func getUserForumProfile(userId: Principal) : async ?ForumTypes.UserForumProfile {
        forumManager.getUserProfile(userId)
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // Statistics
    // ─────────────────────────────────────────────────────────────────────────────

    public query func getForumStats() : async ForumTypes.ForumStats {
        forumManager.getForumStats()
    };

    // ═════════════════════════════════════════════════════════════════════════════
    // SUBSCRIPTION PLAN MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════════
    
    // ─────────────────────────────────────────────────────────────────────────────
    // Public Functions
    // ─────────────────────────────────────────────────────────────────────────────
    
    public query func getActiveSubscriptionPlans() : async [SubscriptionTypes.SubscriptionPlan] {
        subscriptionManager.getActivePlans()
    };
    
    public query func getSubscriptionPlanByTier(tier: SubscriptionTypes.SubscriptionTier) : async ?SubscriptionTypes.SubscriptionPlan {
        subscriptionManager.getPlanByTier(tier)
    };
    
    // ─────────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ─────────────────────────────────────────────────────────────────────────────
    
    public query func getAllSubscriptionPlans(caller: Principal) : async Result.Result<[SubscriptionTypes.SubscriptionPlan], Text> {
        if (not _isAdmin(caller)) {
            return #err("Unauthorized: Admin only");
        };
        #ok(subscriptionManager.getAllPlans())
    };
    
    public shared(msg) func upsertSubscriptionPlan(planInput: SubscriptionTypes.SubscriptionPlanInput) : async Result.Result<SubscriptionTypes.SubscriptionPlan, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        let newPlan = subscriptionManager.upsertPlan(planInput);
        #ok(newPlan)
    };
    
    public shared(msg) func deleteSubscriptionPlan(tier: SubscriptionTypes.SubscriptionTier) : async Result.Result<Bool, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        let deleted = subscriptionManager.deletePlan(tier);
        if (deleted) {
            #ok(true)
        } else {
            #err("Plan not found")
        }
    };
    
    public shared(msg) func initializeDefaultSubscriptionPlans() : async Result.Result<Text, Text> {
        if (not _isAdmin(msg.caller)) {
            return #err("Unauthorized: Admin only");
        };
        
        subscriptionManager.initializeDefaultPlans();
        #ok("Default subscription plans initialized")
    };
    
    /**
     * Generate comprehensive AI prompt for subscription enforcement (admin only)
     * Returns a formatted document explaining all tiers and enforcement requirements
     */
    public query func getSubscriptionPrompt(caller: Principal) : async Result.Result<Text, Text> {
        if (not _isAdmin(caller)) {
            return #err("Unauthorized: Admin only");
        };
        #ok(subscriptionManager.getSubscriptionPrompt())
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // STRIPE WEBHOOK HANDLING (HTTP Endpoints)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * HTTP Request Handler (Query)
     * Handles GET requests for webhook verification
     */
    public query func http_request(request: {
        method: Text;
        url: Text;
        headers: [(Text, Text)];
        body: Blob;
    }) : async {
        status_code: Nat16;
        headers: [(Text, Text)];
        body: Blob;
    } {
        logger.info("📨 [HTTP] Received GET request: " # request.url);
        
        // Stripe webhook verification (GET request)
        if (Text.contains(request.url, #text "/webhook/stripe")) {
            return {
                status_code = 200;
                headers = [("Content-Type", "text/plain")];
                body = Text.encodeUtf8("Kontext Stripe Webhook Endpoint Active ✅");
            };
        };
        
        // Default 404
        return {
            status_code = 404;
            headers = [("Content-Type", "text/plain")];
            body = Text.encodeUtf8("Not Found");
        };
    };
    
    /**
     * HTTP Request Update Handler (Update Call)
     * Handles POST requests for webhook events
     */
    public func http_request_update(request: {
        method: Text;
        url: Text;
        headers: [(Text, Text)];
        body: Blob;
    }) : async {
        status_code: Nat16;
        headers: [(Text, Text)];
        body: Blob;
    } {
        logger.info("📨 [HTTP] Received " # request.method # " request: " # request.url);
        
        // Stripe webhook endpoint
        if (request.method == "POST" and Text.contains(request.url, #text "/webhook/stripe")) {
            return await handleStripeWebhook(request);
        };
        
        // Default 404
        return {
            status_code = 404;
            headers = [("Content-Type", "text/plain")];
            body = Text.encodeUtf8("Not Found");
        };
    };
    
    /**
     * Main Stripe Webhook Handler
     * Processes incoming webhook events from Stripe
     */
    private func handleStripeWebhook(request: {
        method: Text;
        url: Text;
        headers: [(Text, Text)];
        body: Blob;
    }) : async {
        status_code: Nat16;
        headers: [(Text, Text)];
        body: Blob;
    } {
        logger.info("🎣 [Webhook] Processing Stripe webhook...");
        
        // Parse request body
        let bodyText = switch (Text.decodeUtf8(request.body)) {
            case (?text) { text };
            case null {
                logger.error("❌ [Webhook] Failed to decode request body");
                return errorResponse(400, "Invalid request body");
            };
        };
        
        logger.info("📦 [Webhook] Body length: " # Nat.toText(Text.size(bodyText)) # " chars");
        
        // 🔍 LOG FULL PAYLOAD FOR DEBUGGING (first 1500 chars to avoid log overflow)
        if (Text.size(bodyText) > 1500) {
            let chars = Text.toArray(bodyText);
            let truncated = Text.fromArray(Array.subArray(chars, 0, 1500));
            logger.info("📋 [Webhook] Payload (truncated): " # truncated # "... (+" # Nat.toText(Text.size(bodyText) - 1500) # " more chars)");
        } else {
            logger.info("📋 [Webhook] Full payload: " # bodyText);
        };
        
        // Extract event type
        let eventType = switch (extractJsonField(bodyText, "type")) {
            case (?t) { t };
            case null {
                logger.error("❌ [Webhook] Missing event type");
                return errorResponse(400, "Missing event type");
            };
        };
        
        logger.info("🔔 [Webhook] Event type: " # eventType);
        
        // Route to appropriate handler
        try {
            switch (eventType) {
                case "checkout.session.completed" {
                    await handleCheckoutSessionCompleted(bodyText);
                };
                case "customer.subscription.created" {
                    await handleSubscriptionCreated(bodyText);
                };
                case "customer.subscription.updated" {
                    await handleSubscriptionUpdated(bodyText);
                };
                case "customer.subscription.deleted" {
                    await handleSubscriptionDeleted(bodyText);
                };
                case "invoice.payment_succeeded" {
                    await handleInvoicePaymentSucceeded(bodyText);
                };
                case "invoice.payment_failed" {
                    await handleInvoicePaymentFailed(bodyText);
                };
                case _ {
                    logger.info("ℹ️ [Webhook] Unhandled event type: " # eventType);
                };
            };
            
            logger.info("✅ [Webhook] Event processed successfully");
            
            return {
                status_code = 200;
                headers = [("Content-Type", "application/json")];
                body = Text.encodeUtf8("{\"received\":true}");
            };
        } catch (e) {
            let errorMsg = Error.message(e);
            logger.error("❌ [Webhook] Processing failed: " # errorMsg);
            return errorResponse(500, "Webhook processing failed: " # errorMsg);
        };
    };
    
    /**
     * Handle checkout.session.completed event
     * This is fired when a user completes payment
     */
    private func handleCheckoutSessionCompleted(body: Text) : async () {
        logger.info("💳 [Webhook] Processing checkout.session.completed");
        
        // Extract session data from nested data.object
        let customerId = extractNestedJsonField(body, "data", "object", "customer");
        let subscriptionId = extractNestedJsonField(body, "data", "object", "subscription");
        let userPrincipalText = extractNestedMetadata(body, "user_principal");
        let tier = extractNestedMetadata(body, "subscription_tier");
        
        logger.info("👤 [Webhook] Customer ID: " # debug_show(customerId));
        logger.info("📋 [Webhook] Subscription ID: " # debug_show(subscriptionId));
        logger.info("🎫 [Webhook] User Principal: " # debug_show(userPrincipalText));
        logger.info("🎯 [Webhook] Tier: " # debug_show(tier));
        
        // 🔍 If any extraction failed, log relevant sections for debugging
        if (customerId == null or userPrincipalText == null) {
            logger.warn("⚠️ [Webhook] Some fields failed to extract. Check if Stripe JSON structure matches expectations.");
        };
        
        // Validate required fields
        let validatedCustomerId = switch (customerId) {
            case (?cid) { cid };
            case null {
                logger.error("❌ [Webhook] Missing customer ID");
                return;
            };
        };
        
        let validatedUserPrincipal = switch (userPrincipalText) {
            case (?up) {
                try {
                    Principal.fromText(up);
                } catch (e) {
                    logger.error("❌ [Webhook] Invalid user principal: " # Error.message(e));
                    return;
                };
            };
            case null {
                logger.error("❌ [Webhook] Missing user principal");
                return;
            };
        };
        
        let validatedTier = switch (tier) {
            case (?t) { t };
            case null {
                logger.warn("⚠️ [Webhook] Missing tier, defaulting to STARTER");
                "STARTER";
            };
        };
        
        // Calculate monthly credits based on tier
        let monthlyCredits : Nat = switch (validatedTier) {
            case "STARTER" { 10000 };
            case "DEVELOPER" { 25000 };
            case "PRO" { 60000 };
            case "STUDIO" { 150000 };
            case _ {
                logger.warn("⚠️ [Webhook] Unknown tier: " # validatedTier # ", defaulting to 10000 credits");
                10000;
            };
        };
        
        logger.info("💰 [Webhook] Monthly credits: " # Nat.toText(monthlyCredits));
        
        // Look up user's canister
        let userCanisterResult = await getUserPlatformCanister(validatedUserPrincipal);
        let userCanisterId = switch (userCanisterResult.size()) {
            case 0 {
                logger.error("❌ [Webhook] No user canister found for principal: " # Principal.toText(validatedUserPrincipal));
                return;
            };
            case _ { userCanisterResult[0] };
        };
        
        logger.info("🎭 [Webhook] User canister: " # Principal.toText(userCanisterId));
        
        // Update user canister with subscription details
        try {
            let userActor : actor {
                completeSubscriptionSetup: (Text, Bool, Nat64, Text, Nat) -> async Result.Result<(), Text>;
            } = actor(Principal.toText(userCanisterId));
            
            let now = Nat64.fromNat(Int.abs(Time.now() / 1_000_000_000)); // Convert to seconds
            let billingCycleEnd = now + (30 * 24 * 60 * 60); // 30 days from now
            
            let setupResult = await userActor.completeSubscriptionSetup(
                validatedCustomerId,
                true, // subscriptionActive
                billingCycleEnd,
                validatedTier,
                monthlyCredits
            );
            
            switch (setupResult) {
                case (#ok(_)) {
                    logger.info("✅ [Webhook] Successfully updated user subscription via webhook");
                };
                case (#err(e)) {
                    logger.error("❌ [Webhook] Failed to update user subscription: " # e);
                };
            };
        } catch (e) {
            logger.error("❌ [Webhook] Error calling user canister: " # Error.message(e));
        };
    };
    
    /**
     * Handle customer.subscription.created event
     */
    private func handleSubscriptionCreated(body: Text) : async () {
        logger.info("🆕 [Webhook] Processing customer.subscription.created");
        // Similar to checkout.session.completed, extract and update user canister
        // Implementation similar to handleCheckoutSessionCompleted
    };
    
    /**
     * Handle customer.subscription.updated event
     * This fires when subscription changes (upgrade/downgrade/renewal)
     */
    private func handleSubscriptionUpdated(body: Text) : async () {
        logger.info("🔄 [Webhook] Processing customer.subscription.updated");
        
        let customerId = extractNestedJsonField(body, "data", "object", "customer");
        let subscriptionStatus = extractNestedJsonField(body, "data", "object", "status");
        let userPrincipalText = extractNestedMetadata(body, "user_principal");
        let tier = extractNestedMetadata(body, "subscription_tier");
        
        logger.info("👤 [Webhook] Customer ID: " # debug_show(customerId));
        logger.info("📊 [Webhook] Status: " # debug_show(subscriptionStatus));
        logger.info("🎫 [Webhook] User Principal: " # debug_show(userPrincipalText));
        
        let validatedUserPrincipal = switch (userPrincipalText) {
            case (?up) {
                try {
                    Principal.fromText(up);
                } catch (e) {
                    logger.error("❌ [Webhook] Invalid user principal: " # Error.message(e));
                    return;
                };
            };
            case null {
                logger.error("❌ [Webhook] Missing user principal");
                return;
            };
        };
        
        let isActive = switch (subscriptionStatus) {
            case (?"active") { true };
            case (?"trialing") { true };
            case _ { false };
        };
        
        logger.info("✨ [Webhook] Subscription active: " # (if isActive { "true" } else { "false" }));
        
        // Update user canister
        let userCanisterResult = await getUserPlatformCanister(validatedUserPrincipal);
        let userCanisterId = switch (userCanisterResult.size()) {
            case 0 {
                logger.error("❌ [Webhook] No user canister found");
                return;
            };
            case _ { userCanisterResult[0] };
        };
        
        try {
            let userActor : actor {
                updateStripeSubscriptionStatus: (Bool) -> async Result.Result<(), Text>;
            } = actor(Principal.toText(userCanisterId));
            
            let updateResult = await userActor.updateStripeSubscriptionStatus(isActive);
            
            switch (updateResult) {
                case (#ok(_)) {
                    logger.info("✅ [Webhook] Successfully updated subscription status");
                };
                case (#err(e)) {
                    logger.error("❌ [Webhook] Failed to update subscription status: " # e);
                };
            };
        } catch (e) {
            logger.error("❌ [Webhook] Error calling user canister: " # Error.message(e));
        };
    };
    
    /**
     * Handle customer.subscription.deleted event
     * This fires when a subscription is cancelled
     */
    private func handleSubscriptionDeleted(body: Text) : async () {
        logger.info("🗑️ [Webhook] Processing customer.subscription.deleted");
        
        let userPrincipalText = extractNestedMetadata(body, "user_principal");
        
        let validatedUserPrincipal = switch (userPrincipalText) {
            case (?up) {
                try {
                    Principal.fromText(up);
                } catch (e) {
                    logger.error("❌ [Webhook] Invalid user principal: " # Error.message(e));
                    return;
                };
            };
            case null {
                logger.error("❌ [Webhook] Missing user principal");
                return;
            };
        };
        
        // Update user canister to mark subscription as inactive
        let userCanisterResult = await getUserPlatformCanister(validatedUserPrincipal);
        let userCanisterId = switch (userCanisterResult.size()) {
            case 0 {
                logger.error("❌ [Webhook] No user canister found");
                return;
            };
            case _ { userCanisterResult[0] };
        };
        
        try {
            let userActor : actor {
                updateStripeSubscriptionStatus: (Bool) -> async Result.Result<(), Text>;
            } = actor(Principal.toText(userCanisterId));
            
            let updateResult = await userActor.updateStripeSubscriptionStatus(false);
            
            switch (updateResult) {
                case (#ok(_)) {
                    logger.info("✅ [Webhook] Successfully marked subscription as cancelled");
                };
                case (#err(e)) {
                    logger.error("❌ [Webhook] Failed to update subscription status: " # e);
                };
            };
        } catch (e) {
            logger.error("❌ [Webhook] Error calling user canister: " # Error.message(e));
        };
    };
    
    /**
     * Handle invoice.payment_succeeded event
     */
    private func handleInvoicePaymentSucceeded(body: Text) : async () {
        logger.info("💵 [Webhook] Processing invoice.payment_succeeded");
        // Renewal payment succeeded - subscription continues
        // Similar handling to subscription.updated with active status
    };
    
    /**
     * Handle invoice.payment_failed event
     */
    private func handleInvoicePaymentFailed(body: Text) : async () {
        logger.info("⚠️ [Webhook] Processing invoice.payment_failed");
        // Payment failed - may need to suspend access after grace period
        // Log the failure for admin review
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // WEBHOOK HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Extract nested JSON field (e.g., data.object.customer)
     */
    private func extractNestedJsonField(json: Text, level1: Text, level2: Text, field: Text) : ?Text {
        // First extract the level1 object
        let level1Pattern = "\"" # level1 # "\":{";
        if (not Text.contains(json, #text level1Pattern)) {
            return null;
        };
        
        let parts1 = Text.split(json, #text level1Pattern);
        var iter1 = parts1;
        let _ = iter1.next(); // Skip before pattern
        
        let level1Section = switch (iter1.next()) {
            case (?section) { section };
            case null { return null };
        };
        
        // Then extract level2 from level1
        let level2Pattern = "\"" # level2 # "\":{";
        if (not Text.contains(level1Section, #text level2Pattern)) {
            return null;
        };
        
        let parts2 = Text.split(level1Section, #text level2Pattern);
        var iter2 = parts2;
        let _ = iter2.next(); // Skip before pattern
        
        let level2Section = switch (iter2.next()) {
            case (?section) { section };
            case null { return null };
        };
        
        // Finally extract the field from level2
        extractJsonField(level2Section, field);
    };
    
    /**
     * Extract metadata field (e.g., data.object.metadata.user_principal)
     */
    private func extractNestedMetadata(json: Text, metadataField: Text) : ?Text {
        // Extract metadata section
        let metadataPattern = "\"metadata\":{";
        if (not Text.contains(json, #text metadataPattern)) {
            return null;
        };
        
        let parts = Text.split(json, #text metadataPattern);
        var iter = parts;
        let _ = iter.next(); // Skip before pattern
        
        let metadataSection = switch (iter.next()) {
            case (?section) { section };
            case null { return null };
        };
        
        // Extract the specific field
        extractJsonField(metadataSection, metadataField);
    };
    
    /**
     * Simple JSON field extraction (reusing existing utility)
     */
    private func extractJsonField(json: Text, fieldName: Text) : ?Text {
        // Try pattern with no space: "field":"value"
        let pattern1 = "\"" # fieldName # "\":\"";
        // Try pattern with space: "field": "value"
        let pattern2 = "\"" # fieldName # "\": \"";
        
        var pattern = pattern1;
        if (not Text.contains(json, #text pattern1)) {
            if (not Text.contains(json, #text pattern2)) {
                return null;
            };
            pattern := pattern2;
        };
        
        let parts = Text.split(json, #text pattern);
        var iter = parts;
        
        // Skip first part (before field)
        let _ = iter.next();
        
        // Get value part
        switch (iter.next()) {
            case (?valuePart) {
                // Find the closing quote
                let quoteChar : Char = '\u{0022}';
                let endQuote = Text.split(valuePart, #char quoteChar);
                var endIter = endQuote;
                switch (endIter.next()) {
                    case (?value) { ?value };
                    case null { null };
                };
            };
            case null { null };
        };
    };
    
    /**
     * Create error HTTP response
     */
    private func errorResponse(statusCode: Nat16, message: Text) : {
        status_code: Nat16;
        headers: [(Text, Text)];
        body: Blob;
    } {
        {
            status_code = statusCode;
            headers = [("Content-Type", "application/json")];
            body = Text.encodeUtf8("{\"error\":\"" # message # "\"}");
        }
    };

}