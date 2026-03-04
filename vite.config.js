import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    // Required by some crypto/wallet libraries that reference global
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          wagmi: ['wagmi', 'viem'],
          walletconnect: ['@walletconnect/ethereum-provider'],
          xmtp: ['@xmtp/browser-sdk'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
