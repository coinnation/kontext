import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';

// Platform-specific imports
const DatabaseInterfaceDesktop = React.lazy(() => 
    import('./components/desktop/DatabaseInterface').then(module => ({
        default: module.DatabaseInterface
    }))
);

const DatabaseInterfaceMobile = React.lazy(() => 
    import('./components/mobile/DatabaseInterface.mobile').then(module => ({
        default: module.DatabaseInterfaceMobile
    }))
);

interface DatabaseWrapperProps {
    projectId: string;
    projectName: string;
    selectedServerPair: ServerPair | null;
}

interface ServerPair {
    pairId: string;
    name: string;
    frontendCanisterId: string;
    backendCanisterId: string;
    createdAt: number;
    creditsAllocated: number;
}

export const DatabaseWrapper: React.FC<DatabaseWrapperProps> = (props) => {
    // Get isMobile from store
    const { isMobile: storeIsMobile } = useAppStore(state => ({
        isMobile: state.isMobile
    }));

    // Local mobile detection as fallback and force re-render trigger
    const [localIsMobile, setLocalIsMobile] = useState<boolean | null>(null);
    const [hasInitialized, setHasInitialized] = useState(false);

    // Comprehensive mobile detection with immediate initialization
    useEffect(() => {
        const detectMobile = () => {
            const mobile = window.innerWidth <= 768;
            console.log('🔍 [DatabaseWrapper] Mobile detection:', {
                windowWidth: window.innerWidth,
                isMobile: mobile,
                storeIsMobile,
                timestamp: new Date().toISOString()
            });
            
            setLocalIsMobile(mobile);
            setHasInitialized(true);
            
            // Force store update if there's a mismatch
            if (mobile !== storeIsMobile) {
                console.log('📱 [DatabaseWrapper] Store mismatch - forcing update');
                // We'll let ChatInterface handle the store update, but ensure we re-render
            }
        };

        // Immediate detection
        detectMobile();
        
        // Backup detection with slight delay
        const fallbackTimeout = setTimeout(detectMobile, 100);
        
        // Resize listener
        window.addEventListener('resize', detectMobile);
        
        return () => {
            clearTimeout(fallbackTimeout);
            window.removeEventListener('resize', detectMobile);
        };
    }, [storeIsMobile]);

    // Use local detection if available, fall back to store, then default to false
    const isMobile = localIsMobile !== null ? localIsMobile : storeIsMobile;

    console.log('🗄️ [DatabaseWrapper] Rendering decision:', {
        localIsMobile,
        storeIsMobile,
        finalIsMobile: isMobile,
        hasInitialized,
        component: isMobile ? 'Mobile' : 'Desktop'
    });

    // Don't render until we have a definitive mobile detection
    if (localIsMobile === null || !hasInitialized) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                color: 'var(--text-gray)'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTop: '2px solid var(--accent-orange)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <p>Initializing Database Interface...</p>
                </div>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    const DatabaseComponent = isMobile ? DatabaseInterfaceMobile : DatabaseInterfaceDesktop;

    return (
        <React.Suspense fallback={
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                color: 'var(--text-gray)'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTop: '2px solid var(--accent-orange)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <p>Loading {isMobile ? 'Mobile' : 'Desktop'} Database Interface...</p>
                </div>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        }>
            <DatabaseComponent {...props} />
        </React.Suspense>
    );
};

export default DatabaseWrapper;