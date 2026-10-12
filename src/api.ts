export const base = import.meta.env.BASE_URL.replace(/\/$/, '')
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base}/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null)
    throw new Error(
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed (${res.status})`,
    )
  }
  return res.json() as Promise<T>
}
