// Serves out/<slug>/review.html on this machine only, so a take can be chosen from the page:
//   node scripts/review.mjs <slug> [--port 4400]
// "Bunu seç" posts { n, seed }; `voiceover pick` writes it to spec voiceover.picks and rebuilds vo.wav from the cache
// (no credits). Only JSON posts from the page's own origin are accepted, so another site cannot pick for you.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { ROOT, outDir, requireSlug } from "./lib/video.mjs";

const { positional, flags } = parseArgs(process.argv.slice(2), { port: "number" });
const slug = requireSlug(positional[0]);
const port = flags.port ?? 4400;
const page = path.join(outDir(slug), "review.html");
if (!existsSync(page)) {
  console.error(`${path.relative(ROOT, page)} does not exist — npm run voiceover -- build ${slug} (or npm run align) writes it`);
  process.exit(1);
}
const origin = `http://127.0.0.1:${port}`;

const send = (res, status, type, body) => {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, origin);
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/review.html")) {
    return send(res, 200, "text/html; charset=utf-8", readFileSync(page));
  }
  const wav = /^\/review\/(s\d+-\d+\.wav)$/.exec(url.pathname);
  if (req.method === "GET" && wav) {
    const file = path.join(outDir(slug), "review", wav[1]);
    return existsSync(file) ? send(res, 200, "audio/wav", readFileSync(file)) : send(res, 404, "text/plain", "not found");
  }
  if (req.method === "POST" && url.pathname === "/pick") {
    if (!req.headers["content-type"]?.startsWith("application/json") || (req.headers.origin && req.headers.origin !== origin)) {
      return send(res, 403, "application/json", JSON.stringify({ log: "forbidden" }));
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1000) req.destroy();
    });
    req.on("end", () => {
      let n;
      let seed;
      try {
        ({ n, seed } = JSON.parse(body));
      } catch {
        return send(res, 400, "application/json", JSON.stringify({ log: "bad json" }));
      }
      if (!Number.isInteger(n) || !Number.isInteger(seed)) return send(res, 400, "application/json", JSON.stringify({ log: "n and seed must be integers" }));
      console.log(`pick: sentence ${n} → take ${seed}`);
      const run = spawnSync(process.execPath, [path.join(ROOT, "scripts/voiceover.mjs"), "pick", slug, String(n), String(seed)], { encoding: "utf8" });
      const log = `${run.stdout}${run.stderr}`.trim();
      console.log(log);
      send(res, run.status === 0 ? 200 : 500, "application/json", JSON.stringify({ log: log.slice(-2000) }));
    });
    return;
  }
  send(res, 404, "text/plain", "not found");
});

server.listen(port, "127.0.0.1", () => console.log(`${origin}/  (Ctrl+C to stop)`));
