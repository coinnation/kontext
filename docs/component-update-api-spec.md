# Component Update API Specification

## Overview

This document describes how component updates (text changes, style changes) are sent from the frontend to the JSBundler server for live preview updates.

## Update Flow

### 1. User Action
- User selects an element in the preview iframe
- User edits text (e.g., changes "$543" to "$555") or styles in PropertyEditor
- User clicks "Apply" button

### 2. Frontend Processing

#### Step 1: Generate Updated Files
The frontend uses `VisualStyleGenerator` to:

**For text changes** (e.g., "$543" → "$555"):
- Searches through all `.tsx`, `.jsx`, `.ts`, `.js` files in the project
- Looks for the original text using multiple patterns:
  - `>oldText<` (JSX text content)
  - `"oldText"` (string literal)
  - `'oldText'` (string literal)
  - `` `oldText` `` (template literal)
  - `{"oldText"}` (JSX expression)
- Replaces the text while preserving surrounding quotes/brackets
- Returns: `{ filePath: string, content: string }` (full file content with text replaced)

**For style changes**:
- Finds or creates a CSS file (checks in order):
  - `src/frontend/index.css`
  - `src/frontend/App.css`
  - `src/frontend/styles.css`
  - `src/index.css`
  - Any existing `.css` file
  - Defaults to `src/frontend/index.css` if none found
- Generates CSS rule for the element selector (e.g., `div.price`, `#header`)
- Merges with existing CSS (updates existing rule or appends new one)
- Normalizes properties (camelCase → kebab-case, adds units if needed)
- Returns: `{ filePath: string, css: string }` (full CSS file content)

#### Step 2: Prepare File Updates
Creates an array of `FileUpdate` objects:
```typescript
interface FileUpdate {
  fileName: string;  // e.g., "src/frontend/App.tsx" or "src/frontend/index.css"
  content: string;  // Full file content with changes applied
}
```

**Example for text change ($543 → $555):**
```typescript
[
  {
    fileName: "src/frontend/App.tsx",
    content: "... (full file content with $555 instead of $543) ..."
  }
]
```

**Example for style change:**
```typescript
[
  {
    fileName: "src/frontend/index.css",
    content: "... (full CSS file with new/updated rule) ..."
  }
]
```

**Example for both text and style changes:**
```typescript
[
  {
    fileName: "src/frontend/App.tsx",
    content: "... (updated text) ..."
  },
  {
    fileName: "src/frontend/index.css",
    content: "... (updated styles) ..."
  }
]
```

### 3. API Request

#### Endpoint
```
POST https://jsbundler.coinnation.io/kontext/preview/{sessionId}/update
```

#### Headers
```
Content-Type: application/json
```

**CRITICAL**: Request must include `credentials: 'include'` to send cookies for session affinity (Ingress route cookie).

#### Request Body Format
```json
{
  "files": [
    {
      "name": "src/frontend/App.tsx",
      "content": "... full file content ..."
    },
    {
      "name": "src/frontend/index.css",
      "content": "... full CSS content ..."
    }
  ]
}
```

#### Important Notes:
1. **Full file content**: The `content` field contains the **entire file content**, not just the changed portion
2. **File paths**: Paths are normalized (project name prefix removed if present)
3. **Multiple files**: Can send multiple files in one request
4. **Session ID**: Must be a valid, non-expired session ID

### 4. Expected Server Behavior

#### Success Response
```json
{
  "success": true,
  "updated": ["src/frontend/App.tsx", "src/frontend/index.css"],
  "hmrTriggered": true
}
```

#### Server Should:
1. **Validate session**: Check that `sessionId` exists and is not expired
2. **Update files**: Write the new file contents to the preview session's file system
3. **Trigger HMR**: Notify Vite HMR to reload the changed files
4. **Return success**: Confirm which files were updated

#### Error Responses

**Session not found:**
```json
{
  "success": false,
  "error": "No active preview session",
  "code": "SESSION_NOT_FOUND"
}
```

**Session expired:**
```json
{
  "success": false,
  "error": "Preview session expired",
  "code": "SESSION_EXPIRED"
}
```

**Invalid file path:**
```json
{
  "success": false,
  "error": "Invalid file path: src/frontend/App.tsx",
  "code": "INVALID_FILE_PATH"
}
```

### 5. Frontend Error Handling

If the update request fails, the frontend will:
1. Check if error indicates "No active preview session" or "expired"
2. If so, create a new preview session with all project files
3. Then retry the update request

## Example Request/Response

