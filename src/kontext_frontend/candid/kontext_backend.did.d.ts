import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type AIModel = { 'Kimi' : null } |
  { 'Claude' : null } |
  { 'OpenAI' : null } |
  { 'Gemini' : null };
export interface AITokenReserve {
  'totalCreditsRemaining' : bigint,
  'lastCalculated' : bigint,
  'reserveRatio' : number,
  'avgTokensPerCredit' : number,
  'claudeOutputCostPerMillion' : number,
  'daysOfReserve' : bigint,
  'maxPotentialAICostUSD' : number,
  'claudeInputCostPerMillion' : number,
  'currentClaudeBalance' : number,
  'shortfallUSD' : number,
  'requiredClaudeBalance' : number,
}
export interface AcademicProgram {
  'title' : string,
  'thumbnailUrl' : string,
  'isPublished' : boolean,
  'prerequisites' : Array<string>,
  'instructor' : Principal,
  'difficulty' : DifficultyLevel,
  'createdAt' : bigint,
  'tags' : Array<string>,
  'description' : string,
  'isActive' : boolean,
  'courseIds' : Array<string>,
  'averageRating' : number,
  'updatedAt' : bigint,
  'shortDescription' : string,
  'degreeType' : DegreeType,
  'estimatedHours' : bigint,
  'completionCount' : bigint,
  'category' : string,
  'totalCredits' : bigint,
  'electiveCourses' : Array<string>,
  'programId' : string,
  'requiredCourses' : Array<string>,
  'instructorName' : string,
  'enrollmentCount' : bigint,
}
export type AccessTier = { 'pro' : null } |
  { 'enterprise' : null } |
  { 'starter' : null } |
  { 'free' : null } |
  { 'developer' : null };
export interface CanisterDefaultSettings {
  'durationInDays' : bigint,
  'freezingThreshold' : [] | [bigint],
  'memoryGB' : bigint,
  'computeAllocation' : bigint,
  'cyclesAmount' : bigint,
}
export type CanisterPoolType = { 'RegularServerPair' : null } |
  { 'AgencyWorkflowPair' : null } |
  { 'AgentServerPair' : null } |
  { 'UserCanister' : null };
export interface CanisterReplacementInfo {
  'oldCanisterId' : Principal,
  'replacedAt' : bigint,
  'userPrincipal' : Principal,
  'newCanisterId' : Principal,
  'dataTransferred' : boolean,
  'reason' : string,
}
export interface Course {
  'title' : string,
  'credits' : bigint,
  'thumbnailUrl' : string,
  'isPublished' : boolean,
  'prerequisites' : Array<string>,
  'instructor' : Principal,
  'difficulty' : DifficultyLevel,
  'createdAt' : bigint,
  'tags' : Array<string>,
  'description' : string,
  'accessTier' : AccessTier,
  'lessonIds' : Array<string>,
  'isActive' : boolean,
  'averageRating' : number,
  'updatedAt' : bigint,
  'shortDescription' : string,
  'estimatedHours' : bigint,
  'completionCount' : bigint,
  'category' : string,
  'programId' : [] | [string],
  'courseId' : string,
  'syllabus' : Array<SyllabusItem>,
  'instructorName' : string,
  'enrollmentCount' : bigint,
}
export interface CourseEnrollment {
  'status' : EnrollmentStatus,
  'completedAt' : [] | [bigint],
  'startedAt' : [] | [bigint],
  'enrollmentId' : string,
  'timeSpent' : bigint,
  'completedLessonIds' : Array<string>,
  'progress' : number,
  'enrolledAt' : bigint,
  'student' : Principal,
  'currentLessonId' : [] | [string],
  'courseId' : string,
  'lastAccessedAt' : bigint,
}
export interface DashboardData {
  'revenue' : RevenueMetrics,
  'marketplace' : MarketplaceMetrics,
  'generatedAt' : bigint,
  'errors' : ErrorMetrics,
  'userActivity' : UserMetrics,
  'performance' : PerformanceMetrics,
  'featureUsage' : FeatureMetrics,
  'systemHealth' : SystemHealthMetrics,
}
export interface DateRange { 'endDate' : bigint, 'startDate' : bigint }
export type DegreeType = { 'certificate' : null } |
  { 'bachelor' : null } |
  { 'nanodegree' : null } |
  { 'specialization' : null } |
  { 'master' : null } |
  { 'associate' : null } |
  { 'diploma' : null };
export type DifficultyLevel = { 'intermediate' : null } |
  { 'beginner' : null } |
  { 'advanced' : null } |
  { 'expert' : null };
export interface DomainStatistics {
  'requiredNameSiloBalanceUSD' : number,
  'totalCostCents' : bigint,
  'avgCostPerDomainCents' : bigint,
  'totalDomainsPurchased' : bigint,
  'avgPurchasesPerMonth' : number,
  'renewalCostNext30DaysCents' : bigint,
  'renewalsNext30Days' : bigint,
  'domainsByType' : Array<[DomainType, bigint]>,
  'purchasesThisMonth' : bigint,
  'forecastedMonthlyCostCents' : bigint,
}
export type DomainType = { 'Ai' : null } |
  { 'Io' : null } |
  { 'App' : null } |
  { 'Com' : null } |
  { 'Dev' : null } |
  { 'Net' : null } |
  { 'Tech' : null } |
  { 'Other' : string } |
  { 'Cloud' : null };
export interface DownloadToken {
  'exportId' : string,
  'lastUsedAt' : [] | [bigint],
  'tokenId' : string,
  'expiresAt' : bigint,
  'isRevoked' : boolean,
  'listingId' : string,
  'createdAt' : bigint,
  'userCanisterId' : Principal,
  'maxDownloads' : bigint,
  'downloadCount' : bigint,
  'buyer' : Principal,
  'purchaseId' : string,
  'revokedAt' : [] | [bigint],
  'revokedReason' : [] | [string],
}
export type EnrollmentStatus = { 'notStarted' : null } |
  { 'dropped' : null } |
  { 'completed' : null } |
  { 'suspended' : null } |
  { 'inProgress' : null };
export interface ErrorMetrics {
  'errorsByMedium' : bigint,
  'errorsByAPI' : bigint,
  'errorsByLow' : bigint,
  'totalErrors' : bigint,
  'errorsToday' : bigint,
  'unresolvedErrors' : bigint,
  'errorRate' : number,
  'errorsThisWeek' : bigint,
  'avgResolutionTimeMs' : bigint,
  'errorsByCanister' : bigint,
  'errorsByAuth' : bigint,
  'errorsByHigh' : bigint,
  'errorsByCritical' : bigint,
  'errorsThisMonth' : bigint,
  'errorsByPayment' : bigint,
  'errorsByDeployment' : bigint,
}
export type ErrorSeverity = { 'Low' : null } |
  { 'High' : null } |
  { 'Medium' : null } |
  { 'Critical' : null };
export type ErrorType = { 'CanisterError' : null } |
  { 'NetworkError' : null } |
  { 'PaymentFailed' : null } |
  { 'DeploymentFailed' : null } |
  { 'UnknownError' : null } |
  { 'ValidationError' : null } |
  { 'AuthenticationError' : null } |
  { 'APIError' : null } |
  { 'StorageError' : null };
