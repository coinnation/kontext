/**
 * 🚀 PWA OPTIMIZATION: ChatInterface Preload Service
 * 
 * Preloads the ChatInterface component in the background after initial page load
 * so that when users click the chat button, it's already loaded with no delay.
 * 
 * Similar to MonacoPreloadService, this service:
 * - Checks network conditions before preloading
 * - Respects data saver mode
 * - Uses intelligent timing to avoid impacting initial load
 * - Provides graceful fallback if preload fails
 */

interface ChatPreloadState {
  isPreloading: boolean;
  isPreloaded: boolean;
  preloadStartTime: number;
  preloadError: Error | null;
}

class ChatPreloadService {
  private static instance: ChatPreloadService;
  private preloadPromise: Promise<any> | null = null;
  private preloadedChatModule: any = null;
  private state: ChatPreloadState = {
    isPreloading: false,
    isPreloaded: false,
    preloadStartTime: 0,
    preloadError: null
  };
  private debugMode = false;

  private constructor() {
    this.debugMode = localStorage.getItem('chat-preload-debug') === 'true';
  }

  static getInstance(): ChatPreloadService {
    if (!ChatPreloadService.instance) {
      ChatPreloadService.instance = new ChatPreloadService();
    }
    return ChatPreloadService.instance;
  }

  private log(...args: any[]): void {
    if (this.debugMode) {
      console.log('[ChatPreloadService]', ...args);
    }
  }

  /**
   * Check if we should preload based on network conditions and device capabilities
   */
  private shouldPreload(): boolean {
    // Check if user is on a slow connection or has data saver enabled
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    if (connection) {
      // Respect data saver mode
      if (connection.saveData) {
        this.log('❌ Preload cancelled - user has data saver enabled');
        return false;
      }
      
      // Only preload on fast connections
      if (connection.effectiveType && ['slow-2g', '2g'].includes(connection.effectiveType)) {
        this.log('❌ Preload cancelled - slow connection detected', connection.effectiveType);
        return false;
      }
    }

    // Check if user agent suggests mobile device with limited resources
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      // Be more conservative on mobile
      const screenWidth = window.screen.width;
      if (screenWidth < 768) {
        this.log('⚠️ Mobile device detected - using conservative preload strategy');
        // Still allow preload but with lower priority
      }
    }

    // Check available memory (if supported)
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      if (memInfo.usedJSHeapSize > memInfo.totalJSHeapSize * 0.8) {
        this.log('❌ Preload cancelled - high memory usage detected');
        return false;
      }
    }

    return true;
  }

  /**
   * Preload ChatInterface module in the background
   */
  private async preloadInBackground(): Promise<any> {
    this.log('📦 Starting ChatInterface module preload...');
    
    try {
      // Import the ChatInterface module
      const chatModule = await import('../components/ChatInterface');
      this.log('✅ ChatInterface module loaded successfully');
      
      // Store the preloaded module
      this.preloadedChatModule = chatModule;
      
      return chatModule;
    } catch (error) {
      this.log('❌ ChatInterface preload failed:', error);
      throw error;
    }
  }

  /**
   * Start background preload of ChatInterface
   */
  async startBackgroundPreload(): Promise<void> {
    // Don't start multiple preload attempts
    if (this.state.isPreloading || this.state.isPreloaded) {
      this.log('⚠️ Preload already in progress or completed');
      return;
    }

    // Check if we should preload based on network conditions
    if (!this.shouldPreload()) {
      return;
    }

    this.state.isPreloading = true;
    this.state.preloadStartTime = Date.now();
    this.state.preloadError = null;
    
    this.log('🎯 Initiating ChatInterface background preload...');

    try {
      this.preloadPromise = this.preloadInBackground();
      await this.preloadPromise;
      
      this.state.isPreloaded = true;
      this.state.isPreloading = false;
      
      const duration = Date.now() - this.state.preloadStartTime;
      this.log(`🎉 Background preload completed successfully in ${duration}ms`);
    } catch (error) {
      this.log('💥 Background preload failed:', error);
      this.state.preloadError = error instanceof Error ? error : new Error(String(error));
      // Reset state so ChatInterface can fall back to lazy loading
      this.preloadPromise = null;
      this.preloadedChatModule = null;
      this.state.isPreloading = false;
    }
  }

  /**
   * Get the preloaded ChatInterface module
   * Returns null if not yet preloaded (allows fallback to lazy loading)
   */
  async getPreloadedChat(): Promise<any | null> {
    // If already preloaded, return immediately
    if (this.preloadedChatModule) {
      this.log('✅ Returning preloaded ChatInterface module');
      return this.preloadedChatModule;
    }

    // If preload is in progress, wait for it
    if (this.preloadPromise) {
      this.log('⏳ Waiting for preload to complete...');
      try {
        await this.preloadPromise;
        return this.preloadedChatModule;
      } catch (error) {
        this.log('⚠️ Preload promise rejected, returning null for fallback');
        return null;
      }
    }

    // Not preloaded and not in progress - return null for lazy loading fallback
    this.log('ℹ️ ChatInterface not preloaded, will use lazy loading');
    return null;
  }

  /**
   * Get current preload status
   */
  getPreloadStatus(): ChatPreloadState {
    return { ...this.state };
  }

  /**
   * Check if ChatInterface is preloaded
   */
  isPreloaded(): boolean {
    return this.state.isPreloaded;
  }

  /**
   * Check if preload is in progress
   */
  isPreloading(): boolean {
    return this.state.isPreloading;
  }

  /**
   * Reset service state (useful for testing or cleanup)
   */
  reset(): void {
    this.log('🧹 Resetting ChatInterface preload service');
    this.preloadPromise = null;
    this.preloadedChatModule = null;
    this.state = {
      isPreloading: false,
      isPreloaded: false,
      preloadStartTime: 0,
      preloadError: null
    };
  }
}

// Type for Navigator with connection API
interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

interface NetworkInformation {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  saveData?: boolean;
}

// Export singleton instance
export const chatPreloadService = ChatPreloadService.getInstance();
