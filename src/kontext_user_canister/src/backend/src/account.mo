// account.mo
import Principal "mo:base/Principal";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Option "mo:base/Option";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Int "mo:base/Int";
import Hash "mo:base/Hash";
import Debug "mo:base/Debug";
import Types "account_types";

module Account {
    // Type aliases
    public type Account = Types.Account;
    public type AccountInfo = Types.AccountInfo;
    public type AccountPreferences = Types.AccountPreferences;
    public type AccountStats = Types.AccountStats;
    public type ActivityLog = Types.ActivityLog;
    public type Collaborator = Types.Collaborator;
    public type ProjectReference = Types.ProjectReference;
    public type TemplateReference = Types.TemplateReference;
    public type DeploymentReference = Types.DeploymentReference;
    public type AccountResources = Types.AccountResources;
    public type Timestamp = Types.Timestamp;
    public type User = Types.User;
    public type UserProfile = Types.UserProfile;
    public type UserPreferences = Types.UserPreferences;
    public type VisibilityPreferences = Types.VisibilityPreferences;
    public type NotificationPreferences = Types.NotificationPreferences;
    public type Visibility = Types.Visibility;
    public type AccountType = Types.AccountType;
    public type CollaboratorStatus = Types.CollaboratorStatus;
    public type RoleType = Types.RoleType;
    public type Result<T, E> = Result.Result<T, E>;

    // Default values
    let defaultVisibility : Visibility = #Public;
    let defaultAccountType : AccountType = #Basic;

    // Helper function to generate unique IDs
    public func generateId() : Text {
        let now = Int.abs(Time.now());
        let random = (now * 104729) % 10000000; // Simple pseudo-random using prime number
        Nat.toText(random)
    };

    public class AccountManager(ownerPrincipal: Principal, canisterId: Principal) {
        // State variables
        private var owner : Principal = ownerPrincipal;
        private var currentUser : ?User = null;
        private var currentAccount : ?Account = null;
        private var linkedAccountsArray : [Principal] = [];

        // In-memory storage for linked accounts
        private let linkedAccounts = HashMap.HashMap<Principal, Bool>(10, Principal.equal, Principal.hash);

        // Initialize the account manager
        public func initialize() : async Result<(), Text> {
            // Only allow initialization once
            if (Option.isSome(currentUser) or Option.isSome(currentAccount)) {
                return #err("Account already initialized");
            };
            
            return #ok();
        };

        // Initialize user profile
        public func initializeUser(profile: UserProfile) : async Result<User, Text> {
            // Check if user already exists
            switch (currentUser) {
                case (?user) {
                    return #err("User already initialized");
                };
                case (null) {
                    // Create timestamp
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Create default visibility preferences
                    let visibilityPrefs : VisibilityPreferences = {
                        profile = defaultVisibility;
                        projects = defaultVisibility;
                        stats = defaultVisibility;
                        activity = defaultVisibility;
                    };

                    // Create default preferences
                    let preferences : UserPreferences = {
                        theme = ?"light";
                        notifications = {
                            channelPreferences = {
                                email = true;
                                discord = false;
                                telegram = false;
                                inApp = true;
                            };
                            digestFrequency = ?"daily";
                            notificationTypes = ?[("all", true)];
                        };
                        visibility = visibilityPrefs;
                        defaultProjectPreferences = null;
                        customPreferences = null;
                    };

                    // Create new user
                    let newUser : User = {
                        id = ownerPrincipal;
                        profile = profile;
                        preferences = ?preferences;
                        created = now;
                        lastActive = now;
                        primaryAccountId = null;
                        linkedAccounts = [];
                    };

                    // Store the user
                    currentUser := ?newUser;

                    // Create default account if not yet created
                    if (Option.isNull(currentAccount)) {
                        let _ = await initializeAccount();
                    };

                    return #ok(newUser);
                };
            };
        };

        // Initialize account
        private func initializeAccount() : async Result<Account, Text> {
            // Check if account already exists
            switch (currentAccount) {
                case (?account) {
                    return #err("Account already initialized");
                };
                case (null) {
                    // Create timestamp
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Create default account info
                    let accountInfo : AccountInfo = {
                        createdAt = now;
                        lastAccessed = now;
                        firstLoginAt = null;                // New field - will be set on first login
                        hasCompletedOnboarding = false;     // New field - default to false
                        accountType = defaultAccountType;
                        preferences = ?{
                            notificationPreferences = {
                                channelPreferences = {
                                    email = true;
                                    discord = false;
                                    telegram = false;
                                    inApp = true;
                                };
                                digestFrequency = ?"daily";
                                notificationTypes = ?[("all", true)];
                            };
                            defaultVisibility = defaultVisibility;
                            defaultProjectPreferences = null;
                            timezone = ?"UTC";
                            sessionTimeout = ?Nat64.fromNat(3600); // 1 hour
                            customPreferences = null;
                        };
                        canisterSettings = null;
                        externalServices = null;
                    };
                    // Create default stats
                    let accountStats : AccountStats = {
                        projectsCreated = 0;
                        templatesPublished = 0;
                        templatesSold = 0;
                        totalRevenue = 0;
                        reputation = 0;
                        lastActive = now;
                        storageUsed = 0;
                        cyclesBalance = 0;
                        activity = [];
                        
                        // Existing AI credit fields
                        aiCreditsBalance = 10000;
                        aiCreditsAllocated = 10000;
                        aiCreditsUsed = 0;
                        subscriptionTier = "free";
                        lastAICreditsRefresh = now;
                        monthlyAIUsage = 0;
                        
                        // New Stripe integration fields
                        stripeCustomerId = null;          // No customer ID initially
                        subscriptionActive = false;       // Inactive by default
                        billingCycleEnd = null;          // No billing cycle initially
                    };

                    // Create default resources
                    let accountResources : AccountResources = {
                        projects = [];
                        templates = [];
                        deployments = [];
                    };

                    // Create new account
                    let newAccount : Account = {
                        id = canisterId;
                        owner = ownerPrincipal;
                        accountInfo = accountInfo;
                        stats = accountStats;
                        created = now;
                        resources = accountResources;
                        collaborators = [];
                    };

                    // Store the account
                    currentAccount := ?newAccount;

                    // If user exists, update primary account
                    switch (currentUser) {
                        case (?user) {
                            currentUser := ?{
                                user with
                                primaryAccountId = ?canisterId;
                            };
                        };
                        case (null) {
                            // User doesn't exist yet, will be updated when created
                        };
                    };

                    // Log activity
                    addActivityLog("AccountCreated", [("owner", Principal.toText(ownerPrincipal))]);

                    return #ok(newAccount);
                };
            };
        };

