# User Edit Workflows with Hot Reload

## Overview

Users can make edits in Kontext through **two primary methods**, and hot reload will work with both:

1. **AI Chat** (Conversational Editing)
2. **Direct Code Editing** (Monaco Editor)

## Method 1: AI Chat Editing (Current Primary Method)

### Current Flow
```
User: "Make the header blue"
  ↓
AI generates code → Updates Header.tsx
  ↓
Files saved to state → Full deployment (1-3 min)
  ↓
Preview updates
```

### With Hot Reload
```
User: "Make the header blue"
  ↓
AI generates code → Updates Header.tsx
  ↓
Change Detection:
  - Detects: CSS/style change
  - Strategy: preview-update
  ↓
Hot Reload Service:
  - Updates preview session
  - Vite HMR triggers
  ↓
Preview updates in 2-5 seconds ✨
  ↓
(Background: Full deployment continues for persistence)
```

### Integration Point

**Location**: `src/frontend/src/store/slices/chatActionsSlice.ts`

After AI generates code in `handleCodeUpdateRequest`:

```typescript
// After files are extracted and saved
const analysis = changeDetectionService.analyzeChanges(oldFiles, newFiles);

if (analysis.strategy === 'preview-update' || analysis.strategy === 'hot-reload') {
  // Get current project files
  const projectFiles = getProjectFiles(activeProject);
  const packageJson = extractPackageJson(projectFiles);
  
  // Create or update preview session
  const session = await hotReloadService.createPreviewSession(
    activeProject,
    convertToFileArray(projectFiles),
    packageJson
  );
  
  // Update preview if session exists
  if (analysis.strategy === 'preview-update') {
    await hotReloadService.updatePreviewFiles(
      activeProject,
      analysis.changes.map(c => ({
        fileName: c.fileName,
        content: c.newContent
      }))
    );
  }
  
  // Show notification
  showNotification('✨ Changes applied! Preview updating...', 'success');
}
```

## Method 2: Direct Code Editing (Monaco Editor)

### Current Flow
```
User opens file in Monaco Editor
  ↓
User edits code directly
  ↓
User saves (Cmd/Ctrl + S)
  ↓
File saved to backend → Full deployment needed
  ↓
Preview updates (after deployment)
```

### With Hot Reload
```
User opens file in Monaco Editor
  ↓
User edits code directly
  ↓
User saves (Cmd/Ctrl + S)
  ↓
File saved to backend
  ↓
Change Detection:
  - Detects: What type of change?
  - Strategy: hot-reload | preview-update | full-deploy
  ↓
Hot Reload Service:
  - Updates preview session (if applicable)
  - Vite HMR triggers
  ↓
Preview updates in 2-5 seconds ✨
```

### Integration Point

**Location**: `src/frontend/src/store/slices/uiSlice.ts`

In the `saveFileContent` function, after file is saved:

```typescript
saveFileContent: async (): Promise<boolean> => {
  // ... existing save logic ...
  
  if (result) {
    // ✅ File saved successfully
    
    // NEW: Trigger hot reload if applicable
    const { activeProject } = get() as any;
    if (activeProject && currentFile) {
      // Get old and new content
      const oldContent = state.generatedFiles[currentFile] || '';
      const newContent = editContent;
      
      // Analyze change
      const analysis = changeDetectionService.analyzeChanges(
        { [currentFile]: oldContent },
        { [currentFile]: newContent }
      );
      
      // Update preview if hot reloadable
      if (analysis.strategy === 'preview-update' || analysis.strategy === 'hot-reload') {
        try {
          await hotReloadService.updatePreviewFiles(
            activeProject,
            analysis.changes.map(c => ({
              fileName: c.fileName,
              content: c.newContent
            }))
          );
          
          showNotification('✨ Preview updated!', 'success');
        } catch (error) {
          console.error('Hot reload failed:', error);
          // Fallback: User can manually deploy
        }
      }
    }
    
    return true;
  }
}
```

## Method 3: Visual Editing (Future Enhancement)

