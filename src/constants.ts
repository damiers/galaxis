export const MAX_TILE_MEMORY_SIZE = 32 * 1024 * 1024

export const DEFAULT_BG_COLOR = [0.141, 0.141, 0.141, 1]

// Image
export const DEFAULT_CONTRAST_MIN = 0
export const DEFAULT_CONTRAST_MAX = 255
export const DEFAULT_SLICE_INDEX  = 0
export const DEFAULT_IMAGE        = {
  array : new Uint8Array([0]), 
  size  : [1,1,1]
}

// Scene
export const DEFAULT_INPUT_THRESHOLD             = 0.0000001
export const DEFAULT_CAMERA_MATRIX               = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
])
export const DEFAULT_CAMERA_ANGULAR_VELOCITY     = 0
export const DEFAULT_CAMERA_ROTATION_SPEED       = 0.3
export const DEFAULT_CAMERA_FRICTION_COEFFICIENT = 0.999
export const DEFAULT_CAMERA_PAN_SPEED            = 0.005
export const DEFAULT_CAMERA_MIN_ZOOM             = 1
export const DEFAULT_CAMERA_MAX_ZOOM             = 10
export const DEFAULT_ARCBALL_CAMERA_POSITION     = new Float32Array([4, 2, 5])
export const DEFAULT_PERSPECTIVE_FOV             = (2 * Math.PI) / 8
export const DEFAULT_Z_NEAR                      = 1
export const DEFAULT_Z_FAR                       = 100
export const DEFAULT_ORTHO_CAMERA_POSITION       = new Float32Array([0, 0, 5])
export const DEFAULT_ORTHO_BOUND                 = 2