export interface FeatureMetrics {
  'aiRequestsByGemini' : bigint,
  'successRate' : number,
  'projectsDeployed' : bigint,
  'mostUsedFeatures' : Array<[FeatureType, bigint]>,
  'databaseQueries' : bigint,
  'aiRequestsByClaude' : bigint,
  'avgDurationMs' : number,
  'aiRequestsByOpenAI' : bigint,
  'projectsCreated' : bigint,
  'filesStored' : bigint,
  'aiRequestsTotal' : bigint,
  'aiRequestsByKimi' : bigint,
  'agentsDeployed' : bigint,
  'avgTokensPerRequest' : number,
  'totalFeatureUsage' : bigint,
}
export type FeatureType = { 'Marketplace' : null } |
  { 'AgentWorkflow' : null } |
  { 'CanisterDeploy' : null } |
  { 'AIChat' : null } |
  { 'ProjectDeploy' : null } |
  { 'ProjectCreate' : null } |
  { 'FileStorage' : null } |
  { 'DatabaseInterface' : null } |
  { 'ServerPairOps' : null } |
  { 'CodeGeneration' : null };
export type FeePaymentStatus = { 'pending' : null } |
  { 'completed' : null } |
  { 'refunded' : null } |
  { 'failed' : null };
export interface ForumCategory {
  'categoryId' : string,
  'postCount' : bigint,
  'lastThreadTitle' : [] | [string],
  'lastThreadId' : [] | [string],
  'icon' : string,
  'lastActivity' : [] | [bigint],
  'name' : string,
  'createdAt' : bigint,
  'color' : string,
  'slug' : string,
  'description' : string,
  'isActive' : boolean,
  'updatedAt' : bigint,
  'threadCount' : bigint,
  'orderIndex' : bigint,
}
export interface ForumReply {
  'upvotes' : bigint,
  'isDeleted' : boolean,
  'content' : string,
  'createdAt' : bigint,
  'authorName' : string,
  'isAcceptedAnswer' : boolean,
  'author' : Principal,
  'updatedAt' : bigint,
  'isEdited' : boolean,
  'replyId' : string,
  'downvotes' : bigint,
  'threadId' : string,
  'quotedReplyId' : [] | [string],
}
export interface ForumStats {
  'totalReplies' : bigint,
  'threadsToday' : bigint,
  'totalUsers' : bigint,
  'repliesToday' : bigint,
  'totalCategories' : bigint,
  'totalThreads' : bigint,
}
export interface ForumThread {
  'categoryId' : string,
  'upvotes' : bigint,
  'title' : string,
  'content' : string,
  'categoryName' : string,
  'lastReplyByName' : [] | [string],
  'createdAt' : bigint,
  'tags' : Array<string>,
  'authorName' : string,
  'lastReplyAt' : [] | [bigint],
  'lastReplyBy' : [] | [Principal],
  'hasAcceptedAnswer' : boolean,
  'author' : Principal,
  'acceptedAnswerId' : [] | [string],
  'updatedAt' : bigint,
  'viewCount' : bigint,
  'isFeatured' : boolean,
  'replyCount' : bigint,
  'isLocked' : boolean,
  'downvotes' : bigint,
  'threadId' : string,
  'isPinned' : boolean,
}
export type HealthStatus = { 'Healthy' : null } |
  { 'Critical' : null } |
  { 'Warning' : null };
export interface ICPReserve {
  'totalCreditsRemaining' : bigint,
  'lastCalculated' : bigint,
  'reserveRatio' : number,
  'maxPotentialUSDNeeded' : number,
  'xdrRate' : XDRRate,
  'cyclesPerTrillion' : bigint,
  'currentUSDValue' : number,
  'daysOfReserve' : bigint,
  'maxPotentialCyclesNeeded' : bigint,
  'maxPotentialXDRNeeded' : number,
  'currentICPBalance' : number,
  'maxPotentialICPNeeded' : number,
  'shortfallICP' : number,
  'shortfallUSD' : number,
}
export type ImportMethod = { 'fullDeploy' : null } |
  { 'download' : null } |
  { 'directImport' : null };
export interface LearningPath {
  'title' : string,
  'difficulty' : DifficultyLevel,
  'programIds' : Array<string>,
  'description' : string,
  'courseIds' : Array<string>,
  'estimatedHours' : bigint,
  'forRole' : string,
  'pathId' : string,
}
export interface Lesson {
  'lessonId' : string,
  'title' : string,
  'duration' : bigint,
  'completionRate' : number,
  'isPublished' : boolean,
  'resources' : Array<LessonResource>,
  'createdAt' : bigint,
  'description' : string,
  'accessTier' : AccessTier,
  'isFree' : boolean,
  'averageRating' : number,
  'updatedAt' : bigint,
  'viewCount' : bigint,
  'youtubeVideoId' : string,
  'courseId' : string,
  'transcript' : [] | [string],
  'orderIndex' : bigint,
}
export interface LessonResource {
  'title' : string,
  'resourceId' : string,
  'description' : string,
  'fileSize' : bigint,
  'fileType' : ResourceType,
  'fileUrl' : string,
}
export interface ListingFeeConfig {
  'featuredFee' : bigint,
  'featuredDurationDays' : bigint,
  'basicFee' : bigint,
  'premiumDurationDays' : bigint,
  'premiumFee' : bigint,
}
export interface ListingFeePayment {
  'status' : FeePaymentStatus,
  'refundReason' : [] | [string],
  'listingId' : string,
  'feeType' : ListingFeeType,
  'seller' : Principal,
  'amountPaid' : bigint,
  'refundedAt' : [] | [bigint],
  'paymentId' : string,
  'stripePaymentIntentId' : string,
  'paidAt' : bigint,
}
export type ListingFeeType = { 'featured' : null } |
  { 'premium' : null } |
  { 'basic' : null };
export type ListingTier = { 'featured' : null } |
  { 'premium' : null } |
  { 'basic' : null };
export type MarketplaceAction = { 'ProjectSold' : null } |
  { 'ListingUnpublished' : null } |
  { 'ListingUpdated' : null } |
  { 'ProjectDownloaded' : null } |
  { 'ListingViewed' : null } |
  { 'ListingCreated' : null } |
  { 'ListingPublished' : null };
export interface MarketplaceListing {
  'exportId' : string,
  'title' : string,
  'premiumUntil' : [] | [bigint],
  'isPublished' : boolean,
  'featuredUntil' : [] | [bigint],
  'stripeAccountId' : string,
  'listedAt' : bigint,
  'listingId' : string,
  'tags' : Array<string>,
  'description' : string,
  'seller' : Principal,
  'isActive' : boolean,
  'listingTier' : ListingTier,
  'version' : string,
  'totalSales' : bigint,
  'updatedAt' : bigint,
  'userCanisterId' : Principal,
  'projectId' : string,
  'demoUrl' : [] | [string],
  'category' : string,
  'price' : bigint,
  'previewImages' : Array<string>,
}
export interface MarketplaceMetrics {
  'totalViews' : bigint,
  'avgSalePriceCents' : bigint,
  'salesThisWeek' : bigint,
  'activeListings' : bigint,
  'totalListings' : bigint,
  'topCategories' : Array<[string, bigint]>,
  'totalSales' : bigint,
  'platformFeesCollectedCents' : bigint,
  'conversionRate' : number,
  'topSellers' : Array<[Principal, bigint]>,
  'salesThisMonth' : bigint,
  'totalRevenueCents' : bigint,
  'avgTimeToPurchase' : bigint,
}
export interface NotificationAction {
  'actionLabel' : string,
  'actionType' : { 'NavigateTo' : string } |
    { 'Dismiss' : null } |
    { 'OpenDialog' : string } |
    { 'ExternalLink' : string },
}
export type NotificationAudience = { 'All' : null } |
  { 'SubscriptionTier' : string } |
  { 'NewUsers' : bigint } |
  { 'SpecificUsers' : Array<Principal> } |
  { 'ActiveUsers' : bigint };
