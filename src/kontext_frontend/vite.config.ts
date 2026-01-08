import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

// 🔥 SIMPLIFIED CONFIG - Aligning with JSBundler's vanilla Vite approach
// The JSBundler just uses Vite's build() with minimal customization
export default defineConfig({
    plugins: [
        react({
            jsxRuntime: 'automatic',
            babel: {
                babelrc: false,
                configFile: false
            }
        }),
        // Plugin to copy .ic-assets.json5 to dist (Vite skips dotfiles by default)
        {
            name: 'copy-ic-assets-config',
            closeBundle() {
                try {
                    copyFileSync(
                        resolve(__dirname, 'public/.ic-assets.json5'),
                        resolve(__dirname, 'dist/.ic-assets.json5')
                    );
                    console.log('✅ Copied .ic-assets.json5 to dist/');
                } catch (err) {
                    console.warn('⚠️ Failed to copy .ic-assets.json5:', err);
                }
            }
        }
    ],
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        sourcemap: true,
        // Let Vite handle chunking automatically - it's smarter than manual chunking
        rollupOptions: {
            input: resolve(__dirname, 'index.html'),
            output: {
                // Use Vite's default intelligent chunking
                manualChunks: undefined
            }
        },
        // 🔥 TEMPORARILY DISABLE MINIFICATION TO DEBUG INITIALIZATION ERROR
        minify: false,
        cssMinify: false,
        target: 'es2020',
        chunkSizeWarningLimit: 2000
    },
    server: {
        port: 3000
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src')
        }
    },
    // Let Vite handle optimization automatically
    optimizeDeps: {
        // Only exclude things that MUST be lazy loaded
        exclude: [
            'monaco-editor'
        ]
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    }
});
