// logger.mo
import Time "mo:base/Time";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Text "mo:base/Text";
import Array "mo:base/Array";
import Blob "mo:base/Blob";
import List "mo:base/List";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import TrieMap "mo:base/TrieMap";
import Stack "mo:base/Stack";
import Deque "mo:base/Deque";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Nat8 "mo:base/Nat8";
import Result "mo:base/Result";
import Int "mo:base/Int";
import Error "mo:base/Error";

module {
    // Log levels
    public type LogLevel = {
        #INFO;
        #WARN;
        #ERROR;
        #DEBUG;
    };

    // Log level constants
    public let INFO : LogLevel = #INFO;
    public let WARN : LogLevel = #WARN;
    public let ERROR : LogLevel = #ERROR;
    public let DEBUG : LogLevel = #DEBUG;

    // Value converters for common types
    public let TextValue : Text -> Text = func(t: Text) : Text = t;
    public let NatValue : Nat -> Text = Nat.toText;
    public let IntValue : Int -> Text = Int.toText;
    public let BoolValue : Bool -> Text = func(b: Bool) : Text =
        if b { "true" } else { "false" };
    public let PrincipalValue : Principal -> Text = Principal.toText;
    public let ErrorValue : Error -> Text = Error.message;
    public let Nat8Value : Nat8 -> Text = Nat8.toText;

    // Basic metadata type
    public type Metadata = {
        canisterId: ?Principal;
        tags: [Text];
    };

    // Export types
    public type ExportFormat = {
        #JSON;
        #CSV;
        #COMPRESSED;
    };

    public type LogFilter = {
        startTime: ?Int;
        endTime: ?Int;
        levels: ?[LogLevel];
        tags: ?[Text];
        canisterId: ?Principal;
    };

    public type ExportOptions = {
        format: ExportFormat;
        compressed: Bool;
        filter: ?LogFilter;
    };

    public type CompressedLogEntry = {
        data: Blob;
        compressionType: Text;
    };

    // Updated StableLoggerData to include sequence counter
    public type StableLoggerData = {
        logs: [CompressedLogEntry];
        maxSize: Nat;
        retentionDays: Nat;
        sequenceCounter: Nat; // New field to track log sequence
    };

    // Core log entry type
    public type LogEntry = {
        timestamp: Int;
        level: LogLevel;
        message: Text;
        value: Text;
        metadata: ?Metadata;
    };

    public type LoggerConfig = {
      maxSize: Nat;
      retentionDays: Nat;
    };

    public class Logger(initData: ?StableLoggerData, config: ?LoggerConfig) {
        // Add sequence counter with proper initialization
        private var sequenceCounter: Nat = switch (initData) {
            case (?data) { data.sequenceCounter };
            case (null) { 0 };
        };

        // Add method to get current sequence
        public func getCurrentSequence() : Nat {
            sequenceCounter
        };

        private func formatLogEntry(entry: LogEntry) : Text {
            // Convert nanoseconds to date components
            let totalSeconds = entry.timestamp / 1_000_000_000;
            let ms = Int.abs(entry.timestamp % 1_000_000_000) / 1_000_000;

            // Time components
            let secs = totalSeconds % 60;
            let mins = (totalSeconds / 60) % 60;
            let hours = (totalSeconds / 3600) % 24;

            // Date components (simplified)
            let days = (totalSeconds / 86400) % 31 + 1;
            let months = (totalSeconds / 2592000) % 12 + 1;
            let years = 1970 + (totalSeconds / 31536000);

            // Format components with padding
            func pad(n: Int) : Text {
                let str = Int.toText(n);
                if (str.size() < 2) { "0" # str } else { str }
            };

            // Construct datetime string
            let datetime = Int.toText(years) # "-" #
                        pad(months) # "-" #
                        pad(days) # " " #
                        pad(hours) # ":" #
                        pad(mins) # ":" #
                        pad(secs) # "." #
                        pad(ms);

            // Level with icons only
            let levelStr = switch(entry.level) {
                case (#INFO)  "ℹ️  INFO";
                case (#WARN)  "⚠️  WARN";
                case (#ERROR) "❌ ERROR";
                case (#DEBUG) "🔍 DEBUG";
            };

            // Format value if present
            let valueStr = if (entry.value == "") {
                ""
            } else {
                "│ " # entry.value
            };

            // Format metadata tags if present
            let tags = switch(entry.metadata) {
                case (?md) {
                    if (md.tags.size() > 0) {
                        "│ [" # Text.join(", ", md.tags.vals()) # "]"
                    } else { "" };
                };
                case null { "" };
            };

            // Optional canister ID from metadata
            let canisterId = switch(entry.metadata) {
                case (?md) {
                    switch(md.canisterId) {
                        case (?id) { "│ " # Principal.toText(id); };
                        case null { "" };
                    };
                };
                case null { "" };
            };

            // Format: [datetime] [level] [canister_id] [tags] [message] [value]
            "[ " # datetime # " ]" # " │ " #  // Datetime with separator
            levelStr # " │" #                 // Log level with icon
            canisterId #                      // Canister ID (if present)
            tags #                            // Tags (if present)
            " │ " # entry.message #           // Main message
            (if (valueStr != "") { " " # valueStr } else { "" })  // Value (if present)
        };


        private var logBuffer = Buffer.Buffer<LogEntry>(0);

        private var maxSize = switch (config) {
            case (?cfg) { cfg.maxSize };
            case null {
                switch (initData) {
                    case (?data) { data.maxSize };
                    case null { 10000 };
                };
            };
        };
        private var retentionDays = switch (config) {
            case (?cfg) { cfg.retentionDays };
            case null {
                switch (initData) {
                    case (?data) { data.retentionDays };
                    case null { 30 };
                };
            };
        };


        // Add configuration methods
        public func setRetentionDays(days: Nat) {
            retentionDays := days;
        };

        public func setMaxSize(size: Nat) {
            maxSize := size;
        };

        public func getConfig() : LoggerConfig {
            {
                maxSize = maxSize;
                retentionDays = retentionDays;
            }
        };

        // Method to clean old logs
        public func cleanOldLogs() {
            let currentTime = Time.now();
            let retentionNanos = Int.abs(retentionDays * 24 * 60 * 60 * 1000000000);
            let cutoffTime = currentTime - retentionNanos;

            logBuffer := Buffer.mapFilter<LogEntry, LogEntry>(
                logBuffer,
                func (entry: LogEntry) : ?LogEntry {
                    if (entry.timestamp >= cutoffTime) {
                        ?entry
                    } else {
                        null
                    }
                }
            );
        };

        // Modify rotateLogsIfNeeded to also clean old logs
        private func rotateLogsIfNeeded() {
            if (logBuffer.size() > maxSize) {
                logBuffer.clear();
            };
            cleanOldLogs();
        };

        // LAYER 1: Simple logging
        public func log(level: LogLevel, message: Text) {
            logWith(level, message, "", TextValue);
        };

        public func info(message: Text) {
            log(INFO, message);
        };

        public func warn(message: Text) {
            log(WARN, message);
        };

        public func error(message: Text) {
            log(ERROR, message);
        };

        public func dbg(message: Text) {
            log(DEBUG, message);
        };

        // LAYER 2: Logging with values - now increments sequence counter
        public func logWith<T>(
            level: LogLevel,
            message: Text,
            value: T,
            showValue: T -> Text
        ) {
            let entry = {
                timestamp = Time.now();
                level = level;
                message = message;
                value = showValue(value);
                metadata = null;
            };
            logBuffer.add(entry);
            rotateLogsIfNeeded();
            Debug.print(formatLogEntry(entry));

            // Increment sequence counter after adding log
            sequenceCounter += 1;
        };

        // Primitive type logging helpers
        public func logText(level: LogLevel, message: Text, value: Text) {
            logWith(level, message, value, TextValue);
        };

        public func logNat(level: LogLevel, message: Text, value: Nat) {
            logWith(level, message, value, NatValue);
        };

        public func logInt(level: LogLevel, message: Text, value: Int) {
            logWith(level, message, value, IntValue);
        };

        public func logBool(level: LogLevel, message: Text, value: Bool) {
            logWith(level, message, value, BoolValue);
        };

        public func logPrincipal(level: LogLevel, message: Text, value: Principal) {
            logWith(level, message, value, PrincipalValue);
        };

        public func logError(level: LogLevel, message: Text, value: Error) {
            logWith(level, message, value, ErrorValue);
        };

        // Collection logging helpers
        public func logHashMap<K, V>(
            level: LogLevel,
            message: Text,
            map: HashMap.HashMap<K, V>,
            keyShow: K -> Text,
            valueShow: V -> Text
        ) {
            let show = func(map: HashMap.HashMap<K, V>) : Text {
                var output = "{";
                let entries = map.entries();
                var first = true;
                for ((k, v) in entries) {
                    if (not first) { output #= ", " };
                    output #= keyShow(k) # " => " # valueShow(v);
                    first := false;
                };
                output # "}"
            };
            logWith(level, message, map, show);
        };

        public func logArray<T>(
            level: LogLevel,
            message: Text,
            array: [T],
            showValue: T -> Text
        ) {
            let show = func(arr: [T]) : Text {
                var output = "[";
                for (i in arr.keys()) {
                    if (i > 0) { output #= ", " };
                    output #= showValue(arr[i]);
                };
                output # "]"
            };
            logWith(level, message, array, show);
        };

        public func logList<T>(
            level: LogLevel,
            message: Text,
            list: List.List<T>,
            showValue: T -> Text
        ) {
            let show = func(lst: List.List<T>) : Text {
                var output = "[";
                var current = lst;
                var first = true;
                loop {
                    switch (List.pop(current)) {
                        case (null, _) {
                            return output # "]";
                        };
                        case (?item, rest) {
                            if (not first) { output #= ", " };
                            output #= showValue(item);
                            current := rest;
                            first := false;
                        };
                    };

                };
            };
            logWith(level, message, list, show);
        };

        // Export functionality
        public func exportLogs(options: ExportOptions) : Result.Result<Blob, Text> {
            var logs = switch (options.filter) {
                case (null) { Buffer.toArray(logBuffer) };
                case (?filter) { getFilteredLogs(filter) };
            };

            let exportData = switch (options.format) {
                case (#JSON) {
                    let jsonString = "{\"logs\":" # debug_show(logs) # "}";
                    Text.encodeUtf8(jsonString)
                };
                case (#CSV) {
                    var csv = "timestamp,level,message,value,tags\n";
                    for (log in logs.vals()) {
                        csv #= Int.toText(log.timestamp) # "," #
                              debug_show(log.level) # "," #
                              log.message # "," #
                              log.value # "," #
                              (switch(log.metadata) {
                                  case (?md) { debug_show(md.tags) };
                                  case null { "[]" };
                              }) # "\n";
                    };
                    Text.encodeUtf8(csv)
                };
                case (#COMPRESSED) {
                    let compressed = Array.map<LogEntry, CompressedLogEntry>(
                        logs,
                        compressLogEntry
                    );
                    Text.encodeUtf8(debug_show(compressed))
                };
            };

            if (options.compressed) {
                #ok(compressLogEntry({
                    timestamp = Time.now();
                    level = INFO;
                    message = switch (Text.decodeUtf8(exportData)) {
                        case (null) { "" };
                        case (?text) { text };
                    };
                    value = "";
                    metadata = null;
                }).data)
            } else {
                #ok(exportData)
            }
        };

        // Compression utilities
        private func compressLogEntry(entry: LogEntry) : CompressedLogEntry {
            let serialized = debug_show(entry);
            var compressed = "";
            var count = 1;
            var current = serialized.chars().next();

            for (char in serialized.chars()) {
                switch (current) {
                    case (?currentChar) {
                        if (char == currentChar) {
                            count += 1;
                        } else {
                            compressed #= Nat.toText(count) # Text.fromChar(currentChar);
                            count := 1;
                            current := ?char;
                        };
                    };
                    case null { current := ?char; };
                };
            };

            switch (current) {
                case (?currentChar) {
                    compressed #= Nat.toText(count) # Text.fromChar(currentChar);
                };
                case null { };
            };

            {
                data = Text.encodeUtf8(compressed);
                compressionType = "RLE";
            }
        };

        private func _decompressLogEntry(compressed: CompressedLogEntry) : ?LogEntry {
            if (compressed.compressionType != "RLE") {
                return null;
            };

            switch (Text.decodeUtf8(compressed.data)) {
                case (?text) {
                    ?{
                        timestamp = Time.now();
                        level = INFO;
                        message = text;
                        value = "";
                        metadata = null;
                    }
                };
                case null { null };
            }
        };

        // Query functions
        public func getLogs() : [Text] {
            Buffer.toArray(
                Buffer.map<LogEntry, Text>(
                    logBuffer,
                    func(entry) { formatLogEntry(entry) }
                )
            )
        };

        public func getFilteredLogs(filter: LogFilter) : [LogEntry] {
            Buffer.toArray(
                Buffer.mapFilter<LogEntry, LogEntry>(
                    logBuffer,
                    func(entry) {
                        if (matchesFilter(entry, filter)) { ?entry }
                        else { null }
                    }
                )
            )
        };

        private func matchesFilter(entry: LogEntry, filter: LogFilter) : Bool {
            // Check time range
            switch(filter.startTime) {
                case (?start) if (entry.timestamp < start) return false;
                case null {};
            };

            switch(filter.endTime) {
                case (?end) if (entry.timestamp > end) return false;
                case null {};
            };

            // Check log level
            switch(filter.levels) {
                case (?levels) {
                    var levelFound = false;
                    for (level in levels.vals()) {
                        if (level == entry.level) levelFound := true;
                    };
                    if (not levelFound) return false;
                };
                case null {};
            };

            // Check tags
            switch(filter.tags) {
                case (?filterTags) {
                    switch(entry.metadata) {
                        case (?md) {
                            label filtering for (tag in filterTags.vals()) {
                                var found = false;
                                for (entryTag in md.tags.vals()) {
                                    if (Text.equal(tag, entryTag)) {
                                        found := true;
                                        break filtering;
                                    };
                                };
                                if (not found) return false;
                            };
                        };
                        case null return false;
                    };
                };
                case null {};
            };

            true
        };

        // Maintenance functions
        public func clearLogs() {
            logBuffer.clear();
        };

        // Add a method to force advance the sequence counter
        public func forceAdvanceSequence(amount: Nat) : Nat {
            sequenceCounter += amount;
            sequenceCounter
        };

        // Get logs by level
        public func getLogsByLevel(level: Text) : [Text] {
            let allLogs = getLogs();

            // Filter logs based on the level string they contain
            return Array.filter<Text>(
                allLogs,
                func(log: Text) : Bool {
                    switch(level) {
                        case ("INFO") { return Text.contains(log, #text "ℹ️  INFO") or Text.contains(log, #text "ℹ️ INFO"); };
                        case ("WARN") { return Text.contains(log, #text "⚠️  WARN") or Text.contains(log, #text "⚠️ WARN"); };
                        case ("ERROR") { return Text.contains(log, #text "❌ ERROR") or Text.contains(log, #text "❌  ERROR"); };
                        case ("DEBUG") { return Text.contains(log, #text "🔍 DEBUG") or Text.contains(log, #text "🔍  DEBUG"); };
                        case (_) { return true; };
                    };
                }
            );
        };

        // Get logs since a marker
        public func getNewLogsSince(marker: Nat, maxLogsOpt: ?Nat) : {
            logs: [Text];
            nextMarker: Nat;
        } {
            let currentSequence = getCurrentSequence();

            // If marker is current or higher, no new logs
            if (marker >= currentSequence) {
                return {
                    logs = [];
                    nextMarker = currentSequence; // Return current sequence, not marker
                };
            };

            // Get all logs
            let allLogs = getLogs();

            // If we have no logs but sequence counter is higher,
            // this means logs were cleared but sequence continued
            if (allLogs.size() == 0) {
                return {
                    logs = [];
                    nextMarker = currentSequence; // Skip to current sequence
                };
            };

            // Calculate how many logs to return
            let maxLogs = switch (maxLogsOpt) {
                case (null) { 100 };
                case (?val) { val };
            };

            // Calculate how many new logs we should ideally return
            let newLogsCount = currentSequence - marker;

            // But we can't return more logs than we actually have
            let availableLogs = Nat.min(newLogsCount, allLogs.size());

            // And we can't return more than maxLogs
            let logsToReturn = Nat.min(maxLogs, availableLogs);

            // Calculate the starting index to return the newest logs
            let startIndex = allLogs.size() - logsToReturn;

            return {
                logs = Array.subArray(allLogs, startIndex, logsToReturn);
                nextMarker = currentSequence; // Always advance marker to current
            };
        };

        // Updated toStable to include sequence counter
        public func toStable() : StableLoggerData {
            {
                logs = Array.map<LogEntry, CompressedLogEntry>(
                    Buffer.toArray(logBuffer),
                    compressLogEntry
                );
                maxSize = maxSize;
                retentionDays = retentionDays;
                sequenceCounter = sequenceCounter; // Include counter in stable data
            }
        };
    };
};