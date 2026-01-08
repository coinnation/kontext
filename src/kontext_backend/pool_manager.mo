// Pool Manager for Pre-created Canister Pools
import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Option "mo:base/Option";
import Buffer "mo:base/Buffer";
import Hash "mo:base/Hash";
import PoolTypes "./pool_types";

module {
    type PooledCanister = PoolTypes.PooledCanister;
    type PooledServerPair = PoolTypes.PooledServerPair;
    type CanisterPoolType = PoolTypes.CanisterPoolType;
    type PoolCanisterStatus = PoolTypes.PoolCanisterStatus;
    type PoolStats = PoolTypes.PoolStats;

    // Stable data type (must be at module level for external access)
    public type StableData = {
        userCanisters: [(Principal, PooledCanister)];
        serverPairs: [(Text, PooledServerPair)];
    };

    public class PoolManager() {
        // Storage for pooled individual canisters (UserCanisters)
        private var userCanisterPool = HashMap.HashMap<Principal, PooledCanister>(
            10,
            Principal.equal,
            Principal.hash
        );

        // Storage for pooled server pairs
        private var serverPairPool = HashMap.HashMap<Text, PooledServerPair>(
            10,
            Text.equal,
            Text.hash
        );

        // ==================== USER CANISTER POOL ====================

        // Add a new user canister to the pool
        public func addUserCanisterToPool(
            canisterId: Principal,
            memoryGB: Nat,
            durationDays: Nat,
            metadata: ?[(Text, Text)]
        ) : Bool {
            let pooledCanister: PooledCanister = {
                canisterId = canisterId;
                poolType = #UserCanister;
                status = #Available;
                createdAt = Nat64.fromIntWrap(Time.now());
                assignedTo = null;
                assignedAt = null;
                cycleBalance = null;
                memoryGB = memoryGB;
                durationDays = durationDays;
                metadata = metadata;
            };
            
            userCanisterPool.put(canisterId, pooledCanister);
            true
        };

        // Get an available user canister from the pool
        public func getAvailableUserCanister() : ?PooledCanister {
            for ((canisterId, canister) in userCanisterPool.entries()) {
                switch (canister.status) {
                    case (#Available) {
                        return ?canister;
                    };
                    case (_) {};
                };
            };
            null
        };

        // Assign a user canister to a user
        public func assignUserCanister(
            canisterId: Principal,
            userPrincipal: Principal
        ) : Bool {
            switch (userCanisterPool.get(canisterId)) {
                case (?canister) {
                    if (canister.status != #Available) {
                        return false;
                    };

                    let updated: PooledCanister = {
                        canisterId = canister.canisterId;
                        poolType = canister.poolType;
                        status = #Assigned;
                        createdAt = canister.createdAt;
                        assignedTo = ?userPrincipal;
                        assignedAt = ?Nat64.fromIntWrap(Time.now());
                        cycleBalance = canister.cycleBalance;
                        memoryGB = canister.memoryGB;
                        durationDays = canister.durationDays;
                        metadata = canister.metadata;
                    };

                    userCanisterPool.put(canisterId, updated);
                    true
                };
                case null { false };
            };
        };

        // Remove a canister from the pool (when deleted)
        public func removeUserCanisterFromPool(canisterId: Principal) : Bool {
            switch (userCanisterPool.remove(canisterId)) {
                case (?_) { true };
                case null { false };
            };
        };

        // Update canister cycle balance
        public func updateUserCanisterCycles(canisterId: Principal, cycles: Nat) {
            switch (userCanisterPool.get(canisterId)) {
                case (?canister) {
                    let updated: PooledCanister = {
                        canisterId = canister.canisterId;
                        poolType = canister.poolType;
                        status = canister.status;
                        createdAt = canister.createdAt;
                        assignedTo = canister.assignedTo;
                        assignedAt = canister.assignedAt;
                        cycleBalance = ?cycles;
                        memoryGB = canister.memoryGB;
                        durationDays = canister.durationDays;
                        metadata = canister.metadata;
                    };
                    userCanisterPool.put(canisterId, updated);
                };
                case null {};
            };
        };

        // ==================== SERVER PAIR POOL ====================

        // Add a server pair to the pool
        public func addServerPairToPool(
            pairId: Text,
            frontendCanisterId: Principal,
            backendCanisterId: Principal,
            poolType: CanisterPoolType,
            metadata: ?[(Text, Text)]
        ) : Bool {
            // Validate pool type is a server pair type
            switch (poolType) {
                case (#RegularServerPair or #AgentServerPair or #AgencyWorkflowPair) {
                    let pooledPair: PooledServerPair = {
                        pairId = pairId;
                        frontendCanisterId = frontendCanisterId;
                        backendCanisterId = backendCanisterId;
                        poolType = poolType;
                        status = #Available;
                        createdAt = Nat64.fromIntWrap(Time.now());
                        assignedTo = null;
                        assignedAt = null;
                        frontendCycles = null;
                        backendCycles = null;
                        metadata = metadata;
                    };
                    
                    serverPairPool.put(pairId, pooledPair);
                    true
                };
                case (_) { false };
            };
        };

        // Get an available server pair from the pool
        public func getAvailableServerPair(poolType: CanisterPoolType) : ?PooledServerPair {
            for ((pairId, pair) in serverPairPool.entries()) {
                if (pair.status == #Available and pair.poolType == poolType) {
                    return ?pair;
                };
            };
            null
        };

        // Assign a server pair to a user
        public func assignServerPair(
            pairId: Text,
            userPrincipal: Principal
        ) : Bool {
            switch (serverPairPool.get(pairId)) {
                case (?pair) {
                    if (pair.status != #Available) {
                        return false;
                    };

                    let updated: PooledServerPair = {
                        pairId = pair.pairId;
                        frontendCanisterId = pair.frontendCanisterId;
                        backendCanisterId = pair.backendCanisterId;
                        poolType = pair.poolType;
                        status = #Assigned;
                        createdAt = pair.createdAt;
                        assignedTo = ?userPrincipal;
                        assignedAt = ?Nat64.fromIntWrap(Time.now());
                        frontendCycles = pair.frontendCycles;
                        backendCycles = pair.backendCycles;
                        metadata = pair.metadata;
                    };

                    serverPairPool.put(pairId, updated);
                    true
                };
                case null { false };
            };
        };

        // Remove a server pair from the pool
        public func removeServerPairFromPool(pairId: Text) : Bool {
            switch (serverPairPool.remove(pairId)) {
                case (?_) { true };
                case null { false };
            };
        };

        // Update server pair cycle balances
        public func updateServerPairCycles(
            pairId: Text,
            frontendCycles: Nat,
            backendCycles: Nat
        ) {
            switch (serverPairPool.get(pairId)) {
                case (?pair) {
                    let updated: PooledServerPair = {
                        pairId = pair.pairId;
                        frontendCanisterId = pair.frontendCanisterId;
                        backendCanisterId = pair.backendCanisterId;
                        poolType = pair.poolType;
                        status = pair.status;
                        createdAt = pair.createdAt;
                        assignedTo = pair.assignedTo;
                        assignedAt = pair.assignedAt;
                        frontendCycles = ?frontendCycles;
                        backendCycles = ?backendCycles;
                        metadata = pair.metadata;
                    };
                    serverPairPool.put(pairId, updated);
                };
                case null {};
            };
        };

        // ==================== STATISTICS & QUERIES ====================

        // Get pool statistics for a specific type
        public func getPoolStats(poolType: CanisterPoolType) : PoolStats {
            var totalCount = 0;
            var availableCount = 0;
            var assignedCount = 0;
            var creatingCount = 0;
            var maintenanceCount = 0;
            var failedCount = 0;
            var totalCycles: Nat = 0;

            switch (poolType) {
                case (#UserCanister) {
                    for ((_, canister) in userCanisterPool.entries()) {
                        totalCount += 1;
                        switch (canister.status) {
                            case (#Available) { availableCount += 1 };
                            case (#Assigned) { assignedCount += 1 };
                            case (#Creating) { creatingCount += 1 };
                            case (#Maintenance) { maintenanceCount += 1 };
                            case (#Failed) { failedCount += 1 };
                        };
                        switch (canister.cycleBalance) {
                            case (?cycles) { totalCycles += cycles };
                            case null {};
                        };
                    };
                };
                case (_) {
                    for ((_, pair) in serverPairPool.entries()) {
                        if (pair.poolType == poolType) {
                            totalCount += 1;
                            switch (pair.status) {
                                case (#Available) { availableCount += 1 };
                                case (#Assigned) { assignedCount += 1 };
                                case (#Creating) { creatingCount += 1 };
                                case (#Maintenance) { maintenanceCount += 1 };
                                case (#Failed) { failedCount += 1 };
                            };
                            switch (pair.frontendCycles) {
                                case (?cycles) { totalCycles += cycles };
                                case null {};
                            };
                            switch (pair.backendCycles) {
                                case (?cycles) { totalCycles += cycles };
                                case null {};
                            };
                        };
                    };
                };
            };

            {
                poolType = poolType;
                totalCount = totalCount;
                availableCount = availableCount;
                assignedCount = assignedCount;
                creatingCount = creatingCount;
                maintenanceCount = maintenanceCount;
                failedCount = failedCount;
                totalCyclesAllocated = totalCycles;
            }
        };

        // Get all user canisters in pool
        public func getAllUserCanisters() : [PooledCanister] {
            let buffer = Buffer.Buffer<PooledCanister>(userCanisterPool.size());
            for ((_, canister) in userCanisterPool.entries()) {
                buffer.add(canister);
            };
            Buffer.toArray(buffer)
        };

        // Get all server pairs in pool
        public func getAllServerPairs(poolType: ?CanisterPoolType) : [PooledServerPair] {
            let buffer = Buffer.Buffer<PooledServerPair>(serverPairPool.size());
            for ((_, pair) in serverPairPool.entries()) {
                switch (poolType) {
                    case (?type_) {
                        if (pair.poolType == type_) {
                            buffer.add(pair);
                        };
                    };
                    case null {
                        buffer.add(pair);
                    };
                };
            };
            Buffer.toArray(buffer)
        };

        // Get canister by ID
        public func getUserCanisterById(canisterId: Principal) : ?PooledCanister {
            userCanisterPool.get(canisterId)
        };

        // Get server pair by ID
        public func getServerPairById(pairId: Text) : ?PooledServerPair {
            serverPairPool.get(pairId)
        };

        // ==================== STABLE STORAGE ====================

        public func toStable() : StableData {
            {
                userCanisters = Iter.toArray(userCanisterPool.entries());
                serverPairs = Iter.toArray(serverPairPool.entries());
            }
        };

        public func fromStable(data: StableData) {
            userCanisterPool := HashMap.fromIter<Principal, PooledCanister>(
                data.userCanisters.vals(),
                10,
                Principal.equal,
                Principal.hash
            );

            serverPairPool := HashMap.fromIter<Text, PooledServerPair>(
                data.serverPairs.vals(),
                10,
                Text.equal,
                Text.hash
            );
        };
    };
}

