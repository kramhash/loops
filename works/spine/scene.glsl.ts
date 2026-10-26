import { glsl } from "@frapx/fx-passes";
import { raymarch, raymarchCamera } from "@frapx/glsl-raymarch";
import { sdf2d, sdf3d } from "@frapx/glsl-sdf";
import { LOOP_SECONDS } from "../../music/liminal-vein/song";

/** Layers in one loop's height: the column repeats every this many. */
export const LAYERS = 12;

// A column of hexagonal plates stacked on a dark spine, their rims the only
// light. The camera climbs it and circles it once per loop. Through the calm
// the rims glow low; in the drop every kick turns the layers a twelfth of a
// circle, alternate layers the other way, and the hats light single layers.
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
uniform float u_climb;
uniform float u_turns;
uniform float u_hatLayer;

${sdf2d}
${sdf3d}
${raymarchCamera}
${raymarch}

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float FOV = PI * 0.4;
const float LOOP_SECONDS = ${LOOP_SECONDS.toFixed(4)};
const float LAYERS = ${LAYERS.toFixed(1)};
const float LAYER_HEIGHT = 0.9;
const float LOOP_HEIGHT = LAYERS * LAYER_HEIGHT;
const float ORBIT_RADIUS = 5.4;
const float MAX_DISTANCE = 30.0;

const vec3 RIM_COLOR = vec3(0.3, 0.88, 1.0);
const vec3 VEIN_COLOR = vec3(0.78, 0.14, 1.1);

struct SceneSample {
  float dist;
  float material;
  // Distance to the nearest rim, and how strongly that rim shines.
  float rimDistance;
  float rimPower;
  float rimVein;
};

float hash11(float p) {
  return fract(sin(p * 127.1 + 311.7) * 43758.5453123);
}

// The layer's index within the loop, 0 to LAYERS - 1.
float layerId(float k) {
  return mod(k, LAYERS);
}

float layerRadius(float id) {
  return 0.95 + 0.6 * hash11(id + 3.0) + 0.1 * u_pulse * u_drop;
}

// How strongly the layer's rim shines: a few layers carry most of the light,
// every kick flares them all in the drop, and a hat lights its own layer.
float rimPowerOf(float id) {
  float lit = step(0.62, hash11(id + 11.0));
  float base = mix(0.08, 2.8, lit) * mix(1.0, 0.7, u_drop);
  float beat = mix(0.3, 1.4, u_drop) * u_pulse + 3.5 * u_drop * u_flash;
  float hatHere = 1.0 - step(0.5, abs(id - mod(u_hatLayer, LAYERS)));
  return base * (1.0 + 0.2 * u_energy) * (1.0 + beat) + 7.0 * u_hat * hatHere;
}

