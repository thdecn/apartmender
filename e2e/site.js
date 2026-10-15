import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

export async function serveSite() {
  const root = resolve("docs");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
    ".json": "application/json", ".png": "image/png" };
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const path = resolve(root, `.${pathname}`, pathname.endsWith("/") ? "index.html" : "");
    if (!path.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
    try {
      const bytes = await readFile(path);
      response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream",
        "Cache-Control": "no-store" }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((done) => server.close(done)) };
}
