// account_types.mo
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";

module AccountTypes {
    // Re-use common types from user_types
    public type Timestamp = Nat64;
    public type Visibility = VisibilityType;
    
    // Account Management Types
    public type Account = {
        id: Principal;            // Canister ID
        owner: Principal;         // User principal who owns this account
        accountInfo: AccountInfo;
        stats: AccountStats;
        created: Timestamp;
        resources: AccountResources;
        collaborators: [Collaborator]; // Collaborators with their roles
    };

    public type AccountInfo = {
        createdAt: Timestamp;
        lastAccessed: Timestamp;
        firstLoginAt: ?Timestamp;        // When user first logged in after account creation
        hasCompletedOnboarding: Bool;    // Whether user has completed initial setup
        accountType: AccountType;
        preferences: ?AccountPreferences;
        canisterSettings: ?CanisterSettings;
        externalServices: ?ExternalServiceTokens;
    };

    public type AccountType = {
        #Basic;
        #Premium;
        #Enterprise;
        #Custom: Text;
    };

    public type AccountStatus = {
        #Active;
        #Inactive;
        #Suspended;
        #PendingVerification;
        #Archived;
    };

    public type AccountPreferences = {
        notificationPreferences: NotificationPreferences;
        defaultVisibility: Visibility;
        timezone: ?Text;
        sessionTimeout: ?Nat64;
        customPreferences: ?[(Text, Text)];
        defaultProjectPreferences: ?ProjectPreferences;
    };

    // Updated AccountStats with AI credits tracking
    public type AccountStats = {
        projectsCreated: Nat;
        templatesPublished: Nat;
        templatesSold: Nat;
        totalRevenue: Nat64;
        reputation: Nat;
        lastActive: Timestamp;
        storageUsed: Nat64;
        cyclesBalance: Nat64;
        activity: [ActivityLog];
        
        // AI Credits tracking
        aiCreditsBalance: Nat;           // Current AI credits available
        aiCreditsAllocated: Nat;         // Total allocated this month
        aiCreditsUsed: Nat;              // Used this month
        subscriptionTier: Text;          // "free", "pro", "team", "enterprise"
        lastAICreditsRefresh: Timestamp; // When credits were last refreshed
        monthlyAIUsage: Nat;             // Total AI usage this billing cycle

        // New Stripe integration fields
        stripeCustomerId: ?Text;           // Stripe customer ID for direct API access
        subscriptionActive: Bool;          // Quick local subscription status check
        billingCycleEnd: ?Nat64;          // When current billing period expires
    };

    public type ActivityLog = {
        timestamp: Timestamp;
        activityType: Text;
        details: ?[(Text, Text)];
    };

    // AI Usage Tracking Types
    public type AIUsageRecord = {
        timestamp: Timestamp;
        projectId: Text;
        tokensUsed: Nat;              // Total tokens (input + output)
        inputTokens: Nat;             // Input tokens specifically
        outputTokens: Nat;            // Output tokens specifically
        creditsDeducted: Nat;         // Credits charged for this operation
        model: Text;                  // "claude-sonnet-4", "claude-opus-4", etc.
        operation: Text;              // "chat", "code_generation", etc.
    };

    // Subscription Management Types
    public type Subscription = {
        tier: Text;                   // "free", "pro", "team", "enterprise"
        monthlyAllocation: Nat;       // AI credits allocated per month
        billingCycleStart: Timestamp; // When current billing cycle started
        isActive: Bool;               // Whether subscription is active
        autoRefresh: Bool;            // Whether to auto-refresh monthly
    };

    // AI Model Pricing Configuration
    public type AIModelPricing = {
        modelName: Text;              // "claude-sonnet-4", etc.
        inputCostPer1K: Nat;          // Credits per 1000 input tokens
        outputCostPer1K: Nat;         // Credits per 1000 output tokens
        isActive: Bool;               // Whether this model is available
    };

    public type Collaborator = {
        principal: Principal;
        role: RoleType;
        permissions: [Text];
        addedAt: Timestamp;
        expiresAt: ?Timestamp;
        status: CollaboratorStatus;
    };

    public type CollaboratorStatus = {
        #Active;
        #Invited;
        #Removed;
    };

    public type RoleType = {
        #Developer;
        #Reviewer;
        #Contributor;
        #Custom: Text;
    };

