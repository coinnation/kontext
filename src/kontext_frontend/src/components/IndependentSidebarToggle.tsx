import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface IndependentSidebarToggleProps {
    isCollapsed: boolean;
    sidebarOpen: boolean;
    isMobile: boolean;
    onToggle: () => void;
}

export const IndependentSidebarToggle: React.FC<IndependentSidebarToggleProps> = ({
    isCollapsed,
    sidebarOpen,
    isMobile,
    onToggle
}) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Don't render on mobile or if not mounted
    if (isMobile || !mounted) {
        return null;
    }

    // Calculate position based on sidebar state
    const getPosition = () => {
        if (isCollapsed) {
            // When collapsed (80px width): position at 80px - 16px = 64px from left
            return {
                left: '64px'
            };
        } else {
            // When expanded (320px width): position at 320px - 16px = 304px from left
            return {
                left: '304px'
            };
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: '50%', // ONLY CHANGE: Moved from '20px' to center
                transform: 'translateY(-50%)', // ONLY CHANGE: Added for perfect centering
                ...getPosition(),
                width: '32px',
                height: '32px',
                zIndex: 999, // Ultra-high z-index to be above everything
                // zIndex: 999999999, // Ultra-high z-index to be above everything
                transition: 'all 0.3s ease',
                pointerEvents: 'auto'
            }}
        >
            <button
                onClick={onToggle}
                style={{
                    width: '100%',
                    height: '100%',
                    background: 'var(--secondary-black)',
                    border: '2px solid var(--accent-orange)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 0 0 4px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 107, 53, 0.8), inset 0 0 12px rgba(255, 107, 53, 0.2)',
                    backdropFilter: 'blur(15px)',
                    isolation: 'isolate',
                    visibility: 'visible',
                    opacity: 1,
                    transform: 'translateZ(0)',
                    willChange: 'transform, background, border-color, box-shadow'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-orange)';
                    e.currentTarget.style.borderColor = '#ffffff';
                    e.currentTarget.style.transform = 'scale(1.1) translateZ(0)';
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(0, 0, 0, 0.9), 0 0 25px rgba(255, 107, 53, 0.9), inset 0 0 15px rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--secondary-black)';
                    e.currentTarget.style.borderColor = 'var(--accent-orange)';
                    e.currentTarget.style.transform = 'scale(1) translateZ(0)';
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 107, 53, 0.8), inset 0 0 12px rgba(255, 107, 53, 0.2)';
                }}
                onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.95) translateZ(0)';
                }}
                onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1) translateZ(0)';
                }}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {isCollapsed ? (
                    <ChevronRight size={18} color="#ffffff" />
                ) : (
                    <ChevronLeft size={18} color="#ffffff" />
                )}
            </button>
        </div>
    );
};