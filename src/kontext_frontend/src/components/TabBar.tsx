import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PortalDropdown } from './PortalDropdown';
import { useFiles, useUI } from '../store/appStore';

interface DragState {
    isDragging: boolean;
    startX: number;
    scrollLeft: number;
    groupId: string;
}

// ✅ NEW: Mobile double-tap simulation types
interface MobileTapState {
    fileName: string | null;
    timestamp: number;
    isProcessingDoubleTap: boolean;
    syntheticTapScheduled: boolean;
}

export const TabBar: React.FC = () => {
    const { tabGroups } = useFiles();
    const { ui, handleTabClick } = useUI();
    
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [forceRender, setForceRender] = useState(0);
    const [scrollPositions, setScrollPositions] = useState<{ [key: string]: number }>({});
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [fileOpeningState, setFileOpeningState] = useState<{ fileName: string | null; isLoading: boolean }>({ 
        fileName: null, 
        isLoading: false 
    });
    const [showFilesDropdown, setShowFilesDropdown] = useState(false);
    
    // ✅ NEW: Mobile tap detection state
    const [mobileTapState, setMobileTapState] = useState<MobileTapState>({
        fileName: null,
        timestamp: 0,
        isProcessingDoubleTap: false,
        syntheticTapScheduled: false
    });
    
    // ✅ COMPLETELY FIXED: Removed isGeneratingRef to eliminate state interference
    const lastGenerationCheckRef = useRef<number>(0);
    const stableEventHandlerRef = useRef<(fileName: string, e: React.MouseEvent) => void>();
    
    // ✅ NEW: Mobile tap detection refs
    const mobileTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTapElementRef = useRef<HTMLElement | null>(null);
    const syntheticEventMarkerRef = useRef<Set<string>>(new Set());
    
    const groupRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const tabRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const categoryButtonRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const filesLabelRef = useRef<HTMLDivElement | null>(null);
    const dragStartPosition = useRef<{ x: number; y: number } | null>(null);
    const isDraggingRef = useRef<boolean>(false);

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => {
            const isMobileWidth = window.innerWidth <= 768;
            const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isTouchDevice = 'ontouchstart' in window;
            
            const mobile = isMobileWidth || isMobileUserAgent || isTouchDevice;
            console.log('Mobile detection:', { isMobileWidth, isMobileUserAgent, isTouchDevice, mobile, width: window.innerWidth });
            setIsMobile(mobile);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // ✅ SIMPLIFIED: Removed complex generation state tracking
    useEffect(() => {
        lastGenerationCheckRef.current = Date.now();
    }, [tabGroups]);

    // ✅ NEW: Cleanup mobile tap timeouts on unmount
    useEffect(() => {
        return () => {
            if (mobileTapTimeoutRef.current) {
                clearTimeout(mobileTapTimeoutRef.current);
            }
            syntheticEventMarkerRef.current.clear();
        };
    }, []);

    // Global mouse move handler for smooth dragging
    useEffect(() => {
        if (isMobile || !dragState) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!dragState) return;
            
            const container = groupRefs.current[dragState.groupId];
            if (!container) return;

            // Check if mouse has moved enough to be considered a drag (threshold: 5px)
            if (dragStartPosition.current) {
                const deltaX = Math.abs(e.pageX - dragStartPosition.current.x);
                const deltaY = Math.abs(e.pageY - dragStartPosition.current.y);
                
                // Only start dragging if horizontal movement is significant and greater than vertical
                if (!isDraggingRef.current && (deltaX > 5 || deltaY > 5)) {
                    if (deltaX > deltaY) {
                        isDraggingRef.current = true;
                        setDragState({
                            ...dragState,
                            isDragging: true
                        });
                        container.style.cursor = 'grabbing';
                        container.style.userSelect = 'none';
                    }
                }
            }

            // Only scroll if we're actually dragging
            if (isDraggingRef.current && dragState.isDragging) {
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const walk = (x - dragState.startX) * 1.5;
                const newScrollLeft = dragState.scrollLeft - walk;
                
                requestAnimationFrame(() => {
                    container.scrollLeft = newScrollLeft;
                });
            }
        };

        const handleGlobalMouseUp = () => {
            handleMouseUp();
        };

        // Always attach listeners when dragState exists (not just when dragging)
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [dragState, isMobile]);

    // Initialize scroll indicators for each group
    useEffect(() => {
        if (isMobile) return;
        
        tabGroups.forEach(group => {
            const container = groupRefs.current[group.id];
            if (container) {
                const hasScrollLeft = container.scrollLeft > 0;
                const hasScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth - 1);
                
                // Set initial mask based on scroll position
                if (hasScrollLeft && hasScrollRight) {
                    container.style.maskImage = 'linear-gradient(to right, transparent 0px, black 20px, black calc(100% - 20px), transparent 100%)';
                    (container.style as any).webkitMaskImage = 'linear-gradient(to right, transparent 0px, black 20px, black calc(100% - 20px), transparent 100%)';
                } else if (hasScrollLeft) {
                    container.style.maskImage = 'linear-gradient(to right, transparent 0px, black 20px, black 100%)';
                    (container.style as any).webkitMaskImage = 'linear-gradient(to right, transparent 0px, black 20px, black 100%)';
                } else if (hasScrollRight) {
                    container.style.maskImage = 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)';
                    (container.style as any).webkitMaskImage = 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)';
                } else {
                    container.style.maskImage = 'none';
                    (container.style as any).webkitMaskImage = 'none';
                }
            }
        });
    }, [tabGroups, isMobile]);

    // Auto-scroll to writing tabs (desktop only)
    useEffect(() => {
        if (isMobile) return;
        
        tabGroups.forEach(group => {
            group.files.forEach(file => {
                if (file.isWriting && !file.isComplete) {
                    const tabElement = tabRefs.current[file.fileName];
                    const groupElement = groupRefs.current[group.id];
                    
                    if (tabElement && groupElement) {
                        const tabRect = tabElement.getBoundingClientRect();
                        const groupRect = groupElement.getBoundingClientRect();
                        
                        const isVisible = tabRect.left >= groupRect.left && 
                                         tabRect.right <= groupRect.right;
                        
                        if (!isVisible) {
                            tabElement.scrollIntoView({
                                behavior: 'smooth',
                                block: 'nearest',
                                inline: 'center'
                            });
                        }
                    }
                }
            });
        });
    }, [tabGroups, isMobile]);

    // ✅ NEW: Mobile double-tap simulation functions
    const createSyntheticEvent = useCallback((originalEvent: React.MouseEvent, targetElement: HTMLElement): React.MouseEvent => {
        // Create a unique marker for this synthetic event
        const syntheticId = `synthetic_${Date.now()}_${Math.random()}`;
        syntheticEventMarkerRef.current.add(syntheticId);
        
        // Create synthetic mouse event
        const syntheticMouseEvent = new MouseEvent('click', {
            bubbles: originalEvent.bubbles,
            cancelable: originalEvent.cancelable,
            clientX: originalEvent.clientX,
            clientY: originalEvent.clientY,
            button: originalEvent.button,
            buttons: originalEvent.buttons,
            ctrlKey: originalEvent.ctrlKey,
            shiftKey: originalEvent.shiftKey,
            altKey: originalEvent.altKey,
            metaKey: originalEvent.metaKey,
            view: window,
            detail: 2 // Mark as double-click
        });
        
        // Add synthetic marker
        (syntheticMouseEvent as any).__synthetic = true;
        (syntheticMouseEvent as any).__syntheticId = syntheticId;
        
        // Convert to React synthetic event format
        const reactEvent = {
            ...originalEvent,
            nativeEvent: syntheticMouseEvent,
            currentTarget: targetElement,
            target: targetElement,
            type: 'click',
            synthetic: true,
            syntheticId
        } as React.MouseEvent;
        
        return reactEvent;
    }, []);

    const isSyntheticEvent = useCallback((event: React.MouseEvent): boolean => {
        const nativeEvent = event.nativeEvent as any;
        return !!(
            nativeEvent?.__synthetic || 
            event.detail === 2 || 
            (event as any).synthetic ||
            (event as any).__syntheticId
        );
    }, []);

    const scheduleSyntheticTap = useCallback((fileName: string, originalEvent: React.MouseEvent, targetElement: HTMLElement) => {
        console.log('📱 [MOBILE TAP] Scheduling synthetic second tap for:', fileName);
        
        // Clear any existing timeout
        if (mobileTapTimeoutRef.current) {
            clearTimeout(mobileTapTimeoutRef.current);
        }
        
        // Mark that we're scheduling a synthetic tap
        setMobileTapState(prev => ({
            ...prev,
            syntheticTapScheduled: true,
            isProcessingDoubleTap: true
        }));
        
        // Schedule the synthetic tap with optimal timing
        mobileTapTimeoutRef.current = setTimeout(() => {
            try {
                console.log('📱 [MOBILE TAP] Executing synthetic second tap for:', fileName);
                
                // Create synthetic event
                const syntheticEvent = createSyntheticEvent(originalEvent, targetElement);
                
                // Execute the tab click handler directly with synthetic event
                handleTabClickWrapper(fileName, syntheticEvent);
                
                // Clean up state
                setMobileTapState(prev => ({
                    ...prev,
                    isProcessingDoubleTap: false,
                    syntheticTapScheduled: false,
                    fileName: null,
                    timestamp: 0
                }));
                
                console.log('✅ [MOBILE TAP] Synthetic second tap completed for:', fileName);
                
            } catch (error) {
                console.error('❌ [MOBILE TAP] Error in synthetic tap execution:', error);
                
                // Reset state on error
                setMobileTapState(prev => ({
                    ...prev,
                    isProcessingDoubleTap: false,
                    syntheticTapScheduled: false,
                    fileName: null,
                    timestamp: 0
                }));
            }
        }, 25); // 25ms delay - fast enough to feel instant, slow enough to be processed separately
        
    }, [createSyntheticEvent, handleTabClick]);

    const detectInitialMobileTap = useCallback((fileName: string, event: React.MouseEvent): boolean => {
        // Only on mobile devices
        if (!isMobile) {
            return false;
        }
        
        // Skip if this is already a synthetic event
        if (isSyntheticEvent(event)) {
            console.log('📱 [MOBILE TAP] Skipping - synthetic event detected');
            return false;
        }
        
        // Skip if we're already processing a double-tap for this file
        if (mobileTapState.isProcessingDoubleTap && mobileTapState.fileName === fileName) {
            console.log('📱 [MOBILE TAP] Skipping - already processing double-tap for:', fileName);
            return false;
        }
        
        // Skip if file is already opening
        if (fileOpeningState.isLoading && fileOpeningState.fileName === fileName) {
            console.log('📱 [MOBILE TAP] Skipping - file already opening:', fileName);
            return false;
        }
        
        const now = Date.now();
        const currentTarget = event.currentTarget as HTMLElement;
        
        // Check if this is a genuinely new tap
        const isNewTap = (
            mobileTapState.fileName !== fileName || 
            now - mobileTapState.timestamp > 1000 || // Reset after 1 second
            lastTapElementRef.current !== currentTarget
        );
        
        if (isNewTap) {
            console.log('📱 [MOBILE TAP] Initial tap detected for:', fileName);
            
            // Store tap information
            setMobileTapState({
                fileName,
                timestamp: now,
                isProcessingDoubleTap: false,
                syntheticTapScheduled: false
            });
            
            lastTapElementRef.current = currentTarget;
            
            // Schedule the synthetic second tap
            scheduleSyntheticTap(fileName, event, currentTarget);
            
            return true; // This is the initial tap
        }
        
        return false; // This is not an initial tap
    }, [isMobile, isSyntheticEvent, mobileTapState, fileOpeningState, scheduleSyntheticTap]);

    const handleMouseDown = (e: React.MouseEvent, groupId: string) => {
        if (isMobile) return;
        
        const container = groupRefs.current[groupId];
        if (!container) return;

        // Store initial mouse position to detect if this is a drag vs click
        dragStartPosition.current = { x: e.pageX, y: e.pageY };
        isDraggingRef.current = false;

        setDragState({
            isDragging: false, // Start as false, will be set to true if movement detected
            startX: e.pageX - container.offsetLeft,
            scrollLeft: container.scrollLeft,
            groupId
        });
        
        container.style.cursor = 'grab';
        e.preventDefault();
    };

    // Note: handleMouseMove removed - now handled by global mouse move handler

    const handleMouseUp = () => {
        if (isMobile) return;
        
        const wasDragging = isDraggingRef.current;
        const currentGroupId = dragState?.groupId;
        
        if (dragState && dragState.groupId) {
            const container = groupRefs.current[dragState.groupId];
            if (container) {
                container.style.cursor = 'grab';
                container.style.userSelect = '';
                const finalScrollLeft = container.scrollLeft;
                
                // Save scroll position immediately and persist it
                setScrollPositions(prev => ({
                    ...prev,
                    [dragState.groupId]: finalScrollLeft
                }));
                
                // Store in container's data attribute as backup
                container.setAttribute('data-scroll-left', finalScrollLeft.toString());
            }
        }
        
        // Reset drag state with a small delay to prevent accidental clicks after drag
        if (wasDragging) {
            // If we were dragging, reset immediately
            isDraggingRef.current = false;
            dragStartPosition.current = null;
        setDragState(null);
        
            // Small delay before allowing clicks again
            setTimeout(() => {
                isDraggingRef.current = false;
            }, 50);
        } else {
            // If we weren't dragging, reset immediately (it was just a click)
            isDraggingRef.current = false;
            dragStartPosition.current = null;
            setDragState(null);
        }
    };

    const handleMouseLeave = () => {
        if (isMobile) return;
        
        if (dragState && dragState.groupId) {
            const container = groupRefs.current[dragState.groupId];
            if (container) {
                container.style.cursor = 'grab';
                container.style.userSelect = '';
                const finalScrollLeft = container.scrollLeft;
                
                // Save scroll position
                setScrollPositions(prev => ({
                    ...prev,
                    [dragState.groupId]: finalScrollLeft
                }));
                
                // Store in container's data attribute as backup
                container.setAttribute('data-scroll-left', finalScrollLeft.toString());
            }
        }
        
        // Reset drag state
        const wasDragging = isDraggingRef.current;
        const currentGroupId = dragState?.groupId;
        isDraggingRef.current = false;
        dragStartPosition.current = null;
        setDragState(null);
        
        // Restore scroll position if we were dragging
        if (wasDragging && currentGroupId) {
                    const container = groupRefs.current[currentGroupId];
            if (container) {
                const savedScroll = scrollPositions[currentGroupId];
                if (savedScroll !== undefined) {
                    requestAnimationFrame(() => {
                        container.scrollLeft = savedScroll;
                    });
                }
            }
        }
    };

    // ✅ ENHANCED: Mobile-aware tab click handler with double-tap simulation
    const stableHandleTabClick = useCallback(async (fileName: string, e: React.MouseEvent) => {
        console.log('📱 [TAB CLICK] Handler triggered for:', fileName, 'isMobile:', isMobile);
        
        // Prevent drag interference - check if we actually dragged
        if (isDraggingRef.current || (dragState?.isDragging)) {
            console.log('📱 [TAB CLICK] Prevented - drag in progress');
            e.preventDefault();
            return;
        }

        const isMobileDevice = isMobile;
        const isSynthetic = isSyntheticEvent(e);
        
        console.log('📱 [TAB CLICK] Event details:', { 
            fileName, 
            isMobileDevice, 
            isSynthetic,
            detail: e.detail,
            type: e.type 
        });

        try {
            if (isMobileDevice && !isSynthetic) {
                // ✅ MOBILE INITIAL TAP DETECTION AND DOUBLE-TAP SIMULATION
                console.log('📱 [MOBILE TAP] Processing initial mobile tap');
                
                const isInitialTap = detectInitialMobileTap(fileName, e);
                
                if (isInitialTap) {
                    console.log('📱 [MOBILE TAP] Initial tap confirmed - synthetic second tap scheduled');
                    
                    // ✅ CRITICAL: Set loading state immediately for UI feedback
                    setFileOpeningState({ fileName, isLoading: true });
                    
                    // The synthetic second tap will be handled automatically by scheduleSyntheticTap
                    // We don't execute handleTabClick here - we wait for the synthetic event
                    return;
                } else {
                    console.log('📱 [MOBILE TAP] Not an initial tap - proceeding with normal flow');
                }
            }
            
            if (isMobileDevice && isSynthetic) {
                console.log('📱 [MOBILE TAP] Processing synthetic second tap - executing file opening');
            } else if (!isMobileDevice) {
                console.log('📱 [DESKTOP] Processing desktop click - direct execution');
            }
            
            // ✅ EXECUTE FILE OPENING (for synthetic mobile taps or desktop clicks)
            if (isMobileDevice) {
                console.log('📱 [MOBILE] Executing handleTabClick with synthetic double-tap simulation');
                
                try {
                    console.log('📱 [MOBILE] Executing handleTabClick for:', fileName);
                    
                    // Direct execution for mobile (synthetic tap)
                    handleTabClick(fileName);
                    
                    // ✅ CRITICAL: Use requestAnimationFrame for clean state updates
                    requestAnimationFrame(() => {
                        console.log('📱 [MOBILE] File opened successfully, cleaning up');
                        
                        // Sequential cleanup: loading first, then dropdown
                        setFileOpeningState({ fileName: null, isLoading: false });
                        
                        // Use another RAF to ensure smooth state transition
                        requestAnimationFrame(() => {
                            setExpandedCategory(null);
                        });
                    });
                    
                } catch (fileOpenError) {
                    console.error('📱 [MOBILE] File opening failed:', fileOpenError);
                    
                    // Reset loading state but keep dropdown open for retry
                    setFileOpeningState({ fileName: null, isLoading: false });
                    
                    // Reset mobile tap state
                    setMobileTapState(prev => ({
                        ...prev,
                        isProcessingDoubleTap: false,
                        syntheticTapScheduled: false,
                        fileName: null,
                        timestamp: 0
                    }));
                    
                    return;
                }
                
            } else {
                // Desktop: Simple, direct execution (unchanged)
                console.log('📱 [DESKTOP] Direct execution');
                handleTabClick(fileName);
            }
            
            console.log('📱 [TAB CLICK] Successfully handled tab click for:', fileName);
            
        } catch (error) {
            console.error('📱 [TAB CLICK] Error in enhanced handler:', error);
            
            // ✅ CRITICAL: Robust error recovery with RAF
            setFileOpeningState({ fileName: null, isLoading: false });
            
            // Reset mobile tap state on error
            setMobileTapState(prev => ({
                ...prev,
                isProcessingDoubleTap: false,
                syntheticTapScheduled: false,
                fileName: null,
                timestamp: 0
            }));
            
            // Fallback: Try again with a clean slate
            requestAnimationFrame(() => {
                try {
                    console.log('📱 [TAB CLICK] Fallback execution for:', fileName);
                    handleTabClick(fileName);
                    
                    if (isMobileDevice) {
                        // Clean up after successful fallback
                        requestAnimationFrame(() => {
                            setExpandedCategory(null);
                        });
                    }
                } catch (fallbackError) {
                    console.error('📱 [TAB CLICK] Fallback also failed:', fallbackError);
                    setFileOpeningState({ fileName: null, isLoading: false });
                }
            });
        }
    }, [dragState?.isDragging, isMobile, handleTabClick, isSyntheticEvent, detectInitialMobileTap]);

    useEffect(() => {
        stableEventHandlerRef.current = stableHandleTabClick;
    }, [stableHandleTabClick]);

    const handleTabClickWrapper = useCallback((fileName: string, e: React.MouseEvent) => {
        console.log('📱 [TAB CLICK] Wrapper called for:', fileName);
        
        const handler = stableEventHandlerRef.current || stableHandleTabClick;
        handler(fileName, e);
    }, [stableHandleTabClick]);

    const handleCategoryClick = (groupId: string) => {
        console.log('Category clicked:', groupId, 'isMobile:', isMobile);
        if (!isMobile) return;
        
        // Reset any loading states and mobile tap states when switching categories
        setFileOpeningState({ fileName: null, isLoading: false });
        setMobileTapState({
            fileName: null,
            timestamp: 0,
            isProcessingDoubleTap: false,
            syntheticTapScheduled: false
        });
        
        // Clear any pending timeouts
        if (mobileTapTimeoutRef.current) {
            clearTimeout(mobileTapTimeoutRef.current);
            mobileTapTimeoutRef.current = null;
        }
        
        setExpandedCategory(expandedCategory === groupId ? null : groupId);
    };

    const getGroupColor = (groupName: string, originalColor: string) => {
        const hardCodedColors: { [key: string]: string } = {
            'backend': '#f97316',
            'component': '#10b981',
            'style': '#8b5cf6',
            'config': '#06b6d4'
        };
        
        const groupKey = groupName.toLowerCase();
        return hardCodedColors[groupKey] || originalColor || '#64748b';
    };

    const getCategoryState = (group: any) => {
        const writingFiles = group.files.filter((f: any) => f.isWriting && !f.isComplete);
        const completeFiles = group.files.filter((f: any) => f.isComplete);
        const detectedFiles = group.files.filter((f: any) => !f.isWriting && !f.isComplete);
        
        if (writingFiles.length > 0) return 'writing';
        if (detectedFiles.length > 0) return 'detected';
        if (completeFiles.length > 0) return 'complete';
        return 'idle';
    };

    // ✅ ENHANCED: FileDropdownContent with mobile double-tap awareness
    const FileDropdownContent: React.FC<{ group: any, groupColor: string }> = ({ group, groupColor }) => (
        <div style={{
            background: 'rgb(10, 10, 10)',
            border: `1px solid ${groupColor}50`,
            borderRadius: '16px',
            maxHeight: '60vh',
            overflowY: 'auto',
            minWidth: isMobile ? '280px' : '300px',
            maxWidth: isMobile ? '90vw' : '350px',
            boxShadow: `0 25px 50px rgba(0, 0, 0, 0.95), 0 0 0 1px ${groupColor}30, 0 0 20px rgba(${groupColor.replace('#', '')}, 0.2)`,
            backdropFilter: 'blur(20px) saturate(150%)',
            overflow: 'hidden'
        }}>
            <div style={{
                padding: '1rem 1.25rem 0.75rem',
                borderBottom: `1px solid ${groupColor}20`,
                background: `linear-gradient(135deg, ${groupColor}08, ${groupColor}05)`
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.5rem'
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: `linear-gradient(135deg, ${groupColor}30, ${groupColor}20)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        border: `1px solid ${groupColor}40`
                    }}>
                        {group.icon}
                    </div>
                    <div>
                        <div style={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {group.name}
                        </div>
                        <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-gray)',
                            opacity: 0.8
                        }}>
                            {group.files.length} file{group.files.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {group.files.map((file: any, index: number) => {
                    const isActive = ui.sidePane.isOpen && ui.sidePane.activeFile === file.fileName;
                    const isWriting = file.isWriting && !file.isComplete;
                    const isComplete = file.isComplete;
                    const isLoading = fileOpeningState.fileName === file.fileName && fileOpeningState.isLoading;
                    const isProcessingMobileTap = mobileTapState.isProcessingDoubleTap && mobileTapState.fileName === file.fileName;
                    
                    return (
                        <div
                            key={file.fileName}
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('📱 [DROPDOWN] File clicked:', file.fileName, 'isWriting:', isWriting, 'isProcessingMobileTap:', isProcessingMobileTap);
                                
                                // Don't handle click if we're already processing a mobile tap for this file
                                if (isProcessingMobileTap) {
                                    console.log('📱 [DROPDOWN] Skipping - mobile tap in progress');
                                    return;
                                }
                                
                                handleTabClickWrapper(file.fileName, e);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                padding: '1rem 1.25rem',
                                borderBottom: index < group.files.length - 1 ? `1px solid ${groupColor}15` : 'none',
                                cursor: (isLoading || isProcessingMobileTap) ? 'wait' : 'pointer',
                                background: isActive 
                                    ? `linear-gradient(135deg, ${groupColor}25, ${groupColor}15)` 
                                    : (isLoading || isProcessingMobileTap)
                                    ? `linear-gradient(135deg, ${groupColor}20, ${groupColor}10)`
                                    : 'transparent',
                                transition: 'all 0.15s ease',
                                position: 'relative',
                                minHeight: '56px',
                                // ✅ ENHANCED: Better opacity handling for mobile tap states
                                opacity: (isLoading || isProcessingMobileTap) ? 0.8 : 1
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive && !isLoading && !isProcessingMobileTap) {
                                    e.currentTarget.style.background = `linear-gradient(135deg, ${groupColor}15, ${groupColor}08)`;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive && !isLoading && !isProcessingMobileTap) {
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            {/* ✅ ENHANCED: Icon with mobile tap state awareness */}
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: isActive 
                                    ? `linear-gradient(135deg, ${groupColor}40, ${groupColor}30)` 
                                    : `linear-gradient(135deg, ${groupColor}20, ${groupColor}10)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.1rem',
                                flexShrink: 0,
                                border: `1px solid ${groupColor}30`,
                                transition: 'all 0.15s ease',
                                position: 'relative'
                            }}>
                                {(isLoading || isProcessingMobileTap) ? (
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        border: `2px solid ${groupColor}30`,
                                        borderTopColor: groupColor,
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                ) : (
                                    file.icon
                                )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '0.9rem',
                                    color: isActive ? '#ffffff' : 'var(--text-light-gray)',
                                    fontWeight: isActive ? 700 : 600,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    marginBottom: '0.25rem'
                                }}>
                                    {file.displayName}
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-gray)',
                                        background: 'rgba(255,255,255,0.05)',
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '4px',
                                        fontWeight: 500,
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        {file.language}
                                    </div>
                                    
                                    {/* ✅ ENHANCED: Mobile tap state display */}
                                    {(isLoading || isProcessingMobileTap) && (
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: groupColor,
                                            background: `${groupColor}15`,
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: '4px',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.3px',
                                            border: `1px solid ${groupColor}30`
                                        }}>
                                            {isProcessingMobileTap ? 'Processing...' : 'Opening...'}
                                        </div>
                                    )}
                                    
                                    {/* ✅ IMPROVED: Clear state indicators for writing/complete files */}
                                    {!isLoading && !isProcessingMobileTap && isWriting && (
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: '#f97316',
                                            background: 'rgba(249, 115, 22, 0.1)',
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: '4px',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.3px',
                                            border: '1px solid rgba(249, 115, 22, 0.3)'
                                        }}>
                                            Writing
                                        </div>
                                    )}
                                    
                                    {!isLoading && !isProcessingMobileTap && isComplete && (
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: '#10b981',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: '4px',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.3px',
                                            border: '1px solid rgba(16, 185, 129, 0.3)'
                                        }}>
                                            Complete
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* ✅ ENHANCED: Visual indicators with mobile tap awareness */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                flexShrink: 0
                            }}>
                                {!isLoading && !isProcessingMobileTap && isWriting && (
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        background: '#f97316',
                                        borderRadius: '50%',
                                        animation: 'mobilePulse 1s infinite',
                                        boxShadow: '0 0 6px rgba(249, 115, 22, 0.6)'
                                    }} />
                                )}
                                {!isLoading && !isProcessingMobileTap && isComplete && (
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        background: '#10b981',
                                        borderRadius: '50%',
                                        boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)'
                                    }} />
                                )}
                                {isActive && !isLoading && !isProcessingMobileTap && (
                                    <div style={{
                                        fontSize: '1rem',
                                        color: groupColor,
                                        opacity: 0.8
                                    }}>
                                        ▶
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes mobilePulse {
                    0%, 100% { 
                        opacity: 0.7;
                        transform: scale(1);
                    }
                    50% { 
                        opacity: 1;
                        transform: scale(1.2);
                    }
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );

    if (tabGroups.length === 0) return null;

    if (isMobile) {
        return (
            <div 
                key={forceRender}
                className="tab-bar mobile" 
                style={{
                    position: 'relative',
                    overflowX: 'hidden',
                    overflowY: 'visible',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    flexShrink: 0,
                    width: '100%',
                    maxHeight: '60px',
                    maxWidth: '100vw',
                    zIndex: 110
                }}
            >
                <div className="mobile-tab-container" style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.75rem 0.5rem',
                    width: '100%',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    gap: '0.5rem',
                    position: 'relative'
                }}>
                    {/* FILES Label */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255, 107, 53, 0.1)',
                        border: '1px solid rgba(255, 107, 53, 0.3)',
                        borderRadius: '8px',
                        flexShrink: 0
                    }}>
                        <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: 'var(--accent-orange)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            📁 Files
                        </span>
                    </div>

                    {tabGroups.map((group) => {
                        const groupColor = getGroupColor(group.name, group.color);
                        const categoryState = getCategoryState(group);
                        const isExpanded = expandedCategory === group.id;
                        const fileCount = group.files.length;
                        const writingCount = group.files.filter(f => f.isWriting && !f.isComplete).length;
                        const hasLoadingFile = fileOpeningState.isLoading && group.files.some(f => f.fileName === fileOpeningState.fileName);
                        const hasMobileTapProcessing = mobileTapState.isProcessingDoubleTap && group.files.some(f => f.fileName === mobileTapState.fileName);
                        
                        return (
                            <div key={group.id} style={{ 
                                position: 'relative', 
                                flexShrink: 0
                            }}>
                                <div 
                                    ref={(el) => { categoryButtonRefs.current[group.id] = el; }}
                                    className={`mobile-category ${categoryState} ${isExpanded ? 'expanded' : ''}`}
                                    onClick={() => handleCategoryClick(group.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '8px',
                                        border: `1px solid ${groupColor}40`,
                                        background: `${groupColor}08`,
                                        minWidth: 'fit-content',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        position: 'relative',
                                        opacity: (hasLoadingFile || hasMobileTapProcessing) ? 0.8 : 1
                                    }}
                                >
                                    <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                        {group.icon}
                                    </span>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        gap: '0.1rem'
                                    }}>
                                        <div style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            color: groupColor,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.3px',
                                            lineHeight: 1
                                        }}>
                                            {group.name}
                                        </div>
                                        <div style={{
                                            fontSize: '0.6rem',
                                            color: 'var(--text-gray)',
                                            lineHeight: 1
                                        }}>
                                            {(hasLoadingFile || hasMobileTapProcessing) ? 
                                             (hasMobileTapProcessing ? 'Processing...' : 'Opening...') :
                                             writingCount > 0 ? `${writingCount}/${fileCount} writing` : `${fileCount} files`}
                                        </div>
                                    </div>
                                    
                                    {categoryState === 'writing' && !hasLoadingFile && !hasMobileTapProcessing && (
                                        <div className="writing-indicator" style={{
                                            position: 'absolute',
                                            top: '4px',
                                            right: '4px',
                                            width: '6px',
                                            height: '6px',
                                            background: '#f97316',
                                            borderRadius: '50%',
                                            animation: 'mobilePulse 1.5s infinite'
                                        }} />
                                    )}
                                    
                                    {(hasLoadingFile || hasMobileTapProcessing) && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '4px',
                                            right: '4px',
                                            width: '6px',
                                            height: '6px',
                                            border: `1px solid ${groupColor}`,
                                            borderTopColor: 'transparent',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite'
                                        }} />
                                    )}
                                    
                                    <div style={{
                                        fontSize: '0.6rem',
                                        color: groupColor,
                                        opacity: 0.6,
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease'
                                    }}>
                                        ▼
                                    </div>
                                </div>
                                
                                <PortalDropdown
                                    isOpen={isExpanded}
                                    onClose={() => {
                                        setExpandedCategory(null);
                                        // Reset loading state and mobile tap state when dropdown closes
                                        setFileOpeningState({ fileName: null, isLoading: false });
                                        setMobileTapState({
                                            fileName: null,
                                            timestamp: 0,
                                            isProcessingDoubleTap: false,
                                            syntheticTapScheduled: false
                                        });
                                        
                                        // Clear any pending timeouts
                                        if (mobileTapTimeoutRef.current) {
                                            clearTimeout(mobileTapTimeoutRef.current);
                                            mobileTapTimeoutRef.current = null;
                                        }
                                    }}
                                    triggerRef={{ current: categoryButtonRefs.current[group.id] } as React.RefObject<HTMLElement>}
                                    placement="auto"
                                    offset={{ x: 0, y: 8 }}
                                    backdrop={true}
                                    zIndex={10000}
                                >
                                    <FileDropdownContent group={group} groupColor={groupColor} />
                                </PortalDropdown>
                            </div>
                        );
                    })}
                </div>

                <style>{`
                    .mobile-tab-container::-webkit-scrollbar {
                        display: none;
                    }

                    .mobile-category.writing {
                        animation: mobileWritingPulse 2s ease-in-out infinite;
                    }

                    .mobile-category.detected {
                        animation: mobileDetectedGlow 3s ease-in-out infinite;
                    }

                    .mobile-category.complete {
                        animation: mobileCompleteGlow 1s ease-out;
                    }

                    .mobile-category:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    }

                    @keyframes mobileWritingPulse {
                        0%, 100% { 
                            border-color: rgba(255, 255, 255, 0.1);
                            box-shadow: 0 0 0 0px rgba(249, 115, 22, 0.2);
                        }
                        50% { 
                            border-color: #f97316;
                            box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.1);
                        }
                    }

                    @keyframes mobileDetectedGlow {
                        0%, 100% { 
                            opacity: 0.9;
                        }
                        50% { 
                            opacity: 1;
                        }
                    }

                    @keyframes mobileCompleteGlow {
                        0% { 
                            transform: scale(1);
                        }
                        50% { 
                            transform: scale(1.01);
                        }
                        100% { 
                            transform: scale(1);
                        }
                    }

                    @keyframes mobilePulse {
                        0%, 100% { 
                            opacity: 0.7;
                            transform: scale(1);
                        }
                        50% { 
                            opacity: 1;
                            transform: scale(1.2);
                        }
                    }
                    
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    // Desktop layout with FILES label (unchanged - desktop was already working correctly)
    return (
        <div 
            key={forceRender}
            className="tab-bar desktop" 
            style={{
                position: 'relative',
                overflowX: 'hidden',
                overflowY: 'hidden',
                scrollbarWidth: 'thin',
                scrollBehavior: 'smooth',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.02)',
                flexShrink: 0,
                width: '100%',
                maxHeight: '60px',
                maxWidth: '100vw',
                contain: 'layout',
                zIndex: 110
            }}
        >
            <div className="tab-container" style={{
                display: 'flex',
                gap: '0.75rem',
                padding: '0.625rem 0.5rem',
                minHeight: '48px',
                alignItems: 'center',
                justifyContent: 'flex-start',
                width: '100%',
                maxWidth: 'calc(100vw - 1rem)',
                minWidth: '0',
                overflowX: 'auto',
                overflowY: 'visible',
                boxSizing: 'border-box',
                flex: '1 1 0',
                position: 'relative'
            }}>
                {/* FILES Label - Desktop - Clickable */}
                <div 
                    ref={(el) => { filesLabelRef.current = el; }}
                    onClick={() => setShowFilesDropdown(!showFilesDropdown)}
                    style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem 1rem',
                        background: showFilesDropdown 
                            ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.25), rgba(16, 185, 129, 0.15))'
                            : 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(16, 185, 129, 0.08))',
                        border: showFilesDropdown 
                            ? '1px solid rgba(255, 107, 53, 0.5)'
                            : '1px solid rgba(255, 107, 53, 0.3)',
                    borderRadius: '8px',
                    flexShrink: 0,
                        marginRight: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        boxShadow: showFilesDropdown 
                            ? '0 4px 12px rgba(255, 107, 53, 0.3)'
                            : 'none',
                        alignSelf: 'center'
                    }}
                    onMouseEnter={(e) => {
                        if (!showFilesDropdown) {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(16, 185, 129, 0.12))';
                            e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.4)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!showFilesDropdown) {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(16, 185, 129, 0.08))';
                            e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                        }
                    }}
                >
                    <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--accent-orange)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        📁 Files
                        {/* Badge showing file count when there are many files */}
                        {tabGroups.reduce((sum, group) => sum + group.files.length, 0) > 8 && (
                            <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                background: 'rgba(255, 107, 53, 0.3)',
                                color: 'var(--accent-orange)',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '10px',
                                border: '1px solid rgba(255, 107, 53, 0.4)',
                                minWidth: '20px',
                                textAlign: 'center',
                                lineHeight: 1,
                                animation: 'badgePulse 2s ease-in-out infinite'
                            }}>
                                {tabGroups.reduce((sum, group) => sum + group.files.length, 0)}
                            </span>
                        )}
                        <span style={{
                            fontSize: '0.6rem',
                            opacity: 0.7,
                            transform: showFilesDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease'
                        }}>
                            ▼
                        </span>
                    </span>
                </div>

                {/* Files Browser Dropdown */}
                <PortalDropdown
                    isOpen={showFilesDropdown}
                    onClose={() => setShowFilesDropdown(false)}
                    triggerRef={filesLabelRef as React.RefObject<HTMLElement>}
                    placement="bottom-left"
                    offset={{ x: 0, y: 8 }}
                    backdrop={false}
                    zIndex={10000}
                >
                    <div style={{
                        background: 'rgb(10, 10, 10)',
                        border: '1px solid rgba(255, 107, 53, 0.3)',
                        borderRadius: '16px',
                        maxHeight: '70vh',
                        overflowY: 'auto',
                        minWidth: '400px',
                        maxWidth: '600px',
                        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 107, 53, 0.2), 0 0 30px rgba(255, 107, 53, 0.15)',
                        backdropFilter: 'blur(20px) saturate(150%)',
                        overflow: 'hidden'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid rgba(255, 107, 53, 0.2)',
                            background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(16, 185, 129, 0.08))',
                            position: 'sticky',
                            top: 0,
                            zIndex: 1
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                marginBottom: '0.5rem'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.3), rgba(255, 107, 53, 0.2))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.2rem',
                                    border: '1px solid rgba(255, 107, 53, 0.4)'
                                }}>
                                    📁
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        color: '#ffffff',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        All Files
                                    </div>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-gray)',
                                        opacity: 0.8
                                    }}>
                                        {tabGroups.reduce((sum, group) => sum + group.files.length, 0)} file{tabGroups.reduce((sum, group) => sum + group.files.length, 0) !== 1 ? 's' : ''} across {tabGroups.length} categor{tabGroups.length !== 1 ? 'ies' : 'y'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* File List by Group */}
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0.5rem' }}>
                            {tabGroups.map((group, groupIndex) => {
                                const groupColor = getGroupColor(group.name, group.color);
                                const writingFiles = group.files.filter(f => f.isWriting && !f.isComplete);
                                
                                return (
                                    <div key={group.id} style={{
                                        marginBottom: groupIndex < tabGroups.length - 1 ? '1.5rem' : '0.5rem'
                                    }}>
                                        {/* Group Header */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem 1rem',
                                            marginBottom: '0.5rem',
                                            background: `linear-gradient(135deg, ${groupColor}15, ${groupColor}08)`,
                                            border: `1px solid ${groupColor}30`,
                                            borderRadius: '8px'
                                        }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                background: `linear-gradient(135deg, ${groupColor}30, ${groupColor}20)`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1rem',
                                                border: `1px solid ${groupColor}40`
                                            }}>
                                                {group.icon}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    color: groupColor,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    {group.name}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.7rem',
                                                    color: 'var(--text-gray)',
                                                    opacity: 0.8
                                                }}>
                                                    {group.files.length} file{group.files.length !== 1 ? 's' : ''}
                                                    {writingFiles.length > 0 && (
                                                        <span style={{ color: '#f97316', marginLeft: '0.5rem' }}>
                                                            • {writingFiles.length} generating
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Files in Group */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            {group.files.map((file, fileIndex) => {
                                                const isActive = ui.sidePane.isOpen && ui.sidePane.activeFile === file.fileName;
                                                const isWriting = file.isWriting && !file.isComplete;
                                                const isComplete = file.isComplete;
                                                
                                                return (
                                                    <div
                                                        key={file.fileName}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleTabClickWrapper(file.fileName, e);
                                                            setShowFilesDropdown(false);
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '1rem',
                                                            padding: '0.875rem 1rem',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            background: isActive 
                                                                ? `linear-gradient(135deg, ${groupColor}25, ${groupColor}15)` 
                                                                : 'transparent',
                                                            border: isActive 
                                                                ? `1px solid ${groupColor}50`
                                                                : `1px solid ${groupColor}15`,
                                                            transition: 'all 0.15s ease',
                                                            position: 'relative'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (!isActive) {
                                                                e.currentTarget.style.background = `linear-gradient(135deg, ${groupColor}15, ${groupColor}08)`;
                                                                e.currentTarget.style.borderColor = `${groupColor}30`;
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isActive) {
                                                                e.currentTarget.style.background = 'transparent';
                                                                e.currentTarget.style.borderColor = `${groupColor}15`;
                                                            }
                                                        }}
                                                    >
                                                        {/* File Icon */}
                                                        <div style={{
                                                            width: '36px',
                                                            height: '36px',
                                                            borderRadius: '8px',
                                                            background: isActive 
                                                                ? `linear-gradient(135deg, ${groupColor}40, ${groupColor}30)` 
                                                                : `linear-gradient(135deg, ${groupColor}20, ${groupColor}10)`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '1.1rem',
                                                            flexShrink: 0,
                                                            border: `1px solid ${groupColor}30`,
                                                            position: 'relative',
                                                            overflow: 'hidden'
                                                        }}>
                                                            {isWriting && (
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    inset: 0,
                                                                    background: `radial-gradient(circle, ${groupColor}40 0%, transparent 70%)`,
                                                                    animation: 'fileWritingGlow 1.5s ease-in-out infinite'
                                                                }} />
                                                            )}
                                                            <span style={{ position: 'relative', zIndex: 1 }}>
                                                                {file.icon}
                                                            </span>
                                                        </div>

                                                        {/* File Info */}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{
                                                                fontSize: '0.9rem',
                                                                color: isActive ? '#ffffff' : 'var(--text-light-gray)',
                                                                fontWeight: isActive ? 700 : 600,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                marginBottom: '0.25rem'
                                                            }}>
                                                                {file.displayName}
                                                            </div>
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem'
                                                            }}>
                                                                <div style={{
                                                                    fontSize: '0.7rem',
                                                                    color: 'var(--text-gray)',
                                                                    background: 'rgba(255,255,255,0.05)',
                                                                    padding: '0.15rem 0.4rem',
                                                                    borderRadius: '4px',
                                                                    fontWeight: 500,
                                                                    border: '1px solid rgba(255,255,255,0.1)'
                                                                }}>
                                                                    {file.language}
                                                                </div>
                                                                
                                                                {isWriting && (
                                                                    <div style={{
                                                                        fontSize: '0.7rem',
                                                                        color: '#f97316',
                                                                        background: 'rgba(249, 115, 22, 0.15)',
                                                                        padding: '0.15rem 0.4rem',
                                                                        borderRadius: '4px',
                                                                        fontWeight: 600,
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.3px',
                                                                        border: '1px solid rgba(249, 115, 22, 0.3)',
                                                                        animation: 'fileWritingPulse 1.5s ease-in-out infinite'
                                                                    }}>
                                                                        ⚡ Generating
                                                                    </div>
                                                                )}
                                                                
                                                                {isComplete && !isWriting && (
                                                                    <div style={{
                                                                        fontSize: '0.7rem',
                                                                        color: '#10b981',
                                                                        background: 'rgba(16, 185, 129, 0.1)',
                                                                        padding: '0.15rem 0.4rem',
                                                                        borderRadius: '4px',
                                                                        fontWeight: 600,
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.3px',
                                                                        border: '1px solid rgba(16, 185, 129, 0.3)'
                                                                    }}>
                                                                        ✓ Complete
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Active Indicator */}
                                                        {isActive && (
                                                            <div style={{
                                                                fontSize: '1rem',
                                                                color: groupColor,
                                                                opacity: 0.8
                                                            }}>
                                                                ▶
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <style>{`
                            @keyframes fileWritingGlow {
                                0%, 100% { 
                                    opacity: 0.4;
                                    transform: scale(1);
                                }
                                50% { 
                                    opacity: 0.8;
                                    transform: scale(1.1);
                                }
                            }
                            
                            @keyframes fileWritingPulse {
                                0%, 100% { 
                                    opacity: 0.8;
                                    box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4);
                                }
                                50% { 
                                    opacity: 1;
                                    box-shadow: 0 0 8px 2px rgba(249, 115, 22, 0.6);
                                }
                            }
                        `}</style>
                    </div>
                </PortalDropdown>

                {tabGroups.map((group, groupIndex) => {
                    const groupColor = getGroupColor(group.name, group.color);
                    
                    return (
                        <div key={group.id} className="tab-group" style={{
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'center',
                            position: 'relative',
                            flexShrink: 1,
                            minWidth: '0',
                            maxWidth: '500px',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '8px',
                            border: `1px solid ${groupColor}60`,
                            background: `${groupColor}10`
                        }}>
                            <div className="tab-group-label" style={{ 
                                fontSize: '0.7rem',
                                color: groupColor,
                                flexShrink: 0,
                                whiteSpace: 'nowrap',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                marginRight: '0.25rem',
                                opacity: 0.8
                            }}>
                                {group.icon} {group.name}
                            </div>
                            
                            <div 
                                ref={(el) => { 
                                    groupRefs.current[group.id] = el;
                                    // Restore scroll position on mount if available
                                    if (el && scrollPositions[group.id] !== undefined) {
                                        requestAnimationFrame(() => {
                                            el.scrollLeft = scrollPositions[group.id];
                                        });
                                    }
                                }}
                                style={{
                                    display: 'flex',
                                    gap: '0.25rem',
                                    flexWrap: 'nowrap',
                                    overflowX: 'auto',
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                    cursor: dragState?.groupId === group.id && dragState?.isDragging ? 'grabbing' : 'grab',
                                    maxWidth: '400px',
                                    minWidth: '0',
                                    flex: '1 1 0',
                                    position: 'relative',
                                    paddingRight: '5px',
                                    scrollBehavior: 'auto'
                                }}
                                onScroll={(e) => {
                                    const container = e.currentTarget;
                                    const hasScrollLeft = container.scrollLeft > 0;
                                    const hasScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth - 1);
                                    
                                    // Update mask based on scroll position
                                    if (hasScrollLeft && hasScrollRight) {
                                        container.style.maskImage = 'linear-gradient(to right, transparent 0px, black 20px, black calc(100% - 20px), transparent 100%)';
                                        (container.style as any).webkitMaskImage = 'linear-gradient(to right, transparent 0px, black 20px, black calc(100% - 20px), transparent 100%)';
                                    } else if (hasScrollLeft) {
                                        container.style.maskImage = 'linear-gradient(to right, transparent 0px, black 20px, black 100%)';
                                        (container.style as any).webkitMaskImage = 'linear-gradient(to right, transparent 0px, black 20px, black 100%)';
                                    } else if (hasScrollRight) {
                                        container.style.maskImage = 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)';
                                        (container.style as any).webkitMaskImage = 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)';
                                    } else {
                                        container.style.maskImage = 'none';
                                        (container.style as any).webkitMaskImage = 'none';
                                    }
                                }}
                                onMouseDown={(e) => handleMouseDown(e, group.id)}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseLeave}
                            >
                                {group.files.map((file, fileIndex) => {
                                    const isActive = ui.sidePane.isOpen && ui.sidePane.activeFile === file.fileName;
                                    const isWriting = file.isWriting && !file.isComplete;
                                    const isComplete = file.isComplete;
                                    
                                    return (
                                        <div
                                            key={file.fileName}
                                            ref={(el) => { tabRefs.current[file.fileName] = el; }}
                                            className={`file-tab-item ${isActive ? 'active' : ''} ${isWriting ? 'writing' : ''} ${isComplete ? 'complete' : 'detected'}`}
                                            onClick={(e) => {
                                                // Prevent click if we just finished dragging
                                                if (isDraggingRef.current) {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    return;
                                                }
                                                handleTabClickWrapper(file.fileName, e);
                                            }}
                                            title={file.fileName} // Tooltip with full file name
                                            style={{
                                                animationDelay: `${(groupIndex * group.files.length + fileIndex) * 100}ms`,
                                                position: 'relative',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                color: 'var(--text-gray)',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                userSelect: 'none',
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                opacity: 1,
                                                transform: 'translateY(0)',
                                                overflow: 'hidden',
                                                flexShrink: 0,
                                                maxWidth: '120px',
                                                minWidth: '60px'
                                            }}
                                        >
                                            <span className="tab-icon" style={{
                                                fontSize: '0.8rem',
                                                opacity: 0.8,
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                position: 'relative',
                                                flexShrink: 0
                                            }}>
                                                {file.icon}
                                            </span>
                                            <span className="tab-name" style={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: '70px',
                                                fontWeight: 500,
                                                transition: 'font-weight 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}>
                                                {file.displayName}
                                            </span>
                                            
                                            {isWriting && (
                                                <div className="progress-indicator" style={{
                                                    position: 'absolute',
                                                    bottom: '0px',
                                                    left: '0',
                                                    right: '0',
                                                    height: '2px',
                                                    background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-green))',
                                                    borderRadius: '1px',
                                                    opacity: 0.9
                                                }} />
                                            )}
                                            
                                            {isComplete && (
                                                <div className="complete-indicator" style={{
                                                    position: 'absolute',
                                                    top: '4px',
                                                    right: '4px',
                                                    width: '6px',
                                                    height: '6px',
                                                    background: 'var(--accent-green)',
                                                    borderRadius: '50%',
                                                    opacity: 0.9,
                                                    flexShrink: 0,
                                                    boxShadow: '0 0 4px rgba(16, 185, 129, 0.4)'
                                                }} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                .tab-container::-webkit-scrollbar,
                div::-webkit-scrollbar {
                    display: none;
                }

                .file-tab-item {
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    animation: none;
                    transform: translateY(0);
                }

                .file-tab-item.detected {
                    background: rgba(16, 185, 129, 0.06);
                    border-color: rgba(16, 185, 129, 0.2);
                    animation: gentleDetected 3s ease-in-out infinite;
                }

                .file-tab-item.writing {
                    background: rgba(255, 107, 53, 0.15);
                    border-color: rgba(255, 107, 53, 0.6);
                    animation: writingPulse 1.5s ease-in-out infinite;
                    box-shadow: 0 0 20px rgba(255, 107, 53, 0.4), 0 4px 16px rgba(255, 107, 53, 0.3), inset 0 0 20px rgba(255, 107, 53, 0.1);
                    transform: translateY(0) scale(1);
                    position: relative;
                    z-index: 10;
                }
                
                .file-tab-item.writing::before {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    border-radius: 8px;
                    padding: 2px;
                    background: linear-gradient(45deg, rgba(255, 107, 53, 0.8), rgba(249, 115, 22, 0.8), rgba(255, 107, 53, 0.8));
                    background-size: 200% 200%;
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    animation: writingBorderGlow 2s linear infinite;
                    z-index: -1;
                }

                .file-tab-item.complete {
                    background: rgba(16, 185, 129, 0.08);
                    border-color: rgba(16, 185, 129, 0.3);
                    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.2);
                    animation: completePulse 1s ease-out;
                }

                .progress-indicator {
                    animation: progressFlow 2.5s ease-in-out infinite;
                }

                .complete-indicator {
                    animation: completeBlink 0.8s ease-out;
                }

                .file-tab-item:not(.active):hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 107, 53, 0.25);
                    color: var(--text-light-gray);
                    transform: translateY(-1px);
                    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
                }

                .file-tab-item.active {
                    background: linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(16, 185, 129, 0.06));
                    border-color: var(--accent-orange);
                    color: #ffffff;
                    box-shadow: 0 3px 12px rgba(255, 107, 53, 0.25);
                    animation: none;
                    transform: translateY(-1px);
                }

                .file-tab-item.active::after {
                    content: '';
                    position: absolute;
                    bottom: 0px;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, var(--accent-orange), var(--accent-green));
                    border-radius: 1px;
                }

                .file-tab-item.active .tab-icon {
                    opacity: 1;
                    transform: scale(1.1);
                }

                .file-tab-item.active .tab-name {
                    font-weight: 600;
                }

                @keyframes gentleDetected {
                    0%, 100% { 
                        opacity: 0.85;
                        border-color: rgba(16, 185, 129, 0.2);
                    }
                    50% { 
                        opacity: 1;
                        border-color: rgba(16, 185, 129, 0.35);
                    }
                }

                @keyframes writingPulse {
                    0%, 100% { 
                        opacity: 1;
                        border-color: rgba(255, 107, 53, 0.6);
                        box-shadow: 0 0 20px rgba(255, 107, 53, 0.4), 0 4px 16px rgba(255, 107, 53, 0.3), inset 0 0 20px rgba(255, 107, 53, 0.1);
                        transform: translateY(0) scale(1);
                    }
                    50% { 
                        opacity: 1;
                        border-color: rgba(255, 107, 53, 0.9);
                        box-shadow: 0 0 35px rgba(255, 107, 53, 0.7), 0 4px 20px rgba(255, 107, 53, 0.5), inset 0 0 25px rgba(255, 107, 53, 0.2);
                        transform: translateY(0) scale(1.01);
                    }
                }
                
                @keyframes writingBorderGlow {
                    0% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                    100% {
                        background-position: 0% 50%;
                    }
                }
                
                @keyframes badgePulse {
                    0%, 100% {
                        opacity: 0.8;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.05);
                    }
                }

                @keyframes completePulse {
                    0% { 
                        transform: scale(1);
                        box-shadow: 0 2px 6px rgba(16, 185, 129, 0.2);
                    }
                    50% { 
                        transform: scale(1.02);
                        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                    }
                    100% { 
                        transform: scale(1);
                        box-shadow: 0 2px 6px rgba(16, 185, 129, 0.2);
                    }
                }

                @keyframes progressFlow {
                    0% { 
                        width: 0%; 
                        opacity: 0.7;
                    }
                    50% { 
                        width: 70%; 
                        opacity: 1;
                    }
                    100% { 
                        width: 100%; 
                        opacity: 0.9;
                    }
                }

                @keyframes completeBlink {
                    0% { 
                        opacity: 0;
                        transform: scale(0.3);
                        box-shadow: 0 0 0px rgba(16, 185, 129, 0.4);
                    }
                    50% { 
                        opacity: 1;
                        transform: scale(1.3);
                        box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
                    }
                    100% { 
                        opacity: 0.9;
                        transform: scale(1);
                        box-shadow: 0 0 4px rgba(16, 185, 129, 0.4);
                    }
                }

                @media (max-width: 768px) {
                    .file-tab-item {
                        padding: 0.4rem 0.6rem;
                        font-size: 0.7rem;
                        max-width: 100px;
                        min-width: 50px;
                        gap: 0.25rem;
                    }
                    
                    .tab-group-label {
                        font-size: 0.65rem;
                    }

                    .file-tab-item .tab-name {
                        max-width: 50px;
                    }
                }

                @media (max-width: 480px) {
                    .file-tab-item {
                        max-width: 80px;
                        font-size: 0.65rem;
                        padding: 0.3rem 0.5rem;
                    }
                }
            `}</style>
        </div>
    );
};