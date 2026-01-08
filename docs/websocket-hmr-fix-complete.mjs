/**
 * COMPLETE FIXED WebSocket Proxy for Vite HMR
 * 
 * This fixes the "Unexpected server response: 400" error when connecting to Vite HMR.
 * 
 * Key fixes:
 * 1. Use 127.0.0.1 instead of localhost (IPv4 vs IPv6)
 * 2. Connect to correct Vite HMR path (/)
 * 3. Wait for client upgrade before connecting to Vite
 * 4. Forward proper headers
 * 5. Handle connection order correctly
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

/**
 * Fixed WebSocket Proxy Setup
 */
function setupWebSocketProxy(
  httpServer,
  httpsServer,
  bundler
) {
  const handleWebSocketUpgrade = (
    request,
    socket,
    head,
    isSecure = false
  ) => {
    try {
      const protocol = isSecure ? 'https' : 'http';
      const url = new URL(request.url || '', `${protocol}://${request.headers.host}`);
      const pathMatch = url.pathname.match(/^\/preview\/([^/]+)\/hmr/);

      if (!pathMatch) {
        // Not a preview HMR request, ignore
        return;
      }

      const sessionId = pathMatch[1];
      console.log(`🔥🔥🔥 WEBSOCKET UPGRADE REQUEST RECEIVED 🔥🔥🔥`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log(`SessionId: ${sessionId}`);
      console.log(`URL: ${url.pathname}`);
      console.log(`Protocol: ${protocol}`);

      const session = bundler.getPreviewSession(sessionId);

      if (!session) {
        console.log(`❌ Session not found or expired: ${sessionId}`);
        console.log(`🔍 getPreviewSession called for: ${sessionId}`);
        console.log(`   Total sessions in map: ${bundler.getActiveSessionCount?.() || 'unknown'}`);
        socket.destroy();
        return;
      }

      if (session.status !== 'active') {
        console.log(`❌ WebSocket upgrade: Session expired or inactive: ${sessionId}`);
        socket.destroy();
        return;
      }

      console.log(`✅ Session found: ${sessionId} (port: ${session.port}, hmrPort: ${session.hmrPort})`);
      console.log(`🔄 Proxying WebSocket upgrade for session ${sessionId} to HMR port ${session.hmrPort}`);

      // Create WebSocket server to handle client connection FIRST
      const wss = new WebSocketServer({ noServer: true });

      // Handle the client upgrade FIRST, then connect to Vite
      wss.handleUpgrade(request, socket, head, (clientWs) => {
        console.log(`✅ Client WebSocket upgraded for session ${sessionId}`);

        // NOW connect to Vite HMR server AFTER client is upgraded
        // Vite HMR WebSocket expects:
        // - Path: / (root)
        // - Origin: http://127.0.0.1:PORT
        // - Host: 127.0.0.1:PORT
        const viteHmrUrl = `ws://127.0.0.1:${session.hmrPort}/`;
        
        console.log(`🔌 Connecting to Vite HMR server: ${viteHmrUrl}`);
        
        const targetWs = new WebSocket(viteHmrUrl, {
          headers: {
            'Origin': `http://127.0.0.1:${session.hmrPort}`,
            'Host': `127.0.0.1:${session.hmrPort}`,
            // Forward any WebSocket subprotocols from the client
            ...(request.headers['sec-websocket-protocol'] && {
              'Sec-WebSocket-Protocol': request.headers['sec-websocket-protocol']
            })
          }
        });

        // Wait for Vite connection to open
        targetWs.on('open', () => {
          console.log(`✅ WebSocket proxy established for session ${sessionId}`);
          console.log(`   Client ready: ${clientWs.readyState === WebSocket.OPEN ? 'OPEN' : clientWs.readyState}`);
          console.log(`   Target ready: ${targetWs.readyState === WebSocket.OPEN ? 'OPEN' : targetWs.readyState}`);

          // Forward messages from client to Vite HMR server
          clientWs.on('message', (data, isBinary) => {
            if (targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(data, { binary: isBinary });
            }
          });

          // Forward messages from Vite HMR server to client
          targetWs.on('message', (data, isBinary) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(data, { binary: isBinary });
            }
          });
        });

        // Handle target connection errors
        targetWs.on('error', (error) => {
          console.error(`❌ WebSocket target error for session ${sessionId}: ${error.message}`);
          console.error(`   Error details:`, error);
          
          // Try to get more details about the error
          if (error.message.includes('400')) {
            console.error(`   ⚠️  Vite rejected the connection with 400 Bad Request`);
            console.error(`   This usually means:`);
            console.error(`   1. Wrong path (should be /)`);
            console.error(`   2. Wrong headers`);
            console.error(`   3. Vite HMR server not running on port ${session.hmrPort}`);
            console.error(`   4. Vite HMR not configured correctly`);
          }
          
          if (clientWs.readyState !== WebSocket.CLOSED) {
            clientWs.close(1011, 'Vite HMR connection failed');
          }
        });

        // Handle client errors
        clientWs.on('error', (error) => {
          console.error(`❌ WebSocket client error for session ${sessionId}: ${error.message}`);
          if (targetWs.readyState !== WebSocket.CLOSED) {
            targetWs.close();
          }
        });

        // Handle close events
        clientWs.on('close', (code, reason) => {
          console.log(`🔌 WebSocket client closed for session ${sessionId} (code: ${code})`);
          if (targetWs.readyState !== WebSocket.CLOSED) {
            targetWs.close();
          }
        });

        targetWs.on('close', (code, reason) => {
          console.log(`🔌 WebSocket target closed for session ${sessionId} (code: ${code})`);
          if (clientWs.readyState !== WebSocket.CLOSED) {
            clientWs.close();
          }
        });
      });

      // Handle upgrade errors
      socket.on('error', (error) => {
        console.error(`❌ Socket error during upgrade for session ${sessionId}:`, error.message);
      });

    } catch (error) {
      console.error(`❌ Error handling WebSocket upgrade:`, error);
      if (!socket.destroyed) {
        socket.destroy();
      }
    }
  };

  // Setup HTTP WebSocket upgrade handler
  httpServer.on('upgrade', (request, socket, head) => {
    handleWebSocketUpgrade(request, socket, head, false);
  });

  // Setup HTTPS WebSocket upgrade handler
  if (httpsServer) {
    httpsServer.on('upgrade', (request, socket, head) => {
      handleWebSocketUpgrade(request, socket, head, true);
    });
  }
}

export { setupWebSocketProxy };

