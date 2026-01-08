export const idlFactory = ({ IDL }) => {
  const Result_8 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const CanisterPoolType = IDL.Variant({
    'RegularServerPair' : IDL.Null,
    'AgencyWorkflowPair' : IDL.Null,
    'AgentServerPair' : IDL.Null,
    'UserCanister' : IDL.Null,
  });
  const Result_9 = IDL.Variant({ 'ok' : IDL.Bool, 'err' : IDL.Text });
  const Result_11 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : IDL.Text });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const CanisterReplacementInfo = IDL.Record({
    'oldCanisterId' : IDL.Principal,
    'replacedAt' : IDL.Nat64,
    'userPrincipal' : IDL.Principal,
    'newCanisterId' : IDL.Principal,
    'dataTransferred' : IDL.Bool,
    'reason' : IDL.Text,
  });
  const Result_50 = IDL.Variant({
    'ok' : CanisterReplacementInfo,
    'err' : IDL.Text,
  });
  const AITokenReserve = IDL.Record({
    'totalCreditsRemaining' : IDL.Nat,
    'lastCalculated' : IDL.Nat64,
    'reserveRatio' : IDL.Float64,
    'avgTokensPerCredit' : IDL.Float64,
    'claudeOutputCostPerMillion' : IDL.Float64,
    'daysOfReserve' : IDL.Nat,
    'maxPotentialAICostUSD' : IDL.Float64,
    'claudeInputCostPerMillion' : IDL.Float64,
    'currentClaudeBalance' : IDL.Float64,
    'shortfallUSD' : IDL.Float64,
    'requiredClaudeBalance' : IDL.Float64,
  });
  const Result_49 = IDL.Variant({ 'ok' : AITokenReserve, 'err' : IDL.Text });
  const XDRRate = IDL.Record({
    'icpPerXDR' : IDL.Float64,
    'lastUpdated' : IDL.Nat64,
    'usdPerXDR' : IDL.Float64,
  });
  const ICPReserve = IDL.Record({
    'totalCreditsRemaining' : IDL.Nat,
    'lastCalculated' : IDL.Nat64,
    'reserveRatio' : IDL.Float64,
    'maxPotentialUSDNeeded' : IDL.Float64,
    'xdrRate' : XDRRate,
    'cyclesPerTrillion' : IDL.Nat,
    'currentUSDValue' : IDL.Float64,
    'daysOfReserve' : IDL.Nat,
    'maxPotentialCyclesNeeded' : IDL.Nat,
    'maxPotentialXDRNeeded' : IDL.Float64,
    'currentICPBalance' : IDL.Float64,
    'maxPotentialICPNeeded' : IDL.Float64,
    'shortfallICP' : IDL.Float64,
    'shortfallUSD' : IDL.Float64,
  });
  const Result_48 = IDL.Variant({ 'ok' : ICPReserve, 'err' : IDL.Text });
  const TeamMemberEarnings = IDL.Record({
    'memberId' : IDL.Nat,
    'earningsAllTime' : IDL.Nat,
    'creditCommissionEarnings' : IDL.Nat,
    'earningsLastMonth' : IDL.Nat,
    'revenueSharePercent' : IDL.Float64,
    'earningsThisMonth' : IDL.Nat,
    'calculatedAt' : IDL.Nat64,
    'memberName' : IDL.Text,
    'marketplaceEarnings' : IDL.Nat,
    'totalEarnings' : IDL.Nat,
    'subscriptionEarnings' : IDL.Nat,
  });
  const TeamEarningsReport = IDL.Record({
    'platformRetainedRevenue' : IDL.Nat,
    'generatedAt' : IDL.Nat64,
    'totalPlatformRevenue' : IDL.Nat,
    'totalTeamPayouts' : IDL.Nat,
    'memberEarnings' : IDL.Vec(TeamMemberEarnings),
  });
  const Result_47 = IDL.Variant({
    'ok' : TeamEarningsReport,
    'err' : IDL.Text,
  });
  const DifficultyLevel = IDL.Variant({
    'intermediate' : IDL.Null,
    'beginner' : IDL.Null,
    'advanced' : IDL.Null,
    'expert' : IDL.Null,
  });
  const DegreeType = IDL.Variant({
    'certificate' : IDL.Null,
    'bachelor' : IDL.Null,
    'nanodegree' : IDL.Null,
    'specialization' : IDL.Null,
    'master' : IDL.Null,
    'associate' : IDL.Null,
    'diploma' : IDL.Null,
  });
  const Result_46 = IDL.Variant({
    'ok' : IDL.Record({ 'url' : IDL.Text }),
    'err' : IDL.Text,
  });
  const Result_45 = IDL.Variant({
    'ok' : IDL.Record({ 'id' : IDL.Text, 'url' : IDL.Text }),
    'err' : IDL.Text,
  });
  const AccessTier = IDL.Variant({
    'pro' : IDL.Null,
    'enterprise' : IDL.Null,
    'starter' : IDL.Null,
    'free' : IDL.Null,
    'developer' : IDL.Null,
  });
  const SyllabusItem = IDL.Record({
    'description' : IDL.Text,
    'lessonIds' : IDL.Vec(IDL.Text),
    'sectionTitle' : IDL.Text,
  });
  const ResourceType = IDL.Variant({
    'pdf' : IDL.Null,
    'other' : IDL.Null,
    'code' : IDL.Null,
    'slides' : IDL.Null,
    'worksheet' : IDL.Null,
  });
  const LessonResource = IDL.Record({
    'title' : IDL.Text,
    'resourceId' : IDL.Text,
    'description' : IDL.Text,
    'fileSize' : IDL.Nat,
    'fileType' : ResourceType,
    'fileUrl' : IDL.Text,
  });
  const NotificationSeverity = IDL.Variant({
    'Low' : IDL.Null,
    'High' : IDL.Null,
    'Medium' : IDL.Null,
    'Critical' : IDL.Null,
  });
  const NotificationCategory = IDL.Variant({
    'System' : IDL.Null,
    'Announcement' : IDL.Null,
    'Security' : IDL.Null,
    'Deployment' : IDL.Null,
    'Account' : IDL.Null,
    'Credits' : IDL.Null,
    'Feature' : IDL.Null,
    'Subscription' : IDL.Null,
  });
  const NotificationAudience = IDL.Variant({
    'All' : IDL.Null,
    'SubscriptionTier' : IDL.Text,
    'NewUsers' : IDL.Nat64,
    'SpecificUsers' : IDL.Vec(IDL.Principal),
    'ActiveUsers' : IDL.Nat64,
  });
  const NotificationAction = IDL.Record({
    'actionLabel' : IDL.Text,
    'actionType' : IDL.Variant({
      'NavigateTo' : IDL.Text,
      'Dismiss' : IDL.Null,
      'OpenDialog' : IDL.Text,
      'ExternalLink' : IDL.Text,
    }),
  });
  const Result_44 = IDL.Variant({
    'ok' : IDL.Record({
      'id' : IDL.Text,
      'amount' : IDL.Nat,
      'clientSecret' : IDL.Text,
    }),
    'err' : IDL.Text,
  });
  const SubscriptionTier = IDL.Variant({
    'PRO' : IDL.Null,
    'ENTERPRISE' : IDL.Null,
    'FREE' : IDL.Null,
    'STARTER' : IDL.Null,
    'DEVELOPER' : IDL.Null,
  });
  const Result_43 = IDL.Variant({
    'ok' : IDL.Record({
      'tokenId' : IDL.Text,
      'expiresAt' : IDL.Nat64,
      'downloadUrl' : IDL.Text,
    }),
    'err' : IDL.Text,
  });
  const AcademicProgram = IDL.Record({
    'title' : IDL.Text,
    'thumbnailUrl' : IDL.Text,
    'isPublished' : IDL.Bool,
    'prerequisites' : IDL.Vec(IDL.Text),
    'instructor' : IDL.Principal,
    'difficulty' : DifficultyLevel,
    'createdAt' : IDL.Nat64,
    'tags' : IDL.Vec(IDL.Text),
    'description' : IDL.Text,
    'isActive' : IDL.Bool,
    'courseIds' : IDL.Vec(IDL.Text),
    'averageRating' : IDL.Float64,
    'updatedAt' : IDL.Nat64,
    'shortDescription' : IDL.Text,
    'degreeType' : DegreeType,
    'estimatedHours' : IDL.Nat,
    'completionCount' : IDL.Nat,
    'category' : IDL.Text,
    'totalCredits' : IDL.Nat,
    'electiveCourses' : IDL.Vec(IDL.Text),
    'programId' : IDL.Text,
    'requiredCourses' : IDL.Vec(IDL.Text),
    'instructorName' : IDL.Text,
    'enrollmentCount' : IDL.Nat,
  });
  const ForumCategory = IDL.Record({
    'categoryId' : IDL.Text,
    'postCount' : IDL.Nat,
    'lastThreadTitle' : IDL.Opt(IDL.Text),
    'lastThreadId' : IDL.Opt(IDL.Text),
    'icon' : IDL.Text,
    'lastActivity' : IDL.Opt(IDL.Nat64),
    'name' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'color' : IDL.Text,
    'slug' : IDL.Text,
    'description' : IDL.Text,
    'isActive' : IDL.Bool,
    'updatedAt' : IDL.Nat64,
    'threadCount' : IDL.Nat,
    'orderIndex' : IDL.Nat,
  });
  const PlanFeature = IDL.Record({
    'order' : IDL.Nat,
    'description' : IDL.Text,
    'enabled' : IDL.Bool,
  });
  const SubscriptionPlan = IDL.Record({
    'features' : IDL.Vec(PlanFeature),
    'originalPrice' : IDL.Opt(IDL.Nat),
    'order' : IDL.Nat,
    'name' : IDL.Text,
    'createdAt' : IDL.Int,
    'badges' : IDL.Vec(IDL.Text),
    'tier' : SubscriptionTier,
    'description' : IDL.Text,
    'isActive' : IDL.Bool,
    'stripeProductId' : IDL.Opt(IDL.Text),
    'updatedAt' : IDL.Int,
    'stripePriceId' : IDL.Opt(IDL.Text),
    'ctaText' : IDL.Text,
    'monthlyPrice' : IDL.Nat,
    'hostingCredits' : IDL.Nat,
    'maxProjects' : IDL.Opt(IDL.Nat),
    'monthlyCredits' : IDL.Nat,
    'discountPercentage' : IDL.Opt(IDL.Nat),
  });
  const Result_42 = IDL.Variant({ 'ok' : IDL.Vec(IDL.Text), 'err' : IDL.Text });
  const Course = IDL.Record({
    'title' : IDL.Text,
    'credits' : IDL.Nat,
    'thumbnailUrl' : IDL.Text,
    'isPublished' : IDL.Bool,
    'prerequisites' : IDL.Vec(IDL.Text),
    'instructor' : IDL.Principal,
    'difficulty' : DifficultyLevel,
    'createdAt' : IDL.Nat64,
    'tags' : IDL.Vec(IDL.Text),
    'description' : IDL.Text,
    'accessTier' : AccessTier,
    'lessonIds' : IDL.Vec(IDL.Text),
    'isActive' : IDL.Bool,
    'averageRating' : IDL.Float64,
    'updatedAt' : IDL.Nat64,
    'shortDescription' : IDL.Text,
    'estimatedHours' : IDL.Nat,
    'completionCount' : IDL.Nat,
    'category' : IDL.Text,
    'programId' : IDL.Opt(IDL.Text),
    'courseId' : IDL.Text,
    'syllabus' : IDL.Vec(SyllabusItem),
    'instructorName' : IDL.Text,
    'enrollmentCount' : IDL.Nat,
  });
  const Result_41 = IDL.Variant({ 'ok' : IDL.Vec(Course), 'err' : IDL.Text });
  const Result_40 = IDL.Variant({
    'ok' : IDL.Tuple(IDL.Vec(Course), IDL.Nat),
    'err' : IDL.Text,
  });
  const ListingTier = IDL.Variant({
    'featured' : IDL.Null,
    'premium' : IDL.Null,
    'basic' : IDL.Null,
  });
  const MarketplaceListing = IDL.Record({
    'exportId' : IDL.Text,
    'title' : IDL.Text,
    'premiumUntil' : IDL.Opt(IDL.Nat64),
    'isPublished' : IDL.Bool,
    'featuredUntil' : IDL.Opt(IDL.Nat64),
    'stripeAccountId' : IDL.Text,
    'listedAt' : IDL.Nat64,
    'listingId' : IDL.Text,
    'tags' : IDL.Vec(IDL.Text),
    'description' : IDL.Text,
    'seller' : IDL.Principal,
    'isActive' : IDL.Bool,
    'listingTier' : ListingTier,
    'version' : IDL.Text,
    'totalSales' : IDL.Nat,
    'updatedAt' : IDL.Nat64,
    'userCanisterId' : IDL.Principal,
    'projectId' : IDL.Text,
    'demoUrl' : IDL.Opt(IDL.Text),
    'category' : IDL.Text,
    'price' : IDL.Nat,
    'previewImages' : IDL.Vec(IDL.Text),
  });
  const Result_39 = IDL.Variant({
    'ok' : IDL.Vec(MarketplaceListing),
    'err' : IDL.Text,
  });
  const Result_38 = IDL.Variant({
    'ok' : IDL.Tuple(IDL.Vec(MarketplaceListing), IDL.Nat),
    'err' : IDL.Text,
  });
  const Timestamp = IDL.Nat64;
  const NotificationEvent = IDL.Record({
    'id' : IDL.Nat,
    'title' : IDL.Text,
    'expiresAt' : IDL.Opt(Timestamp),
    'metadata' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'icon' : IDL.Opt(IDL.Text),
    'createdBy' : IDL.Principal,
    'actions' : IDL.Opt(IDL.Vec(NotificationAction)),
    'targetAudience' : NotificationAudience,
    'message' : IDL.Text,
    'timestamp' : Timestamp,
    'category' : NotificationCategory,
    'severity' : NotificationSeverity,
    'isPinned' : IDL.Bool,
  });
  const Result_37 = IDL.Variant({
    'ok' : IDL.Vec(NotificationEvent),
    'err' : IDL.Text,
  });
  const PoolCanisterStatus = IDL.Variant({
    'Creating' : IDL.Null,
    'Available' : IDL.Null,
    'Failed' : IDL.Null,
    'Maintenance' : IDL.Null,
    'Assigned' : IDL.Null,
  });
  const PooledServerPair = IDL.Record({
    'status' : PoolCanisterStatus,
    'assignedAt' : IDL.Opt(IDL.Nat64),
    'assignedTo' : IDL.Opt(IDL.Principal),
    'metadata' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'frontendCanisterId' : IDL.Principal,
    'createdAt' : IDL.Nat64,
    'frontendCycles' : IDL.Opt(IDL.Nat),
    'backendCycles' : IDL.Opt(IDL.Nat),
    'backendCanisterId' : IDL.Principal,
    'poolType' : CanisterPoolType,
    'pairId' : IDL.Text,
  });
  const Result_36 = IDL.Variant({
    'ok' : IDL.Vec(PooledServerPair),
    'err' : IDL.Text,
  });
  const PooledCanister = IDL.Record({
    'durationDays' : IDL.Nat,
    'status' : PoolCanisterStatus,
    'assignedAt' : IDL.Opt(IDL.Nat64),
    'assignedTo' : IDL.Opt(IDL.Principal),
    'cycleBalance' : IDL.Opt(IDL.Nat),
    'metadata' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'createdAt' : IDL.Nat64,
    'memoryGB' : IDL.Nat,
    'poolType' : CanisterPoolType,
    'canisterId' : IDL.Principal,
  });
  const Result_35 = IDL.Variant({
    'ok' : IDL.Vec(PooledCanister),
    'err' : IDL.Text,
  });
  const Result_34 = IDL.Variant({
    'ok' : IDL.Vec(AcademicProgram),
    'err' : IDL.Text,
  });
  const Result_33 = IDL.Variant({
    'ok' : IDL.Tuple(IDL.Vec(AcademicProgram), IDL.Nat),
    'err' : IDL.Text,
  });
  const Result_32 = IDL.Variant({
    'ok' : IDL.Vec(SubscriptionPlan),
    'err' : IDL.Text,
  });
  const Result_31 = IDL.Variant({
    'ok' : IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Principal)),
    'err' : IDL.Text,
  });
  const Result_30 = IDL.Variant({
    'ok' : IDL.Record({
      'systemHealthRecords' : IDL.Nat,
      'featureUsageRecords' : IDL.Nat,
      'userActivityRecords' : IDL.Nat,
      'totalUsers' : IDL.Nat,
      'performanceRecords' : IDL.Nat,
      'errorRecords' : IDL.Nat,
      'revenueRecords' : IDL.Nat,
      'marketplaceRecords' : IDL.Nat,
    }),
    'err' : IDL.Text,
  });
  const ImportMethod = IDL.Variant({
    'fullDeploy' : IDL.Null,
    'download' : IDL.Null,
    'directImport' : IDL.Null,
  });
  const ProjectImport = IDL.Record({
    'importedProjectId' : IDL.Text,
    'importId' : IDL.Text,
    'listingId' : IDL.Text,
    'importedAt' : IDL.Nat64,
    'buyerUserCanisterId' : IDL.Principal,
    'buyer' : IDL.Principal,
    'purchaseId' : IDL.Text,
    'importMethod' : ImportMethod,
  });
  const PurchaseStatus = IDL.Variant({
    'pending' : IDL.Null,
    'completed' : IDL.Null,
    'refunded' : IDL.Null,
    'failed' : IDL.Null,
  });
  const VerifiedPurchase = IDL.Record({
    'status' : PurchaseStatus,
    'exportId' : IDL.Text,
    'listingId' : IDL.Text,
    'amountPaid' : IDL.Nat,
    'purchasedAt' : IDL.Nat64,
    'userCanisterId' : IDL.Principal,
    'projectId' : IDL.Text,
    'stripePaymentIntentId' : IDL.Text,
    'buyer' : IDL.Principal,
    'purchaseId' : IDL.Text,
  });
  const DateRange = IDL.Record({
    'endDate' : IDL.Nat64,
    'startDate' : IDL.Nat64,
  });
  const TimeWindow = IDL.Variant({
    'AllTime' : IDL.Null,
    'Last90Days' : IDL.Null,
    'Last7Days' : IDL.Null,
    'Last24Hours' : IDL.Null,
    'Custom' : DateRange,
    'Last30Days' : IDL.Null,
  });
  const RevenueMetrics = IDL.Record({
    'usersByPro' : IDL.Nat,
    'usersByEnterprise' : IDL.Nat,
    'revenueByStarter' : IDL.Nat,
    'revenueFromMarketplace' : IDL.Nat,
    'avgRevenuePerUser' : IDL.Nat,
    'revenueFromSubscriptions' : IDL.Nat,
    'revenueByPro' : IDL.Nat,
    'mrrCents' : IDL.Nat,
    'usersByStarter' : IDL.Nat,
    'revenueFromCredits' : IDL.Nat,
    'arrCents' : IDL.Nat,
    'conversionRate' : IDL.Float64,
    'revenueByFree' : IDL.Nat,
    'payingUsers' : IDL.Nat,
    'retentionRate' : IDL.Float64,
    'usersByFree' : IDL.Nat,
    'avgLifetimeValueCents' : IDL.Nat,
    'churnRate' : IDL.Float64,
    'totalRevenueCents' : IDL.Nat,
    'revenueByEnterprise' : IDL.Nat,
  });
  const MarketplaceMetrics = IDL.Record({
    'totalViews' : IDL.Nat,
    'avgSalePriceCents' : IDL.Nat,
    'salesThisWeek' : IDL.Nat,
    'activeListings' : IDL.Nat,
    'totalListings' : IDL.Nat,
    'topCategories' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat)),
    'totalSales' : IDL.Nat,
    'platformFeesCollectedCents' : IDL.Nat,
    'conversionRate' : IDL.Float64,
    'topSellers' : IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
    'salesThisMonth' : IDL.Nat,
    'totalRevenueCents' : IDL.Nat,
    'avgTimeToPurchase' : IDL.Nat,
  });
  const ErrorMetrics = IDL.Record({
    'errorsByMedium' : IDL.Nat,
    'errorsByAPI' : IDL.Nat,
    'errorsByLow' : IDL.Nat,
    'totalErrors' : IDL.Nat,
    'errorsToday' : IDL.Nat,
    'unresolvedErrors' : IDL.Nat,
    'errorRate' : IDL.Float64,
    'errorsThisWeek' : IDL.Nat,
    'avgResolutionTimeMs' : IDL.Nat,
    'errorsByCanister' : IDL.Nat,
    'errorsByAuth' : IDL.Nat,
    'errorsByHigh' : IDL.Nat,
    'errorsByCritical' : IDL.Nat,
    'errorsThisMonth' : IDL.Nat,
    'errorsByPayment' : IDL.Nat,
    'errorsByDeployment' : IDL.Nat,
  });
  const UserMetrics = IDL.Record({
    'newUsersToday' : IDL.Nat,
    'activeUsersThisMonth' : IDL.Nat,
    'avgSessionsPerUser' : IDL.Float64,
    'avgActionsPerUser' : IDL.Float64,
    'activeUsersToday' : IDL.Nat,
    'activeUsersThisWeek' : IDL.Nat,
    'totalUsers' : IDL.Nat,
    'totalUsersAllTime' : IDL.Nat,
    'newUsersThisWeek' : IDL.Nat,
    'newUsersThisMonth' : IDL.Nat,
    'topUsers' : IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
  });
  const OperationType = IDL.Variant({
    'HTTPOutcall' : IDL.Null,
    'DatabaseQuery' : IDL.Null,
    'Deployment' : IDL.Null,
    'FileUpload' : IDL.Null,
    'FileDownload' : IDL.Null,
    'APICall' : IDL.Null,
    'CanisterCall' : IDL.Null,
    'AIRequest' : IDL.Null,
  });
  const PerformanceMetrics = IDL.Record({
    'p99ResponseTimeMs' : IDL.Nat,
    'medianResponseTimeMs' : IDL.Nat,
    'avgFileUploadTimeMs' : IDL.Nat,
    'totalOperations' : IDL.Nat,
    'overallSuccessRate' : IDL.Float64,
    'avgDatabaseQueryTimeMs' : IDL.Nat,
    'cacheHitRate' : IDL.Float64,
    'avgResponseTimeMs' : IDL.Nat,
    'avgDeploymentTimeMs' : IDL.Nat,
    'p95ResponseTimeMs' : IDL.Nat,
    'avgAIRequestTimeMs' : IDL.Nat,
    'slowestOperations' : IDL.Vec(IDL.Tuple(OperationType, IDL.Nat)),
  });
  const FeatureType = IDL.Variant({
    'Marketplace' : IDL.Null,
    'AgentWorkflow' : IDL.Null,
    'CanisterDeploy' : IDL.Null,
    'AIChat' : IDL.Null,
    'ProjectDeploy' : IDL.Null,
    'ProjectCreate' : IDL.Null,
    'FileStorage' : IDL.Null,
    'DatabaseInterface' : IDL.Null,
    'ServerPairOps' : IDL.Null,
    'CodeGeneration' : IDL.Null,
  });
  const FeatureMetrics = IDL.Record({
    'aiRequestsByGemini' : IDL.Nat,
    'successRate' : IDL.Float64,
    'projectsDeployed' : IDL.Nat,
    'mostUsedFeatures' : IDL.Vec(IDL.Tuple(FeatureType, IDL.Nat)),
    'databaseQueries' : IDL.Nat,
    'aiRequestsByClaude' : IDL.Nat,
    'avgDurationMs' : IDL.Float64,
    'aiRequestsByOpenAI' : IDL.Nat,
    'projectsCreated' : IDL.Nat,
    'filesStored' : IDL.Nat,
    'aiRequestsTotal' : IDL.Nat,
    'aiRequestsByKimi' : IDL.Nat,
    'agentsDeployed' : IDL.Nat,
    'avgTokensPerRequest' : IDL.Float64,
    'totalFeatureUsage' : IDL.Nat,
  });
  const HealthStatus = IDL.Variant({
    'Healthy' : IDL.Null,
    'Critical' : IDL.Null,
    'Warning' : IDL.Null,
  });
  const SystemHealthMetrics = IDL.Record({
    'activeUsers' : IDL.Nat,
    'memoryUtilizationPercent' : IDL.Float64,
    'lastUpgradeTime' : IDL.Opt(IDL.Nat64),
    'memoryUsedBytes' : IDL.Nat,
    'httpOutcallsThisMonth' : IDL.Nat,
    'alerts' : IDL.Vec(IDL.Text),
    'estimatedDaysRemaining' : IDL.Nat,
    'currentCycles' : IDL.Nat,
    'healthStatus' : HealthStatus,
    'storageUsedBytes' : IDL.Nat,
    'uptimePercent' : IDL.Float64,
    'storageUtilizationPercent' : IDL.Float64,
    'totalUsers' : IDL.Nat,
    'httpOutcallsToday' : IDL.Nat,
    'storageCapacityBytes' : IDL.Nat,
    'cyclesBurnRatePerDay' : IDL.Nat,
    'memoryCapacityBytes' : IDL.Nat,
  });
  const DashboardData = IDL.Record({
    'revenue' : RevenueMetrics,
    'marketplace' : MarketplaceMetrics,
    'generatedAt' : IDL.Nat64,
    'errors' : ErrorMetrics,
    'userActivity' : UserMetrics,
    'performance' : PerformanceMetrics,
    'featureUsage' : FeatureMetrics,
    'systemHealth' : SystemHealthMetrics,
  });
  const Result_29 = IDL.Variant({ 'ok' : DashboardData, 'err' : IDL.Text });
  const DomainType = IDL.Variant({
    'Ai' : IDL.Null,
    'Io' : IDL.Null,
    'App' : IDL.Null,
    'Com' : IDL.Null,
    'Dev' : IDL.Null,
    'Net' : IDL.Null,
    'Tech' : IDL.Null,
    'Other' : IDL.Text,
    'Cloud' : IDL.Null,
  });
  const DomainStatistics = IDL.Record({
    'requiredNameSiloBalanceUSD' : IDL.Float64,
    'totalCostCents' : IDL.Nat,
    'avgCostPerDomainCents' : IDL.Nat,
    'totalDomainsPurchased' : IDL.Nat,
    'avgPurchasesPerMonth' : IDL.Float64,
    'renewalCostNext30DaysCents' : IDL.Nat,
    'renewalsNext30Days' : IDL.Nat,
    'domainsByType' : IDL.Vec(IDL.Tuple(DomainType, IDL.Nat)),
    'purchasesThisMonth' : IDL.Nat,
    'forecastedMonthlyCostCents' : IDL.Nat,
  });
  const Result_28 = IDL.Variant({ 'ok' : DomainStatistics, 'err' : IDL.Text });
  const Result_27 = IDL.Variant({ 'ok' : ErrorMetrics, 'err' : IDL.Text });
  const Result_26 = IDL.Variant({ 'ok' : FeatureMetrics, 'err' : IDL.Text });
  const FeePaymentStatus = IDL.Variant({
    'pending' : IDL.Null,
    'completed' : IDL.Null,
    'refunded' : IDL.Null,
    'failed' : IDL.Null,
  });
  const ListingFeeType = IDL.Variant({
    'featured' : IDL.Null,
    'premium' : IDL.Null,
    'basic' : IDL.Null,
  });
  const ListingFeePayment = IDL.Record({
    'status' : FeePaymentStatus,
    'refundReason' : IDL.Opt(IDL.Text),
    'listingId' : IDL.Text,
    'feeType' : ListingFeeType,
    'seller' : IDL.Principal,
    'amountPaid' : IDL.Nat,
    'refundedAt' : IDL.Opt(IDL.Nat64),
    'paymentId' : IDL.Text,
    'stripePaymentIntentId' : IDL.Text,
    'paidAt' : IDL.Nat64,
  });
  const Result_13 = IDL.Variant({ 'ok' : ListingFeePayment, 'err' : IDL.Text });
  const ForumReply = IDL.Record({
    'upvotes' : IDL.Nat,
    'isDeleted' : IDL.Bool,
    'content' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'authorName' : IDL.Text,
    'isAcceptedAnswer' : IDL.Bool,
    'author' : IDL.Principal,
    'updatedAt' : IDL.Nat64,
    'isEdited' : IDL.Bool,
    'replyId' : IDL.Text,
    'downvotes' : IDL.Nat,
    'threadId' : IDL.Text,
    'quotedReplyId' : IDL.Opt(IDL.Text),
  });
  const ForumStats = IDL.Record({
    'totalReplies' : IDL.Nat,
    'threadsToday' : IDL.Nat,
    'totalUsers' : IDL.Nat,
    'repliesToday' : IDL.Nat,
    'totalCategories' : IDL.Nat,
    'totalThreads' : IDL.Nat,
  });
  const ForumThread = IDL.Record({
    'categoryId' : IDL.Text,
    'upvotes' : IDL.Nat,
    'title' : IDL.Text,
    'content' : IDL.Text,
    'categoryName' : IDL.Text,
    'lastReplyByName' : IDL.Opt(IDL.Text),
    'createdAt' : IDL.Nat64,
    'tags' : IDL.Vec(IDL.Text),
    'authorName' : IDL.Text,
    'lastReplyAt' : IDL.Opt(IDL.Nat64),
    'lastReplyBy' : IDL.Opt(IDL.Principal),
    'hasAcceptedAnswer' : IDL.Bool,
    'author' : IDL.Principal,
    'acceptedAnswerId' : IDL.Opt(IDL.Text),
    'updatedAt' : IDL.Nat64,
    'viewCount' : IDL.Nat,
    'isFeatured' : IDL.Bool,
    'replyCount' : IDL.Nat,
    'isLocked' : IDL.Bool,
    'downvotes' : IDL.Nat,
    'threadId' : IDL.Text,
    'isPinned' : IDL.Bool,
  });
  const LearningPath = IDL.Record({
    'title' : IDL.Text,
    'difficulty' : DifficultyLevel,
    'programIds' : IDL.Vec(IDL.Text),
    'description' : IDL.Text,
    'courseIds' : IDL.Vec(IDL.Text),
    'estimatedHours' : IDL.Nat,
    'forRole' : IDL.Text,
    'pathId' : IDL.Text,
  });
  const Lesson = IDL.Record({
    'lessonId' : IDL.Text,
    'title' : IDL.Text,
    'duration' : IDL.Nat,
    'completionRate' : IDL.Float64,
    'isPublished' : IDL.Bool,
    'resources' : IDL.Vec(LessonResource),
    'createdAt' : IDL.Nat64,
    'description' : IDL.Text,
    'accessTier' : AccessTier,
    'isFree' : IDL.Bool,
    'averageRating' : IDL.Float64,
    'updatedAt' : IDL.Nat64,
    'viewCount' : IDL.Nat,
    'youtubeVideoId' : IDL.Text,
    'courseId' : IDL.Text,
    'transcript' : IDL.Opt(IDL.Text),
    'orderIndex' : IDL.Nat,
  });
  const ListingFeeConfig = IDL.Record({
    'featuredFee' : IDL.Nat,
    'featuredDurationDays' : IDL.Nat,
    'basicFee' : IDL.Nat,
    'premiumDurationDays' : IDL.Nat,
    'premiumFee' : IDL.Nat,
  });
  const ReviewSummary = IDL.Record({
    'listingId' : IDL.Text,
    'recommendationRate' : IDL.Float64,
    'averageRating' : IDL.Float64,
    'ratingDistribution' : IDL.Vec(IDL.Nat),
    'verifiedPurchaseRate' : IDL.Float64,
    'totalReviews' : IDL.Nat,
  });
  const SellerResponse = IDL.Record({
    'updatedAt' : IDL.Nat64,
    'responseText' : IDL.Text,
    'respondedAt' : IDL.Nat64,
  });
  const ProjectReview = IDL.Record({
    'title' : IDL.Text,
    'reportCount' : IDL.Nat,
    'listingId' : IDL.Text,
    'cons' : IDL.Vec(IDL.Text),
    'createdAt' : IDL.Nat64,
    'pros' : IDL.Vec(IDL.Text),
    'sellerResponse' : IDL.Opt(SellerResponse),
    'isVerifiedPurchase' : IDL.Bool,
    'comment' : IDL.Text,
    'updatedAt' : IDL.Nat64,
    'isHidden' : IDL.Bool,
    'hiddenReason' : IDL.Opt(IDL.Text),
    'rating' : IDL.Nat,
    'reviewId' : IDL.Text,
    'reviewer' : IDL.Principal,
    'helpfulCount' : IDL.Nat,
    'purchaseId' : IDL.Text,
    'wouldRecommend' : IDL.Bool,
  });
  const Result_25 = IDL.Variant({
    'ok' : MarketplaceMetrics,
    'err' : IDL.Text,
  });
  const EnrollmentStatus = IDL.Variant({
    'notStarted' : IDL.Null,
    'dropped' : IDL.Null,
    'completed' : IDL.Null,
    'suspended' : IDL.Null,
    'inProgress' : IDL.Null,
  });
  const CourseEnrollment = IDL.Record({
    'status' : EnrollmentStatus,
    'completedAt' : IDL.Opt(IDL.Nat64),
    'startedAt' : IDL.Opt(IDL.Nat64),
    'enrollmentId' : IDL.Text,
    'timeSpent' : IDL.Nat,
    'completedLessonIds' : IDL.Vec(IDL.Text),
    'progress' : IDL.Float64,
    'enrolledAt' : IDL.Nat64,
    'student' : IDL.Principal,
    'currentLessonId' : IDL.Opt(IDL.Text),
    'courseId' : IDL.Text,
    'lastAccessedAt' : IDL.Nat64,
  });
  const ProgramEnrollment = IDL.Record({
    'status' : EnrollmentStatus,
    'completedAt' : IDL.Opt(IDL.Nat64),
    'creditsEarned' : IDL.Nat,
    'startedAt' : IDL.Opt(IDL.Nat64),
    'enrollmentId' : IDL.Text,
    'completedCourseIds' : IDL.Vec(IDL.Text),
    'progress' : IDL.Float64,
    'enrolledAt' : IDL.Nat64,
    'student' : IDL.Principal,
    'currentCourseId' : IDL.Opt(IDL.Text),
    'programId' : IDL.Text,
  });
  const NotificationStats = IDL.Record({
    'oldestNotification' : IDL.Opt(Timestamp),
    'newestNotification' : IDL.Opt(Timestamp),
    'totalNotifications' : IDL.Nat,
    'notificationsByCategory' : IDL.Vec(
      IDL.Tuple(NotificationCategory, IDL.Nat)
    ),
    'notificationsBySeverity' : IDL.Vec(
      IDL.Tuple(NotificationSeverity, IDL.Nat)
    ),
  });
  const Result_24 = IDL.Variant({ 'ok' : NotificationStats, 'err' : IDL.Text });
  const PaymentStatus = IDL.Variant({
    'pending' : IDL.Null,
    'completed' : IDL.Null,
    'refunded' : IDL.Null,
    'failed' : IDL.Null,
  });
  const PaymentRecord = IDL.Record({
    'creditsGranted' : IDL.Nat,
    'status' : PaymentStatus,
    'tbCyclesRequested' : IDL.Float64,
    'icpSpent' : IDL.Nat,
    'userPrincipal' : IDL.Principal,
    'timestamp' : IDL.Int,
    'amountUSD' : IDL.Float64,
    'paymentIntentId' : IDL.Text,
  });
  const Result_23 = IDL.Variant({
    'ok' : IDL.Vec(PaymentRecord),
    'err' : IDL.Text,
  });
  const ReportStatus = IDL.Variant({
    'pending' : IDL.Null,
    'reviewed' : IDL.Null,
    'actionTaken' : IDL.Null,
    'dismissed' : IDL.Null,
  });
  const ReportReason = IDL.Variant({
    'misleading' : IDL.Null,
    'other' : IDL.Null,
    'spam' : IDL.Null,
    'irrelevant' : IDL.Null,
    'offensive' : IDL.Null,
  });
  const ReviewReport = IDL.Record({
    'status' : ReportStatus,
    'description' : IDL.Text,
    'resolution' : IDL.Opt(IDL.Text),
    'reportedAt' : IDL.Nat64,
    'reviewId' : IDL.Text,
    'reportId' : IDL.Text,
    'reporter' : IDL.Principal,
    'resolvedAt' : IDL.Opt(IDL.Nat64),
    'resolvedBy' : IDL.Opt(IDL.Principal),
    'reason' : ReportReason,
  });
  const Result_22 = IDL.Variant({
    'ok' : IDL.Vec(ReviewReport),
    'err' : IDL.Text,
  });
  const Result_21 = IDL.Variant({
    'ok' : PerformanceMetrics,
    'err' : IDL.Text,
  });
  const TransactionType = IDL.Variant({
    'sent' : IDL.Null,
    'canister' : IDL.Null,
    'received' : IDL.Null,
  });
  const Transaction = IDL.Record({
    'transactionType' : TransactionType,
    'isPositive' : IDL.Bool,
    'memo' : IDL.Opt(IDL.Text),
    'counterparty' : IDL.Text,
    'timestamp' : IDL.Int,
    'amount' : IDL.Nat,
  });
  const PoolStats = IDL.Record({
    'failedCount' : IDL.Nat,
    'maintenanceCount' : IDL.Nat,
    'totalCount' : IDL.Nat,
    'totalCyclesAllocated' : IDL.Nat,
    'availableCount' : IDL.Nat,
    'assignedCount' : IDL.Nat,
    'poolType' : CanisterPoolType,
    'creatingCount' : IDL.Nat,
  });
  const Result_20 = IDL.Variant({ 'ok' : PoolStats, 'err' : IDL.Text });
  const Result_19 = IDL.Variant({ 'ok' : RevenueMetrics, 'err' : IDL.Text });
  const SubscriptionAllocation = IDL.Record({
    'platformRevenuePercent' : IDL.Float64,
    'aiFundingPercent' : IDL.Float64,
    'monthlyPriceCents' : IDL.Nat,
    'aiFundingUSD' : IDL.Float64,
    'tier' : IDL.Text,
    'icpFundingPercent' : IDL.Float64,
    'platformRevenueUSD' : IDL.Float64,
    'rationale' : IDL.Text,
    'icpFundingUSD' : IDL.Float64,
  });
  const Result_18 = IDL.Variant({
    'ok' : IDL.Record({
      'active' : IDL.Bool,
      'expiresAt' : IDL.Nat64,
      'tier' : IDL.Text,
      'stripeCustomerId' : IDL.Opt(IDL.Text),
      'cached' : IDL.Bool,
    }),
    'err' : IDL.Text,
  });
  const Result_17 = IDL.Variant({
    'ok' : SystemHealthMetrics,
    'err' : IDL.Text,
  });
  const TeamMember = IDL.Record({
    'id' : IDL.Nat,
    'active' : IDL.Bool,
    'revenueSharePercent' : IDL.Float64,
    'name' : IDL.Text,
    'role' : IDL.Text,
    'creditCommissionShare' : IDL.Bool,
    'addedAt' : IDL.Nat64,
    'subscriptionShare' : IDL.Bool,
    'marketplaceShare' : IDL.Bool,
  });
  const Result_16 = IDL.Variant({
    'ok' : IDL.Vec(TeamMember),
    'err' : IDL.Text,
  });
  const Result_15 = IDL.Variant({ 'ok' : UserMetrics, 'err' : IDL.Text });
  const UserCanisterInfo = IDL.Record({
    'status' : IDL.Text,
    'controllers' : IDL.Vec(IDL.Principal),
    'cycleBalance' : IDL.Nat,
    'createdAt' : IDL.Nat64,
    'totalTopups' : IDL.Nat,
    'lastTopup' : IDL.Opt(IDL.Nat64),
    'userCanisterId' : IDL.Principal,
    'userPrincipal' : IDL.Principal,
    'memorySize' : IDL.Nat,
  });
  const Result_14 = IDL.Variant({ 'ok' : UserCanisterInfo, 'err' : IDL.Text });
  const UserForumProfile = IDL.Record({
    'isModerator' : IDL.Bool,
    'displayName' : IDL.Text,
    'userId' : IDL.Principal,
    'badges' : IDL.Vec(IDL.Text),
    'joinedAt' : IDL.Nat64,
    'reputation' : IDL.Int,
    'avatarUrl' : IDL.Opt(IDL.Text),
    'threadCount' : IDL.Nat,
    'replyCount' : IDL.Nat,
    'upvotesReceived' : IDL.Nat,
    'isAdmin' : IDL.Bool,
  });
  const VideoBookmark = IDL.Record({
    'title' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'timestamp' : IDL.Nat,
    'bookmarkId' : IDL.Text,
  });
  const VideoNote = IDL.Record({
    'content' : IDL.Text,
    'noteId' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'updatedAt' : IDL.Nat64,
    'timestamp' : IDL.Nat,
  });
  const VideoProgress = IDL.Record({
    'lessonId' : IDL.Text,
    'completedAt' : IDL.Opt(IDL.Nat64),
    'lastPosition' : IDL.Nat,
    'isCompleted' : IDL.Bool,
    'totalDuration' : IDL.Nat,
    'lastWatchedAt' : IDL.Nat64,
    'playbackSpeed' : IDL.Float64,
    'bookmarks' : IDL.Vec(VideoBookmark),
    'progressPercent' : IDL.Float64,
    'watchedDuration' : IDL.Nat,
    'notes' : IDL.Vec(VideoNote),
    'progressId' : IDL.Text,
    'student' : IDL.Principal,
    'watchCount' : IDL.Nat,
  });
  const Result_7 = IDL.Variant({ 'ok' : MarketplaceListing, 'err' : IDL.Text });
  const SearchResultType = IDL.Variant({
    'Reply' : IDL.Null,
    'Thread' : IDL.Null,
  });
  const SearchResult = IDL.Record({
    'id' : IDL.Text,
    'title' : IDL.Text,
    'categoryName' : IDL.Opt(IDL.Text),
    'createdAt' : IDL.Nat64,
    'authorName' : IDL.Text,
    'author' : IDL.Principal,
    'excerpt' : IDL.Text,
    'resultType' : SearchResultType,
  });
  const Result_12 = IDL.Variant({
    'ok' : IDL.Opt(
      IDL.Record({ 'email' : IDL.Opt(IDL.Text), 'customerId' : IDL.Text })
    ),
    'err' : IDL.Text,
  });
  const ErrorType = IDL.Variant({
    'CanisterError' : IDL.Null,
    'NetworkError' : IDL.Null,
    'PaymentFailed' : IDL.Null,
    'DeploymentFailed' : IDL.Null,
    'UnknownError' : IDL.Null,
    'ValidationError' : IDL.Null,
    'AuthenticationError' : IDL.Null,
    'APIError' : IDL.Null,
    'StorageError' : IDL.Null,
  });
  const ErrorSeverity = IDL.Variant({
    'Low' : IDL.Null,
    'High' : IDL.Null,
    'Medium' : IDL.Null,
    'Critical' : IDL.Null,
  });
  const AIModel = IDL.Variant({
    'Kimi' : IDL.Null,
    'Claude' : IDL.Null,
    'OpenAI' : IDL.Null,
    'Gemini' : IDL.Null,
  });
  const MarketplaceAction = IDL.Variant({
    'ProjectSold' : IDL.Null,
    'ListingUnpublished' : IDL.Null,
    'ListingUpdated' : IDL.Null,
    'ProjectDownloaded' : IDL.Null,
    'ListingViewed' : IDL.Null,
    'ListingCreated' : IDL.Null,
    'ListingPublished' : IDL.Null,
  });
  const PaymentType = IDL.Variant({
    'MarketplaceSale' : IDL.Null,
    'MarketplacePlatformFee' : IDL.Null,
    'Credits' : IDL.Null,
    'Subscription' : IDL.Null,
  });
  const PaymentStatus__1 = IDL.Variant({
    'Failed' : IDL.Null,
    'Refunded' : IDL.Null,
    'Succeeded' : IDL.Null,
    'Pending' : IDL.Null,
  });
  const UserAction = IDL.Variant({
    'Login' : IDL.Null,
    'AgentDeployed' : IDL.Null,
    'SubscriptionPurchased' : IDL.Null,
    'DatabaseQuery' : IDL.Null,
    'ProjectDeployed' : IDL.Null,
    'MarketplacePurchase' : IDL.Null,
    'MarketplaceListing' : IDL.Null,
    'CreditsPurchased' : IDL.Null,
    'Logout' : IDL.Null,
    'FileUploaded' : IDL.Null,
    'AgentCreated' : IDL.Null,
    'AIRequest' : IDL.Null,
    'ProjectCreated' : IDL.Null,
  });
  const CanisterDefaultSettings = IDL.Record({
    'durationInDays' : IDL.Nat,
    'freezingThreshold' : IDL.Opt(IDL.Nat),
    'memoryGB' : IDL.Nat,
    'computeAllocation' : IDL.Nat,
    'cyclesAmount' : IDL.Nat,
  });
  const Result_10 = IDL.Variant({ 'ok' : ListingFeeConfig, 'err' : IDL.Text });
  const Result_6 = IDL.Variant({
    'ok' : IDL.Record({ 'receivedChunks' : IDL.Nat, 'totalChunks' : IDL.Nat }),
    'err' : IDL.Text,
  });
  const SubscriptionPlanInput = IDL.Record({
    'features' : IDL.Vec(PlanFeature),
    'originalPrice' : IDL.Opt(IDL.Nat),
    'order' : IDL.Nat,
    'name' : IDL.Text,
    'badges' : IDL.Vec(IDL.Text),
    'tier' : SubscriptionTier,
    'description' : IDL.Text,
    'isActive' : IDL.Bool,
    'stripeProductId' : IDL.Opt(IDL.Text),
    'stripePriceId' : IDL.Opt(IDL.Text),
    'ctaText' : IDL.Text,
    'monthlyPrice' : IDL.Nat,
    'hostingCredits' : IDL.Nat,
    'maxProjects' : IDL.Opt(IDL.Nat),
    'monthlyCredits' : IDL.Nat,
    'discountPercentage' : IDL.Opt(IDL.Nat),
  });
  const Result_5 = IDL.Variant({ 'ok' : SubscriptionPlan, 'err' : IDL.Text });
  const DownloadToken = IDL.Record({
    'exportId' : IDL.Text,
    'lastUsedAt' : IDL.Opt(IDL.Nat64),
    'tokenId' : IDL.Text,
    'expiresAt' : IDL.Nat64,
    'isRevoked' : IDL.Bool,
    'listingId' : IDL.Text,
    'createdAt' : IDL.Nat64,
    'userCanisterId' : IDL.Principal,
    'maxDownloads' : IDL.Nat,
    'downloadCount' : IDL.Nat,
    'buyer' : IDL.Principal,
    'purchaseId' : IDL.Text,
    'revokedAt' : IDL.Opt(IDL.Nat64),
    'revokedReason' : IDL.Opt(IDL.Text),
  });
  const Result_4 = IDL.Variant({ 'ok' : DownloadToken, 'err' : IDL.Text });
  const Result_3 = IDL.Variant({ 'ok' : PaymentRecord, 'err' : IDL.Text });
  const Result_2 = IDL.Variant({
    'ok' : IDL.Record({
      'id' : IDL.Text,
      'status' : IDL.Text,
      'currency' : IDL.Text,
      'amount' : IDL.Nat,
    }),
    'err' : IDL.Text,
  });
  const Result_1 = IDL.Variant({ 'ok' : VerifiedPurchase, 'err' : IDL.Text });
  const VoteType = IDL.Variant({ 'Downvote' : IDL.Null, 'Upvote' : IDL.Null });
  return IDL.Service({
    'addAdmin' : IDL.Func([IDL.Principal], [Result_8], []),
    'addServerPairToPool' : IDL.Func(
        [
          IDL.Text,
          IDL.Principal,
          IDL.Principal,
          CanisterPoolType,
          IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
        ],
        [Result_9],
        [],
      ),
    'addTeamMember' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Float64, IDL.Bool, IDL.Bool, IDL.Bool],
        [Result_11],
        [],
      ),
    'addUserCanisterToPool' : IDL.Func(
        [
          IDL.Principal,
          IDL.Nat,
          IDL.Nat,
          IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
        ],
        [Result_9],
        [],
      ),
    'addVideoBookmark' : IDL.Func([IDL.Text, IDL.Nat, IDL.Text], [Result], []),
    'addVideoNote' : IDL.Func([IDL.Text, IDL.Nat, IDL.Text], [Result], []),
    'adminReplaceUserCanister' : IDL.Func(
        [IDL.Principal, IDL.Principal, IDL.Text],
        [Result_50],
        [],
      ),
    'adminTopUpUserCanister' : IDL.Func(
        [IDL.Principal, IDL.Nat],
        [Result_8],
        [],
      ),
    'assignServerPairFromPool' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result_9],
        [],
      ),
    'assignUserCanisterFromPool' : IDL.Func(
        [IDL.Principal, IDL.Principal],
        [Result_9],
        [],
      ),
    'calculateAITokenReserve' : IDL.Func([], [Result_49], ['query']),
    'calculateICPReserve' : IDL.Func([], [Result_48], []),
    'calculateTeamEarnings' : IDL.Func([], [Result_47], ['query']),
    'clearAllLogs' : IDL.Func([], [IDL.Nat], []),
    'clearAnalyticsCache' : IDL.Func([], [Result], []),
    'clearSubscriptionCache' : IDL.Func([], [Result], []),
    'createAcademicProgram' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Vec(IDL.Text),
          IDL.Vec(IDL.Text),
          IDL.Vec(IDL.Text),
          IDL.Nat,
          IDL.Nat,
          DifficultyLevel,
          IDL.Text,
          IDL.Vec(IDL.Text),
          IDL.Vec(IDL.Text),
          DegreeType,
        ],
        [Result_8],
        [],
      ),
    'createBillingPortalSession' : IDL.Func(
        [IDL.Text, IDL.Text],
        [Result_46],
        [],
      ),
    'createCanisterWithSettings' : IDL.Func(
        [IDL.Principal, IDL.Nat, IDL.Nat, IDL.Opt(IDL.Nat), IDL.Nat, IDL.Nat],
        [Result_8],
        [],
      ),
    'createCheckoutSession' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Text],
        [Result_45],
        [],
      ),
    'createCourse' : IDL.Func(
        [
          IDL.Opt(IDL.Text),
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Vec(IDL.Text),
          IDL.Nat,
          IDL.Nat,
          DifficultyLevel,
          IDL.Text,
          IDL.Vec(IDL.Text),
          IDL.Vec(IDL.Text),
          AccessTier,
          IDL.Vec(SyllabusItem),
        ],
        [Result_8],
        [],
      ),
    'createForumCategory' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Nat],
        [IDL.Text],
        [],
      ),
    'createForumReply' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Opt(IDL.Text)],
        [IDL.Text],
        [],
      ),
    'createForumThread' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Vec(IDL.Text)],
        [IDL.Text],
        [],
      ),
    'createLearningPath' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Vec(IDL.Text),
          IDL.Vec(IDL.Text),
          IDL.Nat,
          DifficultyLevel,
          IDL.Text,
        ],
        [Result_8],
        [],
      ),
    'createLesson' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Nat,
          IDL.Nat,
          AccessTier,
          IDL.Bool,
          IDL.Vec(LessonResource),
          IDL.Opt(IDL.Text),
        ],
        [Result_8],
        [],
      ),
    'createNotification' : IDL.Func(
        [
          NotificationSeverity,
          NotificationCategory,
          NotificationAudience,
          IDL.Text,
          IDL.Text,
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
          IDL.Opt(IDL.Vec(NotificationAction)),
          IDL.Opt(IDL.Nat64),
          IDL.Bool,
        ],
        [Result_11],
        [],
      ),
    'createPaymentIntent' : IDL.Func(
        [IDL.Nat, IDL.Text, IDL.Text],
        [Result_44],
        [],
      ),
    'createPlatformWallet' : IDL.Func([], [IDL.Text], []),
    'createReview' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Nat,
          IDL.Text,
          IDL.Text,
          IDL.Vec(IDL.Text),
          IDL.Vec(IDL.Text),
          IDL.Bool,
        ],
        [Result_8],
        [],
      ),
    'deleteCanister' : IDL.Func([IDL.Principal], [Result_8], []),
    'deleteForumCategory' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'deleteForumReply' : IDL.Func([IDL.Text, IDL.Text], [IDL.Bool], []),
    'deleteForumThread' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'deleteMarketplaceListing' : IDL.Func([IDL.Text], [Result], []),
    'deleteNotification' : IDL.Func([IDL.Nat], [Result_9], []),
    'deleteReview' : IDL.Func([IDL.Text], [Result], []),
    'deleteSubscriptionPlan' : IDL.Func([SubscriptionTier], [Result_9], []),
    'deployStoredWasm' : IDL.Func(
        [IDL.Text, IDL.Principal, IDL.Principal],
        [Result_8],
        [],
      ),
    'deployToExistingCanister' : IDL.Func(
        [IDL.Principal, IDL.Vec(IDL.Nat8)],
        [Result_8],
        [],
      ),
    'dismissNotification' : IDL.Func([IDL.Nat], [], []),
    'enrollInCourse' : IDL.Func([IDL.Text], [Result_8], []),
    'enrollInProgram' : IDL.Func([IDL.Text], [Result_8], []),
    'finalizeWasmUpload' : IDL.Func([IDL.Text], [Result_8], []),
    'generateDownloadToken' : IDL.Func([IDL.Text], [Result_43], []),
    'generateTestLogs' : IDL.Func([], [], []),
    'getAcademicProgram' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(AcademicProgram)],
        ['query'],
      ),
    'getActiveForumCategories' : IDL.Func(
        [],
        [IDL.Vec(ForumCategory)],
        ['query'],
      ),
    'getActiveSubscriptionPlans' : IDL.Func(
        [],
        [IDL.Vec(SubscriptionPlan)],
        ['query'],
      ),
    'getAdminPrincipal' : IDL.Func([], [Result_8], []),
    'getAdmins' : IDL.Func([], [Result_42], []),
    'getAllCourses' : IDL.Func([], [Result_41], ['query']),
    'getAllCoursesPaginated' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [Result_40],
        ['query'],
      ),
    'getAllForumCategories' : IDL.Func([], [IDL.Vec(ForumCategory)], ['query']),
    'getAllListings' : IDL.Func([], [Result_39], ['query']),
    'getAllListingsPaginated' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [Result_38],
        ['query'],
      ),
    'getAllNotifications' : IDL.Func([], [Result_37], ['query']),
    'getAllPooledServerPairs' : IDL.Func(
        [IDL.Opt(CanisterPoolType)],
        [Result_36],
        ['query'],
      ),
    'getAllPooledUserCanisters' : IDL.Func([], [Result_35], ['query']),
    'getAllPrograms' : IDL.Func([], [Result_34], ['query']),
    'getAllProgramsPaginated' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [Result_33],
        ['query'],
      ),
    'getAllSubscriptionPlans' : IDL.Func(
        [IDL.Principal],
        [Result_32],
        ['query'],
      ),
    'getAllUserCanisters' : IDL.Func([], [Result_31], ['query']),
    'getAnalyticsDataCounts' : IDL.Func([], [Result_30], ['query']),
    'getAvailableServerPairFromPool' : IDL.Func(
        [CanisterPoolType],
        [IDL.Opt(PooledServerPair)],
        [],
      ),
    'getAvailableUserCanisterFromPool' : IDL.Func(
        [],
        [IDL.Opt(PooledCanister)],
        [],
      ),
    'getBuyerImports' : IDL.Func([], [IDL.Vec(ProjectImport)], ['query']),
    'getBuyerPurchases' : IDL.Func([], [IDL.Vec(VerifiedPurchase)], ['query']),
    'getCallerPrincipal' : IDL.Func([], [IDL.Text], []),
    'getCourse' : IDL.Func([IDL.Text], [IDL.Opt(Course)], ['query']),
    'getCoursesByTier' : IDL.Func([AccessTier], [IDL.Vec(Course)], ['query']),
    'getCoursesByTierPaginated' : IDL.Func(
        [AccessTier, IDL.Nat, IDL.Nat],
        [IDL.Vec(Course), IDL.Nat],
        ['query'],
      ),
    'getCreditCommissionPercent' : IDL.Func([], [IDL.Float64], ['query']),
    'getDashboardData' : IDL.Func([TimeWindow], [Result_29], ['query']),
    'getDomainStatistics' : IDL.Func([], [Result_28], ['query']),
    'getErrorMetrics' : IDL.Func([TimeWindow], [Result_27], ['query']),
    'getFeatureUsageMetrics' : IDL.Func([TimeWindow], [Result_26], ['query']),
    'getFeePaymentById' : IDL.Func([IDL.Text], [Result_13], ['query']),
    'getFinancialDashboard' : IDL.Func([], [Result_8], []),
    'getForumCategory' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(ForumCategory)],
        ['query'],
      ),
    'getForumReplies' : IDL.Func([IDL.Text], [IDL.Vec(ForumReply)], ['query']),
    'getForumRepliesPaginated' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Nat],
        [IDL.Vec(ForumReply), IDL.Nat],
        ['query'],
      ),
    'getForumStats' : IDL.Func([], [ForumStats], ['query']),
    'getForumThread' : IDL.Func([IDL.Text], [IDL.Opt(ForumThread)], ['query']),
    'getForumThreadsByCategory' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(ForumThread)],
        ['query'],
      ),
    'getForumThreadsByCategoryPaginated' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Nat],
        [IDL.Vec(ForumThread), IDL.Nat],
        ['query'],
      ),
    'getLearningPaths' : IDL.Func([], [IDL.Vec(LearningPath)], ['query']),
    'getLesson' : IDL.Func([IDL.Text], [IDL.Opt(Lesson)], ['query']),
    'getLessonsByCourse' : IDL.Func([IDL.Text], [IDL.Vec(Lesson)], ['query']),
    'getLessonsByCoursePaginated' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Nat],
        [IDL.Vec(Lesson), IDL.Nat],
        ['query'],
      ),
    'getListingFeeConfig' : IDL.Func([], [ListingFeeConfig], ['query']),
    'getListingReviewSummary' : IDL.Func(
        [IDL.Text],
        [ReviewSummary],
        ['query'],
      ),
    'getListingReviews' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(ProjectReview)],
        ['query'],
      ),
    'getListingsByCategory' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(MarketplaceListing)],
        ['query'],
      ),
    'getListingsByCategoryPaginated' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Nat],
        [IDL.Vec(MarketplaceListing), IDL.Nat],
        ['query'],
      ),
    'getLoggerStatus' : IDL.Func(
        [],
        [
          IDL.Record({
            'canisterType' : IDL.Text,
            'logsAvailable' : IDL.Bool,
            'loggerInitialized' : IDL.Bool,
          }),
        ],
        ['query'],
      ),
    'getLogs' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'getMarketplaceListing' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(MarketplaceListing)],
        ['query'],
      ),
    'getMarketplaceMetrics' : IDL.Func([TimeWindow], [Result_25], ['query']),
    'getMyEnrollments' : IDL.Func(
        [],
        [
          IDL.Record({
            'courses' : IDL.Vec(CourseEnrollment),
            'programs' : IDL.Vec(ProgramEnrollment),
          }),
        ],
        ['query'],
      ),
    'getNewLogsSince' : IDL.Func(
        [IDL.Nat, IDL.Opt(IDL.Nat)],
        [IDL.Record({ 'logs' : IDL.Vec(IDL.Text), 'nextMarker' : IDL.Nat })],
        ['query'],
      ),
    'getNotificationStats' : IDL.Func([], [Result_24], ['query']),
    'getNotifications' : IDL.Func(
        [IDL.Nat64, IDL.Opt(IDL.Nat)],
        [IDL.Vec(NotificationEvent)],
        ['query'],
      ),
    'getPaymentHistory' : IDL.Func([IDL.Opt(IDL.Principal)], [Result_23], []),
    'getPendingReviewReports' : IDL.Func([], [Result_22], ['query']),
    'getPerformanceMetrics' : IDL.Func([TimeWindow], [Result_21], ['query']),
    'getPlatformBalance' : IDL.Func([], [IDL.Nat], []),
    'getPlatformCycleBalance' : IDL.Func([], [IDL.Nat], []),
    'getPlatformTransactions' : IDL.Func(
        [IDL.Opt(IDL.Nat)],
        [IDL.Vec(Transaction)],
        ['query'],
      ),
    'getPlatformWalletId' : IDL.Func(
        [],
        [
          IDL.Opt(
            IDL.Record({
              'principal' : IDL.Text,
              'subaccount' : IDL.Text,
              'accountIdentifier' : IDL.Text,
            })
          ),
        ],
        ['query'],
      ),
    'getPoolStats' : IDL.Func([CanisterPoolType], [Result_20], ['query']),
    'getPricingInfo' : IDL.Func(
        [],
        [
          IDL.Record({
            'maxAmountUSD' : IDL.Float64,
            'description' : IDL.Text,
            'creditsPerUSD' : IDL.Nat,
            'minAmountUSD' : IDL.Float64,
          }),
        ],
        ['query'],
      ),
    'getPublishedCourses' : IDL.Func([], [IDL.Vec(Course)], ['query']),
    'getPublishedCoursesPaginated' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [IDL.Vec(Course), IDL.Nat],
        ['query'],
      ),
    'getPublishedListings' : IDL.Func(
        [],
        [IDL.Vec(MarketplaceListing)],
        ['query'],
      ),
    'getPublishedListingsPaginated' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [IDL.Vec(MarketplaceListing), IDL.Nat],
        ['query'],
      ),
    'getPublishedPrograms' : IDL.Func(
        [],
        [IDL.Vec(AcademicProgram)],
        ['query'],
      ),
    'getPublishedProgramsPaginated' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [IDL.Vec(AcademicProgram), IDL.Nat],
        ['query'],
      ),
    'getRemoteFilesConfig' : IDL.Func(
        [],
        [
          IDL.Record({
            'frontendRules' : IDL.Text,
            'assetStorageWasm' : IDL.Text,
            'agentWasm' : IDL.Text,
            'backendRules' : IDL.Text,
            'assetCanisterId' : IDL.Text,
            'frontendPrompt' : IDL.Text,
            'agencyWasm' : IDL.Text,
            'agentWasmGz' : IDL.Text,
            'backendPrompt' : IDL.Text,
            'userCanisterWasm' : IDL.Text,
            'agencyWasmGz' : IDL.Text,
            'basePath' : IDL.Text,
          }),
        ],
        ['query'],
      ),
    'getRevenueMetrics' : IDL.Func([TimeWindow], [Result_19], ['query']),
    'getSellerFeePayments' : IDL.Func(
        [],
        [IDL.Vec(ListingFeePayment)],
        ['query'],
      ),
    'getSellerListings' : IDL.Func(
        [],
        [IDL.Vec(MarketplaceListing)],
        ['query'],
      ),
    'getSellerListingsPaginated' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [IDL.Vec(MarketplaceListing), IDL.Nat],
        ['query'],
      ),
    'getSellerSales' : IDL.Func([], [IDL.Vec(VerifiedPurchase)], ['query']),
    'getStripePublishableKey' : IDL.Func([], [IDL.Text], ['query']),
    'getSubscriptionAllocations' : IDL.Func(
        [],
        [IDL.Vec(SubscriptionAllocation)],
        ['query'],
      ),
    'getSubscriptionPlanByTier' : IDL.Func(
        [SubscriptionTier],
        [IDL.Opt(SubscriptionPlan)],
        ['query'],
      ),
    'getSubscriptionPrompt' : IDL.Func([IDL.Principal], [Result_8], ['query']),
    'getSubscriptionStatus' : IDL.Func([IDL.Bool], [Result_18], []),
    'getSystemHealthMetrics' : IDL.Func([], [Result_17], ['query']),
    'getTeamMembers' : IDL.Func([], [Result_16], ['query']),
    'getUnreadNotificationCount' : IDL.Func([], [IDL.Nat], ['query']),
    'getUserActivityMetrics' : IDL.Func([TimeWindow], [Result_15], ['query']),
    'getUserCanisterInfo' : IDL.Func([IDL.Principal], [Result_14], []),
    'getUserForumProfile' : IDL.Func(
        [IDL.Principal],
        [IDL.Opt(UserForumProfile)],
        ['query'],
      ),
    'getUserPlatformCanister' : IDL.Func(
        [IDL.Principal],
        [IDL.Vec(IDL.Principal)],
        [],
      ),
    'getVideoProgress' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(VideoProgress)],
        ['query'],
      ),
    'getWasmConfig' : IDL.Func(
        [],
        [
          IDL.Record({
            'assetStorageWasm' : IDL.Text,
            'agentWasm' : IDL.Text,
            'assetCanisterId' : IDL.Text,
            'agencyWasm' : IDL.Text,
            'agentWasmGz' : IDL.Text,
            'userCanisterWasm' : IDL.Text,
            'agencyWasmGz' : IDL.Text,
            'basePath' : IDL.Text,
          }),
        ],
        ['query'],
      ),
    'hideReview' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'http_request' : IDL.Func(
        [
          IDL.Record({
            'url' : IDL.Text,
            'method' : IDL.Text,
            'body' : IDL.Vec(IDL.Nat8),
            'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
          }),
        ],
        [
          IDL.Record({
            'body' : IDL.Vec(IDL.Nat8),
            'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
            'status_code' : IDL.Nat16,
          }),
        ],
        ['query'],
      ),
    'http_request_update' : IDL.Func(
        [
          IDL.Record({
            'url' : IDL.Text,
            'method' : IDL.Text,
            'body' : IDL.Vec(IDL.Nat8),
            'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
          }),
        ],
        [
          IDL.Record({
            'body' : IDL.Vec(IDL.Nat8),
            'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
            'status_code' : IDL.Nat16,
          }),
        ],
        [],
      ),
    'importPurchasedProject' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result_8],
        [],
      ),
    'incrementForumThreadViews' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'initializeDefaultSubscriptionPlans' : IDL.Func([], [Result_8], []),
    'isAdmin' : IDL.Func([], [IDL.Bool], []),
    'isListingFeePaid' : IDL.Func([IDL.Text], [IDL.Bool], ['query']),
    'isListingTierActive' : IDL.Func([IDL.Text], [IDL.Bool], ['query']),
    'lockForumThread' : IDL.Func([IDL.Text, IDL.Bool], [IDL.Bool], []),
    'logDebug' : IDL.Func([IDL.Text], [], []),
    'logError' : IDL.Func([IDL.Text], [], []),
    'logInfo' : IDL.Func([IDL.Text], [], []),
    'logWarn' : IDL.Func([IDL.Text], [], []),
    'markAcceptedAnswer' : IDL.Func([IDL.Text, IDL.Text], [IDL.Bool], []),
    'markNotificationsAsRead' : IDL.Func([IDL.Nat64], [], []),
    'markTokenUsed' : IDL.Func([IDL.Text], [Result], []),
    'pinForumThread' : IDL.Func([IDL.Text, IDL.Bool], [IDL.Bool], []),
    'pruneOldNotifications' : IDL.Func([], [Result_11], []),
    'publishListing' : IDL.Func([IDL.Text], [Result], []),
    'recordListingFeePayment' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat, ListingFeeType],
        [Result_13],
        [],
      ),
    'recordPaymentAndCreditUser' : IDL.Func(
        [IDL.Text, IDL.Float64, IDL.Principal],
        [Result_8],
        [],
      ),
    'recordPaymentWithCalculatedICP' : IDL.Func(
        [IDL.Text, IDL.Float64, IDL.Principal, IDL.Nat, IDL.Float64, IDL.Nat],
        [Result_8],
        [],
      ),
    'recordSystemHealth' : IDL.Func([], [], []),
    'refundListingFee' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'registerMarketplaceListing' : IDL.Func(
        [
          IDL.Text,
          IDL.Principal,
          IDL.Text,
          IDL.Text,
          IDL.Text,
          IDL.Nat,
          IDL.Text,
          IDL.Vec(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Text,
          IDL.Vec(IDL.Text),
          IDL.Text,
        ],
        [Result_7],
        [],
      ),
    'removeAdmin' : IDL.Func([IDL.Principal], [Result_8], []),
    'removeServerPairFromPool' : IDL.Func([IDL.Text], [Result_9], []),
    'removeUserCanisterFromPool' : IDL.Func([IDL.Principal], [Result_9], []),
    'removeUserPlatformCanister' : IDL.Func([IDL.Principal], [Result_8], []),
    'reportReview' : IDL.Func(
        [IDL.Text, ReportReason, IDL.Text],
        [Result_8],
        [],
      ),
    'resolveError' : IDL.Func([IDL.Nat], [Result], []),
    'respondToReview' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'revokeDownloadToken' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'searchForum' : IDL.Func([IDL.Text], [IDL.Vec(SearchResult)], ['query']),
    'searchForumPaginated' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Nat],
        [IDL.Vec(SearchResult), IDL.Nat],
        ['query'],
      ),
    'searchStripeCustomer' : IDL.Func([IDL.Principal], [Result_12], []),
    'sendICPFromPlatform' : IDL.Func([IDL.Principal, IDL.Nat], [Result_8], []),
    'sendICPFromPlatformToAccountId' : IDL.Func(
        [IDL.Text, IDL.Nat],
        [Result_8],
        [],
      ),
    'startWasmUploadSession' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Nat],
        [Result_8],
        [],
      ),
    'topUpCanisterCMC' : IDL.Func([IDL.Principal, IDL.Nat], [Result_8], []),
    'topUpUserCanisterFromPlatform' : IDL.Func(
        [IDL.Principal, IDL.Float64],
        [Result_8],
        [],
      ),
    'topUpUserCanisterWithExactICP' : IDL.Func(
        [IDL.Principal, IDL.Nat],
        [Result_8],
        [],
      ),
    'trackCreditCommission' : IDL.Func(
        [IDL.Principal, IDL.Nat, IDL.Nat],
        [],
        [],
      ),
    'trackDomainPurchase' : IDL.Func(
        [IDL.Text, DomainType, IDL.Nat, IDL.Text],
        [Result_11],
        [],
      ),
    'trackError' : IDL.Func(
        [
          ErrorType,
          IDL.Text,
          IDL.Opt(IDL.Text),
          ErrorSeverity,
          IDL.Opt(IDL.Text),
        ],
        [IDL.Nat],
        [],
      ),
    'trackFeatureUsage' : IDL.Func(
        [
          FeatureType,
          IDL.Opt(AIModel),
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Nat),
          IDL.Bool,
          IDL.Opt(IDL.Text),
        ],
        [],
        [],
      ),
    'trackMarketplaceActivity' : IDL.Func(
        [
          IDL.Text,
          IDL.Principal,
          IDL.Opt(IDL.Principal),
          MarketplaceAction,
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Text),
        ],
        [],
        [],
      ),
    'trackPerformance' : IDL.Func([OperationType, IDL.Nat, IDL.Bool], [], []),
    'trackRevenue' : IDL.Func(
        [
          IDL.Nat,
          IDL.Text,
          IDL.Opt(IDL.Text),
          PaymentType,
          PaymentStatus__1,
          IDL.Opt(IDL.Text),
        ],
        [],
        [],
      ),
    'trackUserActivity' : IDL.Func(
        [UserAction, IDL.Opt(IDL.Text), IDL.Opt(IDL.Text)],
        [],
        [],
      ),
    'unhideReview' : IDL.Func([IDL.Text], [Result], []),
    'unpublishListing' : IDL.Func([IDL.Text], [Result], []),
    'updateAcademicCourse' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Vec(IDL.Text)),
          IDL.Opt(IDL.Bool),
          IDL.Opt(IDL.Bool),
        ],
        [Result],
        [],
      ),
    'updateAcademicProgram' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Vec(IDL.Text)),
          IDL.Opt(IDL.Bool),
        ],
        [Result],
        [],
      ),
    'updateAdminPrincipal' : IDL.Func([IDL.Text], [Result_8], []),
    'updateCanisterDefaults' : IDL.Func(
        [CanisterDefaultSettings],
        [Result_8],
        [],
      ),
    'updateCurrentBalances' : IDL.Func(
        [IDL.Float64, IDL.Float64],
        [Result],
        [],
      ),
    'updateForumCategory' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Bool),
        ],
        [IDL.Bool],
        [],
      ),
    'updateForumReply' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text],
        [IDL.Bool],
        [],
      ),
    'updateForumThread' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Vec(IDL.Text)),
        ],
        [IDL.Bool],
        [],
      ),
    'updateListingFeeConfig' : IDL.Func(
        [
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Nat),
        ],
        [Result_10],
        [],
      ),
    'updateMarketplaceListing' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Vec(IDL.Text)),
          IDL.Opt(IDL.Opt(IDL.Text)),
          IDL.Opt(IDL.Vec(IDL.Text)),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Bool),
        ],
        [Result_7],
        [],
      ),
    'updatePooledServerPairCycles' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Nat],
        [Result_9],
        [],
      ),
    'updatePooledUserCanisterCycles' : IDL.Func(
        [IDL.Principal, IDL.Nat],
        [Result_9],
        [],
      ),
    'updateRemoteFilesConfig' : IDL.Func(
        [
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
        ],
        [Result_8],
        [],
      ),
    'updateReview' : IDL.Func(
        [
          IDL.Text,
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Vec(IDL.Text)),
          IDL.Opt(IDL.Vec(IDL.Text)),
          IDL.Opt(IDL.Bool),
        ],
        [Result],
        [],
      ),
    'updateStripeKeys' : IDL.Func([IDL.Text, IDL.Text], [Result_8], []),
    'updateSubscriptionCache' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Bool, IDL.Nat64, IDL.Opt(IDL.Text)],
        [Result],
        [],
      ),
    'updateTeamMember' : IDL.Func(
        [IDL.Nat, IDL.Opt(IDL.Float64), IDL.Opt(IDL.Bool)],
        [Result],
        [],
      ),
    'updateVideoProgress' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Nat, IDL.Nat, IDL.Float64, IDL.Bool],
        [Result_8],
        [],
      ),
    'updateWasmConfig' : IDL.Func(
        [
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
          IDL.Opt(IDL.Text),
        ],
        [Result_8],
        [],
      ),
    'upgradeListingTier' : IDL.Func([IDL.Text, ListingTier], [Result_7], []),
    'uploadWasmChunk' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Vec(IDL.Nat8)],
        [Result_6],
        [],
      ),
    'upsertSubscriptionPlan' : IDL.Func(
        [SubscriptionPlanInput],
        [Result_5],
        [],
      ),
    'validateDownloadToken' : IDL.Func([IDL.Text], [Result_4], ['query']),
    'verifyPayment' : IDL.Func([IDL.Text], [Result_3], []),
    'verifyPaymentIntent' : IDL.Func([IDL.Text], [Result_2], []),
    'verifyPurchase' : IDL.Func(
        [IDL.Text, IDL.Principal, IDL.Text, IDL.Nat],
        [Result_1],
        [],
      ),
    'voteOnForumReply' : IDL.Func(
        [IDL.Text, IDL.Text, VoteType],
        [IDL.Bool],
        [],
      ),
    'voteOnForumThread' : IDL.Func([IDL.Text, VoteType], [IDL.Bool], []),
    'voteReviewHelpful' : IDL.Func([IDL.Text, IDL.Bool], [Result], []),
    'wallet_receive' : IDL.Func(
        [],
        [IDL.Record({ 'accepted' : IDL.Nat64 })],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
