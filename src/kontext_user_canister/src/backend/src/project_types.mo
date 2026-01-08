import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Debug "mo:base/Debug";


module ProjectTypes {
    // Chat message types for project-specific conversations
    public type ChatMessageType = {
        #User;
        #Assistant;
        #System;
    };

    public type ChatMessage = {
        id: Text;
        messageType: ChatMessageType;
        content: Text;
        timestamp: Nat64;
        isGenerating: ?Bool;
        metadata: ?[(Text, Text)];
    };

    public type ProjectMetadata = {
        customIcon: ?Text;          // Custom emoji or icon identifier
        customColor: ?Text;         // Hex color for project theme
        tags: [Text];               // User-defined tags for organization
        category: ?Text;            // Project category beyond projectType
        priority: ?Text;            // High, Medium, Low
        lastAccessed: ?Nat64;       // When project was last opened
        fileCount: ?Nat;            // Cached file count for display
        estimatedSize: ?Nat;        // Cached project size estimate
        thumbnailUrl: ?Text;        // Optional project thumbnail/screenshot
        notes: ?Text;               // User's personal notes about the project
        isBookmarked: ?Bool;        // User favorite/bookmark status
        completionStatus: ?Text;    // Not Started, In Progress, Completed, On Hold
        difficultyLevel: ?Text;     // Beginner, Intermediate, Advanced
        learningObjectives: ?[Text]; // For educational projects
        externalLinks: ?[(Text, Text)]; // (label, url) pairs for external resources
    };

    // Deployed Agent type for tracking AI agents within a project
    public type DeployedAgent = {
        id: Text;
        name: Text;
        description: ?Text;
        backendCanisterId: ?Principal;
        frontendCanisterId: ?Principal;
        status: Text; // 'active', 'inactive', 'error'
        agentType: ?Text; // 'workflow', 'standalone', etc.
        createdAt: Nat64;
        lastDeployedAt: ?Nat64;
    };

    // Project Types
    public type Project = {
        id: Text;
        name: Text;
        description: ?Text;
        projectType: ProjectType;
        canisters: [Principal];
        motokoPackages: ?[PackageInfo];
        npmPackages: ?[NPMPackageInfo];
        created: Nat64;
        updated: Nat64;
        visibility: Text;        // "public" or "private"
        status: Text;           // "active", "archived", "draft"
        collaborators: ?[Principal];
        templateId: ?Text;
        workingCopyBaseVersion: ?Text;  // Added field to track which version the working copy is based on
        // NEW FIELDS
        messages: ?[ChatMessage];        // Project-specific chat history
        metadata: ?ProjectMetadata;      // UI and user preference data
        messageCount: ?Nat;              // Cached count for performance
        lastMessageTime: ?Nat64;         // For sorting and display
        deployedAgents: ?[DeployedAgent]; // AI agents deployed in this project
        // SMART DEPLOYMENT TRACKING
        hasBackendChanged: ?Bool;        // Track if backend files have changed since last successful deploy
        hasFrontendChanged: ?Bool;       // Track if frontend files have changed since last successful deploy
        lastBackendDeployment: ?Nat64;   // Timestamp of last successful backend deployment
        lastFrontendDeployment: ?Nat64;  // Timestamp of last successful frontend deployment
        lastDeploymentServerPairId: ?Text; // Track which server pair was last deployed to
    };

    public type PackageInfo = {
        name: Text;
        repo: Text;
        version: Text;
        dir: ?[Text];
        homepage: ?[Text];
    };

    public type NPMPackageInfo = {
        name: Text;
        version: Text;
        dependencyType: Text;
    };

