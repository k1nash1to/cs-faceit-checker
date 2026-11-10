/**
 * API-сервер.
 *
 * В dev-режиме Vite проксирует /api сюда, в проде этот же процесс раздаёт
 * собранный dist/. Ключи API живут только здесь и в браузер не попадают.
 */
import { timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

import { renderAdminPage } from './admin.mjs';
import { ADMIN_TOKEN, FORCE_DEMO, HAS_FACEIT, HAS_STEAM, MATCH_LIMIT, PORT, ROOT } from './config.mjs';
import { UpstreamError, UserInputError } from './errors.mjs';
import { buildLookup } from './lookup.mjs';
import { REASONS, addReport, getStorageMode, initReports, listReports } from './reports.mjs';

const app = express();
app.disable('x-powered-by');
// На Render (и любом reverse-proxy) реальный IP приходит в X-Forwarded-For.
// Без этого rate limit считал бы всех клиентов одним IP прокси.
app.set('trust proxy', 1);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Слушаем все интерфейсы: Render (и Docker) обращаются к контейнеру снаружи,
// а не через loopback.
const HOST = process.env.HOST ?? '0.0.0.0';

// ── Rate limit ─────────────────────────────────────────────────────────────
function makeLimiter({ windowMs, max, error, hint }) {
  const buckets = new Map();

  return (req, res, next) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(ip) ?? { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(ip, bucket);

    if (buckets.size > 5_000) buckets.clear();

    if (bucket.count > max) return res.status(429).json({ error, hint });
    return next();
  };
}

const apiLimiter = makeLimiter({
  windowMs: 60_000,
  max: 60,
  error: 'Слишком много запросов',
  hint: 'Подождите минуту и попробуйте снова.',
});

// Жалобы — реже: 8 попыток за 10 минут с одного IP.
const reportLimiter = makeLimiter({
  windowMs: 10 * 60_000,
  max: 8,
  error: 'Слишком много жалоб',
  hint: 'Подождите несколько минут и попробуйте снова.',
});

app.use('/api', apiLimiter);
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    steamKey: HAS_STEAM,
    faceitKey: HAS_FACEIT,
    demoForced: FORCE_DEMO,
    reports: getStorageMode(),
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

// ── Жалобы (приватные, без публичных счётчиков) ────────────────────────────
app.post('/api/reports', reportLimiter, async (req, res) => {
  const body = req.body ?? {};

  const steamId64 = String(body.steamId64 ?? '').trim();
  if (!/^\d{17}$/.test(steamId64)) {
    return res.status(400).json({ error: 'Некорректный Steam ID' });
  }

  const reason = String(body.reason ?? '');
  if (!Object.hasOwn(REASONS, reason)) {
    return res.status(400).json({ error: 'Выберите причину жалобы' });
  }

  const deviceId = String(body.deviceId ?? '');
  if (deviceId.length < 8 || deviceId.length > 64) {
    return res.status(400).json({ error: 'Не удалось определить устройство' });
  }

  const nickname = String(body.nickname ?? '').trim().slice(0, 40) || null;
  const comment = String(body.comment ?? '').trim().slice(0, 600);
  const rawMatch = String(body.matchId ?? '').trim();
  const matchId = /^[\w-]{3,80}$/.test(rawMatch) ? rawMatch : null;

  try {
    const result = await addReport({
      targetSteamId: steamId64,
      targetNickname: nickname,
      matchId,
      reason,
      comment,
      deviceId,
    });

    if (!result.ok) {
      return res.status(409).json({
        error: 'С этого устройства уже отправляли жалобу на этого игрока',
        duplicate: true,
      });
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[reports] insert failed:', err);
    return res.status(500).json({ error: 'Не удалось сохранить жалобу' });
  }
});

app.get('/admin', async (req, res) => {
  res.setHeader('x-robots-tag', 'noindex, nofollow');

  if (!ADMIN_TOKEN) {
    return res.status(503).type('text/plain').send('ADMIN_TOKEN не задан в переменных окружения.');
  }
  if (!tokenMatches(req.query.token)) {
    return res.status(401).type('text/plain').send('Неверный токен.');
  }

  try {
    const reports = await listReports(200);
    res.type('html').send(renderAdminPage(reports, { storage: getStorageMode() }));
  } catch (err) {
    console.error('[admin] read failed:', err);
    res.status(500).type('text/plain').send('Ошибка чтения жалоб.');
  }
});

function tokenMatches(provided) {
  const a = Buffer.from(String(provided ?? ''));
  const b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

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

await initReports();

app.listen(PORT, HOST, () => {
  const flags = [
    `steam=${HAS_STEAM ? 'key' : 'demo'}`,
    `faceit=${HAS_FACEIT ? 'key' : 'demo'}`,
    `reports=${getStorageMode()}`,
  ].join(' ');
  console.log(`[api] listening on ${HOST}:${PORT}  (${flags})`);
});
