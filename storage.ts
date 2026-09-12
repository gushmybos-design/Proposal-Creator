import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { env } from "@/lib/env";

/**
 * File storage for uploaded images (hero backgrounds, image blocks, logos).
 * - Production (Vercel): Vercel Blob — set BLOB_READ_WRITE_TOKEN (created automatically when you
 *   add a Blob store to the project).
 * - Development / no token: writes to ./public/uploads and serves from /uploads/… (not durable on
 *   serverless hosts — only for local use).
 */
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function storeImage(file: File, workspaceId: string): Promise<{ url: string }> {
  if (!ALLOWED.has(file.type)) throw new Error("Only PNG, JPG, WEBP, GIF or SVG images are allowed");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be under 8 MB");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
  const key = `${workspaceId}/${Date.now()}-${nanoid(8)}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`propel/${key}`, file, { access: "public", contentType: file.type, addRandomSuffix: false });
    return { url: blob.url };
  }

  const dir = path.join(process.cwd(), "public", "uploads", workspaceId);
  await mkdir(dir, { recursive: true });
  const filename = key.split("/")[1];
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return { url: `${env.appUrl}/uploads/${workspaceId}/${filename}` };
}