    public type ProjectType = {
        name: Text;     // "Frontend", "Backend", "FullStack"
        subType: Text;  // "React", "Vue", "Motoko", etc.
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MARKETPLACE TYPES - Project Export & Download System
    // ═══════════════════════════════════════════════════════════════════════════

    // Marketplace listing details for a project
    public type MarketplaceListing = {
        projectId: Text;
        forSale: Bool;
        price: Nat;                    // Price in cents (USD)
        stripeAccountId: Text;         // Seller's Stripe Connect account ID
        title: Text;
        description: Text;
        previewImages: [Text];         // URLs to preview images
        demoUrl: ?Text;                // Optional live demo URL
        category: Text;                // Template category
        tags: [Text];                  // Search tags
        version: Text;                 // Project version
        listedAt: Nat64;
        updatedAt: Nat64;
        downloadCount: Nat;            // Total sales
        isPublished: Bool;             // Visible in marketplace
    };

    // Exported project data (compressed)
    public type ProjectExport = {
        projectId: Text;
        exportId: Text;                // Unique export ID
        fileName: Text;
        fileSize: Nat;                 // Size in bytes
        compressionType: Text;         // "zip"
        checksum: Text;                // SHA-256 hash for integrity
        isChunked: Bool;               // Whether file uses chunking
        totalChunks: ?Nat;             // Number of chunks if chunked
        createdAt: Nat64;
        expiresAt: ?Nat64;             // Optional expiration for cleanup
        metadata: ExportMetadata;
    };

    public type ExportMetadata = {
        projectName: Text;
        projectType: ProjectType;
        motokoPackages: ?[PackageInfo];
        npmPackages: ?[NPMPackageInfo];
        fileCount: Nat;
        exportedBy: Principal;
    };

    // Download token for one-time access
    public type DownloadToken = {
        tokenId: Text;
        exportId: Text;
        projectId: Text;
        purchaseId: Text;              // Platform canister purchase ID
        buyer: Principal;
        maxDownloads: Nat;             // Maximum download attempts
        downloadCount: Nat;            // Current download count
        createdAt: Nat64;
        expiresAt: Nat64;              // Token expiration (48 hours default)
        lastUsedAt: ?Nat64;
        isRevoked: Bool;
        revokedAt: ?Nat64;
        revokedReason: ?Text;
    };

    // Download access log
    public type DownloadLog = {
        tokenId: Text;
        exportId: Text;
        buyer: Principal;
        ipAddress: ?Text;              // Optional IP tracking
        userAgent: ?Text;              // Optional browser fingerprint
        downloadedAt: Nat64;
        success: Bool;
        errorMessage: ?Text;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PROJECT FILE STORAGE TYPES - General purpose file storage for users
    // ═══════════════════════════════════════════════════════════════════════════

    public type FileVisibility = {
        #private_;
        #public_;
        #projectTeam;                  // Visible to project collaborators
    };

    public type StoredFile = {
        id: Text;                      // Unique file ID
        projectId: Text;               // Which project this file belongs to
        fileName: Text;
        fileSize: Nat;                 // Size in bytes
        mimeType: Text;                // MIME type (image/png, application/pdf, etc.)
        visibility: FileVisibility;
        uploadedBy: Principal;
        created: Nat64;
        updated: Nat64;
        isChunked: Bool;               // Whether file uses chunking (>2MB)
        totalChunks: ?Nat;             // Number of chunks if chunked
        checksum: Text;                // File integrity hash
        tags: [Text];                  // User-defined tags for organization
        description: ?Text;            // Optional file description
        category: ?Text;               // images, documents, secrets, etc.
    };

    public type FileUploadSession = {
        sessionId: Text;
        projectId: Text;
        fileName: Text;
        mimeType: Text;
        totalChunks: Nat;
        uploadedChunks: [Nat];         // Track which chunks have been uploaded
        startedAt: Nat64;
        expiresAt: Nat64;              // Session expiration (24 hours)
        uploadedBy: Principal;
    };

    public type FileShareLink = {
        linkId: Text;
        fileId: Text;
        token: Text;                   // Unique share token
        createdBy: Principal;
        createdAt: Nat64;
        expiresAt: ?Nat64;             // Optional expiration
        maxDownloads: ?Nat;            // Optional download limit
        downloadCount: Nat;
        isRevoked: Bool;
        revokedAt: ?Nat64;
    };
};