    public type CanisterSettings = {
        name: Text;                    // Canister Name
        canisterType: CanisterType;    // Backend, Frontend, etc.
        memoryAllocation: Nat;         // Memory (GB)
        computeAllocation: Nat;        // Compute Allocation (%)
        freezingThreshold: Nat;        // Freezing Threshold (Seconds)
        duration: ?Nat;                // Duration (Days) - optional since it may not apply to all canisters
        controllers: [Principal];      // Not in UI but important to track
        initialCycles: Nat64;          // Calculated based on other parameters
    };
    
    public type CanisterType = {
        #Backend;
        #Frontend;
        #Asset;
        #Custom: Text;
    };

    public type AccountResources = {
        projects: [ProjectReference];
        templates: [TemplateReference];
        deployments: [DeploymentReference];
    };

    public type ProjectReference = {
        id: Text;
        name: Text;
        visibility: Visibility;
        lastModified: Timestamp;
    };

    public type TemplateReference = {
        id: Text;
        name: Text;
        visibility: Visibility;
        price: ?Nat64;
        salesCount: Nat;
    };

    public type DeploymentReference = {
        id: Text;               // Unique identifier
        name: Text;             // User-friendly name
        projectId: Text;        // Associated project
        canisterId: ?Principal; // The actual canister ID once deployed
        status: Text;           // Simple status like "running", "stopped"
        network: Text;          // "ic", "local", etc.
        lastUpdated: Timestamp; // When it was last updated
    };

    // Identity and Authentication Types
    public type User = {
        id: Principal;  // User's principal ID
        profile: UserProfile;
        preferences: ?UserPreferences;
        created: Nat64;
        lastActive: Nat64;
        primaryAccountId: ?Principal;  // Primary UserAccount canister
        linkedAccounts: [Principal];   // All associated UserAccount canisters
    };

    public type UserProfile = {
        username: Text;      // Required - unique identifier
        displayName: ?Text;  // Optional
        bio: ?Text;         // Optional
        avatar: ?Text;      // Optional - URL/CID
        avatarAsset: ?ImageAsset; // For storing avatar image data directly
        coverPhoto: ?Text;  // Optional - URL/CID for cover photo
        coverPhotoAsset: ?ImageAsset; // For storing cover photo image data directly
        email: ?Text;       // Optional - for notifications
        website: ?Text;     // Optional
        github: ?Text;      // Added github as a direct property
        socials: ?UserSocials;
        metadata: ?[(Text, Text)]; // Extensible metadata
    };

    public type UserSocials = {
        openchat: ?Text;    // Replaced github with openchat
        twitter: ?Text;
        discord: ?Text;
        telegram: ?Text;
    };

    public type UserPreferences = {
        theme: ?Text;
        notifications: NotificationPreferences;
        visibility: VisibilityPreferences;
        defaultProjectPreferences: ?ProjectPreferences;
        customPreferences: ?[(Text, Text)];
    };

    public type ImageAsset = {
        name: Text;
        mimeType: Text;
        data: Blob;
        sizeBytes: Nat;
        width: ?Nat;
        height: ?Nat;
        uploadedAt: Nat64;
    };

    public type NotificationPreferences = {
        channelPreferences: {
            email: Bool;
            discord: Bool;
            telegram: Bool;
            inApp: Bool;
        };
        digestFrequency: ?Text; // "daily", "weekly", etc.
        notificationTypes: ?[(Text, Bool)];
    };

    public type VisibilityPreferences = {
        profile: Visibility;
        projects: Visibility;
        stats: Visibility;
        activity: Visibility;
    };

    public type ProjectPreferences = {
        visibility: VisibilityType;
        projectType: ProjectType;
        buildPreferences: ?BuildPreferences;
        deploymentPreferences: ?DeploymentPreferences;
        accessPreferences: ?AccessControlPreferences;
        defaultPreferences: ?[(Text, Text)];
    };

    public type VisibilityType = {
        #Public;
        #Private;
        #Contacts;
    };

    public type ProjectCategory = {
        #Frontend;
        #Backend; 
        #FullStack;
    };

    public type ProjectFramework = {
        #React;
        #Vue;
        #Motoko;
        #Custom: Text;
    };

    public type ProjectType = {
        category: ProjectCategory;
        framework: ProjectFramework;
    };

