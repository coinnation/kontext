/**
 * Utility to inject element selection script into HTML content
 * Used for both deployment and preview sessions
 */

export function injectElementSelectionScript(htmlContent: string): string {
  // Check if script already injected
  if (htmlContent.includes('kontext-element-selection')) {
    return htmlContent;
  }

  const selectionScript = `(function() {
  let selectedElement = null;
  let highlightOverlay = null;
  let selectionEnabled = false;

  function createHighlightOverlay() {
    if (highlightOverlay) return;
    highlightOverlay = document.createElement('div');
    highlightOverlay.id = 'kontext-highlight-overlay';
    highlightOverlay.style.cssText = \`position: absolute; border: 2px solid #8b5cf6; background: rgba(139, 92, 246, 0.1); pointer-events: none; z-index: 999999; display: none;\`;
    document.body.appendChild(highlightOverlay);
  }

      function getElementInfo(element) {
        if (!element) return null;
        const styles = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        let selector = element.tagName.toLowerCase();
        if (element.id) selector += '#' + element.id;
        else if (element.className) {
          const classes = element.className.split(' ').filter(c => c).slice(0, 3).join('.');
          if (classes) selector += '.' + classes;
        }
        const computedStyles = {};
        ['color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'width', 'height', 'border', 'borderRadius', 'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap'].forEach(prop => {
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
          boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          selector: selector,
          textContent: textContent.trim() || undefined,
          innerHTML: innerHTML || undefined
        };
      }

  function highlightElement(element) {
    if (!element) {
      if (highlightOverlay) highlightOverlay.style.display = 'none';
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

  function handleElementClick(e) {
    if (!selectionEnabled) return;
    if (e.target.id === 'kontext-highlight-overlay' || e.target.closest('#kontext-selection-ui')) return;
    e.preventDefault();
    e.stopPropagation();
    selectedElement = e.target;
    const info = getElementInfo(selectedElement);
    highlightElement(selectedElement);
    window.parent.postMessage({ type: 'ELEMENT_SELECTED', elementInfo: info }, '*');
  }

  window.addEventListener('message', function(event) {
    if (event.data.type === 'PING_SELECTION_SCRIPT') {
      console.log('[SelectionScript] Received ping, responding...');
      window.parent.postMessage({ type: 'SELECTION_SCRIPT_READY' }, '*');
      return;
    }
    if (event.data.type === 'ENABLE_SELECTION') {
      selectionEnabled = true;
      document.body.style.cursor = 'crosshair';
      console.log('[SelectionScript] ✅ Selection mode enabled');
    } else if (event.data.type === 'DISABLE_SELECTION') {
      selectionEnabled = false;
      document.body.style.cursor = '';
      if (highlightOverlay) highlightOverlay.style.display = 'none';
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
          window.parent.postMessage({ type: 'ELEMENT_SELECTED', elementInfo: info }, '*');
        }
      }
    } else if (event.data.type === 'CLEAR_SELECTION') {
      selectedElement = null;
      if (highlightOverlay) highlightOverlay.style.display = 'none';
        } else if (event.data.type === 'UPDATE_STYLES') {
          if (selectedElement && event.data.styles) {
            Object.assign(selectedElement.style, event.data.styles);
            window.parent.postMessage({ type: 'STYLES_UPDATED', elementInfo: getElementInfo(selectedElement) }, '*');
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
            window.parent.postMessage({ type: 'TEXT_UPDATED', elementInfo: getElementInfo(selectedElement) }, '*');
          }
        }
  });

  document.addEventListener('click', handleElementClick, true);
  window.parent.postMessage({ type: 'SELECTION_SCRIPT_READY' }, '*');
})();`;

  // Inject script before </body> tag
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace(
      '</body>',
      `<script id="kontext-element-selection">${selectionScript}</script></body>`
    );
  }

  // If no </body> tag, append to end
  return htmlContent + `\n<script id="kontext-element-selection">${selectionScript}</script>`;
}

