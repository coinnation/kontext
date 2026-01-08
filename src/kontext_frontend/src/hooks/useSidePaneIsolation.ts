import { useCallback, useEffect, useMemo } from 'react';
import { useSidePaneState } from './useSelectiveStore';
import { useAppStore } from '../store/appStore';

export const useSidePaneIsolation = () => {
  const { isOpen, activeFile, isMobile, fileContent, fileMetadata } = useSidePaneState();
  
  // Actions that don't cause re-renders
  const toggleSidePane = useAppStore((state) => state.toggleSidePane);
  const closeSidePane = useAppStore((state) => state.closeSidePane);
  const setMobile = useAppStore((state) => state.setMobile);

  // Lazy file loading that doesn't depend on main generation pipeline
  const loadFileContent = useCallback(async (fileName: string) => {
    if (!fileName || fileContent !== null) return fileContent;
    
    try {
      const activeProject = useAppStore.getState().activeProject;
      if (!activeProject) return null;
      
      // Load specific file content without affecting main state
      const projectFiles = useAppStore.getState().fileContent[activeProject] || {};
      return projectFiles[fileName] || null;
    } catch (error) {
      console.error('Failed to load file content:', error);
      return null;
    }
  }, [fileContent]);

  // Mobile detection that doesn't cause layout re-renders
  useEffect(() => {
    const checkMobile = () => {
      const isMobileWidth = window.innerWidth <= 768;
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTouchDevice = 'ontouchstart' in window;
      
      const mobile = isMobileWidth || isMobileUserAgent || isTouchDevice;
      
      // Only update if changed to prevent unnecessary re-renders
      const currentMobile = useAppStore.getState().ui.sidePane.isMobile;
      if (mobile !== currentMobile) {
        setMobile(mobile);
      }
    };

    checkMobile();
    
    const debouncedCheck = debounce(checkMobile, 150);
    window.addEventListener('resize', debouncedCheck, { passive: true });
    
    return () => window.removeEventListener('resize', debouncedCheck);
  }, [setMobile]);

  // File metadata with fallbacks
  const enrichedFileMetadata = useMemo(() => {
    if (!activeFile || !fileMetadata) return null;
    
    return {
      displayName: fileMetadata.displayName || activeFile.split('/').pop() || activeFile,
      language: fileMetadata.language || 'text',
      icon: fileMetadata.icon || '📄',
      type: fileMetadata.type || 'component'
    };
  }, [activeFile, fileMetadata]);

  // Isolated close handler
  const handleClose = useCallback(() => {
    closeSidePane();
  }, [closeSidePane]);

  // Content loading state
  const isContentLoaded = fileContent !== null;
  const hasActiveFile = Boolean(activeFile);

  return {
    // State
    isOpen,
    activeFile,
    isMobile,
    fileContent,
    fileMetadata: enrichedFileMetadata,
    isContentLoaded,
    hasActiveFile,
    
    // Actions
    toggleSidePane,
    closeSidePane,
    handleClose,
    loadFileContent
  };
};

// Utility function for debouncing
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}