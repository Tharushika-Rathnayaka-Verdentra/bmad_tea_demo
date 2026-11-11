import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

export const LOG_PREFIX = '[testrail-jira-reporter]';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: string,
  ) {
    super(`HTTP ${status} from ${url}: ${body.slice(0, 500)}`);
    this.name = 'HttpError';
  }
}

export interface JsonRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export function basicAuthHeader(user: string, secret: string): string {
  return `Basic ${Buffer.from(`${user}:${secret}`).toString('base64')}`;
}

export async function requestJson<T>(url: string, options: JsonRequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, timeoutMs = 30_000 } = options;
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, url, text);
  }
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function uploadFile<T>(
  url: string,
  filePath: string,
  fieldName: string,
  headers: Record<string, string>,
  contentType = 'application/octet-stream',
  timeoutMs = 60_000,
  fileName = basename(filePath),
): Promise<T> {
  const form = new FormData();
  form.append(fieldName, new Blob([readFileSync(filePath)], { type: contentType }), fileName);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, url, text);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

export function warn(message: string, error?: unknown): void {
  const detail = error instanceof Error ? ` ${error.message}` : error ? ` ${String(error)}` : '';
  console.warn(`${LOG_PREFIX} ${message}${detail}`);
}

export function info(message: string): void {
  console.log(`${LOG_PREFIX} ${message}`);
}