### Potential Flow (Like Mocha)
```
User clicks on element in preview
  ↓
Visual editor opens
  ↓
User makes visual changes (color, size, position)
  ↓
Changes converted to code
  ↓
Hot Reload triggers
  ↓
Preview updates instantly
```

### Implementation (Future)
- Add click handlers to preview iframe
- Detect element selection
- Show visual property editor
- Convert visual changes to CSS/JS
- Trigger hot reload

## Complete Integration Architecture

### File Change Detection Hook

Create a service that watches for file changes from ANY source:

```typescript
// src/frontend/src/services/FileChangeWatcher.ts
class FileChangeWatcher {
  private watchProject(projectId: string) {
    // Watch for changes from:
    // 1. AI code generation
    // 2. Direct file editing
    // 3. File saves
    
    // When change detected:
    // 1. Analyze change type
    // 2. Route to appropriate strategy
    // 3. Trigger hot reload if applicable
  }
}
```

### Integration Points Summary

| Edit Method | Trigger Point | Hot Reload Integration |
|------------|---------------|----------------------|
| **AI Chat** | After `updateGeneratedFiles` in `chatActionsSlice.ts` | Analyze changes → Update preview session |
| **Monaco Editor** | After `saveFileContent` in `uiSlice.ts` | Analyze changes → Update preview session |
| **File Save** | After `saveIndividualFile` in `projectFilesSlice.ts` | Analyze changes → Update preview session |

## User Experience Examples

### Example 1: AI Chat Edit
1. User types: "Change the button color to green"
2. AI generates: Updates `Button.tsx` with green color
3. System detects: CSS/style change
4. Hot reload: Preview updates in 3 seconds
5. User sees: Green button immediately ✨

### Example 2: Direct Code Edit
1. User opens `Header.tsx` in Monaco editor
2. User changes: `color: 'blue'` → `color: 'red'`
3. User saves: Cmd/Ctrl + S
4. System detects: CSS change
5. Hot reload: Preview updates in 2 seconds
6. User sees: Red header immediately ✨

### Example 3: Backend Change
1. User edits `main.mo` (Motoko backend)
2. User saves file
3. System detects: Backend file change
4. Strategy: Full deployment required
5. Notification: "Backend changes require deployment"
6. User clicks: Deploy button
7. Full deployment: 1-3 minutes
8. Preview updates after deployment

## Implementation Checklist

### Phase 1: AI Chat Integration
- [ ] Add change detection after AI code generation
- [ ] Create preview session when first file is generated
- [ ] Update preview session when files change
- [ ] Show notification when preview updates

### Phase 2: Direct Editing Integration
- [ ] Add change detection after file save
- [ ] Update preview session on file save
- [ ] Handle multiple rapid saves (debounce)
- [ ] Show notification when preview updates

### Phase 3: Visual Editing (Future)
- [ ] Add element selection in preview
- [ ] Create visual property editor
- [ ] Convert visual changes to code
- [ ] Trigger hot reload on visual changes

## Error Handling

### If Hot Reload Fails
1. Show error notification
2. Fallback to full deployment
3. Allow user to manually deploy
4. Log error for debugging

### If Preview Session Expires
1. Automatically create new session
2. Show notification: "Preview session refreshed"
3. Continue with hot reload

### If Backend Unavailable
1. Show warning: "Hot reload unavailable"
2. Fallback to full deployment
3. Queue hot reload for when backend is available

## Performance Considerations

### Debouncing
- Debounce file saves: 500ms
- Batch multiple file changes: 1 second
- Prevent excessive preview updates

### Session Management
- Reuse preview sessions when possible
- Clean up expired sessions
- Limit concurrent sessions per user

### Network Optimization
- Compress file updates
- Batch multiple file changes
- Use WebSocket for HMR (already handled by Vite)

## User Notifications

### Success
- "✨ Preview updated! Changes visible in 2-5 seconds"
- "⚡ Hot reload active - changes apply instantly"

### Info
- "🔄 Updating preview session..."
- "📦 Full deployment in progress (background)"

### Warning
- "⚠️ Backend changes require full deployment"
- "⏱️ Preview session expired, creating new one..."

### Error
- "❌ Hot reload failed, using full deployment"
- "🔧 Preview unavailable, please deploy manually"

