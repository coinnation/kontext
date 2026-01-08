# Default index.html Template for Preview Sessions

## Recommended Default Template

When creating a default `index.html` for preview sessions, use this template:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kontext Preview</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
                'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
                sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            background: #1a1a1a;
            color: #ffffff;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
        }
        p {
            font-size: 1.1rem;
            line-height: 1.6;
            color: #cccccc;
        }
        .code {
            background: #2a2a2a;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Kontext Preview</h1>
        <p>
            Your preview session is ready! Start building by creating an <span class="code">index.html</span> file
            or editing your existing files.
        </p>
        <p>
            Changes will appear here automatically with hot module reloading (HMR).
        </p>
    </div>
    <script>
        // Basic console log to verify the page loaded
        console.log('✅ Kontext Preview loaded');
        console.log('📝 Create an index.html file to see your content here');
    </script>
</body>
</html>
```

## Minimal Template (if you prefer simpler)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kontext Preview</title>
</head>
<body>
    <h1>Preview Ready</h1>
    <p>Create an index.html file to see your content.</p>
</body>
</html>
```

## Integration with Element Selection Script

If you're injecting the element selection script, make sure to inject it into the default template:

```javascript
const defaultIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kontext Preview</title>
</head>
<body>
    <h1>Preview Ready</h1>
    <p>Create an index.html file to see your content.</p>
    ${selectionScript} <!-- Inject selection script here -->
</body>
</html>`;
```

## Benefits

1. **User-friendly**: Shows a helpful message instead of blank page
2. **Verifies connection**: Confirms preview session is working
3. **Clear instructions**: Tells user what to do next
4. **Professional**: Looks polished, not like an error

