// Pool Management Types for Platform Canister
import Principal "mo:base/Principal";
import Time "mo:base/Time";

module {
    // Pool canister status
    public type PoolCanisterStatus = {
        #Available;      // Ready to be assigned
        #Assigned;       // Currently assigned to a user
        #Creating;       // Being created
        #Maintenance;    // Under maintenance/topup
        #Failed;         // Creation or operation failed
    };

    // Canister pool types
    public type CanisterPoolType = {
        #UserCanister;           // Management/User canisters
        #RegularServerPair;      // Standard frontend + backend pairs
        #AgentServerPair;        // AI Agent server pairs
        #AgencyWorkflowPair;     // Agency workflow server pairs
    };

    // Individual pooled canister
    public type PooledCanister = {
        canisterId: Principal;
        poolType: CanisterPoolType;
        status: PoolCanisterStatus;
        createdAt: Nat64;
        assignedTo: ?Principal;          // User principal if assigned
        assignedAt: ?Nat64;               // When it was assigned
        cycleBalance: ?Nat;               // Last known cycle balance
        memoryGB: Nat;                    // Memory allocation
        durationDays: Nat;                // Initial duration
        metadata: ?[(Text, Text)];        // Additional metadata
    };

    // Server pair (two canisters together)
    public type PooledServerPair = {
        pairId: Text;                     // Unique pair identifier
        frontendCanisterId: Principal;
        backendCanisterId: Principal;
        poolType: CanisterPoolType;       // RegularServerPair, AgentServerPair, or AgencyWorkflowPair
        status: PoolCanisterStatus;
        createdAt: Nat64;
        assignedTo: ?Principal;           // User principal if assigned
        assignedAt: ?Nat64;
        frontendCycles: ?Nat;
        backendCycles: ?Nat;
        metadata: ?[(Text, Text)];
    };

    // Pool statistics
    public type PoolStats = {
        poolType: CanisterPoolType;
        totalCount: Nat;
        availableCount: Nat;
        assignedCount: Nat;
        creatingCount: Nat;
        maintenanceCount: Nat;
        failedCount: Nat;
        totalCyclesAllocated: Nat;
    };

    // User canister admin info
    public type UserCanisterInfo = {
        userPrincipal: Principal;
        userCanisterId: Principal;
        cycleBalance: Nat;
        memorySize: Nat;
        createdAt: Nat64;
        lastTopup: ?Nat64;
        totalTopups: Nat;
        controllers: [Principal];
        status: Text;                      // "running", "stopped", "stopping"
    };

    // Replacement request/result
    public type CanisterReplacementInfo = {
        userPrincipal: Principal;
        oldCanisterId: Principal;
        newCanisterId: Principal;
        replacedAt: Nat64;
        reason: Text;
        dataTransferred: Bool;
    };
}

