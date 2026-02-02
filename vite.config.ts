import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectRegister: 'inline', // 登録を確実にするためのオプション（任意）
      manifest: {
        name: '伊予絣計測アプリ',
        short_name: '絣計測',
        description: '織物の絣を計測するための職人向けアプリ',
        theme_color: '#1B305D',
        start_url: './',  // 現在のディレクトリから開始
        scope: './',      // 現在のディレクトリを範囲にする
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
