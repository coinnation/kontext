# Fix: IPv6 vs IPv4 Connection Issue

## Problem

The error `connect ECONNREFUSED ::1:30000` indicates that Node.js is trying to connect to IPv6 (`::1`) but Vite is listening on IPv4 (`127.0.0.1`). This happens when `localhost` resolves to IPv6 on some systems.

## Solution

Use `127.0.0.1` explicitly instead of `localhost` in all places where we connect to the Vite dev server.

## Fixes Needed

### 1. Fix `proxyRequest` function in `index.mjs`

**Find:**
```typescript
const options = {
  hostname: 'localhost',
  port: targetPort,
  // ...
  headers: {
    ...req.headers,
    host: `localhost:${targetPort}`,
    // ...
  }
};
```

**Replace with:**
```typescript
const options = {
  hostname: '127.0.0.1', // Use IPv4 explicitly
  port: targetPort,
  family: 4, // Force IPv4
  // ...
  headers: {
    ...req.headers,
    host: `127.0.0.1:${targetPort}`, // Use IPv4 in host header too
    // ...
  }
};
```

### 2. Fix Vite server health check in `JSBundlerService.mjs`

**Find:**
```typescript
const testReq = http.request({
    hostname: 'localhost',
    port: actualPort,
    // ...
});
```

**Replace with:**
```typescript
const testReq = http.request({
    hostname: '127.0.0.1', // Use IPv4 explicitly
    port: actualPort,
    family: 4, // Force IPv4
    // ...
});
```

### 3. Fix WebSocket proxy in `index.mjs`

**Find:**
```typescript
const targetWs = new WebSocket(`ws://localhost:${session.hmrPort}`, {
    headers: {
        'Origin': `http://localhost:${session.hmrPort}`,
    }
});
```

**Replace with:**
```typescript
const targetWs = new WebSocket(`ws://127.0.0.1:${session.hmrPort}`, {
    headers: {
        'Origin': `http://127.0.0.1:${session.hmrPort}`,
    }
});
```

## Why This Happens

- `localhost` can resolve to either IPv4 (`127.0.0.1`) or IPv6 (`::1`) depending on system configuration
- Vite's `host: '0.0.0.0'` binds to all interfaces, but Node.js HTTP client might prefer IPv6
- Using `127.0.0.1` explicitly ensures we always use IPv4, which matches Vite's default behavior

## Testing

After applying these fixes:
1. The health check should succeed
2. The proxy should connect successfully
3. WebSocket connections should work

The error `ECONNREFUSED ::1` should be gone.

