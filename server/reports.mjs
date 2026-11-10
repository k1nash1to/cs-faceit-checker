/**
 * Хранилище жалоб.
 *
 * Жалобы приватные: публично нигде не показываются, доступны только по
 * /admin?token=<ADMIN_TOKEN>.
 *
 * Два режима:
 *   - DATABASE_URL задан  → Postgres, данные переживают рестарт и деплой;
 *   - не задан            → data/reports.json, удобно локально, но на Render
 *                           free диск эфемерный и файл пропадёт при рестарте.
 *
 * «Одна жалоба с устройства на игрока» гарантируется на уровне БД:
 * UNIQUE (target_steam_id, reporter_hash). Идентификатор устройства приходит
 * с клиента (localStorage) и хешируется с солью — сырой id не храним.
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { DATABASE_URL, REPORT_SALT, ROOT } from './config.mjs';

const DATA_DIR = path.join(ROOT, 'data');
const FILE_PATH = path.join(DATA_DIR, 'reports.json');

export const REASONS = {
  cheats: 'Читы',
  smurf: 'Смурф / смесинг',
  toxic: 'Токсичность',
  other: 'Другое',
};

let pool = null;
let storage = 'file';
let fileChain = Promise.resolve();

export const getStorageMode = () => storage;

export async function initReports() {
  if (DATABASE_URL) {
    try {
      const { default: pg } = await import('pg');
      pool = new pg.Pool({
        connectionString: DATABASE_URL,
        ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
        max: 4,
      });

      await pool.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          target_steam_id TEXT NOT NULL,
          target_nickname TEXT,
          match_id TEXT,
          reason TEXT NOT NULL,
          comment TEXT,
          reporter_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          status TEXT NOT NULL DEFAULT 'new',
          UNIQUE (target_steam_id, reporter_hash)
        )
      `);

      storage = 'postgres';
      console.log('[reports] storage: postgres');
      return storage;
    } catch (err) {
      console.error('[reports] Postgres недоступен, переключаюсь на файл:', err.message);
      pool = null;
    }
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  storage = 'file';
  console.log('[reports] storage: file (data/reports.json)');
  return storage;
}

const hashDevice = (deviceId) =>
  createHash('sha256').update(`${deviceId}:${REPORT_SALT}`).digest('hex').slice(0, 40);

export async function addReport({ targetSteamId, targetNickname, matchId, reason, comment, deviceId }) {
  const reporterHash = hashDevice(deviceId);
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  if (storage === 'postgres' && pool) {
    try {
      await pool.query(
        `INSERT INTO reports (id, target_steam_id, target_nickname, match_id, reason, comment, reporter_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, targetSteamId, targetNickname, matchId, reason, comment, reporterHash, createdAt],
      );
      return { ok: true, id };
    } catch (err) {
      // 23505 = unique_violation: с этого устройства уже жаловались на игрока
      if (err.code === '23505') return { ok: false, duplicate: true };
      throw err;
    }
  }

  return withFile(async (reports) => {
    const exists = reports.some(
      (item) => item.target_steam_id === targetSteamId && item.reporter_hash === reporterHash,
    );
    if (exists) return { result: { ok: false, duplicate: true } };

    reports.push({
      id,
      target_steam_id: targetSteamId,
      target_nickname: targetNickname,
      match_id: matchId,
      reason,
      comment,
      reporter_hash: reporterHash,
      created_at: createdAt,
      status: 'new',
    });

    return { result: { ok: true, id }, save: true };
  });
}

export async function listReports(limit = 200) {
  if (storage === 'postgres' && pool) {
    const { rows } = await pool.query(
      `SELECT id, target_steam_id, target_nickname, match_id, reason, comment, created_at, status
       FROM reports ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  const reports = await readFileReports();
  return reports
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
}

async function readFileReports() {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFileReports(reports) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(reports, null, 2), 'utf8');
}

/** Последовательная очередь, чтобы параллельные записи не затирали файл. */
function withFile(worker) {
  const run = fileChain.then(async () => {
    const reports = await readFileReports();
    const outcome = await worker(reports);
    if (outcome?.save) await writeFileReports(reports);
    return outcome?.result;
  });
  fileChain = run.catch(() => {});
  return run;
}
