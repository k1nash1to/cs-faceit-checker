import type { LookupResponse } from './types';

export class ApiError extends Error {
  readonly hint: string | null;

  constructor(message: string, hint: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.hint = hint;
  }
}

type LookupOptions = {
  signal?: AbortSignal;
};

export async function lookup(query: string, options: LookupOptions = {}): Promise<LookupResponse> {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`/api/lookup?${params.toString()}`, {
    signal: options.signal,
    headers: { accept: 'application/json' },
  });

  const payload = (await res.json().catch(() => null)) as
    | (Partial<LookupResponse> & { error?: string; hint?: string })
    | null;

  if (!res.ok || !payload?.steamId64) {
    throw new ApiError(payload?.error ?? 'Не удалось получить данные', payload?.hint ?? null);
  }

  return payload as LookupResponse;
}
