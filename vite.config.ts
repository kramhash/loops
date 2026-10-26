import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// Every works/<name>/index.html is a page, served at /works/<name>/, so
// `frapx-render dist --path /works/<name>/` renders it.
const works = Object.fromEntries(
  readdirSync(resolve(__dirname, "works"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [entry.name, resolve(__dirname, "works", entry.name, "index.html")])
);

export default defineConfig({
  build: {
    rollupOptions: {
      input: { index: resolve(__dirname, "index.html"), ...works }
    }
  }
});
