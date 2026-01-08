import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Error "mo:base/Error";
import HashMap "mo:base/HashMap";
import Interface "./ic-management-interface";
import Debug "./Debug";
import Cycles "mo:base/ExperimentalCycles";
import Blob "mo:base/Blob";
import Text "mo:base/Text";


module {

    type AssetCanisterArgs = {
        #Init : InitArgs;
        #Upgrade : UpgradeArgs;
    };

    type InitArgs = {
        set_permissions : ?SetPermissions;
    };

    type SetPermissions = {
        prepare : [Principal];
        commit : [Principal];
        manage_permissions : [Principal];
    };


    type UpgradeArgs = {
        set_permissions : ?SetPermissions;
    };


public class CanisterService(
    appendLogs: ([Debug.LogEntry]) -> ()
) {
        // IC Management Canister Reference
        private let IC = "aaaaa-aa";
        private let ic = actor (IC) : Interface.Self;

        type CanisterSettings = {
            controllers : ?[Principal];
            compute_allocation : ?Nat;
            memory_allocation : ?Nat;
            freezing_threshold : ?Nat;
        };


public func createCanisterWithSettings(
    userPrincipal: Principal,
    memoryGB: Nat,
    computeAllocation: Nat,
    freezingThreshold: ?Nat,
    durationInDays: Nat,
    cyclesAmount: Nat
): async Result.Result<Text, Text> {
    appendLogs([Debug.print("==== CANISTER SERVICE: CREATE CANISTER STARTED ====")]);
    appendLogs([Debug.print("User: " # Principal.toText(userPrincipal))]);
    appendLogs([Debug.print("Memory (GB): " # Nat.toText(memoryGB))]);
    appendLogs([Debug.print("Compute Allocation: " # Nat.toText(computeAllocation))]);

    switch (freezingThreshold) {
        case (?value) {
            appendLogs([Debug.print("Freezing Threshold: " # Nat.toText(value))]);
        };
        case (null) {
            appendLogs([Debug.print("Freezing Threshold: null (default)")]);
        };
    };

    appendLogs([Debug.print("Duration (Days): " # Nat.toText(durationInDays))]);
    appendLogs([Debug.print("Cycles Amount: " # Nat.toText(cyclesAmount))]);

    // Use the cycles amount provided by the caller
    let requiredCycles = cyclesAmount;

    // Configure canister settings
    let memoryAllocation = memoryGB * 1024 * 1024 * 1024;
    appendLogs([Debug.print("Calculated Memory Allocation (bytes): " # Nat.toText(memoryAllocation))]);
    let backendPrincipal = Principal.fromText("pkmhr-fqaaa-aaaaa-qcfeq-cai");
    let localBackendPrincipal = Principal.fromText("pkmhr-fqaaa-aaaaa-qcfeq-cai");

    appendLogs([Debug.print("Setting up controllers")]);
    appendLogs([Debug.print("- User: " # Principal.toText(userPrincipal))]);
    appendLogs([Debug.print("- Backend: " # Principal.toText(backendPrincipal))]);
    appendLogs([Debug.print("- Local Backend: " # Principal.toText(localBackendPrincipal))]);

    let settings: CanisterSettings = {
        controllers = ?[userPrincipal, backendPrincipal, localBackendPrincipal];
        compute_allocation = ?computeAllocation;
        memory_allocation = ?memoryAllocation;
        freezing_threshold = freezingThreshold;
    };

    appendLogs([
        Debug.print("Canister settings prepared"),
        Debug.print("Adding cycles: " # Nat.toText(requiredCycles))
    ]);

    // Check available cycles in this canister before adding
    let availableCycles = Cycles.balance();
    appendLogs([Debug.print("Available cycles in this canister: " # Nat.toText(availableCycles))]);

    if (availableCycles < requiredCycles) {
        appendLogs([Debug.print("ERROR: Insufficient cycles available. Need " # Nat.toText(requiredCycles) # " but only have " # Nat.toText(availableCycles))]);
        return #err("Insufficient cycles available in the service canister to create new canister. Need " # Nat.toText(requiredCycles) # " but only have " # Nat.toText(availableCycles));
    };

    try {
        appendLogs([Debug.print("Adding " # Nat.toText(requiredCycles) # " cycles")]);

        // Add the cycles with explicit system capability
        Cycles.add<system>(requiredCycles);

        // DO NOT try to capture the return value - Cycles.add() returns ()
        appendLogs([Debug.print("Cycles added, now calling ic.create_canister")]);

        let newCanister = await ic.create_canister({ settings = ?settings });
        let canisterId = newCanister.canister_id;

        appendLogs([Debug.print("Canister created successfully with ID: " # Principal.toText(canisterId))]);

        // CRITICAL: Verify and ensure user principal is set as controller
        appendLogs([Debug.print("Verifying controllers are set correctly...")]);

        try {
            // First, update settings to ensure canister is a controller of itself
            await ic.update_settings({
                canister_id = canisterId;
                settings = {
                    controllers = ?[canisterId, userPrincipal, backendPrincipal, localBackendPrincipal];
                    compute_allocation = null;
                    memory_allocation = null;
                    freezing_threshold = null;
                };
            });
            
            // Verify user principal is actually set as controller
            let status = await ic.canister_status({ canister_id = canisterId });
            let userIsController = Array.find<Principal>(
                status.settings.controllers,
                func(p) { Principal.equal(p, userPrincipal) }
            ) != null;
            
            if (not userIsController) {
                appendLogs([Debug.print("WARNING: User principal not found in controllers after update, retrying...")]);
                // Retry setting controllers
                await ic.update_settings({
                    canister_id = canisterId;
                    settings = {
                        controllers = ?[canisterId, userPrincipal, backendPrincipal, localBackendPrincipal];
                        compute_allocation = null;
                        memory_allocation = null;
                        freezing_threshold = null;
                    };
                });
                appendLogs([Debug.print("✅ Controllers updated (retry)")]);
            } else {
                appendLogs([Debug.print("✅ User principal confirmed as controller")]);
            };
        } catch (updateErr) {
            appendLogs([Debug.print("ERROR: Failed to set/verify canister controllers: " # Error.message(updateErr))]);
            // This is critical - if we can't set controllers, the user won't be able to use their canister
            return #err("Failed to set user as canister controller: " # Error.message(updateErr));
        };

        appendLogs([Debug.print("==== CANISTER SERVICE: CREATE CANISTER COMPLETED SUCCESSFULLY ====")]);
        #ok(Principal.toText(canisterId))
    } catch (err) {
        appendLogs([Debug.print("ERROR: Failed to create canister: " # Error.message(err))]);
        appendLogs([Debug.print("==== CANISTER SERVICE: CREATE CANISTER FAILED ====")]);
        #err("Failed to create canister: " # Error.message(err))
    }
};


    public func deployToExistingCanister(
        canisterId: Principal,
        wasm: [Nat8],
        userPrincipal: ?Principal
    ) : async Result.Result<Text, Text> {
        appendLogs([Debug.print("Deploying WASM to existing canister: " # Principal.toText(canisterId))]);

        try {
            let status = await ic.canister_status({ canister_id = canisterId });
            
            // CRITICAL: Save controllers before install_code (they may be lost during installation)
            let savedControllers = status.settings.controllers;
            appendLogs([Debug.print("Saved controllers before install_code: " # debug_show(savedControllers))]);

            // Simplified init args for deployment
            let init_args = to_candid(null);

            // Install WASM
            await ic.install_code({
                arg = init_args;
                wasm_module = wasm;
                mode = #reinstall;  // Force reinstall to clear stable memory
                canister_id = canisterId;
            });
            
            // CRITICAL: Restore controllers after install_code if user principal was provided
            switch (userPrincipal) {
                case (?userPrincipal) {
                    let postInstallStatus = await ic.canister_status({ canister_id = canisterId });
                    let userIsController = Array.find<Principal>(
                        postInstallStatus.settings.controllers,
                        func(p) { Principal.equal(p, userPrincipal) }
                    ) != null;
                    
                    if (not userIsController) {
                        appendLogs([Debug.print("WARNING: User principal lost controller status after install_code, restoring controllers...")]);
                        // Restore saved controllers, ensuring user principal is included
                        // savedControllers is [Principal] (not optional) from canister_status
                        let userInSaved = Array.find<Principal>(savedControllers, func(p) { Principal.equal(p, userPrincipal) }) != null;
                        let controllersToRestore = if (userInSaved) {
                            ?savedControllers
                        } else {
                            // Add user principal if not in saved list
                            ?Array.append<Principal>(savedControllers, [userPrincipal])
                        };
                        
                        await ic.update_settings({
                            canister_id = canisterId;
                            settings = {
                                controllers = controllersToRestore;
                                compute_allocation = null;
                                memory_allocation = null;
                                freezing_threshold = null;
                            };
                        });
                        appendLogs([Debug.print("✅ Controllers restored after install_code")]);
                    } else {
                        appendLogs([Debug.print("✅ User principal still a controller after install_code")]);
                    };
                };
                case null {
                    appendLogs([Debug.print("No user principal provided, skipping controller restoration")]);
                };
            };

            // Start canister if not running
            if (status.status != #running) {
                await ic.start_canister({ canister_id = canisterId });
            };

            appendLogs([Debug.print("SUCCESSFULLY DEPLOYED CANISTER!!")]);
            #ok(Principal.toText(canisterId))
        } catch err {
            appendLogs([
                Debug.print("Error deploying WASM to existing canister: " # Error.message(err))
            ]);
            #err("Failed to deploy WASM: " # Error.message(err))
        };
    };

    public func deleteCanister(canisterId: Principal) : async Result.Result<Text, Text> {
        appendLogs([Debug.print("Deleting canister: " # Principal.toText(canisterId))]);
        try {
            await ic.stop_canister({ canister_id = canisterId });
            await ic.delete_canister({ canister_id = canisterId });
            #ok("Canister deleted successfully")
        } catch err {
            #err("Failed to delete canister: " # Error.message(err))
        }
      };

    //END OF CLASS CODE
    };
};