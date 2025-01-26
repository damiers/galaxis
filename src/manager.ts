import * as CONSTANTS from '@/constants'
import * as GalaxisTypes from '@/types'
import { vec3, mat4, Mat4 } from "wgpu-matrix";
import { useGalaxisStore } from '@/store'
import image3DShaderCode from "@/shaders/render.image.3d.wgsl?raw"
import image2DShaderCode from "@/shaders/render.image.2d.wgsl?raw";

/* Creators */
export const createView = (
  id          : string,
  mode        : GalaxisTypes.ViewMode,
  canvasElm   : HTMLCanvasElement,
) : GalaxisTypes.View => {

  // use global GPU
  const gpu = useGalaxisStore().getGPU()
  if (!gpu) throw new Error("Failed to get GPU for layer creation.")
  
  const canvasCtx = createCanvasContext(canvasElm)

  const view: GalaxisTypes.View = {
    id,
    mode,
    canvasElm,
    canvasCtx,
    input: createInput(),
    camera: createCamera(mode),
    projection: createProjection(mode, canvasElm),
    lastFrameMs: Date.now(),
    animationFrameId: null,
    imageLayer: createImageLayer(id, mode, canvasCtx),
    maskLayer: createMaskLayerPlaceHolder(id, canvasCtx),

    updateImage: (image: GalaxisTypes.Image) => {
      view.imageLayer = createImageLayer(id, mode, canvasCtx, image);
      view.imageLayer.updateScene(view);
      view.render();
    },
    handleContrastChange: (contrast: Float32Array) => {
      view.imageLayer.updateContrast(contrast);
    },
    handleZoomChange: (zoom: number) => {
      view.input.zoom = Math.max(
        CONSTANTS.DEFAULT_CAMERA_MIN_ZOOM, 
        Math.min(CONSTANTS.DEFAULT_CAMERA_MAX_ZOOM, zoom)
      );
      updateProjection(view);
    },
    handleSliceIdxChange: (sliceIdx: number) => {
      view.imageLayer.updateSliceIdx(new Float32Array([sliceIdx]));
    },
    render: () => {
      const commandEncoder: GPUCommandEncoder =
        gpu.device.createCommandEncoder();
      const renderPassEncoder: GPURenderPassEncoder =
        commandEncoder.beginRenderPass(createRenderPassDescriptor(gpu, view));
      view.imageLayer.render(renderPassEncoder);
      view.maskLayer.render(renderPassEncoder);
      renderPassEncoder.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
    },
    frameRenderHandler: () => {
      view.imageLayer.updateScene(view);
      resetInput(view);
      view.render();
      view.animationFrameId = requestAnimationFrame(view.frameRenderHandler); // Schedule the next frame
    },
  };

  addInputListeners(view);

  return view
}

const createInput = (): GalaxisTypes.Input => {
  return {
    mouseDown : false,
    moveX     : 0,
    moveY     : 0,
    zoom      : CONSTANTS.DEFAULT_CAMERA_MIN_ZOOM,
    click     : false,
    clickX    : 0,
    clickY    : 0,
  }
}

