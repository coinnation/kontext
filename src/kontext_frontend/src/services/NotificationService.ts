import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { idlFactory } from '../../candid/kontext_backend.did.js';
import { _SERVICE } from '../../candid/kontext_backend.did';
import { NotificationEvent } from '../types';

export class NotificationService {
  private actor: _SERVICE | null = null;
  private readonly canisterId = 'pkmhr-fqaaa-aaaaa-qcfeq-cai';
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastCheckTimestamp: bigint = BigInt(0);
  private notificationCallbacks: Set<(notifications: NotificationEvent[]) => void> = new Set();
  private unreadCountCallbacks: Set<(count: number) => void> = new Set();

  /**
   * Initialize the notification service
   */
  public async initialize(identity: Identity): Promise<void> {
    try {
      console.log('📬 [NotificationService] Initializing...');

      const agent = new HttpAgent({
        host: 'https://icp0.io',
        identity
      });

      // Fetch root key for local development (not needed in production)
      if (process.env.DFX_NETWORK !== 'ic') {
        await agent.fetchRootKey();
      }

      this.actor = Actor.createActor<_SERVICE>(idlFactory, {
        agent,
        canisterId: this.canisterId
      });

      // Load last check timestamp from localStorage
      const stored = localStorage.getItem('notificationLastCheck');
      if (stored) {
        this.lastCheckTimestamp = BigInt(stored);
      }

      console.log('✅ [NotificationService] Initialized');
    } catch (error) {
      console.error('❌ [NotificationService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start polling for notifications
   */
  public startPolling(intervalMs: number = 30000): void {
    if (this.pollingInterval) {
      console.warn('⚠️ [NotificationService] Already polling');
      return;
    }

    console.log(`📬 [NotificationService] Starting polling every ${intervalMs}ms`);

    // Initial fetch
    this.fetchNotifications();

    // Set up polling
    this.pollingInterval = setInterval(() => {
      this.fetchNotifications();
    }, intervalMs);
  }

  /**
   * Stop polling for notifications
   */
  public stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('🛑 [NotificationService] Polling stopped');
    }
  }

  /**
   * Fetch notifications from platform canister
   */
  private async fetchNotifications(): Promise<void> {
    if (!this.actor) {
      console.warn('⚠️ [NotificationService] Actor not initialized');
      return;
    }

    try {
      console.log('📬 [NotificationService] Fetching notifications since', this.lastCheckTimestamp);

      // Fetch notifications (FREE query call)
      const notifications = await this.actor.getNotifications(
        this.lastCheckTimestamp,
        [50] // limit
      );

      // Convert to frontend format
      const frontendNotifications = notifications.map(this.convertNotification);

      // Update last check timestamp
      const now = BigInt(Date.now()) * BigInt(1_000_000); // Convert to nanoseconds
      this.lastCheckTimestamp = now;
      localStorage.setItem('notificationLastCheck', now.toString());

      // Notify all callbacks
      this.notificationCallbacks.forEach(callback => {
        callback(frontendNotifications);
      });

      // Fetch unread count
      await this.fetchUnreadCount();

      console.log(`✅ [NotificationService] Fetched ${frontendNotifications.length} notifications`);
    } catch (error) {
      console.error('❌ [NotificationService] Failed to fetch notifications:', error);
    }
  }

  /**
   * Fetch unread notification count
   */
  private async fetchUnreadCount(): Promise<void> {
    if (!this.actor) return;

    try {
      const count = await this.actor.getUnreadNotificationCount();
      
      // Notify all callbacks
      this.unreadCountCallbacks.forEach(callback => {
        callback(Number(count));
      });
    } catch (error) {
      console.error('❌ [NotificationService] Failed to fetch unread count:', error);
    }
  }

  /**
   * Mark notifications as read
   */
  public async markAsRead(): Promise<void> {
    if (!this.actor) return;

    try {
      const now = BigInt(Date.now()) * BigInt(1_000_000);
      await this.actor.markNotificationsAsRead(now);
      console.log('✅ [NotificationService] Notifications marked as read');

      // Update unread count
      await this.fetchUnreadCount();
    } catch (error) {
      console.error('❌ [NotificationService] Failed to mark as read:', error);
    }
  }

  /**
   * Dismiss a specific notification
   */
  public async dismissNotification(notificationId: number): Promise<void> {
    if (!this.actor) return;

    try {
      await this.actor.dismissNotification(BigInt(notificationId));
      console.log('✅ [NotificationService] Notification dismissed:', notificationId);

      // Update unread count
      await this.fetchUnreadCount();
    } catch (error) {
      console.error('❌ [NotificationService] Failed to dismiss notification:', error);
    }
  }

  /**
   * Subscribe to notification updates
   */
  public onNotifications(callback: (notifications: NotificationEvent[]) => void): () => void {
    this.notificationCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.notificationCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to unread count updates
   */
  public onUnreadCount(callback: (count: number) => void): () => void {
    this.unreadCountCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.unreadCountCallbacks.delete(callback);
    };
  }

  /**
   * Force refresh notifications immediately
   */
  public async refresh(): Promise<void> {
    await this.fetchNotifications();
  }

  /**
   * Convert Candid notification to frontend format
   */
  private convertNotification(candid: any): NotificationEvent {
    // Parse severity
    let severity: any = 'Medium';
    if ('Critical' in candid.severity) severity = 'Critical';
    else if ('High' in candid.severity) severity = 'High';
    else if ('Medium' in candid.severity) severity = 'Medium';
    else if ('Low' in candid.severity) severity = 'Low';

    // Parse category
    let category: any = 'System';
    if ('System' in candid.category) category = 'System';
    else if ('Account' in candid.category) category = 'Account';
    else if ('Credits' in candid.category) category = 'Credits';
    else if ('Subscription' in candid.category) category = 'Subscription';
    else if ('Deployment' in candid.category) category = 'Deployment';
    else if ('Security' in candid.category) category = 'Security';
    else if ('Feature' in candid.category) category = 'Feature';
    else if ('Announcement' in candid.category) category = 'Announcement';

    return {
      id: Number(candid.id),
      timestamp: candid.timestamp,
      severity,
      category,
      title: candid.title,
      message: candid.message,
      icon: candid.icon.length > 0 ? candid.icon[0] : undefined,
      metadata: candid.metadata.length > 0 ? candid.metadata[0] : undefined,
      actions: candid.actions.length > 0 ? candid.actions[0] : undefined,
      expiresAt: candid.expiresAt.length > 0 ? candid.expiresAt[0] : undefined,
      createdBy: candid.createdBy.toString(),
      isPinned: candid.isPinned,
      isRead: false,
      isDismissed: false
    };
  }
}

// Singleton instance
export const notificationService = new NotificationService();



