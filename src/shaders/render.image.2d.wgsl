struct VertexInput {
  @location(0) model_coord_pos : vec2<f32>,
};

struct VertexOutput {
  @location(0) model_coord_pos      : vec2<f32>,
  @builtin(position) clip_coord_pos : vec4<f32>,
};

struct Scene {
  trans_mat : mat4x4f,
  eye_pos   : vec4<f32>,
};

struct Contrast {
  min: f32,
  max: f32,
};

@group(0) @binding(0) var image_texture        : texture_3d<f32>;
@group(0) @binding(1) var texture_sampler      : sampler;
@group(0) @binding(2) var<uniform> contrast    : Contrast;
@group(0) @binding(3) var<uniform> scene       : Scene;
@group(0) @binding(4) var<uniform> slice_index : f32;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.model_coord_pos = input.model_coord_pos;
  output.clip_coord_pos  = scene.trans_mat * vec4f(input.model_coord_pos,0,1);
  return output;
}

fn model_to_texture_coord(model_coord_pos: vec2<f32>) -> vec2<f32> {
  // See README for an illustration of model/texture coordinates
  // flip Y:
  //     * vec2f( 1.0,-1.0 )
  // covert from -1 <-> +1 (model coordinate) to 0 <-> 2
  //     + vec2f( 1.0, 1.0 )
  // covert from 0 <-> 2 to 0 <-> 1 (texture coordinate)
  //     * vec2f( 0.5, 0.5 )
  return model_coord_pos * vec2f(0.5,-0.5) + 0.5;
}

fn contrast_adjustment(texture_color: vec4f, contrast_max: f32, contrast_min: f32) -> vec4f {
  return (texture_color - contrast_min/255) / (contrast_max/255 - contrast_min/255);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let dimensionZ = f32(textureDimensions(image_texture).z);
  let texture_color = textureSample(image_texture, texture_sampler, vec3(model_to_texture_coord(input.model_coord_pos),slice_index/dimensionZ));
  return contrast_adjustment(texture_color, contrast.max, contrast.min);
}
