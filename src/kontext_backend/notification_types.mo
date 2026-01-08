// notification_types.mo
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";

module NotificationTypes {
    public type Timestamp = Nat64;

    // Notification severity levels
    public type NotificationSeverity = {
        #Critical;  // Security issues, payment failures
        #High;      // Important updates, deployment issues
        #Medium;    // Feature releases, subscription changes
        #Low;       // Tips, suggestions, newsletters
    };

    // Who should see this notification
    public type NotificationAudience = {
        #All;                                    // Everyone
        #SpecificUsers : [Principal];            // Specific users by principal
        #SubscriptionTier : Text;                // Users with specific subscription
        #NewUsers : Nat64;                       // Users registered after timestamp
        #ActiveUsers : Nat64;                    // Users active since timestamp
    };

    // Notification categories
    public type NotificationCategory = {
        #System;        // Platform updates, maintenance
        #Account;       // Account-related notifications
        #Credits;       // Credit balance, purchases
        #Subscription;  // Subscription changes
        #Deployment;    // Deployment status
        #Security;      // Security alerts
        #Feature;       // New features, tips
        #Announcement;  // General announcements
    };

    // Action that user can take from notification
    public type NotificationAction = {
        actionLabel: Text;
        actionType: {
            #NavigateTo : Text;      // Navigate to URL/route
            #OpenDialog : Text;       // Open specific dialog
            #ExternalLink : Text;     // Open external link
            #Dismiss;                 // Just dismiss
        };
    };

    // Core notification structure
    public type NotificationEvent = {
        id: Nat;
        timestamp: Timestamp;
        severity: NotificationSeverity;
        category: NotificationCategory;
        targetAudience: NotificationAudience;
        
        // Content
        title: Text;
        message: Text;
        icon: ?Text;                 // Emoji or icon name
        
        // Metadata
        metadata: ?[(Text, Text)];   // Additional key-value data
        actions: ?[NotificationAction];
        
        // Expiry
        expiresAt: ?Timestamp;       // Auto-hide after this time
        
        // Tracking
        createdBy: Principal;        // Who created this notification
        isPinned: Bool;              // Pin to top of list
    };

    // User's notification preferences
    public type NotificationPreferences = {
        enabledCategories: [NotificationCategory];
        minimumSeverity: NotificationSeverity;
        maxNotificationsPerDay: ?Nat;
        quietHours: ?{
            startHour: Nat;  // 0-23
            endHour: Nat;    // 0-23
        };
    };

    // User's notification read status
    public type UserNotificationStatus = {
        userId: Principal;
        lastReadTimestamp: Timestamp;
        readNotificationIds: [Nat];
        dismissedNotificationIds: [Nat];
    };

    // Notification statistics
    public type NotificationStats = {
        totalNotifications: Nat;
        notificationsByCategory: [(NotificationCategory, Nat)];
        notificationsBySeverity: [(NotificationSeverity, Nat)];
        oldestNotification: ?Timestamp;
        newestNotification: ?Timestamp;
    };

    // Helper to check if user should see notification
    public func isNotificationRelevantToUser(
        notification: NotificationEvent,
        userId: Principal,
        userSubscriptionTier: ?Text,
        userCreatedAt: Timestamp,
        userLastActiveAt: Timestamp
    ) : Bool {
        switch (notification.targetAudience) {
            case (#All) { true };
            case (#SpecificUsers(users)) {
                var found = false;
                for (user in users.vals()) {
                    if (Principal.equal(user, userId)) {
                        found := true;
                    };
                };
                found
            };
            case (#SubscriptionTier(tier)) {
                switch (userSubscriptionTier) {
                    case (?userTier) { Text.equal(userTier, tier) };
                    case (null) { false };
                };
            };
            case (#NewUsers(timestamp)) {
                userCreatedAt >= timestamp
            };
            case (#ActiveUsers(timestamp)) {
                userLastActiveAt >= timestamp
            };
        }
    };

    // Helper to check if notification is expired
    public func isNotificationExpired(notification: NotificationEvent, now: Timestamp) : Bool {
        switch (notification.expiresAt) {
            case (?expiry) { now > expiry };
            case (null) { false };
        };
    };

    // Helper to get severity level as number (for comparison)
    public func severityToLevel(severity: NotificationSeverity) : Nat {
        switch (severity) {
            case (#Critical) { 4 };
            case (#High) { 3 };
            case (#Medium) { 2 };
            case (#Low) { 1 };
        };
    };
}

