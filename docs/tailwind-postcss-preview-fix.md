# Tailwind CSS Not Working in Preview Sessions

## Problem
Tailwind CSS styles are not being applied in preview sessions, even though all necessary files are present:
- `tailwind.config.js` ✅
- `postcss.config.js` ✅
- `styles.css` (with @tailwind directives) ✅

**Server logs show:**
```
⚠️  WARNING: CSS still contains @tailwind directives - PostCSS/Tailwind not processing!
```

## Root Cause

The server is currently:
1. ✅ Copying PostCSS and Tailwind configs to the temp directory root
2. ✅ Adding `css: { postcss: './postcss.config.js' }` to the Vite config
3. ❌ But Vite is running with `root: '.'` from the temp directory root (`/app/temp-previews/preview-{sessionId}/`)

**The problem:** Even though the configs are at the root, Vite needs to run from `src/frontend/` where the original configs are located, OR the PostCSS config path needs to be absolute/resolved correctly.

## Solution (Server-Side Fix Required)

### Option 1: Set Vite Root to `src/frontend/` (RECOMMENDED)

In `JSBundlerService.createPreviewSession()`, when creating the Vite dev server, set the root to `src/frontend/`:

```javascript
// For icpstudio projects, Vite root should be src/frontend (where package.json, postcss.config.js, tailwind.config.js are)
const viteConfig = {
  root: path.join(tempDir, 'src/frontend'), // CRITICAL: Point to where postcss.config.js is
  plugins: [react()],
  server: {
    port: port,
    host: '0.0.0.0',
    hmr: {
      // HMR config
    }
  },
  css: {
    postcss: './postcss.config.js' // Will be found at src/frontend/postcss.config.js
  }
};

const devServer = await createServer(viteConfig);
```

**Benefits:**
- PostCSS config is in the same directory as the root
- Tailwind config is in the same directory as the root
- CSS files are at `src/styles.css` relative to root
- Matches the actual project structure

### Option 2: Use Absolute Path for PostCSS Config

If keeping `root: '.'` (temp directory root), use an absolute path:

```javascript
const viteConfig = {
  root: '.', // temp directory root
  plugins: [react()],
  server: {
    port: port,
    host: '0.0.0.0',
  },
  css: {
    postcss: path.join(tempDir, 'postcss.config.js') // Absolute path
  }
};
```

### Current Server Behavior

The server logs show:
- Files written to: `/app/temp-previews/preview-{sessionId}/src/frontend/`
- Configs copied to: `/app/temp-previews/preview-{sessionId}/postcss.config.js` (root)
- Vite config has: `root: '.'` (temp directory root)
- Vite config has: `css: { postcss: './postcss.config.js' }`
- **But PostCSS still isn't processing!**

The issue is that when Vite processes CSS files at `src/frontend/src/styles.css`, it looks for PostCSS config relative to the CSS file location, not the Vite root. Setting Vite root to `src/frontend/` fixes this.

### Verification

To verify the fix works:
1. Check server logs: Vite root should be `/app/temp-previews/preview-{sessionId}/src/frontend/`
2. Check CSS response: Should NOT contain `@tailwind` directives (they should be processed)
3. Check browser: Tailwind classes should be applied

## Frontend Status

The frontend is correctly:
- ✅ Generating `vite.config.js` with `root: '.'` and `port: 3000`
- ✅ Including all necessary files (PostCSS, Tailwind configs, CSS files)
- ✅ Server will inject the port and add PostCSS config

**The server needs to override `root: '.'` to `root: 'src/frontend/'` for icpstudio projects when creating the Vite dev server.**