// Alternate layers turn opposite ways, a twelfth of a circle per kick.
mat2 layerTurn(float k, float id) {
  float direction = mod(k, 2.0) < 0.5 ? 1.0 : -1.0;
  float angle = TAU / 6.0 * hash11(id + 7.0) + direction * u_turns * TAU / 12.0;
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float extrude(float d2, float y, float halfHeight) {
  vec2 e = vec2(d2, abs(y) - halfHeight);
  return min(max(e.x, e.y), 0.0) + length(max(e, 0.0));
}

void layer(vec3 p, float k, inout SceneSample s) {
  float id = layerId(k);
  vec3 q = p - vec3(0.0, k * LAYER_HEIGHT, 0.0);
  q.xz = layerTurn(k, id) * q.xz;
  float radius = layerRadius(id);
  float plate = extrude(abs(frapx_sdHexagon(q.xz, radius - 0.2)) - 0.2, q.y, 0.045);
  float rim = extrude(abs(frapx_sdHexagon(q.xz, radius + 0.03)) - 0.018, q.y, 0.022);
  if (plate < s.dist) {
    s.dist = plate;
    s.material = 0.0;
  }
  if (rim < s.dist) {
    s.dist = rim;
    s.material = 1.0;
  }
  float power = rimPowerOf(id);
  // The light a point gets from rims falls off with distance; keep the
  // nearest in reach, weighted by its power.
  if (rim / max(power, 0.05) < s.rimDistance / max(s.rimPower, 0.05)) {
    s.rimDistance = rim;
    s.rimPower = power;
    s.rimVein = step(abs(id - 7.0), 0.5) * step(0.62, hash11(id + 11.0));
  }
}

SceneSample sampleScene(vec3 p) {
  SceneSample s = SceneSample(1e3, 0.0, 1e3, 0.0, 0.0);
  float k = floor(p.y / LAYER_HEIGHT + 0.5);
  layer(p, k - 1.0, s);
  layer(p, k, s);
  layer(p, k + 1.0, s);
  float spine = length(p.xz) - 0.16;
  if (spine < s.dist) {
    s.dist = spine;
    s.material = 0.0;
  }
  // Each layer turns on its own, so a step may cross into a neighbour's
  // turned shape: shorten it.
  s.dist *= 0.7;
  return s;
}

float frapx_map(vec3 p) {
  return sampleScene(p).dist;
}

struct MarchResult {
  float dist;
  vec3 glow;
};

// Marches by hand, gathering the rims' glow from the distance to them at
// every step.
MarchResult marchArtwork(vec3 ro, vec3 rd) {
  float t = 0.02;
  vec3 glow = vec3(0.0);
  int stepLimit = u_quality > 0.5 ? 160 : 100;
  for (int i = 0; i < 160; i++) {
    if (i >= stepLimit) break;
    SceneSample s = sampleScene(ro + rd * t);
    float stride = max(s.dist, 0.01);
    vec3 color = mix(RIM_COLOR, VEIN_COLOR, s.rimVein);
    glow += color * s.rimPower * exp(-14.0 * s.rimDistance) * min(stride, 0.2) * 0.12;
    if (s.dist < 0.0005 * max(t, 1.0)) return MarchResult(t, glow);
    t += stride;
    if (t > MAX_DISTANCE) break;
  }
  return MarchResult(-1.0, glow);
}

void main() {
  float climb = u_reducedMotion > 0.5 ? 0.3 : fract(u_climb);
  float height = climb * LOOP_HEIGHT;
  float orbit = TAU * climb + 0.6;
  vec3 eye = vec3(ORBIT_RADIUS * cos(orbit), height, ORBIT_RADIUS * sin(orbit));
  vec3 target = vec3(0.0, height + 1.1, 0.0);
  mat3 camera = frapx_lookAt(eye, target, 0.0);
  vec3 rd = frapx_cameraRay(gl_FragCoord.xy + u_jitter, u_resolution, camera, FOV);

  // A faint haze, a little lighter overhead, that far layers fade into.
  vec3 voidColor = mix(vec3(0.0012, 0.0016, 0.0028), vec3(0.003, 0.006, 0.01), smoothstep(-0.2, 0.8, rd.y));
  vec3 color = voidColor;

  MarchResult hit = marchArtwork(eye, rd);
  if (hit.dist > 0.0) {
    vec3 p = eye + rd * hit.dist;
    vec3 n = frapx_normal(p, max(0.0007, 0.0004 * hit.dist));
    SceneSample s = sampleScene(p);
    vec3 toEye = -rd;
    vec3 rimColor = mix(RIM_COLOR, VEIN_COLOR, s.rimVein);
    float occlusion = u_quality > 0.5 ? frapx_ao(p, n, 0.24) : 0.85;
    // Light from the nearest rim, falling off with distance, brighter on
    // faces turned toward the column's edge, plus a wet sheen at grazing angles.
    float reach = s.rimPower * exp(-2.4 * s.rimDistance);
    float facing = 0.35 + 0.65 * max(dot(n, normalize(vec3(p.x, 0.0, p.z) + 1e-4)), 0.0);
    float fresnel = 0.06 + 0.94 * pow(1.0 - max(dot(n, toEye), 0.0), 5.0);
    vec3 shaded = vec3(0.03, 0.036, 0.044) * rimColor * reach * facing * occlusion * 0.6
      + rimColor * reach * fresnel * 0.12;
    if (s.material > 0.5) shaded = rimColor * s.rimPower * 0.9;
    float fog = 1.0 - exp(-0.016 * hit.dist * hit.dist);
    color = mix(shaded, voidColor, fog);
  }
  color += hit.glow * 0.6;
  fragColor = vec4(color, 1.0);
}
`;
