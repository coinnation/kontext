import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Blob "mo:base/Blob";
import Array "mo:base/Array";
import Error "mo:base/Error";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Text "mo:base/Text";
import Sha256 "mo:sha2/Sha256";
import HashMap "mo:base/HashMap";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Char "mo:base/Char";

module Wallet {

    public type TransactionType = {
        #received;
        #sent;
        #canister;
    };

    public type Transaction = {
        transactionType: TransactionType;
        counterparty: Text;
        amount: Nat;  // Amount in e8s (1 ICP = 100_000_000 e8s)
        timestamp: Int;  // Time.now() value when transaction occurred
        isPositive: Bool;
        memo: ?Text;  // Optional memo field
    };

    // Update the Wallet type to include transactions
    public type Wallet = {
        principal: Principal;
        subaccount: Blob;
        balance: Nat;
        transactions: [Transaction];  // Array of transactions
    };

    // Define ICP ledger interface types
    private type Account = { owner : Principal; subaccount : ?[Nat8] };
    private type Tokens = { e8s : Nat64 };
    private type TransferArgs = {
        memo: Nat64;
        amount: { e8s: Nat64 };
        fee: { e8s: Nat64 };
        from_subaccount: ?[Nat8];
        to: [Nat8];
        created_at_time: ?{ timestamp_nanos: Nat64 };
    };
    private type TransferResult = {
        #Ok : Nat64;
        #Err : {
            #BadFee : { expected_fee: { e8s: Nat64 } };
            #InsufficientFunds : { balance: { e8s: Nat64 } };
            #TxTooOld : { allowed_window_nanos: Nat64 };
            #TxCreatedInFuture;
            #TxDuplicate : { duplicate_of: Nat64 };
        };
    };

    // Create actor interface for the ledger - same ID for both local and mainnet
    private let Ledger = actor "ryjl3-tyaaa-aaaaa-aaaba-cai" : actor {
        transfer : (TransferArgs) -> async TransferResult;
        account_balance : query ({ account: Blob }) -> async Tokens;
    };

    public class WalletService(getEnvironment: () -> Bool) {
        private let isLocalEnvironment = getEnvironment;
        private let ICP_FEE : Nat64 = 10_000;  // Standard ICP transfer fee

        // Changed from private to public for use in main actor
        public func blobToHex(blob : Blob) : Text {
            let hexChars = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
            let array = Blob.toArray(blob);
            var result = "";
            for (byte in array.vals()) {
                result #= hexChars[Nat8.toNat(byte / 16)] # hexChars[Nat8.toNat(byte % 16)];
            };
            result
        };

        /// Ultra simple hex string to blob conversion
        public func hexToBlob(hex : Text) : ?Blob {
            // Check if hex length is even
            if (Text.size(hex) % 2 != 0) {
                return null;
            };
            
            // Fixed-size buffer based on expected length
            let bufferSize = Text.size(hex) / 2;
            let buffer = Array.init<Nat8>(bufferSize, 0);
            var index = 0;
            
            // Process the hex string using Text.toIter
            var hexIter = Text.toIter(hex);
            var c1Opt = hexIter.next();
            
            while (c1Opt != null) {
                // Get first character
                let c1 = switch(c1Opt) {
                    case (?c) { c };
                    case (null) { return null; };
                };
                
                // Get second character
                let c2Opt = hexIter.next();
                let c2 = switch(c2Opt) {
                    case (?c) { c };
                    case (null) { return null; };
                };
                
                // Convert first character to a nibble (0-15)
                var high : Nat8 = 0;
                if (c1 >= '0' and c1 <= '9') {
                    high := Nat8.fromNat(Nat32.toNat(Char.toNat32(c1) - Char.toNat32('0')));
                } else if (c1 >= 'a' and c1 <= 'f') {
                    high := Nat8.fromNat(Nat32.toNat(Char.toNat32(c1) - Char.toNat32('a') + 10));
                } else if (c1 >= 'A' and c1 <= 'F') {
                    high := Nat8.fromNat(Nat32.toNat(Char.toNat32(c1) - Char.toNat32('A') + 10));
                } else {
                    return null; // Invalid character
                };
                
                // Convert second character to a nibble (0-15)
                var low : Nat8 = 0;
                if (c2 >= '0' and c2 <= '9') {
                    low := Nat8.fromNat(Nat32.toNat(Char.toNat32(c2) - Char.toNat32('0')));
                } else if (c2 >= 'a' and c2 <= 'f') {
                    low := Nat8.fromNat(Nat32.toNat(Char.toNat32(c2) - Char.toNat32('a') + 10));
                } else if (c2 >= 'A' and c2 <= 'F') {
                    low := Nat8.fromNat(Nat32.toNat(Char.toNat32(c2) - Char.toNat32('A') + 10));
                } else {
                    return null; // Invalid character
                };
                
                // Combine nibbles into a byte
                buffer[index] := (high * 16) + low;
                index += 1;
                
                // Get next character for the next iteration
                c1Opt := hexIter.next();
            };
            
            ?Blob.fromArray(Array.freeze(buffer))
        };

        private func natToNat64(n: Nat) : Nat64 {
            // Check if n is within safe range for Nat64
            if (n > 18446744073709551615) {
                Debug.print("Warning: Value too large for Nat64, truncating");
                return 18446744073709551615; // Max Nat64 value
            };
            Nat64.fromNat(n)
        };

        private func nat64ToNat(n: Nat64) : Nat {
            Nat64.toNat(n)
        };

        // Create a standard 32-byte subaccount from principal
        private func generateSubaccount(userPrincipal: Principal) : Blob {
            // Generate standard 32-byte subaccount
            // We'll use the principal's hash for the first 4 bytes to maintain
            // your original approach while ensuring 32 byte length
            let hash = Principal.hash(userPrincipal);
            let hashBytes = [
                Nat8.fromNat(Nat32.toNat(hash >> 24 & 0xFF)),
                Nat8.fromNat(Nat32.toNat(hash >> 16 & 0xFF)),
                Nat8.fromNat(Nat32.toNat(hash >> 8 & 0xFF)),
                Nat8.fromNat(Nat32.toNat(hash & 0xFF))
            ];
            // Create a 32-byte array filled with zeros
            let zeroes = Array.init<Nat8>(32, 0);
            // Copy the hash bytes into the first 4 positions
            for (i in Iter.range(0, 3)) {
                zeroes[i] := hashBytes[i];
            };
            // Convert to immutable array and then to Blob
            Blob.fromArray(Array.freeze(zeroes))
        };

        // Changed from private to public for use in main actor
        public func accountIdentifier(principal: Principal, subaccount: Blob) : [Nat8] {
            // Convert subaccount Blob to [Nat8] array
            let subaccountArray = Blob.toArray(subaccount);
            
            // Create account identifier directly
            let principalBlob = Principal.toBlob(principal);
            let principalBytes = Blob.toArray(principalBlob);
            
            // Create the prefix manually to avoid escape sequence issues
            // \x0A is 10 in decimal (newline character)
            let newline = [10: Nat8]; // Single byte array with the newline character
            let accountIdText = Blob.toArray(Text.encodeUtf8("account-id"));
            let accountIdPrefix = Array.flatten<Nat8>([newline, accountIdText]);
            
            // Calculate SHA-224 hash
            let hashInput = Array.flatten<Nat8>([
                accountIdPrefix,
                principalBytes,
                subaccountArray
            ]);
            
            let shaObj = Sha256.fromArray(#sha224, hashInput);
            let hash = Blob.toArray(shaObj);
            
            // Generate the account identifier (4-byte CRC32 checksum + hash)
            let crc32Bytes = calculateCRC32(hash);
            Array.flatten<Nat8>([crc32Bytes, hash])
        };
        
        // Helper function to calculate CRC32 checksum
        private func calculateCRC32(bytes: [Nat8]) : [Nat8] {
            var crc : Nat32 = 0xFFFFFFFF;
            for (byte in bytes.vals()) {
                crc := crc ^ Nat32.fromNat(Nat8.toNat(byte));
                for (_ in Iter.range(0, 7)) {
                    crc := (crc >> 1) ^ (if ((crc & 1) == 1) 0xEDB88320 else 0);
                };
            };
            let finalCrc = ^crc;
            
            // Convert to big-endian bytes
            [
                Nat8.fromNat(Nat32.toNat((finalCrc >> 24) & 0xFF)),
                Nat8.fromNat(Nat32.toNat((finalCrc >> 16) & 0xFF)),
                Nat8.fromNat(Nat32.toNat((finalCrc >> 8) & 0xFF)),
                Nat8.fromNat(Nat32.toNat(finalCrc & 0xFF))
            ]
        };
        
        // Added convenience method to create a default empty subaccount
        public func createDefaultSubaccount() : Blob {
            Blob.fromArray(Array.freeze(Array.init<Nat8>(32, 0)))
        };


        // Update wallet creation logic
        public func createWallet(userPrincipal: Principal) : Wallet {
            {
                principal = userPrincipal;
                subaccount = generateSubaccount(userPrincipal);
                balance = 0;
                transactions = []; // Initialize with empty array
            }
        };

        // Added new function to create a wallet with a specific subaccount
        public func createWalletWithSubaccount(userPrincipal: Principal, subaccount: Blob) : Wallet {
            {
                principal = userPrincipal;
                subaccount = subaccount;
                balance = 0;
                transactions = []; // Initialize with empty array
            }
        };

        public func getWalletId(wallet: Wallet) : {
            principal: Text;
            subaccount: Text;
            accountIdentifier: Text;
        } {
            // Get the account identifier as an array of Nat8
            let identifierArray = accountIdentifier(wallet.principal, wallet.subaccount);
            
            // Convert to Blob for hex conversion
            let identifierBlob = Blob.fromArray(identifierArray);
            
            {
                principal = Principal.toText(wallet.principal);
                subaccount = blobToHex(wallet.subaccount);
                accountIdentifier = blobToHex(identifierBlob);
            }
        };

        private type CacheEntry = {
            balance: Nat;
            timestamp: Int;  // Time.now() returns Int
        };

        private let CACHE_TTL_NANOS : Int = 60_000_000_000; // 1 minute
        private let balanceCache = HashMap.HashMap<Principal, CacheEntry>(10, Principal.equal, Principal.hash);

        private func isCacheValid(entry: CacheEntry) : Bool {
            let now = Time.now();
            (now - entry.timestamp) < CACHE_TTL_NANOS
        };

        public func isLocalEnvironmentActive() : Bool {
            isLocalEnvironment()
        };

        public func getBalance(wallet: Wallet) : async Nat {
            if (isLocalEnvironment()) {
                Debug.print("Running in local environment: Returning mock balance");
                return 1_000_000_000; // 10 ICP in e8s for testing
            };

            // Check cache first
            switch (balanceCache.get(wallet.principal)) {
                case (?entry) {
                    if (isCacheValid(entry)) {
                        return entry.balance;
                    };
                };
                case null {};
            };

            try {
                // Get the account identifier as [Nat8] array
                let accountIdArray = accountIdentifier(wallet.principal, wallet.subaccount);
                // Convert to Blob for the ledger call
                let accountIdBlob = Blob.fromArray(accountIdArray);

                Debug.print("Account ID: " # debug_show(accountIdBlob));
                Debug.print("Account ID Hex: " # blobToHex(accountIdBlob));

                let balance = await Ledger.account_balance({ account = accountIdBlob });

                Debug.print("Raw balance: " # debug_show(balance));
                
                let currentBalance = nat64ToNat(balance.e8s);

                // Update cache
                balanceCache.put(wallet.principal, {
                    balance = currentBalance;
                    timestamp = Time.now();
                });

                currentBalance
            } catch (err) {
                Debug.print("Error fetching balance: " # Error.message(err));
                switch (balanceCache.get(wallet.principal)) {
                    case (?entry) entry.balance;
                    case null 0;
                }
            }
        };

        public func getCycleBalance(wallet: Wallet) : async Nat {
            if (isLocalEnvironment()) {
                // In local environment, calculate fake cycles based on ICP balance
                // Let's say 1 ICP = 10T cycles for testing
                let balance = await getBalance(wallet);
                let icpAmount = balance / 100_000_000; // Convert e8s to ICP
                return icpAmount * 10_000_000_000_000; // 10T cycles per ICP
            } else {
                // In production this would connect to the actual cycle management
                // For now return 0
                return 0;
            };
        };


public func sendICP(fromWallet: Wallet, toWallet: Wallet, amount: Nat) : async Text {
    Debug.print("Amount: " # debug_show(amount));
    Debug.print("From principal: " # Principal.toText(fromWallet.principal));
    Debug.print("To principal: " # Principal.toText(toWallet.principal));

    // Get detailed wallet info for debugging
    let fromWalletInfo = getWalletId(fromWallet);
    let toWalletInfo = getWalletId(toWallet);
    
    Debug.print("From account ID: " # fromWalletInfo.accountIdentifier);
    Debug.print("To account ID: " # toWalletInfo.accountIdentifier);

    // Check balance
    let actualBalance = await getBalance(fromWallet);
    Debug.print("Actual balance before transfer: " # Nat.toText(actualBalance) # " e8s");
    Debug.print("Required amount with fee: " # Nat.toText(amount + nat64ToNat(ICP_FEE)) # " e8s");
    
    // Verify sufficient funds
    if (actualBalance < amount + nat64ToNat(ICP_FEE)) {
        return "Error: Insufficient funds. You have " # Nat.toText(actualBalance) # 
                " e8s but need " # Nat.toText(amount + nat64ToNat(ICP_FEE)) # " e8s (including fee).";
    };
                
    // Add explicit environment check for debugging
    let isLocal = isLocalEnvironment();
    Debug.print("Is local environment? " # debug_show(isLocal));
    
    if (isLocal) {
        Debug.print("Using local environment path");
        // We'll let the caller handle adding the transaction
        return "Dummy transaction: Sent " # Nat.toText(amount) # " e8s to " # Principal.toText(toWallet.principal);
    } else {
        Debug.print("Using production environment path");
        
        // Convert from_subaccount to [Nat8] array
        let fromSubaccountArray = Blob.toArray(fromWallet.subaccount);
        Debug.print("From subaccount: " # blobToHex(fromWallet.subaccount));
        
        // Get recipient account identifier
        let toAccountId = accountIdentifier(toWallet.principal, toWallet.subaccount);
        Debug.print("To account ID: " # blobToHex(Blob.fromArray(toAccountId)));
        
        // Prepare transfer arguments
        let transferArgs : TransferArgs = {
            memo = Nat64.fromNat(0);
            amount = { e8s = natToNat64(amount) };
            fee = { e8s = ICP_FEE };
            from_subaccount = ?fromSubaccountArray;
            to = toAccountId;
            created_at_time = null;
        };
        
        Debug.print("Transfer args prepared");
        
        try {
            Debug.print("Making ledger.transfer call...");
            let transferResult = await Ledger.transfer(transferArgs);
            Debug.print("Ledger call completed: " # debug_show(transferResult));
            
            switch (transferResult) {
                case (#Ok(blockIndex)) {
                    Debug.print("Transaction successful with block index: " # Nat64.toText(blockIndex));
                    // Clear cache after successful transfer
                    balanceCache.delete(fromWallet.principal);
                    balanceCache.delete(toWallet.principal);
                    
                    // We'll let the caller handle adding the transaction
                    return "Transaction successful! Block index: " # Nat64.toText(blockIndex);
                };
                case (#Err(transferError)) {
                    Debug.print("Transaction returned error: " # debug_show(transferError));
                    switch (transferError) {
                        case (#InsufficientFunds({ balance })) {
                            Debug.print("IMPORTANT - Account has " # Nat64.toText(balance.e8s) # 
                                      " e8s but trying to send " # Nat.toText(amount) # " e8s plus fee");
                        };
                        case _ {};
                    };
                    return "Transaction failed: " # debug_show(transferError);
                };
            }
        } catch (error) {
            Debug.print("CAUGHT ERROR during transfer: " # Error.message(error));
            return "Reject message: " # Error.message(error);
        }
    }
};

public func sendICPToAccountId(fromWallet: Wallet, toAccountId: Text, amount: Nat) : async Text {
    Debug.print("Sending to account ID: " # toAccountId);
    
    // Convert account ID from hex string to byte array
    switch (hexToBlob(toAccountId)) {
        case null {
            return "Error: Invalid account ID format";
        };
        case (?accountIdBlob) {
            let toAccountIdArray = Blob.toArray(accountIdBlob);
            
            // Basic validation - account IDs should be 32 bytes (4-byte CRC32 + 28-byte hash)
            if (toAccountIdArray.size() != 32) {
                return "Error: Invalid account ID length, expected 32 bytes but got " # 
                       Nat.toText(toAccountIdArray.size()) # " bytes";
            };
            
            Debug.print("Amount: " # debug_show(amount));
            Debug.print("From principal: " # Principal.toText(fromWallet.principal));
            
            // Check balance
            let actualBalance = await getBalance(fromWallet);
            Debug.print("Actual balance before transfer: " # Nat.toText(actualBalance) # " e8s");
            Debug.print("Required amount with fee: " # Nat.toText(amount + nat64ToNat(ICP_FEE)) # " e8s");
            
            // Verify sufficient funds
            if (actualBalance < amount + nat64ToNat(ICP_FEE)) {
                return "Error: Insufficient funds. You have " # Nat.toText(actualBalance) # 
                       " e8s but need " # Nat.toText(amount + nat64ToNat(ICP_FEE)) # " e8s (including fee).";
            };
            
            // Add explicit environment check for debugging
            let isLocal = isLocalEnvironment();
            Debug.print("Is local environment? " # debug_show(isLocal));
            
            if (isLocal) {
                Debug.print("Using local environment path");
                // We'll let the caller handle adding the transaction
                return "Dummy transaction: Sent " # Nat.toText(amount) # " e8s to account ID " # toAccountId;
            } else {
                Debug.print("Using production environment path");
                
                // Convert from_subaccount to [Nat8] array
                let fromSubaccountArray = Blob.toArray(fromWallet.subaccount);
                Debug.print("From subaccount: " # blobToHex(fromWallet.subaccount));
                
                // Prepare transfer arguments
                let transferArgs : TransferArgs = {
                    memo = Nat64.fromNat(1347768404);
                    amount = { e8s = natToNat64(amount) };
                    fee = { e8s = ICP_FEE };
                    from_subaccount = ?fromSubaccountArray;
                    to = toAccountIdArray;
                    created_at_time = null;
                };
                                        
                Debug.print("Transfer args prepared");
                
                try {
                    Debug.print("Making ledger.transfer call...");
                    let transferResult = await Ledger.transfer(transferArgs);
                    Debug.print("Ledger call completed: " # debug_show(transferResult));
                    
                    switch (transferResult) {
                        case (#Ok(blockIndex)) {
                            Debug.print("Transaction successful with block index: " # Nat64.toText(blockIndex));
                            // Clear cache after successful transfer
                            balanceCache.delete(fromWallet.principal);
                            
                            // We'll let the caller handle adding the transaction
                            return "Transaction successful! Block index: " # Nat64.toText(blockIndex);
                        };
                        case (#Err(transferError)) {
                            Debug.print("Transaction returned error: " # debug_show(transferError));
                            switch (transferError) {
                                case (#InsufficientFunds({ balance })) {
                                    Debug.print("IMPORTANT - Account has " # Nat64.toText(balance.e8s) # 
                                              " e8s but trying to send " # Nat.toText(amount) # " e8s plus fee");
                                };
                                case _ {};
                            };
                            return "Transaction failed: " # debug_show(transferError);
                        };
                    }
                } catch (error) {
                    Debug.print("CAUGHT ERROR during transfer: " # Error.message(error));
                    return "Reject message: " # Error.message(error);
                }
            }
        };
    }
};






// Add a function to add a transaction to the wallet
public func addTransaction(wallet: Wallet, transactionType: TransactionType, counterparty: Text, amount: Nat, isPositive: Bool, memo: ?Text) : Wallet {
    let newTransaction: Transaction = {
        transactionType = transactionType;
        counterparty = counterparty;
        amount = amount;
        timestamp = Time.now();
        isPositive = isPositive;
        memo = memo;
    };
    
    // Create a new transactions array with the new transaction added
    let updatedTransactions = Array.append<Transaction>(wallet.transactions, [newTransaction]);
    
    // Return updated wallet
    {
        principal = wallet.principal;
        subaccount = wallet.subaccount;
        balance = wallet.balance;
        transactions = updatedTransactions;
    }
};

// Get recent transactions (e.g., last 10)
public func getRecentTransactions(wallet: Wallet, limit: Nat) : [Transaction] {
    if (wallet.transactions.size() == 0) {
        return [];
    };
    
    // Sort transactions by timestamp (most recent first)
    let sortedTransactions = Array.sort<Transaction>(
        wallet.transactions,
        func(a: Transaction, b: Transaction) : {#less; #equal; #greater} {
            if (a.timestamp > b.timestamp) {
                #less  // This puts more recent timestamps first
            } else if (a.timestamp < b.timestamp) {
                #greater
            } else {
                #equal
            }
        }
    );
    
    // Return only the most recent 'limit' transactions
    if (wallet.transactions.size() <= limit) {
        return sortedTransactions;
    } else {
        return Array.subArray(sortedTransactions, 0, limit);
    }
};
    };
};