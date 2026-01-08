import Prim "mo:prim";
import Region "mo:base/Region";
import HashMap "mo:base/HashMap";
import Text "mo:base/Text";
import Nat64 "mo:base/Nat64";
import Principal "mo:base/Principal";
import Interface "ic-management-interface-blob";
import Debug "Debug";

module Metadata {
  public type Metadata = {
    totalKeys: Nat;
    totalUsers: Nat;
    memoryUsage: Nat64;
    cycleBalance: Nat64;
    stableMemoryUsage: Nat;
    heapMemoryUsage: Nat64;
    stableStateSize: Nat;
    uptime: Nat64;
    version: Text;
    lastUpdated: Nat64;
    balance: Nat;
    memorySize: Nat;
    idleCyclesBurnedPerDay: Nat;
    moduleHash: ?[Nat8]; // Use [Nat8] instead of Blob
  };

  private let managementCanister: Interface.Self = actor("aaaaa-aa");

  public func getStateMetadata(
    transientState: HashMap.HashMap<Text, Text>,
    transientUsers: HashMap.HashMap<Text, { name: Text; email: Text }>,
    state: [(Text, Text)],
    users: [(Text, { name: Text; email: Text })],
    regionData: Region,
    startTime: Nat64,
    version: Text,
    lastUpdated: Nat64,
    canisterId: Principal
  ): async Metadata {
    let regionSizeNat64 = Region.size(regionData); // Get size in Nat64
    let sizeInNat: Nat = Nat64.toNat(regionSizeNat64); // Convert to Nat safely

    let canisterStatus = await managementCanister.canister_status({
      canister_id = canisterId;
    });

    {
      totalKeys = transientState.size();
      totalUsers = transientUsers.size();
      memoryUsage = Nat64.fromNat(Prim.rts_memory_size()); // Convert Nat to Nat64
      cycleBalance = Nat64.fromNat(Prim.cyclesBalance()); // Convert Nat to Nat64
      stableMemoryUsage = sizeInNat; // Assign converted value
      heapMemoryUsage = Nat64.fromNat(Prim.rts_heap_size()); // Convert Nat to Nat64
      stableStateSize = state.size() + users.size();
      uptime = Prim.time() - startTime; // Already Nat64
      version = version;
      lastUpdated = lastUpdated;

      // Additional fields from canister_status
      balance = canisterStatus.cycles; // Total cycles available
      memorySize = canisterStatus.memory_size; // Current memory usage
      idleCyclesBurnedPerDay = canisterStatus.idle_cycles_burned_per_day; // Idle cycle burn rate

      // Use [Nat8] instead of Blob
      moduleHash = switch (canisterStatus.module_hash) {
        case (?hash) ?hash;
        case null null;
      };
    }
  };
};
