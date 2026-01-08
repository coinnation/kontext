import { useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '../store/appStore';

/**
 * Performance-optimized selective store hooks that prevent unnecessary re-renders
 * by subscribing only to specific slices of state that components actually need.
 */

// Hook for TabBar that only subscribes to what it needs
export const useTabBarState = (projectId: string | null) => {
  return useAppStore(
    useCallback((state) => {
      if (!projectId) {
        return {
          tabGroups: [],
          dragState: state.uiTransient.dragState,
          scrollPositions: state.uiTransient.scrollPositions,
          isGenerating: state.generation.isGenerating,
          activeFile: state.ui.sidePane.activeFile
        };
      }

      return {
        tabGroups: state.tabGroups[projectId]?.groups || [],
        dragState: state.uiTransient.dragState,
        scrollPositions: state.uiTransient.scrollPositions,
        isGenerating: state.generation.isGenerating,
        activeFile: state.ui.sidePane.activeFile
      };
    }, [projectId])
  );
};

// Hook for SidePane that only subscribes to its specific file and layout state
export const useSidePaneState = () => {
  const activeFile = useAppStore((state) => state.ui.sidePane.activeFile);
  const isOpen = useAppStore((state) => state.ui.sidePane.isOpen);
  const isMobile = useAppStore((state) => state.ui.sidePane.isMobile);
  const activeProject = useAppStore((state) => state.activeProject);
  
  // Only subscribe to the specific file content when needed
  const fileContent = useAppStore(
    useCallback((state) => {
      if (!activeProject || !activeFile) return null;
      return state.fileContent[activeProject]?.[activeFile] || null;
    }, [activeProject, activeFile])
  );

  // Only subscribe to the specific file metadata when needed
  const fileMetadata = useAppStore(
    useCallback((state) => {
      if (!activeProject || !activeFile) return null;
      return state.fileMetadata[activeProject]?.[activeFile] || null;
    }, [activeProject, activeFile])
  );

  return {
    isOpen,
    activeFile,
    isMobile,
    fileContent,
    fileMetadata
  };
};

// Hook for ChatInterface that only subscribes to coordination state
export const useChatCoordinationState = () => {
  return useAppStore((state) => ({
    activeProject: state.activeProject,
    isGenerating: state.generation.isGenerating,
    isStreaming: state.generation.isStreaming,
    sidePaneOpen: state.ui.sidePane.isOpen,
    projects: state.projects // This is relatively stable
  }));
};

// Hook for components that need to update file generation states efficiently
export const useFileGenerationActions = () => {
  return useAppStore((state) => ({
    updateFileContent: state.updateFileContent,
    batchUpdateFileContent: state.batchUpdateFileContent,
    updateFileGenerationState: state.updateFileGenerationState,
    batchUpdateFileGenerationStates: state.batchUpdateFileGenerationStates,
    refreshTabGroups: state.refreshTabGroups,
    invalidateTabGroups: state.invalidateTabGroups
  }));
};

// Hook for UI transient state that doesn't affect data
export const useUITransientActions = () => {
  return useAppStore((state) => ({
    updateDragState: state.updateDragState,
    updateScrollPosition: state.updateScrollPosition,
    updateAnimationState: state.updateAnimationState,
    updateLayoutMetrics: state.updateLayoutMetrics
  }));
};

// Memoized file list for components that need to render file lists efficiently
export const useFileList = (projectId: string | null) => {
  const fileContent = useAppStore(
    useCallback((state) => {
      if (!projectId) return {};
      return state.fileContent[projectId] || {};
    }, [projectId])
  );

  const fileMetadata = useAppStore(
    useCallback((state) => {
      if (!projectId) return {};
      return state.fileMetadata[projectId] || {};
    }, [projectId])
  );

  return useMemo(() => {
    const fileNames = Object.keys(fileContent);
    return fileNames.map(fileName => ({
      fileName,
      content: fileContent[fileName],
      metadata: fileMetadata[fileName] || {
        displayName: fileName.split('/').pop() || fileName,
        language: 'text',
        icon: '📄',
        type: 'component' as const
      }
    }));
  }, [fileContent, fileMetadata]);
};

// Performance monitoring hook
export const usePerformanceMonitor = () => {
  const renderCount = useRef(0);
  const lastRender = useRef(Date.now());
  
  renderCount.current++;
  const timeSinceLastRender = Date.now() - lastRender.current;
  lastRender.current = Date.now();

  // Log performance issues in development
  if (process.env.NODE_ENV === 'development') {
    if (timeSinceLastRender > 16) { // More than 60fps
      console.warn(`Slow render detected: ${timeSinceLastRender}ms`);
    }
    if (renderCount.current > 100) {
      console.warn(`High render count detected: ${renderCount.current}`);
    }
  }

  return {
    renderCount: renderCount.current,
    timeSinceLastRender
  };
};

// Debounced action hook for high-frequency updates
export const useDebouncedAction = <T extends (...args: any[]) => void>(
  action: T,
  delay: number = 100
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        action(...args);
      }, delay);
    }) as T,
    [action, delay]
  );
};