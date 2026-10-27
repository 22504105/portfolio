// A small stand-in for S3-compatible storage (Backblaze B2 in production), for local development and
// the tests: PUT, GET (with byte ranges), HEAD and DELETE on path-style URLs, each checked against its
// presigned signature and expiry exactly as the provider would, and the CORS answers a browser needs.
// Objects live in a folder. Never deployed: production talks to the real provider.
//   npx tsx scripts/fake-s3.ts            → http://localhost:54330, objects in .tmp/media
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkPresigned, type Credentials } from "../lib/server/sigv4";

export const FAKE_CREDENTIALS: Credentials = {
  accessKeyId: "local-media-key",
  secretAccessKey: "local-media-secret-not-for-production",
  region: "local",
};

export function startFakeS3(opts: { port: number; dir: string; bucket: string; creds?: Credentials; maxBytes?: number }): Promise<Server> {
  const creds = opts.creds ?? FAKE_CREDENTIALS;
  const maxBytes = opts.maxBytes ?? 64 * 1024 * 1024;
  mkdirSync(opts.dir, { recursive: true });
  const file = (key: string) => path.join(opts.dir, encodeURIComponent(key));
  const server = createServer((req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": req.headers.origin ?? "*",
      "Access-Control-Allow-Methods": "GET, PUT, HEAD",
      "Access-Control-Allow-Headers": "content-type, range",
      "Access-Control-Expose-Headers": "ETag, Content-Length, Content-Range",
      Vary: "Origin",
    };
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors).end();
      return;
    }
    const [, bucket, ...rest] = url.pathname.split("/");
    const key = decodeURIComponent(rest.join("/"));
    if (bucket !== opts.bucket || !key) {
      res.writeHead(404, cors).end();
      return;
    }
    const problem = checkPresigned(creds, req.method ?? "GET", url, {
      "content-type": req.headers["content-type"],
      "content-length": req.headers["content-length"],
    });
    if (problem) {
      res.writeHead(403, { ...cors, "Content-Type": "text/plain" }).end(problem);
      return;
    }
    const target = file(key);
    if (req.method === "PUT") {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on("data", (c: Buffer) => {
        size += c.length;
        if (size <= maxBytes) chunks.push(c);
      });
      req.on("end", () => {
        if (size > maxBytes) return void res.writeHead(413, cors).end();
        writeFileSync(target, Buffer.concat(chunks));
        writeFileSync(`${target}.type`, req.headers["content-type"] ?? "application/octet-stream");
        res.writeHead(200, { ...cors, ETag: `"${size}"` }).end();
      });
      return;
    }
    if (req.method === "DELETE") {
      rmSync(target, { force: true });
      rmSync(`${target}.type`, { force: true });
      res.writeHead(204, cors).end();
      return;
    }
    if (!existsSync(target)) {
      res.writeHead(404, cors).end();
      return;
    }
    const bytes = readFileSync(target);
    const type = readFileSync(`${target}.type`, "utf8");
    const headers = { ...cors, "Content-Type": type, "Accept-Ranges": "bytes" };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    if (req.method === "HEAD") return void res.writeHead(200, { ...headers, "Content-Length": bytes.length }).end();
    if (!range) return void res.writeHead(200, { ...headers, "Content-Length": bytes.length }).end(bytes);
    const start = range[1] ? Number(range[1]) : Math.max(0, bytes.length - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
    if (start > end) return void res.writeHead(416, { ...headers, "Content-Range": `bytes */${bytes.length}` }).end();
    res
      .writeHead(206, { ...headers, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${bytes.length}` })
      .end(bytes.subarray(start, end + 1));
  });
  return new Promise((resolve) => server.listen(opts.port, () => resolve(server)));
}

if (process.argv[1]?.endsWith("fake-s3.ts")) {
  const port = Number(process.env.FAKE_S3_PORT ?? 54330);
  void startFakeS3({ port, dir: path.resolve(".tmp/media"), bucket: "questling-media" }).then(() =>
    console.log(`fake S3 on http://localhost:${port}, bucket questling-media (objects in .tmp/media)`),
  );
}
