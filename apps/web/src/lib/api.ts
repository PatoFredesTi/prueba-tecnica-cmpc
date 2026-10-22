import type { Envelope } from './types';
let token: string | null = null;
let onUnauthorized: (() => void) | undefined;
export function setSession(value: string | null, callback?: () => void) {
  token = value;
  onUnauthorized = callback;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
  }
}
async function response(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (path.startsWith('/auth/')) headers.set('X-Session-Request', '1');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  let result: Response;
  try {
    result = await fetch(`/api/v1${path}`, { ...options, credentials: 'same-origin', headers });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Intenta nuevamente.', 0);
  }
  if (!result.ok) {
    const error = await result.json().catch(() => ({}));
    if (result.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.();
    throw new ApiError(
      error.message || 'No fue posible completar la operación',
      result.status,
      error.requestId,
    );
  }
  return result;
}
export async function api<T>(path: string, options?: RequestInit): Promise<Envelope<T>> {
  return (await response(path, options)).json();
}
export async function exportBooks(params: URLSearchParams) {
  const blob = await (await response(`/books/export.csv?${params}`)).blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cmpc-libros.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function uploadImage(id: string, file: File) {
  const body = new FormData();
  body.set('file', file);
  return api(`/books/${id}/image`, { method: 'POST', body });
}
export function validateImage(file: File): string | undefined {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return 'Usa una imagen JPEG, PNG o WebP.';
  if (file.size > 5 * 1024 * 1024) return 'La imagen debe pesar como máximo 5 MB.';
}

export async function fetchCover(url: string, signal: AbortSignal) {
  const match = /^\/(?:uploads|api\/v1\/files)\/([a-f0-9-]{36}\.webp)$/i.exec(url);
  if (!match) throw new ApiError('Ruta de portada inválida', 400);
  return (await response(`/files/${match[1]}`, { signal })).blob();
}