### Request
```http
POST /kontext/preview/abc123xyz/update HTTP/1.1
Host: jsbundler.coinnation.io
Content-Type: application/json
Cookie: route=session-abc123xyz

{
  "files": [
    {
      "name": "src/frontend/App.tsx",
      "content": "import React from 'react';\n\nfunction App() {\n  return (\n    <div>\n      <h1>Price: $555</h1>\n    </div>\n  );\n}\n\nexport default App;"
    }
  ]
}
```

### Success Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "updated": ["src/frontend/App.tsx"],
  "hmrTriggered": true
}
```

### Error Response (Session Not Found)
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "success": false,
  "error": "No active preview session",
  "code": "SESSION_NOT_FOUND"
}
```

## File Path Normalization

The frontend normalizes file paths before sending:
- Removes project name prefix if present
- Ensures paths match server expectations
- Example: `project-name/src/frontend/App.tsx` → `src/frontend/App.tsx`

## Session Management

- Session ID is stored client-side after initial preview session creation
- Session expires after 24 hours
- Frontend checks expiration before sending updates
- If session expired, frontend creates new session automatically

## HMR Integration

After successful file update:
- Server should trigger Vite HMR
- HMR sends WebSocket message to preview iframe
- Preview automatically reloads changed files
- User sees changes in preview without manual refresh

## Debugging

### Client-Side Logging
The frontend logs:
- `[HotReload] 📝 Updating {count} files in preview session {sessionId}...`
- `[HotReload] ✅ Files updated, HMR will trigger automatically`
- `[HotReload] ❌ Update failed for session {sessionId}: {error}`

### Server-Side Should Log
- Session ID received
- Files being updated
- File write success/failure
- HMR trigger status
- Any errors encountered

## Common Issues & Server-Side Checks

### Issue: Updates not appearing in preview

**Server should verify:**
1. ✅ **Session ID exists and is valid**
   - Check session map/DB for `sessionId`
   - Verify session hasn't expired
   - Log: `[Server] Session lookup: {sessionId} = {found|not found}`

2. ✅ **Cookie routing is working**
   - Request should include `Cookie: route=session-{sessionId}`
   - Ingress should route to correct pod based on cookie
   - Log: `[Server] Received cookie: {cookie value}`

3. ✅ **Files are being written to correct location**
   - Files should be written to preview session's working directory
   - Path should match: `{sessionDir}/{filePath}`
   - Example: `sessions/abc123/src/frontend/App.tsx`
   - Log: `[Server] Writing file: {fullPath}, size: {bytes}`

4. ✅ **File content is correct**
   - Verify content is not empty
   - Check for encoding issues
   - Log first 100 chars: `[Server] File content preview: {content.substring(0, 100)}`

5. ✅ **HMR is triggered**
   - After file write, notify Vite HMR
   - Send WebSocket message to preview iframe
   - Log: `[Server] HMR triggered for: {filePath}`

### Issue: "No active preview session" error

**Server should:**
- Return 404 with clear error message
- Include error code: `SESSION_NOT_FOUND` or `SESSION_EXPIRED`
- Log: `[Server] Update request for non-existent session: {sessionId}`

**Frontend behavior:**
- Frontend will automatically create new session
- Then retry the update request

### Issue: Files updated but preview not refreshing

**Server should verify:**
1. ✅ **Vite HMR is running**
   - Check Vite dev server is active for session
   - Verify HMR WebSocket connection exists
   - Log: `[Server] HMR status: {active|inactive}`

2. ✅ **File change detection works**
   - Vite should detect file system changes
   - Check Vite logs for file change events
   - Log: `[Server] Vite detected change: {filePath}`

3. ✅ **WebSocket message sent**
   - Verify HMR message sent to preview iframe
   - Check WebSocket connection is open
   - Log: `[Server] HMR message sent: {message}`

### Issue: Request succeeds but files not updated

**Server should check:**
1. ✅ **File write permissions**
   - Ensure process can write to session directory
   - Check disk space available
   - Log: `[Server] File write result: {success|error}`

2. ✅ **File path resolution**
   - Verify relative paths are resolved correctly
   - Check for path traversal issues
   - Log: `[Server] Resolved path: {absolutePath}`

3. ✅ **File system sync**
   - Ensure file is flushed to disk
   - Verify file exists after write
   - Log: `[Server] File exists after write: {true|false}`

## Testing

To test the update endpoint manually:

```bash
curl -X POST https://jsbundler.coinnation.io/kontext/preview/{sessionId}/update \
  -H "Content-Type: application/json" \
  -H "Cookie: route=session-{sessionId}" \
  -d '{
    "files": [
      {
        "name": "src/frontend/App.tsx",
        "content": "import React from \"react\";\n\nfunction App() {\n  return <div>Test</div>;\n}\n\nexport default App;"
      }
    ]
  }'
```

Replace `{sessionId}` with a valid session ID from a created preview session.

