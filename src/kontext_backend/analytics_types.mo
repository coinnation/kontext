/**
 * Analytics Types Module
 * 
 * Comprehensive analytics system for Kontext platform
 * Tracks user activity, feature usage, revenue, marketplace, errors, performance, and system health
 */

import Principal "mo:base/Principal";
import Time "mo:base/Time";

module AnalyticsTypes {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. USER ACTIVITY ANALYTICS
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type UserAction = {
        #Login;
        #Logout;
        #ProjectCreated;
        #ProjectDeployed;
        #AgentCreated;
        #AgentDeployed;
        #AIRequest;
        #FileUploaded;
        #DatabaseQuery;
        #MarketplaceListing;
        #MarketplacePurchase;
        #SubscriptionPurchased;
        #CreditsPurchased;
    };
    
    public type UserActivityRecord = {
        id: Nat;
        userId: Principal;
        action: UserAction;
        timestamp: Nat64;
        sessionId: ?Text;
        metadata: ?Text; // JSON string for additional data
    };
    
    public type UserMetrics = {
        totalUsers: Nat;
        totalUsersAllTime: Nat;
        activeUsersToday: Nat;
        activeUsersThisWeek: Nat;
        activeUsersThisMonth: Nat;
        newUsersToday: Nat;
        newUsersThisWeek: Nat;
        newUsersThisMonth: Nat;
        avgSessionsPerUser: Float;
        avgActionsPerUser: Float;
        topUsers: [(Principal, Nat)]; // (userId, actionCount)
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 2. FEATURE USAGE ANALYTICS
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type FeatureType = {
        #ProjectCreate;
        #ProjectDeploy;
        #AIChat;
        #AgentWorkflow;
        #DatabaseInterface;
        #CodeGeneration;
        #ServerPairOps;
        #CanisterDeploy;
        #FileStorage;
        #Marketplace;
    };
    
    public type AIModel = {
        #Claude;
        #OpenAI;
        #Gemini;
        #Kimi;
    };
    
    public type FeatureUsageRecord = {
        id: Nat;
        userId: Principal;
        feature: FeatureType;
        timestamp: Nat64;
        aiModel: ?AIModel;
        tokensConsumed: ?Nat;
        durationMs: ?Nat;
        success: Bool;
        errorMessage: ?Text;
    };
    
    public type FeatureMetrics = {
        totalFeatureUsage: Nat;
        projectsCreated: Nat;
        projectsDeployed: Nat;
        aiRequestsTotal: Nat;
        aiRequestsByClaude: Nat;
        aiRequestsByOpenAI: Nat;
        aiRequestsByGemini: Nat;
        aiRequestsByKimi: Nat;
        agentsDeployed: Nat;
        databaseQueries: Nat;
        filesStored: Nat;
        avgTokensPerRequest: Float;
        avgDurationMs: Float;
        successRate: Float;
        mostUsedFeatures: [(FeatureType, Nat)];
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 3. REVENUE & SUBSCRIPTION ANALYTICS
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type PaymentType = {
        #Subscription;
        #Credits;
        #MarketplaceSale;
        #MarketplacePlatformFee;
    };
    
    public type PaymentStatus = {
        #Succeeded;
        #Failed;
        #Pending;
        #Refunded;
    };
    
    public type RevenueRecord = {
        id: Nat;
        userId: Principal;
        amountCents: Nat;
        currency: Text;
        tier: ?Text; // Subscription tier
        paymentType: PaymentType;
        timestamp: Nat64;
        status: PaymentStatus;
        stripePaymentId: ?Text;
    };
    
    public type RevenueMetrics = {
        // Monthly Recurring Revenue
        mrrCents: Nat;
        // Annual Recurring Revenue
        arrCents: Nat;
        // Total revenue (all time)
        totalRevenueCents: Nat;
        // Revenue breakdown
        revenueFromSubscriptions: Nat;
        revenueFromCredits: Nat;
        revenueFromMarketplace: Nat;
        // By tier
        revenueByFree: Nat;
        revenueByStarter: Nat;
        revenueByPro: Nat;
        revenueByEnterprise: Nat;
        // User metrics
        avgRevenuePerUser: Nat;
        payingUsers: Nat;
        // Subscription distribution
        usersByFree: Nat;
        usersByStarter: Nat;
        usersByPro: Nat;
        usersByEnterprise: Nat;
        // Health metrics
        churnRate: Float;
        retentionRate: Float;
        conversionRate: Float; // Free to paid
        avgLifetimeValueCents: Nat;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 4. MARKETPLACE ANALYTICS
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type MarketplaceAction = {
        #ListingCreated;
        #ListingUpdated;
        #ListingPublished;
        #ListingUnpublished;
        #ListingViewed;
        #ProjectSold;
        #ProjectDownloaded;
    };
    
    public type MarketplaceRecord = {
        id: Nat;
        listingId: Text;
        sellerId: Principal;
        buyerId: ?Principal;
        action: MarketplaceAction;
        priceCents: ?Nat;
        timestamp: Nat64;
        category: ?Text;
    };
    
    public type MarketplaceMetrics = {
        totalListings: Nat;
        activeListings: Nat;
        totalSales: Nat;
        totalRevenueCents: Nat;
        platformFeesCollectedCents: Nat;
        avgSalePriceCents: Nat;
        totalViews: Nat;
        conversionRate: Float; // Views to sales
        topSellers: [(Principal, Nat)]; // (sellerId, salesCount)
        topCategories: [(Text, Nat)]; // (category, listingsCount)
        salesThisWeek: Nat;
        salesThisMonth: Nat;
        avgTimeToPurchase: Nat; // Days from listing to first sale
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 5. ERROR TRACKING & RELIABILITY
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type ErrorType = {
        #DeploymentFailed;
        #PaymentFailed;
        #APIError;
        #CanisterError;
        #AuthenticationError;
        #ValidationError;
        #StorageError;
        #NetworkError;
        #UnknownError;
    };
    
    public type ErrorSeverity = {
        #Low;
        #Medium;
        #High;
        #Critical;
    };
    
    public type ErrorRecord = {
        id: Nat;
        userId: ?Principal;
        errorType: ErrorType;
        errorMessage: Text;
        feature: ?Text;
        severity: ErrorSeverity;
        timestamp: Nat64;
        resolved: Bool;
        resolvedAt: ?Nat64;
        stackTrace: ?Text;
    };
    
    public type ErrorMetrics = {
        totalErrors: Nat;
        unresolvedErrors: Nat;
        errorsByLow: Nat;
        errorsByMedium: Nat;
        errorsByHigh: Nat;
        errorsByCritical: Nat;
        errorsByDeployment: Nat;
        errorsByPayment: Nat;
        errorsByAPI: Nat;
        errorsByCanister: Nat;
        errorsByAuth: Nat;
        errorRate: Float; // Errors per 1000 operations
        avgResolutionTimeMs: Nat;
        errorsToday: Nat;
        errorsThisWeek: Nat;
        errorsThisMonth: Nat;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 6. PERFORMANCE METRICS
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type OperationType = {
        #APICall;
        #Deployment;
        #AIRequest;
        #DatabaseQuery;
        #FileUpload;
        #FileDownload;
        #CanisterCall;
        #HTTPOutcall;
    };
    
    public type PerformanceRecord = {
        id: Nat;
        operation: OperationType;
        durationMs: Nat;
        success: Bool;
        timestamp: Nat64;
        userId: ?Principal;
    };
    
    public type PerformanceMetrics = {
        totalOperations: Nat;
        avgResponseTimeMs: Nat;
        medianResponseTimeMs: Nat;
        p95ResponseTimeMs: Nat;
        p99ResponseTimeMs: Nat;
        // By operation type
        avgDeploymentTimeMs: Nat;
        avgAIRequestTimeMs: Nat;
        avgDatabaseQueryTimeMs: Nat;
        avgFileUploadTimeMs: Nat;
        // Slowest operations
        slowestOperations: [(OperationType, Nat)];
        // Cache metrics
        cacheHitRate: Float;
        // Success rate
        overallSuccessRate: Float;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 7. SYSTEM HEALTH METRICS
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type SystemHealthRecord = {
        id: Nat;
        timestamp: Nat64;
        cyclesBalance: Nat;
        memoryUsed: Nat;
        storageUsed: Nat;
        httpOutcallsToday: Nat;
        activeUsers: Nat;
        totalUsers: Nat;
    };
    
    public type HealthStatus = {
        #Healthy;
        #Warning;
        #Critical;
    };
    
    public type SystemHealthMetrics = {
        currentCycles: Nat;
        cyclesBurnRatePerDay: Nat;
        estimatedDaysRemaining: Nat;
        memoryUsedBytes: Nat;
        memoryCapacityBytes: Nat;
        memoryUtilizationPercent: Float;
        storageUsedBytes: Nat;
        storageCapacityBytes: Nat;
        storageUtilizationPercent: Float;
        httpOutcallsToday: Nat;
        httpOutcallsThisMonth: Nat;
        activeUsers: Nat;
        totalUsers: Nat;
        healthStatus: HealthStatus;
        alerts: [Text]; // Active alerts
        lastUpgradeTime: ?Nat64;
        uptimePercent: Float;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // AGGREGATED DASHBOARD DATA
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type DashboardData = {
        userActivity: UserMetrics;
        featureUsage: FeatureMetrics;
        revenue: RevenueMetrics;
        marketplace: MarketplaceMetrics;
        errors: ErrorMetrics;
        performance: PerformanceMetrics;
        systemHealth: SystemHealthMetrics;
        generatedAt: Nat64;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // DATE RANGE FILTERING
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type DateRange = {
        startDate: Nat64;
        endDate: Nat64;
    };
    
    public type TimeWindow = {
        #Last24Hours;
        #Last7Days;
        #Last30Days;
        #Last90Days;
        #AllTime;
        #Custom : DateRange;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORT FORMATS
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type ExportFormat = {
        #JSON;
        #CSV;
    };
    
    public type AnalyticsExport = {
        format: ExportFormat;
        data: Text;
        generatedAt: Nat64;
        recordCount: Nat;
    };
}

