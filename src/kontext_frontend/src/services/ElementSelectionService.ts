/**
 * Element Selection Service - Handles element selection in preview iframe
 * Works with cross-origin iframes using postMessage API
 */

interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  computedStyles: Record<string, string>;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selector: string; // CSS selector to target this element
  xpath?: string;
  textContent?: string; // Text content of the element
  innerHTML?: string; // Inner HTML (for elements with nested content)
}

interface SelectionMessage {
  type: 'SELECT_ELEMENT' | 'HIGHLIGHT_ELEMENT' | 'GET_ELEMENT_INFO' | 'UPDATE_STYLES';
  element?: HTMLElement;
  selector?: string;
  styles?: Record<string, string>;
  requestId?: string;
}

class ElementSelectionService {
  private static instance: ElementSelectionService;
  private selectedElement: ElementInfo | null = null;
  private iframeRef: HTMLIFrameElement | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private selectionListeners: Set<(element: ElementInfo | null) => void> = new Set();
  private scriptReady: boolean = false; // 🔥 NEW: Track if script is ready
  private pendingToggle: boolean | null = null; // 🔥 NEW: Store pending toggle state
  private initializedIframes: WeakSet<HTMLIFrameElement> = new WeakSet(); // Track initialized iframes

  private constructor() {
    // Listen for messages from iframe
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  static getInstance(): ElementSelectionService {
    if (!ElementSelectionService.instance) {
      ElementSelectionService.instance = new ElementSelectionService();
    }
    return ElementSelectionService.instance;
  }

  /**
   * Initialize element selection for an iframe
   */
  initialize(iframe: HTMLIFrameElement): void {
    // Prevent multiple initializations of the same iframe
    if (this.initializedIframes.has(iframe) && this.iframeRef === iframe) {
      // Already initialized this iframe, just check if script is ready
      if (!this.scriptReady && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({
            type: 'PING_SELECTION_SCRIPT',
            source: 'kontext'
          }, '*');
        } catch (err) {
          // Cross-origin iframe, can't access - that's OK, postMessage still works
        }
      }
      return;
    }
    
    this.iframeRef = iframe;
    this.scriptReady = false; // Reset ready state
    this.initializedIframes.add(iframe);
    
    // Check if iframe is cross-origin
    let isCrossOrigin = false;
    try {
      const iframeOrigin = new URL(iframe.src).origin;
      isCrossOrigin = iframeOrigin !== window.location.origin;
    } catch (err) {
      // Can't determine origin, assume cross-origin for safety
      isCrossOrigin = true;
    }
    
    // Wait for iframe to load before trying to inject/communicate
    const handleIframeLoad = () => {
      if (isCrossOrigin) {
        // Cross-origin iframe - script should be injected server-side
        // Just ping to check if it's ready
        console.log('[ElementSelection] Cross-origin iframe, using postMessage', {
          iframeSrc: iframe.src,
          iframeOrigin: new URL(iframe.src).origin,
          parentOrigin: window.location.origin
        });
        
        // Ping the iframe to check if server-injected script is ready
        this.setupCrossOriginSelection(iframe);
      } else {
        // Same-origin iframe - can inject script directly
        this.injectSelectionScript(iframe);
        
        console.log('[ElementSelection] Initialized for iframe', {
          iframeSrc: iframe.src,
          iframeOrigin: new URL(iframe.src).origin,
          parentOrigin: window.location.origin,
          isCrossOrigin: false
        });
      }
    };
    
    // Check if iframe is already loaded (with cross-origin safety)
    let isReady = false;
    try {
      if (iframe.contentDocument?.readyState === 'complete' || 
          (iframe.contentWindow && iframe.contentWindow.document.readyState === 'complete')) {
        isReady = true;
      }
    } catch (err) {
      // Cross-origin iframe - can't check readyState, wait for load event
      isReady = false;
    }
    
    if (isReady) {
      handleIframeLoad();
    } else {
      // Wait for iframe to load
      iframe.addEventListener('load', handleIframeLoad, { once: true });
    }
  }

