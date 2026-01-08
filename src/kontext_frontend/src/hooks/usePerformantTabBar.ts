import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useTabBarState, useUITransientActions, useDebouncedAction } from './useSelectiveStore';

interface DragState {
  isDragging: boolean;
  startX: number;
  scrollLeft: number;
  groupId: string;
}

interface UsePerformantTabBarOptions {
  projectId: string | null;
  isMobile: boolean;
  onTabClick: (fileName: string) => void;
}

export const usePerformantTabBar = ({ projectId, isMobile, onTabClick }: UsePerformantTabBarOptions) => {
  // Use selective state subscription
  const { tabGroups, dragState, scrollPositions, isGenerating, activeFile } = useTabBarState(projectId);
  const { updateDragState, updateScrollPosition, updateAnimationState, updateLayoutMetrics } = useUITransientActions();

  // Refs for DOM elements and state that shouldn't trigger re-renders
  const groupRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const tabRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const animationFrameRef = useRef<number>();
  const lastScrollUpdate = useRef<number>(Date.now());

  // Debounced actions to prevent excessive updates
  const debouncedScrollUpdate = useDebouncedAction(updateScrollPosition, 16); // ~60fps
  const debouncedLayoutUpdate = useDebouncedAction(updateLayoutMetrics, 100);

  // Mouse event handlers that don't cause re-renders
  const handleMouseDown = useCallback((e: React.MouseEvent, groupId: string) => {
    if (isMobile) return;
    
    const container = groupRefs.current[groupId];
    if (!container) return;

    const newDragState: DragState = {
      isDragging: true,
      startX: e.pageX - container.offsetLeft,
      scrollLeft: container.scrollLeft,
      groupId
    };
    
    updateDragState(newDragState);
    container.style.cursor = 'grabbing';
    e.preventDefault();
  }, [isMobile, updateDragState]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMobile || !dragState?.isDragging) return;
    
    const container = groupRefs.current[dragState.groupId];
    if (!container) return;

    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - dragState.startX) * 2;
    const newScrollLeft = dragState.scrollLeft - walk;
    
    container.scrollLeft = newScrollLeft;
    
    // Throttle scroll position updates
    const now = Date.now();
    if (now - lastScrollUpdate.current > 16) { // ~60fps
      debouncedScrollUpdate(dragState.groupId, newScrollLeft);
      lastScrollUpdate.current = now;
    }
  }, [isMobile, dragState, debouncedScrollUpdate]);

  const handleMouseUp = useCallback(() => {
    if (isMobile || !dragState?.isDragging) return;
    
    const container = groupRefs.current[dragState.groupId];
    if (container) {
      container.style.cursor = 'grab';
      const finalScrollLeft = container.scrollLeft;
      
      // Final scroll position update
      updateScrollPosition(dragState.groupId, finalScrollLeft);
      
      // Smooth transition
      container.style.scrollBehavior = 'smooth';
      setTimeout(() => {
        if (container) {
          container.style.scrollBehavior = 'auto';
        }
      }, 300);
    }
    
    updateDragState(null);
  }, [isMobile, dragState, updateDragState, updateScrollPosition]);

  const handleMouseLeave = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  // Auto-scroll to writing tabs (desktop only)
  useEffect(() => {
    if (isMobile || !tabGroups.length) return;
    
    // Use requestAnimationFrame to coordinate with browser rendering
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
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
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [tabGroups, isMobile]);

  // Tab click handler that doesn't cause drag conflicts
  const handleTabClick = useCallback((fileName: string, e: React.MouseEvent) => {
    if (dragState?.isDragging) {
      e.preventDefault();
      return;
    }
    onTabClick(fileName);
  }, [dragState?.isDragging, onTabClick]);

  // Memoize group colors and states to prevent recalculation
  const groupColors = useMemo(() => {
    const hardCodedColors: { [key: string]: string } = {
      'backend': '#f97316',
      'component': '#10b981',
      'style': '#8b5cf6',
      'config': '#06b6d4'
    };
    return hardCodedColors;
  }, []);

  const getGroupColor = useCallback((groupName: string, originalColor?: string) => {
    const groupKey = groupName.toLowerCase();
    return groupColors[groupKey] || originalColor || '#64748b';
  }, [groupColors]);

  // Memoize category states to prevent recalculation
  const getCategoryState = useCallback((group: any) => {
    const writingFiles = group.files.filter((f: any) => f.isWriting && !f.isComplete);
    const completeFiles = group.files.filter((f: any) => f.isComplete);
    const detectedFiles = group.files.filter((f: any) => !f.isWriting && !f.isComplete);
    
    if (writingFiles.length > 0) return 'writing';
    if (detectedFiles.length > 0) return 'detected';
    if (completeFiles.length > 0) return 'complete';
    return 'idle';
  }, []);

  // Layout measurement effect that doesn't cause re-renders
  useEffect(() => {
    const measureLayout = () => {
      const tabBarElement = document.querySelector('.tab-bar');
      const sidePaneElement = document.querySelector('.side-pane');
      
      if (tabBarElement) {
        const tabBarRect = tabBarElement.getBoundingClientRect();
        const sidePaneRect = sidePaneElement?.getBoundingClientRect();
        
        debouncedLayoutUpdate({
          tabBarWidth: tabBarRect.width,
          sidePaneWidth: sidePaneRect?.width || 0
        });
      }
    };

    // Initial measurement
    measureLayout();

    // Measure on resize
    window.addEventListener('resize', measureLayout, { passive: true });
    
    return () => {
      window.removeEventListener('resize', measureLayout);
    };
  }, [debouncedLayoutUpdate]);

  // Return memoized handlers and state
  return useMemo(() => ({
    tabGroups,
    dragState,
    scrollPositions,
    isGenerating,
    activeFile,
    groupRefs,
    tabRefs,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTabClick,
    getGroupColor,
    getCategoryState
  }), [
    tabGroups,
    dragState,
    scrollPositions,
    isGenerating,
    activeFile,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTabClick,
    getGroupColor,
    getCategoryState
  ]);
};