export type NotificationCategory = { 'System' : null } |
  { 'Announcement' : null } |
  { 'Security' : null } |
  { 'Deployment' : null } |
  { 'Account' : null } |
  { 'Credits' : null } |
  { 'Feature' : null } |
  { 'Subscription' : null };
export interface NotificationEvent {
  'id' : bigint,
  'title' : string,
  'expiresAt' : [] | [Timestamp],
  'metadata' : [] | [Array<[string, string]>],
  'icon' : [] | [string],
  'createdBy' : Principal,
  'actions' : [] | [Array<NotificationAction>],
  'targetAudience' : NotificationAudience,
  'message' : string,
  'timestamp' : Timestamp,
  'category' : NotificationCategory,
  'severity' : NotificationSeverity,
  'isPinned' : boolean,
}
export type NotificationSeverity = { 'Low' : null } |
  { 'High' : null } |
  { 'Medium' : null } |
  { 'Critical' : null };
export interface NotificationStats {
  'oldestNotification' : [] | [Timestamp],
  'newestNotification' : [] | [Timestamp],
  'totalNotifications' : bigint,
  'notificationsByCategory' : Array<[NotificationCategory, bigint]>,
  'notificationsBySeverity' : Array<[NotificationSeverity, bigint]>,
}
export type OperationType = { 'HTTPOutcall' : null } |
  { 'DatabaseQuery' : null } |
  { 'Deployment' : null } |
  { 'FileUpload' : null } |
  { 'FileDownload' : null } |
  { 'APICall' : null } |
  { 'CanisterCall' : null } |
  { 'AIRequest' : null };
export interface PaymentRecord {
  'creditsGranted' : bigint,
  'status' : PaymentStatus,
  'tbCyclesRequested' : number,
  'icpSpent' : bigint,
  'userPrincipal' : Principal,
  'timestamp' : bigint,
  'amountUSD' : number,
  'paymentIntentId' : string,
}
export type PaymentStatus = { 'pending' : null } |
  { 'completed' : null } |
  { 'refunded' : null } |
  { 'failed' : null };
export type PaymentStatus__1 = { 'Failed' : null } |
  { 'Refunded' : null } |
  { 'Succeeded' : null } |
  { 'Pending' : null };
export type PaymentType = { 'MarketplaceSale' : null } |
  { 'MarketplacePlatformFee' : null } |
  { 'Credits' : null } |
  { 'Subscription' : null };
export interface PerformanceMetrics {
  'p99ResponseTimeMs' : bigint,
  'medianResponseTimeMs' : bigint,
  'avgFileUploadTimeMs' : bigint,
  'totalOperations' : bigint,
  'overallSuccessRate' : number,
  'avgDatabaseQueryTimeMs' : bigint,
  'cacheHitRate' : number,
  'avgResponseTimeMs' : bigint,
  'avgDeploymentTimeMs' : bigint,
  'p95ResponseTimeMs' : bigint,
  'avgAIRequestTimeMs' : bigint,
  'slowestOperations' : Array<[OperationType, bigint]>,
}
export interface PlanFeature {
  'order' : bigint,
  'description' : string,
  'enabled' : boolean,
}
export type PoolCanisterStatus = { 'Creating' : null } |
  { 'Available' : null } |
  { 'Failed' : null } |
  { 'Maintenance' : null } |
  { 'Assigned' : null };
export interface PoolStats {
  'failedCount' : bigint,
  'maintenanceCount' : bigint,
  'totalCount' : bigint,
  'totalCyclesAllocated' : bigint,
  'availableCount' : bigint,
  'assignedCount' : bigint,
  'poolType' : CanisterPoolType,
  'creatingCount' : bigint,
}
export interface PooledCanister {
  'durationDays' : bigint,
  'status' : PoolCanisterStatus,
  'assignedAt' : [] | [bigint],
  'assignedTo' : [] | [Principal],
  'cycleBalance' : [] | [bigint],
  'metadata' : [] | [Array<[string, string]>],
  'createdAt' : bigint,
  'memoryGB' : bigint,
  'poolType' : CanisterPoolType,
  'canisterId' : Principal,
}
export interface PooledServerPair {
  'status' : PoolCanisterStatus,
  'assignedAt' : [] | [bigint],
  'assignedTo' : [] | [Principal],
  'metadata' : [] | [Array<[string, string]>],
  'frontendCanisterId' : Principal,
  'createdAt' : bigint,
  'frontendCycles' : [] | [bigint],
  'backendCycles' : [] | [bigint],
  'backendCanisterId' : Principal,
  'poolType' : CanisterPoolType,
  'pairId' : string,
}
export interface ProgramEnrollment {
  'status' : EnrollmentStatus,
  'completedAt' : [] | [bigint],
  'creditsEarned' : bigint,
  'startedAt' : [] | [bigint],
  'enrollmentId' : string,
  'completedCourseIds' : Array<string>,
  'progress' : number,
  'enrolledAt' : bigint,
  'student' : Principal,
  'currentCourseId' : [] | [string],
  'programId' : string,
}
export interface ProjectImport {
  'importedProjectId' : string,
  'importId' : string,
  'listingId' : string,
  'importedAt' : bigint,
  'buyerUserCanisterId' : Principal,
  'buyer' : Principal,
  'purchaseId' : string,
  'importMethod' : ImportMethod,
}
export interface ProjectReview {
  'title' : string,
  'reportCount' : bigint,
  'listingId' : string,
  'cons' : Array<string>,
  'createdAt' : bigint,
  'pros' : Array<string>,
  'sellerResponse' : [] | [SellerResponse],
  'isVerifiedPurchase' : boolean,
  'comment' : string,
  'updatedAt' : bigint,
  'isHidden' : boolean,
  'hiddenReason' : [] | [string],
  'rating' : bigint,
  'reviewId' : string,
  'reviewer' : Principal,
  'helpfulCount' : bigint,
  'purchaseId' : string,
  'wouldRecommend' : boolean,
}
export type PurchaseStatus = { 'pending' : null } |
  { 'completed' : null } |
  { 'refunded' : null } |
  { 'failed' : null };
export type ReportReason = { 'misleading' : null } |
  { 'other' : null } |
  { 'spam' : null } |
  { 'irrelevant' : null } |
  { 'offensive' : null };
export type ReportStatus = { 'pending' : null } |
  { 'reviewed' : null } |
  { 'actionTaken' : null } |
  { 'dismissed' : null };
export type ResourceType = { 'pdf' : null } |
  { 'other' : null } |
  { 'code' : null } |
  { 'slides' : null } |
  { 'worksheet' : null };
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : VerifiedPurchase } |
  { 'err' : string };
export type Result_10 = { 'ok' : ListingFeeConfig } |
  { 'err' : string };
export type Result_11 = { 'ok' : bigint } |
  { 'err' : string };
export type Result_12 = {
    'ok' : [] | [{ 'email' : [] | [string], 'customerId' : string }]
  } |
  { 'err' : string };
export type Result_13 = { 'ok' : ListingFeePayment } |
  { 'err' : string };
export type Result_14 = { 'ok' : UserCanisterInfo } |
  { 'err' : string };
export type Result_15 = { 'ok' : UserMetrics } |
  { 'err' : string };
export type Result_16 = { 'ok' : Array<TeamMember> } |
  { 'err' : string };
export type Result_17 = { 'ok' : SystemHealthMetrics } |
  { 'err' : string };
