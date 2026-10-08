import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
 
function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '');
        return path.resolve(__dirname, 'src/assets', filename);
      }
    },
  };
}
 
export default defineConfig({
  plugins: [react(), tailwindcss(), figmaAssetResolver()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Push nativo solo si el proyecto Android tiene la configuración de Firebase
    // (sin google-services.json, registrar push cierra la app en Android).
    'import.meta.env.VITE_PUSH_ENABLED': JSON.stringify(
      fs.existsSync(path.resolve(__dirname, 'android/app/google-services.json')) ? 'true' : 'false'),
  },
  esbuild: {
    // Producción: sin console.log/info/debug (pueden exponer correos o datos
    // en equipos compartidos); se conservan warn y error.
    pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.info', 'console.debug'] : [],
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    port: 3000,
    open: true,
  },
});