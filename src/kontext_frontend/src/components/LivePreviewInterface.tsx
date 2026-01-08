import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { elementSelectionService } from '../services/ElementSelectionService';
import { PropertyEditor } from './PropertyEditor';

interface ServerPair {
  pairId: string;
  name: string;
  frontendCanisterId: string;
  backendCanisterId: string;
  createdAt: number;
  creditsAllocated: number;
}

interface LivePreviewInterfaceProps {
  projectId?: string;
  projectName?: string;
  selectedServerPair?: ServerPair; // NEW: Accept server pair from parent
}

// Mobile responsiveness helper
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile, isTablet };
};

// Helper to generate URLs for canisters
const generateCanisterUrls = (canisterId: string, isLocal: boolean) => {
  if (isLocal) {
    return {
      siteUrl: `http://${canisterId}.localhost:4943`,
      candidUrl: `http://127.0.0.1:4943/?canisterId=${canisterId}`,
    };
  } else {
    return {
      siteUrl: `https://${canisterId}.icp0.io`,
      candidUrl: `https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=${canisterId}`,
    };
  }
};

// Check if a canister has content deployed
const checkCanisterContent = async (canisterId: string): Promise<{
  hasContent: boolean;
  contentType?: string;
  title?: string;
  error?: string;
}> => {
  try {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const urls = generateCanisterUrls(canisterId, isLocal);
    
    // Try to fetch the site
    const response = await fetch(urls.siteUrl, {
      method: 'HEAD',
      mode: 'cors'
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      return {
        hasContent: true,
        contentType: contentType || undefined
      };
    } else {
      return {
        hasContent: false,
        error: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    // Try a full fetch as fallback
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const urls = generateCanisterUrls(canisterId, isLocal);
      
      const response = await fetch(urls.siteUrl, {
        method: 'GET',
        mode: 'cors'
      });

      if (response.ok) {
        const text = await response.text();
        // Check if it's HTML content with actual content
        const hasHtmlContent = text.includes('<html>') || text.includes('<body>') || text.length > 100;
        
        // Try to extract title
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : undefined;
        
        return {
          hasContent: hasHtmlContent,
          contentType: 'text/html',
          title: title
        };
      } else {
        return {
          hasContent: false,
          error: `HTTP ${response.status}`
        };
      }
    } catch (fallbackError) {
      return {
        hasContent: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
};

export const LivePreviewInterface: React.FC<LivePreviewInterfaceProps> = ({
  projectId,
  projectName,
  selectedServerPair // NEW: Receive from parent
}) => {
  const { isMobile, isTablet } = useIsMobile();
  
  const { 
    activeProject, 
    projects,
    // NEW: Import deployment coordination actions
    handleLivePreviewActivation,
    ensureChatAlwaysEnabled,
    cleanupStuckDeployments,
    // 🔧 FIX: Import server pair coordination to handle missing prop
    getProjectServerPair,
    projectServerPairs
  } = useAppStore(state => ({
    activeProject: state.activeProject,
    projects: state.projects,
    handleLivePreviewActivation: state.handleLivePreviewActivation,
    ensureChatAlwaysEnabled: state.ensureChatAlwaysEnabled,
    cleanupStuckDeployments: state.cleanupStuckDeployments,
    getProjectServerPair: state.getProjectServerPair,
    projectServerPairs: state.projectServerPairs
  }));

  // FIXED: Set default preview mode based on device type
  const getDefaultPreviewMode = () => {
    if (isMobile) return 'mobile';
    if (isTablet) return 'tablet';
    return 'desktop';
  };

  const [isCheckingContent, setIsCheckingContent] = useState(false);
  const [contentStatus, setContentStatus] = useState<{
    hasContent: boolean;
    contentType?: string;
    title?: string;
    error?: string;
  } | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>(getDefaultPreviewMode());
  const [livePreviewActivated, setLivePreviewActivated] = useState(false); // NEW: Track activation state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // 🔥 NEW: Hot reload preview URL
  const [isSelectionMode, setIsSelectionMode] = useState(false); // 🔥 NEW: Visual editing mode
  const [showPropertyEditor, setShowPropertyEditor] = useState(false); // 🔥 NEW: Show property editor
  const iframeRef = useRef<HTMLIFrameElement | null>(null); // 🔥 NEW: Reference to iframe

  const currentProjectId = projectId || activeProject;
  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentProjectName = projectName || currentProject?.name || 'Current Project';

  // Check if running locally
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // 🔥 SINGLE SOURCE OF TRUTH: Always use coordinated server pair from parent (ProjectControls dropdown)
  const effectiveServerPair = selectedServerPair;

  // 🔥 NEW: Check for hot reload preview URL
  useEffect(() => {
    if (currentProjectId) {
      const checkPreviewUrl = async () => {
        try {
          const { hotReloadService } = await import('../services/HotReloadService');
          const url = hotReloadService.getPreviewUrl(currentProjectId);
          setPreviewUrl(url);
        } catch (error) {
          console.error('[LivePreview] Failed to check preview URL:', error);
          setPreviewUrl(null);
        }
      };
      
      checkPreviewUrl();
      
      // Check periodically for preview URL updates
      const interval = setInterval(checkPreviewUrl, 2000);
      return () => clearInterval(interval);
    } else {
      setPreviewUrl(null);
    }
  }, [currentProjectId]);

  // 🔥 NEW: Initialize element selection when iframe loads
  useEffect(() => {
    if (iframeRef.current && (previewUrl || effectiveServerPair)) {
      elementSelectionService.initialize(iframeRef.current);
      
      // Listen for element selection
      const unsubscribe = elementSelectionService.onSelectionChange((element) => {
        if (element) {
          setShowPropertyEditor(true);
        }
      });
      
      return () => {
        unsubscribe();
        elementSelectionService.cleanup();
      };
    }
  }, [previewUrl, effectiveServerPair]);

  // FIXED: Update preview mode when device type changes
  useEffect(() => {
    setPreviewMode(getDefaultPreviewMode());
  }, [isMobile, isTablet]);

  // NEW: Cleanup any stuck deployments when component mounts
  useEffect(() => {
    cleanupStuckDeployments();
    ensureChatAlwaysEnabled();
  }, [cleanupStuckDeployments, ensureChatAlwaysEnabled]);

  // 🔧 CRITICAL FIX: Load server pair from coordinated state if prop is missing
  // 🔥 REMOVED: No fallback logic - parent MUST provide selectedServerPair from ProjectControls
  // This enforces single source of truth: ProjectControls dropdown selection

  // Check content when server pair changes (using effective server pair)
  useEffect(() => {
    const checkContent = async () => {
      if (!effectiveServerPair) {
        setContentStatus(null);
        setLivePreviewActivated(false); // Reset activation state
        return;
      }

      try {
        setIsCheckingContent(true);
        const status = await checkCanisterContent(effectiveServerPair.frontendCanisterId);
        setContentStatus(status);

        // NEW: If content is found and this is the first time, notify deployment coordination
        if (status.hasContent && !livePreviewActivated && currentProjectId) {
          console.log('🎉 [LivePreview] Content detected - notifying deployment coordination of successful deployment');
          
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const urls = generateCanisterUrls(effectiveServerPair.frontendCanisterId, isLocal);
          
          // Notify deployment coordination that live preview is now active
          handleLivePreviewActivation({
            deployedUrl: urls.siteUrl,
            projectId: currentProjectId,
            serverPairId: effectiveServerPair.pairId,
            activationTime: Date.now()
          });
          
          setLivePreviewActivated(true);
          
          // Ensure chat is enabled since deployment is now successful
          ensureChatAlwaysEnabled();
          
          console.log('✅ [LivePreview] Deployment coordination notified - deploy button should stop spinning');
        }
        
      } catch (error) {
        console.error('Failed to check canister content:', error);
        setContentStatus({
          hasContent: false,
          error: error instanceof Error ? error.message : 'Failed to check content'
        });
      } finally {
        setIsCheckingContent(false);
      }
    };

    if (effectiveServerPair) {
      checkContent();
    }
  }, [effectiveServerPair, livePreviewActivated, currentProjectId, handleLivePreviewActivation, ensureChatAlwaysEnabled]);

  const handleRefreshContent = () => {
    if (effectiveServerPair) {
      // Reset activation state to allow re-notification if needed
      setLivePreviewActivated(false);
      
      const checkContent = async () => {
        try {
          setIsCheckingContent(true);
          const status = await checkCanisterContent(effectiveServerPair.frontendCanisterId);
          setContentStatus(status);
          
          // NEW: If content is found after refresh, notify deployment coordination
          if (status.hasContent && currentProjectId) {
            console.log('🔄 [LivePreview] Content refreshed - notifying deployment coordination');
            
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const urls = generateCanisterUrls(effectiveServerPair.frontendCanisterId, isLocal);
            
            handleLivePreviewActivation({
              deployedUrl: urls.siteUrl,
              projectId: currentProjectId,
              serverPairId: effectiveServerPair.pairId,
              activationTime: Date.now()
            });
            
            setLivePreviewActivated(true);
            ensureChatAlwaysEnabled();
          }
          
        } catch (error) {
          console.error('Failed to check canister content:', error);
          setContentStatus({
            hasContent: false,
            error: error instanceof Error ? error.message : 'Failed to check content'
          });
        } finally {
          setIsCheckingContent(false);
        }
      };

      checkContent();
    }
  };

  const openInNewTab = () => {
    if (effectiveServerPair) {
      const urls = generateCanisterUrls(effectiveServerPair.frontendCanisterId, isLocal);
      window.open(urls.siteUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // FIXED: Get realistic preview dimensions based on modern device sizes
  const getPreviewDimensions = () => {
    switch (previewMode) {
      case 'mobile':
        // Use iPhone 14 Pro size - much more realistic for modern mobile
        return { width: '393px', height: '852px' };
      case 'tablet':
        // Use iPad Pro 11" size - more realistic for modern tablets
        return { width: '834px', height: '1194px' };
      default:
        // Desktop takes full available space
        return { width: '100%', height: '100%' };
    }
  };

  // Generate special iframe URL for Internet Identity authentication
  const generatePreviewUrl = (canisterId: string) => {
    // 🔥 NEW: Use hot reload preview URL if available
    if (previewUrl) {
      console.log('[LivePreview] Using hot reload preview URL:', previewUrl);
      return previewUrl;
    }
    
    // Fallback to deployed canister URL
    const baseUrls = generateCanisterUrls(canisterId, isLocal);
    
    // Add special parameters to help with authentication flow
    const url = new URL(baseUrls.siteUrl);
    
    // Add parameters to help with auth redirects
    url.searchParams.set('preview', 'true');
    url.searchParams.set('parent_origin', window.location.origin);
    
    return url.toString();
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      // FIXED: Dramatically reduced padding, especially on mobile
      padding: isMobile ? '0.75rem' : isTablet ? '1rem' : '1.5rem',
      // FIXED: Much smaller bottom padding on mobile - was eating up tons of space
      paddingBottom: isMobile 
        ? 'calc(20px + env(safe-area-inset-bottom, 10px))' // Reduced from 120px to 20px
        : (isTablet ? '1rem' : '1.5rem'),
      gap: isMobile ? '0.75rem' : '1rem', // Reduced gap on mobile
      overflow: 'hidden',
      height: '100%', // CRITICAL: Ensure full height usage
      // FIXED: Ensure we're using full viewport on mobile
      ...(isMobile && {
        minHeight: '100vh',
        maxHeight: '100vh'
      })
    }}>

      {/* Main Content Area - FIXED: Takes maximum available space */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: isMobile ? '8px' : '12px', // Smaller border radius on mobile
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        minHeight: 0, // CRITICAL for proper flex behavior
        height: '100%', // CRITICAL: Take full available height
        // FIXED: Ensure full space usage on mobile
        ...(isMobile && {
          minHeight: 'calc(100vh - 140px)', // Account for header and minimal padding
        })
      }}>
        {!effectiveServerPair ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '1rem',
            padding: isMobile ? '1rem' : '2rem', // Less padding on mobile
            color: 'var(--text-gray)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: isMobile ? '2rem' : '3rem', opacity: 0.5 }}>
              🏗️
            </div>
            <h3 style={{ 
              fontSize: isMobile ? '1rem' : '1.2rem', 
              fontWeight: '600', 
              color: '#ffffff', 
              margin: '0 0 0.5rem 0' 
            }}>
              No Server Pair Selected
            </h3>
            <p style={{ 
              margin: 0, 
              lineHeight: 1.6,
              fontSize: isMobile ? '0.8rem' : '1rem'
            }}>
              Select a server pair from the Project Controls panel in the project tabs to preview your deployed project.
            </p>
          </div>
        ) : isCheckingContent ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '1rem',
            color: 'var(--text-gray)',
            padding: isMobile ? '1rem' : '2rem'
          }}>
            <div style={{
              width: isMobile ? '28px' : '40px',
              height: isMobile ? '28px' : '40px',
              border: '3px solid rgba(139, 92, 246, 0.3)',
              borderTop: '3px solid #8b5cf6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ margin: 0, fontSize: isMobile ? '0.8rem' : '1rem' }}>
              Checking deployment status...
            </p>
          </div>
        ) : !contentStatus?.hasContent ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '1rem',
            padding: isMobile ? '1rem' : '2rem',
            color: 'var(--text-gray)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: isMobile ? '2rem' : '3rem', opacity: 0.5 }}>
              📦
            </div>
            <h3 style={{ 
              fontSize: isMobile ? '1rem' : '1.2rem', 
              fontWeight: '600', 
              color: '#ffffff', 
              margin: '0 0 0.5rem 0' 
            }}>
              No Content Deployed
            </h3>
            <p style={{ 
              margin: '0 0 1rem 0', 
              lineHeight: 1.6,
              fontSize: isMobile ? '0.8rem' : '1rem'
            }}>
              The selected server pair <strong>{selectedServerPair?.name}</strong> doesn't have any content deployed yet.
            </p>
            {contentStatus?.error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
                color: '#ef4444'
              }}>
                Error: {contentStatus.error}
              </div>
            )}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '0.75rem',
              marginTop: '1rem'
            }}>
              <button
                onClick={handleRefreshContent}
                style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: '#8b5cf6',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minHeight: '40px'
                }}
              >
                🔄 Check Again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Browser-Style Interface */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(17, 17, 17, 0.8)',
              borderRadius: previewMode === 'desktop' ? '0' : '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              minHeight: 0,
              height: '100%',
              boxShadow: previewMode !== 'desktop' ? '0 20px 60px rgba(0, 0, 0, 0.5)' : 'none'
            }}>
              {/* Browser Tabs Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(30, 30, 30, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '0.5rem 0.75rem',
                gap: '0.5rem',
                flexShrink: 0
              }}>
                {/* Active Tab */}
                <div style={{
                  background: 'rgba(17, 17, 17, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderBottom: 'none',
                  borderRadius: '8px 8px 0 0',
                  padding: '0.5rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  minWidth: '200px',
                  maxWidth: '300px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: livePreviewActivated ? '#10b981' : '#f59e0b',
                    flexShrink: 0
                  }}></div>
                  <span style={{
                    fontSize: '0.75rem',
                    color: '#ffffff',
                    fontWeight: '500',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {contentStatus?.title || effectiveServerPair?.name || 'Preview'}
                  </span>
                  {effectiveServerPair && (
                    <button
                      onClick={openInNewTab}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.6)',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                      }}
                      title="Open in new tab"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Browser Navigation Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(40, 40, 40, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '0.5rem 0.75rem',
                gap: '0.5rem',
                flexShrink: 0
              }}>
                {/* Navigation Buttons */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <button
                    onClick={() => {
                      const iframe = document.querySelector('iframe[title*="Preview"]') as HTMLIFrameElement;
                      if (iframe?.contentWindow) {
                        iframe.contentWindow.history.back();
                      }
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.7)',
                      padding: '0.375rem 0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                    }}
                    title="Back"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      const iframe = document.querySelector('iframe[title*="Preview"]') as HTMLIFrameElement;
                      if (iframe?.contentWindow) {
                        iframe.contentWindow.history.forward();
                      }
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.7)',
                      padding: '0.375rem 0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                    }}
                    title="Forward"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleRefreshContent}
                    disabled={!effectiveServerPair || isCheckingContent}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.7)',
                      padding: '0.375rem 0.5rem',
                      borderRadius: '6px',
                      cursor: effectiveServerPair ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.2s ease',
                      opacity: effectiveServerPair ? 1 : 0.5
                    }}
                    onMouseEnter={(e) => {
                      if (effectiveServerPair) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.color = '#ffffff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                    }}
                    title="Refresh"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 4v4h-4M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 20v-4h4" />
                    </svg>
                  </button>
                </div>

                {/* Address Bar */}
                {effectiveServerPair && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(17, 17, 17, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    gap: '0.5rem',
                    minWidth: 0
                  }}>
                    {/* Security Lock Icon */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0
                    }}>
                      {isLocal ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <path d="M9 12l2 2 4-4" />
                        </svg>
                      )}
                    </div>
                    {/* URL */}
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#ffffff',
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}>
                      {previewUrl ? (
                        <>
                          <span style={{ color: '#8b5cf6', marginRight: '0.5rem' }}>⚡</span>
                          {previewUrl}
                        </>
                      ) : effectiveServerPair ? (() => {
                        const urls = generateCanisterUrls(effectiveServerPair.frontendCanisterId, isLocal);
                        return urls.siteUrl;
                      })() : 'No URL'}
                    </span>
                  </div>
                )}

                {/* 🔥 NEW: Visual Edit Mode Toggle */}
                <button
                  onClick={() => {
                    const newSelectionMode = !isSelectionMode;
                    setIsSelectionMode(newSelectionMode);
                    
                    // 🔥 NEW: Tell iframe to enable/disable selection mode
                    elementSelectionService.toggleSelectionMode(newSelectionMode);
                    
                    if (newSelectionMode) {
                      setShowPropertyEditor(true);
                    } else {
                      elementSelectionService.clearSelection();
                      setShowPropertyEditor(false);
                    }
                  }}
                  style={{
                    background: isSelectionMode
                      ? 'rgba(139, 92, 246, 0.3)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: isSelectionMode
                      ? '1px solid rgba(139, 92, 246, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    color: isSelectionMode ? '#a78bfa' : 'rgba(255, 255, 255, 0.7)',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                  title={isSelectionMode ? 'Exit Visual Edit Mode' : 'Enter Visual Edit Mode'}
                >
                  <span>{isSelectionMode ? '✏️' : '🎨'}</span>
                  {!isMobile && <span>{isSelectionMode ? 'Editing' : 'Edit'}</span>}
                </button>

                {/* Preview Mode Selector */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '0.25rem'
                }}>
                  {[
                    { mode: 'desktop', icon: '🖥️', label: 'Desktop' },
                    { mode: 'tablet', icon: '📱', label: 'Tablet' },
                    { mode: 'mobile', icon: '📱', label: 'Mobile' }
                  ].map(({ mode, icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => setPreviewMode(mode as 'desktop' | 'tablet' | 'mobile')}
                      style={{
                        background: previewMode === mode 
                          ? 'rgba(139, 92, 246, 0.3)'
                          : 'transparent',
                        border: previewMode === mode
                          ? '1px solid rgba(139, 92, 246, 0.5)'
                          : '1px solid transparent',
                        color: previewMode === mode ? '#a78bfa' : 'rgba(255, 255, 255, 0.6)',
                        padding: '0.375rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap'
                      }}
                      title={label}
                    >
                      <span>{icon}</span>
                      {!isMobile && <span>{label}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Frame */}
              <div style={{
                flex: 1,
                display: 'flex',
                justifyContent: previewMode === 'desktop' ? 'stretch' : 'center',
                alignItems: previewMode === 'desktop' ? 'stretch' : (isMobile ? 'stretch' : 'flex-start'),
                padding: previewMode === 'desktop' ? '0' : (isMobile ? '0.5rem' : '1rem'),
                overflow: previewMode === 'desktop' ? 'hidden' : 'auto',
                minHeight: 0,
                height: '100%',
                background: 'rgba(0, 0, 0, 0.3)'
              }}>
                {/* 🔥 NEW: Show hot reload preview if available, even without server pair */}
                {(previewUrl || effectiveServerPair) && (
                  <div style={{
                    width: (isMobile && previewMode === 'mobile') ? '100%' : (previewMode === 'desktop' ? '100%' : getPreviewDimensions().width),
                    height: (isMobile && previewMode === 'mobile') ? '100%' : (previewMode === 'desktop' ? '100%' : getPreviewDimensions().height),
                    maxHeight: 'none',
                    border: previewMode === 'desktop' ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: previewMode === 'desktop' ? '0' : '8px',
                    background: '#ffffff',
                    boxShadow: previewMode === 'desktop' ? 'none' : '0 10px 30px rgba(0, 0, 0, 0.3)',
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: (isMobile && previewMode === 'mobile') ? 1 : 'none'
                  }}>
                    {/* Full-size iframe */}
                    <iframe
                      ref={(el) => {
                        iframeRef.current = el;
                        if (el) {
                          elementSelectionService.initialize(el);
                        }
                      }}
                      src={previewUrl || (effectiveServerPair ? generatePreviewUrl(effectiveServerPair.frontendCanisterId) : 'about:blank')}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        background: '#ffffff',
                        flex: 1,
                        cursor: isSelectionMode ? 'crosshair' : 'default'
                      }}
                      title={previewUrl ? 'Hot Reload Preview' : (effectiveServerPair ? `${effectiveServerPair.name} Preview` : 'Preview')}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                      loading="lazy"
                      scrolling="auto"
                    onLoad={(e) => {
                      // NEW: When iframe loads, ensure we've notified deployment coordination
                      if (!livePreviewActivated && currentProjectId && contentStatus?.hasContent) {
                        console.log('🎯 [LivePreview] Iframe loaded - final verification of deployment success');
                        
                        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                        const urls = generateCanisterUrls(effectiveServerPair.frontendCanisterId, isLocal);
                        
                        handleLivePreviewActivation({
                          deployedUrl: urls.siteUrl,
                          projectId: currentProjectId,
                          serverPairId: effectiveServerPair.pairId,
                          activationTime: Date.now()
                        });
                        
                        setLivePreviewActivated(true);
                        ensureChatAlwaysEnabled();
                      }
                      
                      // Try to inject auth helper script
                      try {
                        const iframe = e.target as HTMLIFrameElement;
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        
                        if (iframeDoc) {
                          // Add a helper for auth redirects
                          const script = iframeDoc.createElement('script');
                          script.textContent = `
                            // Helper to handle Internet Identity auth in preview
                            if (window.parent !== window) {
                              console.log('Preview mode detected - auth may open in new tab');
                              
                              // Override window.open for II auth
                              const originalOpen = window.open;
                              window.open = function(url, ...args) {
                                if (url && url.includes('identity.ic0.app')) {
                                  // Open II in new tab with special handling
                                  const authWindow = originalOpen(url + '&derivationOrigin=${window.location.origin}', '_blank', 'noopener,noreferrer');
                                  return authWindow;
                                }
                                return originalOpen(url, ...args);
                              };
                            }
                          `;
                          iframeDoc.head.appendChild(script);
                        }
                      } catch (error) {
                        // Cross-origin restrictions - this is expected
                        console.log('Cannot inject auth helper due to CORS (this is normal)');
                      }
                    }}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 🔥 NEW: Property Editor Overlay */}
      {showPropertyEditor && (
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          zIndex: 1000,
          ...(isMobile && {
            top: 'auto',
            bottom: '1rem',
            right: '1rem',
            left: '1rem',
            width: 'auto'
          })
        }}>
          <PropertyEditor
            onClose={() => {
              setShowPropertyEditor(false);
              setIsSelectionMode(false);
              // 🔥 NEW: Disable selection mode in iframe
              elementSelectionService.toggleSelectionMode(false);
              elementSelectionService.clearSelection();
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};