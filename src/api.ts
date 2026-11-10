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
  matches?: number;
};

export async function lookup(query: string, options: LookupOptions = {}): Promise<LookupResponse> {
  const params = new URLSearchParams({ q: query });
  if (options.matches) params.set('matches', String(options.matches));
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

// ── Жалобы ─────────────────────────────────────────────────────────────────

const DEVICE_KEY = 'cs-faceit:device';

/** Анонимный идентификатор устройства: нужен, чтобы жалоба ушла один раз. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && existing.length >= 8) return existing;

    const created = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    // приватный режим без localStorage — жалоба всё равно уйдёт, просто без дедупа
    return crypto.randomUUID();
  }
}

export type ReportReason = 'cheats' | 'smurf' | 'toxic' | 'other';

export type ReportPayload = {
  steamId64: string;
  nickname: string | null;
  matchId: string | null;
  reason: ReportReason;
  comment: string;
};

export type ReportResult = { ok: boolean; duplicate?: boolean };

export async function submitReport(payload: ReportPayload): Promise<ReportResult> {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ ...payload, deviceId: getDeviceId() }),
  });

  const data = (await res.json().catch(() => null)) as
    | { error?: string; hint?: string; duplicate?: boolean }
    | null;

  if (res.status === 201) return { ok: true };
  if (res.status === 409 || data?.duplicate) return { ok: false, duplicate: true };

  throw new ApiError(data?.error ?? 'Не удалось отправить жалобу', data?.hint ?? null);
}
