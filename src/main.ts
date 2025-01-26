import { App, inject } from "vue";
import { useGalaxisStore } from '@/store'

const GALAXIS_KEY = Symbol('galaxis')

// Function to create vue plugin
export function createGalaxis() {  
  return {
    async install(app: App) {

      // Use Pinia as global state manager for galaxis and it's host app
      // Note: The host app must install Pinia, and
      //       it should do so before the plugin installation
      const pinia = app.config.globalProperties.$pinia
      // Register Galaxis state in global Pinia
      const galaxis = useGalaxisStore(pinia);

      // Provide the GALAXIS_KEY to make it injectable in components
      app.provide(GALAXIS_KEY, galaxis);
    }
  }
}

// Helper function to inject Galaxis in components
export function useGalaxis() {
  const galaxis = inject(GALAXIS_KEY);
  if (!galaxis) {
    throw new Error('Galaxis has not been initialized. Make sure to use app.use(galaxis).');
  }
  return galaxis;
}
