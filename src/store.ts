import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { GPU, View, ViewMode } from '@/types'
import { createView } from '@/manager'

export const useGalaxisStore = defineStore('galaxis', () => {

  // state
  const gpu = ref<GPU>()
  const views: Record<string, View> = reactive({})

  // getters
  const getGPU = (): GPU | undefined => {
    return gpu.value
  }
  const getView = (viewId: string): View => {
    return views[viewId];
  };

  // actions
  const initGPU = async (): Promise<GPU | undefined> => {
    try {
      // WebGPU initialization
      if (!navigator.gpu) throw new Error("WebGPU not supported on this browser.")

      const gpuAdapter = await navigator.gpu.requestAdapter()
      if (!gpuAdapter) throw new Error("No appropriate GPUAdapter found.")

      const gpuDevice = await gpuAdapter.requestDevice()
      if (!gpuDevice) throw new Error("No appropriate GPUDevice found.")

      const gpuTextureFormat = navigator.gpu.getPreferredCanvasFormat()
      if (!gpuTextureFormat) throw new Error("No appropriate GPUTextureFormat found.")

      gpu.value = {
        device        : gpuDevice,
        textureFormat : gpuTextureFormat,
      }

      return gpu.value

    } catch (error) {
      console.error('Error initializing WebGPU:', error)
    }
  }

  const addView = (
    viewId    : string,
    viewType  : ViewMode,
    canvasElm : HTMLCanvasElement,
  ) => {
    const view: View = createView(viewId, viewType, canvasElm)
    views[viewId] = view
  }

  const removeView = (viewId: string) => {
    delete views[viewId]
  }

  // return store
  return {
    getGPU,
    getView,
    initGPU,
    addView,
    removeView,
  }
})
