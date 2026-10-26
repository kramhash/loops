import { glsl } from "@frapx/fx-passes";
import { raymarch, raymarchCamera } from "@frapx/glsl-raymarch";
import { sdf3d, sdfOps } from "@frapx/glsl-sdf";
import { LOOP_SECONDS } from "../../music/liminal-vein/song";

// A single mass of five lobes, smoothly fused, floating in the dark and lit
// only along its rim. Through the calm it breathes; in the drop every kick
// splits it apart along a new axis and it fuses again before the next beat.
// The hats light veins under its skin.
export const scene = glsl`#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_jitter;
uniform float u_reducedMotion;
uniform float u_quality;
// The song (see music/liminal-vein/rhythm.ts and rhythm.ts).
uniform float u_flash;
uniform float u_pulse;
uniform float u_hat;
uniform float u_energy;
uniform float u_drop;
uniform float u_orbit;
uniform float u_split;
uniform float u_splitAxis;

${sdf3d}
${sdfOps}
${raymarchCamera}
${raymarch}

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float FOV = PI * 0.34;
const float LOOP_SECONDS = ${LOOP_SECONDS.toFixed(4)};
const float MAX_DISTANCE = 16.0;
const float GOLDEN_ANGLE = 2.39996323;

const vec3 RIM_COLOR = vec3(0.3, 0.88, 1.0);
const vec3 VEIN_COLOR = vec3(0.78, 0.14, 1.1);

// Rotates about an axis that turns with every kick, so each split goes its
// own way.
mat3 splitFrame() {
  float a = u_splitAxis * GOLDEN_ANGLE;
  float b = u_splitAxis * 1.1;
  float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
  mat3 yaw = mat3(ca, 0.0, -sa, 0.0, 1.0, 0.0, sa, 0.0, ca);
  mat3 pitch = mat3(1.0, 0.0, 0.0, 0.0, cb, sb, 0.0, -sb, cb);
  return yaw * pitch;
}

float breath() {
  return sin(TAU * fract(u_time / LOOP_SECONDS) * 2.0);
}

// The skin's slow folds, in the mass's own space.
float folds(vec3 p) {
  float phase = TAU * fract(u_time / LOOP_SECONDS);
  return 0.045 * sin(5.0 * p.x + phase) * sin(4.0 * p.y - phase) * sin(5.5 * p.z + 2.0 * phase);
}

float massDistance(vec3 p) {
  mat3 frame = splitFrame();
  float spread = mix(0.12, 0.8, u_drop) * u_split + 0.06 * breath();
  float radius = 0.62 + 0.03 * breath() + 0.05 * u_pulse * (1.0 - u_drop);
  // Five lobes: one at the centre, four thrown out along a tetrahedron.
  float d = frapx_sdSphere(p, radius + 0.12);
  const vec3 dirs[4] = vec3[4](
    vec3(1.0, 1.0, 1.0), vec3(-1.0, -1.0, 1.0), vec3(-1.0, 1.0, -1.0), vec3(1.0, -1.0, -1.0)
  );
  for (int i = 0; i < 4; i++) {
    vec3 c = frame * normalize(dirs[i]) * (0.32 + spread);
    d = frapx_opSmoothUnion(d, frapx_sdSphere(p - c, radius), mix(0.5, 0.28, u_split * u_drop));
  }
  return d + folds(p);
}

float frapx_map(vec3 p) {
  // The folds are not an exact distance: shorten the step.
  return massDistance(p) * 0.75;
}

// Veins under the skin: thin bands where two slow fields cross zero.
float veins(vec3 p) {
  float phase = TAU * fract(u_time / LOOP_SECONDS);
  float a = sin(3.1 * p.x + 2.3 * p.y + phase) + sin(2.7 * p.z - 1.9 * p.x);
  float b = sin(2.9 * p.y - 2.1 * p.z - phase) + sin(3.3 * p.x + 1.7 * p.z);
  return exp(-30.0 * abs(a)) * exp(-6.0 * abs(b));
}

void main() {
  float orbit = u_reducedMotion > 0.5 ? 0.15 : fract(u_orbit);
  float angle = TAU * orbit;
  float distance = 4.6 - 0.25 * u_drop - 0.15 * u_drop * u_flash;
  vec3 eye = vec3(distance * sin(angle), 0.55 * sin(TAU * orbit * 2.0), distance * cos(angle));
  mat3 camera = frapx_lookAt(eye, vec3(0.0), 0.0);
  vec3 rd = frapx_cameraRay(gl_FragCoord.xy + u_jitter, u_resolution, camera, FOV);

  vec3 color = vec3(0.0012, 0.0016, 0.0028);

  // March by hand, gathering a halo from how close the ray passes.
  float t = 0.02;
  float halo = 0.0;
  float hit = -1.0;
  int stepLimit = u_quality > 0.5 ? 128 : 80;
  for (int i = 0; i < 128; i++) {
    if (i >= stepLimit) break;
    float d = frapx_map(eye + rd * t);
    halo += exp(-9.0 * max(d, 0.0)) * min(max(d, 0.01), 0.2) * 0.1;
    if (d < 0.0005 * max(t, 1.0)) {
      hit = t;
      break;
    }
    t += max(d, 0.008);
    if (t > MAX_DISTANCE) break;
  }

  float beat = mix(0.4, 1.4, u_drop) * u_pulse + 3.0 * u_drop * u_flash;
  float rimPower = mix(2.2, 1.6, u_drop) * (1.0 + 0.2 * u_energy) * (1.0 + beat);

  if (hit > 0.0) {
    vec3 p = eye + rd * hit;
    vec3 n = frapx_normal(p, max(0.0007, 0.0004 * hit));
    float facing = max(dot(n, -rd), 0.0);
    // Lit only along the rim, where the skin turns away from the eye.
    float rim = pow(1.0 - facing, 3.0);
    float occlusion = u_quality > 0.5 ? frapx_ao(p, n, 0.2) : 0.85;
    vec3 body = vec3(0.012, 0.016, 0.02) * occlusion;
    color = body + RIM_COLOR * rim * rimPower * occlusion;
    color += VEIN_COLOR * veins(p) * (0.25 + 6.0 * u_hat) * (0.4 + 0.6 * u_drop) * facing;
  }
  color += RIM_COLOR * halo * rimPower * 0.35;
  fragColor = vec4(color, 1.0);
}
`;