    public type BuildPreferences = {
        environment: Text;
        variables: [(Text, Text)];
        commands: [Text];
        artifacts: [Text];
    };

    public type DeploymentPreferences = {
        network: Text;
        replica: Text;
        cyclesRequirement: Nat64;
        automaticDeployment: Bool;
    };

    public type AccessControlPreferences = {
        visibility: Text;
        allowedUsers: [Principal];
        allowedRoles: [Text];
        restrictedActions: [(Text, [Text])];
    };

    public type ExternalServiceTokens = {
        github: ?GitHubConfig;
        discord: ?DiscordConfig;
        telegram: ?TelegramConfig;
    };

    public type GitHubConfig = {
        accessToken: Text;  // Encrypted or obfuscated
        tokenExpiry: Timestamp;
        connectedRepositories: [Text];
        webhookConfigs: [WebhookConfig];
    };

    public type DiscordConfig = {
        webhookUrl: Text;
        serverId: Text;
        channelId: Text;
        notificationSettings: NotificationSettings;
    };

    public type TelegramConfig = {
        chatId: Text;
        botEnabled: Bool;
        notificationSettings: NotificationSettings;
    };

    public type WebhookConfig = {
        id: Text;
        url: Text;
        secret: Text;  // Encrypted or obfuscated
        events: [Text];  // Which GitHub events to listen for
        active: Bool;
    };

    public type NotificationSettings = {
        enabled: Bool;
        frequency: ?Text;  // "immediate", "daily", "weekly", etc.
        eventTypes: [Text];  // Which types of events to notify about
        muteTimeStart: ?Nat64;  // Optional quiet hours start
        muteTimeEnd: ?Nat64;    // Optional quiet hours end
        customSettings: ?[(Text, Text)];  // Any additional service-specific settings
    };

    // ===============================
    // AGENT CREDENTIALS & API TOKENS
    // ===============================

    public type CredentialType = {
        #APIKey;           // Simple API key
        #OAuth2;           // OAuth 2.0 token
        #JWT;              // JSON Web Token
        #BasicAuth;        // Username/password
        #Certificate;      // TLS/SSL certificate
        #SSHKey;           // SSH private key
        #Custom: Text;     // Custom credential type
    };

    public type APICredential = {
        id: Text;                    // Unique credential ID
        name: Text;                  // User-friendly name: "OpenAI Production Key"
        service: Text;               // "openai", "anthropic", "gemini", "kimi", "stripe", etc.
        credentialType: CredentialType;
        encryptedToken: Text;        // Encrypted API key/token
        tokenExpiry: ?Nat64;         // Optional expiration
        scopes: [Text];              // API permissions/scopes
        metadata: [(Text, Text)];    // Additional info
        createdAt: Nat64;
        lastUsed: ?Nat64;
        usageCount: Nat;             // Track usage
        isActive: Bool;              // Can be disabled without deletion
        projectIds: [Text];          // Which projects can use this
    };

    public type RateLimit = {
        requestsPerMinute: Nat;
        requestsPerDay: Nat;
        tokensPerMinute: ?Nat;
        tokensPerDay: ?Nat;
    };

    public type LLMCredentials = {
        apiKey: Text;              // Encrypted
        organizationId: ?Text;
        projectId: ?Text;          // Provider's project ID
        model: ?Text;              // Default model
        maxTokens: ?Nat;
        temperature: ?Float;
        rateLimit: ?RateLimit;
        endpoint: ?Text;           // Custom endpoint URL
    };

    public type AgentCredentials = {
        agentId: Text;                        // Which agent these belong to
        projectId: ?Text;                     // Optional: project-specific
        openai: ?LLMCredentials;              // OpenAI (GPT-4, etc.)
        anthropic: ?LLMCredentials;           // Anthropic (Claude)
        gemini: ?LLMCredentials;              // Google Gemini
        kimi: ?LLMCredentials;                // Moonshot AI Kimi
        databases: [DatabaseCredential];
        customAPIs: [APICredential];
        environmentVariables: [(Text, Text)]; // Encrypted env vars
        createdAt: Nat64;
        updatedAt: Nat64;
    };

