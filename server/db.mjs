/**
 * Низкоуровневое хранилище: одно подключение к Postgres или JSON-файлы.
 *
 * Режим выбирается наличием DATABASE_URL. Файловый режим удобен локально,
 * но на Render free диск эфемерный — данные переживут только рестарт процесса.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { DATABASE_URL, ROOT } from './config.mjs';

export const DATA_DIR = path.join(ROOT, 'data');

let pool = null;
let mode = 'file';

export async function initDb() {
  if (DATABASE_URL) {
    try {
      const { default: pg } = await import('pg');
      pool = new pg.Pool({
        connectionString: DATABASE_URL,
        ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
        max: 4,
      });
      await pool.query('SELECT 1');
      mode = 'postgres';
      console.log('[db] storage: postgres');
      return mode;
    } catch (err) {
      console.error('[db] Postgres недоступен, переключаюсь на файлы:', err.message);
      pool = null;
    }
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  mode = 'file';
  console.log('[db] storage: file (data/*.json)');
  return mode;
}

export const getPool = () => pool;
export const getMode = () => mode;

const queues = new Map();

/**
 * Читает JSON-массив, даёт его изменить и при необходимости сохраняет.
 * Очередь на файл защищает от параллельных записей.
 */
export function withJsonFile(name, worker) {
  const file = path.join(DATA_DIR, `${name}.json`);
  const previous = queues.get(name) ?? Promise.resolve();

  const run = previous.then(async () => {
    let items = [];
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      items = [];
    }

    const outcome = await worker(items);

    if (outcome?.save) {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(file, JSON.stringify(items, null, 2), 'utf8');
    }

    return outcome?.result;
  });

  queues.set(
    name,
    run.catch(() => {}),
  );

  return run;
}
