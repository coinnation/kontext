// notification_manager.mo
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Int "mo:base/Int";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Order "mo:base/Order";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Time "mo:base/Time";
import NotificationTypes "./notification_types";

module NotificationManager {
    type NotificationEvent = NotificationTypes.NotificationEvent;
    type NotificationSeverity = NotificationTypes.NotificationSeverity;
    type NotificationCategory = NotificationTypes.NotificationCategory;
    type NotificationAudience = NotificationTypes.NotificationAudience;
    type UserNotificationStatus = NotificationTypes.UserNotificationStatus;
    type Timestamp = NotificationTypes.Timestamp;

    // Stable storage type
    public type StableData = {
        notifications: [NotificationEvent];
        nextId: Nat;
        userStatuses: [UserNotificationStatus];
    };

    public class NotificationManager() {
        // Storage
        private var notifications = Buffer.Buffer<NotificationEvent>(100);
        private var nextNotificationId : Nat = 1;
        private var userStatuses = Buffer.Buffer<UserNotificationStatus>(100);
        
        // Constants
        private let MAX_NOTIFICATIONS : Nat = 1000;
        private let RETENTION_DAYS : Nat64 = 30;
        private let NANOSECONDS_PER_DAY : Nat64 = 86_400_000_000_000;

        // Create a new notification
        public func createNotification(
            severity: NotificationSeverity,
            category: NotificationCategory,
            audience: NotificationAudience,
            title: Text,
            message: Text,
            icon: ?Text,
            metadata: ?[(Text, Text)],
            actions: ?[NotificationTypes.NotificationAction],
            expiresAt: ?Timestamp,
            createdBy: Principal,
            isPinned: Bool
        ) : Nat {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let notificationId = nextNotificationId;
            nextNotificationId += 1;

            let notification : NotificationEvent = {
                id = notificationId;
                timestamp = now;
                severity = severity;
                category = category;
                targetAudience = audience;
                title = title;
                message = message;
                icon = icon;
                metadata = metadata;
                actions = actions;
                expiresAt = expiresAt;
                createdBy = createdBy;
                isPinned = isPinned;
            };

            notifications.add(notification);

            // Prune if we exceed max
            if (notifications.size() > MAX_NOTIFICATIONS) {
                let _ = pruneOldNotifications();
            };

            notificationId
        };

        // Get notifications for a specific user
        public func getNotificationsForUser(
            userId: Principal,
            since: Timestamp,
            userSubscriptionTier: ?Text,
            userCreatedAt: Timestamp,
            userLastActiveAt: Timestamp,
            limit: ?Nat
        ) : [NotificationEvent] {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let buffer = Buffer.Buffer<NotificationEvent>(50);
            let maxResults = switch (limit) {
                case (?l) { l };
                case (null) { 50 };
            };

            // Get user status for read tracking
            let userStatus = getUserStatus(userId);

            for (notification in notifications.vals()) {
                // Check if already at limit
                if (buffer.size() < maxResults) {
                    // Skip if notification is older than requested
                    if (notification.timestamp >= since) {
                        // Skip if expired
                        if (not NotificationTypes.isNotificationExpired(notification, now)) {
                            // Skip if dismissed by user
                            if (not isNotificationDismissed(userStatus, notification.id)) {
                                // Check if relevant to user
                                if (NotificationTypes.isNotificationRelevantToUser(
                                    notification,
                                    userId,
                                    userSubscriptionTier,
                                    userCreatedAt,
                                    userLastActiveAt
                                )) {
                                    buffer.add(notification);
                                };
                            };
                        };
                    };
                };
            };

            // Sort by pinned first, then by timestamp (newest first)
            let sorted = Buffer.toArray(buffer);
            Array.sort<NotificationEvent>(sorted, func(a, b) {
                if (a.isPinned and not b.isPinned) {
                    return #less;
                };
                if (not a.isPinned and b.isPinned) {
                    return #greater;
                };
                if (a.timestamp > b.timestamp) {
                    #less
                } else if (a.timestamp < b.timestamp) {
                    #greater
                } else {
                    #equal
                }
            })
        };

        // Get unread notification count for user
        public func getUnreadCount(
            userId: Principal,
            userSubscriptionTier: ?Text,
            userCreatedAt: Timestamp,
            userLastActiveAt: Timestamp
        ) : Nat {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let userStatus = getUserStatus(userId);
            var count : Nat = 0;

            for (notification in notifications.vals()) {
                // Skip if expired
                if (not NotificationTypes.isNotificationExpired(notification, now)) {
                    // Skip if already read
                    if (notification.timestamp > userStatus.lastReadTimestamp) {
                        // Skip if dismissed
                        if (not isNotificationDismissed(userStatus, notification.id)) {
                            // Check if relevant to user
                            if (NotificationTypes.isNotificationRelevantToUser(
                                notification,
                                userId,
                                userSubscriptionTier,
                                userCreatedAt,
                                userLastActiveAt
                            )) {
                                count += 1;
                            };
                        };
                    };
                };
            };

            count
        };

