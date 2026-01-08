# Session Management Fixes

## Problems Identified

1. **Race Condition**: Multiple calls to `createPreviewSession` happening simultaneously, each creating a new session
2. **Session Not Found**: Updates trying to use sessionId from a different session
3. **404 Errors**: Preview URLs returning 404 because session was replaced or expired

## Root Cause

Three different places are calling `createPreviewSession` at the same time:
- `PropertyEditor.tsx` - When applying visual edits
- `generatedFilesSlice.ts` - When AI generates code  
- `uiSlice.ts` - When user saves a file directly

All three see "no existing session" and all create new ones simultaneously.

## Fixes Applied

### 1. Added Lock Mechanism (HotReloadService.ts)

**Added:**
```typescript
private pendingCreations: Map<string, Promise<PreviewSession>> = new Map();
```

**Updated `createPreviewSession`:**
- Checks if session creation is already in progress
- If yes, waits for the existing creation to complete
- Prevents multiple concurrent session creations for the same project

### 2. Improved Session Validation (HotReloadService.ts)

**Updated `updatePreviewFiles`:**
- Re-fetches session from map before using it (ensures latest session)
- Double-checks session is still valid before making request
- Better error messages with session details

### 3. Enhanced Logging

Added detailed logging to help diagnose:
- When sessions are created vs reused
- Which sessionId is being used for updates
- Session age and expiration details
- Active sessions list when errors occur

## Server-Side Fixes (Already Applied)

1. **Session Reuse**: Server now properly reuses sessions when `sessionId` is provided
2. **Expiration Extension**: Sessions extend expiration on reuse (24 hours from reuse time)
3. **Status Validation**: Server checks session status before allowing updates
4. **Better Error Messages**: Server returns detailed error messages with sessionId

## Expected Behavior After Fixes

1. **Single Session Per Project**: Only one session created per project, even with concurrent calls
2. **Proper Reuse**: Existing sessions are reused instead of creating new ones
3. **Correct Updates**: Updates use the correct sessionId
4. **Better Diagnostics**: Logs show exactly what's happening

## Testing Checklist

- [ ] Only one session created per project (check server logs)
- [ ] Updates work without "Session not found" errors
- [ ] Preview URLs load correctly (no 404)
- [ ] Concurrent calls wait for first session creation
- [ ] Sessions are properly reused across updates

## Additional Notes

The lock mechanism ensures that even if multiple components call `createPreviewSession` simultaneously:
1. First call starts creating session
2. Subsequent calls wait for first to complete
3. All calls get the same session
4. Updates use the correct sessionId

This should completely eliminate the "Session not found" errors.

