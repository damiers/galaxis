<template>
  <div id="viewer-container">
    <div id="left-col-container">
      <canvas id="main-canvas" ref="mainCanvasElement"></canvas>
    </div>
    <div id="right-col-container">
      <Panel />
    </div>
  </div>
</template>

<script setup lang="ts">

import Panel from './components/Panel.vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { useGalaxis } from 'galaxis'
import type { ViewMode } from 'galaxis'

const mainCanvasElement = ref<HTMLCanvasElement>()
const viewId = 'main'

const galaxis = useGalaxis()

onMounted(async () => {

  /* Initialize WebGPU */
  await galaxis.initGPU()

  /* Initialize View */
  if (!mainCanvasElement.value) throw new Error("No appropriate HTMLCanvasElement found.")
  galaxis.addView(viewId, '2D' as ViewMode, mainCanvasElement.value)

  const view = galaxis.getView(viewId)
  if (!view) throw new Error(`View ${viewId} initialization failed.`)
  view.render()

  /* Handle Canvas Resize */
  const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
    for (const entry of entries) {
      // Adjust canvas size
      const canvas  = <HTMLCanvasElement>entry.target
      const width   = entry.contentBoxSize[0].inlineSize
      const height  = entry.contentBoxSize[0].blockSize
      if (width === 0) continue

      const gpu = galaxis.getGPU()
      if (!gpu) throw new Error("Failed to get GPU for resize observer.")

      canvas.width  = Math.max(1, Math.min(width, gpu.device.limits.maxTextureDimension2D))
      canvas.height = Math.max(1, Math.min(height, gpu.device.limits.maxTextureDimension2D))
    }
  })
  observer.observe(mainCanvasElement.value)
})

onUnmounted(() => {
  galaxis.removeView(viewId)
})

</script>

<style>
#app {
  max-width: 1280px;
  margin: 0 auto;
  text-align: center;
}

#viewer-container {
  display: flex;
  flex-direction: row;
  background-color: #282930;
  padding: 2rem;
}

#left-col-container {
  min-width: 600px;
  min-height: 600px;
  display: flex;
  flex: 3;
  background-color: black;
}

#main-canvas {
  width: 100%;
  height: auto;
}

#right-col-container {
  min-width: 200px;
  margin-left: 20px;
  display: flex;
  flex: 1;
  flex-direction: column;
}
</style>