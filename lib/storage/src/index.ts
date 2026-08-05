import { createHash, createHmac } from 'crypto';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { dirname, join } from 'path';
import { Readable } from 'stream';

export interface StorageConfig {
  STORAGE_DRIVER: 'local' | 's3';
  STORAGE_LOCAL_PATH?: string;
  STORAGE_PUBLIC_BASE_URL: string;
  STORAGE_SIGNING_SECRET: string;
}

export interface PutRequest {
  key: string;
  contentType: string;
  body: Buffer | Readable;
  sizeBytes: number;
  metadata?: Record<string, unknown>;
}

export interface PutResponse {
  key: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface GetResponse {
  contentType: string;
  sizeBytes: number;
  body: Readable | Buffer;
}

export interface SignedUrlResponse {
  url: string;
  expiresAt: Date;
}

export interface StorageDriver {
  name: string;
  put(req: PutRequest): Promise<PutResponse>;
  get(key: string): Promise<GetResponse>;
  delete(key: string): Promise<void>;
  signedGetUrl(key: string, expiresInSeconds: number): Promise<SignedUrlResponse>;
}

class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private basePath: string;
  private publicBaseUrl: string;
  private signingSecret: string;

  constructor(config: StorageConfig) {
    this.basePath = config.STORAGE_LOCAL_PATH || './storage';
    this.publicBaseUrl = config.STORAGE_PUBLIC_BASE_URL;
    this.signingSecret = config.STORAGE_SIGNING_SECRET;
  }

  async put(req: PutRequest): Promise<PutResponse> {
    const filePath = join(this.basePath, req.key);
    const dirPath = dirname(filePath);
    await mkdir(dirPath, { recursive: true });

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (req.body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of req.body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    } else {
      buffer = Buffer.from(req.body);
    }

    await writeFile(filePath, buffer);

    const hash = createHash('sha256');
    hash.update(buffer);
    const checksumSha256 = hash.digest('hex');

    return {
      key: req.key,
      sizeBytes: buffer.length,
      checksumSha256,
    };
  }

  async get(key: string): Promise<GetResponse> {
    const filePath = join(this.basePath, key);
    try {
      const body = await readFile(filePath);
      return {
        contentType: 'application/octet-stream',
        sizeBytes: body.length,
        body,
      };
    } catch (err) {
      throw new Error(`File not found: ${key}`);
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath, key);
    try {
      await unlink(filePath);
    } catch (err) {
      // Best-effort
    }
  }

  async signedGetUrl(key: string, expiresInSeconds: number): Promise<SignedUrlResponse> {
    const now = Date.now();
    const expiresAt = new Date(now + expiresInSeconds * 1000);
    const expires = Math.floor(expiresAt.getTime() / 1000);

    const sig = createHmac('sha256', this.signingSecret)
      .update(`${key}:${expires}`)
      .digest('hex');

    const url = `${this.publicBaseUrl}/${key}?e=${expires}&s=${sig}`;
    return { url, expiresAt };
  }
}

export function createStorageDriver(config: StorageConfig): StorageDriver {
  if (config.STORAGE_DRIVER === 'local') {
    return new LocalStorageDriver(config);
  }
  throw new Error(`Unsupported storage driver: ${config.STORAGE_DRIVER}`);
}

export function verifySignature(secret: string, key: string, expires: number, sig: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (expires <= now) return false;
  const expected = createHmac('sha256', secret)
    .update(`${key}:${expires}`)
    .digest('hex');
  return expected === sig;
}

export default createStorageDriver;
