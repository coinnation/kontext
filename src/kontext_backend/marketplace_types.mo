// Marketplace types for platform canister integration with user canisters
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";

module MarketplaceTypes {
    // ═══════════════════════════════════════════════════════════════════════════
    // MARKETPLACE LISTING TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    // Marketplace listing (stored in platform canister)
    public type MarketplaceListing = {
        listingId: Text;               // Unique listing ID
        projectId: Text;               // Project ID in user canister
        userCanisterId: Principal;     // Which user canister owns this project
        seller: Principal;             // Project owner
        exportId: Text;                // Export ID in user canister
        title: Text;
        description: Text;
        price: Nat;                    // Price in USD cents
        stripeAccountId: Text;         // Seller's Stripe Connect account
        previewImages: [Text];
        demoUrl: ?Text;
        category: Text;
        tags: [Text];
        version: Text;
        listedAt: Nat64;
        updatedAt: Nat64;
        totalSales: Nat;               // Number of sales
        isPublished: Bool;             // Visible in marketplace
        isActive: Bool;                // Currently accepting purchases
        listingTier: ListingTier;      // Which tier this listing has
        featuredUntil: ?Nat64;         // When featured status expires (null = never)
        premiumUntil: ?Nat64;          // When premium status expires (null = never)
    };

    // Listing tier (determines visibility and features)
    public type ListingTier = {
        #basic;                        // $9.99 - Standard listing
        #featured;                     // $25.99 - Enhanced visibility + badge
        #premium;                      // $49.99 - Top placement + promotional spots
    };

    // Verified purchase record
    public type VerifiedPurchase = {
        purchaseId: Text;              // Unique purchase ID
        listingId: Text;               // What was purchased
        buyer: Principal;              // Who purchased
        stripePaymentIntentId: Text;   // Stripe payment reference
        amountPaid: Nat;               // Amount paid in USD cents
        userCanisterId: Principal;     // Seller's user canister
        exportId: Text;                // Export to download
        projectId: Text;               // Project purchased
        purchasedAt: Nat64;
        status: PurchaseStatus;
    };

    public type PurchaseStatus = {
        #pending;                      // Payment processing
        #completed;                    // Payment confirmed
        #refunded;                     // Refund issued
        #failed;                       // Payment failed
    };

    // Download token (time-limited, download-limited)
    public type DownloadToken = {
        tokenId: Text;
        purchaseId: Text;              // Associated purchase
        listingId: Text;
        buyer: Principal;
        userCanisterId: Principal;     // Which user canister to call
        exportId: Text;                // What to download
        maxDownloads: Nat;             // Max download attempts
        downloadCount: Nat;            // Current downloads
        createdAt: Nat64;
        expiresAt: Nat64;              // Token expiration
        lastUsedAt: ?Nat64;
        isRevoked: Bool;
        revokedAt: ?Nat64;
        revokedReason: ?Text;
    };

    // Download access log
    public type DownloadAttempt = {
        tokenId: Text;
        purchaseId: Text;
        buyer: Principal;
        attemptedAt: Nat64;
        success: Bool;
        errorMessage: ?Text;
        ipAddress: ?Text;
        userAgent: ?Text;
    };

    // Import record (when buyer imports project directly to workspace)
    public type ProjectImport = {
        importId: Text;                // Unique import ID
        purchaseId: Text;              // Associated purchase
        listingId: Text;               // What was imported
        buyer: Principal;              // Who imported
        buyerUserCanisterId: Principal; // Buyer's user canister
        importedProjectId: Text;       // New project ID in buyer's canister
        importedAt: Nat64;
        importMethod: ImportMethod;
    };

    public type ImportMethod = {
        #directImport;                 // Imported directly to workspace (no server pair)
        #fullDeploy;                   // Imported and deployed with server pair
        #download;                     // Traditional zip download
    };

    // Marketplace statistics
    public type MarketplaceStats = {
        totalListings: Nat;
        activeListings: Nat;
        totalSales: Nat;
        totalRevenue: Nat;             // Total in USD cents
        totalDownloads: Nat;
        topCategories: [(Text, Nat)];  // (category, count)
    };