export type Result_18 = {
    'ok' : {
      'active' : boolean,
      'expiresAt' : bigint,
      'tier' : string,
      'stripeCustomerId' : [] | [string],
      'cached' : boolean,
    }
  } |
  { 'err' : string };
export type Result_19 = { 'ok' : RevenueMetrics } |
  { 'err' : string };
export type Result_2 = {
    'ok' : {
      'id' : string,
      'status' : string,
      'currency' : string,
      'amount' : bigint,
    }
  } |
  { 'err' : string };
export type Result_20 = { 'ok' : PoolStats } |
  { 'err' : string };
export type Result_21 = { 'ok' : PerformanceMetrics } |
  { 'err' : string };
export type Result_22 = { 'ok' : Array<ReviewReport> } |
  { 'err' : string };
export type Result_23 = { 'ok' : Array<PaymentRecord> } |
  { 'err' : string };
export type Result_24 = { 'ok' : NotificationStats } |
  { 'err' : string };
export type Result_25 = { 'ok' : MarketplaceMetrics } |
  { 'err' : string };
export type Result_26 = { 'ok' : FeatureMetrics } |
  { 'err' : string };
export type Result_27 = { 'ok' : ErrorMetrics } |
  { 'err' : string };
export type Result_28 = { 'ok' : DomainStatistics } |
  { 'err' : string };
export type Result_29 = { 'ok' : DashboardData } |
  { 'err' : string };
export type Result_3 = { 'ok' : PaymentRecord } |
  { 'err' : string };
export type Result_30 = {
    'ok' : {
      'systemHealthRecords' : bigint,
      'featureUsageRecords' : bigint,
      'userActivityRecords' : bigint,
      'totalUsers' : bigint,
      'performanceRecords' : bigint,
      'errorRecords' : bigint,
      'revenueRecords' : bigint,
      'marketplaceRecords' : bigint,
    }
  } |
  { 'err' : string };
export type Result_31 = { 'ok' : Array<[Principal, Principal]> } |
  { 'err' : string };
export type Result_32 = { 'ok' : Array<SubscriptionPlan> } |
  { 'err' : string };
export type Result_33 = { 'ok' : [Array<AcademicProgram>, bigint] } |
  { 'err' : string };
export type Result_34 = { 'ok' : Array<AcademicProgram> } |
  { 'err' : string };
export type Result_35 = { 'ok' : Array<PooledCanister> } |
  { 'err' : string };
export type Result_36 = { 'ok' : Array<PooledServerPair> } |
  { 'err' : string };
export type Result_37 = { 'ok' : Array<NotificationEvent> } |
  { 'err' : string };
export type Result_38 = { 'ok' : [Array<MarketplaceListing>, bigint] } |
  { 'err' : string };
export type Result_39 = { 'ok' : Array<MarketplaceListing> } |
  { 'err' : string };
export type Result_4 = { 'ok' : DownloadToken } |
  { 'err' : string };
export type Result_40 = { 'ok' : [Array<Course>, bigint] } |
  { 'err' : string };
export type Result_41 = { 'ok' : Array<Course> } |
  { 'err' : string };
export type Result_42 = { 'ok' : Array<string> } |
  { 'err' : string };
export type Result_43 = {
    'ok' : { 'tokenId' : string, 'expiresAt' : bigint, 'downloadUrl' : string }
  } |
  { 'err' : string };
export type Result_44 = {
    'ok' : { 'id' : string, 'amount' : bigint, 'clientSecret' : string }
  } |
  { 'err' : string };
export type Result_45 = { 'ok' : { 'id' : string, 'url' : string } } |
  { 'err' : string };
export type Result_46 = { 'ok' : { 'url' : string } } |
  { 'err' : string };
export type Result_47 = { 'ok' : TeamEarningsReport } |
  { 'err' : string };
export type Result_48 = { 'ok' : ICPReserve } |
  { 'err' : string };
export type Result_49 = { 'ok' : AITokenReserve } |
  { 'err' : string };
export type Result_5 = { 'ok' : SubscriptionPlan } |
  { 'err' : string };
export type Result_50 = { 'ok' : CanisterReplacementInfo } |
  { 'err' : string };
export type Result_6 = {
    'ok' : { 'receivedChunks' : bigint, 'totalChunks' : bigint }
  } |
  { 'err' : string };
export type Result_7 = { 'ok' : MarketplaceListing } |
  { 'err' : string };
export type Result_8 = { 'ok' : string } |
  { 'err' : string };
export type Result_9 = { 'ok' : boolean } |
  { 'err' : string };
export interface RevenueMetrics {
  'usersByPro' : bigint,
  'usersByEnterprise' : bigint,
  'revenueByStarter' : bigint,
  'revenueFromMarketplace' : bigint,
  'avgRevenuePerUser' : bigint,
  'revenueFromSubscriptions' : bigint,
  'revenueByPro' : bigint,
  'mrrCents' : bigint,
  'usersByStarter' : bigint,
  'revenueFromCredits' : bigint,
  'arrCents' : bigint,
  'conversionRate' : number,
  'revenueByFree' : bigint,
  'payingUsers' : bigint,
  'retentionRate' : number,
  'usersByFree' : bigint,
  'avgLifetimeValueCents' : bigint,
  'churnRate' : number,
  'totalRevenueCents' : bigint,
  'revenueByEnterprise' : bigint,
}
export interface ReviewReport {
  'status' : ReportStatus,
  'description' : string,
  'resolution' : [] | [string],
  'reportedAt' : bigint,
  'reviewId' : string,
  'reportId' : string,
  'reporter' : Principal,
  'resolvedAt' : [] | [bigint],
  'resolvedBy' : [] | [Principal],
  'reason' : ReportReason,
}
export interface ReviewSummary {
  'listingId' : string,
  'recommendationRate' : number,
  'averageRating' : number,
  'ratingDistribution' : Array<bigint>,
  'verifiedPurchaseRate' : number,
  'totalReviews' : bigint,
}
export interface SearchResult {
  'id' : string,
  'title' : string,
  'categoryName' : [] | [string],
  'createdAt' : bigint,
  'authorName' : string,
  'author' : Principal,
  'excerpt' : string,
  'resultType' : SearchResultType,
}
export type SearchResultType = { 'Reply' : null } |
  { 'Thread' : null };
export interface SellerResponse {
  'updatedAt' : bigint,
  'responseText' : string,
  'respondedAt' : bigint,
}
export interface SubscriptionAllocation {
  'platformRevenuePercent' : number,
  'aiFundingPercent' : number,
  'monthlyPriceCents' : bigint,
  'aiFundingUSD' : number,
  'tier' : string,
  'icpFundingPercent' : number,
  'platformRevenueUSD' : number,
  'rationale' : string,
  'icpFundingUSD' : number,
}
export interface SubscriptionPlan {
  'features' : Array<PlanFeature>,
  'originalPrice' : [] | [bigint],
  'order' : bigint,
  'name' : string,
  'createdAt' : bigint,
  'badges' : Array<string>,
  'tier' : SubscriptionTier,
  'description' : string,
  'isActive' : boolean,
  'stripeProductId' : [] | [string],
  'updatedAt' : bigint,
  'stripePriceId' : [] | [string],
  'ctaText' : string,
  'monthlyPrice' : bigint,
  'hostingCredits' : bigint,
  'maxProjects' : [] | [bigint],
  'monthlyCredits' : bigint,
  'discountPercentage' : [] | [bigint],
}
export interface SubscriptionPlanInput {
  'features' : Array<PlanFeature>,
  'originalPrice' : [] | [bigint],
  'order' : bigint,
  'name' : string,
  'badges' : Array<string>,
  'tier' : SubscriptionTier,
  'description' : string,
  'isActive' : boolean,
  'stripeProductId' : [] | [string],
  'stripePriceId' : [] | [string],
  'ctaText' : string,
  'monthlyPrice' : bigint,
  'hostingCredits' : bigint,
  'maxProjects' : [] | [bigint],
  'monthlyCredits' : bigint,
  'discountPercentage' : [] | [bigint],
}
export type SubscriptionTier = { 'PRO' : null } |
  { 'ENTERPRISE' : null } |
  { 'FREE' : null } |
  { 'STARTER' : null } |
  { 'DEVELOPER' : null };
