# Server-Side Element Selection Script

This is the complete script that must be injected into the preview HTML by the bundler service.

## Location in Bundler Code

Update the `injectElementSelectionScript` method in your `JSBundlerService` class.

## Complete Script Code

```javascript
(function() {
  let selectedElement = null;
  let highlightOverlay = null;
  let selectionEnabled = false; // 🔥 CRITICAL: Track selection mode state
  
  // Create highlight overlay
  function createHighlightOverlay() {
    if (highlightOverlay) return;
    
    highlightOverlay = document.createElement('div');
    highlightOverlay.id = 'kontext-highlight-overlay';
    highlightOverlay.style.cssText = `
      position: absolute;
      border: 2px solid #8b5cf6;
      background: rgba(139, 92, 246, 0.1);
      pointer-events: none;
      z-index: 999999;
      display: none;
    `;
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
      selector: selector
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
    // 🔥 CRITICAL: Only handle clicks when selection mode is enabled
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
    
    // 🔥 CRITICAL: Handle selection mode toggle
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
    }
  });
  
  // 🔥 CRITICAL: Always attach listener, but it checks selectionEnabled
  document.addEventListener('click', handleElementClick, true);
  
  // Notify parent that script is ready
  window.parent.postMessage({
    type: 'SELECTION_SCRIPT_READY'
  }, '*');
})();
```

## Updated Bundler Method

Replace the `injectElementSelectionScript` method in your bundler with this:

```typescript
private async injectElementSelectionScript(tempDir: string): Promise<void> {
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
    return {
      tagName: element.tagName,
      id: element.id || undefined,
      className: element.className || undefined,
      computedStyles: computedStyles,
      boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      selector: selector
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
    }
  });

  document.addEventListener('click', handleElementClick, true);
  window.parent.postMessage({ type: 'SELECTION_SCRIPT_READY' }, '*');
})();`;

  // Find and inject into index.html
  const indexHtmlPaths = [
    path.join(tempDir, 'index.html'),
    path.join(tempDir, 'src/frontend/index.html'),
    path.join(tempDir, 'src/index.html')
  ];

  for (const indexPath of indexHtmlPaths) {
    try {
      await fs.access(indexPath);
      let indexHtml = await fs.readFile(indexPath, 'utf8');

      if (!indexHtml.includes('kontext-element-selection')) {
        indexHtml = indexHtml.replace(
          '</body>',
          `<script id="kontext-element-selection">${selectionScript}</script></body>`
        );
        await fs.writeFile(indexPath, indexHtml, 'utf8');
        console.log(`✅ Injected element selection script into ${path.relative(tempDir, indexPath)}`);
      }
      return;
    } catch {
      continue;
    }
  }

  console.warn('⚠️  Could not find index.html to inject selection script');
}
```

## Key Changes from Previous Version

1. ✅ Added `selectionEnabled` flag (line 3)
2. ✅ Added `PING_SELECTION_SCRIPT` handler (responds with `SELECTION_SCRIPT_READY`)
3. ✅ Added `ENABLE_SELECTION` handler (enables selection mode, sets cursor)
4. ✅ Added `DISABLE_SELECTION` handler (disables selection mode, clears cursor)
5. ✅ Updated `handleElementClick` to check `selectionEnabled` before processing
6. ✅ Script sends `SELECTION_SCRIPT_READY` on load

## Testing Checklist

After updating the bundler:

1. ✅ Create a new preview session
2. ✅ Check browser console for: `[SelectionScript] Received ping, responding...`
3. ✅ Check parent console for: `[ElementSelection] ✅ Selection script ready in iframe`
4. ✅ Click Edit button
5. ✅ Check iframe console for: `[SelectionScript] ✅ Selection mode enabled`
6. ✅ Click an element in the preview
7. ✅ Element should be highlighted and Property Editor should open

## Troubleshooting

**If script doesn't respond to ping:**
- Verify script is injected into HTML (check page source)
- Check iframe console for errors
- Verify script ID is `kontext-element-selection`

**If selection mode doesn't enable:**
- Check iframe console for `ENABLE_SELECTION` message
- Verify `selectionEnabled` flag is being set
- Check cursor changes to crosshair

**If clicks don't work:**
- Verify `selectionEnabled` is `true` when clicking
- Check if `handleElementClick` is being called
- Verify element isn't being blocked by overlay

