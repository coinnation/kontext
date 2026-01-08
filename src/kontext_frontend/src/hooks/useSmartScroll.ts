import { useRef, useCallback, useEffect } from 'react';

interface ScrollState {
  isUserScrolling: boolean;
  isNearBottom: boolean;
  isScrolling: boolean;
  lastScrollTime: number;
  lastForceScrollTime: number;
}

interface UseSmartScrollOptions {
  threshold?: number;
  debounceMs?: number;
  mobileOffset?: number;
  behavior?: ScrollBehavior;
}

type ScrollMode = 'auto' | 'user-initiated' | 'system-response' | 'manual-button' | 'force';

interface MobileViewportInfo {
  height: number;
  safeAreaBottom: number;
  safeAreaTop: number;
  keyboardHeight: number;
  actualViewportHeight: number;
  isMobile: boolean;
  isIOS: boolean;
  isKeyboardVisible: boolean;
}

export const useSmartScroll = (options: UseSmartScrollOptions = {}) => {
  const {
    threshold = 100,
    debounceMs = 150,
    mobileOffset = 120, // Base offset - will be enhanced dynamically
    behavior = 'smooth'
  } = options;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollStateRef = useRef<ScrollState>({
    isUserScrolling: false,
    isNearBottom: true,
    isScrolling: false,
    lastScrollTime: 0,
    lastForceScrollTime: 0
  });

  const pendingScrollRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRequestIdRef = useRef<number>(0);

  // Enhanced mobile detection with iOS-specific handling
  const isMobile = useCallback(() => {
    return window.innerWidth <= 768;
  }, []);

  const isIOS = useCallback(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);

  // Comprehensive mobile viewport information
  const getMobileViewportInfo = useCallback((): MobileViewportInfo => {
    const mobile = isMobile();
    const iOS = isIOS();
    
    let viewportHeight = window.innerHeight;
    let actualViewportHeight = viewportHeight;
    let safeAreaBottom = 0;
    let safeAreaTop = 0;
    let keyboardHeight = 0;
    let isKeyboardVisible = false;

    // Use visual viewport for better mobile support
    if (mobile && window.visualViewport) {
      actualViewportHeight = window.visualViewport.height;
      viewportHeight = window.innerHeight; // Layout viewport
      
      // Detect keyboard on mobile
      const heightDifference = viewportHeight - actualViewportHeight;
      if (heightDifference > 150) { // Threshold for keyboard detection
        isKeyboardVisible = true;
        keyboardHeight = heightDifference;
      }
    }

    // Enhanced safe area detection
    if (typeof window !== 'undefined') {
      const computedStyle = getComputedStyle(document.documentElement);
      
      // Try multiple ways to get safe area insets
      const safeAreaInsetBottom = 
        computedStyle.getPropertyValue('env(safe-area-inset-bottom)') ||
        computedStyle.getPropertyValue('constant(safe-area-inset-bottom)');
      
      const safeAreaInsetTop = 
        computedStyle.getPropertyValue('env(safe-area-inset-top)') ||
        computedStyle.getPropertyValue('constant(safe-area-inset-top)');
      
      if (safeAreaInsetBottom) {
        safeAreaBottom = parseInt(safeAreaInsetBottom.replace('px', ''), 10) || 0;
      }
      
      if (safeAreaInsetTop) {
        safeAreaTop = parseInt(safeAreaInsetTop.replace('px', ''), 10) || 0;
      }
      
      // iOS specific adjustments
      if (iOS && safeAreaBottom === 0) {
        // Fallback for older iOS versions or when CSS env() isn't working
        safeAreaBottom = 34; // Standard iOS home indicator height
      }
    }

    return {
      height: viewportHeight,
      actualViewportHeight,
      safeAreaBottom,
      safeAreaTop,
      keyboardHeight,
      isMobile: mobile,
      isIOS: iOS,
      isKeyboardVisible
    };
  }, [isMobile, isIOS]);

  // Calculate dynamic scroll offset based on scenario and viewport
  const calculateScrollOffset = useCallback((mode: ScrollMode, viewport: MobileViewportInfo): number => {
    if (!viewport.isMobile) {
      // Desktop offsets
      switch (mode) {
        case 'user-initiated':
        case 'system-response':
        case 'force':
          return 50;
        case 'manual-button':
          return 30;
        default:
          return 20;
      }
    }

    // Mobile offsets - much more aggressive
    let baseOffset = mobileOffset;
    
    switch (mode) {
      case 'user-initiated':
        // User just submitted - be very aggressive
        baseOffset = 300;
        break;
      case 'system-response':
        // System generating content - be aggressive
        baseOffset = 250;
        break;
      case 'manual-button':
        // User clicked scroll button - be moderately aggressive
        baseOffset = 200;
        break;
      case 'force':
        // Force scroll - be extremely aggressive
        baseOffset = 350;
        break;
      default:
        baseOffset = 180;
    }

    // Add dynamic adjustments
    let totalOffset = baseOffset;
    
    // Add safe area
    totalOffset += viewport.safeAreaBottom;
    
    // Add extra space for keyboard if visible
    if (viewport.isKeyboardVisible) {
      totalOffset += 50;
    }
    
    // iOS specific adjustments
    if (viewport.isIOS) {
      totalOffset += 30; // Extra space for iOS Safari quirks
    }
    
    // Add extra space for chat input area (estimated)
    totalOffset += 120;
    
    // console.log(`📱 [SmartScroll] Mobile offset calculation:`, {
    //   mode,
    //   baseOffset,
    //   safeArea: viewport.safeAreaBottom,
    //   keyboard: viewport.isKeyboardVisible ? 50 : 0,
    //   iOS: viewport.isIOS ? 30 : 0,
    //   chatInput: 120,
    //   totalOffset
    // });
    
    return totalOffset;
  }, [mobileOffset]);

  // Enhanced scroll to bottom with mode-specific behavior
  const scrollToBottom = useCallback((mode: ScrollMode = 'auto', forceImmediate = false) => {
    const now = Date.now();
    const requestId = ++scrollRequestIdRef.current;

    // console.log(`📜 [SmartScroll] Scroll request:`, {
    //   mode,
    //   forceImmediate,
    //   requestId,
    //   isScrolling: scrollStateRef.current.isScrolling
    // });

    // Handle immediate force scrolls (scenarios 2 & 3)
    if (forceImmediate || mode === 'user-initiated' || mode === 'system-response' || mode === 'force') {
      // Clear any pending scrolls
      if (pendingScrollRef.current) {
        clearTimeout(pendingScrollRef.current);
        pendingScrollRef.current = null;
      }
      
      // Bypass debouncing for critical scenarios
      performScroll(mode, requestId, now);
      return;
    }

    // Apply debouncing for non-critical scrolls
    if (now - scrollStateRef.current.lastScrollTime < debounceMs && !forceImmediate) {
      if (pendingScrollRef.current) {
        clearTimeout(pendingScrollRef.current);
      }
      
      pendingScrollRef.current = setTimeout(() => {
        if (scrollRequestIdRef.current === requestId) {
          performScroll(mode, requestId, now);
        }
      }, debounceMs);
      return;
    }

    performScroll(mode, requestId, now);
  }, [debounceMs]);

  // The actual scroll execution
  const performScroll = useCallback((mode: ScrollMode, requestId: number, timestamp: number) => {
    const container = scrollContainerRef.current;
    const messagesEnd = messagesEndRef.current;

    if (!container || !messagesEnd) {
      // console.warn(`📜 [SmartScroll] Missing DOM elements for scroll`);
      return;
    }

    // For force modes, ignore current scroll state
    const shouldRespectUserScroll = mode === 'auto' && 
      scrollStateRef.current.isUserScrolling && 
      !scrollStateRef.current.isNearBottom;
    
    if (shouldRespectUserScroll && mode !== 'force') {
      // console.log(`📜 [SmartScroll] Respecting user scroll state, skipping`);
      return;
    }

    // Don't interrupt ongoing scrolls unless it's a force mode
    if (scrollStateRef.current.isScrolling && !['user-initiated', 'system-response', 'force'].includes(mode)) {
      // console.log(`📜 [SmartScroll] Already scrolling, skipping non-critical scroll`);
      return;
    }

    scrollStateRef.current.isScrolling = true;
    scrollStateRef.current.lastScrollTime = timestamp;
    
    if (['user-initiated', 'system-response', 'force'].includes(mode)) {
      scrollStateRef.current.lastForceScrollTime = timestamp;
    }

    const viewport = getMobileViewportInfo();
    const scrollOffset = calculateScrollOffset(mode, viewport);

    try {
      if (viewport.isMobile) {
        // Mobile-specific scrolling with enhanced calculations
        const containerRect = container.getBoundingClientRect();
        const messagesEndRect = messagesEnd.getBoundingClientRect();
        
        // Calculate precise scroll position
        const targetScrollTop = container.scrollTop + 
          messagesEndRect.bottom - 
          containerRect.bottom + 
          scrollOffset;
        
        const finalScrollTop = Math.max(0, targetScrollTop);
        
        // console.log(`📱 [SmartScroll] Mobile scroll execution:`, {
        //   mode,
        //   currentScrollTop: container.scrollTop,
        //   targetScrollTop,
        //   finalScrollTop,
        //   scrollOffset,
        //   containerHeight: containerRect.height,
        //   messagesEndBottom: messagesEndRect.bottom,
        //   viewport
        // });
        
        // Use scrollTo for precise control on mobile
        container.scrollTo({
          top: finalScrollTop,
          behavior: behavior
        });
      } else {
        // Desktop scrolling with enhanced offset
        // console.log(`💻 [SmartScroll] Desktop scroll execution:`, {
        //   mode,
        //   scrollOffset
        // });
        
        // Scroll to bottom with offset
        const maxScrollTop = container.scrollHeight - container.clientHeight;
        const targetScrollTop = Math.max(0, maxScrollTop);
        
        container.scrollTo({
          top: targetScrollTop,
          behavior: behavior
        });
      }

      // Reset scrolling flag after animation completes
      const resetDelay = behavior === 'smooth' ? 800 : 100;
      setTimeout(() => {
        scrollStateRef.current.isScrolling = false;
        console.log(`📜 [SmartScroll] Scroll completed for mode: ${mode}`);
      }, resetDelay);

    } catch (error) {
      // console.error('📜 [SmartScroll] Scroll execution error:', error);
      scrollStateRef.current.isScrolling = false;
    }
  }, [behavior, getMobileViewportInfo, calculateScrollOffset]);

  // Immediate scroll for critical scenarios (no debouncing, no conditions)
  const forceScrollToBottom = useCallback((mode: ScrollMode = 'force') => {
    // console.log(`🚀 [SmartScroll] Force scroll triggered:`, mode);
    scrollToBottom(mode, true);
  }, [scrollToBottom]);

  // Scroll for user-initiated actions (scenario 2)
  const scrollForUserAction = useCallback(() => {
    // console.log(`👤 [SmartScroll] User action scroll triggered`);
    forceScrollToBottom('user-initiated');
  }, [forceScrollToBottom]);

  // Scroll for system responses (scenarios 3 & 4)
  const scrollForSystemResponse = useCallback(() => {
    // ✅ NEW: Respect user scrolling - don't auto-scroll if user scrolled up
    if (scrollStateRef.current.isUserScrolling && !scrollStateRef.current.isNearBottom) {
      // console.log(`🤖 [SmartScroll] User is scrolling up - skipping auto-scroll`);
      return;
    }
    // console.log(`🤖 [SmartScroll] System response scroll triggered`);
    forceScrollToBottom('system-response');
  }, [forceScrollToBottom]);

  // Scroll for manual button click (scenario 1)
  const scrollForManualButton = useCallback(() => {
    // console.log(`🔘 [SmartScroll] Manual button scroll triggered`);
    forceScrollToBottom('manual-button');
  }, [forceScrollToBottom]);

  // Handle scroll events with enhanced mobile detection
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // Use dynamic threshold based on viewport
    const viewport = getMobileViewportInfo();
    const dynamicThreshold = viewport.isMobile ? threshold * 1.5 : threshold;
    
    const nearBottom = distanceFromBottom < dynamicThreshold;
    const wasNearBottom = scrollStateRef.current.isNearBottom;
    
    scrollStateRef.current.isNearBottom = nearBottom;
    
    // Update user scrolling state
    if (!nearBottom && !scrollStateRef.current.isUserScrolling && !scrollStateRef.current.isScrolling) {
      scrollStateRef.current.isUserScrolling = true;
    }
    
    if (nearBottom && scrollStateRef.current.isUserScrolling) {
      scrollStateRef.current.isUserScrolling = false;
    }

  }, [threshold, getMobileViewportInfo]);

  // Setup scroll listener with passive option for better performance
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial state calculation
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Enhanced visual viewport change listener for mobile
  useEffect(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      const handleViewportChange = () => {
        // Recalculate scroll position when viewport changes (keyboard show/hide)
        setTimeout(() => {
          if (scrollStateRef.current.isNearBottom) {
            forceScrollToBottom('system-response');
          }
        }, 100);
      };

      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);

      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      };
    }
  }, [forceScrollToBottom]);

  // Cleanup pending scrolls on unmount
  useEffect(() => {
    return () => {
      if (pendingScrollRef.current) {
        clearTimeout(pendingScrollRef.current);
      }
    };
  }, []);

  // Enhanced auto-scroll that handles content changes intelligently
  const autoScroll = useCallback((contentChanged = true) => {
    // ✅ NEW: Only auto-scroll if user is near bottom - respect user scrolling up
    if (scrollStateRef.current.isNearBottom && !scrollStateRef.current.isUserScrolling) {
      scrollToBottom('auto');
    }
  }, [scrollToBottom]);

  return {
    scrollContainerRef,
    messagesEndRef,
    scrollToBottom,
    forceScrollToBottom,
    scrollForUserAction,
    scrollForSystemResponse,
    scrollForManualButton,
    autoScroll,
    isUserScrolling: scrollStateRef.current.isUserScrolling,
    isNearBottom: scrollStateRef.current.isNearBottom,
    handleScroll
  };
};