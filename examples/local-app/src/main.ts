import App from './App.vue'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createGalaxis } from 'galaxis'
import { createVuetify } from 'vuetify'
import { VSlider, VRangeSlider } from 'vuetify/components'

const app = createApp(App)

// Pinia: Global state manager (required by Galaxis)
const pinia = createPinia()
app.use(pinia)

// Galaxis: 3D viewer
const galaxis = createGalaxis()
app.use(galaxis)

// Vuetify: pre-defined UI components
const vuetify = createVuetify({
  components: { VSlider, VRangeSlider },
})
app.use(vuetify)

app.mount('#app')
