import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

export class StorageError extends Error {
  readonly code = "SUPABASE_STORAGE_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export interface UploadFileInput {
  fileContent: Uint8Array | string;
  fileName: string;
  contentType?: string;
}

export interface UploadResult {
  key: string;
  fileName: string;
  size: number;
  contentType: string;
  reviewStatus: "active";
}

let client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (client) return client;
  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    throw new StorageError("Supabase Storage is not configured. Set SUPABASE_URL and the server-only SUPABASE_SECRET_KEY.");
  }
  client = createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

function safeObjectKey(input: string): string {
  const key = input.replace(/^\/+/, "");
  if (!key || key.length > 512 || !key.startsWith("products/") || key.split("/").includes("..") || key.includes("\\")) {
    throw new StorageError("Invalid storage object key.");
  }
  const slash = key.lastIndexOf("/");
  const dot = key.lastIndexOf(".");
  const suffix = randomUUID().slice(0, 8);
  return dot > slash ? `${key.slice(0, dot)}-${suffix}${key.slice(dot)}` : `${key}-${suffix}`;
}

export const storage = {
  async uploadFile(input: UploadFileInput): Promise<UploadResult> {
    const body = typeof input.fileContent === "string"
      ? new TextEncoder().encode(input.fileContent)
      : input.fileContent;
    if (!body.byteLength || body.byteLength > 8 * 1024 * 1024) {
      throw new StorageError("Images must be between 1 byte and 8 MB.");
    }
    const key = safeObjectKey(input.fileName);
    const contentType = input.contentType ?? "application/octet-stream";
    const { data, error } = await getClient().storage.from(env.supabaseStorageBucket).upload(key, body, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw new StorageError(`Supabase Storage upload failed: ${error.message}`);
    return {
      key: data.path,
      fileName: data.path.split("/").at(-1) ?? data.path,
      size: body.byteLength,
      contentType,
      reviewStatus: "active",
    };
  },

  async getPresignedUrl(input: { key: string }): Promise<{ key: string; url: string; expireTime: string }> {
    const key = input.key;
    if (!key || key.length > 512 || !key.startsWith("products/") || key.split("/").includes("..") || key.includes("\\")) {
      throw new StorageError("Invalid storage object key.");
    }
    const expiresIn = 60 * 10;
    const { data, error } = await getClient().storage.from(env.supabaseStorageBucket).createSignedUrl(key, expiresIn);
    if (error || !data?.signedUrl) {
      throw new StorageError(`Supabase Storage URL signing failed: ${error?.message ?? "No signed URL returned"}`);
    }
    return { key, url: data.signedUrl, expireTime: new Date(Date.now() + expiresIn * 1000).toISOString() };
  },
};
