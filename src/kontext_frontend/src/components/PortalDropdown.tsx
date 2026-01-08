import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface PortalDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  placement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center' | 'auto';
  offset?: { x: number; y: number };
  className?: string;
  style?: React.CSSProperties;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  backdrop?: boolean;
  zIndex?: number;
}

interface CalculatedPosition {
  top: number;
  left: number;
  right: string | number;
  transformOrigin: string;
  arrowPosition: {
    show: boolean;
    side: 'top' | 'bottom' | 'left' | 'right';
    offset: number;
  };
  animationDirection: 'up' | 'down' | 'left' | 'right';
}

export const PortalDropdown: React.FC<PortalDropdownProps> = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  placement = 'auto',
  offset = { x: 0, y: 8 },
  className = '',
  style = {},
  closeOnClickOutside = true,
  closeOnEscape = true,
  backdrop = false,
  zIndex = 10000
}) => {
  const [position, setPosition] = useState<CalculatedPosition>({
    top: 0,
    left: 0,
    right: 'auto',
    transformOrigin: 'top center',
    arrowPosition: { show: false, side: 'top', offset: 0 },
    animationDirection: 'down'
  });
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalRoot = useRef<HTMLDivElement | null>(null);

  // Ensure portal root exists
  useEffect(() => {
    if (!portalRoot.current) {
      let existingPortalRoot = document.getElementById('portal-root') as HTMLDivElement;
      if (!existingPortalRoot) {
        existingPortalRoot = document.createElement('div');
        existingPortalRoot.id = 'portal-root';
        existingPortalRoot.style.position = 'absolute';
        existingPortalRoot.style.top = '0';
        existingPortalRoot.style.left = '0';
        existingPortalRoot.style.width = '100%';
        existingPortalRoot.style.height = '100%';
        existingPortalRoot.style.pointerEvents = 'none';
        existingPortalRoot.style.zIndex = '9999';
        document.body.appendChild(existingPortalRoot);
      }
      portalRoot.current = existingPortalRoot;
    }
    setMounted(true);
  }, []);

  // Enhanced viewport-aware position calculation
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !mounted) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Mobile-optimized constants
    const MOBILE_MARGIN = 16; // Minimum distance from viewport edges
    const DROPDOWN_ESTIMATED_WIDTH = 320; // Estimated dropdown width
    const DROPDOWN_ESTIMATED_HEIGHT = 300; // Estimated dropdown height
    const ARROW_SIZE = 8; // Size of visual indicator arrow
    
    // Detect if we're in mobile mode
    const isMobile = viewportWidth <= 768;
    const margin = isMobile ? MOBILE_MARGIN : 8;
    
    let calculatedPosition: CalculatedPosition = {
      top: 0,
      left: 0,
      right: 'auto',
      transformOrigin: 'top center',
      arrowPosition: { show: false, side: 'top', offset: 0 },
      animationDirection: 'down'
    };

    if (isMobile && placement === 'auto') {
      // MOBILE-SPECIFIC SMART POSITIONING
      
      // Calculate available space in each direction
      const spaceLeft = triggerRect.left;
      const spaceRight = viewportWidth - triggerRect.right;
      const spaceTop = triggerRect.top;
      const spaceBottom = viewportHeight - triggerRect.bottom;
      
      // Calculate trigger center relative to viewport
      const triggerCenterX = triggerRect.left + (triggerRect.width / 2);
      const triggerCenterY = triggerRect.top + (triggerRect.height / 2);
      
      // Determine optimal horizontal positioning
      let horizontalStrategy: 'left' | 'center' | 'right' | 'full-width' = 'center';
      let dropdownLeft = 0;
      let dropdownRight: string | number = 'auto';
      
      // Check if dropdown would overflow on right
      if (triggerCenterX + (DROPDOWN_ESTIMATED_WIDTH / 2) > viewportWidth - margin) {
        horizontalStrategy = 'right';
      }
      // Check if dropdown would overflow on left  
      else if (triggerCenterX - (DROPDOWN_ESTIMATED_WIDTH / 2) < margin) {
        horizontalStrategy = 'left';
      }
      // Check if dropdown is too wide for viewport
      else if (DROPDOWN_ESTIMATED_WIDTH + (margin * 2) > viewportWidth) {
        horizontalStrategy = 'full-width';
      }
      
      // Apply horizontal positioning strategy
      switch (horizontalStrategy) {
        case 'left':
          // Align dropdown left edge with safe margin
          dropdownLeft = margin;
          calculatedPosition.transformOrigin = `${triggerCenterX - margin}px top`;
          calculatedPosition.arrowPosition = {
            show: true,
            side: 'top',
            offset: Math.max(20, Math.min(triggerCenterX - margin - 10, DROPDOWN_ESTIMATED_WIDTH - 30))
          };
          break;
          
        case 'right':
          // Align dropdown right edge with safe margin
          dropdownRight = margin;
          dropdownLeft = 'auto' as any;
          calculatedPosition.transformOrigin = `${viewportWidth - margin - (triggerCenterX - (viewportWidth - DROPDOWN_ESTIMATED_WIDTH - margin))}px top`;
          calculatedPosition.arrowPosition = {
            show: true,
            side: 'top',
            offset: Math.max(20, Math.min(viewportWidth - margin - triggerCenterX - 10, DROPDOWN_ESTIMATED_WIDTH - 30))
          };
          break;
          
        case 'full-width':
          // Use full width with margins
          dropdownLeft = margin;
          dropdownRight = margin;
          calculatedPosition.transformOrigin = `${triggerCenterX - margin}px top`;
          calculatedPosition.arrowPosition = {
            show: true,
            side: 'top',
            offset: Math.max(20, Math.min(triggerCenterX - margin - 10, viewportWidth - (margin * 2) - 30))
          };
          break;
          
        default: // center
          // Center dropdown under trigger
          dropdownLeft = triggerCenterX - (DROPDOWN_ESTIMATED_WIDTH / 2);
          calculatedPosition.transformOrigin = 'center top';
          calculatedPosition.arrowPosition = {
            show: true,
            side: 'top',
            offset: (DROPDOWN_ESTIMATED_WIDTH / 2) - 10
          };
          break;
      }
      
      // Determine vertical positioning
      let dropdownTop = 0;
      let verticalStrategy: 'below' | 'above' = 'below';
      
      // Check if there's enough space below
      if (spaceBottom < DROPDOWN_ESTIMATED_HEIGHT + margin) {
        // Not enough space below, try above
        if (spaceTop >= DROPDOWN_ESTIMATED_HEIGHT + margin) {
          verticalStrategy = 'above';
        }
        // If not enough space above either, use below but constrain height
      }
      
      if (verticalStrategy === 'above') {
        dropdownTop = triggerRect.top - DROPDOWN_ESTIMATED_HEIGHT - offset.y;
        calculatedPosition.transformOrigin = calculatedPosition.transformOrigin.replace('top', 'bottom');
        calculatedPosition.arrowPosition.side = 'bottom';
        calculatedPosition.animationDirection = 'up';
        
        // Ensure doesn't go above viewport
        if (dropdownTop < margin) {
          dropdownTop = margin;
        }
      } else {
        dropdownTop = triggerRect.bottom + offset.y;
        calculatedPosition.animationDirection = 'down';
        
        // Ensure doesn't go below viewport
        const maxTop = viewportHeight - DROPDOWN_ESTIMATED_HEIGHT - margin;
        if (dropdownTop > maxTop) {
          dropdownTop = Math.max(maxTop, triggerRect.top - DROPDOWN_ESTIMATED_HEIGHT - offset.y);
          if (dropdownTop === Math.max(maxTop, triggerRect.top - DROPDOWN_ESTIMATED_HEIGHT - offset.y) && dropdownTop !== maxTop) {
            calculatedPosition.transformOrigin = calculatedPosition.transformOrigin.replace('top', 'bottom');
            calculatedPosition.arrowPosition.side = 'bottom';
            calculatedPosition.animationDirection = 'up';
          }
        }
      }
      
      calculatedPosition.top = dropdownTop;
      calculatedPosition.left = dropdownLeft as number;
      calculatedPosition.right = dropdownRight;
      
    } else {
      // DESKTOP FALLBACK - Original logic
      let top = 0;
      let left = 0;
      let right: string | number = 'auto';

      switch (placement) {
        case 'bottom-right':
          top = triggerRect.bottom + offset.y;
          left = triggerRect.right + offset.x;
          if (left + 300 > viewportWidth) {
            right = viewportWidth - triggerRect.right + offset.x;
            left = 'auto' as any;
          }
          break;
        case 'bottom-left':
          top = triggerRect.bottom + offset.y;
          left = triggerRect.left + offset.x;
          break;
        case 'bottom-center':
          top = triggerRect.bottom + offset.y;
          left = triggerRect.left + (triggerRect.width / 2) + offset.x;
          break;
        case 'top-right':
          top = triggerRect.top - offset.y;
          left = triggerRect.right + offset.x;
          break;
        case 'top-left':
          top = triggerRect.top - offset.y;
          left = triggerRect.left + offset.x;
          break;
        default:
          top = triggerRect.bottom + offset.y;
          left = triggerRect.left + offset.x;
      }

      if (top + 400 > viewportHeight && triggerRect.top > 400) {
        top = triggerRect.top - 400 - offset.y;
      }
      if (top < 0) {
        top = 8;
      }

      calculatedPosition = {
        top,
        left: left as number,
        right,
        transformOrigin: 'top left',
        arrowPosition: { show: false, side: 'top', offset: 0 },
        animationDirection: 'down'
      };
    }

    setPosition(calculatedPosition);
  }, [triggerRef, placement, offset, mounted]);

  // Update position when dropdown opens or window resizes
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      
      const handleResize = () => calculatePosition();
      const handleScroll = () => calculatePosition();
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isOpen, calculatePosition]);

  // Handle click outside - supports both mouse and touch events for mobile
  useEffect(() => {
    if (isOpen && closeOnClickOutside) {
      const handleClickOutside = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Node;
        
        if (triggerRef.current?.contains(target)) {
          return;
        }
        
        if (dropdownRef.current?.contains(target)) {
          return;
        }
        
        onClose();
      };

      const timeoutId = setTimeout(() => {
        // Add both mouse and touch event listeners for mobile support
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isOpen, closeOnClickOutside, onClose, triggerRef]);

  // Handle escape key
  useEffect(() => {
    if (isOpen && closeOnEscape) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, closeOnEscape, onClose]);

  if (!mounted || !portalRoot.current || !isOpen) {
    return null;
  }

  return createPortal(
    <>
      {/* Backdrop */}
      {backdrop && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: zIndex - 1,
            pointerEvents: 'auto',
            backdropFilter: 'blur(4px)'
          }}
          onClick={(e) => {
            // Only close if clicking directly on backdrop, not on dropdown content
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
          onTouchStart={(e) => {
            // Only close if touching directly on backdrop, not on dropdown content
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        />
      )}
      
      {/* Visual Connection Arrow */}
      {position.arrowPosition.show && (
        <div
          style={{
            position: 'fixed',
            top: position.arrowPosition.side === 'top' 
              ? position.top - 8 
              : position.top + (position.arrowPosition.side === 'bottom' ? 300 : 0),
            left: position.left !== 'auto' 
              ? (position.left as number) + position.arrowPosition.offset
              : 'auto',
            right: position.right !== 'auto' && position.left === 'auto'
              ? (position.right as number) + position.arrowPosition.offset
              : 'auto',
            width: '16px',
            height: '8px',
            zIndex: zIndex + 1,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              width: '0',
              height: '0',
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderBottom: position.arrowPosition.side === 'top' 
                ? '8px solid rgb(10, 10, 10)' 
                : 'none',
              borderTop: position.arrowPosition.side === 'bottom' 
                ? '8px solid rgb(10, 10, 10)' 
                : 'none',
              filter: 'drop-shadow(0 -2px 4px rgba(0, 0, 0, 0.2))'
            }}
          />
        </div>
      )}
      
      {/* Dropdown Content */}
      <div
        ref={dropdownRef}
        className={`portal-dropdown ${className}`}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left !== 'auto' ? position.left : undefined,
          right: position.right !== 'auto' ? position.right : undefined,
          zIndex: zIndex,
          pointerEvents: 'auto',
          transformOrigin: position.transformOrigin,
          animation: `dropdownEnter-${position.animationDirection} 0.2s ease-out`,
          ...style
        }}
      >
        {children}
      </div>

      {/* Enhanced Animations */}
      <style jsx>{`
        @keyframes dropdownEnter-down {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes dropdownEnter-up {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes dropdownEnter-left {
          from {
            opacity: 0;
            transform: translateX(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes dropdownEnter-right {
          from {
            opacity: 0;
            transform: translateX(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </>,
    portalRoot.current
  );
};