export interface SyllabusItem {
  'description' : string,
  'lessonIds' : Array<string>,
  'sectionTitle' : string,
}
export interface SystemHealthMetrics {
  'activeUsers' : bigint,
  'memoryUtilizationPercent' : number,
  'lastUpgradeTime' : [] | [bigint],
  'memoryUsedBytes' : bigint,
  'httpOutcallsThisMonth' : bigint,
  'alerts' : Array<string>,
  'estimatedDaysRemaining' : bigint,
  'currentCycles' : bigint,
  'healthStatus' : HealthStatus,
  'storageUsedBytes' : bigint,
  'uptimePercent' : number,
  'storageUtilizationPercent' : number,
  'totalUsers' : bigint,
  'httpOutcallsToday' : bigint,
  'storageCapacityBytes' : bigint,
  'cyclesBurnRatePerDay' : bigint,
  'memoryCapacityBytes' : bigint,
}
export interface TeamEarningsReport {
  'platformRetainedRevenue' : bigint,
  'generatedAt' : bigint,
  'totalPlatformRevenue' : bigint,
  'totalTeamPayouts' : bigint,
  'memberEarnings' : Array<TeamMemberEarnings>,
}
export interface TeamMember {
  'id' : bigint,
  'active' : boolean,
  'revenueSharePercent' : number,
  'name' : string,
  'role' : string,
  'creditCommissionShare' : boolean,
  'addedAt' : bigint,
  'subscriptionShare' : boolean,
  'marketplaceShare' : boolean,
}
export interface TeamMemberEarnings {
  'memberId' : bigint,
  'earningsAllTime' : bigint,
  'creditCommissionEarnings' : bigint,
  'earningsLastMonth' : bigint,
  'revenueSharePercent' : number,
  'earningsThisMonth' : bigint,
  'calculatedAt' : bigint,
  'memberName' : string,
  'marketplaceEarnings' : bigint,
  'totalEarnings' : bigint,
  'subscriptionEarnings' : bigint,
}
export type TimeWindow = { 'AllTime' : null } |
  { 'Last90Days' : null } |
  { 'Last7Days' : null } |
  { 'Last24Hours' : null } |
  { 'Custom' : DateRange } |
  { 'Last30Days' : null };
export type Timestamp = bigint;
export interface Transaction {
  'transactionType' : TransactionType,
  'isPositive' : boolean,
  'memo' : [] | [string],
  'counterparty' : string,
  'timestamp' : bigint,
  'amount' : bigint,
}
export type TransactionType = { 'sent' : null } |
  { 'canister' : null } |
  { 'received' : null };
export type UserAction = { 'Login' : null } |
  { 'AgentDeployed' : null } |
  { 'SubscriptionPurchased' : null } |
  { 'DatabaseQuery' : null } |
  { 'ProjectDeployed' : null } |
  { 'MarketplacePurchase' : null } |
  { 'MarketplaceListing' : null } |
  { 'CreditsPurchased' : null } |
  { 'Logout' : null } |
  { 'FileUploaded' : null } |
  { 'AgentCreated' : null } |
  { 'AIRequest' : null } |
  { 'ProjectCreated' : null };
export interface UserCanisterInfo {
  'status' : string,
  'controllers' : Array<Principal>,
  'cycleBalance' : bigint,
  'createdAt' : bigint,
  'totalTopups' : bigint,
  'lastTopup' : [] | [bigint],
  'userCanisterId' : Principal,
  'userPrincipal' : Principal,
  'memorySize' : bigint,
}
export interface UserForumProfile {
  'isModerator' : boolean,
  'displayName' : string,
  'userId' : Principal,
  'badges' : Array<string>,
  'joinedAt' : bigint,
  'reputation' : bigint,
  'avatarUrl' : [] | [string],
  'threadCount' : bigint,
  'replyCount' : bigint,
  'upvotesReceived' : bigint,
  'isAdmin' : boolean,
}
export interface UserMetrics {
  'newUsersToday' : bigint,
  'activeUsersThisMonth' : bigint,
  'avgSessionsPerUser' : number,
  'avgActionsPerUser' : number,
  'activeUsersToday' : bigint,
  'activeUsersThisWeek' : bigint,
  'totalUsers' : bigint,
  'totalUsersAllTime' : bigint,
  'newUsersThisWeek' : bigint,
  'newUsersThisMonth' : bigint,
  'topUsers' : Array<[Principal, bigint]>,
}
export interface VerifiedPurchase {
  'status' : PurchaseStatus,
  'exportId' : string,
  'listingId' : string,
  'amountPaid' : bigint,
  'purchasedAt' : bigint,
  'userCanisterId' : Principal,
  'projectId' : string,
  'stripePaymentIntentId' : string,
  'buyer' : Principal,
  'purchaseId' : string,
}
export interface VideoBookmark {
  'title' : string,
  'createdAt' : bigint,
  'timestamp' : bigint,
  'bookmarkId' : string,
}
export interface VideoNote {
  'content' : string,
  'noteId' : string,
  'createdAt' : bigint,
  'updatedAt' : bigint,
  'timestamp' : bigint,
}
export interface VideoProgress {
  'lessonId' : string,
  'completedAt' : [] | [bigint],
  'lastPosition' : bigint,
  'isCompleted' : boolean,
  'totalDuration' : bigint,
  'lastWatchedAt' : bigint,
  'playbackSpeed' : number,
  'bookmarks' : Array<VideoBookmark>,
  'progressPercent' : number,
  'watchedDuration' : bigint,
  'notes' : Array<VideoNote>,
  'progressId' : string,
  'student' : Principal,
  'watchCount' : bigint,
}
export type VoteType = { 'Downvote' : null } |
  { 'Upvote' : null };
