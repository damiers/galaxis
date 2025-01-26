import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }) // Add Vuetify with auto-import enabled
  ],
  resolve: {
    alias: {
      '@': '/examples/webapp/src'
    }
  },
})