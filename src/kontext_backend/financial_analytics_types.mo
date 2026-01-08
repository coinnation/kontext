/**
 * Financial Analytics Types
 * 
 * Treasury management, revenue tracking, and financial forecasting
 * for Kontext platform operations
 */

import Principal "mo:base/Principal";
import Time "mo:base/Time";

module FinancialAnalyticsTypes {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // TREASURY MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Real-time XDR exchange rate (fetched via HTTP outcall)
     */
    public type XDRRate = {
        usdPerXDR: Float;      // Current USD per XDR
        icpPerXDR: Float;      // Current ICP per XDR
        lastUpdated: Nat64;    // Timestamp
    };
    
    /**
     * Platform credit statistics
     */
    public type CreditStatistics = {
        totalCreditsIssued: Nat;           // Total credits across all users
        totalCreditsConsumed: Nat;         // Credits already spent
        totalCreditsRemaining: Nat;        // Credits available to spend
        totalCreditValueUSD: Float;        // USD value (credits × $0.01)
    };
    
    /**
     * AI Token Reserve Calculation
     */
    public type AITokenReserve = {
        // Current state
        totalCreditsRemaining: Nat;        // Total unused credits on platform
        
        // Cost assumptions (per million tokens)
        claudeInputCostPerMillion: Float;  // $3
        claudeOutputCostPerMillion: Float; // $15
        avgTokensPerCredit: Float;         // Estimated tokens per 1 credit
        
        // Reserve calculations
        maxPotentialAICostUSD: Float;      // If ALL credits used for AI
        requiredClaudeBalance: Float;      // How much $ needed in Claude account
        currentClaudeBalance: Float;       // How much $ actually in account
        shortfallUSD: Float;               // Difference (negative = need to top up)
        
        // Safety metrics
        reserveRatio: Float;               // Current / Required (want > 1.0)
        daysOfReserve: Nat;                // Days until reserve depleted
        
        lastCalculated: Nat64;
    };
    
    /**
     * ICP/Cycles Reserve Calculation
     */
    public type ICPReserve = {
        // Current state
        totalCreditsRemaining: Nat;        // Total unused credits
        
        // Conversion rates
        xdrRate: XDRRate;                  // Real-time exchange rates
        cyclesPerTrillion: Nat;            // 1 trillion cycles = 1 XDR
        
        // Reserve calculations
        maxPotentialCyclesNeeded: Nat;     // If ALL credits used for cycles
        maxPotentialXDRNeeded: Float;      // XDR equivalent
        maxPotentialICPNeeded: Float;      // ICP equivalent
        maxPotentialUSDNeeded: Float;      // USD equivalent
        
        // Current balances
        currentICPBalance: Float;          // ICP in platform wallet
        currentUSDValue: Float;            // USD value of ICP
        
        // Safety metrics
        reserveRatio: Float;               // Current / Required
        shortfallICP: Float;               // ICP needed (negative = top up)
        shortfallUSD: Float;               // USD equivalent
        daysOfReserve: Nat;                // Days until reserve depleted
        
        lastCalculated: Nat64;
    };
    
    /**
     * Combined Treasury Status
     */
    public type TreasuryStatus = {
        credits: CreditStatistics;
        aiReserve: AITokenReserve;
        icpReserve: ICPReserve;
        
        // Overall health
        overallHealthStatus: HealthStatus;
        alerts: [Text];
        recommendations: [Text];
        
        generatedAt: Nat64;
    };
    