    public type DatabaseCredential = {
        id: Text;
        name: Text;                // "Production MongoDB"
        dbType: Text;              // "mongodb", "postgres", "mysql", etc.
        host: Text;
        port: Nat;
        database: Text;
        username: Text;
        encryptedPassword: Text;
        connectionString: ?Text;   // Full connection string (encrypted)
        sslEnabled: Bool;
        sslCertificate: ?Text;
        isReadOnly: Bool;          // Safety feature
        allowedOperations: [Text]; // ["SELECT", "INSERT", etc.]
        createdAt: Nat64;
    };

    // ===============================
    // ENVIRONMENT VARIABLES & SECRETS
    // ===============================

    public type Environment = {
        #Development;
        #Staging;
        #Production;
        #Testing;
        #Custom: Text;
    };

    public type EnvVariable = {
        key: Text;                 // Variable name
        encryptedValue: Text;      // Encrypted value
        description: ?Text;
        isSecret: Bool;            // If true, never expose in logs
        isRequired: Bool;
        category: ?Text;           // "api", "database", "feature_flag", etc.
        createdAt: Nat64;
    };

    public type EnvironmentConfig = {
        id: Text;
        name: Text;                // "Production Env", "Dev Env"
        projectId: ?Text;          // Optional: project-specific
        agentId: ?Text;            // Optional: agent-specific
        environment: Environment;   // dev, staging, prod
        variables: [EnvVariable];
        createdAt: Nat64;
        updatedAt: Nat64;
    };

    // ===============================
    // SECURITY & AUDIT
    // ===============================

    public type SecurityAction = {
        #CredentialCreated;
        #CredentialAccessed;
        #CredentialUpdated;
        #CredentialDeleted;
        #CredentialRotated;
        #UnauthorizedAccess;
        #PermissionChanged;
        #APIKeyUsed;
        #TokenRefreshed;
        #EnvironmentVariableAccessed;
        #Custom: Text;
    };

    public type SecurityResult = {
        #Success;
        #Failure: Text;
        #Blocked: Text;
    };

    public type SecurityAuditLog = {
        timestamp: Nat64;
        userId: Principal;
        action: SecurityAction;
        resourceType: Text;        // "credential", "api_key", "project", etc.
        resourceId: Text;
        result: SecurityResult;
        metadata: [(Text, Text)];
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC PROFILE TYPES (User Business Card)
    // ═══════════════════════════════════════════════════════════════════════════

    public type PublicProfile = {
        // Basic Info
        displayName: ?Text;
        bio: ?Text;
        tagline: ?Text;               // One-liner like "Full-stack ICP Developer"
        avatarUrl: ?Text;
        bannerUrl: ?Text;             // Header background image
        location: ?Text;
        timezone: ?Text;
        
        // Contact & Social
        website: ?Text;
        email: ?Text;                 // Public email if they want to share
        socialLinks: SocialLinks;
        
        // Professional Info
        title: ?Text;                 // Job title: "Senior Blockchain Engineer"
        company: ?Text;
        skills: [Text];
        interests: [Text];
        
        // Showcase Settings
        featuredProjects: [Text];     // Project IDs to feature
        showMarketplace: Bool;        // Show marketplace listings
        showStats: Bool;              // Show deployment/project counts
        customSections: [CustomSection];
        
        // Privacy & Display
        isPublic: Bool;               // Master privacy switch
        theme: ?ProfileTheme;         // Custom color scheme
        
        // Metadata
        createdAt: Timestamp;
        updatedAt: Timestamp;
        profileViews: Nat;            // Analytics
    };

    public type SocialLinks = {
        twitter: ?Text;
        github: ?Text;
        linkedin: ?Text;
        discord: ?Text;
        telegram: ?Text;
        medium: ?Text;
        youtube: ?Text;
        custom: [(Text, Text)];       // Custom links: [(label, url)]
    };

    public type CustomSection = {
        id: Text;
        title: Text;
        content: Text;
        icon: Text;
        order: Nat;
        isVisible: Bool;
    };

    public type ProfileTheme = {
        primaryColor: Text;           // Hex color
        accentColor: Text;
        backgroundStyle: BackgroundStyle;
    };

    public type BackgroundStyle = {
        #Solid: Text;                 // Solid color
        #Gradient: (Text, Text);      // Two colors
        #Image: Text;                 // Image URL
        #Default;                     // Use Kontext default
    };

    public type PublicProfileStats = {
        totalProjects: Nat;
        totalDeployments: Nat;
        marketplaceListings: Nat;
        profileViews: Nat;
        joinedDate: Timestamp;
    };
};