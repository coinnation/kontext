import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ProjectTabs } from './ProjectTabs';
import { PortalDropdown } from './PortalDropdown';
import { UserCreditsDropdown } from './UserCreditsDropdown';
import { TopUpCreditsDialog } from './TopUpCreditsDialog';
import { ProfileSettingsDialog } from './ProfileSettingsDialog';
import { ConsolidatedVersionManager } from './ConsolidatedVersionManager';
import { NotificationCenter } from './NotificationCenter';
import { useCredits, useAuth, useUI, useFiles, useAppStore, useSubscription } from '../store/appStore';
import { CreditsService } from '../services/CreditsService';
import { notificationService } from '../services/NotificationService';

interface ChatHeaderProps {
    currentProjectTitle: string;
    currentProjectIcon: string;
    isGenerating: boolean;
    isMobile: boolean;
    onToggleSidebar: () => void;
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
    onCloseApp?: () => void;
    projectId?: string | null;
    selectedVersion?: string | null;
    onVersionChange?: (versionId: string | null) => void;
}

// 🔒 STABLE BUTTON DISPLAY STATE
interface StableButtonDisplay {
  creditsDisplay: string;
  balanceColor: string;
  isLoading: boolean;
  lastUpdated: number;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    currentProjectTitle,
    currentProjectIcon,
    isGenerating,
    isMobile,
    onToggleSidebar,
    activeTab,
    onTabChange,
    onCloseApp,
    projectId,
    selectedVersion,
    onVersionChange
}) => {
    const { credits } = useCredits();
    const { principal } = useAuth();
    const { ui, toggleUserDropdown, closeUserDropdown } = useUI();
    const { showSubscriptionSelection } = useSubscription();
    const { tabGroups } = useFiles();
    
    const userButtonRef = useRef<HTMLButtonElement>(null);

    // 🚨 ULTRA-STABLE STREAMING DETECTION - NO DEPENDENCY ON TABGROUPS ARRAY
    const [isStreamingActiveStable, setIsStreamingActiveStable] = useState(false);
    const streamingCheckTimeoutRef = useRef<NodeJS.Timeout>();
    
    
    // 🔒 STABLE BUTTON DISPLAY STATE
    const [stableButtonDisplay, setStableButtonDisplay] = useState<StableButtonDisplay>({
        creditsDisplay: '...',
        balanceColor: '#6b7280',
        isLoading: true,
        lastUpdated: 0
    });
    
    // 🔥 FIX: Dialog state at ChatHeader level so dialogs persist after dropdown closes
    const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
    
    // Notification state
    const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const identity = useAppStore(state => state.identity);

    // 🔒 STABLE CALLBACKS - NEVER RECREATED
    const stableCallbacks = useRef({
        handleAddCredits: () => {
            // 🔥 FIX: Open dialog and close dropdown
            console.log('💳 [ChatHeader] Add Credits callback called - opening dialog');
            setIsTopUpDialogOpen(true);
            closeUserDropdown();
        },
        handleProfile: () => {
            // 🔥 FIX: Open dialog and close dropdown
            console.log('👤 [ChatHeader] Profile callback called - opening dialog');
            setIsProfileDialogOpen(true);
            closeUserDropdown();
        },
        handleBilling: () => {
            // 🔥 NEW: Open subscription selection and close dropdown
            console.log('💰 [ChatHeader] Billing callback called - opening subscription selection');
            closeUserDropdown();
            if (showSubscriptionSelection) {
                showSubscriptionSelection();
            }
        },
        handleCloseApp: () => {
            closeUserDropdown();
            if (onCloseApp) {
                onCloseApp();
            }
        }
    });

    // Update stable callbacks only when dependencies actually change
    useEffect(() => {
        stableCallbacks.current.handleAddCredits = () => {
            setIsTopUpDialogOpen(true);
            closeUserDropdown();
        };
        stableCallbacks.current.handleProfile = () => {
            setIsProfileDialogOpen(true);
            closeUserDropdown();
        };
        stableCallbacks.current.handleBilling = () => {
            closeUserDropdown();
            if (showSubscriptionSelection) {
                showSubscriptionSelection();
            }
        };
        stableCallbacks.current.handleCloseApp = () => {
            closeUserDropdown();
            if (onCloseApp) {
                onCloseApp();
            }
        };
    }, [closeUserDropdown, onCloseApp, showSubscriptionSelection]);

    // 🚨 STREAMING DETECTION SYSTEM - ISOLATED FROM TABGROUPS CHANGES
    useEffect(() => {
        try {
            const hasWritingFiles = tabGroups.some(group => 
                group.files.some(file => file.isWriting && !file.isComplete)
            );
            
            // Clear existing timeout
            if (streamingCheckTimeoutRef.current) {
                clearTimeout(streamingCheckTimeoutRef.current);
            }

            if (hasWritingFiles && !isStreamingActiveStable) {
                // Start streaming - immediate update
                setIsStreamingActiveStable(true);
            } else if (!hasWritingFiles && isStreamingActiveStable) {
                // Stop streaming - debounced update
                streamingCheckTimeoutRef.current = setTimeout(() => {
                    setIsStreamingActiveStable(false);
                }, 1000); // Wait 1 second after streaming stops before unfreezing
            }
        } catch (e) {
            console.error('Error in streaming detection:', e);
        }

        return () => {
            if (streamingCheckTimeoutRef.current) {
                clearTimeout(streamingCheckTimeoutRef.current);
            }
        };
    }, [tabGroups.length, isStreamingActiveStable]); // Only depend on length to minimize updates

    // 🔄 STABLE BUTTON DISPLAY UPDATE - CALCULATE CREDITS FROM UNITS
    useEffect(() => {
        // Skip updates during streaming to prevent UI thrashing
        if (isStreamingActiveStable) {
            return;
        }

        const updateButtonDisplay = async () => {
            try {
                const currentUnits = credits.unitsBalance || credits.units || 0;
                
                // Show loading state while calculating
                if (credits.isLoading) {
                    setStableButtonDisplay(prev => ({
                        ...prev,
                        isLoading: true
                    }));
                    return;
                }

                let displayCredits = 0;
                let balanceColor = '#6b7280';

                if (currentUnits > 0) {
                    try {
                        // Calculate credits from units using CreditsService
                        const conversionUtils = CreditsService.getConversionUtils();
                        displayCredits = await conversionUtils.unitsToCredits(currentUnits);
                        
                        console.log('💰 [ChatHeader] Calculated credits from units:', {
                            units: currentUnits,
                            credits: displayCredits
                        });
                    } catch (error) {
                        console.error('❌ [ChatHeader] Error calculating credits from units:', error);
                        // Fallback to store credits or rough estimate
                        displayCredits = Math.max(credits.balance, Math.floor(currentUnits / 10));
                    }
                } else {
                    // No units, try to use store credits as fallback
                    displayCredits = credits.balance || 0;
                }

                // Get balance status for color
                const balanceStatus = CreditsService.getBalanceStatus(displayCredits);
                balanceColor = balanceStatus.color;

                // Format display
                const creditsDisplay = CreditsService.formatCreditsDisplay(displayCredits);

                setStableButtonDisplay({
                    creditsDisplay,
                    balanceColor,
                    isLoading: false,
                    lastUpdated: Date.now()
                });

            } catch (error) {
                console.error('❌ [ChatHeader] Error updating button display:', error);
                
                // Fallback to basic display
                setStableButtonDisplay({
                    creditsDisplay: credits.balance > 0 ? CreditsService.formatCreditsDisplay(credits.balance) : '0',
                    balanceColor: '#ef4444',
                    isLoading: false,
                    lastUpdated: Date.now()
                });
            }
        };

        updateButtonDisplay();
    }, [credits.unitsBalance, credits.units, credits.balance, credits.isLoading, isStreamingActiveStable]);

    // Initialize notification service and start polling
    useEffect(() => {
        if (identity) {
            notificationService.initialize(identity)
                .then(() => {
                    // Start polling every 30 seconds
                    notificationService.startPolling(30000);
                    
                    // Subscribe to unread count updates
                    const unsubscribe = notificationService.onUnreadCount((count) => {
                        setUnreadNotificationCount(count);
                    });
                    
                    console.log('✅ [ChatHeader] Notification service initialized');
                    
                    return () => {
                        unsubscribe();
                        notificationService.stopPolling();
                    };
                })
                .catch((error) => {
                    console.error('❌ [ChatHeader] Failed to initialize notification service:', error);
                });
        }
    }, [identity]);

    if (isMobile) {
        return (
            <>
                {/* Title Bar - Project Info - IMPROVED MOBILE LAYOUT */}
                <div style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    position: 'relative',
                    zIndex: 100,
                    flexShrink: 0
                }}>
                    {/* Hamburger Menu Button */}
                    <button
                        onClick={onToggleSidebar}
                        style={{
                            background: 'rgba(255, 107, 53, 0.2)',
                            border: '1px solid rgba(255, 107, 53, 0.3)',
                            borderRadius: '8px',
                            color: '#fff',
                            width: '32px',
                            height: '32px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                            fontSize: '0.9rem'
                        }}
                    >
                        ☰
                    </button>

                    {/* Project Info Container - IMPROVED WIDTH CONSTRAINTS */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        minWidth: 0, // Critical for flex item to shrink below content size
                        maxWidth: 'calc(100vw - 140px)', // Account for buttons on both sides (32px + 80px + gaps + padding)
                        marginLeft: '0.5rem',
                        marginRight: '0.5rem'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            minWidth: 0, // Critical for nested flex to allow shrinking
                            maxWidth: '100%'
                        }}>
                            {/* Project Icon */}
                            <div style={{
                                width: '28px',
                                height: '28px',
                                background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.2rem',
                                flexShrink: 0 // Icon should never shrink
                            }}>
                                {currentProjectIcon}
                            </div>
                            
                            {/* Project Title - CONSTRAINED WIDTH WITH ELLIPSIS */}
                            <div style={{
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                color: '#ffffff',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minWidth: 0, // Allow text to shrink
                                maxWidth: '100%', // Don't exceed container
                                textAlign: 'center'
                            }}>
                                {currentProjectTitle}
                            </div>
                        </div>
                    </div>


                    {/* User Dropdown Button - FIXED WIDTH */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                            ref={userButtonRef}
                            onClick={toggleUserDropdown}
                            style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                padding: '0.4rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                color: '#ffffff',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                fontSize: '0.8rem',
                                minWidth: '80px', // Fixed minimum width to prevent layout shifts
                                justifyContent: 'center',
                                position: 'relative'
                            }}
                        >
                            {/* Notification Badge - Mobile */}
                            {unreadNotificationCount > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '-0.2rem',
                                    right: '-0.2rem',
                                    background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
                                    color: '#fff',
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    padding: '0.1rem 0.3rem',
                                    borderRadius: '10px',
                                    minWidth: '1rem',
                                    textAlign: 'center',
                                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                                    zIndex: 1
                                }}>
                                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                                </div>
                            )}
                            
                            <div style={{
                                width: '24px',
                                height: '24px',
                                background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                flexShrink: 0
                            }}>
                                {principal?.toString().slice(0, 2).toUpperCase() || 'U'}
                            </div>
                            <div style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: stableButtonDisplay.balanceColor,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0
                            }}>
                                {stableButtonDisplay.isLoading ? '...' : stableButtonDisplay.creditsDisplay}
                            </div>
                        </button>

                        <PortalDropdown
                            isOpen={ui.userDropdownOpen}
                            onClose={closeUserDropdown}
                            triggerRef={userButtonRef}
                            placement="bottom-right"
                            offset={{ x: -8, y: 8 }}
                            backdrop={true}
                            zIndex={10000}
                        >
                            <UserCreditsDropdown
                                isMobile={isMobile}
                                isStreamingActive={isStreamingActiveStable}
                                onAddCredits={stableCallbacks.current.handleAddCredits}
                                onProfile={stableCallbacks.current.handleProfile}
                                onBilling={stableCallbacks.current.handleBilling}
                                onCloseApp={stableCallbacks.current.handleCloseApp}
                                unreadNotificationCount={unreadNotificationCount}
                                onOpenNotifications={() => {
                                    console.log('🔔 [ChatHeader] Opening notifications from dropdown...');
                                    closeUserDropdown();
                                    // Delay opening notification center to allow dropdown to close
                                    setTimeout(() => {
                                        setIsNotificationCenterOpen(true);
                                    }, 50);
                                }}
                            />
                        </PortalDropdown>
                    </div>
                </div>

                {/* Notification Center - Portal rendered */}
                <NotificationCenter
                    isOpen={isNotificationCenterOpen}
                    onClose={() => setIsNotificationCenterOpen(false)}
                    anchorRef={userButtonRef}
                />

                {/* Navigation Bar - Tabs */}
                {currentProjectTitle !== 'No Project Selected' && (
                    <div style={{
                        padding: '0.35rem 0.75rem',
                        background: '#0a0a0a',
                        borderTop: '1px solid var(--border-color)',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'center',
                        overflowX: 'auto',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        flexShrink: 0
                    }}>
                        <ProjectTabs 
                            activeTab={activeTab}
                            onTabChange={onTabChange}
                            isMobile={true}
                        />
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            {/* Title Bar - Project Info & User */}
            <div style={{
                padding: '1rem 2rem',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                zIndex: 100,
                flexShrink: 0,
                gap: '1.5rem'
            }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem',
                    minWidth: 0,
                    flex: '1 1 auto'
                }}>
                    <div style={{
                        width: '46px',
                        height: '46px',
                        background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-green))',
                        borderRadius: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        flexShrink: 0
                    }}>
                        {currentProjectIcon}
                    </div>
                    
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h2 style={{
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {currentProjectTitle}
                        </h2>
                        <div style={{
                            fontSize: '0.9rem',
                            color: isGenerating ? 'var(--accent-orange)' : 'var(--accent-green)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                background: isGenerating ? 'var(--accent-orange)' : 'var(--accent-green)',
                                borderRadius: '50%',
                                animation: 'pulse 1.5s infinite'
                            }} />
                            {isGenerating ? 'AI Generating Project...' : 'AI Assistant Active'}
                        </div>
                    </div>

                    {/* Version Manager - Only show when project is selected */}
                    {projectId && currentProjectTitle !== 'No Project Selected' && (
                        <div style={{ 
                            marginLeft: 'auto',
                            flexShrink: 0
                        }}>
                            <ConsolidatedVersionManager
                                projectId={projectId}
                                selectedVersion={selectedVersion || null}
                                onVersionChange={onVersionChange || (() => {})}
                            />
                        </div>
                    )}
                </div>
                
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                        ref={userButtonRef}
                        onClick={toggleUserDropdown}
                        style={{
                            background: ui.userDropdownOpen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '12px',
                            padding: '0.4rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            color: '#10b981',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            minWidth: '160px',
                            position: 'relative',
                            backdropFilter: 'blur(10px)',
                            boxShadow: ui.userDropdownOpen ? '0 4px 12px rgba(16, 185, 129, 0.25)' : '0 2px 8px rgba(16, 185, 129, 0.15)',
                        }}
                        onMouseEnter={(e) => {
                            if (!ui.userDropdownOpen) {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.3)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!ui.userDropdownOpen) {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.15)';
                            }
                        }}
                    >
                        {/* Notification Badge */}
                        {unreadNotificationCount > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '0.25rem',
                                right: '0.25rem',
                                background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
                                color: '#fff',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.35rem',
                                borderRadius: '10px',
                                minWidth: '1.1rem',
                                textAlign: 'center',
                                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                                zIndex: 1
                            }}>
                                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                            </div>
                        )}
                        
                        <div style={{
                            width: '28px', // ✅ REDUCED: Smaller avatar
                            height: '28px', // ✅ REDUCED: Smaller avatar
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem', // ✅ REDUCED: Smaller font for avatar
                            fontWeight: 700,
                            color: '#ffffff',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                        }}>
                            {principal?.toString().slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem' }}>
                            <div style={{
                                fontSize: '0.85rem', // ✅ REDUCED: Smaller font size
                                fontWeight: 700,
                                color: '#10b981',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem', // ✅ REDUCED: Smaller gap
                                lineHeight: 1.2 // ✅ ADDED: Tighter line height
                            }}>
                                <span style={{ fontSize: '0.75rem' }}>💰</span> {/* ✅ REDUCED: Smaller icon */}
                                {stableButtonDisplay.isLoading ? '...' : stableButtonDisplay.creditsDisplay}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(16, 185, 129, 0.7)', opacity: 0.9, lineHeight: 1 }}> {/* ✅ REDUCED: Smaller font */}
                                {isStreamingActiveStable ? 'Generating...' : 'Credits'}
                            </div>
                        </div>
                        
                        <div style={{
                            fontSize: '0.7rem', // ✅ REDUCED: Smaller arrow
                            color: '#10b981',
                            transform: ui.userDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease'
                        }}>
                            ▼
                        </div>
                    </button>

                    <PortalDropdown
                        isOpen={ui.userDropdownOpen}
                        onClose={closeUserDropdown}
                        triggerRef={userButtonRef}
                        placement="bottom-right"
                        offset={{ x: 0, y: 8 }}
                        zIndex={10000}
                    >
                        <UserCreditsDropdown
                            isMobile={isMobile}
                            isStreamingActive={isStreamingActiveStable}
                            onAddCredits={stableCallbacks.current.handleAddCredits}
                            onProfile={stableCallbacks.current.handleProfile}
                            onBilling={stableCallbacks.current.handleBilling}
                            onCloseApp={stableCallbacks.current.handleCloseApp}
                            unreadNotificationCount={unreadNotificationCount}
                            onOpenNotifications={() => {
                                console.log('🔔 [ChatHeader] Opening notifications from dropdown (mobile)...');
                                closeUserDropdown();
                                // Delay opening notification center to allow dropdown to close
                                setTimeout(() => {
                                    setIsNotificationCenterOpen(true);
                                }, 50);
                            }}
                        />
                    </PortalDropdown>
                </div>

                <style>{`
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                    }
                `}</style>
            </div>

            {/* Navigation Bar - Tabs (only show when project is selected) */}
            {currentProjectTitle !== 'No Project Selected' && (
                <div style={{
                    padding: '0 2rem',
                    background: '#0a0a0a',
                    borderBottom: '2px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <ProjectTabs 
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                        isMobile={false}
                    />
                </div>
            )}
            
            {/* 🔥 FIX: Dialogs rendered at ChatHeader level so they persist after dropdown closes */}
            <TopUpCreditsDialog
                isOpen={isTopUpDialogOpen}
                onClose={() => {
                    console.log('💳 [ChatHeader] TopUpCreditsDialog closing');
                    setIsTopUpDialogOpen(false);
                }}
                onSuccess={() => {
                    // 🔥 FIX: Force refresh of credits balance after payment
                    // The store will update, and UserCreditsDropdown will recalculate from units
                    setTimeout(() => {
                        const store = useAppStore.getState();
                        if (store.fetchCreditsBalance) {
                            store.fetchCreditsBalance();
                        }
                    }, 1000);
                }}
            />

            <ProfileSettingsDialog
                isOpen={isProfileDialogOpen}
                onClose={() => {
                    console.log('👤 [ChatHeader] ProfileSettingsDialog closing');
                    setIsProfileDialogOpen(false);
                }}
            />
        </>
    );
};