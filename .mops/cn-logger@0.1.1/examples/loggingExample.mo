import Debug "mo:base/Debug";
import Time "mo:base/Time";
import Array "mo:base/Array";
import L "logger";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Error "mo:base/Error";
import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";

actor LoggingExample {
    // Initialize logger
    private stable var stableLogger : ?L.StableLoggerData = null;

    private let logger = L.Logger(
        stableLogger,
        ?{
            maxSize = 20000;
            retentionDays = 7;
        }
    );


    // Counter to track operations
    private stable var operationCounter : Nat = 0;

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

    // Test log sequence
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
    // Advanced Logging Methods
    // ===============================

    public func logWithValue(level: Text, message: Text, valueText: Text) : async () {
        let logLevel = switch (level) {
            case ("INFO") { L.INFO };
            case ("WARN") { L.WARN };
            case ("ERROR") { L.ERROR };
            case ("DEBUG") { L.DEBUG };
            case (_) { L.INFO }; // Default to INFO
        };

        logger.logText(logLevel, message, valueText);
    };

    public func logWithNat(level: Text, message: Text, value: Nat) : async () {
        let logLevel = switch (level) {
            case ("INFO") { L.INFO };
            case ("WARN") { L.WARN };
            case ("ERROR") { L.ERROR };
            case ("DEBUG") { L.DEBUG };
            case (_) { L.INFO }; // Default to INFO
        };

        logger.logNat(logLevel, message, value);
    };

    public func logWithBool(level: Text, message: Text, value: Bool) : async () {
        let logLevel = switch (level) {
            case ("INFO") { L.INFO };
            case ("WARN") { L.WARN };
            case ("ERROR") { L.ERROR };
            case ("DEBUG") { L.DEBUG };
            case (_) { L.INFO }; // Default to INFO
        };

        logger.logBool(logLevel, message, value);
    };

    public func logWithError(level: Text, message: Text, errorMessage: Text) : async () {
        let logLevel = switch (level) {
            case ("INFO") { L.INFO };
            case ("WARN") { L.WARN };
            case ("ERROR") { L.ERROR };
            case ("DEBUG") { L.DEBUG };
            case (_) { L.INFO }; // Default to INFO
        };

        logger.logError(logLevel, message, Error.reject(errorMessage));
    };

    public func logWithPrincipal(level: Text, message: Text, principalText: Text) : async () {
        let logLevel = switch (level) {
            case ("INFO") { L.INFO };
            case ("WARN") { L.WARN };
            case ("ERROR") { L.ERROR };
            case ("DEBUG") { L.DEBUG };
            case (_) { L.INFO }; // Default to INFO
        };

        // Safely handle principal parsing
        try {
            let principal = Principal.fromText(principalText);
            logger.logPrincipal(logLevel, message, principal);
        } catch (e) {
            logger.logText(logLevel, message # " (invalid principal)", principalText);
        };
    };

    // ===============================
    // Metadata Logging
    // ===============================

    public func logWithMetadata(
        level: Text,
        message: Text,
        canisterId: ?Text,
        tags: [Text]
    ) : async () {
        let logLevel = switch (level) {
            case ("INFO") { L.INFO };
            case ("WARN") { L.WARN };
            case ("ERROR") { L.ERROR };
            case ("DEBUG") { L.DEBUG };
            case (_) { L.INFO }; // Default to INFO
        };

        // Create the metadata
        let metadata : ?L.Metadata = ?{
            canisterId = switch (canisterId) {
                case (null) { null };
                case (?id) {
                    try {
                        let principal = Principal.fromText(id);
                        ?principal;
                    } catch (e) {
                        null;
                    };
                };
            };
            tags = tags;
        };

        // We can't directly log with metadata using the base logger.log method
        // So we'll just log the message and tags separately
        logger.log(logLevel, message);
        if (tags.size() > 0) {
            logger.logText(logLevel, "Tags for previous message", Text.join(", ", tags.vals()));
        };
    };

    // ===============================
    // Test Operations
    // ===============================

    // Simple operation that logs at different levels
    public func performOperation(name: Text) : async Text {
        operationCounter += 1;

        // Log at different levels
        logger.info("Starting operation: " # name);
        logger.info("Operation ID: " # Nat.toText(operationCounter));

        // Simulate work
        logger.dbg("Preparing to process operation data");

        // Simulate a conditional warning
        if (operationCounter % 3 == 0) {
            logger.warn("Operation count is divisible by 3: " # Nat.toText(operationCounter));
        };

        // Simulate an occasional error
        if (operationCounter % 5 == 0) {
            logger.error("Simulated error in operation: " # name);
        };

        // Log with a value
        logger.logNat(L.INFO, "Operation completed with value", operationCounter);

        // Return a confirmation
        return "Operation " # name # " completed (ID: " # Nat.toText(operationCounter) # ")";
    };

    // Generate a sequence of logs rapidly
    public func generateLogBurst(count: Nat) : async Text {
        logger.info("Starting log burst with " # Nat.toText(count) # " entries");

        var i = 0;
        while (i < count) {
            let level = i % 4;
            let message = "Burst log #" # Nat.toText(i+1) # " of " # Nat.toText(count);

            switch (level) {
                case 0 { logger.info(message); };
                case 1 { logger.warn(message); };
                case 2 { logger.error(message); };
                case 3 { logger.dbg(message); };
            };

            i += 1;
        };

        logger.info("Log burst completed");
        return "Generated " # Nat.toText(count) # " log entries";
    };

    // Test different value types in logs
    public func logDifferentTypes() : async Text {
        logger.info("Testing different value types in logs");

        logger.logNat(L.INFO, "Testing Nat value", 12345);
        logger.logText(L.INFO, "Testing Text value", "Hello, logging world!");
        logger.logBool(L.INFO, "Testing Bool value", true);

        // Create a small array to log
        logger.logArray<Nat>(
            L.INFO,
            "Testing array logging",
            [1, 2, 3, 4, 5],
            L.NatValue
        );

        logger.info("Different types test completed");
        return "Logged different value types";
    };

    // ===============================
    // Log Export Functionality
    // ===============================

    // Export logs in different formats
    public func exportLogs(format: Text, compressed: Bool) : async Text {
        let exportFormat = switch (format) {
            case ("JSON") { #JSON };
            case ("CSV") { #CSV };
            case ("COMPRESSED") { #COMPRESSED };
            case (_) { #JSON }; // Default to JSON
        };

        let options: L.ExportOptions = {
            format = exportFormat;
            compressed = compressed;
            filter = null; // No filtering in this example
        };

        let result = logger.exportLogs(options);

        switch (result) {
            case (#ok(blob)) {
                // Convert blob to text for simplicity in this example
                switch (Text.decodeUtf8(blob)) {
                    case (?text) {
                        logger.info("Exported logs in " # format # " format");
                        return "Export successful";
                    };
                    case (null) {
                        logger.error("Failed to decode exported logs");
                        return "Export failed: could not decode result";
                    };
                };
            };
            case (#err(error)) {
                logger.error("Failed to export logs: " # error);
                return "Export failed: " # error;
            };
        };
    };

    // Filter logs by custom criteria
    public func getFilteredLogs(
        startTime: ?Int,
        endTime: ?Int,
        level: ?Text,
        tags: ?[Text]
    ) : async [L.LogEntry] {

        let levels = switch (level) {
            case (null) { null };
            case (?l) {
                let logLevel = switch (l) {
                    case ("INFO") { L.INFO };
                    case ("WARN") { L.WARN };
                    case ("ERROR") { L.ERROR };
                    case ("DEBUG") { L.DEBUG };
                    case (_) { L.INFO };
                };
                ?[logLevel];
            };
        };

        let filter: L.LogFilter = {
            startTime = startTime;
            endTime = endTime;
            levels = levels;
            tags = tags;
            canisterId = null; // Not filtering by canister in this example
        };

        return logger.getFilteredLogs(filter);
    };

    // ===============================
    // Integration Examples
    // ===============================

    // For integration with your existing app
    public func generateLogs() : async () {
        for (i in Iter.range(0, 5)) {
            logger.info("Generated log #" # Nat.toText(i));
        };
    };

    public func runLoggingExamples() : async () {
        logger.info("Running logging examples");
        let _ = await performOperation("example1");
        let _ = await generateLogBurst(3);
        let _ = await logDifferentTypes();
        logger.info("Completed logging examples");
    };

    public func startAutoLogging() : async () {
        // This would typically start a timer, but actors don't support this
        // Instead, we'll just generate some logs immediately
        logger.info("Auto-logging requested (generating sample logs)");
        let _ = await generateLogBurst(5);
    };

    // ===============================
    // System Methods
    // ===============================

    // For stable storage
    system func postupgrade() {
        stableLogger := ?logger.toStable();
    };
};