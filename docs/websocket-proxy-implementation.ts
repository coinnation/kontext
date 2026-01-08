/**
 * Complete WebSocket Proxy Implementation for HMR
 * 
 * Replace the WebSocket upgrade handlers in your Express server with this code.
 * 
 * Prerequisites:
 * npm install ws
 * npm install --save-dev @types/ws
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server as HTTPServer } from 'http';
import { Server as HTTPSServer } from 'https';

/**
 * Proxy WebSocket connection from client to Vite HMR server
 */
function setupWebSocketProxy(
  httpServer: HTTPServer,
  httpsServer: HTTPSServer | undefined,
  bundler: any // Your JSBundlerService instance
): void {
  
  /**
   * Handle WebSocket upgrade for a specific session
   */
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
        console.log(`⚠️  WebSocket upgrade request doesn't match preview pattern: ${url.pathname}`);
        socket.destroy();
        return;
      }
      
      const sessionId = pathMatch[1];
      const session = bundler.getPreviewSession(sessionId);
      
      if (!session) {
        console.log(`❌ WebSocket upgrade: Session not found: ${sessionId}`);
        socket.destroy();
        return;
      }
      
      if (session.status !== 'active') {
        console.log(`❌ WebSocket upgrade: Session expired or inactive: ${sessionId}`);
        socket.destroy();
        return;
      }
      
      console.log(`🔄 Proxying WebSocket upgrade for session ${sessionId} to HMR port ${session.hmrPort}`);
      
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

/**
 * Usage in your startServer function:
 * 
 * async function startServer(): Promise<void> {
 *   // ... existing code ...
 *   
 *   const httpServer = http.createServer(app);
 *   const httpsServer = https.createServer(sslOptions, app);
 *   
 *   // Setup WebSocket proxy BEFORE calling listen()
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
 *   
 *   // ... rest of your code ...
 * }
 */

export { setupWebSocketProxy };

