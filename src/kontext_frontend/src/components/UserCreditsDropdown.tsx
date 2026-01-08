import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCredits, useAuth, useAppStore } from '../store/appStore';
import { CreditsService } from '../services/CreditsService';
import { subscriptionService } from '../services/SubscriptionService';
import { SubscriptionTier } from '../types';

interface UserCreditsDropdownProps {
  isMobile: boolean;
  isStreamingActive: boolean;
  onAddCredits: () => void;
  onProfile: () => void;
  onBilling: () => void;
  onCloseApp: () => void;
  unreadNotificationCount?: number;
  onOpenNotifications?: () => void;
}

interface DisplayState {
  credits: number;
  isRefreshing: boolean;
  lastUpdated: number;
  error: string | null;
}

interface TierDisplayInfo {
  icon: string;
  name: string;
}

export const UserCreditsDropdown: React.FC<UserCreditsDropdownProps> = ({
  isMobile,
  isStreamingActive,
  onAddCredits,
  onProfile,
  onBilling,
  onCloseApp,
  unreadNotificationCount = 0,
  onOpenNotifications
}) => {
  const { credits } = useCredits();
  const { principal } = useAuth();
  const subscription = useAppStore(state => state.subscription);
  
  // Simplified display state - mirrors what CreditsService provides
  const [displayState, setDisplayState] = useState<DisplayState>({
    credits: 0,
    isRefreshing: false,
    lastUpdated: 0,
    error: null
  });

  // 🔥 FIX: State for async-loaded tier display info
  const [tierDisplayInfo, setTierDisplayInfo] = useState<TierDisplayInfo>({
    icon: '📦',
    name: subscription.currentTier || 'Free'
  });

  // 🔥 FIX: Dialog state moved to ChatHeader level - no longer needed here

  // Track the last known units balance to detect changes
  const lastUnitsRef = useRef<number>(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();

  // 🔥 FIX: Load tier display info when subscription tier changes
  useEffect(() => {
    const loadTierInfo = async () => {
      if (!subscription.currentTier || subscription.currentTier === SubscriptionTier.FREE) {
        setTierDisplayInfo({
          icon: '📦',
          name: 'Free'
        });
        return;
      }

      try {
        const [icon, name] = await Promise.all([
          subscriptionService.getTierIcon(subscription.currentTier),
          subscriptionService.getTierDisplayName(subscription.currentTier)
        ]);
        setTierDisplayInfo({ icon, name });
      } catch (error) {
        console.error('❌ [UserCreditsDropdown] Error loading tier info:', error);
        // Fallback to basic values
        setTierDisplayInfo({
          icon: '📦',
          name: subscription.currentTier
        });
      }
    };

    loadTierInfo();
  }, [subscription.currentTier]);

  // Force refresh function - bypasses all caching and protection
  // 🚨 STREAMING-SAFE: Can be called during streaming but will respect streaming state in auto-refresh
  const forceRefresh = async () => {
    if (displayState.isRefreshing) return;

    try {
      setDisplayState(prev => ({
        ...prev,
        isRefreshing: true,
        error: null
      }));

      console.log('🔄 [UserCreditsDropdown] Force refreshing credits display...');

      // Use the exact same logic as the store - fetch fresh balance from backend
      // Trigger fresh fetch from backend (same as hosting interface does)
      await useAppStore.getState().fetchCreditsBalance();
      
      // Get the fresh store data
      const freshCredits = useAppStore.getState().credits;
      const freshUnits = freshCredits.unitsBalance || freshCredits.units || 0;
      
      console.log('✅ [UserCreditsDropdown] Fresh credits from store:', {
        balance: freshCredits.balance,
        unitsBalance: freshUnits
      });

      // 🔥 FIX: Calculate credits from units (same as external display) instead of using stored balance
      let calculatedCredits = freshCredits.balance;
      if (freshUnits > 0) {
        try {
          const conversionUtils = CreditsService.getConversionUtils();
          calculatedCredits = await conversionUtils.unitsToCredits(freshUnits);
          console.log('✅ [UserCreditsDropdown] Calculated credits from units:', {
            units: freshUnits,
            credits: calculatedCredits
          });
        } catch (error) {
          console.error('❌ [UserCreditsDropdown] Error calculating credits, using store balance:', error);
          calculatedCredits = freshCredits.balance;
        }
      }

      // Update display state with calculated credits
      setDisplayState({
        credits: calculatedCredits,
        isRefreshing: false,
        lastUpdated: Date.now(),
        error: null
      });

      // Update our tracking ref
      lastUnitsRef.current = freshUnits;

    } catch (error) {
      console.error('❌ [UserCreditsDropdown] Error during force refresh:', error);
      
      setDisplayState(prev => ({
        ...prev,
        isRefreshing: false,
        error: 'Failed to refresh balance'
      }));
    }
  };

  // Auto-refresh when units balance changes (same detection as before, but simpler response)
  useEffect(() => {
    const currentUnits = credits.unitsBalance || credits.units || 0;
    
    // Detect if units actually changed
    const unitsChanged = currentUnits !== lastUnitsRef.current;
    
    if (unitsChanged && currentUnits >= 0) {
      console.log('📊 [UserCreditsDropdown] Units balance changed, triggering refresh:', {
        oldUnits: lastUnitsRef.current,
        newUnits: currentUnits,
        isStreamingActive
      });

      // Clear any pending refresh
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      if (isStreamingActive) {
        // During streaming, delay the refresh but don't block it entirely
        refreshTimeoutRef.current = setTimeout(() => {
          forceRefresh();
        }, 2000); // 2 second delay during streaming
      } else {
        // Immediate refresh when not streaming
        forceRefresh();
      }
    }
  }, [credits.unitsBalance, credits.units, isStreamingActive]);

  // 🔥 FIX: Calculate credits from units like external display does, not just use stored balance
  // 🚨 STREAMING-SAFE: Respects isStreamingActive to prevent UI thrashing during code generation
  useEffect(() => {
    // Skip updates during streaming to prevent UI thrashing
    if (isStreamingActive) {
      return;
    }

    const updateDisplayFromUnits = async () => {
      const currentUnits = credits.unitsBalance || credits.units || 0;
      
      // Skip if no units or already refreshing
      if (currentUnits <= 0 || displayState.isRefreshing) {
        return;
      }

      // Only update if units actually changed (prevent unnecessary recalculations)
      if (currentUnits === lastUnitsRef.current && displayState.credits > 0) {
        return;
      }

      try {
        // Calculate credits from units using the same method as ChatHeader
        const conversionUtils = CreditsService.getConversionUtils();
        const calculatedCredits = await conversionUtils.unitsToCredits(currentUnits);
        
        console.log('🔄 [UserCreditsDropdown] Updating display from units:', {
          units: currentUnits,
          calculatedCredits,
          storedBalance: credits.balance
        });

        setDisplayState({
          credits: calculatedCredits,
          isRefreshing: false,
          lastUpdated: Date.now(),
          error: null
        });

        lastUnitsRef.current = currentUnits;
      } catch (error) {
        console.error('❌ [UserCreditsDropdown] Error calculating credits from units:', error);
        // Fallback to store balance if calculation fails
        if (credits.balance > 0) {
          setDisplayState({
            credits: credits.balance,
            isRefreshing: false,
            lastUpdated: Date.now(),
            error: null
          });
        }
      }
    };

    updateDisplayFromUnits();
  }, [credits.unitsBalance, credits.units, credits.balance, isStreamingActive]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    if (displayState.isRefreshing) return;
    
    console.log('🔄 [UserCreditsDropdown] Manual refresh triggered');
    await forceRefresh();
  };

  // Determine what to display - prioritize fresh calculated data, fallback to store
  const displayCredits = useMemo(() => {
    // If we have fresh calculated data, use it
    if (displayState.credits > 0 && displayState.lastUpdated > 0) {
      return displayState.credits;
    }
    
    // Otherwise fall back to store data
    return credits.balance || 0;
  }, [displayState.credits, displayState.lastUpdated, credits.balance]);


  // Format credits display using the same service as everything else
  const creditsDisplay = CreditsService.formatCreditsDisplay(displayCredits);
  const balanceStatus = CreditsService.getBalanceStatus(displayCredits);

  // Determine loading state - simplified
  const isLoadingDisplay = credits.isLoading || displayState.isRefreshing;

  return (
    <div style={{
      background: 'rgb(17, 17, 17)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '0.75rem',
      minWidth: isMobile ? '280px' : '320px',
      maxWidth: isMobile ? '90vw' : '400px',
      maxHeight: '600px', // 🔥 FIX: Restore full height so close button is visible without scrolling
      overflowY: 'auto', // Make scrollable if content exceeds max height
      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 107, 53, 0.1)',
      animation: 'fadeInScale 0.2s ease-out',
      isolation: 'isolate'
    }}>
      {/* Notifications Section */}
      {onOpenNotifications && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenNotifications();
          }}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: unreadNotificationCount > 0 
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(245, 158, 11, 0.15))'
              : 'rgba(255, 255, 255, 0.03)',
            border: unreadNotificationCount > 0 
              ? '1px solid rgba(239, 68, 68, 0.3)'
              : '1px solid var(--border-color)',
            borderRadius: '8px',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            marginBottom: '0.75rem',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = unreadNotificationCount > 0 
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(245, 158, 11, 0.25))'
              : 'rgba(255, 255, 255, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = unreadNotificationCount > 0 
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(245, 158, 11, 0.15))'
              : 'rgba(255, 255, 255, 0.03)';
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🔔</span>
            <span>Notifications</span>
          </span>
          {unreadNotificationCount > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: '10px',
              minWidth: '1.5rem',
              textAlign: 'center'
            }}>
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </div>
          )}
        </button>
      )}

      {/* Credits Balance Section */}
      <div style={{
        padding: '0.75rem',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '8px',
        marginBottom: '0.5rem',
        border: `1px solid ${balanceStatus.color}40`
      }}>
        <div style={{
          fontSize: isMobile ? '1.2rem' : '1.4rem',
          fontWeight: 700,
          color: balanceStatus.color,
          marginBottom: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem'
        }}>
          {isLoadingDisplay ? (
            <span style={{ fontSize: '0.9rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTop: '2px solid #ffffff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              {displayCredits > 0 ? creditsDisplay : 'Loading...'}
            </span>
          ) : (
            <span>{creditsDisplay}</span>
          )}
          
          <button
            onClick={handleManualRefresh}
            disabled={isLoadingDisplay}
            style={{
              background: 'none',
              border: 'none',
              color: isLoadingDisplay ? 'rgba(156, 163, 175, 0.5)' : 'var(--text-gray)',
              cursor: isLoadingDisplay ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              opacity: isLoadingDisplay ? 0.3 : 1,
              marginLeft: 'auto',
              padding: '0.25rem',
              transition: 'all 0.2s ease',
              borderRadius: '4px'
            }}
            title="Refresh balance"
            onMouseEnter={(e) => {
              if (!isLoadingDisplay) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoadingDisplay) {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--text-gray)';
              }
            }}
          >
            {isLoadingDisplay ? '⏳' : '🔄'}
          </button>
        </div>
        
        <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)' }}>
          {balanceStatus.message}
          {isStreamingActive && (
            <span style={{ 
              marginLeft: '0.5rem', 
              color: 'var(--accent-orange)',
              fontWeight: 600
            }}>
              • Generation Active (Updates Delayed)
            </span>
          )}
          {displayState.error && (
            <span style={{ 
              marginLeft: '0.5rem', 
              color: '#f59e0b',
              fontWeight: 500
            }}>
              • {displayState.error}
            </span>
          )}
        </div>

        {!isMobile && displayCredits > 0 && displayState.lastUpdated > 0 && (
          <div style={{ 
            fontSize: '0.7rem', 
            color: 'var(--text-gray)', 
            marginTop: '0.5rem',
            opacity: 0.8
          }}>
            <span style={{ opacity: 0.6 }}>
              Updated {Math.round((Date.now() - displayState.lastUpdated) / 1000)}s ago
            </span>
          </div>
        )}
      </div>

      {/* Subscription Tier Badge */}
      {subscription.currentTier && subscription.currentTier !== SubscriptionTier.FREE && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: subscription.isActive 
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15))'
            : 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.15))',
          border: subscription.isActive
            ? '1px solid rgba(16, 185, 129, 0.3)'
            : '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>
              {tierDisplayInfo.icon}
            </span>
            <div>
              <div style={{ 
                fontSize: '0.8rem', 
                fontWeight: 600,
                color: subscription.isActive ? '#10b981' : '#fbbf24'
              }}>
                {tierDisplayInfo.name}
              </div>
              {subscription.monthlyCredits > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  {subscription.monthlyCredits.toLocaleString()} credits/mo
                </div>
              )}
            </div>
          </div>
          {subscription.isActive && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '0.25rem 0.5rem',
              borderRadius: '4px'
            }}>
              ✓ Active
            </div>
          )}
        </div>
      )}

      {/* Menu Options */}
      <div style={{ marginTop: '0.75rem' }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('💳 [UserCreditsDropdown] Add Credits button clicked');
            // 🔥 FIX: Call parent callback which will open dialog and close dropdown
            onAddCredits();
          }}
          onTouchEnd={(e) => {
            // Prevent click event from firing on mobile after touch
            e.preventDefault();
            e.stopPropagation();
            console.log('💳 [UserCreditsDropdown] Add Credits button touched');
            // 🔥 FIX: Call parent callback which will open dialog and close dropdown
            onAddCredits();
          }}
          disabled={isStreamingActive}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: isStreamingActive 
              ? 'rgba(16, 185, 129, 0.1)' 
              : 'linear-gradient(135deg, var(--accent-green), #059669)',
            border: 'none',
            borderRadius: '8px',
            color: isStreamingActive ? 'rgba(255, 255, 255, 0.5)' : '#ffffff',
            cursor: isStreamingActive ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            opacity: isStreamingActive ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          💳 {isStreamingActive ? 'Add Credits (After Generation)' : 'Add Credits'}
        </button>

        {/* Quick Access: Edit Profile */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('✏️ [UserCreditsDropdown] Edit Profile button clicked');
            // Open profile interface directly to Account tab
            onProfile();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('✏️ [UserCreditsDropdown] Edit Profile button touched');
            onProfile();
          }}
          disabled={isStreamingActive}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: isStreamingActive 
              ? 'rgba(139, 92, 246, 0.1)' 
              : 'rgba(139, 92, 246, 0.15)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            color: isStreamingActive ? 'rgba(255, 255, 255, 0.5)' : '#a78bfa',
            cursor: isStreamingActive ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            marginBottom: '0.5rem',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            opacity: isStreamingActive ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          ✏️ Edit Profile
        </button>

        {/* Billing & Subscription Management */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('💳 [UserCreditsDropdown] Billing button clicked');
            // 🔥 FIX: Call parent callback which will open subscription selection
            onBilling();
          }}
          onTouchEnd={(e) => {
            // Prevent click event from firing on mobile after touch
            e.preventDefault();
            e.stopPropagation();
            console.log('💳 [UserCreditsDropdown] Billing button touched');
            // 🔥 FIX: Call parent callback which will open subscription selection
            onBilling();
          }}
          disabled={isStreamingActive}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: isStreamingActive 
              ? 'rgba(255, 255, 255, 0.03)' 
              : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: isStreamingActive ? 'rgba(255, 255, 255, 0.5)' : '#ffffff',
            cursor: isStreamingActive ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            marginBottom: '0.5rem',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            opacity: isStreamingActive ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isStreamingActive) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          💰 Billing
        </button>

        <button
          onClick={onCloseApp}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          🚪 Close App
        </button>
      </div>

      {/* 🔥 FIX: Dialogs moved to ChatHeader level - no longer rendered here */}

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
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};