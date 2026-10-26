import { glsl, type PassOptions } from "@frapx/fx-passes";
import { BLOOM, BLOOM_LEVELS, bloomPasses } from "./bloom.glsl";

export type FinishOptions = {
  /** Seconds in the loop, which seeds the dither so the last frame wraps to the first. */
  loopSeconds: number;
  /** How much of the bloom is added back. */
  bloomStrength?: number;
  /** How far the corners darken, 0–1. */
  vignette?: number;
  /**
   * Captions laid over the finished frame (a making-of): a texture of
   * `panels` stacked panels, each `aspect` times as wide as it is tall, with
   * the `u_caption` uniform picking one. The bloom also follows `u_bloomGain`.
   */
  caption?: { texture: string; panels: number; aspect: number };
};

/**
 * Everything after the linear-light `scene` pass, once per frame on the mean
 * of its samples: bloom (see bloom.glsl.ts), then `display` adds it and applies
 * the vignette, an ACES tone curve and dither.
 */
export const finishPasses = ({ loopSeconds, bloomStrength = 0.5, vignette = 0.42, caption }: FinishOptions): PassOptions[] => [
  ...bloomPasses("scene"),
  {
    name: "display",
    inputs: ["scene", BLOOM],
    filter: "nearest",
    fragment: glsl`#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_scene;
uniform sampler2D u_${BLOOM};
uniform float u_frameTime;
// 1 adds dither against banding in 8-bit output; 16-bit output needs none.
uniform float u_dither;
${
  caption
    ? `uniform vec2 u_resolution;
uniform sampler2D u_${caption.texture};
uniform float u_caption;
uniform float u_bloomGain;

// The caption panel over the bottom of the frame, full width; straight alpha.
vec4 captionAt(vec2 uv) {
  float height = (u_resolution.x / u_resolution.y) / ${caption.aspect.toFixed(4)};
  float v = (uv.y - 0.04) / height;
  if (v < 0.0 || v > 1.0) return vec4(0.0);
  // Panels stack top to bottom in the texture, which is flipped on upload.
  float row = 1.0 - (u_caption + 1.0 - v) / ${caption.panels.toFixed(1)};
  return texture(u_${caption.texture}, vec2(uv.x, row));
}`
    : ""
}

const float LOOP_SECONDS = ${loopSeconds.toFixed(6)};

float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// Narkowicz's fit of the ACES filmic curve: deep blacks, and bright light
// rolls off to white instead of flattening out.
vec3 aces(vec3 x) {
  return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 color = texelFetch(u_scene, ivec2(gl_FragCoord.xy), 0).rgb;
  color += texture(u_${BLOOM}, v_uv).rgb * ${(bloomStrength / BLOOM_LEVELS).toFixed(5)}${caption ? " * u_bloomGain" : ""};
  color *= 1.0 - ${vignette.toFixed(3)} * smoothstep(0.18, 0.82, length(v_uv - 0.5));
  color = aces(color);
  float phase = fract(u_frameTime / LOOP_SECONDS);
  color += u_dither * (hash31(vec3(gl_FragCoord.xy, phase * 97.0)) - 0.5) / 255.0;
  color = pow(max(color, 0.0), vec3(0.4545));
${
  caption
    ? `  vec4 text = captionAt(v_uv);
  // A dark band behind the text keeps it legible over bright rings.
  float band = smoothstep(0.0, 0.06, v_uv.y - 0.01) * (1.0 - smoothstep(0.0, 0.05, v_uv.y - 0.04 - (u_resolution.x / u_resolution.y) / ${caption.aspect.toFixed(4)}));
  color *= 1.0 - 0.55 * band;
  color = mix(color, text.rgb, text.a);`
    : ""
}
  fragColor = vec4(color, 1.0);
}
`
  }
];
