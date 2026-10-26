// Everything a work's page shares: the passes on the stage, the song as its
// clock and its uniforms, the sound button, `?frame=N`, and the render target
// frapx-render drives. A work supplies its passes and uniform sources.
import {
  createPasses,
  type PassOptions,
  type PassesInstance,
  type TextureMap,
  type UniformSource
} from "@frapx/fx-passes";
import { registerRenderTarget } from "@frapx/tool-capture";
import { createSoundtrack } from "./soundtrack";
import "./stage.css";

declare global {
  interface Window {
    // Read by verification scripts.
    __work?: PassesInstance;
    __workTime?: () => number;
  }
}

/** Frame rate of the exported loop, and of `?frame=N`. */
export const FPS = 60;
/** Samples a still frame refines to, and the export's default. */
const SAMPLES = 32;
/** Open shutter as a fraction of the frame interval: 180°. */
const SHUTTER = 0.5;
/** Shorts are vertical: the export's size unless --resolution says otherwise. */
const EXPORT_RESOLUTION: [number, number] = [1080, 1920];

export type WorkOptions = {
  passes: PassOptions[];
  /** Bound in order; a later source wins for the same uniform. */
  sources: UniformSource[];
  /** Textures every pass that declares them can read (such as captions). */
  textures?: TextureMap;
  /** The song the browser plays, and the loop's length in seconds. */
  music: { url: string; seconds: number };
  /**
   * Extra `--set key=value` parameters for frapx-render, applied as uniforms
   * (for example `stage` in a making-of).
   */
  renderUniforms?: readonly string[];
};

export const startWork = ({ passes, sources, textures, music, renderUniforms = [] }: WorkOptions): PassesInstance => {
  const stage = document.querySelector<HTMLElement>("[data-stage]")!;
  const soundButton = document.querySelector<HTMLButtonElement>("[data-sound]")!;
  const errorMessage = document.querySelector<HTMLElement>("[data-error]")!;

  // ?frame=N holds frame N of the 60 fps loop and refines it, to check a frame
  // without rendering it.
  const params = new URLSearchParams(window.location.search);
  const stillFrame = params.has("frame") ? Number(params.get("frame")) : null;
  const holdsFrame = stillFrame !== null && Number.isInteger(stillFrame) && stillFrame >= 0;

  // Set once frapx-render prepares the page, which then always renders at full quality.
  let exporting = false;
  const prefersLightweightRender = (): boolean =>
    window.matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 700;
  const quality = () => (exporting || holdsFrame || !prefersLightweightRender() ? 1 : 0);

  // The page starts silent; the sound button brings the song in where the
  // loop is, and from then on the song's position is the time.
  const soundtrack = createSoundtrack(music.url, music.seconds);

  // While playing, every frame draws one sample. A frame that holds still
  // (reduced motion, ?frame=N) refines to SAMPLES by itself.
  const fx = createPasses({
    target: stage,
    clock: holdsFrame ? "manual" : "realtime",
    timeSource: soundtrack.time,
    // The time wraps every loop, so the last frame + 1 renders exactly like frame 0.
    accumulation: { samples: SAMPLES, shutter: SHUTTER, fps: FPS, loop: music.seconds },
    passes,
    ...(textures !== undefined && { textures }),
    uniforms: { quality: quality(), dither: 1 },
    dpr: () => Math.min(window.devicePixelRatio, prefersLightweightRender() ? 1 : 1.5),
    maxDpr: 1.5,
    respectReducedMotion: true,
    onResize: ({ instance }) => instance.setUniform("quality", quality()),
    onReady: () => {
      stage.classList.add("is-ready");
      soundButton.hidden = holdsFrame;
    },
    onError: (error) => {
      stage.classList.add("is-unsupported");
      errorMessage.hidden = false;
      console.error(error);
    }
  });

  for (const source of sources) fx.bindUniforms(source);

  soundButton.addEventListener("click", () => {
    soundButton.disabled = true;
    soundtrack
      .toggle()
      .then((playing) => soundButton.setAttribute("aria-pressed", String(playing)))
      .catch((error: unknown) => console.error(error))
      .finally(() => {
        soundButton.disabled = false;
      });
  });

  if (holdsFrame) {
    void fx.ready.then(() => {
      fx.setTime(stillFrame / FPS);
      fx.render();
    });
  }

  // frapx-render: --set spp=N samples per frame (default 32), --set shutter=F
  // the open shutter as a fraction of the frame (default 0.5), --set dither=0|1
  // (default on for 8-bit PNG, off for --format png16), plus renderUniforms.
  registerRenderTarget(fx, {
    fps: FPS,
    duration: music.seconds,
    resolution: EXPORT_RESOLUTION,
    prepare({ params: job, fps, format }) {
      const samples = Number(job.spp ?? SAMPLES);
      if (!Number.isInteger(samples) || samples < 1) {
        throw new RangeError(`spp must be a positive integer, got "${job.spp}"`);
      }
      const shutter = job.shutter === undefined ? SHUTTER : Number(job.shutter);
      if (!Number.isFinite(shutter) || shutter < 0 || shutter > 1) {
        throw new RangeError(`shutter must be between 0 and 1, got "${job.shutter}"`);
      }
      const dither = job.dither ?? (format === "png" ? "1" : "0");
      if (dither !== "0" && dither !== "1") {
        throw new RangeError(`dither must be 0 or 1, got "${dither}"`);
      }
      exporting = true;
      fx.setUniforms({ quality: 1, dither: Number(dither) });
      for (const name of renderUniforms) {
        const value = job[name];
        if (value === undefined) continue;
        const number = Number(value);
        if (!Number.isFinite(number)) throw new RangeError(`${name} must be a number, got "${value}"`);
        fx.setUniform(name, number);
      }
      fx.setAccumulation({ samples, shutter, fps });
    }
  });

  window.__work = fx;
  window.__workTime = soundtrack.time;
  return fx;
};
