import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
      server: {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'X-Frame-Options': 'DENY',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          
           'Content-Security-Policy': "default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' ws: https://*.googleapis.com https://*.firebaseio.com https://securetoken.googleapis.com; frame-src https://accounts.google.com https://*.firebaseapp.com; object-src 'none'; base-uri 'self'; form-action 'self'",
        },
        proxy: {
          '/api': 'http://localhost:8787',
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
});