    public type HealthStatus = {
        #Healthy;      // > 90 days reserve
        #Adequate;     // 30-90 days reserve
        #Warning;      // 7-30 days reserve
        #Critical;     // < 7 days reserve
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SUBSCRIPTION ALLOCATION
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Subscription tier allocation
     */
    public type SubscriptionAllocation = {
        tier: Text;                        // 'starter', 'pro', 'enterprise'
        monthlyPriceCents: Nat;            // e.g., 2999 for $29.99
        
        // Allocation breakdown
        icpFundingPercent: Float;          // % allocated to ICP reserve
        aiFundingPercent: Float;           // % allocated to AI reserve
        platformRevenuePercent: Float;     // % as platform profit
        
        // Calculated amounts
        icpFundingUSD: Float;              // $ allocated to ICP
        aiFundingUSD: Float;               // $ allocated to AI
        platformRevenueUSD: Float;         // $ as profit
        
        // Justification
        rationale: Text;                   // Why this split?
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // DOMAIN PURCHASE TRACKING
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type DomainType = {
        #Com;
        #Net;
        #Io;
        #Ai;
        #Dev;
        #App;
        #Tech;
        #Cloud;
        #Other : Text;
    };
    
    public type DomainPurchase = {
        id: Nat;
        userId: Principal;
        domainName: Text;
        domainType: DomainType;
        costCents: Nat;                    // Cost in cents
        provider: Text;                    // 'NameSilo', etc.
        timestamp: Nat64;
        renewalDate: ?Nat64;               // When renewal is due
        autoRenew: Bool;
    };
    
    public type DomainStatistics = {
        totalDomainsPurchased: Nat;
        domainsByType: [(DomainType, Nat)]; // [(.Io, 45), (.Com, 23), ...]
        totalCostCents: Nat;
        avgCostPerDomainCents: Nat;
        
        // Forecasting
        purchasesThisMonth: Nat;
        avgPurchasesPerMonth: Float;
        forecastedMonthlyCostCents: Nat;   // Predicted next month cost
        
        // Provider balance needed
        requiredNameSiloBalanceUSD: Float; // How much to keep in NameSilo
        
        // Renewal tracking
        renewalsNext30Days: Nat;
        renewalCostNext30DaysCents: Nat;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // REVENUE ATTRIBUTION & COMMISSION
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type RevenueSource = {
        #Subscription;
        #CreditPurchase;
        #CreditConsumption;    // 7% markup
        #MarketplaceSale;
        #MarketplaceCommission;
    };
    
    public type RevenueRecord = {
        id: Nat;
        userId: Principal;
        source: RevenueSource;
        amountCents: Nat;                  // Gross amount
        commissionCents: Nat;              // Platform commission (e.g., 7%)
        netAmountCents: Nat;               // What user paid
        timestamp: Nat64;
    };
    
    public type RevenueBreakdown = {
        // Subscription revenue
        subscriptionRevenueGross: Nat;     // Total subscription payments
        
        // Credit-related revenue
        creditPurchaseRevenue: Nat;        // Direct credit purchases
        creditConsumptionCommission: Nat;  // 7% markup on usage
        totalCreditRevenue: Nat;           // Sum of above
        
        // Marketplace revenue
        marketplaceSalesRevenue: Nat;      // Seller sales
        marketplaceCommission: Nat;        // Platform commission
        
        // Total
        totalRevenueGross: Nat;            // All revenue
        
        // Breakdown by period
        revenueToday: Nat;
        revenueThisWeek: Nat;
        revenueThisMonth: Nat;
        
        generatedAt: Nat64;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // TEAM REVENUE SHARING
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type TeamMember = {
        id: Nat;
        name: Text;
        role: Text;                        // 'Developer', 'Designer', etc.
        revenueSharePercent: Float;        // e.g., 15.5 for 15.5%
        
        // What revenue they get % of
        subscriptionShare: Bool;           // Get % of subscription revenue?
        creditCommissionShare: Bool;       // Get % of credit commission?
        marketplaceShare: Bool;            // Get % of marketplace commission?
        
        active: Bool;
        addedAt: Nat64;
    };
    
    public type TeamMemberEarnings = {
        memberId: Nat;
        memberName: Text;
        revenueSharePercent: Float;
        
        // Earnings breakdown
        subscriptionEarnings: Nat;         // From subscriptions
        creditCommissionEarnings: Nat;     // From credit commission
        marketplaceEarnings: Nat;          // From marketplace
        totalEarnings: Nat;                // Sum
        
        // Historical
        earningsThisMonth: Nat;
        earningsLastMonth: Nat;
        earningsAllTime: Nat;
        
        calculatedAt: Nat64;
    };
    
    public type TeamEarningsReport = {
        totalPlatformRevenue: Nat;         // Total revenue this period
        totalTeamPayouts: Nat;             // Total paid to team
        platformRetainedRevenue: Nat;      // What's left for platform
        
        memberEarnings: [TeamMemberEarnings];
        
        generatedAt: Nat64;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // COMPREHENSIVE FINANCIAL DASHBOARD
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type FinancialDashboard = {
        // Treasury
        treasury: TreasuryStatus;
        
        // Subscription allocation
        subscriptionAllocations: [SubscriptionAllocation];
        
        // Domain tracking
        domainStats: DomainStatistics;
        
        // Revenue
        revenueBreakdown: RevenueBreakdown;
        
        // Team earnings
        teamEarnings: TeamEarningsReport;
        
        // Summary metrics
        summary: {
            totalMonthlyRevenue: Nat;
            totalMonthlyCosts: Nat;          // AI + ICP + Domains + Team
            netProfit: Int;                  // Revenue - Costs
            profitMargin: Float;             // Net / Revenue
        };
        
        generatedAt: Nat64;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FORECASTING
    // ═══════════════════════════════════════════════════════════════════════════
    
    public type MonthlyForecast = {
        month: Text;                       // 'January 2026'
        
        // Predicted revenue
        forecastedSubscriptionRevenue: Nat;
        forecastedCreditRevenue: Nat;
        forecastedMarketplaceRevenue: Nat;
        forecastedTotalRevenue: Nat;
        
        // Predicted costs
        forecastedAICosts: Nat;
        forecastedICPCosts: Nat;
        forecastedDomainCosts: Nat;
        forecastedTeamPayouts: Nat;
        forecastedTotalCosts: Nat;
        
        // Predicted profit
        forecastedNetProfit: Int;
        forecastedProfitMargin: Float;
        
        // Confidence
        confidenceLevel: Float;            // 0.0 - 1.0
    };
}

