/**
 * API-сервер.
 *
 * В dev-режиме Vite проксирует /api сюда, в проде этот же процесс раздаёт
 * собранный dist/. Ключи API живут только здесь и в браузер не попадают.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

import { flashText, renderLoginPage, renderPanelPage } from './admin.mjs';
import { createAdmin, deleteAdmin, findAdminById, findAdminByLogin, initAdmins, listAdmins, touchAdmin } from './admins.mjs';
import {
  authEnabled,
  clearSessionCookie,
  cookieName,
  createSession,
  parseCookies,
  readSession,
  sessionCookie,
  verifyPassword,
} from './auth.mjs';
import { FORCE_DEMO, HAS_FACEIT, HAS_STEAM, MATCH_LIMIT, PORT, ROOT } from './config.mjs';
import { getMode, initDb } from './db.mjs';
import { UpstreamError, UserInputError } from './errors.mjs';
import { buildLookup } from './lookup.mjs';
import { REASONS, addReport, initReports, listReports } from './reports.mjs';

const app = express();
app.disable('x-powered-by');
// На Render (и любом reverse-proxy) реальный IP приходит в X-Forwarded-For.
// Без этого rate limit считал бы всех клиентов одним IP прокси.
app.set('trust proxy', 1);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Слушаем все интерфейсы: Render (и Docker) обращаются к контейнеру снаружи,
// а не через loopback.
const HOST = process.env.HOST ?? '0.0.0.0';

// Хеш-заглушка: чтобы при несуществующем логине проверка пароля тоже тратила время
// и по скорости ответа нельзя было понять, есть такой админ или нет.
const DUMMY_HASH = `scrypt$${randomBytes(16).toString('hex')}$${randomBytes(64).toString('hex')}`;

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

// Вход в админку: 10 попыток за 10 минут.
const loginBuckets = new Map();
function loginLimiter(req, res, next) {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const bucket = loginBuckets.get(ip) ?? { count: 0, resetAt: now + 10 * 60_000 };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 10 * 60_000;
  }

  bucket.count += 1;
  loginBuckets.set(ip, bucket);

  if (loginBuckets.size > 5_000) loginBuckets.clear();

  if (bucket.count > 10) {
    return res.status(429).type('html').send(renderLoginPage({ error: true, login: '' }));
  }

  return next();
}

app.use('/api', apiLimiter);
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    steamKey: HAS_STEAM,
    faceitKey: HAS_FACEIT,
    demoForced: FORCE_DEMO,
    reports: getMode(),
    adminAuth: authEnabled,
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

// ── Админка ────────────────────────────────────────────────────────────────
app.get('/admin/login', (req, res) => {
  res.setHeader('x-robots-tag', 'noindex, nofollow');

  if (!authEnabled) {
    return res
      .status(503)
      .type('text/plain')
      .send('Админка выключена: задайте ADMIN_PASSWORD (или ADMIN_TOKEN) в переменных окружения.');
  }

  res.type('html').send(
    renderLoginPage({ error: req.query.error === '1', login: String(req.query.login ?? '').slice(0, 32) }),
  );
});

app.post('/admin/login', loginLimiter, async (req, res) => {
  if (!sameOrigin(req)) return res.status(403).type('text/plain').send('Forbidden');
  if (!authEnabled) return res.redirect(303, '/admin/login');

  const login = String(req.body?.login ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  const admin = await findAdminByLogin(login);
  const ok = verifyPassword(password, admin?.password_hash ?? DUMMY_HASH);

  if (!admin || !ok) {
    return res.redirect(303, `/admin/login?error=1&login=${encodeURIComponent(login)}`);
  }

  await touchAdmin(admin.id);
  res.setHeader('set-cookie', sessionCookie(createSession(admin), req.secure));
  return res.redirect(303, '/admin');
});

app.post('/admin/logout', (req, res) => {
  res.setHeader('set-cookie', clearSessionCookie);
  res.redirect(303, '/admin/login');
});

app.get('/admin', async (req, res) => {
  res.setHeader('x-robots-tag', 'noindex, nofollow');

  const me = await currentAdmin(req);
  if (!me) return res.redirect(302, '/admin/login');

  const [reports, admins] = await Promise.all([listReports(200), listAdmins()]);

  res.type('html').send(
    renderPanelPage({
      reports,
      admins,
      me,
      storage: getMode(),
      flash: flashFromQuery(req.query),
    }),
  );
});

app.post('/admin/admins', requireOwner, async (req, res) => {
  const login = String(req.body?.login ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (!/^[a-z0-9_.-]{3,32}$/.test(login) || password.length < 8) {
    return res.redirect(303, '/admin?error=invalid');
  }

  const result = await createAdmin({ login, password });
  if (!result.ok) return res.redirect(303, '/admin?error=taken');

  return res.redirect(303, '/admin?ok=created');
});

app.post('/admin/admins/:id/delete', requireOwner, async (req, res) => {
  const result = await deleteAdmin(String(req.params.id));
  if (!result.ok) return res.redirect(303, `/admin?error=${result.owner ? 'owner' : 'missing'}`);
  return res.redirect(303, '/admin?ok=deleted');
});

/** Текущий админ из подписанного cookie; удалённый админ сессию теряет сразу. */
async function currentAdmin(req) {
  const session = readSession(parseCookies(req.headers.cookie)[cookieName]);
  if (!session) return null;

  const admin = await findAdminById(session.sub);
  if (!admin) return null;

  return { id: admin.id, login: admin.login, role: admin.role };
}

function requireOwner(req, res, next) {
  if (!sameOrigin(req)) return res.status(403).type('text/plain').send('Forbidden');

  currentAdmin(req)
    .then((me) => {
      if (!me) return res.redirect(302, '/admin/login');
      if (me.role !== 'owner') {
        return res.status(403).type('text/plain').send('Управлять админами может только владелец.');
      }
      req.admin = me;
      return next();
    })
    .catch(next);
}

/** Защита от CSRF: для форм сверяем Origin/Referer с хостом. */
function sameOrigin(req) {
  const host = req.headers.host;

  const origin = req.headers.origin;
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = req.headers.referer;
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return true;
}

function flashFromQuery(query) {
  const ok = typeof query.ok === 'string' ? flashText('ok', query.ok) : null;
  if (ok) return { type: 'ok', text: ok };

  const error = typeof query.error === 'string' ? flashText('error', query.error) : null;
  if (error) return { type: 'error', text: error };

  return null;
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

await initDb();
await initReports();
await initAdmins();

app.listen(PORT, HOST, () => {
  const flags = [
    `steam=${HAS_STEAM ? 'key' : 'demo'}`,
    `faceit=${HAS_FACEIT ? 'key' : 'demo'}`,
    `reports=${getMode()}`,
    `admin=${authEnabled ? 'on' : 'off'}`,
  ].join(' ');
  console.log(`[api] listening on ${HOST}:${PORT}  (${flags})`);
});