    // Seller payout record
    public type SellerPayout = {
        payoutId: Text;
        seller: Principal;
        stripeTransferId: Text;        // Stripe Transfer ID
        amount: Nat;                   // Amount in USD cents
        listings: [Text];              // Listing IDs included
        periodStart: Nat64;
        periodEnd: Nat64;
        paidAt: Nat64;
        status: PayoutStatus;
    };

    public type PayoutStatus = {
        #pending;
        #processing;
        #paid;
        #failed;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // REVIEW SYSTEM TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    // Project review (5-star rating + text review)
    public type ProjectReview = {
        reviewId: Text;                // Unique review ID
        listingId: Text;               // Which listing is being reviewed
        purchaseId: Text;              // Verified purchase (required to review)
        reviewer: Principal;           // Who left the review
        rating: Nat;                   // 1-5 stars
        title: Text;                   // Review headline
        comment: Text;                 // Review text
        pros: [Text];                  // List of pros (optional)
        cons: [Text];                  // List of cons (optional)
        wouldRecommend: Bool;          // Would you recommend this?
        createdAt: Nat64;
        updatedAt: Nat64;
        isVerifiedPurchase: Bool;      // Always true for marketplace
        helpfulCount: Nat;             // How many found helpful
        reportCount: Nat;              // How many reported as spam
        isHidden: Bool;                // Admin can hide reviews
        hiddenReason: ?Text;           // Why was it hidden
        sellerResponse: ?SellerResponse; // Seller can respond
    };

    // Seller response to a review
    public type SellerResponse = {
        responseText: Text;
        respondedAt: Nat64;
        updatedAt: Nat64;
    };

    // Review summary for a listing
    public type ReviewSummary = {
        listingId: Text;
        totalReviews: Nat;
        averageRating: Float;          // 0.0 - 5.0
        ratingDistribution: [Nat];     // [1-star count, 2-star, 3-star, 4-star, 5-star]
        recommendationRate: Float;     // % who would recommend (0-100)
        verifiedPurchaseRate: Float;   // % from verified purchases (0-100)
    };

    // Review vote (helpful/not helpful)
    public type ReviewVote = {
        reviewId: Text;
        voter: Principal;
        isHelpful: Bool;
        votedAt: Nat64;
    };

    // Review report (for moderation)
    public type ReviewReport = {
        reportId: Text;
        reviewId: Text;
        reporter: Principal;
        reason: ReportReason;
        description: Text;
        reportedAt: Nat64;
        status: ReportStatus;
        resolvedBy: ?Principal;        // Admin who resolved
        resolvedAt: ?Nat64;
        resolution: ?Text;             // What action was taken
    };

    public type ReportReason = {
        #spam;
        #offensive;
        #misleading;
        #irrelevant;
        #other;
    };

    public type ReportStatus = {
        #pending;
        #reviewed;
        #actionTaken;                  // Review hidden/removed
        #dismissed;                    // Report was invalid
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // LISTING FEE TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    // Listing fee payment record
    public type ListingFeePayment = {
        paymentId: Text;               // Unique payment ID
        listingId: Text;               // Which listing this fee is for
        seller: Principal;             // Who paid
        stripePaymentIntentId: Text;   // Stripe payment reference
        amountPaid: Nat;               // Amount paid in USD cents
        feeType: ListingFeeType;       // What type of fee
        paidAt: Nat64;
        status: FeePaymentStatus;
        refundedAt: ?Nat64;
        refundReason: ?Text;
    };

    public type ListingFeeType = {
        #basic;                        // Basic listing fee ($9.99)
        #featured;                     // Featured listing fee ($25.99)
        #premium;                      // Premium listing fee ($49.99)
    };

    public type FeePaymentStatus = {
        #pending;                      // Payment processing
        #completed;                    // Payment confirmed, listing active
        #refunded;                     // Refund issued
        #failed;                       // Payment failed
    };

    // Listing fee configuration (admin can adjust)
    public type ListingFeeConfig = {
        basicFee: Nat;                 // Basic listing fee in USD cents (default: 999 = $9.99)
        featuredFee: Nat;              // Featured listing fee in USD cents (default: 2599 = $25.99)
        premiumFee: Nat;               // Premium listing fee in USD cents (default: 4999 = $49.99)
        featuredDurationDays: Nat;     // How long featured status lasts (0 = permanent)
        premiumDurationDays: Nat;      // How long premium status lasts (0 = permanent)
    };
};