  /**
   * Inject selection script into iframe (same-origin only)
   */
  private injectSelectionScript(iframe: HTMLIFrameElement): void {
    if (!iframe.contentWindow) return;

    try {
      // Check if we can access the document (same-origin check)
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      // If we can't access document, it's cross-origin - should use setupCrossOriginSelection instead
      if (!iframeDoc) {
        console.warn('[ElementSelection] Cannot access iframe document - may be cross-origin');
        return;
      }
      
      // Check if script already injected
      if (iframeDoc.getElementById('kontext-element-selection')) {
        return;
      }

      const script = iframeDoc.createElement('script');
      script.id = 'kontext-element-selection';
      script.textContent = `
        (function() {
          let selectedElement = null;
          let highlightOverlay = null;
          let selectionEnabled = false; // 🔥 NEW: Track selection mode state
          
          // Create highlight overlay
          function createHighlightOverlay() {
            if (highlightOverlay) return;
            
            highlightOverlay = document.createElement('div');
            highlightOverlay.id = 'kontext-highlight-overlay';
            highlightOverlay.style.cssText = \`
              position: absolute;
              border: 2px solid #8b5cf6;
              background: rgba(139, 92, 246, 0.1);
              pointer-events: none;
              z-index: 999999;
              display: none;
            \`;
            document.body.appendChild(highlightOverlay);
          }
          
          // Get element info
          function getElementInfo(element) {
            if (!element) return null;
            
            const styles = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            
            // Build selector
            let selector = element.tagName.toLowerCase();
            if (element.id) {
              selector += '#' + element.id;
            } else if (element.className) {
              const classes = element.className.split(' ').filter(c => c).slice(0, 3).join('.');
              if (classes) selector += '.' + classes;
            }
            
            // Get computed styles
            const computedStyles = {};
            const styleProps = [
              'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily',
              'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
              'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
              'width', 'height', 'border', 'borderRadius', 'display',
              'flexDirection', 'justifyContent', 'alignItems', 'gap'
            ];
            
            styleProps.forEach(prop => {
              computedStyles[prop] = styles.getPropertyValue(prop);
            });
            
            // Get text content (only direct text, not from children)
            let textContent = '';
            let innerHTML = '';
            
            // For elements that can contain text
            if (element.childNodes.length === 0 || 
                (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3)) {
              // Element has only text node(s) as direct children
              textContent = element.textContent || element.innerText || '';
              innerHTML = element.innerHTML || '';
            } else {
              // Element has children, get its own text if any
              textContent = element.textContent || element.innerText || '';
              innerHTML = element.innerHTML || '';
            }
            
            return {
              tagName: element.tagName,
              id: element.id || undefined,
              className: element.className || undefined,
              computedStyles: computedStyles,
              boundingRect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              },
              selector: selector,
              textContent: textContent.trim() || undefined,
              innerHTML: innerHTML || undefined
            };
          }
          
          // Highlight element
          function highlightElement(element) {
            if (!element) {
              if (highlightOverlay) {
                highlightOverlay.style.display = 'none';
              }
              return;
            }
            
            createHighlightOverlay();
            
            const rect = element.getBoundingClientRect();
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            
            highlightOverlay.style.display = 'block';
            highlightOverlay.style.left = (rect.left + scrollX) + 'px';
            highlightOverlay.style.top = (rect.top + scrollY) + 'px';
            highlightOverlay.style.width = rect.width + 'px';
            highlightOverlay.style.height = rect.height + 'px';
          }
          
          // Handle element click
          function handleElementClick(e) {
            // 🔥 NEW: Only handle clicks when selection mode is enabled
            if (!selectionEnabled) return;
            
            // Don't select if clicking on overlay or selection UI
            if (e.target.id === 'kontext-highlight-overlay' || 
                e.target.closest('#kontext-selection-ui')) {
              return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            
            const element = e.target;
            selectedElement = element;
            
            const info = getElementInfo(element);
            highlightElement(element);
            
            // Send to parent
            window.parent.postMessage({
              type: 'ELEMENT_SELECTED',
              elementInfo: info
            }, '*');
          }
          
          // Listen for messages from parent
          window.addEventListener('message', function(event) {
            // 🔥 NEW: Respond to ping to confirm script is loaded
            if (event.data.type === 'PING_SELECTION_SCRIPT') {
              console.log('[SelectionScript] Received ping, responding...');
              window.parent.postMessage({
                type: 'SELECTION_SCRIPT_READY'
              }, '*');
              return;
            }
            
            // 🔥 NEW: Handle selection mode toggle
            if (event.data.type === 'ENABLE_SELECTION') {
              selectionEnabled = true;
              document.body.style.cursor = 'crosshair';
              console.log('[SelectionScript] ✅ Selection mode enabled');
            } else if (event.data.type === 'DISABLE_SELECTION') {
              selectionEnabled = false;
              document.body.style.cursor = '';
              if (highlightOverlay) {
                highlightOverlay.style.display = 'none';
              }
              selectedElement = null;
              console.log('[SelectionScript] ❌ Selection mode disabled');
            } else if (event.data.type === 'SELECT_ELEMENT') {
              const selector = event.data.selector;
              if (selector) {
                const element = document.querySelector(selector);
                if (element) {
                  selectedElement = element;
                  const info = getElementInfo(element);
                  highlightElement(element);
                  
                  window.parent.postMessage({
                    type: 'ELEMENT_SELECTED',
                    elementInfo: info
                  }, '*');
                }
              }
            } else if (event.data.type === 'CLEAR_SELECTION') {
              selectedElement = null;
              if (highlightOverlay) {
                highlightOverlay.style.display = 'none';
              }
            } else if (event.data.type === 'UPDATE_STYLES') {
              if (selectedElement && event.data.styles) {
                Object.assign(selectedElement.style, event.data.styles);
                
                // Notify parent
                window.parent.postMessage({
                  type: 'STYLES_UPDATED',
                  elementInfo: getElementInfo(selectedElement)
                }, '*');
              }
            } else if (event.data.type === 'UPDATE_TEXT') {
              if (selectedElement && event.data.textContent !== undefined) {
                // Update text content
                if (selectedElement.nodeType === 3) {
                  // Text node
                  selectedElement.textContent = event.data.textContent;
                } else {
                  // Element node - update text content
                  selectedElement.textContent = event.data.textContent;
                }
                
                // Notify parent
                window.parent.postMessage({
                  type: 'TEXT_UPDATED',
                  elementInfo: getElementInfo(selectedElement)
                }, '*');
              }
            }
          });
          
          // 🔥 CHANGED: Always attach listener, but it checks selectionEnabled
          document.addEventListener('click', handleElementClick, true);
          
          // Notify parent that script is ready
          window.parent.postMessage({
            type: 'SELECTION_SCRIPT_READY'
          }, '*');
        })();
      `;
      
      iframeDoc.head.appendChild(script);
      console.log('[ElementSelection] Selection script injected');
    } catch (error) {
      // Cross-origin - use postMessage instead
      console.log('[ElementSelection] Cross-origin iframe, using postMessage');
      this.setupCrossOriginSelection(iframe);
    }
  }

