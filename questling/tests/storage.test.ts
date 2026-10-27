import { readFileSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkImage, checkVideo, checkVoice } from "@/lib/server/media-check";
import { checkPresigned, presign } from "@/lib/server/sigv4";
import { deleteObject, downloadUrl, headObject, readObject, uploadUrl } from "@/lib/server/storage";
import { FAKE_CREDENTIALS, startFakeS3 } from "../scripts/fake-s3";

// Gate B (docs/features-audit.md): signed URLs for S3-compatible storage (Backblaze B2), the check of
// what an upload really is, and the round trip through a stand-in that verifies signatures as B2 does.

const fixture = (name: string) => new Uint8Array(readFileSync(path.join("tests/fixtures/video", name)));

describe("SigV4 presigned URLs", () => {
  it("match AWS's published example", () => {
    const url = presign(
      { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1" },
      {
        method: "GET",
        url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
        expires: 86400,
        now: new Date("2013-05-24T00:00:00Z"),
      },
    );
    expect(new URL(url).searchParams.get("X-Amz-Signature")).toBe("aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });

  it("are refused when expired, altered, signed by another key, or sent with another content type", () => {
    const creds = FAKE_CREDENTIALS;
    const now = new Date("2026-10-26T12:00:00Z");
    const put = presign(creds, {
      method: "PUT",
      url: new URL("http://s3.local/b/voice/a.webm"),
      expires: 600,
      now,
      headers: { "content-type": "audio/webm" },
    });
    expect(checkPresigned(creds, "PUT", new URL(put), { "content-type": "audio/webm" }, now)).toBeNull();
    expect(checkPresigned(creds, "PUT", new URL(put), { "content-type": "audio/webm" }, new Date(now.getTime() + 601_000))).toBe("expired");
    expect(checkPresigned(creds, "PUT", new URL(put), { "content-type": "video/mp4" }, now)).toBe("signature");
    expect(checkPresigned(creds, "GET", new URL(put), {}, now)).toBe("signature");
    expect(checkPresigned(creds, "PUT", new URL(put.replace("a.webm", "b.webm")), { "content-type": "audio/webm" }, now)).toBe("signature");
    expect(checkPresigned({ ...creds, accessKeyId: "other" }, "PUT", new URL(put), { "content-type": "audio/webm" }, now)).toBe(
      "credential",
    );
  });
});

describe("what an upload really is", () => {
  it("takes MP4 H.264/AAC (moov first or last) and WebM VP9/Opus, with duration and size", async () => {
    for (const name of ["ok.mp4", "ok-moov-end.mp4", "ok.webm"]) {
      const checked = await checkVideo(fixture(name));
      expect(checked).toMatchObject({ ok: true });
      if (checked.ok) expect(checked.durationMs).toBeGreaterThan(2900);
    }
    expect(await checkVideo(fixture("ok.webm"))).toMatchObject({ ok: true, mime: "video/webm", width: 320, height: 180 });
  });

  it("refuses MOV, HEVC, over a minute, audio posing as video, and junk — each with its reason", async () => {
    expect(await checkVideo(fixture("clip.mov"))).toEqual({ ok: false, reason: "type" });
    expect(await checkVideo(fixture("hevc.mp4"))).toEqual({ ok: false, reason: "codec" });
    expect(await checkVideo(fixture("long.mp4"))).toEqual({ ok: false, reason: "duration" });
    expect(await checkVideo(fixture("voice.m4a"))).toMatchObject({ ok: false });
    expect(await checkVideo(new Uint8Array(1000))).toEqual({ ok: false, reason: "type" });
    expect(await checkVideo(new Uint8Array(26 * 1024 * 1024))).toEqual({ ok: false, reason: "too_large" });
  });

  it("takes the voice formats browsers record (WebM/Opus, MP4/AAC) and nothing with a picture", async () => {
    expect(await checkVoice(fixture("voice.webm"))).toMatchObject({ ok: true, mime: "audio/webm" });
    expect(await checkVoice(fixture("voice.m4a"))).toMatchObject({ ok: true, mime: "audio/mp4" });
    expect(await checkVoice(fixture("ok.mp4"))).toEqual({ ok: false, reason: "codec" });
    expect(await checkVoice(fixture("clip.mov"))).toEqual({ ok: false, reason: "type" });
  });

  it("reads image sizes from PNG, JPEG and WebP headers", () => {
    expect(checkImage(new Uint8Array(readFileSync("public/images/forest.webp")))).toMatchObject({
      ok: true,
      mime: "image/webp",
      width: 1408,
      height: 768,
    });
    expect(checkImage(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toEqual({ ok: false, reason: "type" });
  });
});

describe("storage round trip (stand-in that checks signatures like B2)", () => {
  const dir = path.resolve(".tmp/test-media");
  let server: Server;
  beforeAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    server = await startFakeS3({ port: 54391, dir, bucket: "test-bucket" });
    Object.assign(process.env, {
      MEDIA_S3_ENDPOINT: "http://localhost:54391",
      MEDIA_S3_REGION: FAKE_CREDENTIALS.region,
      MEDIA_S3_BUCKET: "test-bucket",
      MEDIA_S3_ACCESS_KEY_ID: FAKE_CREDENTIALS.accessKeyId,
      MEDIA_S3_SECRET_ACCESS_KEY: FAKE_CREDENTIALS.secretAccessKey,
    });
  });
  afterAll(() => {
    server?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("uploads with the signed type and length only, reads back with ranges, deletes", async () => {
    const bytes = fixture("voice.webm");
    const put = uploadUrl("voice/u1/take.webm", "audio/webm", bytes.length);
    expect((await fetch(put, { method: "PUT", body: Buffer.from(bytes), headers: { "content-type": "video/mp4" } })).status).toBe(403);
    // A bigger file than declared is refused by storage itself (the length is signed).
    const bigger = Buffer.concat([Buffer.from(bytes), Buffer.alloc(10_000)]);
    expect((await fetch(put, { method: "PUT", body: bigger, headers: { "content-type": "audio/webm" } })).status).toBe(403);
    expect(await headObject("voice/u1/take.webm")).toBeNull();
    expect((await fetch(put, { method: "PUT", body: Buffer.from(bytes), headers: { "content-type": "audio/webm" } })).status).toBe(200);
    expect(await headObject("voice/u1/take.webm")).toEqual({ size: bytes.length, contentType: "audio/webm" });
    expect(await readObject("voice/u1/take.webm", 10_000_000)).toEqual(bytes);
    await expect(readObject("voice/u1/take.webm", 10)).rejects.toThrow(/larger/);
    const ranged = await fetch(downloadUrl("voice/u1/take.webm"), { headers: { range: "bytes=0-9" } });
    expect(ranged.status).toBe(206);
    expect((await ranged.arrayBuffer()).byteLength).toBe(10);
    // A download link opens only its own object.
    expect((await fetch(downloadUrl("voice/u1/take.webm").replace("take.webm", "other.webm"))).status).toBe(403);
    await deleteObject("voice/u1/take.webm");
    expect(await headObject("voice/u1/take.webm")).toBeNull();
    await deleteObject("voice/u1/take.webm"); // gone already: fine
  });
});
