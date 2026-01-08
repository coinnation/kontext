# Express Server Fixes for Preview Proxy

## Issues Found

1. **502 Bad Gateway**: HTTP proxy route not working correctly
2. **WebSocket failures**: Upgrade handler needs proper implementation

## Fix 1: HTTP Proxy Route

Replace your current `/preview/:sessionId` route with this improved version:

```typescript
// Improved HTTP proxy function
const proxyRequest = async (
  req: express.Request, 
  res: express.Response, 
  targetPort: number, 
  targetPath: string = ''
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: targetPort,
      path: targetPath || req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `localhost:${targetPort}`,
        // Remove hop-by-hop headers
        'connection': 'keep-alive',
      }
    };

    // Remove hop-by-hop headers
    delete (options.headers as any)['transfer-encoding'];
    delete (options.headers as any)['content-length'];

    const proxyReq = http.request(options, (proxyRes) => {
      // Copy status code
      res.status(proxyRes.statusCode || 500);
      
      // Copy headers
      Object.keys(proxyRes.headers).forEach(key => {
        const value = proxyRes.headers[key];
        if (value && !['connection', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });
      
      // Pipe response
      proxyRes.pipe(res);
      proxyRes.on('end', () => resolve());
    });

    proxyReq.on('error', (err: Error) => {
      console.error(`Proxy error for port ${targetPort}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: `Preview server unavailable (port ${targetPort})`
        });
      }
      reject(err);
    });

    // Handle client disconnect
    req.on('close', () => {
      proxyReq.destroy();
    });

    // Pipe request body
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  });
};

// Fixed preview route - MUST be before other routes
app.use('/preview/:sessionId', async (req, res, next) => {
  const sessionId = req.params.sessionId;
  
  // Don't proxy WebSocket upgrade requests (handled by upgrade handler)
  if (req.headers.upgrade === 'websocket') {
    return next();
  }
  
  // Don't proxy the /hmr path for HTTP requests (WebSocket only)
  if (req.path.endsWith('/hmr') || req.path.includes('/hmr/')) {
    return res.status(400).json({
      success: false,
      error: 'HMR endpoint is WebSocket only'
    });
  }
  
  const session = bundler.getPreviewSession(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Preview session not found'
    });
  }
  
  if (session.status !== 'active') {
    return res.status(410).json({
      success: false,
      error: 'Preview session expired'
    });
  }
  
  // Remove /preview/:sessionId prefix from path
  const targetPath = req.url.replace(`/preview/${sessionId}`, '') || '/';
  
  try {
    await proxyRequest(req, res, session.port, targetPath);
  } catch (error) {
    console.error(`Proxy error for session ${sessionId}:`, error);
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: 'Failed to proxy request to preview server'
      });
    }
  }
});
```

## Fix 2: WebSocket Upgrade Handler

Use the implementation from `websocket-proxy-implementation.ts` - it properly handles WebSocket handshakes.

## Fix 3: Route Order

**CRITICAL**: The preview route must be registered BEFORE other catch-all routes. Make sure your route order is:

```typescript
// 1. Health check (no path conflict)
app.get('/health', ...);

// 2. Preview routes (specific paths)
app.use('/preview/:sessionId', ...);

// 3. Other API routes
app.post('/bundle', ...);
app.post('/kontext/bundle', ...);
app.post('/kontext/preview', ...);

// 4. Catch-all routes LAST
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

## Fix 4: Verify Vite Server is Running

Add logging to verify the Vite dev server is actually running:

```typescript
// In createPreviewSession, after devServer.listen():
await devServer.listen();

console.log(`✅ Vite dev server listening on port ${actualPort}`);
console.log(`✅ Vite HMR server listening on port ${actualHmrPort}`);

// Test the connection
const testReq = http.request({
  hostname: 'localhost',
  port: actualPort,
  path: '/',
  method: 'GET'
}, (res) => {
  console.log(`✅ Vite server responding: ${res.statusCode}`);
});

testReq.on('error', (err) => {
  console.error(`❌ Vite server not responding:`, err);
});

testReq.end();
```

## Debugging Steps

1. **Check if Vite server is running**: Look for "Vite dev server listening" logs
2. **Check session exists**: Log `bundler.getPreviewSession(sessionId)` result
3. **Check port**: Verify the port in the session matches what Vite is using
4. **Test direct connection**: Try `curl http://localhost:${port}` to see if Vite responds

## Common Issues

1. **Route order**: Preview route must be before catch-all routes
2. **Port mismatch**: Vite might be using a different port than stored in session
3. **Vite not started**: Dev server might not have started successfully
4. **Headers**: Hop-by-hop headers need to be removed in proxy

