/**
 * Маленький HTTP-клиент для внешних API.
 *
 * - таймаут на каждый запрос (Steam и FACEIT иногда отвечают очень долго);
 * - один повтор на 429/5xx — этого достаточно, чтобы пережить случайный сбой,
 *   но не превратить запрос пользователя в штурм чужого API.
 */
import { UpstreamError } from './errors.mjs';

const DEFAULT_TIMEOUT = 10_000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getJson(url, { headers = {}, timeoutMs = DEFAULT_TIMEOUT, service = 'upstream' } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', ...headers },
        signal: controller.signal,
      });

      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        lastError = new UpstreamError(service, res.status, data);
        if (RETRYABLE.has(res.status) && attempt === 0) {
          await sleep(400);
          continue;
        }
        throw lastError;
      }

      return data;
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      if (err?.name === 'AbortError') {
        lastError = new UpstreamError(service, 0, 'timeout');
        if (attempt === 0) {
          await sleep(300);
          continue;
        }
        throw lastError;
      }
      lastError = new UpstreamError(service, 0, err?.message ?? 'network error');
      if (attempt === 0) {
        await sleep(300);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new UpstreamError(service, 0);
}
