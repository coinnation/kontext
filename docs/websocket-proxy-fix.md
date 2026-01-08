# WebSocket Proxy Fix for HMR

## Problem
The current manual TCP proxy approach doesn't properly handle WebSocket handshakes, which can cause connection failures.

## Solution
Use the `ws` library to properly proxy WebSocket connections.

## Installation

```bash
npm install ws
npm install --save-dev @types/ws
```

## Fixed WebSocket Upgrade Handler

Replace the WebSocket upgrade handlers in your Express server with this implementation:

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

// Helper function to proxy WebSocket connections
function proxyWebSocket(
  clientSocket: any,
  clientHead: Buffer,
  targetPort: number,
  sessionId: string
): void {
  // Create WebSocket connection to Vite HMR server
  const targetWs = new WebSocket(`ws://localhost:${targetPort}`, {
    headers: {
      'Origin': `http://localhost:${targetPort}`,
    }
  });

  let clientWs: WebSocket | null = null;

  targetWs.on('open', () => {
    console.log(`✅ WebSocket proxy established for session ${sessionId} (port ${targetPort})`);
    
    // Upgrade client connection to WebSocket
    // Note: The client connection is already upgraded by Express, we just need to pipe data
    // Create a WebSocket server to handle the client connection properly
    const wss = new WebSocketServer({ noServer: true });
    
    // Handle the upgrade
    wss.handleUpgrade(clientSocket, clientHead, (ws) => {
      clientWs = ws;
      
      // Forward messages from client to target
      ws.on('message', (data: Buffer) => {
        if (targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(data);
        }
      });
      
      // Forward messages from target to client
      targetWs.on('message', (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket client error for session ${sessionId}:`, error);
        targetWs.close();
      });
      
      targetWs.on('error', (error) => {
        console.error(`WebSocket target error for session ${sessionId}:`, error);
        ws.close();
      });
      
      // Handle close
      ws.on('close', () => {
        console.log(`WebSocket client closed for session ${sessionId}`);
        targetWs.close();
      });
      
      targetWs.on('close', () => {
        console.log(`WebSocket target closed for session ${sessionId}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    });
  });

  targetWs.on('error', (error) => {
    console.error(`Failed to connect to Vite HMR server for session ${sessionId}:`, error);
    if (!clientSocket.destroyed) {
      clientSocket.destroy();
    }
  });
}

// In your HTTP server setup:
httpServer.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const pathMatch = url.pathname.match(/^\/preview\/([^/]+)\/hmr/);
  
  if (pathMatch) {
    const sessionId = pathMatch[1];
    const session = bundler.getPreviewSession(sessionId);
    
    if (!session || session.status !== 'active') {
      console.log(`❌ Invalid or expired session: ${sessionId}`);
      socket.destroy();
      return;
    }
    
    console.log(`🔄 Proxying WebSocket upgrade for session ${sessionId} to port ${session.hmrPort}`);
    proxyWebSocket(socket, head, session.hmrPort, sessionId);
  } else {
    socket.destroy();
  }
});

// In your HTTPS server setup:
httpsServer.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
  const url = new URL(request.url || '', `https://${request.headers.host}`);
  const pathMatch = url.pathname.match(/^\/preview\/([^/]+)\/hmr/);
  
  if (pathMatch) {
    const sessionId = pathMatch[1];
    const session = bundler.getPreviewSession(sessionId);
    
    if (!session || session.status !== 'active') {
      console.log(`❌ Invalid or expired session: ${sessionId}`);
      socket.destroy();
      return;
    }
    
    console.log(`🔄 Proxying WebSocket upgrade (WSS) for session ${sessionId} to port ${session.hmrPort}`);
    proxyWebSocket(socket, head, session.hmrPort, sessionId);
  } else {
    socket.destroy();
  }
});
```

## Alternative: Simpler Approach (If ws library causes issues)

If you prefer to stick with Node's built-in modules, here's a corrected version that properly handles the WebSocket handshake:

```typescript
import { createConnection } from 'net';

function proxyWebSocketNative(
  clientSocket: any,
  clientHead: Buffer,
  targetPort: number,
  sessionId: string,
  request: IncomingMessage
): void {
  const targetSocket = createConnection(targetPort, 'localhost', () => {
    // Forward the upgrade request with all original headers
    const upgradeRequest = [
      `${request.method} ${request.url} HTTP/1.1`,
      `Host: localhost:${targetPort}`,
      ...Object.entries(request.headers).map(([key, value]) => {
        // Skip hop-by-hop headers
        const hopByHop = ['connection', 'upgrade', 'keep-alive', 'proxy-authenticate', 
                          'proxy-authorization', 'te', 'trailers', 'transfer-encoding'];
        if (hopByHop.includes(key.toLowerCase())) {
          return null;
        }
        return `${key}: ${Array.isArray(value) ? value.join(', ') : value}`;
      }).filter(Boolean),
      'Connection: Upgrade',
      'Upgrade: websocket',
      '', // Empty line before body
    ].join('\r\n') + '\r\n';
    
    targetSocket.write(upgradeRequest);
    
    if (clientHead && clientHead.length > 0) {
      targetSocket.write(clientHead);
    }
  });
  
  // Pipe data bidirectionally
  clientSocket.pipe(targetSocket);
  targetSocket.pipe(clientSocket);
  
  // Handle errors
  clientSocket.on('error', (err: Error) => {
    console.error(`WebSocket client error for session ${sessionId}:`, err);
    targetSocket.destroy();
  });
  
  targetSocket.on('error', (err: Error) => {
    console.error(`WebSocket target error for session ${sessionId}:`, err);
    clientSocket.destroy();
  });
  
  // Handle close
  clientSocket.on('close', () => {
    targetSocket.destroy();
  });
  
  targetSocket.on('close', () => {
    clientSocket.destroy();
  });
}
```

## Recommended: Use ws library

The `ws` library approach is more reliable and handles edge cases better. Use the first solution if possible.

