import Text "mo:base/Text";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import StandardDebug "mo:base/Debug";



module Debug {

  // Define the structure of a log entry
  public type LogEntry = {
      timestamp: Text;  // Change timestamp to Text for consistency with frontend expectations
      level: Text;
      message: Text;
      details: ?Text;
  };

  // Wrapper function for Debug.print
  public func print(message: Text) : LogEntry {
      StandardDebug.print(message);
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

      // Return the created LogEntry (don't store it in Debug)
      return logEntry;
  };
}
