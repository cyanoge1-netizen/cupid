/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Use only VITE_BASE for the base path
const base = process.env.VITE_BASE || './';
const normalizedBase = base.endsWith('/') ? base : `${base}/`;
const manifestScope = base === './' ? './' : normalizedBase;
const shareAction = base === './' ? './share' : `${normalizedBase}share`;

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        id: manifestScope,
        name: 'ঘটকালি (Ghotkali)',
        short_name: 'ঘটকালি',
        description: 'বায়োডাটা ম্যানেজমেন্ট অ্যাপ',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        lang: 'bn',
        scope: manifestScope,
        start_url: manifestScope,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        share_target: {
          action: shareAction,
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            files: [
              {
                name: 'media',
                accept: [
                  'image/*',
                  'audio/*',
                  'application/pdf',
                  'application/msword',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'text/plain'
                ]
              }
            ]
          }
        }
      }
    })
  ],
  test: {
    environment: 'node',
    globals: true,
  }
});
