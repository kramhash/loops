import { glsl, type PassOptions } from "@frapx/fx-passes";
import { BLOOM, BLOOM_LEVELS, bloomPasses } from "./bloom.glsl";

export type FinishOptions = {
  /** Seconds in the loop, which seeds the dither so the last frame wraps to the first. */
  loopSeconds: number;
  /** How much of the bloom is added back. */
  bloomStrength?: number;
  /** How far the corners darken, 0–1. */
  vignette?: number;
};

/**
 * Everything after the linear-light `scene` pass, once per frame on the mean
 * of its samples: bloom (see bloom.glsl.ts), then `display` adds it and applies
 * the vignette, an ACES tone curve and dither.
 */
export const finishPasses = ({ loopSeconds, bloomStrength = 0.5, vignette = 0.42 }: FinishOptions): PassOptions[] => [
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

const float LOOP_SECONDS = ${loopSeconds.toFixed(4)};

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
  color += texture(u_${BLOOM}, v_uv).rgb * ${(bloomStrength / BLOOM_LEVELS).toFixed(5)};
  color *= 1.0 - ${vignette.toFixed(3)} * smoothstep(0.18, 0.82, length(v_uv - 0.5));
  color = aces(color);
  float phase = fract(u_frameTime / LOOP_SECONDS);
  color += u_dither * (hash31(vec3(gl_FragCoord.xy, phase * 97.0)) - 0.5) / 255.0;
  fragColor = vec4(pow(max(color, 0.0), vec3(0.4545)), 1.0);
}
`
  }
];