  /**
   * Setup selection for cross-origin iframe
   */
  private setupCrossOriginSelection(iframe: HTMLIFrameElement): void {
    // For cross-origin, the script must be injected server-side
    // We'll wait for SELECTION_SCRIPT_READY message to confirm it's loaded
    console.log('[ElementSelection] Waiting for server-injected selection script...');
    
    // Reset ready state
    this.scriptReady = false;
    
    // Wait a bit for the iframe to fully initialize before pinging
    // The script sends SELECTION_SCRIPT_READY on load, but we also ping to be sure
    const startPinging = () => {
      // Try to ping the script to see if it's ready
      // The server-side script should respond with SELECTION_SCRIPT_READY
      const checkScriptReady = () => {
        if (iframe.contentWindow && !this.scriptReady) {
          iframe.contentWindow.postMessage({
            type: 'PING_SELECTION_SCRIPT',
            source: 'kontext'
          }, '*');
        }
      };
      
      // Check after a short delay to let the script initialize
      setTimeout(() => {
        if (!this.scriptReady) {
          checkScriptReady();
        }
      }, 500);
      
      // Then check periodically
      const interval = setInterval(() => {
        if (this.scriptReady) {
          clearInterval(interval);
        } else {
          checkScriptReady();
        }
      }, 1000);
      
      // Stop checking after 10 seconds
      setTimeout(() => {
        clearInterval(interval);
        if (!this.scriptReady) {
          console.warn('[ElementSelection] ⚠️ Selection script not ready after 10 seconds. The script should be injected server-side in preview sessions.');
        }
      }, 10000);
    };
    
    // Wait for iframe to be ready
    if (iframe.contentWindow) {
      // If iframe is already loaded, start pinging
      if (iframe.contentDocument?.readyState === 'complete') {
        startPinging();
      } else {
        // Wait for iframe load event
        iframe.addEventListener('load', () => {
          setTimeout(startPinging, 200); // Small delay to ensure script has executed
        }, { once: true });
      }
    } else {
      // Fallback: start pinging after a delay
      setTimeout(startPinging, 1000);
    }
  }

