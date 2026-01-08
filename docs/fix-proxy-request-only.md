# Fix for proxyRequest Function Only

## Issue
Your current `proxyRequest` function is missing:
1. Proper error handling
2. Hop-by-hop header removal
3. Client disconnect handling
4. Timeout handling
5. Proper async/await pattern

## Replace Your `proxyRequest` Function

Find this function in your `index.mjs`:

```typescript
const proxyRequest = (req: express.Request, res: express.Response, targetPort: number, targetPath: string = '') => {
  // ... current implementation
};
```

Replace it with this improved version:

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
      hostname: '127.0.0.1', // Use IPv4 explicitly (localhost can resolve to IPv6 ::1)
      port: targetPort,
      path: targetPath || req.url,
      method: req.method,
      family: 4, // Force IPv4
      headers: {
        ...req.headers,
        host: `127.0.0.1:${targetPort}`, // Use IPv4 in host header too
        connection: 'keep-alive',
      }
    };

    // Remove hop-by-hop headers that shouldn't be forwarded
    delete (options.headers as any)['transfer-encoding'];
    delete (options.headers as any)['content-length'];
    delete (options.headers as any)['upgrade'];
    delete (options.headers as any)['connection'];

    const proxyReq = http.request(options, (proxyRes) => {
      // Don't send response if headers already sent
      if (res.headersSent) {
        return resolve();
      }

      // Copy status code
      res.status(proxyRes.statusCode || 500);

      // Copy headers (excluding hop-by-hop headers)
      Object.keys(proxyRes.headers).forEach(key => {
        const value = proxyRes.headers[key];
        const lowerKey = key.toLowerCase();
        
        // Skip hop-by-hop headers
        if (value && !['connection', 'transfer-encoding', 'upgrade', 'keep-alive'].includes(lowerKey)) {
          res.setHeader(key, value);
        }
      });

      // Pipe response
      proxyRes.pipe(res);
      proxyRes.on('end', () => resolve());
      proxyRes.on('error', (err) => {
        console.error(`Proxy response error:`, err);
        reject(err);
      });
    });

    proxyReq.on('error', (err: Error) => {
      console.error(`Proxy request error for port ${targetPort}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: `Preview server unavailable (port ${targetPort})`,
          details: err.message
        });
      }
      reject(err);
    });

    // Handle client disconnect
    req.on('close', () => {
      if (!proxyReq.destroyed) {
        proxyReq.destroy();
      }
    });

    // Handle timeout
    proxyReq.setTimeout(30000, () => {
      console.error(`Proxy request timeout for port ${targetPort}`);
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: 'Preview server timeout'
        });
      }
      reject(new Error('Proxy timeout'));
    });

    // Pipe request body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  });
};
```

## Update Your Preview Route

Also update your `/preview/:sessionId` route to use `await`:

```typescript
// Proxy HTTP requests to Vite dev server
app.use('/preview/:sessionId', async (req, res, next) => {
  const sessionId = req.params.sessionId;
  
  // Skip WebSocket upgrade requests (handled by upgrade handler)
  if (req.headers.upgrade === 'websocket') {
    return next();
  }
  
  // Don't proxy the /hmr path for HTTP requests (WebSocket only)
  if (req.path.endsWith('/hmr') || req.path.includes('/hmr/')) {
    return res.status(400).json({
      success: false,
      error: 'HMR endpoint is WebSocket only. Use wss:// protocol.'
    });
  }
  
  console.log(`📡 Proxying HTTP request for session ${sessionId}: ${req.method} ${req.path}`);
  
  const session = bundler.getPreviewSession(sessionId);
  
  if (!session) {
    console.log(`❌ Session not found: ${sessionId}`);
    return res.status(404).json({
      success: false,
      error: 'Preview session not found'
    });
  }
  
  if (session.status !== 'active') {
    console.log(`❌ Session expired: ${sessionId}`);
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
    console.error(`❌ Proxy error for session ${sessionId}:`, error);
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: 'Failed to proxy request to preview server',
        sessionId,
        port: session.port
      });
    }
  }
});
```

## Remove the HMR HTTP Route

You can remove this route entirely (it's not needed):

```typescript
// DELETE THIS - Not needed
app.use('/preview/:sessionId/hmr', async (req, res, next) => {
  // ... remove this entire route
});
```

The HMR endpoint is WebSocket-only, so HTTP requests to it should return 400 (as shown above).

## Summary of Changes

1. ✅ Made `proxyRequest` async with proper Promise handling
2. ✅ Added hop-by-hop header removal
3. ✅ Added client disconnect handling
4. ✅ Added timeout handling (30 seconds)
5. ✅ Improved error messages with port numbers
6. ✅ Made preview route async and added better logging
7. ✅ Removed unnecessary HMR HTTP route

After these changes, your 502 errors should be resolved!

