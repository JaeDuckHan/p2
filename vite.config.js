import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Required by some crypto/wallet libraries that reference global
    global: 'globalThis',
  },
})
