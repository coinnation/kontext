import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Error "mo:base/Error";
import HashMap "mo:base/HashMap";
import Interface "./ic-management-interface-blob";
import wallet "./wallet";
import Debug "./Debug";
import Cycles "mo:base/ExperimentalCycles";
import Blob "mo:base/Blob";
import Text "mo:base/Text";
import Buffer "mo:base/Buffer";
import Option "mo:base/Option";


module Canister {
    public type CanisterMetadata = {
        name: Text;
        canisterType: Text;
        subType: ?Text;
        project: ?Text;
        didInterface: ?Text;    // For Candid interface
        stableInterface: ?Text; // For stable interface
    };

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
    
    type CanisterSettings = {
        controllers : ?[Principal];
        compute_allocation : ?Nat;
        memory_allocation : ?Nat;
        freezing_threshold : ?Nat;
    };

public class CanisterService(
    isLocalEnvironment: Bool,
    userWallet: ?wallet.Wallet,
    initialUserCanisters: [Principal],  
    mainActor: actor {
        addCanisterMetadata: (Principal, CanisterMetadata) -> async ();
        removeCanisterMetadata: (Principal) -> async ();
        updateCanisterMetadata: (Principal, CanisterMetadata) -> async ();
        getCanisterMetadata: (Principal) -> async ?CanisterMetadata;
    },
    walletService: wallet.WalletService,
    appendLogs: ([Debug.LogEntry]) -> ()
) {
    private var userCanisters: [Principal] = initialUserCanisters;
    
    
        // IC Management Canister Reference
        private let IC = "aaaaa-aa";
        private let ic = actor (IC) : Interface.Self;
        private let CANISTER_CREATION_COST : Nat = 500_000_000_000; // 500B cycles
        private let MEMORY_COST_PER_GB_PER_SECOND : Nat = 127_000;
        private let COMPUTE_COST_PER_PERCENT_PER_SECOND : Nat = 10_000_000;
        private let UPDATE_CALL_COST : Nat = 5_000_000; // 5M cycles per update call
        private let CYCLES_PER_XDR : Float = 1_000_000_000_000; // 1T cycles per XDR
        private let CMC_CANISTER_ID : Principal = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");


        public func validateCanisterSettings(
            memoryGB: Nat,
            computeAllocation: Nat,
            durationInDays: Nat
        ) : Result.Result<Text, Text> {
            if (memoryGB == 0 or memoryGB > 32) {
                return #err("Memory allocation must be between 1 and 32 GB");
            };

            if (computeAllocation == 0 or computeAllocation > 100) {
                return #err("Compute allocation must be between 1 and 100 percent");
            };

            if (durationInDays < 30 or durationInDays > 365) {
                return #err("Duration must be between 30 and 365 days");
            };

            #ok("Valid settings")
        };



    public func createCanisterWithSettings(
        userPrincipal: Principal,    
        userCanisterPrincipal: Principal,   
        memoryGB: Nat,
        computeAllocation: Nat,
        freezingThreshold: ?Nat,
        _durationInDays: Nat,        // Unused but kept for API compatibility
        cyclesAmount: Nat,           // Add cycles amount parameter
        metadata: ?CanisterMetadata
    ): async Result.Result<Text, Text> {
        appendLogs([Debug.print("=== Starting createCanisterWithSettings ===")]);
        appendLogs([Debug.print("- User Principal: " # Principal.toText(userPrincipal))]);
        appendLogs([Debug.print("- Main Canister: " # Principal.toText(userCanisterPrincipal))]);
        appendLogs([Debug.print("- Cycles Amount: " # Nat.toText(cyclesAmount))]);

        // Validate cycles amount
        if (cyclesAmount < 100_000_000_000) { // Minimum 100B cycles
            appendLogs([Debug.print("ERROR: Insufficient cycles amount. Minimum is 100B, provided: " # Nat.toText(cyclesAmount))]);
            return #err("Cycles amount must be at least 100B (100_000_000_000)");
        };

        // Step 1: Calculate costs or use provided cycles
        appendLogs([Debug.print("Step 1: Using provided cycles amount: " # Nat.toText(cyclesAmount))]);
        
        // Step 4: Configure canister settings
        appendLogs([Debug.print("Step 2: Configuring canister settings")]);
        let memoryAllocation = memoryGB * 1024 * 1024 * 1024;
        let settings: CanisterSettings = {
            controllers = ?[userPrincipal, userCanisterPrincipal];
            compute_allocation = ?computeAllocation;
            memory_allocation = ?memoryAllocation;
            freezing_threshold = freezingThreshold;
        };

        appendLogs([
            Debug.print("Settings configured:"),
            Debug.print("- Environment: " # (if (isLocalEnvironment) "Local" else "Production")),
            Debug.print("- Provided Cycles: " # Nat.toText(cyclesAmount)),
            Debug.print("- Memory Allocation: " # Nat.toText(memoryAllocation)),
            Debug.print("- Compute Allocation: " # Nat.toText(computeAllocation))
        ]);

        try {
            // Step 3: Create canister
            appendLogs([Debug.print("Step 3: Creating canister...")]);
            Cycles.add<system>(cyclesAmount);  // Use the provided cycles amount
            let newCanister = await ic.create_canister({ settings = ?settings });
            let canisterId = newCanister.canister_id;
            appendLogs([Debug.print("Canister created with ID: " # Principal.toText(canisterId))]);

            // Step 4: Add canister as controller
            appendLogs([Debug.print("Step 4: Setting up controllers...")]);
            await ic.update_settings({
                canister_id = canisterId;
                settings = {
                    controllers = ?[canisterId, userPrincipal, userCanisterPrincipal];
                    compute_allocation = null;
                    memory_allocation = null;
                    freezing_threshold = null;
                };
            });

            // Step 5: Create and store metadata
            appendLogs([Debug.print("Step 5: Storing metadata")]);
                
            let defaultMetadata: CanisterMetadata = {
                name = switch(metadata) {
                    case (?meta) meta.name;  // Use the name from metadata
                    case null Principal.toText(canisterId);  // Fallback to using the ID
                };
                canisterType = switch(metadata) {
                    case (?meta) meta.canisterType;
                    case null "unknown";
                };
                subType = switch(metadata) {
                    case (?meta) meta.subType;
                    case null null;
                };
                project = switch(metadata) {
                    case (?meta) meta.project;
                    case null null;
                };
                didInterface = switch(metadata) {
                    case (?meta) meta.didInterface;
                    case null null;
                };
                stableInterface = switch(metadata) {
                    case (?meta) meta.stableInterface;
                    case null null;
                };
            };

            // Store metadata in main actor
            await mainActor.addCanisterMetadata(canisterId, defaultMetadata);
            
            // Step 6: Update user canisters list (only do this once)
            appendLogs([Debug.print("Step 6: Updating user canisters list")]);
            userCanisters := Array.append<Principal>(userCanisters, [canisterId]);

            appendLogs([Debug.print("✅ Canister created successfully: " # Principal.toText(canisterId))]);
            #ok(Principal.toText(canisterId))
        } catch err {
            appendLogs([Debug.print("❌ Failed to create canister: " # Error.message(err))]);
            #err("Failed to create canister: " # Error.message(err))
        }
    };
            
        
public func deployToExistingCanister(
    canisterId: Principal,
    wasm: [Nat8],
    canisterType: Text,
    deploymentStage: Text,
    userCanisterPrincipal: Principal,
    userPrincipal: Principal,
    metadata: ?CanisterMetadata,
    installMode: ?Text // New parameter to specify install mode
) : async Result.Result<Text, Text> {
    appendLogs([Debug.print("Deploying " # canisterType # " (" # deploymentStage # ") WASM to existing canister: " # Principal.toText(canisterId))]);

    try {
        let status = await ic.canister_status({ canister_id = canisterId });

        let init_args = switch (canisterType, deploymentStage) {
            case ("frontend", "assetstorage") {
                appendLogs([Debug.print("ATTEMPTING FRONTEND ASSET STORAGE!")]);
                to_candid(
                    ?#Init({
                        set_permissions = ?{
                            prepare = [userPrincipal, userCanisterPrincipal];
                            commit = [userPrincipal, userCanisterPrincipal];
                            manage_permissions = [userPrincipal, userCanisterPrincipal];
                        }
                    }) : ?AssetCanisterArgs
                )
            };
            case ("frontend", "frontend") {
                appendLogs([Debug.print("ATTEMPTING FRONTEND CODE!")]);
                to_candid(
                    ?#Init({
                        set_permissions = ?{
                            prepare = [userPrincipal, userCanisterPrincipal];
                            commit = [userPrincipal, userCanisterPrincipal];
                            manage_permissions = [userPrincipal, userCanisterPrincipal];
                        }
                    }) : ?AssetCanisterArgs
                )
            };
            case ("backend", _) {
                appendLogs([Debug.print("ATTEMPTING BACKEND STORAGE!")]);
                to_candid(null)
            };
            case _ {
                to_candid(null)
            };
        };

        // Determine installation mode based on the parameter
let mode = switch (installMode) {
    case (?mode) {
        switch (mode) {
            case ("upgrade") {
                appendLogs([Debug.print("Using UPGRADE mode with EOP")]);
                // The #upgrade variant expects an optional record
                // which contains optional fields for skip_pre_upgrade and wasm_memory_persistence
                #upgrade(?{
                    skip_pre_upgrade = ?false; // This is ?Bool, not Null
                    wasm_memory_persistence = ?#Keep; // This allows #Keep or #replace
                })
            };
            case ("reinstall") {
                appendLogs([Debug.print("Using REINSTALL mode")]);
                #reinstall
            };
            case ("install") {
                appendLogs([Debug.print("Using INSTALL mode")]);
                #install
            };
            case _ {
                appendLogs([Debug.print("Unknown mode, defaulting to REINSTALL")]);
                #reinstall
            }
        }
    };
    case (null) {
        // Default to reinstall for backward compatibility
        appendLogs([Debug.print("No mode specified, defaulting to REINSTALL")]);
        #reinstall
    }
};

        appendLogs([Debug.print("Installing code with mode: " # debug_show(mode))]);
        
        await ic.install_code({
            arg = init_args;
            wasm_module = wasm;
            mode = mode;
            canister_id = canisterId;
        });

        if (canisterType == "backend") {
            switch(metadata) {
                case (?meta) {
                    switch(meta.didInterface) {
                        case (?candid) {
                            appendLogs([Debug.print("Installing Candid interface for backend canister")]);
                            await ic.update_settings({
                                canister_id = canisterId;
                                settings = {
                                    candid_module = ?Text.encodeUtf8(candid);
                                    compute_allocation = null;
                                    controllers = null;
                                    freezing_threshold = null;
                                    memory_allocation = null;
                                }
                            });
                        };
                        case null {
                            appendLogs([Debug.print("No Candid interface provided in metadata")]);
                        };
                    };
                };
                case null {
                    appendLogs([Debug.print("No metadata provided for backend canister")]);
                };
            };
        };

        if (status.status != #running) {
            await ic.start_canister({ canister_id = canisterId });
        };

        appendLogs([Debug.print("SUCCESSFULLY DEPLOYED " # canisterType # " CANISTER!!")]);
        #ok(Principal.toText(canisterId))
    } catch err {
        appendLogs([
            Debug.print("Error deploying " # canisterType # " WASM to existing canister: " # Error.message(err))
        ]);
        #err("Failed to deploy WASM: " # Error.message(err))
    }
};

public func deployBackendWithCustomInit(
    canisterId: Principal,
    wasm: [Nat8],
    initArgs: Blob, // Using Blob for binary data
    _userCanisterPrincipal: Principal,
    _userPrincipal: Principal,
    metadata: ?CanisterMetadata,
    installMode: ?Text // New parameter to specify install mode
) : async Result.Result<Text, Text> {
    appendLogs([Debug.print("Deploying backend WASM with custom init args to existing canister: " # Principal.toText(canisterId))]);
    appendLogs([Debug.print("Init args byte length: " # Nat.toText(initArgs.size()))]);
    
    if (installMode != null) {
        appendLogs([Debug.print("Installation mode: " # Option.get(installMode, "reinstall"))]);
    };

    try {
        let status = await ic.canister_status({ canister_id = canisterId });
        
        // Determine installation mode based on the parameter
        let baseParams = {
            arg = initArgs;
            wasm_module = wasm;
            canister_id = canisterId;
        };
        
        // Handle different installation modes
        switch (installMode) {
            case (?mode) {
                switch (mode) {
                    case ("upgrade") {
                        appendLogs([Debug.print("Using UPGRADE mode with EOP")]);
                        // For upgrade with EOP
                        await ic.install_code({
                            arg = baseParams.arg;
                            wasm_module = baseParams.wasm_module;
                            canister_id = baseParams.canister_id;
                            mode = #upgrade(?{
                                skip_pre_upgrade = ?false;
                                wasm_memory_persistence = ?#Keep;
                            });
                        });
                    };
                    case ("install") {
                        appendLogs([Debug.print("Using INSTALL mode")]);
                        // For install
                        await ic.install_code({
                            arg = baseParams.arg;
                            wasm_module = baseParams.wasm_module;
                            canister_id = baseParams.canister_id;
                            mode = #install;
                        });
                    };
                    case _ {
                        // Default to reinstall for any other value
                        appendLogs([Debug.print("Using REINSTALL mode (default)")]);
                        await ic.install_code({
                            arg = baseParams.arg;
                            wasm_module = baseParams.wasm_module;
                            canister_id = baseParams.canister_id;
                            mode = #reinstall;
                        });
                    };
                };
            };
            case (null) {
                // Default to reinstall for backward compatibility
                appendLogs([Debug.print("No mode specified, defaulting to REINSTALL")]);
                await ic.install_code({
                    arg = baseParams.arg;
                    wasm_module = baseParams.wasm_module;
                    canister_id = baseParams.canister_id;
                    mode = #reinstall;
                });
            };
        };

        // Handle metadata (same as original)
        switch(metadata) {
            case (?meta) {
                switch(meta.didInterface) {
                    case (?candid) {
                        appendLogs([Debug.print("Installing Candid interface for backend canister")]);
                        await ic.update_settings({
                            canister_id = canisterId;
                            settings = {
                                candid_module = ?Text.encodeUtf8(candid);
                                compute_allocation = null;
                                controllers = null;
                                freezing_threshold = null;
                                memory_allocation = null;
                            }
                        });
                    };
                    case null {
                        appendLogs([Debug.print("No Candid interface provided in metadata")]);
                    };
                };
            };
            case null {
                appendLogs([Debug.print("No metadata provided for backend canister")]);
            };
        };

        if (status.status != #running) {
            await ic.start_canister({ canister_id = canisterId });
        };

        let modeText = switch (installMode) {
            case (?m) { m };
            case (null) { "reinstall" };
        };
        appendLogs([Debug.print("SUCCESSFULLY DEPLOYED BACKEND CANISTER WITH CUSTOM INIT ARGS USING MODE: " # modeText)]);
        #ok(Principal.toText(canisterId))
    } catch (err) {
        appendLogs([
            Debug.print("Error deploying backend WASM with custom init args to existing canister: " # Error.message(err))
        ]);
        #err("Failed to deploy backend WASM with custom init args: " # Error.message(err))
    };
};


    private func mockGetIcpXdrConversionRate() : async { data : { xdr_permyriad_per_icp : Int } } {
        return { data = { xdr_permyriad_per_icp = 10000 } };
    };

    public func calculateCyclesCost(
        memoryGB : Nat,
        computeAllocation : Nat,
        estimatedUpdateCallsPerDay : Nat,
        durationInDays : Nat
    ) : async {
        totalICP : Float;
        breakdown : {
            creationCostICP : Float;
            memoryCostICP : Float;
            computeCostICP : Float;
            operationsCostICP : Float;
        };
    } {
        let durationInSeconds = durationInDays * 24 * 60 * 60;

        let memoryCost = memoryGB * MEMORY_COST_PER_GB_PER_SECOND * durationInSeconds;
        let computeCost = computeAllocation * COMPUTE_COST_PER_PERCENT_PER_SECOND * durationInSeconds;
        let operationsCost = estimatedUpdateCallsPerDay * UPDATE_CALL_COST * durationInDays;

        let totalCycles = CANISTER_CREATION_COST;
        let conversionRate = if (isLocalEnvironment) {
            await mockGetIcpXdrConversionRate();
        } else {
            let cmc = actor(Principal.toText(CMC_CANISTER_ID)) : actor {
                get_icp_xdr_conversion_rate : () -> async { data : { xdr_permyriad_per_icp : Int } }
            };
            await cmc.get_icp_xdr_conversion_rate();
        };

        let xdrPerIcp : Float = Float.fromInt(conversionRate.data.xdr_permyriad_per_icp) / 10000.0;
        let cyclesPerIcp = CYCLES_PER_XDR / xdrPerIcp;
        let totalICP = Float.fromInt(totalCycles) / cyclesPerIcp;
        let creationCostICP = Float.fromInt(CANISTER_CREATION_COST) / cyclesPerIcp;
        let memoryCostICP = Float.fromInt(memoryCost) / cyclesPerIcp;
        let computeCostICP = Float.fromInt(computeCost) / cyclesPerIcp;
        let operationsCostICP = Float.fromInt(operationsCost) / cyclesPerIcp;

        return {
            totalICP = totalICP;
            breakdown = {
                creationCostICP = creationCostICP;
                memoryCostICP = memoryCostICP;
                computeCostICP = computeCostICP;
                operationsCostICP = operationsCostICP;
            };
        };
    };

    // Updated to work with any canister, not just those created by the user
    public func topUpCanister(
        userPrincipal: Principal,
        canisterId: Principal,
        icpAmount: Float
    ) : async Result.Result<Text, Text> {
        appendLogs([Debug.print("=== Starting topUpCanister ===")]);
        appendLogs([Debug.print("- User Principal: " # Principal.toText(userPrincipal))]);
        appendLogs([Debug.print("- Canister ID: " # Principal.toText(canisterId))]);
        appendLogs([Debug.print("- ICP Amount: " # Float.toText(icpAmount))]);

        if (isLocalEnvironment) {
            try {
                // In local environment, directly add cycles to the canister
                let cyclesPerIcp = 1_000_000_000_000;  // 1T cycles per ICP
                let cyclesToAdd = Float.toInt(icpAmount * Float.fromInt(cyclesPerIcp));

                appendLogs([Debug.print("Local environment - adding " # Int.toText(cyclesToAdd) # " cycles")]);
                Cycles.add<system>(Int.abs(cyclesToAdd));
                await ic.deposit_cycles({ canister_id = canisterId });

                appendLogs([Debug.print("✅ Successfully added cycles to canister " # Principal.toText(canisterId))]);
                #ok("Added " # Int.toText(cyclesToAdd) # " cycles to canister")
            } catch (err) {
                appendLogs([Debug.print("❌ Failed to add cycles: " # Error.message(err))]);
                #err("Failed to add cycles in local environment: " # Error.message(err))
            }
        } else {
            // For production environment, we need to handle the ICP to cycles conversion
            // and sending ICP to the cycles minting canister
            
            switch (userWallet) {
                case (null) {
                    appendLogs([Debug.print("❌ No wallet found for user")]);
                    return #err("No wallet found for user");
                };
                case (?wallet) {
                    try {
                        // 1. Get the CMC account ID where to send ICP
                        let cmcCanister = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai"); // Cycles Minting Canister
                        
                        // Create default subaccount for CMC (all zeros)
                        let defaultSubaccount = walletService.createDefaultSubaccount();
                        
                        // Get the account ID for the CMC
                        let cmcAccountIdArray = walletService.accountIdentifier(cmcCanister, defaultSubaccount);
                        let cmcAccountIdBlob = Blob.fromArray(cmcAccountIdArray);
                        let cmcAccountId = walletService.blobToHex(cmcAccountIdBlob);
                        
                        appendLogs([Debug.print("Sending ICP to CMC account ID: " # cmcAccountId)]);
                        
                        // 2. Convert ICP amount to e8s (ICP * 10^8)
                        let e8sAmount = Nat64.fromNat(Int.abs(Float.toInt(icpAmount * 100_000_000)));
                        
                        // 3. Send ICP to the CMC
                        let sendResult = await walletService.sendICPToAccountId(
                            wallet,
                            cmcAccountId,
                            Nat64.toNat(e8sAmount)
                        );
                        
                        appendLogs([Debug.print("ICP send result: " # sendResult)]);
                        
                        // 4. If successful, deposit cycles to the canister
                        if (Text.startsWith(sendResult, #text "Transaction successful")) {
                            // Get conversion rate
                            let cmc = actor(Principal.toText(CMC_CANISTER_ID)) : actor {
                                get_icp_xdr_conversion_rate : () -> async { data : { xdr_permyriad_per_icp : Int } }
                            };
                            let conversionRate = await cmc.get_icp_xdr_conversion_rate();
                            let xdrPerIcp : Float = Float.fromInt(conversionRate.data.xdr_permyriad_per_icp) / 10000.0;
                            let cyclesPerIcp = CYCLES_PER_XDR / xdrPerIcp;
                            let cyclesToAdd = Float.toInt(icpAmount * cyclesPerIcp);
                            
                            appendLogs([Debug.print("Adding " # Int.toText(cyclesToAdd) # " cycles to canister")]);
                            
                            // Notify the CMC to convert the ICP to cycles and deposit to the canister
                            // Note: In a real implementation, you would need to call the CMC's appropriate method
                            // This is a simplified placeholder - in production you'd need to call the actual CMC
                            // interface to perform the conversion and deposit
                            Cycles.add<system>(Int.abs(cyclesToAdd));
                            await ic.deposit_cycles({ canister_id = canisterId });
                            
                            #ok("Successfully topped up canister with " # Float.toText(icpAmount) # " ICP worth of cycles")
                        } else {
                            appendLogs([Debug.print("❌ ICP transaction failed")]);
                            #err("ICP transaction failed: " # sendResult)
                        }
                    } catch (err) {
                        appendLogs([Debug.print("❌ Top-up failed: " # Error.message(err))]);
                        #err("Failed to top up canister: " # Error.message(err))
                    }
                };
            }
        }
    };


        public func startCanister(canisterId: Principal) : async Result.Result<Text, Text> {
            appendLogs([Debug.print("Starting canister: " # Principal.toText(canisterId))]);

            try {
                await ic.start_canister({ canister_id = canisterId });
                #ok("Canister started successfully")
            } catch err {
                #err("Failed to start canister: " # Error.message(err))
            }
        };


        public func stopCanister(canisterId: Principal) : async Result.Result<Text, Text> {
            appendLogs([Debug.print("Stopping canister: " # Principal.toText(canisterId))]);

            try {
                await ic.stop_canister({ canister_id = canisterId });
                #ok("Canister stopped successfully")
            } catch err {
                #err("Failed to stop canister: " # Error.message(err))
            }
        };

        public func getCanisterBalance(canisterId: Principal) : async Result.Result<Nat, Text> {
            try {
                let status = await ic.canister_status({ canister_id = canisterId });
                #ok(status.cycles)
            } catch err {
                #err("Failed to get canister balance: " # Error.message(err))
            }
        };

        public func isModuleInstalled(canisterId: Principal) : async Result.Result<Bool, Text> {
            try {
                let status = await ic.canister_status({ canister_id = canisterId });
                #ok(status.module_hash != null)
            } catch err {
                #err("Failed to check module installation: " # Error.message(err))
            }
        };

        public func getCanisterStatus(canisterId: Principal) : async Result.Result<Text, Text> {
            try {
                let status = await ic.canister_status({ canister_id = canisterId });
                #ok(
                    switch (status.status) {
                        case (#running) "running";
                        case (#stopping) "stopping";
                        case (#stopped) "stopped";
                    }
                )
            } catch err {
                #err("Failed to get canister status: " # Error.message(err))
            }
        };



public func updateCanisterMetadata(
    canisterId: Principal,
    metadata: CanisterMetadata
) : async Result.Result<Text, Text> {
    appendLogs([Debug.print("=== Starting updateCanisterMetadata ===")]);
    appendLogs([Debug.print("Canister ID: " # Principal.toText(canisterId))]);
    
    try {
        await mainActor.updateCanisterMetadata(canisterId, metadata);
        #ok("Metadata updated successfully")
    } catch (err) {
        #err("Failed to update metadata: " # Error.message(err))
    }
};





public func deleteCanister(canisterId: Principal) : async Result.Result<Text, Text> {
    try {
        await ic.stop_canister({ canister_id = canisterId });
        await ic.delete_canister({ canister_id = canisterId });

        // Remove metadata through main actor instead of local storage
        await mainActor.removeCanisterMetadata(canisterId);



        // Update user canisters list
        userCanisters := Array.filter<Principal>(
            userCanisters,
            func(c: Principal) : Bool {
                not Principal.equal(c, canisterId)
            }
        );

        #ok("Canister deleted successfully")
    } catch err {
        #err("Failed to delete canister: " # Error.message(err))
    }
};


public func getUserCanisters() : async [{
    principal: Principal;
    metadata: ?CanisterMetadata;
}] {
    let results = Buffer.Buffer<{
        principal: Principal;
        metadata: ?CanisterMetadata;
    }>(userCanisters.size());

    for (canisterId in userCanisters.vals()) {
        let metadata = await mainActor.getCanisterMetadata(canisterId);
        results.add({
            principal = canisterId;
            metadata = metadata;
        });
    };

    Buffer.toArray(results)
};



    }; // End of class
}; // End of module