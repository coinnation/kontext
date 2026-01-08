# Black Screen Fix Summary

## Issues Identified

1. **502 Bad Gateway** - HTTP proxy not working correctly
2. **SecurityError** - Cross-origin iframe access without proper checks
3. **Session Management** - Multiple sessions being created, old sessions not found
4. **Black Screen** - Iframe can't load due to 502 error

## Fixes Applied

### ✅ Fix 1: Cross-Origin Iframe Access (FIXED)

**File**: `src/frontend/src/services/ElementSelectionService.ts`

**Problem**: Code was trying to access `iframe.contentDocument` without checking if it's cross-origin, causing SecurityError.

**Solution**: Added cross-origin detection and proper error handling:
- Check if iframe is cross-origin before accessing document
- Use `setupCrossOriginSelection` for cross-origin iframes (postMessage only)
- Use `injectSelectionScript` only for same-origin iframes
- Wrap all document access in try-catch

### ⏳ Fix 2: HTTP Proxy (NEEDS TO BE APPLIED)

**File**: `index.mjs` (on jsbundler.coinnation.io server)

**Problem**: `proxyRequest` function missing proper error handling, timeout, and hop-by-hop header removal.

**Solution**: See `docs/fix-proxy-request-only.md` for the complete fix.

**Key changes**:
- Make function async with Promise handling
- Remove hop-by-hop headers
- Add 30-second timeout
- Add client disconnect cleanup
- Better error messages

### ⚠️ Fix 3: Session Management (NEEDS INVESTIGATION)

**Problem**: Multiple sessions being created for the same project, causing "Session not found" errors.

**Possible causes**:
1. Server creating new session even when `sessionId` is provided
2. Sessions expiring too quickly
3. Race condition - multiple `createPreviewSession` calls happening simultaneously

**Temporary workaround**: The code already tries to reuse sessions, but if the server doesn't honor the `sessionId` parameter, it will create new ones.

**To investigate**:
- Check server logs to see if `sessionId` parameter is being honored
- Check if sessions are being cleaned up prematurely
- Add session reuse logic on server side

## Immediate Actions Needed

1. **Apply HTTP proxy fix** (from `docs/fix-proxy-request-only.md`)
   - This will fix the 502 errors
   - This will allow the preview to load

2. **Verify cross-origin fix is working**
   - The SecurityError should be gone
   - Check browser console for any remaining errors

3. **Monitor session creation**
   - Check server logs to see why multiple sessions are being created
   - Verify session reuse logic on server side

## Testing Checklist

After applying fixes:

- [ ] Preview loads without 502 error
- [ ] No SecurityError in console
- [ ] Visual editing works (click element, see property editor)
- [ ] HMR WebSocket connects successfully
- [ ] Only one session created per project
- [ ] Session updates work (not "Session not found")

## Expected Behavior After Fixes

1. **Preview loads**: Iframe shows content from `https://jsbundler.coinnation.io/preview/{sessionId}`
2. **No console errors**: SecurityError should be gone
3. **Visual editing works**: Click element → property editor appears
4. **HMR works**: Changes trigger hot reload (if WebSocket connects)
5. **Single session**: One session per project, reused across updates