  /**
   * Handle messages from iframe
   */
  private handleMessage(event: MessageEvent): void {
    // Verify origin (in production, check against known domains)
    // For preview sessions, accept messages from jsbundler.coinnation.io
    // For deployed canisters, accept messages from icp0.io
    const allowedOrigins = [
      'jsbundler.coinnation.io',
      'icp0.io',
      'localhost',
      '127.0.0.1'
    ];
    
    const isAllowedOrigin = allowedOrigins.some(origin => event.origin.includes(origin));
    if (!isAllowedOrigin && event.origin !== window.location.origin) {
      // Silently ignore messages from unknown origins
      return;
    }

    const data = event.data;

    switch (data.type) {
      case 'SELECTION_SCRIPT_READY':
        console.log('[ElementSelection] ✅ Selection script ready in iframe', {
          origin: event.origin,
          iframeSrc: this.iframeRef?.src
        });
        this.scriptReady = true;
        
        // 🔥 NEW: Apply pending toggle if any
        if (this.pendingToggle !== null) {
          console.log(`[ElementSelection] Applying pending selection mode: ${this.pendingToggle}`);
          this.toggleSelectionMode(this.pendingToggle);
          this.pendingToggle = null;
        }
        break;

      case 'ELEMENT_SELECTED':
        this.selectedElement = data.elementInfo;
        this.notifySelectionListeners(this.selectedElement);
        console.log('[ElementSelection] Element selected:', this.selectedElement);
        break;

      case 'STYLES_UPDATED':
        this.selectedElement = data.elementInfo;
        this.notifySelectionListeners(this.selectedElement);
        break;

      case 'TEXT_UPDATED':
        this.selectedElement = data.elementInfo;
        this.notifySelectionListeners(this.selectedElement);
        break;

      default:
        // Handle custom message handlers
        if (data.requestId && this.messageHandlers.has(data.requestId)) {
          const handler = this.messageHandlers.get(data.requestId);
          handler?.(data);
          this.messageHandlers.delete(data.requestId);
        }
    }
  }

  /**
   * Select element by selector
   */
  selectElement(selector: string): void {
    if (!this.iframeRef?.contentWindow) return;

    this.iframeRef.contentWindow.postMessage({
      type: 'SELECT_ELEMENT',
      selector
    }, '*');
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedElement = null;
    
    if (this.iframeRef?.contentWindow) {
      this.iframeRef.contentWindow.postMessage({
        type: 'CLEAR_SELECTION'
      }, '*');
    }
    
    this.notifySelectionListeners(null);
  }

  /**
   * Update element styles
   */
  updateElementStyles(styles: Record<string, string>): void {
    if (!this.iframeRef?.contentWindow) return;

    this.iframeRef.contentWindow.postMessage({
      type: 'UPDATE_STYLES',
      styles
    }, '*');
  }

  /**
   * Update element text content
   */
  updateElementText(textContent: string): void {
    if (!this.iframeRef?.contentWindow) return;

    this.iframeRef.contentWindow.postMessage({
      type: 'UPDATE_TEXT',
      textContent
    }, '*');
  }

  /**
   * Toggle selection mode on/off
   */
  toggleSelectionMode(enabled: boolean): void {
    if (!this.iframeRef?.contentWindow) {
      console.warn('[ElementSelection] Cannot toggle: iframe not available');
      return;
    }

    // 🔥 NEW: If script not ready yet, store the toggle state
    if (!this.scriptReady) {
      console.log(`[ElementSelection] Script not ready, storing pending toggle: ${enabled}`);
      this.pendingToggle = enabled;
      
      // Try to ping the script
      this.iframeRef.contentWindow.postMessage({
        type: 'PING_SELECTION_SCRIPT',
        source: 'kontext'
      }, '*');
      return;
    }

    const message = {
      type: enabled ? 'ENABLE_SELECTION' : 'DISABLE_SELECTION',
      source: 'kontext'
    };
    
    this.iframeRef.contentWindow.postMessage(message, '*');
    
    console.log(`[ElementSelection] Selection mode ${enabled ? 'enabled' : 'disabled'}`, {
      message,
      iframeOrigin: this.iframeRef.src,
      scriptReady: this.scriptReady
    });
  }

  /**
   * Get currently selected element
   */
  getSelectedElement(): ElementInfo | null {
    return this.selectedElement;
  }

  /**
   * Subscribe to selection changes
   */
  onSelectionChange(callback: (element: ElementInfo | null) => void): () => void {
    this.selectionListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.selectionListeners.delete(callback);
    };
  }

  /**
   * Notify all selection listeners
   */
  private notifySelectionListeners(element: ElementInfo | null): void {
    this.selectionListeners.forEach(callback => {
      try {
        callback(element);
      } catch (error) {
        console.error('[ElementSelection] Error in selection listener:', error);
      }
    });
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.clearSelection();
    this.iframeRef = null;
    this.selectionListeners.clear();
    this.messageHandlers.clear();
    this.scriptReady = false;
    this.pendingToggle = null;
  }
}

export const elementSelectionService = ElementSelectionService.getInstance();

