# Fix: Ensure Vite Server is Ready Before Returning Session

## Problem

The 502 errors are happening because the Vite dev server might not be fully started when the first request comes in. The current health check is non-blocking and might fail silently.

## Solution

Update the `createPreviewSession` method in `JSBundlerService.mjs` to wait for the Vite server to be ready before returning the session.

## Find This Code in `createPreviewSession`:

```typescript
await devServer.listen();

const actualPort = devServer.config.server.port || port;
const hmrConfig = devServer.config.server.hmr;
const actualHmrPort = (hmrConfig && typeof hmrConfig === 'object' && 'port' in hmrConfig) 
    ? hmrConfig.port || hmrPort 
    : hmrPort;

// Verify server is actually listening
const http = await import('http');
const testReq = http.request({
    hostname: 'localhost',
    port: actualPort,
    path: '/',
    method: 'GET',
    timeout: 2000
}, (res) => {
    console.log(`✅ Verified Vite server responding on port ${actualPort} (status: ${res.statusCode})`);
});

testReq.on('error', (err) => {
    console.warn(`⚠️  Warning: Could not verify Vite server on port ${actualPort}: ${err.message}`);
    console.warn(`   This may be normal if server is still starting. Will retry on first request.`);
});

testReq.on('timeout', () => {
    console.warn(`⚠️  Warning: Vite server health check timed out on port ${actualPort}`);
    testReq.destroy();
});

testReq.end();
```

## Replace With This (Waits for Server to be Ready):

```typescript
await devServer.listen();

const actualPort = devServer.config.server.port || port;
const hmrConfig = devServer.config.server.hmr;
const actualHmrPort = (hmrConfig && typeof hmrConfig === 'object' && 'port' in hmrConfig) 
    ? hmrConfig.port || hmrPort 
    : hmrPort;

// CRITICAL: Wait for Vite server to be ready before returning session
console.log(`⏳ Waiting for Vite server to be ready on port ${actualPort}...`);
const http = await import('http');

let serverReady = false;
let attempts = 0;
const maxAttempts = 10; // Try for up to 10 seconds
const retryDelay = 1000; // 1 second between attempts

while (!serverReady && attempts < maxAttempts) {
    attempts++;
    
    try {
        await new Promise<void>((resolve, reject) => {
            const testReq = http.request({
                hostname: '127.0.0.1', // Use IPv4 explicitly (localhost can resolve to IPv6 ::1)
                port: actualPort,
                path: '/',
                method: 'GET',
                timeout: 2000,
                family: 4 // Force IPv4
            }, (res) => {
                console.log(`✅ Vite server is ready on port ${actualPort} (status: ${res.statusCode}, attempt ${attempts})`);
                res.on('data', () => {}); // Consume response
                res.on('end', () => {
                    serverReady = true;
                    resolve();
                });
            });

            testReq.on('error', (err) => {
                if (attempts < maxAttempts) {
                    console.log(`   ⏳ Vite server not ready yet (attempt ${attempts}/${maxAttempts}): ${err.message}`);
                    reject(err);
                } else {
                    console.error(`❌ Vite server failed to start after ${maxAttempts} attempts: ${err.message}`);
                    reject(err);
                }
            });

            testReq.on('timeout', () => {
                testReq.destroy();
                if (attempts < maxAttempts) {
                    reject(new Error('Timeout'));
                } else {
                    reject(new Error(`Vite server health check timed out after ${maxAttempts} attempts`));
                }
            });

            testReq.end();
        });
        
        // If we get here, server is ready
        break;
        
    } catch (error) {
        if (attempts >= maxAttempts) {
            // Release ports on failure
            this.releasePort(port);
            this.releasePort(hmrPort);
            throw new Error(`Vite dev server failed to start on port ${actualPort} after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
}

if (!serverReady) {
    // Release ports on failure
    this.releasePort(port);
    this.releasePort(hmrPort);
    throw new Error(`Vite dev server failed to become ready on port ${actualPort} after ${maxAttempts} attempts`);
}

console.log(`✅ Vite server confirmed ready on port ${actualPort} after ${attempts} attempt(s)`);
```

## What This Does

1. **Waits for Vite server** - Retries up to 10 times (10 seconds total)
2. **Verifies actual response** - Checks that the server returns a valid HTTP response
3. **Fails fast** - If server doesn't start, throws error immediately instead of returning broken session
4. **Better logging** - Shows progress of readiness checks

## Alternative: Add Retry Logic to Proxy

If you prefer to keep the non-blocking check, you can add retry logic to the proxy route instead:

```typescript
// In your /preview/:sessionId route, add retry logic:
let retries = 0;
const maxRetries = 3;

while (retries < maxRetries) {
    try {
        await proxyRequest(req, res, session.port, targetPath);
        break; // Success, exit retry loop
    } catch (error) {
        retries++;
        if (retries >= maxRetries) {
            // Final attempt failed
            throw error;
        }
        // Wait 500ms before retry
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`   🔄 Retrying proxy request (${retries}/${maxRetries})...`);
    }
}
```

## Recommendation

Use the **first approach** (wait for server to be ready) - it's cleaner and prevents 502 errors from happening in the first place.

