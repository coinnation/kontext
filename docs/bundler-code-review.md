# JSBundler HMR Implementation Review

## ✅ What You Have (Complete)

### 1. Service Methods ✅
- ✅ `createPreviewSession()` - Creates Vite dev server with HMR
- ✅ `updatePreviewSession()` - Updates files and triggers HMR
- ✅ `getPreviewSession()` - Returns session status
- ✅ `closePreviewSession()` - Cleans up session

### 2. Express Endpoints ✅
- ✅ `POST /kontext/preview` - Create session
- ✅ `POST /kontext/preview/:sessionId/update` - Update files
- ✅ `GET /kontext/preview/:sessionId` - Get status
- ✅ `DELETE /kontext/preview/:sessionId` - Close session

### 3. Infrastructure ✅
- ✅ Port allocation (30000-40000 range)
- ✅ Session expiration (24 hours)
- ✅ Cleanup intervals
- ✅ Vite dev server with HMR enabled
- ✅ WebSocket support (WSS)

## ⚠️ What's Missing or Needs Attention

### 1. Reverse Proxy Configuration (Infrastructure)
**Status:** Not in code (expected - this is infrastructure)

You need to configure nginx/load balancer to route:
- `preview-*.jsbundler.coinnation.io` → Vite server port
- `wss://preview-*.jsbundler.coinnation.io/hmr` → Vite HMR port

**This is NOT in your code** - it's infrastructure-level configuration.

### 2. Element Selection Script Injection (For Visual Editing)
**Status:** Missing - needs to be added

For visual element editing to work, you need to inject the selection script into preview sessions. Add this to `createPreviewSession`:

```typescript
// After writing files, inject element selection script
const selectionScript = `
(function() {
  // Element selection script from ElementSelectionService
  // (Copy the script from src/frontend/src/services/ElementSelectionService.ts)
})();
`;

// Inject into index.html or create a separate script file
const indexHtmlPath = path.join(tempDir, 'index.html');
let indexHtml = await fs.readFile(indexHtmlPath, 'utf8');

// Add script before </body>
if (!indexHtml.includes('kontext-element-selection')) {
  indexHtml = indexHtml.replace(
    '</body>',
    `<script id="kontext-element-selection">${selectionScript}</script></body>`
  );
  await fs.writeFile(indexHtmlPath, indexHtml, 'utf8');
}
```

### 3. Error Handling Enhancement
**Status:** Good, but could be more specific

Your error handling is good, but consider adding:
- More specific error messages for common failures
- Validation of file structure before creating session
- Better handling of port exhaustion

### 4. Session Status in getPreviewSession
**Status:** ✅ Already implemented correctly

Your `getPreviewSession` method correctly returns status ('active' | 'expired').

## 🔧 Recommended Additions

### 1. Add Element Selection Script Injection

Add this method to `JSBundlerService`:

```typescript
private async injectElementSelectionScript(tempDir: string): Promise<void> {
    const selectionScript = `
(function() {
  let selectedElement = null;
  let highlightOverlay = null;
  
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
  
  function getElementInfo(element) {
    if (!element) return null;
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    let selector = element.tagName.toLowerCase();
    if (element.id) {
      selector += '#' + element.id;
    } else if (element.className) {
      const classes = element.className.split(' ').filter(c => c).slice(0, 3).join('.');
      if (classes) selector += '.' + classes;
    }
    return {
      tagName: element.tagName,
      id: element.id || undefined,
      className: element.className || undefined,
      computedStyles: Object.fromEntries([
        'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily',
        'padding', 'margin', 'width', 'height', 'borderRadius'
      ].map(prop => [prop, styles.getPropertyValue(prop)])),
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
    if (e.target.id === 'kontext-highlight-overlay') return;
    e.preventDefault();
    e.stopPropagation();
    selectedElement = e.target;
    const info = getElementInfo(element);
    highlightElement(element);
    window.parent.postMessage({
      type: 'ELEMENT_SELECTED',
      elementInfo: info
    }, '*');
  }
  
  window.addEventListener('message', function(event) {
    if (event.data.type === 'SELECT_ELEMENT') {
      const element = document.querySelector(event.data.selector);
      if (element) {
        selectedElement = element;
        highlightElement(element);
        window.parent.postMessage({
          type: 'ELEMENT_SELECTED',
          elementInfo: getElementInfo(element)
        }, '*');
      }
    } else if (event.data.type === 'CLEAR_SELECTION') {
      selectedElement = null;
      if (highlightOverlay) highlightOverlay.style.display = 'none';
    } else if (event.data.type === 'UPDATE_STYLES') {
      if (selectedElement && event.data.styles) {
        Object.assign(selectedElement.style, event.data.styles);
        window.parent.postMessage({
          type: 'STYLES_UPDATED',
          elementInfo: getElementInfo(selectedElement)
        }, '*');
      }
    }
  });
  
  document.addEventListener('click', handleElementClick, true);
  
  window.parent.postMessage({ type: 'SELECTION_SCRIPT_READY' }, '*');
})();
`;

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
                console.log(`✅ Injected element selection script into ${indexPath}`);
            }
            return;
        } catch {
            // File doesn't exist, try next
            continue;
        }
    }
    
    console.warn('⚠️  Could not find index.html to inject selection script');
}
```

Then call it in `createPreviewSession`:

```typescript
// After writing files
await this.injectElementSelectionScript(tempDir);
```

### 2. Add File Structure Validation

Add validation before creating session:

```typescript
private validatePreviewFiles(files: File[], packageJson: any): void {
    // Check for required files
    const hasIndexHtml = files.some(f => f.name.endsWith('index.html'));
    const hasPackageJson = !!packageJson;
    
    if (!hasIndexHtml) {
        throw new Error('Invalid files: index.html is required');
    }
    
    if (!hasPackageJson) {
        throw new Error('Invalid request: packageJson is required');
    }
    
    // Check for React entry point
    const hasEntryPoint = files.some(f => 
        f.name.includes('index.tsx') || 
        f.name.includes('index.jsx') ||
        f.name.includes('main.tsx') ||
        f.name.includes('main.jsx')
    );
    
    if (!hasEntryPoint && packageJson.dependencies?.react) {
        throw new Error('Invalid files: React entry point (index.tsx/jsx or main.tsx/jsx) is required');
    }
}
```

## ✅ Summary

**You have 95% of what you need!** The core HMR functionality is complete. You just need:

1. **Element selection script injection** (for visual editing) - ~10 lines of code
2. **Reverse proxy configuration** (infrastructure, not code) - nginx/load balancer setup
3. **Optional enhancements** - validation, better error messages

## 🚀 Next Steps

1. ✅ Your code is ready for basic HMR
2. ⚠️ Add element selection script injection (for visual editing)
3. ⚠️ Configure reverse proxy (infrastructure)
4. ✅ Test with Kontext frontend

Your implementation looks solid! The main thing missing is the element selection script injection for visual editing support.

