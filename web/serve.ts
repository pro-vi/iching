// Dev server for the wterm cast-playback experiment.
// Bundles main.ts (browser target, embedded wterm WASM) and serves the page,
// the wterm stylesheet, and the recording JSON.

import { resolve } from "node:path";

const ROOT = import.meta.dir;
const PORT = 4178;

async function bundleMain(): Promise<string> {
  const built = await Bun.build({
    entrypoints: [resolve(ROOT, "main.ts")],
    target: "browser",
    minify: false,
  });
  if (!built.success) {
    throw new AggregateError(built.logs, "main.ts bundle failed");
  }
  return built.outputs[0].text();
}

let mainJs = await bundleMain();
const wtermCss = await Bun.file(
  resolve(ROOT, "node_modules/@wterm/dom/src/terminal.css"),
).text();

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);

    if (pathname === "/") {
      return new Response(Bun.file(resolve(ROOT, "index.html")));
    }
    if (pathname === "/main.js") {
      // Rebuild each load so edits to main.ts show up on refresh.
      mainJs = await bundleMain();
      return new Response(mainJs, {
        headers: { "content-type": "text/javascript" },
      });
    }
    if (pathname === "/wterm.css") {
      return new Response(wtermCss, {
        headers: { "content-type": "text/css" },
      });
    }
    if (pathname.startsWith("/recordings/")) {
      const file = Bun.file(resolve(ROOT, pathname.slice(1)));
      if (await file.exists()) {
        return new Response(file, {
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`iching cast playback → http://localhost:${server.port}`);
