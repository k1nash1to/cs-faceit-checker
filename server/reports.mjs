/**
 * Жалобы.
 *
 * Приватные: публично нигде не показываются, доступны только в админке.
 * «Одна жалоба с устройства на игрока» гарантируется на уровне БД:
 * UNIQUE (target_steam_id, reporter_hash).
 */
import { createHash, randomUUID } from 'node:crypto';

import { REPORT_SALT } from './config.mjs';
import { getMode, getPool, withJsonFile } from './db.mjs';

export const REASONS = {
  cheats: 'Читы',
  smurf: 'Смурф / смесинг',
  toxic: 'Токсичность',
  other: 'Другое',
};

export async function initReports() {
  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
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
  }

  return getMode();
}

const hashDevice = (deviceId) =>
  createHash('sha256').update(`${deviceId}:${REPORT_SALT}`).digest('hex').slice(0, 40);

export async function addReport({ targetSteamId, targetNickname, matchId, reason, comment, deviceId }) {
  const reporterHash = hashDevice(deviceId);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
    try {
      await pool.query(
        `INSERT INTO reports (id, target_steam_id, target_nickname, match_id, reason, comment, reporter_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, targetSteamId, targetNickname, matchId, reason, comment, reporterHash, createdAt],
      );
      return { ok: true, id };
    } catch (err) {
      if (err.code === '23505') return { ok: false, duplicate: true };
      throw err;
    }
  }

  return withJsonFile('reports', (reports) => {
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
  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
    const { rows } = await pool.query(
      `SELECT id, target_steam_id, target_nickname, match_id, reason, comment, created_at, status
       FROM reports ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  return withJsonFile('reports', (reports) => ({
    result: reports
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, limit),
  }));
}
