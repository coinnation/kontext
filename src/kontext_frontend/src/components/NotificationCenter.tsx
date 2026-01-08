import React, { useState, useEffect, useRef } from 'react';
import { NotificationEvent, NotificationSeverity, NotificationCategory } from '../types';
import { notificationService } from '../services/NotificationService';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  anchorRef
}) => {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to notification updates
  useEffect(() => {
    const unsubscribeNotifications = notificationService.onNotifications((newNotifications) => {
      setNotifications(prev => {
        // Merge new notifications with existing ones
        const merged = [...newNotifications, ...prev];
        // Remove duplicates by ID
        const unique = merged.filter((n, index, self) =>
          index === self.findIndex((t) => t.id === n.id)
        );
        // Sort by timestamp (newest first) and pinned first
        return unique.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return Number(b.timestamp - a.timestamp);
        }).slice(0, 50); // Keep only latest 50
      });
    });

    const unsubscribeUnreadCount = notificationService.onUnreadCount((count) => {
      setUnreadCount(count);
    });

    return () => {
      unsubscribeNotifications();
      unsubscribeUnreadCount();
    };
  }, []);

  // Mark as read when opened
  useEffect(() => {
    console.log('🔔 [NotificationCenter] isOpen changed:', isOpen);
    if (isOpen) {
      console.log('✅ [NotificationCenter] Opening notification center, marking as read...');
      notificationService.markAsRead();
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  // Get position relative to anchor
  const getDropdownPosition = () => {
    if (!anchorRef.current) return {};
    
    const rect = anchorRef.current.getBoundingClientRect();
    return {
      position: 'fixed' as const,
      top: `${rect.bottom + 8}px`,
      right: `${window.innerWidth - rect.right}px`,
      zIndex: 10000
    };
  };

  const getSeverityColor = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'Critical': return '#ef4444';
      case 'High': return '#f59e0b';
      case 'Medium': return '#3b82f6';
      case 'Low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'System': return '⚙️';
      case 'Account': return '👤';
      case 'Credits': return '💰';
      case 'Subscription': return '💳';
      case 'Deployment': return '🚀';
      case 'Security': return '🔐';
      case 'Feature': return '✨';
      case 'Announcement': return '📢';
      default: return '📬';
    }
  };

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1_000_000); // Convert from nanoseconds
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleDismiss = async (notificationId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    await notificationService.dismissNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleNotificationClick = (notification: NotificationEvent) => {
    if (notification.actions && notification.actions.length > 0) {
      const action = notification.actions[0];
      if ('NavigateTo' in action.actionType) {
        // Handle navigation
        window.location.href = action.actionType.NavigateTo;
      } else if ('ExternalLink' in action.actionType) {
        window.open(action.actionType.ExternalLink, '_blank');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      style={{
        ...getDropdownPosition(),
        width: '400px',
        maxWidth: '90vw',
        maxHeight: '600px',
        background: 'linear-gradient(135deg, rgb(17, 17, 17) 0%, #1a1a1a 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeInScale 0.2s ease-out'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '1.1rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #f97316, #fbbf24)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          📬 Notifications
        </h3>
        {unreadCount > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '0.25rem 0.5rem',
            borderRadius: '12px',
            minWidth: '1.5rem',
            textAlign: 'center'
          }}>
            {unreadCount}
          </div>
        )}
      </div>

      {/* Notification List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem'
      }}>
        {notifications.length === 0 ? (
          <div style={{
            padding: '3rem 1rem',
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <div style={{ fontSize: '0.9rem' }}>No notifications</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>You're all caught up!</div>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              style={{
                padding: '0.75rem',
                marginBottom: '0.5rem',
                background: notification.isPinned
                  ? 'rgba(255, 107, 53, 0.1)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${notification.isPinned ? 'rgba(255, 107, 53, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`,
                borderLeft: `3px solid ${getSeverityColor(notification.severity)}`,
                borderRadius: '8px',
                cursor: notification.actions ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = notification.isPinned
                  ? 'rgba(255, 107, 53, 0.15)'
                  : 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = notification.isPinned
                  ? 'rgba(255, 107, 53, 0.1)'
                  : 'rgba(255, 255, 255, 0.03)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <span style={{ fontSize: '1.25rem' }}>
                    {notification.icon || getCategoryIcon(notification.category)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#fff',
                      marginBottom: '0.25rem'
                    }}>
                      {notification.title}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: getSeverityColor(notification.severity),
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>{notification.category}</span>
                      <span>•</span>
                      <span>{formatTimestamp(notification.timestamp)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDismiss(notification.id, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.5)',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    fontSize: '1rem',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div style={{
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.7)',
                lineHeight: '1.4'
              }}>
                {notification.message}
              </div>

              {notification.actions && notification.actions.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  {notification.actions.map((action, index) => (
                    <button
                      key={index}
                      style={{
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255, 107, 53, 0.1)',
                        border: '1px solid rgba(255, 107, 53, 0.3)',
                        borderRadius: '6px',
                        color: '#ff6b35',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};



