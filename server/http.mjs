import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleAPI } from "./service.mjs";

const root = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
const headers = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "X-Frame-Options": "DENY",
};
function plain(response, status, text) {
  response.writeHead(status, {
    ...headers,
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(text);
}

export function createAppServer(db, { serveStatic = true } = {}) {
  return createServer(async (incoming, outgoing) => {
    try {
      // Loopback binding plus a Host check prevents accidental network exposure and DNS rebinding.
      const authority = incoming.headers.host || "";
      if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/iu.test(authority))
        return plain(outgoing, 403, "Use the local FeedWise address.");
      const url = new URL(incoming.url || "/", "http://" + authority);
      if (url.pathname.startsWith("/api/")) {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of incoming) {
          bytes += chunk.length;
          if (bytes > 16000) return plain(outgoing, 413, "Request too large.");
          chunks.push(chunk);
        }
        const method = incoming.method || "GET";
        const request = new Request(url, {
          method,
          headers: incoming.headers,
          ...(!["GET", "HEAD"].includes(method)
            ? { body: Buffer.concat(chunks) }
            : {}),
        });
        const result = await handleAPI(request, db);
        outgoing.writeHead(result.status, {
          ...headers,
          ...Object.fromEntries(result.headers),
        });
        outgoing.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      if (!serveStatic) return plain(outgoing, 404, "Not found.");
      if (!["GET", "HEAD"].includes(incoming.method || "GET"))
        return plain(outgoing, 405, "Method not allowed.");
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        return plain(outgoing, 400, "Invalid path.");
      }
      const filename = path.resolve(root, "." + pathname);
      if (filename !== root && !filename.startsWith(root + path.sep))
        return plain(outgoing, 403, "Invalid path.");
      let target = filename;
      try {
        if (!(await stat(target)).isFile())
          target = path.join(root, "index.html");
      } catch {
        if (path.extname(pathname)) return plain(outgoing, 404, "Not found.");
        target = path.join(root, "index.html");
      }
      const content = await readFile(target);
      outgoing.writeHead(200, {
        ...headers,
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
      });
      outgoing.end(incoming.method === "HEAD" ? undefined : content);
    } catch {
      if (!outgoing.headersSent)
        plain(
          outgoing,
          503,
          "FeedWise is unavailable. Check the terminal; run npm run build if this is the first start.",
        );
      else outgoing.end();
    }
  });
}
