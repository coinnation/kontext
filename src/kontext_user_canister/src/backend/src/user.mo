import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Types "types";
import CustomDebug "Debug";
import Float "mo:base/Float"; 
import Nat64 "mo:base/Nat64";
import Nat32 "mo:base/Nat32";
import Nat8 "mo:base/Nat8";
import Text "mo:base/Text";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Region "mo:base/Region";
import Cycles "mo:base/ExperimentalCycles";
import Interface "ic-management-interface";
import wallet "wallet";
import canister "canister";
import Error "mo:base/Error";
import Result "mo:base/Result";
import Buffer "mo:base/Buffer";
import Nat "mo:base/Nat";
import Debug "mo:base/Debug";
import Char "mo:base/Char";
import Prim "mo:prim";
import codeArtifacts "code_artifacts";
import metadata "metadata";
import Option "mo:base/Option";
import Blob "mo:base/Blob";
import Int "mo:base/Int";
import ProjectTypes "project_types";
import AccountTypes "account_types";
import Account "account";
import VersionTypes "project_version_types";
import VersionManager "version_manager";
import Time "mo:base/Time";
import PathUtils "path_utils";
import Bool "mo:base/Bool";
import Random "mo:base/Random";
import Hash "mo:base/Hash";
import L "mo:cn-logger/logger";



actor Main {
    // Type aliases
    type Project = ProjectTypes.Project;
    type ProjectType = ProjectTypes.ProjectType;
    type PackageInfo = ProjectTypes.PackageInfo;
    type NPMPackageInfo = ProjectTypes.NPMPackageInfo;
    type User = AccountTypes.User;
    type CodeArtifact = Types.CodeArtifact;
    type ChunkId = Types.ChunkId;
    type Chunk = Types.Chunk;
    type CanisterMetadata = canister.CanisterMetadata;
    type Wallet = wallet.Wallet;

    type ProjectVersion = VersionTypes.ProjectVersion;
    type SemanticVersion = VersionTypes.SemanticVersion;
    type VersionArtifact = VersionTypes.VersionArtifact;
    type VersionStatus = VersionTypes.VersionStatus;
    type ArtifactFile = VersionTypes.ArtifactFile;
    type VersionError = VersionManager.VersionError;

    public type FileData = {
        fileName: Text;
        content: codeArtifacts.FileContent;
        mimeType: Text;
        language: Text;
        path: Text;
    };


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



    public type DeploymentReference = {
        id: Text;               // Unique identifier
        name: Text;             // User-friendly name
        projectId: Text;        // Associated project
        canisterId: ?Principal; // The actual canister ID once deployed
        status: Text;           // Simple status like "running", "stopped"
        network: Text;          // "ic", "local", etc.
        lastUpdated: Nat64; // When it was last updated
    };

    public type ServerPair = {
        pairId: Text;
        name: Text;
        frontendCanisterId: Principal;
        backendCanisterId: Principal;
        createdAt: Nat64;
        creditsAllocated: Nat;
    };

    // ===============================
    // USER CONTEXT & PREFERENCES TYPES
    // ===============================
    
    public type ReferenceItem = {
        id: Text;
        title: Text;
        content: Text;
        category: ?Text;
        createdAt: Nat64;
    };

    public type CodeRule = {
        id: Text;
        title: Text;
        rule: Text;
        examples: [Text];
        createdAt: Nat64;
    };

    public type ColorPalette = {
        id: Text;
        name: Text;
        colors: [Text];
        createdAt: Nat64;
    };

    public type DesignInspiration = {
        id: Text;
        title: Text;
        url: ?Text;
        imageUrl: ?Text;
        notes: ?Text;
        createdAt: Nat64;
    };

    public type DocumentationItem = {
        id: Text;
        title: Text;
        content: Text;
        category: ?Text;
        createdAt: Nat64;
    };

    public type GitHubGuideline = {
        id: Text;
        title: Text;
        guideline: Text;
        createdAt: Nat64;
    };

    public type CodeTemplate = {
        id: Text;
        name: Text;
        language: Text;
        code: Text;
        description: ?Text;
        createdAt: Nat64;
    };

    public type APIEndpoint = {
        id: Text;
        name: Text;
        method: Text;
        url: Text;
        headers: [(Text, Text)];
        body: ?Text;
        description: ?Text;
        createdAt: Nat64;
    };

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

    // ===============================
    // LOGGING SETUP
    
//    private let logBuffer = Buffer.Buffer<Text>(0);

//     private func log(message: Text) {
//         Debug.print("[LOG] " # message);
//         logBuffer.add(message);
//     };

//     public query func getLogs() : async [Text] {
//         Buffer.toArray(logBuffer)
//     };

    // ===============================
    // STABLE STORAGE DECLARATIONS
    // ===============================
    // User Information
    private stable var userData : ?User = null;
    
    // Wallet & Canister Management
    private stable var userWallet : ?Wallet = null;
    private stable var userCanisters : [Principal] = [];
    private stable var userCanisterMetadata : [(Principal, CanisterMetadata)] = [];
    
    // Project & Code Storage
    private stable var userProjects : [Project] = [];
    private stable var codeArtifactEntries : [(Text, CodeArtifact)] = [];
    private stable var chunkEntries : [(ChunkId, Chunk)] = [];
    private stable var nextChunkIdStable : Nat = 0;
    private stable var forceLocalMode : Bool = false;

    // Basic state
    stable var state: [(Text, Text)] = [];
    stable var startTime: Nat64 = 0;
    stable var lastUpdated: Nat64 = 0;
    stable var regionData = Region.new();
    stable var canisterPrincipal: Text = Principal.toText(Principal.fromActor(Main));

    // Account-specific stable storage
    stable var accountUserData : ?AccountTypes.User = null;
    stable var accountManagerData : ?AccountTypes.Account = null;
    stable var accountLinkedPrincipals : [Principal] = [];


    private stable var versionEntries : [(Text, ProjectVersion)] = [];
    private stable var artifactEntries : [(Text, VersionArtifact)] = [];
    private stable var projectVersionEntries : [(Text, [Text])] = [];


    private stable var stableLogger : ?L.StableLoggerData = null;

    private stable var serverPairsEntries : [(Text, ServerPair)] = [];
    // 🚀 PERFORMANCE FIX: Direct project → server pair mapping (O(1) lookups)
    private stable var projectServerPairsEntries : [(Text, [Text])] = [];

    private stable var aiUsageHistory : [AccountTypes.AIUsageRecord] = [];
    private stable var userSubscription : ?AccountTypes.Subscription = null;

    // ===============================
    // USER CONTEXT & PREFERENCES STORAGE
    // ===============================
    private stable var userReferences : [ReferenceItem] = [];
    private stable var userCodeRules : [CodeRule] = [];
    private stable var userColorPalettes : [ColorPalette] = [];
    private stable var userDesignInspirations : [DesignInspiration] = [];
    private stable var userDocumentationItems : [DocumentationItem] = [];
    private stable var userGitHubGuidelines : [GitHubGuideline] = [];
    private stable var userCodeTemplates : [CodeTemplate] = [];
    private stable var userAPIEndpoints : [APIEndpoint] = [];

    // ===============================
    // AGENT CREDENTIALS & ENVIRONMENT VARIABLES
    // ===============================
    private stable var agentCredentialsStore : [AccountTypes.AgentCredentials] = [];
    private stable var environmentConfigStore : [AccountTypes.EnvironmentConfig] = [];
    private stable var apiCredentialsStore : [AccountTypes.APICredential] = [];
    private stable var databaseCredentialsStore : [AccountTypes.DatabaseCredential] = [];
    
    // Public Profile Storage
    private stable var userPublicProfile : ?AccountTypes.PublicProfile = null;
    private stable var securityAuditLogs : [AccountTypes.SecurityAuditLog] = [];

    // ===============================
    // USER PREFERENCES & UI STATE
    // ===============================
    private stable var selectedServerPairId : ?Text = null;  // Currently selected server pair for UI
    private stable var selectedProjectId : ?Text = null;     // Currently selected project for UI

    // ===============================
    // TRANSIENT STORAGE & VARIABLES
    // ===============================
    private var transientState = HashMap.HashMap<Text, Text>(10, Text.equal, Text.hash);
    private var logs: [CustomDebug.LogEntry] = [];
    private var artifactManager : ?codeArtifacts.CodeArtifactManager = null;
    let ASSET_CANISTER_ID = "bd3sg-teaaa-aaaaa-qaaba-cai";
    private var versionManager : ?VersionManager.VersionManager = null;
    private var serverPairs = HashMap.HashMap<Text, ServerPair>(32, Text.equal, Text.hash);
    // 🚀 PERFORMANCE FIX: Direct project → server pair IDs mapping for O(1) lookups
    private var projectServerPairs = HashMap.HashMap<Text, [Text]>(32, Text.equal, Text.hash);


    // Track upload sessions for large WASM files
    private var wasmUploadSessions = HashMap.HashMap<Text, {
        sessionId: Text;
        projectId: Text;
        fileName: Text;
        canisterId: ?Principal;  // Optional target canister
        canisterType: ?Text;     // Type info for deployment
        deploymentStage: ?Text;  // e.g., "local", "ic"
        chunks: HashMap.HashMap<Nat, [Nat8]>;
        totalChunks: Nat;
        receivedChunks: Nat;
        totalSize: Nat;
        createdAt: Int;
    }>(32, Text.equal, Text.hash);


    private var wasmDownloadSessions = HashMap.HashMap<Text, {
        sessionId: Text;
        projectId: Text;
        path: Text;
        fileName: Text;
        totalChunks: Nat;
        totalSize: Nat;
        chunkSize: Nat;
        createdAt: Int;
    }>(32, Text.equal, Text.hash);


        private let walletService = wallet.WalletService(func () : Bool {
        if (forceLocalMode) {
            return true;  // Force local mode for testing
        };
        
        // Otherwise, try to detect environment automatically
        let canisterId = Principal.toText(Principal.fromActor(Main));
        
        // Local canister IDs typically start with these prefixes
        let localPrefixes = [
            "rwlgt-iiaaa-",  // dfx local canister ID prefix
            "bkyz2-fmaaa-",  // dfx local canister ID prefix
            "bd3sg-teaaa-",  // Another common local prefix
        ];
        
        for (prefix in localPrefixes.vals()) {
            if (Text.startsWith(canisterId, #text prefix)) {
                return true;  // We're in a local environment
            };
        };
        
        // Not in local environment
        return false;
    });

    private let logger = L.Logger(
        stableLogger,
        ?{
            maxSize = 20000;
            retentionDays = 7;
        }
    );

    private var canisterService = canister.CanisterService(
    forceLocalMode,
    userWallet,
    userCanisters,
    actor(Principal.toText(Principal.fromActor(Main))),  // Pass the main actor reference
    walletService,
    func (logs: [CustomDebug.LogEntry]) { 
        for (entry in logs.vals()) {
            logger.info("Service Log: " # debug_show(entry));
        }
    }
);

    public func setLocalMode(enabled: Bool) : async () {
        forceLocalMode := enabled;
        // You might want to add access control here for production
    };
        

    // IC Management Canister Reference
    let IC = actor "aaaaa-aa" : Interface.Self;

    // Marketplace Canister ID
    let LOCAL_MARKETPLACE_CANISTER_ID = "uxrrr-q7777-77774-qaaaq-cai";
    let MAINNET_MARKETPLACE_CANISTER_ID = "lpm4r-7qaaa-aaaaa-qaeea-cai";

    private func isMarketplaceCanister(caller: Principal) : Bool {
        let localMarketplaceId = Principal.fromText(LOCAL_MARKETPLACE_CANISTER_ID);
        let mainnetMarketplaceId = Principal.fromText(MAINNET_MARKETPLACE_CANISTER_ID);
        Principal.equal(caller, localMarketplaceId) or Principal.equal(caller, mainnetMarketplaceId)
    };


    // ===============================
    // WALLET MANAGEMENT
    // ===============================
    public func createUserWallet() : async Text {
        logger.info("Attempting to create user wallet...");
        switch (userWallet) {
            case (?_existing) {
                logger.info("❌ Wallet creation failed: Wallet already exists");
                return "Wallet already exists";
            };
            case null {
                logger.info("Creating new wallet for principal: " # Principal.toText(Principal.fromActor(Main)));
                let newWallet = walletService.createWallet(Principal.fromActor(Main));
                userWallet := ?newWallet;
                
                // Reinitialize canister service with new wallet
                canisterService := canister.CanisterService(
                    true,
                    userWallet,
                    userCanisters,
                    actor(Principal.toText(Principal.fromActor(Main))),  // Pass main actor reference instead
                    walletService,
                    func (logs: [CustomDebug.LogEntry]) { 
                        for (entry in logs.vals()) {
                            logger.info("Service Log: " # debug_show(entry));
                        }
                    }
                );
                
                logger.info("✅ Wallet created successfully");
                return "Wallet created successfully";
            };
        };
    };

    public query func getUserWalletId() : async ?{
        principal: Text;
        subaccount: Text;
        accountIdentifier: Text;
    } {
        logger.info("Getting user wallet ID...");
        switch (userWallet) {
            case (?wallet) {
                let id = walletService.getWalletId(wallet);
                logger.info("✅ Wallet ID retrieved: " # id.principal);
                ?id
            };
            case null {
                logger.info("❌ Get wallet ID failed: No wallet initialized");
                null
            }
        }
    };

public func getUserBalance() : async Nat {
    logger.info("Getting user balance...");
    switch (userWallet) {
        case (null) { 
            logger.info("❌ Get balance failed: No wallet initialized");
            return 0; 
        };
        case (?wallet) {
            logger.info("Fetching balance for wallet: " # Principal.toText(wallet.principal));
            let newBalance = await walletService.getBalance(wallet);
            userWallet := ?{
                principal = wallet.principal;
                subaccount = wallet.subaccount;
                balance = newBalance;
                transactions = wallet.transactions; // Preserve existing transactions
            };
            logger.info("✅ Balance retrieved: " # Nat.toText(newBalance));
            return newBalance;
        };
    };
};

    public func getCycleBalance() : async Nat {
        logger.info("Getting cycle balance...");
        switch (userWallet) {
            case (null) {
                logger.info("❌ Get cycle balance failed: No wallet initialized");
                return 0;
            };
            case (?wallet) {
                let balance = await walletService.getCycleBalance(wallet);
                logger.info("✅ Cycle balance retrieved: " # Nat.toText(balance));
                return balance;
            };
        };
    };

// Add this function to expose wallet transactions
public query func getWalletTransactions(limit: ?Nat) : async [wallet.Transaction] {
    logger.info("Getting wallet transactions");
    switch (userWallet) {
        case (null) { 
            logger.info("❌ Get transactions failed: No wallet initialized");
            return []; 
        };
        case (?wallet) {
            let maxTransactions = switch (limit) {
                case (null) { 10 }; // Default limit of 10 if not specified
                case (?max) { max };
            };
            
            walletService.getRecentTransactions(wallet, maxTransactions)
        };
    };
};

// Update sendICP to handle transaction recording
public func sendICP(fromPrincipal: Principal, toPrincipal: Principal, amount: Nat) : async Result.Result<Text, Text> {
    logger.info("Initiating ICP transfer:");
    logger.info("- From: " # Principal.toText(fromPrincipal));
    logger.info("- To: " # Principal.toText(toPrincipal));
    logger.info("- Amount: " # Nat.toText(amount));

    switch (userWallet) {
        case (null) {
            logger.info("❌ Transfer failed: No wallet initialized");
            #err("No wallet initialized")
        };
        case (?wallet) {
            if (amount == 0) {
                logger.info("❌ Transfer failed: Amount must be greater than 0");
                return #err("Amount must be greater than 0");
            };
            
            try {
                logger.info("Getting sender's initial balance...");
                let initialBalance = await walletService.getBalance(wallet);
                logger.info("Initial sender balance: " # Nat.toText(initialBalance));
                
                // Create recipient wallet with DEFAULT empty subaccount for wallet compatibility
                logger.info("Creating recipient wallet with default subaccount...");
                let defaultSubaccount = walletService.createDefaultSubaccount();
                let toWallet = walletService.createWalletWithSubaccount(toPrincipal, defaultSubaccount);
                
                // Get the account ID for debugging
                let toWalletInfo = walletService.getWalletId(toWallet);
                logger.info("Recipient wallet created with account ID: " # toWalletInfo.accountIdentifier);
                
                logger.info("Executing transfer...");
                let result = await walletService.sendICP(wallet, toWallet, amount);
                
                // If the transaction was successful, manually add a transaction record
                if (Text.startsWith(result, #text "Transaction successful") or 
                    Text.startsWith(result, #text "Dummy transaction")) {
                    
                    // Add the transaction to the wallet
                    let updatedWallet = walletService.addTransaction(
                        wallet,
                        #sent,
                        Principal.toText(toPrincipal),
                        amount,
                        false,
                        ?(result)
                    );
                    
                    // Update the stored wallet
                    userWallet := ?updatedWallet;
                };
                
                logger.info("Getting final balances...");
                let finalBalance = await walletService.getBalance(wallet);
                logger.info("Final sender balance: " # Nat.toText(finalBalance));
                
                logger.info("✅ Transfer completed successfully");
                #ok(result)
            } catch (error) {
                let errorMsg = Error.message(error);
                logger.info("❌ Transfer failed with error: " # errorMsg);
                #err(errorMsg)
            }
        };
    };
};

// Update sendICPToAccountId to handle transaction recording
public func sendICPToAccountId(fromPrincipal: Principal, toAccountId: Text, amount: Nat) : async Result.Result<Text, Text> {
    logger.info("Initiating ICP transfer to account ID:");
    logger.info("- From Principal: " # Principal.toText(fromPrincipal));
    logger.info("- To Account ID: " # toAccountId);
    logger.info("- Amount: " # Nat.toText(amount));

    switch (userWallet) {
        case (null) {
            logger.info("❌ Transfer failed: No wallet initialized");
            #err("No wallet initialized")
        };
        case (?wallet) {
            if (amount == 0) {
                logger.info("❌ Transfer failed: Amount must be greater than 0");
                return #err("Amount must be greater than 0");
            };
            
            try {
                logger.info("Getting sender's initial balance...");
                let initialBalance = await walletService.getBalance(wallet);
                logger.info("Initial sender balance: " # Nat.toText(initialBalance));
                
                logger.info("Executing transfer to account ID...");
                let result = await walletService.sendICPToAccountId(wallet, toAccountId, amount);
                
                // If the transaction was successful, manually add a transaction record
                if (Text.startsWith(result, #text "Transaction successful") or 
                    Text.startsWith(result, #text "Dummy transaction")) {
                    
                    // Add the transaction to the wallet
                    let updatedWallet = walletService.addTransaction(
                        wallet,
                        #sent,
                        toAccountId,
                        amount,
                        false,
                        ?(result)
                    );
                    
                    // Update the stored wallet
                    userWallet := ?updatedWallet;
                };
                
                logger.info("Getting final balance...");
                let finalBalance = await walletService.getBalance(wallet);
                logger.info("Final sender balance: " # Nat.toText(finalBalance));
                
                logger.info("✅ Transfer to account ID completed");
                #ok(result)
            } catch (error) {
                let errorMsg = Error.message(error);
                logger.info("❌ Transfer to account ID failed with error: " # errorMsg);
                #err(errorMsg)
            }
        };
    };
};


public func topUpCanisterCMC(fromPrincipal: Principal, canisterId: Principal, amount: Nat) : async Result.Result<Text, Text> {
    logger.info("Initiating canister top-up:");
    logger.info("- From: " # Principal.toText(fromPrincipal));
    logger.info("- Canister: " # Principal.toText(canisterId));
    logger.info("- Amount: " # Nat.toText(amount));

    switch (userWallet) {
        case (null) {
            logger.info("❌ Top-up failed: No wallet initialized");
            #err("No wallet initialized")
        };
        case (?wallet) {
            if (amount == 0) {
                logger.info("❌ Top-up failed: Amount must be greater than 0");
                return #err("Amount must be greater than 0");
            };
            
            try {
                logger.info("Getting sender's initial balance...");
                let initialBalance = await walletService.getBalance(wallet);
                logger.info("Initial sender balance: " # Nat.toText(initialBalance));
                
                // Calculate the correct CMC subaccount for this canister
                let cmcPrincipal = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");
                
                // Create the dfx-compatible subaccount (first byte is length, followed by principal bytes)
                let canisterIdBytes = Blob.toArray(Principal.toBlob(canisterId));
                let buffer = Array.init<Nat8>(32, 0);
                buffer[0] := Nat8.fromNat(canisterIdBytes.size());
                
                // Copy principal bytes starting at position 1
                for (i in Iter.range(0, canisterIdBytes.size() - 1)) {
                    buffer[i + 1] := canisterIdBytes[i];
                };
                
                let subaccount = Blob.fromArray(Array.freeze(buffer));
                
                // Get the account identifier for the CMC with this subaccount
                let toAccountId = walletService.accountIdentifier(cmcPrincipal, subaccount);
                let toAccountIdHex = walletService.blobToHex(Blob.fromArray(toAccountId));
                
                logger.info("Calculated CMC top-up account ID: " # toAccountIdHex);
                
                // Use the MEMO_TOP_UP_CANISTER value (1347768404) as per dfx
                // Note: Your walletService might not support custom memos, so this might be ignored
                
                // Send ICP to the correct account
                logger.info("Executing transfer to CMC subaccount...");
                let result = await walletService.sendICPToAccountId(wallet, toAccountIdHex, amount);
                
                logger.info("Getting final balance...");
                let finalBalance = await walletService.getBalance(wallet);
                logger.info("Final sender balance: " # Nat.toText(finalBalance));
                
                logger.info("✅ Top-up ICP transfer completed");
                #ok(result)
            } catch (error) {
                let errorMsg = Error.message(error);
                logger.info("❌ Top-up failed with error: " # errorMsg);
                #err(errorMsg)
            }
        };
    };
};


    // ===============================
    // SERVER PAIRS
    // ===============================

    // Create a new server pair
    // 🚀 PERFORMANCE FIX: Added projectId parameter for O(1) project lookups
    public shared(msg) func createServerPair(
        projectId: Text,
        name: Text,
        frontendCanisterId: Principal,
        backendCanisterId: Principal,
        creditsAllocated: Nat
    ) : async Result.Result<Text, Text> {
        logger.info("🔄 createServerPair called with: projectId=" # projectId # ", name=" # name # ", frontend=" # Principal.toText(frontendCanisterId) # ", backend=" # Principal.toText(backendCanisterId) # ", credits=" # Nat.toText(creditsAllocated));
        
        // Authorization check
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            let errorMsg = "Unauthorized: only canister controllers can create server pairs. Caller: " # Principal.toText(msg.caller);
            logger.error("❌ " # errorMsg);
            return #err(errorMsg);
        };
        logger.info("✅ Authorization check passed for caller: " # Principal.toText(msg.caller));
        
        // Input validation
        if (Text.size(name) == 0) {
            let errorMsg = "Invalid input: server pair name cannot be empty";
            logger.error("❌ " # errorMsg);
            return #err(errorMsg);
        };
        
        if (creditsAllocated == 0) {
            let errorMsg = "Invalid input: credits allocated must be greater than 0";
            logger.error("❌ " # errorMsg);
            return #err(errorMsg);
        };
        
        if (Principal.equal(frontendCanisterId, backendCanisterId)) {
            let errorMsg = "Invalid input: frontend and backend canister IDs cannot be the same";
            logger.error("❌ " # errorMsg);
            return #err(errorMsg);
        };
        
        // Generate unique pair ID
        let timestamp = Time.now();
        let pairId = name # "_" # Nat64.toText(Nat64.fromIntWrap(timestamp)) # "_" # 
                    Nat.toText(Int.abs(timestamp) % 10000);
        logger.info("📝 Generated pairId: " # pairId);
        
        // Check for duplicate pair ID (unlikely but defensive)
        switch (serverPairs.get(pairId)) {
            case (?existing) {
                let errorMsg = "Collision detected: server pair ID already exists: " # pairId;
                logger.error("❌ " # errorMsg);
                return #err(errorMsg);
            };
            case null { 
                logger.info("✅ PairId is unique, proceeding with creation");
            };
        };
        
        // Create server pair object
        let serverPair: ServerPair = {
            pairId = pairId;
            name = name;
            frontendCanisterId = frontendCanisterId;
            backendCanisterId = backendCanisterId;
            createdAt = Nat64.fromIntWrap(timestamp);
            creditsAllocated = creditsAllocated;
        };
        logger.info("📦 Server pair object created successfully");
        
        // Store in HashMap
        let sizeBefore = serverPairs.size();
        serverPairs.put(pairId, serverPair);
        let sizeAfter = serverPairs.size();
        
        // Verify storage succeeded
        if (sizeAfter != sizeBefore + 1) {
            let errorMsg = "Storage failed: HashMap size did not increase. Before: " # Nat.toText(sizeBefore) # ", After: " # Nat.toText(sizeAfter);
            logger.error("❌ " # errorMsg);
            return #err(errorMsg);
        };
        
        // Verify retrieval works
        switch (serverPairs.get(pairId)) {
            case (?stored) {
                if (stored.pairId != pairId or stored.name != name) {
                    let errorMsg = "Storage verification failed: retrieved data does not match stored data";
                    logger.error("❌ " # errorMsg);
                    return #err(errorMsg);
                };
                logger.info("✅ Storage verification passed");
            };
            case null {
                let errorMsg = "Storage verification failed: cannot retrieve just-stored server pair";
                logger.error("❌ " # errorMsg);
                return #err(errorMsg);
            };
        };
        
        // 🚀 PERFORMANCE FIX: Add to project → server pairs mapping for O(1) lookups
        let existingProjectPairs = Option.get(projectServerPairs.get(projectId), []);
        let updatedProjectPairs = Array.append(existingProjectPairs, [pairId]);
        projectServerPairs.put(projectId, updatedProjectPairs);
        logger.info("✅ Added server pair to project mapping: projectId=" # projectId # ", pairId=" # pairId);
        
        logger.info("✅ Server pair created and verified successfully: " # pairId # " (Total pairs: " # Nat.toText(sizeAfter) # ")");
        
        #ok(pairId)
    };


    // 🚀 PERFORMANCE FIX: Direct O(1) lookup using project → server pairs mapping
    public shared(msg) func getProjectServerPairs(
        projectId: Text
    ) : async Result.Result<[ServerPair], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access server pairs");
        };
        
        // 🚀 Direct O(1) lookup in project mapping (instead of O(n×m) filtering)
        let pairIds = Option.get(projectServerPairs.get(projectId), []);
        logger.info("📋 Found " # Nat.toText(Array.size(pairIds)) # " server pair(s) for project: " # projectId);
        
        // O(k) where k = pairs in project (not total pairs!)
        let projectPairs = Array.mapFilter<Text, ServerPair>(
            pairIds,
            func(pairId: Text) : ?ServerPair {
                let pair = serverPairs.get(pairId);
                switch (pair) {
                    case (?p) {
                        logger.info("✅ Retrieved server pair: " # pairId);
                    };
                    case null {
                        logger.warn("⚠️ Server pair not found in HashMap: " # pairId # " (orphaned reference, will be skipped)");
                    };
                };
                pair
            }
        );
        
        logger.info("✅ Returning " # Nat.toText(Array.size(projectPairs)) # " server pair(s)");
        #ok(projectPairs)
    };


    // Get all user's server pairs
    public query(msg) func getUserServerPairs() : async [ServerPair] {
        Iter.toArray(serverPairs.vals())
    };

    // Delete a server pair
    // 🚀 PERFORMANCE FIX: Also removes from project mapping
    public shared(msg) func deleteServerPair(pairId: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can delete server pairs");
        };
        
        switch (serverPairs.remove(pairId)) {
            case (?_) {
                // Remove from all project mappings
                for ((projectId, pairIds) in projectServerPairs.entries()) {
                    let filteredPairs = Array.filter<Text>(pairIds, func(id) = id != pairId);
                    if (Array.size(filteredPairs) != Array.size(pairIds)) {
                        projectServerPairs.put(projectId, filteredPairs);
                        logger.info("✅ Removed server pair from project mapping: projectId=" # projectId);
                    };
                };
                logger.info("✅ Server pair deleted: " # pairId);
                #ok(())
            };
            case null {
                #err("Server pair not found: " # pairId)
            };
        }
    };

    // Update server pair metadata
    public shared(msg) func updateServerPair(
        pairId: Text,
        name: ?Text,
        creditsAllocated: ?Nat
    ) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can update server pairs");
        };
        
        switch (serverPairs.get(pairId)) {
            case (?existingPair) {
                let updatedPair: ServerPair = {
                    pairId = existingPair.pairId;
                    name = Option.get(name, existingPair.name);
                    frontendCanisterId = existingPair.frontendCanisterId;
                    backendCanisterId = existingPair.backendCanisterId;
                    createdAt = existingPair.createdAt;
                    creditsAllocated = Option.get(creditsAllocated, existingPair.creditsAllocated);
                };
                
                serverPairs.put(pairId, updatedPair);
                logger.info("✅ Server pair updated: " # pairId);
                #ok(())
            };
            case null {
                #err("Server pair not found: " # pairId)
            };
        }
    };

    // 🚀 NEW: Move a server pair from one project to another (enables server pair reuse)
    public shared(msg) func moveServerPairToProject(
        pairId: Text,
        fromProjectId: Text,
        toProjectId: Text
    ) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can move server pairs");
        };
        
        // Verify server pair exists
        switch (serverPairs.get(pairId)) {
            case null {
                return #err("Server pair not found: " # pairId);
            };
            case (?_) {
                // Proceed with move
            };
        };
        
        // Remove from old project
        let fromPairs = Option.get(projectServerPairs.get(fromProjectId), []);
        let updatedFromPairs = Array.filter<Text>(fromPairs, func(id) = id != pairId);
        
        if (Array.size(updatedFromPairs) == Array.size(fromPairs)) {
            return #err("Server pair not found in source project: " # fromProjectId);
        };
        
        projectServerPairs.put(fromProjectId, updatedFromPairs);
        logger.info("✅ Removed server pair from source project: " # fromProjectId);
        
        // Add to new project
        let toPairs = Option.get(projectServerPairs.get(toProjectId), []);
        
        // Check if already in target project
        let alreadyInProject = Array.find<Text>(toPairs, func(id) = id == pairId) != null;
        if (alreadyInProject) {
            return #err("Server pair already exists in target project: " # toProjectId);
        };
        
        let updatedToPairs = Array.append(toPairs, [pairId]);
        projectServerPairs.put(toProjectId, updatedToPairs);
        logger.info("✅ Added server pair to target project: " # toProjectId);
        
        logger.info("✅ Server pair moved successfully: " # pairId # " from " # fromProjectId # " to " # toProjectId);
        #ok(())
    };


    // ===============================
    // DEPLOYED AGENTS MANAGEMENT
    // ===============================

    // Add a deployed agent to a project
    public shared(msg) func addDeployedAgentToProject(
        projectId: Text,
        agent: DeployedAgent
    ) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage deployed agents");
        };

        logger.info("🤖 Adding deployed agent to project: projectId=" # projectId # ", agentId=" # agent.id);

        // Find the project
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null {
                logger.error("❌ Project not found: " # projectId);
                return #err("Project not found: " # projectId);
            };
            case (?project) {
                // Get existing agents or create new array
                let existingAgents = Option.get(project.deployedAgents, []);
                
                // Check if agent already exists
                let agentExists = Array.find<DeployedAgent>(
                    existingAgents,
                    func(a: DeployedAgent) : Bool { a.id == agent.id }
                ) != null;
                
                if (agentExists) {
                    logger.warn("⚠️ Agent already exists in project: " # agent.id);
                    return #err("Agent already exists in project: " # agent.id);
                };
                
                // Add the new agent
                let updatedAgents = Array.append(existingAgents, [agent]);
                
                // Create updated project
                let updatedProject = {
                    project with
                    deployedAgents = ?updatedAgents;
                    updated = Nat64.fromIntWrap(Time.now());
                };
                
                // Update the project in array
                updateProjectInArray(updatedProject);
                
                logger.info("✅ Deployed agent added successfully: " # agent.id);
                #ok(())
            };
        }
    };

    // Remove a deployed agent from a project
    public shared(msg) func removeDeployedAgentFromProject(
        projectId: Text,
        agentId: Text
    ) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage deployed agents");
        };

        logger.info("🗑️ Removing deployed agent from project: projectId=" # projectId # ", agentId=" # agentId);

        // Find the project
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null {
                logger.error("❌ Project not found: " # projectId);
                return #err("Project not found: " # projectId);
            };
            case (?project) {
                // Get existing agents
                let existingAgents = Option.get(project.deployedAgents, []);
                
                // Filter out the agent to remove
                let updatedAgents = Array.filter<DeployedAgent>(
                    existingAgents,
                    func(a: DeployedAgent) : Bool { a.id != agentId }
                );
                
                // Check if anything was removed
                if (Array.size(updatedAgents) == Array.size(existingAgents)) {
                    logger.warn("⚠️ Agent not found in project: " # agentId);
                    return #err("Agent not found in project: " # agentId);
                };
                
                // Create updated project
                let updatedProject = {
                    project with
                    deployedAgents = ?updatedAgents;
                    updated = Nat64.fromIntWrap(Time.now());
                };
                
                // Update the project in array
                updateProjectInArray(updatedProject);
                
                logger.info("✅ Deployed agent removed successfully: " # agentId);
                #ok(())
            };
        }
    };

    // Get all deployed agents for a project
    public shared(msg) func getProjectDeployedAgents(
        projectId: Text
    ) : async Result.Result<[DeployedAgent], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access deployed agents");
        };

        logger.info("📋 Getting deployed agents for project: " # projectId);

        // Find the project
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null {
                logger.error("❌ Project not found: " # projectId);
                return #err("Project not found: " # projectId);
            };
            case (?project) {
                let agents = Option.get(project.deployedAgents, []);
                logger.info("✅ Found " # Nat.toText(Array.size(agents)) # " deployed agents");
                #ok(agents)
            };
        }
    };

    // Update a deployed agent in a project
    public shared(msg) func updateDeployedAgentInProject(
        projectId: Text,
        agent: DeployedAgent
    ) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage deployed agents");
        };

        logger.info("🔄 Updating deployed agent in project: projectId=" # projectId # ", agentId=" # agent.id);

        // Find the project
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null {
                logger.error("❌ Project not found: " # projectId);
                return #err("Project not found: " # projectId);
            };
            case (?project) {
                // Get existing agents
                let existingAgents = Option.get(project.deployedAgents, []);
                
                // Update or keep existing agents
                let updatedAgents = Array.map<DeployedAgent, DeployedAgent>(
                    existingAgents,
                    func(a: DeployedAgent) : DeployedAgent {
                        if (a.id == agent.id) { agent } else { a }
                    }
                );
                
                // Check if agent was found
                let agentFound = Array.find<DeployedAgent>(
                    existingAgents,
                    func(a: DeployedAgent) : Bool { a.id == agent.id }
                ) != null;
                
                if (not agentFound) {
                    logger.warn("⚠️ Agent not found in project: " # agent.id);
                    return #err("Agent not found in project: " # agent.id);
                };
                
                // Create updated project
                let updatedProject = {
                    project with
                    deployedAgents = ?updatedAgents;
                    updated = Nat64.fromIntWrap(Time.now());
                };
                
                // Update the project in array
                updateProjectInArray(updatedProject);
                
                logger.info("✅ Deployed agent updated successfully: " # agent.id);
                #ok(())
            };
        }
    };


    // ===============================
    // USER CONTEXT MANAGEMENT (References, Rules, Templates, etc.)
    // ===============================

    // -------- REFERENCE ITEMS --------

    public shared(msg) func addReferenceItem(item: ReferenceItem) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage references");
        };

        logger.info("📚 Adding reference item: " # item.title);
        userReferences := Array.append(userReferences, [item]);
        logger.info("✅ Reference item added successfully");
        #ok(())
    };

    public shared(msg) func updateReferenceItem(item: ReferenceItem) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage references");
        };

        logger.info("🔄 Updating reference item: " # item.id);
        let updated = Array.map<ReferenceItem, ReferenceItem>(
            userReferences,
            func(r: ReferenceItem) : ReferenceItem {
                if (r.id == item.id) { item } else { r }
            }
        );
        userReferences := updated;
        logger.info("✅ Reference item updated successfully");
        #ok(())
    };

    public shared(msg) func deleteReferenceItem(id: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage references");
        };

        logger.info("🗑️ Deleting reference item: " # id);
        userReferences := Array.filter<ReferenceItem>(userReferences, func(r) = r.id != id);
        logger.info("✅ Reference item deleted successfully");
        #ok(())
    };

    public shared(msg) func getReferenceItems() : async Result.Result<[ReferenceItem], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access references");
        };

        logger.info("📋 Getting " # Nat.toText(Array.size(userReferences)) # " reference items");
        #ok(userReferences)
    };

    // -------- CODE RULES --------

    public shared(msg) func addCodeRule(rule: CodeRule) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage code rules");
        };

        logger.info("📝 Adding code rule: " # rule.title);
        userCodeRules := Array.append(userCodeRules, [rule]);
        logger.info("✅ Code rule added successfully");
        #ok(())
    };

    public shared(msg) func updateCodeRule(rule: CodeRule) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage code rules");
        };

        logger.info("🔄 Updating code rule: " # rule.id);
        let updated = Array.map<CodeRule, CodeRule>(
            userCodeRules,
            func(r: CodeRule) : CodeRule {
                if (r.id == rule.id) { rule } else { r }
            }
        );
        userCodeRules := updated;
        logger.info("✅ Code rule updated successfully");
        #ok(())
    };

    public shared(msg) func deleteCodeRule(id: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage code rules");
        };

        logger.info("🗑️ Deleting code rule: " # id);
        userCodeRules := Array.filter<CodeRule>(userCodeRules, func(r) = r.id != id);
        logger.info("✅ Code rule deleted successfully");
        #ok(())
    };

    public shared(msg) func getCodeRules() : async Result.Result<[CodeRule], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access code rules");
        };

        logger.info("📋 Getting " # Nat.toText(Array.size(userCodeRules)) # " code rules");
        #ok(userCodeRules)
    };

    // -------- COLOR PALETTES --------

    public shared(msg) func addColorPalette(palette: ColorPalette) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage color palettes");
        };

        logger.info("🎨 Adding color palette: " # palette.name);
        userColorPalettes := Array.append(userColorPalettes, [palette]);
        logger.info("✅ Color palette added successfully");
        #ok(())
    };

    public shared(msg) func updateColorPalette(palette: ColorPalette) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage color palettes");
        };

        logger.info("🔄 Updating color palette: " # palette.id);
        let updated = Array.map<ColorPalette, ColorPalette>(
            userColorPalettes,
            func(p: ColorPalette) : ColorPalette {
                if (p.id == palette.id) { palette } else { p }
            }
        );
        userColorPalettes := updated;
        logger.info("✅ Color palette updated successfully");
        #ok(())
    };

    public shared(msg) func deleteColorPalette(id: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage color palettes");
        };

        logger.info("🗑️ Deleting color palette: " # id);
        userColorPalettes := Array.filter<ColorPalette>(userColorPalettes, func(p) = p.id != id);
        logger.info("✅ Color palette deleted successfully");
        #ok(())
    };

    public shared(msg) func getColorPalettes() : async Result.Result<[ColorPalette], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access color palettes");
        };

        logger.info("📋 Getting " # Nat.toText(Array.size(userColorPalettes)) # " color palettes");
        #ok(userColorPalettes)
    };

    // -------- DESIGN INSPIRATIONS --------

    public shared(msg) func addDesignInspiration(inspiration: DesignInspiration) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage design inspirations");
        };

        logger.info("💡 Adding design inspiration: " # inspiration.title);
        userDesignInspirations := Array.append(userDesignInspirations, [inspiration]);
        logger.info("✅ Design inspiration added successfully");
        #ok(())
    };

    public shared(msg) func updateDesignInspiration(inspiration: DesignInspiration) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage design inspirations");
        };

        logger.info("🔄 Updating design inspiration: " # inspiration.id);
        let updated = Array.map<DesignInspiration, DesignInspiration>(
            userDesignInspirations,
            func(d: DesignInspiration) : DesignInspiration {
                if (d.id == inspiration.id) { inspiration } else { d }
            }
        );
        userDesignInspirations := updated;
        logger.info("✅ Design inspiration updated successfully");
        #ok(())
    };

    public shared(msg) func deleteDesignInspiration(id: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage design inspirations");
        };

        logger.info("🗑️ Deleting design inspiration: " # id);
        userDesignInspirations := Array.filter<DesignInspiration>(userDesignInspirations, func(d) = d.id != id);
        logger.info("✅ Design inspiration deleted successfully");
        #ok(())
    };

    public shared(msg) func getDesignInspirations() : async Result.Result<[DesignInspiration], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access design inspirations");
        };

        logger.info("📋 Getting " # Nat.toText(Array.size(userDesignInspirations)) # " design inspirations");
        #ok(userDesignInspirations)
    };

    // -------- DOCUMENTATION ITEMS --------

    public shared(msg) func addDocumentationItem(doc: DocumentationItem) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage documentation");
        };

        logger.info("📖 Adding documentation item: " # doc.title);
        userDocumentationItems := Array.append(userDocumentationItems, [doc]);
        logger.info("✅ Documentation item added successfully");
        #ok(())
    };

    public shared(msg) func updateDocumentationItem(doc: DocumentationItem) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage documentation");
        };

        logger.info("🔄 Updating documentation item: " # doc.id);
        let updated = Array.map<DocumentationItem, DocumentationItem>(
            userDocumentationItems,
            func(d: DocumentationItem) : DocumentationItem {
                if (d.id == doc.id) { doc } else { d }
            }
        );
        userDocumentationItems := updated;
        logger.info("✅ Documentation item updated successfully");
        #ok(())
    };

    public shared(msg) func deleteDocumentationItem(id: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage documentation");
        };

        logger.info("🗑️ Deleting documentation item: " # id);
        userDocumentationItems := Array.filter<DocumentationItem>(userDocumentationItems, func(d) = d.id != id);
        logger.info("✅ Documentation item deleted successfully");
        #ok(())
    };

    public shared(msg) func getDocumentationItems() : async Result.Result<[DocumentationItem], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access documentation");
        };

        logger.info("📋 Getting " # Nat.toText(Array.size(userDocumentationItems)) # " documentation items");
        #ok(userDocumentationItems)
    };

    // -------- GITHUB GUIDELINES --------

    public shared(msg) func addGitHubGuideline(guideline: GitHubGuideline) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage GitHub guidelines");
        };

        logger.info("🔧 Adding GitHub guideline: " # guideline.title);
        userGitHubGuidelines := Array.append(userGitHubGuidelines, [guideline]);
        logger.info("✅ GitHub guideline added successfully");
        #ok(())
    };

    public shared(msg) func updateGitHubGuideline(guideline: GitHubGuideline) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage GitHub guidelines");
        };

        logger.info("🔄 Updating GitHub guideline: " # guideline.id);
        let updated = Array.map<GitHubGuideline, GitHubGuideline>(
            userGitHubGuidelines,
            func(g: GitHubGuideline) : GitHubGuideline {
                if (g.id == guideline.id) { guideline } else { g }
            }
        );
        userGitHubGuidelines := updated;
        logger.info("✅ GitHub guideline updated successfully");
        #ok(())
    };

    public shared(msg) func deleteGitHubGuideline(id: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage GitHub guidelines");
        };

        logger.info("🗑️ Deleting GitHub guideline: " # id);
        userGitHubGuidelines := Array.filter<GitHubGuideline>(userGitHubGuidelines, func(g) = g.id != id);
        logger.info("✅ GitHub guideline deleted successfully");
        #ok(())
    };

    public shared(msg) func getGitHubGuidelines() : async Result.Result<[GitHubGuideline], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access GitHub guidelines");
        };

        logger.info("📋 Getting " # Nat.toText(Array.size(userGitHubGuidelines)) # " GitHub guidelines");
        #ok(userGitHubGuidelines)
    };

    // -------- CODE TEMPLATES --------

    public shared(msg) func addCodeTemplate(template: CodeTemplate) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage code templates");
        };

        logger.info("📄 Adding code template: " # template.name);
        userCodeTemplates := Array.append(userCodeTemplates, [template]);
        logger.info("✅ Code template added successfully");
        #ok(())
    };

    public shared(msg) func updateCodeTemplate(template: CodeTemplate) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage code templates");
        };

        logger.info("🔄 Updating code template: " # template.id);
        let updated = Array.map<CodeTemplate, CodeTemplate>(
            userCodeTemplates,
            func(t: CodeTemplate) : CodeTemplate {
                if (t.id == template.id) { template } else { t }
            }
        );
        userCodeTemplates := updated;
        logger.info("✅ Code template updated successfully");
        #ok(())
    };

    public shared(msg) func deleteCodeTemplate(id: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage code templates");
        };

        logger.info("🗑️ Deleting code template: " # id);
        userCodeTemplates := Array.filter<CodeTemplate>(userCodeTemplates, func(t) = t.id != id);
        logger.info("✅ Code template deleted successfully");
        #ok(())
    };

    public shared(msg) func getCodeTemplates() : async Result.Result<[CodeTemplate], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access code templates");
        };

        logger.info("📋 Getting " # Nat.toText(Array.size(userCodeTemplates)) # " code templates");
        #ok(userCodeTemplates)
    };

    // -------- API ENDPOINTS --------

    public shared(msg) func addAPIEndpoint(endpoint: APIEndpoint) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage API endpoints");
        };

        logger.info("🌐 Adding API endpoint: " # endpoint.name);
        userAPIEndpoints := Array.append(userAPIEndpoints, [endpoint]);
        logger.info("✅ API endpoint added successfully");
        #ok(())
    };

    public shared(msg) func updateAPIEndpoint(endpoint: APIEndpoint) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage API endpoints");
        };

        logger.info("🔄 Updating API endpoint: " # endpoint.id);
        let updated = Array.map<APIEndpoint, APIEndpoint>(
            userAPIEndpoints,
            func(e: APIEndpoint) : APIEndpoint {
                if (e.id == endpoint.id) { endpoint } else { e }
            }
        );
        userAPIEndpoints := updated;
        logger.info("✅ API endpoint updated successfully");
        #ok(())
    };

    public shared(msg) func deleteAPIEndpoint(id: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can manage API endpoints");
        };

        logger.info("🗑️ Deleting API endpoint: " # id);
        userAPIEndpoints := Array.filter<APIEndpoint>(userAPIEndpoints, func(e) = e.id != id);
        logger.info("✅ API endpoint deleted successfully");
        #ok(())
    };

    public shared(msg) func getAPIEndpoints() : async Result.Result<[APIEndpoint], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access API endpoints");
        };

        logger.info("📋 Getting " # Nat.toText(Array.size(userAPIEndpoints)) # " API endpoints");
        #ok(userAPIEndpoints)
    };

    // -------- BULK OPERATIONS --------

    public shared(msg) func getAllUserContext() : async Result.Result<{
        references: [ReferenceItem];
        codeRules: [CodeRule];
        colorPalettes: [ColorPalette];
        designInspirations: [DesignInspiration];
        documentationItems: [DocumentationItem];
        gitHubGuidelines: [GitHubGuideline];
        codeTemplates: [CodeTemplate];
        apiEndpoints: [APIEndpoint];
    }, Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access user context");
        };

        logger.info("📦 Getting all user context data");
        #ok({
            references = userReferences;
            codeRules = userCodeRules;
            colorPalettes = userColorPalettes;
            designInspirations = userDesignInspirations;
            documentationItems = userDocumentationItems;
            gitHubGuidelines = userGitHubGuidelines;
            codeTemplates = userCodeTemplates;
            apiEndpoints = userAPIEndpoints;
        })
    };


    // ===============================
    // AGENT CREDENTIALS MANAGEMENT
    // ===============================

    // Helper function to log security events
    private func logSecurityEvent(
        userId: Principal,
        action: AccountTypes.SecurityAction,
        resourceType: Text,
        resourceId: Text,
        result: AccountTypes.SecurityResult,
        metadata: [(Text, Text)]
    ) {
        let log: AccountTypes.SecurityAuditLog = {
            timestamp = Nat64.fromIntWrap(Time.now());
            userId = userId;
            action = action;
            resourceType = resourceType;
            resourceId = resourceId;
            result = result;
            metadata = metadata;
        };
        
        // Keep only last 10000 audit logs to prevent unbounded growth
        let logSize = securityAuditLogs.size();
        if (logSize >= 10000) {
            let startIndex = logSize - 9999;
            securityAuditLogs := Array.tabulate<AccountTypes.SecurityAuditLog>(
                9999,
                func(i) = securityAuditLogs[startIndex + i]
            );
        };
        
        securityAuditLogs := Array.append(securityAuditLogs, [log]);
    };

    // -------- AGENT CREDENTIALS --------

    public shared(msg) func addAgentCredentials(credentials: AccountTypes.AgentCredentials) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "agent_credentials", credentials.agentId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage agent credentials");
        };

        logger.info("🔐 Adding credentials for agent: " # credentials.agentId);
        
        // Check if credentials already exist for this agent
        let exists = Array.find<AccountTypes.AgentCredentials>(
            agentCredentialsStore,
            func(c) = c.agentId == credentials.agentId
        );
        
        if (exists != null) {
            logger.warn("⚠️ Credentials already exist for agent: " # credentials.agentId);
            return #err("Credentials already exist for this agent. Use update instead.");
        };
        
        agentCredentialsStore := Array.append(agentCredentialsStore, [credentials]);
        logSecurityEvent(msg.caller, #CredentialCreated, "agent_credentials", credentials.agentId, #Success, []);
        logger.info("✅ Agent credentials added successfully");
        #ok(())
    };

    public shared(msg) func updateAgentCredentials(credentials: AccountTypes.AgentCredentials) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "agent_credentials", credentials.agentId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage agent credentials");
        };

        logger.info("🔄 Updating credentials for agent: " # credentials.agentId);
        
        let updated = Array.map<AccountTypes.AgentCredentials, AccountTypes.AgentCredentials>(
            agentCredentialsStore,
            func(c: AccountTypes.AgentCredentials) : AccountTypes.AgentCredentials {
                if (c.agentId == credentials.agentId) { credentials } else { c }
            }
        );
        
        agentCredentialsStore := updated;
        logSecurityEvent(msg.caller, #CredentialUpdated, "agent_credentials", credentials.agentId, #Success, []);
        logger.info("✅ Agent credentials updated successfully");
        #ok(())
    };

    public shared(msg) func deleteAgentCredentials(agentId: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "agent_credentials", agentId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage agent credentials");
        };

        logger.info("🗑️ Deleting credentials for agent: " # agentId);
        agentCredentialsStore := Array.filter<AccountTypes.AgentCredentials>(
            agentCredentialsStore,
            func(c) = c.agentId != agentId
        );
        logSecurityEvent(msg.caller, #CredentialDeleted, "agent_credentials", agentId, #Success, []);
        logger.info("✅ Agent credentials deleted successfully");
        #ok(())
    };

    public shared(msg) func getAgentCredentials(agentId: Text) : async Result.Result<AccountTypes.AgentCredentials, Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "agent_credentials", agentId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can access agent credentials");
        };

        logger.info("🔍 Getting credentials for agent: " # agentId);
        
        switch (Array.find<AccountTypes.AgentCredentials>(agentCredentialsStore, func(c) = c.agentId == agentId)) {
            case (?credentials) {
                logSecurityEvent(msg.caller, #CredentialAccessed, "agent_credentials", agentId, #Success, []);
                logger.info("✅ Agent credentials retrieved successfully");
                #ok(credentials)
            };
            case null {
                logger.warn("⚠️ No credentials found for agent: " # agentId);
                #err("No credentials found for agent: " # agentId)
            };
        }
    };

    public shared(msg) func getAllAgentCredentials() : async Result.Result<[AccountTypes.AgentCredentials], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "agent_credentials", "all", #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can access agent credentials");
        };

        logger.info("📋 Getting all agent credentials");
        logSecurityEvent(msg.caller, #CredentialAccessed, "agent_credentials", "all", #Success, []);
        #ok(agentCredentialsStore)
    };

    // -------- ENVIRONMENT VARIABLES --------

    public shared(msg) func addEnvironmentConfig(config: AccountTypes.EnvironmentConfig) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "environment_config", config.id, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage environment configs");
        };

        logger.info("🌍 Adding environment config: " # config.name);
        
        // Check if config already exists
        let exists = Array.find<AccountTypes.EnvironmentConfig>(
            environmentConfigStore,
            func(e) = e.id == config.id
        );
        
        if (exists != null) {
            logger.warn("⚠️ Environment config already exists: " # config.id);
            return #err("Environment config already exists. Use update instead.");
        };
        
        environmentConfigStore := Array.append(environmentConfigStore, [config]);
        logSecurityEvent(msg.caller, #CredentialCreated, "environment_config", config.id, #Success, [("name", config.name)]);
        logger.info("✅ Environment config added successfully");
        #ok(())
    };

    public shared(msg) func updateEnvironmentConfig(config: AccountTypes.EnvironmentConfig) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "environment_config", config.id, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage environment configs");
        };

        logger.info("🔄 Updating environment config: " # config.id);
        
        let updated = Array.map<AccountTypes.EnvironmentConfig, AccountTypes.EnvironmentConfig>(
            environmentConfigStore,
            func(e: AccountTypes.EnvironmentConfig) : AccountTypes.EnvironmentConfig {
                if (e.id == config.id) { config } else { e }
            }
        );
        
        environmentConfigStore := updated;
        logSecurityEvent(msg.caller, #CredentialUpdated, "environment_config", config.id, #Success, []);
        logger.info("✅ Environment config updated successfully");
        #ok(())
    };

    public shared(msg) func deleteEnvironmentConfig(configId: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "environment_config", configId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage environment configs");
        };

        logger.info("🗑️ Deleting environment config: " # configId);
        environmentConfigStore := Array.filter<AccountTypes.EnvironmentConfig>(
            environmentConfigStore,
            func(e) = e.id != configId
        );
        logSecurityEvent(msg.caller, #CredentialDeleted, "environment_config", configId, #Success, []);
        logger.info("✅ Environment config deleted successfully");
        #ok(())
    };

    public shared(msg) func getEnvironmentConfig(configId: Text) : async Result.Result<AccountTypes.EnvironmentConfig, Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "environment_config", configId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can access environment configs");
        };

        logger.info("🔍 Getting environment config: " # configId);
        
        switch (Array.find<AccountTypes.EnvironmentConfig>(environmentConfigStore, func(e) = e.id == configId)) {
            case (?config) {
                logSecurityEvent(msg.caller, #EnvironmentVariableAccessed, "environment_config", configId, #Success, []);
                logger.info("✅ Environment config retrieved successfully");
                #ok(config)
            };
            case null {
                logger.warn("⚠️ No environment config found: " # configId);
                #err("No environment config found: " # configId)
            };
        }
    };

    public shared(msg) func getEnvironmentConfigsByProject(projectId: Text) : async Result.Result<[AccountTypes.EnvironmentConfig], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "environment_config", projectId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can access environment configs");
        };

        logger.info("📋 Getting environment configs for project: " # projectId);
        
        let configs = Array.filter<AccountTypes.EnvironmentConfig>(
            environmentConfigStore,
            func(e) = switch (e.projectId) {
                case (?pid) { pid == projectId };
                case null { false };
            }
        );
        
        logSecurityEvent(msg.caller, #EnvironmentVariableAccessed, "environment_config", projectId, #Success, []);
        logger.info("✅ Found " # Nat.toText(Array.size(configs)) # " environment configs");
        #ok(configs)
    };

    public shared(msg) func getAllEnvironmentConfigs() : async Result.Result<[AccountTypes.EnvironmentConfig], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "environment_config", "all", #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can access environment configs");
        };

        logger.info("📋 Getting all environment configs");
        logSecurityEvent(msg.caller, #EnvironmentVariableAccessed, "environment_config", "all", #Success, []);
        #ok(environmentConfigStore)
    };

    // -------- API CREDENTIALS --------

    public shared(msg) func addAPICredential(credential: AccountTypes.APICredential) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "api_credential", credential.id, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage API credentials");
        };

        logger.info("🔑 Adding API credential: " # credential.name);
        
        apiCredentialsStore := Array.append(apiCredentialsStore, [credential]);
        logSecurityEvent(msg.caller, #CredentialCreated, "api_credential", credential.id, #Success, [("service", credential.service)]);
        logger.info("✅ API credential added successfully");
        #ok(())
    };

    public shared(msg) func updateAPICredential(credential: AccountTypes.APICredential) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "api_credential", credential.id, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage API credentials");
        };

        logger.info("🔄 Updating API credential: " # credential.id);
        
        let updated = Array.map<AccountTypes.APICredential, AccountTypes.APICredential>(
            apiCredentialsStore,
            func(c: AccountTypes.APICredential) : AccountTypes.APICredential {
                if (c.id == credential.id) { credential } else { c }
            }
        );
        
        apiCredentialsStore := updated;
        logSecurityEvent(msg.caller, #CredentialUpdated, "api_credential", credential.id, #Success, []);
        logger.info("✅ API credential updated successfully");
        #ok(())
    };

    public shared(msg) func deleteAPICredential(credentialId: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "api_credential", credentialId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage API credentials");
        };

        logger.info("🗑️ Deleting API credential: " # credentialId);
        apiCredentialsStore := Array.filter<AccountTypes.APICredential>(
            apiCredentialsStore,
            func(c) = c.id != credentialId
        );
        logSecurityEvent(msg.caller, #CredentialDeleted, "api_credential", credentialId, #Success, []);
        logger.info("✅ API credential deleted successfully");
        #ok(())
    };

    public shared(msg) func getAPICredential(credentialId: Text) : async Result.Result<AccountTypes.APICredential, Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "api_credential", credentialId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can access API credentials");
        };

        logger.info("🔍 Getting API credential: " # credentialId);
        
        switch (Array.find<AccountTypes.APICredential>(apiCredentialsStore, func(c) = c.id == credentialId)) {
            case (?credential) {
                logSecurityEvent(msg.caller, #APIKeyUsed, "api_credential", credentialId, #Success, []);
                
                // Update usage count
                let updated = Array.map<AccountTypes.APICredential, AccountTypes.APICredential>(
                    apiCredentialsStore,
                    func(c: AccountTypes.APICredential) : AccountTypes.APICredential {
                        if (c.id == credentialId) {
                            {
                                c with
                                usageCount = c.usageCount + 1;
                                lastUsed = ?Nat64.fromIntWrap(Time.now());
                            }
                        } else { c }
                    }
                );
                apiCredentialsStore := updated;
                
                logger.info("✅ API credential retrieved successfully");
                #ok(credential)
            };
            case null {
                logger.warn("⚠️ No API credential found: " # credentialId);
                #err("No API credential found: " # credentialId)
            };
        }
    };

    public shared(msg) func getAllAPICredentials() : async Result.Result<[AccountTypes.APICredential], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "api_credential", "all", #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can access API credentials");
        };

        logger.info("📋 Getting all API credentials");
        logSecurityEvent(msg.caller, #CredentialAccessed, "api_credential", "all", #Success, []);
        #ok(apiCredentialsStore)
    };

    // -------- DATABASE CREDENTIALS --------

    public shared(msg) func addDatabaseCredential(credential: AccountTypes.DatabaseCredential) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "database_credential", credential.id, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage database credentials");
        };

        logger.info("🗄️ Adding database credential: " # credential.name);
        
        databaseCredentialsStore := Array.append(databaseCredentialsStore, [credential]);
        logSecurityEvent(msg.caller, #CredentialCreated, "database_credential", credential.id, #Success, [("dbType", credential.dbType)]);
        logger.info("✅ Database credential added successfully");
        #ok(())
    };

    public shared(msg) func updateDatabaseCredential(credential: AccountTypes.DatabaseCredential) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "database_credential", credential.id, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage database credentials");
        };

        logger.info("🔄 Updating database credential: " # credential.id);
        
        let updated = Array.map<AccountTypes.DatabaseCredential, AccountTypes.DatabaseCredential>(
            databaseCredentialsStore,
            func(c: AccountTypes.DatabaseCredential) : AccountTypes.DatabaseCredential {
                if (c.id == credential.id) { credential } else { c }
            }
        );
        
        databaseCredentialsStore := updated;
        logSecurityEvent(msg.caller, #CredentialUpdated, "database_credential", credential.id, #Success, []);
        logger.info("✅ Database credential updated successfully");
        #ok(())
    };

    public shared(msg) func deleteDatabaseCredential(credentialId: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "database_credential", credentialId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can manage database credentials");
        };

        logger.info("🗑️ Deleting database credential: " # credentialId);
        databaseCredentialsStore := Array.filter<AccountTypes.DatabaseCredential>(
            databaseCredentialsStore,
            func(c) = c.id != credentialId
        );
        logSecurityEvent(msg.caller, #CredentialDeleted, "database_credential", credentialId, #Success, []);
        logger.info("✅ Database credential deleted successfully");
        #ok(())
    };

    public shared(msg) func getDatabaseCredential(credentialId: Text) : async Result.Result<AccountTypes.DatabaseCredential, Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "database_credential", credentialId, #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can access database credentials");
        };

        logger.info("🔍 Getting database credential: " # credentialId);
        
        switch (Array.find<AccountTypes.DatabaseCredential>(databaseCredentialsStore, func(c) = c.id == credentialId)) {
            case (?credential) {
                logSecurityEvent(msg.caller, #CredentialAccessed, "database_credential", credentialId, #Success, []);
                logger.info("✅ Database credential retrieved successfully");
                #ok(credential)
            };
            case null {
                logger.warn("⚠️ No database credential found: " # credentialId);
                #err("No database credential found: " # credentialId)
            };
        }
    };

    public shared(msg) func getAllDatabaseCredentials() : async Result.Result<[AccountTypes.DatabaseCredential], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logSecurityEvent(msg.caller, #UnauthorizedAccess, "database_credential", "all", #Blocked("Unauthorized"), []);
            return #err("Unauthorized: only canister controllers can access database credentials");
        };

        logger.info("📋 Getting all database credentials");
        logSecurityEvent(msg.caller, #CredentialAccessed, "database_credential", "all", #Success, []);
        #ok(databaseCredentialsStore)
    };

    // -------- SECURITY AUDIT LOGS --------

    public shared(msg) func getSecurityAuditLogs(limit: ?Nat) : async Result.Result<[AccountTypes.SecurityAuditLog], Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can access audit logs");
        };

        logger.info("📊 Getting security audit logs");
        
        let maxLogs = switch (limit) {
            case (?l) { if (l > 1000) { 1000 } else { l } };
            case null { 100 };
        };
        
        let totalLogs = Array.size(securityAuditLogs);
        if (totalLogs == 0) {
            return #ok([]);
        };
        
        let startIndex = if (totalLogs > maxLogs) { totalLogs - maxLogs } else { 0 };
        let logs = Array.tabulate<AccountTypes.SecurityAuditLog>(
            Int.abs(totalLogs - startIndex),
            func(i) = securityAuditLogs[startIndex + i]
        );
        
        #ok(logs)
    };


    // ===============================
    // USER PREFERENCES & UI STATE
    // ===============================

    // Get the currently selected server pair
    public query(msg) func getSelectedServerPair() : async ?Text {
        logger.info("📍 Getting selected server pair for: " # Principal.toText(msg.caller));
        selectedServerPairId
    };

    // Set the currently selected server pair
    public shared(msg) func setSelectedServerPair(pairId: ?Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can set selected server pair");
        };

        switch (pairId) {
            case null {
                logger.info("🔄 Clearing selected server pair");
                selectedServerPairId := null;
                #ok(())
            };
            case (?id) {
                // Verify the server pair exists
                switch (serverPairs.get(id)) {
                    case null {
                        logger.warn("⚠️ Attempted to select non-existent server pair: " # id);
                        #err("Server pair not found: " # id)
                    };
                    case (?_pair) {
                        logger.info("✅ Selected server pair: " # id);
                        selectedServerPairId := ?id;
                        #ok(())
                    };
                };
            };
        }
    };

    // Get the currently selected project
    public query(msg) func getSelectedProject() : async ?Text {
        logger.info("📍 Getting selected project for: " # Principal.toText(msg.caller));
        selectedProjectId
    };

    // Set the currently selected project
    public shared(msg) func setSelectedProject(projectId: ?Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can set selected project");
        };

        switch (projectId) {
            case null {
                logger.info("🔄 Clearing selected project");
                selectedProjectId := null;
                #ok(())
            };
            case (?id) {
                // Verify the project exists
                let projectExists = Array.find<Project>(
                    userProjects,
                    func(p: Project) : Bool { p.id == id }
                ) != null;
                
                if (not projectExists) {
                    logger.warn("⚠️ Attempted to select non-existent project: " # id);
                    return #err("Project not found: " # id);
                };
                
                logger.info("✅ Selected project: " # id);
                selectedProjectId := ?id;
                #ok(())
            };
        }
    };

    // Get both selected server pair and project (convenience function)
    public query(msg) func getUIState() : async {
        selectedServerPair: ?Text;
        selectedProject: ?Text;
    } {
        logger.info("📍 Getting UI state for: " # Principal.toText(msg.caller));
        {
            selectedServerPair = selectedServerPairId;
            selectedProject = selectedProjectId;
        }
    };

    // Set both selected server pair and project (convenience function)
    public shared(msg) func setUIState(
        serverPairId: ?Text,
        projectId: ?Text
    ) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only canister controllers can set UI state");
        };

        logger.info("🔄 Setting UI state");
        
        // Set server pair
        switch (serverPairId) {
            case null {
                selectedServerPairId := null;
            };
            case (?id) {
                switch (serverPairs.get(id)) {
                    case null {
                        return #err("Server pair not found: " # id);
                    };
                    case (?_) {
                        selectedServerPairId := ?id;
                    };
                };
            };
        };
        
        // Set project
        switch (projectId) {
            case null {
                selectedProjectId := null;
            };
            case (?id) {
                let projectExists = Array.find<Project>(
                    userProjects,
                    func(p: Project) : Bool { p.id == id }
                ) != null;
                
                if (not projectExists) {
                    return #err("Project not found: " # id);
                };
                
                selectedProjectId := ?id;
            };
        };
        
        logger.info("✅ UI state updated successfully");
        #ok(())
    };


    // ===============================
    // CANISTER MANAGEMENT
    // ===============================

    public shared(msg) func getUserCanisters() : async [{
        principal: Principal;
        name: Text;
        canisterType: Text;
    }] {
        logger.info("Getting user canisters:");
        logger.info("- Caller: " # Principal.toText(msg.caller));
        logger.info("- Canister ID: " # Principal.toText(Principal.fromActor(Main)));
        
        try {
            let canisters = await canisterService.getUserCanisters();
            logger.info("User canisters retrieved:");
            logger.info("- Total canisters: " # Nat.toText(canisters.size()));
            
            Array.map<{
                principal: Principal;
                metadata: ?CanisterMetadata;
            }, {
                principal: Principal;
                name: Text;
                canisterType: Text;
            }>(
                canisters,
                func(result) : {
                    principal: Principal;
                    name: Text;
                    canisterType: Text;
                } {
                    {
                        principal = result.principal;
                        name = switch(result.metadata) {
                            case (?meta) meta.name;
                            case null "";
                        };
                        canisterType = switch(result.metadata) {
                            case (?meta) meta.canisterType;
                            case null "unknown";
                        };
                    }
                }
            )
        } catch (err) {
            logger.info("Failed to get user canisters:");
            logger.info("- Error: " # Error.message(err));
            [] // Return empty array in case of error
        }
    };


    public func createCanisterWithSettings(
        userPrincipal: Principal,  // Add user principal as a parameter
        memoryGB: Nat,
        computeAllocation: Nat,
        freezingThreshold: ?Nat,
        durationInDays: Nat,
        cyclesAmount: Nat,  // Add cycles amount parameter
        name: Text,
        canisterType: Text
    ): async Result.Result<Text, Text> {
        logger.info("Creating canister with settings:");
        logger.info("- Name: " # name);
        logger.info("- Type: " # canisterType);
        logger.info("- Memory: " # Nat.toText(memoryGB) # "GB");
        logger.info("- Duration: " # Nat.toText(durationInDays) # " days");
        logger.info("- Cycles Amount: " # Nat.toText(cyclesAmount));

        switch(userWallet) {
            case null {
                logger.info("❌ Canister creation failed: No wallet initialized");
                return #err("No wallet initialized");
            };
            case (?wallet) {
                logger.info("Creating canister using wallet: " # Principal.toText(wallet.principal));
                let result = await canisterService.createCanisterWithSettings(
                    userPrincipal,              
                    Principal.fromActor(Main),  
                    memoryGB,
                    computeAllocation,
                    freezingThreshold,
                    durationInDays,
                    cyclesAmount,              
                    ?{
                        name = name;
                        canisterType = canisterType;
                        subType = null;
                        project = null;
                        didInterface = null;
                        stableInterface = null;
                    }
                );
                switch(result) {
                    case (#ok(canisterId)) {
                        logger.info("✅ Canister created successfully: " # canisterId);
                        userCanisters := Array.append(userCanisters, [Principal.fromText(canisterId)]);
                        #ok(canisterId)
                    };
                    case (#err(e)) {
                        logger.info("❌ Canister creation failed: " # e);
                        #err(e);
                    }
                }
            };
        }
    };

    public func startCanister(canisterId: Principal) : async Result.Result<Text, Text> {
        logger.info("Attempting to start canister: " # Principal.toText(canisterId));
        
        if (Array.find<Principal>(userCanisters, func(p) { p == canisterId }) == null) {
            logger.info("❌ Start canister failed: Canister not found or not owned by user");
            return #err("Canister not found or not owned by this user");
        };
        
        let result = await canisterService.startCanister(canisterId);
        switch(result) {
            case (#ok(msg)) {
                logger.info("✅ Canister started successfully");
                #ok(msg)
            };
            case (#err(e)) {
                logger.info("❌ Start canister failed: " # e);
                #err(e)
            };
        }
    };

    public func stopCanister(canisterId: Principal) : async Result.Result<Text, Text> {
        logger.info("Attempting to stop canister: " # Principal.toText(canisterId));
        
        if (Array.find<Principal>(userCanisters, func(p) { p == canisterId }) == null) {
            logger.info("❌ Stop canister failed: Canister not found or not owned by user");
            return #err("Canister not found or not owned by this user");
        };
        
        let result = await canisterService.stopCanister(canisterId);
        switch(result) {
            case (#ok(msg)) {
                logger.info("✅ Canister stopped successfully");
                #ok(msg)
            };
            case (#err(e)) {
                logger.info("❌ Stop canister failed: " # e);
                #err(e)
            };
        }
    };

    public func deleteCanister(canisterId: Principal) : async Result.Result<Text, Text> {
        logger.info("Attempting to delete canister: " # Principal.toText(canisterId));
        
        if (Array.find<Principal>(userCanisters, func(p) { p == canisterId }) == null) {
            logger.info("❌ Delete canister failed: Canister not found or not owned by user");
            return #err("Canister not found or not owned by this user");
        };
        
        let result = await canisterService.deleteCanister(canisterId);
        switch(result) {
            case (#ok(msg)) {
                logger.info("Removing canister from user's list...");
                userCanisters := Array.filter<Principal>(
                    userCanisters,
                    func(p) { p != canisterId }
                );
                logger.info("✅ Canister deleted successfully");
                #ok(msg)
            };
            case (#err(e)) {
                logger.info("❌ Delete canister failed: " # e);
                #err(e)
            };
        }
    };

    public func topUpCanister(canisterId: Principal, icpAmount: Float) : async Result.Result<Text, Text> {
        logger.info("Attempting to top up canister: " # Principal.toText(canisterId));
        logger.info("Top up amount: " # Float.toText(icpAmount) # " ICP");
        
        // Skip canister ownership check - allow topping up any canister
        // Just verify the canister exists via a canister status check
        try {
            let ic = actor("aaaaa-aa") : Interface.Self;
            let status = await ic.canister_status({ canister_id = canisterId });
            logger.info("Canister status verified, proceeding with top up");
        } catch (err) {
            logger.info("❌ Top up failed: Canister does not exist or cannot be accessed: " # Error.message(err));
            return #err("Canister does not exist or cannot be accessed. Please verify the canister ID.");
        };
        
        switch (userWallet) {
            case (null) {
                logger.info("❌ Top up failed: No wallet initialized");
                return #err("No wallet initialized");
            };
            case (?wallet) {
                try {
                    // For testing in local environment, let's immediately update the cycle balance
                    // This simulates a successful top-up
                    if (walletService.isLocalEnvironmentActive()) {
                        logger.info("Local environment detected - simulating top-up");
                        let result = await canisterService.topUpCanister(Principal.fromActor(Main), canisterId, icpAmount);
                        switch (result) {
                            case (#ok(msg)) {
                                logger.info("✅ Canister topped up successfully (local simulation)");
                                #ok(msg)
                            };
                            case (#err(e)) {
                                logger.info("❌ Top up failed (local simulation): " # e);
                                #err(e)
                            };
                        }
                    } else {
                        logger.info("Production environment - performing actual ICP transfer");
                        
                        // Get CMC account ID where to send ICP
                        let cmcCanister = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");
                        let defaultSubaccount = walletService.createDefaultSubaccount();
                        let cmcAccountIdArray = walletService.accountIdentifier(cmcCanister, defaultSubaccount);
                        let cmcAccountIdBlob = Blob.fromArray(cmcAccountIdArray);
                        let cmcAccountId = walletService.blobToHex(cmcAccountIdBlob);
                        
                        logger.info("Sending " # Float.toText(icpAmount) # " ICP to CMC account ID: " # cmcAccountId);
                        
                        // Convert ICP amount to e8s
                        let e8sAmount = Int.abs(Float.toInt(icpAmount * 100_000_000));
                        
                        // Send ICP to the CMC
                        let result = await walletService.sendICPToAccountId(
                            wallet,
                            cmcAccountId,
                            e8sAmount
                        );
                        
                        logger.info("ICP transfer result: " # result);
                        
                        if (Text.startsWith(result, #text "Transaction successful")) {
                            // Forward request to canister service to handle the cycle deposit
                            let topUpResult = await canisterService.topUpCanister(
                                Principal.fromActor(Main),
                                canisterId,
                                icpAmount
                            );
                            
                            switch (topUpResult) {
                                case (#ok(msg)) {
                                    logger.info("✅ Canister topped up successfully");
                                    #ok(msg)
                                };
                                case (#err(e)) {
                                    logger.info("❌ Top up failed after ICP transfer: " # e);
                                    #err(e)
                                };
                            }
                        } else {
                            logger.info("❌ ICP transfer failed: " # result);
                            #err("ICP transfer failed: " # result)
                        }
                    }
                } catch (err) {
                    let errorMsg = Error.message(err);
                    logger.info("❌ Top up failed with error: " # errorMsg);
                    #err(errorMsg)
                }
            };
        }
    };

public func topUpSelf(icpAmount: Float) : async Result.Result<Text, Text> {
    logger.info("Attempting direct top up with " # Float.toText(icpAmount) # " ICP");
    
    switch (userWallet) {
        case (null) {
            logger.info("❌ Self top-up failed: No wallet initialized");
            return #err("No wallet initialized");
        };
        case (?wallet) {
            try {
                // Get our own canister ID
                let selfCanisterId = Principal.fromActor(Main);
                
                // For local or production, use the same direct calculation
                // This assumes a fixed conversion rate of 1 ICP = 1T cycles
                let CYCLES_PER_ICP : Nat = 1_000_000_000_000; // 1T cycles per ICP
                
                // Calculate cycles to add - use exact multiplication to avoid conversion issues
                let e8sPerICP : Nat = 100_000_000; // 1 ICP = 100,000,000 e8s
                let icpInE8s : Nat = Int.abs(Float.toInt(icpAmount * 100_000_000));
                let cyclesToAdd : Nat = (icpInE8s * CYCLES_PER_ICP) / e8sPerICP;
                
                logger.info("Direct calculation: Adding " # Nat.toText(cyclesToAdd) # " cycles to self");
                
                // First send the ICP if in production
                if (not walletService.isLocalEnvironmentActive()) {
                    // Production environment - send ICP to CMC
                    let cmcCanister = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");
                    let defaultSubaccount = walletService.createDefaultSubaccount();
                    let cmcAccountIdArray = walletService.accountIdentifier(cmcCanister, defaultSubaccount);
                    let cmcAccountIdBlob = Blob.fromArray(cmcAccountIdArray);
                    let cmcAccountId = walletService.blobToHex(cmcAccountIdBlob);
                    
                    logger.info("Sending " # Float.toText(icpAmount) # " ICP to CMC account ID: " # cmcAccountId);
                    
                    // Convert ICP amount to e8s
                    let e8sAmount = Int.abs(Float.toInt(icpAmount * 100_000_000));
                    
                    // Send ICP to the CMC
                    let result = await walletService.sendICPToAccountId(
                        wallet,
                        cmcAccountId,
                        e8sAmount
                    );
                    
                    logger.info("ICP transfer result: " # result);
                    
                    if (not Text.startsWith(result, #text "Transaction successful")) {
                        logger.info("❌ ICP transfer failed: " # result);
                        return #err("ICP transfer failed: " # result);
                    };
                };
                
                // Add cycles to canister
                logger.info("Adding " # Nat.toText(cyclesToAdd) # " cycles to self");
                
                // Use a more direct approach for adding cycles
                Cycles.add(cyclesToAdd);
                
                // Call wallet_receive to accept the cycles
                let acceptResult = await wallet_receive();
                logger.info("Self top-up complete, accepted " # Nat64.toText(acceptResult.accepted) # " cycles");
                
                return #ok("Successfully topped up self with " # Float.toText(icpAmount) # 
                          " ICP worth of cycles (" # Nat.toText(cyclesToAdd) # " cycles)");
                
            } catch (err) {
                let errorMsg = Error.message(err);
                logger.info("❌ Self top-up failed with error: " # errorMsg);
                return #err(errorMsg);
            }
        };
    }
};


    // Convert from Nat64 XDR permyriad value to Float XDR per ICP value
    private func convertXdrPermyriadToFloat(xdrPermyriad: Nat) : Float {
        // The mathematical approach: manually calculate whole and decimal parts
        let wholePart = xdrPermyriad / 10000;
        let decimalPart = xdrPermyriad % 10000;
        
        // Convert to Float in a roundabout way
        var wholeFloat : Float = 0.0;
        var i = 0;
        while (i < wholePart) {
            wholeFloat += 1.0;
            i += 1;
        };
        
        // Calculate the decimal part
        var decimalFloat : Float = 0.0;
        
        if (decimalPart > 0) {
            // One decimal place = 1/10 = 0.1
            var oneTenthousandth : Float = 0.0001;
            i := 0;
            while (i < decimalPart) {
                decimalFloat += oneTenthousandth;
                i += 1;
            };
        };
        
        // Combine the whole and decimal parts
        wholeFloat + decimalFloat
    };


    public func topUpExternalCanister(canisterIdText: Text, icpAmount: Float) : async Result.Result<Text, Text> {
        logger.info("Attempting to top up external canister: " # canisterIdText);
        logger.info("Top up amount: " # Float.toText(icpAmount) # " ICP");
        
        if (icpAmount <= 0) {
            return #err("Top-up amount must be greater than 0");
        };
        
        // Validate the principal format first
        let canisterId = try {
            Principal.fromText(canisterIdText)
        } catch (err) {
            logger.info("❌ Top up failed: Invalid canister ID format: " # Error.message(err));
            return #err("Invalid canister ID format. Please provide a valid principal ID.");
        };
        
        // Verify the canister exists
        let ic = actor("aaaaa-aa") : Interface.Self;
        
        try {
            let status = await ic.canister_status({ canister_id = canisterId });
            logger.info("External canister status verified, proceeding with top up");
            
            // Use the existing topUpCanister logic for the actual top-up
            return await topUpCanister(canisterId, icpAmount);
        } catch (err) {
            logger.info("❌ Top up failed: External canister cannot be accessed: " # Error.message(err));
            return #err("The specified canister cannot be accessed. Please verify the canister ID.");
        };
    };



        public func getCanisterStatus(canisterId: Principal) : async Result.Result<Text, Text> {
            logger.info("Getting status for canister: " # Principal.toText(canisterId));
            
            if (Array.find<Principal>(userCanisters, func(p) { p == canisterId }) == null) {
                logger.info("❌ Get status failed: Canister not found or not owned by user");
                return #err("Canister not found or not owned by this user");
            };
            
            let result = await canisterService.getCanisterStatus(canisterId);
            switch(result) {
                case (#ok(msg)) {
                    logger.info("✅ Canister status retrieved successfully");
                    #ok(msg)
                };
                case (#err(e)) {
                    logger.info("❌ Get status failed: " # e);
                    #err(e)
                };
            }
        };




    // ===============================
    // CANISTER DEPLOYMENT
    // ===============================
public shared(msg) func deployToExistingCanister(
    canisterId: Principal,
    wasm: [Nat8],
    canisterType: Text,
    deploymentStage: Text,
    userPrincipal: Principal,
    metadata: ?canister.CanisterMetadata,
    versionId: ?Text, // Version parameter
    installMode: ?Text // New parameter to specify install mode
) : async Result.Result<Text, Text> {
    logger.info("Attempting to deploy to existing canister:");
    logger.info("- Canister ID: " # Principal.toText(canisterId));
    logger.info("- Type: " # canisterType);
    logger.info("- Stage: " # deploymentStage);
    logger.info("- Mode: " # Option.get(installMode, "reinstall")); // Log the installation mode
    logger.info("- WASM size: " # Nat.toText(wasm.size()) # " bytes");
    
    // Verify canister ownership
    if (Array.find<Principal>(userCanisters, func(p) { p == canisterId }) == null) {
        logger.info("❌ Deployment failed: Canister not found or not owned by user");
        return #err("Canister not found or not owned by this user canister");
    };

    logger.info("Initiating deployment...");
    let result = await canisterService.deployToExistingCanister(
        canisterId,
        wasm,
        canisterType,
        deploymentStage,
        Principal.fromActor(Main),
        userPrincipal,
        metadata,
        installMode // Pass the install mode to the service
    );

    // Record deployment in version if specified
    if (versionId != null) {
        try {
            let vid = Option.get(versionId, "");
            let versionManager = getVersionManager();
            let versionResult = versionManager.getVersion(vid);
            
            switch (versionResult) {
                case (#ok(version)) {
                    // Create a DeploymentReference record
                    let deploymentRef: DeploymentReference = {
                        id = "deployment-" # Principal.toText(canisterId) # "-" # Nat64.toText(Nat64.fromIntWrap(Time.now()));
                        name = canisterType # " deployment";
                        projectId = version.projectId;
                        canisterId = ?canisterId;
                        status = switch(result) {
                            case (#ok(_)) { "deployed" };
                            case (#err(_)) { "failed" };
                        };
                        network = deploymentStage; // Using deploymentStage as network identifier
                        lastUpdated = Nat64.fromIntWrap(Time.now());
                    };
                    
                    // We would need to add a method to VersionManager to record deployments
                    let _ = versionManager.addDeploymentReference(vid, deploymentRef);
                    logger.info("Recorded deployment in version " # vid);
                };
                case (#err(error)) {
                    logger.info("❌ Error recording deployment in version: " # debug_show(error));
                    // Continue with regular deployment result
                };
            };
        } catch (e) {
            logger.info("❌ Exception recording deployment in version: " # Error.message(e));
            // Continue with regular deployment result
        };
    };

    switch(result) {
        case (#ok(msg)) {
            logger.info("✅ Deployment completed successfully with mode: " # Option.get(installMode, "reinstall"));
            #ok(msg)
        };
        case (#err(e)) {
            logger.info("❌ Deployment failed: " # e);
            #err(e)
        };
    }
};



// ===============================
// CYCLE MANAGEMENT
// ===============================
public func wallet_receive() : async { accepted: Nat64 } {
    logger.info("Receiving cycles...");
    let available = Cycles.available();
    logger.info("Available cycles: " # Nat.toText(available));
    
    let accepted = Cycles.accept(available);
    logger.info("✅ Accepted cycles: " # Nat.toText(accepted));
    
    { accepted = Nat64.fromNat(accepted) };
};


    // ===============================
    // PROJECT MANAGEMENT
    // ===============================
    public query func getUserProjects() : async [Project] {
        userProjects
    };

    public func getProject(projectId: Text) : async Result.Result<Project, Text> {
        logger.info("Getting project with ID: " # projectId);
        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null {
                logger.info("❌ Project not found: " # projectId);
                #err("Project not found")
            };
            case (?project) {
                logger.info("✅ Project found: " # project.name);
                #ok(project)
            };
        }
    };

    // Helper function to update a project in the stable array
    private func updateProjectInArray(updatedProject: Project) : () {
        userProjects := Array.map<Project, Project>(
            userProjects,
            func (p: Project) : Project {
                if (p.id == updatedProject.id) { updatedProject } else { p }
            }
        );
    };

    func isAlphanumeric(c: Char) : Bool {
        let code = Char.toNat32(c);
        let isDigit = code >= 48 and code <= 57;  // 0-9
        let isUpper = code >= 65 and code <= 90;  // A-Z
        let isLower = code >= 97 and code <= 122; // a-z
        isDigit or isUpper or isLower
    };

    public shared(msg) func createProject(
        project: Project,
        initializeVersion: ?Bool
    ) : async Result.Result<Text, Text> {
        logs := Array.append(logs, [CustomDebug.print("=== Starting createProject ===")]);
        logs := Array.append(logs, [CustomDebug.print("Project ID: " # project.id)]);
        logs := Array.append(logs, [CustomDebug.print("Name: " # project.name)]);

        // Clean up any existing artifacts for this project
        getArtifactManager().cleanupProject(project.id);

        // Initialize with welcome message if no messages provided
        let initialMessages = switch (project.messages) {
            case null {
                let welcomeMessage: ChatMessage = {
                    id = project.id # "_welcome";
                    messageType = #System;
                    content = "Welcome to " # project.name # "! I'm your AI development assistant. What would you like to create today?";
                    timestamp = Nat64.fromIntWrap(Time.now());
                    isGenerating = null;
                    metadata = null;
                };
                ?[welcomeMessage]
            };
            case (?msgs) { ?msgs };
        };

        // Add the workingCopyBaseVersion field and initialize messages
        let projectWithDefaults = {
            project with
            workingCopyBaseVersion = project.workingCopyBaseVersion;
            messages = initialMessages;
            messageCount = switch (initialMessages) {
                case null { ?0 };
                case (?msgs) { ?msgs.size() };
            };
            lastMessageTime = switch (initialMessages) {
                case null { null };
                case (?msgs) { 
                    if (msgs.size() > 0) { ?msgs[msgs.size() - 1].timestamp } else { null }
                };
            };
            deployedAgents = ?[]; // Initialize with empty array
        };

        // Simply add the project as provided to the array
        userProjects := Array.append(userProjects, [projectWithDefaults]);
        
        // Initialize versioning if requested (default is true if not specified)
        let shouldInitVersion = Option.get(initializeVersion, true);
        if (shouldInitVersion) {
            try {
                let manager = getVersionManager();
                let result = manager.initializeProjectVersion(projectWithDefaults);
                
                switch (result) {
                    case (#ok(version)) {
                        logs := Array.append(logs, [CustomDebug.print("=== Project versioning initialized ===")]);
                        
                        // Set the initial version as the working copy base if none was provided
                        if (Option.isNull(projectWithDefaults.workingCopyBaseVersion)) {
                            let updatedProject = {
                                projectWithDefaults with
                                workingCopyBaseVersion = ?version.id;
                            };
                            updateProjectInArray(updatedProject);
                            logs := Array.append(logs, [CustomDebug.print("=== Set initial version as working copy base ===")]);
                        };
                    };
                    case (#err(error)) {
                        logs := Array.append(logs, [CustomDebug.print("=== Failed to initialize versioning: " # debug_show(error) # " ===")]);
                        // We don't fail the whole operation if versioning fails
                    };
                };
            } catch (e) {
                logs := Array.append(logs, [CustomDebug.print("=== Exception initializing versioning: " # Error.message(e) # " ===")]);
                // We don't fail the whole operation if versioning fails
            };
        };

        logs := Array.append(logs, [CustomDebug.print("=== Project Creation Complete ===")]);
        #ok(project.id)
    };

    private func normalizePath(path: Text): Text {
        var result = path;
        
        // Replace double slashes with single slash until no more double slashes exist
        while (Text.contains(result, #text "//")) {
            result := Text.replace(result, #text "//", "/");
        };
        
        // Ensure path doesn't end with a slash (unless it's just "/")
        if (Text.size(result) > 1 and Text.endsWith(result, #text "/")) {
            result := Text.trimEnd(result, #text "/");
        };
        
        return result;
    };


    // ===============================
    // PROJECT VERSION MANAGEMENT
    // ===============================

      private func getVersionManager() : VersionManager.VersionManager {
      switch (versionManager) {
          case (?manager) { manager };
          case null {
              let manager = VersionManager.VersionManager();
              
              // Restore state if we have it
              if (versionEntries.size() > 0 or artifactEntries.size() > 0 or projectVersionEntries.size() > 0) {
                  manager.setState(versionEntries, artifactEntries, projectVersionEntries);
              };
              
              versionManager := ?manager;
              manager
          };
      }
  };


// Initialize a project with its first version
public shared(msg) func initializeProjectVersion(
    projectId: Text
) : async Result.Result<ProjectVersion, Text> {
    logger.info("Initializing project version: " # projectId);
    
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
       logger.info("❌ Access denied: User is not a canister controller");
        return #err("Unauthorized: only the project owner can initialize versions");
    };
      
    // Get the project
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case (null) {
            return #err("Project not found");
        };
        case (?project) {
            // Initialize the version using the version manager
            let manager = getVersionManager();
            let result = manager.initializeProjectVersion(project);
            
            switch (result) {
                case (#ok(version)) {
                    logger.info("✅ Version initialized successfully: " # version.id);
                    
                    // Copy current project files to new version
                    logger.info("Attempting to copy current project files to initial version...");
                    
                    try {
                        // Get the canister principal
                        let canisterPrincipal = Principal.fromActor(Main);
                        logger.info("Using canister principal: " # Principal.toText(canisterPrincipal));
                        
                        // Get current project files (no version)
                        logger.info("Calling getProjectFiles with no version ID");
                        let filesResult = await getProjectFiles(
                            canisterPrincipal,
                            projectId,
                            null // null indicates current files, not a specific version
                        );
                        
                        switch (filesResult) {
                            case (#ok(currentFiles)) {
                                logger.info("Retrieved " # Nat.toText(currentFiles.size()) # " files from project");
                                
                                if (currentFiles.size() > 0) {
                                    // Convert code artifacts to version artifact files
                                    logger.info("Converting files to version artifact format");
                                    let artifactFiles = Buffer.Buffer<ArtifactFile>(currentFiles.size());
                                    
                                    for (file in currentFiles.vals()) {
                                        // Check if file is chunked (> 2MB)
                                        let artifactContent = switch (file.chunks) {
                                            case (?chunkList) {
                                                // File is chunked - store chunk references
                                                logger.info("Processing chunked file: " # file.fileName # " (" # Nat.toText(chunkList.size()) # " chunks)");
                                                #ChunkReference(chunkList)
                                            };
                                            case (null) {
                                                // File is not chunked - store inline content
                                                switch (file.content) {
                                                    case (?#Text(text)) { 
                                                        logger.info("Processing text file: " # file.fileName);
                                                        #Text(text) 
                                                    };
                                                    case (?#Binary(bytes)) { 
                                                        logger.info("Processing binary file: " # file.fileName);
                                                        #Binary(bytes) 
                                                    };
                                                    case (null) { 
                                                        logger.info("Processing null content file: " # file.fileName);
                                                        #Text("") 
                                                    };
                                                }
                                            };
                                        };
                                        
                                        let artifactFile : ArtifactFile = {
                                            path = normalizePath(file.path);  // Use normalized path
                                            fileName = file.fileName;
                                            mimeType = file.mimeType;
                                            language = file.language;
                                            content = artifactContent;
                                            lastModified = Nat64.fromIntWrap(Time.now());
                                        };
                                        
                                        artifactFiles.add(artifactFile);
                                    };
                                    
                                    logger.info("Creating artifact snapshot with " # Nat.toText(artifactFiles.size()) # " files");
                                    
                                    // Create artifact snapshot with current files
                                    let snapshotResult = manager.createArtifactSnapshot(version.id, Buffer.toArray(artifactFiles));
                                    
                                    switch (snapshotResult) {
                                        case (#ok(snapshot)) {
                                            logger.info("✅ Successfully created snapshot with ID: " # snapshot.id);
                                            
                                            // Get updated version with the snapshot
                                            let updatedVersionResult = manager.getVersion(version.id);
                                            switch (updatedVersionResult) {
                                                case (#ok(updatedVersion)) {
                                                    logger.info("✅ Retrieved updated version with snapshot");
                                                    return #ok(updatedVersion);
                                                };
                                                case (#err(error)) {
                                                    logger.info("⚠️ Could not retrieve updated version: " # debug_show(error));
                                                    return #ok(version);
                                                };
                                            };
                                        };
                                        case (#err(error)) {
                                            logger.info("❌ Failed to create artifact snapshot: " # debug_show(error));
                                            return #ok(version);
                                        };
                                    };
                                } else {
                                    logger.info("No files found in the project to copy");
                                    return #ok(version);
                                };
                            };
                            case (#err(error)) {
                                logger.info("❌ Error getting project files: " # error);
                                return #ok(version);
                            };
                        };
                    } catch (e) {
                        logger.info("❌ Exception in file copying process: " # Error.message(e));
                        return #ok(version);
                    };
                    
                    logger.info("Reached end of version initialization without returning");
                    #ok(version)
                };
                case (#err(error)) {
                    let errorMsg = switch (error) {
                        case (#VersionNotFound) { "Version not found" };
                        case (#InvalidVersion) { "Invalid version format" };
                        case (#ProjectNotFound) { "Project not found" };
                        case (#ArtifactNotFound) { "Artifact not found" };
                        case (#VersionExists) { "Version already exists for this project" };
                        case (#CanisterError) { "Canister error" };
                        case (#Unauthorized) { "Unauthorized" };
                        case (#Other(msg)) { msg };
                    };
                    logger.info("❌ Version initialization failed: " # errorMsg);
                    #err(errorMsg)
                };
            }
        };
    }
};


// Create a new version for a project
public shared(msg) func createProjectVersion(
    projectId: Text, 
    major: Nat, 
    minor: Nat, 
    patch: Nat,
    prerelease: ?Text,
    build: ?Text,
    description: ?Text,
    releaseNotes: ?Text,
    parentVersionId: ?Text
) : async Result.Result<ProjectVersion, Text> {
    logger.info("Creating new project version: " # projectId);
    
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
       logger.info("❌ Access denied: User is not a canister controller");
        return #err("Unauthorized: only the project owner can initialize versions");
    };
    
    // Verify the project exists
    if (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId }) == null) {
        return #err("Project not found");
    };
    
    // Create the semantic version
    let semanticVersion: SemanticVersion = {
        major = major;
        minor = minor;
        patch = patch;
        prerelease = prerelease;
        build = build;
    };
    
    // First, check if we need to validate the parent version
    if (parentVersionId != null) {
        let pvId = Option.get(parentVersionId, "");
        let versionManager = getVersionManager();
        let versionResult = versionManager.getVersion(pvId);
        
        switch (versionResult) {
            case (#err(_)) {
                // Parent version not found, but we'll continue with current files
                logger.info("Warning: Parent version not found: " # pvId # ". Will use current project files.");
                // Continue with operation below, using current files
            };
            case (#ok(_)) {
                // Parent version exists, continue normally
            };
        };
    };
    
    // Use the version manager to create the new version
    let manager = getVersionManager();
    let result = manager.createNewVersion(
        projectId,
        semanticVersion,
        description,
        releaseNotes,
        parentVersionId
    );
    
    switch (result) {
        case (#ok(version)) {
            logger.info("✅ Version created successfully: " # version.id);
            
            // Process to copy current files if needed
            if (Option.isNull(version.artifactSnapshot)) {
                logger.info("No artifacts in new version. Copying current project files...");
                
                try {
                    // Get current project files (no version)
                    let filesResult = await getProjectFiles(
                        Principal.fromActor(Main), // Use the canister's own principal
                        projectId,
                        null // null indicates current files, not a specific version
                    );
                    
                    switch (filesResult) {
                        case (#ok(currentFiles)) {
                            if (currentFiles.size() > 0) {
                                logger.info("Found " # Nat.toText(currentFiles.size()) # " current files to copy to version");
                                
                                // Convert code artifacts to version artifact files
                                let artifactFiles = Array.map<codeArtifacts.CodeArtifact, ArtifactFile>(
                                    currentFiles,
                                    func(file: codeArtifacts.CodeArtifact) : ArtifactFile {
                                        // Check if file is chunked (> 2MB)
                                        let artifactContent = switch (file.chunks) {
                                            case (?chunkList) {
                                                // File is chunked - store chunk references
                                                #ChunkReference(chunkList)
                                            };
                                            case (null) {
                                                // File is not chunked - store inline content
                                                switch (file.content) {
                                                    case (?#Text(text)) { #Text(text) };
                                                    case (?#Binary(bytes)) { #Binary(bytes) };
                                                    case (null) { #Text("") }; // Empty content for null
                                                }
                                            };
                                        };
                                        
                                        {
                                            path = normalizePath(file.path);
                                            fileName = file.fileName;
                                            mimeType = file.mimeType;
                                            language = file.language;
                                            content = artifactContent;
                                            lastModified = Nat64.fromIntWrap(Time.now());
                                        }
                                    }
                                );
                                
                                // Create artifact snapshot with current files
                                let snapshotResult = manager.createArtifactSnapshot(version.id, artifactFiles);
                                
                                switch (snapshotResult) {
                                    case (#ok(_)) {
                                        logger.info("✅ Successfully copied current files to new version");
                                    };
                                    case (#err(error)) {
                                        logger.info("❌ Failed to copy current files to version: " # debug_show(error));
                                        // Continue anyway, as the version was created successfully
                                    };
                                };
                            } else {
                                logger.info("No current files found to copy to version");
                            };
                        };
                        case (#err(error)) {
                            logger.info("❌ Failed to get current files: " # error);
                            // Continue anyway, as the version was created successfully
                        };
                    };
                } catch (e) {
                    logger.info("❌ Exception while copying current files: " # Error.message(e));
                    // Continue anyway, as the version was created successfully
                };
                
                // Get the updated version with the new artifact snapshot
                let updatedVersionResult = manager.getVersion(version.id);
                switch (updatedVersionResult) {
                    case (#ok(updatedVersion)) {
                        return #ok(updatedVersion);
                    };
                    case (#err(_)) {
                        // If we can't get the updated version, return the original one
                        return #ok(version);
                    };
                };
            } else {
                // Version already has artifacts (likely copied from parent)
                return #ok(version);
            };
        };
        case (#err(error)) {
            let errorMsg = switch (error) {
                case (#VersionNotFound) { "Version not found" };
                case (#InvalidVersion) { "Invalid version format" };
                case (#ProjectNotFound) { "Project not found" };
                case (#ArtifactNotFound) { "Artifact not found" };
                case (#VersionExists) { "Version already exists for this project" };
                case (#CanisterError) { "Canister error" };
                case (#Unauthorized) { "Unauthorized" };
                case (#Other(msg)) { msg };
            };
            logger.info("❌ Version creation failed: " # errorMsg);
            #err(errorMsg)
        };
    }
};

  // Get all versions of a project
    public shared(msg) func getProjectVersions(
        projectId: Text
    ) : async Result.Result<[ProjectVersion], Text> {
        // Now we can use await here
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logger.info("❌ Access denied: User is not a canister controller");
            return #err("Unauthorized: only the project owner can initialize versions");
        };
        
        let manager = getVersionManager();
        let result = manager.getProjectVersions(projectId);
        
        switch (result) {
            case (#ok(versions)) {
                #ok(versions)
            };
            case (#err(error)) {
                let errorMsg = switch (error) {
                    case (#VersionNotFound) { "Version not found" };
                    case (#InvalidVersion) { "Invalid version format" };
                    case (#ProjectNotFound) { "Project not found" };
                    case (#ArtifactNotFound) { "Artifact not found" };
                    case (#VersionExists) { "Version already exists for this project" };
                    case (#CanisterError) { "Canister error" };
                    case (#Unauthorized) { "Unauthorized" };
                    case (#Other(msg)) { msg };
                };
                #err(errorMsg)
            };
        }
    };


  // Get a specific version by ID
    public shared(msg) func getProjectVersion(
        versionId: Text
    ) : async Result.Result<ProjectVersion, Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logger.info("❌ Access denied: User is not a canister controller");
            return #err("Unauthorized: only canister controllers can access versions");
        };
        
        let manager = getVersionManager();
        let result = manager.getVersion(versionId);
        
        switch (result) {
            case (#ok(version)) {
                #ok(version)
            };
            case (#err(error)) {
                let errorMsg = switch (error) {
                    case (#VersionNotFound) { "Version not found" };
                    case (#InvalidVersion) { "Invalid version format" };
                    case (#ProjectNotFound) { "Project not found" };
                    case (#ArtifactNotFound) { "Artifact not found" };
                    case (#VersionExists) { "Version already exists for this project" };
                    case (#CanisterError) { "Canister error" };
                    case (#Unauthorized) { "Unauthorized" };
                    case (#Other(msg)) { msg };
                };
                #err(errorMsg)
            };
        }
    };
  
  // Get the latest version of a project
    public shared(msg) func getLatestProjectVersion(
        projectId: Text
    ) : async Result.Result<ProjectVersion, Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logger.info("❌ Access denied: User is not a canister controller");
            return #err("Unauthorized: only canister controllers can access versions");
        };
        
        let manager = getVersionManager();
        let result = manager.getLatestVersion(projectId);
        
        switch (result) {
            case (#ok(version)) {
                #ok(version)
            };
            case (#err(error)) {
                let errorMsg = switch (error) {
                    case (#VersionNotFound) { "Version not found" };
                    case (#InvalidVersion) { "Invalid version format" };
                    case (#ProjectNotFound) { "Project not found" };
                    case (#ArtifactNotFound) { "Artifact not found" };
                    case (#VersionExists) { "Version already exists for this project" };
                    case (#CanisterError) { "Canister error" };
                    case (#Unauthorized) { "Unauthorized" };
                    case (#Other(msg)) { msg };
                };
                #err(errorMsg)
            };
        }
    };


public shared(_msg) func promoteVersionToWorkingCopy(
    userPrincipal: Principal,
    projectId: Text,
    versionId: Text,
    overwriteExisting: Bool
) : async Result.Result<Text, Text> {
    logger.info("⏳ PROMOTE VERSION TO WORKING COPY - Starting...");
    logger.info("- Project ID: " # projectId);
    logger.info("- Version ID: " # versionId);
    logger.info("- Overwrite existing: " # Bool.toText(overwriteExisting));
    
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null {
            logger.info("❌ Project not found: " # projectId);
            #err("Project not found");
        };
        case (?project) {
            logger.info("✅ Project found: " # project.name);
            logger.info("Current workingCopyBaseVersion: " # 
                Option.get(project.workingCopyBaseVersion, "None"));
            
            let versionManager = getVersionManager();
            
            // Get version artifacts
            logger.info("⏳ Fetching version artifacts for: " # versionId);
            let artifactsResult = versionManager.getVersionArtifacts(versionId);
            
            switch (artifactsResult) {
                case (#ok(artifact)) {
                    logger.info("✅ Successfully retrieved version artifacts");
                    logger.info("- Total files in version: " # Int.toText(artifact.files.size()));
                    
                    let artifactManager = getArtifactManager();
                    var processedCount = 0;
                    var errorCount = 0;
                    var skippedCount = 0;
                    
                    // Process each file from the version
                    logger.info("⏳ Processing files from version...");
                    for (file in artifact.files.vals()) {
                        // First check if file exists in working copy
                        let normalizedPath = PathUtils.normalizePath(file.path);
                        let readResult = artifactManager.readArtifact(projectId, normalizedPath, file.fileName);
                        
                        logger.info("- Processing file: " # (if (normalizedPath != "") normalizedPath # "/" else "") # file.fileName);
                        
                        let fileExists = switch (readResult) {
                            case (#ok(_)) { 
                                logger.info("  - File exists in working copy");
                                true 
                            };
                            case (#err(_)) { 
                                logger.info("  - File does not exist in working copy");
                                false 
                            };
                        };
                        
                        let shouldProcess = if (fileExists) {
                            if (overwriteExisting) {
                                logger.info("  - Will update existing file");
                                true
                            } else {
                                logger.info("  - Skipping (file exists and overwriteExisting=false)");
                                skippedCount += 1;
                                false
                            }
                        } else {
                            logger.info("  - Will create new file");
                            true
                        };
                        
                        if (shouldProcess) {
                            // Choose whether to create or update based on file existence
                            let contentResult = switch (file.content) {
                                case (#Text(text)) {
                                    logger.info("  - Content type: Text (" # Int.toText(text.size()) # " chars)");
                                    if (fileExists) {
                                        // Use updateArtifact for existing files
                                        artifactManager.updateArtifact(
                                            projectId,
                                            file.fileName, 
                                            #Text(text),
                                            file.mimeType,
                                            normalizedPath
                                        )
                                    } else {
                                        // Use createArtifact for new files
                                        artifactManager.createArtifact(
                                            projectId,
                                            file.fileName, 
                                            #Text(text),
                                            file.mimeType,
                                            file.language,
                                            normalizedPath
                                        )
                                    }
                                };
                                case (#Binary(bytes)) {
                                    logger.info("  - Content type: Binary (" # Int.toText(bytes.size()) # " bytes)");
                                    if (fileExists) {
                                        // Use updateArtifact for existing files
                                        artifactManager.updateArtifact(
                                            projectId,
                                            file.fileName, 
                                            #Binary(bytes),
                                            file.mimeType,
                                            normalizedPath
                                        )
                                    } else {
                                        // Use createArtifact for new files
                                        artifactManager.createArtifact(
                                            projectId,
                                            file.fileName, 
                                            #Binary(bytes),
                                            file.mimeType,
                                            file.language,
                                            normalizedPath
                                        )
                                    }
                                };
                                case (#Reference(ref)) {
                                    logger.info("  - Content type: Reference (unsupported)");
                                    #err("Cannot promote reference type files")
                                };
                            };
                            
                            switch (contentResult) {
                                case (#ok(_)) { 
                                    logger.info("  - ✅ Successfully processed file");
                                    processedCount += 1; 
                                };
                                case (#err(e)) { 
                                    logger.info("  - ❌ Error processing file: " # e);
                                    errorCount += 1; 
                                };
                            };
                        };
                    };
                    
                    logger.info("📊 Processing summary:");
                    logger.info("- Files processed: " # Int.toText(processedCount));
                    logger.info("- Files skipped: " # Int.toText(skippedCount));
                    logger.info("- Errors: " # Int.toText(errorCount));
                    
                    // Update the project with new workingCopyBaseVersion
                    logger.info("⏳ Updating project workingCopyBaseVersion to: " # versionId);
                    let updatedProject = {
                        id = project.id;
                        name = project.name;
                        description = project.description;
                        projectType = project.projectType;
                        canisters = project.canisters;
                        motokoPackages = project.motokoPackages;
                        npmPackages = project.npmPackages;
                        created = project.created;
                        updated = Nat64.fromIntWrap(Time.now());
                        visibility = project.visibility;
                        status = project.status;
                        collaborators = project.collaborators;
                        templateId = project.templateId;
                        workingCopyBaseVersion = ?versionId;
                        messages = project.messages;
                        metadata = project.metadata;
                        messageCount = project.messageCount;
                        lastMessageTime = project.lastMessageTime;
                        deployedAgents = project.deployedAgents;
                        hasBackendChanged = project.hasBackendChanged;
                        hasFrontendChanged = project.hasFrontendChanged;
                        lastBackendDeployment = project.lastBackendDeployment;
                        lastFrontendDeployment = project.lastFrontendDeployment;
                        lastDeploymentServerPairId = project.lastDeploymentServerPairId;
                    };
                    
                    // Update the project in the array
                    logger.info("⏳ Saving updated project");
                    updateProjectInArray(updatedProject);
                    logger.info("✅ Project successfully updated");
                    
                    logger.info("✅ PROMOTE VERSION TO WORKING COPY - Completed successfully");
                    #ok("Promoted " # Nat.toText(processedCount) # " files from version " # versionId # 
                        " to working copy." # (if (errorCount > 0) " Errors: " # Nat.toText(errorCount) else "") #
                        (if (skippedCount > 0) " Skipped: " # Nat.toText(skippedCount) else "") #
                        ". Working copy is now based on version " # versionId)
                };
                case (#err(error)) {
                    // Error handling for version artifacts
                    let errorMsg = switch (error) {
                        case (#VersionNotFound) { "Version not found" };
                        case (#InvalidVersion) { "Invalid version format" };
                        case (#ProjectNotFound) { "Project not found" };
                        case (#ArtifactNotFound) { "No artifacts found for this version" };
                        case (#VersionExists) { "Version already exists for this project" };
                        case (#CanisterError) { "Canister error" };
                        case (#Unauthorized) { "Unauthorized" };
                        case (#Other(msg)) { msg };
                    };
                    logger.info("❌ PROMOTE VERSION TO WORKING COPY - Failed: " # errorMsg);
                    #err(errorMsg)
                };
            }
        };
    }
};
    
  // Update version status
  public shared(msg) func updateVersionStatus(
      versionId: Text,
      statusText: Text
  ) : async Result.Result<ProjectVersion, Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logger.info("❌ Access denied: User is not a canister controller");
            return #err("Unauthorized: only canister controllers can access versions");
        };

      // Convert text status to variant
      let status = switch (statusText) {
          case ("development") { #Development };
          case ("released") { #Released };
          case ("deprecated") { #Deprecated };
          case ("draft") { #Draft };
          case (_) { return #err("Invalid status: must be 'development', 'released', 'deprecated', or 'draft'") };
      };
      
      let manager = getVersionManager();
      let result = manager.updateVersionStatus(versionId, status);
      
      switch (result) {
          case (#ok(version)) {
              logger.info("✅ Version status updated successfully: " # version.id);
              #ok(version)
          };
          case (#err(error)) {
              let errorMsg = switch (error) {
                  case (#VersionNotFound) { "Version not found" };
                  case (#InvalidVersion) { "Invalid version format" };
                  case (#ProjectNotFound) { "Project not found" };
                  case (#ArtifactNotFound) { "Artifact not found" };
                  case (#VersionExists) { "Version already exists for this project" };
                  case (#CanisterError) { "Canister error" };
                  case (#Unauthorized) { "Unauthorized" };
                  case (#Other(msg)) { msg };
              };
              logger.info("❌ Version status update failed: " # errorMsg);
              #err(errorMsg)
          };
      }
  };
  
  // Create version-specific code artifacts
  public shared(msg) func createVersionArtifacts(
      versionId: Text,
      files: [ArtifactFile]
  ) : async Result.Result<VersionArtifact, Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logger.info("❌ Access denied: User is not a canister controller");
            return #err("Unauthorized: only canister controllers can access versions");
        };
      
      let manager = getVersionManager();
      let result = manager.createArtifactSnapshot(versionId, files);
      
      switch (result) {
          case (#ok(artifact)) {
              logger.info("✅ Version artifacts created successfully: " # artifact.id);
              #ok(artifact)
          };
          case (#err(error)) {
              let errorMsg = switch (error) {
                  case (#VersionNotFound) { "Version not found" };
                  case (#InvalidVersion) { "Invalid version format" };
                  case (#ProjectNotFound) { "Project not found" };
                  case (#ArtifactNotFound) { "Artifact not found" };
                  case (#VersionExists) { "Version already exists for this project" };
                  case (#CanisterError) { "Canister error" };
                  case (#Unauthorized) { "Unauthorized" };
                  case (#Other(msg)) { msg };
              };
              logger.info("❌ Version artifacts creation failed: " # errorMsg);
              #err(errorMsg)
          };
      }
  };
  
  // Get version-specific artifacts
    public shared(msg) func getVersionArtifacts(
        versionId: Text
    ) : async Result.Result<VersionArtifact, Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logger.info("❌ Access denied: User is not a canister controller");
            return #err("Unauthorized: only canister controllers can access artifacts");
        };
        
        let manager = getVersionManager();
        let result = manager.getVersionArtifacts(versionId);
        
        switch (result) {
            case (#ok(artifact)) {
                #ok(artifact)
            };
            case (#err(error)) {
                let errorMsg = switch (error) {
                    case (#VersionNotFound) { "Version not found" };
                    case (#InvalidVersion) { "Invalid version format" };
                    case (#ProjectNotFound) { "Project not found" };
                    case (#ArtifactNotFound) { "Artifact not found" };
                    case (#VersionExists) { "Version already exists for this project" };
                    case (#CanisterError) { "Canister error" };
                    case (#Unauthorized) { "Unauthorized" };
                    case (#Other(msg)) { msg };
                };
                #err(errorMsg)
            };
        }
    };
  
public shared(_msg) func createCodeArtifactForVersion(
    userPrincipal: Principal,
    versionId: Text,
    fileName: Text,
    content: codeArtifacts.FileContent,
    mimeType: Text,
    language: Text,
    path: Text
) : async Result.Result<VersionTypes.ArtifactFile, Text> {
    if (userPrincipal != userPrincipal) {
        return #err("Unauthorized: only the project owner can create artifacts");
    };
    
    try {
        // Get the version to verify it exists and get the project ID
        let manager = getVersionManager();
        let versionResult = manager.getVersion(versionId);
        
        switch (versionResult) {
            case (#err(error)) {
                let errorMsg = switch (error) {
                    case (#VersionNotFound) { "Version not found" };
                    case (#InvalidVersion) { "Invalid version format" };
                    case (#ProjectNotFound) { "Project not found" };
                    case (#ArtifactNotFound) { "Artifact not found" };
                    case (#VersionExists) { "Version already exists for this project" };
                    case (#CanisterError) { "Canister error" };
                    case (#Unauthorized) { "Unauthorized" };
                    case (#Other(msg)) { msg };
                };
                return #err(errorMsg);
            };
            case (#ok(version)) {
                // Get the project to check working copy base version
                let projectResult = Array.find<Project>(
                    userProjects, 
                    func(p: Project) : Bool { p.id == version.projectId }
                );
                
                switch (projectResult) {
                    case (null) {
                        return #err("Project not found: " # version.projectId);
                    };
                    case (?project) {
                        // Normalize the path
                        let normalizedPath = normalizePath(path);
                        
                        // Convert the content to the version artifact format
                        let artifactContent = switch (content) {
                            case (#Text(text)) { #Text(text) : VersionTypes.ArtifactContent };
                            case (#Binary(bytes)) { #Binary(bytes) : VersionTypes.ArtifactContent };
                        };
                                                        
                        // Create the artifact file
                        let artifactFile: VersionTypes.ArtifactFile = {
                            path = normalizedPath;
                            fileName = fileName;
                            mimeType = mimeType;
                            language = language;
                            content = artifactContent;
                            lastModified = Nat64.fromIntWrap(Time.now());
                        };
                        
                        // Check if there's an existing artifact snapshot
                        switch (version.artifactSnapshot) {
                            case (null) {
                                // No existing snapshot, create a new one with just this file
                                let result = manager.createArtifactSnapshot(versionId, [artifactFile]);
                                switch (result) {
                                    case (#ok(_)) {
                                        logger.info("✅ Created new artifact snapshot with file: " # fileName);
                                        
                                        // Check if we should update the working copy too
                                        let isWorkingCopyBase = switch (project.workingCopyBaseVersion) {
                                            case (?baseVersion) { baseVersion == versionId };
                                            case (null) { false };
                                        };
                                        
                                        // Check if this is the latest version
                                        let latestVersionResult = manager.getLatestVersion(version.projectId);
                                        let isLatestVersion = switch (latestVersionResult) {
                                            case (#ok(latest)) { latest.id == versionId };
                                            case (#err(_)) { false };
                                        };
                                        
                                        if (isWorkingCopyBase or isLatestVersion) {
                                            // Also update the working copy
                                            let _ = getArtifactManager().createArtifact(
                                                project.id,
                                                fileName,
                                                content,
                                                mimeType,
                                                language,
                                                normalizedPath
                                            );
                                            logger.info("Also updated working copy as this is the base version or latest version");
                                        };
                                        
                                        #ok(artifactFile)
                                    };
                                    case (#err(error)) {
                                        let errorMsg = switch (error) {
                                            case (#VersionNotFound) { "Version not found" };
                                            case (#InvalidVersion) { "Invalid version format" };
                                            case (#ProjectNotFound) { "Project not found" };
                                            case (#ArtifactNotFound) { "Artifact not found" };
                                            case (#VersionExists) { "Version already exists for this project" };
                                            case (#CanisterError) { "Canister error" };
                                            case (#Unauthorized) { "Unauthorized" };
                                            case (#Other(msg)) { msg };
                                        };
                                        #err(errorMsg)
                                    };
                                }
                            };
                            case (?snapshotId) {
                                // Get existing snapshot
                                let artifactResult = manager.getVersionArtifacts(versionId);
                                switch (artifactResult) {
                                    case (#ok(artifact)) {
                                        // Replace the file if it exists, otherwise add it
                                        let existingFileIndex = Array.indexOf<ArtifactFile>(
                                            {
                                                path = normalizedPath;
                                                fileName = fileName;
                                                mimeType = "";
                                                language = "";
                                                content = #Text("") : VersionTypes.ArtifactContent;
                                                lastModified = 0;
                                            },
                                            artifact.files,
                                            func(a: ArtifactFile, b: ArtifactFile) : Bool {
                                                a.path == b.path and a.fileName == b.fileName
                                            }
                                        );
                                        
                                        let updatedFiles = if (existingFileIndex == null) {
                                            // File doesn't exist, append it
                                            Array.append(artifact.files, [artifactFile])
                                        } else {
                                            // File exists, replace it
                                            let index = Option.get(existingFileIndex, 0);
                                            let before = Array.subArray(artifact.files, 0, index);
                                            let after = Array.subArray(
                                                artifact.files,
                                                index + 1,
                                                artifact.files.size() - index - 1
                                            );
                                            Array.append(before, Array.append([artifactFile], after))
                                        };
                                        
                                        // Create new snapshot with updated files
                                        let result = manager.createArtifactSnapshot(versionId, updatedFiles);
                                        switch (result) {
                                            case (#ok(_)) {
                                                logger.info("✅ Updated artifact snapshot with file: " # fileName);
                                                
                                                // Check if we should update the working copy too
                                                let isWorkingCopyBase = switch (project.workingCopyBaseVersion) {
                                                    case (?baseVersion) { baseVersion == versionId };
                                                    case (null) { false };
                                                };
                                                
                                                // Check if this is the latest version
                                                let latestVersionResult = manager.getLatestVersion(version.projectId);
                                                let isLatestVersion = switch (latestVersionResult) {
                                                    case (#ok(latest)) { latest.id == versionId };
                                                    case (#err(_)) { false };
                                                };
                                                
                                                if (isWorkingCopyBase or isLatestVersion) {
                                                    // Also update the working copy
                                                    let _ = getArtifactManager().createArtifact(
                                                        project.id,
                                                        fileName,
                                                        content,
                                                        mimeType,
                                                        language,
                                                        normalizedPath
                                                    );
                                                    logger.info("Also updated working copy as this is the base version or latest version");
                                                };
                                                
                                                #ok(artifactFile)
                                            };
                                            case (#err(error)) {
                                                let errorMsg = switch (error) {
                                                    case (#VersionNotFound) { "Version not found" };
                                                    case (#InvalidVersion) { "Invalid version format" };
                                                    case (#ProjectNotFound) { "Project not found" };
                                                    case (#ArtifactNotFound) { "Artifact not found" };
                                                    case (#VersionExists) { "Version already exists for this project" };
                                                    case (#CanisterError) { "Canister error" };
                                                    case (#Unauthorized) { "Unauthorized" };
                                                    case (#Other(msg)) { msg };
                                                };
                                                #err(errorMsg)
                                            };
                                        }
                                    };
                                    case (#err(error)) {
                                        let errorMsg = switch (error) {
                                            case (#VersionNotFound) { "Version not found" };
                                            case (#InvalidVersion) { "Invalid version format" };
                                            case (#ProjectNotFound) { "Project not found" };
                                            case (#ArtifactNotFound) { "Artifact not found" };
                                            case (#VersionExists) { "Version already exists for this project" };
                                            case (#CanisterError) { "Canister error" };
                                            case (#Unauthorized) { "Unauthorized" };
                                            case (#Other(msg)) { msg };
                                        };
                                        #err(errorMsg)
                                    };
                                }
                            };
                        }
                    };
                };
            };
        }
    } catch (e) {
        #err("Error creating version artifact: " # Error.message(e))
    }
};
  
// Get file from version artifacts
public shared(msg) func getVersionArtifactFile(
    versionId: Text,
    path: Text,
    fileName: Text
) : async Result.Result<VersionTypes.ArtifactFile, Text> {
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        logger.info("❌ Access denied: User is not a canister controller");
        return #err("Unauthorized: only canister controllers can access artifacts");
    };
    
    let manager = getVersionManager();
    let result = manager.getVersionArtifacts(versionId);
    
    switch (result) {
        case (#ok(artifact)) {
            let fileResult = Array.find<ArtifactFile>(
                artifact.files,
                func(file: ArtifactFile) : Bool {
                    file.path == path and file.fileName == fileName
                }
            );
            
            switch (fileResult) {
                case (?file) {
                    #ok(file)
                };
                case (null) {
                    #err("File not found in version artifacts")
                };
            }
        };
        case (#err(error)) {
            let errorMsg = switch (error) {
                case (#VersionNotFound) { "Version not found" };
                case (#InvalidVersion) { "Invalid version format" };
                case (#ProjectNotFound) { "Project not found" };
                case (#ArtifactNotFound) { "Artifact not found" };
                case (#VersionExists) { "Version already exists for this project" };
                case (#CanisterError) { "Canister error" };
                case (#Unauthorized) { "Unauthorized" };
                case (#Other(msg)) { msg };
            };
            #err(errorMsg)
        };
    }
};

// Get version by semantic version string
public shared(msg) func getVersionByString(
    projectId: Text,
    versionStr: Text
) : async Result.Result<ProjectVersion, Text> {
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        logger.info("❌ Access denied: User is not a canister controller");
        return #err("Unauthorized: only canister controllers can access versions");
    };
    
    // Parse the version string
    let parsedVersion = VersionTypes.parseVersion(versionStr);
    
    switch (parsedVersion) {
        case (null) {
            #err("Invalid version format. Expected format: major.minor.patch[-prerelease][+build]")
        };
        case (?semanticVersion) {
            let manager = getVersionManager();
            let result = manager.getVersionBySemanticVersion(projectId, semanticVersion);
            
            switch (result) {
                case (#ok(version)) {
                    #ok(version)
                };
                case (#err(error)) {
                    let errorMsg = switch (error) {
                        case (#VersionNotFound) { "Version not found" };
                        case (#InvalidVersion) { "Invalid version format" };
                        case (#ProjectNotFound) { "Project not found" };
                        case (#ArtifactNotFound) { "Artifact not found" };
                        case (#VersionExists) { "Version already exists for this project" };
                        case (#CanisterError) { "Canister error" };
                        case (#Unauthorized) { "Unauthorized" };
                        case (#Other(msg)) { msg };
                    };
                    #err(errorMsg)
                };
            }
        };
    }
};


// Call updateVersionPackages in VersionManager
public shared(msg) func updateVersionPackages(
    versionId: Text,
    motokoPackages: ?[PackageInfo],
    npmPackages: ?[NPMPackageInfo]
) : async Result.Result<ProjectVersion, Text> {
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        logger.info("❌ Access denied: User is not a canister controller");
        return #err("Unauthorized: only canister controllers can modify versions");
    };
    
    let manager = getVersionManager();
    let result = manager.updateVersionPackages(versionId, motokoPackages, npmPackages);
    
    switch (result) {
        case (#ok(version)) {
            #ok(version)
        };
        case (#err(error)) {
            let errorMsg = switch (error) {
                case (#VersionNotFound) { "Version not found" };
                case (#InvalidVersion) { "Invalid version format" };
                case (#ProjectNotFound) { "Project not found" };
                case (#ArtifactNotFound) { "Artifact not found" };
                case (#VersionExists) { "Version already exists for this project" };
                case (#CanisterError) { "Canister error" };
                case (#Unauthorized) { "Unauthorized" };
                case (#Other(msg)) { msg };
            };
            #err(errorMsg)
        };
    }
};

// Call updateVersionCanisters in VersionManager
public shared(msg) func updateVersionCanisters(
    versionId: Text,
    canisters: ?[Principal]
) : async Result.Result<ProjectVersion, Text> {
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        logger.info("❌ Access denied: User is not a canister controller");
        return #err("Unauthorized: only canister controllers can modify versions");
    };
    
    let manager = getVersionManager();
    let result = manager.updateVersionCanisters(versionId, canisters);
    
    switch (result) {
        case (#ok(version)) {
            #ok(version)
        };
        case (#err(error)) {
            let errorMsg = switch (error) {
                case (#VersionNotFound) { "Version not found" };
                case (#InvalidVersion) { "Invalid version format" };
                case (#ProjectNotFound) { "Project not found" };
                case (#ArtifactNotFound) { "Artifact not found" };
                case (#VersionExists) { "Version already exists for this project" };
                case (#CanisterError) { "Canister error" };
                case (#Unauthorized) { "Unauthorized" };
                case (#Other(msg)) { msg };
            };
            #err(errorMsg)
        };
    }
};

// Call addDeploymentReference in VersionManager
public shared(msg) func addDeploymentToVersion(
    versionId: Text,
    deployment: DeploymentReference
) : async Result.Result<ProjectVersion, Text> {
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        logger.info("❌ Access denied: User is not a canister controller");
        return #err("Unauthorized: only canister controllers can modify versions");
    };
    
    let manager = getVersionManager();
    let result = manager.addDeploymentReference(versionId, deployment);
    
    switch (result) {
        case (#ok(version)) {
            #ok(version)
        };
        case (#err(error)) {
            let errorMsg = switch (error) {
                case (#VersionNotFound) { "Version not found" };
                case (#InvalidVersion) { "Invalid version format" };
                case (#ProjectNotFound) { "Project not found" };
                case (#ArtifactNotFound) { "Artifact not found" };
                case (#VersionExists) { "Version already exists for this project" };
                case (#CanisterError) { "Canister error" };
                case (#Unauthorized) { "Unauthorized" };
                case (#Other(msg)) { msg };
            };
            #err(errorMsg)
        };
    }
};

// Delete a project version
public shared(msg) func deleteProjectVersion(
    versionId: Text
) : async Result.Result<(), Text> {
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        logger.info("❌ Access denied: User is not a canister controller");
        return #err("Unauthorized: only canister controllers can delete versions");
    };
    
    let manager = getVersionManager();
    let result = manager.deleteVersion(versionId);
    
    switch (result) {
        case (#ok(_)) {
            logger.info("✅ Version deleted successfully: " # versionId);
            #ok(())
        };
        case (#err(error)) {
            let errorMsg = switch (error) {
                case (#VersionNotFound) { "Version not found" };
                case (#InvalidVersion) { "Invalid version format" };
                case (#ProjectNotFound) { "Project not found" };
                case (#ArtifactNotFound) { "Artifact not found" };
                case (#VersionExists) { "Version already exists for this project" };
                case (#CanisterError) { "Canister error" };
                case (#Unauthorized) { "Unauthorized" };
                case (#Other(msg)) { msg };
            };
            logger.info("❌ Version deletion failed: " # errorMsg);
            #err(errorMsg)
        };
    }
};

// Copy version artifacts from one version to another
public shared(msg) func copyVersionArtifacts(
    sourceVersionId: Text,
    targetVersionId: Text
) : async Result.Result<ProjectVersion, Text> {
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        logger.info("❌ Access denied: User is not a canister controller");
        return #err("Unauthorized: only canister controllers can modify versions");
    };
    
    let manager = getVersionManager();
    
    // Get source version artifacts
    let sourceArtifactsResult = manager.getVersionArtifacts(sourceVersionId);
    
    switch (sourceArtifactsResult) {
        case (#err(error)) {
            let errorMsg = switch (error) {
                case (#VersionNotFound) { "Source version not found" };
                case (#InvalidVersion) { "Invalid version format" };
                case (#ProjectNotFound) { "Project not found" };
                case (#ArtifactNotFound) { "Source artifacts not found" };
                case (#VersionExists) { "Version conflict" };
                case (#CanisterError) { "Canister error" };
                case (#Unauthorized) { "Unauthorized" };
                case (#Other(msg)) { msg };
            };
            return #err(errorMsg);
        };
        case (#ok(sourceArtifact)) {
            // Verify target version exists
            let targetVersionResult = manager.getVersion(targetVersionId);
            
            switch (targetVersionResult) {
                case (#err(error)) {
                    let errorMsg = switch (error) {
                        case (#VersionNotFound) { "Target version not found" };
                        case (#InvalidVersion) { "Invalid version format" };
                        case (#ProjectNotFound) { "Project not found" };
                        case (#ArtifactNotFound) { "Artifact not found" };
                        case (#VersionExists) { "Version conflict" };
                        case (#CanisterError) { "Canister error" };
                        case (#Unauthorized) { "Unauthorized" };
                        case (#Other(msg)) { msg };
                    };
                    return #err(errorMsg);
                };
                case (#ok(targetVersion)) {
                    // Create a new artifact snapshot for the target version
                    let result = manager.createArtifactSnapshot(
                        targetVersionId,
                        sourceArtifact.files
                    );
                    
                    switch (result) {
                        case (#ok(_)) {
                            // Get the updated version and return it
                            let updatedVersionResult = manager.getVersion(targetVersionId);
                            
                            switch (updatedVersionResult) {
                                case (#ok(version)) {
                                    logger.info("✅ Artifacts copied successfully from " # sourceVersionId # " to " # targetVersionId);
                                    #ok(version)
                                };
                                case (#err(error)) {
                                    let errorMsg = switch (error) {
                                        case (#VersionNotFound) { "Target version not found after copying" };
                                        case (#InvalidVersion) { "Invalid version format" };
                                        case (#ProjectNotFound) { "Project not found" };
                                        case (#ArtifactNotFound) { "Artifact not found" };
                                        case (#VersionExists) { "Version conflict" };
                                        case (#CanisterError) { "Canister error" };
                                        case (#Unauthorized) { "Unauthorized" };
                                        case (#Other(msg)) { msg };
                                    };
                                    #err(errorMsg)
                                };
                            }
                        };
                        case (#err(error)) {
                            let errorMsg = switch (error) {
                                case (#VersionNotFound) { "Target version not found" };
                                case (#InvalidVersion) { "Invalid version format" };
                                case (#ProjectNotFound) { "Project not found" };
                                case (#ArtifactNotFound) { "Failed to create artifact snapshot" };
                                case (#VersionExists) { "Version conflict" };
                                case (#CanisterError) { "Canister error" };
                                case (#Unauthorized) { "Unauthorized" };
                                case (#Other(msg)) { msg };
                            };
                            #err(errorMsg)
                        };
                    }
                };
            }
        };
    }
};




    // ===============================
    // CANISTER MANAGEMENT
    // ===============================
    public func addCanisterMetadata(canisterId: Principal, metadata: CanisterMetadata) : async () {
        userCanisterMetadata := Array.append(userCanisterMetadata, [(canisterId, metadata)]);
    };

    public func removeCanisterMetadata(canisterId: Principal) : async () {
        userCanisterMetadata := Array.filter<(Principal, CanisterMetadata)>(
            userCanisterMetadata,
            func ((id, _)) { not Principal.equal(id, canisterId) }
        );
    };

    public func updateCanisterMetadata(canisterId: Principal, metadata: CanisterMetadata) : async () {
        userCanisterMetadata := Array.map<(Principal, CanisterMetadata), (Principal, CanisterMetadata)>(
            userCanisterMetadata,
            func ((id, oldMetadata)) {
                if (Principal.equal(id, canisterId)) {
                    (canisterId, metadata)
                } else {
                    (id, oldMetadata)
                }
            }
        );
    };

    public func getCanisterMetadata(canisterId: Principal) : async ?CanisterMetadata {
        switch (Array.find<(Principal, CanisterMetadata)>(
            userCanisterMetadata,
            func ((id, _)) { Principal.equal(id, canisterId) }
        )) {
            case (?(_, metadata)) ?metadata;
            case null null;
        }
    };




public shared(msg) func updateCanisterMetadataBC(
    canisterId: Principal,
    name: Text,
    canisterType: Text
) : async Result.Result<Text, Text> {
    logger.info("=== Starting updateCanisterMetadataBC ===");
    logger.info("Canister ID: " # Principal.toText(canisterId));
    logger.info("Name: " # name);
    logger.info("Type: " # canisterType);

    let metadata: CanisterMetadata = {
        name;
        canisterType;
        subType = null;
        project = null;
        didInterface = null;
        stableInterface = null;
    };
    
    // Update metadata directly
    userCanisterMetadata := Array.map<(Principal, CanisterMetadata), (Principal, CanisterMetadata)>(
        userCanisterMetadata,
        func ((id, oldMetadata)) {
            if (Principal.equal(id, canisterId)) {
                (canisterId, metadata)
            } else {
                (id, oldMetadata)
            }
        }
    );
    
    logger.info("=== updateCanisterMetadataBC completed ===");
    #ok("Canister metadata updated successfully")
};


    public shared(msg) func getCanisterBalance(
        canisterId: Principal
    ) : async Result.Result<Nat, Text> {
        let userCanisterList = await canisterService.getUserCanisters();
        if (Array.find<{principal: Principal; metadata: ?canister.CanisterMetadata}>(
            userCanisterList,
            func(p) { Principal.equal(p.principal, canisterId) }
        ) == null) {
            #err("Canister not found or not owned by caller")
        } else {
            await canisterService.getCanisterBalance(canisterId)
        }
    };

        public shared(msg) func isModuleInstalled(
        canisterId: Principal
    ) : async Result.Result<Bool, Text> {
        let userCanisterList = await canisterService.getUserCanisters();
        if (Array.find<{principal: Principal; metadata: ?canister.CanisterMetadata}>(
            userCanisterList,
            func(p) { Principal.equal(p.principal, canisterId) }
        ) == null) {
            #err("Canister not found or not owned by caller")
        } else {
            await canisterService.isModuleInstalled(canisterId)
        }
    };



public shared(msg) func addCanisterToProject(
    projectId: Text, 
    canisterId: Principal,
    versionId: ?Text // Added optional version parameter
) : async Result.Result<Text, Text> {
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null return #err("Project not found");
        case (?project) {
            // Use the async public method instead
            switch (await getCanisterMetadata(canisterId)) {
                case null return #err("Canister not found");
                case (?metadata) {
                    let updatedMetadata = {
                        name = metadata.name;
                        canisterType = metadata.canisterType;
                        subType = metadata.subType;
                        project = ?project.name;
                        didInterface = null;
                        stableInterface = null;
                    };

                    // Use the async public method
                    await updateCanisterMetadata(canisterId, updatedMetadata);

                    let updatedCanisters = Array.append(project.canisters, [canisterId]);
                    let updatedProject = {
                        id = project.id;
                        name = project.name;
                        description = project.description;
                        projectType = project.projectType;
                        canisters = updatedCanisters;
                        motokoPackages = project.motokoPackages;
                        npmPackages = project.npmPackages;
                        created = project.created;
                        updated = Prim.time();
                        visibility = project.visibility;
                        status = project.status;
                        collaborators = project.collaborators;
                        templateId = project.templateId;
                        workingCopyBaseVersion = project.workingCopyBaseVersion;
                        messages = project.messages;
                        metadata = project.metadata;
                        messageCount = project.messageCount;
                        lastMessageTime = project.lastMessageTime;
                        deployedAgents = project.deployedAgents;
                        hasBackendChanged = project.hasBackendChanged;
                        hasFrontendChanged = project.hasFrontendChanged;
                        lastBackendDeployment = project.lastBackendDeployment;
                        lastFrontendDeployment = project.lastFrontendDeployment;
                        lastDeploymentServerPairId = project.lastDeploymentServerPairId;
                    };

                    updateProjectInArray(updatedProject);
                    
                    // Update version if specified
                    if (versionId != null) {
                        try {
                            let vid = Option.get(versionId, "");
                            let versionManager = getVersionManager();
                            let versionResult = versionManager.getVersion(vid);
                            
                            switch (versionResult) {
                                case (#ok(version)) {
                                    // Update canisters in the version
                                let versionCanisters = if (Array.size(version.canisters) == 0) {
                                    // If canisters array is empty, create a new one with just this canister
                                    [canisterId]
                                } else {
                                    // Add canister if not already present
                                    let cans = version.canisters;
                                    if (Array.find<Principal>(cans, func(c) { Principal.equal(c, canisterId) }) == null) {
                                        Array.append(cans, [canisterId])
                                    } else {
                                        cans // Canister already exists in version
                                    }
                                };
                                    
                                    // Update version in storage
                                    let _ = versionManager.updateVersionCanisters(vid, ?versionCanisters);
                                    logs := Array.append(logs, [CustomDebug.print(
                                        "Added canister to version " # vid)]);
                                };
                                case (#err(error)) {
                                    logs := Array.append(logs, [CustomDebug.print(
                                        "Error updating version canisters: " # debug_show(error))]);
                                    // Continue with regular canister update
                                };
                            };
                        } catch (e) {
                            logs := Array.append(logs, [CustomDebug.print(
                                "Exception updating version canisters: " # Error.message(e))]);
                            // Continue with regular canister update
                        };
                    };
                    
                    #ok("Canister added to project successfully")
                };
            };
        };
    };
};


public shared(msg) func removeCanisterFromProject(
    projectId: Text, 
    canisterId: Principal,
    versionId: ?Text // Added optional version parameter
) : async Result.Result<Text, Text> {
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null return #err("Project not found");
        case (?project) {
            // Use await since getCanisterMetadata is async now
            switch (await getCanisterMetadata(canisterId)) {
                case null return #err("Canister not found");
                case (?metadata) {
                    let updatedMetadata : CanisterMetadata = {
                        name = metadata.name;
                        canisterType = metadata.canisterType;
                        subType = metadata.subType;
                        project = null;
                        didInterface = null;
                        stableInterface = null;
                    };

                    // Use await for updateCanisterMetadata
                    await updateCanisterMetadata(canisterId, updatedMetadata);

                    let updatedCanisters = Array.filter<Principal>(
                        project.canisters,
                        func (p: Principal) : Bool { p != canisterId }
                    );

                    let updatedProject = {
                        id = project.id;
                        name = project.name;
                        description = project.description;
                        projectType = project.projectType;
                        canisters = updatedCanisters;
                        motokoPackages = project.motokoPackages;
                        npmPackages = project.npmPackages;
                        created = project.created;
                        updated = Prim.time();
                        visibility = project.visibility;
                        status = project.status;
                        collaborators = project.collaborators;
                        templateId = project.templateId;
                        workingCopyBaseVersion = project.workingCopyBaseVersion;
                        messages = project.messages;
                        metadata = project.metadata;
                        messageCount = project.messageCount;
                        lastMessageTime = project.lastMessageTime;
                        deployedAgents = project.deployedAgents;
                        hasBackendChanged = project.hasBackendChanged;
                        hasFrontendChanged = project.hasFrontendChanged;
                        lastBackendDeployment = project.lastBackendDeployment;
                        lastFrontendDeployment = project.lastFrontendDeployment;
                        lastDeploymentServerPairId = project.lastDeploymentServerPairId;
                    };

                    updateProjectInArray(updatedProject);
                    
                    // Update version if specified
                    if (versionId != null) {
                        try {
                            let vid = Option.get(versionId, "");
                            let versionManager = getVersionManager();
                            let versionResult = versionManager.getVersion(vid);
                            
                            switch (versionResult) {
                                case (#ok(version)) {
                                    // Since version.canisters appears to be [Principal] (not optional)
                                    let filteredCanisters = Array.filter<Principal>(
                                        version.canisters,  // Directly use as non-optional array
                                        func(c: Principal) : Bool { 
                                            not Principal.equal(c, canisterId) 
                                        }
                                    );
                                    
                                    // Then wrap in optional when passing to the function
                                    let _ = versionManager.updateVersionCanisters(vid, ?filteredCanisters);
                                    logs := Array.append(logs, [CustomDebug.print(
                                        "Removed canister from version " # vid)]);
                                };
                                case (#err(error)) {
                                    logs := Array.append(logs, [CustomDebug.print(
                                        "Error updating version canisters: " # debug_show(error))]);
                                    // Continue with regular canister update
                                };
                            };
                        } catch (e) {
                            logs := Array.append(logs, [CustomDebug.print(
                                "Exception updating version canisters: " # Error.message(e))]);
                            // Continue with regular canister update
                        };
                    };
                    
                    #ok("Canister removed from project successfully")
                };
            };
        };
    };
};



    private func debugLogPackages(prefix: Text, packages: [PackageInfo]) {
        let logMsg = prefix # " - Total packages: " # Nat.toText(packages.size()) #
            "\nPackages: " #
            Array.foldLeft<PackageInfo, Text>(
                packages,
                "",
                func(acc: Text, pkg: PackageInfo): Text {
                    acc # "\n  * " # pkg.name # " (" # pkg.repo # " @ " # pkg.version # ")"
                }
            );
        logs := Array.append(logs, [CustomDebug.print(logMsg)]);
    };

public shared(msg) func addPackageToProject(
    projectId: Text, 
    package: PackageInfo,
    versionId: ?Text 
) : async Result.Result<Text, Text> {
    logs := Array.append(logs, [CustomDebug.print("=== Starting addPackageToProject ===")]);
    logs := Array.append(logs, [CustomDebug.print("ProjectID: " # projectId)]);
    logs := Array.append(logs, [CustomDebug.print("Package: " # package.name # " from " # package.repo)]);

    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null {
            logs := Array.append(logs, [CustomDebug.print("[ERROR] Project not found: " # projectId)]);
            #err("Project not found");
        };
        case (?project) {
            logs := Array.append(logs, [CustomDebug.print("Found project: " # project.name)]);
            let currentPackages = switch(project.motokoPackages) {
                case null {
                    logs := Array.append(logs, [CustomDebug.print("Current packages is null, initializing empty array")]);
                    [];
                };
                case (?packages) {
                    debugLogPackages("Current packages", packages);
                    packages;
                };
            };

            let packageExists = Array.find<PackageInfo>(
                currentPackages,
                func(p: PackageInfo) : Bool { p.name == package.name }
            );

            if (packageExists != null) {
                logs := Array.append(logs, [CustomDebug.print("[ERROR] Package already exists: " # package.name)]);
                #err("Package already exists in project");
            } else {
                let updatedPackages = Array.append(currentPackages, [package]);
                debugLogPackages("Updated packages", updatedPackages);

                let updatedProject = {
                    id = project.id;
                    name = project.name;
                    description = project.description;
                    projectType = project.projectType;
                    canisters = project.canisters;
                    motokoPackages = ?updatedPackages;
                    npmPackages = project.npmPackages;
                    created = project.created;
                    updated = Prim.time();
                    visibility = project.visibility;
                    status = project.status;
                    collaborators = project.collaborators;
                    templateId = project.templateId;
                    workingCopyBaseVersion = project.workingCopyBaseVersion;
                    messages = project.messages;
                    metadata = project.metadata;
                    messageCount = project.messageCount;
                    lastMessageTime = project.lastMessageTime;
                    deployedAgents = project.deployedAgents;
                    hasBackendChanged = project.hasBackendChanged;
                    hasFrontendChanged = project.hasFrontendChanged;
                    lastBackendDeployment = project.lastBackendDeployment;
                    lastFrontendDeployment = project.lastFrontendDeployment;
                    lastDeploymentServerPairId = project.lastDeploymentServerPairId;
                };

                updateProjectInArray(updatedProject);
                
                // Update version if specified
                if (versionId != null) {
                    try {
                        let vid = Option.get(versionId, "");
                        let versionManager = getVersionManager();
                        let versionResult = versionManager.getVersion(vid);
                        
                        switch (versionResult) {
                            case (#ok(version)) {
                                // Update packages in the version
                                let versionPackages = switch (version.motokoPackages) {
                                    case (null) { [package] };
                                    case (?pkgs) { 
                                        // Check if package exists in version
                                        let pkgExists = Array.find<PackageInfo>(
                                            pkgs,
                                            func(p: PackageInfo) : Bool { p.name == package.name }
                                        );
                                        
                                        if (pkgExists == null) {
                                            Array.append(pkgs, [package])
                                        } else {
                                            pkgs // Package already exists in version
                                        }
                                    };
                                };
                                
                                // Create updated version
                                let updatedVersion = {
                                    version with
                                    motokoPackages = ?versionPackages;
                                };
                                
                                // Update version in storage
                                // Note: This is simplified and would require version update support
                                // in your VersionManager class
                                logs := Array.append(logs, [CustomDebug.print(
                                    "Would update packages in version " # vid # 
                                    " (update mechanism needed in VersionManager)")]);
                            };
                            case (#err(error)) {
                                logs := Array.append(logs, [CustomDebug.print(
                                    "Error updating version packages: " # debug_show(error))]);
                                // Continue with regular package update
                            };
                        };
                    } catch (e) {
                        logs := Array.append(logs, [CustomDebug.print(
                            "Exception updating version packages: " # Error.message(e))]);
                        // Continue with regular package update
                    };
                };
                
                logs := Array.append(logs, [CustomDebug.print("[SUCCESS] Package " # package.name # " added successfully")]);
                #ok("Package " # package.name # " added successfully")
            };
        };
    };
};

    public shared(msg) func removePackageFromProject(projectId: Text, packageName: Text) : async Result.Result<Text, Text> {
        logs := Array.append(logs, [CustomDebug.print("Removing package " # packageName # " from project " # projectId)]);
        
        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null {
                logs := Array.append(logs, [CustomDebug.print("Project not found: " # projectId)]);
                #err("Project not found");
            };
            case (?project) {
                switch (project.motokoPackages) {
                    case null {
                        logs := Array.append(logs, [CustomDebug.print("No packages in project")]);
                        #err("No packages in project");
                    };
                    case (?packages) {
                        let initialCount = packages.size();
                        logs := Array.append(logs, [CustomDebug.print("Initial packages count: " # Nat.toText(initialCount))]);

                        let updatedPackages = Array.filter<PackageInfo>(
                            packages,
                            func(p: PackageInfo) : Bool { p.name != packageName }
                        );

                        let finalCount = updatedPackages.size();
                        logs := Array.append(logs, [CustomDebug.print("Final packages count: " # Nat.toText(finalCount))]);

                        if (initialCount == finalCount) {
                            logs := Array.append(logs, [CustomDebug.print("Package not found: " # packageName)]);
                            #err("Package not found in project");
                        } else {
                            let updatedProject = {
                                id = project.id;
                                name = project.name;
                                description = project.description;
                                projectType = project.projectType;
                                canisters = project.canisters;
                                motokoPackages = ?updatedPackages;
                                npmPackages = project.npmPackages;
                                created = project.created;
                                updated = Prim.time();
                                visibility = project.visibility;
                                status = project.status;
                                collaborators = project.collaborators;
                                templateId = project.templateId;
                                workingCopyBaseVersion = project.workingCopyBaseVersion;
                                messages = project.messages;
                                metadata = project.metadata;
                                messageCount = project.messageCount;
                                lastMessageTime = project.lastMessageTime;
                                deployedAgents = project.deployedAgents;
                                hasBackendChanged = project.hasBackendChanged;
                                hasFrontendChanged = project.hasFrontendChanged;
                                lastBackendDeployment = project.lastBackendDeployment;
                                lastFrontendDeployment = project.lastFrontendDeployment;
                                lastDeploymentServerPairId = project.lastDeploymentServerPairId;
                            };

                            updateProjectInArray(updatedProject);
                            logs := Array.append(logs, [CustomDebug.print("Package " # packageName # " removed successfully")]);
                            #ok("Package " # packageName # " removed successfully")
                        };
                    };
                };
            };
        };
    };



public shared(msg) func deleteProject(projectId: Text) : async Result.Result<Text, Text> {
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null return #err("Project not found");
        case (?project) {
            // Get the artifact manager instance
            let artifactManager = getArtifactManager();

            // Clean up all project artifacts
            artifactManager.cleanupProject(projectId);
            
            // Clean up all version data for this project
            try {
                let versionManager = getVersionManager();
                
                // Get all versions for this project
                let versionsResult = versionManager.getProjectVersions(projectId);
                
                switch (versionsResult) {
                    case (#ok(versions)) {
                        logger.info("Cleaning up " # Nat.toText(versions.size()) # " versions for project " # projectId);
                        
                        // Explicitly delete each version
                        for (version in versions.vals()) {
                            let deleteResult = versionManager.deleteVersion(version.id);
                            
                            switch (deleteResult) {
                                case (#ok(_)) {
                                    logger.info("Successfully deleted version: " # version.id);
                                };
                                case (#err(error)) {
                                    logger.info("Failed to delete version " # version.id # ": " # debug_show(error));
                                    // Continue with other versions even if one fails
                                };
                            };
                        };
                    };
                    case (#err(_)) {
                        // No versions or error, continue with deletion
                    };
                };
            } catch (e) {
                // Log but continue with deletion
                logger.info("Error cleaning up versions: " # Error.message(e));
            };

            // Remove project from stable array
            userProjects := Array.filter<Project>(
                userProjects,
                func (p: Project) : Bool { p.id != projectId }
            );

            #ok("Project and all associated resources deleted successfully")
        };
    };
};




public shared(msg) func updateProject(
    project: Project,
    createNewVersion: Bool,
    versionNotes: ?Text
) : async Result.Result<Text, Text> {
    logs := Array.append(logs, [CustomDebug.print("=== Starting updateProject ===")]);
    logs := Array.append(logs, [CustomDebug.print("Project ID: " # project.id)]);
    logs := Array.append(logs, [CustomDebug.print("Name: " # project.name)]);
    
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == project.id })) {
        case null return #err("Project not found");
        case (?existingProject) {
            // Make sure we update the timestamp
            let updatedProject = {
                id = project.id;
                name = project.name;
                description = project.description;
                projectType = project.projectType;
                canisters = project.canisters;
                motokoPackages = project.motokoPackages;
                npmPackages = project.npmPackages;
                created = existingProject.created; // Keep original creation time
                updated = Prim.time(); // Update the timestamp
                visibility = project.visibility;
                status = project.status;
                collaborators = project.collaborators;
                templateId = project.templateId;
                workingCopyBaseVersion = project.workingCopyBaseVersion;
                messages = existingProject.messages; // Keep existing messages
                metadata = existingProject.metadata; // Keep existing metadata
                messageCount = existingProject.messageCount; // Keep existing count
                lastMessageTime = existingProject.lastMessageTime; // Keep existing timestamp
                deployedAgents = existingProject.deployedAgents; // Keep existing deployed agents
                // Preserve deployment tracking fields
                hasBackendChanged = existingProject.hasBackendChanged;
                hasFrontendChanged = existingProject.hasFrontendChanged;
                lastBackendDeployment = existingProject.lastBackendDeployment;
                lastFrontendDeployment = existingProject.lastFrontendDeployment;
                lastDeploymentServerPairId = existingProject.lastDeploymentServerPairId;
            };

            updateProjectInArray(updatedProject);
            
            // Handle versioning if requested
            if (createNewVersion) {
                logs := Array.append(logs, [CustomDebug.print("Creating new version for project")]);
                try {
                    let versionManager = getVersionManager();
                    
                    // Get the latest version
                    let latestResult = versionManager.getLatestVersion(project.id);
                    
                    // Create a new version
                    let nextVersion = switch (latestResult) {
                        case (#ok(latest)) {
                            // Increment the minor version number
                            let currentSemVer = latest.semanticVersion;
                            {
                                major = currentSemVer.major;
                                minor = currentSemVer.minor + 1;
                                patch = 0;
                                prerelease = null;
                                build = null;
                            }
                        };
                        case (#err(_)) {
                            // If no versions exist, start with 1.0.0
                            {
                                major = 1;
                                minor = 0;
                                patch = 0;
                                prerelease = null;
                                build = null;
                            }
                        };
                    };
                    
                    // Get parent version ID
                    let parentId = switch (latestResult) {
                        case (#ok(latest)) { ?latest.id };
                        case (#err(_)) { null };
                    };
                    
                    // Create new version
                    let versionResult = versionManager.createNewVersion(
                        project.id,
                        nextVersion,
                        project.description,
                        versionNotes,
                        parentId
                    );
                    
                    switch (versionResult) {
                        case (#ok(version)) {
                            logs := Array.append(logs, [CustomDebug.print("Created new version: " # version.id)]);
                        };
                        case (#err(error)) {
                            logs := Array.append(logs, [CustomDebug.print("Failed to create version: " # debug_show(error))]);
                            // Don't fail the whole update if versioning fails
                        };
                    };
                } catch (e) {
                    logs := Array.append(logs, [CustomDebug.print("Exception creating version: " # Error.message(e))]);
                    // Don't fail the whole update if versioning fails
                };
            };
            
            logs := Array.append(logs, [CustomDebug.print("=== Project Update Complete ===")]);
            #ok("Project updated successfully")
        };
    };
};

    public shared(msg) func addNpmPackageToProject(projectId: Text, package: NPMPackageInfo) : async Result.Result<Text, Text> {
        logs := Array.append(logs, [CustomDebug.print("=== Starting addNpmPackageToProject ===")]);
        logs := Array.append(logs, [CustomDebug.print("ProjectID: " # projectId)]);
        logs := Array.append(logs, [CustomDebug.print("Package: " # package.name # " version " # package.version)]);

        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null {
                logs := Array.append(logs, [CustomDebug.print("[ERROR] Project not found: " # projectId)]);
                #err("Project not found");
            };
            case (?project) {
                let currentPackages = switch(project.npmPackages) {
                    case null { [] };
                    case (?packages) { packages };
                };

                // Check if package already exists
                let packageExists = Array.find<NPMPackageInfo>(
                    currentPackages,
                    func(p: NPMPackageInfo) : Bool { p.name == package.name }
                );

                if (packageExists != null) {
                    #err("Package already exists in project");
                } else {
                    let updatedPackages = Array.append(currentPackages, [package]);

                    let updatedProject = {
                        id = project.id;
                        name = project.name;
                        description = project.description;
                        projectType = project.projectType;
                        canisters = project.canisters;
                        motokoPackages = project.motokoPackages;
                        npmPackages = ?updatedPackages;
                        created = project.created;
                        updated = Prim.time();
                        visibility = project.visibility;
                        status = project.status;
                        collaborators = project.collaborators;
                        templateId = project.templateId;
                        workingCopyBaseVersion = project.workingCopyBaseVersion;
                        messages = project.messages;
                        metadata = project.metadata;
                        messageCount = project.messageCount;
                        lastMessageTime = project.lastMessageTime;
                        deployedAgents = project.deployedAgents;
                        hasBackendChanged = project.hasBackendChanged;
                        hasFrontendChanged = project.hasFrontendChanged;
                        lastBackendDeployment = project.lastBackendDeployment;
                        lastFrontendDeployment = project.lastFrontendDeployment;
                        lastDeploymentServerPairId = project.lastDeploymentServerPairId;
                    };

                    updateProjectInArray(updatedProject);
                    #ok("NPM Package " # package.name # " added successfully")
                };
            };
        };
    };

    public shared(msg) func removeNpmPackageFromProject(projectId: Text, packageName: Text) : async Result.Result<Text, Text> {
        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null #err("Project not found");
            case (?project) {
                switch (project.npmPackages) {
                    case null #err("No npm packages in project");
                    case (?packages) {
                        let updatedPackages = Array.filter<NPMPackageInfo>(
                            packages,
                            func(p: NPMPackageInfo) : Bool { p.name != packageName }
                        );

                        if (updatedPackages.size() == packages.size()) {
                            #err("Package not found in project");
                        } else {
                            let updatedProject = {
                                id = project.id;
                                name = project.name;
                                description = project.description;
                                projectType = project.projectType;
                                canisters = project.canisters;
                                motokoPackages = project.motokoPackages;
                                npmPackages = ?updatedPackages;
                                created = project.created;
                                updated = Prim.time();
                                visibility = project.visibility;
                                status = project.status;
                                collaborators = project.collaborators;
                                templateId = project.templateId;
                                workingCopyBaseVersion = project.workingCopyBaseVersion;
                                messages = project.messages;
                                metadata = project.metadata;
                                messageCount = project.messageCount;
                                lastMessageTime = project.lastMessageTime;
                                deployedAgents = project.deployedAgents;
                                hasBackendChanged = project.hasBackendChanged;
                                hasFrontendChanged = project.hasFrontendChanged;
                                lastBackendDeployment = project.lastBackendDeployment;
                                lastFrontendDeployment = project.lastFrontendDeployment;
                                lastDeploymentServerPairId = project.lastDeploymentServerPairId;
                            };

                            updateProjectInArray(updatedProject);
                            #ok("NPM Package removed successfully")
                        };
                    };
                };
            };
        };
    };


        // ===============================
    // ASSET/ARTIFACT MANAGEMENT
    // ===============================
    private func getArtifactManager() : codeArtifacts.CodeArtifactManager {
        switch (artifactManager) {
            case (?manager) { manager };
            case null {
                let manager = codeArtifacts.CodeArtifactManager(Principal.fromActor(Main), Principal.fromText(ASSET_CANISTER_ID));
                artifactManager := ?manager;
                manager
            };
        }
    };






    public shared(_msg) func readCodeArtifact(
        userPrincipal: Principal,
        projectId: Text,
        path: Text,
        fileName: Text,
        versionId: ?Text // Optional version parameter
    ) : async Result.Result<codeArtifacts.CodeArtifact, Text> {
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null #err("Project not found");
            case (?project) {
                // If version is specified, read from that version
                switch (versionId) {
                    case (null) {
                        // Read from regular artifacts (original behavior)
                        getArtifactManager().readArtifact(projectId, path, fileName)
                    };
                    case (?vid) {
                        // Read from version-specific artifacts
                        let versionManager = getVersionManager();
                        
                        // Get version artifacts
                        let artifactsResult = versionManager.getVersionArtifacts(vid);
                        
                        switch (artifactsResult) {
                            case (#ok(artifact)) {
                                // Find the specific file
                                let fileResult = Array.find<ArtifactFile>(
                                    artifact.files,
                                    func(file: ArtifactFile) : Bool {
                                        file.path == path and file.fileName == fileName
                                    }
                                );
                                
                                switch (fileResult) {
                                    case (?file) {
                                        // Convert to CodeArtifact format
                                        let content = switch (file.content) {
                                            case (#Text(text)) { #Text(text) };
                                            case (#Binary(bytes)) { #Binary(bytes) };
                                            case (#Reference(ref)) { 
                                                // In a real implementation, you'd dereference this
                                                #Text("Reference to: " # ref)
                                            };
                                        };
                                        
                                        #ok({
                                            id = projectId # "/" # file.path # "/" # file.fileName;
                                            projectId = projectId;
                                            fileName = file.fileName;
                                            content = switch (file.content) {
                                                case (#Text(text)) { ?#Text(text) }; // Add ? to make it optional
                                                case (#Binary(bytes)) { ?#Binary(bytes) }; // Add ? to make it optional
                                                case (#Reference(ref)) { ?#Text("Reference: " # ref) }; // Add ? to make it optional
                                            };
                                            mimeType = file.mimeType;
                                            language = file.language;
                                            path = file.path;
                                            lastModified = Nat64.toNat(file.lastModified);
                                            size = 0; // Add missing field
                                            version = 0; // Add missing field
                                            chunks = null; // Add missing field
                                        })
                                    };
                                    case (null) {
                                        #err("File not found in version artifacts")
                                    };
                                }
                            };
                            case (#err(error)) {
                                let errorMsg = switch (error) {
                                    case (#VersionNotFound) { "Version not found" };
                                    case (#ArtifactNotFound) { "No artifacts found for this version" };
                                    case (_) { "Error retrieving version artifacts" };
                                };
                                #err(errorMsg)
                            };
                        }
                    };
                }
            };
        }
    };


public shared(_msg) func createCodeArtifact(
    userPrincipal: Principal,
    projectId: Text,
    fileName: Text,
    content: codeArtifacts.FileContent,
    mimeType: Text,
    language: Text,
    path: Text,
    versionId: ?Text
) : async Result.Result<codeArtifacts.CodeArtifact, Text> {
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null #err("Project not found");
        case (?project) {
            try {
                // Normalize the path at the entry point
                let normalizedPath = PathUtils.normalizePath(path);
                
                // If versionId is null, this is a save to the working copy only
                if (versionId == null) {
                    // Create the normal artifact with normalized path
                    let artifactResult = getArtifactManager().createArtifact(
                        projectId,
                        fileName,
                        content,
                        mimeType,
                        language,
                        normalizedPath  // Use normalized path
                    );
                    
                    // Return the result - do NOT update the base version
                    return artifactResult;
                }
                // If we have a specific version ID, handle the versioned save
                else {
                    let vid = Option.unwrap(versionId); // Safe because we checked versionId != null above
                    
                    // Check if this is the working copy base version
                    let isWorkingCopyBase = switch (project.workingCopyBaseVersion) {
                        case (?baseVersion) { baseVersion == vid };
                        case (null) { false };
                    };
                    
                    // Prepare artifact file for version
                    let artifactFile : ArtifactFile = {
                        path = normalizedPath;
                        fileName = fileName;
                        mimeType = mimeType;
                        language = language;
                        content = switch (content) {
                            case (#Text(text)) { #Text(text) };
                            case (#Binary(bytes)) { #Binary(bytes) };
                        };
                        lastModified = Nat64.fromIntWrap(Time.now());
                    };
                    
                    // Get the version manager and update the version files
                    let versionManager = getVersionManager();
                    let artifactsResult = versionManager.getVersionArtifacts(vid);
                    
                    // Update the version's artifacts
                    switch (artifactsResult) {
                        case (#ok(existingArtifact)) {
                            // Filter out any existing file with the same path/name
                            let updatedFiles = Array.filter<ArtifactFile>(
                                existingArtifact.files,
                                func(file : ArtifactFile) : Bool {
                                    not (file.path == normalizedPath and file.fileName == fileName)
                                }
                            );
                            
                            // Add the new file
                            let newFiles = Array.append<ArtifactFile>(updatedFiles, [artifactFile]);
                            
                            // Update the version snapshot
                            let _ = versionManager.createArtifactSnapshot(vid, newFiles);
                            logger.info("Updated version " # vid # " with file " # normalizedPath # "/" # fileName);
                        };
                        case (#err(_)) {
                            // No existing artifacts, create new snapshot with just this file
                            let _ = versionManager.createArtifactSnapshot(vid, [artifactFile]);
                            logger.info("Created new snapshot in version " # vid);
                        };
                    };
                    
                    // Only update the working copy if this is the working copy base version
                    if (isWorkingCopyBase) {
                        logger.info("Updating working copy because version " # vid # " is the working copy base");
                        
                        // Save to the working copy also
                        let workingCopyResult = getArtifactManager().createArtifact(
                            projectId,
                            fileName,
                            content,
                            mimeType,
                            language,
                            normalizedPath
                        );
                        
                        // If working copy update fails, log it but continue
                        switch (workingCopyResult) {
                            case (#ok(_)) {
                                logger.info("Successfully updated working copy");
                            };
                            case (#err(e)) {
                                // Try update instead of create if creation failed
                                let updateResult = getArtifactManager().updateArtifact(
                                    projectId,
                                    fileName,
                                    content,
                                    mimeType,
                                    normalizedPath
                                );
                                
                                switch (updateResult) {
                                    case (#ok(_)) {
                                        logger.info("Successfully updated working copy (using update)");
                                    };
                                    case (#err(e2)) {
                                        logger.info("Error updating working copy: " # e2);
                                    };
                                };
                            };
                        };
                    } else {
                        logger.info("NOT updating working copy because version " # vid # " is not the working copy base");
                    };
                    
                    // Create an artifact result to return
                    // Since we might not have created a working copy artifact, create a dummy result
                    let dummyArtifact: codeArtifacts.CodeArtifact = {
                        id = projectId # ":" # normalizedPath # "/" # fileName;
                        projectId = projectId;
                        fileName = fileName;
                        mimeType = mimeType;
                        content = ?content;  // Make it optional with ?
                        language = language;
                        path = normalizedPath;
                        lastModified = Time.now();  // Convert to Int
                        size = 0;       // Add missing field
                        version = 0;    // Add missing field 
                        chunks = null;  // Add missing field
                    };
                    
                    #ok(dummyArtifact)
                };
            } catch (e) {
                #err("Error creating artifact: " # Error.message(e))
            }
        };
    }
};

public shared(_msg) func createMultipleCodeArtifacts(
    userPrincipal: Principal,
    projectId: Text,
    files: [FileData],
    versionId: ?Text
) : async Result.Result<[codeArtifacts.CodeArtifact], Text> {
    
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null { #err("Project not found") };
        case (?project) {
            let results = Buffer.Buffer<codeArtifacts.CodeArtifact>(files.size());
            
            // Process all files in a single canister call
            for (fileData in files.vals()) {
                let normalizedPath = normalizePath(fileData.path); // Use local function
                
                let artifactResult = getArtifactManager().createArtifact(
                    projectId,
                    fileData.fileName,
                    fileData.content,
                    fileData.mimeType,
                    fileData.language,
                    normalizedPath
                );
                
                switch (artifactResult) {
                    case (#ok(artifact)) {
                        results.add(artifact);
                    };
                    case (#err(e)) {
                        return #err("Failed to create " # fileData.fileName # ": " # e);
                    };
                };
            };
            
            #ok(Buffer.toArray(results))
        };
    }
};


public shared(_msg) func updateCodeArtifact(
    userPrincipal: Principal,
    projectId: Text,
    fileName: Text,
    content: codeArtifacts.FileContent,
    path: Text,
    versionId: ?Text
) : async Result.Result<codeArtifacts.CodeArtifact, Text> {
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null #err("Project not found");
        case (?project) {
            let mimeType = switch(content) {
                case (#Text(_)) "text/plain";
                case (#Binary(_)) "application/octet-stream";
            };
            
            // Normalize the path at the entry point
            let normalizedPath = PathUtils.normalizePath(path);
            
            // Handle the version-specific case first
            switch (versionId) {
                case (?vid) {
                    let versionManager = getVersionManager();
                    
                    // Verify the version exists and get it
                    let versionResult = versionManager.getVersion(vid);
                    
                    switch (versionResult) {
                        case (#err(error)) {
                            let errorMsg = switch (error) {
                                case (#VersionNotFound) { "Version not found" };
                                case (#InvalidVersion) { "Invalid version format" };
                                case (#ProjectNotFound) { "Project not found" };
                                case (#ArtifactNotFound) { "Artifact not found" };
                                case (#VersionExists) { "Version already exists for this project" };
                                case (#CanisterError) { "Canister error" };
                                case (#Unauthorized) { "Unauthorized" };
                                case (#Other(msg)) { msg };
                            };
                            return #err(errorMsg);
                        };
                        case (#ok(version)) {
                            // First try to get existing artifact to preserve language
                            var language = "";
                            
                            // Get existing version artifacts
                            let artifactsResult = versionManager.getVersionArtifacts(vid);
                            
                            switch (artifactsResult) {
                                case (#ok(artifact)) {
                                    // Try to find the existing file to get its language
                                    let existingFile = Array.find<ArtifactFile>(
                                        artifact.files,
                                        func(file: ArtifactFile) : Bool {
                                            file.path == normalizedPath and file.fileName == fileName
                                        }
                                    );
                                    
                                    switch (existingFile) {
                                        case (?file) {
                                            language := file.language;
                                        };
                                        case (null) {
                                            // If no existing file, try to detect from working copy
                                            let workingCopyResult = getArtifactManager().readArtifact(
                                                projectId, normalizedPath, fileName
                                            );
                                            
                                            switch (workingCopyResult) {
                                                case (#ok(artifact)) {
                                                    language := artifact.language;
                                                };
                                                case (#err(_)) {
                                                    // No language information available
                                                };
                                            };
                                        };
                                    };
                                    
                                    // Prepare the artifact file with updated content
                                    let artifactFile : ArtifactFile = {
                                        path = normalizedPath;
                                        fileName = fileName;
                                        mimeType = mimeType;
                                        language = language;
                                        content = switch (content) {
                                            case (#Text(text)) { #Text(text) };
                                            case (#Binary(bytes)) { #Binary(bytes) };
                                        };
                                        lastModified = Nat64.fromIntWrap(Time.now());
                                    };
                                    
                                    // Filter out existing file if any
                                    let filteredFiles = Array.filter<ArtifactFile>(
                                        artifact.files,
                                        func(file: ArtifactFile) : Bool {
                                            not (file.path == normalizedPath and file.fileName == fileName)
                                        }
                                    );
                                    
                                    // Add updated file
                                    let updatedFiles = Array.append<ArtifactFile>(
                                        filteredFiles, [artifactFile]
                                    );
                                    
                                    // Update version artifacts
                                    let _ = versionManager.createArtifactSnapshot(vid, updatedFiles);
                                    
                                    // Check if we should also update the working copy
                                    let isWorkingCopyBase = switch (project.workingCopyBaseVersion) {
                                        case (?baseVersion) { baseVersion == vid };
                                        case (null) { false };
                                    };
                                    
                                    // Check if this is the latest version
                                    let latestVersionResult = versionManager.getLatestVersion(projectId);
                                    let isLatestVersion = switch (latestVersionResult) {
                                        case (#ok(latest)) { latest.id == vid };
                                        case (#err(_)) { false };
                                    };
                                    
                                    if (isWorkingCopyBase or isLatestVersion) {
                                        // Also update the working copy
                                        let artifactResult = getArtifactManager().updateArtifact(
                                            projectId, 
                                            fileName, 
                                            content,
                                            mimeType,
                                            normalizedPath
                                        );
                                        
                                        switch (artifactResult) {
                                            case (#ok(updatedArtifact)) {
                                                logger.info("Updated both version " # vid # " and working copy");
                                                return #ok(updatedArtifact);
                                            };
                                            case (#err(e)) {
                                                logger.info("Updated version " # vid # " but failed to update working copy: " # e);
                                                // Return a constructed artifact anyway
                                                return #ok({
                                                    id = projectId # ":" # normalizedPath # "/" # fileName;
                                                    projectId = projectId;
                                                    fileName = fileName;
                                                    content = ?content;
                                                    mimeType = mimeType;
                                                    language = language;
                                                    path = normalizedPath;
                                                    lastModified = Time.now();
                                                    size = 0;
                                                    version = 0;
                                                    chunks = null;
                                                });
                                            };
                                        };
                                    } else {
                                        logger.info("Updated version " # vid # " only (not base or latest)");
                                        
                                        // Return a constructed artifact
                                        return #ok({
                                            id = projectId # ":" # normalizedPath # "/" # fileName;
                                            projectId = projectId;
                                            fileName = fileName;
                                            content = ?content;
                                            mimeType = mimeType;
                                            language = language;
                                            path = normalizedPath;
                                            lastModified = Time.now();
                                            size = 0;
                                            version = 0;
                                            chunks = null;
                                        });
                                    };
                                };
                                case (#err(_)) {
                                    // No existing artifacts, create new file
                                    let artifactFile : ArtifactFile = {
                                        path = normalizedPath;
                                        fileName = fileName;
                                        mimeType = mimeType;
                                        language = language;
                                        content = switch (content) {
                                            case (#Text(text)) { #Text(text) };
                                            case (#Binary(bytes)) { #Binary(bytes) };
                                        };
                                        lastModified = Nat64.fromIntWrap(Time.now());
                                    };
                                    
                                    // Create new snapshot with just this file
                                    let _ = versionManager.createArtifactSnapshot(vid, [artifactFile]);
                                    
                                    // Check if we should update the working copy too
                                    let isWorkingCopyBase = switch (project.workingCopyBaseVersion) {
                                        case (?baseVersion) { baseVersion == vid };
                                        case (null) { false };
                                    };
                                    
                                    // Check if this is the latest version
                                    let latestVersionResult = versionManager.getLatestVersion(projectId);
                                    let isLatestVersion = switch (latestVersionResult) {
                                        case (#ok(latest)) { latest.id == vid };
                                        case (#err(_)) { false };
                                    };
                                    
                                    if (isWorkingCopyBase or isLatestVersion) {
                                        let artifactResult = getArtifactManager().updateArtifact(
                                            projectId, 
                                            fileName, 
                                            content,
                                            mimeType,
                                            normalizedPath
                                        );
                                        
                                        return artifactResult;
                                    } else {
                                        // Return a constructed artifact
                                        return #ok({
                                            id = projectId # ":" # normalizedPath # "/" # fileName;
                                            projectId = projectId;
                                            fileName = fileName;
                                            content = ?content;
                                            mimeType = mimeType;
                                            language = language;
                                            path = normalizedPath;
                                            lastModified = Time.now();
                                            size = 0;
                                            version = 0;
                                            chunks = null;
                                        });
                                    };
                                };
                            };
                        };
                    };
                };
                case (null) {
                    // Regular update to working copy only
                    let result = getArtifactManager().updateArtifact(
                        projectId, 
                        fileName, 
                        content, 
                        mimeType, 
                        normalizedPath
                    );
                    
                    // Do NOT sync working copy changes to base version
                    return result;
                };
            }
        };
    }
};


public shared(_msg) func deleteCodeArtifact(
    userPrincipal: Principal,
    projectId: Text,
    path: Text,
    fileName: Text,
    versionId: ?Text
) : async Result.Result<Text, Text> {
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null #err("Project not found");
        case (?project) {
            // Normalize the path consistently
            let normalizedPath = PathUtils.normalizePath(path);
            
            // Handle the version-specific case first
            switch (versionId) {
                case (?vid) {
                    let versionManager = getVersionManager();
                    
                    // Verify the version exists and get it
                    let versionResult = versionManager.getVersion(vid);
                    
                    switch (versionResult) {
                        case (#err(error)) {
                            let errorMsg = switch (error) {
                                case (#VersionNotFound) { "Version not found" };
                                case (#InvalidVersion) { "Invalid version format" };
                                case (#ProjectNotFound) { "Project not found" };
                                case (#ArtifactNotFound) { "Artifact not found" };
                                case (#VersionExists) { "Version already exists for this project" };
                                case (#CanisterError) { "Canister error" };
                                case (#Unauthorized) { "Unauthorized" };
                                case (#Other(msg)) { msg };
                            };
                            return #err(errorMsg);
                        };
                        case (#ok(version)) {
                            // Get existing version artifacts
                            let artifactsResult = versionManager.getVersionArtifacts(vid);
                            
                            // Check if we should also update the working copy
                            let isWorkingCopyBase = switch (project.workingCopyBaseVersion) {
                                case (?baseVersion) { baseVersion == vid };
                                case (null) { false };
                            };
                            
                            // Check if this is the latest version
                            let latestVersionResult = versionManager.getLatestVersion(projectId);
                            let isLatestVersion = switch (latestVersionResult) {
                                case (#ok(latest)) { latest.id == vid };
                                case (#err(_)) { false };
                            };
                            
                            switch (artifactsResult) {
                                case (#ok(artifact)) {
                                    // Filter out the file to delete
                                    let updatedFiles = Array.filter<ArtifactFile>(
                                        artifact.files,
                                        func(file: ArtifactFile) : Bool {
                                            not (file.path == normalizedPath and file.fileName == fileName)
                                        }
                                    );
                                    
                                    let fileRemoved = updatedFiles.size() < artifact.files.size();
                                    
                                    if (fileRemoved) {
                                        // File was found and removed, update the snapshot
                                        let _ = versionManager.createArtifactSnapshot(vid, updatedFiles);
                                        
                                        // Also delete from working copy if needed
                                        if (isWorkingCopyBase or isLatestVersion) {
                                            let workingCopyResult = getArtifactManager().deleteArtifact(
                                                projectId, normalizedPath, fileName
                                            );
                                            
                                            switch (workingCopyResult) {
                                                case (#ok(_)) {
                                                    return #ok("File deleted from version " # vid # " and working copy");
                                                };
                                                case (#err(e)) {
                                                    return #ok("File deleted from version " # vid # 
                                                          " but failed to delete from working copy: " # e);
                                                };
                                            };
                                        } else {
                                            return #ok("File deleted from version " # vid);
                                        };
                                    } else {
                                        return #err("File not found in version " # vid);
                                    };
                                };
                                case (#err(_)) {
                                    return #err("No artifact snapshot found for version " # vid);
                                };
                            };
                        };
                    };
                };
                case (null) {
                    // Delete from working copy only
                    let result = getArtifactManager().deleteArtifact(projectId, normalizedPath, fileName);
                    
                    // Do NOT sync deletions to base version
                    return result;
                };
            }
        };
    }
};


public func migratePathsToStandard() : async () {
    // 1. Migrate regular artifacts
    let artifactManager = getArtifactManager();
    let (artifactEntries, _, _) = artifactManager.getState();
    
    for ((id, artifact) in artifactEntries.vals()) {
        let normalizedPath = PathUtils.normalizePath(artifact.path);
        
        if (normalizedPath != artifact.path) {
            // Create new artifact with normalized path
            let newArtifactId = artifact.projectId # ":" # normalizedPath # "/" # artifact.fileName;
            
            // Delete the old artifact and properly handle the result
            let deleteResult = artifactManager.deleteArtifact(artifact.projectId, artifact.path, artifact.fileName);
            
            // Only proceed with creation if deletion succeeded or there was nothing to delete
            switch (deleteResult) {
                case (#ok(_)) {
                    // Create new artifact with normalized path
                    let _ = artifactManager.createArtifact(
                        artifact.projectId,
                        artifact.fileName,
                        Option.get(artifact.content, #Text("")),
                        artifact.mimeType,
                        artifact.language,
                        normalizedPath
                    );
                };
                case (#err(e)) {
                    // You might want to log the error or handle it differently
                    // For now, we'll try to create anyway
                    let _ = artifactManager.createArtifact(
                        artifact.projectId,
                        artifact.fileName,
                        Option.get(artifact.content, #Text("")),
                        artifact.mimeType,
                        artifact.language,
                        normalizedPath
                    );
                };
            };
        };
    };
    
    // 2. Migrate version artifacts
    let versionManager = getVersionManager();
    let (_, versionArtifactEntries, _) = versionManager.getState();
    
    for ((id, versionArtifact) in versionArtifactEntries.vals()) {
        let updatedFiles = Array.map<ArtifactFile, ArtifactFile>(
            versionArtifact.files,
            func(file: ArtifactFile) : ArtifactFile {
                let normalizedPath = PathUtils.normalizePath(file.path);
                if (normalizedPath != file.path) {
                    {
                        file with
                        path = normalizedPath;
                    }
                } else {
                    file
                }
            }
        );
        
        // Create new snapshot with normalized paths
        let _ = versionManager.createArtifactSnapshot(
            versionArtifact.versionId,
            updatedFiles
        );
    };
};


public shared(msg) func getProjectFiles(
    userPrincipal: Principal,
    projectId: Text,
    versionId: ?Text // Optional parameter with default value null
) : async Result.Result<[codeArtifacts.CodeArtifact], Text> {
    logger.info("Request to access project files:");
    logger.info("- Project ID: " # projectId);
    logger.info("- User: " # Principal.toText(msg.caller));
    
    // Check if project exists
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null {
            logger.info("❌ Project not found: " # projectId);
            return #err("Project not found")
        };
        case (?project) {
            logger.info("Project found: " # project.name);
            
            // Check if user is a controller - controllers get full access
            let isController = await isCanisterController(msg.caller);
            if (isController) {
                logger.info("✅ Access granted: User is a canister controller");
                
                // Handle version-specific request if versionId is provided
                switch (versionId) {
                    case null {
                        // Original behavior - get current files
                        return #ok(getArtifactManager().getProjectArtifacts(projectId));
                    };
                    case (?vid) {
                        // Get version-specific files
                        logger.info("Getting files for version: " # vid);
                        let manager = getVersionManager();
                        let result = manager.getVersionArtifacts(vid);
                        
                        switch (result) {
                            case (#ok(artifact)) {
                                // Convert version artifacts to code artifacts format
                                let artifactResults = Array.map<ArtifactFile, codeArtifacts.CodeArtifact>(
                                    artifact.files,
                                    func(file: ArtifactFile) : codeArtifacts.CodeArtifact {
                                        // Check if file content is chunked or inline
                                        let (fileContent, fileChunks, fileSize) = switch (file.content) {
                                            case (#Text(text)) { 
                                                (?#Text(text), null, text.size())
                                            };
                                            case (#Binary(bytes)) { 
                                                (?#Binary(bytes), null, bytes.size())
                                            };
                                            case (#Reference(ref)) { 
                                                (?#Text("Reference to: " # ref), null, 0)
                                            };
                                            case (#ChunkReference(chunkList)) {
                                                // File is chunked - return chunk IDs, no inline content
                                                let totalSize = Array.foldLeft<(Nat, Nat), Nat>(
                                                    chunkList,
                                                    0,
                                                    func(acc: Nat, chunk: (Nat, Nat)) : Nat {
                                                        acc + chunk.1
                                                    }
                                                );
                                                (null, ?chunkList, totalSize)
                                            };
                                        };

                                        // Normalize the path when constructing the ID
                                        let normalizedPath = normalizePath(file.path);
                                        
                                        {
                                            id = projectId # ":" # normalizedPath # "/" # file.fileName;
                                            projectId = projectId;
                                            fileName = file.fileName;
                                            content = fileContent;  // null if chunked
                                            chunks = fileChunks;    // chunk IDs if chunked
                                            mimeType = file.mimeType;
                                            language = file.language;
                                            path = file.path;
                                            lastModified = Time.now();  // Convert to Int
                                            size = fileSize;       // Actual file size
                                            version = 0;    // Add missing field 
                                        }
                                    }
                                );
                                return #ok(artifactResults)
                            };
                            case (#err(error)) {
                                let errorMsg = switch (error) {
                                    case (#VersionNotFound) { "Version not found" };
                                    case (#ArtifactNotFound) { "No artifacts found for this version" };
                                    case (_) { "Error retrieving version artifacts" };
                                };
                                logger.info("❌ " # errorMsg);
                                return #err(errorMsg)
                            };
                        }
                    };
                }
            };
            
            // Not authorized
            logger.info("❌ Access denied: User is not authorized for this project");
            #err("You don't have permission to access this project")
        };
    }
};


// Check if a principal is a controller of the current canister
public func isCanisterController(caller: Principal) : async Bool {
    let thisCanisterId = Principal.fromText(canisterPrincipal);
    
    try {
        let canisterStatus = await IC.canister_status({
            canister_id = thisCanisterId
        });
        
        // Check if caller is in the controllers list
        return Array.find<Principal>(
            canisterStatus.settings.controllers,
            func(p) { Principal.equal(p, caller) }
        ) != null;
    } catch (e) {
        logger.info("Error checking controller status: " # Error.message(e));
        return false;
    };
};


public shared(_msg) func getProjectFileTree(
    userPrincipal: Principal,
    projectId: Text,
    versionId: ?Text // Optional version parameter
) : async Result.Result<codeArtifacts.FileTreeNode, Text> {
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null #err("Project not found");
        case (?project) {
            // If no version specified, use regular file tree
            if (versionId == null) {
                switch(getArtifactManager().getProjectFileTree(projectId)) {
                    case (?tree) #ok(tree);
                    case null #err("File tree not found");
                }
            } else {
                // Get file tree for specific version
                let vid = Option.get(versionId, "");
                let versionManager = getVersionManager();
                
                // Get version artifacts
                let artifactsResult = versionManager.getVersionArtifacts(vid);
                
                switch (artifactsResult) {
                    case (#ok(artifact)) {
                        // Build file tree from version artifacts
                        let fileTree = buildFileTreeFromArtifacts(artifact.files);
                        #ok(fileTree)
                    };
                    case (#err(error)) {
                        let errorMsg = switch (error) {
                            case (#VersionNotFound) { "Version not found" };
                            case (#ArtifactNotFound) { "No artifacts found for this version" };
                            case (_) { "Error retrieving version artifacts" };
                        };
                        #err(errorMsg)
                    };
                }
            }
        };
    }
};

// Helper function to build a file tree from artifact files
private func buildFileTreeFromArtifacts(files: [ArtifactFile]) : codeArtifacts.FileTreeNode {
    // Create a map to store directories by path
    var dirMap = HashMap.HashMap<Text, codeArtifacts.FileTreeNode>(32, Text.equal, Text.hash);
    
    // Root node
    let rootNode : codeArtifacts.FileTreeNode = {
        name = "root";
        path = "/";
        isDirectory = true;
        children = ?[];
    };
    
    dirMap.put("/", rootNode);
    
    // First pass: ensure all directories exist
    for (file in files.vals()) {
        // Parse the path to extract directories
        let fullPath = file.path;
        let pathParts = Text.split(fullPath, #char('/'));
        let pathPartsArray = Iter.toArray(pathParts);
        
        var currentPath = "/";
        
        // Create all directories in the path
        for (i in Iter.range(0, pathPartsArray.size() - 1)) {
            if (pathPartsArray[i] != "") {
                // Only process non-empty path segments
                let dirName = pathPartsArray[i];
                let nextPath = if (currentPath == "/") {
                    "/" # dirName;
                } else {
                    currentPath # "/" # dirName;
                };
                    
                // Create directory if it doesn't exist
                if (Option.isNull(dirMap.get(nextPath))) {
                    let newDir : codeArtifacts.FileTreeNode = {
                        name = dirName;
                        path = nextPath;
                        isDirectory = true;
                        children = ?[];
                    };
                    dirMap.put(nextPath, newDir);
                    
                    // Add to parent directory
                    switch (dirMap.get(currentPath)) {
                        case (?parentDir) {
                            let updatedChildren = switch (parentDir.children) {
                                case (?existing) { Array.append(existing, [newDir]) };
                                case (null) { [newDir] };
                            };
                            
                            let updatedParent : codeArtifacts.FileTreeNode = {
                                name = parentDir.name;
                                path = parentDir.path;
                                isDirectory = true;
                                children = ?updatedChildren;
                            };
                            
                            dirMap.put(currentPath, updatedParent);
                        };
                        case (null) {
                            // This shouldn't happen as we're building the path incrementally
                            Debug.print("Error: Parent directory not found: " # currentPath);
                        };
                    };
                };
                
                currentPath := nextPath;
            };
        }; // Properly close the inner for loop
        
        // Create file node
        let fileNode : codeArtifacts.FileTreeNode = {
            name = file.fileName;
            path = if (fullPath == "/" or fullPath == "") {
                "/" # file.fileName;
            } else {
                fullPath # "/" # file.fileName;
            };
            isDirectory = false;
            children = null;
        };
        
        // Add file to its parent directory
        let parentDirPath = if (fullPath == "" or fullPath == "/") {
            "/";
        } else {
            fullPath;
        };
        
        switch (dirMap.get(parentDirPath)) {
            case (?parentDir) {
                let updatedChildren = switch (parentDir.children) {
                    case (?existing) { Array.append(existing, [fileNode]) };
                    case (null) { [fileNode] };
                };
                
                let updatedParent : codeArtifacts.FileTreeNode = {
                    name = parentDir.name;
                    path = parentDir.path;
                    isDirectory = true;
                    children = ?updatedChildren;
                };
                
                dirMap.put(parentDirPath, updatedParent);
            };
            case (null) {
                // If the parent directory doesn't exist (e.g., files at root level)
                // Add to root directory
                switch (dirMap.get("/")) {
                    case (?rootDir) {
                        let updatedChildren = switch (rootDir.children) {
                            case (?existing) { Array.append(existing, [fileNode]) };
                            case (null) { [fileNode] };
                        };
                        
                        let updatedRoot : codeArtifacts.FileTreeNode = {
                            name = rootDir.name;
                            path = rootDir.path;
                            isDirectory = true;
                            children = ?updatedChildren;
                        };
                        
                        dirMap.put("/", updatedRoot);
                    };
                    case (null) {
                        // This shouldn't happen as we initialize the root
                        Debug.print("Error: Root directory not found");
                    };
                };
            };
        };
    }; // Properly close the outer for loop
    
    // Return the root node with the complete tree
    switch (dirMap.get("/")) {
        case (?root) { root };
        case (null) {
            // Fallback in case something went wrong
            {
                name = "root";
                path = "/";
                isDirectory = true;
                children = null;
            }
        };
    }
};

   


    public func getChunk(chunkId: codeArtifacts.ChunkId) : async ?codeArtifacts.Chunk {
        getArtifactManager().getChunk(chunkId)
    };

    // ===============================
    // 🚀 PERFORMANCE OPTIMIZATION: BATCH CHUNK RETRIEVAL
    // ===============================
    
    // Retrieve multiple chunks in a single call (5-10× faster than sequential getChunk calls)
    public func getChunksBatch(chunkIds: [Nat]) : async [(Nat, ?codeArtifacts.Chunk)] {
        logger.info("🚀 [PERF] Batch chunk retrieval requested for " # Nat.toText(chunkIds.size()) # " chunks");
        
        let results = Array.map<Nat, (Nat, ?codeArtifacts.Chunk)>(
            chunkIds,
            func(id: Nat) : (Nat, ?codeArtifacts.Chunk) {
                let chunk = getArtifactManager().getChunk(id);
                (id, chunk)
            }
        );
        
        // Log success count
        let successCount = Array.foldLeft<(Nat, ?codeArtifacts.Chunk), Nat>(
            results,
            0,
            func(acc: Nat, item: (Nat, ?codeArtifacts.Chunk)) : Nat {
                switch (item.1) {
                    case (?_) { acc + 1 };
                    case (null) { acc };
                }
            }
        );
        
        logger.info("🚀 [PERF] Batch retrieval complete: " # Nat.toText(successCount) # "/" # Nat.toText(chunkIds.size()) # " chunks found");
        
        results
    };

    // ===============================
    // 🚀 PERFORMANCE OPTIMIZATION: FILE METADATA API
    // ===============================
    
    // Get file metadata without content (faster initial load, smaller response)
    public shared(msg) func getProjectFileMetadata(
        userPrincipal: Principal,
        projectId: Text,
        versionId: ?Text
    ) : async Result.Result<[codeArtifacts.FileMetadata], Text> {
        logger.info("🚀 [PERF] Metadata request for project: " # projectId);
        
        // Check if project exists
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case (null) {
                logger.info("❌ Project not found: " # projectId);
                return #err("Project not found")
            };
            case (?project) {
                // Check if user is a controller
                let isController = await isCanisterController(msg.caller);
                if (not isController) {
                    logger.info("❌ Access denied: User is not a canister controller");
                    return #err("You don't have permission to access this project")
                };
                
                // Handle version-specific request
                switch (versionId) {
                    case (null) {
                        // Return metadata for current files
                        let metadata = getArtifactManager().getProjectMetadata(projectId);
                        logger.info("🚀 [PERF] Returned metadata for " # Nat.toText(metadata.size()) # " files");
                        return #ok(metadata)
                    };
                    case (?vid) {
                        // Get version-specific metadata
                        logger.info("Getting metadata for version: " # vid);
                        let manager = getVersionManager();
                        let result = manager.getVersionArtifacts(vid);
                        
                        switch (result) {
                            case (#ok(artifact)) {
                                // Convert version artifacts to metadata
                                let metadata = Array.map<ArtifactFile, codeArtifacts.FileMetadata>(
                                    artifact.files,
                                    func(file: ArtifactFile) : codeArtifacts.FileMetadata {
                                        let normalizedPath = normalizePath(file.path);
                                        let (fileSize, isChunked, chunkCount) = switch (file.content) {
                                            case (#Text(text)) { (text.size(), false, null) };
                                            case (#Binary(bytes)) { (bytes.size(), false, null) };
                                            case (#Reference(_)) { (0, false, null) };
                                            case (#ChunkReference(chunkList)) {
                                                let totalSize = Array.foldLeft<(Nat, Nat), Nat>(
                                                    chunkList,
                                                    0,
                                                    func(acc: Nat, chunk: (Nat, Nat)) : Nat {
                                                        acc + chunk.1
                                                    }
                                                );
                                                (totalSize, true, ?chunkList.size())
                                            };
                                        };
                                        
                                        {
                                            id = projectId # ":" # normalizedPath # "/" # file.fileName;
                                            projectId = projectId;
                                            fileName = file.fileName;
                                            mimeType = file.mimeType;
                                            language = file.language;
                                            path = file.path;
                                            lastModified = Nat64.toNat(file.lastModified);
                                            version = 0;
                                            size = fileSize;
                                            isChunked = isChunked;
                                            chunkCount = chunkCount;
                                        }
                                    }
                                );
                                logger.info("🚀 [PERF] Returned version metadata for " # Nat.toText(metadata.size()) # " files");
                                return #ok(metadata)
                            };
                            case (#err(error)) {
                                let errorMsg = switch (error) {
                                    case (#VersionNotFound) { "Version not found" };
                                    case (#ArtifactNotFound) { "No artifacts found for this version" };
                                    case (_) { "Error retrieving version artifacts" };
                                };
                                logger.info("❌ " # errorMsg);
                                return #err(errorMsg)
                            };
                        }
                    };
                }
            };
        }
    };


    private func isAssetOrFrontendCanister(canisterId: Principal) : Bool {
        for ((id, metadata) in userCanisterMetadata.vals()) {
            if (Principal.equal(id, canisterId)) {
                let canisterType = metadata.canisterType;
                return canisterType == "asset" or canisterType == "frontend";
            };
        };
        false
    };


    public func getUserStateMetadata() : async metadata.Metadata {
        // Get the canister's own ID directly
        let thisCanisterId = Principal.fromActor(Main);
        
        try {
            let canisterStatus = await IC.canister_status({
                canister_id = thisCanisterId
            });

            return {
                totalKeys = transientState.size();
                totalUsers = 0;
                memoryUsage = Nat64.fromNat(Prim.rts_memory_size());
                cycleBalance = Nat64.fromNat(Prim.cyclesBalance());
                stableMemoryUsage = Nat64.toNat(Region.size(regionData));
                heapMemoryUsage = Nat64.fromNat(Prim.rts_heap_size());
                stableStateSize = state.size() + 0;
                uptime = Prim.time() - startTime;
                version = "1.0";
                lastUpdated = lastUpdated;
                // These lines might cause precision issues
                balance = canisterStatus.cycles; // Be careful with this conversion
                memorySize = canisterStatus.memory_size; // Be careful with this conversion
                idleCyclesBurnedPerDay = canisterStatus.idle_cycles_burned_per_day; // Be careful with this conversion
                moduleHash = canisterStatus.module_hash;
            };
        } catch (err) {
            // Return default values if the canister_status call fails
            return {
                totalKeys = transientState.size();
                totalUsers = 0;
                memoryUsage = Nat64.fromNat(Prim.rts_memory_size());
                cycleBalance = Nat64.fromNat(Prim.cyclesBalance());
                stableMemoryUsage = Nat64.toNat(Region.size(regionData));
                heapMemoryUsage = Nat64.fromNat(Prim.rts_heap_size());
                stableStateSize = state.size() + 0;
                uptime = Prim.time() - startTime;
                version = "1.0";
                lastUpdated = lastUpdated;
                balance = 0; // Default value
                memorySize = 0; // Default value
                idleCyclesBurnedPerDay = 0; // Default value
                moduleHash = null;
            };
        };
    };


    // ===============================
    // ACCOUNT MANAGEMENT
    // ===============================

    
    private var accountManager : ?Account.AccountManager = null;

    // Helper to get or initialize the account manager
    private func getAccountManager() : Account.AccountManager {
        switch (accountManager) {
            case (?manager) { manager };
            case null {
                let manager = Account.AccountManager(
                    Principal.fromActor(Main),  // Owner principal
                    Principal.fromActor(Main)   // Canister ID
                );
                accountManager := ?manager;
                manager
            };
        }
    };

    public shared(msg) func updateUserReputation(newReputation: Nat) : async Result.Result<(), Text> {
        logger.info("Updating user reputation for: " # Principal.toText(msg.caller));
        logger.info("New reputation value: " # Nat.toText(newReputation));
        
        // Check if the caller is the marketplace canister
        if (not isMarketplaceCanister(msg.caller)) {
            logger.info("❌ Updating user reputation failed: Caller is not a marketplace canister");
            return #err("Only the marketplace canister can update user reputation");
        };
        
        try {
            await getAccountManager().setUserReputation(newReputation)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Updating user reputation failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Initialize user account - sets up both user profile and account
    public shared(msg) func initializeUserAccount(profile: AccountTypes.UserProfile) : async Result.Result<AccountTypes.User, Text> {
        logger.info("Initializing user account for: " # Principal.toText(msg.caller));
        
        let manager = getAccountManager();
        
        try {
            let initResult = await manager.initializeUser(profile);
            
            switch (initResult) {
                case (#ok(user)) {
                    logger.info("✅ User account initialized successfully: " # user.profile.username);
                    
                    // Initialize default subscription for new users
                    let _ = await initializeDefaultSubscription();
                    
                    #ok(user)
                };
                case (#err(e)) {
                    logger.info("❌ User account initialization failed: " # e);
                    #err(e)
                };
            }
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ User account initialization failed with error: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Get user information
    public query(msg) func getUserAccountInfo() : async ?AccountTypes.User {
        logger.info("Getting user account info for: " # Principal.toText(msg.caller));
        getAccountManager().getUserInfo()
    };

    // Get account details
    public query(msg) func getAccountDetails() : async ?AccountTypes.Account {
        logger.info("Getting account details for: " # Principal.toText(msg.caller));
        getAccountManager().getAccountInfo()
    };

    // Update user profile
    public shared(msg) func updateUserProfile(profile: AccountTypes.UserProfile) : async Result.Result<AccountTypes.User, Text> {
        logger.info("Updating user profile for: " # Principal.toText(msg.caller));
        try {
            await getAccountManager().updateUserProfile(profile)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ User profile update failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Update user preferences
    public shared(msg) func updateUserPreferences(preferences: AccountTypes.UserPreferences) : async Result.Result<AccountTypes.User, Text> {
        logger.info("Updating user preferences for: " # Principal.toText(msg.caller));
        try {
            await getAccountManager().updateUserPreferences(preferences)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ User preferences update failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Update account preferences
    public shared(msg) func updateAccountPreferences(preferences: AccountTypes.AccountPreferences) : async Result.Result<AccountTypes.Account, Text> {
        logger.info("Updating account preferences for: " # Principal.toText(msg.caller));
        try {
            await getAccountManager().updateAccountPreferences(preferences)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Account preferences update failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Update notification preferences
    public shared(msg) func updateNotificationPreferences(preferences: AccountTypes.NotificationPreferences) : async Result.Result<(), Text> {
        logger.info("Updating notification preferences for: " # Principal.toText(msg.caller));
        try {
            await getAccountManager().updateNotificationPreferences(preferences)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Notification preferences update failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Link an account
    public shared(msg) func linkAccount(accountId: Principal) : async Result.Result<(), Text> {
        logger.info("Linking account for: " # Principal.toText(msg.caller));
        logger.info("Account to link: " # Principal.toText(accountId));
        try {
            await getAccountManager().linkAccount(accountId)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Account linking failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Unlink an account
    public shared(msg) func unlinkAccount(accountId: Principal) : async Result.Result<(), Text> {
        logger.info("Unlinking account for: " # Principal.toText(msg.caller));
        logger.info("Account to unlink: " # Principal.toText(accountId));
        try {
            await getAccountManager().unlinkAccount(accountId)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Account unlinking failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Set primary account
    public shared(msg) func setPrimaryAccount(accountId: Principal) : async Result.Result<(), Text> {
        logger.info("Setting primary account for: " # Principal.toText(msg.caller));
        logger.info("New primary account: " # Principal.toText(accountId));
        try {
            await getAccountManager().setPrimaryAccount(accountId)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Setting primary account failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Get linked accounts
    public query(msg) func getLinkedAccounts() : async [Principal] {
        logger.info("Getting linked accounts for: " # Principal.toText(msg.caller));
        getAccountManager().getLinkedAccounts()
    };

    // Get external services configuration
    public query(msg) func getExternalServices() : async ?AccountTypes.ExternalServiceTokens {
        logger.info("Getting external services for: " # Principal.toText(msg.caller));
        getAccountManager().getExternalServices()
    };

    // Add external service
    public shared(msg) func addExternalService(serviceType: Text, config: [(Text, Text)]) : async Result.Result<(), Text> {
        logger.info("Adding external service for: " # Principal.toText(msg.caller));
        logger.info("Service type: " # serviceType);
        try {
            await getAccountManager().addExternalService(serviceType, config)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Adding external service failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Remove external service
    public shared(msg) func removeExternalService(serviceType: Text) : async Result.Result<(), Text> {
        logger.info("Removing external service for: " # Principal.toText(msg.caller));
        logger.info("Service type: " # serviceType);
        try {
            await getAccountManager().removeExternalService(serviceType)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Removing external service failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Update GitHub repositories
    public shared(msg) func updateGitHubRepositories(repositories: [Text]) : async Result.Result<(), Text> {
        logger.info("Updating GitHub repositories for: " # Principal.toText(msg.caller));
        logger.info("Repositories count: " # Nat.toText(repositories.size()));
        try {
            await getAccountManager().updateGitHubRepositories(repositories)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Updating GitHub repositories failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Add GitHub webhook
    public shared(msg) func addGitHubWebhook(url: Text, secret: Text, events: [Text]) : async Result.Result<Text, Text> {
        logger.info("Adding GitHub webhook for: " # Principal.toText(msg.caller));
        logger.info("Webhook URL: " # url);
        logger.info("Events count: " # Nat.toText(events.size()));
        try {
            await getAccountManager().addGitHubWebhook(url, secret, events)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Adding GitHub webhook failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Update account type
    public shared(msg) func updateAccountType(accountType: AccountTypes.AccountType) : async Result.Result<(), Text> {
        logger.info("Updating account type for: " # Principal.toText(msg.caller));
        let typeText = switch (accountType) {
            case (#Basic) "Basic";
            case (#Premium) "Premium";
            case (#Enterprise) "Enterprise";
            case (#Custom(text)) "Custom: " # text;
        };
        logger.info("New account type: " # typeText);
        try {
            await getAccountManager().updateAccountType(accountType)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Updating account type failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Update canister settings
    public shared(msg) func updateAccountCanisterSettings(settings: AccountTypes.CanisterSettings) : async Result.Result<(), Text> {
        logger.info("Updating canister settings for: " # Principal.toText(msg.caller));
        logger.info("Canister name: " # settings.name);
        try {
            await getAccountManager().updateCanisterSettings(settings)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Updating canister settings failed: " # errorMsg);
            #err(errorMsg)
        }
    };


    // Add a project to account resources
    public shared(msg) func addProjectToAccount(id: Text, name: Text, visibility: AccountTypes.Visibility) : async Result.Result<(), Text> {
        logger.info("Adding project to account for: " # Principal.toText(msg.caller));
        logger.info("Project: " # name # " (" # id # ")");
        try {
            await getAccountManager().addProject(id, name, visibility)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Adding project to account failed: " # errorMsg);
            #err(errorMsg)
        }
    };


    // For the Main actor
    public shared(msg) func getAccountIdByUsername(username: Text) : async Result.Result<Principal, Text> {
        logger.info("Looking up account owner for username: " # username);
        
        // Get the account manager
        let accountMgr = getAccountManager();
        
        // Get current user - note these are query functions, no await needed
        switch (accountMgr.getUserInfo()) {
            case (?user) {
                // Check if this user has the username we're looking for
                if (Text.equal(user.profile.username, username)) {
                    // Get the account to retrieve the owner
                    switch (accountMgr.getAccountInfo()) {
                        case (?account) {
                            logger.info("✅ Found owner for username: " # Principal.toText(account.id));
                            return #ok(account.id);
                        };
                        case (null) {
                            logger.info("❌ Account not initialized for username: " # username);
                            return #err("Account not initialized for username: " # username);
                        };
                    };
                } else {
                    logger.info("❌ Username does not match current user: " # username);
                    return #err("Username does not match current user: " # username);
                };
            };
            case (null) {
                logger.info("❌ User not found for username: " # username);
                return #err("User not found for username: " # username);
            };
        };
    };



    // Update project in account resources
    public shared(msg) func updateAccountProject(id: Text, name: Text, visibility: AccountTypes.Visibility) : async Result.Result<(), Text> {
        logger.info("Updating project in account for: " # Principal.toText(msg.caller));
        logger.info("Project: " # name # " (" # id # ")");
        try {
            await getAccountManager().updateProject(id, name, visibility)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Updating project in account failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Delete project from account resources
    public shared(msg) func deleteProjectFromAccount(id: Text) : async Result.Result<(), Text> {
        logger.info("Deleting project from account for: " # Principal.toText(msg.caller));
        logger.info("Project ID: " # id);
        try {
            await getAccountManager().deleteProject(id)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Deleting project from account failed: " # errorMsg);
            #err(errorMsg)
        }
    };


    // Add a deployment to resources
    public shared(msg) func addDeploymentToAccount(
        id: Text, 
        name: Text, 
        projectId: Text, 
        canisterId: ?Principal, 
        status: Text, 
        network: Text
    ) : async Result.Result<(), Text> {
        logger.info("Adding deployment to account for: " # Principal.toText(msg.caller));
        logger.info("Deployment: " # name # " (" # id # ")");
        try {
            await getAccountManager().addDeployment(id, name, projectId, canisterId, status, network)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Adding deployment to account failed: " # errorMsg);
            #err(errorMsg)
        }
    };



public shared(msg) func deleteDeployment(
    deploymentId: Text,
    versionId: ?Text  // Optional version ID if this is a version-specific deployment
) : async Result.Result<Text, Text> {
    logger.info("Deleting deployment:");
    logger.info("- Deployment ID: " # deploymentId);
    
    switch (versionId) {
        case (?vid) {
            // CASE: Delete from a version's deployments
            logger.info("- Version ID: " # vid);
            try {
                let versionManager = getVersionManager();
                
                // Use the method from VersionManager to handle the deletion
                let result = versionManager.deleteDeploymentFromVersion(vid, deploymentId);
                
                switch (result) {
                    case (#ok(_)) {
                        logger.info("✅ Successfully deleted deployment from version " # vid);
                        return #ok("Deployment successfully deleted from version");
                    };
                    case (#err(error)) {
                        let errorMsg = switch (error) {
                            case (#VersionNotFound) { "Version not found" };
                            case (#InvalidVersion) { "Invalid version format" };
                            case (#ProjectNotFound) { "Project not found" };
                            case (#ArtifactNotFound) { "Deployment not found in version" };
                            case (#VersionExists) { "Version already exists for this project" };
                            case (#CanisterError) { "Canister error" };
                            case (#Unauthorized) { "Unauthorized" };
                            case (#Other(msg)) { msg };
                        };
                        logger.info("❌ Failed to delete deployment from version: " # errorMsg);
                        return #err(errorMsg);
                    };
                };
            } catch (e) {
                let errorMsg = Error.message(e);
                logger.info("❌ Exception while deleting version deployment: " # errorMsg);
                return #err(errorMsg);
            };
        };
        case (null) {
            // CASE: Delete from account resources
            logger.info("- No version ID provided, deleting from account deployments");
            try {
                let accountManager = getAccountManager();
                
                // Account might be initialized but we need to check if it has the deployment
                switch (accountManager.getAccountInfo()) {
                    case (null) {
                        return #err("Account not initialized");
                    };
                    case (?account) {
                        // Check if we have any deployments
                        if (account.resources.deployments.size() == 0) {
                            return #err("No deployments found in account");
                        };
                        
                        // Create a function to delete the deployment from account
                        let result = await accountManager.deleteDeployment(deploymentId);
                        
                        switch (result) {
                            case (#ok(_)) {
                                logger.info("✅ Successfully deleted deployment from account");
                                return #ok("Deployment successfully deleted from account");
                            };
                            case (#err(e)) {
                                logger.info("❌ Failed to delete deployment from account: " # e);
                                return #err(e);
                            };
                        };
                    };
                };
            } catch (error) {
                let errorMsg = Error.message(error);
                logger.info("❌ Exception while deleting account deployment: " # errorMsg);
                return #err(errorMsg);
            };
        };
    };
};

// Helper function to delete deployment from account
private func deleteDeploymentFromAccount(
    deploymentId: Text
) : async Result.Result<(), Text> {
    let accountManager = getAccountManager();
    
    switch (accountManager.getAccountInfo()) {
        case (null) {
            #err("Account not initialized")
        };
        case (?account) {
            // Find the deployment to get its details for logging
            var deploymentName = "Unknown";
            var deploymentProject = "Unknown";
            
            for (dep in account.resources.deployments.vals()) {
                if (dep.id == deploymentId) {
                    deploymentName := dep.name;
                    deploymentProject := dep.projectId;
                };
            };
            
            // Filter out the deployment to delete
            let updatedDeployments = Array.filter<DeploymentReference>(
                account.resources.deployments,
                func(d: DeploymentReference) : Bool { d.id != deploymentId }
            );
            
            if (updatedDeployments.size() == account.resources.deployments.size()) {
                return #err("Deployment not found in account");
            };
            
            try {
                // Call the AccountManager method, but convert the Result<(), Text> to Result.Result<(), Text>
                let result = await accountManager.deleteDeployment(deploymentId);
                
                // Convert the type
                switch (result) {
                    case (#ok(_)) { #ok(()) };
                    case (#err(e)) { #err(e) };
                }
            } catch (e) {
                #err(Error.message(e))
            }
        };
    }
};



// Original function for backward compatibility
public shared(msg) func updateDeploymentStatus(id: Text, status: Text) : async Result.Result<(), Text> {
    logger.info("Updating deployment status for: " # Principal.toText(msg.caller));
    logger.info("Deployment ID: " # id);
    logger.info("New status: " # status);
    
    // Simply update the account deployment record (original behavior)
    try {
        await getAccountManager().updateDeploymentStatus(id, status)
    } catch (error) {
        let errorMsg = Error.message(error);
        logger.info("❌ Updating deployment status failed: " # errorMsg);
        #err(errorMsg)
    }
};

// New function with version support
public shared(msg) func updateDeploymentStatusWithVersion(
    id: Text, 
    status: Text,
    versionId: ?Text
) : async Result.Result<(), Text> {
    logger.info("Updating deployment status:");
    logger.info("- Deployment ID: " # id);
    logger.info("- New status: " # status);
    
    switch (versionId) {
        case (?vid) {
            // CASE: VALID VERSION ID PASSED IN
            logger.info("- Version ID: " # vid);
            try {
                // Use the versionManager's updateDeploymentStatus method
                let versionManager = getVersionManager();
                
                // This calls the method that exists in the VersionManager module
                let result = versionManager.updateDeploymentStatus(vid, id, status);
                
                switch (result) {
                    case (#ok(_)) {
                        logger.info("✅ Successfully updated deployment status in version " # vid);
                        return #ok();
                    };
                    case (#err(error)) {
                        let errorMsg = switch (error) {
                            case (#VersionNotFound) { "Version not found" };
                            case (#InvalidVersion) { "Invalid version format" };
                            case (#ProjectNotFound) { "Project not found" };
                            case (#ArtifactNotFound) { "Artifact not found" };
                            case (#VersionExists) { "Version already exists" };
                            case (#CanisterError) { "Canister error" };
                            case (#Unauthorized) { "Unauthorized" };
                            case (#Other(msg)) { msg };
                        };
                        logger.info("❌ Failed to update version deployment: " # errorMsg);
                        return #err(errorMsg);
                    };
                };
            } catch (e) {
                let errorMsg = Error.message(e);
                logger.info("❌ Exception while updating version deployment: " # errorMsg);
                return #err(errorMsg);
            };
        };
        case (null) {
            // CASE: NO VERSION - Update account deployment record
            logger.info("- No version ID provided, updating account deployment");
            try {
                // Use the existing account manager's method
                await getAccountManager().updateDeploymentStatus(id, status)
            } catch (error) {
                let errorMsg = Error.message(error);
                logger.info("❌ Updating deployment status failed: " # errorMsg);
                #err(errorMsg)
            }
        };
    }
};




    // Collaborator management

    // Add a collaborator
    public shared(msg) func addCollaborator(
        principalId: Principal, 
        role: AccountTypes.RoleType,
        permissions: [Text], 
        expiresAt: ?AccountTypes.Timestamp
    ) : async Result.Result<(), Text> {
        logger.info("Adding collaborator for: " # Principal.toText(msg.caller));
        logger.info("Collaborator: " # Principal.toText(principalId));
        try {
            await getAccountManager().addCollaborator(principalId, role, permissions, expiresAt)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Adding collaborator failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Update collaborator status
    public shared(msg) func updateCollaboratorStatus(
        principalId: Principal,
        status: AccountTypes.CollaboratorStatus
    ) : async Result.Result<(), Text> {
        logger.info("Updating collaborator status for: " # Principal.toText(msg.caller));
        logger.info("Collaborator: " # Principal.toText(principalId));
        let statusText = switch (status) {
            case (#Active) "Active";
            case (#Invited) "Invited";
            case (#Removed) "Removed";
        };
        logger.info("New status: " # statusText);
        try {
            await getAccountManager().updateCollaboratorStatus(principalId, status)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Updating collaborator status failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Resource usage methods

    // Update cycles balance
    public shared(msg) func updateAccountCyclesBalance(newBalance: Nat64) : async Result.Result<(), Text> {
        logger.info("Updating cycles balance for: " # Principal.toText(msg.caller));
        logger.info("New balance: " # Nat64.toText(newBalance));
        try {
            await getAccountManager().updateCyclesBalance(newBalance)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Updating cycles balance failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // ===============================
    // AI CREDITS MANAGEMENT METHODS
    // ===============================

    // Deduct AI credits for API usage
    public shared(msg) func deductAICredits(
        projectId: Text, 
        inputTokens: Nat, 
        outputTokens: Nat, 
        model: Text,
        operation: Text
    ) : async Result.Result<Nat, Text> {
        logger.info("Deducting AI credits for: " # Principal.toText(msg.caller));
        logger.info("Project: " # projectId # ", Model: " # model # ", Operation: " # operation);
        logger.info("Input tokens: " # Nat.toText(inputTokens) # ", Output tokens: " # Nat.toText(outputTokens));
        
        try {
            let result = await getAccountManager().deductAICredits(projectId, inputTokens, outputTokens, model, operation);
            
            switch (result) {
                case (#ok(remainingBalance)) {
                    logger.info("✅ AI credits deducted successfully. Remaining balance: " # Nat.toText(remainingBalance));
                    
                    // Log usage to stable storage for analytics
                    let usageRecord : AccountTypes.AIUsageRecord = {
                        timestamp = Nat64.fromNat(Int.abs(Time.now()));
                        projectId = projectId;
                        tokensUsed = inputTokens + outputTokens;
                        inputTokens = inputTokens;
                        outputTokens = outputTokens;
                        creditsDeducted = 0; // This will be calculated in AccountManager
                        model = model;
                        operation = operation;
                    };
                    
                    // Keep only last 1000 records to prevent unbounded growth
                    let historySize = aiUsageHistory.size();
                    if (historySize >= 1000) {
                        let startIndex = historySize - 999;
                        aiUsageHistory := Array.tabulate<AccountTypes.AIUsageRecord>(
                            999, 
                            func(i) = aiUsageHistory[startIndex + i]
                        );
                    };
                    
                    aiUsageHistory := Array.append(aiUsageHistory, [usageRecord]);
                    
                    #ok(remainingBalance)
                };
                case (#err(error)) {
                    logger.info("❌ Failed to deduct AI credits: " # error);
                    #err(error)
                };
            }
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ AI credits deduction failed with error: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Refund AI credits (for failed API calls)
    public shared(msg) func refundAICredits(projectId: Text, amount: Nat, reason: Text) : async Result.Result<Bool, Text> {
        logger.info("Refunding AI credits for: " # Principal.toText(msg.caller));
        logger.info("Project: " # projectId # ", Amount: " # Nat.toText(amount) # ", Reason: " # reason);
        
        try {
            let result = await getAccountManager().refundAICredits(projectId, amount, reason);
            
            switch (result) {
                case (#ok(_)) {
                    logger.info("✅ AI credits refunded successfully");
                    #ok(true)
                };
                case (#err(error)) {
                    logger.info("❌ Failed to refund AI credits: " # error);
                    #err(error)
                };
            }
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ AI credits refund failed with error: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Refresh monthly AI credits
    public shared(msg) func refreshMonthlyAICredits() : async Result.Result<Bool, Text> {
        logger.info("Refreshing monthly AI credits for: " # Principal.toText(msg.caller));
        
        try {
            let result = await getAccountManager().refreshMonthlyAICredits();
            
            switch (result) {
                case (#ok(_)) {
                    logger.info("✅ Monthly AI credits refreshed successfully");
                    #ok(true)
                };
                case (#err(error)) {
                    logger.info("❌ Failed to refresh monthly AI credits: " # error);
                    #err(error)
                };
            }
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Monthly AI credits refresh failed with error: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Update subscription tier
    public shared(msg) func updateSubscriptionTier(tier: Text, monthlyAllocation: Nat) : async Result.Result<Bool, Text> {
        logger.info("Updating subscription tier for: " # Principal.toText(msg.caller));
        logger.info("New tier: " # tier # ", Monthly allocation: " # Nat.toText(monthlyAllocation));
        
        try {
            let result = await getAccountManager().updateSubscriptionTier(tier, monthlyAllocation);
            
            switch (result) {
                case (#ok(_)) {
                    // Update subscription data in stable storage
                    userSubscription := ?{
                        tier = tier;
                        monthlyAllocation = monthlyAllocation;
                        billingCycleStart = Nat64.fromNat(Int.abs(Time.now()));
                        isActive = true;
                        autoRefresh = true;
                    };
                    
                    logger.info("✅ Subscription tier updated successfully");
                    #ok(true)
                };
                case (#err(error)) {
                    logger.info("❌ Failed to update subscription tier: " # error);
                    #err(error)
                };
            }
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Subscription tier update failed with error: " # errorMsg);
            #err(errorMsg)
        }
    };

    // ===============================
    // ONBOARDING AND FIRST LOGIN METHODS
    // ===============================

    // Mark first login
    public shared(msg) func markFirstLogin() : async Result.Result<Bool, Text> {
        logger.info("Marking first login for: " # Principal.toText(msg.caller));
        
        try {
            let result = await getAccountManager().markFirstLogin();
            
            switch (result) {
                case (#ok(_)) {
                    logger.info("✅ First login marked successfully");
                    #ok(true)
                };
                case (#err(error)) {
                    logger.info("❌ Failed to mark first login: " # error);
                    #err(error)
                };
            }
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Mark first login failed with error: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Complete onboarding
    public shared(msg) func completeOnboarding() : async Result.Result<Bool, Text> {
        logger.info("Completing onboarding for: " # Principal.toText(msg.caller));
        
        try {
            let result = await getAccountManager().completeOnboarding();
            
            switch (result) {
                case (#ok(_)) {
                    logger.info("✅ Onboarding completed successfully");
                    #ok(true)
                };
                case (#err(error)) {
                    logger.info("❌ Failed to complete onboarding: " # error);
                    #err(error)
                };
            }
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Complete onboarding failed with error: " # errorMsg);
            #err(errorMsg)
        }
    };

    // ===============================
    // QUERY METHODS (Fast access)
    // ===============================

    // Get AI credits balance
    public query(msg) func getAICreditsBalance() : async Nat {
        logger.info("Getting AI credits balance for: " # Principal.toText(msg.caller));
        getAccountManager().getAICreditsBalance()
    };

    // Get AI usage this month
    public query(msg) func getAIUsageThisMonth() : async Nat {
        logger.info("Getting AI usage this month for: " # Principal.toText(msg.caller));
        getAccountManager().getAIUsageThisMonth()
    };

    // Get subscription tier
    public query(msg) func getSubscriptionTier() : async Text {
        logger.info("Getting subscription tier for: " # Principal.toText(msg.caller));
        getAccountManager().getSubscriptionTier()
    };

    // Get AI usage history
    public query(msg) func getAIUsageHistory(limit: ?Nat) : async [AccountTypes.AIUsageRecord] {
        logger.info("Getting AI usage history for: " # Principal.toText(msg.caller));
        
        let maxLimit = switch (limit) {
            case (?l) { Nat.min(l, 100) }; // Cap at 100 records
            case null { 20 }; // Default to 20
        };
        
        let historySize = aiUsageHistory.size();
        if (historySize <= maxLimit) {
            aiUsageHistory
        } else {
            // Return most recent records
            let startIndex = historySize - maxLimit;
            Array.tabulate<AccountTypes.AIUsageRecord>(maxLimit, func(i) = aiUsageHistory[startIndex + i])
        }
    };

    // Get subscription info
    public query(msg) func getSubscriptionInfo() : async ?AccountTypes.Subscription {
        logger.info("Getting subscription info for: " # Principal.toText(msg.caller));
        userSubscription
    };

    // Get onboarding status
    public query(msg) func getOnboardingStatus() : async {
        hasCompletedOnboarding: Bool;
        firstLoginAt: ?Nat64;
        accountCreatedAt: ?Nat64;
    } {
        logger.info("Getting onboarding status for: " # Principal.toText(msg.caller));
        getAccountManager().getOnboardingStatus()
    };

    // Check if first time user
    public query(msg) func isFirstTimeUser() : async Bool {
        logger.info("Checking if first time user for: " # Principal.toText(msg.caller));
        getAccountManager().isFirstTimeUser()
    };

    // ===============================
    // HELPER METHOD FOR INITIALIZATION
    // ===============================

    // Initialize default subscription for new users
    public shared(msg) func initializeDefaultSubscription() : async Result.Result<Bool, Text> {
        logger.info("Initializing default subscription for: " # Principal.toText(msg.caller));
        
        switch (userSubscription) {
            case (?_) { 
                logger.info("❌ Subscription already exists");
                #err("Subscription already exists") 
            };
            case null {
                userSubscription := ?{
                    tier = "free";
                    monthlyAllocation = 10000; // 10k credits for free tier
                    billingCycleStart = Nat64.fromNat(Int.abs(Time.now()));
                    isActive = true;
                    autoRefresh = true;
                };
                
                // Update account stats if account exists
                try {
                    let _ = await getAccountManager().updateSubscriptionTier("free", 10000);
                    logger.info("✅ Default subscription initialized successfully");
                    #ok(true)
                } catch (error) {
                    let errorMsg = Error.message(error);
                    logger.info("❌ Failed to initialize default subscription: " # errorMsg);
                    #err(errorMsg)
                }
            };
        }
    };


    // Stripe Integration Methods
    public shared(msg) func setStripeCustomerId(customerId: Text) : async Result.Result<(), Text> {
        logger.info("Setting Stripe customer ID for: " # Principal.toText(msg.caller));
        logger.info("Customer ID: " # customerId);
        
        try {
            await getAccountManager().setStripeCustomerId(customerId)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Setting Stripe customer ID failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    public shared(msg) func updateStripeSubscriptionStatus(active: Bool) : async Result.Result<(), Text> {
        logger.info("Updating Stripe subscription status for: " # Principal.toText(msg.caller));
        logger.info("Active: " # Bool.toText(active));
        
        try {
            await getAccountManager().updateSubscriptionStatus(active)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Updating Stripe subscription status failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    public shared(msg) func updateBillingCycleEnd(endTimestamp: Nat64) : async Result.Result<(), Text> {
        logger.info("Updating billing cycle end for: " # Principal.toText(msg.caller));
        logger.info("End timestamp: " # Nat64.toText(endTimestamp));
        
        try {
            await getAccountManager().updateBillingCycleEnd(endTimestamp)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Updating billing cycle end failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Combined method for efficiency
    public shared(msg) func updateStripeData(
        customerId: ?Text, 
        subscriptionActive: Bool, 
        billingCycleEnd: ?Nat64
    ) : async Result.Result<(), Text> {
        logger.info("Updating complete Stripe data for: " # Principal.toText(msg.caller));
        
        try {
            await getAccountManager().updateStripeData(customerId, subscriptionActive, billingCycleEnd)
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Updating Stripe data failed: " # errorMsg);
            #err(errorMsg)
        }
    };

    // Fast query methods for subscription checks
    public query(msg) func getStripeCustomerId() : async ?Text {
        getAccountManager().getStripeCustomerId()
    };

    public query(msg) func isSubscriptionActiveLocal() : async Bool {
        getAccountManager().isSubscriptionActive()
    };

    public query(msg) func getBillingCycleEnd() : async ?Nat64 {
        getAccountManager().getBillingCycleEnd()
    };

    // Enhanced method that includes Stripe data
    public shared(msg) func completeSubscriptionSetup(
        customerId: Text,
        subscriptionActive: Bool,
        billingCycleEnd: Nat64,
        tier: Text,
        monthlyAllocation: Nat
    ) : async Result.Result<(), Text> {
        logger.info("Completing subscription setup with Stripe data for: " # Principal.toText(msg.caller));
        
        try {
            // Update subscription tier (existing functionality)
            let tierResult = await getAccountManager().updateSubscriptionTier(tier, monthlyAllocation);
            
            switch (tierResult) {
                case (#ok(_)) {
                    // Update Stripe-specific data
                    let stripeResult = await getAccountManager().updateStripeData(
                        ?customerId, 
                        subscriptionActive, 
                        ?billingCycleEnd
                    );
                    
                    switch (stripeResult) {
                        case (#ok(_)) {
                            logger.info("✅ Subscription setup completed successfully");
                            #ok(())
                        };
                        case (#err(e)) {
                            logger.info("❌ Failed to update Stripe data: " # e);
                            #err(e)
                        };
                    }
                };
                case (#err(e)) {
                    logger.info("❌ Failed to update subscription tier: " # e);
                    #err(e)
                };
            }
        } catch (error) {
            let errorMsg = Error.message(error);
            logger.info("❌ Complete subscription setup failed: " # errorMsg);
            #err(errorMsg)
        }
    };


   

    // ===============================
    // WASM CHUNKING
    // ===============================

    // Generate a unique session ID (implement or use your existing UUID generation)
    private func generateSessionId() : Text {
        let now = Int.abs(Time.now());
        
        // Time.now() returns an Int, but we need to handle the modulo operation differently
        let timeValue = Int.abs(Time.now());
        let moduloValue = timeValue % 10000;
        let counter : Nat = Int.abs(moduloValue) + 10000;
        
        return Nat.toText(now) # "-" # Nat.toText(counter);
    };

    private let natHash = func(n: Nat): Hash.Hash {
        Text.hash(Nat.toText(n))
    };

    // Start a WASM upload session
    public shared(msg) func startWasmUploadSession(
        projectId: Text,
        fileName: Text,
        totalChunks: Nat,
        totalSize: Nat,
        canisterId: ?Principal,
        canisterType: ?Text,
        deploymentStage: ?Text
    ) : async Result.Result<Text, Text> {
        logger.info("Starting WASM upload session:");
        logger.info("- Project: " # projectId);
        logger.info("- File: " # fileName);
        logger.info("- Total chunks: " # Nat.toText(totalChunks));
        logger.info("- Total size: " # Nat.toText(totalSize));
        
        let sessionId = generateSessionId();
        
        wasmUploadSessions.put(sessionId, {
            sessionId = sessionId;
            projectId = projectId;
            fileName = fileName;
            canisterId = canisterId;
            canisterType = canisterType;
            deploymentStage = deploymentStage;
            chunks = HashMap.HashMap<Nat, [Nat8]>(totalChunks, Nat.equal, natHash);
            totalChunks = totalChunks;
            receivedChunks = 0;
            totalSize = totalSize;
            createdAt = Time.now();
        });
        
        logger.info("✅ Upload session created: " # sessionId);
        #ok(sessionId)
    };



    // Upload a WASM chunk
    public shared(msg) func uploadWasmChunk(
        sessionId: Text,
        chunkIndex: Nat,
        chunkData: [Nat8]
    ) : async Result.Result<{receivedChunks: Nat; totalChunks: Nat}, Text> {
        switch (wasmUploadSessions.get(sessionId)) {
            case null {
                logger.info("❌ Upload session not found: " # sessionId);
                #err("Upload session not found")
            };
            case (?session) {
                if (chunkIndex >= session.totalChunks) {
                    logger.info("❌ Invalid chunk index: " # Nat.toText(chunkIndex));
                    return #err("Invalid chunk index");
                };
                
                // Store the chunk
                session.chunks.put(chunkIndex, chunkData);
                
                // Update session
                let updatedSession = {
                    session with
                    receivedChunks = session.receivedChunks + 1
                };
                
                wasmUploadSessions.put(sessionId, updatedSession);
                
                logger.info("✅ Chunk " # Nat.toText(chunkIndex) # " received for session " # sessionId);
                logger.info("- Progress: " # Nat.toText(updatedSession.receivedChunks) # "/" # Nat.toText(updatedSession.totalChunks));
                
                #ok({
                    receivedChunks = updatedSession.receivedChunks;
                    totalChunks = updatedSession.totalChunks;
                })
            };
        };
    };

    // Finalize WASM upload and get it ready for deployment
public shared(msg) func finalizeWasmUpload(
    sessionId: Text
) : async Result.Result<Text, Text> {
    switch (wasmUploadSessions.get(sessionId)) {
        case null {
            logger.info("❌ Upload session not found: " # sessionId);
            #err("Upload session not found")
        };
        case (?session) {
            if (session.receivedChunks < session.totalChunks) {
                logger.info("❌ Not all chunks received for session " # sessionId);
                return #err("Not all chunks received: " # 
                    Nat.toText(session.receivedChunks) # "/" # 
                    Nat.toText(session.totalChunks));
            };
            
            // Combine all chunks into one WASM binary
            logger.info("⏳ Assembling " # Nat.toText(session.totalChunks) # " chunks for session " # sessionId);
            
            let wasmBuffer = Buffer.Buffer<Nat8>(session.totalSize);
            
            for (i in Iter.range(0, session.totalChunks - 1)) {
                switch (session.chunks.get(i)) {
                    case (?chunk) {
                        for (byte in chunk.vals()) {
                            wasmBuffer.add(byte);
                        };
                    };
                    case null {
                        logger.info("❌ Missing chunk " # Nat.toText(i) # " for session " # sessionId);
                        return #err("Missing chunk: " # Nat.toText(i));
                    };
                };
            };
            
            let combinedWasm = Buffer.toArray(wasmBuffer);
            logger.info("✅ Successfully assembled WASM of size: " # Nat.toText(combinedWasm.size()) # " bytes");
            
            // Store the WASM in your artifact storage system
            let artifactId = session.projectId # "-wasm-" # session.fileName;
            let artifactManager = getArtifactManager();
            
            // Check if the artifact already exists
            let existingArtifact = artifactManager.readArtifact(
                session.projectId,
                "wasms",
                session.fileName
            );
            
            // Store result variable to hold the operation result
            let storeResult = switch (existingArtifact) {
                // If the artifact exists, update it
                case (#ok(_)) {
                    logger.info("⚠️ Artifact already exists, updating instead of creating");
                    artifactManager.updateArtifact(
                        session.projectId,
                        session.fileName,
                        #Binary(combinedWasm),
                        "application/wasm",
                        "wasms"
                    )
                };
                // If it doesn't exist, create a new one
                case (#err(_)) {
                    logger.info("🆕 Creating new artifact");
                    artifactManager.createArtifact(
                        session.projectId,
                        session.fileName,
                        #Binary(combinedWasm),
                        "application/wasm",
                        "wasm", 
                        "wasms"
                    )
                };
            };
            
            // Clean up the session
            wasmUploadSessions.delete(sessionId);
            
            // Check storage result
            switch (storeResult) {
                case (#err(e)) {
                    logger.info("❌ Failed to store WASM: " # e);
                    return #err("Failed to store WASM: " # e);
                };
                case (#ok(artifact)) {
                    logger.info("✅ WASM stored successfully with ID: " # artifactId);
                    
                    // If canisterId is provided, trigger deployment
                    switch (session.canisterId) {
                        case (?canisterId) {
                            logger.info("⏳ Triggering deployment for canister: " # Principal.toText(canisterId));
                            return #ok("WASM stored successfully. Use deployStoredWasm to deploy it.");
                        };
                        case (null) {
                            return #ok("WASM stored successfully. ID: " # artifactId);
                        };
                    };
                };
            };
        };
    };
};

// Start a download session
public shared(msg) func startWasmDownloadSession(
    projectId: Text,
    path: Text,
    fileName: Text
) : async Result.Result<{
    sessionId: Text;
    totalChunks: Nat;
    totalSize: Nat;
    chunkSize: Nat;
}, Text> {
    logger.info("Starting WASM download session:");
    logger.info("- Project: " # projectId);
    logger.info("- Path: " # path);
    logger.info("- File: " # fileName);
    
    let artifactManager = getArtifactManager();
    
    // First try to read the artifact to see if it exists and get its details
    let artifactResult = artifactManager.readArtifact(projectId, path, fileName);
    
    switch (artifactResult) {
        case (#err(error)) {
            logger.info("❌ Failed to find file for download: " # error);
            return #err("Failed to find file: " # error);
        };
        case (#ok(artifact)) {
            // If content is small enough to be returned directly, suggest using readCodeArtifact
            if (artifact.size < 1_900_000 and Option.isSome(artifact.content)) {
                logger.info("⚠️ File is small enough to download directly via readCodeArtifact");
                return #err("File is small enough to download directly via readCodeArtifact");
            };
            
            // Determine total size and number of chunks needed
            let totalSize = artifact.size;
            let chunkSize = 1_900_000; // Just under 2MB limit
            let totalChunks = (totalSize + chunkSize - 1) / chunkSize; // Ceiling division
            
            // Create a session ID
            let sessionId = generateSessionId();
            
            // Store session information
            wasmDownloadSessions.put(sessionId, {
                sessionId = sessionId;
                projectId = projectId;
                path = path;
                fileName = fileName;
                totalChunks = totalChunks;
                totalSize = totalSize;
                chunkSize = chunkSize;
                createdAt = Time.now();
            });
            
            logger.info("✅ Download session created: " # sessionId);
            logger.info("- Total size: " # Nat.toText(totalSize) # " bytes");
            logger.info("- Chunks: " # Nat.toText(totalChunks) # " (max " # Nat.toText(chunkSize) # " bytes each)");
            
            return #ok({
                sessionId = sessionId;
                totalChunks = totalChunks;
                totalSize = totalSize;
                chunkSize = chunkSize;
            });
        };
    };
};

// This is the proper way to implement Array.slice in Motoko
private func arraySlice<T>(arr: [T], start: Nat, length: Nat) : [T] {
    let buffer = Buffer.Buffer<T>(length);
    var i = 0;
    while (i < length and start + i < arr.size()) {
        buffer.add(arr[start + i]);
        i += 1;
    };
    Buffer.toArray(buffer)
};

public shared(msg) func downloadWasmChunk(
    sessionId: Text,
    chunkIndex: Nat
) : async Result.Result<[Nat8], Text> {
    logger.info("Downloading chunk " # Nat.toText(chunkIndex) # " from session " # sessionId);
    
    switch (wasmDownloadSessions.get(sessionId)) {
        case (null) {
            logger.info("❌ Download session not found: " # sessionId);
            return #err("Download session not found");
        };
        case (?session) {
            if (chunkIndex >= session.totalChunks) {
                logger.info("❌ Invalid chunk index: " # Nat.toText(chunkIndex));
                return #err("Invalid chunk index");
            };
            
            let artifactManager = getArtifactManager();
            
            // Read the full artifact
            let artifactResult = artifactManager.readArtifact(session.projectId, session.path, session.fileName);
            
            switch (artifactResult) {
                case (#err(error)) {
                    logger.info("❌ Failed to read artifact for chunking: " # error);
                    return #err("Failed to read artifact: " # error);
                };
                case (#ok(artifact)) {
                    // Get binary content
                    let binaryContent = switch (artifact.content) {
                        case (?#Binary(bytes)) { bytes };
                        case (?#Text(text)) { 
                            // Convert text to binary
                            Blob.toArray(Text.encodeUtf8(text)) 
                        };
                        case (null) {
                            // Handle chunked content
                            if (Option.isNull(artifact.chunks)) {
                                logger.info("❌ Artifact has no content and no chunks");
                                return #err("Artifact has no content");
                            };
                            
                            logger.info("Artifact has chunked content, assembling...");
                            
                            // If the artifact was stored with chunks, you need to reassemble
                            // Unfortunately, we would need to load all chunks to extract one piece
                            // This is a limitation of the current design
                            
                            // Create a buffer with estimated size
                            let totalSize = artifact.size;
                            let chunkBuffer = Buffer.Buffer<Nat8>(totalSize);
                            
                            // Collect all chunks
                            switch (artifact.chunks) {
                                case (?artifactChunks) {
                                    for ((chunkId, _) in artifactChunks.vals()) {
                                        switch (artifactManager.getChunk(chunkId)) {
                                            case (?chunk) {
                                                for (byte in chunk.content.vals()) {
                                                    chunkBuffer.add(byte);
                                                };
                                            };
                                            case (null) {
                                                logger.info("❌ Missing chunk: " # Nat.toText(chunkId));
                                                return #err("Missing chunk: " # Nat.toText(chunkId));
                                            };
                                        };
                                    };
                                    
                                    let fullContent = Buffer.toArray(chunkBuffer);
                                    
                                    // Now extract just the requested chunk
                                    let startIndex = chunkIndex * session.chunkSize;
                                    let endIndex = Nat.min(startIndex + session.chunkSize, fullContent.size());
                                    
                                    if (startIndex >= fullContent.size()) {
                                        logger.info("❌ Chunk start index beyond content size");
                                        return #err("Chunk index out of bounds");
                                    };
                                    
                                    // Extract the chunk using arraySlice helper
                                    let chunkSize = endIndex - startIndex;
                                    logger.info("Extracting chunk from " # Nat.toText(startIndex) # " to " # Nat.toText(endIndex) # " (" # Nat.toText(chunkSize) # " bytes)");
                                    
                                    // Use our arraySlice helper
                                    let resultChunk = arraySlice<Nat8>(fullContent, startIndex, chunkSize);
                                    
                                    logger.info("✅ Chunk " # Nat.toText(chunkIndex) # " extracted successfully: " # Nat.toText(resultChunk.size()) # " bytes");
                                    return #ok(resultChunk);
                                };
                                case (null) {
                                    logger.info("❌ Artifact has no chunks");
                                    return #err("Artifact has no content");
                                };
                            };
                        };
                    };
                    
                    // At this point we have the binary content directly
                    // Calculate chunk boundaries
                    let startIndex = chunkIndex * session.chunkSize;
                    let endIndex = Nat.min(startIndex + session.chunkSize, binaryContent.size());
                    
                    if (startIndex >= binaryContent.size()) {
                        logger.info("❌ Chunk start index beyond content size");
                        return #err("Chunk index out of bounds");
                    };
                    
                    // Extract the chunk
                    let chunkSize = endIndex - startIndex;
                    logger.info("Extracting chunk from " # Nat.toText(startIndex) # " to " # Nat.toText(endIndex) # " (" # Nat.toText(chunkSize) # " bytes)");
                    
                    // Create buffer for the chunk and copy required bytes
                    let chunkBuffer = Buffer.Buffer<Nat8>(chunkSize);
                    var i = 0;
                    while (i < chunkSize) {
                        chunkBuffer.add(binaryContent[startIndex + i]);
                        i += 1;
                    };
                    
                    let chunk = Buffer.toArray(chunkBuffer);
                    logger.info("✅ Chunk " # Nat.toText(chunkIndex) # " extracted successfully: " # Nat.toText(chunk.size()) # " bytes");
                    return #ok(chunk);
                };
            };
        };
    };
};

// Cleanup session when done
public shared(msg) func cleanupWasmDownloadSession(sessionId: Text) : async Result.Result<Text, Text> {
    logger.info("Cleaning up download session: " # sessionId);
    
    switch (wasmDownloadSessions.get(sessionId)) {
        case (null) {
            logger.info("❌ Download session not found: " # sessionId);
            return #err("Download session not found");
        };
        case (?session) {
            wasmDownloadSessions.delete(sessionId);
            logger.info("✅ Download session cleaned up successfully: " # sessionId);
            return #ok("Download session cleaned up successfully");
        };
    };
};

    // Deploy a stored WASM
    public shared(msg) func deployStoredWasm(
        projectId: Text, 
        fileName: Text,
        canisterId: Principal,
        canisterType: Text,
        deploymentStage: Text,
        userPrincipal: Principal,
        metadata: ?canister.CanisterMetadata,
        versionId: ?Text,
        installMode: ?Text
    ) : async Result.Result<Text, Text> {
        logger.info("Deploying stored WASM:");
        logger.info("- Project: " # projectId);
        logger.info("- File: " # fileName);
        logger.info("- Canister: " # Principal.toText(canisterId));
        
        let artifactManager = getArtifactManager();
        
        // Retrieve WASM from storage
        let wasmResult = artifactManager.readArtifact(projectId, "wasms", fileName);
        
        switch (wasmResult) {
            case (#err(e)) {
                logger.info("❌ Failed to retrieve stored WASM: " # e);
                return #err("Failed to retrieve stored WASM: " # e);
            };
            case (#ok(artifact)) {
                // Extract binary content
                let wasmBytes = switch (artifact.content) {
                    case (?#Binary(bytes)) { bytes };
                    case (?#Text(_)) { 
                        logger.info("❌ Stored content is not binary");
                        return #err("Stored content is not binary. Expected WASM binary."); 
                    };
                    case (null) {
                        if (Option.isNull(artifact.chunks)) {
                            logger.info("❌ No content found in stored WASM");
                            return #err("No content found in stored WASM");
                        };
                        
                        // You'll need to adapt this part to match your actual implementation
                        // of how chunks are stored and retrieved in your system
                        logger.info("⚠️ Content is null, attempting to read from chunks");
                        let wasmBuffer = Buffer.Buffer<Nat8>(0);
                        
                        // Note: This section might need adjusting based on your actual chunking system
                        switch (artifact.chunks) {
                            case (?chunkRefs) {
                                for ((chunkId, _) in chunkRefs.vals()) {
                                    switch (artifactManager.getChunk(chunkId)) {
                                        case (?chunk) {
                                            for (byte in chunk.content.vals()) {
                                                wasmBuffer.add(byte);
                                            };
                                        };
                                        case (null) {
                                            logger.info("❌ Missing chunk: " # Nat.toText(chunkId));
                                            return #err("Missing chunk in stored WASM: " # Nat.toText(chunkId));
                                        };
                                    };
                                };
                            };
                            case (null) {
                                logger.info("❌ No content or chunks found");
                                return #err("No content or chunks found in stored WASM");
                            };
                        };
                        
                        Buffer.toArray(wasmBuffer)
                    };
                };
                
                // Deploy the WASM using existing deployment method
                logger.info("⏳ Deploying WASM of size: " # Nat.toText(wasmBytes.size()) # " bytes");
                
                return await deployToExistingCanister(
                    canisterId,
                    wasmBytes,
                    canisterType,
                    deploymentStage,
                    userPrincipal,
                    metadata,
                    versionId,
                    installMode
                );
            };
        };
    };



    // ===============================
    // PROJECT CHUNKING
    // ===============================

private stable var fileDownloadSessionsEntries : [(Text, FileDownloadSession)] = [];
private var fileDownloadSessions = HashMap.HashMap<Text, FileDownloadSession>(10, Text.equal, Text.hash);


public type FileDownloadSession = {
    sessionId: Text;
    projectId: Text;
    versionId: ?Text;
    totalFiles: Nat;
    batchSize: Nat;
    totalBatches: Nat;
    createdAt: Int;
    estimatedTotalSize: Nat; 
};

public shared(msg) func startProjectFilesDownloadSession(
    userPrincipal: Principal,
    projectId: Text,
    versionId: ?Text
) : async Result.Result<{
    sessionId: Text;
    totalFiles: Nat;
    totalBatches: Nat;
    batchSize: Nat;
}, Text> {
    logger.info("Starting project files download session:");
    logger.info("- Project: " # projectId);
    logger.info("- Version: " # debug_show(versionId));
    
    // Check if project exists
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null {
            return #err("Project not found");
        };
        case (?project) {
            // Check if user is authorized
            let isController = await isCanisterController(msg.caller);
            if (not isController) {
                return #err("You don't have permission to access this project");
            };
            
            // Get all files and estimate sizes (NEW LOGIC)
            let (totalFiles, estimatedTotalSize) = switch (versionId) {
                case null {
                    let artifacts = getArtifactManager().getProjectArtifacts(projectId);
                    var totalSize = 0;
                    
                    for (artifact in artifacts.vals()) {
                        switch (artifact.content) {
                            case (?content) {
                                switch (content) {
                                    case (#Text(text)) { 
                                        totalSize += text.size() * 4;
                                    };
                                    case (#Binary(bytes)) { 
                                        totalSize += bytes.size();
                                    };
                                };
                            };
                            case null { 
                                totalSize += 1000;
                            };
                        };
                    };
                    
                    (artifacts.size(), totalSize)
                };
                case (?vid) {
                    let manager = getVersionManager();
                    let result = manager.getVersionArtifacts(vid);
                    
                    switch (result) {
                        case (#ok(artifact)) { 
                            var totalSize = 0;
                            
                            for (file in artifact.files.vals()) {
                                switch (file.content) {
                                    case (#Text(text)) { 
                                        totalSize += text.size() * 4;
                                    };
                                    case (#Binary(bytes)) { 
                                        totalSize += bytes.size();
                                    };
                                    case (#Reference(ref)) { 
                                        totalSize += 1000;
                                    };
                                };
                            };
                            
                            (artifact.files.size(), totalSize)
                        };
                        case (#err(_)) { (0, 0) };
                    }
                };
            };
            
            if (totalFiles == 0) {
                return #err("No files found in project");
            };
            
            // SMART BATCH SIZING (REPLACE your fixed batchSize = 10)
            let averageFileSize = if (totalFiles > 0) { 
                estimatedTotalSize / totalFiles 
            } else { 
                10000
            };
            
            // NUCLEAR BATCH SIZING - Maximum aggression
            let targetBatchSize = 1900000; // 1.9MB - 95% of 2MB limit
            let calculatedBatchSize = if (averageFileSize > 0) {
                targetBatchSize / averageFileSize
            } else {
                3
            };

            // AGGRESSIVE limits - allow up to 12 files per batch
            let batchSize = if (calculatedBatchSize < 1) { 
                1 
            } else if (calculatedBatchSize > 12) { 
                12  // INCREASED from 5 to 12
            } else { 
                calculatedBatchSize 
            };
                        
            let totalBatches = (totalFiles + batchSize - 1) / batchSize;
            
            // Create session ID
            let sessionId = generateSessionId();
            
            // Store session with NEW estimatedTotalSize field
            fileDownloadSessions.put(sessionId, {
                sessionId = sessionId;
                projectId = projectId;
                versionId = versionId;
                totalFiles = totalFiles;
                batchSize = batchSize;
                totalBatches = totalBatches;
                createdAt = Time.now();
                estimatedTotalSize = estimatedTotalSize; // NEW FIELD
            });
            
            logger.info("✅ Smart file download session created: " # sessionId);
            logger.info("- Total files: " # Nat.toText(totalFiles));
            logger.info("- Estimated size: " # Nat.toText(estimatedTotalSize) # " bytes");
            logger.info("- Smart batch size: " # Nat.toText(batchSize) # " files per batch");
            logger.info("- Total batches: " # Nat.toText(totalBatches));
            
            return #ok({
                sessionId = sessionId;
                totalFiles = totalFiles;
                totalBatches = totalBatches;
                batchSize = batchSize;
            });
        };
    };
};

public shared(msg) func downloadProjectFilesBatch(
    sessionId: Text,
    batchIndex: Nat
) : async Result.Result<{files: [codeArtifacts.CodeArtifact]; isLastBatch: Bool}, Text> {
    logger.info("Downloading file batch " # Nat.toText(batchIndex) # " from session " # sessionId);
    
    switch (fileDownloadSessions.get(sessionId)) {
        case (null) {
            logger.info("❌ File download session not found: " # sessionId);
            return #err("Download session not found");
        };
        case (?session) {
            if (batchIndex >= session.totalBatches) {
                logger.info("❌ Invalid batch index: " # Nat.toText(batchIndex));
                return #err("Invalid batch index");
            };
            
            let startIndex = batchIndex * session.batchSize;
            let endIndex = Nat.min(startIndex + session.batchSize, session.totalFiles);
            let isLastBatch = batchIndex == (session.totalBatches - 1);
            
            logger.info("Extracting files from " # Nat.toText(startIndex) # " to " # Nat.toText(endIndex));
            
            try {
                // NEW: Add size checking to prevent oversized batches
                let batchFiles = switch (session.versionId) {
                    case null {
                        let allArtifacts = getArtifactManager().getProjectArtifacts(session.projectId);
                        
                        let batchSize = endIndex - startIndex;
                        let batchBuffer = Buffer.Buffer<codeArtifacts.CodeArtifact>(batchSize);
                        var currentBatchSize = 0;
                        let maxBatchSize = 1500000; // 1.5MB safety limit (NEW)
                        
                        var i = 0;
                        while (i < batchSize and startIndex + i < allArtifacts.size()) {
                            let artifact = allArtifacts[startIndex + i];
                            
                            // NEW: Estimate artifact size before adding
                            var artifactSize = 1000;
                            switch (artifact.content) {
                                case (?content) {
                                    switch (content) {
                                        case (#Text(text)) { 
                                            artifactSize := text.size() * 4;
                                        };
                                        case (#Binary(bytes)) { 
                                            artifactSize := bytes.size();
                                        };
                                    };
                                };
                                case null { };
                            };
                            
                            // NEW: Stop if adding this file would exceed limit
                            if (currentBatchSize + artifactSize > maxBatchSize and batchBuffer.size() > 0) {
                                logger.info("Batch size limit reached, stopping at " # Nat.toText(batchBuffer.size()) # " files");
                                i := batchSize; // Break the loop
                            } else {
                                batchBuffer.add(artifact);
                                currentBatchSize += artifactSize;
                                i += 1;
                            };
                        };
                        
                        Buffer.toArray(batchBuffer)
                    };
                    case (?vid) {
                        // Same size checking logic for version files
                        let manager = getVersionManager();
                        let result = manager.getVersionArtifacts(vid);
                        
                        switch (result) {
                            case (#ok(artifact)) {
                                let batchSize = endIndex - startIndex;
                                let batchBuffer = Buffer.Buffer<codeArtifacts.CodeArtifact>(batchSize);
                                var currentBatchSize = 0;
                                let maxBatchSize = 1500000; // 1.5MB safety limit
                                
                                var i = 0;
                                while (i < batchSize and startIndex + i < artifact.files.size()) {
                                    let file = artifact.files[startIndex + i];
                                    
                                    var fileSize = 1000;
                                    switch (file.content) {
                                        case (#Text(text)) { 
                                            fileSize := text.size() * 4;
                                        };
                                        case (#Binary(bytes)) { 
                                            fileSize := bytes.size();
                                        };
                                        case (#Reference(ref)) { 
                                            fileSize := 1000;
                                        };
                                    };
                                    
                                    if (currentBatchSize + fileSize > maxBatchSize and batchBuffer.size() > 0) {
                                        logger.info("Version batch size limit reached");
                                        i := batchSize;
                                    } else {
                                        let fileContent = switch (file.content) {
                                            case (#Text(text)) { #Text(text) };
                                            case (#Binary(bytes)) { #Binary(bytes) };
                                            case (#Reference(ref)) { #Text("Reference to: " # ref) };
                                        };
                                        
                                        let convertedArtifact = {
                                            id = session.projectId # ":" # file.path # "/" # file.fileName;
                                            projectId = session.projectId;
                                            fileName = file.fileName;
                                            content = ?fileContent;
                                            mimeType = file.mimeType;
                                            language = file.language;
                                            path = file.path;
                                            lastModified = Nat64.toNat(file.lastModified);
                                            size = 0;
                                            version = 0;
                                            chunks = null;
                                        };
                                        
                                        batchBuffer.add(convertedArtifact);
                                        currentBatchSize += fileSize;
                                        i += 1;
                                    };
                                };
                                
                                Buffer.toArray(batchBuffer)
                            };
                            case (#err(_)) {
                                []
                            };
                        }
                    };
                };
                
                logger.info("✅ Batch " # Nat.toText(batchIndex) # " with size checking: " # Nat.toText(batchFiles.size()) # " files");
                
                return #ok({
                    files = batchFiles;
                    isLastBatch = isLastBatch;
                });
                
            } catch (error) {
                logger.info("❌ Error processing batch: " # Error.message(error));
                return #err("Error processing batch: " # Error.message(error));
            };
        };
    };
};


public shared(msg) func cleanupProjectFilesDownloadSession(sessionId: Text) : async Result.Result<Text, Text> {
    logger.info("Cleaning up file download session: " # sessionId);
    
    switch (fileDownloadSessions.get(sessionId)) {
        case (null) {
            logger.info("❌ File download session not found: " # sessionId);
            return #err("Download session not found");
        };
        case (?session) {
            fileDownloadSessions.delete(sessionId);
            logger.info("✅ File download session cleaned up successfully: " # sessionId);
            return #ok("File download session cleaned up successfully");
        };
    };
};


public shared(msg) func getProjectStatistics(
    userPrincipal: Principal,
    projectId: Text,
    versionId: ?Text
) : async Result.Result<{
    totalFiles: Nat;
    totalEstimatedSize: Nat;
    averageFileSize: Nat;
    largeFiles: Nat; // Files > 100KB
    binaryFiles: Nat;
    textFiles: Nat;
    recommendedBatchSize: Nat;
}, Text> {
    logger.info("Getting project statistics for: " # projectId);
    
    // Check authorization
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        return #err("You don't have permission to access this project");
    };
    
    try {
        var totalFiles = 0;
        var totalEstimatedSize = 0;
        var largeFiles = 0;
        var binaryFiles = 0;
        var textFiles = 0;
        
        switch (versionId) {
            case null {
                let artifacts = getArtifactManager().getProjectArtifacts(projectId);
                totalFiles := artifacts.size();
                
                for (artifact in artifacts.vals()) {
                    var fileSize = 1000;
                    
                    switch (artifact.content) {
                        case (?content) {
                            switch (content) {
                                case (#Text(text)) { 
                                    fileSize := text.size() * 4;
                                    textFiles += 1;
                                };
                                case (#Binary(bytes)) { 
                                    fileSize := bytes.size();
                                    binaryFiles += 1;
                                };
                            };
                        };
                        case null { 
                            textFiles += 1;
                        };
                    };
                    
                    totalEstimatedSize += fileSize;
                    
                    if (fileSize > 100000) { // 100KB
                        largeFiles += 1;
                    };
                };
            };
            case (?vid) {
                let manager = getVersionManager();
                let result = manager.getVersionArtifacts(vid);
                
                switch (result) {
                    case (#ok(artifact)) {
                        totalFiles := artifact.files.size();
                        
                        for (file in artifact.files.vals()) {
                            var fileSize = 1000;
                            
                            switch (file.content) {
                                case (#Text(text)) { 
                                    fileSize := text.size() * 4;
                                    textFiles += 1;
                                };
                                case (#Binary(bytes)) { 
                                    fileSize := bytes.size();
                                    binaryFiles += 1;
                                };
                                case (#Reference(ref)) { 
                                    fileSize := 1000;
                                    textFiles += 1;
                                };
                            };
                            
                            totalEstimatedSize += fileSize;
                            
                            if (fileSize > 100000) {
                                largeFiles += 1;
                            };
                        };
                    };
                    case (#err(error)) { 
                        let errorText = switch (error) {
                            case (#ProjectNotFound) { "Project not found" };
                            case (#VersionNotFound) { "Version not found" };
                            case (#Unauthorized) { "Unauthorized access" };
                            case (#ArtifactNotFound) { "Artifact not found" };
                            case (#CanisterError) { "Canister error" };
                            case (#InvalidVersion) { "Invalid version" };
                            case (#VersionExists) { "Version already exists" };
                            case (#Other(msg)) { msg };
                        };
                        return #err("Failed to get version artifacts: " # errorText);
                    };
                };
            };
        };
        
        let averageFileSize = if (totalFiles > 0) { 
            totalEstimatedSize / totalFiles 
        } else { 
            1000 
        };
        
        // Calculate recommended batch size
        let recommendedBatchSize = if (largeFiles > totalFiles / 2) {
            // Lots of large files - use small batches
            1
        } else if (averageFileSize > 50000) {
            // Medium-large files
            2
        } else if (averageFileSize > 10000) {
            // Medium files
            5
        } else {
            // Small files
            10
        };
        
        let stats = {
            totalFiles = totalFiles;
            totalEstimatedSize = totalEstimatedSize;
            averageFileSize = averageFileSize;
            largeFiles = largeFiles;
            binaryFiles = binaryFiles;
            textFiles = textFiles;
            recommendedBatchSize = recommendedBatchSize;
        };
        
        logger.info("✅ Project statistics calculated");
        logger.info("- Total files: " # Nat.toText(totalFiles));
        logger.info("- Estimated size: " # Nat.toText(totalEstimatedSize) # " bytes");
        logger.info("- Average file size: " # Nat.toText(averageFileSize) # " bytes");
        logger.info("- Large files (>100KB): " # Nat.toText(largeFiles));
        logger.info("- Recommended batch size: " # Nat.toText(recommendedBatchSize));
        
        return #ok(stats);
        
    } catch (error) {
        logger.info("❌ Error calculating project statistics: " # Error.message(error));
        return #err("Error calculating project statistics: " # Error.message(error));
    };
};

// REPLACE the problematic switch statement in downloadLargeFileIndividually with this:

public shared(msg) func downloadLargeFileIndividually(
    userPrincipal: Principal,
    projectId: Text,
    filePath: Text,
    fileName: Text,
    versionId: ?Text
) : async Result.Result<{content: [Nat8]; mimeType: Text; size: Nat}, Text> {
    logger.info("Downloading large file individually: " # filePath # "/" # fileName);
    
    // Check authorization
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        return #err("You don't have permission to access this project");
    };
    
    try {
        // FIXED: Properly handle the optional versionId parameter
        let versionParam = switch (versionId) {
            case null { [] };
            case (?v) { [v] };
        };
        
        // Read the file
        let fileResult = await readCodeArtifact(
            userPrincipal, 
            projectId, 
            filePath, 
            fileName, 
            let versionIdParam = switch (versionId) {
                case null { null };
                case (?v) { ?v };
            }
        );
        
        switch (fileResult) {
            case (#ok(artifact)) {
                switch (artifact.content) {
                    case (?content) {
                        switch (content) {
                            case (#Binary(bytes)) {
                                logger.info("✅ Large binary file downloaded: " # Nat.toText(bytes.size()) # " bytes");
                                return #ok({
                                    content = bytes;
                                    mimeType = artifact.mimeType;
                                    size = bytes.size();
                                });
                            };
                            case (#Text(text)) {
                                let textBytes = Blob.toArray(Text.encodeUtf8(text));
                                logger.info("✅ Large text file downloaded: " # Nat.toText(textBytes.size()) # " bytes");
                                return #ok({
                                    content = textBytes;
                                    mimeType = artifact.mimeType;
                                    size = textBytes.size();
                                });
                            };
                        };
                    };
                    case null {
                        return #err("File has no content");
                    };
                };
            };
            case (#err(error)) {
                return #err("Failed to read file: " # error);
            };
        };
    } catch (error) {
        logger.info("❌ Error downloading large file: " # Error.message(error));
        return #err("Error downloading large file: " # Error.message(error));
    };
};

public func cleanupExpiredSessions() : () {
    let now = Time.now();
    let timeout = 30 * 60 * 1000000000; // 30 minutes in nanoseconds
    
    let expiredSessions = Buffer.Buffer<Text>(10);
    
    for ((sessionId, session) in fileDownloadSessions.entries()) {
        if (now - session.createdAt > timeout) {
            expiredSessions.add(sessionId);
        };
    };
    
    for (sessionId in expiredSessions.vals()) {
        fileDownloadSessions.delete(sessionId);
        logger.info("Cleaned up expired session: " # sessionId);
    };
    
    if (expiredSessions.size() > 0) {
        logger.info("Cleaned up " # Nat.toText(expiredSessions.size()) # " expired sessions");
    };
};

public query func getFileDownloadSystemHealth() : async {
    activeSessions: Nat;
    systemStatus: Text;
    recommendedAction: Text;
} {
    let activeSessions = fileDownloadSessions.size();
    
    let (systemStatus, recommendedAction) = if (activeSessions > 50) {
        ("OVERLOADED", "Consider cleaning up sessions or reducing concurrent downloads")
    } else if (activeSessions > 20) {
        ("BUSY", "Monitor session cleanup")
    } else {
        ("HEALTHY", "System operating normally")
    };
    
    {
        activeSessions = activeSessions;
        systemStatus = systemStatus;
        recommendedAction = recommendedAction;
    }
};




    // ===============================
    // EXPOSED LOGGER METHODS
    // ===============================
    
    // These methods simply delegate to the logger instance
    
    // Logger accessor functions
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

    // Query function to get all logs
    public query func getLogs() : async [Text] {
        logger.getLogs()
    };

    // Get logs since a marker
    public query func getNewLogsSince(marker: Nat, maxLogsOpt: ?Nat) : async {
        logs: [Text];
        nextMarker: Nat;
    } {
        logger.getNewLogsSince(marker, maxLogsOpt)
    };

    // Add this to your Main actor
    public func testLogSequence() : async {
        before: Nat;
        afterLog: Nat;
        afterIncrement: Nat;
    } {
        let beforeValue = logger.getCurrentSequence();
        
        // Log something to trigger the sequence increment
        logger.info("Test log entry");
        let afterLogValue = logger.getCurrentSequence();
        
        // Manually increment
        let afterIncrementValue = logger.forceAdvanceSequence(1);
        
        return {
            before = beforeValue;
            afterLog = afterLogValue;
            afterIncrement = afterIncrementValue;
        };
    };

    // Get logs by level
    public query func getLogsByLevel(level: Text) : async [Text] {
        logger.getLogsByLevel(level)
    };

    // Manual log maintenance
    public func cleanOldLogs() : async () {
        logger.cleanOldLogs();
    };

    // Clear all logs
    public func clearAllLogs() : async Nat {
        // Clear the logs
        logger.clearLogs();
        
        // Reset sequence counter to 0
        let newSequence = 0;
        let _ = logger.forceAdvanceSequence(0); // Reset to 0
        
        return newSequence;
    };

    // Configuration management
    public func updateLoggerConfig(maxSize: Nat, retentionDays: Nat) : async () {
        logger.setMaxSize(maxSize);
        logger.setRetentionDays(retentionDays);
    };

    public query func getLoggerConfig() : async L.LoggerConfig {
        logger.getConfig()
    };


    // ===============================
// PROJECT MESSAGE MANAGEMENT
// ===============================

public shared(msg) func addMessageToProject(
    projectId: Text,
    messageContent: Text,
    messageType: ChatMessageType,
    messageId: ?Text
) : async Result.Result<Text, Text> {
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        logger.info("❌ Access denied: User is not a canister controller");
        return #err("Unauthorized: only project owners can add messages");
    };
    
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null {
            logger.info("❌ Project not found: " # projectId);
            return #err("Project not found");
        };
        case (?project) {
            let generatedMessageId = switch (messageId) {
                case (?id) { id };
                case null { 
                    projectId # "_msg_" # Nat64.toText(Nat64.fromIntWrap(Time.now())) # "_" # 
                    Nat.toText(Int.abs(Time.now()) % 10000)
                };
            };
            
            let newMessage: ChatMessage = {
                id = generatedMessageId;
                messageType = messageType;
                content = messageContent;
                timestamp = Nat64.fromIntWrap(Time.now());
                isGenerating = null;
                metadata = null;
            };
            
            let currentMessages = switch (project.messages) {
                case null { [] };
                case (?msgs) { msgs };
            };
            
            let updatedMessages = Array.append(currentMessages, [newMessage]);
            let messageCount = updatedMessages.size();
            
            let updatedProject = {
                project with
                messages = ?updatedMessages;
                messageCount = ?messageCount;
                lastMessageTime = ?newMessage.timestamp;
                updated = Nat64.fromIntWrap(Time.now());
            };
            
            updateProjectInArray(updatedProject);
            logger.info("✅ Message added to project: " # projectId);
            
            return #ok(generatedMessageId);
        };
    };
};

public shared(msg) func updateMessageInProject(
    projectId: Text,
    messageId: Text,
    newContent: Text,
    isGenerating: ?Bool
) : async Result.Result<(), Text> {
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        return #err("Unauthorized: only project owners can update messages");
    };
    
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null { return #err("Project not found") };
        case (?project) {
            switch (project.messages) {
                case null { return #err("No messages found in project") };
                case (?messages) {
                    let updatedMessages = Array.map<ChatMessage, ChatMessage>(
                        messages,
                        func(msg: ChatMessage) : ChatMessage {
                            if (msg.id == messageId) {
                                {
                                    msg with
                                    content = newContent;
                                    isGenerating = isGenerating;
                                    timestamp = Nat64.fromIntWrap(Time.now());
                                }
                            } else {
                                msg
                            }
                        }
                    );
                    
                    let updatedProject = {
                        project with
                        messages = ?updatedMessages;
                        updated = Nat64.fromIntWrap(Time.now());
                    };
                    
                    updateProjectInArray(updatedProject);
                    return #ok(());
                };
            };
        };
    };
};

public query(msg) func getProjectMessages(
    projectId: Text,
    limit: ?Nat,
    offset: ?Nat
) : async Result.Result<[ChatMessage], Text> {
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null { return #err("Project not found") };
        case (?project) {
            switch (project.messages) {
                case null { return #ok([]) };
                case (?messages) {
                    let startIndex = switch (offset) {
                        case null { 0 };
                        case (?off) { off };
                    };
                    
                    let maxResults = switch (limit) {
                        case null { messages.size() };
                        case (?lim) { Nat.min(lim, 100) }; // Max 100 messages per query
                    };
                    
                    let endIndex = Nat.min(startIndex + maxResults, messages.size());
                    
                    if (startIndex >= messages.size()) {
                        return #ok([]);
                    };
                    
                    let slicedMessages = Array.subArray(messages, startIndex, endIndex - startIndex);
                    return #ok(slicedMessages);
                };
            };
        };
    };
};

public shared(msg) func clearProjectMessages(
    projectId: Text
) : async Result.Result<(), Text> {
    let isController = await isCanisterController(msg.caller);
    if (not isController) {
        return #err("Unauthorized: only project owners can clear messages");
    };
    
    switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
        case null { return #err("Project not found") };
        case (?project) {
            // Keep system welcome message
            let systemMessage: ChatMessage = {
                id = projectId # "_welcome";
                messageType = #System;
                content = "Welcome to " # project.name # "! I'm your AI development assistant. What would you like to create today?";
                timestamp = Nat64.fromIntWrap(Time.now());
                isGenerating = null;
                metadata = null;
            };
            
            let updatedProject = {
                project with
                messages = ?[systemMessage];
                messageCount = ?1;
                lastMessageTime = ?systemMessage.timestamp;
                updated = Nat64.fromIntWrap(Time.now());
            };
            
            updateProjectInArray(updatedProject);
            return #ok(());
        };
    };
};

    // ===============================
    // USER ACCOUNT MANAGEMENT
    // ===============================



    // ===============================
    // PROJECT METADATA MANAGEMENT
    // ===============================

    public shared(msg) func updateProjectMetadata(
        projectId: Text,
        metadata: ProjectMetadata
    ) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only project owners can update metadata");
        };
        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null { return #err("Project not found") };
            case (?project) {
                let updatedMetadata = {
                    customIcon = metadata.customIcon;
                    customColor = metadata.customColor;
                    tags = metadata.tags;
                    category = metadata.category;
                    priority = metadata.priority;
                    lastAccessed = ?Nat64.fromIntWrap(Time.now());
                    fileCount = metadata.fileCount;
                    estimatedSize = metadata.estimatedSize;
                    thumbnailUrl = metadata.thumbnailUrl;
                    notes = metadata.notes;
                    isBookmarked = metadata.isBookmarked;
                    completionStatus = metadata.completionStatus;
                    difficultyLevel = metadata.difficultyLevel;
                    learningObjectives = metadata.learningObjectives;
                    externalLinks = metadata.externalLinks;
                };
                
                let updatedProject = {
                    project with
                    metadata = ?updatedMetadata;
                    updated = Nat64.fromIntWrap(Time.now());
                };
                
                updateProjectInArray(updatedProject);
                logger.info("✅ Project metadata updated: " # projectId);
                return #ok(());
            };
        };
    };

    public query(msg) func getProjectMetadata(
        projectId: Text
    ) : async Result.Result<ProjectMetadata, Text> {
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null { return #err("Project not found") };
            case (?project) {
                switch (project.metadata) {
                    case null {
                        // Return default metadata
                        let defaultMetadata: ProjectMetadata = {
                            customIcon = null;
                            customColor = null;
                            tags = [];
                            category = null;
                            priority = null;
                            lastAccessed = null;
                            fileCount = null;
                            estimatedSize = null;
                            thumbnailUrl = null;
                            notes = null;
                            isBookmarked = null;
                            completionStatus = null;
                            difficultyLevel = null;
                            learningObjectives = null;
                            externalLinks = null;
                        };
                        return #ok(defaultMetadata);
                    };
                    case (?meta) { return #ok(meta) };
                };
            };
        };
    };

    public shared(msg) func markProjectAccessed(
        projectId: Text
    ) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized");
        };
        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null { return #err("Project not found") };
            case (?project) {
                let currentMetadata = switch (project.metadata) {
                    case null {
                        {
                            customIcon = null;
                            customColor = null;
                            tags = [];
                            category = null;
                            priority = null;
                            lastAccessed = null;
                            fileCount = null;
                            estimatedSize = null;
                            thumbnailUrl = null;
                            notes = null;
                            isBookmarked = null;
                            completionStatus = null;
                            difficultyLevel = null;
                            learningObjectives = null;
                            externalLinks = null;
                        };
                    };
                    case (?meta) { meta };
                };
                
                let updatedMetadata = {
                    currentMetadata with
                    lastAccessed = ?Nat64.fromIntWrap(Time.now());
                };
                
                let updatedProject = {
                    project with
                    metadata = ?updatedMetadata;
                };
                
                updateProjectInArray(updatedProject);
                return #ok(());
            };
        };
    };
    
    // ===============================
    // SMART DEPLOYMENT TRACKING
    // ===============================
    
    // Mark backend files as changed (sets hasBackendChanged flag)
    public shared(msg) func markBackendChanged(projectId: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only project owners can mark deployment changes");
        };
        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null { return #err("Project not found") };
            case (?project) {
                let updatedProject = {
                    project with
                    hasBackendChanged = ?true;
                    updated = Nat64.fromIntWrap(Time.now());
                };
                
                updateProjectInArray(updatedProject);
                logger.info("✅ Backend marked as changed for project: " # projectId);
                return #ok(());
            };
        };
    };
    
    // Mark frontend files as changed (sets hasFrontendChanged flag)
    public shared(msg) func markFrontendChanged(projectId: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only project owners can mark deployment changes");
        };
        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null { return #err("Project not found") };
            case (?project) {
                let updatedProject = {
                    project with
                    hasFrontendChanged = ?true;
                    updated = Nat64.fromIntWrap(Time.now());
                };
                
                updateProjectInArray(updatedProject);
                logger.info("✅ Frontend marked as changed for project: " # projectId);
                return #ok(());
            };
        };
    };
    
    // Clear backend changed flag after successful deployment
    public shared(msg) func clearBackendChangedFlag(projectId: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only project owners can clear deployment flags");
        };
        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null { return #err("Project not found") };
            case (?project) {
                let now = Nat64.fromIntWrap(Time.now());
                let updatedProject = {
                    project with
                    hasBackendChanged = ?false;
                    lastBackendDeployment = ?now;
                    updated = now;
                };
                
                updateProjectInArray(updatedProject);
                logger.info("✅ Backend deployment flag cleared for project: " # projectId);
                return #ok(());
            };
        };
    };
    
    // Clear frontend changed flag after successful deployment
    public shared(msg) func clearFrontendChangedFlag(projectId: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only project owners can clear deployment flags");
        };
        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null { return #err("Project not found") };
            case (?project) {
                let now = Nat64.fromIntWrap(Time.now());
                let updatedProject = {
                    project with
                    hasFrontendChanged = ?false;
                    lastFrontendDeployment = ?now;
                    updated = now;
                };
                
                updateProjectInArray(updatedProject);
                logger.info("✅ Frontend deployment flag cleared for project: " # projectId);
                return #ok(());
            };
        };
    };
    
    // Mark both flags when server pair changes (force full redeploy)
    public shared(msg) func markServerPairChanged(projectId: Text, serverPairId: Text) : async Result.Result<(), Text> {
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            return #err("Unauthorized: only project owners can mark server pair changes");
        };
        
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null { return #err("Project not found") };
            case (?project) {
                let updatedProject = {
                    project with
                    hasBackendChanged = ?true;
                    hasFrontendChanged = ?true;
                    lastDeploymentServerPairId = ?serverPairId;
                    updated = Nat64.fromIntWrap(Time.now());
                };
                
                updateProjectInArray(updatedProject);
                logger.info("✅ Full redeploy marked due to server pair change for project: " # projectId);
                return #ok(());
            };
        };
    };
    
    // Get deployment tracking flags for a project
    public query func getDeploymentFlags(projectId: Text) : async Result.Result<{
        hasBackendChanged: Bool;
        hasFrontendChanged: Bool;
        lastBackendDeployment: ?Nat64;
        lastFrontendDeployment: ?Nat64;
        lastDeploymentServerPairId: ?Text;
    }, Text> {
        switch (Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })) {
            case null { return #err("Project not found") };
            case (?project) {
                // Default to true if flags are not set (first deploy or migrated projects)
                let hasBackendChanged = switch (project.hasBackendChanged) {
                    case (?flag) { flag };
                    case null { true }; // Force deploy if not set
                };
                
                let hasFrontendChanged = switch (project.hasFrontendChanged) {
                    case (?flag) { flag };
                    case null { true }; // Force deploy if not set
                };
                
                return #ok({
                    hasBackendChanged = hasBackendChanged;
                    hasFrontendChanged = hasFrontendChanged;
                    lastBackendDeployment = project.lastBackendDeployment;
                    lastFrontendDeployment = project.lastFrontendDeployment;
                    lastDeploymentServerPairId = project.lastDeploymentServerPairId;
                });
            };
        };
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC PROFILE METHODS (User Business Card)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Get public profile for this user (accessible by anyone)
     */
    public query func getPublicProfile() : async ?AccountTypes.PublicProfile {
        userPublicProfile
    };
    
    /**
     * Update public profile (owner only)
     */
    public shared(msg) func updatePublicProfile(profile: AccountTypes.PublicProfile) : async Result.Result<(), Text> {
        // Verify caller is a controller of this canister (same pattern as other update methods)
        let isController = await isCanisterController(msg.caller);
        if (not isController) {
            logger.error("❌ Unauthorized public profile update attempt by: " # Principal.toText(msg.caller));
            return #err("Unauthorized: You can only update your own profile");
        };
        
        logger.info("📝 Updating public profile");
        
        let now = Time.now();
        let updatedProfile = {
            displayName = profile.displayName;
            bio = profile.bio;
            tagline = profile.tagline;
            avatarUrl = profile.avatarUrl;
            bannerUrl = profile.bannerUrl;
            location = profile.location;
            timezone = profile.timezone;
            website = profile.website;
            email = profile.email;
            socialLinks = profile.socialLinks;
            title = profile.title;
            company = profile.company;
            skills = profile.skills;
            interests = profile.interests;
            featuredProjects = profile.featuredProjects;
            showMarketplace = profile.showMarketplace;
            showStats = profile.showStats;
            customSections = profile.customSections;
            isPublic = profile.isPublic;
            theme = profile.theme;
            createdAt = switch (userPublicProfile) {
                case (?existing) { existing.createdAt };
                case null { Nat64.fromNat(Int.abs(now)) };
            };
            updatedAt = Nat64.fromNat(Int.abs(now));
            profileViews = switch (userPublicProfile) {
                case (?existing) { existing.profileViews };
                case null { 0 };
            };
        };
        
        userPublicProfile := ?updatedProfile;
        logger.info("✅ Public profile updated successfully");
        #ok(())
    };
    
    /**
     * Get public profile stats (accessible by anyone)
     */
    public query func getPublicProfileStats() : async AccountTypes.PublicProfileStats {
        let projectCount = Array.size(userProjects);
        
        // Count total deployments across all projects
        var totalDeployments = 0;
        for (project in userProjects.vals()) {
            totalDeployments += Array.size(project.canisters);
        };
        
        // Count marketplace listings (would need to query platform canister)
        let marketplaceListings : Nat = 0; // TODO: Query platform canister
        
        let views : Nat = switch (userPublicProfile) {
            case (?profile) { profile.profileViews };
            case null { 0 };
        };
        
        let joined : Nat64 = switch (userData) {
            case (?user) { user.created };
            case null { 0 };
        };
        
        {
            totalProjects = projectCount;
            totalDeployments = totalDeployments;
            marketplaceListings = marketplaceListings;
            profileViews = views;
            joinedDate = joined;
        }
    };
    
    /**
     * Increment profile view count
     */
    public func incrementProfileViews() : async () {
        switch (userPublicProfile) {
            case (?profile) {
                let updatedProfile = {
                    displayName = profile.displayName;
                    bio = profile.bio;
                    tagline = profile.tagline;
                    avatarUrl = profile.avatarUrl;
                    bannerUrl = profile.bannerUrl;
                    location = profile.location;
                    timezone = profile.timezone;
                    website = profile.website;
                    email = profile.email;
                    socialLinks = profile.socialLinks;
                    title = profile.title;
                    company = profile.company;
                    skills = profile.skills;
                    interests = profile.interests;
                    featuredProjects = profile.featuredProjects;
                    showMarketplace = profile.showMarketplace;
                    showStats = profile.showStats;
                    customSections = profile.customSections;
                    isPublic = profile.isPublic;
                    theme = profile.theme;
                    createdAt = profile.createdAt;
                    updatedAt = profile.updatedAt;
                    profileViews = profile.profileViews + 1;
                };
                userPublicProfile := ?updatedProfile;
            };
            case null { /* No profile to increment */ };
        };
    };
    
    /**
     * Get featured projects with full details (for public profile display)
     */
    public query func getFeaturedProjects() : async [Project] {
        switch (userPublicProfile) {
            case (?profile) {
                if (not profile.isPublic) {
                    return [];
                };
                
                // Filter projects to only featured ones
                let featuredIds = profile.featuredProjects;
                Array.filter<Project>(
                    userProjects,
                    func(p) {
                        Array.find<Text>(featuredIds, func(id) { id == p.id }) != null
                    }
                )
            };
            case null { [] };
        }
    };
    
    // ===============================
    // SYSTEM LIFECYCLE METHODS
    // ===============================
    
    system func preupgrade() {
        // Persist project → server pairs mapping
        projectServerPairsEntries := Iter.toArray(projectServerPairs.entries());
        Debug.print("✅ [PREUPGRADE] Persisted " # Nat.toText(Array.size(projectServerPairsEntries)) # " project → server pair mappings");
    };
    
    system func postupgrade() {
        // Update stableLogger for next upgrade
        stableLogger := ?logger.toStable();
        Debug.print("Post-upgrade: Logger state preserved");
        
        // Rest of your postupgrade code...
        transientState := HashMap.HashMap<Text, Text>(10, Text.equal, Text.hash);
        for ((key, value) in state.vals()) {
            transientState.put(key, value);
        };
        Debug.print("Post-upgrade completed successfully");

        // Restore server pairs HashMap
        for ((pairId, pair) in serverPairsEntries.vals()) {
            serverPairs.put(pairId, pair);
        };
        
        // 🚀 MIGRATION: Restore project → server pairs mapping
        for ((projectId, pairIds) in projectServerPairsEntries.vals()) {
            projectServerPairs.put(projectId, pairIds);
        };
        Debug.print("✅ Restored " # Nat.toText(projectServerPairs.size()) # " project → server pair mappings");
        
        // 🚀 MIGRATION: Auto-populate project mappings for existing server pairs (one-time migration)
        // Only runs if projectServerPairs is empty but we have server pairs and projects
        if (projectServerPairs.size() == 0 and serverPairs.size() > 0) {
            Debug.print("🔄 [MIGRATION] Detected existing server pairs without project mapping - running migration...");
            
            // Build reverse lookup: canisterId → projectId
            var canisterToProject = HashMap.HashMap<Principal, Text>(64, Principal.equal, Principal.hash);
            
            // Scan all user canisters and build the mapping
            for (canisterMeta in userCanisterMetadata.vals()) {
                let (principal, metadata) = canisterMeta;
                switch (metadata.project) {
                    case (?projectId) {
                        canisterToProject.put(principal, projectId);
                    };
                    case null { /* Skip canisters without project association */ };
                };
            };
            
            Debug.print("🔄 [MIGRATION] Built canister → project mapping with " # Nat.toText(canisterToProject.size()) # " entries");
            
            // Assign each server pair to its project
            var migratedCount = 0;
            for ((pairId, pair) in serverPairs.entries()) {
                let frontendProject = canisterToProject.get(pair.frontendCanisterId);
                let backendProject = canisterToProject.get(pair.backendCanisterId);
                
                // Both canisters should belong to the same project
                switch (frontendProject, backendProject) {
                    case (?frontProj, ?backProj) {
                        if (frontProj == backProj) {
                            // Add to project mapping
                            let existingPairs = Option.get(projectServerPairs.get(frontProj), []);
                            let updatedPairs = Array.append(existingPairs, [pairId]);
                            projectServerPairs.put(frontProj, updatedPairs);
                            migratedCount += 1;
                            Debug.print("✅ [MIGRATION] Assigned server pair " # pairId # " to project " # frontProj);
                        } else {
                            Debug.print("⚠️ [MIGRATION] Server pair " # pairId # " has mismatched projects: frontend=" # frontProj # ", backend=" # backProj);
                        };
                    };
                    case _ {
                        Debug.print("⚠️ [MIGRATION] Server pair " # pairId # " has canisters not associated with any project - skipping");
                    };
                };
            };
            
            Debug.print("✅ [MIGRATION] Completed! Migrated " # Nat.toText(migratedCount) # " server pairs to project mappings");
        };
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 📁 PROJECT FILE STORAGE - General purpose file storage for users
    // ═══════════════════════════════════════════════════════════════════════════

    // Stable storage for user files
    private stable var storedFilesEntries: [(Text, ProjectTypes.StoredFile)] = [];
    private var storedFiles = HashMap.HashMap<Text, ProjectTypes.StoredFile>(0, Text.equal, Text.hash);

    private stable var fileBlobsEntries: [(Text, Blob)] = [];
    private var fileBlobs = HashMap.HashMap<Text, Blob>(0, Text.equal, Text.hash);

    private stable var fileChunksStoreEntries: [(Text, [Blob])] = [];
    private var fileChunksStore = HashMap.HashMap<Text, [Blob]>(0, Text.equal, Text.hash);

    private stable var fileUploadSessionsEntries: [(Text, ProjectTypes.FileUploadSession)] = [];
    private var fileUploadSessions = HashMap.HashMap<Text, ProjectTypes.FileUploadSession>(0, Text.equal, Text.hash);

    private stable var fileShareLinksEntries: [(Text, ProjectTypes.FileShareLink)] = [];
    private var fileShareLinks = HashMap.HashMap<Text, ProjectTypes.FileShareLink>(0, Text.equal, Text.hash);

    private stable var nextFileId: Nat = 1;
    private stable var nextFileSessionId: Nat = 1;
    private stable var nextFileShareLinkId: Nat = 1;

    // Constants for file storage
    private let MAX_FILE_SIZE: Nat = 50_000_000; // 50MB max per file
    private let FILE_CHUNK_SIZE: Nat = 1_900_000; // 1.9MB chunks
    private let UPLOAD_SESSION_EXPIRY: Nat64 = 86_400_000_000_000; // 24 hours

    // Allowed MIME types for file upload
    private func isAllowedMimeType(mimeType: Text) : Bool {
        let allowedTypes = [
            // Images
            "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp",
            // Documents
            "application/pdf", "text/plain", "text/csv", "text/markdown",
            "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            // Code files
            "text/html", "text/css", "text/javascript", "application/json", "application/xml",
            "text/x-python", "text/x-java", "text/x-c", "text/x-c++",
            // Archives
            "application/zip", "application/x-rar-compressed", "application/x-7z-compressed", "application/gzip",
            // Video
            "video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/webm",
            // Audio
            "audio/mpeg", "audio/wav", "audio/webm", "audio/ogg",
            // Other
            "application/octet-stream" // Generic binary
        ];
        
        Array.foldLeft<Text, Bool>(
            allowedTypes,
            false,
            func(acc: Bool, allowed: Text): Bool {
                acc or Text.equal(mimeType, allowed)
            }
        )
    };

    // Sanitize file name
    private func sanitizeStorageFileName(fileName: Text) : Text {
        var sanitized = fileName;
        sanitized := Text.replace(sanitized, #text "/", "_");
        sanitized := Text.replace(sanitized, #text "\\", "_");
        sanitized := Text.replace(sanitized, #text "..", "_");
        sanitized := Text.replace(sanitized, #text ":", "_");
        sanitized := Text.replace(sanitized, #text "*", "_");
        sanitized := Text.replace(sanitized, #text "?", "_");
        sanitized := Text.replace(sanitized, #text "\"", "_");
        sanitized := Text.replace(sanitized, #text "<", "_");
        sanitized := Text.replace(sanitized, #text ">", "_");
        sanitized := Text.replace(sanitized, #text "|", "_");
        
        if (Text.size(sanitized) > 255) {
            let hashValue = Text.hash(sanitized);
            let hashText = Nat32.toText(hashValue);
            "file_" # hashText
        } else {
            sanitized
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FILE UPLOAD - Small files (<2MB)
    // ═══════════════════════════════════════════════════════════════════════════

    public shared(msg) func uploadProjectFile(
        projectId: Text,
        fileName: Text,
        mimeType: Text,
        fileData: Blob,
        visibility: ProjectTypes.FileVisibility,
        tags: [Text],
        description: ?Text,
        category: ?Text
    ) : async Result.Result<ProjectTypes.StoredFile, Text> {
        // Verify project exists
        switch (findProject(projectId)) {
            case (?project) {
                // Validate inputs
                if (Text.size(fileName) == 0) {
                    return #err("File name is required");
                };
                
                if (not isAllowedMimeType(mimeType)) {
                    return #err("MIME type not allowed: " # mimeType);
                };
                
                let fileSize = fileData.size();
                
                if (fileSize > 2_000_000) {
                    return #err("File too large for direct upload. Use chunked upload for files over 2MB");
                };
                
                if (fileSize == 0) {
                    return #err("File cannot be empty");
                };
                
                let now = Nat64.fromNat(Int.abs(Time.now()));
                let fileId = projectId # "_file_" # Nat.toText(nextFileId);
                nextFileId += 1;
                
                let sanitizedFileName = sanitizeStorageFileName(fileName);
                let checksum = generateChecksum(fileData);
                
                let storedFile: ProjectTypes.StoredFile = {
                    id = fileId;
                    projectId = projectId;
                    fileName = sanitizedFileName;
                    fileSize = fileSize;
                    mimeType = mimeType;
                    visibility = visibility;
                    uploadedBy = msg.caller;
                    created = now;
                    updated = now;
                    isChunked = false;
                    totalChunks = null;
                    checksum = checksum;
                    tags = tags;
                    description = description;
                    category = category;
                };
                
                storedFiles.put(fileId, storedFile);
                fileBlobs.put(fileId, fileData);
                
                #ok(storedFile)
            };
            case null {
                #err("Project not found")
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FILE UPLOAD - Chunked (>2MB)
    // ═══════════════════════════════════════════════════════════════════════════

    public shared(msg) func startFileUploadSession(
        projectId: Text,
        fileName: Text,
        mimeType: Text,
        totalChunks: Nat,
        totalSize: Nat
    ) : async Result.Result<Text, Text> {
        // Verify project exists
        switch (findProject(projectId)) {
            case (?project) {
                if (not isAllowedMimeType(mimeType)) {
                    return #err("MIME type not allowed: " # mimeType);
                };
                
                if (totalSize > MAX_FILE_SIZE) {
                    return #err("File too large. Maximum size: " # Nat.toText(MAX_FILE_SIZE) # " bytes");
                };
                
                let now = Nat64.fromNat(Int.abs(Time.now()));
                let sessionId = projectId # "_session_" # Nat.toText(nextFileSessionId);
                nextFileSessionId += 1;
                
                let session: ProjectTypes.FileUploadSession = {
                    sessionId = sessionId;
                    projectId = projectId;
                    fileName = sanitizeStorageFileName(fileName);
                    mimeType = mimeType;
                    totalChunks = totalChunks;
                    uploadedChunks = [];
                    startedAt = now;
                    expiresAt = now + UPLOAD_SESSION_EXPIRY;
                    uploadedBy = msg.caller;
                };
                
                fileUploadSessions.put(sessionId, session);
                #ok(sessionId)
            };
            case null {
                #err("Project not found")
            };
        }
    };

    public shared(msg) func uploadFileChunkToSession(
        sessionId: Text,
        chunkIndex: Nat,
        chunkData: Blob
    ) : async Result.Result<{ completed: Bool; progress: Nat }, Text> {
        switch (fileUploadSessions.get(sessionId)) {
            case (?session) {
                // Verify ownership
                if (session.uploadedBy != msg.caller) {
                    return #err("Unauthorized: Session belongs to different user");
                };
                
                // Check expiration
                let now = Nat64.fromNat(Int.abs(Time.now()));
                if (now > session.expiresAt) {
                    fileUploadSessions.delete(sessionId);
                    return #err("Upload session expired");
                };
                
                // Validate chunk index
                if (chunkIndex >= session.totalChunks) {
                    return #err("Chunk index out of range");
                };
                
                // Get existing chunks for this session
                let existingChunks = switch (fileChunksStore.get(sessionId)) {
                    case (?chunks) { chunks };
                    case null { Array.tabulate<Blob>(session.totalChunks, func(_: Nat): Blob { Blob.fromArray([]) }) };
                };
                
                // Store chunk at correct index
                let updatedChunks = Array.tabulate<Blob>(session.totalChunks, func(i: Nat): Blob {
                    if (i == chunkIndex) { chunkData }
                    else { existingChunks[i] }
                });
                
                fileChunksStore.put(sessionId, updatedChunks);
                
                // Update uploaded chunks list
                let newUploadedChunks = if (Array.find<Nat>(session.uploadedChunks, func(idx: Nat): Bool { idx == chunkIndex }) == null) {
                    Array.append<Nat>(session.uploadedChunks, [chunkIndex])
                } else {
                    session.uploadedChunks
                };
                
                let updatedSession: ProjectTypes.FileUploadSession = {
                    sessionId = session.sessionId;
                    projectId = session.projectId;
                    fileName = session.fileName;
                    mimeType = session.mimeType;
                    totalChunks = session.totalChunks;
                    uploadedChunks = newUploadedChunks;
                    startedAt = session.startedAt;
                    expiresAt = session.expiresAt;
                    uploadedBy = session.uploadedBy;
                };
                
                fileUploadSessions.put(sessionId, updatedSession);
                
                let completed = newUploadedChunks.size() == session.totalChunks;
                let progress = (newUploadedChunks.size() * 100) / session.totalChunks;
                
                #ok({ completed = completed; progress = progress })
            };
            case null {
                #err("Upload session not found")
            };
        }
    };

    public shared(msg) func completeFileUpload(
        sessionId: Text,
        visibility: ProjectTypes.FileVisibility,
        tags: [Text],
        description: ?Text,
        category: ?Text
    ) : async Result.Result<ProjectTypes.StoredFile, Text> {
        switch (fileUploadSessions.get(sessionId)) {
            case (?session) {
                if (session.uploadedBy != msg.caller) {
                    return #err("Unauthorized");
                };
                
                // Verify all chunks uploaded
                if (session.uploadedChunks.size() != session.totalChunks) {
                    return #err("Not all chunks uploaded: " # Nat.toText(session.uploadedChunks.size()) # "/" # Nat.toText(session.totalChunks));
                };
                
                // Get chunks
                switch (fileChunksStore.get(sessionId)) {
                    case (?chunks) {
                        // Assemble file
                        var assembledBlob = Buffer.Buffer<Nat8>(0);
                        for (chunk in chunks.vals()) {
                            let chunkArray = Blob.toArray(chunk);
                            for (byte in chunkArray.vals()) {
                                assembledBlob.add(byte);
                            };
                        };
                        
                        let fileData = Blob.fromArray(Buffer.toArray(assembledBlob));
                        let fileSize = fileData.size();
                        
                        let now = Nat64.fromNat(Int.abs(Time.now()));
                        let fileId = session.projectId # "_file_" # Nat.toText(nextFileId);
                        nextFileId += 1;
                        
                        let checksum = generateChecksum(fileData);
                        
                        let storedFile: ProjectTypes.StoredFile = {
                            id = fileId;
                            projectId = session.projectId;
                            fileName = session.fileName;
                            fileSize = fileSize;
                            mimeType = session.mimeType;
                            visibility = visibility;
                            uploadedBy = msg.caller;
                            created = now;
                            updated = now;
                            isChunked = true;
                            totalChunks = ?session.totalChunks;
                            checksum = checksum;
                            tags = tags;
                            description = description;
                            category = category;
                        };
                        
                        // Store as chunks for efficient serving
                        storedFiles.put(fileId, storedFile);
                        fileChunksStore.put(fileId, chunks);
                        
                        // Cleanup session
                        fileUploadSessions.delete(sessionId);
                        fileChunksStore.delete(sessionId);
                        
                        #ok(storedFile)
                    };
                    case null {
                        #err("Chunks not found")
                    };
                }
            };
            case null {
                #err("Upload session not found")
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FILE MANAGEMENT - GET/UPDATE/DELETE
    // ═══════════════════════════════════════════════════════════════════════════

    public query(msg) func getStoredFiles(projectId: Text) : async [ProjectTypes.StoredFile] {
        let allFiles = Iter.toArray(storedFiles.vals());
        Array.filter<ProjectTypes.StoredFile>(
            allFiles,
            func(file: ProjectTypes.StoredFile): Bool {
                file.projectId == projectId
            }
        )
    };

    public query(msg) func getStoredFile(fileId: Text) : async ?ProjectTypes.StoredFile {
        storedFiles.get(fileId)
    };

    public query(msg) func getStoredFilesByCategory(projectId: Text, category: Text) : async [ProjectTypes.StoredFile] {
        let allFiles = Iter.toArray(storedFiles.vals());
        Array.filter<ProjectTypes.StoredFile>(
            allFiles,
            func(file: ProjectTypes.StoredFile): Bool {
                file.projectId == projectId and (
                    switch (file.category) {
                        case (?cat) { cat == category };
                        case null { false };
                    }
                )
            }
        )
    };

    public shared(msg) func updateFileMetadata(
        fileId: Text,
        fileName: ?Text,
        visibility: ?ProjectTypes.FileVisibility,
        tags: ?[Text],
        description: ?(?Text),
        category: ?(?Text)
    ) : async Result.Result<(), Text> {
        switch (storedFiles.get(fileId)) {
            case (?file) {
                if (file.uploadedBy != msg.caller) {
                    return #err("Unauthorized");
                };
                
                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                let updated: ProjectTypes.StoredFile = {
                    id = file.id;
                    projectId = file.projectId;
                    fileName = switch (fileName) {
                        case (?name) { sanitizeStorageFileName(name) };
                        case null { file.fileName };
                    };
                    fileSize = file.fileSize;
                    mimeType = file.mimeType;
                    visibility = Option.get(visibility, file.visibility);
                    uploadedBy = file.uploadedBy;
                    created = file.created;
                    updated = now;
                    isChunked = file.isChunked;
                    totalChunks = file.totalChunks;
                    checksum = file.checksum;
                    tags = Option.get(tags, file.tags);
                    description = switch (description) {
                        case (?newDesc) { newDesc };
                        case null { file.description };
                    };
                    category = switch (category) {
                        case (?newCat) { newCat };
                        case null { file.category };
                    };
                };
                
                storedFiles.put(fileId, updated);
                #ok()
            };
            case null {
                #err("File not found")
            };
        }
    };

    public shared(msg) func deleteProjectFile(fileId: Text) : async Result.Result<(), Text> {
        switch (storedFiles.get(fileId)) {
            case (?file) {
                if (file.uploadedBy != msg.caller) {
                    return #err("Unauthorized");
                };
                
                // Delete all associated data
                storedFiles.delete(fileId);
                fileBlobs.delete(fileId);
                fileChunksStore.delete(fileId);
                
                // Delete associated share links
                let links = Iter.toArray(fileShareLinks.vals());
                for (link in links.vals()) {
                    if (link.fileId == fileId) {
                        fileShareLinks.delete(link.linkId);
                    };
                };
                
                #ok()
            };
            case null {
                #err("File not found")
            };
        }
    };

    public query(msg) func getStorageUsage(projectId: Text) : async Nat {
        let allFiles = Iter.toArray(storedFiles.vals());
        let projectFiles = Array.filter<ProjectTypes.StoredFile>(
            allFiles,
            func(file: ProjectTypes.StoredFile): Bool {
                file.projectId == projectId
            }
        );
        
        Array.foldLeft<ProjectTypes.StoredFile, Nat>(
            projectFiles,
            0,
            func(acc: Nat, file: ProjectTypes.StoredFile): Nat {
                acc + file.fileSize
            }
        )
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FILE SHARING - Create share links
    // ═══════════════════════════════════════════════════════════════════════════

    public shared(msg) func createFileShareLink(
        fileId: Text,
        expiresInSeconds: ?Nat,
        maxDownloads: ?Nat
    ) : async Result.Result<{ linkId: Text; token: Text; url: Text }, Text> {
        switch (storedFiles.get(fileId)) {
            case (?file) {
                if (file.uploadedBy != msg.caller) {
                    return #err("Unauthorized");
                };
                
                let now = Nat64.fromNat(Int.abs(Time.now()));
                let linkId = fileId # "_link_" # Nat.toText(nextFileShareLinkId);
                nextFileShareLinkId += 1;
                
                let tokenSeed = Principal.toText(msg.caller) # fileId # Nat64.toText(now) # linkId;
                let tokenHash = Text.hash(tokenSeed);
                let token = "share_" # Nat32.toText(tokenHash);
                
                let expiresAt = switch (expiresInSeconds) {
                    case (?seconds) {
                        let secondsNano = Nat64.fromNat(seconds) * 1_000_000_000;
                        ?(now + secondsNano)
                    };
                    case null { null };
                };
                
                let shareLink: ProjectTypes.FileShareLink = {
                    linkId = linkId;
                    fileId = fileId;
                    token = token;
                    createdBy = msg.caller;
                    createdAt = now;
                    expiresAt = expiresAt;
                    maxDownloads = maxDownloads;
                    downloadCount = 0;
                    isRevoked = false;
                    revokedAt = null;
                };
                
                fileShareLinks.put(linkId, shareLink);
                
                // TODO: Replace with actual canister ID
                let canisterId = "your-canister-id";
                let url = "https://" # canisterId # ".raw.icp0.io/file/" # token;
                
                #ok({ linkId = linkId; token = token; url = url })
            };
            case null {
                #err("File not found")
            };
        }
    };

    public shared(msg) func revokeFileShareLink(linkId: Text) : async Result.Result<(), Text> {
        switch (fileShareLinks.get(linkId)) {
            case (?link) {
                if (link.createdBy != msg.caller) {
                    return #err("Unauthorized");
                };
                
                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                let updated: ProjectTypes.FileShareLink = {
                    linkId = link.linkId;
                    fileId = link.fileId;
                    token = link.token;
                    createdBy = link.createdBy;
                    createdAt = link.createdAt;
                    expiresAt = link.expiresAt;
                    maxDownloads = link.maxDownloads;
                    downloadCount = link.downloadCount;
                    isRevoked = true;
                    revokedAt = ?now;
                };
                
                fileShareLinks.put(linkId, updated);
                #ok()
            };
            case null {
                #err("Share link not found")
            };
        }
    };

    public query(msg) func getFileShareLinks(fileId: Text) : async [ProjectTypes.FileShareLink] {
        let allLinks = Iter.toArray(fileShareLinks.vals());
        Array.filter<ProjectTypes.FileShareLink>(
            allLinks,
            func(link: ProjectTypes.FileShareLink): Bool {
                link.fileId == fileId
            }
        )
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // HTTP FILE SERVING - Serve files via share links
    // ═══════════════════════════════════════════════════════════════════════════

    private func serveSharedFile(token: Text) : HttpResponse {
        // Find share link by token
        let allLinks = Iter.toArray(fileShareLinks.vals());
        let linkOpt = Array.find<ProjectTypes.FileShareLink>(
            allLinks,
            func(link: ProjectTypes.FileShareLink): Bool {
                link.token == token
            }
        );
        
        switch (linkOpt) {
            case (?link) {
                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                // Check if revoked
                if (link.isRevoked) {
                    return createHttpError(403, "Share link has been revoked");
                };
                
                // Check expiration
                switch (link.expiresAt) {
                    case (?expiresAt) {
                        if (now > expiresAt) {
                            return createHttpError(403, "Share link has expired");
                        };
                    };
                    case null {};
                };
                
                // Check download limit
                switch (link.maxDownloads) {
                    case (?maxDownloads) {
                        if (link.downloadCount >= maxDownloads) {
                            return createHttpError(403, "Download limit reached");
                        };
                    };
                    case null {};
                };
                
                // Serve the file
                switch (storedFiles.get(link.fileId)) {
                    case (?file) {
                        // Increment download count (note: in query context, can't update state)
                        // In production, would need an update call after download
                        
                        if (file.isChunked) {
                            return serveChunkedFile(file, token);
                        } else {
                            return serveDirectFile(file);
                        }
                    };
                    case null {
                        return createHttpError(404, "File not found");
                    };
                }
            };
            case null {
                return createHttpError(404, "Invalid share token");
            };
        }
    };

    private func serveDirectFile(file: ProjectTypes.StoredFile) : HttpResponse {
        switch (fileBlobs.get(file.id)) {
            case (?blob) {
                {
                    status_code = 200;
                    headers = [
                        ("Content-Type", file.mimeType),
                        ("Content-Disposition", "inline; filename=\"" # file.fileName # "\""),
                        ("Content-Length", Nat.toText(file.fileSize)),
                        ("Cache-Control", "public, max-age=3600")
                    ];
                    body = blob;
                    streaming_strategy = null;
                }
            };
            case null {
                createHttpError(404, "File data not found")
            };
        }
    };

    private func serveChunkedFile(file: ProjectTypes.StoredFile, token: Text) : HttpResponse {
        switch (fileChunksStore.get(file.id)) {
            case (?chunks) {
                if (chunks.size() == 0) {
                    return createHttpError(500, "No chunks found");
                };
                
                {
                    status_code = 200;
                    headers = [
                        ("Content-Type", file.mimeType),
                        ("Content-Disposition", "inline; filename=\"" # file.fileName # "\""),
                        ("Content-Length", Nat.toText(file.fileSize)),
                        ("Cache-Control", "public, max-age=3600")
                    ];
                    body = chunks[0];
                    streaming_strategy = if (chunks.size() > 1) {
                        ?#Callback({
                            token = {
                                exportId = file.id;
                                chunkIndex = 1;
                                tokenId = token;
                            };
                            callback = streamProjectChunk;
                        })
                    } else {
                        null
                    };
                }
            };
            case null {
                createHttpError(404, "File chunks not found")
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 🛒 MARKETPLACE - PROJECT EXPORT & DOWNLOAD SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    // Stable storage for marketplace features
    private stable var marketplaceListingsEntries: [(Text, ProjectTypes.MarketplaceListing)] = [];
    private var marketplaceListings = HashMap.HashMap<Text, ProjectTypes.MarketplaceListing>(0, Text.equal, Text.hash);

    private stable var projectExportsEntries: [(Text, ProjectTypes.ProjectExport)] = [];
    private var projectExports = HashMap.HashMap<Text, ProjectTypes.ProjectExport>(0, Text.equal, Text.hash);

    private stable var exportBlobsEntries: [(Text, Blob)] = [];
    private var exportBlobs = HashMap.HashMap<Text, Blob>(0, Text.equal, Text.hash);

    private stable var exportChunksEntries: [(Text, [Blob])] = [];
    private var exportChunks = HashMap.HashMap<Text, [Blob]>(0, Text.equal, Text.hash);

    private stable var downloadTokensEntries: [(Text, ProjectTypes.DownloadToken)] = [];
    private var downloadTokens = HashMap.HashMap<Text, ProjectTypes.DownloadToken>(0, Text.equal, Text.hash);

    private stable var downloadLogsEntries: [(Text, [ProjectTypes.DownloadLog])] = [];
    private var downloadLogs = HashMap.HashMap<Text, [ProjectTypes.DownloadLog]>(0, Text.equal, Text.hash);

    // Constants for marketplace
    private let MAX_PROJECT_EXPORT_SIZE: Nat = 50_000_000; // 50MB max project size
    private let CHUNK_SIZE: Nat = 1_900_000; // 1.9MB chunks
    private let TOKEN_EXPIRY_SECONDS: Nat64 = 172_800_000_000_000; // 48 hours in nanoseconds
    private let MAX_DOWNLOAD_ATTEMPTS: Nat = 3;

    // Helper function to find project by ID
    private func findProject(projectId: Text) : ?Project {
        Array.find<Project>(userProjects, func(p: Project) : Bool { p.id == projectId })
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MARKETPLACE LISTING MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    // Create or update marketplace listing
    public shared(msg) func createMarketplaceListing(
        projectId: Text,
        price: Nat,
        stripeAccountId: Text,
        title: Text,
        description: Text,
        previewImages: [Text],
        demoUrl: ?Text,
        category: Text,
        tags: [Text],
        version: Text
    ) : async Result.Result<ProjectTypes.MarketplaceListing, Text> {
        // Verify project exists (user canister implies ownership)
        switch (findProject(projectId)) {
            case (?project) {
                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                let listing: ProjectTypes.MarketplaceListing = {
                    projectId = projectId;
                    forSale = true;
                    price = price;
                    stripeAccountId = stripeAccountId;
                    title = title;
                    description = description;
                    previewImages = previewImages;
                    demoUrl = demoUrl;
                    category = category;
                    tags = tags;
                    version = version;
                    listedAt = now;
                    updatedAt = now;
                    downloadCount = 0;
                    isPublished = false; // Must be approved/published separately
                };

                marketplaceListings.put(projectId, listing);
                #ok(listing)
            };
            case null {
                #err("Project not found")
            };
        }
    };

    // Update marketplace listing
    public shared(msg) func updateMarketplaceListing(
        projectId: Text,
        price: ?Nat,
        title: ?Text,
        description: ?Text,
        previewImages: ?[Text],
        demoUrl: ?(?Text),
        category: ?Text,
        tags: ?[Text],
        version: ?Text,
        isPublished: ?Bool
    ) : async Result.Result<ProjectTypes.MarketplaceListing, Text> {
        switch (marketplaceListings.get(projectId)) {
            case (?listing) {
                // Verify project exists (user canister implies ownership)
                switch (findProject(projectId)) {
                    case (?project) {
                        let updated: ProjectTypes.MarketplaceListing = {
                            projectId = listing.projectId;
                            forSale = listing.forSale;
                            price = Option.get(price, listing.price);
                            stripeAccountId = listing.stripeAccountId;
                            title = Option.get(title, listing.title);
                            description = Option.get(description, listing.description);
                            previewImages = Option.get(previewImages, listing.previewImages);
                            demoUrl = switch (demoUrl) {
                                case (?newDemo) { newDemo };
                                case null { listing.demoUrl };
                            };
                            category = Option.get(category, listing.category);
                            tags = Option.get(tags, listing.tags);
                            version = Option.get(version, listing.version);
                            listedAt = listing.listedAt;
                            updatedAt = Nat64.fromNat(Int.abs(Time.now()));
                            downloadCount = listing.downloadCount;
                            isPublished = Option.get(isPublished, listing.isPublished);
                        };

                        marketplaceListings.put(projectId, updated);
                        #ok(updated)
                    };
                    case null { #err("Project not found") };
                }
            };
            case null {
                #err("Marketplace listing not found")
            };
        }
    };

    // Toggle for sale status
    public shared(msg) func toggleMarketplaceForSale(
        projectId: Text,
        forSale: Bool
    ) : async Result.Result<(), Text> {
        switch (marketplaceListings.get(projectId)) {
            case (?listing) {
                switch (findProject(projectId)) {
                    case (?project) {
                        let updated: ProjectTypes.MarketplaceListing = {
                            projectId = listing.projectId;
                            forSale = forSale;
                            price = listing.price;
                            stripeAccountId = listing.stripeAccountId;
                            title = listing.title;
                            description = listing.description;
                            previewImages = listing.previewImages;
                            demoUrl = listing.demoUrl;
                            category = listing.category;
                            tags = listing.tags;
                            version = listing.version;
                            listedAt = listing.listedAt;
                            updatedAt = Nat64.fromNat(Int.abs(Time.now()));
                            downloadCount = listing.downloadCount;
                            isPublished = listing.isPublished;
                        };

                        marketplaceListings.put(projectId, updated);
                        #ok()
                    };
                    case null { #err("Project not found") };
                }
            };
            case null {
                #err("Marketplace listing not found")
            };
        }
    };

    // Get marketplace listing
    public query func getMarketplaceListing(projectId: Text) : async ?ProjectTypes.MarketplaceListing {
        marketplaceListings.get(projectId)
    };

    // Get all user's marketplace listings
    public query(msg) func getUserMarketplaceListings() : async [ProjectTypes.MarketplaceListing] {
        let listings = Iter.toArray(marketplaceListings.vals());
        Array.filter<ProjectTypes.MarketplaceListing>(
            listings,
            func(listing: ProjectTypes.MarketplaceListing): Bool {
                // All listings in this user canister belong to the user
                switch (findProject(listing.projectId)) {
                    case (?project) { true };
                    case null { false };
                }
            }
        )
    };

    // Delete marketplace listing
    public shared(msg) func deleteMarketplaceListing(projectId: Text) : async Result.Result<(), Text> {
        switch (findProject(projectId)) {
            case (?project) {
                marketplaceListings.delete(projectId);
                #ok()
            };
            case null {
                #err("Project not found")
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PROJECT EXPORT - Create downloadable ZIP
    // ═══════════════════════════════════════════════════════════════════════════

    // Export project as downloadable package
    public shared(msg) func exportProject(projectId: Text) : async Result.Result<ProjectTypes.ProjectExport, Text> {
        switch (findProject(projectId)) {
            case (?project) {
                // Generate export data (simplified - in reality would compress all project files)
                let exportData = generateProjectExportData(project);
                let fileSize = exportData.size();

                if (fileSize > MAX_PROJECT_EXPORT_SIZE) {
                    return #err("Project too large. Maximum size: " # Nat.toText(MAX_PROJECT_EXPORT_SIZE) # " bytes");
                };

                let now = Nat64.fromNat(Int.abs(Time.now()));
                let exportId = projectId # "_export_" # Nat64.toText(now);
                let isChunked = fileSize > 2_000_000;

                // Calculate checksum
                let checksum = generateChecksum(exportData);

                let metadata: ProjectTypes.ExportMetadata = {
                    projectName = project.name;
                    projectType = project.projectType;
                    motokoPackages = project.motokoPackages;
                    npmPackages = project.npmPackages;
                    fileCount = 0; // Would be calculated from actual files
                    exportedBy = msg.caller;
                };

                let totalChunks = if (isChunked) {
                    let chunkCount = fileSize / CHUNK_SIZE;
                    let remainder = fileSize % CHUNK_SIZE;
                    if (remainder > 0) { ?(chunkCount + 1) } else { ?chunkCount }
                } else { 
                    null 
                };

                let exportRecord: ProjectTypes.ProjectExport = {
                    projectId = projectId;
                    exportId = exportId;
                    fileName = sanitizeFileName(project.name # "_" # Nat64.toText(now) # ".zip");
                    fileSize = fileSize;
                    compressionType = "zip";
                    checksum = checksum;
                    isChunked = isChunked;
                    totalChunks = totalChunks;
                    createdAt = now;
                    expiresAt = null; // No expiration for marketplace exports
                    metadata = metadata;
                };

                // Store export data
                if (isChunked) {
                    let chunks = createChunks(exportData, CHUNK_SIZE);
                    exportChunks.put(exportId, chunks);
                } else {
                    exportBlobs.put(exportId, exportData);
                };

                projectExports.put(exportId, exportRecord);
                #ok(exportRecord)
            };
            case null {
                #err("Project not found")
            };
        }
    };

    // Get export info
    public query func getProjectExport(exportId: Text) : async ?ProjectTypes.ProjectExport {
        projectExports.get(exportId)
    };

    // List exports for a project
    public query(msg) func getProjectExports(projectId: Text) : async [ProjectTypes.ProjectExport] {
        let exports = Iter.toArray(projectExports.vals());
        Array.filter<ProjectTypes.ProjectExport>(
            exports,
            func(exp: ProjectTypes.ProjectExport): Bool {
                exp.projectId == projectId and exp.metadata.exportedBy == msg.caller
            }
        )
    };

    // Delete export
    public shared(msg) func deleteProjectExport(exportId: Text) : async Result.Result<(), Text> {
        switch (projectExports.get(exportId)) {
            case (?exp) {
                if (exp.metadata.exportedBy != msg.caller) {
                    return #err("Unauthorized");
                };

                projectExports.delete(exportId);
                exportBlobs.delete(exportId);
                exportChunks.delete(exportId);
                #ok()
            };
            case null {
                #err("Export not found")
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // DOWNLOAD TOKEN MANAGEMENT (Platform Canister Access Only)
    // ═══════════════════════════════════════════════════════════════════════════

    // Generate download token - ONLY callable by platform canister
    public shared(msg) func generateDownloadToken(
        exportId: Text,
        projectId: Text,
        purchaseId: Text,
        buyer: Principal
    ) : async Result.Result<ProjectTypes.DownloadToken, Text> {
        // TODO: Verify msg.caller is platform canister
        // if (msg.caller != PLATFORM_CANISTER_ID) {
        //     return #err("Unauthorized: Only platform canister can generate download tokens");
        // };

        switch (projectExports.get(exportId)) {
            case (?exp) {
                let now = Nat64.fromNat(Int.abs(Time.now()));
                let tokenId = generateTokenId(purchaseId, buyer, now);
                
                let token: ProjectTypes.DownloadToken = {
                    tokenId = tokenId;
                    exportId = exportId;
                    projectId = projectId;
                    purchaseId = purchaseId;
                    buyer = buyer;
                    maxDownloads = MAX_DOWNLOAD_ATTEMPTS;
                    downloadCount = 0;
                    createdAt = now;
                    expiresAt = now + TOKEN_EXPIRY_SECONDS;
                    lastUsedAt = null;
                    isRevoked = false;
                    revokedAt = null;
                    revokedReason = null;
                };

                downloadTokens.put(tokenId, token);
                #ok(token)
            };
            case null {
                #err("Export not found")
            };
        }
    };

    // Validate download token - Internal use
    private func validateDownloadToken(tokenId: Text) : Result.Result<ProjectTypes.DownloadToken, Text> {
        switch (downloadTokens.get(tokenId)) {
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
                    return #err("Token download limit reached");
                };

                #ok(token)
            };
            case null {
                #err("Invalid token")
            };
        }
    };

    // Revoke download token - Platform canister or owner can call
    public shared(msg) func revokeDownloadToken(
        tokenId: Text,
        reason: Text
    ) : async Result.Result<(), Text> {
        // TODO: Verify msg.caller is platform canister or project owner
        switch (downloadTokens.get(tokenId)) {
            case (?token) {
                let now = Nat64.fromNat(Int.abs(Time.now()));
                
                let updated: ProjectTypes.DownloadToken = {
                    tokenId = token.tokenId;
                    exportId = token.exportId;
                    projectId = token.projectId;
                    purchaseId = token.purchaseId;
                    buyer = token.buyer;
                    maxDownloads = token.maxDownloads;
                    downloadCount = token.downloadCount;
                    createdAt = token.createdAt;
                    expiresAt = token.expiresAt;
                    lastUsedAt = token.lastUsedAt;
                    isRevoked = true;
                    revokedAt = ?now;
                    revokedReason = ?reason;
                };

                downloadTokens.put(tokenId, updated);
                #ok()
            };
            case null {
                #err("Token not found")
            };
        }
    };

    // Get download token info - Platform canister or buyer can call
    public query(msg) func getDownloadToken(tokenId: Text) : async ?ProjectTypes.DownloadToken {
        // TODO: Verify caller is platform canister or token buyer
        downloadTokens.get(tokenId)
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // HTTP REQUEST HANDLER - Serve Project Downloads
    // ═══════════════════════════════════════════════════════════════════════════

    public type HeaderField = (Text, Text);
    
    public type HttpRequest = {
        url: Text;
        method: Text;
        body: Blob;
        headers: [HeaderField];
    };
    
    public type HttpResponse = {
        status_code: Nat16;
        headers: [HeaderField];
        body: Blob;
        streaming_strategy: ?StreamingStrategy;
    };
    
    public type StreamingStrategy = {
        #Callback: {
            token: StreamingCallbackToken;
            callback: shared query (StreamingCallbackToken) -> async StreamingCallbackResponse;
        };
    };
    
    public type StreamingCallbackToken = {
        exportId: Text;
        chunkIndex: Nat;
        tokenId: Text;
    };
    
    public type StreamingCallbackResponse = {
        body: Blob;
        token: ?StreamingCallbackToken;
    };

    // Main HTTP handler for project downloads
    public query func http_request(request: HttpRequest) : async HttpResponse {
        let url = request.url;
        
        // Route: /file/{token} - Shared files
        if (Text.contains(url, #text "/file/")) {
            let token = extractFileTokenFromUrl(url);
            switch (token) {
                case (?tkn) {
                    return serveSharedFile(tkn);
                };
                case null {
                    return createHttpError(400, "Invalid token format");
                };
            }
        }
        // Route: /download/{tokenId} - Marketplace downloads
        else if (Text.contains(url, #text "/download/")) {
            let tokenId = extractTokenFromUrl(url);
            
            switch (tokenId) {
                case (?tid) {
                    return serveProjectDownload(tid);
                };
                case null {
                    return createHttpError(400, "Invalid token format");
                };
            }
        } else {
            return createHttpError(404, "Not found");
        }
    };

    // Extract file share token from URL
    private func extractFileTokenFromUrl(url: Text) : ?Text {
        if (not Text.contains(url, #text "/file/")) {
            return null;
        };
        
        let parts = Iter.toArray(Text.split(url, #char '/'));
        var foundFile = false;
        
        for (part in parts.vals()) {
            if (foundFile and Text.size(part) > 0) {
                var token = part;
                
                // Remove query parameters
                if (Text.contains(token, #text "?")) {
                    let queryParts = Iter.toArray(Text.split(token, #char '?'));
                    if (queryParts.size() > 0) {
                        token := queryParts[0];
                    };
                };
                
                if (Text.size(token) > 0) {
                    return ?token;
                };
            };
            
            if (part == "file") {
                foundFile := true;
            };
        };
        
        null
    };

    // Serve project download with token validation
    private func serveProjectDownload(tokenId: Text) : HttpResponse {
        // Validate token
        switch (validateDownloadToken(tokenId)) {
            case (#err(msg)) {
                return createHttpError(403, msg);
            };
            case (#ok(token)) {
                // Get export
                switch (projectExports.get(token.exportId)) {
                    case (?exp) {
                        // Log download attempt
                        let now = Nat64.fromNat(Int.abs(Time.now()));
                        let log: ProjectTypes.DownloadLog = {
                            tokenId = tokenId;
                            exportId = token.exportId;
                            buyer = token.buyer;
                            ipAddress = null; // Could extract from headers
                            userAgent = null; // Could extract from headers
                            downloadedAt = now;
                            success = true;
                            errorMessage = null;
                        };
                        logDownload(tokenId, log);

                        // Increment download count
                        incrementDownloadCount(tokenId);

                        // Serve file
                        if (exp.isChunked) {
                            return serveChunkedExport(exp, tokenId);
                        } else {
                            return serveDirectExport(exp);
                        }
                    };
                    case null {
                        return createHttpError(404, "Export not found");
                    };
                }
            };
        }
    };

    // Serve small exports (<2MB) directly
    private func serveDirectExport(exp: ProjectTypes.ProjectExport) : HttpResponse {
        switch (exportBlobs.get(exp.exportId)) {
            case (?blob) {
                {
                    status_code = 200;
                    headers = [
                        ("Content-Type", "application/zip"),
                        ("Content-Disposition", "attachment; filename=\"" # exp.fileName # "\""),
                        ("Content-Length", Nat.toText(exp.fileSize)),
                        ("X-Checksum-SHA256", exp.checksum),
                        ("Cache-Control", "no-cache, no-store, must-revalidate")
                    ];
                    body = blob;
                    streaming_strategy = null;
                }
            };
            case null {
                createHttpError(404, "Export data not found")
            };
        }
    };

    // Serve large exports (>2MB) with chunking
    private func serveChunkedExport(exp: ProjectTypes.ProjectExport, tokenId: Text) : HttpResponse {
        switch (exportChunks.get(exp.exportId)) {
            case (?chunks) {
                if (chunks.size() == 0) {
                    return createHttpError(500, "No chunks found");
                };

                let firstChunk = chunks[0];
                
                {
                    status_code = 200;
                    headers = [
                        ("Content-Type", "application/zip"),
                        ("Content-Disposition", "attachment; filename=\"" # exp.fileName # "\""),
                        ("Content-Length", Nat.toText(exp.fileSize)),
                        ("X-Checksum-SHA256", exp.checksum),
                        ("Cache-Control", "no-cache, no-store, must-revalidate")
                    ];
                    body = firstChunk;
                    streaming_strategy = if (chunks.size() > 1) {
                        ?#Callback({
                            token = {
                                exportId = exp.exportId;
                                chunkIndex = 1;
                                tokenId = tokenId;
                            };
                            callback = streamProjectChunk;
                        })
                    } else {
                        null
                    };
                }
            };
            case null {
                createHttpError(404, "Export chunks not found")
            };
        }
    };

    // Streaming callback for chunked downloads
    public query func streamProjectChunk(token: StreamingCallbackToken) : async StreamingCallbackResponse {
        // Re-validate token on each chunk
        switch (validateDownloadToken(token.tokenId)) {
            case (#err(_)) {
                return {
                    body = Blob.fromArray([]);
                    token = null;
                };
            };
            case (#ok(_)) {
                switch (exportChunks.get(token.exportId)) {
                    case (?chunks) {
                        if (token.chunkIndex >= chunks.size()) {
                            return {
                                body = Blob.fromArray([]);
                                token = null;
                            };
                        };

                        let chunk = chunks[token.chunkIndex];
                        let hasMoreChunks = token.chunkIndex + 1 < chunks.size();

                        {
                            body = chunk;
                            token = if (hasMoreChunks) {
                                ?{
                                    exportId = token.exportId;
                                    chunkIndex = token.chunkIndex + 1;
                                    tokenId = token.tokenId;
                                }
                            } else {
                                null
                            };
                        }
                    };
                    case null {
                        {
                            body = Blob.fromArray([]);
                            token = null;
                        }
                    };
                }
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    private func extractTokenFromUrl(url: Text) : ?Text {
        if (not Text.contains(url, #text "/download/")) {
            return null;
        };
        
        let parts = Iter.toArray(Text.split(url, #char '/'));
        var foundDownload = false;
        
        for (part in parts.vals()) {
            if (foundDownload and Text.size(part) > 0) {
                var token = part;
                
                // Remove query parameters
                if (Text.contains(token, #text "?")) {
                    let queryParts = Iter.toArray(Text.split(token, #char '?'));
                    if (queryParts.size() > 0) {
                        token := queryParts[0];
                    };
                };
                
                if (Text.size(token) > 0) {
                    return ?token;
                };
            };
            
            if (part == "download") {
                foundDownload := true;
            };
        };
        
        null
    };

    private func generateTokenId(purchaseId: Text, buyer: Principal, timestamp: Nat64) : Text {
        let seed = purchaseId # Principal.toText(buyer) # Nat64.toText(timestamp);
        let hash = Text.hash(seed);
        "token_" # Nat32.toText(hash) # "_" # Nat64.toText(timestamp)
    };

    private func generateChecksum(data: Blob) : Text {
        // Simplified checksum - in production use proper SHA-256
        let hash = Text.hash(debug_show(data));
        Nat32.toText(hash)
    };

    private func sanitizeFileName(fileName: Text) : Text {
        var sanitized = fileName;
        sanitized := Text.replace(sanitized, #text "/", "_");
        sanitized := Text.replace(sanitized, #text "\\", "_");
        sanitized := Text.replace(sanitized, #text "..", "_");
        sanitized := Text.replace(sanitized, #text ":", "_");
        sanitized
    };

    private func createChunks(data: Blob, chunkSize: Nat) : [Blob] {
        let dataArray = Blob.toArray(data);
        let totalSize = dataArray.size();
        let numChunks = (totalSize / chunkSize) + (if (totalSize % chunkSize == 0) { 0 } else { 1 });
        
        Array.tabulate<Blob>(numChunks, func(i: Nat): Blob {
            let start = i * chunkSize;
            let end = if (start + chunkSize > totalSize) { totalSize } else { start + chunkSize };
            let chunkArray = Array.tabulate<Nat8>(end - start, func(j: Nat): Nat8 {
                dataArray[start + j]
            });
            Blob.fromArray(chunkArray)
        })
    };

    private func generateProjectExportData(project: Project) : Blob {
        // Simplified - in production would compress all project files
        let mockData = "Project: " # project.name # "\nType: " # project.projectType.name;
        Text.encodeUtf8(mockData)
    };

    private func createHttpError(statusCode: Nat16, message: Text) : HttpResponse {
        {
            status_code = statusCode;
            headers = [("Content-Type", "text/plain")];
            body = Text.encodeUtf8(message);
            streaming_strategy = null;
        }
    };

    private func logDownload(tokenId: Text, log: ProjectTypes.DownloadLog) {
        let existingLogs = switch (downloadLogs.get(tokenId)) {
            case (?logs) { logs };
            case null { [] };
        };
        let updatedLogs = Array.append<ProjectTypes.DownloadLog>(existingLogs, [log]);
        downloadLogs.put(tokenId, updatedLogs);
    };

    private func incrementDownloadCount(tokenId: Text) {
        switch (downloadTokens.get(tokenId)) {
            case (?token) {
                let updated: ProjectTypes.DownloadToken = {
                    tokenId = token.tokenId;
                    exportId = token.exportId;
                    projectId = token.projectId;
                    purchaseId = token.purchaseId;
                    buyer = token.buyer;
                    maxDownloads = token.maxDownloads;
                    downloadCount = token.downloadCount + 1;
                    createdAt = token.createdAt;
                    expiresAt = token.expiresAt;
                    lastUsedAt = ?Nat64.fromNat(Int.abs(Time.now()));
                    isRevoked = token.isRevoked;
                    revokedAt = token.revokedAt;
                    revokedReason = token.revokedReason;
                };
                downloadTokens.put(tokenId, updated);
            };
            case null {};
        };
    };

    // Get download logs for a purchase (platform canister or buyer)
    public query func getDownloadLogs(tokenId: Text) : async [ProjectTypes.DownloadLog] {
        switch (downloadLogs.get(tokenId)) {
            case (?logs) { logs };
            case null { [] };
        }
    };
}; // End of actor