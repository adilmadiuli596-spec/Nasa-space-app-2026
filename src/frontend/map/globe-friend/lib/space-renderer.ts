import type { CameraState } from "../types/map.types";
import { spaceRotation } from "./space-camera";

export interface SpaceFrame {
  camera: CameraState;
  roll: number;
  /** Map viewport in background-canvas pixel coordinates, bottom-left origin. */
  viewport: [number, number, number, number];
}
export interface SpaceRenderer {
  render(frame: SpaceFrame): void;
  dispose(releaseContext?: boolean): void;
}
const VERTEX = `#version 300 es
precision highp float;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uPanorama;
uniform mat3 uRotation;
uniform vec2 uResolution;
uniform vec4 uViewport;
out vec4 fragment;
const float PI = 3.14159265359;

float hash21(vec2 point) {
  vec3 p = fract(vec3(point.xyx) * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 stars(vec2 sky, vec2 grid, float density, float strength) {
  vec2 p = sky * grid;
  vec2 cell = floor(p);
  cell.x = mod(cell.x, grid.x);
  float seed = hash21(cell + 17.0);
  if (seed < density) return vec3(0.0);
  vec2 center = 0.2 + 0.6 * vec2(hash21(cell + 53.0), hash21(cell + 91.0));
  vec2 delta = fract(p) - center;
  delta.x *= max(cos((sky.y - 0.5) * PI), 0.2);
  float distance = length(delta);
  float pixel = max(length(fwidth(p)) * 0.65, 0.018);
  float core = 1.0 - smoothstep(0.0, pixel, distance);
  float glow = exp(-distance * distance / (pixel * pixel * 9.0)) * 0.055;
  float brightness = 0.35 + pow(hash21(cell + 8.0), 8.0) * 1.65;
  vec3 tint = mix(vec3(0.63, 0.78, 1.0), vec3(1.0, 0.86, 0.65), hash21(cell + 31.0));
  return tint * (core + glow) * brightness * strength;
}
void main() {
  vec2 screen = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw * 2.0 - 1.0;
  screen.x *= uViewport.z / uViewport.w;
  // An artistic wide-angle celestial lens shows the Milky Way around the globe.
  vec3 ray = normalize(uRotation * vec3(screen * 0.767327, -1.0));
  vec2 sky = vec2(atan(ray.z, ray.x) / (2.0 * PI) + 0.5, asin(clamp(ray.y, -1.0, 1.0)) / PI + 0.5);
  vec3 panorama = texture(uPanorama, sky).rgb;
  // Feather an imperfect photographic seam without affecting the spherical stars.
  float edge = smoothstep(0.96, 1.0, abs(sky.x - 0.5) * 2.0);
  panorama = mix(panorama, texture(uPanorama, vec2(1.0 - sky.x, sky.y)).rgb, edge * 0.5);
  vec3 color = pow(panorama, vec3(1.06)) * 0.86;
  color += stars(sky, vec2(640.0, 320.0), 0.91, 0.72);
  color += stars(sky, vec2(1280.0, 640.0), 0.95, 0.30);
  vec2 uv = gl_FragCoord.xy / uResolution;
  float vignette = 1.0 - 0.26 * smoothstep(0.2, 0.78, length(uv - 0.5));
  fragment = vec4(color * vignette + vec3(0.001, 0.002, 0.005), 1.0);
}`;

/** Independent, tiny WebGL2 sky pass. It never requests its own animation frames. */
export function createSpaceRenderer(canvas: HTMLCanvasElement, url: string, invalidate: () => void): SpaceRenderer | null {
  if (typeof window.WebGL2RenderingContext === "undefined") return null;
  const gl = canvas.getContext("webgl2", {
    alpha: false, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false, powerPreference: "low-power",
  });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let texture: WebGLTexture | null = null;
  let disposed = false;
  const panorama = new Image();
  const cleanup = (releaseContext = true) => {
    if (disposed) return;
    disposed = true;
    panorama.onload = null; panorama.onerror = null;
    panorama.removeAttribute("src");
    if (texture) gl.deleteTexture(texture);
    if (program) gl.deleteProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
    if (releaseContext) gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  try {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Cannot allocate sky shader");
      shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Sky shader failed");
      return shader;
    };
    program = gl.createProgram();
    if (!program) throw new Error("Cannot allocate sky program");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Sky program failed");
    const rotation = gl.getUniformLocation(program, "uRotation");
    const resolution = gl.getUniformLocation(program, "uResolution");
    const viewport = gl.getUniformLocation(program, "uViewport");
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "uPanorama"), 0);
    texture = gl.createTexture();
    if (!texture) throw new Error("Cannot allocate sky texture");
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([1, 2, 5, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    panorama.decoding = "async";
    panorama.onload = () => {
      if (disposed || gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
      // Image north is at the top; spherical latitude increases toward the top.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, panorama);
      invalidate();
    };
    panorama.src = url;
    return {
      render(frame) {
        if (disposed || gl.isContextLost()) return;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniformMatrix3fv(rotation, false, spaceRotation(frame.camera, frame.roll));
        gl.uniform2f(resolution, canvas.width, canvas.height);
        gl.uniform4fv(viewport, frame.viewport);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      dispose: cleanup,
    };
  } catch {
    // Cosmetic failure must never stop the geographic map: CSS panorama remains.
    cleanup();
    return null;
  }
}
