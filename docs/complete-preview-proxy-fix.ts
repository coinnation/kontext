/**
 * Complete Preview Proxy Fix for Express Server
 * 
 * This file contains all the fixes needed for the preview proxy to work correctly.
 * Copy the relevant sections into your Express server file.
 */

import express from 'express';
import http from 'http';
import https from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

// ============================================================================
// FIX 1: Improved HTTP Proxy Function
// ============================================================================

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

// ============================================================================
// FIX 2: Preview HTTP Proxy Route
// ============================================================================

function setupPreviewHttpProxy(app: express.Application, bundler: any): void {
  // CRITICAL: This route must be registered BEFORE other routes
  app.use('/preview/:sessionId', async (req, res, next) => {
    const sessionId = req.params.sessionId;

    // Skip WebSocket upgrade requests (handled by upgrade handler)
    if (req.headers.upgrade === 'websocket') {
      return next();
    }

    // Don't proxy /hmr path for HTTP requests (WebSocket only)
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
}

// ============================================================================
// FIX 3: WebSocket Upgrade Handler
// ============================================================================

function setupWebSocketProxy(
  httpServer: http.Server,
  httpsServer: https.Server | undefined,
  bundler: any
): void {
  const handleWebSocketUpgrade = (
    request: IncomingMessage,
    socket: any,
    head: Buffer,
    isSecure: boolean = false
  ): void => {
    try {
      const protocol = isSecure ? 'https' : 'http';
      const url = new URL(request.url || '', `${protocol}://${request.headers.host}`);
      const pathMatch = url.pathname.match(/^\/preview\/([^/]+)\/hmr/);

      if (!pathMatch) {
        // Not a preview HMR request, ignore
        return;
      }

      const sessionId = pathMatch[1];
      console.log(`🔄 WebSocket upgrade request for session ${sessionId}`);

      const session = bundler.getPreviewSession(sessionId);

      if (!session) {
        console.log(`❌ WebSocket upgrade: Session not found: ${sessionId}`);
        socket.destroy();
        return;
      }

      if (session.status !== 'active') {
        console.log(`❌ WebSocket upgrade: Session expired: ${sessionId}`);
        socket.destroy();
        return;
      }

      console.log(`🔄 Proxying WebSocket for session ${sessionId} to HMR port ${session.hmrPort}`);

      // Create WebSocket connection to Vite HMR server
      const targetWs = new WebSocket(`ws://localhost:${session.hmrPort}`, {
        headers: {
          'Origin': `http://localhost:${session.hmrPort}`,
        }
      });

      // Create WebSocket server to handle client connection
      const wss = new WebSocketServer({ noServer: true });

      // Handle the client upgrade
      wss.handleUpgrade(request, socket, head, (clientWs: WebSocket) => {
        console.log(`✅ WebSocket proxy established for session ${sessionId}`);

        // Forward messages from client to Vite HMR server
        clientWs.on('message', (data: Buffer, isBinary: boolean) => {
          if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(data, { binary: isBinary });
          }
        });

        // Forward messages from Vite HMR server to client
        targetWs.on('message', (data: Buffer, isBinary: boolean) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data, { binary: isBinary });
          }
        });

        // Handle errors
        clientWs.on('error', (error: Error) => {
          console.error(`❌ WebSocket client error for session ${sessionId}:`, error.message);
          if (targetWs.readyState !== WebSocket.CLOSED) {
            targetWs.close();
          }
        });

        targetWs.on('error', (error: Error) => {
          console.error(`❌ WebSocket target error for session ${sessionId}:`, error.message);
          if (clientWs.readyState !== WebSocket.CLOSED) {
            clientWs.close();
          }
        });

        // Handle close
        clientWs.on('close', (code: number, reason: Buffer) => {
          console.log(`🔌 WebSocket client closed for session ${sessionId} (code: ${code})`);
          if (targetWs.readyState !== WebSocket.CLOSED) {
            targetWs.close();
          }
        });

        targetWs.on('close', (code: number, reason: Buffer) => {
          console.log(`🔌 WebSocket target closed for session ${sessionId} (code: ${code})`);
          if (clientWs.readyState !== WebSocket.CLOSED) {
            clientWs.close();
          }
        });
      });

      // Handle target connection errors
      targetWs.on('error', (error: Error) => {
        console.error(`❌ Failed to connect to Vite HMR server for session ${sessionId}:`, error.message);
        if (!socket.destroyed) {
          socket.destroy();
        }
      });

    } catch (error) {
      console.error(`❌ Error handling WebSocket upgrade:`, error);
      if (!socket.destroyed) {
        socket.destroy();
      }
    }
  };

  // Setup HTTP WebSocket upgrade handler
  httpServer.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    handleWebSocketUpgrade(request, socket, head, false);
  });

  // Setup HTTPS WebSocket upgrade handler
  if (httpsServer) {
    httpsServer.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
      handleWebSocketUpgrade(request, socket, head, true);
    });
  }
}

// ============================================================================
// USAGE IN startServer FUNCTION
// ============================================================================

/**
 * Example of how to use these fixes in your startServer function:
 * 
 * async function startServer(): Promise<void> {
 *   const app = express();
 *   const bundler = new JSBundlerService();
 *   
 *   // ... middleware setup ...
 *   
 *   // CRITICAL: Setup preview proxy BEFORE other routes
 *   setupPreviewHttpProxy(app, bundler);
 *   
 *   // ... other routes ...
 *   
 *   const httpServer = http.createServer(app);
 *   const httpsServer = https.createServer(sslOptions, app);
 *   
 *   // Setup WebSocket proxy
 *   setupWebSocketProxy(httpServer, httpsServer, bundler);
 *   
 *   httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
 *     console.log(`✅ HTTP server running on port ${HTTP_PORT}`);
 *   });
 *   
 *   if (httpsServer) {
 *     httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
 *       console.log(`✅ HTTPS server running on port ${HTTPS_PORT}`);
 *     });
 *   }
 * }
 */

export { setupPreviewHttpProxy, setupWebSocketProxy, proxyRequest };

