import { useAuthStore } from '@/stores/auth';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export type ApiSuccess<T> = { success: true; data: T; meta?: Record<string, unknown> };
export type ApiError = {
  success: false;
  error: { code: string; message: { ar: string; en: string }; details?: unknown };
};

async function coreFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }
  if (token) headers.set('authorization', `Bearer ${token}`);

  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const json = (await res.json()) as ApiSuccess<T> | ApiError;
  if (!res.ok || !('success' in json) || !json.success) {
    const err = 'error' in json ? json.error : { code: 'UNKNOWN', message: { en: 'Request failed', ar: 'فشل الطلب' } };
    throw Object.assign(new Error(err.message.en), { code: err.code, bilingual: err.message, status: res.status });
  }
  return json.data;
}

export const api = {
  get:    <T,>(path: string) => coreFetch<T>(path),
  post:   <T,>(path: string, body?: unknown) =>
    coreFetch<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined }),
  patch:  <T,>(path: string, body?: unknown) =>
    coreFetch<T>(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined }),
  delete: <T = void,>(path: string) => coreFetch<T>(path, { method: 'DELETE' }),
};