        // Add activity log entry
        private func addActivityLog(activityType: Text, details: [(Text, Text)]) : () {
            switch (currentAccount) {
                case (?account) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    let newActivity : ActivityLog = {
                        timestamp = now;
                        activityType = activityType;
                        details = ?details;
                    };
                    
                    // Create buffer to modify the array
                    let activityBuffer = Buffer.Buffer<ActivityLog>(account.stats.activity.size() + 1);
                    
                    // Add new activity at the beginning (most recent first)
                    activityBuffer.add(newActivity);
                    
                    // Add existing activities
                    for (activity in account.stats.activity.vals()) {
                        activityBuffer.add(activity);
                    };
                    
                    // Limit to 50 activities
                    let finalActivities = if (activityBuffer.size() > 50) {
                        Buffer.subBuffer(activityBuffer, 0, 50).toArray();
                    } else {
                        activityBuffer.toArray();
                    };
                    
                    // Update account with new activity
                    currentAccount := ?{
                        account with
                        stats = {
                            account.stats with
                            activity = finalActivities;
                            lastActive = now;
                        };
                    };
                };
                case (null) {
                    // Account doesn't exist yet, can't log activity
                };
            };
        };

        // Update account's last accessed timestamp
        private func updateLastAccessed() : () {
            switch (currentAccount) {
                case (?account) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Update last accessed
                    currentAccount := ?{
                        account with
                        accountInfo = {
                            account.accountInfo with
                            lastAccessed = now;
                        };
                        stats = {
                            account.stats with
                            lastActive = now;
                        };
                    };
                };
                case (null) {
                    // Account doesn't exist yet
                };
            };
        };

        // Get user info
        public func getUserInfo() : ?User {
            updateLastAccessed();
            return currentUser;
        };

        // Get account info
        public func getAccountInfo() : ?Account {
            updateLastAccessed();
            return currentAccount;
        };

        // Update user profile
        public func updateUserProfile(profile: UserProfile) : async Result<User, Text> {
            switch (currentUser) {
                case (?user) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Update user profile
                    let updatedUser = {
                        user with
                        profile = profile;
                        lastActive = now;
                    };
                    
                    currentUser := ?updatedUser;
                    
                    // Log activity
                    addActivityLog("ProfileUpdated", [("username", profile.username)]);
                    
                    return #ok(updatedUser);
                };
                case (null) {
                    return #err("User not initialized");
                };
            };
        };

        // Update user preferences
        public func updateUserPreferences(preferences: UserPreferences) : async Result<User, Text> {
            switch (currentUser) {
                case (?user) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Update user preferences
                    let updatedUser = {
                        user with
                        preferences = ?preferences;
                        lastActive = now;
                    };
                    
                    currentUser := ?updatedUser;
                    
                    // Log activity
                    addActivityLog("PreferencesUpdated", []);
                    
                    return #ok(updatedUser);
                };
                case (null) {
                    return #err("User not initialized");
                };
            };
        };

        // Update account preferences
        public func updateAccountPreferences(preferences: AccountPreferences) : async Result<Account, Text> {
            switch (currentAccount) {
                case (?account) {
                    // Update account preferences
                    let updatedAccount = {
                        account with
                        accountInfo = {
                            account.accountInfo with
                            preferences = ?preferences;
                        };
                    };
                    
                    currentAccount := ?updatedAccount;
                    
                    // Log activity
                    addActivityLog("AccountPreferencesUpdated", []);
                    
                    return #ok(updatedAccount);
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };
        
        // Update notification preferences for the user
        public func updateNotificationPreferences(notificationPreferences: Types.NotificationPreferences) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    switch (account.accountInfo.preferences) {
                        case (?prefs) {
                            // Update just the notifications enabled part
                            let updatedPreferences = {
                                prefs with
                                notificationPreferences = notificationPreferences;
                            };
                            
                            // Update account with new preferences
                            currentAccount := ?{
                                account with
                                accountInfo = {
                                    account.accountInfo with
                                    preferences = ?updatedPreferences;
                                };
                            };
                            
                            // Log activity
                            addActivityLog("NotificationPreferencesUpdated", []);
                            
                            return #ok();
                        };
                        case (null) {
                            return #err("Account preferences not initialized");
                        };
                    };
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Link an account
        public func linkAccount(accountId: Principal) : async Result<(), Text> {
            // Check if account already linked
            let isAlreadyLinked = Array.find<Principal>(linkedAccountsArray, func(p) {
                Principal.equal(p, accountId)
            });

            if (Option.isSome(isAlreadyLinked)) {
                return #err("Account already linked");
            };

            // Add to linked accounts
            linkedAccounts.put(accountId, true);
            
            // Update linked accounts array
            let buffer = Buffer.Buffer<Principal>(linkedAccountsArray.size() + 1);
            for (p in linkedAccountsArray.vals()) {
                buffer.add(p);
            };
            buffer.add(accountId);
            linkedAccountsArray := buffer.toArray();
            
            // Update user with linked account
            switch (currentUser) {
                case (?user) {
                    currentUser := ?{
                        user with
                        linkedAccounts = linkedAccountsArray;
                    };
                    
                    // Log activity
                    addActivityLog("AccountLinked", [("accountId", Principal.toText(accountId))]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("User not initialized");
                };
            };
        };

        // Unlink an account
        public func unlinkAccount(accountId: Principal) : async Result<(), Text> {
            // Don't allow unlinking if it's the primary account
            switch (currentUser) {
                case (?user) {
                    switch (user.primaryAccountId) {
                        case (?primaryId) {
                            if (Principal.equal(primaryId, accountId)) {
                                return #err("Cannot unlink primary account");
                            };
                        };
                        case (null) {
                            // No primary account set, ok to proceed
                        };
                    };
                };
                case (null) {
                    return #err("User not initialized");
                };
            };

            // Remove from linked accounts
            linkedAccounts.delete(accountId);
            
            // Update linked accounts array
            let buffer = Buffer.Buffer<Principal>(0);
            for (p in linkedAccountsArray.vals()) {
                if (not Principal.equal(p, accountId)) {
                    buffer.add(p);
                };
            };
            linkedAccountsArray := buffer.toArray();
            
            // Update user with linked accounts
            switch (currentUser) {
                case (?user) {
                    currentUser := ?{
                        user with
                        linkedAccounts = linkedAccountsArray;
                    };
                    
                    // Log activity
                    addActivityLog("AccountUnlinked", [("accountId", Principal.toText(accountId))]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("User not initialized");
                };
            };
        };

        // Set primary account
        public func setPrimaryAccount(accountId: Principal) : async Result<(), Text> {
            // Check if account is linked
            let isLinked = Array.find<Principal>(linkedAccountsArray, func(p) {
                Principal.equal(p, accountId)
            });

            if (Option.isNull(isLinked)) {
                return #err("Account not linked");
            };

            // Update user with primary account
            switch (currentUser) {
                case (?user) {
                    currentUser := ?{
                        user with
                        primaryAccountId = ?accountId;
                    };
                    
                    // Log activity
                    addActivityLog("PrimaryAccountSet", [("accountId", Principal.toText(accountId))]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("User not initialized");
                };
            };
        };

        // Get linked accounts
        public func getLinkedAccounts() : [Principal] {
            updateLastAccessed();
            return linkedAccountsArray;
        };

        // Get external services configuration
        public func getExternalServices() : ?Types.ExternalServiceTokens {
            switch (currentAccount) {
                case (?account) {
                    updateLastAccessed();
                    return account.accountInfo.externalServices;
                };
                case (null) {
                    return null;
                };
            };
        };
        
        // External service integration methods
        public func addExternalService(serviceType: Text, config: [(Text, Text)]) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    var externalServices = switch (account.accountInfo.externalServices) {
                        case (?services) { services };
                        case (null) {
                            {
                                github = null;
                                discord = null;
                                telegram = null;
                            }
                        };
                    };
                    
                    // Helper to create notification settings
                    func createNotificationSettings() : Types.NotificationSettings {
                        {
                            enabled = true;
                            frequency = ?"immediate";
                            eventTypes = ["all"];
                            muteTimeStart = null;
                            muteTimeEnd = null;
                            customSettings = null;
                        }
                    };
                    
                    // Convert config array to a hashmap for easier access
                    let configMap = HashMap.HashMap<Text, Text>(10, Text.equal, Text.hash);
                    for ((key, value) in config.vals()) {
                        configMap.put(key, value);
                    };
                    
                    switch (serviceType) {
                        case ("github") {
                            let accessToken = Option.get(configMap.get("accessToken"), "");
                            if (accessToken == "") {
                                return #err("Access token is required for GitHub integration");
                            };
                            
                            let tokenExpiry = Option.get(configMap.get("tokenExpiry"), "0");
                            let expiryNat64 = switch (Nat64.fromNat(Text.size(tokenExpiry))) {
                                case (val) { val };
                            };
                            
                            // Get repositories as comma-separated list
                            let reposList = Option.get(configMap.get("repositories"), "");
                            let repos = if (reposList == "") {
                                [] : [Text]
                            } else {
                                // Split by comma and convert to array
                                let splitIter = Text.split(reposList, #text(","));
                                let reposBuffer = Buffer.Buffer<Text>(8);
                                
                                for (repo in splitIter) {
                                    reposBuffer.add(repo);
                                };
                                
                                reposBuffer.toArray()
                            };
                            
                            // Create GitHub config
                            let githubConfig : Types.GitHubConfig = {
                                accessToken = accessToken;
                                tokenExpiry = expiryNat64;
                                connectedRepositories = repos;
                                webhookConfigs = [];
                            };
                            
                            // Update external services
                            externalServices := {
                                externalServices with
                                github = ?githubConfig;
                            };
                        };
                        case ("discord") {
                            let webhookUrl = Option.get(configMap.get("webhookUrl"), "");
                            if (webhookUrl == "") {
                                return #err("Webhook URL is required for Discord integration");
                            };
                            
                            let serverId = Option.get(configMap.get("serverId"), "");
                            let channelId = Option.get(configMap.get("channelId"), "");
                            
                            // Create Discord config
                            let discordConfig : Types.DiscordConfig = {
                                webhookUrl = webhookUrl;
                                serverId = serverId;
                                channelId = channelId;
                                notificationSettings = createNotificationSettings();
                            };
                            
                            // Update external services
                            externalServices := {
                                externalServices with
                                discord = ?discordConfig;
                            };
                        };
                        case ("telegram") {
                            let chatId = Option.get(configMap.get("chatId"), "");
                            if (chatId == "") {
                                return #err("Chat ID is required for Telegram integration");
                            };
                            
                            // Create Telegram config
                            let telegramConfig : Types.TelegramConfig = {
                                chatId = chatId;
                                botEnabled = true;
                                notificationSettings = createNotificationSettings();
                            };
                            
                            // Update external services
                            externalServices := {
                                externalServices with
                                telegram = ?telegramConfig;
                            };
                        };
                        case (_) {
                            return #err("Unsupported service type: " # serviceType);
                        };
                    };
                    
                    // Update account with external services
                    currentAccount := ?{
                        account with
                        accountInfo = {
                            account.accountInfo with
                            externalServices = ?externalServices;
                        };
                    };
                    
                    // Log activity
                    addActivityLog("ExternalServiceConnected", [("serviceType", serviceType)]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Remove external service
        public func removeExternalService(serviceType: Text) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    switch (account.accountInfo.externalServices) {
                        case (?services) {
                            var updatedServices = services;
                            
                            switch (serviceType) {
                                case ("github") {
                                    updatedServices := {
                                        services with
                                        github = null;
                                    };
                                };
                                case ("discord") {
                                    updatedServices := {
                                        services with
                                        discord = null;
                                    };
                                };
                                case ("telegram") {
                                    updatedServices := {
                                        services with
                                        telegram = null;
                                    };
                                };
                                case (_) {
                                    return #err("Unsupported service type: " # serviceType);
                                };
                            };
                            
                            // Update account with modified external services
                            currentAccount := ?{
                                account with
                                accountInfo = {
                                    account.accountInfo with
                                    externalServices = ?updatedServices;
                                };
                            };
                            
                            // Log activity
                            addActivityLog("ExternalServiceRemoved", [("serviceType", serviceType)]);
                            
                            return #ok();
                        };
                        case (null) {
                            return #err("External services not initialized");
                        };
                    };
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Update GitHub repository connections
        public func updateGitHubRepositories(repositories: [Text]) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    switch (account.accountInfo.externalServices) {
                        case (?services) {
                            switch (services.github) {
                                case (?github) {
                                    // Update GitHub config with new repositories
                                    let updatedGitHub : Types.GitHubConfig = {
                                        github with
                                        connectedRepositories = repositories;
                                    };
                                    
                                    // Update external services
                                    let updatedServices = {
                                        services with
                                        github = ?updatedGitHub;
                                    };
                                    
                                    // Update account with external services
                                    currentAccount := ?{
                                        account with
                                        accountInfo = {
                                            account.accountInfo with
                                            externalServices = ?updatedServices;
                                        };
                                    };
                                    
                                    // Log activity
                                    addActivityLog("GitHubRepositoriesUpdated", [("count", Nat.toText(repositories.size()))]);
                                    
                                    return #ok();
                                };
                                case (null) {
                                    return #err("GitHub integration not configured");
                                };
                            };
                        };
                        case (null) {
                            return #err("External services not configured");
                        };
                    };
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Add GitHub webhook
        public func addGitHubWebhook(url: Text, secret: Text, events: [Text]) : async Result<Text, Text> {
            switch (currentAccount) {
                case (?account) {
                    switch (account.accountInfo.externalServices) {
                        case (?services) {
                            switch (services.github) {
                                case (?github) {
                                    // Generate a webhook ID
                                    let webhookId = generateId();
                                    
                                    // Create new webhook config
                                    let webhook : Types.WebhookConfig = {
                                        id = webhookId;
                                        url = url;
                                        secret = secret;
                                        events = events;
                                        active = true;
                                    };
                                    
                                    // Add to existing webhooks
                                    let webhooks = Buffer.Buffer<Types.WebhookConfig>(github.webhookConfigs.size() + 1);
                                    for (w in github.webhookConfigs.vals()) {
                                        webhooks.add(w);
                                    };
                                    webhooks.add(webhook);
                                    
                                    // Update GitHub config
                                    let updatedGitHub : Types.GitHubConfig = {
                                        github with
                                        webhookConfigs = webhooks.toArray();
                                    };
                                    
                                    // Update external services
                                    let updatedServices = {
                                        services with
                                        github = ?updatedGitHub;
                                    };
                                    
                                    // Update account with external services
                                    currentAccount := ?{
                                        account with
                                        accountInfo = {
                                            account.accountInfo with
                                            externalServices = ?updatedServices;
                                        };
                                    };
                                    
                                    // Log activity
                                    addActivityLog("GitHubWebhookAdded", [("webhookId", webhookId), ("url", url)]);
                                    
                                    return #ok(webhookId);
                                };
                                case (null) {
                                    return #err("GitHub integration not configured");
                                };
                            };
                        };
                        case (null) {
                            return #err("External services not configured");
                        };
                    };
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Update account type
        public func updateAccountType(accountType: AccountType) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    // Update account type
                    currentAccount := ?{
                        account with
                        accountInfo = {
                            account.accountInfo with
                            accountType = accountType;
                        };
                    };
                    
                    // Log activity
                    let accountTypeText = switch (accountType) {
                        case (#Basic) "Basic";
                        case (#Premium) "Premium";
                        case (#Enterprise) "Enterprise";
                        case (#Custom(t)) "Custom: " # t;
                    };
                    
                    addActivityLog("AccountTypeUpdated", [("type", accountTypeText)]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Update canister settings
        public func updateCanisterSettings(settings: Types.CanisterSettings) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    // Update canister settings
                    currentAccount := ?{
                        account with
                        accountInfo = {
                            account.accountInfo with
                            canisterSettings = ?settings;
                        };
                    };
                    
                    // Log activity
                    addActivityLog("CanisterSettingsUpdated", [
                        ("canisterName", settings.name),
                        ("memoryAllocation", Nat.toText(settings.memoryAllocation)),
                        ("computeAllocation", Nat.toText(settings.computeAllocation))
                    ]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Add a project to resources
        public func addProject(id: Text, name: Text, visibility: Visibility) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    let newProject : ProjectReference = {
                        id = id;
                        name = name;
                        visibility = visibility;
                        lastModified = now;
                    };
                    
                    // Add to projects array
                    let buffer = Buffer.Buffer<ProjectReference>(account.resources.projects.size() + 1);
                    for (p in account.resources.projects.vals()) {
                        buffer.add(p);
                    };
                    buffer.add(newProject);
                    
                    // Update account resources
                    currentAccount := ?{
                        account with
                        resources = {
                            account.resources with
                            projects = buffer.toArray();
                        };
                        stats = {
                            account.stats with
                            projectsCreated = account.stats.projectsCreated + 1;
                        };
                    };
                    
                    // Log activity
                    addActivityLog("ProjectAdded", [("projectId", id), ("projectName", name)]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Update project
        public func updateProject(id: Text, name: Text, visibility: Visibility) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Find the project
                    let projectIndex = Array.indexOf<Text>(
                        id,
                        Array.map<ProjectReference, Text>(
                            account.resources.projects,
                            func(p: ProjectReference) : Text { p.id }
                        ),
                        Text.equal
                    );
                    
                    switch (projectIndex) {
                        case (?index) {
                            // Create a buffer to update the project
                            let buffer = Buffer.Buffer<ProjectReference>(account.resources.projects.size());
                            
                            // Add all projects, updating the one with the matching id
                            for (i in Iter.range(0, account.resources.projects.size() - 1)) {
                                if (i == index) {
                                    // Update this project
                                    buffer.add({
                                        id = id;
                                        name = name;
                                        visibility = visibility;
                                        lastModified = now;
                                    });
                                } else if (i < account.resources.projects.size()) {
                                    // Add other projects unchanged
                                    buffer.add(account.resources.projects[i]);
                                };
                            };
                            
                            // Update account resources
                            currentAccount := ?{
                                account with
                                resources = {
                                    account.resources with
                                    projects = buffer.toArray();
                                };
                            };
                            
                            // Log activity
                            addActivityLog("ProjectUpdated", [("projectId", id), ("projectName", name)]);
                            
                            return #ok();
                        };
                        case (null) {
                            return #err("Project not found");
                        };
                    };
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Delete project
        public func deleteProject(id: Text) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    // Find the project name before deletion for activity log
                    var projectName = "Unknown";
                    for (project in account.resources.projects.vals()) {
                        if (project.id == id) {
                            projectName := project.name;
                        };
                    };
                    
                    // Filter out the project to delete
                    let updatedProjects = Array.filter<ProjectReference>(
                        account.resources.projects,
                        func(p: ProjectReference) : Bool { p.id != id }
                    );
                    
                    // Update account resources
                    currentAccount := ?{
                        account with
                        resources = {
                            account.resources with
                            projects = updatedProjects;
                        };
                    };
                    
                    // Log activity
                    addActivityLog("ProjectDeleted", [("projectId", id), ("projectName", projectName)]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Add a template to resources
        public func addTemplate(id: Text, name: Text, visibility: Visibility, price: ?Nat64) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    let newTemplate : TemplateReference = {
                        id = id;
                        name = name;
                        visibility = visibility;
                        price = price;
                        salesCount = 0;
                    };
                    
                    // Add to templates array
                    let buffer = Buffer.Buffer<TemplateReference>(account.resources.templates.size() + 1);
                    for (t in account.resources.templates.vals()) {
                        buffer.add(t);
                    };
                    buffer.add(newTemplate);
                    
                    // Update account resources
                    currentAccount := ?{
                        account with
                        resources = {
                            account.resources with
                            templates = buffer.toArray();
                        };
                        stats = {
                            account.stats with
                            templatesPublished = account.stats.templatesPublished + 1;
                        };
                    };
                    
                    // Log activity
                    addActivityLog("TemplatePublished", [("templateId", id), ("templateName", name)]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Record template sale
        public func recordTemplateSale(templateId: Text, revenue: Nat64) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    // Find the template
                    let templateIndex = Array.indexOf<Text>(
                        templateId,
                        Array.map<TemplateReference, Text>(
                            account.resources.templates,
                            func(t: TemplateReference) : Text { t.id }
                        ),
                        Text.equal
                    );
                    
                    switch (templateIndex) {
                        case (?index) {
                            // Create a buffer to update the template
                            let buffer = Buffer.Buffer<TemplateReference>(account.resources.templates.size());
                            
                            // Add all templates, updating the one with the matching id
                            for (i in Iter.range(0, account.resources.templates.size() - 1)) {
                                if (i == index) {
                                    // Update this template
                                    let template = account.resources.templates[i];
                                    buffer.add({
                                        template with
                                        salesCount = template.salesCount + 1;
                                    });
                                } else if (i < account.resources.templates.size()) {
                                    // Add other templates unchanged
                                    buffer.add(account.resources.templates[i]);
                                };
                            };
                            
                            // Update account resources and stats
                            currentAccount := ?{
                                account with
                                resources = {
                                    account.resources with
                                    templates = buffer.toArray();
                                };
                                stats = {
                                    account.stats with
                                    templatesSold = account.stats.templatesSold + 1;
                                    totalRevenue = account.stats.totalRevenue + revenue;
                                };
                            };
                            
                            // Log activity
                            addActivityLog("TemplateSold", [
                                ("templateId", templateId),
                                ("revenue", Nat64.toText(revenue))
                            ]);
                            
                            return #ok();
                        };
                        case (null) {
                            return #err("Template not found");
                        };
                    };
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Add a deployment to resources
        public func addDeployment(id: Text, name: Text, projectId: Text, canisterId: ?Principal, status: Text, network: Text) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    let newDeployment : DeploymentReference = {
                        id = id;
                        name = name;
                        projectId = projectId;
                        canisterId = canisterId;
                        status = status;
                        network = network;
                        lastUpdated = now;
                    };
                    
                    // Add to deployments array
                    let buffer = Buffer.Buffer<DeploymentReference>(account.resources.deployments.size() + 1);
                    for (d in account.resources.deployments.vals()) {
                        buffer.add(d);
                    };
                    buffer.add(newDeployment);
                    
                    // Update account resources
                    currentAccount := ?{
                        account with
                        resources = {
                            account.resources with
                            deployments = buffer.toArray();
                        };
                    };
                    
                    // Log activity
                    let details = switch (canisterId) {
                        case (?cid) {
                            [("deploymentId", id), ("deploymentName", name), ("canisterId", Principal.toText(cid)), ("network", network)];
                        };
                        case (null) {
                            [("deploymentId", id), ("deploymentName", name), ("network", network)];
                        };
                    };
                    
                    addActivityLog("DeploymentCreated", details);
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Add to AccountManager class in account.mo
public func deleteDeployment(id: Text) : async Result<(), Text> {
    switch (currentAccount) {
        case (?account) {
            // Find the deployment name before deletion for activity log
            var deploymentName = "Unknown";
            for (deployment in account.resources.deployments.vals()) {
                if (deployment.id == id) {
                    deploymentName := deployment.name;
                };
            };
            
            // Filter out the deployment to delete
            let updatedDeployments = Array.filter<DeploymentReference>(
                account.resources.deployments,
                func(d: DeploymentReference) : Bool { d.id != id }
            );
            
            if (updatedDeployments.size() == account.resources.deployments.size()) {
                return #err("Deployment not found");
            };
            
            // Update account resources
            currentAccount := ?{
                account with
                resources = {
                    account.resources with
                    deployments = updatedDeployments;
                };
            };
            
            // Log activity
            addActivityLog("DeploymentDeleted", [("deploymentId", id), ("deploymentName", deploymentName)]);
            
            return #ok();
        };
        case (null) {
            return #err("Account not initialized");
        };
    };
};

        // Update deployment status
        public func updateDeploymentStatus(id: Text, status: Text) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Find the deployment
                    let deploymentIndex = Array.indexOf<Text>(
                        id,
                        Array.map<DeploymentReference, Text>(
                            account.resources.deployments,
                            func(d: DeploymentReference) : Text { d.id }
                        ),
                        Text.equal
                    );
                    
                    switch (deploymentIndex) {
                        case (?index) {
                            // Create a buffer to update the deployment
                            let buffer = Buffer.Buffer<DeploymentReference>(account.resources.deployments.size());
                            
                            // Add all deployments, updating the one with the matching id
                            for (i in Iter.range(0, account.resources.deployments.size() - 1)) {
                                if (i == index) {
                                    // Update this deployment
                                    let deployment = account.resources.deployments[i];
                                    buffer.add({
                                        deployment with
                                        status = status;
                                        lastUpdated = now;
                                    });
                                } else if (i < account.resources.deployments.size()) {
                                    // Add other deployments unchanged
                                    buffer.add(account.resources.deployments[i]);
                                };
                            };
                            
                            // Update account resources
                            currentAccount := ?{
                                account with
                                resources = {
                                    account.resources with
                                    deployments = buffer.toArray();
                                };
                            };
                            
                            // Log activity
                            addActivityLog("DeploymentStatusUpdated", [
                                ("deploymentId", id),
                                ("status", status)
                            ]);
                            
                            return #ok();
                        };
                        case (null) {
                            return #err("Deployment not found");
                        };
                    };
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Add a collaborator
        public func addCollaborator(principalId: Principal, role: RoleType, permissions: [Text], expiresAt: ?Timestamp) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    // Check if collaborator already exists
                    let existingIndex = Array.indexOf<Collaborator>({
                        principal = principalId;
                        role = role;
                        permissions = permissions;
                        addedAt = 0;
                        expiresAt = null;
                        status = #Active;
                    }, account.collaborators, func(a: Collaborator, b: Collaborator) : Bool {
                        Principal.equal(a.principal, b.principal)
                    });
                    
                    if (Option.isSome(existingIndex)) {
                        return #err("Collaborator already exists");
                    };
                    
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    let newCollaborator : Collaborator = {
                        principal = principalId;
                        role = role;
                        permissions = permissions;
                        addedAt = now;
                        expiresAt = expiresAt;
                        status = #Invited;
                    };
                    
                    // Add to collaborators array
                    let buffer = Buffer.Buffer<Collaborator>(account.collaborators.size() + 1);
                    for (c in account.collaborators.vals()) {
                        buffer.add(c);
                    };
                    buffer.add(newCollaborator);
                    
                    // Update account collaborators
                    currentAccount := ?{
                        account with
                        collaborators = buffer.toArray();
                    };
                    
                    // Log activity
                    let roleText = switch (role) {
                        case (#Developer) "Developer";
                        case (#Reviewer) "Reviewer";
                        case (#Contributor) "Contributor";
                        case (#Custom(t)) t;
                    };
                    
                    addActivityLog("CollaboratorInvited", [
                        ("collaborator", Principal.toText(principalId)),
                        ("role", roleText)
                    ]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Update a collaborator's status
        public func updateCollaboratorStatus(principalId: Principal, status: CollaboratorStatus) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    // Find the collaborator
                    let collaboratorIndex = Array.indexOf<Principal>(
                        principalId,
                        Array.map<Collaborator, Principal>(
                            account.collaborators,
                            func(c: Collaborator) : Principal { c.principal }
                        ),
                        Principal.equal
                    );
                    
                    switch (collaboratorIndex) {
                        case (?index) {
                            // Create a buffer to update the collaborator
                            let buffer = Buffer.Buffer<Collaborator>(account.collaborators.size());
                            
                            // Add all collaborators, updating the one with the matching principal
                            for (i in Iter.range(0, account.collaborators.size() - 1)) {
                                if (i == index) {
                                    // Update this collaborator
                                    let collaborator = account.collaborators[i];
                                    buffer.add({
                                        collaborator with
                                        status = status;
                                    });
                                } else if (i < account.collaborators.size()) {
                                    // Add other collaborators unchanged
                                    buffer.add(account.collaborators[i]);
                                };
                            };
                            
                            // Update account collaborators
                            currentAccount := ?{
                                account with
                                collaborators = buffer.toArray();
                            };
                            
                            // Log activity
                            let statusText = switch (status) {
                                case (#Active) "Active";
                                case (#Invited) "Invited";
                                case (#Removed) "Removed";
                            };
                            
                            addActivityLog("CollaboratorStatusUpdated", [
                                ("collaborator", Principal.toText(principalId)),
                                ("status", statusText)
                            ]);
                            
                            return #ok();
                        };
                        case (null) {
                            return #err("Collaborator not found");
                        };
                    };
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Update cycles balance
        public func updateCyclesBalance(newBalance: Nat64) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    // Update cycles balance
                    currentAccount := ?{
                        account with
                        stats = {
                            account.stats with
                            cyclesBalance = newBalance;
                        };
                    };
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Set user reputation score to a specific value
        public func setUserReputation(newReputation: Nat) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    // Update account stats with new reputation value
                    currentAccount := ?{
                        account with
                        stats = {
                            account.stats with
                            reputation = newReputation;
                        };
                    };
                    
                    // Log activity
                    addActivityLog("ReputationUpdated", [
                        ("newValue", Nat.toText(newReputation))
                    ]);
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // Update storage used
        public func updateStorageUsed(newStorageUsed: Nat64) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    // Update storage used
                    currentAccount := ?{
                        account with
                        stats = {
                            account.stats with
                            storageUsed = newStorageUsed;
                        };
                    };
                    
                    return #ok();
                };
                case (null) {
                    return #err("Account not initialized");
                };
            };
        };

        // AI Credits Management Methods
        public func deductAICredits(
            projectId: Text, 
            inputTokens: Nat, 
            outputTokens: Nat, 
            model: Text,
            operation: Text
        ) : async Result<Nat, Text> {
            switch (currentAccount) {
                case null { #err("Account not initialized") };
                case (?account) {
                    // Model pricing configuration
                    let pricing = switch (model) {
                        case ("claude-sonnet-4") { { inputCostPer1K = 3; outputCostPer1K = 15; } };
                        case ("claude-opus-4") { { inputCostPer1K = 15; outputCostPer1K = 75; } };
                        case ("claude-haiku-3.5") { { inputCostPer1K = 1; outputCostPer1K = 3; } };
                        case (_) { { inputCostPer1K = 3; outputCostPer1K = 15; } }; // Default to Sonnet
                    };
                    
                    // Calculate base cost (credits per 1000 tokens)
                    let inputCost = (inputTokens * pricing.inputCostPer1K) / 1000;
                    let outputCost = (outputTokens * pricing.outputCostPer1K) / 1000;
                    let baseCost = inputCost + outputCost;
                    
                    // Calculate 20% platform commission
                    let commission = (baseCost * 20) / 100;
                    let totalCostWithCommission = baseCost + commission;
                    
                    // Check if user has enough credits (must cover base + commission)
                    if (account.stats.aiCreditsBalance < totalCostWithCommission) {
                        return #err("Insufficient AI credits. Need " # Nat.toText(totalCostWithCommission) # " credits (base: " # Nat.toText(baseCost) # " + 20% commission: " # Nat.toText(commission) # "), have " # Nat.toText(account.stats.aiCreditsBalance));
                    };
                    
                    // Deduct credits and update stats (deduct total including commission)
                    let updatedStats = {
                        account.stats with
                        aiCreditsBalance = account.stats.aiCreditsBalance - totalCostWithCommission;
                        aiCreditsUsed = account.stats.aiCreditsUsed + totalCostWithCommission;
                        monthlyAIUsage = account.stats.monthlyAIUsage + totalCostWithCommission;
                        lastActive = Nat64.fromNat(Int.abs(Time.now()));
                    };
                    
                    // Update account
                    currentAccount := ?{
                        account with stats = updatedStats;
                    };
                    
                    // Log activity (including commission breakdown)
                    addActivityLog("AICreditsUsed", [
                        ("projectId", projectId),
                        ("model", model),
                        ("operation", operation),
                        ("baseCost", Nat.toText(baseCost)),
                        ("commission", Nat.toText(commission)),
                        ("totalCharged", Nat.toText(totalCostWithCommission)),
                        ("inputTokens", Nat.toText(inputTokens)),
                        ("outputTokens", Nat.toText(outputTokens))
                    ]);
                    
                    // Note: Platform canister tracks commission via frontend or separate call
                    // Frontend should call platform.trackCreditCommission(userPrincipal, baseCost, commission)
                    
                    #ok(account.stats.aiCreditsBalance - totalCostWithCommission)
                };
            }
        };

        public func refundAICredits(projectId: Text, amount: Nat, reason: Text) : async Result<Bool, Text> {
            switch (currentAccount) {
                case null { #err("Account not initialized") };
                case (?account) {
                    let updatedStats = {
                        account.stats with
                        aiCreditsBalance = account.stats.aiCreditsBalance + amount;
                        aiCreditsUsed = if (account.stats.aiCreditsUsed >= amount) { 
                            account.stats.aiCreditsUsed - amount 
                        } else { 0 };
                        monthlyAIUsage = if (account.stats.monthlyAIUsage >= amount) { 
                            account.stats.monthlyAIUsage - amount 
                        } else { 0 };
                    };
                    
                    currentAccount := ?{
                        account with stats = updatedStats;
                    };
                    
                    // Log activity
                    addActivityLog("AICreditsRefunded", [
                        ("projectId", projectId),
                        ("amount", Nat.toText(amount)),
                        ("reason", reason)
                    ]);
                    
                    #ok(true)
                };
            }
        };

        public func refreshMonthlyAICredits() : async Result<Bool, Text> {
            switch (currentAccount) {
                case (?account) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    let daysSinceRefresh = (now - account.stats.lastAICreditsRefresh) / (24 * 60 * 60 * 1_000_000_000);
                    
                    // Check if 30 days have passed (monthly refresh)
                    if (daysSinceRefresh >= 30) {
                        // Get allocation based on subscription tier
                        let allocation = switch (account.stats.subscriptionTier) {
                            case ("free") { 10000 };
                            case ("pro") { 50000 };
                            case ("team") { 100000 };
                            case ("enterprise") { 500000 };
                            case (_) { 10000 }; // Default to free tier
                        };
                        
                        let updatedStats = {
                            account.stats with
                            aiCreditsBalance = allocation;
                            aiCreditsAllocated = allocation;
                            aiCreditsUsed = 0;
                            monthlyAIUsage = 0;
                            lastAICreditsRefresh = now;
                        };
                        
                        currentAccount := ?{
                            account with stats = updatedStats;
                        };
                        
                        // Log activity
                        addActivityLog("MonthlyCreditsRefreshed", [
                            ("allocation", Nat.toText(allocation)),
                            ("tier", account.stats.subscriptionTier)
                        ]);
                        
                        #ok(true)
                    } else {
                        #err("Not time for refresh yet. " # Nat64.toText(30 - daysSinceRefresh) # " days remaining")
                    }
                };
                case (null) { #err("Account not initialized") };
            }
        };

        public func updateSubscriptionTier(tier: Text, monthlyAllocation: Nat) : async Result<Bool, Text> {
            switch (currentAccount) {
                case null { #err("Account not initialized") };
                case (?account) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    // Update account stats
                    let updatedStats = {
                        account.stats with
                        subscriptionTier = tier;
                        aiCreditsBalance = monthlyAllocation;
                        aiCreditsAllocated = monthlyAllocation;
                        aiCreditsUsed = 0;
                        monthlyAIUsage = 0;
                        lastAICreditsRefresh = now;
                    };
                    
                    currentAccount := ?{
                        account with stats = updatedStats;
                    };
                    
                    // Log activity
                    addActivityLog("SubscriptionUpdated", [
                        ("tier", tier),
                        ("allocation", Nat.toText(monthlyAllocation))
                    ]);
                    
                    #ok(true)
                };
            }
        };

        // First Login and Onboarding Methods
        public func markFirstLogin() : async Result<Bool, Text> {
            switch (currentAccount) {
                case null { #err("Account not initialized") };
                case (?account) {
                    // Only set if not already set
                    switch (account.accountInfo.firstLoginAt) {
                        case (?_) { #err("First login already recorded") };
                        case null {
                            let now = Nat64.fromNat(Int.abs(Time.now()));
                            
                            let updatedAccountInfo = {
                                account.accountInfo with
                                firstLoginAt = ?now;
                                lastAccessed = now;
                            };
                            
                            currentAccount := ?{
                                account with accountInfo = updatedAccountInfo;
                            };
                            
                            // Log activity
                            addActivityLog("FirstLogin", [("timestamp", Nat64.toText(now))]);
                            
                            #ok(true)
                        };
                    }
                };
            }
        };

        public func completeOnboarding() : async Result<Bool, Text> {
            switch (currentAccount) {
                case null { #err("Account not initialized") };
                case (?account) {
                    let now = Nat64.fromNat(Int.abs(Time.now()));
                    
                    let updatedAccountInfo = {
                        account.accountInfo with
                        hasCompletedOnboarding = true;
                        lastAccessed = now;
                    };
                    
                    currentAccount := ?{
                        account with accountInfo = updatedAccountInfo;
                    };
                    
                    // Log activity
                    addActivityLog("OnboardingCompleted", [("timestamp", Nat64.toText(now))]);
                    
                    #ok(true)
                };
            }
        };

        // Query methods for AI credits
        public func getAICreditsBalance() : Nat {
            switch (currentAccount) {
                case (?account) { account.stats.aiCreditsBalance };
                case null { 0 };
            }
        };

        public func getAIUsageThisMonth() : Nat {
            switch (currentAccount) {
                case (?account) { account.stats.monthlyAIUsage };
                case null { 0 };
            }
        };

        public func getSubscriptionTier() : Text {
            switch (currentAccount) {
                case (?account) { account.stats.subscriptionTier };
                case null { "free" };
            }
        };

        public func getOnboardingStatus() : {
            hasCompletedOnboarding: Bool;
            firstLoginAt: ?Nat64;
            accountCreatedAt: ?Nat64;
        } {
            switch (currentAccount) {
                case (?account) {
                    {
                        hasCompletedOnboarding = account.accountInfo.hasCompletedOnboarding;
                        firstLoginAt = account.accountInfo.firstLoginAt;
                        accountCreatedAt = ?account.accountInfo.createdAt;
                    }
                };
                case null {
                    {
                        hasCompletedOnboarding = false;
                        firstLoginAt = null;
                        accountCreatedAt = null;
                    }
                };
            }
        };

        public func isFirstTimeUser() : Bool {
            switch (currentAccount) {
                case (?account) {
                    switch (account.accountInfo.firstLoginAt) {
                        case null { true };  // Never logged in
                        case (?_) { not account.accountInfo.hasCompletedOnboarding }; // Logged in but not onboarded
                    }
                };
                case null { true }; // No account = first time
            }
        };


        // Stripe Data Storage Methods
        public func setStripeCustomerId(customerId: Text) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    let updatedStats = {
                        account.stats with
                        stripeCustomerId = ?customerId;
                    };
                    
                    currentAccount := ?{
                        account with stats = updatedStats;
                    };
                    
                    // Log activity
                    addActivityLog("StripeCustomerLinked", [("customerId", customerId)]);
                    
                    #ok(())
                };
                case (null) { #err("Account not initialized") };
            }
        };

        public func updateSubscriptionStatus(active: Bool) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    let updatedStats = {
                        account.stats with
                        subscriptionActive = active;
                    };
                    
                    currentAccount := ?{
                        account with stats = updatedStats;
                    };
                    
                    // Log activity
                    addActivityLog("SubscriptionStatusUpdated", [("active", if (active) "true" else "false")]);
                    
                    #ok(())
                };
                case (null) { #err("Account not initialized") };
            }
        };

        public func updateBillingCycleEnd(endTimestamp: Nat64) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    let updatedStats = {
                        account.stats with
                        billingCycleEnd = ?endTimestamp;
                    };
                    
                    currentAccount := ?{
                        account with stats = updatedStats;
                    };
                    
                    // Log activity
                    addActivityLog("BillingCycleUpdated", [("endTimestamp", Nat64.toText(endTimestamp))]);
                    
                    #ok(())
                };
                case (null) { #err("Account not initialized") };
            }
        };

        // Query Methods (fast local access)
        public func getStripeCustomerId() : ?Text {
            switch (currentAccount) {
                case (?account) { account.stats.stripeCustomerId };
                case (null) { null };
            }
        };

        public func isSubscriptionActive() : Bool {
            switch (currentAccount) {
                case (?account) { account.stats.subscriptionActive };
                case (null) { false };
            }
        };

        public func getBillingCycleEnd() : ?Nat64 {
            switch (currentAccount) {
                case (?account) { account.stats.billingCycleEnd };
                case (null) { null };
            }
        };

        // Combined method to update all Stripe data at once
        public func updateStripeData(customerId: ?Text, subscriptionActive: Bool, billingCycleEnd: ?Nat64) : async Result<(), Text> {
            switch (currentAccount) {
                case (?account) {
                    let updatedStats = {
                        account.stats with
                        stripeCustomerId = customerId;
                        subscriptionActive = subscriptionActive;
                        billingCycleEnd = billingCycleEnd;
                    };
                    
                    currentAccount := ?{
                        account with stats = updatedStats;
                    };
                    
                    // Log activity
                    addActivityLog("StripeDataUpdated", [
                        ("hasCustomerId", if (Option.isSome(customerId)) "true" else "false"),
                        ("subscriptionActive", if (subscriptionActive) "true" else "false"),
                        ("hasBillingCycleEnd", if (Option.isSome(billingCycleEnd)) "true" else "false")
                    ]);
                    
                    #ok(())
                };
                case (null) { #err("Account not initialized") };
            }
        };



    };  // End of AccountManager class
};     // End of module