const createCamera = (viewMode: GalaxisTypes.ViewMode): GalaxisTypes.Camera => {

  const matrix = CONSTANTS.DEFAULT_CAMERA_MATRIX;

  let camera: GalaxisTypes.Camera = {
    mode: "Ortho",
    matrix: matrix,
    right: new Float32Array(matrix.buffer, 4 * 0, 4),
    up: new Float32Array(matrix.buffer, 4 * 4, 4),
    back: new Float32Array(matrix.buffer, 4 * 8, 4),
    position: new Float32Array(matrix.buffer, 4 * 12, 4),
  };
  let position = CONSTANTS.DEFAULT_ORTHO_CAMERA_POSITION;

  switch (viewMode) {
    case '3D': {
      camera = {
        ...camera,
        mode: "Arcball",
        angularVelocity: CONSTANTS.DEFAULT_CAMERA_ANGULAR_VELOCITY,
        rotationSpeed: CONSTANTS.DEFAULT_CAMERA_ROTATION_SPEED,
        frictionCoefficient: CONSTANTS.DEFAULT_CAMERA_FRICTION_COEFFICIENT,
        axis: vec3.create(),
      } as GalaxisTypes.ArcballCamera;
      position = CONSTANTS.DEFAULT_ARCBALL_CAMERA_POSITION;
      break
    }
    case '2D': {
      camera = {
        ...camera,
        panSpeed: CONSTANTS.DEFAULT_CAMERA_PAN_SPEED,
      } as GalaxisTypes.OrthoCamera;
      break
    }
    default: {
      throw new Error(`Unknown view mode: ${viewMode}`);
    }
  }

  vec3.copy(position, camera.position);
  vec3.copy(vec3.normalize(camera.position), camera.back);
  vec3.copy(vec3.normalize(vec3.cross(camera.up, camera.back)), camera.right);
  vec3.copy(vec3.normalize(vec3.cross(camera.back, camera.right)), camera.up);

  return camera;
}

const createProjection = (viewMode: GalaxisTypes.ViewMode, canvasElm: HTMLCanvasElement): Mat4 => {

  switch (viewMode) {
    case '3D': {
      return mat4.perspective(
        CONSTANTS.DEFAULT_PERSPECTIVE_FOV,
        canvasElm.clientWidth / canvasElm.clientHeight,
        CONSTANTS.DEFAULT_Z_NEAR,
        CONSTANTS.DEFAULT_Z_FAR,
      )
    }
    case '2D': {
      return mat4.ortho(
        - CONSTANTS.DEFAULT_ORTHO_BOUND, // left
          CONSTANTS.DEFAULT_ORTHO_BOUND, // right
          CONSTANTS.DEFAULT_ORTHO_BOUND, // bottom
        - CONSTANTS.DEFAULT_ORTHO_BOUND, // top
          CONSTANTS.DEFAULT_Z_NEAR,      // near
          CONSTANTS.DEFAULT_Z_FAR        // far
      );
    }
    default: {
      throw new Error(`Unknown view mode: ${viewMode}`);
    }
  }
}

const createCanvasContext = (canvasElm: HTMLCanvasElement): GPUCanvasContext => {

  // use global GPU
  const gpu = useGalaxisStore().getGPU()
  if (!gpu) throw new Error("Failed to get GPU for canvas context.")

  const gpuCanvasContext = canvasElm.getContext("webgpu")
  if (!gpuCanvasContext) throw new Error("Failed to get WebGPU GPUCanvasContext context.")

  gpuCanvasContext.configure({
    device    : gpu.device,
    format    : gpu.textureFormat,
    alphaMode : 'premultiplied',
  })

  return gpuCanvasContext
}

