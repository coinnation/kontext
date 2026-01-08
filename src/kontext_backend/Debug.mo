import Text "mo:base/Text";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import StandardDebug "mo:base/Debug";

module Debug {

  // Define the structure of a log entry
  public type LogEntry = {
      timestamp: Text;  // Use Text for consistency with frontend expectations
      level: Text;
      message: Text;
      details: ?Text;
  };

  // Wrapper function for Debug.print - only outputs in development
  public func print(message: Text) : LogEntry {
      // Only print to debug console in development/local environments
      // In mainnet production, this will be a no-op for performance
      StandardDebug.print("[KONTEXT DEBUG] " # message);
      return addLog("INFO", message, null);
  };

  // Function to add a log entry and return it
  public func addLog(level: Text, message: Text, details: ?Text) : LogEntry {
      let currentTime = Time.now();
      let logEntry : LogEntry = {
          timestamp = Nat.toText(Int.abs(currentTime));
          level = level;
          message = message;
          details = details;
      };

      // Return the created LogEntry (don't store it in Debug module for mainnet efficiency)
      return logEntry;
  };

  // Helper function to format log entries for display
  public func formatLogEntry(entry: LogEntry) : Text {
      let detailsText = switch (entry.details) {
          case (?details) " | " # details;
          case null "";
      };
      "[" # entry.timestamp # "] " # entry.level # ": " # entry.message # detailsText;
  };

  // Safe logging function that won't impact mainnet performance
  public func logInfo(message: Text) : LogEntry {
      addLog("INFO", message, null);
  };

  public func logWarning(message: Text, details: ?Text) : LogEntry {
      addLog("WARNING", message, details);
  };

  public func logError(message: Text, details: ?Text) : LogEntry {
      addLog("ERROR", message, details);
  };
}