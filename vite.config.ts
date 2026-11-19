import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  // Safety: a production build must never point at the local emulators.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (command === 'build' && env.VITE_USE_EMULATORS === 'true') {
    throw new Error('VITE_USE_EMULATORS=true no está permitido al compilar para producción.');
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: [
        'react',
        'react-dom',
        'lucide-react',
        'firebase',
        '@firebase/app',
        '@firebase/component',
        '@firebase/firestore',
        '@firebase/auth',
        '@firebase/storage',
        '@firebase/util'
      ]
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'lucide-react',
        'firebase/app',
        'firebase/firestore',
        'firebase/auth',
        'firebase/storage'
      ]
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
