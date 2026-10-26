/** One caption per stage: its title and the line of code that makes it. */
export const CAPTIONS: readonly { title: string; code: readonly string[] }[] = [
  {
    title: "01  SHAPE",
    code: ["float wall = radius - length(q.xy / scale);", "// a signed distance, marched per pixel"]
  },
  {
    title: "02  NORMALS",
    code: ["vec3 n = frapx_normal(p, eps);", "// the surface's direction, from the field"]
  },
  {
    title: "03  LIGHT",
    code: ["light = RING_COLOR * ringPower * ring.x;", "// lit by the glowing rings alone"]
  },
  {
    title: "04  BLOOM",
    code: ["...bloomPasses(\"scene\"), // 1/2 down to 1/64", "color = aces(color + bloom);"]
  },
  {
    title: "05  RHYTHM",
    code: ["flash: { track: \"kick\", mode: \"pulse\", decay: 35 }", "// a vixeq song, read as frapx uniforms"]
  }
];

/** Pixels of one caption panel; the atlas stacks them top to bottom. */
export const PANEL_WIDTH = 1080;
export const PANEL_HEIGHT = 300;

/**
 * Draws every caption into one canvas, a panel each, for the display pass to
 * pick from: white on transparent, with the credit under each.
 */
export const drawCaptions = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = PANEL_WIDTH;
  canvas.height = PANEL_HEIGHT * CAPTIONS.length;
  const context = canvas.getContext("2d")!;
  const mono = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  CAPTIONS.forEach(({ title, code }, index) => {
    const top = index * PANEL_HEIGHT;
    const left = 72;
    context.fillStyle = "rgba(236, 254, 255, 0.95)";
    context.font = `600 44px ${mono}`;
    context.fillText(title, left, top + 70);
    context.font = `400 30px ${mono}`;
    code.forEach((line, row) => {
      context.fillStyle = line.startsWith("//") ? "rgba(103, 232, 249, 0.75)" : "rgba(236, 254, 255, 0.88)";
      context.fillText(line, left, top + 132 + row * 44);
    });
    context.fillStyle = "rgba(236, 254, 255, 0.5)";
    context.font = `500 24px ${mono}`;
    context.fillText("frapx + vixeq  ·  github.com/kramhash/loops", left, top + 260);
  });
  return canvas;
};
