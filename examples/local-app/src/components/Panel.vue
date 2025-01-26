<template>
  <v-card id="view-control-container">
    <v-row id="contrast-range-slider" align="center">
      <v-col cols="3" class="text-right">
        <v-list-item-title>Contrasts:</v-list-item-title>
      </v-col>
      <v-col cols="5">
        <v-range-slider
          v-model="contrasts"
          min="0"
          max="255"
          step="1"
          thumb-size="15"
          thumb-color="#868E93"
          track-size="2"
          track-color="#5A626C"
          track-fill-color="#6A7380"
          hide-details
          hide-thumb-label
          @start="onControlChangeStart"
          @update:modelValue="onContrastChange"
          @end="onControlChangeEnd"
        ></v-range-slider>
      </v-col>
    </v-row>
    <v-row id="zoom-slider" align="center">
      <v-col cols="3" class="text-right">
        <v-list-item-title>Zoom:</v-list-item-title>
      </v-col>
      <v-col cols="5">
        <v-slider
          v-model="zoom"
          min="1"
          max="6"
          step="1"
          thumb-size="15"
          thumb-color="#868E93"
          track-size="2"
          track-color="#5A626C"
          track-fill-color="#6A7380"
          hide-details
          hide-thumb-label
          @start="onControlChangeStart"
          @update:modelValue="onZoomChange"
          @end="onControlChangeEnd"
        ></v-slider>
      </v-col>
    </v-row>
    <v-row id="sliceIdx-slider" align="center">
      <v-col cols="3" class="text-right">
        <v-list-item-title>Slice#:</v-list-item-title>
      </v-col>
      <v-col cols="5">
        <v-slider
          v-model="sliceIdx"
          min="0"
          :max="sliceIdxMax"
          step="1"
          thumb-size="15"
          thumb-color="#868E93"
          track-size="2"
          track-color="#5A626C"
          track-fill-color="#6A7380"
          hide-details
          thumb-label="always"
          @start="onControlChangeStart"
          @update:modelValue="onSliceIdxChange"
          @end="onControlChangeEnd"
        ></v-slider>
      </v-col>
    </v-row>
  </v-card>
  <v-card id="drag-and-drop-container"
    class="d-flex align-center justify-center"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <span v-if="errorMsg" class="highlighted-text">
      {{ errorMsg }}
      <v-btn
        color="#5865f2"
        size="small"
        @click="onClickErrorMsgOkBtn"
      >
        OK
      </v-btn>
    </span>
    <span v-else :class="{'highlighted-text': isDragging}">
      {{ isDragging ? 'Drop File' : 'Drag File Here' }}
    </span>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { View, Image } from 'galaxis'
import { useGalaxis } from 'galaxis'
import * as tiff from 'tiff';
import { normVisorData } from '../utils';

const contrasts   = ref<[number,number]>([0,255])
const zoom        = ref<number>(1)
const sliceIdx    = ref<number>(0)
const sliceIdxMax = ref<number>(0)
const isDragging  = ref<Boolean>(false)
const errorMsg    = ref<string>('')

const galaxis = useGalaxis()
const viewId  = 'main'

onMounted(() => {
  const view: View = galaxis.getView(viewId);
  if (!view) throw new Error("View main is not defined");
  sliceIdxMax.value = view.imageLayer.image.size[0];
});

const onControlChangeStart = () => {
  const view: View = galaxis.getView(viewId);
  if (!view) throw new Error("View main is not defined");
  view.animationFrameId = requestAnimationFrame(view.frameRenderHandler);
};

const onControlChangeEnd = () => {
  const view: View = galaxis.getView(viewId);
  if (!view) throw new Error("View main is not defined");
  cancelAnimationFrame(view.animationFrameId);
};

const onContrastChange = () => {
  const view: View = galaxis.getView(viewId);
  if (!view) throw new Error("View main is not defined");
  view.handleContrastChange(new Float32Array(contrasts.value))
};

const onZoomChange = () => {
  const view: View = galaxis.getView(viewId);
  if (!view) throw new Error("View main is not defined");
  view.handleZoomChange(zoom.value)
};

const onSliceIdxChange = () => {
  const view: View = galaxis.getView(viewId);
  if (!view) throw new Error("View main is not defined");
  view.handleSliceIdxChange(sliceIdx.value)
};

const onDragOver = () => {
  isDragging.value = true;
};

const onDragLeave = () => {
  isDragging.value = false;
};

const onDrop = async (event: DragEvent) => {
  event.preventDefault();
  isDragging.value = false;

  // Check if files are available in the dataTransfer object
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    console.log("No file dropped");
    return;
  }

  // Support one file for now
  const file: File = files[0];
  try {
    const image: Image = await readTiffFile(file)

    const view: View = galaxis.getView(viewId);
    if (!view) throw new Error("View main is not defined");
    view.updateImage(image)

  } catch (e) {
    if (e instanceof Error) {
      errorMsg.value = e.message;
    } else {
      console.error("An unknown error occurred", e);
    }
  }
};

const onClickErrorMsgOkBtn = () => {
  errorMsg.value = '';
};

const readTiffFile = async (file: File): Promise<Image> => {
  return new Promise((resolve, reject) => {
    // TIFF file
    if (file.type === "image/tiff") {
      // Use FileReader to read the file content
      const reader = new FileReader();
      // Define what to do once the file is successfully read
      reader.onload = (e) => {
        const fileContent = e.target?.result;
        if (fileContent instanceof ArrayBuffer) {
          // Decode TIFF using UTIF
          const tiffImages = tiff.decode(fileContent);
          // Check if there are images in the file
          if (tiffImages.length === 0) {
            throw new Error("No images found in the TIFF file");
          }

          // Iterate through each page to assemble a 3D array - imageData
          const firstImage   = tiffImages[0];
          const width        = firstImage.width;
          const height       = firstImage.height;
          const depth        = tiffImages.length;  // Depth is the number of pages
          const totalVoxels  = width * height * depth;
          const imageData    = new Uint16Array(totalVoxels);
          let offset = 0;
          for (let i=0; i<depth; i++) {
            const image = tiffImages[i];
            imageData.set(image.data, offset);
            offset += image.data.length;
          }

          const normData: Uint8Array = normVisorData(imageData);

          resolve({
            array: normData,
            size : [depth, height, width]
          });
        } else {
          reject(new Error("File content is not an ArrayBuffer."));
        }
      };
      // Define what to do in case of an error
      reader.onerror = () => {
        reject(new Error("Error reading the TIFF file"));
      };
      // Read the file as an ArrayBuffer (ideal for binary files like TIFF)
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error("Only support TIFF file for now."));
    }
  });
};

</script>

<style>
#view-control-container {
  flex: 1 1 auto;
  min-height: 200px;
  color: gray;
  border: 2px solid gray;
  background-color: #414851;
  text-align: center;
}
#drag-and-drop-container {
  flex: 1 1 auto;
  min-height: 100px;
  color: gray;
  border: 2px solid gray;
  background-color: #414851;
  cursor: pointer;
}
#view-control-container .v-row .v-col .v-list-item-title {
  font-size: calc(0.5em + 0.5vmax);
  color: #fff;
}
.v-btn {
  margin-top: 2em;
}
</style>
