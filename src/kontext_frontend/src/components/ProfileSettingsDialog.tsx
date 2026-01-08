import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../store/appStore';
import { userCanisterService } from '../services/UserCanisterService';

interface ProfileSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileSettingsDialog({ isOpen, onClose }: ProfileSettingsDialogProps) {
  const { principal, identity, userCanisterId } = useAuth();
  
  // Preferences state
  const [theme, setTheme] = useState<string>('dark');
  const [emailNotifications, setEmailNotifications] = useState<boolean>(true);
  const [discordNotifications, setDiscordNotifications] = useState<boolean>(false);
  const [telegramNotifications, setTelegramNotifications] = useState<boolean>(false);
  const [inAppNotifications, setInAppNotifications] = useState<boolean>(true);
  const [digestFrequency, setDigestFrequency] = useState<string>('daily');
  const [profileVisibility, setProfileVisibility] = useState<string>('Public');
  const [projectsVisibility, setProjectsVisibility] = useState<string>('Public');
  const [statsVisibility, setStatsVisibility] = useState<string>('Public');
  const [activityVisibility, setActivityVisibility] = useState<string>('Public');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const portalRoot = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure portal root exists
  useEffect(() => {
    if (!portalRoot.current) {
      let existingPortalRoot = document.getElementById('dialog-portal-root') as HTMLDivElement;
      if (!existingPortalRoot) {
        existingPortalRoot = document.createElement('div');
        existingPortalRoot.id = 'dialog-portal-root';
        existingPortalRoot.style.position = 'fixed';
        existingPortalRoot.style.top = '0';
        existingPortalRoot.style.left = '0';
        existingPortalRoot.style.width = '100%';
        existingPortalRoot.style.height = '100%';
        existingPortalRoot.style.pointerEvents = 'none';
        existingPortalRoot.style.zIndex = '100002';
        document.body.appendChild(existingPortalRoot);
      }
      portalRoot.current = existingPortalRoot;
    }
    if (isOpen) {
      setMounted(true);
    }
  }, [isOpen]);

  // Load preferences when dialog opens
  useEffect(() => {
    if (isOpen && userCanisterId && identity) {
      loadPreferences();
    }
  }, [isOpen, userCanisterId, identity]);

