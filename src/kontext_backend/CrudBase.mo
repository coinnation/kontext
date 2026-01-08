// CrudBase.mo - Platform-provided SAFE Motoko CRUD patterns
// DO NOT MODIFY - This is automatically generated platform code

import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Nat "mo:base/Nat";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Principal "mo:base/Principal";

module {

    /**
     * SAFE: Simple type aliases that Claude can handle reliably
     */
    public type Id = Nat;
    public type Timestamp = Int;
    public type ApiResult<T> = Result.Result<T, Text>;

    /**
     * SAFE: Helper functions for HashMap patterns (not classes)
     * These patterns are much more reliable for Claude generation
     */

    /**
     * Create a new HashMap with standard settings
     * SAFE: Simple function, not a class
     */
    public func newHashMap<T>(): HashMap.HashMap<Nat, T> {
        HashMap.HashMap<Nat, T>(0, Nat.equal, Hash.hash)
    };

    /**
     * SAFE: Standard stable memory pattern for any HashMap
     * Usage: stable var myEntries: [(Nat, MyType)] = [];
     */
    public func saveToStable<T>(map: HashMap.HashMap<Nat, T>): [(Nat, T)] {
        Iter.toArray(map.entries())
    };

    /**
     * SAFE: Restore HashMap from stable memory
     */
    public func loadFromStable<T>(entries: [(Nat, T)]): HashMap.HashMap<Nat, T> {
        HashMap.fromIter<Nat, T>(entries.vals(), entries.size(), Nat.equal, Hash.hash)
    };

    /**
     * SAFE: Generate next ID for entities
     */
    public func nextId(currentId: Nat): Nat {
        currentId + 1
    };

    /**
     * SAFE: Standard success result
     */
    public func success<T>(data: T): ApiResult<T> {
        #ok(data)
    };

    /**
     * SAFE: Standard error result
     */
    public func error<T>(message: Text): ApiResult<T> {
        #err(message)
    };

    // ========================================
    // 🔒 USER-SCOPED SECURITY FUNCTIONS
    // ========================================

    /**
     * SAFE: Get all entities belonging to a specific user
     * Automatically filters by owner - prevents data leakage
     */
    public func getUserEntities<T>(
        entities: HashMap.HashMap<Nat, T>,
        owner: Principal,
        getOwner: (T) -> Principal
    ): [T] {
        entities.vals()
            |> Iter.toArray(_)
            |> Array.filter(_, func(entity: T): Bool { getOwner(entity) == owner })
    };

    /**
     * SAFE: Get a single entity if user owns it
     * Returns null if entity doesn't exist OR user doesn't own it
     */
    public func getUserEntity<T>(
        entities: HashMap.HashMap<Nat, T>,
        id: Nat,
        owner: Principal,
        getOwner: (T) -> Principal
    ): ?T {
        switch (entities.get(id)) {
            case (null) { null };
            case (?entity) {
                if (getOwner(entity) == owner) { ?entity } else { null }
            };
        }
    };

    /**
     * SAFE: Create and store a user entity
     * Returns the new nextId value
     */
    public func createUserEntity<T>(
        entities: HashMap.HashMap<Nat, T>,
        nextId: Nat,
        entity: T
    ): Nat {
        entities.put(nextId, entity);
        nextId + 1
    };

    /**
     * SAFE: Update entity only if user owns it
     * Returns true if update succeeded, false if no permission or entity not found
     */
    public func updateUserEntity<T>(
        entities: HashMap.HashMap<Nat, T>,
        id: Nat,
        updatedEntity: T,
        owner: Principal,
        getOwner: (T) -> Principal
    ): Bool {
        switch (entities.get(id)) {
            case (null) { false };
            case (?existing) {
                if (getOwner(existing) == owner) {
                    entities.put(id, updatedEntity);
                    true
                } else { false }
            };
        }
    };

    /**
     * SAFE: Delete entity only if user owns it
     * Returns true if delete succeeded, false if no permission or entity not found
     */
    public func deleteUserEntity<T>(
        entities: HashMap.HashMap<Nat, T>,
        id: Nat,
        owner: Principal,
        getOwner: (T) -> Principal
    ): Bool {
        switch (entities.get(id)) {
            case (null) { false };
            case (?entity) {
                if (getOwner(entity) == owner) {
                    entities.delete(id);
                    true
                } else { false }
            };
        }
    };

    /**
     * SAFE: Get count of entities belonging to a specific user
     */
    public func getUserEntityCount<T>(
        entities: HashMap.HashMap<Nat, T>,
        owner: Principal,
        getOwner: (T) -> Principal
    ): Nat {
        getUserEntities<T>(entities, owner, getOwner).size()
    };

    /**
     * SAFE: Get user entities filtered by a condition
     */
    public func getUserEntitiesWhere<T>(
        entities: HashMap.HashMap<Nat, T>,
        owner: Principal,
        getOwner: (T) -> Principal,
        condition: (T) -> Bool
    ): [T] {
        getUserEntities<T>(entities, owner, getOwner)
            |> Array.filter(_, condition)
    };

    // ========================================
    // 🔧 EXISTING UTILITY FUNCTIONS (KEEP AS-IS)
    // ========================================

    /**
     * SAFE: Get all values from HashMap as Array
     * WARNING: Use getUserEntities() instead for user-scoped data
     */
    public func getAllValues<T>(map: HashMap.HashMap<Nat, T>): [T] {
        Iter.toArray(map.vals())
    };

    /**
     * SAFE: Get all entries from HashMap as Array
     * WARNING: Use getUserEntities() instead for user-scoped data
     */
    public func getAllEntries<T>(map: HashMap.HashMap<Nat, T>): [(Nat, T)] {
        Iter.toArray(map.entries())
    };

    /**
     * SAFE: Check if HashMap contains key
     * WARNING: Use getUserEntity() instead for user-scoped access
     */
    public func hasKey<T>(map: HashMap.HashMap<Nat, T>, id: Nat): Bool {
        switch (map.get(id)) {
            case (?_) { true };
            case null { false };
        }
    };

    /**
     * SAFE: Get HashMap size
     */
    public func getSize<T>(map: HashMap.HashMap<Nat, T>): Nat {
        map.size()
    };

    /**
     * SAFE: Current timestamp
     */
    public func now(): Timestamp {
        Time.now()
    };

    /**
     * SAFE: Validate caller permissions (basic pattern)
     */
    public func validateCaller(caller: Principal, allowedCallers: [Principal]): Bool {
        Array.find<Principal>(allowedCallers, func(p) = p == caller) != null
    };

    /**
     * SAFE: Basic pagination helper
     */
    public func paginate<T>(items: [T], offset: Nat, limit: Nat): [T] {
        let size = items.size();
        if (offset >= size) { return [] };

        let endIndex = Nat.min(offset + limit, size);
        Array.tabulate<T>(endIndex - offset, func(i) = items[offset + i])
    };
}