struct VertexInput {
  @location(0) model_coord_pos : vec3<f32>,
};

struct VertexOutput {
  @location(0) model_coord_pos      : vec3<f32>,
  @builtin(position) clip_coord_pos : vec4<f32>,
};

struct Scene {
  trans_mat : mat4x4f,
  eye_pos   : vec4<f32>,
};

struct Contrast {
  min : f32,
  max : f32,
};

struct Ray {
  ray_origin    : vec3f,
  ray_direction : vec3f,
  max_intensity : f32,
  max_i_coord   : vec3u
};

@group(0) @binding(0) var image_texture       : texture_3d<f32>;
@group(0) @binding(1) var texture_sampler     : sampler;
@group(0) @binding(2) var<uniform> contrast   : Contrast;
@group(0) @binding(3) var<uniform> scene      : Scene;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.model_coord_pos = input.model_coord_pos;
  output.clip_coord_pos  = scene.trans_mat * vec4f(input.model_coord_pos,1);
  return output;
}

fn model_to_texture_coord(model_coord_pos: vec3<f32>) -> vec3<f32> {
  // See README for an illustration of model/texture coordinates
  // flip Y & Z:
  //     * vec3f( 1.0,-1.0,-1.0)
  // covert from -1 <-> +1 (model coordinate) to 0 <-> 2
  //     + vec3f( 1.0, 1.0, 1.0)
  // covert from 0 <-> 2 to 0 <-> 1 (texture coordinate)
  //     * vec3f( 0.5, 0.5, 0.5)
  return model_coord_pos * vec3f(0.5,-0.5,-0.5) + 0.5;
}

fn intersect_box(orig: vec3f, dir: vec3f) -> vec2f {
	var box_min  = vec3f(-1.0);
	var box_max  = vec3f(1.0);
	var inv_dir  = 1.0 / dir;
	var tmin_tmp = (box_min - orig) * inv_dir;
	var tmax_tmp = (box_max - orig) * inv_dir;
	var tmin     = min(tmin_tmp, tmax_tmp);
	var tmax     = max(tmin_tmp, tmax_tmp);
	var t0       = max(tmin.x, max(tmin.y, tmin.z));
	var t1       = min(tmax.x, min(tmax.y, tmax.z));
	return vec2f(t0, t1);
}

fn get_ray(ray_origin: vec3<f32>, ray_direction: vec3<f32>, step: f32) -> Ray {
  var ray: Ray;

  var t_hit = intersect_box(ray_origin, ray_direction);
	if (t_hit.x > t_hit.y) {
		discard;
	}
	t_hit.x = max(t_hit.x, 0.0);

  var mip = -1.0;
  var intensity = mip;
  for (var t = t_hit.x; t < t_hit.y; t+=step) {
    let model_pos    = ray_origin + t * ray_direction;
    let texture_pos  = model_to_texture_coord(model_pos);
    intensity        = max(f32(textureSampleLevel(image_texture, texture_sampler, texture_pos, 0).r),0.0);
    if (intensity > mip) {
      mip = intensity;
      ray.max_i_coord = vec3u(texture_pos);
    }
  }
  ray.ray_origin    = ray_origin;
  ray.ray_direction = ray_direction;
  ray.max_intensity = mip;
  return ray;
}

fn contrast_adjustment(texture_color: vec4f, contrast_max: f32, contrast_min: f32) -> vec4f {
  return (texture_color*255 - contrast_min) / (contrast_max - contrast_min);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {

  let ray_origin = scene.eye_pos.xyz;
  let ray_dir    = normalize(input.model_coord_pos - ray_origin);
  let ray        = get_ray(ray_origin, ray_dir, 0.01);

  return contrast_adjustment(vec4f(ray.max_intensity,ray.max_intensity,ray.max_intensity,1), contrast.max, contrast.min);
}
