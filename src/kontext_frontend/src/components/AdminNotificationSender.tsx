/**
 * Admin Notification Sender
 * 
 * Interface for admins to send platform-wide notifications
 */

import React, { useState } from 'react';
import { Bell, Send, Plus, Trash2, Users } from 'lucide-react';
import { platformCanisterService } from '../services/PlatformCanisterService';
import { Principal } from '@dfinity/principal';

type NotificationSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
type NotificationCategory = 'System' | 'Account' | 'Credits' | 'Subscription' | 'Deployment' | 'Security' | 'Feature' | 'Announcement';
type AudienceType = 'All' | 'SpecificUsers' | 'SubscriptionTier' | 'NewUsers' | 'ActiveUsers';

interface NotificationForm {
  severity: NotificationSeverity;
  category: NotificationCategory;
  audienceType: AudienceType;
  audienceValue: string;
  title: string;
  message: string;
  icon: string;
  metadata: Array<{ key: string; value: string }>;
  actions: Array<{ label: string; actionType: string; actionValue: string }>;
  expiresAt: string;
  isPinned: boolean;
}

export const AdminNotificationSender: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<NotificationForm>({
    severity: 'Medium',
    category: 'Announcement',
    audienceType: 'All',
    audienceValue: '',
    title: '',
    message: '',
    icon: '📢',
    metadata: [],
    actions: [],
    expiresAt: '',
    isPinned: false
  });

  const handleSendNotification = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Validation
      if (!form.title || !form.message) {
        setError('Please fill in title and message');
        return;
      }

      console.log('📤 [AdminNotificationSender] Sending notification with platformCanisterService...');

      // Convert severity to Motoko variant
      const severityVariant = { [form.severity]: null };
      const categoryVariant = { [form.category]: null };

      // Build audience
      let audience: any;
      switch (form.audienceType) {
        case 'All':
          audience = { AllUsers: null };
          break;
        case 'SpecificUsers':
          const principals = form.audienceValue.split(',').map(p => p.trim()).filter(p => p);
          if (principals.length === 0) {
            setError('Please provide at least one user principal');
            return;
          }
          try {
            const principalObjects = principals.map(p => Principal.fromText(p));
            audience = { SpecificUsers: principalObjects };
          } catch (e) {
            setError('Invalid principal format in user list');
            return;
          }
          break;
        case 'SubscriptionTier':
          if (!form.audienceValue) {
            setError('Please specify a subscription tier');
            return;
          }
          const tierMapping: Record<string, any> = {
            'free': { Free: null },
            'starter': { Starter: null },
            'developer': { Developer: null },
            'pro': { Pro: null },
            'enterprise': { Enterprise: null }
          };
          audience = { SubscriptionTier: tierMapping[form.audienceValue.toLowerCase()] };
          break;
        case 'NewUsers':
          const days = parseInt(form.audienceValue) || 7;
          const daysInNano = BigInt(days * 24 * 60 * 60 * 1000000000);
          audience = { NewUsers: daysInNano };
          break;
        case 'ActiveUsers':
          const activeDays = parseInt(form.audienceValue) || 30;
          const activeDaysInNano = BigInt(activeDays * 24 * 60 * 60 * 1000000000);
          audience = { ActiveUsers: activeDaysInNano };
          break;
        default:
          audience = { AllUsers: null };
      }

      // Build metadata
      const metadataMap: Array<[string, string]> = form.metadata.map(m => [m.key, m.value]);

      // Build actions
      const actionVariants = form.actions.map(action => {
        let actionTypeVariant: any;
        switch (action.actionType) {
          case 'NavigateTo':
            actionTypeVariant = { NavigateTo: null };
            break;
          case 'OpenDialog':
            actionTypeVariant = { OpenDialog: null };
            break;
          case 'ExternalLink':
            actionTypeVariant = { ExternalLink: null };
            break;
          case 'Dismiss':
            actionTypeVariant = { Dismiss: null };
            break;
          default:
            actionTypeVariant = { Dismiss: null };
        }

        return {
          actionLabel: action.label,
          actionType: actionTypeVariant,
          actionValue: [action.actionValue]
        };
      });

      // Convert expiry date
      const expiryTimestamp = form.expiresAt 
        ? [BigInt(new Date(form.expiresAt).getTime() * 1000000)]
        : [];

      const result = await platformCanisterService.sendNotification(
        severityVariant,
        categoryVariant,
        audience,
        form.title,
        form.message,
        form.icon,
        metadataMap,
        actionVariants,
        expiryTimestamp,
        form.isPinned
      );
      
      console.log('📨 [AdminNotificationSender] Notification result:', result);

      if ('ok' in result) {
        setSuccess(`✅ Notification sent successfully! ID: ${result.ok}`);
        // Reset form
        setForm({
          severity: 'Medium',
          category: 'Announcement',
          audienceType: 'All',
          audienceValue: '',
          title: '',
          message: '',
          icon: '📢',
          metadata: [],
          actions: [],
          expiresAt: '',
          isPinned: false
        });
      } else {
        setError(`Failed to send notification: ${'err' in result ? result.err : 'Unknown error'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '1rem',
    borderRadius: '12px',
    border: '2px solid rgba(255, 107, 53, 0.3)',
    background: 'rgba(26, 26, 26, 0.8)',
    color: '#ffffff',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
    outline: 'none'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '1rem',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: '0.75rem',
    fontWeight: '700'
  };

  return (
    <div style={{
      background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.08) 0%, transparent 50%), linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 100%)',
      border: '2px solid rgba(255, 107, 53, 0.3)',
      borderRadius: '24px',
      padding: '3rem',
      maxWidth: '900px',
      margin: '0 auto',
      boxShadow: '0 20px 60px rgba(255, 107, 53, 0.3)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Top tri-color gradient bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: 'linear-gradient(90deg, #ff6b35, #10b981, #a855f7)',
      }}></div>

      {/* Header */}
      <div style={{
        marginBottom: '2.5rem',
        paddingBottom: '1.5rem',
        borderBottom: '2px solid rgba(255, 107, 53, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
            borderRadius: '12px',
            padding: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(255, 107, 53, 0.3)'
          }}>
            <Bell size={28} color="#ffffff" />
          </div>
          <div>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ff6b35, #10b981, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              marginBottom: '0.25rem'
            }}>
              Send Platform Notification
            </h2>
            <p style={{ 
              color: 'rgba(255, 255, 255, 0.6)', 
              margin: 0,
              fontSize: '0.95rem'
            }}>
              Broadcast important messages to your users
            </p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#ef4444',
          fontSize: '0.9rem'
        }}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#10b981',
          fontSize: '0.9rem'
        }}>
          {success}
        </div>
      )}

      {/* Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>Severity</label>
          <select
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value as NotificationSeverity })}
            style={inputStyle}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as NotificationCategory })}
            style={inputStyle}
          >
            <option value="Announcement">Announcement</option>
            <option value="System">System</option>
            <option value="Account">Account</option>
            <option value="Credits">Credits</option>
            <option value="Subscription">Subscription</option>
            <option value="Deployment">Deployment</option>
            <option value="Security">Security</option>
            <option value="Feature">Feature</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Icon</label>
          <input
            type="text"
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            placeholder="📢"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Target Audience */}
      <div style={{
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Users size={20} color="#8b5cf6" />
          <h3 style={{ color: '#8b5cf6', fontSize: '1rem', margin: 0 }}>Target Audience</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Audience Type</label>
            <select
              value={form.audienceType}
              onChange={(e) => setForm({ ...form, audienceType: e.target.value as AudienceType, audienceValue: '' })}
              style={inputStyle}
            >
              <option value="All">All Users</option>
              <option value="SpecificUsers">Specific Users</option>
              <option value="SubscriptionTier">Subscription Tier</option>
              <option value="NewUsers">New Users</option>
              <option value="ActiveUsers">Active Users</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              {form.audienceType === 'SpecificUsers' && 'Principal IDs (comma-separated)'}
              {form.audienceType === 'SubscriptionTier' && 'Tier (free/starter/developer/pro)'}
              {form.audienceType === 'NewUsers' && 'Days since signup'}
              {form.audienceType === 'ActiveUsers' && 'Days of activity'}
              {form.audienceType === 'All' && 'N/A'}
            </label>
            <input
              type="text"
              value={form.audienceValue}
              onChange={(e) => setForm({ ...form, audienceValue: e.target.value })}
              placeholder={
                form.audienceType === 'SpecificUsers' ? 'xxxxx-xxxxx-cai, yyyyy-yyyyy-cai' :
                form.audienceType === 'SubscriptionTier' ? 'free' :
                form.audienceType === 'NewUsers' ? '7' :
                form.audienceType === 'ActiveUsers' ? '30' :
                'N/A'
              }
              disabled={form.audienceType === 'All'}
              style={{...inputStyle, opacity: form.audienceType === 'All' ? 0.5 : 1}}
            />
          </div>
        </div>
      </div>

      <label style={labelStyle}>Notification Title</label>
      <input
        type="text"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="e.g., New Feature Released!"
        style={inputStyle}
      />

      <label style={labelStyle}>Message</label>
      <textarea
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        placeholder="Detailed notification message..."
        rows={4}
        style={{...inputStyle, resize: 'vertical'}}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', marginBottom: '1.5rem', alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>Expires At (optional)</label>
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            id="isPinned"
            checked={form.isPinned}
            onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="isPinned" style={{ color: 'rgba(255, 255, 255, 0.8)', cursor: 'pointer', fontSize: '0.9rem' }}>
            Pin notification
          </label>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSendNotification}
        disabled={loading}
        style={{
          width: '100%',
          padding: '1.25rem',
          borderRadius: '12px',
          background: loading 
            ? 'rgba(255, 107, 53, 0.3)' 
            : 'linear-gradient(135deg, #ff6b35, #f59e0b)',
          color: '#ffffff',
          border: '2px solid rgba(255, 107, 53, 0.5)',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 700,
          fontSize: '1.1rem',
          opacity: loading ? 0.6 : 1,
          boxShadow: loading ? 'none' : '0 8px 24px rgba(255, 107, 53, 0.4)',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 36px rgba(255, 107, 53, 0.6)';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 107, 53, 0.4)';
          }
        }}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '18px', 
              height: '18px', 
              border: '3px solid rgba(255,255,255,0.3)', 
              borderTopColor: '#fff', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite' 
            }}></div>
            Sending Notification...
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Send size={20} />
            📤 Send Notification
          </span>
        )}
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