        // Mark notifications as read for user
        public func markAsRead(userId: Principal, timestamp: Timestamp) : () {
            let userStatus = getUserStatus(userId);
            
            // Update or create status
            var found = false;
            let buffer = Buffer.Buffer<UserNotificationStatus>(userStatuses.size());
            
            for (status in userStatuses.vals()) {
                if (Principal.equal(status.userId, userId)) {
                    buffer.add({
                        userId = status.userId;
                        lastReadTimestamp = timestamp;
                        readNotificationIds = status.readNotificationIds;
                        dismissedNotificationIds = status.dismissedNotificationIds;
                    });
                    found := true;
                } else {
                    buffer.add(status);
                };
            };

            if (not found) {
                buffer.add({
                    userId = userId;
                    lastReadTimestamp = timestamp;
                    readNotificationIds = [];
                    dismissedNotificationIds = [];
                });
            };

            userStatuses := buffer;
        };

        // Dismiss a specific notification for user
        public func dismissNotification(userId: Principal, notificationId: Nat) : () {
            let buffer = Buffer.Buffer<UserNotificationStatus>(userStatuses.size());
            var found = false;

            for (status in userStatuses.vals()) {
                if (Principal.equal(status.userId, userId)) {
                    let dismissedIds = Buffer.fromArray<Nat>(status.dismissedNotificationIds);
                    dismissedIds.add(notificationId);
                    
                    buffer.add({
                        userId = status.userId;
                        lastReadTimestamp = status.lastReadTimestamp;
                        readNotificationIds = status.readNotificationIds;
                        dismissedNotificationIds = Buffer.toArray(dismissedIds);
                    });
                    found := true;
                } else {
                    buffer.add(status);
                };
            };

            if (not found) {
                buffer.add({
                    userId = userId;
                    lastReadTimestamp = 0;
                    readNotificationIds = [];
                    dismissedNotificationIds = [notificationId];
                });
            };

            userStatuses := buffer;
        };

        // Get all notifications (admin only)
        public func getAllNotifications() : [NotificationEvent] {
            Buffer.toArray(notifications)
        };

        // Get notification statistics
        public func getStats() : NotificationTypes.NotificationStats {
            var categoryMap = Buffer.Buffer<(NotificationCategory, Nat)>(8);
            var severityMap = Buffer.Buffer<(NotificationSeverity, Nat)>(4);
            var oldest : ?Timestamp = null;
            var newest : ?Timestamp = null;

            for (notification in notifications.vals()) {
                // Track oldest/newest
                switch (oldest) {
                    case (null) { oldest := ?notification.timestamp };
                    case (?o) {
                        if (notification.timestamp < o) {
                            oldest := ?notification.timestamp;
                        };
                    };
                };

                switch (newest) {
                    case (null) { newest := ?notification.timestamp };
                    case (?n) {
                        if (notification.timestamp > n) {
                            newest := ?notification.timestamp;
                        };
                    };
                };
            };

            {
                totalNotifications = notifications.size();
                notificationsByCategory = Buffer.toArray(categoryMap);
                notificationsBySeverity = Buffer.toArray(severityMap);
                oldestNotification = oldest;
                newestNotification = newest;
            }
        };

        // Prune old notifications (keep last 30 days)
        public func pruneOldNotifications() : Nat {
            let now = Nat64.fromNat(Int.abs(Time.now()));
            let cutoff = now - (RETENTION_DAYS * NANOSECONDS_PER_DAY);
            let buffer = Buffer.Buffer<NotificationEvent>(notifications.size());
            var prunedCount : Nat = 0;

            for (notification in notifications.vals()) {
                // Keep if within retention period OR if pinned
                if (notification.timestamp >= cutoff or notification.isPinned) {
                    buffer.add(notification);
                } else {
                    prunedCount += 1;
                };
            };

            notifications := buffer;
            prunedCount
        };

        // Delete a specific notification (admin only)
        public func deleteNotification(notificationId: Nat) : Bool {
            let buffer = Buffer.Buffer<NotificationEvent>(notifications.size());
            var deleted = false;

            for (notification in notifications.vals()) {
                if (notification.id == notificationId) {
                    deleted := true;
                } else {
                    buffer.add(notification);
                };
            };

            notifications := buffer;
            deleted
        };

        // Helper: Get user status
        private func getUserStatus(userId: Principal) : UserNotificationStatus {
            for (status in userStatuses.vals()) {
                if (Principal.equal(status.userId, userId)) {
                    return status;
                };
            };

            // Return default status if not found
            {
                userId = userId;
                lastReadTimestamp = 0;
                readNotificationIds = [];
                dismissedNotificationIds = [];
            }
        };

        // Helper: Check if notification is dismissed by user
        private func isNotificationDismissed(status: UserNotificationStatus, notificationId: Nat) : Bool {
            for (id in status.dismissedNotificationIds.vals()) {
                if (id == notificationId) {
                    return true;
                };
            };
            false
        };

        // Prepare for upgrade
        public func toStable() : StableData {
            {
                notifications = Buffer.toArray(notifications);
                nextId = nextNotificationId;
                userStatuses = Buffer.toArray(userStatuses);
            }
        };

        // Restore from upgrade
        public func fromStable(data: StableData) : () {
            notifications := Buffer.fromArray(data.notifications);
            nextNotificationId := data.nextId;
            userStatuses := Buffer.fromArray(data.userStatuses);
        };
    };
}