  const loadPreferences = async () => {
    if (!userCanisterId || !identity) return;
    
    setLoading(true);
    try {
      console.log('📥 [ProfileSettings] Loading user preferences...');
      const result = await userCanisterService.getAccountPreferences(userCanisterId, identity);
      
      if (result.success && result.preferences) {
        const prefs = result.preferences;
        console.log('✅ [ProfileSettings] Preferences loaded:', prefs);
        
        // Extract preferences with defaults
        if (prefs.theme) {
          setTheme(Array.isArray(prefs.theme) && prefs.theme.length > 0 ? prefs.theme[0] : 'dark');
        }
        
        if (prefs.notifications?.channelPreferences) {
          const ch = prefs.notifications.channelPreferences;
          setEmailNotifications(ch.email ?? true);
          setDiscordNotifications(ch.discord ?? false);
          setTelegramNotifications(ch.telegram ?? false);
          setInAppNotifications(ch.inApp ?? true);
        }
        
        if (prefs.notifications?.digestFrequency) {
          const freq = Array.isArray(prefs.notifications.digestFrequency) 
            ? (prefs.notifications.digestFrequency.length > 0 ? prefs.notifications.digestFrequency[0] : 'daily')
            : 'daily';
          setDigestFrequency(freq);
        }
        
        if (prefs.visibility) {
          const extractVisibility = (vis: any) => {
            if (typeof vis === 'object' && vis !== null) {
              if ('Public' in vis) return 'Public';
              if ('Private' in vis) return 'Private';
              if ('Contacts' in vis) return 'Contacts';
            }
            return 'Public';
          };
          
          setProfileVisibility(extractVisibility(prefs.visibility.profile));
          setProjectsVisibility(extractVisibility(prefs.visibility.projects));
          setStatsVisibility(extractVisibility(prefs.visibility.stats));
          setActivityVisibility(extractVisibility(prefs.visibility.activity));
        }
      } else {
        console.log('ℹ️ [ProfileSettings] No preferences found, using defaults');
      }
    } catch (error) {
      console.error('❌ [ProfileSettings] Error loading preferences:', error);
      setMessage({ type: 'error', text: 'Failed to load preferences' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userCanisterId || !identity) {
      setMessage({ type: 'error', text: 'Not authenticated' });
      return;
    }
    
    setSaving(true);
    setMessage(null);
    
    try {
      console.log('💾 [ProfileSettings] Saving preferences...');
      
      // Convert visibility strings to Motoko variants
      const toVisibilityVariant = (vis: string) => {
        if (vis === 'Public') return { Public: null };
        if (vis === 'Private') return { Private: null };
        if (vis === 'Contacts') return { Contacts: null };
        return { Public: null };
      };
      
      const preferences = {
        theme: [theme],
        notifications: {
          channelPreferences: {
            email: emailNotifications,
            discord: discordNotifications,
            telegram: telegramNotifications,
            inApp: inAppNotifications
          },
          digestFrequency: [digestFrequency],
          notificationTypes: []
        },
        visibility: {
          profile: toVisibilityVariant(profileVisibility),
          projects: toVisibilityVariant(projectsVisibility),
          stats: toVisibilityVariant(statsVisibility),
          activity: toVisibilityVariant(activityVisibility)
        },
        defaultProjectPreferences: [],
        customPreferences: []
      };
      
      console.log('📤 [ProfileSettings] Sending preferences:', preferences);
      
      const result = await userCanisterService.updateAccountPreferences(
        userCanisterId,
        identity,
        preferences
      );
      
      if (result.success) {
        console.log('✅ [ProfileSettings] Preferences saved successfully');
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setTimeout(() => {
          setMessage(null);
        }, 3000);
      } else {
        console.error('❌ [ProfileSettings] Failed to save:', result.error);
        setMessage({ type: 'error', text: result.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('❌ [ProfileSettings] Error saving preferences:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save settings' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    if (mounted) {
      setTimeout(() => setMounted(false), 300);
    }
    return null;
  }
  
  if (!mounted || !portalRoot.current) {
    if (isOpen && !mounted) {
      setMounted(true);
    }
    return null;
  }

  const dialogContent = (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100000,
      padding: '1rem',
      pointerEvents: 'auto',
      overflowY: 'auto'
    }} onClick={(e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid rgba(255, 107, 53, 0.3)',
        borderRadius: '20px',
        padding: '2rem',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9), 0 0 50px rgba(255, 107, 53, 0.2)'
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid rgba(255, 107, 53, 0.2)',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <h2 style={{
            fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #ff6b35, #fbbf24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            ⚙️ Profile Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.9rem'
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

        {/* Loading State */}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#ff6b35'
          }}>
            ⏳ Loading preferences...
          </div>
        )}

        {/* Message Banner */}
        {message && (
          <div style={{
            background: message.type === 'success' 
              ? 'rgba(34, 197, 94, 0.1)' 
              : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.type === 'success' 
              ? 'rgba(34, 197, 94, 0.3)' 
              : 'rgba(239, 68, 68, 0.3)'}`,
            color: message.type === 'success' ? '#22c55e' : '#ef4444',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            textAlign: 'center'
          }}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        {/* Settings Form */}
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* User Info */}
            <div style={{
              background: 'rgba(255, 107, 53, 0.1)',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{
                fontSize: '0.85rem',
                color: '#ff6b35',
                fontWeight: 600,
                marginBottom: '0.5rem'
              }}>
                🆔 Principal ID:
              </div>
              <div 
                onClick={async (e) => {
                  if (principal) {
                    try {
                      await navigator.clipboard.writeText(principal.toString());
                      const target = e.currentTarget;
                      const originalText = target.textContent;
                      target.textContent = '✓ Copied!';
                      target.style.color = '#10b981';
                      setTimeout(() => {
                        if (target.textContent === '✓ Copied!') {
                          target.textContent = originalText;
                          target.style.color = '#e5e7eb';
                        }
                      }, 2000);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                  }
                }}
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: '#e5e7eb',
                  wordBreak: 'break-all',
                  lineHeight: '1.4',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                title="Click to copy"
              >
                {principal?.toString()}
              </div>
            </div>

            {/* Theme */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: '0.5rem'
              }}>
                🎨 Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 107, 53, 0.3)',
                  background: 'rgba(26, 26, 26, 0.8)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            {/* Notification Channels */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: '0.75rem'
              }}>
                🔔 Notification Channels
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: '📧 Email', value: emailNotifications, setter: setEmailNotifications },
                  { label: '💬 Discord', value: discordNotifications, setter: setDiscordNotifications },
                  { label: '📱 Telegram', value: telegramNotifications, setter: setTelegramNotifications },
                  { label: '🔔 In-App', value: inAppNotifications, setter: setInAppNotifications }
                ].map((item, idx) => (
                  <label key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }}>
                    <input
                      type="checkbox"
                      checked={item.value}
                      onChange={(e) => item.setter(e.target.checked)}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        accentColor: '#ff6b35'
                      }}
                    />
                    <span style={{ color: '#e5e7eb', fontSize: '0.9rem', flex: 1 }}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Digest Frequency */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: '0.5rem'
              }}>
                📊 Notification Digest
              </label>
              <select
                value={digestFrequency}
                onChange={(e) => setDigestFrequency(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 107, 53, 0.3)',
                  background: 'rgba(26, 26, 26, 0.8)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="realtime">Real-time</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="never">Never</option>
              </select>
            </div>

            {/* Visibility Settings */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: '0.75rem'
              }}>
                👁️ Visibility Settings
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: '👤 Profile', value: profileVisibility, setter: setProfileVisibility },
                  { label: '📁 Projects', value: projectsVisibility, setter: setProjectsVisibility },
                  { label: '📊 Stats', value: statsVisibility, setter: setStatsVisibility },
                  { label: '📈 Activity', value: activityVisibility, setter: setActivityVisibility }
                ].map((item, idx) => (
                  <div key={idx} style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ color: '#e5e7eb', fontSize: '0.9rem' }}>
                      {item.label}
                    </span>
                    <select
                      value={item.value}
                      onChange={(e) => item.setter(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 107, 53, 0.3)',
                        background: 'rgba(26, 26, 26, 0.8)',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="Public">🌐 Public</option>
                      <option value="Contacts">👥 Contacts Only</option>
                      <option value="Private">🔒 Private</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '12px',
                background: saving 
                  ? 'rgba(255, 107, 53, 0.3)' 
                  : 'linear-gradient(135deg, #ff6b35, #fbbf24)',
                border: 'none',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: saving 
                  ? 'none' 
                  : '0 4px 20px rgba(255, 107, 53, 0.4)',
                opacity: saving ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 30px rgba(255, 107, 53, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 107, 53, 0.4)';
                }
              }}
            >
              {saving ? '⏳ Saving...' : '💾 Save Settings'}
            </button>
          </div>
        )}

        {/* Info Banner */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginTop: '1.5rem'
        }}>
          <div style={{
            fontSize: '0.85rem',
            color: '#60a5fa',
            lineHeight: '1.6'
          }}>
            <strong>ℹ️ Quick Settings:</strong> These are your most commonly used preferences. 
            For advanced settings, visit your full profile dashboard.
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, portalRoot.current!);
}
