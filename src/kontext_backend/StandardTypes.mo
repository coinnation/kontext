// StandardTypes.mo - Platform-provided SAFE Motoko types
// DO NOT MODIFY - This is automatically generated platform code

import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Result "mo:base/Result";

module {

    /**
     * SAFE: Basic type aliases that Claude can reliably generate
     */
    public type Id = Nat;
    public type Timestamp = Int;
    public type UserId = Principal;
    public type ApiResult<T> = Result.Result<T, Text>;

    /**
     * SAFE: Simple enums that Claude handles well
     */
    public type Status = {
        #active;
        #inactive;
        #pending;
        #deleted;
    };

    public type Priority = {
        #low;
        #medium;
        #high;
        #urgent;
    };

    public type Visibility = {
        #visible;
        #hidden;
        #internal;
    };

    /**
     * SAFE: Simple record types (no complex nesting)
     */
    public type BaseEntity = {
        id: Id;
        createdAt: Timestamp;
        updatedAt: Timestamp;
        status: Status;
    };

    /**
     * SAFE: Helper functions for common operations
     */
    public func now(): Timestamp {
        Time.now()
    };

    public func createEntity(id: Id): BaseEntity {
        {
            id = id;
            createdAt = now();
            updatedAt = now();
            status = #active;
        }
    };

    public func updateEntity(entity: BaseEntity): BaseEntity {
        {
            id = entity.id;
            createdAt = entity.createdAt;
            updatedAt = now();
            status = entity.status;
        }
    };

    /**
     * SAFE: Standard error messages
     */
    public let Errors = {
        notFound = "Item not found";
        unauthorized = "Unauthorized";
        invalidInput = "Invalid input";
        alreadyExists = "Already exists";
        systemError = "System error";
    };

    /**
     * SAFE: Standard success messages
     */
    public let Success = {
        created = "Created successfully";
        updated = "Updated successfully";
        deleted = "Deleted successfully";
        retrieved = "Retrieved successfully";
    };

    /**
     * SAFE: Simple result helpers
     */
    public func ok<T>(data: T): ApiResult<T> {
        #ok(data)
    };

    public func err<T>(message: Text): ApiResult<T> {
        #err(message)
    };
}