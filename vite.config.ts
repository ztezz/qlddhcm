import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { cloudflare } from "@cloudflare/vite-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3004';

    return {
        base: '/',
        server: {
            port: 3000,
            strictPort: true,
            host: '0.0.0.0',
            allowedHosts: 'all',
            proxy: {
                '/api': {
                    target: apiProxyTarget,
                    changeOrigin: true,
                    secure: false,
                },
                '/uploads': {
                    target: apiProxyTarget,
                    changeOrigin: true,
                    secure: false,
                }
            }
        },

        plugins: [react(), tailwindcss(), cloudflare()],

        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src'),
            }
        },

        build: {
            rollupOptions: {
                output: {
                    chunkFileNames: 'assets/js/[name]-[hash].js',
                    entryFileNames: 'assets/js/[name]-[hash].js',
                    assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
                }
            },
            chunkSizeWarningLimit: 2000,
            target: 'esnext',
            minify: 'esbuild',
            sourcemap: false
        }
    };
});