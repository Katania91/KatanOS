import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 1000, // Aumenta leggermente il limite di warning (opzionale, ma utile)
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              if (id.includes('node_modules')) {
                // Separa le librerie principali di React
                if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                  return 'vendor-react';
                }
                // Separa la libreria dei grafici (spesso pesante)
                if (id.includes('chart.js')) {
                  return 'vendor-charts';
                }
                // Separa le icone
                if (id.includes('lucide-react')) {
                  return 'vendor-icons';
                }
                // Separa la libreria AI
                if (id.includes('@google/genai')) {
                  return 'vendor-ai';
                }
                // Tutto il resto va in un chunk generico "vendor"
                return 'vendor';
              }
            }
          }
        }
      }
    };
});
