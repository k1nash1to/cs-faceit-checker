/**
 * Конфигурация приложения.
 *
 * Ключи читаются из окружения или из файла `.env` в корне проекта.
 * Ни один ключ никогда не попадает в браузер: всё общение с Steam и FACEIT
 * идёт через серверный прокси.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // битый .env не должен ронять сервер — просто работаем на переменных окружения
  }
}

const int = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const ROOT = root;
export const PORT = int(process.env.PORT, 8787);

export const STEAM_KEY = String(process.env.STEAM_API_KEY ?? '').trim();
export const FACEIT_KEY = String(process.env.FACEIT_API_KEY ?? '').trim();

export const HAS_STEAM = STEAM_KEY.length > 0;
export const HAS_FACEIT = FACEIT_KEY.length > 0;

export const MATCH_LIMIT = Math.min(Math.max(int(process.env.MATCH_LIMIT, 12), 1), 30);
export const FORCE_DEMO = /^(1|true|yes)$/i.test(String(process.env.DEMO ?? ''));

// ── Жалобы ────────────────────────────────────────────────────────────────
// Строка подключения к Postgres (Neon, Render, Supabase — любой).
// Не задана → жалобы пишутся в data/reports.json (переживает рестарт только локально).
export const DATABASE_URL = String(process.env.DATABASE_URL ?? '').trim();

// Секрет для страницы /admin?token=... Придумай длинную случайную строку.
export const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN ?? '').trim();

// Соль для хеширования идентификатора устройства жалобщика.
export const REPORT_SALT = String(process.env.REPORT_SALT ?? '').trim() || 'cs-faceit-checker-salt';
