import { Mat4 } from "wgpu-matrix"

export interface GPU {
  device        : GPUDevice
  textureFormat : GPUTextureFormat
}

export type ViewMode = '3D' | '2D'
export interface View {
  id               : string;
  mode             : ViewMode;
  canvasElm        : HTMLCanvasElement;
  canvasCtx        : GPUCanvasContext;
  input            : Input;
  camera           : Camera;
  projection       : Mat4;
  lastFrameMs      : number; // time when last frame renderred, epoch in milliseconds
  animationFrameId : number | null;
  imageLayer       : ImageLayer;
  maskLayer        : MaskLayer;

  updateImage          : (image: Image) => void;
  handleContrastChange : (contrast: Float32Array) => void;
  handleZoomChange     : (zoom: number) => void;
  handleSliceIdxChange : (sliceIdx: number) => void;
  render               : () => void;
  frameRenderHandler   : () => void;
}

export interface Input {
  mouseDown : boolean
  moveX     : number
  moveY     : number
  zoom      : number
  click     : boolean
  clickX    : number
  clickY    : number
}

// REF: https://github.com/webgpu/webgpu-samples
export type CameraMode = 'Ortho' | 'Arcball'
export interface Camera {
  mode     : CameraMode
  // The camera matrix.
  // This is the inverse of the view matrix.
  matrix   : Mat4
  // Alias to column vector 0 of the camera matrix.
  right    : Vec4
  // Alias to column vector 1 of the camera matrix.
  up       : Vec4
  // Alias to column vector 2 of the camera matrix.
  back     : Vec4
  // Alias to column vector 3 of the camera matrix.
  position : Vec4
}

export interface ArcballCamera extends Camera {
  // The current angular velocity
  angularVelocity     : number
  // The current rotation axis
  axis                : Vec3
  // Speed multiplier for camera rotation
  rotationSpeed       : number
  // Rotation velocity drag coeffient [0 .. 1]
  // 0: Spins forever
  // 1: Instantly stops spinning
  frictionCoefficient : number
}

export interface OrthoCamera extends Camera {
  // Speed multiplier for camera pan
  panSpeed : number
}

export interface Layer {
  id        : string
  canvasCtx : GPUCanvasContext
  render    : (renderPass: GPURenderPassEncoder) => void
}

export interface Image {
  array : Uint8Array
  size  : [number, number, number] // [depth, height, width]
}

export interface Vertex {
  count  : number;
  coords : Float32Array;
  buffer : GPUBuffer;
}

export interface ColorTexture {
  data         : Uint8Array;
  size         : [number, number, number];
  bytesPerRow  : number;
  rowsPerImage : number;
  texture      : GPUTexture;
}

export interface Uniform {
  value    : Float32Array
  buffer   : GPUBuffer
}

export interface ImageLayer extends Layer {
  image          : Image
  colorTexture   : ColorTexture
  vertex         : Vertex
  scene          : Uniform
  contrast       : Uniform
  sliceIdx       : Uniform
  renderPipeline : GPURenderPipeline
  bindGroup      : GPUBindGroup

  updateScene    : (view: View) => void
  updateContrast : (contrast: Float32Array) => void
  updateSliceIdx : (sliceIdx: Float32Array) => void
}

export interface Mask {
  // placeholder
}

export interface MaskLayer extends Layer {
  // placeholder
}

export interface Tile {
  index    : string
  pos      : [number, number, number] // [z, y, x]
  size     : [number, number, number] // [depth, height, width]
  mipmaps  : Mipmap[]
  loaded   : boolean
  texture? : GPUTexture // Reference to the WebGPU texture
}

export interface Mipmap {
  level : number
  array : Uint8Array
  size  : [number, number, number] // [depth, height, width]
}