const createImageLayer = (
  viewId: string,
  viewMode: GalaxisTypes.ViewMode,
  canvasCtx: GPUCanvasContext,
  image?: GalaxisTypes.Image,
): GalaxisTypes.ImageLayer => {
  // GPU: use global GPU
  const gpu = useGalaxisStore().getGPU();
  if (!gpu) throw new Error("Failed to get GPU for layer creation.");

  // ID
  const id: string = `${viewId}-image`;

  // Image: 3D Volume Image
  if (!image) {
    image = CONSTANTS.DEFAULT_IMAGE as GalaxisTypes.Image;
  }

  // Vertex
  // normalize dataSize to 0-1
  const maxSize = Math.max(...image.size);
  const normDataRange = image.size.map((s) => s / maxSize);
  let vertexByteSize: number;
  let vertexFormat: GPUVertexFormat;
  let vertexCount: number;
  let vertexCoords: Float32Array;

  switch (viewMode) {
    case "3D": {
      vertexByteSize = 4 * 3; // Byte size of one vertex, Float32 * xyz.
      vertexFormat = "float32x3";
      vertexCount = 6 * 6; // 6 faces * 6 points each.
      vertexCoords = getCubeCoordinates(normDataRange);
      break;
    }
    case "2D": {
      vertexByteSize = 4 * 2; // Byte size of one vertex, Float32 * xy.
      vertexFormat = "float32x2";
      vertexCount = 6; // 2 triangles.
      vertexCoords = getSquareCoordinates(normDataRange);
      break;
    }
  }

  const vertex: GalaxisTypes.Vertex = {
    count: vertexCount,
    coords: vertexCoords,
    buffer: gpu.device.createBuffer({
      label: `${id} Vertex Buffer`,
      size: vertexByteSize * vertexCount,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    }),
  };

  // Texture & Sampler
  const colorTextureFormat: GPUTextureFormat =
    canvasCtx.getConfiguration()!.format;
  const colorTexture: GalaxisTypes.ColorTexture = {
    data: toRgba8Uint(image.array, image.size),
    size: image.size,
    bytesPerRow: image.size[0] * 4,
    rowsPerImage: image.size[1],
    texture: gpu.device.createTexture({
      label: `${id} Color Texture`,
      dimension: "3d",
      size: image.size,
      format: colorTextureFormat,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    }),
  };
  const sampler: GPUSampler = gpu.device.createSampler({
    label: `${id} Sampler`,
    magFilter: "linear",
    minFilter: "linear",
  });

  // Uniforms
  // Scene
  const sceneValueSize = 4 * 4 + 4; // 4x4 transform matrix + 4 camera position
  const sceneValue = new Float32Array(sceneValueSize);
  const scene: GalaxisTypes.Uniform = {
    value: sceneValue,
    buffer: gpu.device.createBuffer({
      label: `${id} Scene Buffer`,
      size: sceneValueSize * 4, // byteSize, float32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
  };
  // Contrast
  const contrastValueSize = 1 + 1; // 1 min + 1 max
  const contrastValue = new Float32Array([
    CONSTANTS.DEFAULT_CONTRAST_MIN,
    CONSTANTS.DEFAULT_CONTRAST_MAX,
  ]);
  const contrast: GalaxisTypes.Uniform = {
    value: contrastValue,
    buffer: gpu.device.createBuffer({
      label: `${id} Contrast Buffer`,
      size: contrastValueSize * 4, // byteSize, float32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
  };
  // Slice Index
  const sliceIdxValueSize = 1;
  const sliceIdxValue = new Float32Array([
    CONSTANTS.DEFAULT_SLICE_INDEX
  ]);
  const sliceIdx: GalaxisTypes.Uniform = {
    value: sliceIdxValue,
    buffer: gpu.device.createBuffer({
      label: `${id} Contrast Buffer`,
      size: sliceIdxValueSize * 4, // byteSize, float32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
  };

  // Shader
  let imageShaderCode: string;
  switch (viewMode) {
    case "3D": {
      imageShaderCode = image3DShaderCode;
      break;
    }
    case "2D": {
      imageShaderCode = image2DShaderCode;
      break;
    }
  }
  const shaderModule: GPUShaderModule = gpu.device.createShaderModule({
    code: imageShaderCode,
  });

  // Render Pipeline
  let renderPipelineDescriptor: GPURenderPipelineDescriptor = {
    label: `${id} Render Pipeline`,
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain",
      buffers: [
        {
          arrayStride: vertexByteSize,
          attributes: [{ shaderLocation: 0, offset: 0, format: vertexFormat }],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [
        {
          format: colorTextureFormat,
        },
      ],
    },
    primitive: { topology: "triangle-list" },
  };
  if ("3D" === viewMode) {
    renderPipelineDescriptor.depthStencil = {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus",
    };
  }
  const renderPipeline: GPURenderPipeline = gpu.device.createRenderPipeline(
    renderPipelineDescriptor
  );

  // Bind Group
  let entries = [
    { binding: 0, resource: colorTexture.texture.createView() },
    { binding: 1, resource: sampler },
    { binding: 2, resource: { buffer: contrast.buffer } },
    { binding: 3, resource: { buffer: scene.buffer } },
  ];
  if ("2D" === viewMode) {
    entries.push({ binding: 4, resource: { buffer: sliceIdx.buffer } });
  }
  const bindGroup: GPUBindGroup = gpu.device.createBindGroup({
    label: `${id} Bind Group`,
    layout: renderPipeline.getBindGroupLayout(0),
    entries,
  });

  // Layer
  const layer: GalaxisTypes.ImageLayer = {
    id,
    canvasCtx,
    image,
    vertex,
    colorTexture,
    scene,
    contrast,
    sliceIdx,
    renderPipeline,
    bindGroup,

    updateScene: (view: GalaxisTypes.View) => {
      const now: number = Date.now();
      const deltaTime: number = (now - view.lastFrameMs) / 1000;
      view.lastFrameMs = now;

      updateCamera(view, deltaTime);
      const sceneMatrix = new Float32Array(20);
      sceneMatrix.set(
        mat4.multiply(view.projection, mat4.inverse(view.camera.matrix))
      );
      sceneMatrix.set(view.camera.matrix.subarray(12), 16);

      layer.scene.value = sceneMatrix;
      gpu.device.queue.writeBuffer(layer.scene.buffer, 0, sceneMatrix);
    },
    updateContrast: (contrast: Float32Array) => {
      layer.contrast.value = contrast;
      gpu.device.queue.writeBuffer(layer.contrast.buffer, 0, contrast);
    },
    updateSliceIdx: (sliceIdx: Float32Array) => {
      layer.sliceIdx.value = sliceIdx;
      gpu.device.queue.writeBuffer(layer.sliceIdx.buffer, 0, sliceIdx);
    },
    render: (renderPass: GPURenderPassEncoder) => {
      renderPass.setPipeline(layer.renderPipeline);
      renderPass.setBindGroup(0, layer.bindGroup);
      renderPass.setVertexBuffer(0, layer.vertex.buffer);
      renderPass.draw(layer.vertex.count);
    },
  };

  // Fill GPU Memories
  gpu.device.queue.writeBuffer(layer.vertex.buffer, 0, layer.vertex.coords);
  gpu.device.queue.writeTexture(
    { texture: layer.colorTexture.texture },
    layer.colorTexture.data,
    {
      bytesPerRow: layer.colorTexture.bytesPerRow,
      rowsPerImage: layer.colorTexture.rowsPerImage,
    },
    layer.colorTexture.size
  );
  gpu.device.queue.writeBuffer(layer.scene.buffer, 0, layer.scene.value);
  gpu.device.queue.writeBuffer(layer.contrast.buffer, 0, layer.contrast.value);
  gpu.device.queue.writeBuffer(layer.sliceIdx.buffer, 0, layer.sliceIdx.value);

  return layer;
}

const createMaskLayerPlaceHolder = (
  viewId: string,
  canvasCtx: GPUCanvasContext
): GalaxisTypes.MaskLayer => {
  // placeholder
  return {
    id     : `${viewId}-mask`,
    canvasCtx,
    render : () => {}
  }
}

const createRenderPassDescriptor = (gpu: GalaxisTypes.GPU, view: GalaxisTypes.View): GPURenderPassDescriptor => {
  let renderPassDescriptor: GPURenderPassDescriptor = {
    label: `${view.id} RenderPass Descriptor`,
    colorAttachments: [
      {
        view: view.canvasCtx.getCurrentTexture().createView(),
        clearValue: CONSTANTS.DEFAULT_BG_COLOR,
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };
  if ("3D" === view.mode) {
    const depthTexture: GPUTexture = gpu.device.createTexture({
      label  : `${view.id} Depth Texture`,
      size   : [view.canvasElm.width, view.canvasElm.height],
      format : "depth24plus",
      usage  : GPUTextureUsage.RENDER_ATTACHMENT,
    })
    renderPassDescriptor.depthStencilAttachment = {
      view            : depthTexture.createView(),
      depthClearValue : CONSTANTS.DEFAULT_Z_NEAR,
      depthLoadOp     : "clear",
      depthStoreOp    : "store",
    }
  }
  return renderPassDescriptor;
}

/* Input Listeners connects HTML Canvas Elements and Inputs */
const addInputListeners = (view: GalaxisTypes.View) => {
  view.canvasElm.addEventListener('pointerdown', () => {
    view.input.mouseDown = true
    view.animationFrameId = requestAnimationFrame(view.frameRenderHandler);
  })
  view.canvasElm.addEventListener('pointerup', () => {
    view.input.mouseDown = false
    cancelAnimationFrame(view.animationFrameId!);
  })
  view.canvasElm.addEventListener('pointermove', (e) => {
    view.input.mouseDown = e.pointerType == 'mouse' ? (e.buttons & 1) !== 0 : true
    if (view.input.mouseDown) {
      view.input.moveX += e.movementX
      view.input.moveY += e.movementY
    }
  })
  view.canvasElm.addEventListener('dblclick', (e) => {
    view.input.click = true
    var mouseX = e.clientX - view.canvasElm.getBoundingClientRect().left
    var mouseY = e.clientY - view.canvasElm.getBoundingClientRect().top
    // Normalize coordinates to NDC
    view.input.clickX = (mouseX / view.canvasElm.clientWidth) * 2 - 1
    view.input.clickY = 1 - (mouseY / view.canvasElm.clientHeight) * 2
  })
}

const resetInput = (view: GalaxisTypes.View) => {
  view.input.mouseDown = false;
  view.input.moveX = 0;
  view.input.moveY = 0;
  view.input.click = false;
  view.input.clickX = 0;
  view.input.clickY = 0;
}

/* Camera/Projection Updaters connects Inputs and Scene Matrices */
const updateCamera = (view: GalaxisTypes.View, deltaTime: number) => {
  // Update camera
  switch (view.camera.mode) {
    case 'Arcball': {
      updateArcballCamera(view.camera as GalaxisTypes.ArcballCamera, deltaTime, view.input)
      break
    }
    case 'Ortho': {
      updateOrthoCamera(view.camera as GalaxisTypes.OrthoCamera, view.input)
      break
    }
    default: {
      throw new Error(`Unknown camera mode: ${view.camera.mode}`)
    }
  }
}

const updateArcballCamera = (camera: GalaxisTypes.ArcballCamera, deltaTime: number, input: GalaxisTypes.Input) => {

  // Dampen any existing angular velocity
  camera.angularVelocity *= Math.pow(1 - camera.frictionCoefficient, deltaTime)

  // Calculate the movement vector
  const movement = vec3.create()
  vec3.addScaled(movement, camera.right, input.moveX, movement)
  vec3.addScaled(movement, camera.up, -input.moveY, movement)

  // Cross the movement vector with the view direction to calculate the rotation axis x magnitude
  const crossProduct = vec3.cross(movement, camera.back)

  // Calculate the magnitude of the drag
  const magnitude = vec3.len(crossProduct)
  if (magnitude > CONSTANTS.DEFAULT_INPUT_THRESHOLD) {
    // Normalize the crossProduct to get the rotation axis
    vec3.copy(vec3.scale(crossProduct, 1 / magnitude), camera.axis);
    // Remember the current angular velocity. This is used when the touch is released for a fling.
    camera.angularVelocity = magnitude * camera.rotationSpeed
  }

  // The rotation around camera.axis to apply to the camera matrix camera update
  const rotationAngle = camera.angularVelocity * deltaTime
  if (rotationAngle > CONSTANTS.DEFAULT_INPUT_THRESHOLD) {
    // Rotate the matrix around axis
    // Note: The rotation is not done as a matrix-matrix multiply as the repeated multiplications
    // will quickly introduce substantial error into the matrix.
    vec3.copy(vec3.normalize(vec3.transformMat4Upper3x3(camera.back, mat4.rotation(camera.axis, rotationAngle))), camera.back);
    vec3.copy(vec3.normalize(vec3.cross(camera.up, camera.back)),camera.right);
    vec3.copy(vec3.normalize(vec3.cross(camera.back, camera.right)),camera.up);
  }

  // Calculate camera position based on zoom
  vec3.copy(vec3.scale(camera.back, CONSTANTS.DEFAULT_CAMERA_MAX_ZOOM - input.zoom), camera.position)
}

const updateOrthoCamera = (camera: GalaxisTypes.OrthoCamera, input: GalaxisTypes.Input) => {
  // Handle panning
  // Calculate the movement vector
  const movement = vec3.create();
  vec3.addScaled(movement, camera.right, -input.moveX * camera.panSpeed, movement);
  vec3.addScaled(movement, camera.up, -input.moveY * camera.panSpeed, movement);
  // Clamp camera position
  const posXYBound = Math.abs(input.zoom - CONSTANTS.DEFAULT_ORTHO_BOUND);
  let position = vec3.add(camera.position, movement);
  position[0] = Math.max(-posXYBound, Math.min(position[0], posXYBound));
  position[1] = Math.max(-posXYBound, Math.min(position[1], posXYBound));
  vec3.copy(position, camera.position);
}

const updateProjection = (view: GalaxisTypes.View) => {
  if (view.mode == "2D") {
    view.projection = mat4.ortho(
      - CONSTANTS.DEFAULT_ORTHO_BOUND / view.input.zoom, // left
        CONSTANTS.DEFAULT_ORTHO_BOUND / view.input.zoom, // right
        CONSTANTS.DEFAULT_ORTHO_BOUND / view.input.zoom, // bottom
      - CONSTANTS.DEFAULT_ORTHO_BOUND / view.input.zoom, // top
        CONSTANTS.DEFAULT_Z_NEAR,                        // near
        CONSTANTS.DEFAULT_Z_FAR                          // far
    )
  }
}

/* Utility Functions */
const toRgba8Uint = (
  data: Uint8Array,
  shape: number[]
): Uint8Array => {
  let rgba8UintArray = new Uint8Array(shape[0] * shape[1] * shape[2] * 4);
  let k = 0;
  for (var j = 0; j < rgba8UintArray.length; j += 4) {
    k = j / 4;
    rgba8UintArray[j] = data[k];
    rgba8UintArray[j + 1] = data[k];
    rgba8UintArray[j + 2] = data[k];
    rgba8UintArray[j + 3] = 255;
  }
  return rgba8UintArray;
}

const getSquareCoordinates = (normDataRange: number[]): Float32Array => {
  const d = normDataRange;
  return new Float32Array([
    -d[0], d[1],
     d[0], d[1],
    -d[0],-d[1],
     d[0], d[1],
    -d[0],-d[1],
     d[0],-d[1],
  ]);
};

const getCubeCoordinates = (normDataRange: number[]): Float32Array => {
  const d = normDataRange;
  return new Float32Array([
     d[0], -d[1],  d[2],
    -d[0], -d[1],  d[2],
    -d[0], -d[1], -d[2],
     d[0], -d[1], -d[2],
     d[0], -d[1],  d[2],
    -d[0], -d[1], -d[2],
     d[0],  d[1],  d[2],
     d[0], -d[1],  d[2],
     d[0], -d[1], -d[2],
     d[0],  d[1], -d[2],
     d[0],  d[1],  d[2],
     d[0], -d[1], -d[2],
    -d[0],  d[1],  d[2],
     d[0],  d[1],  d[2],
     d[0],  d[1], -d[2],
    -d[0],  d[1], -d[2],
    -d[0],  d[1],  d[2],
     d[0],  d[1], -d[2],
    -d[0], -d[1],  d[2],
    -d[0],  d[1],  d[2],
    -d[0],  d[1], -d[2],
    -d[0], -d[1], -d[2],
    -d[0], -d[1],  d[2],
    -d[0],  d[1], -d[2],
     d[0],  d[1],  d[2],
    -d[0],  d[1],  d[2],
    -d[0], -d[1],  d[2],
    -d[0], -d[1],  d[2],
     d[0], -d[1],  d[2],
     d[0],  d[1],  d[2],
     d[0], -d[1], -d[2],
    -d[0], -d[1], -d[2],
    -d[0],  d[1], -d[2],
     d[0],  d[1], -d[2],
     d[0], -d[1], -d[2],
    -d[0],  d[1], -d[2],
  ]);
};