export interface XDRRate {
  'icpPerXDR' : number,
  'lastUpdated' : bigint,
  'usdPerXDR' : number,
}
export interface _SERVICE {
  'addAdmin' : ActorMethod<[Principal], Result_8>,
  'addServerPairToPool' : ActorMethod<
    [
      string,
      Principal,
      Principal,
      CanisterPoolType,
      [] | [Array<[string, string]>],
    ],
    Result_9
  >,
  'addTeamMember' : ActorMethod<
    [string, string, number, boolean, boolean, boolean],
    Result_11
  >,
  'addUserCanisterToPool' : ActorMethod<
    [Principal, bigint, bigint, [] | [Array<[string, string]>]],
    Result_9
  >,
  'addVideoBookmark' : ActorMethod<[string, bigint, string], Result>,
  'addVideoNote' : ActorMethod<[string, bigint, string], Result>,
  'adminReplaceUserCanister' : ActorMethod<
    [Principal, Principal, string],
    Result_50
  >,
  'adminTopUpUserCanister' : ActorMethod<[Principal, bigint], Result_8>,
  'assignServerPairFromPool' : ActorMethod<[string, Principal], Result_9>,
  'assignUserCanisterFromPool' : ActorMethod<[Principal, Principal], Result_9>,
  'calculateAITokenReserve' : ActorMethod<[], Result_49>,
  'calculateICPReserve' : ActorMethod<[], Result_48>,
  'calculateTeamEarnings' : ActorMethod<[], Result_47>,
  'clearAllLogs' : ActorMethod<[], bigint>,
  'clearAnalyticsCache' : ActorMethod<[], Result>,
  'clearSubscriptionCache' : ActorMethod<[], Result>,
  'createAcademicProgram' : ActorMethod<
    [
      string,
      string,
      string,
      string,
      string,
      Array<string>,
      Array<string>,
      Array<string>,
      bigint,
      bigint,
      DifficultyLevel,
      string,
      Array<string>,
      Array<string>,
      DegreeType,
    ],
    Result_8
  >,
  'createBillingPortalSession' : ActorMethod<[string, string], Result_46>,
  'createCanisterWithSettings' : ActorMethod<
    [Principal, bigint, bigint, [] | [bigint], bigint, bigint],
    Result_8
  >,
  'createCheckoutSession' : ActorMethod<
    [string, string, string, string],
    Result_45
  >,
  'createCourse' : ActorMethod<
    [
      [] | [string],
      string,
      string,
      string,
      string,
      string,
      Array<string>,
      bigint,
      bigint,
      DifficultyLevel,
      string,
      Array<string>,
      Array<string>,
      AccessTier,
      Array<SyllabusItem>,
    ],
    Result_8
  >,
  'createForumCategory' : ActorMethod<
    [string, string, string, string, string, bigint],
    string
  >,
  'createForumReply' : ActorMethod<[string, string, [] | [string]], string>,
  'createForumThread' : ActorMethod<
    [string, string, string, Array<string>],
    string
  >,
  'createLearningPath' : ActorMethod<
    [
      string,
      string,
      Array<string>,
      Array<string>,
      bigint,
      DifficultyLevel,
      string,
    ],
    Result_8
  >,
  'createLesson' : ActorMethod<
    [
      string,
      string,
      string,
      string,
      bigint,
      bigint,
      AccessTier,
      boolean,
      Array<LessonResource>,
      [] | [string],
    ],
    Result_8
  >,
  'createNotification' : ActorMethod<
    [
      NotificationSeverity,
      NotificationCategory,
      NotificationAudience,
      string,
      string,
      [] | [string],
      [] | [Array<[string, string]>],
      [] | [Array<NotificationAction>],
      [] | [bigint],
      boolean,
    ],
    Result_11
  >,
  'createPaymentIntent' : ActorMethod<[bigint, string, string], Result_44>,
  'createPlatformWallet' : ActorMethod<[], string>,
  'createReview' : ActorMethod<
    [
      string,
      string,
      bigint,
      string,
      string,
      Array<string>,
      Array<string>,
      boolean,
    ],
    Result_8
  >,
  'deleteCanister' : ActorMethod<[Principal], Result_8>,
  'deleteForumCategory' : ActorMethod<[string], boolean>,
  'deleteForumReply' : ActorMethod<[string, string], boolean>,
  'deleteForumThread' : ActorMethod<[string], boolean>,
  'deleteMarketplaceListing' : ActorMethod<[string], Result>,
  'deleteNotification' : ActorMethod<[bigint], Result_9>,
  'deleteReview' : ActorMethod<[string], Result>,
  'deleteSubscriptionPlan' : ActorMethod<[SubscriptionTier], Result_9>,
  'deployStoredWasm' : ActorMethod<[string, Principal, Principal], Result_8>,
  'deployToExistingCanister' : ActorMethod<
    [Principal, Uint8Array | number[]],
    Result_8
  >,
  'dismissNotification' : ActorMethod<[bigint], undefined>,
  'enrollInCourse' : ActorMethod<[string], Result_8>,
  'enrollInProgram' : ActorMethod<[string], Result_8>,
  'finalizeWasmUpload' : ActorMethod<[string], Result_8>,
  'generateDownloadToken' : ActorMethod<[string], Result_43>,
  'generateTestLogs' : ActorMethod<[], undefined>,
  'getAcademicProgram' : ActorMethod<[string], [] | [AcademicProgram]>,
  'getActiveForumCategories' : ActorMethod<[], Array<ForumCategory>>,
  'getActiveSubscriptionPlans' : ActorMethod<[], Array<SubscriptionPlan>>,
  'getAdminPrincipal' : ActorMethod<[], Result_8>,
  'getAdmins' : ActorMethod<[], Result_42>,
  'getAllCourses' : ActorMethod<[], Result_41>,
  'getAllCoursesPaginated' : ActorMethod<[bigint, bigint], Result_40>,
  'getAllForumCategories' : ActorMethod<[], Array<ForumCategory>>,
  'getAllListings' : ActorMethod<[], Result_39>,
  'getAllListingsPaginated' : ActorMethod<[bigint, bigint], Result_38>,
  'getAllNotifications' : ActorMethod<[], Result_37>,
  'getAllPooledServerPairs' : ActorMethod<[[] | [CanisterPoolType]], Result_36>,
  'getAllPooledUserCanisters' : ActorMethod<[], Result_35>,
  'getAllPrograms' : ActorMethod<[], Result_34>,
  'getAllProgramsPaginated' : ActorMethod<[bigint, bigint], Result_33>,
  'getAllSubscriptionPlans' : ActorMethod<[Principal], Result_32>,
  'getAllUserCanisters' : ActorMethod<[], Result_31>,
  'getAnalyticsDataCounts' : ActorMethod<[], Result_30>,
  'getAvailableServerPairFromPool' : ActorMethod<
    [CanisterPoolType],
    [] | [PooledServerPair]
  >,
  'getAvailableUserCanisterFromPool' : ActorMethod<[], [] | [PooledCanister]>,
  'getBuyerImports' : ActorMethod<[], Array<ProjectImport>>,
  'getBuyerPurchases' : ActorMethod<[], Array<VerifiedPurchase>>,
  'getCallerPrincipal' : ActorMethod<[], string>,
  'getCourse' : ActorMethod<[string], [] | [Course]>,
  'getCoursesByTier' : ActorMethod<[AccessTier], Array<Course>>,
  'getCoursesByTierPaginated' : ActorMethod<
    [AccessTier, bigint, bigint],
    [Array<Course>, bigint]
  >,
  'getCreditCommissionPercent' : ActorMethod<[], number>,
  'getDashboardData' : ActorMethod<[TimeWindow], Result_29>,
  'getDomainStatistics' : ActorMethod<[], Result_28>,
  'getErrorMetrics' : ActorMethod<[TimeWindow], Result_27>,
  'getFeatureUsageMetrics' : ActorMethod<[TimeWindow], Result_26>,
  'getFeePaymentById' : ActorMethod<[string], Result_13>,
  'getFinancialDashboard' : ActorMethod<[], Result_8>,
  'getForumCategory' : ActorMethod<[string], [] | [ForumCategory]>,
  'getForumReplies' : ActorMethod<[string], Array<ForumReply>>,
  'getForumRepliesPaginated' : ActorMethod<
    [string, bigint, bigint],
    [Array<ForumReply>, bigint]
  >,
  'getForumStats' : ActorMethod<[], ForumStats>,
  'getForumThread' : ActorMethod<[string], [] | [ForumThread]>,
  'getForumThreadsByCategory' : ActorMethod<[string], Array<ForumThread>>,
  'getForumThreadsByCategoryPaginated' : ActorMethod<
    [string, bigint, bigint],
    [Array<ForumThread>, bigint]
  >,
  'getLearningPaths' : ActorMethod<[], Array<LearningPath>>,
  'getLesson' : ActorMethod<[string], [] | [Lesson]>,
  'getLessonsByCourse' : ActorMethod<[string], Array<Lesson>>,
  'getLessonsByCoursePaginated' : ActorMethod<
    [string, bigint, bigint],
    [Array<Lesson>, bigint]
  >,
  'getListingFeeConfig' : ActorMethod<[], ListingFeeConfig>,
  'getListingReviewSummary' : ActorMethod<[string], ReviewSummary>,
  'getListingReviews' : ActorMethod<[string], Array<ProjectReview>>,
  'getListingsByCategory' : ActorMethod<[string], Array<MarketplaceListing>>,
  'getListingsByCategoryPaginated' : ActorMethod<
    [string, bigint, bigint],
    [Array<MarketplaceListing>, bigint]
  >,
  'getLoggerStatus' : ActorMethod<
    [],
    {
      'canisterType' : string,
      'logsAvailable' : boolean,
      'loggerInitialized' : boolean,
    }
  >,
  'getLogs' : ActorMethod<[], Array<string>>,
  'getMarketplaceListing' : ActorMethod<[string], [] | [MarketplaceListing]>,
  'getMarketplaceMetrics' : ActorMethod<[TimeWindow], Result_25>,
  'getMyEnrollments' : ActorMethod<
    [],
    {
      'courses' : Array<CourseEnrollment>,
      'programs' : Array<ProgramEnrollment>,
    }
  >,
  'getNewLogsSince' : ActorMethod<
    [bigint, [] | [bigint]],
    { 'logs' : Array<string>, 'nextMarker' : bigint }
  >,
  'getNotificationStats' : ActorMethod<[], Result_24>,
  'getNotifications' : ActorMethod<
    [bigint, [] | [bigint]],
    Array<NotificationEvent>
  >,
  'getPaymentHistory' : ActorMethod<[[] | [Principal]], Result_23>,
  'getPendingReviewReports' : ActorMethod<[], Result_22>,
  'getPerformanceMetrics' : ActorMethod<[TimeWindow], Result_21>,
  'getPlatformBalance' : ActorMethod<[], bigint>,
  'getPlatformCycleBalance' : ActorMethod<[], bigint>,
  'getPlatformTransactions' : ActorMethod<[[] | [bigint]], Array<Transaction>>,
  'getPlatformWalletId' : ActorMethod<
    [],
    [] | [
      {
        'principal' : string,
        'subaccount' : string,
        'accountIdentifier' : string,
      }
    ]
  >,
  'getPoolStats' : ActorMethod<[CanisterPoolType], Result_20>,
  'getPricingInfo' : ActorMethod<
    [],
    {
      'maxAmountUSD' : number,
      'description' : string,
      'creditsPerUSD' : bigint,
      'minAmountUSD' : number,
    }
  >,
  'getPublishedCourses' : ActorMethod<[], Array<Course>>,
  'getPublishedCoursesPaginated' : ActorMethod<
    [bigint, bigint],
    [Array<Course>, bigint]
  >,
  'getPublishedListings' : ActorMethod<[], Array<MarketplaceListing>>,
  'getPublishedListingsPaginated' : ActorMethod<
    [bigint, bigint],
    [Array<MarketplaceListing>, bigint]
  >,
  'getPublishedPrograms' : ActorMethod<[], Array<AcademicProgram>>,
  'getPublishedProgramsPaginated' : ActorMethod<
    [bigint, bigint],
    [Array<AcademicProgram>, bigint]
  >,
  'getRemoteFilesConfig' : ActorMethod<
    [],
    {
      'frontendRules' : string,
      'assetStorageWasm' : string,
      'agentWasm' : string,
      'backendRules' : string,
      'assetCanisterId' : string,
      'frontendPrompt' : string,
      'agencyWasm' : string,
      'agentWasmGz' : string,
      'backendPrompt' : string,
      'userCanisterWasm' : string,
      'agencyWasmGz' : string,
      'basePath' : string,
    }
  >,
  'getRevenueMetrics' : ActorMethod<[TimeWindow], Result_19>,
  'getSellerFeePayments' : ActorMethod<[], Array<ListingFeePayment>>,
  'getSellerListings' : ActorMethod<[], Array<MarketplaceListing>>,
  'getSellerListingsPaginated' : ActorMethod<
    [bigint, bigint],
    [Array<MarketplaceListing>, bigint]
  >,
  'getSellerSales' : ActorMethod<[], Array<VerifiedPurchase>>,
  'getStripePublishableKey' : ActorMethod<[], string>,
  'getSubscriptionAllocations' : ActorMethod<[], Array<SubscriptionAllocation>>,
  'getSubscriptionPlanByTier' : ActorMethod<
    [SubscriptionTier],
    [] | [SubscriptionPlan]
  >,
  'getSubscriptionPrompt' : ActorMethod<[Principal], Result_8>,
  'getSubscriptionStatus' : ActorMethod<[boolean], Result_18>,
  'getSystemHealthMetrics' : ActorMethod<[], Result_17>,
  'getTeamMembers' : ActorMethod<[], Result_16>,
  'getUnreadNotificationCount' : ActorMethod<[], bigint>,
  'getUserActivityMetrics' : ActorMethod<[TimeWindow], Result_15>,
  'getUserCanisterInfo' : ActorMethod<[Principal], Result_14>,
  'getUserForumProfile' : ActorMethod<[Principal], [] | [UserForumProfile]>,
  'getUserPlatformCanister' : ActorMethod<[Principal], Array<Principal>>,
  'getVideoProgress' : ActorMethod<[string], [] | [VideoProgress]>,
  'getWasmConfig' : ActorMethod<
    [],
    {
      'assetStorageWasm' : string,
      'agentWasm' : string,
      'assetCanisterId' : string,
      'agencyWasm' : string,
      'agentWasmGz' : string,
      'userCanisterWasm' : string,
      'agencyWasmGz' : string,
      'basePath' : string,
    }
  >,
  'hideReview' : ActorMethod<[string, string], Result>,
  'http_request' : ActorMethod<
    [
      {
        'url' : string,
        'method' : string,
        'body' : Uint8Array | number[],
        'headers' : Array<[string, string]>,
      },
    ],
    {
      'body' : Uint8Array | number[],
      'headers' : Array<[string, string]>,
      'status_code' : number,
    }
  >,
  'http_request_update' : ActorMethod<
    [
      {
        'url' : string,
        'method' : string,
        'body' : Uint8Array | number[],
        'headers' : Array<[string, string]>,
      },
    ],
    {
      'body' : Uint8Array | number[],
      'headers' : Array<[string, string]>,
      'status_code' : number,
    }
  >,
  'importPurchasedProject' : ActorMethod<[string, Principal], Result_8>,
  'incrementForumThreadViews' : ActorMethod<[string], boolean>,
  'initializeDefaultSubscriptionPlans' : ActorMethod<[], Result_8>,
  'isAdmin' : ActorMethod<[], boolean>,
  'isListingFeePaid' : ActorMethod<[string], boolean>,
  'isListingTierActive' : ActorMethod<[string], boolean>,
  'lockForumThread' : ActorMethod<[string, boolean], boolean>,
  'logDebug' : ActorMethod<[string], undefined>,
  'logError' : ActorMethod<[string], undefined>,
  'logInfo' : ActorMethod<[string], undefined>,
  'logWarn' : ActorMethod<[string], undefined>,
  'markAcceptedAnswer' : ActorMethod<[string, string], boolean>,
  'markNotificationsAsRead' : ActorMethod<[bigint], undefined>,
  'markTokenUsed' : ActorMethod<[string], Result>,
  'pinForumThread' : ActorMethod<[string, boolean], boolean>,
  'pruneOldNotifications' : ActorMethod<[], Result_11>,
  'publishListing' : ActorMethod<[string], Result>,
  'recordListingFeePayment' : ActorMethod<
    [string, string, bigint, ListingFeeType],
    Result_13
  >,
  'recordPaymentAndCreditUser' : ActorMethod<
    [string, number, Principal],
    Result_8
  >,
  'recordPaymentWithCalculatedICP' : ActorMethod<
    [string, number, Principal, bigint, number, bigint],
    Result_8
  >,
  'recordSystemHealth' : ActorMethod<[], undefined>,
  'refundListingFee' : ActorMethod<[string, string], Result>,
  'registerMarketplaceListing' : ActorMethod<
    [
      string,
      Principal,
      string,
      string,
      string,
      bigint,
      string,
      Array<string>,
      [] | [string],
      string,
      Array<string>,
      string,
    ],
    Result_7
  >,
  'removeAdmin' : ActorMethod<[Principal], Result_8>,
  'removeServerPairFromPool' : ActorMethod<[string], Result_9>,
  'removeUserCanisterFromPool' : ActorMethod<[Principal], Result_9>,
  'removeUserPlatformCanister' : ActorMethod<[Principal], Result_8>,
  'reportReview' : ActorMethod<[string, ReportReason, string], Result_8>,
  'resolveError' : ActorMethod<[bigint], Result>,
  'respondToReview' : ActorMethod<[string, string], Result>,
  'revokeDownloadToken' : ActorMethod<[string, string], Result>,
  'searchForum' : ActorMethod<[string], Array<SearchResult>>,
  'searchForumPaginated' : ActorMethod<
    [string, bigint, bigint],
    [Array<SearchResult>, bigint]
  >,
  'searchStripeCustomer' : ActorMethod<[Principal], Result_12>,
  'sendICPFromPlatform' : ActorMethod<[Principal, bigint], Result_8>,
  'sendICPFromPlatformToAccountId' : ActorMethod<[string, bigint], Result_8>,
  'startWasmUploadSession' : ActorMethod<[string, bigint, bigint], Result_8>,
  'topUpCanisterCMC' : ActorMethod<[Principal, bigint], Result_8>,
  'topUpUserCanisterFromPlatform' : ActorMethod<[Principal, number], Result_8>,
  'topUpUserCanisterWithExactICP' : ActorMethod<[Principal, bigint], Result_8>,
  'trackCreditCommission' : ActorMethod<[Principal, bigint, bigint], undefined>,
  'trackDomainPurchase' : ActorMethod<
    [string, DomainType, bigint, string],
    Result_11
  >,
  'trackError' : ActorMethod<
    [ErrorType, string, [] | [string], ErrorSeverity, [] | [string]],
    bigint
  >,
  'trackFeatureUsage' : ActorMethod<
    [
      FeatureType,
      [] | [AIModel],
      [] | [bigint],
      [] | [bigint],
      boolean,
      [] | [string],
    ],
    undefined
  >,
  'trackMarketplaceActivity' : ActorMethod<
    [
      string,
      Principal,
      [] | [Principal],
      MarketplaceAction,
      [] | [bigint],
      [] | [string],
    ],
    undefined
  >,
  'trackPerformance' : ActorMethod<[OperationType, bigint, boolean], undefined>,
  'trackRevenue' : ActorMethod<
    [
      bigint,
      string,
      [] | [string],
      PaymentType,
      PaymentStatus__1,
      [] | [string],
    ],
    undefined
  >,
  'trackUserActivity' : ActorMethod<
    [UserAction, [] | [string], [] | [string]],
    undefined
  >,
  'unhideReview' : ActorMethod<[string], Result>,
  'unpublishListing' : ActorMethod<[string], Result>,
  'updateAcademicCourse' : ActorMethod<
    [
      string,
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [Array<string>],
      [] | [boolean],
      [] | [boolean],
    ],
    Result
  >,
  'updateAcademicProgram' : ActorMethod<
    [
      string,
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [Array<string>],
      [] | [boolean],
    ],
    Result
  >,
  'updateAdminPrincipal' : ActorMethod<[string], Result_8>,
  'updateCanisterDefaults' : ActorMethod<[CanisterDefaultSettings], Result_8>,
  'updateCurrentBalances' : ActorMethod<[number, number], Result>,
  'updateForumCategory' : ActorMethod<
    [
      string,
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [bigint],
      [] | [boolean],
    ],
    boolean
  >,
  'updateForumReply' : ActorMethod<[string, string, string], boolean>,
  'updateForumThread' : ActorMethod<
    [string, [] | [string], [] | [string], [] | [Array<string>]],
    boolean
  >,
  'updateListingFeeConfig' : ActorMethod<
    [[] | [bigint], [] | [bigint], [] | [bigint], [] | [bigint], [] | [bigint]],
    Result_10
  >,
  'updateMarketplaceListing' : ActorMethod<
    [
      string,
      [] | [bigint],
      [] | [string],
      [] | [string],
      [] | [Array<string>],
      [] | [[] | [string]],
      [] | [Array<string>],
      [] | [string],
      [] | [boolean],
    ],
    Result_7
  >,
  'updatePooledServerPairCycles' : ActorMethod<
    [string, bigint, bigint],
    Result_9
  >,
  'updatePooledUserCanisterCycles' : ActorMethod<[Principal, bigint], Result_9>,
  'updateRemoteFilesConfig' : ActorMethod<
    [
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
    ],
    Result_8
  >,
  'updateReview' : ActorMethod<
    [
      string,
      [] | [bigint],
      [] | [string],
      [] | [string],
      [] | [Array<string>],
      [] | [Array<string>],
      [] | [boolean],
    ],
    Result
  >,
  'updateStripeKeys' : ActorMethod<[string, string], Result_8>,
  'updateSubscriptionCache' : ActorMethod<
    [Principal, string, boolean, bigint, [] | [string]],
    Result
  >,
  'updateTeamMember' : ActorMethod<
    [bigint, [] | [number], [] | [boolean]],
    Result
  >,
  'updateVideoProgress' : ActorMethod<
    [string, bigint, bigint, bigint, number, boolean],
    Result_8
  >,
  'updateWasmConfig' : ActorMethod<
    [
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
      [] | [string],
    ],
    Result_8
  >,
  'upgradeListingTier' : ActorMethod<[string, ListingTier], Result_7>,
  'uploadWasmChunk' : ActorMethod<
    [string, bigint, Uint8Array | number[]],
    Result_6
  >,
  'upsertSubscriptionPlan' : ActorMethod<[SubscriptionPlanInput], Result_5>,
  'validateDownloadToken' : ActorMethod<[string], Result_4>,
  'verifyPayment' : ActorMethod<[string], Result_3>,
  'verifyPaymentIntent' : ActorMethod<[string], Result_2>,
  'verifyPurchase' : ActorMethod<[string, Principal, string, bigint], Result_1>,
  'voteOnForumReply' : ActorMethod<[string, string, VoteType], boolean>,
  'voteOnForumThread' : ActorMethod<[string, VoteType], boolean>,
  'voteReviewHelpful' : ActorMethod<[string, boolean], Result>,
  'wallet_receive' : ActorMethod<[], { 'accepted' : bigint }>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
