/** Calling our own API from the browser */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
  }
}

async function handle<T>(response: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // No JSON body
  }
  if (!response.ok) {
    const body = (data ?? {}) as { message?: string; error?: string };
    if (response.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new ApiRequestError(body.message ?? `Request failed (${response.status})`, response.status, body.error ?? 'error');
  }
  return data as T;
}

/** For SWR: `useSWR('/api/v1/...', fetcher)` */
export async function fetcher<T>(url: string): Promise<T> {
  return handle<T>(await fetch(url, { credentials: 'same-origin' }));
}

export async function apiSend<T>(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  return handle<T>(
    await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  );
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
