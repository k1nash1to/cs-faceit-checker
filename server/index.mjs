/**
 * API-сервер.
 *
 * В dev-режиме Vite проксирует /api сюда, в проде этот же процесс раздаёт
 * собранный dist/. Ключи API живут только здесь и в браузер не попадают.
 */
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

import { FORCE_DEMO, HAS_FACEIT, HAS_STEAM, MATCH_LIMIT, PORT, ROOT } from './config.mjs';
import { UpstreamError, UserInputError } from './errors.mjs';
import { buildLookup } from './lookup.mjs';

const app = express();
app.disable('x-powered-by');
// На Render (и любом reverse-proxy) реальный IP приходит в X-Forwarded-For.
// Без этого rate limit считал бы всех клиентов одним IP прокси.
app.set('trust proxy', 1);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Слушаем все интерфейсы: Render (и Docker) обращаются к контейнеру снаружи,
// а не через loopback.
const HOST = process.env.HOST ?? '0.0.0.0';

// ── Простой rate limit: 60 запросов в минуту с одного IP ────────────────────
const buckets = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const bucket = buckets.get(ip) ?? { count: 0, resetAt: now + 60_000 };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 60_000;
  }

  bucket.count += 1;
  buckets.set(ip, bucket);

  if (buckets.size > 5_000) buckets.clear();

  if (bucket.count > 60) {
    return res.status(429).json({
      error: 'Слишком много запросов',
      hint: 'Подождите минуту и попробуйте снова.',
    });
  }

  return next();
}

app.use('/api', rateLimit);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    steamKey: HAS_STEAM,
    faceitKey: HAS_FACEIT,
    demoForced: FORCE_DEMO,
  });
});

app.get('/api/lookup', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const limit = clamp(Number.parseInt(String(req.query.matches ?? ''), 10) || MATCH_LIMIT, 1, 30);
  // Без ключей сразу отдаём демо — так сайт можно открыть и посмотреть без настройки.
  const demo = req.query.demo === '1' || FORCE_DEMO || (!HAS_STEAM && !HAS_FACEIT);

  try {
    const payload = await buildLookup({ q, limit, demo });
    res.setHeader('cache-control', 'no-store');
    res.json(payload);
  } catch (err) {
    sendError(res, err);
  }
});

function sendError(res, err) {
  if (err instanceof UserInputError) {
    return res.status(400).json({ error: err.message, hint: err.hint });
  }

  if (err instanceof UpstreamError) {
    const status = err.status === 429 ? 429 : 502;
    return res.status(status).json({
      error: err.service === 'faceit' ? 'FACEIT не ответил' : 'Steam не ответил',
      hint: err.status === 0 ? 'Похоже на таймаут — попробуйте ещё раз.' : `Код ответа ${err.status}.`,
    });
  }

  console.error('[lookup] unexpected error:', err);
  return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}

// ── Статика для продакшена ─────────────────────────────────────────────────
const dist = path.join(ROOT, 'dist');

if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  const flags = [
    `steam=${HAS_STEAM ? 'key' : 'demo'}`,
    `faceit=${HAS_FACEIT ? 'key' : 'demo'}`,
  ].join(' ');
  console.log(`[api] listening on ${HOST}:${PORT}  (${flags})`);
});
