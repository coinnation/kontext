import React, { useState, useEffect } from 'react';
import { useCanister } from '../useCanister';
import { useAuth } from '../store/appStore';
import { NotificationSeverity, NotificationCategory } from '../types';

interface NotificationCommandCenterProps {
  onClose: () => void;
}

type TabType = 'create' | 'manage' | 'stats';

export const NotificationCommandCenter: React.FC<NotificationCommandCenterProps> = ({ onClose }) => {
  const { actor } = useCanister('main');
  const { principal, identity } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('create');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Form state for creating notifications
  const [severity, setSeverity] = useState<NotificationSeverity>(NotificationSeverity.MEDIUM);
  const [category, setCategory] = useState<NotificationCategory>(NotificationCategory.ANNOUNCEMENT);
  const [audienceType, setAudienceType] = useState<'all' | 'specific' | 'tier' | 'new' | 'active'>('all');
  const [specificUsers, setSpecificUsers] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState('free');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [icon, setIcon] = useState('📢');
  const [isPinned, setIsPinned] = useState(false);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);
  const [hasAction, setHasAction] = useState(false);
  const [actionLabel, setActionLabel] = useState('');
  const [actionType, setActionType] = useState<'navigate' | 'dialog' | 'external'>('navigate');
  const [actionValue, setActionValue] = useState('');

  // State for managing notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load notifications and stats
  useEffect(() => {
    if (activeTab === 'manage') {
      loadNotifications();
    } else if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab, actor]);

  const loadNotifications = async () => {
    if (!actor) return;
    
    try {
      setIsLoading(true);
      const result = await actor.getAllNotifications();
      if ('ok' in result) {
        setNotifications(result.ok);
      } else {
        setError(result.err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    if (!actor) return;
    
    try {
      setIsLoading(true);
      const result = await actor.getNotificationStats();
      if ('ok' in result) {
        setStats(result.ok);
      } else {
        setError(result.err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !principal) return;

    if (!title.trim() || !message.trim()) {
      setError('Title and message are required');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      // Build audience
      let audience: any;
      if (audienceType === 'all') {
        audience = { All: null };
      } else if (audienceType === 'specific') {
        const principals = specificUsers.split(',').map(p => p.trim()).filter(Boolean);
        if (principals.length === 0) {
          setError('Please enter at least one principal ID');
          setIsLoading(false);
          return;
        }
        audience = { SpecificUsers: principals };
      } else if (audienceType === 'tier') {
        audience = { SubscriptionTier: subscriptionTier };
      } else if (audienceType === 'new') {
        const timestamp = BigInt(Date.now()) * BigInt(1_000_000);
        audience = { NewUsers: timestamp };
      } else {
        const timestamp = BigInt(Date.now()) * BigInt(1_000_000);
        audience = { ActiveUsers: timestamp };
      }

      // Build severity
      const severityVariant = { [severity]: null };

      // Build category
      const categoryVariant = { [category]: null };

      // Build expiry
      const expiry = hasExpiry
        ? [BigInt(Date.now() + expiryDays * 24 * 60 * 60 * 1000) * BigInt(1_000_000)]
        : [];

      // Build actions
      const actions = hasAction && actionLabel && actionValue
        ? [[{
            label: actionLabel,
            actionType: actionType === 'navigate'
              ? { NavigateTo: actionValue }
              : actionType === 'dialog'
                ? { OpenDialog: actionValue }
                : { ExternalLink: actionValue }
          }]]
        : [];

      const result = await actor.createNotification(
        severityVariant,
        categoryVariant,
        audience,
        title,
        message,
        icon ? [icon] : [],
        [],
        actions,
        expiry,
        isPinned
      );

      if ('ok' in result) {
        setSuccess(`✅ Notification created successfully! ID: ${result.ok}`);
        // Reset form
        setTitle('');
        setMessage('');
        setIcon('📢');
        setIsPinned(false);
        setHasExpiry(false);
        setHasAction(false);
        setActionLabel('');
        setActionValue('');
      } else {
        setError(result.err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create notification');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNotification = async (notificationId: number) => {
    if (!actor || !confirm('Are you sure you want to delete this notification?')) return;

    try {
      const result = await actor.deleteNotification(BigInt(notificationId));
      if ('ok' in result) {
        setSuccess('Notification deleted successfully');
        loadNotifications();
      } else {
        setError(result.err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
    }
  };

  const handlePruneOld = async () => {
    if (!actor || !confirm('Prune all notifications older than 30 days?')) return;

    try {
      const result = await actor.pruneOldNotifications();
      if ('ok' in result) {
        setSuccess(`Pruned ${result.ok} old notifications`);
        loadNotifications();
      } else {
        setError(result.err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prune notifications');
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'Critical': return '#ef4444';
      case 'High': return '#f59e0b';
      case 'Medium': return '#3b82f6';
      case 'Low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1_000_000);
    return date.toLocaleString();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--kontext-primary-black)',
      zIndex: 10000,
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.15) 0%, transparent 50%), linear-gradient(135deg, rgb(17, 17, 17) 0%, #1a1a1a 50%, rgb(17, 17, 17) 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: isMobile ? '1rem' : '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>📢</div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #f97316, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Notification Command Center
            </h1>
            <p style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.6)'
            }}>
              Create and manage platform-wide notifications
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        background: 'rgba(17, 17, 17, 0.8)',
        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        gap: 0
      }}>
        {[
          { id: 'create', label: '➕ Create', icon: '➕' },
          { id: 'manage', label: '📋 Manage', icon: '📋' },
          { id: 'stats', label: '📊 Statistics', icon: '📊' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            style={{
              padding: isMobile ? '0.75rem 1rem' : '1rem 2rem',
              background: activeTab === tab.id ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--kontext-orange)' : '2px solid transparent',
              color: activeTab === tab.id ? '#fff' : 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              fontSize: isMobile ? '0.9rem' : '1rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {isMobile ? tab.icon : tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Status Messages */}
        {error && (
          <div style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            marginBottom: '1rem'
          }}>
            ❌ {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '1rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            color: '#10b981',
            marginBottom: '1rem'
          }}>
            {success}
          </div>
        )}

        {/* Create Tab */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateNotification}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Basic Info */}
              <div style={{
                background: 'rgba(17, 17, 17, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: isMobile ? '1rem' : '1.5rem'
              }}>
                <h3 style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.1rem',
                  color: '#fff'
                }}>
                  📝 Basic Information
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                      Severity
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as NotificationSeverity)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                    >
                      <option value="Low">🟢 Low</option>
                      <option value="Medium">🔵 Medium</option>
                      <option value="High">🟠 High</option>
                      <option value="Critical">🔴 Critical</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                    >
                      <option value="System">⚙️ System</option>
                      <option value="Account">👤 Account</option>
                      <option value="Credits">💰 Credits</option>
                      <option value="Subscription">💳 Subscription</option>
                      <option value="Deployment">🚀 Deployment</option>
                      <option value="Security">🔐 Security</option>
                      <option value="Feature">✨ Feature</option>
                      <option value="Announcement">📢 Announcement</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Icon (emoji)
                  </label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="📢"
                    maxLength={2}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter notification title"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Message *
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter notification message"
                    required
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              {/* Audience Targeting */}
              <div style={{
                background: 'rgba(17, 17, 17, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: isMobile ? '1rem' : '1.5rem'
              }}>
                <h3 style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.1rem',
                  color: '#fff'
                }}>
                  🎯 Audience Targeting
                </h3>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Target Audience
                  </label>
                  <select
                    value={audienceType}
                    onChange={(e) => setAudienceType(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  >
                    <option value="all">🌍 Everyone</option>
                    <option value="specific">👤 Specific User(s)</option>
                    <option value="tier">💳 Subscription Tier</option>
                    <option value="new">🆕 New Users (registered after now)</option>
                    <option value="active">⚡ Active Users (active since now)</option>
                  </select>
                </div>

                {audienceType === 'specific' && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                      Principal IDs (comma-separated)
                    </label>
                    <textarea
                      value={specificUsers}
                      onChange={(e) => setSpecificUsers(e.target.value)}
                      placeholder="principal1, principal2, principal3..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                )}

                {audienceType === 'tier' && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                      Subscription Tier
                    </label>
                    <select
                      value={subscriptionTier}
                      onChange={(e) => setSubscriptionTier(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                    >
                      <option value="free">Free</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Advanced Options */}
              <div style={{
                background: 'rgba(17, 17, 17, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: isMobile ? '1rem' : '1.5rem'
              }}>
                <h3 style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.1rem',
                  color: '#fff'
                }}>
                  ⚙️ Advanced Options
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Pin Option */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#fff', fontSize: '0.9rem' }}>
                      📌 Pin to top of notification list
                    </span>
                  </label>

                  {/* Expiry Option */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={hasExpiry}
                        onChange={(e) => setHasExpiry(e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                      />
                      <span style={{ color: '#fff', fontSize: '0.9rem' }}>
                        ⏰ Set expiration date
                      </span>
                    </label>
                    {hasExpiry && (
                      <div style={{ marginLeft: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                          Expires in (days)
                        </label>
                        <input
                          type="number"
                          value={expiryDays}
                          onChange={(e) => setExpiryDays(parseInt(e.target.value) || 7)}
                          min={1}
                          max={365}
                          style={{
                            width: '150px',
                            padding: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.9rem'
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Action Option */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={hasAction}
                        onChange={(e) => setHasAction(e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                      />
                      <span style={{ color: '#fff', fontSize: '0.9rem' }}>
                        🔗 Add action button
                      </span>
                    </label>
                    {hasAction && (
                      <div style={{ marginLeft: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <input
                          type="text"
                          value={actionLabel}
                          onChange={(e) => setActionLabel(e.target.value)}
                          placeholder="Button label (e.g., 'View Details')"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.9rem'
                          }}
                        />
                        <select
                          value={actionType}
                          onChange={(e) => setActionType(e.target.value as any)}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.9rem'
                          }}
                        >
                          <option value="navigate">Navigate to route</option>
                          <option value="dialog">Open dialog</option>
                          <option value="external">External link</option>
                        </select>
                        <input
                          type="text"
                          value={actionValue}
                          onChange={(e) => setActionValue(e.target.value)}
                          placeholder={
                            actionType === 'navigate' ? '/route/path'
                              : actionType === 'dialog' ? 'dialogName'
                                : 'https://...'
                          }
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.9rem'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !title.trim() || !message.trim()}
                style={{
                  padding: '1rem 2rem',
                  background: isLoading || !title.trim() || !message.trim()
                    ? 'rgba(255, 107, 53, 0.3)'
                    : 'linear-gradient(135deg, #f97316, #fbbf24)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: isLoading || !title.trim() || !message.trim() ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !title.trim() || !message.trim() ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && title.trim() && message.trim()) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {isLoading ? '⏳ Creating...' : '📤 Send Notification'}
              </button>
            </div>
          </form>
        )}

        {/* Manage Tab */}
        {activeTab === 'manage' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Active Notifications</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={loadNotifications}
                  disabled={isLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={handlePruneOld}
                  disabled={isLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    color: '#ef4444',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🧹 Prune Old
                </button>
              </div>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                No notifications found
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {notifications.map((notif: any) => {
                  const severityKey = Object.keys(notif.severity)[0];
                  const categoryKey = Object.keys(notif.category)[0];
                  
                  return (
                    <div
                      key={Number(notif.id)}
                      style={{
                        background: notif.isPinned ? 'rgba(255, 107, 53, 0.1)' : 'rgba(17, 17, 17, 0.6)',
                        border: `1px solid ${notif.isPinned ? 'rgba(255, 107, 53, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                        borderLeft: `4px solid ${getSeverityColor(severityKey)}`,
                        borderRadius: '12px',
                        padding: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                          <span style={{ fontSize: '1.5rem' }}>
                            {notif.icon.length > 0 ? notif.icon[0] : '📢'}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.25rem' }}>
                              {notif.isPinned && <span style={{ marginRight: '0.5rem' }}>📌</span>}
                              {notif.title}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: getSeverityColor(severityKey) }}>
                              {severityKey} • {categoryKey} • ID: {Number(notif.id)}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteNotification(Number(notif.id))}
                          style={{
                            padding: '0.5rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                      
                      <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '0.5rem' }}>
                        {notif.message}
                      </div>
                      
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Created: {formatTimestamp(notif.timestamp)}
                        {notif.expiresAt.length > 0 && ` • Expires: ${formatTimestamp(notif.expiresAt[0])}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div>
            <h3 style={{ margin: '0 0 1rem 0', color: '#fff' }}>Notification Statistics</h3>
            
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                Loading statistics...
              </div>
            ) : stats ? (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#10b981', marginBottom: '0.5rem' }}>
                    {stats.totalNotifications}
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Total Notifications
                  </div>
                </div>
                
                {stats.oldestNotification.length > 0 && (
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#3b82f6', marginBottom: '0.5rem' }}>
                      Oldest
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                      {formatTimestamp(stats.oldestNotification[0])}
                    </div>
                  </div>
                )}
                
                {stats.newestNotification.length > 0 && (
                  <div style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#8b5cf6', marginBottom: '0.5rem' }}>
                      Newest
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                      {formatTimestamp(stats.newestNotification[0])}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                No statistics available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};



