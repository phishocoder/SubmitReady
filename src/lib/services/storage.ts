import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { put } from "@vercel/blob";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env, isBlobConfigured, isS3Configured } from "@/lib/env";

type StoredFile = {
  key: string;
  mimeType: string;
};

export interface StorageProvider {
  put(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredFile>;
  read(params: { key: string }): Promise<Buffer>;
}

class LocalStorageProvider implements StorageProvider {
  async put(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredFile> {
    const filePath = path.join(env.LOCAL_STORAGE_DIR, params.key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, params.body);

    return { key: params.key, mimeType: params.contentType };
  }

  async read(params: { key: string }): Promise<Buffer> {
    const filePath = path.join(env.LOCAL_STORAGE_DIR, params.key);
    return fs.readFile(filePath);
  }
}

class BlobStorageProvider implements StorageProvider {
  async put(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredFile> {
    const response = await put(params.key, params.body, {
      access: "public",
      addRandomSuffix: false,
      contentType: params.contentType,
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    return {
      key: response.url,
      mimeType: params.contentType,
    };
  }

  async read(params: { key: string }): Promise<Buffer> {
    const response = await fetch(params.key, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Blob read failed with status ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
      },
      forcePathStyle: Boolean(env.S3_ENDPOINT),
    });
  }

  async put(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredFile> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );

    return { key: params.key, mimeType: params.contentType };
  }

  async read(params: { key: string }): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: params.key,
      }),
    );

    const stream = response.Body;
    if (!stream || !(stream instanceof Readable)) {
      throw new Error("Failed to read object body from S3.");
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

let storageSingleton: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (storageSingleton) {
    return storageSingleton;
  }

  const shouldUseBlob =
    (isBlobConfigured || process.env.VERCEL === "1") &&
    Boolean(env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN);

  if (shouldUseBlob) {
    storageSingleton = new BlobStorageProvider();
    return storageSingleton;
  }

  if (isS3Configured) {
    storageSingleton = new S3StorageProvider();
    return storageSingleton;
  }

  storageSingleton = new LocalStorageProvider();
  return storageSingleton;
}
